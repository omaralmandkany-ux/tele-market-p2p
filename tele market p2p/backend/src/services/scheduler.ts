import { dealHelpers, taskHelpers, verificationHelpers, notificationHelpers, walletHelpers, userHelpers } from '../database/db.js';
import telegram from './telegram.js';
import { config } from '../config/env.js';
import crypto from 'crypto';

const VERIFICATION_INTERVAL_MINUTES = 30;
const VERIFICATION_PERIOD_HOURS = 24;
const STALE_DEAL_HOURS = 48;

// =============================================
// Process scheduled tasks
// =============================================
export async function processScheduledTasks(): Promise<void> {
    try {
        const tasks = await taskHelpers.getPending();

        for (const task of tasks) {
            await taskHelpers.markProcessing(task.id);

            try {
                switch (task.type) {
                    case 'auto_post':
                        await handleAutoPost(task.target_id);
                        break;
                    case 'verify_post':
                        await handleVerifyPost(task.target_id);
                        break;
                    case 'timeout_check':
                        await handleTimeoutCheck(task.target_id);
                        break;
                    case 'release_funds':
                        await handleReleaseFunds(task.target_id);
                        break;
                }
                await taskHelpers.complete(task.id, { success: true });
            } catch (error: any) {
                console.error(`Task ${task.id} failed:`, error);
                await taskHelpers.fail(task.id, error.message);
            }
        }
    } catch (error) {
        console.error('Error processing scheduled tasks:', error);
    }
}

// =============================================
// Handle auto-posting
// =============================================
async function handleAutoPost(dealId: number): Promise<void> {
    const deal = await dealHelpers.getById(dealId);

    if (!deal) {
        throw new Error('Deal not found');
    }

    if (deal.status !== 'scheduled') {
        console.log(`Deal ${dealId} is not in scheduled status, skipping auto-post`);
        return;
    }

    // Check if bot is admin
    const isBotAdmin = await telegram.isBotAdmin(deal.channel_telegram_id);
    if (!isBotAdmin) {
        // Notify owner that bot needs admin rights
        await notificationHelpers.create({
            user_id: deal.channel_owner_id,
            type: 'admin_alert',
            title: 'Bot Needs Admin Rights',
            message: `Cannot auto-post to ${deal.channel_title}. Please make sure the bot is an admin.`,
            data: JSON.stringify({ deal_id: dealId }),
        });
        throw new Error('Bot is not admin in channel');
    }

    // Post to channel
    const result = await telegram.postToChannel(
        deal.channel_telegram_id,
        deal.ad_content || '',
        deal.ad_media_url || undefined
    );

    if (!result.success) {
        throw new Error(`Failed to post: ${result.error}`);
    }

    // Create content hash for verification
    const contentHash = crypto
        .createHash('sha256')
        .update(deal.ad_content || '')
        .digest('hex');

    // Create post verification record
    await verificationHelpers.create({
        deal_id: dealId,
        message_id: result.message_id,
        channel_telegram_id: deal.channel_telegram_id,
        content_hash: contentHash,
    });

    // Update deal status
    await dealHelpers.updateStatus(dealId, 'posted', {
        posted_message_id: result.message_id,
        posted_at: new Date().toISOString(),
    });

    // Schedule verification checks
    const now = new Date();
    for (let i = 1; i <= (VERIFICATION_PERIOD_HOURS * 60 / VERIFICATION_INTERVAL_MINUTES); i++) {
        const checkTime = new Date(now.getTime() + i * VERIFICATION_INTERVAL_MINUTES * 60000);
        await taskHelpers.create({
            type: 'verify_post',
            target_id: dealId,
            target_type: 'deal',
            scheduled_at: checkTime.toISOString(),
        });
    }

    // Schedule final fund release
    const releaseTime = new Date(now.getTime() + VERIFICATION_PERIOD_HOURS * 60 * 60000);
    await taskHelpers.create({
        type: 'release_funds',
        target_id: dealId,
        target_type: 'deal',
        scheduled_at: releaseTime.toISOString(),
    });

    // Notify both parties
    await notificationHelpers.create({
        user_id: deal.advertiser_id,
        type: 'post_published',
        title: 'Ad Published! 🚀',
        message: `Your ad has been posted to ${deal.channel_title}`,
        data: JSON.stringify({ deal_id: dealId }),
    });

    await notificationHelpers.create({
        user_id: deal.channel_owner_id,
        type: 'post_published',
        title: 'Ad Published! 🚀',
        message: `Ad has been auto-posted to ${deal.channel_title}`,
        data: JSON.stringify({ deal_id: dealId }),
    });
}

// =============================================
// Handle post verification
// =============================================
async function handleVerifyPost(dealId: number): Promise<void> {
    const deal = await dealHelpers.getById(dealId);

    if (!deal || !['posted', 'verifying'].includes(deal.status)) {
        return;
    }

    const result = await telegram.checkMessageExists(
        deal.channel_telegram_id,
        deal.posted_message_id!
    );

    await verificationHelpers.update(dealId, result.exists, result.modified || false);

    if (!result.exists) {
        // Post was deleted - open dispute
        await dealHelpers.updateStatus(dealId, 'disputed');

        await notificationHelpers.create({
            user_id: deal.advertiser_id,
            type: 'deal_disputed',
            title: '⚠️ Post Deleted',
            message: `The ad on ${deal.channel_title} was deleted before the required time. A dispute has been opened.`,
            data: JSON.stringify({ deal_id: dealId }),
        });

        await notificationHelpers.create({
            user_id: deal.channel_owner_id,
            type: 'deal_disputed',
            title: '⚠️ Dispute Opened',
            message: `Your post was deleted before the required time. This may result in a refund.`,
            data: JSON.stringify({ deal_id: dealId }),
        });
    } else {
        // Update deal to verifying if still posted
        if (deal.status === 'posted') {
            await dealHelpers.updateStatus(dealId, 'verifying', {
                post_verified_count: (deal.post_verified_count || 0) + 1,
                last_verification_at: new Date().toISOString(),
            });
        }
    }
}

// =============================================
// Handle timeout check
// =============================================
async function handleTimeoutCheck(dealId: number): Promise<void> {
    const deal = await dealHelpers.getById(dealId);

    if (!deal) return;

    const staleStatuses = ['pending', 'accepted', 'funded', 'draft_pending', 'draft_rejected'];

    if (!staleStatuses.includes(deal.status)) {
        return;
    }

    // Check if deal has expired
    if (deal.expires_at && new Date(deal.expires_at) < new Date()) {
        await handleDealExpiry(deal);
        return;
    }

    // Check for stale deals
    const lastActivity = new Date(deal.last_activity_at);
    const hoursInactive = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60);

    if (hoursInactive >= STALE_DEAL_HOURS) {
        await handleDealExpiry(deal);
    }
}

// =============================================
// Handle deal expiration
// =============================================
async function handleDealExpiry(deal: any): Promise<void> {
    await dealHelpers.updateStatus(deal.id, 'expired');

    // Refund if funded
    if (['funded', 'draft_pending', 'draft_submitted', 'draft_rejected'].includes(deal.status) && deal.escrow_amount) {
        await userHelpers.updateBalance(deal.advertiser_id, deal.escrow_amount);
        await walletHelpers.refundEscrow(deal.id);

        await notificationHelpers.create({
            user_id: deal.advertiser_id,
            type: 'funds_refunded',
            title: 'Funds Refunded 💸',
            message: `Deal expired. ${deal.escrow_amount} TON has been refunded to your balance.`,
            data: JSON.stringify({ deal_id: deal.id }),
        });
    }

    await notificationHelpers.create({
        user_id: deal.advertiser_id,
        type: 'deal_expired',
        title: 'Deal Expired ⏰',
        message: `Your deal for ${deal.channel_title} has expired due to inactivity.`,
        data: JSON.stringify({ deal_id: deal.id }),
    });

    await notificationHelpers.create({
        user_id: deal.channel_owner_id,
        type: 'deal_expired',
        title: 'Deal Expired ⏰',
        message: `The deal for ${deal.channel_title} has expired due to inactivity.`,
        data: JSON.stringify({ deal_id: deal.id }),
    });
}

// =============================================
// Handle fund release
// =============================================
async function handleReleaseFunds(dealId: number): Promise<void> {
    const deal = await dealHelpers.getById(dealId);

    if (!deal || deal.status !== 'verifying') {
        return;
    }

    // Final verification
    const result = await telegram.checkMessageExists(
        deal.channel_telegram_id,
        deal.posted_message_id!
    );

    if (!result.exists) {
        // Post was removed - dispute
        await dealHelpers.updateStatus(dealId, 'disputed');
        return;
    }

    // Calculate platform fee (5%)
    const fee = deal.escrow_amount * 0.05;
    const payout = deal.escrow_amount - fee;

    // Release funds to channel owner
    await userHelpers.updateBalance(deal.channel_owner_id, payout);
    await walletHelpers.releaseEscrow(dealId);

    // Update deal
    await dealHelpers.updateStatus(dealId, 'completed', {
        completed_at: new Date().toISOString(),
    });

    // Notify both parties
    await notificationHelpers.create({
        user_id: deal.channel_owner_id,
        type: 'funds_received',
        title: 'Payment Received! 🎉',
        message: `${payout.toFixed(4)} TON has been added to your balance for ${deal.channel_title}`,
        data: JSON.stringify({ deal_id: dealId, amount: payout }),
    });

    await notificationHelpers.create({
        user_id: deal.advertiser_id,
        type: 'deal_completed',
        title: 'Deal Completed! ✅',
        message: `Your ad campaign on ${deal.channel_title} has been completed successfully.`,
        data: JSON.stringify({ deal_id: dealId }),
    });
}

// =============================================
// Check for stale deals (run periodically)
// =============================================
export async function checkStaleDeals(): Promise<void> {
    try {
        const staleDeals = await dealHelpers.getStale(STALE_DEAL_HOURS);

        for (const deal of staleDeals) {
            await handleDealExpiry(deal);
        }
    } catch (error) {
        console.error('Error checking stale deals:', error);
    }
}

// =============================================
// Check expired deals (run periodically)
// =============================================
export async function checkExpiredDeals(): Promise<void> {
    try {
        const expiredDeals = await dealHelpers.getExpired();

        for (const deal of expiredDeals) {
            await handleDealExpiry(deal);
        }
    } catch (error) {
        console.error('Error checking expired deals:', error);
    }
}

// =============================================
// Schedule a post for auto-posting
// =============================================
export async function scheduleAutoPost(dealId: number, scheduledTime: Date): Promise<void> {
    await taskHelpers.create({
        type: 'auto_post',
        target_id: dealId,
        target_type: 'deal',
        scheduled_at: scheduledTime.toISOString(),
    });
}

// =============================================
// Start scheduler (call on server start)
// =============================================
export function startScheduler(): void {
    // Process pending tasks every minute
    setInterval(processScheduledTasks, 60 * 1000);

    // Check for stale/expired deals every 15 minutes
    setInterval(checkStaleDeals, 15 * 60 * 1000);
    setInterval(checkExpiredDeals, 15 * 60 * 1000);

    console.log('✅ Scheduler started');
}

export default {
    processScheduledTasks,
    checkStaleDeals,
    checkExpiredDeals,
    scheduleAutoPost,
    startScheduler,
};

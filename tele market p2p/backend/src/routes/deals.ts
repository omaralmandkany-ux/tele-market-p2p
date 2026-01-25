import { Router, Request, Response } from 'express';
import { dealHelpers, listingHelpers, channelHelpers, notificationHelpers, taskHelpers } from '../database/db.js';
import tonWallet from '../services/tonWallet.js';
import { verifyChannelAdminForFinancial } from '../middleware/verifyAdmin.js';

const router = Router();

// =============================================
// Get user's deals
// =============================================
router.get('/', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { role = 'all' } = req.query;
        let deals: any[] = [];

        if (role === 'advertiser' || role === 'all') {
            const advertiserDeals = await dealHelpers.getByUser(req.user.id, 'advertiser');
            deals = [...deals, ...advertiserDeals.map((d: any) => ({ ...d, userRole: 'advertiser' }))];
        }

        if (role === 'owner' || role === 'all') {
            const ownerDeals = await dealHelpers.getByUser(req.user.id, 'owner');
            deals = [...deals, ...ownerDeals.map((d: any) => ({ ...d, userRole: 'owner' }))];
        }

        // Remove duplicates and sort
        const uniqueDeals = Array.from(new Map(deals.map(d => [d.id, d])).values());
        uniqueDeals.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        res.json({ success: true, data: uniqueDeals });
    } catch (error: any) {
        console.error('Error fetching deals:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch deals' });
    }
});

// =============================================
// Get single deal
// =============================================
router.get('/:id', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const deal = await dealHelpers.getById(parseInt(req.params.id));

        if (!deal) {
            return res.status(404).json({ success: false, error: 'Deal not found' });
        }

        if (deal.advertiser_id !== req.user.id && deal.channel_owner_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        deal.userRole = deal.advertiser_id === req.user.id ? 'advertiser' : 'owner';
        res.json({ success: true, data: deal });
    } catch (error: any) {
        console.error('Error fetching deal:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch deal' });
    }
});

// =============================================
// Create deal from listing (advertiser)
// =============================================
router.post('/', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { listing_id, ad_content, ad_media_url, ad_requirements, scheduled_time } = req.body;

        if (!listing_id) {
            return res.status(400).json({ success: false, error: 'Listing ID is required' });
        }

        // Get listing
        const listing = await listingHelpers.getById(listing_id);
        if (!listing) {
            return res.status(404).json({ success: false, error: 'Listing not found' });
        }

        // Can't buy from own channel
        if (listing.owner_id === req.user.id) {
            return res.status(400).json({ success: false, error: 'Cannot create deal for your own listing' });
        }

        // Create deal
        const dealId = await dealHelpers.create({
            listing_id,
            advertiser_id: req.user.id,
            channel_owner_id: listing.owner_id,
            channel_id: listing.channel_id,
            escrow_amount: listing.price,
            ad_content,
            ad_media_url,
            ad_requirements,
            scheduled_time,
            expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), // 72 hours
        });

        // Create escrow wallet
        await tonWallet.createEscrowWallet(dealId);

        // Notify channel owner
        await notificationHelpers.create({
            user_id: listing.owner_id,
            type: 'deal_created',
            title: 'New Deal Request! 📢',
            message: `Someone wants to advertise on ${listing.channel_title}`,
            data: JSON.stringify({ deal_id: dealId }),
        });

        const deal = await dealHelpers.getById(dealId);
        res.status(201).json({ success: true, data: deal });
    } catch (error: any) {
        console.error('Error creating deal:', error);
        res.status(500).json({ success: false, error: 'Failed to create deal' });
    }
});

// =============================================
// Accept deal (channel owner) - AUTO-FUND & AUTO-POST
// =============================================
router.post('/:id/accept', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const dealId = parseInt(req.params.id);
        const deal = await dealHelpers.getById(dealId);

        if (!deal) {
            return res.status(404).json({ success: false, error: 'Deal not found' });
        }

        if (deal.channel_owner_id !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Only channel owner can accept' });
        }

        if (deal.status !== 'pending') {
            return res.status(400).json({ success: false, error: `Cannot accept deal in ${deal.status} status` });
        }

        // First change status to accepted so fundEscrow can work
        await dealHelpers.updateStatus(dealId, 'accepted');

        // AUTO-FUND: Deduct from advertiser and lock in escrow
        try {
            await tonWallet.fundEscrow(dealId, deal.advertiser_id);
        } catch (fundError: any) {
            // Revert to pending if funding fails
            await dealHelpers.updateStatus(dealId, 'pending');
            return res.status(400).json({ success: false, error: fundError.message || 'Advertiser has insufficient balance' });
        }

        // Calculate post time based on scheduled_time or default to 1 hour from now
        let postTime = deal.scheduled_time;
        if (!postTime) {
            const defaultDelay = 60 * 60 * 1000; // 1 hour default
            postTime = new Date(Date.now() + defaultDelay).toISOString();
        }

        // Update deal with schedule time
        await dealHelpers.updateStatus(dealId, 'funded', {
            scheduled_time: postTime,
        });

        // Schedule the auto-post task
        await taskHelpers.create({
            type: 'auto_post',
            target_id: dealId,
            target_type: 'deal',
            scheduled_at: postTime,
        });

        // Notify advertiser
        await notificationHelpers.create({
            user_id: deal.advertiser_id,
            type: 'deal_accepted',
            title: 'Deal Accepted & Funded! ✅',
            message: `Your ad for ${deal.channel_title} will be posted automatically!`,
            data: JSON.stringify({ deal_id: dealId }),
        });

        const updatedDeal = await dealHelpers.getById(dealId);
        res.json({
            success: true,
            data: updatedDeal,
            message: 'Deal accepted! Payment locked and ad scheduled for posting.'
        });
    } catch (error: any) {
        console.error('Error accepting deal:', error);
        res.status(500).json({ success: false, error: 'Failed to accept deal' });
    }
});

// =============================================
// Reject deal (channel owner)
// =============================================
router.post('/:id/reject', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const dealId = parseInt(req.params.id);
        const deal = await dealHelpers.getById(dealId);

        if (!deal) {
            return res.status(404).json({ success: false, error: 'Deal not found' });
        }

        if (deal.channel_owner_id !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Only channel owner can reject' });
        }

        if (deal.status !== 'pending') {
            return res.status(400).json({ success: false, error: `Cannot reject deal in ${deal.status} status` });
        }

        await dealHelpers.updateStatus(dealId, 'rejected');

        // Notify advertiser
        await notificationHelpers.create({
            user_id: deal.advertiser_id,
            type: 'deal_rejected',
            title: 'Deal Declined',
            message: `Your deal for ${deal.channel_title} was declined.`,
            data: JSON.stringify({ deal_id: dealId }),
        });

        const updatedDeal = await dealHelpers.getById(dealId);
        res.json({ success: true, data: updatedDeal });
    } catch (error: any) {
        console.error('Error rejecting deal:', error);
        res.status(500).json({ success: false, error: 'Failed to reject deal' });
    }
});

// =============================================
// Fund deal (advertiser) - Uses TON Wallet
// =============================================
router.post('/:id/fund', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const dealId = parseInt(req.params.id);

        const result = await tonWallet.fundEscrow(dealId, req.user.id);

        if (!result.success) {
            return res.status(400).json({ success: false, error: 'Failed to fund escrow' });
        }

        // Update deal status to draft_pending
        await dealHelpers.updateStatus(dealId, 'draft_pending');

        const updatedDeal = await dealHelpers.getById(dealId);
        res.json({
            success: true,
            data: updatedDeal,
            escrow: {
                address: result.escrow_address,
                tx_hash: result.tx_hash,
            },
        });
    } catch (error: any) {
        console.error('Error funding deal:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to fund deal' });
    }
});

// =============================================
// Trigger auto-post (after draft approved & scheduled)
// =============================================
router.post('/:id/post', verifyChannelAdminForFinancial, async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const dealId = parseInt(req.params.id);
        const deal = await dealHelpers.getById(dealId);

        if (!deal) {
            return res.status(404).json({ success: false, error: 'Deal not found' });
        }

        if (deal.channel_owner_id !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Only channel owner can trigger post' });
        }

        const validStatuses = ['draft_approved', 'scheduled'];
        if (!validStatuses.includes(deal.status)) {
            return res.status(400).json({ success: false, error: 'Draft must be approved before posting' });
        }

        // If scheduled_time is set and in future, schedule it
        if (deal.scheduled_time && new Date(deal.scheduled_time) > new Date()) {
            await taskHelpers.create({
                type: 'auto_post',
                target_id: dealId,
                target_type: 'deal',
                scheduled_at: deal.scheduled_time,
            });
            await dealHelpers.updateStatus(dealId, 'scheduled');
            res.json({ success: true, message: 'Post scheduled for ' + deal.scheduled_time });
        } else {
            // Post immediately
            await taskHelpers.create({
                type: 'auto_post',
                target_id: dealId,
                target_type: 'deal',
                scheduled_at: new Date().toISOString(),
            });
            await dealHelpers.updateStatus(dealId, 'posting');
            res.json({ success: true, message: 'Posting now...' });
        }
    } catch (error: any) {
        console.error('Error triggering post:', error);
        res.status(500).json({ success: false, error: 'Failed to trigger post' });
    }
});

// =============================================
// Complete deal (manual completion by advertiser)
// =============================================
router.post('/:id/complete', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const dealId = parseInt(req.params.id);
        const deal = await dealHelpers.getById(dealId);

        if (!deal) {
            return res.status(404).json({ success: false, error: 'Deal not found' });
        }

        if (deal.advertiser_id !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Only advertiser can complete' });
        }

        if (!['posted', 'verifying'].includes(deal.status)) {
            return res.status(400).json({ success: false, error: 'Deal must be posted to complete' });
        }

        // Release funds
        const result = await tonWallet.releaseEscrow(dealId);

        await dealHelpers.updateStatus(dealId, 'completed', {
            completed_at: new Date().toISOString(),
        });

        // Notify channel owner
        await notificationHelpers.create({
            user_id: deal.channel_owner_id,
            type: 'funds_received',
            title: 'Payment Received! 🎉',
            message: `${result.payout.toFixed(4)} TON has been added to your balance.`,
            data: JSON.stringify({ deal_id: dealId }),
        });

        const updatedDeal = await dealHelpers.getById(dealId);
        res.json({ success: true, data: updatedDeal });
    } catch (error: any) {
        console.error('Error completing deal:', error);
        res.status(500).json({ success: false, error: 'Failed to complete deal' });
    }
});

// =============================================
// Dispute deal
// =============================================
router.post('/:id/dispute', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const dealId = parseInt(req.params.id);
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ success: false, error: 'Reason is required' });
        }

        const deal = await dealHelpers.getById(dealId);

        if (!deal) {
            return res.status(404).json({ success: false, error: 'Deal not found' });
        }

        if (deal.advertiser_id !== req.user.id && deal.channel_owner_id !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        await dealHelpers.updateStatus(dealId, 'disputed');

        // Notify both parties
        const otherUserId = deal.advertiser_id === req.user.id ? deal.channel_owner_id : deal.advertiser_id;
        await notificationHelpers.create({
            user_id: otherUserId,
            type: 'deal_disputed',
            title: '⚠️ Dispute Opened',
            message: `A dispute has been opened. Reason: ${reason}`,
            data: JSON.stringify({ deal_id: dealId, reason }),
        });

        const updatedDeal = await dealHelpers.getById(dealId);
        res.json({ success: true, data: updatedDeal });
    } catch (error: any) {
        console.error('Error disputing deal:', error);
        res.status(500).json({ success: false, error: 'Failed to dispute deal' });
    }
});

// =============================================
// Cancel deal (before funding)
// =============================================
router.post('/:id/cancel', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const dealId = parseInt(req.params.id);
        const deal = await dealHelpers.getById(dealId);

        if (!deal) {
            return res.status(404).json({ success: false, error: 'Deal not found' });
        }

        if (deal.advertiser_id !== req.user.id && deal.channel_owner_id !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        // Can only cancel before funding
        if (!['pending', 'accepted'].includes(deal.status)) {
            return res.status(400).json({ success: false, error: 'Cannot cancel after funding' });
        }

        await dealHelpers.updateStatus(dealId, 'cancelled');

        // Notify other party
        const otherUserId = deal.advertiser_id === req.user.id ? deal.channel_owner_id : deal.advertiser_id;
        await notificationHelpers.create({
            user_id: otherUserId,
            type: 'deal_cancelled',
            title: 'Deal Cancelled',
            message: `The deal for ${deal.channel_title} has been cancelled.`,
            data: JSON.stringify({ deal_id: dealId }),
        });

        const updatedDeal = await dealHelpers.getById(dealId);
        res.json({ success: true, data: updatedDeal });
    } catch (error: any) {
        console.error('Error cancelling deal:', error);
        res.status(500).json({ success: false, error: 'Failed to cancel deal' });
    }
});

// =============================================
// Request refund (for disputed/problematic deals)
// =============================================
router.post('/:id/refund', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const dealId = parseInt(req.params.id);
        const deal = await dealHelpers.getById(dealId);

        if (!deal) {
            return res.status(404).json({ success: false, error: 'Deal not found' });
        }

        // Only admin can process refunds
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Only admin can process refunds' });
        }

        const result = await tonWallet.refundEscrow(dealId);
        await dealHelpers.updateStatus(dealId, 'refunded');

        res.json({
            success: true,
            message: 'Refund processed',
            data: { tx_hash: result.tx_hash, refund: result.refund },
        });
    } catch (error: any) {
        console.error('Error processing refund:', error);
        res.status(500).json({ success: false, error: 'Failed to process refund' });
    }
});

export default router;

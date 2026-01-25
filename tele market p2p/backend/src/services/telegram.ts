import { config } from '../config/env.js';

const TELEGRAM_API = `https://api.telegram.org/bot${config.botToken}`;

interface TelegramResponse {
    ok: boolean;
    result?: any;
    description?: string;
}

// =============================================
// Send message via Telegram Bot
// =============================================
export async function sendMessage(chatId: number | string, text: string, options?: {
    parse_mode?: 'HTML' | 'MarkdownV2';
    reply_markup?: any;
    disable_notification?: boolean;
}): Promise<{ success: boolean; message_id?: number; error?: string }> {
    try {
        const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: options?.parse_mode || 'HTML',
                reply_markup: options?.reply_markup,
                disable_notification: options?.disable_notification,
            }),
        });

        const data = await response.json() as TelegramResponse;
        if (data.ok) {
            return { success: true, message_id: data.result.message_id };
        }
        return { success: false, error: data.description };
    } catch (error: any) {
        console.error('Error sending message:', error);
        return { success: false, error: error.message };
    }
}

// =============================================
// Send notification with inline buttons
// =============================================
export async function sendNotificationWithButtons(
    telegramId: number,
    title: string,
    message: string,
    buttons: Array<{ text: string; callback_data?: string; url?: string }>
): Promise<{ success: boolean; message_id?: number }> {
    const inline_keyboard = [buttons.map(btn => btn.url ? { text: btn.text, url: btn.url } : { text: btn.text, callback_data: btn.callback_data })];

    return sendMessage(telegramId, `<b>${title}</b>\n\n${message}`, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard },
    });
}

// =============================================
// Notify user about deal status change
// =============================================
export async function notifyDealUpdate(
    telegramId: number,
    dealId: number,
    status: string,
    channelTitle: string,
    miniAppUrl: string
): Promise<void> {
    const statusMessages: Record<string, { title: string; message: string; emoji: string }> = {
        accepted: { title: 'Deal Accepted', message: 'Your deal request has been accepted.', emoji: '✅' },
        rejected: { title: 'Deal Declined', message: 'Your deal request was declined.', emoji: '❌' },
        funded: { title: 'Deal Funded', message: 'The escrow has been funded. Waiting for creative draft.', emoji: '💰' },
        draft_submitted: { title: 'Draft Submitted', message: 'A creative draft is ready for your review.', emoji: '📝' },
        draft_approved: { title: 'Draft Approved', message: 'The creative has been approved. Ready for scheduling.', emoji: '✅' },
        draft_rejected: { title: 'Draft Needs Revision', message: 'The draft needs some changes.', emoji: '🔄' },
        scheduled: { title: 'Post Scheduled', message: 'Your ad is scheduled for publishing.', emoji: '📅' },
        posted: { title: 'Ad Published', message: 'Your ad has been published!', emoji: '🚀' },
        completed: { title: 'Deal Completed', message: 'Funds have been released. Thank you!', emoji: '🎉' },
        disputed: { title: 'Dispute Opened', message: 'A dispute has been opened for this deal.', emoji: '⚠️' },
        cancelled: { title: 'Deal Cancelled', message: 'This deal has been cancelled.', emoji: '🚫' },
        refunded: { title: 'Funds Refunded', message: 'Funds have been returned to the advertiser.', emoji: '💸' },
        expired: { title: 'Deal Expired', message: 'This deal has expired due to inactivity.', emoji: '⏰' },
    };

    const statusInfo = statusMessages[status] || { title: 'Deal Update', message: `Status changed to ${status}`, emoji: '📌' };

    await sendNotificationWithButtons(
        telegramId,
        `${statusInfo.emoji} ${statusInfo.title}`,
        `<b>Channel:</b> ${channelTitle}\n${statusInfo.message}`,
        [{ text: '📱 Open App', url: `${miniAppUrl}?startapp=deal_${dealId}` }]
    );
}

// =============================================
// Get channel info from Telegram
// =============================================
export async function getChatInfo(chatId: number | string): Promise<any> {
    try {
        const response = await fetch(`${TELEGRAM_API}/getChat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId }),
        });

        const data = await response.json() as TelegramResponse;
        if (data.ok) {
            return data.result;
        }
        return null;
    } catch (error) {
        console.error('Error getting chat info:', error);
        return null;
    }
}

// =============================================
// Get channel member count
// =============================================
export async function getChatMemberCount(chatId: number | string): Promise<number | null> {
    try {
        const response = await fetch(`${TELEGRAM_API}/getChatMemberCount`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId }),
        });

        const data = await response.json() as TelegramResponse;
        if (data.ok) {
            return data.result;
        }
        return null;
    } catch (error) {
        console.error('Error getting member count:', error);
        return null;
    }
}

// =============================================
// Check if bot is admin in channel
// =============================================
export async function isBotAdmin(chatId: number | string): Promise<boolean> {
    try {
        const response = await fetch(`${TELEGRAM_API}/getChatMember`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, user_id: config.botToken.split(':')[0] }),
        });

        const data = await response.json() as TelegramResponse;
        if (data.ok) {
            return ['administrator', 'creator'].includes(data.result.status);
        }
        return false;
    } catch (error) {
        console.error('Error checking bot admin status:', error);
        return false;
    }
}

// =============================================
// Check if user is admin in channel
// =============================================
export async function isUserAdmin(chatId: number | string, userId: number): Promise<boolean> {
    try {
        const response = await fetch(`${TELEGRAM_API}/getChatMember`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, user_id: userId }),
        });

        const data = await response.json() as TelegramResponse;
        if (data.ok) {
            return ['administrator', 'creator'].includes(data.result.status);
        }
        return false;
    } catch (error) {
        console.error('Error checking user admin status:', error);
        return false;
    }
}

// =============================================
// Get all admins of a channel
// =============================================
export async function getChannelAdmins(chatId: number | string): Promise<any[]> {
    try {
        const response = await fetch(`${TELEGRAM_API}/getChatAdministrators`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId }),
        });

        const data = await response.json() as TelegramResponse;
        if (data.ok) {
            return data.result;
        }
        return [];
    } catch (error) {
        console.error('Error getting channel admins:', error);
        return [];
    }
}

// =============================================
// Post message to channel
// =============================================
export async function postToChannel(
    chatId: number | string,
    content: string,
    mediaUrl?: string
): Promise<{ success: boolean; message_id?: number; error?: string }> {
    try {
        if (mediaUrl) {
            // Post with media
            const isVideo = mediaUrl.match(/\.(mp4|mov|avi)$/i);
            const endpoint = isVideo ? 'sendVideo' : 'sendPhoto';
            const mediaKey = isVideo ? 'video' : 'photo';

            const response = await fetch(`${TELEGRAM_API}/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    [mediaKey]: mediaUrl,
                    caption: content,
                    parse_mode: 'HTML',
                }),
            });

            const data = await response.json() as TelegramResponse;
            if (data.ok) {
                return { success: true, message_id: data.result.message_id };
            }
            return { success: false, error: data.description };
        } else {
            // Post text only
            return sendMessage(chatId, content, { parse_mode: 'HTML' });
        }
    } catch (error: any) {
        console.error('Error posting to channel:', error);
        return { success: false, error: error.message };
    }
}

// =============================================
// Check if message exists in channel
// =============================================
export async function checkMessageExists(
    chatId: number | string,
    messageId: number
): Promise<{ exists: boolean; modified?: boolean; error?: string }> {
    try {
        // Try to forward message to self (will fail if deleted)
        const response = await fetch(`${TELEGRAM_API}/copyMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                from_chat_id: chatId,
                message_id: messageId,
            }),
        });

        const data = await response.json() as TelegramResponse;

        if (data.ok) {
            // Delete the copied message
            await fetch(`${TELEGRAM_API}/deleteMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    message_id: data.result.message_id,
                }),
            });
            return { exists: true, modified: false };
        }

        if (data.description?.includes('message to copy not found') || data.description?.includes('MESSAGE_ID_INVALID')) {
            return { exists: false };
        }

        return { exists: true, error: data.description };
    } catch (error: any) {
        console.error('Error checking message:', error);
        return { exists: true, error: error.message };
    }
}

// =============================================
// Get channel statistics (extended)
// =============================================
export async function getChannelStats(chatId: number | string): Promise<{
    subscribers: number;
    avg_views?: number;
    premium_percentage?: number;
    language_stats?: Record<string, number>;
}> {
    const memberCount = await getChatMemberCount(chatId);

    // Note: Detailed stats require Telegram Statistics API or MTProto
    // For MVP, we return basic info
    return {
        subscribers: memberCount || 0,
        // These would require MTProto API in production
        avg_views: undefined,
        premium_percentage: undefined,
        language_stats: undefined,
    };
}

export default {
    sendMessage,
    sendNotificationWithButtons,
    notifyDealUpdate,
    getChatInfo,
    getChatMemberCount,
    isBotAdmin,
    isUserAdmin,
    getChannelAdmins,
    postToChannel,
    checkMessageExists,
    getChannelStats,
};

import { Router, Request, Response } from 'express';
import { channelHelpers, listingHelpers, managerHelpers, userHelpers } from '../database/db.js';
import telegram from '../services/telegram.js';
import crypto from 'crypto';

const router = Router();

// =============================================
// Get user's channels
// =============================================
router.get('/', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const channels = await channelHelpers.getByOwner(req.user.id);
        res.json({ success: true, data: channels });
    } catch (error: any) {
        console.error('Error fetching channels:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch channels' });
    }
});

// =============================================
// Get verified channels (for marketplace)
// =============================================
router.get('/verified', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        const channels = await channelHelpers.getVerified(limit, offset);
        res.json({ success: true, data: channels });
    } catch (error: any) {
        console.error('Error fetching verified channels:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch channels' });
    }
});

// =============================================
// Get single channel with listings
// =============================================
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const channel = await channelHelpers.getById(parseInt(req.params.id));

        if (!channel) {
            return res.status(404).json({ success: false, error: 'Channel not found' });
        }

        const listings = await listingHelpers.getByChannel(channel.id);
        const managers = await managerHelpers.getByChannel(channel.id);

        res.json({
            success: true,
            data: { ...channel, listings, managers },
        });
    } catch (error: any) {
        console.error('Error fetching channel:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch channel' });
    }
});

// =============================================
// Add channel manually
// =============================================
router.post('/', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { username, title, description, categories } = req.body;

        if (!title) {
            return res.status(400).json({ success: false, error: 'Title is required' });
        }

        // Generate verification code
        const verificationCode = crypto.randomBytes(4).toString('hex').toUpperCase();

        const channelId = await channelHelpers.create({
            username: username || null,
            title,
            description,
            categories: categories ? JSON.stringify(categories) : null,
            owner_id: req.user.id,
        });

        await channelHelpers.updateVerification(channelId, false, verificationCode);

        const channel = await channelHelpers.getById(channelId);
        res.status(201).json({
            success: true,
            data: channel,
            verification_code: verificationCode,
            message: 'Add verification code to channel description, then verify',
        });
    } catch (error: any) {
        console.error('Error adding channel:', error);
        res.status(500).json({ success: false, error: 'Failed to add channel' });
    }
});

// =============================================
// Quick verify (via username)
// =============================================
router.post('/quick-verify', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { username } = req.body;

        if (!username) {
            return res.status(400).json({ success: false, error: 'Channel username is required' });
        }

        const cleanUsername = username.replace('@', '');

        // Get chat info from Telegram
        const chatInfo = await telegram.getChatInfo('@' + cleanUsername);
        if (!chatInfo) {
            return res.status(400).json({ success: false, error: 'Channel not found on Telegram' });
        }

        // Check if user is admin
        const isAdmin = await telegram.isUserAdmin(chatInfo.id, req.user.telegram_id);
        if (!isAdmin) {
            return res.status(403).json({ success: false, error: 'You must be an admin of this channel' });
        }

        // Check if bot is admin
        const botIsAdmin = await telegram.isBotAdmin(chatInfo.id);

        // Get subscriber count
        const memberCount = await telegram.getChatMemberCount(chatInfo.id);

        // Check if channel already exists
        let channel = await channelHelpers.getByUsername(cleanUsername);

        if (channel) {
            // Update existing channel
            await channelHelpers.update(channel.id, {
                telegram_id: chatInfo.id,
                title: chatInfo.title,
                subscribers_count: memberCount,
                photo_url: chatInfo.photo?.big_file_id,
                is_verified: true,
                bot_is_admin: botIsAdmin,
            });
        } else {
            // Create new verified channel
            const channelId = await channelHelpers.create({
                telegram_id: chatInfo.id,
                username: cleanUsername,
                title: chatInfo.title,
                description: chatInfo.description,
                subscribers_count: memberCount,
                owner_id: req.user.id,
                photo_url: chatInfo.photo?.big_file_id,
            });

            await channelHelpers.update(channelId, {
                is_verified: true,
                bot_is_admin: botIsAdmin,
            });

            channel = await channelHelpers.getById(channelId);
        }

        // Sync admins
        const admins = await telegram.getChannelAdmins(chatInfo.id);
        for (const admin of admins) {
            if (admin.user.is_bot) continue;

            // Find or create user
            let user = await userHelpers.getByTelegramId(admin.user.id);
            if (!user) {
                const userId = await userHelpers.create(admin.user.id, admin.user.username, admin.user.first_name, null);
                user = await userHelpers.getById(userId);
            }

            // Add as manager
            await managerHelpers.add(channel.id, user.id, admin.user.id, admin.status === 'creator' ? 'owner' : 'admin', null);
        }

        const updatedChannel = await channelHelpers.getById(channel.id);

        res.json({
            success: true,
            data: updatedChannel,
            message: botIsAdmin ? 'Channel verified with auto-posting enabled!' : 'Channel verified! Add bot as admin for auto-posting.',
        });
    } catch (error: any) {
        console.error('Error quick verifying:', error);
        res.status(500).json({ success: false, error: 'Failed to verify channel' });
    }
});

// =============================================
// Verify channel with code
// =============================================
router.post('/:id/verify', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const channelId = parseInt(req.params.id);
        const channel = await channelHelpers.getById(channelId);

        if (!channel) {
            return res.status(404).json({ success: false, error: 'Channel not found' });
        }

        if (channel.owner_id !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        if (!channel.username) {
            return res.status(400).json({ success: false, error: 'Channel username required for verification' });
        }

        // Get channel from Telegram
        const chatInfo = await telegram.getChatInfo('@' + channel.username);
        if (!chatInfo) {
            return res.status(400).json({ success: false, error: 'Channel not found on Telegram' });
        }

        // Check if description contains verification code
        if (!chatInfo.description?.includes(channel.verification_code)) {
            return res.status(400).json({
                success: false,
                error: `Add "${channel.verification_code}" to channel description and try again`,
            });
        }

        // Check if user is admin
        const isAdmin = await telegram.isUserAdmin(chatInfo.id, req.user.telegram_id);
        if (!isAdmin) {
            return res.status(403).json({ success: false, error: 'You must be an admin of this channel' });
        }

        // Verify!
        const memberCount = await telegram.getChatMemberCount(chatInfo.id);
        const botIsAdmin = await telegram.isBotAdmin(chatInfo.id);

        await channelHelpers.update(channelId, {
            telegram_id: chatInfo.id,
            title: chatInfo.title,
            subscribers_count: memberCount,
            is_verified: true,
            bot_is_admin: botIsAdmin,
            verification_code: null, // Clear code
        });

        const updatedChannel = await channelHelpers.getById(channelId);

        res.json({
            success: true,
            data: updatedChannel,
            message: 'Channel verified successfully!',
        });
    } catch (error: any) {
        console.error('Error verifying channel:', error);
        res.status(500).json({ success: false, error: 'Failed to verify channel' });
    }
});

// =============================================
// Get channel managers
// =============================================
router.get('/:id/managers', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const channelId = parseInt(req.params.id);
        const channel = await channelHelpers.getById(channelId);

        if (!channel) {
            return res.status(404).json({ success: false, error: 'Channel not found' });
        }

        if (channel.owner_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        const managers = await managerHelpers.getByChannel(channelId);
        res.json({ success: true, data: managers });
    } catch (error: any) {
        console.error('Error fetching managers:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch managers' });
    }
});

// =============================================
// Sync managers from Telegram
// =============================================
router.post('/:id/sync-managers', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const channelId = parseInt(req.params.id);
        const channel = await channelHelpers.getById(channelId);

        if (!channel) {
            return res.status(404).json({ success: false, error: 'Channel not found' });
        }

        if (channel.owner_id !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        if (!channel.telegram_id) {
            return res.status(400).json({ success: false, error: 'Channel not linked to Telegram' });
        }

        const admins = await telegram.getChannelAdmins(channel.telegram_id);
        let synced = 0;

        for (const admin of admins) {
            if (admin.user.is_bot) continue;

            let user = await userHelpers.getByTelegramId(admin.user.id);
            if (!user) {
                const userId = await userHelpers.create(admin.user.id, admin.user.username, admin.user.first_name, null);
                user = await userHelpers.getById(userId);
            }

            await managerHelpers.add(channelId, user.id, admin.user.id, admin.status === 'creator' ? 'owner' : 'admin', undefined);
            synced++;
        }

        const managers = await managerHelpers.getByChannel(channelId);

        res.json({
            success: true,
            data: managers,
            message: `Synced ${synced} managers from Telegram`,
        });
    } catch (error: any) {
        console.error('Error syncing managers:', error);
        res.status(500).json({ success: false, error: 'Failed to sync managers' });
    }
});

// =============================================
// Update channel stats
// =============================================
router.post('/:id/refresh-stats', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const channelId = parseInt(req.params.id);
        const channel = await channelHelpers.getById(channelId);

        if (!channel) {
            return res.status(404).json({ success: false, error: 'Channel not found' });
        }

        if (channel.owner_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        if (!channel.telegram_id) {
            return res.status(400).json({ success: false, error: 'Channel not linked to Telegram' });
        }

        const stats = await telegram.getChannelStats(channel.telegram_id);
        const botIsAdmin = await telegram.isBotAdmin(channel.telegram_id);

        await channelHelpers.update(channelId, {
            subscribers_count: stats.subscribers,
            avg_views: stats.avg_views,
            premium_percentage: stats.premium_percentage,
            language_stats: stats.language_stats ? JSON.stringify(stats.language_stats) : null,
            bot_is_admin: botIsAdmin,
            last_stats_update: new Date().toISOString(),
        });

        const updatedChannel = await channelHelpers.getById(channelId);

        res.json({
            success: true,
            data: updatedChannel,
            message: 'Stats refreshed',
        });
    } catch (error: any) {
        console.error('Error refreshing stats:', error);
        res.status(500).json({ success: false, error: 'Failed to refresh stats' });
    }
});

// =============================================
// Delete channel
// =============================================
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const channelId = parseInt(req.params.id);
        const channel = await channelHelpers.getById(channelId);

        if (!channel) {
            return res.status(404).json({ success: false, error: 'Channel not found' });
        }

        if (channel.owner_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        // Note: CASCADE will delete related listings, deals, etc.
        const { query } = await import('../database/db.js');
        await query('DELETE FROM channels WHERE id = ?', [channelId]);

        res.json({ success: true, message: 'Channel deleted' });
    } catch (error: any) {
        console.error('Error deleting channel:', error);
        res.status(500).json({ success: false, error: 'Failed to delete channel' });
    }
});

export default router;

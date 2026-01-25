import { Router, Request, Response } from 'express';
import { adminMiddleware } from '../middleware/auth.js';
import { userHelpers, channelHelpers, dealHelpers, query } from '../database/db.js';
import tonWallet from '../services/tonWallet.js';

const router = Router();

// All admin routes require admin role
router.use(adminMiddleware);

// =============================================
// Get platform statistics
// =============================================
router.get('/stats', async (req: Request, res: Response) => {
    try {
        const [userCount] = await query('SELECT COUNT(*) as count FROM users') as any[];
        const [channelCount] = await query('SELECT COUNT(*) as count FROM channels') as any[];
        const [verifiedCount] = await query('SELECT COUNT(*) as count FROM channels WHERE is_verified = 1') as any[];
        const [dealCount] = await query('SELECT COUNT(*) as count FROM deals') as any[];
        const [completedCount] = await query('SELECT COUNT(*) as count FROM deals WHERE status = ?', ['completed']) as any[];
        const [disputeCount] = await query('SELECT COUNT(*) as count FROM deals WHERE status = ?', ['disputed']) as any[];
        const [totalVolume] = await query('SELECT COALESCE(SUM(escrow_amount), 0) as total FROM deals WHERE status = ?', ['completed']) as any[];

        res.json({
            success: true,
            data: {
                users: userCount?.count || 0,
                channels: channelCount?.count || 0,
                verified_channels: verifiedCount?.count || 0,
                deals: dealCount?.count || 0,
                completed_deals: completedCount?.count || 0,
                open_disputes: disputeCount?.count || 0,
                total_volume: totalVolume?.total || 0,
            },
        });
    } catch (error: any) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
});

// =============================================
// Get all users
// =============================================
router.get('/users', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        const users = await query(
            'SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
            [limit, offset]
        );

        res.json({ success: true, data: users });
    } catch (error: any) {
        console.error('Error fetching users:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch users' });
    }
});

// =============================================
// Get user by ID
// =============================================
router.get('/users/:id', async (req: Request, res: Response) => {
    try {
        const user = await userHelpers.getById(parseInt(req.params.id));

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({ success: true, data: user });
    } catch (error: any) {
        console.error('Error fetching user:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch user' });
    }
});

// =============================================
// Update user role
// =============================================
router.put('/users/:id/role', async (req: Request, res: Response) => {
    try {
        const { role } = req.body;

        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ success: false, error: 'Invalid role' });
        }

        await userHelpers.update(parseInt(req.params.id), { role });
        const user = await userHelpers.getById(parseInt(req.params.id));

        res.json({ success: true, data: user });
    } catch (error: any) {
        console.error('Error updating role:', error);
        res.status(500).json({ success: false, error: 'Failed to update role' });
    }
});

// =============================================
// Get all channels
// =============================================
router.get('/channels', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        const channels = await query(
            'SELECT c.*, u.username as owner_username FROM channels c LEFT JOIN users u ON c.owner_id = u.id ORDER BY c.created_at DESC LIMIT ? OFFSET ?',
            [limit, offset]
        );

        res.json({ success: true, data: channels });
    } catch (error: any) {
        console.error('Error fetching channels:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch channels' });
    }
});

// =============================================
// Manually verify channel
// =============================================
router.post('/channels/:id/verify', async (req: Request, res: Response) => {
    try {
        const channelId = parseInt(req.params.id);
        await channelHelpers.update(channelId, { is_verified: true });
        const channel = await channelHelpers.getById(channelId);

        res.json({ success: true, data: channel, message: 'Channel verified' });
    } catch (error: any) {
        console.error('Error verifying channel:', error);
        res.status(500).json({ success: false, error: 'Failed to verify channel' });
    }
});

// =============================================
// Get disputed deals
// =============================================
router.get('/disputes', async (req: Request, res: Response) => {
    try {
        const disputes = await query(
            `SELECT d.*, c.title as channel_title, 
             u1.username as advertiser_username, 
             u2.username as owner_username 
             FROM deals d 
             LEFT JOIN channels c ON d.channel_id = c.id 
             LEFT JOIN users u1 ON d.advertiser_id = u1.id 
             LEFT JOIN users u2 ON d.channel_owner_id = u2.id 
             WHERE d.status = ? 
             ORDER BY d.created_at DESC`,
            ['disputed']
        );

        res.json({ success: true, data: disputes });
    } catch (error: any) {
        console.error('Error fetching disputes:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch disputes' });
    }
});

// =============================================
// Resolve dispute
// =============================================
router.post('/disputes/:id/resolve', async (req: Request, res: Response) => {
    try {
        const dealId = parseInt(req.params.id);
        const { resolution, refund_to_advertiser } = req.body;

        const deal = await dealHelpers.getById(dealId);

        if (!deal) {
            return res.status(404).json({ success: false, error: 'Deal not found' });
        }

        if (deal.status !== 'disputed') {
            return res.status(400).json({ success: false, error: 'Deal is not disputed' });
        }

        if (refund_to_advertiser) {
            // Refund to advertiser
            await tonWallet.refundEscrow(dealId);
            await dealHelpers.updateStatus(dealId, 'refunded');
        } else {
            // Release to owner
            await tonWallet.releaseEscrow(dealId);
            await dealHelpers.updateStatus(dealId, 'completed');
        }

        res.json({
            success: true,
            message: refund_to_advertiser ? 'Refunded to advertiser' : 'Released to channel owner',
        });
    } catch (error: any) {
        console.error('Error resolving dispute:', error);
        res.status(500).json({ success: false, error: 'Failed to resolve dispute' });
    }
});

export default router;

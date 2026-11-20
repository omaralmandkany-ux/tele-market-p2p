import { Router, Request, Response } from 'express';
import { userHelpers, notificationHelpers, transactionHelpers } from '../database/db.js';
import tonWallet from '../services/tonWallet.js';

const router = Router();

// =============================================
// Get current user profile
// =============================================
router.get('/me', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        res.json({ success: true, data: req.user });
    } catch (error: any) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch profile' });
    }
});

// =============================================
// Get user statistics
// =============================================
router.get('/stats', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { query } = await import('../database/db.js');

        // Get counts
        const [channels] = await query('SELECT COUNT(*) as count FROM channels WHERE owner_id = ?', [req.user.id]) as any[];
        const [advertiserDeals] = await query('SELECT COUNT(*) as count FROM deals WHERE advertiser_id = ?', [req.user.id]) as any[];
        const [ownerDeals] = await query('SELECT COUNT(*) as count FROM deals WHERE channel_owner_id = ?', [req.user.id]) as any[];
        const [completedDeals] = await query('SELECT COUNT(*) as count FROM deals WHERE (advertiser_id = ? OR channel_owner_id = ?) AND status = ?', [req.user.id, req.user.id, 'completed']) as any[];
        const [campaigns] = await query('SELECT COUNT(*) as count FROM campaigns WHERE advertiser_id = ?', [req.user.id]) as any[];

        res.json({
            success: true,
            data: {
                channels: channels?.count || 0,
                deals_as_advertiser: advertiserDeals?.count || 0,
                deals_as_owner: ownerDeals?.count || 0,
                completed_deals: completedDeals?.count || 0,
                campaigns: campaigns?.count || 0,
                balance: req.user.balance,
            },
        });
    } catch (error: any) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch stats' });
    }
});

// =============================================
// Get wallet info
// =============================================
router.get('/wallet', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const walletInfo = await tonWallet.getWalletInfo(req.user.id);

        res.json({
            success: true,
            data: walletInfo,
        });
    } catch (error: any) {
        console.error('Error fetching wallet:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch wallet' });
    }
});

// =============================================
// Simulate deposit (for testing)
// =============================================
router.post('/deposit', async (req: Request, res: Response) => {
    try {
        // SECURITY: balances are simulated (no real TON is received or sent), so these
        // endpoints let anyone mint balance. Only enable them for local testing.
        if (process.env.ENABLE_SIMULATED_PAYMENTS !== 'true') {
            return res.status(403).json({ success: false, error: 'Simulated payments are disabled' });
        }

        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Valid amount is required' });
        }

        const result = await tonWallet.simulateDeposit(req.user.id, parseFloat(amount));

        res.json({
            success: true,
            message: `Deposited ${amount} TON`,
            data: {
                tx_hash: result.tx_hash,
                new_balance: result.new_balance,
            },
        });
    } catch (error: any) {
        console.error('Error depositing:', error);
        res.status(500).json({ success: false, error: 'Failed to deposit' });
    }
});

// =============================================
// Withdraw (simulation)
// =============================================
router.post('/withdraw', async (req: Request, res: Response) => {
    try {
        // SECURITY: balances are simulated (no real TON is received or sent), so these
        // endpoints let anyone mint balance. Only enable them for local testing.
        if (process.env.ENABLE_SIMULATED_PAYMENTS !== 'true') {
            return res.status(403).json({ success: false, error: 'Simulated payments are disabled' });
        }

        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { amount, to_address } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({ success: false, error: 'Valid amount is required' });
        }

        if (!to_address) {
            return res.status(400).json({ success: false, error: 'Destination address is required' });
        }

        const result = await tonWallet.simulateWithdraw(req.user.id, parseFloat(amount), to_address);

        res.json({
            success: true,
            message: `Withdrawn ${amount} TON to ${to_address}`,
            data: {
                tx_hash: result.tx_hash,
            },
        });
    } catch (error: any) {
        console.error('Error withdrawing:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to withdraw' });
    }
});

// =============================================
// Get transaction history
// =============================================
router.get('/transactions', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const limit = parseInt(req.query.limit as string) || 50;
        const transactions = await transactionHelpers.getByUser(req.user.id, limit);

        res.json({
            success: true,
            data: transactions,
        });
    } catch (error: any) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch transactions' });
    }
});

// =============================================
// Get notifications
// =============================================
router.get('/notifications', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const notifications = await notificationHelpers.getUnread(req.user.id);

        res.json({
            success: true,
            data: notifications,
        });
    } catch (error: any) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
    }
});

// =============================================
// Mark notifications as read
// =============================================
router.post('/notifications/read', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { ids } = req.body;
        await notificationHelpers.markRead(req.user.id, ids);

        res.json({ success: true, message: 'Notifications marked as read' });
    } catch (error: any) {
        console.error('Error marking notifications:', error);
        res.status(500).json({ success: false, error: 'Failed to mark notifications' });
    }
});

// =============================================
// Update profile
// =============================================
router.put('/me', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { wallet_address } = req.body;

        const updates: Record<string, any> = {};
        if (wallet_address !== undefined) {
            updates.wallet_address = wallet_address;
        }

        if (Object.keys(updates).length > 0) {
            await userHelpers.update(req.user.id, updates);
        }

        const updatedUser = await userHelpers.getById(req.user.id);

        res.json({
            success: true,
            data: updatedUser,
        });
    } catch (error: any) {
        console.error('Error updating profile:', error);
        res.status(500).json({ success: false, error: 'Failed to update profile' });
    }
});

export default router;

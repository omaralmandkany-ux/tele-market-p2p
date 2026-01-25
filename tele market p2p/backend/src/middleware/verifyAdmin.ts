import { Request, Response, NextFunction } from 'express';
import { channelHelpers, managerHelpers } from '../database/db.js';
import telegram from '../services/telegram.js';

// =============================================
// Verify user has channel admin rights
// =============================================
export async function verifyChannelAdmin(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        // Get channel ID from params or body
        const channelId = parseInt(req.params.channelId || req.body.channel_id);

        if (!channelId) {
            return res.status(400).json({ success: false, error: 'Channel ID required' });
        }

        // Get channel
        const channel = await channelHelpers.getById(channelId);

        if (!channel) {
            return res.status(404).json({ success: false, error: 'Channel not found' });
        }

        // Check if user is the owner
        if (channel.owner_id === req.user.id) {
            // Re-verify with Telegram if channel has telegram_id
            if (channel.telegram_id) {
                const isAdmin = await telegram.isUserAdmin(channel.telegram_id, req.user.telegram_id);
                if (!isAdmin) {
                    return res.status(403).json({
                        success: false,
                        error: 'You are no longer an admin of this channel on Telegram'
                    });
                }
            }
            return next();
        }

        // Check if user is a manager
        const isManager = await managerHelpers.isManager(channelId, req.user.id);

        if (isManager) {
            // Re-verify with Telegram
            if (channel.telegram_id) {
                const isAdmin = await telegram.isUserAdmin(channel.telegram_id, req.user.telegram_id);
                if (!isAdmin) {
                    // Remove from managers since they're no longer admin
                    await managerHelpers.remove(channelId, req.user.id);
                    return res.status(403).json({
                        success: false,
                        error: 'You are no longer an admin of this channel on Telegram'
                    });
                }
            }
            return next();
        }

        return res.status(403).json({
            success: false,
            error: 'You do not have admin rights for this channel'
        });
    } catch (error: any) {
        console.error('Error verifying channel admin:', error);
        return res.status(500).json({ success: false, error: 'Failed to verify permissions' });
    }
}

// =============================================
// Verify specific permission
// =============================================
export function verifyPermission(permission: string) {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            if (!req.user) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const channelId = parseInt(req.params.channelId || req.body.channel_id);

            if (!channelId) {
                return res.status(400).json({ success: false, error: 'Channel ID required' });
            }

            const channel = await channelHelpers.getById(channelId);

            if (!channel) {
                return res.status(404).json({ success: false, error: 'Channel not found' });
            }

            // Owner has all permissions
            if (channel.owner_id === req.user.id) {
                return next();
            }

            // Check manager permission
            const hasPermission = await managerHelpers.hasPermission(channelId, req.user.id, permission);

            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    error: `You do not have permission: ${permission}`
                });
            }

            return next();
        } catch (error: any) {
            console.error('Error verifying permission:', error);
            return res.status(500).json({ success: false, error: 'Failed to verify permissions' });
        }
    };
}

// =============================================
// Verify deal participant
// =============================================
export async function verifyDealParticipant(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        // Deal ID from params
        const dealId = parseInt(req.params.id || req.params.dealId);

        if (!dealId) {
            return res.status(400).json({ success: false, error: 'Deal ID required' });
        }

        // Import here to avoid circular dependency
        const { dealHelpers } = await import('../database/db.js');
        const deal = await dealHelpers.getById(dealId);

        if (!deal) {
            return res.status(404).json({ success: false, error: 'Deal not found' });
        }

        // Check if user is a participant or admin
        if (deal.advertiser_id !== req.user.id &&
            deal.channel_owner_id !== req.user.id &&
            req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: 'You are not a participant in this deal'
            });
        }

        // Attach deal to request for downstream use
        (req as any).deal = deal;
        return next();
    } catch (error: any) {
        console.error('Error verifying deal participant:', error);
        return res.status(500).json({ success: false, error: 'Failed to verify permissions' });
    }
}

// =============================================
// Re-verify channel admin for financial operations
// =============================================
export async function verifyChannelAdminForFinancial(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        // Get deal from previous middleware or fetch it
        let deal = (req as any).deal;

        if (!deal) {
            const dealId = parseInt(req.params.id || req.params.dealId);
            if (dealId) {
                const { dealHelpers } = await import('../database/db.js');
                deal = await dealHelpers.getById(dealId);
            }
        }

        if (!deal) {
            return next(); // Let the route handler deal with missing deal
        }

        // If user is channel owner, verify they're still admin on Telegram
        if (deal.channel_owner_id === req.user.id && deal.channel_telegram_id) {
            const isStillAdmin = await telegram.isUserAdmin(deal.channel_telegram_id, req.user.telegram_id);

            if (!isStillAdmin) {
                return res.status(403).json({
                    success: false,
                    error: 'You must be an admin of the channel to perform this action. Please verify your admin status in Telegram.'
                });
            }
        }

        return next();
    } catch (error: any) {
        console.error('Error verifying channel admin for financial:', error);
        return res.status(500).json({ success: false, error: 'Failed to verify permissions' });
    }
}

export default {
    verifyChannelAdmin,
    verifyPermission,
    verifyDealParticipant,
    verifyChannelAdminForFinancial,
};

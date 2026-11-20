import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { config } from '../config/env.js';
import { userHelpers } from '../database/db.js';
import type { User } from '../types/index.js';

// Extend Express Request to include user
declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}

// Validate Telegram WebApp initData
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
    try {
        const initData = req.headers['x-telegram-init-data'] as string;

        if (!initData) {
            // Development mode: create test user.
            // SECURITY: only when NODE_ENV is *explicitly* 'development' (config.nodeEnv
            // defaults to 'development' when unset, which would open this in production).
            if (process.env.NODE_ENV === 'development') {
                const testUser = await userHelpers.getByTelegramId(12345678);
                if (testUser) {
                    req.user = testUser as User;
                } else {
                    const userId = await userHelpers.create(12345678, 'testuser', 'Test', null);
                    req.user = await userHelpers.getById(userId) as User;
                }
                return next();
            }
            return res.status(401).json({ success: false, error: 'Unauthorized: No init data' });
        }

        // SECURITY: without a bot token the HMAC key is public and anyone can forge initData
        if (!config.botToken) {
            console.error('BOT_TOKEN is not set - refusing to authenticate requests');
            return res.status(500).json({ success: false, error: 'Server misconfigured' });
        }

        // Parse and validate initData
        const urlParams = new URLSearchParams(initData);
        const hash = urlParams.get('hash');
        if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) {
            return res.status(401).json({ success: false, error: 'Unauthorized: Invalid hash' });
        }
        urlParams.delete('hash');

        // Sort and create data check string
        const dataCheckArr: string[] = [];
        urlParams.sort();
        urlParams.forEach((value, key) => {
            dataCheckArr.push(`${key}=${value}`);
        });
        const dataCheckString = dataCheckArr.join('\n');

        // Validate hash
        const secretKey = crypto
            .createHmac('sha256', 'WebAppData')
            .update(config.botToken)
            .digest();

        const calculatedHash = crypto
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest();

        const providedHash = Buffer.from(hash, 'hex');
        if (providedHash.length !== calculatedHash.length ||
            !crypto.timingSafeEqual(providedHash, calculatedHash)) {
            return res.status(401).json({ success: false, error: 'Unauthorized: Invalid hash' });
        }

        // Check auth_date (allow 24 hours)
        const authDate = parseInt(urlParams.get('auth_date') || '0');
        const now = Math.floor(Date.now() / 1000);
        if (!authDate || now - authDate > 86400) {
            return res.status(401).json({ success: false, error: 'Unauthorized: Expired' });
        }

        // Get or create user
        const userDataStr = urlParams.get('user');
        if (!userDataStr) {
            return res.status(401).json({ success: false, error: 'Unauthorized: No user data' });
        }

        const userData = JSON.parse(userDataStr);
        let user = await userHelpers.getByTelegramId(userData.id);

        if (!user) {
            const userId = await userHelpers.create(
                userData.id,
                userData.username || null,
                userData.first_name || null,
                userData.photo_url || null
            );
            user = await userHelpers.getById(userId);
        }

        req.user = user as User;
        next();
    } catch (error) {
        console.error('Auth error:', error);
        res.status(401).json({ success: false, error: 'Unauthorized' });
    }
}

// Admin check middleware
export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    next();
}

import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { initializeDatabase } from './database/db.js';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import scheduler from './services/scheduler.js';

// Routes
import channelsRouter from './routes/channels.js';
import listingsRouter from './routes/listings.js';
import dealsRouter from './routes/deals.js';
import usersRouter from './routes/users.js';
import adminRouter from './routes/admin.js';
import campaignsRouter from './routes/campaigns.js';
import creativeRouter from './routes/creative.js';

const app = express();

// Middleware
app.use(cors({
    origin: config.frontendUrl === 'http://localhost:5173' ? true : config.frontendUrl,
    credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API info
app.get('/api', (req, res) => {
    res.json({
        name: 'Telegram Ad Marketplace API',
        version: '2.0.0',
        features: [
            'Marketplace for channel listings',
            'Campaign briefs for advertisers',
            'Creative approval workflow',
            'Auto-posting & verification',
            'Escrow with TON simulation',
            'Multi-admin channel support',
        ],
        endpoints: {
            channels: '/api/channels',
            listings: '/api/listings',
            deals: '/api/deals',
            campaigns: '/api/campaigns',
            creative: '/api/deals/:id/drafts',
            users: '/api/users',
            admin: '/api/admin',
        },
    });
});

// Protected routes
app.use('/api/channels', authMiddleware, channelsRouter);
app.use('/api/listings', authMiddleware, listingsRouter);
app.use('/api/deals', authMiddleware, dealsRouter);
app.use('/api/campaigns', authMiddleware, campaignsRouter);
app.use('/api/users', authMiddleware, usersRouter);
app.use('/api/admin', authMiddleware, adminRouter);

// Creative routes (nested under deals)
app.use('/api/deals', authMiddleware, creativeRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Initialize database and start server
async function main() {
    try {
        // Initialize database
        await initializeDatabase();

        // Start scheduler for auto-posting, verification, and timeouts
        scheduler.startScheduler();

        // Start server
        app.listen(config.port, () => {
            console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║   🚀 Telegram Ad Marketplace API v2.0                             ║
║                                                                   ║
║   Server: http://localhost:${config.port}                                  ║
║   Environment: ${config.nodeEnv.padEnd(49)}║
║                                                                   ║
║   📌 Core Features:                                               ║
║   • Channel listings & marketplace                                ║
║   • Campaign briefs & applications                                ║
║   • Creative approval workflow                                    ║
║   • Auto-posting with verification                                ║
║   • Escrow with TON wallet simulation                             ║
║   • Multi-admin channel management                                ║
║   • Automatic timeout & cancellation                              ║
║                                                                   ║
║   🔗 Endpoints:                                                   ║
║   • /api/channels    - Channel management                         ║
║   • /api/listings    - Marketplace listings                       ║
║   • /api/deals       - Deal/escrow management                     ║
║   • /api/campaigns   - Advertiser campaigns                       ║
║   • /api/users       - User profile & wallet                      ║
║   • /api/admin       - Admin panel                                ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
      `);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

main();


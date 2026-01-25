import { Router, Request, Response } from 'express';
import { listingHelpers, channelHelpers } from '../database/db.js';

const router = Router();

// =============================================
// Get marketplace listings (public)
// =============================================
router.get('/', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;
        const minPrice = req.query.min_price ? parseFloat(req.query.min_price as string) : undefined;
        const maxPrice = req.query.max_price ? parseFloat(req.query.max_price as string) : undefined;
        const format = req.query.format as string | undefined;
        const minSubscribers = req.query.min_subscribers ? parseInt(req.query.min_subscribers as string) : undefined;

        const listings = await listingHelpers.getActive(limit, offset, {
            minPrice,
            maxPrice,
            format,
            minSubscribers,
        });

        res.json({
            success: true,
            data: listings,
        });
    } catch (error: any) {
        console.error('Error fetching listings:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch listings' });
    }
});

// =============================================
// Get single listing
// =============================================
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const listing = await listingHelpers.getById(parseInt(req.params.id));

        if (!listing) {
            return res.status(404).json({ success: false, error: 'Listing not found' });
        }

        res.json({ success: true, data: listing });
    } catch (error: any) {
        console.error('Error fetching listing:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch listing' });
    }
});

// =============================================
// Create listing
// =============================================
router.post('/', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { channel_id, title, description, price, currency, duration_hours, format, format_details } = req.body;

        if (!channel_id || !title || !price) {
            return res.status(400).json({ success: false, error: 'channel_id, title, and price are required' });
        }

        // Verify channel ownership
        const channel = await channelHelpers.getById(channel_id);
        if (!channel) {
            return res.status(404).json({ success: false, error: 'Channel not found' });
        }
        if (channel.owner_id !== req.user.id) {
            return res.status(403).json({ success: false, error: 'You do not own this channel' });
        }
        if (!channel.is_verified) {
            return res.status(400).json({ success: false, error: 'Channel must be verified' });
        }

        const listingId = await listingHelpers.create({
            channel_id,
            title,
            description,
            price: parseFloat(price),
            currency: currency || 'TON',
            duration_hours: duration_hours || 24,
            format: format || 'post',
            format_details,
        });

        const listing = await listingHelpers.getById(listingId);
        res.status(201).json({ success: true, data: listing });
    } catch (error: any) {
        console.error('Error creating listing:', error);
        res.status(500).json({ success: false, error: 'Failed to create listing' });
    }
});

// =============================================
// Update listing
// =============================================
router.put('/:id', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const listingId = parseInt(req.params.id);
        const listing = await listingHelpers.getById(listingId);

        if (!listing) {
            return res.status(404).json({ success: false, error: 'Listing not found' });
        }

        if (listing.owner_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        const updates: Record<string, any> = {};
        const allowedFields = ['title', 'description', 'price', 'currency', 'duration_hours', 'format', 'format_details', 'is_active'];

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        await listingHelpers.update(listingId, updates);
        const updatedListing = await listingHelpers.getById(listingId);

        res.json({ success: true, data: updatedListing });
    } catch (error: any) {
        console.error('Error updating listing:', error);
        res.status(500).json({ success: false, error: 'Failed to update listing' });
    }
});

// =============================================
// Delete listing
// =============================================
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const listingId = parseInt(req.params.id);
        const listing = await listingHelpers.getById(listingId);

        if (!listing) {
            return res.status(404).json({ success: false, error: 'Listing not found' });
        }

        if (listing.owner_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        await listingHelpers.delete(listingId);

        res.json({ success: true, message: 'Listing deleted' });
    } catch (error: any) {
        console.error('Error deleting listing:', error);
        res.status(500).json({ success: false, error: 'Failed to delete listing' });
    }
});

export default router;

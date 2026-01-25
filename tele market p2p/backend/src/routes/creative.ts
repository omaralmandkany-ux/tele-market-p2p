import { Router, Request, Response } from 'express';
import { dealHelpers, draftHelpers, notificationHelpers } from '../database/db.js';

const router = Router();

// =============================================
// Get all drafts for a deal
// =============================================
router.get('/:dealId/drafts', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const dealId = parseInt(req.params.dealId);
        const deal = await dealHelpers.getById(dealId);

        if (!deal) {
            return res.status(404).json({ success: false, error: 'Deal not found' });
        }

        // Only deal participants can view drafts
        if (deal.advertiser_id !== req.user.id && deal.channel_owner_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        const drafts = await draftHelpers.getByDeal(dealId);

        res.json({
            success: true,
            data: drafts,
        });
    } catch (error: any) {
        console.error('Error fetching drafts:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch drafts' });
    }
});

// =============================================
// Submit draft (channel owner submits for review)
// =============================================
router.post('/:dealId/drafts', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const dealId = parseInt(req.params.dealId);
        const { content, media_url } = req.body;

        if (!content) {
            return res.status(400).json({ success: false, error: 'Content is required' });
        }

        const deal = await dealHelpers.getById(dealId);

        if (!deal) {
            return res.status(404).json({ success: false, error: 'Deal not found' });
        }

        // Only channel owner can submit drafts
        if (deal.channel_owner_id !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Only channel owner can submit drafts' });
        }

        // Check deal status
        const validStatuses = ['funded', 'draft_pending', 'draft_rejected'];
        if (!validStatuses.includes(deal.status)) {
            return res.status(400).json({ success: false, error: `Cannot submit draft in ${deal.status} status` });
        }

        // Create draft
        const draftId = await draftHelpers.create({
            deal_id: dealId,
            content,
            media_url,
            submitted_by: req.user.id,
        });

        // Update deal status
        await dealHelpers.updateStatus(dealId, 'draft_submitted');

        // Notify advertiser
        await notificationHelpers.create({
            user_id: deal.advertiser_id,
            type: 'draft_submitted',
            title: 'Creative Draft Submitted',
            message: `The channel owner has submitted a draft for review for "${deal.channel_title}"`,
            data: JSON.stringify({ deal_id: dealId, draft_id: draftId }),
        });

        res.status(201).json({
            success: true,
            message: 'Draft submitted for review',
            data: { draft_id: draftId },
        });
    } catch (error: any) {
        console.error('Error submitting draft:', error);
        res.status(500).json({ success: false, error: 'Failed to submit draft' });
    }
});

// =============================================
// Review draft (advertiser approves/rejects)
// =============================================
router.put('/:dealId/drafts/:draftId/review', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const dealId = parseInt(req.params.dealId);
        const draftId = parseInt(req.params.draftId);
        const { approved, feedback } = req.body;

        const deal = await dealHelpers.getById(dealId);

        if (!deal) {
            return res.status(404).json({ success: false, error: 'Deal not found' });
        }

        // Only advertiser can review drafts
        if (deal.advertiser_id !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Only advertiser can review drafts' });
        }

        if (deal.status !== 'draft_submitted') {
            return res.status(400).json({ success: false, error: 'No draft pending review' });
        }

        // Get the draft
        const drafts = await draftHelpers.getByDeal(dealId);
        const draft = drafts.find((d: any) => d.id === draftId && d.status === 'pending');

        if (!draft) {
            return res.status(404).json({ success: false, error: 'Draft not found or already reviewed' });
        }

        // Review the draft
        await draftHelpers.review(draftId, approved, req.user.id, feedback);

        if (approved) {
            // Update deal with approved content and schedule
            await dealHelpers.updateStatus(dealId, 'draft_approved', {
                ad_content: draft.content,
                ad_media_url: draft.media_url,
            });

            // Notify channel owner
            await notificationHelpers.create({
                user_id: deal.channel_owner_id,
                type: 'draft_approved',
                title: 'Draft Approved! ✅',
                message: `Your creative draft for "${deal.channel_title}" has been approved. You can now schedule the post.`,
                data: JSON.stringify({ deal_id: dealId }),
            });

            res.json({
                success: true,
                message: 'Draft approved! Ready for scheduling.',
            });
        } else {
            // Update deal status to allow resubmission
            await dealHelpers.updateStatus(dealId, 'draft_rejected');

            // Notify channel owner
            await notificationHelpers.create({
                user_id: deal.channel_owner_id,
                type: 'draft_rejected',
                title: 'Draft Needs Revision',
                message: `Your draft for "${deal.channel_title}" needs changes. Feedback: ${feedback || 'No specific feedback provided.'}`,
                data: JSON.stringify({ deal_id: dealId, feedback }),
            });

            res.json({
                success: true,
                message: 'Draft rejected. Channel owner can submit a new version.',
            });
        }
    } catch (error: any) {
        console.error('Error reviewing draft:', error);
        res.status(500).json({ success: false, error: 'Failed to review draft' });
    }
});

// =============================================
// Schedule post after draft approval
// =============================================
router.post('/:dealId/schedule', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const dealId = parseInt(req.params.dealId);
        const { scheduled_time } = req.body;

        const deal = await dealHelpers.getById(dealId);

        if (!deal) {
            return res.status(404).json({ success: false, error: 'Deal not found' });
        }

        // Only channel owner can schedule
        if (deal.channel_owner_id !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Only channel owner can schedule' });
        }

        if (deal.status !== 'draft_approved') {
            return res.status(400).json({ success: false, error: 'Draft must be approved before scheduling' });
        }

        // Validate scheduled time
        const scheduledDate = new Date(scheduled_time);
        if (isNaN(scheduledDate.getTime())) {
            return res.status(400).json({ success: false, error: 'Invalid scheduled time' });
        }

        if (scheduledDate < new Date()) {
            return res.status(400).json({ success: false, error: 'Scheduled time must be in the future' });
        }

        // Update deal
        await dealHelpers.updateStatus(dealId, 'scheduled', {
            scheduled_time: scheduledDate.toISOString(),
        });

        // Notify advertiser
        await notificationHelpers.create({
            user_id: deal.advertiser_id,
            type: 'post_scheduled',
            title: 'Post Scheduled 📅',
            message: `Your ad on "${deal.channel_title}" is scheduled for ${scheduledDate.toLocaleString()}`,
            data: JSON.stringify({ deal_id: dealId, scheduled_time }),
        });

        res.json({
            success: true,
            message: 'Post scheduled successfully',
            data: { scheduled_time: scheduledDate.toISOString() },
        });
    } catch (error: any) {
        console.error('Error scheduling post:', error);
        res.status(500).json({ success: false, error: 'Failed to schedule post' });
    }
});

export default router;

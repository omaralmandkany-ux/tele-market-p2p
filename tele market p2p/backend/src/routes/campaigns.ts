import { Router, Request, Response } from 'express';
import { campaignHelpers, applicationHelpers, channelHelpers, dealHelpers, notificationHelpers, walletHelpers } from '../database/db.js';

const router = Router();

// =============================================
// Get all active campaigns (for channel owners to browse)
// =============================================
router.get('/', async (req: Request, res: Response) => {
    try {
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        const campaigns = await campaignHelpers.getActive(limit, offset);

        res.json({
            success: true,
            data: campaigns,
        });
    } catch (error: any) {
        console.error('Error fetching campaigns:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch campaigns' });
    }
});

// =============================================
// Get my campaigns (as advertiser)
// =============================================
router.get('/my', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const campaigns = await campaignHelpers.getByAdvertiser(req.user.id);

        res.json({
            success: true,
            data: campaigns,
        });
    } catch (error: any) {
        console.error('Error fetching my campaigns:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch campaigns' });
    }
});

// =============================================
// Get single campaign
// =============================================
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const id = parseInt(req.params.id);
        const campaign = await campaignHelpers.getById(id);

        if (!campaign) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }

        const applications = await applicationHelpers.getByCampaign(id);

        res.json({
            success: true,
            data: { ...campaign, applications },
        });
    } catch (error: any) {
        console.error('Error fetching campaign:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch campaign' });
    }
});

// =============================================
// Create new campaign (advertiser creates brief)
// =============================================
router.post('/', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const {
            title,
            description,
            budget_min,
            budget_max,
            target_subscribers_min,
            target_subscribers_max,
            target_categories,
            target_languages,
            preferred_format,
            start_date,
            end_date,
        } = req.body;

        if (!title || !description) {
            return res.status(400).json({ success: false, error: 'Title and description are required' });
        }

        const campaignId = await campaignHelpers.create({
            advertiser_id: req.user.id,
            title,
            description,
            budget_min,
            budget_max,
            target_subscribers_min,
            target_subscribers_max,
            target_categories: target_categories ? JSON.stringify(target_categories) : null,
            target_languages: target_languages ? JSON.stringify(target_languages) : null,
            preferred_format: preferred_format || 'any',
            start_date,
            end_date,
        });

        const campaign = await campaignHelpers.getById(campaignId);

        res.status(201).json({
            success: true,
            data: campaign,
            message: 'Campaign created successfully',
        });
    } catch (error: any) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ success: false, error: 'Failed to create campaign' });
    }
});

// =============================================
// Update campaign
// =============================================
router.put('/:id', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const id = parseInt(req.params.id);
        const campaign = await campaignHelpers.getById(id);

        if (!campaign) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }

        if (campaign.advertiser_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        const updates: Record<string, any> = {};
        const allowedFields = ['title', 'description', 'budget_min', 'budget_max', 'target_subscribers_min', 'target_subscribers_max', 'preferred_format', 'start_date', 'end_date', 'status'];

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        if (req.body.target_categories) {
            updates.target_categories = JSON.stringify(req.body.target_categories);
        }
        if (req.body.target_languages) {
            updates.target_languages = JSON.stringify(req.body.target_languages);
        }

        await campaignHelpers.update(id, updates);
        const updatedCampaign = await campaignHelpers.getById(id);

        res.json({
            success: true,
            data: updatedCampaign,
            message: 'Campaign updated successfully',
        });
    } catch (error: any) {
        console.error('Error updating campaign:', error);
        res.status(500).json({ success: false, error: 'Failed to update campaign' });
    }
});

// =============================================
// Apply to campaign (channel owner applies)
// =============================================
router.post('/:id/apply', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const campaignId = parseInt(req.params.id);
        const { channel_id, proposed_price, message } = req.body;

        if (!channel_id || !proposed_price) {
            return res.status(400).json({ success: false, error: 'Channel ID and proposed price are required' });
        }

        // Verify campaign exists and is active
        const campaign = await campaignHelpers.getById(campaignId);
        if (!campaign) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }
        if (campaign.status !== 'active') {
            return res.status(400).json({ success: false, error: 'Campaign is not accepting applications' });
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
            return res.status(400).json({ success: false, error: 'Channel must be verified to apply' });
        }

        // Check if already applied
        const existingApplications = await applicationHelpers.getByCampaign(campaignId);
        const alreadyApplied = existingApplications.find((a: any) => a.channel_id === channel_id);
        if (alreadyApplied) {
            return res.status(400).json({ success: false, error: 'You have already applied with this channel' });
        }

        // Create application
        const applicationId = await applicationHelpers.create({
            campaign_id: campaignId,
            channel_id,
            applicant_id: req.user.id,
            proposed_price,
            message,
        });

        // Notify advertiser
        await notificationHelpers.create({
            user_id: campaign.advertiser_id,
            type: 'campaign_application',
            title: 'New Application',
            message: `${channel.title} applied to your campaign "${campaign.title}"`,
            data: JSON.stringify({ campaign_id: campaignId, application_id: applicationId, channel_id }),
        });

        res.status(201).json({
            success: true,
            message: 'Application submitted successfully',
        });
    } catch (error: any) {
        console.error('Error applying to campaign:', error);
        res.status(500).json({ success: false, error: 'Failed to submit application' });
    }
});

// =============================================
// Get applications for a campaign
// =============================================
router.get('/:id/applications', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const campaignId = parseInt(req.params.id);
        const campaign = await campaignHelpers.getById(campaignId);

        if (!campaign) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }

        if (campaign.advertiser_id !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Not authorized to view applications' });
        }

        const applications = await applicationHelpers.getByCampaign(campaignId);

        res.json({
            success: true,
            data: applications,
        });
    } catch (error: any) {
        console.error('Error fetching applications:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch applications' });
    }
});

// =============================================
// Accept/Reject application (create deal if accepted)
// =============================================
router.put('/:id/applications/:appId', async (req: Request, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const campaignId = parseInt(req.params.id);
        const applicationId = parseInt(req.params.appId);
        const { accepted, response_message, ad_requirements, scheduled_time } = req.body;

        // Verify campaign ownership
        const campaign = await campaignHelpers.getById(campaignId);
        if (!campaign) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }
        if (campaign.advertiser_id !== req.user.id) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        // Get application
        const application = await applicationHelpers.getById(applicationId);
        if (!application || application.campaign_id !== campaignId) {
            return res.status(404).json({ success: false, error: 'Application not found' });
        }
        if (application.status !== 'pending') {
            return res.status(400).json({ success: false, error: 'Application already processed' });
        }

        if (accepted) {
            // Accept application
            await applicationHelpers.updateStatus(applicationId, 'accepted', response_message);

            // Get channel info
            const channel = await channelHelpers.getById(application.channel_id);

            // Create escrow wallet for deal
            const escrowWallet = await walletHelpers.createEscrowWallet(0); // Temporary, will update after deal creation

            // Create deal
            const dealId = await dealHelpers.create({
                campaign_id: campaignId,
                application_id: applicationId,
                advertiser_id: req.user.id,
                channel_owner_id: application.applicant_id,
                channel_id: application.channel_id,
                escrow_amount: application.proposed_price,
                ad_requirements,
                scheduled_time,
                expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(), // 72 hours
            });

            // Update escrow wallet with deal id
            await walletHelpers.createEscrowWallet(dealId);

            // Notify channel owner
            await notificationHelpers.create({
                user_id: application.applicant_id,
                type: 'application_accepted',
                title: 'Application Accepted! 🎉',
                message: `Your application for "${campaign.title}" was accepted. Please wait for funding.`,
                data: JSON.stringify({ campaign_id: campaignId, deal_id: dealId }),
            });

            res.json({
                success: true,
                message: 'Application accepted, deal created',
                data: { deal_id: dealId },
            });
        } else {
            // Reject application
            await applicationHelpers.updateStatus(applicationId, 'rejected', response_message);

            // Notify channel owner
            await notificationHelpers.create({
                user_id: application.applicant_id,
                type: 'application_rejected',
                title: 'Application Status Update',
                message: `Your application for "${campaign.title}" was not selected.`,
                data: JSON.stringify({ campaign_id: campaignId }),
            });

            res.json({
                success: true,
                message: 'Application rejected',
            });
        }
    } catch (error: any) {
        console.error('Error processing application:', error);
        res.status(500).json({ success: false, error: 'Failed to process application' });
    }
});

export default router;

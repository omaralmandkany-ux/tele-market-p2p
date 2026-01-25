import { Router, Request, Response } from "express";
import { collections, addDoc, getDoc, updateDoc, queryDocs } from "../firebase";

const router = Router();

interface Campaign {
    id: string;
    advertiserId: string;
    title: string;
    description: string;
    budget: number;
    niche: string;
    requirements?: string;
    status: "active" | "paused" | "completed";
    createdAt: unknown;
}

interface Application {
    id: string;
    campaignId: string;
    channelId: string;
    channelOwnerId: string;
    message?: string;
    proposedPrice: number;
    status: "pending" | "accepted" | "rejected";
    createdAt: unknown;
}

// GET /api/campaigns - Get all active campaigns
router.get("/", async (_req: Request, res: Response) => {
    const campaigns = await queryDocs<Campaign>(
        collections.campaigns,
        "status",
        "==",
        "active"
    );
    res.json(campaigns);
});

// GET /api/campaigns/my - Get user's campaigns
router.get("/my", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: { id: string } }).user;
    const campaigns = await queryDocs<Campaign>(
        collections.campaigns,
        "advertiserId",
        "==",
        user.id
    );
    res.json(campaigns);
});

// POST /api/campaigns - Create a new campaign
router.post("/", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: { id: string } }).user;
    const { title, description, budget, niche, requirements } = req.body;

    if (!title || !budget || !niche) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const campaignId = await addDoc(collections.campaigns, {
        advertiserId: user.id,
        title,
        description: description || "",
        budget: Number(budget),
        niche,
        requirements: requirements || "",
        status: "active",
    });

    const campaign = await getDoc<Campaign>(collections.campaigns, campaignId);
    res.json(campaign);
});

// PUT /api/campaigns/:id - Update a campaign
router.put("/:id", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: { id: string } }).user;
    const { id } = req.params;
    const { title, description, budget, niche, requirements, status } = req.body;

    const campaign = await getDoc<Campaign>(collections.campaigns, id);
    if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
    }

    if (campaign.advertiserId !== user.id) {
        return res.status(403).json({ error: "Not your campaign" });
    }

    await updateDoc(collections.campaigns, id, {
        ...(title && { title }),
        ...(description && { description }),
        ...(budget && { budget: Number(budget) }),
        ...(niche && { niche }),
        ...(requirements !== undefined && { requirements }),
        ...(status && { status }),
    });

    const updated = await getDoc<Campaign>(collections.campaigns, id);
    res.json(updated);
});

// GET /api/campaigns/:id/applications - Get applications for a campaign
router.get("/:id/applications", async (req: Request, res: Response) => {
    const { id } = req.params;
    const applications = await queryDocs<Application>(
        collections.notifications, // Using notifications as applications collection
        "campaignId",
        "==",
        id
    );
    res.json(applications);
});

// POST /api/campaigns/:id/apply - Apply to a campaign
router.post("/:id/apply", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: { id: string } }).user;
    const { id } = req.params;
    const { channelId, message, proposedPrice } = req.body;

    const campaign = await getDoc<Campaign>(collections.campaigns, id);
    if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
    }

    if (!channelId) {
        return res.status(400).json({ error: "Channel ID required" });
    }

    // Verify channel ownership
    const channel = await getDoc<{ ownerId: string }>(
        collections.channels,
        channelId
    );
    if (!channel || channel.ownerId !== user.id) {
        return res.status(403).json({ error: "Not your channel" });
    }

    // Create application in a subcollection or separate collection
    const applicationId = await addDoc(collections.notifications, {
        type: "campaign_application",
        campaignId: id,
        channelId,
        channelOwnerId: user.id,
        message: message || "",
        proposedPrice: proposedPrice || campaign.budget,
        status: "pending",
    });

    res.json({ success: true, applicationId });
});

// DELETE /api/campaigns/:id - Delete a campaign
router.delete("/:id", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: { id: string } }).user;
    const { id } = req.params;

    const campaign = await getDoc<Campaign>(collections.campaigns, id);
    if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
    }

    if (campaign.advertiserId !== user.id) {
        return res.status(403).json({ error: "Not your campaign" });
    }

    await collections.campaigns.doc(id).delete();
    res.json({ success: true });
});

export default router;

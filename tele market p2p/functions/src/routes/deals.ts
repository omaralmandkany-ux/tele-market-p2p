import { Router, Request, Response } from "express";
import { collections, addDoc, getDoc, updateDoc, queryDocs } from "../firebase";

const router = Router();

type DealStatus =
    | "pending"
    | "accepted"
    | "funded"
    | "draft_submitted"
    | "draft_approved"
    | "posted"
    | "completed"
    | "disputed"
    | "cancelled"
    | "refunded";

interface Deal {
    id: string;
    listingId: string;
    advertiserId: string;
    channelOwnerId: string;
    status: DealStatus;
    amount: number;
    adContent?: string;
    mediaUrl?: string;
    scheduledTime?: unknown;
    createdAt: unknown;
}

// GET /api/deals - Get user's deals
router.get("/", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: { id: string } }).user;

    const asAdvertiser = await queryDocs<Deal>(
        collections.deals,
        "advertiserId",
        "==",
        user.id
    );
    const asOwner = await queryDocs<Deal>(
        collections.deals,
        "channelOwnerId",
        "==",
        user.id
    );

    res.json({
        asAdvertiser,
        asOwner,
    });
});

// POST /api/deals - Create a new deal
router.post("/", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: { id: string } }).user;
    const { listingId, adContent, mediaUrl, scheduledTime } = req.body;

    if (!listingId) {
        return res.status(400).json({ error: "Listing ID required" });
    }

    const listing = await getDoc<{ channelId: string; price: number }>(
        collections.listings,
        listingId
    );
    if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
    }

    const channel = await getDoc<{ ownerId: string }>(
        collections.channels,
        listing.channelId
    );
    if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
    }

    const dealId = await addDoc(collections.deals, {
        listingId,
        advertiserId: user.id,
        channelOwnerId: channel.ownerId,
        status: "pending",
        amount: listing.price,
        adContent: adContent || "",
        mediaUrl: mediaUrl || "",
        scheduledTime: scheduledTime || null,
    });

    const deal = await getDoc<Deal>(collections.deals, dealId);
    res.json(deal);
});

// POST /api/deals/:id/accept - Channel owner accepts deal
router.post("/:id/accept", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: { id: string } }).user;
    const { id } = req.params;

    const deal = await getDoc<Deal>(collections.deals, id);
    if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
    }

    if (deal.channelOwnerId !== user.id) {
        return res.status(403).json({ error: "Not authorized" });
    }

    if (deal.status !== "pending") {
        return res.status(400).json({ error: "Deal is not pending" });
    }

    await updateDoc(collections.deals, id, { status: "accepted" });
    const updated = await getDoc<Deal>(collections.deals, id);
    res.json(updated);
});

// POST /api/deals/:id/fund - Advertiser funds the deal
router.post("/:id/fund", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: { id: string; balance: number } }).user;
    const { id } = req.params;

    const deal = await getDoc<Deal>(collections.deals, id);
    if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
    }

    if (deal.advertiserId !== user.id) {
        return res.status(403).json({ error: "Not authorized" });
    }

    if (deal.status !== "accepted") {
        return res.status(400).json({ error: "Deal is not accepted" });
    }

    if (user.balance < deal.amount) {
        return res.status(400).json({ error: "Insufficient balance" });
    }

    // Deduct from advertiser balance
    await updateDoc(collections.users, user.id, {
        balance: user.balance - deal.amount,
    });

    await updateDoc(collections.deals, id, { status: "funded" });
    const updated = await getDoc<Deal>(collections.deals, id);
    res.json(updated);
});

// POST /api/deals/:id/complete - Complete the deal
router.post("/:id/complete", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: { id: string } }).user;
    const { id } = req.params;

    const deal = await getDoc<Deal>(collections.deals, id);
    if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
    }

    if (deal.advertiserId !== user.id) {
        return res.status(403).json({ error: "Not authorized" });
    }

    if (deal.status !== "posted" && deal.status !== "funded") {
        return res.status(400).json({ error: "Deal cannot be completed" });
    }

    // Transfer funds to channel owner
    const owner = await getDoc<{ balance: number }>(
        collections.users,
        deal.channelOwnerId
    );
    if (owner) {
        const platformFee = deal.amount * 0.05; // 5% fee
        const ownerAmount = deal.amount - platformFee;
        await updateDoc(collections.users, deal.channelOwnerId, {
            balance: owner.balance + ownerAmount,
        });
    }

    await updateDoc(collections.deals, id, { status: "completed" });
    const updated = await getDoc<Deal>(collections.deals, id);
    res.json(updated);
});

// POST /api/deals/:id/cancel - Cancel the deal
router.post("/:id/cancel", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: { id: string } }).user;
    const { id } = req.params;

    const deal = await getDoc<Deal>(collections.deals, id);
    if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
    }

    if (deal.advertiserId !== user.id && deal.channelOwnerId !== user.id) {
        return res.status(403).json({ error: "Not authorized" });
    }

    if (deal.status === "completed") {
        return res.status(400).json({ error: "Cannot cancel completed deal" });
    }

    // Refund if funded
    if (deal.status === "funded") {
        const advertiser = await getDoc<{ balance: number }>(
            collections.users,
            deal.advertiserId
        );
        if (advertiser) {
            await updateDoc(collections.users, deal.advertiserId, {
                balance: advertiser.balance + deal.amount,
            });
        }
    }

    await updateDoc(collections.deals, id, { status: "cancelled" });
    const updated = await getDoc<Deal>(collections.deals, id);
    res.json(updated);
});

// GET /api/deals/:id - Get deal details
router.get("/:id", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: { id: string } }).user;
    const { id } = req.params;
    const deal = await getDoc<Deal>(collections.deals, id);

    if (!deal) {
        return res.status(404).json({ error: "Deal not found" });
    }

    // SECURITY: only the two parties may see a deal
    if (deal.advertiserId !== user.id && deal.channelOwnerId !== user.id) {
        return res.status(403).json({ error: "Not authorized" });
    }

    res.json(deal);
});

export default router;

import { Router, Request, Response } from "express";
import { collections, addDoc, getDoc, updateDoc, queryDocs } from "../firebase";

const router = Router();

interface Listing {
    id: string;
    channelId: string;
    adType: string;
    price: number;
    duration: number;
    description?: string;
    isActive: boolean;
    createdAt: unknown;
}

// GET /api/listings - Get all active listings
router.get("/", async (req: Request, res: Response) => {
    const { niche, minPrice, maxPrice, minSubscribers } = req.query;

    let listings = await queryDocs<Listing>(
        collections.listings,
        "isActive",
        "==",
        true
    );

    // Apply filters (basic implementation)
    if (minPrice) {
        listings = listings.filter((l) => l.price >= Number(minPrice));
    }
    if (maxPrice) {
        listings = listings.filter((l) => l.price <= Number(maxPrice));
    }

    res.json(listings);
});

// GET /api/listings/my - Get user's listings
router.get("/my", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: { id: string } }).user;

    // Get user's channels first
    const channels = await queryDocs<{ id: string }>(
        collections.channels,
        "ownerId",
        "==",
        user.id
    );
    const channelIds = channels.map((c) => c.id);

    if (channelIds.length === 0) {
        return res.json([]);
    }

    // Get listings for those channels
    const allListings: Listing[] = [];
    for (const channelId of channelIds) {
        const listings = await queryDocs<Listing>(
            collections.listings,
            "channelId",
            "==",
            channelId
        );
        allListings.push(...listings);
    }

    res.json(allListings);
});

// POST /api/listings - Create a new listing
router.post("/", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: { id: string } }).user;
    const { channelId, adType, price, duration, description } = req.body;

    if (!channelId || !adType || !price) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    // Verify channel ownership
    const channel = await getDoc<{ ownerId: string }>(
        collections.channels,
        channelId
    );
    if (!channel || channel.ownerId !== user.id) {
        return res.status(403).json({ error: "Not your channel" });
    }

    const listingId = await addDoc(collections.listings, {
        channelId,
        adType,
        price: Number(price),
        duration: duration || 24,
        description: description || "",
        isActive: true,
    });

    const listing = await getDoc<Listing>(collections.listings, listingId);
    res.json(listing);
});

// PUT /api/listings/:id - Update a listing
router.put("/:id", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: { id: string } }).user;
    const { id } = req.params;
    const { adType, price, duration, description, isActive } = req.body;

    const listing = await getDoc<Listing>(collections.listings, id);
    if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
    }

    // Verify ownership through channel
    const channel = await getDoc<{ ownerId: string }>(
        collections.channels,
        listing.channelId
    );
    if (!channel || channel.ownerId !== user.id) {
        return res.status(403).json({ error: "Not your listing" });
    }

    await updateDoc(collections.listings, id, {
        ...(adType && { adType }),
        ...(price && { price: Number(price) }),
        ...(duration && { duration }),
        ...(description !== undefined && { description }),
        ...(isActive !== undefined && { isActive }),
    });

    const updated = await getDoc<Listing>(collections.listings, id);
    res.json(updated);
});

// DELETE /api/listings/:id - Delete a listing
router.delete("/:id", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: { id: string } }).user;
    const { id } = req.params;

    const listing = await getDoc<Listing>(collections.listings, id);
    if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
    }

    const channel = await getDoc<{ ownerId: string }>(
        collections.channels,
        listing.channelId
    );
    if (!channel || channel.ownerId !== user.id) {
        return res.status(403).json({ error: "Not your listing" });
    }

    await collections.listings.doc(id).delete();
    res.json({ success: true });
});

// GET /api/listings/:id - Get listing details
router.get("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const listing = await getDoc<Listing>(collections.listings, id);

    if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
    }

    res.json(listing);
});

export default router;

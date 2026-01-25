import { Router, Request, Response } from "express";
import { collections, addDoc, getDoc, updateDoc, queryDocs } from "../firebase";
import { getChatInfo, getChatMemberCount, getChatAdministrators } from "../telegram";

const router = Router();

interface Channel {
    id: string;
    telegramId: number;
    username?: string;
    title: string;
    subscriberCount: number;
    verified: boolean;
    ownerId: string;
}

// GET /api/channels - Get all verified channels
router.get("/", async (_req: Request, res: Response) => {
    const channels = await queryDocs<Channel>(
        collections.channels,
        "verified",
        "==",
        true
    );
    res.json(channels);
});

// GET /api/channels/my - Get user's channels
router.get("/my", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: { id: string } }).user;
    const channels = await queryDocs<Channel>(
        collections.channels,
        "ownerId",
        "==",
        user.id
    );
    res.json(channels);
});

// POST /api/channels - Add a new channel
router.post("/", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: { id: string } }).user;
    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ error: "Channel username required" });
    }

    try {
        // Get chat info from Telegram
        const chatInfo = await getChatInfo(`@${username}`);
        if (!chatInfo) {
            return res.status(404).json({ error: "Channel not found on Telegram" });
        }

        const chat = chatInfo as { id: number; title: string; username?: string };
        const memberCount = await getChatMemberCount(chat.id);

        const channelId = await addDoc(collections.channels, {
            telegramId: chat.id,
            username: chat.username || username,
            title: chat.title,
            subscriberCount: memberCount,
            verified: false,
            ownerId: user.id,
        });

        const channel = await getDoc<Channel>(collections.channels, channelId);
        res.json(channel);
    } catch (error) {
        res.status(500).json({ error: "Failed to add channel" });
    }
});

// POST /api/channels/:id/verify - Verify channel ownership
router.post("/:id/verify", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: { id: string; telegramId: number } }).user;
    const { id } = req.params;

    const channel = await getDoc<Channel>(collections.channels, id);
    if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
    }

    if (channel.ownerId !== user.id) {
        return res.status(403).json({ error: "Not your channel" });
    }

    try {
        // Check if user is admin of the channel
        const admins = await getChatAdministrators(channel.telegramId);
        const isAdmin = (admins as Array<{ user: { id: number } }>).some(
            (admin) => admin.user.id === user.telegramId
        );

        if (!isAdmin) {
            return res.status(403).json({ error: "You must be an admin of this channel" });
        }

        // Update subscriber count and verify
        const memberCount = await getChatMemberCount(channel.telegramId);
        await updateDoc(collections.channels, id, {
            verified: true,
            subscriberCount: memberCount,
        });

        const updatedChannel = await getDoc<Channel>(collections.channels, id);
        res.json(updatedChannel);
    } catch (error) {
        res.status(500).json({ error: "Verification failed" });
    }
});

// GET /api/channels/:id - Get channel details
router.get("/:id", async (req: Request, res: Response) => {
    const { id } = req.params;
    const channel = await getDoc<Channel>(collections.channels, id);

    if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
    }

    res.json(channel);
});

// DELETE /api/channels/:id - Delete a channel
router.delete("/:id", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: { id: string } }).user;
    const { id } = req.params;

    const channel = await getDoc<Channel>(collections.channels, id);
    if (!channel) {
        return res.status(404).json({ error: "Channel not found" });
    }

    if (channel.ownerId !== user.id) {
        return res.status(403).json({ error: "Not your channel" });
    }

    await collections.channels.doc(id).delete();
    res.json({ success: true });
});

export default router;

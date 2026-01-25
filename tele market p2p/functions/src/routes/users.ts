import { Router, Request, Response } from "express";
import { collections, addDoc, getDoc, updateDoc, queryDocs } from "../firebase";
import { validateInitData } from "../telegram";

const router = Router();

interface User {
    id: string;
    telegramId: number;
    username?: string;
    firstName: string;
    balance: number;
    isAdmin: boolean;
    createdAt: unknown;
}

// Auth middleware
router.use(async (req: Request, res: Response, next) => {
    const initData = req.headers["x-telegram-init-data"] as string;
    const result = validateInitData(initData);

    if (!result.valid || !result.user) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    // Get or create user
    const telegramId = result.user.id.toString();
    let user = await getDoc<User>(collections.users, telegramId);

    if (!user) {
        await collections.users.doc(telegramId).set({
            telegramId: result.user.id,
            username: result.user.username || null,
            firstName: result.user.first_name,
            balance: 0,
            isAdmin: false,
            createdAt: new Date(),
        });
        user = await getDoc<User>(collections.users, telegramId);
    }

    (req as unknown as { user: User }).user = user!;
    next();
});

// GET /api/users/me - Get current user profile
router.get("/me", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: User }).user;
    res.json(user);
});

// GET /api/users/stats - Get user statistics
router.get("/stats", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: User }).user;

    const channels = await queryDocs(
        collections.channels,
        "ownerId",
        "==",
        user.id
    );
    const deals = await queryDocs(
        collections.deals,
        "advertiserId",
        "==",
        user.id
    );

    res.json({
        channelsCount: channels.length,
        dealsCount: deals.length,
        balance: user.balance,
    });
});

// GET /api/users/notifications - Get notifications
router.get("/notifications", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: User }).user;
    const notifications = await queryDocs(
        collections.notifications,
        "userId",
        "==",
        user.id
    );
    res.json(notifications);
});

// POST /api/users/wallet/deposit - Deposit to wallet
router.post("/wallet/deposit", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: User }).user;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
    }

    const newBalance = user.balance + amount;
    await updateDoc(collections.users, user.id, { balance: newBalance });

    // Record transaction
    await addDoc(collections.transactions, {
        userId: user.id,
        type: "deposit",
        amount,
        status: "completed",
    });

    res.json({ success: true, balance: newBalance });
});

// POST /api/users/wallet/withdraw - Withdraw from wallet
router.post("/wallet/withdraw", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: User }).user;
    const { amount, address } = req.body;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
    }

    if (user.balance < amount) {
        return res.status(400).json({ error: "Insufficient balance" });
    }

    const newBalance = user.balance - amount;
    await updateDoc(collections.users, user.id, { balance: newBalance });

    // Record transaction
    await addDoc(collections.transactions, {
        userId: user.id,
        type: "withdrawal",
        amount,
        address,
        status: "completed",
    });

    res.json({ success: true, balance: newBalance });
});

// GET /api/users/transactions - Get transaction history
router.get("/transactions", async (req: Request, res: Response) => {
    const user = (req as unknown as { user: User }).user;
    const transactions = await queryDocs(
        collections.transactions,
        "userId",
        "==",
        user.id
    );
    res.json(transactions);
});

export default router;

import * as functions from "firebase-functions";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";

// Import routes
import usersRouter, { requireTelegramAuth } from "./routes/users";
import channelsRouter from "./routes/channels";
import listingsRouter from "./routes/listings";
import dealsRouter from "./routes/deals";
import campaignsRouter from "./routes/campaigns";

// Initialize Express app
const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// Health check
app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Mount routes
app.use("/api/users", usersRouter);
// SECURITY: these routers read req.user but had no auth middleware of their own
app.use("/api/channels", requireTelegramAuth, channelsRouter);
app.use("/api/listings", requireTelegramAuth, listingsRouter);
app.use("/api/deals", requireTelegramAuth, dealsRouter);
app.use("/api/campaigns", requireTelegramAuth, campaignsRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal server error" });
});

// Export as Firebase Cloud Function
export const api = functions.https.onRequest(app);

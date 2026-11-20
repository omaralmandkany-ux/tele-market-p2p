import * as crypto from "crypto";

const BOT_TOKEN = process.env.BOT_TOKEN || "";

interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
}

interface InitDataResult {
    valid: boolean;
    user?: TelegramUser;
    error?: string;
}

export function validateInitData(initData: string): InitDataResult {
    try {
        if (!initData) {
            return { valid: false, error: "No initData provided" };
        }

        // For development/testing - allow bypass
        if (process.env.NODE_ENV === "development" && initData === "test") {
            return {
                valid: true,
                user: {
                    id: 12345,
                    first_name: "Test",
                    username: "testuser",
                },
            };
        }

        // SECURITY: without a bot token the HMAC key is public and anyone can forge initData
        if (!BOT_TOKEN) {
            return { valid: false, error: "BOT_TOKEN not configured" };
        }

        const params = new URLSearchParams(initData);
        const hash = params.get("hash");
        if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) {
            return { valid: false, error: "Invalid hash" };
        }
        params.delete("hash");

        // Sort parameters
        const dataCheckString = Array.from(params.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => `${key}=${value}`)
            .join("\n");

        // Create secret key
        const secretKey = crypto
            .createHmac("sha256", "WebAppData")
            .update(BOT_TOKEN)
            .digest();

        // Calculate hash
        const calculatedHash = crypto
            .createHmac("sha256", secretKey)
            .update(dataCheckString)
            .digest();

        const providedHash = Buffer.from(hash, "hex");
        if (providedHash.length !== calculatedHash.length ||
            !crypto.timingSafeEqual(providedHash, calculatedHash)) {
            return { valid: false, error: "Invalid hash" };
        }

        // Reject stale init data (replay protection, 24h)
        const authDate = parseInt(params.get("auth_date") || "0", 10);
        const now = Math.floor(Date.now() / 1000);
        if (!authDate || now - authDate > 86400) {
            return { valid: false, error: "Expired" };
        }

        // Parse user data
        const userStr = params.get("user");
        if (!userStr) {
            return { valid: false, error: "No user data" };
        }

        const user = JSON.parse(userStr) as TelegramUser;
        return { valid: true, user };
    } catch (error) {
        return { valid: false, error: "Validation error" };
    }
}

// Telegram Bot API helper
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function getChatInfo(chatId: string | number): Promise<unknown> {
    const response = await fetch(`${TELEGRAM_API}/getChat?chat_id=${chatId}`);
    const data = await response.json();
    return data.ok ? data.result : null;
}

export async function getChatMemberCount(chatId: string | number): Promise<number> {
    const response = await fetch(`${TELEGRAM_API}/getChatMemberCount?chat_id=${chatId}`);
    const data = await response.json();
    return data.ok ? data.result : 0;
}

export async function sendMessage(
    chatId: string | number,
    text: string
): Promise<boolean> {
    const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    const data = await response.json();
    return data.ok;
}

export async function getChatAdministrators(
    chatId: string | number
): Promise<unknown[]> {
    const response = await fetch(
        `${TELEGRAM_API}/getChatAdministrators?chat_id=${chatId}`
    );
    const data = await response.json();
    return data.ok ? data.result : [];
}

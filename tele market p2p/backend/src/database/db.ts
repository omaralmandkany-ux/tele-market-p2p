import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Database file path
const DB_PATH = process.env.DB_PATH || './data/database.sqlite';

// Ensure directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Database connection
let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

// Initialize database with tables
export async function initializeDatabase(): Promise<void> {
  const database = getDb();

  // Create tables
  database.exec(`
        -- Users table
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER UNIQUE NOT NULL,
            username TEXT,
            first_name TEXT,
            photo_url TEXT,
            role TEXT DEFAULT 'user',
            balance REAL DEFAULT 0,
            wallet_address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Channels table
        CREATE TABLE IF NOT EXISTS channels (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telegram_id INTEGER,
            username TEXT,
            title TEXT NOT NULL,
            description TEXT,
            subscribers_count INTEGER,
            avg_views INTEGER,
            owner_id INTEGER NOT NULL,
            is_verified INTEGER DEFAULT 0,
            bot_is_admin INTEGER DEFAULT 0,
            verification_code TEXT,
            categories TEXT,
            photo_url TEXT,
            premium_percentage REAL,
            language_stats TEXT,
            last_stats_update DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES users(id)
        );

        -- Channel Managers table
        CREATE TABLE IF NOT EXISTS channel_managers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            telegram_id INTEGER NOT NULL,
            role TEXT DEFAULT 'admin',
            permissions TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(channel_id, user_id)
        );

        -- Listings table
        CREATE TABLE IF NOT EXISTS listings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            price REAL NOT NULL,
            currency TEXT DEFAULT 'TON',
            duration_hours INTEGER DEFAULT 24,
            format TEXT DEFAULT 'post',
            format_details TEXT,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
        );

        -- Campaigns table
        CREATE TABLE IF NOT EXISTS campaigns (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            advertiser_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            budget_min REAL,
            budget_max REAL,
            target_subscribers_min INTEGER,
            target_subscribers_max INTEGER,
            target_categories TEXT,
            target_languages TEXT,
            preferred_format TEXT DEFAULT 'any',
            start_date DATETIME,
            end_date DATETIME,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (advertiser_id) REFERENCES users(id)
        );

        -- Campaign Applications table
        CREATE TABLE IF NOT EXISTS campaign_applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            campaign_id INTEGER NOT NULL,
            channel_id INTEGER NOT NULL,
            applicant_id INTEGER NOT NULL,
            proposed_price REAL NOT NULL,
            message TEXT,
            status TEXT DEFAULT 'pending',
            response_message TEXT,
            responded_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
            FOREIGN KEY (channel_id) REFERENCES channels(id),
            FOREIGN KEY (applicant_id) REFERENCES users(id)
        );

        -- Deals table
        CREATE TABLE IF NOT EXISTS deals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            listing_id INTEGER,
            campaign_id INTEGER,
            application_id INTEGER,
            advertiser_id INTEGER NOT NULL,
            channel_owner_id INTEGER NOT NULL,
            channel_id INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            escrow_amount REAL,
            escrow_wallet_address TEXT,
            ad_content TEXT,
            ad_media_url TEXT,
            ad_requirements TEXT,
            scheduled_time DATETIME,
            posted_message_id INTEGER,
            posted_at DATETIME,
            completed_at DATETIME,
            expires_at DATETIME,
            last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (listing_id) REFERENCES listings(id),
            FOREIGN KEY (campaign_id) REFERENCES campaigns(id),
            FOREIGN KEY (advertiser_id) REFERENCES users(id),
            FOREIGN KEY (channel_owner_id) REFERENCES users(id),
            FOREIGN KEY (channel_id) REFERENCES channels(id)
        );

        -- Creative Drafts table
        CREATE TABLE IF NOT EXISTS creative_drafts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            deal_id INTEGER NOT NULL,
            version INTEGER DEFAULT 1,
            content TEXT NOT NULL,
            media_url TEXT,
            submitted_by INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            feedback TEXT,
            reviewed_by INTEGER,
            reviewed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (deal_id) REFERENCES deals(id) ON DELETE CASCADE,
            FOREIGN KEY (submitted_by) REFERENCES users(id),
            FOREIGN KEY (reviewed_by) REFERENCES users(id)
        );

        -- Wallets table
        CREATE TABLE IF NOT EXISTS wallets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            address TEXT NOT NULL,
            type TEXT DEFAULT 'main',
            balance REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        -- Escrow Wallets table
        CREATE TABLE IF NOT EXISTS escrow_wallets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            deal_id INTEGER NOT NULL UNIQUE,
            address TEXT NOT NULL,
            balance REAL DEFAULT 0,
            status TEXT DEFAULT 'pending',
            funded_at DATETIME,
            released_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (deal_id) REFERENCES deals(id)
        );

        -- Transactions table
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            deal_id INTEGER,
            from_user_id INTEGER,
            to_user_id INTEGER,
            from_wallet_address TEXT,
            to_wallet_address TEXT,
            amount REAL NOT NULL,
            fee_amount REAL DEFAULT 0,
            type TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            tx_hash TEXT,
            completed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (deal_id) REFERENCES deals(id),
            FOREIGN KEY (from_user_id) REFERENCES users(id),
            FOREIGN KEY (to_user_id) REFERENCES users(id)
        );

        -- Notifications table
        CREATE TABLE IF NOT EXISTS notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT,
            data TEXT,
            is_read INTEGER DEFAULT 0,
            bot_message_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );

        -- Post Verifications table
        CREATE TABLE IF NOT EXISTS post_verifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            deal_id INTEGER NOT NULL UNIQUE,
            message_id INTEGER NOT NULL,
            channel_telegram_id INTEGER NOT NULL,
            content_hash TEXT,
            is_present INTEGER DEFAULT 1,
            is_modified INTEGER DEFAULT 0,
            check_count INTEGER DEFAULT 0,
            last_check_at DATETIME,
            first_missing_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (deal_id) REFERENCES deals(id)
        );

        -- Scheduled Tasks table
        CREATE TABLE IF NOT EXISTS scheduled_tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            target_id INTEGER NOT NULL,
            target_type TEXT NOT NULL,
            scheduled_at DATETIME NOT NULL,
            status TEXT DEFAULT 'pending',
            result TEXT,
            error TEXT,
            retry_count INTEGER DEFAULT 0,
            executed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
        CREATE INDEX IF NOT EXISTS idx_channels_owner ON channels(owner_id);
        CREATE INDEX IF NOT EXISTS idx_channels_username ON channels(username);
        CREATE INDEX IF NOT EXISTS idx_listings_channel ON listings(channel_id);
        CREATE INDEX IF NOT EXISTS idx_deals_advertiser ON deals(advertiser_id);
        CREATE INDEX IF NOT EXISTS idx_deals_owner ON deals(channel_owner_id);
        CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
    `);

  console.log('✅ SQLite Database initialized successfully');
}

// =============================================
// User Helpers
// =============================================
export const userHelpers = {
  getByTelegramId(telegramId: number): any {
    const stmt = getDb().prepare('SELECT * FROM users WHERE telegram_id = ?');
    return stmt.get(telegramId);
  },

  getById(id: number): any {
    const stmt = getDb().prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
  },

  create(telegramId: number, username: string | null, firstName: string | null, photoUrl: string | null): number {
    const stmt = getDb().prepare('INSERT INTO users (telegram_id, username, first_name, photo_url) VALUES (?, ?, ?, ?)');
    const result = stmt.run(telegramId, username, firstName, photoUrl);
    return Number(result.lastInsertRowid);
  },

  update(id: number, data: Record<string, any>): void {
    const sets: string[] = [];
    const values: any[] = [];
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        sets.push(`${key} = ?`);
        values.push(value);
      }
    });
    if (sets.length === 0) return;
    values.push(id);
    const stmt = getDb().prepare(`UPDATE users SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
    stmt.run(...values);
  },

  updateBalance(userId: number, amount: number): void {
    const stmt = getDb().prepare('UPDATE users SET balance = balance + ? WHERE id = ?');
    stmt.run(amount, userId);
  },
};

// =============================================
// Channel Helpers
// =============================================
export const channelHelpers = {
  getByOwner(ownerId: number): any[] {
    const stmt = getDb().prepare('SELECT * FROM channels WHERE owner_id = ?');
    return stmt.all(ownerId) as any[];
  },

  getById(id: number): any {
    const stmt = getDb().prepare('SELECT * FROM channels WHERE id = ?');
    return stmt.get(id);
  },

  getByUsername(username: string): any {
    const stmt = getDb().prepare('SELECT * FROM channels WHERE username = ?');
    return stmt.get(username);
  },

  getVerified(limit = 50, offset = 0): any[] {
    const stmt = getDb().prepare(`
            SELECT c.*, u.username as owner_username, u.first_name as owner_first_name 
            FROM channels c JOIN users u ON c.owner_id = u.id 
            WHERE c.is_verified = 1 
            ORDER BY c.subscribers_count DESC 
            LIMIT ? OFFSET ?
        `);
    return stmt.all(limit, offset) as any[];
  },

  create(data: Record<string, any>): number {
    const stmt = getDb().prepare(`
            INSERT INTO channels (telegram_id, username, title, description, subscribers_count, owner_id, categories, photo_url) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
    const result = stmt.run(
      data.telegram_id || null, data.username || null, data.title,
      data.description || null, data.subscribers_count || null,
      data.owner_id, data.categories || null, data.photo_url || null
    );
    return Number(result.lastInsertRowid);
  },

  update(id: number, data: Record<string, any>): void {
    const sets: string[] = [];
    const values: any[] = [];
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        sets.push(`${key} = ?`);
        values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
      }
    });
    if (sets.length === 0) return;
    values.push(id);
    const stmt = getDb().prepare(`UPDATE channels SET ${sets.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  },

  updateVerification(id: number, isVerified: boolean, verificationCode?: string): void {
    const stmt = getDb().prepare('UPDATE channels SET is_verified = ?, verification_code = ? WHERE id = ?');
    stmt.run(isVerified ? 1 : 0, verificationCode || null, id);
  },
};

// =============================================
// Channel Manager Helpers
// =============================================
export const managerHelpers = {
  getByChannel(channelId: number): any[] {
    const stmt = getDb().prepare(`
            SELECT cm.*, u.username, u.first_name, u.photo_url 
            FROM channel_managers cm JOIN users u ON cm.user_id = u.id 
            WHERE cm.channel_id = ?
        `);
    return stmt.all(channelId) as any[];
  },

  add(channelId: number, userId: number, telegramId: number, role: string, permissions?: string): void {
    const stmt = getDb().prepare(`
            INSERT OR REPLACE INTO channel_managers (channel_id, user_id, telegram_id, role, permissions) 
            VALUES (?, ?, ?, ?, ?)
        `);
    stmt.run(channelId, userId, telegramId, role, permissions || null);
  },

  remove(channelId: number, userId: number): void {
    const stmt = getDb().prepare('DELETE FROM channel_managers WHERE channel_id = ? AND user_id = ?');
    stmt.run(channelId, userId);
  },

  isManager(channelId: number, userId: number): boolean {
    const stmt = getDb().prepare('SELECT id FROM channel_managers WHERE channel_id = ? AND user_id = ?');
    return !!stmt.get(channelId, userId);
  },

  hasPermission(channelId: number, userId: number, permission: string): boolean {
    const stmt = getDb().prepare('SELECT permissions FROM channel_managers WHERE channel_id = ? AND user_id = ?');
    const row = stmt.get(channelId, userId) as any;
    if (!row || !row.permissions) return false;
    try {
      const parsed = JSON.parse(row.permissions);
      return parsed[permission] === true;
    } catch {
      return false;
    }
  },
};

// =============================================
// Listing Helpers
// =============================================
export const listingHelpers = {
  getActive(limit = 50, offset = 0, filters?: { minPrice?: number; maxPrice?: number; format?: string; minSubscribers?: number }): any[] {
    let query = `
            SELECT l.*, c.title as channel_title, c.username as channel_username, 
            c.subscribers_count as channel_subscribers, c.photo_url as channel_photo_url, 
            c.avg_views as channel_avg_views, c.owner_id 
            FROM listings l JOIN channels c ON l.channel_id = c.id 
            WHERE l.is_active = 1 AND c.is_verified = 1
        `;
    const params: any[] = [];

    if (filters?.minPrice) { query += ' AND l.price >= ?'; params.push(filters.minPrice); }
    if (filters?.maxPrice) { query += ' AND l.price <= ?'; params.push(filters.maxPrice); }
    if (filters?.format) { query += ' AND l.format = ?'; params.push(filters.format); }
    if (filters?.minSubscribers) { query += ' AND c.subscribers_count >= ?'; params.push(filters.minSubscribers); }

    query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const stmt = getDb().prepare(query);
    return stmt.all(...params) as any[];
  },

  getById(id: number): any {
    const stmt = getDb().prepare(`
            SELECT l.*, c.title as channel_title, c.username as channel_username, 
            c.subscribers_count as channel_subscribers, c.photo_url as channel_photo_url, 
            c.avg_views as channel_avg_views, c.owner_id, c.telegram_id as channel_telegram_id 
            FROM listings l JOIN channels c ON l.channel_id = c.id WHERE l.id = ?
        `);
    return stmt.get(id);
  },

  getByChannel(channelId: number): any[] {
    const stmt = getDb().prepare('SELECT * FROM listings WHERE channel_id = ?');
    return stmt.all(channelId) as any[];
  },

  create(data: Record<string, any>): number {
    const stmt = getDb().prepare(`
            INSERT INTO listings (channel_id, title, description, price, currency, duration_hours, format, format_details) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
    const result = stmt.run(
      data.channel_id, data.title, data.description || null, data.price,
      data.currency || 'TON', data.duration_hours || 24, data.format || 'post', data.format_details || null
    );
    return Number(result.lastInsertRowid);
  },

  update(id: number, data: Record<string, any>): void {
    const sets: string[] = [];
    const values: any[] = [];
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) {
        sets.push(`${key} = ?`);
        values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
      }
    });
    if (sets.length === 0) return;
    values.push(id);
    const stmt = getDb().prepare(`UPDATE listings SET ${sets.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  },

  delete(id: number): void {
    const stmt = getDb().prepare('DELETE FROM listings WHERE id = ?');
    stmt.run(id);
  },
};

// =============================================
// Campaign Helpers
// =============================================
export const campaignHelpers = {
  getActive(limit = 50, offset = 0): any[] {
    const stmt = getDb().prepare(`
            SELECT c.*, u.username as advertiser_username, u.first_name as advertiser_first_name,
            (SELECT COUNT(*) FROM campaign_applications ca WHERE ca.campaign_id = c.id) as application_count 
            FROM campaigns c JOIN users u ON c.advertiser_id = u.id 
            WHERE c.status = 'active' ORDER BY c.created_at DESC LIMIT ? OFFSET ?
        `);
    return stmt.all(limit, offset) as any[];
  },

  getById(id: number): any {
    const stmt = getDb().prepare(`
            SELECT c.*, u.username as advertiser_username, u.first_name as advertiser_first_name 
            FROM campaigns c JOIN users u ON c.advertiser_id = u.id WHERE c.id = ?
        `);
    return stmt.get(id);
  },

  getByAdvertiser(advertiserId: number): any[] {
    const stmt = getDb().prepare('SELECT * FROM campaigns WHERE advertiser_id = ? ORDER BY created_at DESC');
    return stmt.all(advertiserId) as any[];
  },

  create(data: Record<string, any>): number {
    const stmt = getDb().prepare(`
            INSERT INTO campaigns (advertiser_id, title, description, budget_min, budget_max, 
            target_subscribers_min, target_subscribers_max, target_categories, target_languages, 
            preferred_format, start_date, end_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
    const result = stmt.run(
      data.advertiser_id, data.title, data.description,
      data.budget_min || null, data.budget_max || null,
      data.target_subscribers_min || null, data.target_subscribers_max || null,
      data.target_categories || null, data.target_languages || null,
      data.preferred_format || 'any', data.start_date || null, data.end_date || null
    );
    return Number(result.lastInsertRowid);
  },

  update(id: number, data: Record<string, any>): void {
    const sets: string[] = [];
    const values: any[] = [];
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) { sets.push(`${key} = ?`); values.push(value); }
    });
    if (sets.length === 0) return;
    values.push(id);
    const stmt = getDb().prepare(`UPDATE campaigns SET ${sets.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  },
};

// =============================================
// Campaign Application Helpers
// =============================================
export const applicationHelpers = {
  getByCampaign(campaignId: number): any[] {
    const stmt = getDb().prepare(`
            SELECT ca.*, c.title as channel_title, c.username as channel_username, 
            c.subscribers_count as channel_subscribers, c.photo_url as channel_photo_url,
            u.username as applicant_username, u.first_name as applicant_first_name 
            FROM campaign_applications ca 
            JOIN channels c ON ca.channel_id = c.id 
            JOIN users u ON ca.applicant_id = u.id 
            WHERE ca.campaign_id = ? ORDER BY ca.created_at DESC
        `);
    return stmt.all(campaignId) as any[];
  },

  getByChannel(channelId: number): any[] {
    const stmt = getDb().prepare(`
            SELECT ca.*, camp.title as campaign_title, camp.description as campaign_description 
            FROM campaign_applications ca 
            JOIN campaigns camp ON ca.campaign_id = camp.id 
            WHERE ca.channel_id = ? ORDER BY ca.created_at DESC
        `);
    return stmt.all(channelId) as any[];
  },

  getById(id: number): any {
    const stmt = getDb().prepare('SELECT * FROM campaign_applications WHERE id = ?');
    return stmt.get(id);
  },

  create(data: Record<string, any>): number {
    const stmt = getDb().prepare(`
            INSERT INTO campaign_applications (campaign_id, channel_id, applicant_id, proposed_price, message) 
            VALUES (?, ?, ?, ?, ?)
        `);
    const result = stmt.run(data.campaign_id, data.channel_id, data.applicant_id, data.proposed_price, data.message || null);
    return Number(result.lastInsertRowid);
  },

  updateStatus(id: number, status: string, responseMessage?: string): void {
    const stmt = getDb().prepare('UPDATE campaign_applications SET status = ?, response_message = ?, responded_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(status, responseMessage || null, id);
  },
};

// =============================================
// Deal Helpers
// =============================================
export const dealHelpers = {
  getByUser(userId: number, role: 'advertiser' | 'owner'): any[] {
    const column = role === 'advertiser' ? 'advertiser_id' : 'channel_owner_id';
    const stmt = getDb().prepare(`
            SELECT d.*, l.title as listing_title, c.title as channel_title, c.username as channel_username, 
            c.telegram_id as channel_telegram_id, adv.username as advertiser_username, adv.first_name as advertiser_first_name, 
            own.username as owner_username, own.first_name as owner_first_name 
            FROM deals d 
            LEFT JOIN listings l ON d.listing_id = l.id 
            JOIN channels c ON d.channel_id = c.id 
            JOIN users adv ON d.advertiser_id = adv.id 
            JOIN users own ON d.channel_owner_id = own.id 
            WHERE d.${column} = ? ORDER BY d.created_at DESC
        `);
    return stmt.all(userId) as any[];
  },

  getById(id: number): any {
    const stmt = getDb().prepare(`
            SELECT d.*, l.title as listing_title, c.title as channel_title, c.username as channel_username, 
            c.telegram_id as channel_telegram_id, adv.username as advertiser_username, adv.first_name as advertiser_first_name, 
            own.username as owner_username, own.first_name as owner_first_name 
            FROM deals d 
            LEFT JOIN listings l ON d.listing_id = l.id 
            JOIN channels c ON d.channel_id = c.id 
            JOIN users adv ON d.advertiser_id = adv.id 
            JOIN users own ON d.channel_owner_id = own.id 
            WHERE d.id = ?
        `);
    return stmt.get(id);
  },

  create(data: Record<string, any>): number {
    const stmt = getDb().prepare(`
            INSERT INTO deals (listing_id, campaign_id, application_id, advertiser_id, channel_owner_id, channel_id, 
            escrow_amount, ad_content, ad_media_url, ad_requirements, scheduled_time, expires_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
    const result = stmt.run(
      data.listing_id || null, data.campaign_id || null, data.application_id || null,
      data.advertiser_id, data.channel_owner_id, data.channel_id,
      data.escrow_amount || null, data.ad_content || null, data.ad_media_url || null,
      data.ad_requirements || null, data.scheduled_time || null, data.expires_at || null
    );
    return Number(result.lastInsertRowid);
  },

  updateStatus(id: number, status: string, additionalData?: Record<string, any>): void {
    const sets = ['status = ?', 'last_activity_at = CURRENT_TIMESTAMP'];
    const values: any[] = [status];
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        if (value !== undefined) { sets.push(`${key} = ?`); values.push(value); }
      });
    }
    values.push(id);
    const stmt = getDb().prepare(`UPDATE deals SET ${sets.join(', ')} WHERE id = ?`);
    stmt.run(...values);
  },

  getExpired(): any[] {
    const stmt = getDb().prepare(`
            SELECT * FROM deals 
            WHERE status NOT IN ('completed', 'cancelled', 'refunded', 'expired') 
            AND expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP
        `);
    return stmt.all() as any[];
  },

  getStale(hoursInactive: number): any[] {
    const stmt = getDb().prepare(`
            SELECT * FROM deals 
            WHERE status NOT IN ('completed', 'cancelled', 'refunded', 'expired', 'posted', 'verifying') 
            AND last_activity_at < datetime('now', '-' || ? || ' hours')
        `);
    return stmt.all(hoursInactive) as any[];
  },
};

// =============================================
// Creative Draft Helpers
// =============================================
export const draftHelpers = {
  getByDeal(dealId: number): any[] {
    const stmt = getDb().prepare(`
            SELECT cd.*, u.username as submitter_username, u.first_name as submitter_first_name,
            r.username as reviewer_username, r.first_name as reviewer_first_name 
            FROM creative_drafts cd 
            JOIN users u ON cd.submitted_by = u.id 
            LEFT JOIN users r ON cd.reviewed_by = r.id 
            WHERE cd.deal_id = ? ORDER BY cd.version DESC
        `);
    return stmt.all(dealId) as any[];
  },

  getLatest(dealId: number): any {
    const stmt = getDb().prepare('SELECT * FROM creative_drafts WHERE deal_id = ? ORDER BY version DESC LIMIT 1');
    return stmt.get(dealId);
  },

  create(data: Record<string, any>): number {
    // Get next version
    const versionStmt = getDb().prepare('SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM creative_drafts WHERE deal_id = ?');
    const versionRow = versionStmt.get(data.deal_id) as any;
    const nextVersion = versionRow.next_version;

    // Mark previous drafts as superseded
    const updateStmt = getDb().prepare('UPDATE creative_drafts SET status = ? WHERE deal_id = ? AND status = ?');
    updateStmt.run('superseded', data.deal_id, 'pending');

    const stmt = getDb().prepare('INSERT INTO creative_drafts (deal_id, version, content, media_url, submitted_by) VALUES (?, ?, ?, ?, ?)');
    const result = stmt.run(data.deal_id, nextVersion, data.content, data.media_url || null, data.submitted_by);
    return Number(result.lastInsertRowid);
  },

  review(id: number, approved: boolean, reviewerId: number, feedback?: string): void {
    const stmt = getDb().prepare('UPDATE creative_drafts SET status = ?, feedback = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(approved ? 'approved' : 'rejected', feedback || null, reviewerId, id);
  },
};

// =============================================
// Wallet Helpers
// =============================================
export const walletHelpers = {
  getByUser(userId: number): any {
    const stmt = getDb().prepare('SELECT * FROM wallets WHERE user_id = ? AND type = ?');
    return stmt.get(userId, 'main');
  },

  createForUser(userId: number): { id: number; address: string } {
    const address = 'UQ' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const stmt = getDb().prepare('INSERT INTO wallets (user_id, address, type) VALUES (?, ?, ?)');
    const result = stmt.run(userId, address, 'main');
    return { id: Number(result.lastInsertRowid), address };
  },

  createEscrowWallet(dealId: number): { id: number; address: string } {
    const address = 'EQ' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const stmt = getDb().prepare('INSERT INTO escrow_wallets (deal_id, address) VALUES (?, ?)');
    const result = stmt.run(dealId, address);
    return { id: Number(result.lastInsertRowid), address };
  },

  getEscrowWallet(dealId: number): any {
    const stmt = getDb().prepare('SELECT * FROM escrow_wallets WHERE deal_id = ?');
    return stmt.get(dealId);
  },

  fundEscrow(dealId: number, amount: number): void {
    const stmt = getDb().prepare('UPDATE escrow_wallets SET balance = ?, status = ?, funded_at = CURRENT_TIMESTAMP WHERE deal_id = ?');
    stmt.run(amount, 'funded', dealId);
  },

  releaseEscrow(dealId: number): void {
    const stmt = getDb().prepare('UPDATE escrow_wallets SET balance = 0, status = ?, released_at = CURRENT_TIMESTAMP WHERE deal_id = ?');
    stmt.run('released', dealId);
  },

  refundEscrow(dealId: number): void {
    const stmt = getDb().prepare('UPDATE escrow_wallets SET balance = 0, status = ?, released_at = CURRENT_TIMESTAMP WHERE deal_id = ?');
    stmt.run('refunded', dealId);
  },
};

// =============================================
// Transaction Helpers
// =============================================
export const transactionHelpers = {
  create(data: Record<string, any>): number {
    const stmt = getDb().prepare(`
            INSERT INTO transactions (deal_id, from_user_id, to_user_id, from_wallet_address, to_wallet_address, 
            amount, fee_amount, type, status, tx_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
    const result = stmt.run(
      data.deal_id || null, data.from_user_id || null, data.to_user_id || null,
      data.from_wallet_address || null, data.to_wallet_address || null,
      data.amount, data.fee_amount || 0, data.type, data.status || 'pending', data.tx_hash || null
    );
    return Number(result.lastInsertRowid);
  },

  complete(id: number, txHash?: string): void {
    const stmt = getDb().prepare('UPDATE transactions SET status = ?, tx_hash = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run('completed', txHash || null, id);
  },

  getByUser(userId: number, limit = 50): any[] {
    const stmt = getDb().prepare('SELECT * FROM transactions WHERE from_user_id = ? OR to_user_id = ? ORDER BY created_at DESC LIMIT ?');
    return stmt.all(userId, userId, limit) as any[];
  },
};

// =============================================
// Notification Helpers
// =============================================
export const notificationHelpers = {
  create(data: Record<string, any>): number {
    const stmt = getDb().prepare('INSERT INTO notifications (user_id, type, title, message, data, bot_message_id) VALUES (?, ?, ?, ?, ?, ?)');
    const result = stmt.run(data.user_id, data.type, data.title, data.message || null, data.data || null, data.bot_message_id || null);
    return Number(result.lastInsertRowid);
  },

  getUnread(userId: number): any[] {
    const stmt = getDb().prepare('SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC');
    return stmt.all(userId) as any[];
  },

  markRead(userId: number, ids?: number[]): void {
    if (ids && ids.length > 0) {
      const placeholders = ids.map(() => '?').join(', ');
      const stmt = getDb().prepare(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id IN (${placeholders})`);
      stmt.run(userId, ...ids);
    } else {
      const stmt = getDb().prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?');
      stmt.run(userId);
    }
  },
};

// =============================================
// Post Verification Helpers
// =============================================
export const verificationHelpers = {
  create(data: Record<string, any>): number {
    const stmt = getDb().prepare('INSERT INTO post_verifications (deal_id, message_id, channel_telegram_id, content_hash) VALUES (?, ?, ?, ?)');
    const result = stmt.run(data.deal_id, data.message_id, data.channel_telegram_id, data.content_hash);
    return Number(result.lastInsertRowid);
  },

  update(dealId: number, isPresent: boolean, isModified: boolean): void {
    const stmt = getDb().prepare('UPDATE post_verifications SET is_present = ?, is_modified = ?, check_count = check_count + 1, last_check_at = CURRENT_TIMESTAMP WHERE deal_id = ?');
    stmt.run(isPresent ? 1 : 0, isModified ? 1 : 0, dealId);
    if (!isPresent) {
      const updateStmt = getDb().prepare('UPDATE post_verifications SET first_missing_at = COALESCE(first_missing_at, CURRENT_TIMESTAMP) WHERE deal_id = ?');
      updateStmt.run(dealId);
    }
  },

  getPendingVerifications(): any[] {
    const stmt = getDb().prepare(`
            SELECT pv.*, d.status as deal_status FROM post_verifications pv 
            JOIN deals d ON pv.deal_id = d.id 
            WHERE d.status IN ('posted', 'verifying') AND pv.is_present = 1 
            AND (pv.last_check_at IS NULL OR pv.last_check_at < datetime('now', '-30 minutes'))
        `);
    return stmt.all() as any[];
  },
};

// =============================================
// Scheduled Task Helpers
// =============================================
export const taskHelpers = {
  create(data: Record<string, any>): number {
    const stmt = getDb().prepare('INSERT INTO scheduled_tasks (type, target_id, target_type, scheduled_at) VALUES (?, ?, ?, ?)');
    const result = stmt.run(data.type, data.target_id, data.target_type, data.scheduled_at);
    return Number(result.lastInsertRowid);
  },

  getPending(): any[] {
    const stmt = getDb().prepare("SELECT * FROM scheduled_tasks WHERE status = 'pending' AND scheduled_at <= CURRENT_TIMESTAMP ORDER BY scheduled_at ASC LIMIT 100");
    return stmt.all() as any[];
  },

  markProcessing(id: number): void {
    const stmt = getDb().prepare('UPDATE scheduled_tasks SET status = ? WHERE id = ?');
    stmt.run('processing', id);
  },

  complete(id: number, result?: any): void {
    const stmt = getDb().prepare('UPDATE scheduled_tasks SET status = ?, result = ?, executed_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run('completed', result ? JSON.stringify(result) : null, id);
  },

  fail(id: number, error: string): void {
    const stmt = getDb().prepare('UPDATE scheduled_tasks SET status = ?, error = ?, retry_count = retry_count + 1, executed_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run('failed', error, id);
  },
};

// =============================================
// General Query Helper
// =============================================
export function query(sql: string, params: any[] = []): any {
  const stmt = getDb().prepare(sql);
  if (sql.trim().toUpperCase().startsWith('SELECT')) {
    return stmt.all(...params);
  } else {
    return stmt.run(...params);
  }
}

export default {
  getDb,
  initializeDatabase,
  query,
  userHelpers,
  channelHelpers,
  managerHelpers,
  listingHelpers,
  campaignHelpers,
  applicationHelpers,
  dealHelpers,
  draftHelpers,
  walletHelpers,
  transactionHelpers,
  notificationHelpers,
  verificationHelpers,
  taskHelpers,
};

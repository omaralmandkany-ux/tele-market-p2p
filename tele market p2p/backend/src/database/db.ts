import mysql from 'mysql2/promise';
import { config } from '../config/env.js';

// Database connection pool
let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: config.dbHost,
      port: config.dbPort,
      user: config.dbUser,
      password: config.dbPassword,
      database: config.dbName,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: 'utf8mb4',
    });
  }
  return pool;
}

// Initialize database connection
export async function initializeDatabase(): Promise<void> {
  try {
    const connection = await getPool().getConnection();
    console.log('✅ MySQL Database connected successfully');
    connection.release();
  } catch (error) {
    console.error('❌ MySQL connection failed:', error);
    throw error;
  }
}

// =============================================
// User Helpers
// =============================================
export const userHelpers = {
  async getByTelegramId(telegramId: number) {
    const [rows] = await getPool().execute(
      'SELECT * FROM users WHERE telegram_id = ?',
      [telegramId]
    );
    return (rows as any[])[0];
  },

  async getById(id: number) {
    const [rows] = await getPool().execute(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    return (rows as any[])[0];
  },

  async create(telegramId: number, username: string | null, firstName: string | null, photoUrl: string | null) {
    const [result] = await getPool().execute(
      'INSERT INTO users (telegram_id, username, first_name, photo_url) VALUES (?, ?, ?, ?)',
      [telegramId, username, firstName, photoUrl]
    );
    return (result as any).insertId;
  },

  async update(id: number, data: Record<string, any>) {
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
    await getPool().execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, values);
  },

  async updateBalance(userId: number, amount: number) {
    await getPool().execute('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, userId]);
  },
};

// =============================================
// Channel Helpers
// =============================================
export const channelHelpers = {
  async getByOwner(ownerId: number) {
    const [rows] = await getPool().execute('SELECT * FROM channels WHERE owner_id = ?', [ownerId]);
    return rows as any[];
  },

  async getById(id: number) {
    const [rows] = await getPool().execute('SELECT * FROM channels WHERE id = ?', [id]);
    return (rows as any[])[0];
  },

  async getByUsername(username: string) {
    const [rows] = await getPool().execute('SELECT * FROM channels WHERE username = ?', [username]);
    return (rows as any[])[0];
  },

  async getVerified(limit = 50, offset = 0) {
    const [rows] = await getPool().execute(
      'SELECT c.*, u.username as owner_username, u.first_name as owner_first_name FROM channels c JOIN users u ON c.owner_id = u.id WHERE c.is_verified = 1 ORDER BY c.subscribers_count DESC LIMIT ? OFFSET ?',
      [limit, offset]
    );
    return rows as any[];
  },

  async create(data: Record<string, any>) {
    const [result] = await getPool().execute(
      `INSERT INTO channels (telegram_id, username, title, description, subscribers_count, owner_id, categories, photo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.telegram_id || null, data.username || null, data.title, data.description || null, data.subscribers_count || null, data.owner_id, data.categories || null, data.photo_url || null]
    );
    return (result as any).insertId;
  },

  async update(id: number, data: Record<string, any>) {
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
    await getPool().execute(`UPDATE channels SET ${sets.join(', ')} WHERE id = ?`, values);
  },

  async updateVerification(id: number, isVerified: boolean, verificationCode?: string) {
    await getPool().execute('UPDATE channels SET is_verified = ?, verification_code = ? WHERE id = ?', [isVerified ? 1 : 0, verificationCode || null, id]);
  },
};

// =============================================
// Channel Manager Helpers (Multi-Admin)
// =============================================
export const managerHelpers = {
  async getByChannel(channelId: number) {
    const [rows] = await getPool().execute(
      'SELECT cm.*, u.username, u.first_name, u.photo_url FROM channel_managers cm JOIN users u ON cm.user_id = u.id WHERE cm.channel_id = ?',
      [channelId]
    );
    return rows as any[];
  },

  async add(channelId: number, userId: number, telegramId: number, role: string, permissions?: string) {
    await getPool().execute(
      'INSERT INTO channel_managers (channel_id, user_id, telegram_id, role, permissions) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role), permissions = VALUES(permissions)',
      [channelId, userId, telegramId, role, permissions || null]
    );
  },

  async remove(channelId: number, userId: number) {
    await getPool().execute('DELETE FROM channel_managers WHERE channel_id = ? AND user_id = ?', [channelId, userId]);
  },

  async isManager(channelId: number, userId: number) {
    const [rows] = await getPool().execute(
      'SELECT id FROM channel_managers WHERE channel_id = ? AND user_id = ?',
      [channelId, userId]
    );
    return (rows as any[]).length > 0;
  },

  async hasPermission(channelId: number, userId: number, permission: string) {
    const [rows] = await getPool().execute(
      'SELECT permissions FROM channel_managers WHERE channel_id = ? AND user_id = ?',
      [channelId, userId]
    );
    if ((rows as any[]).length === 0) return false;
    const perms = (rows as any[])[0].permissions;
    if (!perms) return false;
    try {
      const parsed = JSON.parse(perms);
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
  async getActive(limit = 50, offset = 0, filters?: { minPrice?: number; maxPrice?: number; format?: string; minSubscribers?: number }) {
    let query = `SELECT l.*, c.title as channel_title, c.username as channel_username, c.subscribers_count as channel_subscribers, c.photo_url as channel_photo_url, c.avg_views as channel_avg_views, c.owner_id FROM listings l JOIN channels c ON l.channel_id = c.id WHERE l.is_active = 1 AND c.is_verified = 1`;
    const params: any[] = [];

    if (filters?.minPrice) { query += ' AND l.price >= ?'; params.push(filters.minPrice); }
    if (filters?.maxPrice) { query += ' AND l.price <= ?'; params.push(filters.maxPrice); }
    if (filters?.format) { query += ' AND l.format = ?'; params.push(filters.format); }
    if (filters?.minSubscribers) { query += ' AND c.subscribers_count >= ?'; params.push(filters.minSubscribers); }

    query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await getPool().execute(query, params);
    return rows as any[];
  },

  async getById(id: number) {
    const [rows] = await getPool().execute(
      `SELECT l.*, c.title as channel_title, c.username as channel_username, c.subscribers_count as channel_subscribers, c.photo_url as channel_photo_url, c.avg_views as channel_avg_views, c.owner_id, c.telegram_id as channel_telegram_id FROM listings l JOIN channels c ON l.channel_id = c.id WHERE l.id = ?`,
      [id]
    );
    return (rows as any[])[0];
  },

  async getByChannel(channelId: number) {
    const [rows] = await getPool().execute('SELECT * FROM listings WHERE channel_id = ?', [channelId]);
    return rows as any[];
  },

  async create(data: Record<string, any>) {
    const [result] = await getPool().execute(
      `INSERT INTO listings (channel_id, title, description, price, currency, duration_hours, format, format_details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.channel_id, data.title, data.description || null, data.price, data.currency || 'TON', data.duration_hours || 24, data.format || 'post', data.format_details || null]
    );
    return (result as any).insertId;
  },

  async update(id: number, data: Record<string, any>) {
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
    await getPool().execute(`UPDATE listings SET ${sets.join(', ')} WHERE id = ?`, values);
  },

  async delete(id: number) {
    await getPool().execute('DELETE FROM listings WHERE id = ?', [id]);
  },
};

// =============================================
// Campaign Helpers
// =============================================
export const campaignHelpers = {
  async getActive(limit = 50, offset = 0) {
    const [rows] = await getPool().execute(
      `SELECT c.*, u.username as advertiser_username, u.first_name as advertiser_first_name, (SELECT COUNT(*) FROM campaign_applications ca WHERE ca.campaign_id = c.id) as application_count FROM campaigns c JOIN users u ON c.advertiser_id = u.id WHERE c.status = 'active' ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return rows as any[];
  },

  async getById(id: number) {
    const [rows] = await getPool().execute(
      `SELECT c.*, u.username as advertiser_username, u.first_name as advertiser_first_name FROM campaigns c JOIN users u ON c.advertiser_id = u.id WHERE c.id = ?`,
      [id]
    );
    return (rows as any[])[0];
  },

  async getByAdvertiser(advertiserId: number) {
    const [rows] = await getPool().execute('SELECT * FROM campaigns WHERE advertiser_id = ? ORDER BY created_at DESC', [advertiserId]);
    return rows as any[];
  },

  async create(data: Record<string, any>) {
    const [result] = await getPool().execute(
      `INSERT INTO campaigns (advertiser_id, title, description, budget_min, budget_max, target_subscribers_min, target_subscribers_max, target_categories, target_languages, preferred_format, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.advertiser_id, data.title, data.description, data.budget_min || null, data.budget_max || null, data.target_subscribers_min || null, data.target_subscribers_max || null, data.target_categories || null, data.target_languages || null, data.preferred_format || 'any', data.start_date || null, data.end_date || null]
    );
    return (result as any).insertId;
  },

  async update(id: number, data: Record<string, any>) {
    const sets: string[] = [];
    const values: any[] = [];
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) { sets.push(`${key} = ?`); values.push(value); }
    });
    if (sets.length === 0) return;
    values.push(id);
    await getPool().execute(`UPDATE campaigns SET ${sets.join(', ')} WHERE id = ?`, values);
  },
};

// =============================================
// Campaign Application Helpers
// =============================================
export const applicationHelpers = {
  async getByCampaign(campaignId: number) {
    const [rows] = await getPool().execute(
      `SELECT ca.*, c.title as channel_title, c.username as channel_username, c.subscribers_count as channel_subscribers, c.photo_url as channel_photo_url, u.username as applicant_username, u.first_name as applicant_first_name FROM campaign_applications ca JOIN channels c ON ca.channel_id = c.id JOIN users u ON ca.applicant_id = u.id WHERE ca.campaign_id = ? ORDER BY ca.created_at DESC`,
      [campaignId]
    );
    return rows as any[];
  },

  async getByChannel(channelId: number) {
    const [rows] = await getPool().execute(
      `SELECT ca.*, camp.title as campaign_title, camp.description as campaign_description FROM campaign_applications ca JOIN campaigns camp ON ca.campaign_id = camp.id WHERE ca.channel_id = ? ORDER BY ca.created_at DESC`,
      [channelId]
    );
    return rows as any[];
  },

  async getById(id: number) {
    const [rows] = await getPool().execute('SELECT * FROM campaign_applications WHERE id = ?', [id]);
    return (rows as any[])[0];
  },

  async create(data: Record<string, any>) {
    const [result] = await getPool().execute(
      `INSERT INTO campaign_applications (campaign_id, channel_id, applicant_id, proposed_price, message) VALUES (?, ?, ?, ?, ?)`,
      [data.campaign_id, data.channel_id, data.applicant_id, data.proposed_price, data.message || null]
    );
    return (result as any).insertId;
  },

  async updateStatus(id: number, status: string, responseMessage?: string) {
    await getPool().execute(
      'UPDATE campaign_applications SET status = ?, response_message = ?, responded_at = NOW() WHERE id = ?',
      [status, responseMessage || null, id]
    );
  },
};

// =============================================
// Deal Helpers
// =============================================
export const dealHelpers = {
  async getByUser(userId: number, role: 'advertiser' | 'owner') {
    const column = role === 'advertiser' ? 'advertiser_id' : 'channel_owner_id';
    const [rows] = await getPool().execute(
      `SELECT d.*, l.title as listing_title, c.title as channel_title, c.username as channel_username, c.telegram_id as channel_telegram_id, adv.username as advertiser_username, adv.first_name as advertiser_first_name, own.username as owner_username, own.first_name as owner_first_name FROM deals d LEFT JOIN listings l ON d.listing_id = l.id JOIN channels c ON d.channel_id = c.id JOIN users adv ON d.advertiser_id = adv.id JOIN users own ON d.channel_owner_id = own.id WHERE d.${column} = ? ORDER BY d.created_at DESC`,
      [userId]
    );
    return rows as any[];
  },

  async getById(id: number) {
    const [rows] = await getPool().execute(
      `SELECT d.*, l.title as listing_title, c.title as channel_title, c.username as channel_username, c.telegram_id as channel_telegram_id, adv.username as advertiser_username, adv.first_name as advertiser_first_name, own.username as owner_username, own.first_name as owner_first_name FROM deals d LEFT JOIN listings l ON d.listing_id = l.id JOIN channels c ON d.channel_id = c.id JOIN users adv ON d.advertiser_id = adv.id JOIN users own ON d.channel_owner_id = own.id WHERE d.id = ?`,
      [id]
    );
    return (rows as any[])[0];
  },

  async create(data: Record<string, any>) {
    const [result] = await getPool().execute(
      `INSERT INTO deals (listing_id, campaign_id, application_id, advertiser_id, channel_owner_id, channel_id, escrow_amount, ad_content, ad_media_url, ad_requirements, scheduled_time, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.listing_id || null, data.campaign_id || null, data.application_id || null, data.advertiser_id, data.channel_owner_id, data.channel_id, data.escrow_amount || null, data.ad_content || null, data.ad_media_url || null, data.ad_requirements || null, data.scheduled_time || null, data.expires_at || null]
    );
    return (result as any).insertId;
  },

  async updateStatus(id: number, status: string, additionalData?: Record<string, any>) {
    const sets = ['status = ?', 'last_activity_at = NOW()'];
    const values: any[] = [status];
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        if (value !== undefined) { sets.push(`${key} = ?`); values.push(value); }
      });
    }
    values.push(id);
    await getPool().execute(`UPDATE deals SET ${sets.join(', ')} WHERE id = ?`, values);
  },

  async getExpired() {
    const [rows] = await getPool().execute(
      `SELECT * FROM deals WHERE status NOT IN ('completed', 'cancelled', 'refunded', 'expired') AND expires_at IS NOT NULL AND expires_at < NOW()`
    );
    return rows as any[];
  },

  async getStale(hoursInactive: number) {
    const [rows] = await getPool().execute(
      `SELECT * FROM deals WHERE status NOT IN ('completed', 'cancelled', 'refunded', 'expired', 'posted', 'verifying') AND last_activity_at < DATE_SUB(NOW(), INTERVAL ? HOUR)`,
      [hoursInactive]
    );
    return rows as any[];
  },
};

// =============================================
// Creative Draft Helpers
// =============================================
export const draftHelpers = {
  async getByDeal(dealId: number) {
    const [rows] = await getPool().execute(
      `SELECT cd.*, u.username as submitter_username, u.first_name as submitter_first_name, r.username as reviewer_username, r.first_name as reviewer_first_name FROM creative_drafts cd JOIN users u ON cd.submitted_by = u.id LEFT JOIN users r ON cd.reviewed_by = r.id WHERE cd.deal_id = ? ORDER BY cd.version DESC`,
      [dealId]
    );
    return rows as any[];
  },

  async getLatest(dealId: number) {
    const [rows] = await getPool().execute(
      `SELECT * FROM creative_drafts WHERE deal_id = ? ORDER BY version DESC LIMIT 1`,
      [dealId]
    );
    return (rows as any[])[0];
  },

  async create(data: Record<string, any>) {
    // Get next version
    const [versionRows] = await getPool().execute(
      'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM creative_drafts WHERE deal_id = ?',
      [data.deal_id]
    );
    const nextVersion = (versionRows as any[])[0].next_version;

    // Mark previous drafts as superseded
    await getPool().execute(
      'UPDATE creative_drafts SET status = ? WHERE deal_id = ? AND status = ?',
      ['superseded', data.deal_id, 'pending']
    );

    const [result] = await getPool().execute(
      `INSERT INTO creative_drafts (deal_id, version, content, media_url, submitted_by) VALUES (?, ?, ?, ?, ?)`,
      [data.deal_id, nextVersion, data.content, data.media_url || null, data.submitted_by]
    );
    return (result as any).insertId;
  },

  async review(id: number, approved: boolean, reviewerId: number, feedback?: string) {
    await getPool().execute(
      'UPDATE creative_drafts SET status = ?, feedback = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
      [approved ? 'approved' : 'rejected', feedback || null, reviewerId, id]
    );
  },
};

// =============================================
// Wallet Helpers
// =============================================
export const walletHelpers = {
  async getByUser(userId: number) {
    const [rows] = await getPool().execute('SELECT * FROM wallets WHERE user_id = ? AND type = ?', [userId, 'main']);
    return (rows as any[])[0];
  },

  async createForUser(userId: number) {
    const address = 'UQ' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const [result] = await getPool().execute(
      'INSERT INTO wallets (user_id, address, type) VALUES (?, ?, ?)',
      [userId, address, 'main']
    );
    return { id: (result as any).insertId, address };
  },

  async createEscrowWallet(dealId: number) {
    const address = 'EQ' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const [result] = await getPool().execute(
      'INSERT INTO escrow_wallets (deal_id, address) VALUES (?, ?)',
      [dealId, address]
    );
    return { id: (result as any).insertId, address };
  },

  async getEscrowWallet(dealId: number) {
    const [rows] = await getPool().execute('SELECT * FROM escrow_wallets WHERE deal_id = ?', [dealId]);
    return (rows as any[])[0];
  },

  async fundEscrow(dealId: number, amount: number) {
    await getPool().execute(
      'UPDATE escrow_wallets SET balance = ?, status = ?, funded_at = NOW() WHERE deal_id = ?',
      [amount, 'funded', dealId]
    );
  },

  async releaseEscrow(dealId: number) {
    await getPool().execute(
      'UPDATE escrow_wallets SET balance = 0, status = ?, released_at = NOW() WHERE deal_id = ?',
      ['released', dealId]
    );
  },

  async refundEscrow(dealId: number) {
    await getPool().execute(
      'UPDATE escrow_wallets SET balance = 0, status = ?, released_at = NOW() WHERE deal_id = ?',
      ['refunded', dealId]
    );
  },
};

// =============================================
// Transaction Helpers
// =============================================
export const transactionHelpers = {
  async create(data: Record<string, any>) {
    const [result] = await getPool().execute(
      `INSERT INTO transactions (deal_id, from_user_id, to_user_id, from_wallet_address, to_wallet_address, amount, fee_amount, type, status, tx_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.deal_id || null, data.from_user_id || null, data.to_user_id || null, data.from_wallet_address || null, data.to_wallet_address || null, data.amount, data.fee_amount || 0, data.type, data.status || 'pending', data.tx_hash || null]
    );
    return (result as any).insertId;
  },

  async complete(id: number, txHash?: string) {
    await getPool().execute(
      'UPDATE transactions SET status = ?, tx_hash = ?, completed_at = NOW() WHERE id = ?',
      ['completed', txHash || null, id]
    );
  },

  async getByUser(userId: number, limit = 50) {
    const [rows] = await getPool().execute(
      'SELECT * FROM transactions WHERE from_user_id = ? OR to_user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, userId, limit]
    );
    return rows as any[];
  },
};

// =============================================
// Notification Helpers
// =============================================
export const notificationHelpers = {
  async create(data: Record<string, any>) {
    const [result] = await getPool().execute(
      `INSERT INTO notifications (user_id, type, title, message, data, bot_message_id) VALUES (?, ?, ?, ?, ?, ?)`,
      [data.user_id, data.type, data.title, data.message || null, data.data || null, data.bot_message_id || null]
    );
    return (result as any).insertId;
  },

  async getUnread(userId: number) {
    const [rows] = await getPool().execute(
      'SELECT * FROM notifications WHERE user_id = ? AND is_read = 0 ORDER BY created_at DESC',
      [userId]
    );
    return rows as any[];
  },

  async markRead(userId: number, ids?: number[]) {
    if (ids && ids.length > 0) {
      const placeholders = ids.map(() => '?').join(', ');
      await getPool().execute(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id IN (${placeholders})`, [userId, ...ids]);
    } else {
      await getPool().execute('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);
    }
  },
};

// =============================================
// Post Verification Helpers
// =============================================
export const verificationHelpers = {
  async create(data: Record<string, any>) {
    const [result] = await getPool().execute(
      `INSERT INTO post_verifications (deal_id, message_id, channel_telegram_id, content_hash) VALUES (?, ?, ?, ?)`,
      [data.deal_id, data.message_id, data.channel_telegram_id, data.content_hash]
    );
    return (result as any).insertId;
  },

  async update(dealId: number, isPresent: boolean, isModified: boolean) {
    await getPool().execute(
      'UPDATE post_verifications SET is_present = ?, is_modified = ?, check_count = check_count + 1, last_check_at = NOW() WHERE deal_id = ?',
      [isPresent ? 1 : 0, isModified ? 1 : 0, dealId]
    );
    if (!isPresent) {
      await getPool().execute(
        'UPDATE post_verifications SET first_missing_at = COALESCE(first_missing_at, NOW()) WHERE deal_id = ?',
        [dealId]
      );
    }
  },

  async getPendingVerifications() {
    const [rows] = await getPool().execute(
      `SELECT pv.*, d.status as deal_status FROM post_verifications pv JOIN deals d ON pv.deal_id = d.id WHERE d.status IN ('posted', 'verifying') AND pv.is_present = 1 AND (pv.last_check_at IS NULL OR pv.last_check_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE))`
    );
    return rows as any[];
  },
};

// =============================================
// Scheduled Task Helpers
// =============================================
export const taskHelpers = {
  async create(data: Record<string, any>) {
    const [result] = await getPool().execute(
      `INSERT INTO scheduled_tasks (type, target_id, target_type, scheduled_at) VALUES (?, ?, ?, ?)`,
      [data.type, data.target_id, data.target_type, data.scheduled_at]
    );
    return (result as any).insertId;
  },

  async getPending() {
    const [rows] = await getPool().execute(
      `SELECT * FROM scheduled_tasks WHERE status = 'pending' AND scheduled_at <= NOW() ORDER BY scheduled_at ASC LIMIT 100`
    );
    return rows as any[];
  },

  async markProcessing(id: number) {
    await getPool().execute('UPDATE scheduled_tasks SET status = ? WHERE id = ?', ['processing', id]);
  },

  async complete(id: number, result?: any) {
    await getPool().execute(
      'UPDATE scheduled_tasks SET status = ?, result = ?, executed_at = NOW() WHERE id = ?',
      ['completed', result ? JSON.stringify(result) : null, id]
    );
  },

  async fail(id: number, error: string) {
    await getPool().execute(
      'UPDATE scheduled_tasks SET status = ?, error = ?, retry_count = retry_count + 1, executed_at = NOW() WHERE id = ?',
      ['failed', error, id]
    );
  },
};

// =============================================
// General Query Helper
// =============================================
export async function query(sql: string, params: any[] = []) {
  const [rows] = await getPool().execute(sql, params);
  return rows;
}

export default {
  getPool,
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

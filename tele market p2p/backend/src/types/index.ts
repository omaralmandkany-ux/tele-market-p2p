// =============================================
// User Types
// =============================================
export interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    photo_url?: string;
}

export interface User {
    id: number;
    telegram_id: number;
    username: string | null;
    first_name: string | null;
    photo_url: string | null;
    role: 'user' | 'admin';
    balance: number;
    wallet_address: string | null;
    created_at: string;
    updated_at: string;
}

// =============================================
// Channel Types
// =============================================
export interface Channel {
    id: number;
    telegram_id: number | null;
    username: string | null;
    title: string;
    description: string | null;
    subscribers_count: number | null;
    avg_views: number | null;
    avg_reach: number | null;
    premium_percentage: number | null;
    language_stats: string | null; // JSON
    owner_id: number;
    is_verified: boolean;
    bot_is_admin: boolean;
    verification_code: string | null;
    categories: string | null; // JSON
    photo_url: string | null;
    last_stats_update: string | null;
    created_at: string;
}

export interface ChannelWithOwner extends Channel {
    owner_username: string | null;
    owner_first_name: string | null;
}

export interface ChannelStats {
    subscribers_count: number;
    avg_views: number;
    avg_reach: number;
    premium_percentage: number;
    language_distribution: Record<string, number>;
}

// =============================================
// Channel Manager Types (Multi-Admin)
// =============================================
export type ManagerRole = 'owner' | 'admin' | 'manager';

export interface ChannelManager {
    id: number;
    channel_id: number;
    user_id: number;
    telegram_id: number;
    role: ManagerRole;
    permissions: string | null; // JSON
    synced_from_telegram: boolean;
    added_at: string;
}

export interface ManagerPermissions {
    can_manage_listings: boolean;
    can_manage_deals: boolean;
    can_manage_finances: boolean;
    can_manage_admins: boolean;
}

// =============================================
// Listing Types
// =============================================
export type AdFormat = 'post' | 'story' | 'repost' | 'video' | 'custom';

export interface Listing {
    id: number;
    channel_id: number;
    title: string;
    description: string | null;
    price: number;
    currency: string;
    duration_hours: number;
    format: AdFormat;
    format_details: string | null;
    is_active: boolean;
    created_at: string;
}

export interface ListingWithChannel extends Listing {
    channel_title: string;
    channel_username: string | null;
    channel_subscribers: number | null;
    channel_photo_url: string | null;
    channel_avg_views: number | null;
    owner_id: number;
}

// =============================================
// Campaign Types (Advertiser Requests)
// =============================================
export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';

export interface Campaign {
    id: number;
    advertiser_id: number;
    title: string;
    description: string;
    budget_min: number | null;
    budget_max: number | null;
    target_subscribers_min: number | null;
    target_subscribers_max: number | null;
    target_categories: string | null; // JSON
    target_languages: string | null; // JSON
    preferred_format: 'post' | 'story' | 'repost' | 'video' | 'any';
    start_date: string | null;
    end_date: string | null;
    status: CampaignStatus;
    created_at: string;
    updated_at: string;
}

export interface CampaignWithAdvertiser extends Campaign {
    advertiser_username: string | null;
    advertiser_first_name: string | null;
    application_count?: number;
}

// =============================================
// Campaign Application Types
// =============================================
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface CampaignApplication {
    id: number;
    campaign_id: number;
    channel_id: number;
    applicant_id: number;
    proposed_price: number;
    message: string | null;
    status: ApplicationStatus;
    response_message: string | null;
    created_at: string;
    responded_at: string | null;
}

export interface ApplicationWithDetails extends CampaignApplication {
    channel_title: string;
    channel_username: string | null;
    channel_subscribers: number | null;
    channel_photo_url: string | null;
    applicant_username: string | null;
    applicant_first_name: string | null;
}

// =============================================
// Deal Types
// =============================================
export type DealStatus =
    | 'pending'         // Advertiser created request
    | 'accepted'        // Owner accepted
    | 'rejected'        // Owner rejected
    | 'funded'          // Funds deposited to escrow
    | 'draft_pending'   // Waiting for owner to submit draft
    | 'draft_submitted' // Owner submitted draft for review
    | 'draft_approved'  // Advertiser approved draft
    | 'draft_rejected'  // Advertiser rejected draft with feedback
    | 'scheduled'       // Approved & scheduled for posting
    | 'posting'         // Being posted
    | 'posted'          // Ad was posted
    | 'verifying'       // Verifying post is still live
    | 'completed'       // Deal completed, funds released
    | 'disputed'        // Dispute raised
    | 'cancelled'       // Deal cancelled
    | 'refunded'        // Funds returned to advertiser
    | 'expired';        // Deal expired due to timeout

export interface Deal {
    id: number;
    listing_id: number | null;
    campaign_id: number | null;
    application_id: number | null;
    advertiser_id: number;
    channel_owner_id: number;
    channel_id: number;
    status: DealStatus;
    escrow_amount: number | null;
    escrow_wallet_address: string | null;
    ad_content: string | null;
    ad_media_url: string | null;
    ad_requirements: string | null;
    scheduled_time: string | null;
    posted_message_id: number | null;
    posted_at: string | null;
    post_verified_count: number;
    last_verification_at: string | null;
    completed_at: string | null;
    last_activity_at: string;
    expires_at: string | null;
    created_at: string;
}

export interface DealWithDetails extends Deal {
    listing_title: string | null;
    channel_title: string;
    channel_username: string | null;
    channel_telegram_id: number | null;
    advertiser_username: string | null;
    advertiser_first_name: string | null;
    owner_username: string | null;
    owner_first_name: string | null;
}

// =============================================
// Creative Draft Types
// =============================================
export type DraftStatus = 'pending' | 'approved' | 'rejected' | 'superseded';

export interface CreativeDraft {
    id: number;
    deal_id: number;
    version: number;
    content: string;
    media_url: string | null;
    submitted_by: number;
    status: DraftStatus;
    feedback: string | null;
    created_at: string;
    reviewed_at: string | null;
    reviewed_by: number | null;
}

export interface DraftWithSubmitter extends CreativeDraft {
    submitter_username: string | null;
    submitter_first_name: string | null;
    reviewer_username: string | null;
    reviewer_first_name: string | null;
}

// =============================================
// Wallet Types
// =============================================
export type WalletType = 'main' | 'escrow';

export interface Wallet {
    id: number;
    user_id: number;
    address: string;
    type: WalletType;
    balance: number;
    is_active: boolean;
    created_at: string;
}

export interface EscrowWallet {
    id: number;
    deal_id: number;
    address: string;
    balance: number;
    status: 'pending' | 'funded' | 'released' | 'refunded';
    funded_at: string | null;
    released_at: string | null;
    created_at: string;
}

// =============================================
// Transaction Types
// =============================================
export type TransactionType =
    | 'deposit'
    | 'withdrawal'
    | 'escrow_fund'
    | 'escrow_release'
    | 'refund'
    | 'fee'
    | 'transfer';

export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface Transaction {
    id: number;
    deal_id: number | null;
    from_user_id: number | null;
    to_user_id: number | null;
    from_wallet_address: string | null;
    to_wallet_address: string | null;
    amount: number;
    fee_amount: number;
    type: TransactionType;
    status: TransactionStatus;
    tx_hash: string | null;
    created_at: string;
    completed_at: string | null;
}

// =============================================
// Post Verification Types
// =============================================
export interface PostVerification {
    id: number;
    deal_id: number;
    message_id: number;
    channel_telegram_id: number;
    content_hash: string;
    is_present: boolean;
    is_modified: boolean;
    check_count: number;
    last_check_at: string | null;
    first_missing_at: string | null;
    created_at: string;
}

// =============================================
// Scheduled Task Types
// =============================================
export type TaskType = 'auto_post' | 'verify_post' | 'timeout_check' | 'release_funds' | 'stats_update';
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface ScheduledTask {
    id: number;
    type: TaskType;
    target_id: number;
    target_type: string;
    scheduled_at: string;
    executed_at: string | null;
    status: TaskStatus;
    result: string | null; // JSON
    error: string | null;
    retry_count: number;
    created_at: string;
}

// =============================================
// Notification Types
// =============================================
export type NotificationType =
    | 'deal_created'
    | 'deal_accepted'
    | 'deal_rejected'
    | 'deal_funded'
    | 'draft_submitted'
    | 'draft_approved'
    | 'draft_rejected'
    | 'post_scheduled'
    | 'post_published'
    | 'deal_completed'
    | 'deal_disputed'
    | 'deal_cancelled'
    | 'deal_expired'
    | 'funds_received'
    | 'funds_refunded'
    | 'campaign_application'
    | 'application_accepted'
    | 'application_rejected'
    | 'channel_verified'
    | 'admin_alert';

export interface Notification {
    id: number;
    user_id: number;
    type: NotificationType | string;
    title: string;
    message: string | null;
    is_read: boolean;
    data: string | null; // JSON
    bot_message_id: number | null;
    created_at: string;
}

// =============================================
// API Response Types
// =============================================
export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

// =============================================
// Request Types
// =============================================
export interface CreateChannelRequest {
    username?: string;
    title: string;
    description?: string;
    categories?: string[];
}

export interface CreateListingRequest {
    channel_id: number;
    title: string;
    description?: string;
    price: number;
    currency?: string;
    duration_hours?: number;
    format?: AdFormat;
    format_details?: string;
}

export interface CreateCampaignRequest {
    title: string;
    description: string;
    budget_min?: number;
    budget_max?: number;
    target_subscribers_min?: number;
    target_subscribers_max?: number;
    target_categories?: string[];
    target_languages?: string[];
    preferred_format?: 'post' | 'story' | 'repost' | 'video' | 'any';
    start_date?: string;
    end_date?: string;
}

export interface ApplyToCampaignRequest {
    channel_id: number;
    proposed_price: number;
    message?: string;
}

export interface CreateDealRequest {
    listing_id?: number;
    application_id?: number;
    ad_content?: string;
    ad_media_url?: string;
    ad_requirements?: string;
    scheduled_time?: string;
}

export interface SubmitDraftRequest {
    content: string;
    media_url?: string;
}

export interface ReviewDraftRequest {
    approved: boolean;
    feedback?: string;
}

// =============================================
// Telegram WebApp Types
// =============================================
export interface WebAppInitData {
    query_id?: string;
    user?: TelegramUser;
    auth_date: number;
    hash: string;
}

// =============================================
// Express Request Extension
// =============================================
declare global {
    namespace Express {
        interface Request {
            user?: User;
            telegramUser?: TelegramUser;
        }
    }
}

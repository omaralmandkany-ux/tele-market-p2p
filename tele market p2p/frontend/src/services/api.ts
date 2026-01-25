const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Get Telegram init data for authentication
function getInitData(): string {
    if (window.Telegram?.WebApp?.initData) {
        return window.Telegram.WebApp.initData;
    }
    // Development fallback
    return '';
}

// API request helper
async function request<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string; message?: string }> {
    try {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            'X-Telegram-Init-Data': getInitData(),
            ...options.headers,
        };

        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers,
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API request failed:', error);
        return { success: false, error: 'Network error' };
    }
}

// API methods
export const api = {
    // User
    getMe: () => request<User>('/api/users/me'),
    getMyStats: () => request<UserStats>('/api/users/stats'),
    getNotifications: () => request<Notification[]>('/api/users/notifications'),
    markNotificationsRead: (ids?: number[]) =>
        request('/api/users/notifications/read', { method: 'POST', body: JSON.stringify({ ids }) }),

    // Wallet
    getWallet: () => request<WalletInfo>('/api/users/wallet'),
    deposit: (amount: number) =>
        request<{ tx_hash: string; new_balance: number }>('/api/users/deposit', { method: 'POST', body: JSON.stringify({ amount }) }),
    withdraw: (amount: number, to_address: string) =>
        request<{ tx_hash: string }>('/api/users/withdraw', { method: 'POST', body: JSON.stringify({ amount, to_address }) }),
    getTransactions: () => request<Transaction[]>('/api/users/transactions'),

    // Channels
    getMyChannels: () => request<Channel[]>('/api/channels'),
    getVerifiedChannels: () => request<Channel[]>('/api/channels/verified'),
    getChannel: (id: number) => request<ChannelWithDetails>(`/api/channels/${id}`),
    createChannel: (data: CreateChannelData) =>
        request<Channel>('/api/channels', { method: 'POST', body: JSON.stringify(data) }),
    quickVerifyChannel: (username: string) =>
        request<Channel>('/api/channels/quick-verify', { method: 'POST', body: JSON.stringify({ username }) }),
    verifyChannel: (channelId: number) =>
        request<Channel>(`/api/channels/${channelId}/verify`, { method: 'POST' }),
    syncManagers: (channelId: number) =>
        request<any[]>(`/api/channels/${channelId}/sync-managers`, { method: 'POST' }),
    refreshStats: (channelId: number) =>
        request<Channel>(`/api/channels/${channelId}/refresh-stats`, { method: 'POST' }),
    deleteChannel: (id: number) =>
        request(`/api/channels/${id}`, { method: 'DELETE' }),
    getChannelListings: (channelId: number) =>
        request<Listing[]>(`/api/channels/${channelId}/listings`),
    startVerification: (channelId: number) =>
        request<{ verificationCode: string }>(`/api/channels/${channelId}/start-verification`, { method: 'POST' }),
    confirmVerification: (channelId: number) =>
        request<Channel>(`/api/channels/${channelId}/confirm-verification`, { method: 'POST' }),

    // Listings
    getListings: (params?: ListingsParams) => {
        const query = new URLSearchParams(params as Record<string, string>).toString();
        return request<ListingWithChannel[]>(`/api/listings${query ? `?${query}` : ''}`);
    },
    getListing: (id: number) => request<ListingWithChannel>(`/api/listings/${id}`),
    createListing: (data: CreateListingData) =>
        request<Listing>('/api/listings', { method: 'POST', body: JSON.stringify(data) }),
    updateListing: (id: number, data: Partial<CreateListingData>) =>
        request<Listing>(`/api/listings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteListing: (id: number) =>
        request(`/api/listings/${id}`, { method: 'DELETE' }),

    // Campaigns
    getCampaigns: () => request<Campaign[]>('/api/campaigns'),
    getMyCampaigns: () => request<Campaign[]>('/api/campaigns/my'),
    getCampaign: (id: number) => request<CampaignWithApplications>(`/api/campaigns/${id}`),
    createCampaign: (data: CreateCampaignData) =>
        request<Campaign>('/api/campaigns', { method: 'POST', body: JSON.stringify(data) }),
    updateCampaign: (id: number, data: Partial<CreateCampaignData>) =>
        request<Campaign>(`/api/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    applyToCampaign: (campaignId: number, data: ApplyToCampaignData) =>
        request(`/api/campaigns/${campaignId}/apply`, { method: 'POST', body: JSON.stringify(data) }),
    getApplications: (campaignId: number) =>
        request<CampaignApplication[]>(`/api/campaigns/${campaignId}/applications`),
    respondToApplication: (campaignId: number, appId: number, data: { accepted: boolean; response_message?: string }) =>
        request(`/api/campaigns/${campaignId}/applications/${appId}`, { method: 'PUT', body: JSON.stringify(data) }),

    // Deals
    getDeals: (role?: 'advertiser' | 'owner' | 'all') =>
        request<DealWithDetails[]>(`/api/deals${role ? `?role=${role}` : ''}`),
    getDeal: (id: number) => request<DealWithDetails>(`/api/deals/${id}`),
    createDeal: (data: CreateDealData) =>
        request<Deal>('/api/deals', { method: 'POST', body: JSON.stringify(data) }),
    acceptDeal: (id: number) =>
        request<Deal>(`/api/deals/${id}/accept`, { method: 'POST' }),
    rejectDeal: (id: number) =>
        request<Deal>(`/api/deals/${id}/reject`, { method: 'POST' }),
    fundDeal: (id: number) =>
        request<{ data: Deal; escrow: { address: string; tx_hash: string } }>(`/api/deals/${id}/fund`, { method: 'POST' }),
    completeDeal: (id: number) =>
        request<Deal>(`/api/deals/${id}/complete`, { method: 'POST' }),
    disputeDeal: (id: number, reason: string) =>
        request<Deal>(`/api/deals/${id}/dispute`, { method: 'POST', body: JSON.stringify({ reason }) }),
    cancelDeal: (id: number) =>
        request<Deal>(`/api/deals/${id}/cancel`, { method: 'POST' }),
    triggerPost: (id: number) =>
        request(`/api/deals/${id}/post`, { method: 'POST' }),

    // Creative Drafts
    getDrafts: (dealId: number) =>
        request<CreativeDraft[]>(`/api/deals/${dealId}/drafts`),
    submitDraft: (dealId: number, data: { content: string; media_url?: string }) =>
        request<{ draft_id: number }>(`/api/deals/${dealId}/drafts`, { method: 'POST', body: JSON.stringify(data) }),
    reviewDraft: (dealId: number, draftId: number, data: { approved: boolean; feedback?: string }) =>
        request(`/api/deals/${dealId}/drafts/${draftId}/review`, { method: 'PUT', body: JSON.stringify(data) }),
    scheduleDeal: (dealId: number, scheduled_time: string) =>
        request(`/api/deals/${dealId}/schedule`, { method: 'POST', body: JSON.stringify({ scheduled_time }) }),
};

// Types
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

export interface UserStats {
    channels: number;
    deals_as_advertiser: number;
    deals_as_owner: number;
    completed_deals: number;
    campaigns: number;
    balance: number;
}

export interface WalletInfo {
    address: string;
    balance: number;
    transactions: Transaction[];
}

export interface Channel {
    id: number;
    telegram_id: number | null;
    username: string | null;
    title: string;
    description: string | null;
    subscribers_count: number | null;
    avg_views: number | null;
    owner_id: number;
    is_verified: boolean;
    bot_is_admin: boolean;
    verification_code: string | null;
    categories: string | null;
    photo_url: string | null;
    created_at: string;
}

export interface ChannelWithDetails extends Channel {
    listings: Listing[];
    managers: ChannelManager[];
}

export interface ChannelManager {
    id: number;
    user_id: number;
    role: string;
    username: string | null;
    first_name: string | null;
}

export interface Listing {
    id: number;
    channel_id: number;
    title: string;
    description: string | null;
    price: number;
    currency: string;
    duration_hours: number;
    format: string;
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

export interface Campaign {
    id: number;
    advertiser_id: number;
    title: string;
    description: string;
    budget_min: number | null;
    budget_max: number | null;
    target_subscribers_min: number | null;
    target_subscribers_max: number | null;
    target_categories: string | null;
    preferred_format: string;
    status: string;
    created_at: string;
    advertiser_username?: string | null;
    advertiser_first_name?: string | null;
    application_count?: number;
}

export interface CampaignWithApplications extends Campaign {
    applications: CampaignApplication[];
}

export interface CampaignApplication {
    id: number;
    campaign_id: number;
    channel_id: number;
    applicant_id: number;
    proposed_price: number;
    message: string | null;
    status: string;
    response_message: string | null;
    created_at: string;
    channel_title?: string;
    channel_username?: string | null;
    channel_subscribers?: number | null;
}

export interface Deal {
    id: number;
    listing_id: number | null;
    campaign_id: number | null;
    advertiser_id: number;
    channel_owner_id: number;
    channel_id: number;
    status: DealStatus;
    escrow_amount: number;
    escrow_wallet_address: string | null;
    ad_content: string | null;
    ad_media_url: string | null;
    ad_requirements: string | null;
    scheduled_time: string | null;
    posted_message_id: number | null;
    posted_at: string | null;
    completed_at: string | null;
    created_at: string;
}

export interface DealWithDetails extends Deal {
    listing_title: string | null;
    channel_title: string;
    channel_username: string | null;
    advertiser_username: string | null;
    advertiser_first_name: string | null;
    owner_username: string | null;
    owner_first_name: string | null;
    userRole?: 'advertiser' | 'owner';
}

export type DealStatus =
    | 'pending'
    | 'accepted'
    | 'rejected'
    | 'funded'
    | 'draft_pending'
    | 'draft_submitted'
    | 'draft_approved'
    | 'draft_rejected'
    | 'scheduled'
    | 'posting'
    | 'posted'
    | 'verifying'
    | 'completed'
    | 'disputed'
    | 'cancelled'
    | 'refunded'
    | 'expired';

export interface CreativeDraft {
    id: number;
    deal_id: number;
    version: number;
    content: string;
    media_url: string | null;
    submitted_by: number;
    status: string;
    feedback: string | null;
    created_at: string;
    reviewed_at: string | null;
    submitter_username?: string | null;
}

export interface Notification {
    id: number;
    user_id: number;
    type: string;
    title: string;
    message: string | null;
    is_read: boolean;
    data: string | null;
    created_at: string;
}

export interface Transaction {
    id: number;
    deal_id: number | null;
    from_user_id: number | null;
    to_user_id: number | null;
    amount: number;
    fee_amount: number;
    type: string;
    status: string;
    tx_hash: string | null;
    created_at: string;
}

export interface CreateChannelData {
    username?: string;
    title: string;
    description?: string;
    categories?: string[];
}

export interface CreateListingData {
    channel_id: number;
    title: string;
    description?: string;
    price: number;
    currency?: string;
    duration_hours?: number;
    format?: string;
    format_details?: string;
}

export interface CreateCampaignData {
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

export interface ApplyToCampaignData {
    channel_id: number;
    proposed_price: number;
    message?: string;
}

export interface CreateDealData {
    listing_id?: number;
    application_id?: number;
    ad_content?: string;
    ad_media_url?: string;
    ad_requirements?: string;
    scheduled_time?: string;
}

export interface ListingsParams {
    limit?: string;
    offset?: string;
    min_price?: string;
    max_price?: string;
    format?: string;
    min_subscribers?: string;
    search?: string;
}

export default api;

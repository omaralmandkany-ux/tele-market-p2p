import { useState, useEffect } from 'react';
import { api, DealWithDetails, DealStatus } from '../services/api';

const STATUS_LABELS: Record<DealStatus, string> = {
    pending: 'Pending Approval',
    accepted: 'Accepted - Awaiting Payment',
    rejected: 'Rejected',
    funded: 'Funded - Post Ad',
    draft_pending: 'Awaiting Draft',
    draft_submitted: 'Draft Submitted',
    draft_approved: 'Draft Approved',
    draft_rejected: 'Draft Rejected',
    scheduled: 'Scheduled',
    posting: 'Posting...',
    posted: 'Posted - Awaiting Confirmation',
    verifying: 'Verifying...',
    completed: 'Completed ✅',
    disputed: 'Disputed ⚠️',
    cancelled: 'Cancelled',
    refunded: 'Refunded',
    expired: 'Expired',
};

export default function Deals() {
    const [deals, setDeals] = useState<DealWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'advertiser' | 'owner'>('all');

    useEffect(() => {
        fetchDeals();
    }, [activeTab]);

    const fetchDeals = async () => {
        setLoading(true);
        const result = await api.getDeals(activeTab);
        if (result.success && result.data) {
            setDeals(result.data);
        }
        setLoading(false);
    };

    const handleAction = async (dealId: number, action: string) => {
        let result;
        switch (action) {
            case 'accept':
                result = await api.acceptDeal(dealId);
                break;
            case 'reject':
                result = await api.rejectDeal(dealId);
                break;
            case 'fund':
                result = await api.fundDeal(dealId);
                break;
            case 'posted':
                result = await api.triggerPost(dealId);
                break;
            case 'complete':
                result = await api.completeDeal(dealId);
                break;
            case 'cancel':
                result = await api.cancelDeal(dealId);
                break;
            default:
                return;
        }

        if (result?.success) {
            window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
            fetchDeals();
        } else {
            window.Telegram?.WebApp?.showAlert(result?.error || 'Action failed');
        }
    };

    const getActions = (deal: DealWithDetails) => {
        const actions: { label: string; action: string; style: string }[] = [];

        if (deal.userRole === 'owner') {
            if (deal.status === 'pending') {
                actions.push({ label: 'Accept', action: 'accept', style: 'btn-success' });
                actions.push({ label: 'Reject', action: 'reject', style: 'btn-danger' });
            }
            if (deal.status === 'funded') {
                actions.push({ label: 'Mark as Posted', action: 'posted', style: 'btn-primary' });
            }
        }

        if (deal.userRole === 'advertiser') {
            if (deal.status === 'accepted') {
                actions.push({ label: 'Fund Deal', action: 'fund', style: 'btn-success' });
            }
            if (deal.status === 'posted') {
                actions.push({ label: 'Confirm & Release', action: 'complete', style: 'btn-success' });
            }
            if (['pending', 'accepted'].includes(deal.status)) {
                actions.push({ label: 'Cancel', action: 'cancel', style: 'btn-secondary' });
            }
        }

        return actions;
    };

    const getStatusColor = (status: DealStatus) => {
        switch (status) {
            case 'completed': return 'badge-success';
            case 'pending': case 'accepted': return 'badge-warning';
            case 'funded': case 'posting': case 'posted': return 'badge-info';
            case 'disputed': return 'badge-error';
            default: return 'badge-primary';
        }
    };

    return (
        <div className="page">
            <div className="container">
                <h1 className="title">Deals</h1>
                <p className="text-muted" style={{ marginBottom: '16px' }}>
                    Manage your escrow deals
                </p>

                {/* Tabs */}
                <div className="tabs">
                    <button
                        className={`tab ${activeTab === 'all' ? 'active' : ''}`}
                        onClick={() => setActiveTab('all')}
                    >
                        All
                    </button>
                    <button
                        className={`tab ${activeTab === 'advertiser' ? 'active' : ''}`}
                        onClick={() => setActiveTab('advertiser')}
                    >
                        As Buyer
                    </button>
                    <button
                        className={`tab ${activeTab === 'owner' ? 'active' : ''}`}
                        onClick={() => setActiveTab('owner')}
                    >
                        As Seller
                    </button>
                </div>

                {/* Deals List */}
                {loading ? (
                    <div className="loading">
                        <div className="spinner"></div>
                    </div>
                ) : deals.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">🤝</div>
                        <p>No deals yet</p>
                        <p className="text-muted">Browse the marketplace to create your first deal</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {deals.map((deal) => (
                            <div key={deal.id} className="card">
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>{deal.listing_title}</div>
                                        <div className="text-muted" style={{ fontSize: '13px' }}>
                                            {deal.channel_username ? `@${deal.channel_username}` : deal.channel_title}
                                        </div>
                                    </div>
                                    <span className={`badge ${getStatusColor(deal.status)}`}>
                                        {STATUS_LABELS[deal.status]}
                                    </span>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <span className="text-muted" style={{ fontSize: '12px' }}>
                                        {deal.userRole === 'advertiser' ? '🛒 Buying' : '💰 Selling'}
                                    </span>
                                    <span className="listing-price">${deal.escrow_amount}</span>
                                </div>

                                {/* Ad Content Preview */}
                                {deal.ad_content && (
                                    <div style={{
                                        padding: '12px',
                                        background: 'var(--glass-bg)',
                                        borderRadius: 'var(--radius-sm)',
                                        marginBottom: '12px',
                                        fontSize: '13px',
                                        color: 'var(--color-text-secondary)',
                                    }}>
                                        <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--color-text-primary)' }}>
                                            Ad Content:
                                        </strong>
                                        {deal.ad_content.substring(0, 100)}
                                        {deal.ad_content.length > 100 && '...'}
                                    </div>
                                )}

                                {/* Actions */}
                                {getActions(deal).length > 0 && (
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                        {getActions(deal).map((action) => (
                                            <button
                                                key={action.action}
                                                className={`btn ${action.style}`}
                                                onClick={() => handleAction(deal.id, action.action)}
                                            >
                                                {action.label}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Date */}
                                <div className="text-muted" style={{ fontSize: '11px', marginTop: '12px' }}>
                                    Created: {new Date(deal.created_at).toLocaleDateString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

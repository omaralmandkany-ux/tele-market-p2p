import { useState, useEffect } from 'react';
import { api, DealWithDetails, DealStatus } from '../services/api';

const STATUS_LABELS: Record<DealStatus, string> = {
    pending: 'Awaiting Approval',
    accepted: 'Processing Payment...',
    rejected: 'Rejected',
    funded: 'Scheduled ⏰',
    draft_pending: 'Creating Ad',
    draft_submitted: 'Reviewing Ad',
    draft_approved: 'Ready to Post',
    draft_rejected: 'Needs Edit',
    scheduled: 'Scheduled ⏰',
    posting: 'Posting...',
    posted: 'Posted ✓',
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

    // Counter offer modal
    const [showCounterModal, setShowCounterModal] = useState(false);
    const [counterDealId, setCounterDealId] = useState<number | null>(null);
    const [counterPrice, setCounterPrice] = useState('');
    const [submitting, setSubmitting] = useState(false);

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

    const handleAction = async (dealId: number, action: string, deal?: DealWithDetails) => {
        // Handle counter offer - show modal
        if (action === 'counter') {
            setCounterDealId(dealId);
            setCounterPrice(deal?.escrow_amount?.toString() || '');
            setShowCounterModal(true);
            return;
        }

        setSubmitting(true);
        let result;

        switch (action) {
            case 'accept':
                result = await api.acceptDeal(dealId);
                break;
            case 'reject':
                result = await api.rejectDeal(dealId);
                break;
            case 'complete':
                result = await api.completeDeal(dealId);
                break;
            case 'cancel':
                result = await api.cancelDeal(dealId);
                break;
            default:
                setSubmitting(false);
                return;
        }

        if (result?.success) {
            window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');

            // Show success message based on action
            if (action === 'accept') {
                window.Telegram?.WebApp?.showAlert('✅ Accepted! Payment locked & ad scheduled for auto-posting.');
            } else if (action === 'complete') {
                window.Telegram?.WebApp?.showAlert('✅ Deal completed! Payment released.');
            }

            fetchDeals();
        } else {
            window.Telegram?.WebApp?.showAlert(result?.error || 'Action failed');
        }
        setSubmitting(false);
    };

    const handleCounterSubmit = async () => {
        if (!counterDealId || !counterPrice) return;

        setSubmitting(true);
        const result = await api.rejectDeal(counterDealId);

        if (result?.success) {
            window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
            window.Telegram?.WebApp?.showAlert(`Counter offer of $${counterPrice} noted. Deal declined for now.`);
            setShowCounterModal(false);
            setCounterDealId(null);
            fetchDeals();
        }
        setSubmitting(false);
    };

    const getActions = (deal: DealWithDetails) => {
        const actions: { label: string; action: string; style: string; icon: string }[] = [];

        // Channel Owner actions
        if (deal.userRole === 'owner') {
            if (deal.status === 'pending') {
                actions.push({ label: 'Accept', action: 'accept', style: 'btn-success', icon: '✅' });
                actions.push({ label: 'Counter', action: 'counter', style: 'btn-warning', icon: '💰' });
                actions.push({ label: 'Reject', action: 'reject', style: 'btn-danger', icon: '❌' });
            }
        }

        // Advertiser actions
        if (deal.userRole === 'advertiser') {
            if (deal.status === 'posted') {
                actions.push({ label: 'Confirm & Complete', action: 'complete', style: 'btn-success', icon: '✅' });
            }
            if (deal.status === 'pending') {
                actions.push({ label: 'Cancel', action: 'cancel', style: 'btn-secondary', icon: '✖️' });
            }
        }

        return actions;
    };

    const getStatusColor = (status: DealStatus) => {
        switch (status) {
            case 'completed': return 'badge-success';
            case 'pending': return 'badge-warning';
            case 'funded': case 'scheduled': case 'posted': return 'badge-info';
            case 'rejected': case 'cancelled': case 'disputed': return 'badge-error';
            default: return 'badge-primary';
        }
    };

    const getStatusEmoji = (status: DealStatus, userRole?: string) => {
        switch (status) {
            case 'pending': return userRole === 'owner' ? '📩' : '⏳';
            case 'funded': case 'scheduled': return '⏰';
            case 'posting': return '🚀';
            case 'posted': return '📢';
            case 'completed': return '✅';
            case 'rejected': case 'cancelled': return '❌';
            default: return '📋';
        }
    };

    const formatScheduledTime = (time: string | null) => {
        if (!time) return null;
        const date = new Date(time);
        const now = new Date();
        const diffMs = date.getTime() - now.getTime();
        const diffHours = Math.round(diffMs / (1000 * 60 * 60));

        if (diffHours <= 0) return 'Posting soon...';
        if (diffHours === 1) return 'In 1 hour';
        if (diffHours < 24) return `In ${diffHours} hours`;
        return date.toLocaleDateString();
    };

    return (
        <div className="page">
            <div className="container">
                <h1 className="title">My Deals</h1>
                <p className="text-muted" style={{ marginBottom: '16px' }}>
                    {activeTab === 'owner' ? 'Ads to post on your channels' :
                        activeTab === 'advertiser' ? 'Your ad requests' : 'All your deals'}
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
                        <p className="text-muted">Browse the marketplace to get started</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {deals.map((deal) => (
                            <div key={deal.id} className="card" style={{ padding: '16px' }}>
                                {/* Header */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '20px' }}>{getStatusEmoji(deal.status, deal.userRole)}</span>
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '15px' }}>
                                                @{deal.channel_username || deal.channel_title}
                                            </div>
                                            <div className="text-muted" style={{ fontSize: '12px' }}>
                                                {deal.userRole === 'advertiser' ? 'Your ad request' : 'Ad request for you'}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div className="listing-price">${deal.escrow_amount}</div>
                                        <span className={`badge ${getStatusColor(deal.status)}`} style={{ fontSize: '10px' }}>
                                            {STATUS_LABELS[deal.status]}
                                        </span>
                                    </div>
                                </div>

                                {/* Ad Content Preview */}
                                {deal.ad_content && (
                                    <div style={{
                                        padding: '12px',
                                        background: 'var(--glass-bg)',
                                        borderRadius: '8px',
                                        marginBottom: '12px',
                                        fontSize: '13px',
                                        color: 'var(--color-text-secondary)',
                                        whiteSpace: 'pre-wrap',
                                    }}>
                                        {deal.ad_content.length > 150
                                            ? deal.ad_content.substring(0, 150) + '...'
                                            : deal.ad_content}
                                    </div>
                                )}

                                {/* Scheduled Time */}
                                {deal.scheduled_time && ['funded', 'scheduled'].includes(deal.status) && (
                                    <div style={{
                                        padding: '8px 12px',
                                        background: 'rgba(0, 122, 255, 0.1)',
                                        borderRadius: '8px',
                                        marginBottom: '12px',
                                        fontSize: '13px',
                                        color: 'var(--color-accent)'
                                    }}>
                                        ⏰ {formatScheduledTime(deal.scheduled_time)}
                                    </div>
                                )}

                                {/* Actions */}
                                {getActions(deal).length > 0 && (
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {getActions(deal).map((action) => (
                                            <button
                                                key={action.action}
                                                className={`btn ${action.style}`}
                                                onClick={() => handleAction(deal.id, action.action, deal)}
                                                disabled={submitting}
                                                style={{ flex: 1, fontSize: '13px' }}
                                            >
                                                {action.icon} {action.label}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Status Messages */}
                                {deal.status === 'completed' && (
                                    <div style={{
                                        padding: '8px 12px',
                                        background: 'rgba(52, 199, 89, 0.1)',
                                        borderRadius: '8px',
                                        color: 'var(--color-success)',
                                        fontSize: '13px',
                                        textAlign: 'center'
                                    }}>
                                        ✅ Deal completed! Payment released.
                                    </div>
                                )}

                                {deal.status === 'posted' && deal.userRole === 'advertiser' && (
                                    <div style={{
                                        padding: '8px 12px',
                                        background: 'rgba(0, 122, 255, 0.1)',
                                        borderRadius: '8px',
                                        color: 'var(--color-accent)',
                                        fontSize: '13px',
                                        textAlign: 'center'
                                    }}>
                                        📢 Ad is live! Click "Confirm & Complete" when verified.
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Counter Offer Modal */}
            {showCounterModal && (
                <div className="modal-overlay" onClick={() => setShowCounterModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '340px' }}>
                        <div className="modal-header">
                            <h2>💰 Counter Offer</h2>
                            <button className="modal-close" onClick={() => setShowCounterModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <p className="text-muted" style={{ marginBottom: '16px', fontSize: '13px' }}>
                                Propose a different price for this ad
                            </p>
                            <div className="form-group">
                                <label>Your Price ($)</label>
                                <input
                                    type="number"
                                    value={counterPrice}
                                    onChange={(e) => setCounterPrice(e.target.value)}
                                    placeholder="Enter amount"
                                    min="1"
                                    step="0.1"
                                    style={{ fontSize: '18px', textAlign: 'center' }}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowCounterModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleCounterSubmit}
                                disabled={submitting || !counterPrice}
                            >
                                {submitting ? 'Sending...' : 'Send Offer'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

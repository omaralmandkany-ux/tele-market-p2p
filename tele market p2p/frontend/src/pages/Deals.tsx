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

    // Draft modal state
    const [showDraftModal, setShowDraftModal] = useState(false);
    const [selectedDealId, setSelectedDealId] = useState<number | null>(null);
    const [draftContent, setDraftContent] = useState('');
    const [draftMediaUrl, setDraftMediaUrl] = useState('');
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

    const handleAction = async (dealId: number, action: string) => {
        // Handle submit_draft separately to show modal
        if (action === 'submit_draft') {
            setSelectedDealId(dealId);
            setDraftContent('');
            setDraftMediaUrl('');
            setShowDraftModal(true);
            return;
        }

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

    const handleSubmitDraft = async () => {
        if (!selectedDealId || !draftContent.trim()) {
            window.Telegram?.WebApp?.showAlert('Please enter the ad content');
            return;
        }

        setSubmitting(true);
        const result = await api.submitDraft(selectedDealId, {
            content: draftContent.trim(),
            media_url: draftMediaUrl.trim() || undefined,
        });

        if (result?.success) {
            window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
            setShowDraftModal(false);
            setSelectedDealId(null);
            setDraftContent('');
            setDraftMediaUrl('');
            fetchDeals();
        } else {
            window.Telegram?.WebApp?.showAlert(result?.error || 'Failed to submit draft');
        }
        setSubmitting(false);
    };

    const getActions = (deal: DealWithDetails) => {
        const actions: { label: string; action: string; style: string }[] = [];

        if (deal.userRole === 'owner') {
            if (deal.status === 'pending') {
                actions.push({ label: 'Accept', action: 'accept', style: 'btn-success' });
                actions.push({ label: 'Reject', action: 'reject', style: 'btn-danger' });
            }
            if (deal.status === 'draft_pending') {
                actions.push({ label: 'Submit Draft', action: 'submit_draft', style: 'btn-primary' });
            }
            if (deal.status === 'draft_rejected') {
                actions.push({ label: 'Resubmit Draft', action: 'submit_draft', style: 'btn-primary' });
            }
            if (deal.status === 'funded' || deal.status === 'draft_approved') {
                actions.push({ label: 'Mark as Posted', action: 'posted', style: 'btn-primary' });
            }
        }

        if (deal.userRole === 'advertiser') {
            if (deal.status === 'accepted') {
                actions.push({ label: 'Fund Deal', action: 'fund', style: 'btn-success' });
            }
            if (deal.status === 'draft_submitted') {
                actions.push({ label: 'Review Draft', action: 'review_draft', style: 'btn-primary' });
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
            case 'funded': case 'posting': case 'posted': case 'draft_approved': return 'badge-info';
            case 'disputed': case 'draft_rejected': return 'badge-error';
            case 'draft_pending': case 'draft_submitted': return 'badge-primary';
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
                                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>{deal.listing_title || deal.channel_title}</div>
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

            {/* Draft Submission Modal */}
            {showDraftModal && (
                <div className="modal-overlay" onClick={() => setShowDraftModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Submit Draft</h2>
                            <button className="modal-close" onClick={() => setShowDraftModal(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label>Ad Content *</label>
                                <textarea
                                    value={draftContent}
                                    onChange={(e) => setDraftContent(e.target.value)}
                                    placeholder="Enter the ad content that will be posted..."
                                    rows={5}
                                    style={{ width: '100%', resize: 'vertical' }}
                                />
                            </div>
                            <div className="form-group">
                                <label>Media URL (optional)</label>
                                <input
                                    type="text"
                                    value={draftMediaUrl}
                                    onChange={(e) => setDraftMediaUrl(e.target.value)}
                                    placeholder="https://example.com/image.jpg"
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowDraftModal(false)}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleSubmitDraft}
                                disabled={submitting || !draftContent.trim()}
                            >
                                {submitting ? 'Submitting...' : 'Submit Draft'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

import React, { useState, useEffect } from 'react';
import { api, Campaign } from '../services/api';

const Campaigns: React.FC = () => {
    const [view, setView] = useState<'browse' | 'my'>('browse');
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [myCampaigns, setMyCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [showApply, setShowApply] = useState<number | null>(null);

    useEffect(() => {
        loadCampaigns();
    }, [view]);

    const loadCampaigns = async () => {
        setLoading(true);
        try {
            if (view === 'browse') {
                const res = await api.getCampaigns();
                if (res.success) setCampaigns(res.data || []);
            } else {
                const res = await api.getMyCampaigns();
                if (res.success) setMyCampaigns(res.data || []);
            }
        } catch (error) {
            console.error('Error loading campaigns:', error);
        }
        setLoading(false);
    };

    return (
        <div className="page campaigns-page">
            <header className="page-header">
                <h1>📢 Campaigns</h1>
                <p>Advertiser requests & channel applications</p>
            </header>

            <div className="tabs">
                <button
                    className={`tab ${view === 'browse' ? 'active' : ''}`}
                    onClick={() => setView('browse')}
                >
                    🔍 Browse
                </button>
                <button
                    className={`tab ${view === 'my' ? 'active' : ''}`}
                    onClick={() => setView('my')}
                >
                    📋 My Campaigns
                </button>
            </div>

            {view === 'browse' && (
                <div className="campaigns-list">
                    <p className="section-info">
                        💡 Channel owners can apply to these campaigns
                    </p>
                    {loading ? (
                        <div className="loading">Loading campaigns...</div>
                    ) : campaigns.length === 0 ? (
                        <div className="empty-state">
                            <span className="emoji">📭</span>
                            <p>No active campaigns</p>
                        </div>
                    ) : (
                        campaigns.map(campaign => (
                            <div key={campaign.id} className="card campaign-card">
                                <div className="campaign-header">
                                    <h3>{campaign.title}</h3>
                                    <span className="status-badge active">{campaign.status}</span>
                                </div>
                                <p className="description">{campaign.description}</p>
                                <div className="campaign-details">
                                    {campaign.budget_max && (
                                        <span className="detail">💰 Up to {campaign.budget_max} TON</span>
                                    )}
                                    {campaign.target_subscribers_min && (
                                        <span className="detail">👥 {campaign.target_subscribers_min}+ subs</span>
                                    )}
                                    <span className="detail">📝 {campaign.preferred_format}</span>
                                </div>
                                <div className="campaign-meta">
                                    <span>by @{campaign.advertiser_username || 'Anonymous'}</span>
                                    <span>{campaign.application_count || 0} applications</span>
                                </div>
                                <button
                                    className="btn btn-primary"
                                    onClick={() => setShowApply(campaign.id)}
                                >
                                    Apply with Channel
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}

            {view === 'my' && (
                <div className="my-campaigns">
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                        ➕ Create Campaign
                    </button>
                    {loading ? (
                        <div className="loading">Loading...</div>
                    ) : myCampaigns.length === 0 ? (
                        <div className="empty-state">
                            <span className="emoji">📝</span>
                            <p>No campaigns yet</p>
                            <p className="hint">Create a campaign to reach channel owners</p>
                        </div>
                    ) : (
                        myCampaigns.map(campaign => (
                            <div key={campaign.id} className="card campaign-card">
                                <div className="campaign-header">
                                    <h3>{campaign.title}</h3>
                                    <span className={`status-badge ${campaign.status}`}>{campaign.status}</span>
                                </div>
                                <p className="description">{campaign.description}</p>
                                <div className="campaign-stats">
                                    <span>Budget: {campaign.budget_min} - {campaign.budget_max} TON</span>
                                </div>
                                <button className="btn btn-secondary">
                                    View Applications
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Create Campaign Modal */}
            {showCreate && (
                <CreateCampaignModal
                    onClose={() => setShowCreate(false)}
                    onCreated={() => {
                        setShowCreate(false);
                        loadCampaigns();
                    }}
                />
            )}

            {/* Apply Modal */}
            {showApply && (
                <ApplyModal
                    campaignId={showApply}
                    onClose={() => setShowApply(null)}
                    onApplied={() => {
                        setShowApply(null);
                        loadCampaigns();
                    }}
                />
            )}
        </div>
    );
};

// Create Campaign Modal
const CreateCampaignModal: React.FC<{
    onClose: () => void;
    onCreated: () => void;
}> = ({ onClose, onCreated }) => {
    const [form, setForm] = useState({
        title: '',
        description: '',
        budget_min: '',
        budget_max: '',
        target_subscribers_min: '',
        preferred_format: 'any',
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await api.createCampaign({
                title: form.title,
                description: form.description,
                budget_min: form.budget_min ? parseFloat(form.budget_min) : undefined,
                budget_max: form.budget_max ? parseFloat(form.budget_max) : undefined,
                target_subscribers_min: form.target_subscribers_min ? parseInt(form.target_subscribers_min) : undefined,
                preferred_format: form.preferred_format as any,
            });
            if (res.success) {
                onCreated();
            }
        } catch (error) {
            console.error('Error creating campaign:', error);
        }
        setLoading(false);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Create Campaign</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Campaign Title *</label>
                        <input
                            type="text"
                            value={form.title}
                            onChange={e => setForm({ ...form, title: e.target.value })}
                            placeholder="e.g., Looking for crypto channels"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Description *</label>
                        <textarea
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                            placeholder="Describe what you're looking for..."
                            required
                            rows={4}
                        />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Budget Min (TON)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.budget_min}
                                onChange={e => setForm({ ...form, budget_min: e.target.value })}
                                placeholder="0.5"
                            />
                        </div>
                        <div className="form-group">
                            <label>Budget Max (TON)</label>
                            <input
                                type="number"
                                step="0.01"
                                value={form.budget_max}
                                onChange={e => setForm({ ...form, budget_max: e.target.value })}
                                placeholder="10"
                            />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Min Subscribers</label>
                        <input
                            type="number"
                            value={form.target_subscribers_min}
                            onChange={e => setForm({ ...form, target_subscribers_min: e.target.value })}
                            placeholder="1000"
                        />
                    </div>
                    <div className="form-group">
                        <label>Preferred Format</label>
                        <select
                            value={form.preferred_format}
                            onChange={e => setForm({ ...form, preferred_format: e.target.value })}
                        >
                            <option value="any">Any Format</option>
                            <option value="post">Post</option>
                            <option value="story">Story</option>
                            <option value="repost">Repost</option>
                            <option value="video">Video</option>
                        </select>
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? 'Creating...' : 'Create Campaign'}
                    </button>
                </form>
            </div>
        </div>
    );
};

// Apply Modal
const ApplyModal: React.FC<{
    campaignId: number;
    onClose: () => void;
    onApplied: () => void;
}> = ({ campaignId, onClose, onApplied }) => {
    const [channels, setChannels] = useState<any[]>([]);
    const [selectedChannel, setSelectedChannel] = useState<number | null>(null);
    const [proposedPrice, setProposedPrice] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadChannels();
    }, []);

    const loadChannels = async () => {
        const res = await api.getMyChannels();
        if (res.success) {
            setChannels((res.data || []).filter((c: any) => c.is_verified));
        }
    };

    const handleApply = async () => {
        if (!selectedChannel || !proposedPrice) return;
        setLoading(true);
        try {
            const res = await api.applyToCampaign(campaignId, {
                channel_id: selectedChannel,
                proposed_price: parseFloat(proposedPrice),
                message,
            });
            if (res.success) {
                onApplied();
            }
        } catch (error) {
            console.error('Error applying:', error);
        }
        setLoading(false);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Apply to Campaign</h2>
                    <button className="close-btn" onClick={onClose}>✕</button>
                </div>
                <div className="modal-content">
                    <div className="form-group">
                        <label>Select Channel *</label>
                        <select
                            value={selectedChannel || ''}
                            onChange={e => setSelectedChannel(parseInt(e.target.value))}
                        >
                            <option value="">Choose a channel...</option>
                            {channels.map(ch => (
                                <option key={ch.id} value={ch.id}>
                                    {ch.title} ({ch.subscribers_count} subs)
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Your Price (TON) *</label>
                        <input
                            type="number"
                            step="0.01"
                            value={proposedPrice}
                            onChange={e => setProposedPrice(e.target.value)}
                            placeholder="5.00"
                        />
                    </div>
                    <div className="form-group">
                        <label>Message (optional)</label>
                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder="Why your channel is a good fit..."
                            rows={3}
                        />
                    </div>
                    <button
                        className="btn btn-primary"
                        onClick={handleApply}
                        disabled={loading || !selectedChannel || !proposedPrice}
                    >
                        {loading ? 'Applying...' : 'Submit Application'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Campaigns;

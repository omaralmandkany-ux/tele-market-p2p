import { useState } from 'react';
import { api, ListingWithChannel } from '../services/api';

interface CreateDealModalProps {
    listing: ListingWithChannel;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateDealModal({ listing, onClose, onSuccess }: CreateDealModalProps) {
    const [adContent, setAdContent] = useState('');
    const [adMediaUrl, setAdMediaUrl] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Get minimum date-time (now + 1 hour)
    const getMinDateTime = () => {
        const now = new Date();
        now.setHours(now.getHours() + 1);
        return now.toISOString().slice(0, 16);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!adContent.trim()) {
            setError('Ad content is required');
            return;
        }

        setLoading(true);
        setError('');

        const result = await api.createDeal({
            listing_id: listing.id,
            ad_content: adContent,
            ad_media_url: adMediaUrl || undefined,
            scheduled_time: scheduledTime || undefined,
        });

        if (result.success) {
            window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
            onSuccess();
        } else {
            setError(result.error || 'Failed to create deal');
        }

        setLoading(false);
    };

    const formatSubscribers = (count: number | null) => {
        if (!count) return 'N/A';
        if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
        if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
        return count.toString();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">📢 Book Ad</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    {/* Channel Preview */}
                    <div className="card" style={{ marginBottom: '20px', background: 'var(--color-bg-tertiary)', padding: '12px' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div
                                style={{
                                    width: '50px',
                                    height: '50px',
                                    borderRadius: '50%',
                                    background: 'var(--color-accent-gradient)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '20px',
                                    flexShrink: 0,
                                }}
                            >
                                {listing.channel_photo_url ? (
                                    <img
                                        src={listing.channel_photo_url}
                                        alt={listing.channel_title}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                                    />
                                ) : (
                                    '📢'
                                )}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '15px' }}>
                                    @{listing.channel_username || listing.channel_title}
                                </div>
                                <div className="text-muted" style={{ fontSize: '12px' }}>
                                    👥 {formatSubscribers(listing.channel_subscribers)} subscribers
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <span className="listing-price">${listing.price}</span>
                                <div className="text-muted" style={{ fontSize: '11px' }}>{listing.duration_hours}h</div>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="alert alert-error" style={{ marginBottom: '16px' }}>{error}</div>
                    )}

                    <form onSubmit={handleSubmit}>
                        {/* Ad Content */}
                        <div className="form-group">
                            <label className="form-label">📝 Ad Content *</label>
                            <textarea
                                className="form-textarea"
                                placeholder="Write your ad text here..."
                                value={adContent}
                                onChange={(e) => setAdContent(e.target.value)}
                                rows={4}
                                required
                                style={{ fontSize: '14px' }}
                            />
                        </div>

                        {/* Media URL */}
                        <div className="form-group">
                            <label className="form-label">🖼️ Media URL (Optional)</label>
                            <input
                                type="url"
                                className="form-input"
                                placeholder="https://example.com/image.jpg"
                                value={adMediaUrl}
                                onChange={(e) => setAdMediaUrl(e.target.value)}
                            />
                        </div>

                        {/* Schedule Time */}
                        <div className="form-group">
                            <label className="form-label">⏰ Post Time (Optional)</label>
                            <input
                                type="datetime-local"
                                className="form-input"
                                value={scheduledTime}
                                onChange={(e) => setScheduledTime(e.target.value)}
                                min={getMinDateTime()}
                            />
                            <p className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                                Leave empty for immediate posting after approval
                            </p>
                        </div>

                        {/* Simple Info */}
                        <div style={{
                            padding: '12px',
                            background: 'var(--glass-bg)',
                            borderRadius: '8px',
                            marginBottom: '16px',
                            fontSize: '13px'
                        }}>
                            <div style={{ color: 'var(--color-accent)', fontWeight: 600, marginBottom: '8px' }}>
                                ✨ How it works:
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--color-text-secondary)' }}>
                                <span>1️⃣ You send this request</span>
                                <span>2️⃣ Channel owner approves</span>
                                <span>3️⃣ Ad gets posted automatically!</span>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-block btn-lg"
                            disabled={loading || !adContent.trim()}
                        >
                            {loading ? 'Sending...' : `🚀 Send Request • $${listing.price}`}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

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
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

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
                    <h2 className="modal-title">Book Ad Slot</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    {/* Listing Preview */}
                    <div className="card" style={{ marginBottom: '24px', background: 'var(--color-bg-tertiary)' }}>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            <div
                                style={{
                                    width: '60px',
                                    height: '60px',
                                    borderRadius: '8px',
                                    background: 'var(--color-accent-gradient)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '24px',
                                }}
                            >
                                {listing.channel_photo_url ? (
                                    <img
                                        src={listing.channel_photo_url}
                                        alt={listing.channel_title}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                                    />
                                ) : (
                                    '📢'
                                )}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 600 }}>{listing.title}</div>
                                <div className="text-muted" style={{ fontSize: '13px' }}>
                                    @{listing.channel_username || listing.channel_title}
                                </div>
                                <div className="text-muted" style={{ fontSize: '12px', marginTop: '4px' }}>
                                    👥 {formatSubscribers(listing.channel_subscribers)} • ⏱️ {listing.duration_hours}h
                                </div>
                            </div>
                            <div>
                                <span className="listing-price">${listing.price}</span>
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div className="alert alert-error">{error}</div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Ad Content *</label>
                            <textarea
                                className="form-textarea"
                                placeholder="Write your ad text here. This is what will be posted..."
                                value={adContent}
                                onChange={(e) => setAdContent(e.target.value)}
                                rows={5}
                                required
                            />
                            <p className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                                Supports text, emojis, and links
                            </p>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Media URL (Optional)</label>
                            <input
                                type="url"
                                className="form-input"
                                placeholder="https://example.com/image.jpg"
                                value={adMediaUrl}
                                onChange={(e) => setAdMediaUrl(e.target.value)}
                            />
                            <p className="text-muted" style={{ fontSize: '11px', marginTop: '4px' }}>
                                Link to image or video to include with post
                            </p>
                        </div>

                        <div className="alert alert-info">
                            <strong>How it works:</strong>
                            <ol style={{ margin: '8px 0 0 16px', fontSize: '13px' }}>
                                <li>Submit your request</li>
                                <li>Channel owner reviews & accepts</li>
                                <li>You deposit ${listing.price} to escrow</li>
                                <li>Ad is posted - you verify</li>
                                <li>Funds released to channel owner</li>
                            </ol>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-block btn-lg"
                            disabled={loading}
                            style={{ marginTop: '16px' }}
                        >
                            {loading ? 'Submitting...' : `Request for $${listing.price}`}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

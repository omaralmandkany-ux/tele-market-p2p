import { useState } from 'react';
import { api, Channel } from '../services/api';

interface CreateListingModalProps {
    channel: Channel;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateListingModal({ channel, onClose, onSuccess }: CreateListingModalProps) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [durationHours, setDurationHours] = useState('24');
    const [format, setFormat] = useState('post');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim() || !price) {
            setError('Title and price are required');
            return;
        }

        const priceNum = parseFloat(price);
        if (isNaN(priceNum) || priceNum <= 0) {
            setError('Please enter a valid price');
            return;
        }

        setLoading(true);
        setError('');

        const result = await api.createListing({
            channel_id: channel.id,
            title,
            description: description || undefined,
            price: priceNum,
            duration_hours: parseInt(durationHours),
            format,
        });

        if (result.success) {
            window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
            onSuccess();
        } else {
            setError(result.error || 'Failed to create listing');
        }

        setLoading(false);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">New Listing</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    <div className="alert alert-info" style={{ marginBottom: '16px' }}>
                        Creating listing for: <strong>{channel.title}</strong>
                    </div>

                    {error && (
                        <div className="alert alert-error">{error}</div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Listing Title *</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="e.g., Sponsored Post, Story Mention"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <textarea
                                className="form-textarea"
                                placeholder="Describe what the advertiser gets..."
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Price (USD) *</label>
                                <input
                                    type="number"
                                    className="form-input"
                                    placeholder="50"
                                    value={price}
                                    onChange={(e) => setPrice(e.target.value)}
                                    min="1"
                                    step="0.01"
                                    required
                                />
                            </div>

                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Duration</label>
                                <select
                                    className="form-select"
                                    value={durationHours}
                                    onChange={(e) => setDurationHours(e.target.value)}
                                >
                                    <option value="12">12 hours</option>
                                    <option value="24">24 hours</option>
                                    <option value="48">48 hours</option>
                                    <option value="72">72 hours</option>
                                    <option value="168">1 week</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Ad Format</label>
                            <select
                                className="form-select"
                                value={format}
                                onChange={(e) => setFormat(e.target.value)}
                            >
                                <option value="post">Regular Post</option>
                                <option value="story">Story/Temporary</option>
                                <option value="repost">Repost/Share</option>
                                <option value="video">Video</option>
                            </select>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary btn-block btn-lg"
                            disabled={loading}
                        >
                            {loading ? 'Creating...' : 'Create Listing'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}

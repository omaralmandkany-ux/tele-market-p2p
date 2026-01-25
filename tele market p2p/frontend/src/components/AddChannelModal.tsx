import { useState } from 'react';
import { api } from '../services/api';

interface AddChannelModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddChannelModal({ onClose, onSuccess }: AddChannelModalProps) {
    const [mode, setMode] = useState<'quick' | 'manual'>('quick');
    const [username, setUsername] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleQuickVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim()) {
            setError('Username is required');
            return;
        }

        setLoading(true);
        setError('');

        const result = await api.quickVerifyChannel(username.replace('@', ''));

        if (result.success) {
            window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
            onSuccess();
        } else {
            setError(result.error || 'Failed to verify channel');
        }

        setLoading(false);
    };

    const handleManualAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            setError('Title is required');
            return;
        }

        setLoading(true);
        setError('');

        const result = await api.createChannel({
            username: username.replace('@', '') || undefined,
            title,
            description: description || undefined,
        });

        if (result.success) {
            window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
            onSuccess();
        } else {
            setError(result.error || 'Failed to add channel');
        }

        setLoading(false);
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Add Channel</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                <div className="modal-body">
                    {/* Mode Tabs */}
                    <div className="tabs" style={{ marginBottom: '24px' }}>
                        <button
                            className={`tab ${mode === 'quick' ? 'active' : ''}`}
                            onClick={() => setMode('quick')}
                        >
                            Quick Verify
                        </button>
                        <button
                            className={`tab ${mode === 'manual' ? 'active' : ''}`}
                            onClick={() => setMode('manual')}
                        >
                            Manual Add
                        </button>
                    </div>

                    {error && (
                        <div className="alert alert-error">{error}</div>
                    )}

                    {mode === 'quick' ? (
                        <form onSubmit={handleQuickVerify}>
                            <div className="form-group">
                                <label className="form-label">Channel Username</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="@yourchannel"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                                <p className="text-muted" style={{ fontSize: '12px', marginTop: '8px' }}>
                                    💡 Make sure you're an admin of the channel and the bot can access it
                                </p>
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary btn-block btn-lg"
                                disabled={loading}
                            >
                                {loading ? 'Verifying...' : 'Verify & Add'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleManualAdd}>
                            <div className="form-group">
                                <label className="form-label">Channel Username (Optional)</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="@yourchannel"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Channel Title *</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="My Awesome Channel"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <textarea
                                    className="form-textarea"
                                    placeholder="What's your channel about?"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    rows={3}
                                />
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary btn-block btn-lg"
                                disabled={loading}
                            >
                                {loading ? 'Adding...' : 'Add Channel'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

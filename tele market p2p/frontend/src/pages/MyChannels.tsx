import { useState, useEffect } from 'react';
import { api, Channel, Listing } from '../services/api';
import AddChannelModal from '../components/AddChannelModal';
import CreateListingModal from '../components/CreateListingModal';

export default function MyChannels() {
    const [channels, setChannels] = useState<Channel[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddChannel, setShowAddChannel] = useState(false);
    const [showCreateListing, setShowCreateListing] = useState<Channel | null>(null);
    const [expandedChannel, setExpandedChannel] = useState<number | null>(null);
    const [channelListings, setChannelListings] = useState<Record<number, Listing[]>>({});

    useEffect(() => {
        fetchChannels();
    }, []);

    const fetchChannels = async () => {
        const result = await api.getMyChannels();
        if (result.success && result.data) {
            setChannels(result.data);
        }
        setLoading(false);
    };

    const fetchChannelListings = async (channelId: number) => {
        const result = await api.getChannelListings(channelId);
        if (result.success && result.data) {
            setChannelListings(prev => ({ ...prev, [channelId]: result.data! }));
        }
    };

    const toggleChannel = (channelId: number) => {
        if (expandedChannel === channelId) {
            setExpandedChannel(null);
        } else {
            setExpandedChannel(channelId);
            if (!channelListings[channelId]) {
                fetchChannelListings(channelId);
            }
        }
    };

    const handleStartVerification = async (channel: Channel) => {
        const result = await api.startVerification(channel.id);
        if (result.success && result.data) {
            window.Telegram?.WebApp?.showAlert(
                `Post this code in your channel:\n\n${result.data.verificationCode}\n\nThen click "Confirm Verification"`
            );
            fetchChannels();
        } else {
            window.Telegram?.WebApp?.showAlert(result.error || 'Failed to start verification');
        }
    };

    const handleConfirmVerification = async (channel: Channel) => {
        const result = await api.confirmVerification(channel.id);
        if (result.success) {
            window.Telegram?.WebApp?.showAlert('Channel verified successfully! ✅');
            fetchChannels();
        } else {
            window.Telegram?.WebApp?.showAlert(result.error || 'Verification failed');
        }
    };

    const formatSubscribers = (count: number | null) => {
        if (!count) return 'N/A';
        if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
        if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
        return count.toString();
    };

    return (
        <div className="page">
            <div className="container">
                <div className="section-header">
                    <h1 className="title">My Channels</h1>
                    <button className="btn btn-primary" onClick={() => setShowAddChannel(true)}>
                        + Add
                    </button>
                </div>
                <p className="text-muted" style={{ marginBottom: '24px' }}>
                    Register and verify your channels to create listings
                </p>

                {loading ? (
                    <div className="loading">
                        <div className="spinner"></div>
                    </div>
                ) : channels.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📢</div>
                        <p>No channels yet</p>
                        <p className="text-muted">Add your first channel to start earning</p>
                        <button
                            className="btn btn-primary"
                            style={{ marginTop: '16px' }}
                            onClick={() => setShowAddChannel(true)}
                        >
                            Add Channel
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {channels.map((channel) => (
                            <div key={channel.id} className="card">
                                <div
                                    className="card-header"
                                    onClick={() => toggleChannel(channel.id)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <div className="card-avatar">
                                        {channel.photo_url ? (
                                            <img
                                                src={channel.photo_url}
                                                alt={channel.title}
                                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }}
                                            />
                                        ) : (
                                            '📢'
                                        )}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div className="card-title">
                                            {channel.title}
                                            {channel.is_verified && (
                                                <span className="verified-badge" style={{ marginLeft: '8px' }}>Verified</span>
                                            )}
                                        </div>
                                        <div className="card-subtitle">
                                            {channel.username ? `@${channel.username}` : 'No username'}
                                            {channel.subscribers_count && ` • ${formatSubscribers(channel.subscribers_count)} subscribers`}
                                        </div>
                                    </div>
                                    <span style={{ fontSize: '18px', color: 'var(--color-text-muted)' }}>
                                        {expandedChannel === channel.id ? '▲' : '▼'}
                                    </span>
                                </div>

                                {expandedChannel === channel.id && (
                                    <div style={{ marginTop: '16px' }}>
                                        {/* Verification Status */}
                                        {!channel.is_verified && (
                                            <div className="alert alert-info" style={{ marginBottom: '16px' }}>
                                                <strong>Verification Required</strong>
                                                <p style={{ margin: '8px 0' }}>Verify your channel to create listings</p>
                                                {channel.verification_code ? (
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            className="btn btn-secondary"
                                                            onClick={() => handleStartVerification(channel)}
                                                        >
                                                            Show Code
                                                        </button>
                                                        <button
                                                            className="btn btn-success"
                                                            onClick={() => handleConfirmVerification(channel)}
                                                        >
                                                            Confirm
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        className="btn btn-primary"
                                                        onClick={() => handleStartVerification(channel)}
                                                    >
                                                        Start Verification
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Listings */}
                                        {channel.is_verified && (
                                            <>
                                                <div className="section-header" style={{ marginBottom: '12px' }}>
                                                    <span style={{ fontWeight: 600 }}>Listings</span>
                                                    <button
                                                        className="btn btn-secondary"
                                                        onClick={() => setShowCreateListing(channel)}
                                                    >
                                                        + New Listing
                                                    </button>
                                                </div>

                                                {channelListings[channel.id]?.length > 0 ? (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        {channelListings[channel.id].map((listing) => (
                                                            <div
                                                                key={listing.id}
                                                                style={{
                                                                    display: 'flex',
                                                                    justifyContent: 'space-between',
                                                                    alignItems: 'center',
                                                                    padding: '12px',
                                                                    background: 'var(--glass-bg)',
                                                                    borderRadius: 'var(--radius-sm)',
                                                                }}
                                                            >
                                                                <div>
                                                                    <div style={{ fontWeight: 500 }}>{listing.title}</div>
                                                                    <div className="text-muted" style={{ fontSize: '12px' }}>
                                                                        {listing.format} • {listing.duration_hours}h
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <span className="badge badge-success">${listing.price}</span>
                                                                    {!listing.is_active && (
                                                                        <span className="badge badge-warning" style={{ marginLeft: '4px' }}>
                                                                            Inactive
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-muted" style={{ textAlign: 'center', padding: '16px' }}>
                                                        No listings yet
                                                    </p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Add Channel Modal */}
            {showAddChannel && (
                <AddChannelModal
                    onClose={() => setShowAddChannel(false)}
                    onSuccess={() => {
                        setShowAddChannel(false);
                        fetchChannels();
                    }}
                />
            )}

            {/* Create Listing Modal */}
            {showCreateListing && (
                <CreateListingModal
                    channel={showCreateListing}
                    onClose={() => setShowCreateListing(null)}
                    onSuccess={() => {
                        fetchChannelListings(showCreateListing.id);
                        setShowCreateListing(null);
                    }}
                />
            )}
        </div>
    );
}

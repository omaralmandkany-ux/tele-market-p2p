import { useState, useEffect } from 'react';
import { api, ListingWithChannel } from '../services/api';
import CreateDealModal from '../components/CreateDealModal';

export default function Marketplace() {
    const [listings, setListings] = useState<ListingWithChannel[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedListing, setSelectedListing] = useState<ListingWithChannel | null>(null);

    useEffect(() => {
        fetchListings();
    }, []);

    const fetchListings = async (searchTerm?: string) => {
        setLoading(true);
        const result = await api.getListings(searchTerm ? { search: searchTerm } : undefined);
        if (result.success && result.data) {
            setListings(result.data);
        }
        setLoading(false);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchListings(search);
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
                <h1 className="title">Marketplace</h1>
                <p className="text-muted" style={{ marginBottom: '24px' }}>
                    Find channels to advertise your products
                </p>

                {/* Search */}
                <form onSubmit={handleSearch} className="search-box">
                    <span className="search-icon">🔍</span>
                    <input
                        type="text"
                        className="search-input"
                        placeholder="Search channels..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </form>

                {/* Listings */}
                {loading ? (
                    <div className="loading">
                        <div className="spinner"></div>
                    </div>
                ) : listings.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-icon">📭</div>
                        <p>No listings found</p>
                        <p className="text-muted">Check back later for new opportunities</p>
                    </div>
                ) : (
                    <div className="listing-grid">
                        {listings.map((listing) => (
                            <div
                                key={listing.id}
                                className="card listing-card"
                                onClick={() => setSelectedListing(listing)}
                                style={{ cursor: 'pointer' }}
                            >
                                <div className="listing-image">
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
                                <div className="listing-info">
                                    <div className="listing-title">{listing.title}</div>
                                    <div className="listing-channel">
                                        @{listing.channel_username || listing.channel_title}
                                        <span className="verified-badge" style={{ marginLeft: '8px' }}>Verified</span>
                                    </div>
                                    <div className="listing-meta">
                                        <span>👥 {formatSubscribers(listing.channel_subscribers)}</span>
                                        <span>⏱️ {listing.duration_hours}h</span>
                                        <span>📝 {listing.format}</span>
                                    </div>
                                    <div style={{ marginTop: '8px' }}>
                                        <span className="listing-price">${listing.price}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Deal Modal */}
            {selectedListing && (
                <CreateDealModal
                    listing={selectedListing}
                    onClose={() => setSelectedListing(null)}
                    onSuccess={() => {
                        setSelectedListing(null);
                        window.Telegram?.WebApp?.showAlert('Deal request sent successfully!');
                    }}
                />
            )}
        </div>
    );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, UserStats } from '../services/api';
import { useUser } from '../hooks/useUser';

export default function Home() {
    const { user } = useUser();
    const [stats, setStats] = useState<UserStats | null>(null);

    useEffect(() => {
        const fetchStats = async () => {
            const result = await api.getMyStats();
            if (result.success && result.data) {
                setStats(result.data);
            }
        };
        fetchStats();
    }, []);

    return (
        <div className="page">
            <div className="container">
                {/* Welcome Section */}
                <div style={{ marginBottom: '32px', textAlign: 'center' }}>
                    <h1 className="title">Ad Marketplace</h1>
                    <p className="text-muted">
                        Welcome{user?.first_name ? `, ${user.first_name}` : ''}! 👋
                    </p>
                </div>

                {/* Stats */}
                {stats && (
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-value">${stats.balance.toFixed(2)}</div>
                            <div className="stat-label">Balance</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.channels}</div>
                            <div className="stat-label">Channels</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.completed_deals}</div>
                            <div className="stat-label">Completed Deals</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-value">{stats.deals_as_owner + stats.deals_as_advertiser}</div>
                            <div className="stat-label">Total Deals</div>
                        </div>
                    </div>
                )}

                {/* Quick Actions */}
                <div className="section">
                    <h2 className="section-title">Quick Actions</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <Link to="/marketplace" className="card" style={{ textDecoration: 'none' }}>
                            <div className="card-header">
                                <div className="card-avatar">🛒</div>
                                <div>
                                    <div className="card-title">Browse Marketplace</div>
                                    <div className="card-subtitle">Find channels to advertise on</div>
                                </div>
                            </div>
                        </Link>

                        <Link to="/channels" className="card" style={{ textDecoration: 'none' }}>
                            <div className="card-header">
                                <div className="card-avatar">📢</div>
                                <div>
                                    <div className="card-title">My Channels</div>
                                    <div className="card-subtitle">Register & manage your channels</div>
                                </div>
                            </div>
                        </Link>

                        <Link to="/deals" className="card" style={{ textDecoration: 'none' }}>
                            <div className="card-header">
                                <div className="card-avatar">🤝</div>
                                <div>
                                    <div className="card-title">Active Deals</div>
                                    <div className="card-subtitle">Track your escrow deals</div>
                                </div>
                            </div>
                        </Link>
                    </div>
                </div>

                {/* How It Works */}
                <div className="section">
                    <h2 className="section-title">How It Works</h2>
                    <div className="card">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                <span className="badge badge-primary">1</span>
                                <div>
                                    <strong>For Channel Owners</strong>
                                    <p className="text-muted" style={{ marginTop: '4px' }}>
                                        Register & verify your channel, create listings with your prices
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                <span className="badge badge-primary">2</span>
                                <div>
                                    <strong>For Advertisers</strong>
                                    <p className="text-muted" style={{ marginTop: '4px' }}>
                                        Browse channels, send ad requests with your content
                                    </p>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                <span className="badge badge-primary">3</span>
                                <div>
                                    <strong>Secure Escrow</strong>
                                    <p className="text-muted" style={{ marginTop: '4px' }}>
                                        Funds are held safely until the ad is verified
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

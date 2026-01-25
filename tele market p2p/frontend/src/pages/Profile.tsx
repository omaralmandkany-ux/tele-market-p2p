import { useState } from 'react';
import { api } from '../services/api';
import { useUser } from '../hooks/useUser';

export default function Profile() {
    const { user, setUser } = useUser();
    const [depositAmount, setDepositAmount] = useState('');
    const [depositing, setDepositing] = useState(false);

    const handleDeposit = async () => {
        const amount = parseFloat(depositAmount);
        if (isNaN(amount) || amount <= 0) {
            window.Telegram?.WebApp?.showAlert('Please enter a valid amount');
            return;
        }

        setDepositing(true);
        const result = await api.deposit(amount);

        if (result.success && result.data) {
            window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
            window.Telegram?.WebApp?.showAlert(`Successfully deposited $${amount}!`);

            // Update user balance
            if (user) {
                setUser({ ...user, balance: result.data.new_balance });
            }
            setDepositAmount('');
        } else {
            window.Telegram?.WebApp?.showAlert('Deposit failed');
        }

        setDepositing(false);
    };

    if (!user) {
        return (
            <div className="page">
                <div className="container">
                    <div className="loading">
                        <div className="spinner"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="container">
                {/* Profile Header */}
                <div className="card" style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <div
                        style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '50%',
                            background: 'var(--color-accent-gradient)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '32px',
                            margin: '0 auto 16px',
                        }}
                    >
                        {user.photo_url ? (
                            <img
                                src={user.photo_url}
                                alt={user.first_name || ''}
                                style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                            />
                        ) : (
                            '👤'
                        )}
                    </div>
                    <h2 style={{ marginBottom: '4px' }}>{user.first_name || 'User'}</h2>
                    <p className="text-muted">
                        {user.username ? `@${user.username}` : `ID: ${user.telegram_id}`}
                    </p>
                    {user.role === 'admin' && (
                        <span className="badge badge-primary" style={{ marginTop: '8px' }}>Admin</span>
                    )}
                </div>

                {/* Balance Card */}
                <div className="card" style={{ marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <span className="text-muted">Current Balance</span>
                        <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-success)' }}>
                            ${user.balance.toFixed(2)}
                        </span>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                            type="number"
                            className="form-input"
                            placeholder="Amount"
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(e.target.value)}
                            min="1"
                            step="0.01"
                        />
                        <button
                            className="btn btn-success"
                            onClick={handleDeposit}
                            disabled={depositing}
                            style={{ whiteSpace: 'nowrap' }}
                        >
                            {depositing ? '...' : 'Deposit'}
                        </button>
                    </div>
                    <p className="text-muted" style={{ fontSize: '11px', marginTop: '8px' }}>
                        💡 Demo mode: Deposits are simulated for testing
                    </p>
                </div>

                {/* Quick Stats */}
                <div className="section">
                    <h3 className="section-title">Account Info</h3>
                    <div className="card">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span className="text-muted">Member Since</span>
                                <span>{new Date(user.created_at).toLocaleDateString()}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span className="text-muted">Role</span>
                                <span style={{ textTransform: 'capitalize' }}>{user.role}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span className="text-muted">Telegram ID</span>
                                <span>{user.telegram_id}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Help */}
                <div className="section">
                    <h3 className="section-title">Help & Support</h3>
                    <div className="card">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <a href="#" className="text-muted" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>📖 How to use</span>
                                <span>→</span>
                            </a>
                            <a href="#" className="text-muted" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>❓ FAQ</span>
                                <span>→</span>
                            </a>
                            <a href="#" className="text-muted" style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>💬 Contact Support</span>
                                <span>→</span>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

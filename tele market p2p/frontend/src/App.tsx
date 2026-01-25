import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { api, User } from './services/api';

// Pages
import Home from './pages/Home';
import Marketplace from './pages/Marketplace';
import MyChannels from './pages/MyChannels';
import Deals from './pages/Deals';
import Profile from './pages/Profile';
import Campaigns from './pages/Campaigns';

// Context
import { UserContext } from './hooks/useUser';

function App() {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            const result = await api.getMe();
            if (result.success && result.data) {
                setUser(result.data);
            }
            setLoading(false);
        };
        fetchUser();
    }, []);

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
            </div>
        );
    }

    return (
        <UserContext.Provider value={{ user, setUser }}>
            <BrowserRouter>
                <div className="app">
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/marketplace" element={<Marketplace />} />
                        <Route path="/campaigns" element={<Campaigns />} />
                        <Route path="/channels" element={<MyChannels />} />
                        <Route path="/deals" element={<Deals />} />
                        <Route path="/profile" element={<Profile />} />
                    </Routes>

                    <nav className="nav">
                        <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">🏠</span>
                            <span>Home</span>
                        </NavLink>
                        <NavLink to="/marketplace" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">🛒</span>
                            <span>Market</span>
                        </NavLink>
                        <NavLink to="/campaigns" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">📢</span>
                            <span>Campaigns</span>
                        </NavLink>
                        <NavLink to="/deals" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">🤝</span>
                            <span>Deals</span>
                        </NavLink>
                        <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                            <span className="nav-icon">👤</span>
                            <span>Profile</span>
                        </NavLink>
                    </nav>
                </div>
            </BrowserRouter>
        </UserContext.Provider>
    );
}

export default App;

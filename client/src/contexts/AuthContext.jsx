import { createContext, useContext, useState, useCallback } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem('escrow_user');
            return saved ? JSON.parse(saved) : null;
        } catch { return null; }
    });

    const [token, setToken] = useState(() => localStorage.getItem('escrow_token'));

    const applySession = useCallback((data) => {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('escrow_token', data.token);
        localStorage.setItem('escrow_user', JSON.stringify(data.user));
    }, []);

    const login = useCallback(async (usernameOrSession, password) => {
        if (usernameOrSession && typeof usernameOrSession === 'object' && usernameOrSession.token && usernameOrSession.user) {
            applySession(usernameOrSession);
            return usernameOrSession.user;
        }

        const data = await api.login(usernameOrSession, password);
        applySession(data);
        return data.user;
    }, [applySession]);

    const logout = useCallback(async () => {
        try { await api.logout(); } catch { }
        setToken(null);
        setUser(null);
        localStorage.removeItem('escrow_token');
        localStorage.removeItem('escrow_user');
    }, []);

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}

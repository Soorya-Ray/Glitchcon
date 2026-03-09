import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const toast = useToast();

    async function handleSubmit(e) {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(username, password);
            toast('Welcome back!', 'success');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="login-screen">
            <div className="login-wrapper">
                <div className="login-card">
                    <div className="login-logo">
                        <div className="logo-icon">🔗</div>
                        <h1>EscrowChain</h1>
                        <p>Smart Contract Payment System</p>
                    </div>

                    <div className="demo-credentials">
                        <h4>🔑 Demo Credentials</h4>
                        <div className="cred-row"><span>Customer</span><span className="cred-role">customer1</span></div>
                        <div className="cred-row"><span>Supplier</span><span className="cred-role">supplier1</span></div>
                        <div className="cred-row"><span>Driver</span><span className="cred-role">driver1</span></div>
                        <div className="cred-row"><span>Admin</span><span className="cred-role">admin1</span></div>
                        <div className="cred-row" style={{ marginTop: '0.3rem', color: 'var(--text-muted)' }}>
                            <span>Password (all)</span><span className="cred-role">password123</span>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="login-username">Username</label>
                            <input
                                type="text" id="login-username" className="form-input"
                                placeholder="Enter username" required autoComplete="username"
                                value={username} onChange={e => setUsername(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="login-password">Password</label>
                            <input
                                type="password" id="login-password" className="form-input"
                                placeholder="Enter password" required autoComplete="current-password"
                                value={password} onChange={e => setPassword(e.target.value)}
                            />
                        </div>
                        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>
                    {error && <p style={{ color: 'var(--accent-rose)', fontSize: '0.82rem', textAlign: 'center', marginTop: '0.5rem' }}>{error}</p>}
                </div>
            </div>
        </div>
    );
}

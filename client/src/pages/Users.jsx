import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import api from '../api';

export default function Users() {
    const { user } = useAuth();
    const toast = useToast();
    const [usersData, setUsersData] = useState({ users: [], stats: {} });
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newUser, setNewUser] = useState({ username: '', password: '', name: '', role: 'customer', email: '' });

    useEffect(() => { loadUsers(); }, []);

    async function loadUsers() {
        try {
            setLoading(true);
            const data = await api.getUsers();
            setUsersData(data);
        } catch (err) {
            toast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    }

    async function handlePromote(id) {
        try {
            await api.promoteUser(id);
            toast('User promoted to admin', 'success');
            loadUsers();
        } catch (err) { toast(err.message, 'error'); }
    }

    async function handleDemote(id) {
        try {
            await api.demoteUser(id, 'customer');
            toast('User demoted', 'success');
            loadUsers();
        } catch (err) { toast(err.message, 'error'); }
    }

    async function handleDelete(id) {
        if (!confirm('Are you sure you want to delete this user?')) return;
        try {
            await api.deleteUser(id);
            toast('User deleted', 'success');
            loadUsers();
        } catch (err) { toast(err.message, 'error'); }
    }

    async function handleAddUser(e) {
        e.preventDefault();
        try {
            await api.register(newUser);
            toast('User created', 'success');
            setShowAddModal(false);
            setNewUser({ username: '', password: '', name: '', role: 'customer', email: '' });
            loadUsers();
        } catch (err) { toast(err.message, 'error'); }
    }

    if (user?.role !== 'admin') {
        return <div className="empty-state"><div className="empty-icon">🔒</div><h3>Admin Only</h3><p>This section is restricted to administrators.</p></div>;
    }

    const { stats = {} } = usersData;
    const filtered = (usersData.users || []).filter(u => {
        if (filter === 'all') return true;
        if (filter === 'active') return u.is_active === 1;
        return u.role === filter;
    });

    return (
        <div className="fade-in">
            <div className="stats-grid">
                <div className="stat-card slide-up"><div className="stat-icon indigo">👥</div><div className="stat-value">{stats.totalUsers || 0}</div><div className="stat-label">Total Users</div></div>
                <div className="stat-card slide-up" style={{ animationDelay: '80ms' }}><div className="stat-icon emerald">🟢</div><div className="stat-value">{stats.activeUsers || 0}</div><div className="stat-label">Active Now</div></div>
                <div className="stat-card slide-up" style={{ animationDelay: '160ms' }}><div className="stat-icon amber">👑</div><div className="stat-value">{stats.adminCount || 0}</div><div className="stat-label">Admins</div></div>
                <div className="stat-card slide-up" style={{ animationDelay: '240ms' }}><div className="stat-icon cyan">🚚</div><div className="stat-value">{stats.roleBreakdown?.driver || 0}</div><div className="stat-label">Drivers</div></div>
            </div>

            <div className="section">
                <div className="section-header">
                    <h2>👥 User Management</h2>
                    <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>+ Add User</button>
                </div>

                <div className="tab-bar">
                    {['all', 'active', 'admin', 'customer', 'driver', 'supplier'].map(f => (
                        <button key={f} className={`tab-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                            {f.charAt(0).toUpperCase() + f.slice(1)}{f === 'all' ? ' Users' : f === 'active' ? ' Now' : 's'}
                        </button>
                    ))}
                </div>

                {loading ? (
                    <div><div className="spinner" /><p className="loading-text">Loading users...</p></div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="users-table">
                            <thead>
                                <tr><th>User</th><th>Role</th><th>Email</th><th>Rep Score</th><th>Status</th><th>Actions</th></tr>
                            </thead>
                            <tbody>
                                {filtered.map(u => (
                                    <tr key={u.id}>
                                        <td>
                                            <div className="user-name-cell">
                                                <div className="avatar" style={{ width: 28, height: 28, fontSize: '0.72rem' }}>{u.name?.charAt(0)}</div>
                                                <div><div style={{ fontWeight: 600, fontSize: '0.82rem' }}>{u.name}</div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>@{u.username}</div></div>
                                            </div>
                                        </td>
                                        <td><span className={`role-tag ${u.role}`}>{u.role}</span></td>
                                        <td style={{ fontSize: '0.82rem' }}>{u.email || '—'}</td>
                                        <td style={{ fontSize: '0.82rem', fontWeight: 600 }}>{u.reputation_score?.toFixed(1) || '5.0'}</td>
                                        <td><span style={{ color: u.is_active ? 'var(--accent-emerald)' : 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 600 }}>{u.is_active ? '● Online' : '○ Offline'}</span></td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                                                {u.role !== 'admin' && <button className="btn btn-outline btn-xs" onClick={() => handlePromote(u.id)}>👑 Promote</button>}
                                                {u.role === 'admin' && u.id !== user.id && <button className="btn btn-outline btn-xs" onClick={() => handleDemote(u.id)}>⬇ Demote</button>}
                                                {u.id !== user.id && <button className="btn btn-danger btn-xs" onClick={() => handleDelete(u.id)}>✕</button>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showAddModal && (
                <Modal title="Add New User" onClose={() => setShowAddModal(false)} footer={
                    <><button className="btn btn-outline" onClick={() => setShowAddModal(false)}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleAddUser}>👤 Create User</button></>
                }>
                    <form onSubmit={handleAddUser}>
                        <div className="form-group"><label>Username</label><input className="form-input" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} required /></div>
                        <div className="form-group"><label>Password</label><input className="form-input" type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} required /></div>
                        <div className="form-group"><label>Full Name</label><input className="form-input" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} required /></div>
                        <div className="form-group"><label>Email</label><input className="form-input" type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} /></div>
                        <div className="form-group"><label>Role</label>
                            <select className="form-input" value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}>
                                <option value="customer">Customer</option><option value="supplier">Supplier</option><option value="driver">Driver</option><option value="admin">Admin</option>
                            </select>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}

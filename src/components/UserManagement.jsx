import React, { useState, useEffect } from 'react';
import { api } from '../services/api';

const ROLES = [
    { value: 'admin', label: 'Admin' },
    { value: 'bc_sales', label: 'BC Sales' },
    { value: 'sask_sales', label: 'Sask Sales' },
    { value: 'analyst', label: 'Analyst' }
];

const REGIONS = [
    { value: 'National', label: 'National' },
    { value: 'BC', label: 'BC' },
    { value: 'Alberta', label: 'Alberta' },
    { value: 'Saskatchewan', label: 'Saskatchewan' },
    { value: 'Manitoba', label: 'Manitoba' }
];

const formatRole = (role) => ROLES.find(r => r.value === role)?.label || role;

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        username: '',
        password: '',
        role: 'analyst',
        region: 'National'
    });

    const loadUsers = async () => {
        try {
            setLoading(true);
            setError('');
            const data = await api.fetchUsers();
            if (data) setUsers(data);
        } catch (e) {
            setError(e.message || 'Failed to load users');
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadUsers(); }, []);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.username.trim()) {
            setError('Username is required');
            return;
        }
        if (!form.password) {
            setError('Password is required');
            return;
        }
        try {
            await api.createUser({
                username: form.username.trim(),
                password: form.password,
                role: form.role,
                region: form.region === 'National' ? null : form.region
            });
            setForm({ username: '', password: '', role: 'analyst', region: 'National' });
            setShowForm(false);
            await loadUsers();
        } catch (e) {
            setError(e.message || 'Failed to create user');
        }
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '900px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>User Management</h2>

            {error && (
                <div style={{
                    backgroundColor: '#fee2e2', color: '#b91c1c', padding: '0.75rem',
                    borderRadius: '4px', marginBottom: '1rem', fontSize: '0.9rem'
                }}>{error}</div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ color: '#3363AF', fontSize: '0.9rem' }}>
                    {users.length} user{users.length !== 1 ? 's' : ''}
                </span>
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => { setShowForm(!showForm); setError(''); }}
                >
                    {showForm ? 'Cancel' : 'Create User'}
                </button>
            </div>

            {showForm && (
                <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Create User</h3>
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Username</label>
                            <input
                                type="text"
                                name="username"
                                value={form.username}
                                onChange={handleChange}
                                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
                                placeholder="e.g. jsmith"
                                autoComplete="off"
                            />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Password</label>
                            <input
                                type="password"
                                name="password"
                                value={form.password}
                                onChange={handleChange}
                                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
                                autoComplete="new-password"
                            />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Role</label>
                            <select
                                name="role"
                                value={form.role}
                                onChange={handleChange}
                                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
                            >
                                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Region</label>
                            <select
                                name="region"
                                value={form.region}
                                onChange={handleChange}
                                style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' }}
                            >
                                {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>
                        <button type="submit" className="btn btn-primary">Create User</button>
                    </form>
                </div>
            )}

            <div className="card" style={{ overflow: 'hidden', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#3363AF' }}>Loading users...</div>
                ) : users.length === 0 ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: '#3363AF' }}>No users found.</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.85rem' }}>Username</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.85rem' }}>Role</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.85rem' }}>Region</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.85rem' }}>Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                                    <td style={{ padding: '0.75rem 1rem' }}>{u.username}</td>
                                    <td style={{ padding: '0.75rem 1rem' }}>{formatRole(u.role)}</td>
                                    <td style={{ padding: '0.75rem 1rem' }}>{u.region || '—'}</td>
                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#3363AF' }}>
                                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default UserManagement;

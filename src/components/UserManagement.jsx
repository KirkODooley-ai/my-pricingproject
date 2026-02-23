import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { PERMISSIONS, PERMISSION_LABELS } from '../constants/permissions';

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

const ALL_PERMISSION_KEYS = Object.values(PERMISSIONS);

const formatRole = (role) => ROLES.find(r => r.value === role)?.label || role;

const UserManagement = () => {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [form, setForm] = useState({
        username: '',
        password: '',
        role: 'analyst',
        region: 'National',
        permissions: [],
        isActive: true
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
        const { name, value, type, checked } = e.target;
        setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handlePermissionToggle = (perm) => {
        setForm(prev => {
            const perms = prev.permissions.includes(perm)
                ? prev.permissions.filter(p => p !== perm)
                : [...prev.permissions, perm];
            return { ...prev, permissions: perms };
        });
    };

    const openEdit = (u) => {
        setEditingUser(u);
        setForm({
            username: u.username,
            password: '',
            role: u.role,
            region: u.region || 'National',
            permissions: Array.isArray(u.permissions) ? [...u.permissions] : [],
            isActive: u.isActive !== false
        });
        setError('');
    };

    const closeEdit = () => {
        setEditingUser(null);
        setForm({ username: '', password: '', role: 'analyst', region: 'National', permissions: [], isActive: true });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.username.trim()) {
            setError('Username is required');
            return;
        }
        if (!editingUser && !form.password) {
            setError('Password is required');
            return;
        }
        try {
            if (editingUser) {
                const payload = {
                    username: form.username.trim(),
                    role: form.role,
                    region: form.region === 'National' ? null : form.region,
                    permissions: form.permissions,
                    isActive: form.isActive
                };
                if (form.password) payload.password = form.password;
                await api.updateUser(editingUser.id, payload);
                closeEdit();
            } else {
                await api.createUser({
                    username: form.username.trim(),
                    password: form.password,
                    role: form.role,
                    region: form.region === 'National' ? null : form.region
                });
                setForm({ username: '', password: '', role: 'analyst', region: 'National' });
                setShowForm(false);
            }
            await loadUsers();
        } catch (e) {
            setError(e.message || (editingUser ? 'Failed to update user' : 'Failed to create user'));
        }
    };

    const handleDeactivate = async (u) => {
        setError('');
        try {
            await api.updateUser(u.id, { isActive: !u.isActive });
            await loadUsers();
            if (editingUser?.id === u.id) {
                setForm(prev => ({ ...prev, isActive: !u.isActive }));
            }
        } catch (e) {
            setError(e.message || 'Failed to update user status');
        }
    };

    const handleDelete = async (u) => {
        if (deleteConfirm !== u.id) {
            setDeleteConfirm(u.id);
            return;
        }
        setError('');
        try {
            await api.deleteUser(u.id);
            setDeleteConfirm(null);
            if (editingUser?.id === u.id) closeEdit();
            await loadUsers();
        } catch (e) {
            setError(e.message || 'Failed to delete user');
        }
    };

    const cardStyle = { padding: '1.5rem', marginBottom: '1.5rem', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' };
    const inputStyle = { width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: '4px' };
    const labelStyle = { display: 'block', marginBottom: '0.5rem', fontWeight: 500 };

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
                    onClick={() => { setShowForm(!showForm); setError(''); setEditingUser(null); }}
                    disabled={!!editingUser}
                >
                    {showForm ? 'Cancel' : 'Create User'}
                </button>
            </div>

            {showForm && !editingUser && (
                <div className="card" style={cardStyle}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Create User</h3>
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={labelStyle}>Username</label>
                            <input type="text" name="username" value={form.username} onChange={handleChange}
                                style={inputStyle} placeholder="e.g. jsmith" autoComplete="off" />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={labelStyle}>Password</label>
                            <input type="password" name="password" value={form.password} onChange={handleChange}
                                style={inputStyle} autoComplete="new-password" />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={labelStyle}>Role</label>
                            <select name="role" value={form.role} onChange={handleChange} style={inputStyle}>
                                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={labelStyle}>Region</label>
                            <select name="region" value={form.region} onChange={handleChange} style={inputStyle}>
                                {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>
                        <button type="submit" className="btn btn-primary">Create User</button>
                    </form>
                </div>
            )}

            {(editingUser || deleteConfirm) && (
                <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#fef3c7', borderRadius: '4px', fontSize: '0.9rem' }}>
                    {deleteConfirm && (
                        <span>Click Delete again on the user to confirm permanent deletion. </span>
                    )}
                    {editingUser && <span>Editing: {editingUser.username}</span>}
                </div>
            )}

            {editingUser && (
                <div className="card" style={cardStyle}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Edit User</h3>
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={labelStyle}>Username</label>
                            <input type="text" name="username" value={form.username} onChange={handleChange}
                                style={inputStyle} autoComplete="off" />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={labelStyle}>New Password <span style={{ color: '#6b7280', fontWeight: 400 }}>(leave blank to keep current)</span></label>
                            <input type="password" name="password" value={form.password} onChange={handleChange}
                                style={inputStyle} autoComplete="new-password" />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={labelStyle}>Role</label>
                            <select name="role" value={form.role} onChange={handleChange} style={inputStyle}>
                                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={labelStyle}>Region</label>
                            <select name="region" value={form.region} onChange={handleChange} style={inputStyle}>
                                {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                            </select>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={labelStyle}>Additional Permissions</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.5rem' }}>
                                {ALL_PERMISSION_KEYS.map(perm => (
                                    <label key={perm} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                                        <input type="checkbox" checked={form.permissions.includes(perm)}
                                            onChange={() => handlePermissionToggle(perm)} />
                                        {PERMISSION_LABELS[perm] || perm}
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} />
                                <span>Active (can log in)</span>
                            </label>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button type="submit" className="btn btn-primary">Save Changes</button>
                            <button type="button" className="btn" style={{ backgroundColor: '#e5e7eb' }} onClick={closeEdit}>Cancel</button>
                        </div>
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
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.85rem' }}>Status</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.85rem' }}>Created</th>
                                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: 600, fontSize: '0.85rem' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id} style={{ borderBottom: '1px solid #e5e7eb', opacity: u.isActive === false ? 0.65 : 1 }}>
                                    <td style={{ padding: '0.75rem 1rem' }}>{u.username}</td>
                                    <td style={{ padding: '0.75rem 1rem' }}>{formatRole(u.role)}</td>
                                    <td style={{ padding: '0.75rem 1rem' }}>{u.region || '—'}</td>
                                    <td style={{ padding: '0.75rem 1rem' }}>
                                        <span style={{ color: u.isActive !== false ? '#059669' : '#b91c1c', fontSize: '0.85rem' }}>
                                            {u.isActive !== false ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', fontSize: '0.9rem', color: '#3363AF' }}>
                                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                                    </td>
                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                        <button type="button" className="btn" style={{ fontSize: '0.85rem', padding: '0.25rem 0.5rem', marginRight: '0.25rem' }}
                                            onClick={() => openEdit(u)}>Edit</button>
                                        <button type="button" className="btn" style={{ fontSize: '0.85rem', padding: '0.25rem 0.5rem', marginRight: '0.25rem', backgroundColor: u.isActive !== false ? '#fef3c7' : '#d1fae5' }}
                                            onClick={() => handleDeactivate(u)}>
                                            {u.isActive !== false ? 'Deactivate' : 'Activate'}
                                        </button>
                                        <button type="button" className="btn" style={{ fontSize: '0.85rem', padding: '0.25rem 0.5rem', backgroundColor: deleteConfirm === u.id ? '#dc2626' : '#fee2e2', color: deleteConfirm === u.id ? 'white' : '#b91c1c' }}
                                            onClick={() => handleDelete(u)} disabled={currentUser?.id === u.id}>
                                            {deleteConfirm === u.id ? 'Confirm Delete' : 'Delete'}
                                        </button>
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

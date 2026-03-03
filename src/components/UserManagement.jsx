import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { PERMISSIONS, PERMISSION_LABELS, hasPermission } from '../constants/permissions';

const ROLES = [
    { value: 'admin', label: 'Admin' },
    { value: 'product_manager', label: 'Product Manager' },
    { value: 'outside_sales', label: 'Outside Sales' },
    { value: 'sales_manager', label: 'Sales Manager' },
    { value: 'sales_support', label: 'Sales Support' },
    { value: 'analyst', label: 'Analyst' }
];

const REGIONS = [
    { value: 'National', label: 'National' },
    { value: 'BC', label: 'BC' },
    { value: 'AB', label: 'AB' },
    { value: 'SK', label: 'SK' },
    { value: 'MB', label: 'MB' },
    { value: 'ON', label: 'ON' },
    { value: 'Other', label: 'Other' }
];

const SALES_REGIONS = [
    { value: '', label: '— None —' },
    { value: 'BC', label: 'BC' },
    { value: 'AB', label: 'AB' },
    { value: 'SK', label: 'SK' },
    { value: 'MB', label: 'MB' },
    { value: 'ON', label: 'ON' },
    { value: 'Other', label: 'Other' }
];

const ALL_PERMISSION_KEYS = Object.values(PERMISSIONS);

const formatRole = (role) => ROLES.find(r => r.value === role)?.label || role;

const UserManagement = () => {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        username: '',
        password: '',
        role: 'analyst',
        region: 'National',
        region1: '',
        region2: '',
        permissions: [],
        isActive: true,
        canEdit: false
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

    useEffect(() => {
        if (successMsg) {
            const t = setTimeout(() => setSuccessMsg(''), 6000);
            return () => clearTimeout(t);
        }
    }, [successMsg]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handlePermissionToggle = (perm) => {
        setForm(prev => {
            const current = Array.isArray(prev.permissions) ? prev.permissions : [];
            const perms = current.includes(perm)
                ? current.filter(p => p !== perm)
                : [...current, perm];
            return { ...prev, permissions: perms };
        });
    };

    const openEdit = (u) => {
        setSuccessMsg('');
        setEditingUser(u);
        const regions = Array.isArray(u.regions) ? u.regions : (u.region ? [u.region] : []);
        setForm({
            username: u.username,
            password: '',
            role: u.role,
            region: u.region || 'National',
            region1: regions[0] || '',
            region2: regions[1] || '',
            permissions: Array.isArray(u.permissions) ? [...u.permissions] : [],
            isActive: u.isActive !== false,
            canEdit: u.role === 'admin' || u.canEdit === true
        });
        setError('');
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const closeEdit = () => {
        setEditingUser(null);
        setShowForm(false);
        setForm({ username: '', password: '', role: 'analyst', region: 'National', region1: '', region2: '', permissions: [], isActive: true, canEdit: false });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMsg('');
        if (!form.username.trim()) {
            setError('Username is required');
            return;
        }
        if (!editingUser && !form.password) {
            setError('Password is required');
            return;
        }
        setSaving(true);
        try {
            if (editingUser) {
                const perms = Array.isArray(form.permissions) ? form.permissions : [];
                const regions = [form.region1, form.region2].filter(Boolean);
                const payload = {
                    username: form.username.trim(),
                    role: form.role,
                    region: form.region === 'National' ? null : form.region,
                    regions,
                    permissions: perms,
                    isActive: form.isActive,
                    canEdit: form.canEdit
                };
                if (form.password) payload.password = form.password;
                await api.updateUser(editingUser.id, payload);
                closeEdit();
                setSuccessMsg('Permissions updated. User must log out and log back in to see changes.');
            } else {
                const perms = Array.isArray(form.permissions) ? form.permissions : [];
                const regions = [form.region1, form.region2].filter(Boolean);
                await api.createUser({
                    username: form.username.trim(),
                    password: form.password,
                    role: form.role,
                    region: form.region === 'National' ? null : form.region,
                    regions,
                    permissions: perms,
                    canEdit: form.canEdit
                });
                setForm({ username: '', password: '', role: 'analyst', region: 'National', region1: '', region2: '', permissions: [], canEdit: false });
                setShowForm(false);
                setSuccessMsg('User created. They can log in with their new permissions.');
            }
            await loadUsers();
        } catch (e) {
            setError(e.message || (editingUser ? 'Failed to update user' : 'Failed to create user'));
        } finally {
            setSaving(false);
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
            // Auto reset delete confirmation after 3 seconds
            setTimeout(() => setDeleteConfirm(null), 3000);
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

    const canManageUsers = currentUser?.role === 'admin' || hasPermission(currentUser?.permissions, PERMISSIONS.MANAGE_USERS);

    // Premium SaaS UI Variables
    const styles = {
        pageWrapper: { width: '100%', minHeight: '100%' },
        container: { maxWidth: '1200px', margin: '0 auto', padding: '2.5rem', width: '100%', fontFamily: 'var(--font-base)' },
        headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' },
        headerText: { fontSize: '1.85rem', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.02em', margin: '0 0 0.5rem 0' },
        subText: { color: '#64748b', fontSize: '1.05rem', margin: 0 },
        
        card: { backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.03)', border: '1px solid rgba(15, 23, 42, 0.08)', padding: '2rem', marginBottom: '2rem' },
        tableContainer: { backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.03)', border: '1px solid rgba(15, 23, 42, 0.08)', overflow: 'hidden' },
        
        inputField: { padding: '0.65rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem', color: '#0f172a', width: '100%', backgroundColor: '#ffffff', transition: 'border-color 0.2s', outline: 'none' },
        label: { display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
        
        primaryBtn: { backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.65rem 1.25rem', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', boxShadow: '0 1px 3px rgba(37,99,235,0.2)', transition: 'background-color 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' },
        outlineBtn: { backgroundColor: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.65rem 1.25rem', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s' },
        dangerBtn: { backgroundColor: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: '6px', padding: '0.4rem 0.8rem', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s' },
        dangerBtnConfirm: { backgroundColor: '#dc2626', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.4rem 0.8rem', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s' },
        actionBtn: { backgroundColor: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '6px', padding: '0.4rem 0.8rem', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s' },
        
        table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
        th: { padding: '1.25rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' },
        td: { padding: '1rem 1.5rem', fontSize: '0.95rem', color: '#0f172a', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
        
        badgeActive: { backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '0.25rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center' },
        badgeInactive: { backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', padding: '0.25rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center' },
        roleBadge: { backgroundColor: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: '500' }
    };

    return (
        <div style={styles.pageWrapper}>
            <div style={styles.container}>
                {/* Header Profile */}
                <div style={styles.headerRow}>
                    <div>
                        <h2 style={styles.headerText}>User Management</h2>
                        <p style={styles.subText}>Manage system access, roles, and regional permissions.</p>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#f8fafc', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <span style={{ fontSize: '1.2rem' }}>👥</span>
                            <div>
                                <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', fontWeight: '600', textTransform: 'uppercase' }}>Total Users</span>
                                <span style={{ display: 'block', fontSize: '1.1rem', color: '#0f172a', fontWeight: '700' }}>{users.length}</span>
                            </div>
                        </div>

                        {canManageUsers && (
                            <button
                                style={showForm && !editingUser ? styles.outlineBtn : styles.primaryBtn}
                                onClick={() => { 
                                    if (editingUser) {
                                        closeEdit();
                                    } else {
                                        if (!showForm) {
                                            setForm({ username: '', password: '', role: 'analyst', region: 'National', region1: '', region2: '', permissions: [], isActive: true, canEdit: false });
                                            setSuccessMsg('');
                                        }
                                        setShowForm(!showForm); 
                                    }
                                    setError(''); 
                                }}
                            >
                                <span style={{ fontSize: '1.1rem' }}>{showForm && !editingUser ? '✕' : '＋'}</span> 
                                {showForm && !editingUser ? 'Cancel' : 'Add New User'}
                            </button>
                        )}
                    </div>
                </div>

                {error && (
                    <div style={{ backgroundColor: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', padding: '1rem', borderRadius: '0 8px 8px 0', marginBottom: '2rem', fontSize: '0.95rem', alignItems: 'center', display: 'flex', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.2rem' }}>⚠️</span> {error}
                    </div>
                )}
                {successMsg && (
                    <div style={{ backgroundColor: '#ecfdf5', borderLeft: '4px solid #10b981', color: '#065f46', padding: '1rem', borderRadius: '0 8px 8px 0', marginBottom: '2rem', fontSize: '0.95rem', display: 'flex', gap: '0.5rem' }}>
                        <span style={{ fontSize: '1.2rem' }}>✓</span> {successMsg}
                    </div>
                )}

                {/* Create / Edit Form */}
                {showForm && (
                    <div style={{...styles.card, borderTop: `4px solid ${editingUser ? '#f59e0b' : '#3b82f6'}`}}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid #f1f5f9' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span>{editingUser ? '✏️' : '👤'}</span> {editingUser ? `Edit Profile: ${editingUser.username}` : 'Register New User'}
                            </h3>
                            {editingUser && (
                                <button onClick={closeEdit} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
                            )}
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                <div>
                                    <label style={styles.label}>Username / Login ID</label>
                                    <input type="text" name="username" value={form.username} onChange={handleChange} style={styles.inputField} placeholder="e.g. jsmith" autoComplete="off" />
                                </div>
                                <div>
                                    <label style={styles.label}>Password {editingUser && <span style={{ color: '#94a3b8', fontWeight: '400', textTransform: 'none', letterSpacing: '0' }}>(Leave blank to keep current)</span>}</label>
                                    <input type="password" name="password" value={form.password} onChange={handleChange} style={styles.inputField} placeholder={editingUser ? "••••••••" : "Create a strong password"} autoComplete="new-password" />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                                <div>
                                    <label style={styles.label}>System Role</label>
                                    <select name="role" value={form.role} onChange={handleChange} style={styles.inputField}>
                                        {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={styles.label}>Territory / Region</label>
                                    <select name="region" value={form.region} onChange={handleChange} style={styles.inputField}>
                                        {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                                <div>
                                    <label style={styles.label}>Region 1 (Sales)</label>
                                    <select name="region1" value={form.region1} onChange={handleChange} style={styles.inputField}>
                                        {SALES_REGIONS.map(r => <option key={r.value || 'none'} value={r.value}>{r.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label style={styles.label}>Region 2 (Sales)</label>
                                    <select name="region2" value={form.region2} onChange={handleChange} style={styles.inputField}>
                                        {SALES_REGIONS.map(r => <option key={r.value || 'none'} value={r.value}>{r.label}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{ marginBottom: '2rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: form.role === 'admin' ? 'default' : 'pointer', padding: '1rem', backgroundColor: form.canEdit ? '#ecfdf5' : '#f8fafc', border: `1px solid ${form.canEdit ? '#a7f3d0' : '#e2e8f0'}`, borderRadius: '8px', opacity: form.role === 'admin' ? 0.8 : 1 }}>
                                    <input 
                                        type="checkbox" 
                                        name="canEdit" 
                                        checked={form.role === 'admin' ? true : form.canEdit} 
                                        onChange={handleChange} 
                                        disabled={form.role === 'admin'}
                                        style={{ width: '1.2rem', height: '1.2rem', cursor: form.role === 'admin' ? 'default' : 'pointer' }}
                                    />
                                    <div>
                                        <span style={{ display: 'block', fontWeight: '600', color: '#0f172a', fontSize: '0.95rem' }}>Can Edit Data</span>
                                        <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b' }}>
                                            {form.role === 'admin' ? 'Admins always have edit access.' : 'Allow user to add, edit, delete, and import data.'}
                                        </span>
                                    </div>
                                </label>
                            </div>

                            <div style={{ backgroundColor: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
                                <label style={{...styles.label, marginBottom: '1rem'}}>Granular Permissions</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
                                    {ALL_PERMISSION_KEYS.map(perm => {
                                        const permList = Array.isArray(form.permissions) ? form.permissions : [];
                                        const isChecked = permList.includes(perm);
                                        return (
                                            <label
                                                key={perm}
                                                style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', fontSize: '0.95rem', color: '#334155' }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    value={perm}
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        handlePermissionToggle(perm);
                                                    }}
                                                    style={{ width: '1.1rem', height: '1.1rem', marginTop: '0.1rem', cursor: 'pointer', flexShrink: 0 }}
                                                />
                                                <span style={{ fontWeight: isChecked ? '600' : '400' }}>
                                                    {PERMISSION_LABELS[perm] || perm}
                                                </span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {editingUser && (
                                <div style={{ marginBottom: '2rem' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '1rem', backgroundColor: form.isActive ? '#ecfdf5' : '#f1f5f9', border: `1px solid ${form.isActive ? '#a7f3d0' : '#cbd5e1'}`, borderRadius: '8px' }}>
                                        <input 
                                            type="checkbox" 
                                            name="isActive" 
                                            checked={form.isActive} 
                                            onChange={handleChange} 
                                            style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }}
                                        />
                                        <div>
                                            <span style={{ display: 'block', fontWeight: '600', color: '#0f172a', fontSize: '0.95rem' }}>Account Active</span>
                                            <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b' }}>If unchecked, user will be unable to log in to the system.</span>
                                        </div>
                                    </label>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
                                <button type="submit" style={{...styles.primaryBtn, width: '200px', display: 'flex', justifyContent: 'center'}} disabled={saving}>
                                    {saving ? '⏳ Saving...' : (editingUser ? '💾 Save Changes' : '✓ Create Account')}
                                </button>
                                {editingUser && (
                                    <button type="button" style={styles.outlineBtn} onClick={closeEdit} disabled={saving} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}>Cancel</button>
                                )}
                            </div>
                        </form>
                    </div>
                )}

                {/* Users List Data Table */}
                <div style={styles.tableContainer}>
                    {loading ? (
                        <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#64748b' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '1rem', animation: 'spin 2s linear infinite' }}>⏳</div>
                            Loading user directory...
                        </div>
                    ) : users.length === 0 ? (
                        <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#64748b' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>👥</div>
                            <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#0f172a', marginBottom: '0.5rem' }}>No Users Registered</h3>
                            <p style={{ margin: 0 }}>Create the system's first user to get started.</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={styles.table}>
                                <thead>
                                    <tr>
                                        <th style={styles.th}>Authorized User</th>
                                        <th style={styles.th}>System Role</th>
                                        <th style={styles.th}>Regions</th>
                                        <th style={styles.th}>Permissions</th>
                                        <th style={styles.th}>Territory</th>
                                        <th style={styles.th}>Access Status</th>
                                        <th style={styles.th}>Registration Date</th>
                                        {canManageUsers && <th style={{...styles.th, textAlign: 'right'}}>Management</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => {
                                        const isInactive = u.isActive === false;
                                        return (
                                            <tr key={u.id} style={{ transition: 'background-color 0.2s', backgroundColor: isInactive ? '#fafaf9' : 'transparent', opacity: isInactive ? 0.8 : 1 }}>
                                                <td style={{...styles.td, fontWeight: '600'}}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontWeight: '700', fontSize: '0.8rem' }}>
                                                            {u.username.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <span style={{ color: isInactive ? '#94a3b8' : '#0f172a' }}>{u.username}</span>
                                                        {currentUser?.id === u.id && <span style={{ fontSize: '0.7rem', backgroundColor: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontWeight: '600' }}>YOU</span>}
                                                    </div>
                                                </td>
                                                <td style={styles.td}>
                                                    <span style={styles.roleBadge}>{formatRole(u.role)}</span>
                                                </td>
                                                <td style={{...styles.td, fontSize: '0.8rem'}}>
                                                    {Array.isArray(u.regions) && u.regions.length > 0 ? (
                                                        <span style={{ color: '#475569' }}>{u.regions.join(', ')}</span>
                                                    ) : u.region ? (
                                                        <span style={{ color: '#475569' }}>{u.region}</span>
                                                    ) : (
                                                        <span style={{ color: '#94a3b8' }}>—</span>
                                                    )}
                                                </td>
                                                <td style={{...styles.td, fontSize: '0.8rem', maxWidth: '200px'}}>
                                                    {Array.isArray(u.permissions) && u.permissions.length > 0 ? (
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                            {u.permissions.map(p => (
                                                                <span key={p} style={{ backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem' }}>
                                                                    {PERMISSION_LABELS[p] || p}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: '#94a3b8' }}>—</span>
                                                    )}
                                                </td>
                                                <td style={{...styles.td, color: '#475569', fontWeight: '500'}}>
                                                    {u.region || <span style={{ color: '#cbd5e1' }}>Global</span>}
                                                </td>
                                                <td style={styles.td}>
                                                    <span style={!isInactive ? styles.badgeActive : styles.badgeInactive}>
                                                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: !isInactive ? '#10b981' : '#94a3b8', marginRight: '6px' }}></span>
                                                        {!isInactive ? 'Active' : 'Suspended'}
                                                    </span>
                                                </td>
                                                <td style={{...styles.td, fontSize: '0.85rem', color: '#64748b'}}>
                                                    {u.createdAt ? new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(u.createdAt)) : 'Legacy'}
                                                </td>
                                                
                                                {canManageUsers && (
                                                    <td style={{...styles.td, textAlign: 'right'}}>
                                                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', alignItems: 'center' }}>
                                                            <button 
                                                                title="Edit user profile"
                                                                style={styles.actionBtn} 
                                                                onClick={() => openEdit(u)}
                                                                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0'; }}
                                                                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                                                            >
                                                                Edit
                                                            </button>
                                                            
                                                            <button 
                                                                title={!isInactive ? "Suspend account access" : "Restore account access"}
                                                                style={{...styles.actionBtn, backgroundColor: !isInactive ? '#fffbeb' : '#ecfdf5', color: !isInactive ? '#b45309' : '#059669'}} 
                                                                onClick={() => handleDeactivate(u)}
                                                                disabled={currentUser?.id === u.id}
                                                            >
                                                                {!isInactive ? 'Suspend' : 'Activate'}
                                                            </button>
                                                            
                                                            <button 
                                                                title="Permanently delete user"
                                                                style={deleteConfirm === u.id ? styles.dangerBtnConfirm : styles.dangerBtn} 
                                                                onClick={() => handleDelete(u)} 
                                                                disabled={currentUser?.id === u.id}
                                                            >
                                                                {deleteConfirm === u.id ? 'Confirm?' : 'Delete'}
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserManagement;

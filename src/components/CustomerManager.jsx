import React, { useState } from 'react';
import { calculateTier, formatCurrency, CUSTOMER_GROUPS } from '../utils/pricingEngine';
import { useAuth } from '../contexts/AuthContext';

const getTierBadgeStyles = (tierName) => {
    const name = (tierName || '').toLowerCase();
    if (name.includes('obsidian')) return { backgroundColor: '#1e293b', color: '#f8fafc', border: '1px solid #0f172a' };
    if (name.includes('platinum')) return { backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
    if (name.includes('diamond')) return { backgroundColor: '#EFF6FF', color: '#1d4ed8', border: '1px solid #bfdbfe' };
    if (name.includes('gold')) return { backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' };
    if (name.includes('silver')) return { backgroundColor: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb' };
    if (name.includes('bronze')) return { backgroundColor: '#ffedd5', color: '#c2410c', border: '1px solid #fdba74' };
    return { backgroundColor: '#f8fafc', color: '#64748b', border: '1px solid #e2e8f0' };
};

const CustomerManager = ({ customers, onAddCustomer, onUpdateCustomer, onDeleteCustomer }) => {
    const { user } = useAuth();
    const canEdit = user?.role === 'admin' || user?.can_edit === true;
    const [activeTab, setActiveTab] = useState(CUSTOMER_GROUPS.DEALER);
    const [showAddForm, setShowAddForm] = useState(false);
    
    const [newCustomer, setNewCustomer] = useState({
        name: '',
        territory: 'SK',
        group: CUSTOMER_GROUPS.DEALER,
        annualSpend: 0
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setNewCustomer(prev => ({
            ...prev,
            [name]: name === 'annualSpend' ? (parseFloat(value) || 0) : value
        }));
    };

    const handleAdd = (e) => {
        e.preventDefault();
        if (!newCustomer.name) return;
        onAddCustomer({ ...newCustomer, id: Date.now().toString() });
        setNewCustomer({ name: '', territory: 'SK', group: activeTab !== 'Other' ? activeTab : CUSTOMER_GROUPS.DEALER, annualSpend: 0 });
        setShowAddForm(false);
    };

    const territoryRank = { 'SK': 1, 'AB': 2, 'BC': 3, 'Other': 4 };
    const getRank = (t) => territoryRank[t] || 4;

    const sortedCustomers = [...customers]
        .filter(c => {
            if (activeTab === 'Other') {
                return c.group !== CUSTOMER_GROUPS.DEALER && c.group !== CUSTOMER_GROUPS.COMMERCIAL;
            }
            return c.group === activeTab;
        })
        .sort((a, b) => {
            const spendDiff = b.annualSpend - a.annualSpend;
            if (spendDiff !== 0) return spendDiff;
            const rankA = getRank(a.territory);
            const rankB = getRank(b.territory);
            return rankA - rankB;
        });

    // Premium SaaS UI Variables
    const styles = {
        pageWrapper: { width: '100%', minHeight: '100%' },
        container: { maxWidth: '1600px', margin: '0 auto', padding: '2.5rem', width: '100%', fontFamily: 'var(--font-base)' },
        headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' },
        headerText: { fontSize: '1.75rem', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.02em', margin: '0 0 0.5rem 0' },
        subText: { color: '#64748b', fontSize: '1rem', margin: 0 },
        headerActions: { display: 'flex', gap: '1rem', alignItems: 'center' },
        
        primaryBtn: { padding: '0.6rem 1.25rem', backgroundColor: '#2563EB', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' },
        outlineBtn: { padding: '0.5rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', fontWeight: '500', color: '#475569' },
        dangerTextBtn: { background: 'none', border: 'none', color: '#dc2626', fontWeight: '600', cursor: 'pointer', padding: '0.25rem 0.5rem' },

        layoutGrid: { display: 'grid', gridTemplateColumns: '260px 1fr', gap: '2rem', alignItems: 'start' },
        card: { backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.03)', border: '1px solid rgba(15, 23, 42, 0.08)', overflow: 'hidden' },
        
        listHeader: { padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(15, 23, 42, 0.06)', backgroundColor: '#fafbfc', fontSize: '0.9rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
        listContainer: { maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' },
        listItemActive: { padding: '1rem 1.5rem', cursor: 'pointer', backgroundColor: '#EFF6FF', borderLeft: '4px solid #2563EB', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        listItemInactive: { padding: '1rem 1.5rem', cursor: 'pointer', backgroundColor: 'white', borderLeft: '4px solid transparent', borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
        listName: { fontSize: '0.95rem', fontWeight: '500' },
        listBadge: { fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '999px', backgroundColor: '#e2e8f0', color: '#475569', fontWeight: '600' },
        listBadgeActive: { fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '999px', backgroundColor: '#bfdbfe', color: '#1e40af', fontWeight: '600' },

        tableControlBar: { padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(15, 23, 42, 0.08)', backgroundColor: '#ffffff', display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' },
        
        inputField: { padding: '0.6rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem', color: '#0f172a', transition: 'all 0.2s', outline: 'none', width: '100%', backgroundColor: '#ffffff' },
        inputLabel: { display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' },

        table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
        th: { padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', borderBottom: '1px solid rgba(15, 23, 42, 0.08)' },
        td: { padding: '1rem 1.5rem', fontSize: '0.95rem', color: '#0f172a', borderBottom: '1px solid rgba(15, 23, 42, 0.04)', verticalAlign: 'middle' },
        
        baseBadge: { padding: '0.35rem 0.75rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '600', display: 'inline-block' },
        
        totalsRow: { backgroundColor: '#f8fafc', fontWeight: '600', borderTop: '2px solid #e2e8f0' }
    };

    const getGroupCount = (groupName) => {
        if (groupName === 'Other') return customers.filter(c => c.group !== CUSTOMER_GROUPS.DEALER && c.group !== CUSTOMER_GROUPS.COMMERCIAL).length;
        return customers.filter(c => c.group === groupName).length;
    };

    return (
        <div style={styles.pageWrapper}>
            <div style={styles.container}>
                {/* Header */}
                <div style={styles.headerRow}>
                    <div>
                        <h2 style={styles.headerText}>Customer Management</h2>
                        <p style={styles.subText}>Manage accounts, regional assignments, and tier eligibility</p>
                    </div>

                    <div style={styles.headerActions}>
                        {canEdit && (
                            <button 
                                onClick={() => setShowAddForm(!showAddForm)}
                                style={showAddForm ? styles.outlineBtn : styles.primaryBtn}
                            >
                                {showAddForm ? 'Cancel Creation' : '+ New Customer'}
                            </button>
                        )}
                    </div>
                </div>

                <div style={styles.layoutGrid}>
                    {/* Sidebar: Customer Groups */}
                    <div style={styles.card}>
                        <div style={styles.listHeader}>Customer Segments</div>
                        <div style={styles.listContainer}>
                            {[CUSTOMER_GROUPS.DEALER, CUSTOMER_GROUPS.COMMERCIAL, 'Other'].map(group => {
                                const isActive = activeTab === group;
                                const count = getGroupCount(group);
                                return (
                                    <div 
                                        key={group} 
                                        onClick={() => setActiveTab(group)} 
                                        style={isActive ? styles.listItemActive : styles.listItemInactive}
                                    >
                                        <div style={{...styles.listName, color: isActive ? '#1e40af' : '#0f172a'}}>{group}</div>
                                        <span style={isActive ? styles.listBadgeActive : styles.listBadge}>{count}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Main Data Panel */}
                    <div style={styles.card}>
                        
                        {/* Control Bar */}
                        <div style={styles.tableControlBar}>
                            <div style={{ fontSize: '0.95rem', color: '#475569', fontWeight: '500' }}>
                                Viewing <strong style={{ color: '#0f172a' }}>{activeTab}</strong> Segment
                            </div>
                        </div>

                        {/* Add Form Insert */}
                        {showAddForm && canEdit && (
                            <div style={{ padding: '2rem', borderBottom: '1px solid rgba(15, 23, 42, 0.08)', backgroundColor: '#f8fafc' }}>
                                <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'end' }}>
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <label style={styles.inputLabel}>Customer Name</label>
                                        <input type="text" name="name" style={styles.inputField} value={newCustomer.name} onChange={handleChange} required autoFocus />
                                    </div>
                                    <div>
                                        <label style={styles.inputLabel}>Territory</label>
                                        <select name="territory" style={styles.inputField} value={newCustomer.territory} onChange={handleChange}>
                                            <option value="SK">SK</option>
                                            <option value="AB">AB</option>
                                            <option value="BC">BC</option>
                                            <option value="MB">MB</option>
                                            <option value="ON">ON</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={styles.inputLabel}>Group</label>
                                        <select name="group" style={styles.inputField} value={newCustomer.group} onChange={handleChange}>
                                            <option value={CUSTOMER_GROUPS.DEALER}>Dealer</option>
                                            <option value={CUSTOMER_GROUPS.COMMERCIAL}>Commercial</option>
                                            <option value="Consumer">Consumer</option>
                                            <option value="Internal">Internal</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={styles.inputLabel}>Annual Spend ($)</label>
                                        <input type="number" name="annualSpend" style={styles.inputField} value={newCustomer.annualSpend || ''} onChange={handleChange} placeholder="0.00" />
                                    </div>
                                    <button type="submit" style={styles.primaryBtn}>Save Account</button>
                                </form>
                            </div>
                        )}

                        {/* Data Table */}
                        <div style={{ overflowX: 'auto' }}>
                            <table style={styles.table}>
                                <thead>
                                    <tr style={{ backgroundColor: '#fafbfc' }}>
                                        <th style={{...styles.th, width: '35%'}}>Customer Name</th>
                                        <th style={{...styles.th, width: '15%', textAlign: 'center'}}>Territory</th>
                                        <th style={{...styles.th, width: '15%', textAlign: 'right'}}>Annual Spend</th>
                                        <th style={{...styles.th, width: '20%'}}>Pricing Tier</th>
                                        <th style={{...styles.th, width: '15%', textAlign: 'center'}}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedCustomers.length === 0 ? (
                                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>No customers found in this segment.</td></tr>
                                    ) : (
                                        sortedCustomers.map(customer => {
                                            const tierName = calculateTier(customer.group, customer.annualSpend);
                                            const badgeStyle = getTierBadgeStyles(tierName);
                                            
                                            return (
                                                <tr key={customer.id}>
                                                    <td style={{...styles.td, fontWeight: '500'}}>{customer.name}</td>
                                                    <td style={{...styles.td, textAlign: 'center'}}>
                                                        {canEdit ? (
                                                        <select
                                                            value={customer.territory || 'Other'}
                                                            onChange={(e) => onUpdateCustomer(customer.id, { territory: e.target.value })}
                                                            style={{ 
                                                                padding: '0.4rem 0.5rem', 
                                                                border: '1px solid #cbd5e1', 
                                                                borderRadius: '6px', 
                                                                fontSize: '0.85rem',
                                                                color: '#475569',
                                                                fontWeight: '500',
                                                                backgroundColor: '#f8fafc',
                                                                outline: 'none',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            <option value="SK">SK</option>
                                                            <option value="AB">AB</option>
                                                            <option value="BC">BC</option>
                                                            <option value="MB">MB</option>
                                                            <option value="ON">ON</option>
                                                            <option value="Other">Other</option>
                                                        </select>
                                                        ) : (
                                                            <span style={{ fontWeight: '500', color: '#475569' }}>{customer.territory || 'Other'}</span>
                                                        )}
                                                    </td>
                                                    <td style={{...styles.td, textAlign: 'right', fontWeight: '600'}}>{formatCurrency(customer.annualSpend)}</td>
                                                    <td style={styles.td}>
                                                        <span style={{...styles.baseBadge, ...badgeStyle}}>
                                                            {tierName.replace('Authorized ', '').replace(' Partner', '')}
                                                        </span>
                                                    </td>
                                                    <td style={{...styles.td, textAlign: 'center'}}>
                                                        {canEdit && (
                                                            <button 
                                                                style={styles.dangerTextBtn}
                                                                onClick={() => onDeleteCustomer(customer.id)}
                                                            >
                                                                Delete
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}

                                    {/* Subtotal Row for Current Tab */}
                                    {sortedCustomers.length > 0 && (
                                        <tr style={styles.totalsRow}>
                                            <td colSpan="2" style={{...styles.td, textAlign: 'right', color: '#64748b', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em'}}>
                                                Segment Subtotal:
                                            </td>
                                            <td style={{...styles.td, textAlign: 'right', color: '#0f172a', fontSize: '1.05rem'}}>
                                                {formatCurrency(sortedCustomers.reduce((sum, c) => sum + (c.annualSpend || 0), 0))}
                                            </td>
                                            <td colSpan="2" style={styles.td}></td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default CustomerManager;

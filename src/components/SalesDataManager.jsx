import React, { useState, useMemo, useEffect } from 'react';
import { formatCurrency, formatPercent } from '../utils/pricingEngine';

const SalesDataManager = ({ customers, salesTransactions = [], categories, onDeleteCustomer, onDeleteCategory, onBatchDeleteSales, onUpdateSale, onAddSale, onDeleteSale }) => {
    const [deleteId, setDeleteId] = useState(null);
    const [deleteCategory, setDeleteCategory] = useState(null);
    const [viewMode, setViewMode] = useState('category'); // 'category' | 'customer'
    const [selectedId, setSelectedId] = useState('');

    const [editTx, setEditTx] = useState(null);
    const [isAdding, setIsAdding] = useState(false);
    const [newSale, setNewSale] = useState({ customerName: '', category: '', amount: 0, cogs: 0 });
    const [expandedGroup, setExpandedGroup] = useState(null);

    const validSales = useMemo(() => Array.isArray(salesTransactions) ? salesTransactions : [], [salesTransactions]);
    const categoryNames = useMemo(() => categories.map(c => c.name), [categories]);

    const salesCustomers = useMemo(() => {
        const names = new Set(validSales.map(tx => tx.customerName));
        return Array.from(names).sort();
    }, [validSales]);

    useEffect(() => {
        if (!selectedId) {
            if (viewMode === 'category' && categoryNames.length > 0) setSelectedId(categoryNames[0]);
            if (viewMode === 'customer' && salesCustomers.length > 0) setSelectedId(salesCustomers[0]);
        }
    }, [viewMode, categoryNames, salesCustomers, selectedId]);

    const stats = useMemo(() => {
        if (viewMode === 'category') {
            const catName = selectedId;
            const relevantTx = validSales.filter(tx => tx.category === catName);
            const aggMap = {};
            let total = 0;
            let totalCogs = 0;

            relevantTx.forEach(tx => {
                const currentFn = aggMap[tx.customerName] || { amount: 0, cogs: 0 };
                aggMap[tx.customerName] = {
                    amount: currentFn.amount + tx.amount,
                    cogs: currentFn.cogs + (tx.cogs || 0)
                };
                total += tx.amount;
                totalCogs += (tx.cogs || 0);
            });

            const buyers = Object.entries(aggMap).map(([name, data]) => ({
                id: name,
                name,
                amount: data.amount,
                cogs: data.cogs
            })).sort((a, b) => b.amount - a.amount);

            return { items: buyers, total, totalCogs };
        } else {
            const customerName = selectedId;
            const relevantTx = validSales.filter(tx => tx.customerName === customerName);
            const aggMap = {};
            let total = 0;
            let totalCogs = 0;

            relevantTx.forEach(tx => {
                const currentFn = aggMap[tx.category] || { amount: 0, cogs: 0 };
                aggMap[tx.category] = {
                    amount: currentFn.amount + tx.amount,
                    cogs: currentFn.cogs + (tx.cogs || 0)
                };
                total += tx.amount;
                totalCogs += (tx.cogs || 0);
            });

            const items = Object.entries(aggMap).map(([cat, data]) => ({
                id: cat,
                name: cat,
                amount: data.amount,
                cogs: data.cogs
            })).sort((a, b) => b.amount - a.amount);

            return { items, total, totalCogs };
        }
    }, [viewMode, selectedId, validSales]);

    // Premium SaaS UI Variables
    const styles = {
        pageWrapper: { width: '100%', minHeight: '100%' },
        container: { maxWidth: '1600px', margin: '0 auto', padding: '2.5rem', width: '100%', fontFamily: 'var(--font-base)' },
        headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' },
        headerText: { fontSize: '1.75rem', fontWeight: '700', color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: '0 0 0.5rem 0' },
        subText: { color: 'var(--text-muted)', fontSize: '1rem', margin: 0 },
        headerActions: { display: 'flex', gap: '1rem', alignItems: 'center' },
        
        // Segmented Control (Toggle)
        segmentTrack: { display: 'flex', backgroundColor: '#f1f5f9', padding: '0.25rem', borderRadius: '8px', border: '1px solid rgba(15, 23, 42, 0.05)' },
        segmentBtnActive: { padding: '0.5rem 1.25rem', backgroundColor: '#ffffff', color: '#0f172a', fontWeight: '600', fontSize: '0.9rem', borderRadius: '6px', border: 'none', boxShadow: '0 1px 3px rgba(15,23,42,0.08)', cursor: 'default' },
        segmentBtnInactive: { padding: '0.5rem 1.25rem', backgroundColor: 'transparent', color: '#64748b', fontWeight: '500', fontSize: '0.9rem', borderRadius: '6px', border: 'none', cursor: 'pointer' },
        
        dangerBtn: { padding: '0.5rem 1rem', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s' },
        primaryBtn: { padding: '0.6rem 1.25rem', backgroundColor: '#2563EB', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' },
        outlineBtn: { padding: '0.5rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', fontWeight: '500', color: '#475569' },

        // Layout
        layoutGrid: { display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem', alignItems: 'start' },
        
        // Cards
        card: { backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.03)', border: '1px solid rgba(15, 23, 42, 0.08)', overflow: 'hidden' },
        
        // Sidebar List
        listHeader: { padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(15, 23, 42, 0.06)', backgroundColor: '#fafbfc', fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' },
        listContainer: { maxHeight: '650px', overflowY: 'auto' },
        listItemActive: { padding: '1rem 1.5rem', cursor: 'pointer', backgroundColor: '#EFF6FF', borderLeft: '4px solid #2563EB', borderBottom: '1px solid #f1f5f9' },
        listItemInactive: { padding: '1rem 1.5rem', cursor: 'pointer', backgroundColor: 'white', borderLeft: '4px solid transparent', borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' },
        listName: { fontSize: '0.95rem', fontWeight: '500', color: '#0f172a' },
        
        // Data Area
        statBanner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid rgba(15, 23, 42, 0.08)', backgroundColor: '#ffffff' },
        statLabel: { fontSize: '0.9rem', color: '#64748b', marginBottom: '0.25rem' },
        statValue: { fontSize: '2.25rem', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.02em', lineHeight: '1.1' },
        
        // Table
        table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
        th: { padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', borderBottom: '1px solid rgba(15, 23, 42, 0.08)' },
        td: { padding: '1rem 1.5rem', fontSize: '0.95rem', color: '#0f172a', borderBottom: '1px solid rgba(15, 23, 42, 0.04)', verticalAlign: 'middle' },
        
        // Modal Overlay
        overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(2px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
        modal: { backgroundColor: '#ffffff', borderRadius: '12px', padding: '2rem', width: '90%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.04)' },
        input: { width: '100%', padding: '0.75rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem', color: '#0f172a', transition: 'border-color 0.2s' },
        label: { display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem' }
    };

    return (
        <div style={styles.pageWrapper}>
            <div style={styles.container}>
                
                {/* Header Row */}
                <div style={styles.headerRow}>
                    <div>
                        <h2 style={styles.headerText}>Data Explorer</h2>
                        <p style={styles.subText}>Review and manage detailed sales transactions</p>
                    </div>

                    <div style={styles.headerActions}>
                        {viewMode === 'customer' && selectedId && (
                            <button onClick={() => setDeleteId(selectedId)} style={styles.dangerBtn}>
                                Clear Sales Data
                            </button>
                        )}
                        {viewMode === 'category' && selectedId && onDeleteCategory && (
                            <button onClick={() => setDeleteCategory(selectedId)} style={styles.dangerBtn}>
                                Clear Category Data
                            </button>
                        )}

                        <div style={styles.segmentTrack}>
                            <button 
                                onClick={() => { setViewMode('category'); setSelectedId(''); }}
                                style={viewMode === 'category' ? styles.segmentBtnActive : styles.segmentBtnInactive}
                            >
                                By Product Line
                            </button>
                            <button 
                                onClick={() => { setViewMode('customer'); setSelectedId(''); }}
                                style={viewMode === 'customer' ? styles.segmentBtnActive : styles.segmentBtnInactive}
                            >
                                By Account
                            </button>
                        </div>
                    </div>
                </div>

                <div style={styles.layoutGrid}>
                    {/* Selector Column */}
                    <div style={styles.card}>
                        <div style={styles.listHeader}>
                            {viewMode === 'category' ? 'Product Lines' : 'Accounts'}
                        </div>
                        <div style={styles.listContainer}>
                            {viewMode === 'category' ? (
                                categoryNames.map(cat => (
                                    <div key={cat} onClick={() => setSelectedId(cat)} style={selectedId === cat ? styles.listItemActive : styles.listItemInactive}>
                                        <div style={{...styles.listName, color: selectedId === cat ? '#1e40af' : '#0f172a'}}>{cat}</div>
                                    </div>
                                ))
                            ) : (
                                salesCustomers.map(name => (
                                    <div key={name} onClick={() => setSelectedId(name)} style={selectedId === name ? styles.listItemActive : styles.listItemInactive}>
                                        <div style={{...styles.listName, color: selectedId === name ? '#1e40af' : '#0f172a'}}>{name}</div>
                                    </div>
                                ))
                            )}
                            {viewMode === 'customer' && salesCustomers.length === 0 && (
                                <div style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.9rem' }}>
                                    No transaction records found.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Data Panel */}
                    <div style={styles.card}>
                        <div style={styles.statBanner}>
                            <div>
                                <div style={styles.statLabel}>Total spend for <strong style={{color: '#0f172a'}}>{selectedId}</strong></div>
                                <div style={styles.statValue}>{formatCurrency(stats.total)}</div>
                            </div>
                            {onAddSale && (
                                <button 
                                    onClick={() => {
                                        setNewSale({ customerName: viewMode === 'customer' ? selectedId : '', category: viewMode === 'category' ? selectedId : '', amount: 0, cogs: 0 });
                                        setIsAdding(true);
                                    }}
                                    style={styles.primaryBtn}
                                >
                                    + Add Record
                                </button>
                            )}
                        </div>

                        <div style={{ overflowX: 'auto' }}>
                            <table style={styles.table}>
                                <thead>
                                    <tr>
                                        <th style={styles.th}>{viewMode === 'category' ? 'Account' : 'Product Line'}</th>
                                        <th style={{ ...styles.th, textAlign: 'right' }}>Revenue</th>
                                        <th style={{ ...styles.th, textAlign: 'right' }}>Cost</th>
                                        <th style={{ ...styles.th, textAlign: 'right' }}>Share</th>
                                        <th style={{ ...styles.th, textAlign: 'center' }}>Details</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stats.items.length > 0 ? (
                                        stats.items.map(item => (
                                            <React.Fragment key={item.id || item.name}>
                                                <tr>
                                                    <td style={{ ...styles.td, fontWeight: '500' }}>{item.name}</td>
                                                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: '600' }}>{formatCurrency(item.amount)}</td>
                                                    <td style={{ ...styles.td, textAlign: 'right', color: '#64748b' }}>{formatCurrency(item.cogs || 0)}</td>
                                                    <td style={{ ...styles.td, textAlign: 'right', color: '#64748b' }}>{formatPercent((item.amount / stats.total) || 0)}</td>
                                                    <td style={{ ...styles.td, textAlign: 'center' }}>
                                                        <button 
                                                            onClick={() => setExpandedGroup(expandedGroup === item.id ? null : item.id)}
                                                            style={{ padding: '0.25rem 0.75rem', fontSize: '0.8rem', fontWeight: '600', color: expandedGroup === item.id ? '#2563EB' : '#64748b', backgroundColor: expandedGroup === item.id ? '#EFF6FF' : '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                        >
                                                            {expandedGroup === item.id ? 'Close' : 'View'}
                                                        </button>
                                                    </td>
                                                </tr>
                                                {/* Expanded Details Row */}
                                                {expandedGroup === item.id && (
                                                    <tr style={{ backgroundColor: '#f8fafc' }}>
                                                        <td colSpan="5" style={{ padding: '1rem 1.5rem 1.5rem 1.5rem' }}>
                                                            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                                                                <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                                                                    <thead style={{ backgroundColor: '#f1f5f9' }}>
                                                                        <tr>
                                                                            <th style={{ padding: '0.75rem 1rem', color: '#64748b', fontWeight: '600', textAlign: 'left' }}>Record ID</th>
                                                                            <th style={{ padding: '0.75rem 1rem', color: '#64748b', fontWeight: '600', textAlign: 'right' }}>Revenue</th>
                                                                            <th style={{ padding: '0.75rem 1rem', color: '#64748b', fontWeight: '600', textAlign: 'right' }}>Cost</th>
                                                                            <th style={{ padding: '0.75rem 1rem', color: '#64748b', fontWeight: '600', textAlign: 'right' }}>Action</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {validSales
                                                                            .filter(tx => (viewMode === 'category' && tx.category === selectedId && tx.customerName === item.name) || (viewMode === 'customer' && tx.customerName === selectedId && tx.category === item.name))
                                                                            .map(tx => (
                                                                                <tr key={tx.id || Math.random()} style={{ borderTop: '1px solid #f1f5f9' }}>
                                                                                    <td style={{ padding: '0.75rem 1rem', color: '#94a3b8', fontFamily: 'monospace' }}>{tx.id ? tx.id.substring(tx.id.length - 6) : 'N/A'}</td>
                                                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', fontWeight: '500' }}>{formatCurrency(tx.amount)}</td>
                                                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: '#64748b' }}>{formatCurrency(tx.cogs || 0)}</td>
                                                                                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                                                                                        <button 
                                                                                            onClick={() => setEditTx(tx)}
                                                                                            style={{ color: '#2563EB', fontWeight: '600', border: 'none', background: 'transparent', cursor: 'pointer' }}
                                                                                        >
                                                                                            Edit
                                                                                        </button>
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))
                                    ) : (
                                        <tr><td colSpan="5" style={{ textAlign: 'center', padding: '4rem 2rem', color: '#94a3b8' }}>No records match the current selection.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Modals rendered selectively below to avoid cluttering visual layout code above. */}
                {/* Modal overlay logic remains identical but styling updated using inline styles block above */}
                
                {editTx && (
                    <div style={styles.overlay}>
                        <div style={styles.modal}>
                            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', color: '#0f172a' }}>Edit Record</h3>
                            
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={styles.label}>Account</label>
                                <div style={{ padding: '0.75rem 1rem', backgroundColor: '#f1f5f9', borderRadius: '6px', color: '#475569', fontWeight: '500' }}>{editTx.name || editTx.customerName}</div>
                            </div>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={styles.label}>Product Line</label>
                                <select value={editTx.category} onChange={e => setEditTx({ ...editTx, category: e.target.value })} style={styles.input}>
                                    {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={styles.label}>Revenue ($)</label>
                                <input type="number" value={editTx.amount} onChange={e => setEditTx({ ...editTx, amount: parseFloat(e.target.value) || 0 })} style={styles.input} />
                            </div>

                            <div style={{ marginBottom: '2rem' }}>
                                <label style={styles.label}>Cost / COGS ($)</label>
                                <input type="number" value={editTx.cogs || 0} onChange={e => setEditTx({ ...editTx, cogs: parseFloat(e.target.value) || 0 })} style={styles.input} />
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between' }}>
                                <button onClick={() => { if (onDeleteSale) onDeleteSale(editTx.id); setEditTx(null); }} style={styles.dangerBtn}>Delete Record</button>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button onClick={() => setEditTx(null)} style={styles.outlineBtn}>Cancel</button>
                                    <button onClick={() => { if (onUpdateSale) onUpdateSale(editTx.id, { amount: editTx.amount, category: editTx.category, cogs: editTx.cogs }); setEditTx(null); }} style={styles.primaryBtn}>Save Changes</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {isAdding && (
                    <div style={styles.overlay}>
                        <div style={styles.modal}>
                            <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', color: '#0f172a' }}>Create New Record</h3>
                            
                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={styles.label}>Account Name</label>
                                <input type="text" placeholder="e.g. Acme Corp" value={newSale.customerName} onChange={e => setNewSale({ ...newSale, customerName: e.target.value })} style={styles.input} />
                            </div>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={styles.label}>Product Line</label>
                                <select value={newSale.category} onChange={e => setNewSale({ ...newSale, category: e.target.value })} style={styles.input}>
                                    <option value="" disabled>Select a line...</option>
                                    {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div style={{ marginBottom: '1.25rem' }}>
                                <label style={styles.label}>Revenue ($)</label>
                                <input type="number" placeholder="0.00" value={newSale.amount || ''} onChange={e => setNewSale({ ...newSale, amount: parseFloat(e.target.value) || 0 })} style={styles.input} />
                            </div>

                            <div style={{ marginBottom: '2rem' }}>
                                <label style={styles.label}>Cost / COGS ($)</label>
                                <input type="number" placeholder="0.00" value={newSale.cogs || ''} onChange={e => setNewSale({ ...newSale, cogs: parseFloat(e.target.value) || 0 })} style={styles.input} />
                            </div>

                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                <button onClick={() => setIsAdding(false)} style={styles.outlineBtn}>Cancel</button>
                                <button onClick={() => { if (onAddSale && newSale.customerName && newSale.category) { onAddSale({ name: newSale.customerName, customerName: newSale.customerName, category: newSale.category, amount: newSale.amount || 0, cogs: newSale.cogs || 0, customerId: '' }); setIsAdding(false); } }} style={styles.primaryBtn}>Add Record</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Confirm Deletion Modals */}
                {(deleteId || deleteCategory) && (
                    <div style={styles.overlay}>
                        <div style={{...styles.modal, maxWidth: '400px'}}>
                            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', color: '#dc2626' }}>Confirm Deletion</h3>
                            <p style={{ color: '#475569', lineHeight: '1.5', margin: '0 0 0.5rem 0' }}>Are you sure you want to permanently clear all records for <strong>{deleteId || deleteCategory}</strong>?</p>
                            <p style={{ fontSize: '0.85rem', color: '#94a3b8', margin: '0 0 2rem 0' }}>This action cannot be undone.</p>
                            
                            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                                <button onClick={() => { setDeleteId(null); setDeleteCategory(null); }} style={styles.outlineBtn}>Cancel</button>
                                <button onClick={() => { 
                                    if (onBatchDeleteSales) onBatchDeleteSales(deleteId, deleteCategory); 
                                    setDeleteId(null); setDeleteCategory(null); setSelectedId(''); 
                                }} style={{...styles.primaryBtn, backgroundColor: '#dc2626', boxShadow: '0 2px 4px rgba(220,38,38,0.2)'}}>
                                    Yes, Clear Data
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default SalesDataManager;

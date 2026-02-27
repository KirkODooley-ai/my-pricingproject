import React, { useState } from 'react';
import { calculateCategoryMargin, formatCurrency, formatPercent, getCategoryGroup } from '../utils/pricingEngine';
import { useAuth } from '../contexts/AuthContext';

const CategoryManager = ({ categories, onAddCategory, onUpdateCategory, onDeleteCategory, onRestoreDefaults, onSwapCategories, laborRates = {} }) => {
    const { user } = useAuth();
    const canEdit = user?.role === 'admin' || user?.can_edit === true;
    const [editingId, setEditingId] = useState(null);
    const [editFormData, setEditFormData] = useState({});
    const [showAddForm, setShowAddForm] = useState(false);

    const [newCategory, setNewCategory] = useState({
        name: '',
        revenue: 0,
        materialCost: 0,
        laborPercentage: 0
    });

    const handleEditClick = (category) => {
        setEditingId(category.id);
        setEditFormData({
            ...category,
            laborPercentage: (category.laborPercentage || 0) * 100
        });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditFormData({});
    };

    const handleSaveClick = (id) => {
        const rev = parseFloat(editFormData.revenue) || 0;
        const labPct = (parseFloat(editFormData.laborPercentage) || 0) / 100;
        const totalFootage = parseFloat(editFormData.totalFootage ?? editFormData.total_footage) || 0;
        const quantity = parseFloat(editFormData.quantity) || 0;
        const groupName = getCategoryGroup(editFormData.name || '');
        const rate = laborRates[groupName];

        let calculatedLaborCost = 0;
        if (rate != null && rate !== '' && (totalFootage > 0 || quantity > 0)) {
            calculatedLaborCost = (totalFootage / Math.max(1, quantity)) * (parseFloat(rate) || 0);
        } else {
            calculatedLaborCost = rev * labPct;
        }

        onUpdateCategory(id, {
            ...editFormData,
            revenue: rev,
            materialCost: parseFloat(editFormData.materialCost) || 0,
            laborPercentage: labPct,
            totalFootage,
            quantity,
            laborCost: calculatedLaborCost
        });
        setEditingId(null);
    };

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditFormData(prev => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setNewCategory(prev => ({
            ...prev,
            [name]: name === 'name' ? value : parseFloat(value) || 0
        }));
    };

    const handleAdd = (e) => {
        e.preventDefault();
        if (!newCategory.name) return;

        const rev = newCategory.revenue || 0;
        const labPct = (newCategory.laborPercentage || 0) / 100;
        const calculatedLaborCost = rev * labPct;

        onAddCategory({
            ...newCategory,
            laborPercentage: labPct,
            laborCost: calculatedLaborCost,
            id: Date.now().toString()
        });
        setNewCategory({ name: '', revenue: 0, materialCost: 0, laborPercentage: 0 });
        setShowAddForm(false);
    };

    // Premium SaaS UI Variables (Matching PricingTable / SalesDataManager)
    const styles = {
        pageWrapper: { width: '100%', minHeight: '100%' },
        container: { maxWidth: '1600px', margin: '0 auto', padding: '2.5rem', width: '100%', fontFamily: 'var(--font-base)' },
        headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' },
        headerText: { fontSize: '1.75rem', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.02em', margin: '0 0 0.5rem 0' },
        subText: { color: '#64748b', fontSize: '1rem', margin: 0 },
        headerActions: { display: 'flex', gap: '1rem', alignItems: 'center' },

        primaryBtn: { padding: '0.6rem 1.25rem', backgroundColor: '#2563EB', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(37,99,235,0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem' },
        outlineBtn: { padding: '0.5rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', fontWeight: '500', color: '#475569' },
        dangerBtn: { padding: '0.5rem 1rem', backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', fontWeight: '600', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s' },

        dangerTextBtn: { background: 'none', border: 'none', color: '#dc2626', fontWeight: '600', cursor: 'pointer', padding: '0.25rem 0.5rem' },
        actionTextBtn: { background: 'none', border: 'none', color: '#2563EB', fontWeight: '600', cursor: 'pointer', padding: '0.25rem 0.5rem' },

        card: { backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.03)', border: '1px solid rgba(15, 23, 42, 0.08)', overflow: 'hidden' },

        inputField: { padding: '0.6rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem', color: '#0f172a', transition: 'all 0.2s', outline: 'none', width: '100%' },
        inputLabel: { display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' },

        table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
        th: { padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', borderBottom: '1px solid rgba(15, 23, 42, 0.08)' },
        td: { padding: '1rem 1.5rem', fontSize: '0.95rem', color: '#0f172a', borderBottom: '1px solid rgba(15, 23, 42, 0.04)', verticalAlign: 'middle' },

        badgeGreen: { backgroundColor: '#ecfdf5', color: '#059669', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '600' },
        badgeRed: { backgroundColor: '#fef2f2', color: '#dc2626', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '600' },
        badgeBlue: { backgroundColor: '#EFF6FF', color: '#2563EB', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '600' },

        groupRow: { backgroundColor: '#fafbfc' },
        groupText: { fontWeight: '600', color: '#64748b', padding: '0.8rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #e2e8f0', borderTop: '1px solid #e2e8f0' }
    };

    return (
        <div style={styles.pageWrapper}>
            <div style={styles.container}>
                {/* Header Row */}
                <div style={styles.headerRow}>
                    <div>
                        <h2 style={styles.headerText}>Category Analysis</h2>
                        <p style={styles.subText}>Manage product lines, revenue mix, and margin profiles</p>
                    </div>

                    <div style={styles.headerActions}>
                        {canEdit && categories.length === 0 && (
                            <button onClick={onRestoreDefaults} style={styles.primaryBtn}>
                                ⟳ Load Default Categories
                            </button>
                        )}
                        {canEdit && (
                            <button
                                onClick={() => setShowAddForm(!showAddForm)}
                                style={showAddForm ? styles.outlineBtn : styles.primaryBtn}
                            >
                                {showAddForm ? 'Cancel Creation' : '+ Add Category'}
                            </button>
                        )}
                    </div>
                </div>

                <div style={styles.card}>
                    {/* Add Form Insert */}
                    {showAddForm && canEdit && (
                        <div style={{ padding: '2rem', borderBottom: '1px solid rgba(15, 23, 42, 0.08)', backgroundColor: '#f8fafc' }}>
                            <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
                                <div><label style={styles.inputLabel}>Category Name</label><input type="text" name="name" style={styles.inputField} value={newCategory.name} onChange={handleChange} autoFocus required /></div>
                                <div><label style={styles.inputLabel}>Revenue ($)</label><input type="number" name="revenue" style={styles.inputField} value={newCategory.revenue || ''} onChange={handleChange} /></div>
                                <div><label style={styles.inputLabel}>Material Cost ($)</label><input type="number" name="materialCost" style={styles.inputField} value={newCategory.materialCost || ''} onChange={handleChange} /></div>
                                <div style={{ position: 'relative' }}>
                                    <label style={styles.inputLabel}>Labor %</label>
                                    <input type="number" step="0.5" name="laborPercentage" style={styles.inputField} value={newCategory.laborPercentage || ''} onChange={handleChange} placeholder="e.g. 15" />
                                    <span style={{ position: 'absolute', right: '12px', top: '38px', color: '#9ca3af', fontSize: '0.9rem', fontWeight: '500' }}>%</span>
                                </div>
                                <button type="submit" style={styles.primaryBtn}>Save Category</button>
                            </form>
                        </div>
                    )}

                    {/* Data Table */}
                    <div style={{ overflowX: 'auto' }}>
                        <table style={styles.table}>
                            <thead>
                                <tr style={{ backgroundColor: '#ffffff' }}>
                                    <th style={{ ...styles.th, width: '20%' }}>Category Name</th>
                                    <th style={{ ...styles.th, width: '12%', textAlign: 'right' }}>Revenue</th>
                                    <th style={{ ...styles.th, width: '10%', textAlign: 'center' }}>Sales Mix</th>
                                    <th style={{ ...styles.th, width: '12%', textAlign: 'right' }}>Material Cost</th>
                                    <th style={{ ...styles.th, width: '10%', textAlign: 'center' }}>Labor %</th>
                                    <th style={{ ...styles.th, width: '12%', textAlign: 'right' }}>Labor Cost</th>
                                    <th style={{ ...styles.th, width: '12%', textAlign: 'center' }}>Total Margin</th>
                                    <th style={{ ...styles.th, width: '12%', textAlign: 'center' }}>Actions</th>
                                </tr>
                            </thead>

                            {/* Render Groups */}
                            {['Large Rolled Panel', 'Small Rolled Panels', 'Cladding Series', 'Parts'].map(groupName => {
                                const groupCats = categories.filter(cat => getCategoryGroup(cat.name) === groupName);
                                if (groupCats.length === 0) return null;

                                return (
                                    <tbody key={groupName}>
                                        <tr style={styles.groupRow}>
                                            <td colSpan={8} style={styles.groupText}>{groupName}</td>
                                        </tr>

                                        {groupCats.map((cat, index) => {
                                            const margin = calculateCategoryMargin(cat);
                                            const totalRevenue = categories.reduce((sum, c) => sum + (c.revenue || 0), 0);
                                            const salesMix = totalRevenue > 0 ? (cat.revenue || 0) / totalRevenue : 0;
                                            const isEditing = editingId === cat.id && canEdit;

                                            // Swap Logic
                                            const canMoveUp = index > 0;
                                            const canMoveDown = index < groupCats.length - 1;
                                            const prevCat = canMoveUp ? groupCats[index - 1] : null;
                                            const nextCat = canMoveDown ? groupCats[index + 1] : null;

                                            return (
                                                <tr key={cat.id}>
                                                    {isEditing ? (
                                                        <>
                                                            <td style={styles.td}><input type="text" name="name" value={editFormData.name} onChange={handleEditChange} style={styles.inputField} autoFocus /></td>
                                                            <td style={styles.td}><input type="number" name="revenue" value={editFormData.revenue} onChange={handleEditChange} style={{ ...styles.inputField, textAlign: 'right' }} /></td>
                                                            <td style={styles.td}>-</td>
                                                            <td style={styles.td}>
                                                                <input
                                                                    type="number"
                                                                    name="materialCost"
                                                                    value={editFormData.materialCost}
                                                                    disabled
                                                                    title="Auto-calculated from Sales Data COGS"
                                                                    style={{ ...styles.inputField, backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#94a3b8', textAlign: 'right' }}
                                                                />
                                                            </td>
                                                            <td style={styles.td}><input type="number" step="0.5" name="laborPercentage" value={editFormData.laborPercentage || 0} onChange={handleEditChange} style={{ ...styles.inputField, textAlign: 'center' }} /></td>
                                                            <td style={{ ...styles.td, textAlign: 'right', color: '#94a3b8' }}>
                                                                {(() => {
                                                                    const tf = parseFloat(editFormData.totalFootage ?? editFormData.total_footage) || 0;
                                                                    const q = parseFloat(editFormData.quantity) || 0;
                                                                    const r = laborRates[getCategoryGroup(editFormData.name || '')];
                                                                    const labCost = (r != null && r !== '' && (tf > 0 || q > 0)) ? (tf / Math.max(1, q)) * (parseFloat(r) || 0) : (parseFloat(editFormData.revenue) || 0) * (parseFloat(editFormData.laborPercentage || 0) / 100 || 0);
                                                                    return formatCurrency(labCost ?? 0);
                                                                })()}
                                                            </td>
                                                            <td style={styles.td}>-</td>
                                                            <td style={{ ...styles.td, textAlign: 'center' }}>
                                                                <button style={styles.actionTextBtn} onClick={() => handleSaveClick(cat.id)}>Save</button>
                                                                <button style={styles.dangerTextBtn} onClick={handleCancelEdit}>Cancel</button>
                                                            </td>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <td style={{ ...styles.td, fontWeight: '500' }}>{cat.name}</td>
                                                            <td style={{ ...styles.td, textAlign: 'right', fontWeight: '500' }}>{formatCurrency(cat.revenue)}</td>
                                                            <td style={{ ...styles.td, textAlign: 'center' }}><span style={styles.badgeBlue}>{formatPercent(salesMix)}</span></td>
                                                            <td style={{ ...styles.td, textAlign: 'right' }}>{formatCurrency(cat.materialCost)}</td>
                                                            <td style={{ ...styles.td, textAlign: 'center', color: cat.laborPercentage ? '#0f172a' : '#cbd5e1', fontWeight: '500' }}>{cat.laborPercentage ? formatPercent(cat.laborPercentage) : '-'}</td>
                                                            <td style={{ ...styles.td, textAlign: 'right', color: '#64748b' }}>{formatCurrency(cat.laborCost ?? 0)}</td>
                                                            <td style={{ ...styles.td, textAlign: 'center' }}>
                                                                <span style={margin < 0.2 ? styles.badgeRed : styles.badgeGreen}>
                                                                    {formatPercent(margin)}
                                                                </span>
                                                            </td>
                                                            <td style={{ ...styles.td, display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                                                                {canEdit && <button style={styles.actionTextBtn} onClick={() => handleEditClick(cat)}>Edit</button>}
                                                                {canEdit && <button style={styles.dangerTextBtn} onClick={() => onDeleteCategory(cat.id)}>Delete</button>}

                                                                {/* Reordering Arrows (Premium SVGs) */}
                                                                {canEdit && onSwapCategories && (
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginLeft: '0.5rem', borderLeft: '1px solid #e2e8f0', paddingLeft: '0.5rem' }}>
                                                                        <button
                                                                            type="button"
                                                                            disabled={!canMoveUp}
                                                                            onClick={() => canMoveUp && onSwapCategories(cat.id, prevCat.id)}
                                                                            style={{
                                                                                border: 'none', background: 'transparent', cursor: canMoveUp ? 'pointer' : 'default', opacity: canMoveUp ? 1 : 0.2,
                                                                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b'
                                                                            }}
                                                                            title="Move Up"
                                                                        >
                                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
                                                                        </button>
                                                                        <button
                                                                            type="button"
                                                                            disabled={!canMoveDown}
                                                                            onClick={() => canMoveDown && onSwapCategories(cat.id, nextCat.id)}
                                                                            style={{
                                                                                border: 'none', background: 'transparent', cursor: canMoveDown ? 'pointer' : 'default', opacity: canMoveDown ? 1 : 0.2,
                                                                                display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b'
                                                                            }}
                                                                            title="Move Down"
                                                                        >
                                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                );
                            })}
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CategoryManager;

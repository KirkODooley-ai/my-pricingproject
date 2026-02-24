import React, { useState } from 'react';
import { calculateMargin, formatCurrency, formatPercent, calculateListPrice, calculateNetPrice, CUSTOMER_GROUPS, TIER_RULES, calculateTier, getFastenerType, FASTENER_TYPES, CATEGORY_GROUPS } from '../utils/pricingEngine';
import { useAuth } from '../contexts/AuthContext';

const PricingTable = ({ products, categories = [], onUpdateProduct, onAddProduct, onDeleteProduct, pricingStrategy, salesTransactions = [], customers = [], customerAliases = {} }) => {
    const { user } = useAuth();
    const isManager = user?.role === 'manager';
    const [editingId, setEditingId] = useState(null);
    const [activeCategory, setActiveCategory] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [previewTier, setPreviewTier] = useState({ group: '', tier: '' });
    const [editFormData, setEditFormData] = useState({});
    const [showAddForm, setShowAddForm] = useState(false);
    const [newProduct, setNewProduct] = useState({ name: '', unitCost: '', cost: '', price: '', vendor: '', itemCode: '', category: '' });

    const filteredProducts = products.filter(p => {
        const catMatch = activeCategory === 'All' || p.category === activeCategory;
        if (!searchTerm) return catMatch;
        const msg = searchTerm.toLowerCase();
        const textMatch = (
            (p.name || '').toLowerCase().includes(msg) ||
            (p.itemCode || '').toLowerCase().includes(msg) ||
            (p.vendor || '').toLowerCase().includes(msg) ||
            (p.subCategory || '').toLowerCase().includes(msg)
        );
        return catMatch && textMatch;
    });

    const categorySales = salesTransactions.filter(tx => activeCategory === 'All' || tx.category === activeCategory);

    const handleEditClick = (product) => { setEditingId(product.id); setEditFormData({ ...product }); };
    const handleCancelEdit = () => { setEditingId(null); setEditFormData({}); };
    const handleSaveClick = (id) => {
        onUpdateProduct(id, { ...editFormData, unitCost: parseFloat(editFormData.unitCost) || 0, cost: parseFloat(editFormData.cost) || 0, price: parseFloat(editFormData.price) || 0 });
        setEditingId(null);
    };
    const handleInputChange = (e) => setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
    const handleAddSubmit = (e) => {
        e.preventDefault();
        if (!newProduct.name || !newProduct.cost || !newProduct.price) return;
        onAddProduct({
            id: Date.now().toString(), name: newProduct.name, unitCost: parseFloat(newProduct.unitCost) || 0, cost: parseFloat(newProduct.cost), price: parseFloat(newProduct.price), vendor: newProduct.vendor, itemCode: newProduct.itemCode, category: newProduct.category || (activeCategory !== 'All' ? activeCategory : '')
        });
        setNewProduct({ name: '', unitCost: '', cost: '', price: '', vendor: '', itemCode: '', category: '' });
        setShowAddForm(false);
    };

    const styles = {
        container: { maxWidth: '1600px', margin: '0 auto', fontFamily: 'var(--font-base)', width: '100%', padding: '1.5rem' },
        card: { backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-card)', border: '1px solid var(--border-light)', overflow: 'hidden', marginBottom: '2rem' },
        controlBar: { padding: '1.5rem', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', flexWrap: 'wrap', gap: '1rem' },
        filterGroup: { display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: '1', minWidth: '200px' },
        label: { fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' },
        input: { padding: '0.6rem 1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.95rem', color: 'var(--text-primary)', transition: 'all 0.2s', outline: 'none' },
        btnPrimary: { padding: '0.6rem 1.25rem', backgroundColor: 'var(--primary-color)', color: '#ffffff', border: 'none', borderRadius: 'var(--radius-md)', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.2s' },
        btnOutline: { padding: '0.6rem 1.25rem', backgroundColor: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontWeight: 'bold', cursor: 'pointer' },
        table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
        th: { padding: '1rem', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', borderBottom: '1px solid var(--border-strong)' },
        td: { padding: '1rem', fontSize: '0.95rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-light)', verticalAlign: 'middle' },
        actionTextBtn: { background: 'none', border: 'none', color: 'var(--primary-color)', fontWeight: 'bold', cursor: 'pointer', padding: '0.25rem 0.5rem' },
        dangerTextBtn: { background: 'none', border: 'none', color: '#dc2626', fontWeight: 'bold', cursor: 'pointer', padding: '0.25rem 0.5rem' },
        badgeGreen: { backgroundColor: '#ecfdf5', color: '#059669', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 'bold' },
        badgeRed: { backgroundColor: '#fef2f2', color: '#dc2626', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 'bold' },
        groupRow: { backgroundColor: 'var(--bg-muted)', borderTop: '2px solid var(--border-light)', borderBottom: '1px solid var(--border-light)' },
        groupText: { fontWeight: 'bold', color: 'var(--dark-blue)', padding: '0.75rem 1rem', fontSize: '1.05rem' }
    };

    const renderProductRow = (product) => {
        const isEditing = editingId === product.id;
        let stratList = 0, stratNet = 0, stratMargin = 0;
        const currentMargin = calculateMargin(product.price, product.cost);

        if (previewTier.tier && pricingStrategy) {
            let groupName = product.category === 'Fasteners' ? `Fasteners:${getFastenerType(product.name)}` : (product.category || 'Default');
            stratList = calculateListPrice(product.cost, groupName, pricingStrategy.listMultipliers);
            stratNet = calculateNetPrice(stratList, previewTier.group, previewTier.tier, groupName, pricingStrategy);
            stratMargin = calculateMargin(stratNet, product.cost);
        } else { stratMargin = currentMargin; }

        return (
            <tr key={product.id}>
                {isEditing ? (
                    <>
                        <td style={styles.td}><select name="category" value={editFormData.category} onChange={handleInputChange} style={styles.input}>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></td>
                        <td style={styles.td}><input type="text" name="vendor" value={editFormData.vendor} onChange={handleInputChange} style={{...styles.input, width: '90px'}} /></td>
                        <td style={styles.td}><input type="text" name="itemCode" value={editFormData.itemCode} onChange={handleInputChange} style={{...styles.input, width: '100px'}} /></td>
                        <td style={styles.td}><input type="text" name="name" value={editFormData.name} onChange={handleInputChange} style={styles.input} autoFocus /></td>
                        <td style={styles.td}><input type="number" name="cost" value={editFormData.cost} onChange={handleInputChange} style={{...styles.input, width: '80px', textAlign: 'right'}} /></td>
                        <td style={styles.td}><input type="number" name="unitCost" value={editFormData.unitCost} onChange={handleInputChange} style={{...styles.input, width: '80px', textAlign: 'right'}} disabled /></td>
                        <td style={styles.td}><input type="number" name="price" value={editFormData.price} onChange={handleInputChange} style={{...styles.input, width: '80px', textAlign: 'right'}} /></td>
                        <td style={styles.td}>-</td>
                        {previewTier.tier && <><td colSpan="3" style={styles.td}>-</td></>}
                        <td style={{...styles.td, textAlign: 'center'}}>
                            <button onClick={() => handleSaveClick(product.id)} style={styles.actionTextBtn}>Save</button>
                            <button onClick={handleCancelEdit} style={styles.dangerTextBtn}>Cancel</button>
                        </td>
                    </>
                ) : (
                    <>
                        <td style={{...styles.td, color: 'var(--text-secondary)', fontSize: '0.85rem'}}>{product.category}</td>
                        <td style={{...styles.td, color: 'var(--text-secondary)', fontSize: '0.85rem'}}>{product.vendor}</td>
                        <td style={{...styles.td, fontFamily: 'monospace', color: 'var(--text-muted)'}}>{product.itemCode}</td>
                        <td style={{...styles.td, fontWeight: 'bold'}}>{product.name}</td>
                        <td style={{...styles.td, textAlign: 'right', fontWeight: '500'}}>{formatCurrency(product.cost)}</td>
                        <td style={{...styles.td, textAlign: 'right', color: 'var(--text-muted)'}}>{product.unitCost ? formatCurrency(product.unitCost) : '-'}</td>
                        <td style={{...styles.td, textAlign: 'right', fontWeight: 'bold'}}>{formatCurrency(product.price)}</td>
                        <td style={{...styles.td, textAlign: 'center'}}>
                            <span style={currentMargin < 0.2 ? styles.badgeRed : styles.badgeGreen}>{formatPercent(currentMargin)}</span>
                        </td>
                        {previewTier.tier && (
                            <>
                                <td style={{...styles.td, textAlign: 'right', fontWeight: '500', backgroundColor: '#f8fafc'}}>{formatCurrency(stratList)}</td>
                                <td style={{...styles.td, textAlign: 'right', fontWeight: 'bold', color: 'var(--primary-color)', backgroundColor: '#f8fafc'}}>{formatCurrency(stratNet)}</td>
                                <td style={{...styles.td, textAlign: 'right', backgroundColor: '#f8fafc'}}>
                                    <span style={stratMargin < 0.2 ? styles.badgeRed : styles.badgeGreen}>{formatPercent(stratMargin)}</span>
                                </td>
                            </>
                        )}
                        <td style={{...styles.td, textAlign: 'center'}}>
                            <button onClick={() => handleEditClick(product)} style={styles.actionTextBtn}>Edit</button>
                            <button onClick={() => onDeleteProduct(product.id)} style={styles.dangerTextBtn}>Delete</button>
                        </td>
                    </>
                )}
            </tr>
        );
    };

    const getGroupedOptions = () => {
        const relevantCats = new Set([...categories.map(c => c.name), ...products.map(p => p.category)]);
        const grouped = {}; const assigned = new Set();
        Object.entries(CATEGORY_GROUPS).forEach(([groupName, items]) => {
            grouped[groupName] = items.filter(i => relevantCats.has(i));
            items.forEach(i => assigned.add(i));
        });
        grouped['Parts & Accessories'] = [...relevantCats].filter(c => !assigned.has(c) && c !== 'All').sort();
        return grouped;
    };

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                {/* Control Header */}
                <div style={styles.controlBar}>
                    <div style={{ display: 'flex', gap: '1.5rem', flex: '2', flexWrap: 'wrap' }}>
                        <div style={styles.filterGroup}>
                            <label style={styles.label}>Category</label>
                            <select style={styles.input} value={activeCategory} onChange={(e) => setActiveCategory(e.target.value)}>
                                <option value="All">All Products</option>
                                {Object.entries(getGroupedOptions()).map(([group, items]) => items.length > 0 && (
                                    <optgroup key={group} label={group}>{items.map(cat => <option key={cat} value={cat}>{cat}</option>)}</optgroup>
                                ))}
                            </select>
                        </div>
                        <div style={styles.filterGroup}>
                            <label style={styles.label}>Search Components</label>
                            <input type="text" placeholder="Find by Name, Code..." style={styles.input} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-end', flex: '1', justifyContent: 'flex-end' }}>
                        <div style={styles.filterGroup}>
                            <label style={{...styles.label, color: 'var(--primary-color)'}}>Strategy Projection</label>
                            <select style={{...styles.input, backgroundColor: 'var(--primary-light)', borderColor: '#bfdbfe', fontWeight: 'bold', color: 'var(--dark-blue)'}} value={`${previewTier.group}|${previewTier.tier}`} onChange={(e) => {
                                const [g, t] = e.target.value.split('|'); setPreviewTier({ group: g, tier: t });
                            }}>
                                <option value="|">-- Active Real-world Data --</option>
                                <optgroup label="Dealer Tiers">{TIER_RULES[CUSTOMER_GROUPS.DEALER].map(t => <option key={t.name} value={`${CUSTOMER_GROUPS.DEALER}|${t.name}`}>{t.name}</option>)}</optgroup>
                                <optgroup label="Commercial Partners">{TIER_RULES[CUSTOMER_GROUPS.COMMERCIAL].map(t => <option key={t.name} value={`${CUSTOMER_GROUPS.COMMERCIAL}|${t.name}`}>{t.name}</option>)}</optgroup>
                            </select>
                        </div>
                        {!isManager && <button style={showAddForm ? styles.btnOutline : styles.btnPrimary} onClick={() => setShowAddForm(!showAddForm)}>{showAddForm ? 'Cancel Creation' : '+ Create Product'}</button>}
                    </div>
                </div>

                {/* Add Product Form */}
                {showAddForm && (
                    <div style={{ padding: '2rem', borderBottom: '1px solid var(--border-light)', backgroundColor: 'var(--bg-page)' }}>
                        <h4 style={{ margin: '0 0 1rem 0', fontFamily: 'var(--font-base)', color: 'var(--dark-blue)', fontSize: '1.25rem' }}>Add New Record</h4>
                        <form onSubmit={handleAddSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'end' }}>
                            <div style={styles.filterGroup}>
                                <label style={styles.label}>Categorization</label>
                                <select style={styles.input} value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}>
                                    <option value="">Select Category</option>
                                    {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                                </select>
                            </div>
                            <div style={styles.filterGroup}><label style={styles.label}>Vendor Brand</label><input type="text" style={styles.input} value={newProduct.vendor} onChange={(e) => setNewProduct({ ...newProduct, vendor: e.target.value })} /></div>
                            <div style={styles.filterGroup}><label style={styles.label}>SKU / Code</label><input type="text" style={styles.input} value={newProduct.itemCode} onChange={(e) => setNewProduct({ ...newProduct, itemCode: e.target.value })} /></div>
                            <div style={styles.filterGroup}><label style={styles.label}>Component Name</label><input type="text" style={styles.input} value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} required /></div>
                            <div style={styles.filterGroup}><label style={styles.label}>Bag Cost ($)</label><input type="number" step="0.0001" style={styles.input} value={newProduct.cost} onChange={(e) => setNewProduct({ ...newProduct, cost: e.target.value })} required /></div>
                            <div style={styles.filterGroup}><label style={styles.label}>List Price ($)</label><input type="number" step="0.0001" style={styles.input} value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} required /></div>
                            <button type="submit" style={styles.btnPrimary}>Create Record</button>
                        </form>
                    </div>
                )}

                {/* Data Table */}
                <div style={{ overflowX: 'auto', width: '100%' }}>
                    <table style={styles.table}>
                        <thead>
                            <tr style={{ backgroundColor: 'var(--bg-page)' }}>
                                <th style={{...styles.th, width: '12%'}}>Category</th>
                                <th style={{...styles.th, width: '8%'}}>Vendor</th>
                                <th style={{...styles.th, width: '10%'}}>SKU</th>
                                <th style={{...styles.th, width: '22%'}}>Asset Name</th>
                                {!isManager && <th style={{...styles.th, textAlign: 'right', width: '8%'}}>Cost</th>}
                                {!isManager && <th style={{...styles.th, textAlign: 'right', width: '8%'}}>Unit</th>}
                                <th style={{...styles.th, textAlign: 'right', width: '8%'}}>List Price</th>
                                <th style={{...styles.th, textAlign: 'center', width: '8%'}}>Margin</th>
                                {previewTier.tier && (
                                    <>
                                        <th style={{...styles.th, textAlign: 'right', backgroundColor: '#f8fafc', width: '9%'}}>Proj. List</th>
                                        {!isManager && <th style={{...styles.th, textAlign: 'right', backgroundColor: '#f8fafc', color: 'var(--primary-color)', width: '9%'}}>Proj. Net</th>}
                                        {!isManager && <th style={{...styles.th, textAlign: 'right', backgroundColor: '#f8fafc', width: '8%'}}>Strat. Margin</th>}
                                    </>
                                )}
                                {!isManager && <th style={{...styles.th, textAlign: 'center'}}>Actions</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredProducts.length === 0 ? (
                                <tr><td colSpan="12" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>No products match your current filters.</td></tr>
                            ) : (
                                (activeCategory.toLowerCase().includes('fastener') && FASTENER_TYPES) ? (
                                    [...new Set(filteredProducts.map(p => p.subCategory || 'Uncategorized'))].sort().map(subCat => {
                                        const subCatProducts = filteredProducts.filter(p => (p.subCategory || 'Uncategorized') === subCat);
                                        if (subCatProducts.length === 0) return null;
                                        return (
                                            <React.Fragment key={subCat}>
                                                <tr style={styles.groupRow}><td colSpan="12" style={styles.groupText}>{subCat}</td></tr>
                                                {FASTENER_TYPES.map(type => {
                                                    const groupItems = subCatProducts.filter(p => getFastenerType(p.name) === type);
                                                    if (groupItems.length === 0) return null;
                                                    return (
                                                        <React.Fragment key={type}>
                                                            <tr><td colSpan="12" style={{ padding: '0.5rem 1rem', backgroundColor: '#fafbfc', fontWeight: 'bold', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{type} Grouping</td></tr>
                                                            {groupItems.map(p => renderProductRow(p))}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </React.Fragment>
                                        );
                                    })
                                ) : (
                                    filteredProducts.map(p => renderProductRow(p))
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default PricingTable;

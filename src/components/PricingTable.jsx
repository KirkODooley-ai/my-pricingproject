import React, { useState } from 'react';
import { calculateMargin, formatCurrency, formatPercent, calculateListPrice, calculateNetPrice, CUSTOMER_GROUPS, TIER_RULES, calculateTier, getFastenerType, FASTENER_TYPES, CATEGORY_GROUPS } from '../utils/pricingEngine';
import { useAuth } from '../contexts/AuthContext';

const PricingTable = ({ products, categories = [], onUpdateProduct, onAddProduct, onDeleteProduct, pricingStrategy, salesTransactions = [], customers = [], customerAliases = {}, productVariants = [], onUpdateVariants = () => {} }) => {
    const { user } = useAuth();
    const isManager = user?.role === 'manager';
    const [editingId, setEditingId] = useState(null);
    const [activeCategory, setActiveCategory] = useState('All');
    const [searchTerm, setSearchTerm] = useState('');
    const [previewTier, setPreviewTier] = useState({ group: '', tier: '' });
    const [editFormData, setEditFormData] = useState({});
    
    // Variant state
    const [editingVariantId, setEditingVariantId] = useState(null);
    const [editVariantFormData, setEditVariantFormData] = useState({});
    const [expandedProducts, setExpandedProducts] = useState(new Set());

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

    const toggleExpand = (id) => {
        setExpandedProducts(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    const handleEditClick = (product) => { setEditingId(product.id); setEditFormData({ ...product }); };
    const handleCancelEdit = () => { setEditingId(null); setEditFormData({}); };
    const handleSaveClick = (id) => {
        onUpdateProduct(id, { ...editFormData, unitCost: parseFloat(editFormData.unitCost) || 0, cost: parseFloat(editFormData.cost) || 0, price: parseFloat(editFormData.price) || 0 });
        setEditingId(null);
    };
    
    const handleVariantEditClick = (variant) => { setEditingVariantId(variant.id); setEditVariantFormData({ ...variant }); };
    const handleVariantCancelEdit = () => { setEditingVariantId(null); setEditVariantFormData({}); };
    const handleVariantSaveClick = (id) => {
        const newCost = parseFloat(editVariantFormData.costOverride)
        const newPrice = parseFloat(editVariantFormData.priceOverride)
        onUpdateVariants(prev => prev.map(v => v.id === id ? { ...v, ...editVariantFormData, costOverride: isNaN(newCost) ? null : newCost, priceOverride: isNaN(newPrice) ? null : newPrice } : v));
        setEditingVariantId(null);
    };

    const handleVariantInputChange = (e) => setEditVariantFormData({ ...editVariantFormData, [e.target.name]: e.target.value });
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
        actionTextBtn: { background: 'none', border: 'none', color: '#2563EB', fontWeight: '600', cursor: 'pointer', padding: '0.25rem 0.5rem' },

        layoutGrid: { display: 'grid', gridTemplateColumns: '280px 1fr', gap: '2rem', alignItems: 'start' },
        card: { backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.03)', border: '1px solid rgba(15, 23, 42, 0.08)', overflow: 'hidden' },
        
        listHeader: { padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(15, 23, 42, 0.06)', backgroundColor: '#fafbfc', fontSize: '0.9rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' },
        listContainer: { maxHeight: 'calc(100vh - 250px)', overflowY: 'auto' },
        listItemActive: { padding: '1rem 1.5rem', cursor: 'pointer', backgroundColor: '#EFF6FF', borderLeft: '4px solid #2563EB', borderBottom: '1px solid #f1f5f9' },
        listItemInactive: { padding: '1rem 1.5rem', cursor: 'pointer', backgroundColor: 'white', borderLeft: '4px solid transparent', borderBottom: '1px solid #f1f5f9', transition: 'background 0.2s' },
        listName: { fontSize: '0.95rem', fontWeight: '500' },

        tableControlBar: { padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(15, 23, 42, 0.08)', backgroundColor: '#ffffff', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' },
        inputField: { padding: '0.6rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.95rem', color: '#0f172a', transition: 'all 0.2s', outline: 'none' },
        inputLabel: { display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' },

        table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
        th: { padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', borderBottom: '1px solid rgba(15, 23, 42, 0.08)' },
        td: { padding: '1rem 1.5rem', fontSize: '0.95rem', color: '#0f172a', borderBottom: '1px solid rgba(15, 23, 42, 0.04)', verticalAlign: 'middle' },
        badgeGreen: { backgroundColor: '#ecfdf5', color: '#059669', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '600' },
        badgeRed: { backgroundColor: '#fef2f2', color: '#dc2626', padding: '0.25rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '600' },
        groupRow: { backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', borderTop: '2px solid #e2e8f0' },
        groupText: { fontWeight: '600', color: '#334155', padding: '0.75rem 1.5rem', fontSize: '0.95rem' }
    };

    const getGroupedOptions = () => {
        const relevantCats = new Set([...categories.map(c => c.name), ...products.map(p => p.category)].filter(Boolean));
        const categoriesList = ['All', ...Array.from(relevantCats).sort()];
        return categoriesList;
    };

    const renderProductRow = (product) => {
        const isEditing = editingId === product.id;
        const variants = productVariants.filter(v => v.productId === product.id).sort((a,b) => b.gauge - a.gauge);
        const hasVariants = variants.length > 0;
        const isExpanded = expandedProducts.has(product.id);

        let stratList = 0, stratNet = 0, stratMargin = 0;
        const currentMargin = calculateMargin(product.price, product.cost);

        if (previewTier.tier && pricingStrategy) {
            let groupName = product.category === 'Fasteners' ? `Fasteners:${getFastenerType(product.name)}` : (product.category || 'Default');
            stratList = calculateListPrice(product.cost, groupName, pricingStrategy.listMultipliers);
            stratNet = calculateNetPrice(stratList, previewTier.group, previewTier.tier, groupName, pricingStrategy);
            stratMargin = calculateMargin(stratNet, product.cost);
        } else { stratMargin = currentMargin; }

        return (
            <React.Fragment key={product.id}>
            <tr style={{ backgroundColor: isExpanded ? '#fafbfc' : 'transparent'}}>
                {isEditing ? (
                    <>
                        <td style={styles.td}><select name="category" value={editFormData.category} onChange={handleInputChange} style={styles.inputField}>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></td>
                        <td style={styles.td}><input type="text" name="itemCode" value={editFormData.itemCode} onChange={handleInputChange} style={{...styles.inputField, width: '90px'}} /></td>
                        <td style={styles.td}><input type="text" name="name" value={editFormData.name} onChange={handleInputChange} style={styles.inputField} autoFocus /></td>
                        <td style={styles.td}><input type="number" name="cost" value={editFormData.cost} onChange={handleInputChange} style={{...styles.inputField, width: '80px', textAlign: 'right'}} /></td>
                        <td style={styles.td}><input type="number" name="price" value={editFormData.price} onChange={handleInputChange} style={{...styles.inputField, width: '80px', textAlign: 'right'}} /></td>
                        <td style={styles.td}>-</td>
                        {previewTier.tier && <><td colSpan="3" style={styles.td}>-</td></>}
                        <td style={{...styles.td, textAlign: 'center'}}>
                            <button onClick={() => handleSaveClick(product.id)} style={styles.actionTextBtn}>Save</button>
                            <button onClick={handleCancelEdit} style={styles.dangerTextBtn}>Cancel</button>
                        </td>
                    </>
                ) : (
                    <>
                        <td style={{...styles.td, color: '#64748b', fontSize: '0.85rem'}}>{product.category}</td>
                        <td style={{...styles.td, fontFamily: 'monospace', color: '#64748b'}}>{product.itemCode}</td>
                        <td style={{...styles.td, fontWeight: '500'}}>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                {hasVariants && (
                                    <button 
                                        onClick={() => toggleExpand(product.id)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '0.5rem', color: '#2563EB', fontSize: '0.75rem' }}
                                    >
                                        {isExpanded ? '▼' : '▶'}
                                    </button>
                                )}
                                {product.name}
                            </div>
                        </td>
                        <td style={{...styles.td, textAlign: 'right', fontWeight: '500'}}>{formatCurrency(product.cost)}</td>
                        <td style={{...styles.td, textAlign: 'right', fontWeight: '600'}}>{formatCurrency(product.price)}</td>
                        <td style={{...styles.td, textAlign: 'center'}}>
                            <span style={currentMargin < 0.2 ? styles.badgeRed : styles.badgeGreen}>{formatPercent(currentMargin)}</span>
                        </td>
                        {previewTier.tier && (
                            <>
                                <td style={{...styles.td, textAlign: 'right', fontWeight: '500', backgroundColor: '#f8fafc'}}>{formatCurrency(stratList)}</td>
                                <td style={{...styles.td, textAlign: 'right', fontWeight: '600', color: '#2563EB', backgroundColor: '#f8fafc'}}>{formatCurrency(stratNet)}</td>
                                <td style={{...styles.td, textAlign: 'center', backgroundColor: '#f8fafc'}}>
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

            {hasVariants && isExpanded && variants.map(variant => {
                    const isVarEditing = editingVariantId === variant.id;
                    const baseWeight = parseFloat(product.weight_lbs_ft) || 2.0;
                    const vWeight = parseFloat(variant.weight) || 0;
                    
                    let finalPrice = product.price;
                    let finalCost = product.cost;
                    
                    if (variant.priceOverride != null && variant.priceOverride > 0) finalPrice = parseFloat(variant.priceOverride);
                    else if (baseWeight > 0 && vWeight > 0) finalPrice = (parseFloat(product.price) || 0) * (vWeight / baseWeight);

                    if (variant.costOverride != null && variant.costOverride > 0) finalCost = parseFloat(variant.costOverride);
                    else if (baseWeight > 0 && vWeight > 0) finalCost = (parseFloat(product.cost) || 0) * (vWeight / baseWeight);
                    
                    const varMargin = calculateMargin(finalPrice, finalCost);
                    
                    let varStratList = 0, varStratNet = 0, varStratMargin = 0;
                    if (previewTier.tier && pricingStrategy) {
                        let groupName = product.category === 'Fasteners' ? `Fasteners:${getFastenerType(product.name)}` : (product.category || 'Default');
                        varStratList = calculateListPrice(finalCost, groupName, pricingStrategy.listMultipliers);
                        varStratNet = calculateNetPrice(varStratList, previewTier.group, previewTier.tier, groupName, pricingStrategy);
                        varStratMargin = calculateMargin(varStratNet, finalCost);
                    } else { varStratMargin = varMargin; }
                    
                    return (
                        <tr key={variant.id} style={{ backgroundColor: '#f8fafc', borderLeft: '3px solid #cbd5e1' }}>
                            {isVarEditing ? (
                                <>
                                    <td colSpan="3" style={{...styles.td, paddingLeft: '3rem'}}>
                                        <span style={{color: '#64748b', fontWeight: '500'}}>↳ {variant.gauge} Gauge Variant</span>
                                    </td>
                                    <td style={{...styles.td, textAlign: 'right'}}>
                                        <input type="number" name="costOverride" value={editVariantFormData.costOverride || ''} placeholder="Auto" onChange={handleVariantInputChange} style={{...styles.inputField, width: '80px', textAlign: 'right'}} />
                                    </td>
                                    <td style={{...styles.td, textAlign: 'right'}}>
                                        <input type="number" name="priceOverride" value={editVariantFormData.priceOverride || ''} placeholder="Auto" onChange={handleVariantInputChange} style={{...styles.inputField, width: '80px', textAlign: 'right'}} />
                                    </td>
                                    <td style={styles.td}></td>
                                    {previewTier.tier && <><td colSpan="3" style={styles.td}>-</td></>}
                                    <td style={{...styles.td, textAlign: 'center'}}>
                                        <button onClick={() => handleVariantSaveClick(variant.id)} style={styles.actionTextBtn}>Save</button>
                                        <button onClick={handleVariantCancelEdit} style={styles.dangerTextBtn}>Cancel</button>
                                    </td>
                                </>
                            ) : (
                                <>
                                    <td style={{...styles.td, paddingLeft: '3rem'}} colSpan="2">
                                        <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>↳ Variant: {variant.gauge} Gauge</span>
                                    </td>
                                    <td style={{...styles.td, color: '#64748b', fontSize: '0.85rem'}}>Weight: {vWeight.toFixed(2)} lbs/ft</td>
                                    <td style={{...styles.td, textAlign: 'right', fontWeight: '500', color: variant.costOverride ? '#0f172a' : '#94a3b8'}}>{formatCurrency(finalCost)}</td>
                                    <td style={{...styles.td, textAlign: 'right', fontWeight: '600', color: variant.priceOverride ? '#0f172a' : '#94a3b8'}}>{formatCurrency(finalPrice)}</td>
                                    <td style={{...styles.td, textAlign: 'center'}}><span style={varMargin < 0.2 ? styles.badgeRed : styles.badgeGreen}>{formatPercent(varMargin)}</span></td>
                                    
                                    {previewTier.tier && (
                                        <>
                                            <td style={{...styles.td, textAlign: 'right', fontWeight: '500', backgroundColor: '#e2e8f0'}}>{formatCurrency(varStratList)}</td>
                                            <td style={{...styles.td, textAlign: 'right', fontWeight: '600', color: '#2563EB', backgroundColor: '#e2e8f0'}}>{formatCurrency(varStratNet)}</td>
                                            <td style={{...styles.td, textAlign: 'center', backgroundColor: '#e2e8f0'}}><span style={varStratMargin < 0.2 ? styles.badgeRed : styles.badgeGreen}>{formatPercent(varStratMargin)}</span></td>
                                        </>
                                    )}
                                    <td style={{...styles.td, textAlign: 'center'}}>
                                        <button onClick={() => handleVariantEditClick(variant)} style={{...styles.actionTextBtn, fontSize: '0.8rem'}}>Override</button>
                                    </td>
                                </>
                            )}
                        </tr>
                    )
                })}
            </React.Fragment>
        );
    };

    const categorySidebarList = getGroupedOptions();

    return (
        <div style={styles.pageWrapper}>
            <div style={styles.container}>
                {/* Header Row */}
                <div style={styles.headerRow}>
                    <div>
                        <h2 style={styles.headerText}>Product Management</h2>
                        <p style={styles.subText}>Create, review, and manage inventory and pricing</p>
                    </div>

                    <div style={styles.headerActions}>
                        {!isManager && (
                            <button 
                                onClick={() => setShowAddForm(!showAddForm)}
                                style={showAddForm ? styles.outlineBtn : styles.primaryBtn}
                            >
                                {showAddForm ? 'Cancel Creation' : '+ Create Record'}
                            </button>
                        )}
                    </div>
                </div>

                <div style={styles.layoutGrid}>
                    {/* Sidebar: Categories */}
                    <div style={styles.card}>
                        <div style={styles.listHeader}>Product Lines</div>
                        <div style={styles.listContainer}>
                            {categorySidebarList.map(cat => (
                                <div 
                                    key={cat} 
                                    onClick={() => setActiveCategory(cat)} 
                                    style={activeCategory === cat ? styles.listItemActive : styles.listItemInactive}
                                >
                                    <div style={{...styles.listName, color: activeCategory === cat ? '#1e40af' : '#0f172a'}}>{cat}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Main Data Panel */}
                    <div style={styles.card}>
                        
                        {/* Table Controls (Search & Projection) */}
                        <div style={styles.tableControlBar}>
                            <div>
                                <label style={styles.inputLabel}>Search Library</label>
                                <input 
                                    type="text" 
                                    placeholder="Find by Name, Code..." 
                                    style={{...styles.inputField, width: '250px'}} 
                                    value={searchTerm} 
                                    onChange={(e) => setSearchTerm(e.target.value)} 
                                />
                            </div>

                            <div>
                                <label style={{...styles.inputLabel, color: '#2563EB'}}>Strategy Projection</label>
                                <select 
                                    style={{...styles.inputField, backgroundColor: '#EFF6FF', borderColor: '#bfdbfe', fontWeight: '600', color: '#1e40af', width: '220px'}} 
                                    value={`${previewTier.group}|${previewTier.tier}`} 
                                    onChange={(e) => {
                                        const [g, t] = e.target.value.split('|'); 
                                        setPreviewTier({ group: g, tier: t });
                                    }}
                                >
                                    <option value="|">-- Active Core Data --</option>
                                    <optgroup label="Dealer Tiers">
                                        {TIER_RULES[CUSTOMER_GROUPS.DEALER].map(t => <option key={t.name} value={`${CUSTOMER_GROUPS.DEALER}|${t.name}`}>{t.name}</option>)}
                                    </optgroup>
                                    <optgroup label="Commercial Partners">
                                        {TIER_RULES[CUSTOMER_GROUPS.COMMERCIAL].map(t => <option key={t.name} value={`${CUSTOMER_GROUPS.COMMERCIAL}|${t.name}`}>{t.name}</option>)}
                                    </optgroup>
                                </select>
                            </div>
                        </div>

                        {/* Add Form Insert */}
                        {showAddForm && (
                            <div style={{ padding: '2rem', borderBottom: '1px solid rgba(15, 23, 42, 0.08)', backgroundColor: '#f8fafc' }}>
                                <form onSubmit={handleAddSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'end' }}>
                                    <div><label style={styles.inputLabel}>Categorization</label><select style={styles.inputField} value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}><option value="">Select Category</option>{categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></div>
                                    <div><label style={styles.inputLabel}>SKU / Code</label><input type="text" style={styles.inputField} value={newProduct.itemCode} onChange={(e) => setNewProduct({ ...newProduct, itemCode: e.target.value })} /></div>
                                    <div><label style={styles.inputLabel}>Component Name</label><input type="text" style={styles.inputField} value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} required /></div>
                                    <div><label style={styles.inputLabel}>Cost ($)</label><input type="number" step="0.0001" style={styles.inputField} value={newProduct.cost} onChange={(e) => setNewProduct({ ...newProduct, cost: e.target.value })} required /></div>
                                    <div><label style={styles.inputLabel}>Price ($)</label><input type="number" step="0.0001" style={styles.inputField} value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} required /></div>
                                    <button type="submit" style={styles.primaryBtn}>Save</button>
                                </form>
                            </div>
                        )}

                        {/* Data Table Base */}
                        <div style={{ overflowX: 'auto' }}>
                            <table style={styles.table}>
                                <thead>
                                    <tr style={{ backgroundColor: '#fafbfc' }}>
                                        <th style={{...styles.th, width: '12%'}}>Category</th>
                                        <th style={{...styles.th, width: '10%'}}>SKU</th>
                                        <th style={{...styles.th, width: '22%'}}>Asset Name</th>
                                        {!isManager && <th style={{...styles.th, textAlign: 'right', width: '8%'}}>Cost</th>}
                                        <th style={{...styles.th, textAlign: 'right', width: '8%'}}>List Price</th>
                                        <th style={{...styles.th, textAlign: 'center', width: '8%'}}>Margin</th>
                                        {previewTier.tier && (
                                            <>
                                                <th style={{...styles.th, textAlign: 'right', backgroundColor: '#f8fafc', width: '9%'}}>Proj. List</th>
                                                {!isManager && <th style={{...styles.th, textAlign: 'right', backgroundColor: '#f8fafc', color: '#2563EB', width: '9%'}}>Proj. Net</th>}
                                                {!isManager && <th style={{...styles.th, textAlign: 'center', backgroundColor: '#f8fafc', width: '8%'}}>Strat. Margin</th>}
                                            </>
                                        )}
                                        {!isManager && <th style={{...styles.th, textAlign: 'center'}}>Actions</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredProducts.length === 0 ? (
                                        <tr><td colSpan="12" style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>No components match your active view criteria.</td></tr>
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
                                                                    <tr><td colSpan="12" style={{ padding: '0.5rem 1.5rem', backgroundColor: '#ffffff', fontWeight: '600', fontSize: '0.85rem', color: '#64748b' }}>{type} Class Grouping</td></tr>
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
            </div>
        </div>
    );
};

export default PricingTable;

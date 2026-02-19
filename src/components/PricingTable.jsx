import React, { useState } from 'react'
import { calculateMargin, formatCurrency, formatPercent, calculateListPrice, calculateNetPrice, CUSTOMER_GROUPS, TIER_RULES, calculateTier, getFastenerType, FASTENER_TYPES, CATEGORY_GROUPS, DEFAULT_CATEGORIES } from '../utils/pricingEngine'
import { useAuth } from '../contexts/AuthContext' // [NEW]
import './PricingTable.css'

const PricingTable = ({ products, categories = [], onUpdateProduct, onAddProduct, onDeleteProduct, pricingStrategy, salesTransactions = [], customers = [], customerAliases = {} }) => {
    const { user } = useAuth(); // [NEW]
    const isManager = user?.role === 'manager';
    const [editingId, setEditingId] = useState(null)
    const [activeCategory, setActiveCategory] = useState('All') // Filter: Category
    const [searchTerm, setSearchTerm] = useState('') // Filter: Text Search

    // [NEW] Preview State
    const [previewTier, setPreviewTier] = useState({ group: '', tier: '' }) // { group: 'Dealer', tier: 'Authorized Obsidian' }

    // Temporary state for the row being edited
    const [editFormData, setEditFormData] = useState({})

    // New Product Form State
    const [showAddForm, setShowAddForm] = useState(false)
    const [newProduct, setNewProduct] = useState({ name: '', unitCost: '', cost: '', price: '', vendor: '', itemCode: '', category: '' })

    // --- Filtering Logic ---
    const filteredProducts = products.filter(p => {
        // 1. Category Filter
        const catMatch = activeCategory === 'All' || p.category === activeCategory

        // 2. Search Filter (if active)
        if (!searchTerm) return catMatch

        const msg = searchTerm.toLowerCase()
        const textMatch = (
            (p.name || '').toLowerCase().includes(msg) ||
            (p.itemCode || '').toLowerCase().includes(msg) ||
            (p.vendor || '').toLowerCase().includes(msg) ||
            (p.subCategory || '').toLowerCase().includes(msg)
        )

        return catMatch && textMatch
    })


    // [FIX] Define categorySales at component level so it's accessible to ImpactAnalysis
    const categorySales = salesTransactions.filter(tx =>
        activeCategory === 'All' || tx.category === activeCategory
    )

    const handleEditClick = (product) => {
        setEditingId(product.id)
        setEditFormData({ ...product })
    }

    const handleCancelEdit = () => {
        setEditingId(null)
        setEditFormData({})
    }

    const handleSaveClick = (id) => {
        onUpdateProduct(id, {
            ...editFormData,
            unitCost: parseFloat(editFormData.unitCost) || 0,
            cost: parseFloat(editFormData.cost) || 0, // Bag Cost (Net Price)
            price: parseFloat(editFormData.price) || 0 // Bag Price (List Price)
        })
        setEditingId(null)
    }

    const handleInputChange = (e) => {
        const { name, value } = e.target
        setEditFormData({ ...editFormData, [name]: value })
    }

    const handleAddSubmit = (e) => {
        e.preventDefault()
        if (!newProduct.name || !newProduct.cost || !newProduct.price) return

        onAddProduct({
            id: Date.now().toString(),
            name: newProduct.name,
            unitCost: parseFloat(newProduct.unitCost) || 0,
            cost: parseFloat(newProduct.cost),
            price: parseFloat(newProduct.price),
            vendor: newProduct.vendor,
            itemCode: newProduct.itemCode,
            category: newProduct.category || (activeCategory !== 'All' ? activeCategory : '')
        })

        setNewProduct({ name: '', unitCost: '', cost: '', price: '', vendor: '', itemCode: '', category: '' })
        setShowAddForm(false)
    }

    const renderProductRow = (product) => {
        const isEditing = editingId === product.id

        // --- Strategy Calculations ---
        let stratList = 0
        let stratNet = 0
        let stratMargin = 0
        const currentMargin = calculateMargin(product.price, product.cost)

        if (previewTier.tier && pricingStrategy) {
            // Identify Group (Fasteners vs Other)
            let groupName = 'Default'
            if (product.category === 'Fasteners') {
                const type = getFastenerType(product.name)
                groupName = `Fasteners:${type}`
            } else {
                groupName = product.category || 'Default'
            }

            stratList = calculateListPrice(product.cost, groupName, pricingStrategy.listMultipliers)
            stratNet = calculateNetPrice(stratList, previewTier.group, previewTier.tier, groupName, pricingStrategy)
            stratMargin = calculateMargin(stratNet, product.cost)
        } else {
            stratMargin = currentMargin
        }

        return (
            <tr key={product.id}>
                {isEditing ? (
                    <>
                        <td>
                            <select name="category" value={editFormData.category} onChange={handleInputChange} className="input-field">
                                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                            </select>
                        </td>
                        <td><input type="text" name="vendor" value={editFormData.vendor} onChange={handleInputChange} className="input-field" /></td>
                        <td><input type="text" name="itemCode" value={editFormData.itemCode} onChange={handleInputChange} className="input-field" /></td>
                        <td><input type="text" name="name" value={editFormData.name} onChange={handleInputChange} className="input-field" autoFocus /></td>
                        <td><input type="number" name="cost" value={editFormData.cost} onChange={handleInputChange} className="input-field" style={{ textAlign: 'right' }} /></td>
                        <td><input type="number" name="unitCost" value={editFormData.unitCost} onChange={handleInputChange} className="input-field" style={{ textAlign: 'right' }} disabled title="Auto-calc" /></td>
                        <td><input type="number" name="price" value={editFormData.price} onChange={handleInputChange} className="input-field" style={{ textAlign: 'right' }} /></td>
                        <td style={{ textAlign: 'center', color: '#9ca3af' }}>-</td>
                        {previewTier.tier && (
                            <>
                                <td style={{ backgroundColor: '#eff6ff', borderLeft: '2px solid #ddd' }}>-</td>
                                <td style={{ backgroundColor: '#ecfdf5' }}>-</td>
                                <td style={{ backgroundColor: '#ecfdf5' }}>-</td>
                            </>
                        )}
                        <td style={{ textAlign: 'center' }}>
                            <button className="action-btn save-btn" onClick={() => handleSaveClick(product.id)}>Save</button>
                            <button className="action-btn delete-btn" onClick={handleCancelEdit}>Cancel</button>
                        </td>
                    </>
                ) : (
                    <>
                        <td style={{ color: '#6b7280', fontSize: '0.9rem' }}>{product.category}</td>
                        <td style={{ color: '#6b7280', fontSize: '0.9rem' }}>{product.vendor}</td>
                        <td style={{ color: '#6b7280', fontFamily: 'monospace' }}>{product.itemCode}</td>
                        <td style={{ fontWeight: 500 }}>{product.name}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(product.cost)}</td>
                        <td style={{ textAlign: 'right', color: '#6b7280' }}>
                            {product.unitCost ? formatCurrency(product.unitCost) : '-'} <span style={{ fontSize: '0.7em' }}>(Unit)</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(product.price)}</td>
                        <td style={{ textAlign: 'center' }}>
                            <span className={`badge ${currentMargin < 0.2 ? 'badge-red' : 'badge-green'}`}>
                                {formatPercent(currentMargin)}
                            </span>
                        </td>
                        {previewTier.tier && (
                            <>
                                <td style={{ textAlign: 'right', fontWeight: 600, color: '#2563eb', backgroundColor: '#eff6ff', borderLeft: '2px solid #ddd' }}>
                                    {formatCurrency(stratList)}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#059669', backgroundColor: '#ecfdf5' }}>
                                    {formatCurrency(stratNet)}
                                </td>
                                <td style={{ textAlign: 'right', color: stratMargin < 0.15 ? '#ef4444' : '#059669', backgroundColor: '#ecfdf5' }}>
                                    {formatPercent(stratMargin)}
                                </td>
                            </>
                        )}
                        <td style={{ textAlign: 'center' }}>
                            <button className="action-btn edit-btn" onClick={() => handleEditClick(product)}>Edit</button>
                            <button className="action-btn delete-btn" onClick={() => onDeleteProduct(product.id)}>Delete</button>
                        </td>
                    </>
                )}
            </tr>
        )
    }


    // --- Determine Grouped Options for Dropdown ---
    // We want to group categories based on CATEGORY_GROUPS constant
    // Any category in 'products' or 'categories' that isn't in a group goes to "Other"

    const getGroupedOptions = () => {
        const relevantCats = new Set([...categories.map(c => c.name), ...products.map(p => p.category)])
        const grouped = {}
        const assigned = new Set()

        // 1. Process Defined Groups
        Object.entries(CATEGORY_GROUPS).forEach(([groupName, items]) => {
            grouped[groupName] = items.filter(i => relevantCats.has(i))
            items.forEach(i => assigned.add(i))
        })

        // 2. Find Remaining "Parts / Other"
        const otherAndParts = [...relevantCats].filter(c => !assigned.has(c) && c !== 'All').sort()
        grouped['Parts & Accessories'] = otherAndParts

        return grouped
    }

    const groupedOptions = getGroupedOptions()


    return (
        <div className="pricing-table-container">
            {/* [NEW] Control Bar (Dropdown + Search + Strategy) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>

                {/* Left: Filter Controls */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexGrow: 1 }}>
                    {/* 1. Category Dropdown */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Category</label>
                        <select
                            className="input-field"
                            style={{ minWidth: '220px', fontWeight: 600 }}
                            value={activeCategory}
                            onChange={(e) => setActiveCategory(e.target.value)}
                        >
                            <option value="All">All Products</option>
                            {Object.entries(groupedOptions).map(([group, items]) => (
                                items.length > 0 && (
                                    <optgroup key={group} label={group}>
                                        {items.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </optgroup>
                                )
                            ))}
                        </select>
                    </div>

                    {/* 2. Search Input */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', flexGrow: 1, maxWidth: '400px' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Search</label>
                        <input
                            type="text"
                            placeholder="Find by Name, Code, or Vendor..."
                            className="input-field"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* Right: Strategy & Actions */}
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', paddingLeft: '2rem', borderLeft: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#2563eb', textTransform: 'uppercase' }}>Preview Strategy</label>
                        <select
                            className="input-field"
                            style={{ borderRadius: '6px', backgroundColor: '#eff6ff', borderColor: '#93c5fd' }}
                            value={`${previewTier.group}|${previewTier.tier}`}
                            onChange={(e) => {
                                const [g, t] = e.target.value.split('|')
                                setPreviewTier({ group: g, tier: t })
                            }}
                        >
                            <option value="|">-- Raw Data --</option>
                            <optgroup label="Dealer Tiers">
                                {TIER_RULES[CUSTOMER_GROUPS.DEALER].map(t => (
                                    <option key={t.name} value={`${CUSTOMER_GROUPS.DEALER}|${t.name}`}>{t.name}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Commercial Partners">
                                {TIER_RULES[CUSTOMER_GROUPS.COMMERCIAL].map(t => (
                                    <option key={t.name} value={`${CUSTOMER_GROUPS.COMMERCIAL}|${t.name}`}>{t.name}</option>
                                ))}
                            </optgroup>
                        </select>
                    </div>

                    {!isManager && (
                        <button className="add-btn" onClick={() => setShowAddForm(!showAddForm)} style={{ height: 'fit-content', alignSelf: 'flex-end', marginBottom: '2px' }}>
                            {showAddForm ? 'Cancel' : '+ Product'}
                        </button>
                    )}
                </div>
            </div>

            {showAddForm && (
                <form onSubmit={handleAddSubmit} className="add-form" style={{ margin: '1rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                    <h4>New Product</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem' }}>
                        <select
                            className="input-field"
                            value={newProduct.category}
                            onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                        >
                            <option value="">Select Category</option>
                            {/* Simple flat list for adding new products, or reused grouped logic */}
                            {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                        <input type="text" placeholder="Vendor" className="input-field" value={newProduct.vendor} onChange={(e) => setNewProduct({ ...newProduct, vendor: e.target.value })} />
                        <input type="text" placeholder="Item Code" className="input-field" value={newProduct.itemCode} onChange={(e) => setNewProduct({ ...newProduct, itemCode: e.target.value })} />
                        <input type="text" placeholder="Product Name" className="input-field" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} required />
                        <input type="number" step="0.0001" placeholder="Cost" className="input-field" value={newProduct.cost} onChange={(e) => setNewProduct({ ...newProduct, cost: e.target.value })} required />
                        <input type="number" step="0.0001" placeholder="Price" className="input-field" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: e.target.value })} required />
                    </div>
                    <button type="submit" className="action-btn save-btn" style={{ marginTop: '1rem' }}>Save Product</button>
                </form>
            )}

            {/* [NEW] Category Summary Stats (Actual Sales Data) */}
            {(() => {
                // 1. Calculate Actual Historical Totals for this Category (All Customers)
                const categorySales = salesTransactions.filter(tx =>
                    activeCategory === 'All' || tx.category === activeCategory
                )

                const totalRevenue = categorySales.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0)
                const totalCOGS = categorySales.reduce((sum, tx) => sum + (parseFloat(tx.cogs) || 0), 0)
                const totalMargin = totalRevenue > 0 ? (totalRevenue - totalCOGS) / totalRevenue : 0

                // 2. Strategy Logic (Preview)
                // We still need the 'Lift Multiplier' from the Product List to project changes
                let liftMultiplier = 1.0
                if (previewTier.tier && pricingStrategy) {
                    // Calculate the theoretical lift based on the product list (Basket Lift)
                    // This is used as a proxy for how much prices will increase/decrease
                    let sumListCost = 0
                    let sumListCurrPrice = 0
                    let sumListStratPrice = 0

                    filteredProducts.forEach(p => {
                        const cost = p.cost || 0
                        sumListCost += cost
                        sumListCurrPrice += (p.price || 0)

                        const groupName = p.category === 'Fasteners' ? 'Fasteners' : 'Default'
                        const list = calculateListPrice(cost, groupName, pricingStrategy.listMultipliers)
                        const net = calculateNetPrice(list, previewTier.group, previewTier.tier, groupName, pricingStrategy)
                        sumListStratPrice += net
                    })

                    if (sumListCurrPrice > 0) {
                        liftMultiplier = sumListStratPrice / sumListCurrPrice
                    }
                }

                return (
                    <div style={{
                        margin: '0 1rem 1rem 1rem',
                        padding: '1rem',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        display: 'flex',
                        gap: '3rem',
                        alignItems: 'flex-start',
                        fontSize: '0.9rem'
                    }}>
                        {/* LEFT: Global Category Performance (Actual History) */}
                        <div>
                            <span style={{ fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.05em' }}>
                                Total {activeCategory === 'All' ? 'Sales' : activeCategory} Spend
                            </span>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '1.5rem' }}>
                                <div>
                                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
                                        {formatCurrency(totalRevenue)}
                                    </span>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Last 12 Months</div>
                                </div>
                                <div>
                                    <span style={{ fontSize: '1.2rem', fontWeight: 600, color: totalMargin < 0.2 ? '#e11d48' : '#10b981' }}>
                                        {formatPercent(totalMargin)}
                                    </span>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Realized Margin</div>
                                </div>

                                {/* [NEW] Unclassified / Other Display */}
                                {(() => {
                                    // Calculate Unmatched (Other) Revenue
                                    const unmatchedRevenue = categorySales.reduce((sum, tx) => {
                                        const rawTxName = (tx.name || tx.customerName || '').trim()
                                        const aliasTarget = customerAliases && customerAliases[rawTxName]
                                        const effectiveName = (aliasTarget || rawTxName).toLowerCase()
                                        const normalize = (n) => n.replace(/ inc\.?| llc\.?| co\.?| ltd\.?| corp\.?/g, '').trim()

                                        // Quick Match Check
                                        const matched = customers.some(c => {
                                            const cName = (c.name || '').toLowerCase().trim()
                                            if (cName === effectiveName) return true
                                            const cleanCName = normalize(cName)
                                            const cleanTxName = normalize(effectiveName)
                                            if (cleanCName === cleanTxName) return true
                                            if (cleanTxName.length > 4 && cleanCName.includes(cleanTxName)) return true
                                            if (cleanCName.length > 4 && cleanTxName.includes(cleanCName)) return true
                                            return false
                                        })

                                        return !matched ? sum + (parseFloat(tx.amount) || 0) : sum
                                    }, 0)

                                    if (unmatchedRevenue <= 0) return null

                                    return (
                                        <div style={{ marginLeft: '1rem', paddingLeft: '1.5rem', borderLeft: '1px solid #e2e8f0' }}>
                                            <span style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f59e0b' }}>
                                                {formatCurrency(unmatchedRevenue)}
                                            </span>
                                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Unclassified (Other)</div>
                                        </div>
                                    )
                                })()}
                            </div>
                        </div>

                        {/* RIGHT: Tier Specific Projection */}
                        {previewTier.tier && (
                            <div style={{ paddingLeft: '2rem', borderLeft: '2px solid #cbd5e1', flexGrow: 1 }}>
                                <span style={{ fontWeight: 600, color: '#2563eb', display: 'block', marginBottom: '0.5rem', textTransform: 'uppercase', fontSize: '0.8rem', letterSpacing: '0.05em' }}>
                                    Impact Analysis: {previewTier.tier}
                                </span>

                                {(() => {
                                    // [NEW] 1. Calculate Real-Time Annual Spend for ALL Customers based on Sales Data
                                    // This prevents "Bronze" classification if customer record is outdated
                                    const customerSpendMap = new Map() // Normalized Name -> Total Spend

                                    // Iterate ALL sales (not just this category) to get total annual spend for tiering
                                    salesTransactions.forEach(tx => {
                                        const rawTxName = (tx.name || tx.customerName || '').trim()
                                        const aliasTarget = customerAliases && customerAliases[rawTxName]
                                        const effectiveName = (aliasTarget || rawTxName).toLowerCase().trim()

                                        // Find canonical customer to get their canonical Name
                                        // (We map by name string because we don't have IDs reliably linked yet)
                                        // Optimization: Pre-map customers for speed could be better, but this is safe
                                        const normalize = (n) => n.replace(/ inc\.?| llc\.?| co\.?| ltd\.?| corp\.?/g, '').trim()
                                        const cleanTx = normalize(effectiveName)

                                        const matchedCust = customers.find(c => {
                                            const cName = (c.name || '').toLowerCase().trim()
                                            if (cName === effectiveName) return true
                                            const cleanC = normalize(cName)
                                            return cleanC === cleanTx || (cleanC.length > 4 && cleanTx.includes(cleanC))
                                        })

                                        if (matchedCust) {
                                            const key = matchedCust.name
                                            const prev = customerSpendMap.get(key) || 0
                                            customerSpendMap.set(key, prev + (parseFloat(tx.amount) || 0))
                                        }
                                    })

                                    // Filter Sales for this specific Tier (Alias + Robust Matching)
                                    const tierSales = categorySales.filter(tx => {
                                        // 1. Prepare Transaction Name
                                        const rawTxName = (tx.name || tx.customerName || '').trim()

                                        // 2. Resolve Alias (Priority 1)
                                        // Use the manually mapped name if it exists (from Variance Report)
                                        const aliasTarget = customerAliases && customerAliases[rawTxName]
                                        const effectiveName = (aliasTarget || rawTxName).toLowerCase()

                                        // 3. Find Matching Customer
                                        const normalize = (n) => n.replace(/ inc\.?| llc\.?| co\.?| ltd\.?| corp\.?/g, '').trim()
                                        const cleanTxName = normalize(effectiveName)

                                        const customer = customers.find(c => {
                                            const cName = (c.name || '').toLowerCase().trim()

                                            // A. Exact Normalized Match
                                            if (cName === effectiveName) return true

                                            // B. Cleaned Match (No Inc/LLC)
                                            const cleanCName = normalize(cName)
                                            if (cleanCName === cleanTxName) return true

                                            // C. Substring (if distinct, >4 chars)
                                            if (cleanTxName.length > 4 && cleanCName.includes(cleanTxName)) return true
                                            if (cleanCName.length > 4 && cleanTxName.includes(cleanCName)) return true

                                            return false
                                        })

                                        if (!customer) return false
                                        if (customer.group !== previewTier.group) return false

                                        // [FIX] Use Customer Card Priority & Correct Arg Order
                                        const calculationSpend = customer.annualSpend || customerSpendMap.get(customer.name) || 0
                                        const t = calculateTier(customer.group, calculationSpend)

                                        return t === previewTier.tier
                                    })

                                    const tierHistRev = tierSales.reduce((sum, tx) => sum + (parseFloat(tx.amount) || 0), 0)
                                    const tierProjRev = tierHistRev * liftMultiplier
                                    const diff = tierProjRev - tierHistRev

                                    // Top Contributors & Customer Count
                                    const contributors = tierSales.reduce((acc, tx) => {
                                        const name = tx.name || tx.customerName || 'Unknown'
                                        acc[name] = (acc[name] || 0) + parseFloat(tx.amount || 0)
                                        return acc
                                    }, {})
                                    const uniqueCustomers = Object.keys(contributors).length
                                    const topContrib = Object.entries(contributors).sort(([, a], [, b]) => b - a).slice(0, 3)

                                    return (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '0.5rem 2rem', alignItems: 'center' }}>
                                                <span style={{ color: '#64748b' }}>Historical Volume:</span>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{formatCurrency(tierHistRev)}</span>
                                                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                        (from {uniqueCustomers} matched customers)
                                                    </span>
                                                </div>

                                                <span style={{ color: '#2563eb' }}>Projected Volume:</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '1.1rem', color: '#2563eb' }}>{formatCurrency(tierProjRev)}</span>
                                                    <span style={{ fontSize: '0.85em', fontWeight: 600, color: diff > 0 ? '#10b981' : '#e11d48', padding: '2px 6px', borderRadius: '4px', backgroundColor: diff > 0 ? '#d1fae5' : '#fee2e2' }}>
                                                        {diff > 0 ? '+' : ''}{formatCurrency(diff)} ({formatPercent((diff / tierHistRev) || 0)})
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Contributors Mini-List */}
                                            {tierHistRev > 0 && (
                                                <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'right' }}>
                                                    <strong>Top Customers:</strong>
                                                    {topContrib.map(([n, v]) => (
                                                        <div key={n}>{n} ({formatCurrency(v)})</div>
                                                    ))}
                                                </div>
                                            )}
                                            {tierHistRev === 0 && (
                                                <div style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '0.85rem' }}>
                                                    No historical sales found for this tier.

                                                    {/* [NEW] Data Match Diagnostics */}
                                                    {categorySales.length > 0 && (
                                                        <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '4px', color: '#1e40af', fontSize: '0.75rem' }}>
                                                            <strong>Tier Status:</strong> No customers currently qualify for {previewTier.tier}.<br />

                                                            {(() => {
                                                                // Debug Matching
                                                                // [NEW] Recalculate Real-Time Spend for Diagnostic Reliability
                                                                const customerSpendMap = new Map()
                                                                salesTransactions.forEach(tx => {
                                                                    const rawTxName = (tx.name || tx.customerName || '').trim()
                                                                    const aliasTarget = customerAliases && customerAliases[rawTxName]
                                                                    const effectiveName = (aliasTarget || rawTxName).toLowerCase().trim()
                                                                    const normalize = (n) => n.replace(/ inc\.?| llc\.?| co\.?| ltd\.?| corp\.?/g, '').trim()
                                                                    const cleanTx = normalize(effectiveName)

                                                                    const matchedCust = customers.find(c => {
                                                                        const cName = (c.name || '').toLowerCase().trim()
                                                                        if (cName === effectiveName) return true
                                                                        const cleanC = normalize(cName)
                                                                        return cleanC === cleanTx || (cleanC.length > 4 && cleanTx.includes(cleanC))
                                                                    })

                                                                    if (matchedCust) {
                                                                        const key = matchedCust.name
                                                                        const prev = customerSpendMap.get(key) || 0
                                                                        customerSpendMap.set(key, prev + (parseFloat(tx.amount) || 0))
                                                                    }
                                                                })

                                                                // [FIX] Use Maps for correct get/set and deduplication
                                                                let matches = 0
                                                                let unmatchedNames = new Map()
                                                                let matchedToOtherTier = new Map()

                                                                categorySales.forEach(tx => {
                                                                    const rawTxName = (tx.name || tx.customerName || '').trim()

                                                                    // Resolve Alias for Diagnostic
                                                                    const aliasTarget = customerAliases && customerAliases[rawTxName]
                                                                    const effectiveName = (aliasTarget || rawTxName).toLowerCase()

                                                                    const normalize = (n) => n.replace(/ inc\.?| llc\.?| co\.?| ltd\.?| corp\.?/g, '').trim()
                                                                    const cleanTxName = normalize(effectiveName)

                                                                    const customer = customers.find(c => {
                                                                        const cName = (c.name || '').toLowerCase().trim()
                                                                        if (cName === effectiveName) return true
                                                                        const cleanCName = normalize(cName)
                                                                        if (cleanCName === cleanTxName) return true
                                                                        if (cleanTxName.length > 4 && cleanCName.includes(cleanTxName)) return true
                                                                        if (cleanCName.length > 4 && cleanTxName.includes(cleanCName)) return true
                                                                        return false
                                                                    })

                                                                    if (customer) {
                                                                        if (customer.group === previewTier.group) {
                                                                            const realTimeSpend = customer.annualSpend || customerSpendMap.get(customer.name) || 0
                                                                            const t = calculateTier(customer.group, realTimeSpend)

                                                                            if (t === previewTier.tier) matches++
                                                                            else {
                                                                                const spend = formatCurrency(realTimeSpend)
                                                                                // Use Map to deduplicate by customer name
                                                                                matchedToOtherTier.set(customer.name, { name: customer.name, tier: t, spend: realTimeSpend, label: `${customer.name} (${t} - ${spend})` })
                                                                            }
                                                                        } else {
                                                                            matchedToOtherTier.set(customer.name, { name: customer.name, tier: customer.group, spend: 0, label: `${customer.name} (${customer.group})` })
                                                                        }
                                                                    } else {
                                                                        // Track Unmatched Value
                                                                        const val = unmatchedNames.get(rawTxName) || 0
                                                                        unmatchedNames.set(rawTxName, val + (parseFloat(tx.amount) || 0))
                                                                    }
                                                                })

                                                                // Sort by Value
                                                                const unknownList = Array.from(unmatchedNames.entries())
                                                                    .sort(([, a], [, b]) => b - a)
                                                                    .slice(0, 3)
                                                                    .map(([n, v]) => `${n} (${formatCurrency(v)})`)
                                                                    .join(', ')

                                                                const otherTierList = Array.from(matchedToOtherTier.values())
                                                                    .sort((a, b) => b.spend - a.spend)
                                                                    .slice(0, 3)
                                                                    .map(item => item.label)
                                                                    .join(', ')

                                                                return (
                                                                    <>
                                                                        {unmatchedNames.size > 0 && (
                                                                            <div style={{ marginBottom: '0.5rem' }}>
                                                                                <span style={{ fontWeight: 600 }}>• {unmatchedNames.size} transactions are Unclassified.</span><br />
                                                                                <span style={{ color: '#be123c' }}>To fix: Link "{unknownList}..." to a Customer (e.g. "Employees") in the Variance Report.</span>
                                                                            </div>
                                                                        )}
                                                                        {matchedToOtherTier.size > 0 && matches > 0 && (
                                                                            <div>
                                                                                <span style={{ fontWeight: 600 }}>• Found matches in other tiers:</span><br />
                                                                                <span>{otherTierList}...</span>
                                                                            </div>
                                                                        )}
                                                                        {matchedToOtherTier.size === 0 && unmatchedNames.size === 0 && (
                                                                            <span>• All customers matched but fall into different tiers or groups.</span>
                                                                        )}
                                                                    </>
                                                                )
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )
                                })()}
                            </div>
                        )}
                    </div>
                )
            })()}

            <div className="table-wrapper">
                <table className="pricing-table">
                    <thead>
                        <tr>
                            <th style={{ width: '12%' }}>Category</th>
                            <th style={{ width: '10%' }}>Vendor</th>
                            <th style={{ width: '10%' }}>Code</th>
                            <th style={{ width: '20%' }}>Name</th>
                            {!isManager && <th style={{ width: '8%', textAlign: 'right' }}>Base Cost</th>}
                            {!isManager && <th style={{ width: '8%', textAlign: 'right' }}>Unit Cost</th>}
                            <th style={{ width: '8%', textAlign: 'right' }}>Current Price</th>
                            <th style={{ width: '8%', textAlign: 'center' }}>Margin (Curr)</th>

                            {/* [NEW] Dynamic Strategy Headers */}
                            {previewTier.tier && (
                                <>
                                    <th style={{ width: '9%', textAlign: 'right', color: '#2563eb', backgroundColor: '#eff6ff', borderLeft: '2px solid #ddd' }}>Strat List</th>
                                    {!isManager && <th style={{ width: '9%', textAlign: 'right', color: '#059669', backgroundColor: '#ecfdf5' }}>Net ({previewTier.tier})</th>}
                                    {!isManager && <th style={{ width: '7%', textAlign: 'right', color: '#059669', backgroundColor: '#ecfdf5' }}>Strat Margin</th>}
                                </>
                            )}

                            {!isManager && <th style={{ width: '10%', textAlign: 'center' }}>Actions</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredProducts.length === 0 ? (
                            <tr><td colSpan="13" style={{ textAlign: 'center', padding: '2rem' }}>No products found matching your criteria.</td></tr>
                        ) : (
                            // [FIX] Ensure Grouping persists even if Preview is active
                            (activeCategory.toLowerCase().includes('fastener') && FASTENER_TYPES) ? (
                                (() => {
                                    // 1. Identify Unique Sub-Categories
                                    const availableSubCats = [...new Set(filteredProducts.map(p => p.subCategory || 'Uncategorized'))]
                                        .sort((a, b) => a.localeCompare(b))

                                    return availableSubCats.map(subCat => {
                                        // 2. Filter for this Sub-Category
                                        const subCatProducts = filteredProducts.filter(p => (p.subCategory || 'Uncategorized') === subCat)
                                        if (subCatProducts.length === 0) return null

                                        return (
                                            <React.Fragment key={subCat}>
                                                {/* LEVEL 1 HEADER: Sub-Category */}
                                                <tr style={{ backgroundColor: '#e2e8f0', borderTop: '2px solid #94a3b8' }}>
                                                    <td colSpan="13" style={{ padding: '0.75rem 1rem', fontWeight: 800, color: '#1e293b', fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                        {subCat}
                                                    </td>
                                                </tr>

                                                {/* LEVEL 2: Fastener Types */}
                                                {FASTENER_TYPES.map(type => {
                                                    const groupItems = subCatProducts.filter(p => getFastenerType(p.name) === type)
                                                    if (groupItems.length === 0) return null

                                                    // Calculate Stats (Min/Max/Avg Margin AND Price)
                                                    let minMargin = 1.0
                                                    let maxMargin = -1.0
                                                    let sumMargin = 0

                                                    let minPrice = Infinity
                                                    let maxPrice = -Infinity
                                                    let sumPrice = 0

                                                    let validCount = 0

                                                    // [FIX] Pre-calculate margins securely for stats
                                                    groupItems.forEach(p => {
                                                        let margin = 0
                                                        let price = 0 // The price used for stats (List or Net)

                                                        if (previewTier.tier && pricingStrategy) {
                                                            // Strategy Calculation for Aggregates
                                                            const subKey = `Fasteners:${type}`
                                                            const stratList = calculateListPrice(p.cost, subKey, pricingStrategy.listMultipliers) || 0
                                                            const stratNet = calculateNetPrice(stratList, previewTier.group, previewTier.tier, subKey, pricingStrategy) || 0

                                                            margin = calculateMargin(stratNet, p.cost)
                                                            price = stratNet // Preview Mode: Use Net Price
                                                        } else {
                                                            margin = calculateMargin(p.price, p.cost)
                                                            price = p.price // Raw Mode: Use List Price
                                                        }

                                                        // Safety check for valid margin
                                                        if (!isNaN(margin)) {
                                                            if (margin < minMargin) minMargin = margin
                                                            if (margin > maxMargin) maxMargin = margin
                                                            sumMargin += margin

                                                            // Price Stats
                                                            if (price < minPrice) minPrice = price
                                                            if (price > maxPrice) maxPrice = price
                                                            sumPrice += price

                                                            validCount++
                                                        }
                                                    })

                                                    // Handle empty valid counts
                                                    if (validCount === 0) {
                                                        minMargin = 0; maxMargin = 0;
                                                        minPrice = 0; maxPrice = 0;
                                                    }

                                                    const avgMargin = validCount > 0 ? sumMargin / validCount : 0
                                                    const avgPrice = validCount > 0 ? sumPrice / validCount : 0

                                                    return (
                                                        <React.Fragment key={type}>
                                                            {/* LEVEL 2 HEADER: Type */}
                                                            <tr style={{ backgroundColor: '#f1f5f9', borderTop: '1px solid #cbd5e1', borderBottom: '1px solid #e2e8f0' }}>
                                                                <td colSpan="13" style={{ padding: '0.5rem 1rem 0.5rem 2rem', fontWeight: 700, color: '#334155', fontSize: '0.95rem' }}>
                                                                    {type} <span style={{ fontWeight: 400, color: '#64748b', fontSize: '0.85rem' }}>({groupItems.length} items)</span>
                                                                </td>
                                                            </tr>

                                                            {/* ITEMS */}
                                                            {groupItems.map(p => renderProductRow(p))}

                                                            {/* GROUP FOOTER (STATS) */}
                                                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
                                                                {/* 1. Indent (Skip Category, Vendor, Code) -> 3 Columns */}
                                                                <td colSpan="3" style={{ borderRight: 'none' }}></td>

                                                                {/* 2. Stats Content (Spans Name + Data Cols) */}
                                                                <td colSpan={previewTier.tier ? 8 : 5} style={{ padding: '0.75rem 1rem', borderLeft: 'none' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4rem' }}>
                                                                        <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                                            {type} Averages:
                                                                        </span>

                                                                        {/* Price Stats */}
                                                                        <div style={{ display: 'flex', gap: '2rem', paddingRight: '2rem', borderRight: '1px solid #e2e8f0' }}>
                                                                            <div style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                                                <span style={{ color: '#64748b' }}>Min Price:</span> <span style={{ fontWeight: 600, color: '#334155', marginLeft: '0.5rem' }}>{formatCurrency(minPrice)}</span>
                                                                            </div>
                                                                            <div style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                                                <span style={{ color: '#64748b' }}>Max:</span> <span style={{ fontWeight: 600, marginLeft: '0.5rem' }}>{formatCurrency(maxPrice)}</span>
                                                                            </div>
                                                                            <div style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                                                <span style={{ color: '#64748b' }}>Avg:</span> <span style={{ fontWeight: 700, color: '#0f172a', marginLeft: '0.5rem' }}>{formatCurrency(avgPrice)}</span>
                                                                            </div>
                                                                        </div>

                                                                        {/* Margin Stats */}
                                                                        <div style={{ display: 'flex', gap: '3rem' }}>
                                                                            <div style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                                                <span style={{ color: '#64748b' }}>Min Margin:</span> <span style={{ fontWeight: 600, color: minMargin < 0.15 ? '#ef4444' : '#334155', marginLeft: '0.5rem' }}>{formatPercent(minMargin)}</span>
                                                                            </div>
                                                                            <div style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                                                <span style={{ color: '#64748b' }}>Max:</span> <span style={{ fontWeight: 600, marginLeft: '0.5rem' }}>{formatPercent(maxMargin)}</span>
                                                                            </div>
                                                                            <div style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                                                <span style={{ color: '#64748b' }}>Avg:</span> <span style={{ fontWeight: 700, color: '#2563eb', marginLeft: '0.5rem' }}>{formatPercent(avgMargin)}</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </td>

                                                                {/* 3. Actions Column Placeholder */}
                                                                <td></td>
                                                            </tr>
                                                        </React.Fragment>
                                                    )
                                                })}
                                            </React.Fragment>
                                        )
                                    })
                                })()
                            ) : (
                                filteredProducts.map(p => renderProductRow(p))
                            )
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export default PricingTable

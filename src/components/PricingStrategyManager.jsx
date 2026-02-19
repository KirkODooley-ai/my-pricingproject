import React, { useState } from 'react'
import { CUSTOMER_GROUPS, TIER_RULES, FASTENER_TYPES, getCategoryGroup, getMarginFloor, enforceTierHierarchy, getListMultiplier } from '../utils/pricingEngine'
import './PricingTable.css'

const PricingStrategyManager = ({ strategy, setStrategy, categories, salesTransactions, customers, products = [], productVariants = [], onSave }) => {

    // --- UI State ---
    const [activeTab, setActiveTab] = useState('markup') // 'markup' | 'discounts'
    const [discountActiveGroup, setDiscountActiveGroup] = useState(CUSTOMER_GROUPS.DEALER)
    const [expandedFasteners, setExpandedFasteners] = useState(false)
    const [expandedMarkupCats, setExpandedMarkupCats] = useState({}) // For Variants toggling in Markup Tab

    // --- Data Processing: Map Category -> Variants ---
    const categoryVariantsMap = React.useMemo(() => {
        const map = {}
        // Process product variants
        productVariants.forEach(variant => {
            const product = products.find(p => p.id === variant.productId)
            if (product && product.categoryId) {
                // Find category name
                const cat = categories.find(c => c.id === product.categoryId)
                const catName = cat ? cat.name : product.categoryId // fallback

                if (catName) {
                    if (!map[catName]) map[catName] = new Set()
                    if (variant.gauge) map[catName].add(variant.gauge)
                }
            }
        })
        // Convert Sets to Arrays and sorting
        Object.keys(map).forEach(k => {
            map[k] = Array.from(map[k]).sort((a, b) => parseFloat(b) - parseFloat(a)) // Sort Desc (29, 26, 24)
        })
        return map
    }, [products, productVariants, categories])

    // --- Handlers ---
    const handleListMultiplierChange = (group, value) => {
        const val = parseFloat(value)
        if (isNaN(val) || val < 0) return
        setStrategy(prev => ({
            ...prev,
            listMultipliers: { ...prev.listMultipliers, [group]: val }
        }))
    }

    const handleTierDiscountChange = (groupType, tierName, productGroup, value) => {
        const val = parseFloat(value)
        if (isNaN(val) || val < 0) return
        setStrategy(prev => {
            const groupTiers = prev.tierMultipliers[groupType] || {}
            const tierConfig = groupTiers[tierName] || {}
            return {
                ...prev,
                tierMultipliers: {
                    ...prev.tierMultipliers,
                    [groupType]: {
                        ...groupTiers,
                        [tierName]: { ...tierConfig, [productGroup]: val }
                    }
                }
            }
        })
    }
    // --- Auto-Calculation Logic ---
    const handleAutoCalculate = () => {
        if (!salesTransactions || salesTransactions.length === 0) {
            alert("No sales data available to analyze.")
            return
        }

        const confirmCalc = window.confirm(
            "This will OVERWRITE your current discount settings based on your sales history.\n\n" +
            "Logic: For each Category & Tier, calculate the effective discount needed to match your historical pricing against a 3.0x multiplier.\n\n" +
            "Are you sure?"
        )
        if (!confirmCalc) return

        // [NEW] Use Centralized Logic Utility
        // This ensures consistent handling of Small Rolled Panels, Parts, Cladding, and Tier Hierarchy.
        import('../utils/pricingEngine').then(({ calculateAutoDiscounts }) => {
            const finalStrategy = calculateAutoDiscounts(strategy, salesTransactions, customers, categories)

            setStrategy(finalStrategy)
            alert("SUCCESS: Values updated. Parts/Fasteners should now show scaling starts at Floor (e.g. 0.56, 0.58, 0.60).")
        })
    }
    // We want to group categories: { "Large Rolled Panel": [cat1, cat2], ... }
    const groupedCategories = categories.reduce((acc, cat) => {
        const group = getCategoryGroup(cat.name) // Use helper
        if (!acc[group]) acc[group] = []
        acc[group].push(cat.name)
        return acc
    }, {})

    // Sort Groups (Custom Order if needed, else Alphabetical)
    const groupOrder = ['Large Rolled Panel', 'Small Rolled Panels', 'Cladding Series', 'Parts'] // Match CategoryManager
    // catch-alls
    Object.keys(groupedCategories).forEach(g => {
        if (!groupOrder.includes(g)) groupOrder.push(g)
    })

    // --- Styles ---
    // Moved to Global CSS (.nav-link, .btn, .pricing-table)

    return (
        <div className="card" style={{ maxWidth: '100%', margin: '0 0 4rem 0' }}>

            {/* Header */}
            <div style={{ marginBottom: '2rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: '1rem' }}>
                <div>
                    <h2 className="heading-lg">Pricing Strategy</h2>
                    <p style={{ color: 'var(--text-light)', marginTop: '0.25rem' }}>Configure global markups and customer tier discounts.</p>
                </div>
                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '1rem' }}>
                    {/* [NEW] Save Button */}
                    <button
                        className="btn btn-primary"
                        onClick={onSave}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: '#10b981', borderColor: '#059669', color: 'white' }}
                    >
                        <span>💾</span> Save Changes
                    </button>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            className={`btn ${activeTab === 'markup' ? 'btn-primary' : 'btn-ghost'}`}
                            style={{
                                backgroundColor: activeTab === 'markup' ? 'var(--accent-color)' : 'transparent',
                                color: activeTab === 'markup' ? '#fff' : 'var(--text-light)',
                                fontWeight: activeTab === 'markup' ? 600 : 500
                            }}
                            onClick={() => setActiveTab('markup')}
                        >
                            1. Base Markup
                        </button>
                        <button
                            className={`btn ${activeTab === 'discounts' ? 'btn-primary' : 'btn-ghost'}`}
                            style={{
                                backgroundColor: activeTab === 'discounts' ? 'var(--accent-color)' : 'transparent',
                                color: activeTab === 'discounts' ? '#fff' : 'var(--text-light)',
                                fontWeight: activeTab === 'discounts' ? 600 : 500
                            }}
                            onClick={() => setActiveTab('discounts')}
                        >
                            2. Tier Discounts
                        </button>
                    </div>
                </div>
            </div>

            {/* --- TAB 1: MARKUP --- */}
            {activeTab === 'markup' && (
                <div style={{ animation: 'fadeIn 0.3s' }}>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <h3 className="heading-md" style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Category List Price Multipliers</h3>
                        <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>
                            Multiplier applied to Base Cost to determine List Price. (e.g. 1.5 = 50% Margin)
                        </p>
                    </div>

                    <table className="pricing-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40%' }}>Product Category</th>
                                <th style={{ textAlign: 'right', width: '20%' }}>Base Multiplier</th>
                                <th style={{ textAlign: 'right' }}>Calculated Example ($100 Cost)</th>
                            </tr>
                        </thead>
                        {groupOrder.map(groupName => {
                            const cats = groupedCategories[groupName]
                            if (!cats) return null

                            return (
                                <tbody key={groupName}>
                                    {/* Group Header */}
                                    <tr>
                                        <td colSpan={3} style={{ backgroundColor: '#f1f5f9', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.8rem', color: '#475569', padding: '0.75rem 1rem' }}>
                                            {groupName}
                                        </td>
                                    </tr>
                                    {/* Category Rows */}
                                    {cats.sort().map(catName => {
                                        const variants = categoryVariantsMap[catName] || []
                                        const hasVariants = variants.length > 0
                                        const isExpanded = expandedMarkupCats[catName]

                                        return (
                                            <React.Fragment key={catName}>
                                                <tr>
                                                    <td style={{ fontWeight: 600, paddingLeft: '0.5rem' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            {/* Chevron or Spacer */}
                                                            {hasVariants ? (
                                                                <button
                                                                    onClick={() => setExpandedMarkupCats(prev => ({ ...prev, [catName]: !prev[catName] }))}
                                                                    style={{
                                                                        background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center',
                                                                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease'
                                                                    }}
                                                                >
                                                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                        <polyline points="9 18 15 12 9 6"></polyline>
                                                                    </svg>
                                                                </button>
                                                            ) : (
                                                                <div style={{ width: '24px' }}></div>
                                                            )}

                                                            <span>{catName}</span>

                                                            {catName === 'Fasteners' && (
                                                                <span className="link-action" onClick={() => setExpandedFasteners(!expandedFasteners)} style={{ marginLeft: '10px', fontSize: '0.8rem', color: 'var(--accent-color)', cursor: 'pointer' }}>
                                                                    {expandedFasteners ? 'Hide Types' : 'Show Types'}
                                                                </span>
                                                            )}
                                                            {hasVariants && !isExpanded && (
                                                                <span
                                                                    onClick={() => setExpandedMarkupCats(prev => ({ ...prev, [catName]: !prev[catName] }))}
                                                                    style={{ fontSize: '0.75rem', color: '#94a3b8', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', marginLeft: 'auto' }}
                                                                >
                                                                    + {variants.length} Gauges
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <input
                                                            type="number" step="0.05"
                                                            className="input-field"
                                                            style={{ width: '100px', textAlign: 'right' }}
                                                            value={strategy.listMultipliers[catName] || 1.5}
                                                            onChange={(e) => handleListMultiplierChange(catName, e.target.value)}
                                                        />
                                                    </td>
                                                    <td style={{ textAlign: 'right', color: 'var(--text-light)' }}>
                                                        ${(100 * (strategy.listMultipliers[catName] || 1.5)).toFixed(2)}
                                                    </td>
                                                </tr>
                                                {/* Variant Sub-Rows (Markup) */}
                                                {hasVariants && isExpanded && variants.map((gauge, idx) => {
                                                    const variantKey = `${catName}:${gauge}`
                                                    const explicitVal = strategy.listMultipliers[variantKey]
                                                    const defaultVal = strategy.listMultipliers[catName] || 1.5
                                                    const currentVal = explicitVal !== undefined ? explicitVal : defaultVal
                                                    const isOverridden = explicitVal !== undefined
                                                    const isLast = idx === variants.length - 1

                                                    return (
                                                        <tr key={variantKey} className="variant-row" style={{ backgroundColor: '#f8fafc' }}>
                                                            <td style={{ padding: 0 }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', height: '100%', paddingLeft: '1.2rem' }}>
                                                                    {/* Tree Line Visual */}
                                                                    <div style={{
                                                                        width: '1.5rem',
                                                                        height: '100%',
                                                                        borderLeft: '2px solid #cbd5e1',
                                                                        borderBottom: isLast ? 'none' : 'none', // Simple vertical line
                                                                        position: 'relative'
                                                                    }}>
                                                                        {/* L-Shape Connector */}
                                                                        <div style={{
                                                                            position: 'absolute',
                                                                            top: '50%',
                                                                            left: 0,
                                                                            width: '1rem',
                                                                            height: '2px', // Horizontal
                                                                            backgroundColor: '#cbd5e1'
                                                                        }}></div>
                                                                        <div style={{
                                                                            position: 'absolute',
                                                                            top: 0,
                                                                            left: '-2px', // Align with borderLeft
                                                                            width: '2px',
                                                                            height: '50%', // Fill top half
                                                                            backgroundColor: '#cbd5e1'
                                                                        }}></div>
                                                                    </div>
                                                                    <span style={{ fontSize: '0.9rem', color: '#64748b', marginLeft: '0.5rem', fontWeight: 500 }}>
                                                                        {gauge} Gauge
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td style={{ textAlign: 'right' }}>
                                                                <input
                                                                    type="number" step="0.05"
                                                                    className="input-field"
                                                                    style={{
                                                                        width: '100px', textAlign: 'right', height: '32px', fontSize: '0.9rem',
                                                                        borderColor: isOverridden ? 'var(--warning)' : 'var(--border-color)',
                                                                        backgroundColor: isOverridden ? '#fffbeb' : '#fff'
                                                                    }}
                                                                    value={currentVal}
                                                                    onChange={(e) => handleListMultiplierChange(variantKey, e.target.value)}
                                                                />
                                                            </td>
                                                            <td style={{ textAlign: 'right', color: 'var(--text-light)', fontSize: '0.85rem' }}>
                                                                ${(100 * currentVal).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    )
                                                })}

                                                {/* Fasteners Sub-Types */}
                                                {catName === 'Fasteners' && expandedFasteners && FASTENER_TYPES.map(type => {
                                                    const subKey = `Fasteners:${type}`
                                                    return (
                                                        <tr key={subKey} style={{ backgroundColor: '#f8fafc' }}>
                                                            <td style={{ paddingLeft: '3rem', fontSize: '0.9rem', color: 'var(--text-light)' }}>└ {type}</td>
                                                            <td style={{ textAlign: 'right' }}>
                                                                <input
                                                                    type="number" step="0.05"
                                                                    className="input-field"
                                                                    style={{ width: '100px', textAlign: 'right', fontSize: '0.9rem' }}
                                                                    value={strategy.listMultipliers[subKey] || strategy.listMultipliers['Fasteners'] || 1.5}
                                                                    onChange={(e) => handleListMultiplierChange(subKey, e.target.value)}
                                                                />
                                                            </td>
                                                            <td style={{ textAlign: 'right', color: 'var(--text-light)', fontSize: '0.85rem' }}>
                                                                ${(100 * (strategy.listMultipliers[subKey] || strategy.listMultipliers['Fasteners'] || 1.5)).toFixed(2)}
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </React.Fragment>
                                        )
                                    })}
                                </tbody>
                            )
                        })}
                    </table>
                </div>
            )}

            {/* --- TAB 2: DISCOUNTS --- */}
            {activeTab === 'discounts' && (
                <div style={{ animation: 'fadeIn 0.3s' }}>
                    <div style={{ marginBottom: '1.5rem' }}>
                        <h3 className="heading-md" style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Customer Tier Discounts</h3>
                        <p style={{ color: 'var(--text-light)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                            Configure Net Price Multipliers per Tier. (e.g. 0.70 = 30% Off List).
                        </p>

                        {/* Controls Bar */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    onClick={() => setDiscountActiveGroup(CUSTOMER_GROUPS.DEALER)}
                                    className="btn"
                                    style={{
                                        backgroundColor: discountActiveGroup === CUSTOMER_GROUPS.DEALER ? '#fff' : 'transparent',
                                        color: discountActiveGroup === CUSTOMER_GROUPS.DEALER ? 'var(--accent-color)' : 'var(--text-light)',
                                        boxShadow: discountActiveGroup === CUSTOMER_GROUPS.DEALER ? 'var(--shadow-sm)' : 'none',
                                        border: discountActiveGroup === CUSTOMER_GROUPS.DEALER ? '1px solid var(--border-color)' : 'none'
                                    }}
                                >
                                    Dealer Tiers
                                </button>
                                <button
                                    onClick={() => setDiscountActiveGroup(CUSTOMER_GROUPS.COMMERCIAL)}
                                    className="btn"
                                    style={{
                                        backgroundColor: discountActiveGroup === CUSTOMER_GROUPS.COMMERCIAL ? '#fff' : 'transparent',
                                        color: discountActiveGroup === CUSTOMER_GROUPS.COMMERCIAL ? 'var(--success)' : 'var(--text-light)',
                                        boxShadow: discountActiveGroup === CUSTOMER_GROUPS.COMMERCIAL ? 'var(--shadow-sm)' : 'none',
                                        border: discountActiveGroup === CUSTOMER_GROUPS.COMMERCIAL ? '1px solid var(--border-color)' : 'none'
                                    }}
                                >
                                    Commercial Tiers
                                </button>
                            </div>

                            {/* Auto-Calc Button */}
                            <button
                                onClick={handleAutoCalculate}
                                className="btn"
                                style={{
                                    backgroundColor: '#fff',
                                    border: '1px solid var(--border-color)',
                                    color: 'var(--text-main)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}
                            >
                                <span style={{ fontSize: '1.1rem' }}>⚡</span> Auto-Set Discounts
                            </button>
                        </div>
                    </div>

                    {/* Transposed Matrix Table */}
                    <TransposedTierTable
                        groupType={discountActiveGroup}
                        tiers={TIER_RULES[discountActiveGroup]}
                        groupedCategories={groupedCategories}
                        groupOrder={groupOrder}
                        strategy={strategy}
                        onChange={handleTierDiscountChange}
                        categoryVariantsMap={categoryVariantsMap}
                    />
                </div>
            )}
        </div>
    )
}

// [NEW] Transposed Table: Rows = Categories (Grouped), Columns = Tiers
const TransposedTierTable = ({ groupType, tiers, groupedCategories, groupOrder, strategy, onChange, categoryVariantsMap }) => {

    const [expandedCats, setExpandedCats] = React.useState({})

    return (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)' }}>
            <table className="pricing-table" style={{ width: '100%', fontSize: '0.9rem', border: 'none' }}>
                <thead>
                    <tr>
                        <th style={{ textAlign: 'left', minWidth: '220px', position: 'sticky', left: 0, background: '#f8fafc', zIndex: 3, borderRight: '1px solid var(--border-color)' }}>Category</th>
                        {tiers.map(tier => (
                            <th key={tier.name} style={{ textAlign: 'center', minWidth: '100px' }}>
                                {tier.name.replace('Authorized ', '').replace(' Partner', '')}
                            </th>
                        ))}
                    </tr>
                </thead>
                {groupOrder.map(groupName => {
                    const cats = groupedCategories[groupName]
                    if (!cats) return null

                    return (
                        <tbody key={groupName}>
                            {/* Group Row */}
                            <tr>
                                <td style={{ backgroundColor: '#f1f5f9', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.8rem', color: '#475569', padding: '0.75rem 1rem', position: 'sticky', left: 0, zIndex: 2, borderRight: '1px solid var(--border-color)' }}>{groupName}</td>
                                {/* Empty cells for group row */}
                                {tiers.map(t => <td key={t.name} style={{ backgroundColor: '#f1f5f9' }}></td>)}
                            </tr>

                            {/* Category Rows */}
                            {cats.sort().map(catName => {
                                const variants = categoryVariantsMap[catName] || []
                                const hasVariants = variants.length > 0
                                const isExpanded = expandedCats[catName]

                                return (
                                    <React.Fragment key={catName}>
                                        <tr>
                                            <td style={{ fontWeight: 600, position: 'sticky', left: 0, background: '#fff', paddingLeft: '0.5rem', borderRight: '1px solid var(--border-color)', zIndex: 2 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    {/* Chevron */}
                                                    {hasVariants ? (
                                                        <button
                                                            onClick={() => setExpandedCats(prev => ({ ...prev, [catName]: !prev[catName] }))}
                                                            style={{
                                                                background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center',
                                                                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease'
                                                            }}
                                                        >
                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="9 18 15 12 9 6"></polyline>
                                                            </svg>
                                                        </button>
                                                    ) : (
                                                        <div style={{ width: '24px' }}></div>
                                                    )}

                                                    <span>{catName}</span>

                                                    {hasVariants && !isExpanded && (
                                                        <span
                                                            onClick={() => setExpandedCats(prev => ({ ...prev, [catName]: !prev[catName] }))}
                                                            style={{ fontSize: '0.75rem', color: '#94a3b8', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', marginLeft: 'auto' }}
                                                        >
                                                            + {variants.length} Gauges
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            {tiers.map(tier => {
                                                // Value Resolution
                                                const val = strategy.tierMultipliers[groupType]?.[tier.name]?.[catName]
                                                    ?? strategy.tierMultipliers[groupType]?.[tier.name]?.['Default']
                                                    ?? 0.0 // Default to 0 discount if unset

                                                return (
                                                    <td key={tier.name} style={{ textAlign: 'center' }}>
                                                        <input
                                                            type="number" step="0.01" max="1.0" min="0.0"
                                                            className="input-field"
                                                            style={{
                                                                width: '70px',
                                                                textAlign: 'center',
                                                                backgroundColor: val > 0 ? '#dcfce7' : '#fff', // Green if discount exists
                                                                fontWeight: val > 0 ? 600 : 400,
                                                                border: val > 0 ? '1px solid #86efac' : '1px solid var(--border-color)'
                                                            }}
                                                            value={val}
                                                            onChange={(e) => onChange(groupType, tier.name, catName, e.target.value)}
                                                        />
                                                    </td>
                                                )
                                            })}
                                        </tr>
                                        {/* Variant Sub-Rows */}
                                        {hasVariants && isExpanded && variants.map((gauge, idx) => {
                                            const variantKey = `${catName}:${gauge}`
                                            const isLast = idx === variants.length - 1

                                            return (
                                                <tr key={variantKey} className="variant-row" style={{ backgroundColor: '#f8fafc' }}>
                                                    <td style={{ padding: 0, fontSize: '0.85rem', color: 'var(--text-light)', position: 'sticky', left: 0, background: '#f8fafc', borderRight: '1px solid var(--border-color)', zIndex: 2 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', height: '100%', paddingLeft: '1.2rem' }}>
                                                            {/* Tree Line Visual */}
                                                            <div style={{
                                                                width: '1.5rem',
                                                                height: '100%',
                                                                borderLeft: '2px solid #cbd5e1',
                                                                position: 'relative'
                                                            }}>
                                                                {/* L-Shape Connector */}
                                                                <div style={{
                                                                    position: 'absolute',
                                                                    top: '50%',
                                                                    left: 0,
                                                                    width: '1rem',
                                                                    height: '2px', // Horizontal
                                                                    backgroundColor: '#cbd5e1'
                                                                }}></div>
                                                                <div style={{
                                                                    position: 'absolute',
                                                                    top: 0,
                                                                    left: '-2px', // Align with borderLeft
                                                                    width: '2px',
                                                                    height: '50%', // Fill top half
                                                                    backgroundColor: '#cbd5e1'
                                                                }}></div>
                                                            </div>
                                                            <span style={{ fontSize: '0.9rem', color: '#64748b', marginLeft: '0.5rem', fontWeight: 500 }}>
                                                                {gauge} Gauge
                                                            </span>
                                                        </div>
                                                    </td>
                                                    {tiers.map(tier => {
                                                        const explicitVal = strategy.tierMultipliers[groupType]?.[tier.name]?.[variantKey]
                                                        const catVal = strategy.tierMultipliers[groupType]?.[tier.name]?.[catName]
                                                            ?? strategy.tierMultipliers[groupType]?.[tier.name]?.['Default'] ?? 0.0

                                                        const displayVal = explicitVal !== undefined ? explicitVal : catVal
                                                        const isOverridden = explicitVal !== undefined && explicitVal !== catVal

                                                        return (
                                                            <td key={tier.name} style={{ textAlign: 'center' }}>
                                                                <input
                                                                    type="number" step="0.01" max="1.0" min="0.0"
                                                                    className="input-field"
                                                                    style={{
                                                                        width: '70px',
                                                                        textAlign: 'center',
                                                                        backgroundColor: isOverridden ? '#fffbeb' : '#f8fafc',
                                                                        border: isOverridden ? '1px solid var(--warning)' : '1px solid var(--border-color)',
                                                                        fontSize: '0.9rem', height: '32px'
                                                                    }}
                                                                    value={displayVal}
                                                                    onChange={(e) => onChange(groupType, tier.name, variantKey, e.target.value)}
                                                                    placeholder={catVal}
                                                                />
                                                            </td>
                                                        )
                                                    })}
                                                </tr>
                                            )
                                        })}
                                    </React.Fragment>
                                )
                            })}
                        </tbody>
                    )
                })}
            </table>
        </div>
    )
}

export default PricingStrategyManager

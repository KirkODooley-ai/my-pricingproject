import React, { useState, useMemo } from 'react'
import { calculateMargin, formatCurrency, formatPercent } from '../utils/pricingEngine'
import './PricingCalculator.css'

const PricingCalculator = ({ products, productVariants = [] }) => {
    // --- Mode State ---
    const [mode, setMode] = useState('product') // 'portfolio' | 'product'

    // --- Portfolio State ---
    const [priceIncreasePct, setPriceIncreasePct] = useState(0)
    const [costIncreasePct, setCostIncreasePct] = useState(0)
    const [projectedVolume, setProjectedVolume] = useState(100)

    // --- Product Explorer State ---
    const [selectedProductId, setSelectedProductId] = useState('')
    const [selectedGauge, setSelectedGauge] = useState('')

    // --- Product Selection Logic (Unified) ---
    const selectedProduct = useMemo(() => products.find(p => p.id === selectedProductId), [products, selectedProductId])

    const relevantVariants = useMemo(() => {
        if (!selectedProductId) return []
        return productVariants.filter(v => v.productId === selectedProductId).sort((a, b) => b.gauge - a.gauge)
    }, [productVariants, selectedProductId])

    // --- Options Logic ---
    const allGaugeOptions = useMemo(() => {
        if (!selectedProduct) return []

        // 1. Base Product (Usually 29ga)
        const baseOption = {
            id: 'base',
            gauge: selectedProduct.gauge || 29,
            weight: selectedProduct.weight_lbs_ft || 2.0,
            price: selectedProduct.price,
            cost: selectedProduct.cost,
            isBase: true
        }

        // 2. Variants (e.g. 26ga, 24ga)
        const variantOptions = relevantVariants.map(v => ({
            id: v.id,
            gauge: v.gauge,
            weight: v.weight,
            price: v.priceOverride, // Might be null
            cost: v.costOverride, // Might be null
            isBase: false,
            // If priceOverride is null, we calculate it later based on weight ratio
        }))

        // 3. Merge & Deduplicate (in case base is also in variants)
        const all = [baseOption, ...variantOptions]

        // Deduplicate by gauge (prefer variant if it exists? or base? Base has price/cost.)
        // Actually, if variant exists for the same gauge, it overrides base.
        const unique = []
        const seenGauges = new Set()

        // Process variants first (they might override base if defined for same gauge)
        // No, keep it simple: Map by gauge
        const map = new Map()

        // Add Base first
        map.set(baseOption.gauge, baseOption)

        // Add Variants (overwrite if same gauge)
        variantOptions.forEach(v => map.set(v.gauge, v))

        // Convert to array and sort
        return Array.from(map.values()).sort((a, b) => b.gauge - a.gauge) // Descending: 29, 26, 24? No, Thinner to Thicker? 
        // 29 is Thinner, 24 is Thicker.
        // Usually list 29, 26, 24 (Common -> Premium)
        // Or 24, 26, 29 (Thick -> Thin)
        // Let's sort numerically descending (29 -> 26 -> 24) as 29 is standard.
    }, [selectedProduct, relevantVariants])


    // Auto-select logic? User wants "Select Gauge" placeholder if not chosen.
    // So REMOVE auto-select logic.
    /*
    React.useEffect(() => {
       // ... existing auto-select logic removed ...
    }, [relevantVariants, selectedGauge])
    */

    const productMetrics = useMemo(() => {
        if (!selectedProduct || !selectedGauge) return null

        const option = allGaugeOptions.find(o => o.gauge === parseInt(selectedGauge))
        if (!option) return null

        // Calculate Price/Cost
        let finalPrice = parseFloat(selectedProduct.price) || 0
        let finalCost = parseFloat(selectedProduct.cost) || 0

        // Base Props (for ratio calculation)
        const baseWeight = parseFloat(selectedProduct.weight_lbs_ft) || 2.0
        const weight = parseFloat(option.weight) || 0

        // If it's the Base Option, use its price/cost
        if (option.isBase) {
            finalPrice = parseFloat(selectedProduct.price) || 0
            finalCost = parseFloat(selectedProduct.cost) || 0
        } else {
            // Variant Logic
            // Price: Override > Weight Ratio
            if (option.price != null && option.price > 0) {
                finalPrice = parseFloat(option.price)
            } else if (baseWeight > 0 && weight > 0) {
                // Ratio: New Weight / Old Weight
                finalPrice = (parseFloat(selectedProduct.price) || 0) * (weight / baseWeight)
            }

            // Cost: Override > Weight Ratio
            if (option.cost != null && option.cost > 0) {
                finalCost = parseFloat(option.cost)
            } else if (baseWeight > 0 && weight > 0) {
                finalCost = (parseFloat(selectedProduct.cost) || 0) * (weight / baseWeight)
            }
        }

        const margin = calculateMargin(finalPrice, finalCost)

        return {
            price: finalPrice,
            cost: finalCost,
            margin,
            weight: weight,
            gauge: option.gauge
        }
    }, [selectedProduct, selectedGauge, allGaugeOptions])

    // Inversion Check (29ga > 26ga Price?)
    const inversionWarning = useMemo(() => {
        if (!productMetrics || allGaugeOptions.length < 2) return null

        // Logic: Compare current metric with others? 
        // Or just run a check across all options once selected?
        // Let's check specifically: Is T (Thinner, High Gauge) > T-1 (Thicker, Low Gauge)?
        // 29ga Price > 26ga Price?

        // We need prices for ALL options to compare.
        // ... (Similar logic to before, but using allGaugeOptions)
        return null // Simplified for now to focus on UI
    }, [productMetrics, allGaugeOptions])


    // --- Current Portfolio Calculation ---
    const currentMetrics = useMemo(() => {
        if (mode !== 'portfolio') return { revenue: 0, cost: 0, margin: 0 }
        let totalRevenue = 0
        let totalCost = 0

        products.forEach(p => {
            totalRevenue += p.price * projectedVolume
            totalCost += p.cost * projectedVolume
        })

        const totalMargin = totalRevenue > 0 ? (totalRevenue - totalCost) / totalRevenue : 0
        return { revenue: totalRevenue, cost: totalCost, margin: totalMargin }
    }, [products, projectedVolume, mode])

    // Projected Metrics
    const projectedMetrics = useMemo(() => {
        if (mode !== 'portfolio') return { revenue: 0, cost: 0, margin: 0 }
        let totalRevenue = 0
        let totalCost = 0

        products.forEach(p => {
            const newCost = p.cost * (1 + costIncreasePct / 100)
            const newPrice = p.price * (1 + priceIncreasePct / 100)

            totalRevenue += newPrice * projectedVolume
            totalCost += newCost * projectedVolume
        })

        const totalMargin = totalRevenue > 0 ? (totalRevenue - totalCost) / totalRevenue : 0
        return { revenue: totalRevenue, cost: totalCost, margin: totalMargin }
    }, [products, priceIncreasePct, costIncreasePct, projectedVolume, mode])

    const revenueDelta = projectedMetrics.revenue - currentMetrics.revenue
    const marginDelta = projectedMetrics.margin - currentMetrics.margin


    // --- RENDER ---
    return (
        <div className="calculator-container">
            {/* Tab Switcher */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid #e5e7eb' }}>
                <button
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderBottom: mode === 'product' ? '3px solid #2563eb' : '3px solid transparent',
                        color: mode === 'product' ? '#2563eb' : '#6b7280',
                        fontWeight: mode === 'product' ? 700 : 500,
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '1rem'
                    }}
                    onClick={() => setMode('product')} // Default to Product First?
                >
                    Product Pricing
                </button>
                <button
                    style={{
                        padding: '0.75rem 1.5rem',
                        borderBottom: mode === 'portfolio' ? '3px solid #2563eb' : '3px solid transparent',
                        color: mode === 'portfolio' ? '#2563eb' : '#6b7280',
                        fontWeight: mode === 'portfolio' ? 700 : 500,
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: '1rem'
                    }}
                    onClick={() => setMode('portfolio')}
                >
                    Portfolio Analysis
                </button>
            </div>

            {mode === 'portfolio' ? (
                /* EXISTING PORTFOLIO UI */
                <>
                    <div className="controls-grid">
                        <div className="control-group">
                            <label>Price Increase (%)</label>
                            <input
                                className="input-field"
                                type="number"
                                value={priceIncreasePct}
                                onChange={e => setPriceIncreasePct(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div className="control-group">
                            <label>Cost Increase (%)</label>
                            <input
                                className="input-field"
                                type="number"
                                value={costIncreasePct}
                                onChange={e => setCostIncreasePct(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                        <div className="control-group">
                            <label>Simulated Volume (Units per product)</label>
                            <input
                                className="input-field"
                                type="number"
                                value={projectedVolume}
                                onChange={e => setProjectedVolume(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>

                    <div className="stats-grid">
                        {/* Current State */}
                        <div className="stat-card">
                            <h3>Current State</h3>
                            <div className="metric-row">
                                <span>Total Revenue:</span>
                                <span className="metric-value">{formatCurrency(currentMetrics.revenue)}</span>
                            </div>
                            <div className="metric-row">
                                <span>Total Cost:</span>
                                <span className="metric-value">{formatCurrency(currentMetrics.cost)}</span>
                            </div>
                            <div className="metric-row highlight">
                                <span>Net Margin:</span>
                                <span className="metric-value">{formatPercent(currentMetrics.margin)}</span>
                            </div>
                        </div>

                        {/* Projected State */}
                        <div className="stat-card projected">
                            <h3>Projected State</h3>
                            <div className="metric-row">
                                <span>Total Revenue:</span>
                                <span className="metric-value">
                                    {formatCurrency(projectedMetrics.revenue)}
                                    <span className={revenueDelta >= 0 ? 'delta-positive' : 'delta-negative'} style={{ marginLeft: '0.5rem', fontSize: '0.8em' }}>
                                        ({revenueDelta >= 0 ? '+' : ''}{formatCurrency(revenueDelta)})
                                    </span>
                                </span>
                            </div>
                            <div className="metric-row">
                                <span>Total Cost:</span>
                                <span className="metric-value">{formatCurrency(projectedMetrics.cost)}</span>
                            </div>
                            <div className="metric-row highlight">
                                <span>Net Margin:</span>
                                <span className="metric-value">
                                    {formatPercent(projectedMetrics.margin)}
                                    <span className={marginDelta >= 0 ? 'delta-positive' : 'delta-negative'} style={{ marginLeft: '0.5rem', fontSize: '0.8em' }}>
                                        ({marginDelta >= 0 ? '+' : ''}{formatPercent(marginDelta)})
                                    </span>
                                </span>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                /* NEW PRODUCT PRICING UI */
                <div className="explorer-container">

                    {/* 1. SELECTION BAR (Main Refactor) */}
                    {/* 1. SELECTION BAR (Main Refactor) */}
                    <div className="card" style={{ marginBottom: '2rem', display: 'flex', gap: '2rem', alignItems: 'flex-end', padding: '1.5rem' }}>
                        {/* Product Selector */}
                        <div style={{ flex: 1 }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Product Profile
                            </label>
                            <div style={{ position: 'relative' }}>
                                <select
                                    className="input-field"
                                    style={{
                                        width: '100%',
                                        fontSize: '1rem',
                                        fontWeight: 500,
                                        height: '46px' // Enforce consistent height
                                    }}
                                    value={selectedProductId}
                                    onChange={e => { setSelectedProductId(e.target.value); setSelectedGauge(''); }}
                                >
                                    <option value="">-- Select Profile --</option>
                                    {products
                                        .filter(p => !p.isHidden) // Filter active?
                                        .sort((a, b) => a.name.localeCompare(b.name))
                                        .map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                </select>
                            </div>
                        </div>

                        {/* Gauge Selector (Variant) */}
                        <div style={{ width: '280px' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: 'var(--text-main)', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Gauge Thickness
                            </label>
                            <select
                                className="input-field"
                                style={{
                                    width: '100%',
                                    fontSize: '1rem',
                                    height: '46px', // Enforce consistent height
                                    // Visual Hierarchy: Differentiate from Product
                                    backgroundColor: selectedProductId ? '#eff6ff' : 'var(--bg-body)',
                                    borderColor: selectedProductId ? 'var(--accent-color)' : 'var(--border-color)',
                                    color: selectedProductId ? 'var(--secondary-color)' : 'var(--text-light)',
                                    fontWeight: 600,
                                    cursor: selectedProductId ? 'pointer' : 'not-allowed'
                                }}
                                value={selectedGauge}
                                onChange={e => setSelectedGauge(e.target.value)}
                                disabled={!selectedProductId}
                            >
                                <option value="">{selectedProductId ? 'Select Gauge...' : '---'}</option>
                                {allGaugeOptions.map(opt => (
                                    <option key={opt.gauge} value={opt.gauge}>
                                        {opt.gauge} Gauge ({opt.weight.toFixed(2)} lbs/ft)
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* 2. METRICS DISPLAY */}
                    {productMetrics ? (
                        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                            <div className="stat-card">
                                <span className="metric-label">Unit Price</span>
                                <span className="metric-value" style={{ color: '#2563eb', fontSize: '1.8rem' }}>
                                    {formatCurrency(productMetrics.price)}
                                </span>
                                <span className="metric-sub" style={{ marginTop: '0.5rem' }}>Legacy Calculation</span>
                            </div>
                            <div className="stat-card">
                                <span className="metric-label">Unit Cost</span>
                                <span className="metric-value">
                                    {formatCurrency(productMetrics.cost)}
                                </span>
                            </div>
                            <div className="stat-card">
                                <span className="metric-label">Margin</span>
                                <span className="metric-value">
                                    {formatPercent(productMetrics.margin)}
                                </span>
                            </div>
                            <div className="stat-card" style={{ backgroundColor: '#f8fafc' }}>
                                <span className="metric-label">Specification</span>
                                <div style={{ marginTop: '0.5rem', fontWeight: 600 }}>
                                    <div>{productMetrics.gauge} Gauge</div>
                                    <div style={{ color: '#64748b' }}>{productMetrics.weight?.toFixed(3)} lbs/ft</div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{
                            textAlign: 'center',
                            padding: '4rem',
                            backgroundColor: '#f9fafb',
                            borderRadius: '8px',
                            border: '2px dashed #e5e7eb',
                            color: '#9ca3af'
                        }}>
                            {selectedProductId ? "Please select a gauge to view pricing." : "Select a product profile to begin."}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default PricingCalculator

import React, { useState, useMemo } from 'react';
import {
    calculateMargin, formatCurrency, formatPercent,
    isGaugeEnabledCategory, getCategoryGroup,
    CATEGORY_GROUPS, CATEGORY_GROUP_OPTIONS,
    getListMultiplier, TIER_RULES, CUSTOMER_GROUPS
} from '../utils/pricingEngine';

// Resolve the tier discount for a given category + tier
const getTierDiscount = (strategy, customerGroup, tierName, categoryName) => {
    const groupTiers = strategy?.tierMultipliers?.[customerGroup] || {};
    const tierConfig = groupTiers[tierName] || {};
    return tierConfig[categoryName] ?? tierConfig['Default'] ?? 0;
};

const PricingCalculator = ({ products, productVariants = [], pricingStrategy }) => {
    // --- Mode State ---
    const [mode, setMode] = useState('product');

    // --- Portfolio State ---
    const [priceIncreasePct, setPriceIncreasePct] = useState(0);
    const [costIncreasePct, setCostIncreasePct] = useState(0);
    const [projectedVolume, setProjectedVolume] = useState(100);

    // --- Product Explorer State ---
    const [selectedProductId, setSelectedProductId] = useState('');
    const [selectedGauge, setSelectedGauge] = useState('');
    const [selectedGroup, setSelectedGroup] = useState(CUSTOMER_GROUPS.DEALER);
    const [selectedTier, setSelectedTier] = useState('');

    const selectedProduct = useMemo(() => products.find(p => p.id === selectedProductId), [products, selectedProductId]);

    const relevantVariants = useMemo(() => {
        if (!selectedProductId) return [];
        return productVariants.filter(v => v.productId === selectedProductId).sort((a, b) => b.gauge - a.gauge);
    }, [productVariants, selectedProductId]);

    const allGaugeOptions = useMemo(() => {
        if (!selectedProduct) return [];
        const baseOption = {
            id: 'base', gauge: selectedProduct.gauge || 29, weight: selectedProduct.weight_lbs_ft || 2.0,
            price: selectedProduct.price, cost: selectedProduct.cost, isBase: true
        };
        const variantOptions = relevantVariants.map(v => ({
            id: v.id, gauge: v.gauge, weight: v.weight,
            price: v.priceOverride, cost: v.costOverride, isBase: false,
        }));
        const map = new Map();
        map.set(baseOption.gauge, baseOption);
        variantOptions.forEach(v => map.set(v.gauge, v));
        return Array.from(map.values()).sort((a, b) => b.gauge - a.gauge);
    }, [selectedProduct, relevantVariants]);

    const isGaugeProduct = selectedProduct && isGaugeEnabledCategory(selectedProduct.category);

    // Core cost/price for the selected product + gauge
    const productMetrics = useMemo(() => {
        if (!selectedProduct) return null;
        if (!isGaugeProduct) {
            const price = parseFloat(selectedProduct.price) || 0;
            const cost  = parseFloat(selectedProduct.cost)  || 0;
            return { price, cost, margin: calculateMargin(price, cost), weight: null, gauge: null };
        }
        if (!selectedGauge) return null;
        const option = allGaugeOptions.find(o => o.gauge === parseInt(selectedGauge));
        if (!option) return null;
        const baseWeight = parseFloat(selectedProduct.weight_lbs_ft) || 2.0;
        const weight     = parseFloat(option.weight) || 0;
        let finalPrice = parseFloat(selectedProduct.price) || 0;
        let finalCost  = parseFloat(selectedProduct.cost)  || 0;
        if (!option.isBase) {
            if (option.price != null && option.price > 0) finalPrice = parseFloat(option.price);
            else if (baseWeight > 0 && weight > 0) finalPrice = (parseFloat(selectedProduct.price) || 0) * (weight / baseWeight);
            if (option.cost != null && option.cost > 0) finalCost = parseFloat(option.cost);
            else if (baseWeight > 0 && weight > 0) finalCost = (parseFloat(selectedProduct.cost) || 0) * (weight / baseWeight);
        }
        return { price: finalPrice, cost: finalCost, margin: calculateMargin(finalPrice, finalCost), weight, gauge: option.gauge };
    }, [selectedProduct, selectedGauge, allGaugeOptions, isGaugeProduct]);

    // Pricing chain: cost → list → tier price
    const pricingChain = useMemo(() => {
        if (!productMetrics || !pricingStrategy || !selectedProduct) return null;
        const cost        = productMetrics.cost;
        const catName     = selectedProduct.category || '';
        const listMult    = getListMultiplier(pricingStrategy, catName);
        const listPrice   = cost * listMult;
        const storedPrice = productMetrics.price;

        // Tier price (only when a tier is selected)
        let tierDiscount = 0, tierPrice = null, tierMargin = null;
        if (selectedTier) {
            tierDiscount = getTierDiscount(pricingStrategy, selectedGroup, selectedTier, catName);
            tierPrice  = listPrice * (1 - tierDiscount);
            tierMargin = calculateMargin(tierPrice, cost);
        }

        return { cost, listMult, listPrice, storedPrice, tierDiscount, tierPrice, tierMargin };
    }, [productMetrics, pricingStrategy, selectedProduct, selectedGroup, selectedTier]);

    // Portfolio metrics
    const currentMetrics = useMemo(() => {
        if (mode !== 'portfolio') return { revenue: 0, cost: 0, margin: 0 };
        let totalRevenue = 0, totalCost = 0;
        products.forEach(p => { totalRevenue += p.price * projectedVolume; totalCost += p.cost * projectedVolume; });
        return { revenue: totalRevenue, cost: totalCost, margin: totalRevenue > 0 ? (totalRevenue - totalCost) / totalRevenue : 0 };
    }, [products, projectedVolume, mode]);

    const projectedMetrics = useMemo(() => {
        if (mode !== 'portfolio') return { revenue: 0, cost: 0, margin: 0 };
        let totalRevenue = 0, totalCost = 0;
        products.forEach(p => {
            totalRevenue += p.price * (1 + priceIncreasePct / 100) * projectedVolume;
            totalCost    += p.cost  * (1 + costIncreasePct  / 100) * projectedVolume;
        });
        return { revenue: totalRevenue, cost: totalCost, margin: totalRevenue > 0 ? (totalRevenue - totalCost) / totalRevenue : 0 };
    }, [products, priceIncreasePct, costIncreasePct, projectedVolume, mode]);

    const revenueDelta = projectedMetrics.revenue - currentMetrics.revenue;
    const marginDelta  = projectedMetrics.margin  - currentMetrics.margin;

    const tierOptions = TIER_RULES[selectedGroup] || [];

    const styles = {
        pageWrapper:  { width: '100%', minHeight: '100%' },
        container:    { maxWidth: '1400px', margin: '0 auto', padding: '2.5rem', width: '100%', fontFamily: 'var(--font-base)' },
        headerRow:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' },
        headerText:   { fontSize: '1.75rem', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.02em', margin: '0 0 0.5rem 0' },
        subText:      { color: '#64748b', fontSize: '1rem', margin: 0 },
        card:         { backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(15,23,42,0.03)', border: '1px solid rgba(15,23,42,0.08)', padding: '2rem' },
        inputField:   { padding: '0.6rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '1rem', color: '#0f172a', outline: 'none', width: '100%', backgroundColor: '#ffffff' },
        inputLabel:   { display: 'block', fontSize: '0.78rem', fontWeight: '600', color: '#475569', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
        tabContainer: { display: 'flex', gap: '0.5rem', backgroundColor: '#f1f5f9', padding: '0.35rem', borderRadius: '8px' },
        tabBtn: (a)   => ({ padding: '0.6rem 1.5rem', border: 'none', borderRadius: '6px', background: a ? '#fff' : 'transparent', color: a ? '#0f172a' : '#64748b', fontWeight: a ? '600' : '500', cursor: 'pointer', boxShadow: a ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s', fontSize: '0.95rem' }),
        groupToggleBtn: (a) => ({ padding: '0.45rem 1rem', border: `1px solid ${a ? '#3b82f6' : '#cbd5e1'}`, borderRadius: '6px', background: a ? '#eff6ff' : '#fff', color: a ? '#1e40af' : '#475569', fontWeight: a ? '600' : '500', cursor: 'pointer', fontSize: '0.9rem', transition: 'all 0.15s' }),
        statCard:     { flex: 1, backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.5rem', display: 'flex', flexDirection: 'column' },
        metricLabel:  { fontSize: '0.78rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' },
        metricValue:  { fontSize: '1.9rem', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.02em' },
        metricSub:    { fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' },
        divider:      { width: '1px', backgroundColor: '#e2e8f0', alignSelf: 'stretch', margin: '0 0.5rem' },
        arrowBox:     { display: 'flex', alignItems: 'center', color: '#94a3b8', fontSize: '1.25rem', fontWeight: '300' },
    };

    return (
        <div style={styles.pageWrapper}>
            <div style={styles.container}>
                <div style={styles.headerRow}>
                    <div>
                        <h2 style={styles.headerText}>Price Lookup</h2>
                        <p style={styles.subText}>Cost → List Price → Tier Price, all driven by Pricing Strategy</p>
                    </div>
                    <div style={styles.tabContainer}>
                        <button style={styles.tabBtn(mode === 'product')}   onClick={() => setMode('product')}>Product Explorer</button>
                        <button style={styles.tabBtn(mode === 'portfolio')} onClick={() => setMode('portfolio')}>Portfolio Analysis</button>
                    </div>
                </div>

                {mode === 'portfolio' ? (
                    /* ── Portfolio Analysis (unchanged) ── */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div style={{...styles.card, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem'}}>
                            <div>
                                <label style={styles.inputLabel}>Price Increase (%)</label>
                                <div style={{ position: 'relative' }}>
                                    <input type="number" step="0.5" style={{...styles.inputField, paddingRight: '2rem'}} value={priceIncreasePct} onChange={e => setPriceIncreasePct(parseFloat(e.target.value) || 0)} />
                                    <span style={{ position: 'absolute', right: '12px', top: '10px', color: '#94a3b8', fontWeight: '600' }}>%</span>
                                </div>
                            </div>
                            <div>
                                <label style={styles.inputLabel}>Cost Increase (%)</label>
                                <div style={{ position: 'relative' }}>
                                    <input type="number" step="0.5" style={{...styles.inputField, paddingRight: '2rem'}} value={costIncreasePct} onChange={e => setCostIncreasePct(parseFloat(e.target.value) || 0)} />
                                    <span style={{ position: 'absolute', right: '12px', top: '10px', color: '#94a3b8', fontWeight: '600' }}>%</span>
                                </div>
                            </div>
                            <div>
                                <label style={styles.inputLabel}>Simulated Volume</label>
                                <input type="number" style={styles.inputField} value={projectedVolume} onChange={e => setProjectedVolume(parseFloat(e.target.value) || 0)} />
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            <div style={{...styles.card, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0'}}>
                                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#475569', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Baseline</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}><span style={{ color: '#64748b' }}>Total Revenue</span><span style={{ fontWeight: '600' }}>{formatCurrency(currentMetrics.revenue)}</span></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}><span style={{ color: '#64748b' }}>Total Cost</span><span style={{ fontWeight: '600' }}>{formatCurrency(currentMetrics.cost)}</span></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: '600' }}>Net Margin</span><span style={{ fontWeight: '700', color: '#2563EB', fontSize: '1.2rem' }}>{formatPercent(currentMetrics.margin)}</span></div>
                                </div>
                            </div>
                            <div style={{...styles.card, backgroundColor: '#eff6ff', border: '1px solid #bfdbfe'}}>
                                <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#1e40af', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Projected Outcome</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid #bfdbfe' }}><span style={{ color: '#1e40af' }}>Total Revenue</span><div><span style={{ fontWeight: '600', color: '#1e3a8a' }}>{formatCurrency(projectedMetrics.revenue)}</span><span style={{ color: revenueDelta >= 0 ? '#059669' : '#dc2626', fontWeight: '600', marginLeft: '0.5rem', fontSize: '0.9rem' }}>({revenueDelta >= 0 ? '+' : ''}{formatCurrency(revenueDelta)})</span></div></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid #bfdbfe' }}><span style={{ color: '#1e40af' }}>Total Cost</span><span style={{ fontWeight: '600', color: '#1e3a8a' }}>{formatCurrency(projectedMetrics.cost)}</span></div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ fontWeight: '700', color: '#1e3a8a' }}>Net Margin</span><div><span style={{ fontWeight: '700', color: '#1d4ed8', fontSize: '1.3rem' }}>{formatPercent(projectedMetrics.margin)}</span><span style={{ color: marginDelta >= 0 ? '#059669' : '#dc2626', fontWeight: '600', marginLeft: '0.5rem', fontSize: '0.9rem' }}>({marginDelta >= 0 ? '+' : ''}{formatPercent(marginDelta)})</span></div></div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* ── Product Explorer ── */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                        {/* Selection Row */}
                        <div style={{...styles.card, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '1.5rem'}}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '1.5rem', alignItems: 'end' }}>

                                {/* Product + Gauge */}
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                                    <div style={{ flex: 1 }}>
                                        <label style={styles.inputLabel}>Product</label>
                                        <select
                                            style={{...styles.inputField, height: '44px', fontWeight: '500'}}
                                            value={selectedProductId}
                                            onChange={e => { setSelectedProductId(e.target.value); setSelectedGauge(''); }}
                                        >
                                            <option value="">— Select a product —</option>
                                            {(() => {
                                                const visible = products.filter(p => !p.isHidden);
                                                const grouped = {};
                                                CATEGORY_GROUP_OPTIONS.forEach(g => { grouped[g] = []; });
                                                visible.forEach(p => {
                                                    const g = getCategoryGroup(p.category || '');
                                                    const key = CATEGORY_GROUP_OPTIONS.includes(g) ? g : 'Accessories';
                                                    grouped[key].push(p);
                                                });
                                                CATEGORY_GROUP_OPTIONS.forEach(groupName => {
                                                    const catOrder = CATEGORY_GROUPS[groupName] || [];
                                                    grouped[groupName].sort((a, b) => {
                                                        const iA = catOrder.indexOf(a.category), iB = catOrder.indexOf(b.category);
                                                        if (iA !== iB) { if (iA === -1) return 1; if (iB === -1) return -1; return iA - iB; }
                                                        return (a.name || '').localeCompare(b.name || '');
                                                    });
                                                });
                                                return CATEGORY_GROUP_OPTIONS.map(groupName => {
                                                    const items = grouped[groupName];
                                                    if (!items || items.length === 0) return null;
                                                    return (
                                                        <optgroup key={groupName} label={`── ${groupName} ──`}>
                                                            {items.map(p => <option key={p.id} value={p.id}>{p.category ? `${p.category} — ` : ''}{p.name}</option>)}
                                                        </optgroup>
                                                    );
                                                });
                                            })()}
                                        </select>
                                    </div>

                                    {isGaugeProduct && (
                                        <div style={{ width: '200px' }}>
                                            <label style={styles.inputLabel}>Gauge</label>
                                            <select
                                                style={{...styles.inputField, height: '44px', fontWeight: '600', borderColor: selectedProductId ? '#3b82f6' : '#cbd5e1', color: selectedProductId ? '#1e3a8a' : '#94a3b8'}}
                                                value={selectedGauge}
                                                onChange={e => setSelectedGauge(e.target.value)}
                                                disabled={!selectedProductId}
                                            >
                                                <option value="">{selectedProductId ? 'Select gauge…' : 'Select product first'}</option>
                                                {allGaugeOptions.map(opt => (
                                                    <option key={opt.gauge} value={opt.gauge}>{opt.gauge} Gauge ({opt.weight?.toFixed?.(3) ?? '—'} lbs/ft)</option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {/* Customer Group toggle */}
                                <div>
                                    <label style={styles.inputLabel}>Customer Type</label>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button style={styles.groupToggleBtn(selectedGroup === CUSTOMER_GROUPS.DEALER)} onClick={() => { setSelectedGroup(CUSTOMER_GROUPS.DEALER); setSelectedTier(''); }}>Dealer</button>
                                        <button style={styles.groupToggleBtn(selectedGroup === CUSTOMER_GROUPS.COMMERCIAL)} onClick={() => { setSelectedGroup(CUSTOMER_GROUPS.COMMERCIAL); setSelectedTier(''); }}>Commercial</button>
                                    </div>
                                </div>

                                {/* Tier selector */}
                                <div style={{ width: '200px' }}>
                                    <label style={styles.inputLabel}>Tier</label>
                                    <select
                                        style={{...styles.inputField, height: '44px'}}
                                        value={selectedTier}
                                        onChange={e => setSelectedTier(e.target.value)}
                                    >
                                        <option value="">— List price only —</option>
                                        {tierOptions.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Pricing Chain */}
                        {pricingChain ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                                {/* Main chain row */}
                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'stretch' }}>

                                    {/* Cost */}
                                    <div style={{...styles.statCard, borderTop: '4px solid #94a3b8', flex: '0 0 auto', minWidth: '160px'}}>
                                        <span style={styles.metricLabel}>Unit Cost</span>
                                        <span style={{...styles.metricValue, fontSize: '1.6rem', color: '#475569'}}>{formatCurrency(pricingChain.cost)}</span>
                                        <span style={styles.metricSub}>From product record</span>
                                    </div>

                                    <div style={styles.arrowBox}>×{pricingChain.listMult.toFixed(3)}</div>

                                    {/* List Price */}
                                    <div style={{...styles.statCard, borderTop: '4px solid #2563EB', flex: 1}}>
                                        <span style={styles.metricLabel}>List Price</span>
                                        <span style={{...styles.metricValue, color: '#2563EB'}}>{formatCurrency(pricingChain.listPrice)}</span>
                                        <span style={styles.metricSub}>
                                            Cost × {pricingChain.listMult.toFixed(3)} &nbsp;·&nbsp;
                                            Margin: {formatPercent(calculateMargin(pricingChain.listPrice, pricingChain.cost))}
                                            {Math.abs(pricingChain.listPrice - pricingChain.storedPrice) > 0.005 && (
                                                <span style={{ color: '#f59e0b', marginLeft: '0.5rem' }}>
                                                    (stored: {formatCurrency(pricingChain.storedPrice)})
                                                </span>
                                            )}
                                        </span>
                                    </div>

                                    {/* Tier Price — only when a tier is selected */}
                                    {pricingChain.tierPrice != null && (
                                        <>
                                            <div style={styles.arrowBox}>
                                                {pricingChain.tierDiscount > 0
                                                    ? `−${formatPercent(pricingChain.tierDiscount)}`
                                                    : '→'}
                                            </div>
                                            <div style={{...styles.statCard, borderTop: '4px solid #059669', flex: 1}}>
                                                <span style={styles.metricLabel}>
                                                    {selectedTier} Price
                                                </span>
                                                <span style={{...styles.metricValue, color: '#059669'}}>{formatCurrency(pricingChain.tierPrice)}</span>
                                                <span style={styles.metricSub}>
                                                    {pricingChain.tierDiscount > 0
                                                        ? `${formatPercent(pricingChain.tierDiscount)} off list`
                                                        : 'No discount applied'}
                                                    &nbsp;·&nbsp; Margin: {formatPercent(pricingChain.tierMargin)}
                                                </span>
                                            </div>
                                        </>
                                    )}

                                    {/* Margin summary card */}
                                    <div style={{...styles.statCard, backgroundColor: '#f8fafc', flex: '0 0 auto', minWidth: '160px'}}>
                                        <span style={styles.metricLabel}>
                                            {pricingChain.tierPrice != null ? 'Tier Margin' : 'List Margin'}
                                        </span>
                                        <span style={{...styles.metricValue, fontSize: '1.6rem', color: (() => { const m = pricingChain.tierPrice != null ? pricingChain.tierMargin : calculateMargin(pricingChain.listPrice, pricingChain.cost); return m >= 0.35 ? '#059669' : m >= 0.2 ? '#d97706' : '#dc2626'; })() }}>
                                            {formatPercent(pricingChain.tierPrice != null ? pricingChain.tierMargin : calculateMargin(pricingChain.listPrice, pricingChain.cost))}
                                        </span>
                                        {productMetrics?.gauge != null && (
                                            <span style={styles.metricSub}>{productMetrics.gauge} Gauge · {productMetrics.weight?.toFixed(3)} lbs/ft</span>
                                        )}
                                    </div>
                                </div>

                                {/* Info strip — show if list ≠ stored */}
                                {Math.abs(pricingChain.listPrice - pricingChain.storedPrice) > 0.005 && (
                                    <div style={{ padding: '0.75rem 1.25rem', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', fontSize: '0.875rem', color: '#92400e' }}>
                                        <strong>Note:</strong> The calculated list price ({formatCurrency(pricingChain.listPrice)}) differs from the stored price ({formatCurrency(pricingChain.storedPrice)}).
                                        The calculated price uses your current multiplier (×{pricingChain.listMult.toFixed(3)}) from Pricing Strategy.
                                        To align them, update the multiplier in <strong>Admin → Global Pricing</strong> or adjust the stored price in <strong>Products</strong>.
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '5rem 2rem', backgroundColor: '#ffffff', borderRadius: '12px', border: '2px dashed #cbd5e1', color: '#64748b' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.4 }}>📊</div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem' }}>Select a product to see pricing</h3>
                                <p style={{ margin: 0, fontSize: '0.9rem' }}>
                                    {!selectedProductId
                                        ? 'Choose a product from the dropdown above.'
                                        : isGaugeProduct
                                            ? 'Select a gauge thickness to compute pricing.'
                                            : 'Loading…'}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PricingCalculator;

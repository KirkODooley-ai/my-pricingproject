import React, { useState, useMemo } from 'react';
import { calculateMargin, formatCurrency, formatPercent, isGaugeEnabledCategory } from '../utils/pricingEngine';

const PricingCalculator = ({ products, productVariants = [] }) => {
    // --- Mode State ---
    const [mode, setMode] = useState('product'); // 'portfolio' | 'product'

    // --- Portfolio State ---
    const [priceIncreasePct, setPriceIncreasePct] = useState(0);
    const [costIncreasePct, setCostIncreasePct] = useState(0);
    const [projectedVolume, setProjectedVolume] = useState(100);

    // --- Product Explorer State ---
    const [selectedProductId, setSelectedProductId] = useState('');
    const [selectedGauge, setSelectedGauge] = useState('');

    const selectedProduct = useMemo(() => products.find(p => p.id === selectedProductId), [products, selectedProductId]);

    const relevantVariants = useMemo(() => {
        if (!selectedProductId) return [];
        return productVariants.filter(v => v.productId === selectedProductId).sort((a, b) => b.gauge - a.gauge);
    }, [productVariants, selectedProductId]);

    const allGaugeOptions = useMemo(() => {
        if (!selectedProduct) return [];

        const baseOption = {
            id: 'base',
            gauge: selectedProduct.gauge || 29,
            weight: selectedProduct.weight_lbs_ft || 2.0,
            price: selectedProduct.price,
            cost: selectedProduct.cost,
            isBase: true
        };

        const variantOptions = relevantVariants.map(v => ({
            id: v.id,
            gauge: v.gauge,
            weight: v.weight,
            price: v.priceOverride,
            cost: v.costOverride,
            isBase: false,
        }));

        const map = new Map();
        map.set(baseOption.gauge, baseOption);
        variantOptions.forEach(v => map.set(v.gauge, v));

        return Array.from(map.values()).sort((a, b) => b.gauge - a.gauge);
    }, [selectedProduct, relevantVariants]);

    const isGaugeProduct = selectedProduct && isGaugeEnabledCategory(selectedProduct.category);

    const productMetrics = useMemo(() => {
        if (!selectedProduct) return null;

        // Non-gauge products: single variation, use product cost/price directly
        if (!isGaugeProduct) {
            const price = parseFloat(selectedProduct.price) || 0;
            const cost = parseFloat(selectedProduct.cost) || 0;
            const margin = calculateMargin(price, cost);
            return { price, cost, margin, weight: null, gauge: null };
        }

        // Gauge products: require gauge selection
        if (!selectedGauge) return null;

        const option = allGaugeOptions.find(o => o.gauge === parseInt(selectedGauge));
        if (!option) return null;

        let finalPrice = parseFloat(selectedProduct.price) || 0;
        let finalCost = parseFloat(selectedProduct.cost) || 0;

        const baseWeight = parseFloat(selectedProduct.weight_lbs_ft) || 2.0;
        const weight = parseFloat(option.weight) || 0;

        if (option.isBase) {
            finalPrice = parseFloat(selectedProduct.price) || 0;
            finalCost = parseFloat(selectedProduct.cost) || 0;
        } else {
            if (option.price != null && option.price > 0) finalPrice = parseFloat(option.price);
            else if (baseWeight > 0 && weight > 0) finalPrice = (parseFloat(selectedProduct.price) || 0) * (weight / baseWeight);

            if (option.cost != null && option.cost > 0) finalCost = parseFloat(option.cost);
            else if (baseWeight > 0 && weight > 0) finalCost = (parseFloat(selectedProduct.cost) || 0) * (weight / baseWeight);
        }

        const margin = calculateMargin(finalPrice, finalCost);

        return { price: finalPrice, cost: finalCost, margin, weight: weight, gauge: option.gauge };
    }, [selectedProduct, selectedGauge, allGaugeOptions, isGaugeProduct]);

    const currentMetrics = useMemo(() => {
        if (mode !== 'portfolio') return { revenue: 0, cost: 0, margin: 0 };
        let totalRevenue = 0, totalCost = 0;
        products.forEach(p => {
            totalRevenue += p.price * projectedVolume;
            totalCost += p.cost * projectedVolume;
        });
        const totalMargin = totalRevenue > 0 ? (totalRevenue - totalCost) / totalRevenue : 0;
        return { revenue: totalRevenue, cost: totalCost, margin: totalMargin };
    }, [products, projectedVolume, mode]);

    const projectedMetrics = useMemo(() => {
        if (mode !== 'portfolio') return { revenue: 0, cost: 0, margin: 0 };
        let totalRevenue = 0, totalCost = 0;
        products.forEach(p => {
            const newCost = p.cost * (1 + costIncreasePct / 100);
            const newPrice = p.price * (1 + priceIncreasePct / 100);
            totalRevenue += newPrice * projectedVolume;
            totalCost += newCost * projectedVolume;
        });
        const totalMargin = totalRevenue > 0 ? (totalRevenue - totalCost) / totalRevenue : 0;
        return { revenue: totalRevenue, cost: totalCost, margin: totalMargin };
    }, [products, priceIncreasePct, costIncreasePct, projectedVolume, mode]);

    const revenueDelta = projectedMetrics.revenue - currentMetrics.revenue;
    const marginDelta = projectedMetrics.margin - currentMetrics.margin;

    // Premium SaaS UI Variables
    const styles = {
        pageWrapper: { width: '100%', minHeight: '100%' },
        container: { maxWidth: '1400px', margin: '0 auto', padding: '2.5rem', width: '100%', fontFamily: 'var(--font-base)' },
        headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' },
        headerText: { fontSize: '1.75rem', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.02em', margin: '0 0 0.5rem 0' },
        subText: { color: '#64748b', fontSize: '1rem', margin: 0 },
        
        card: { backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.03)', border: '1px solid rgba(15, 23, 42, 0.08)', padding: '2rem' },
        
        inputField: { padding: '0.6rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '1rem', color: '#0f172a', transition: 'all 0.2s', outline: 'none', width: '100%', backgroundColor: '#ffffff' },
        inputLabel: { display: 'block', fontSize: '0.8rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' },

        tabContainer: { display: 'flex', gap: '0.5rem', backgroundColor: '#f1f5f9', padding: '0.35rem', borderRadius: '8px' },
        tabBtn: (isActive) => ({ padding: '0.6rem 1.5rem', border: 'none', borderRadius: '6px', background: isActive ? '#fff' : 'transparent', color: isActive ? '#0f172a' : '#64748b', fontWeight: isActive ? '600' : '500', cursor: 'pointer', boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s', fontSize: '0.95rem' }),

        statCard: { flex: 1, backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.5rem', display: 'flex', flexDirection: 'column' },
        statMetricLabel: { fontSize: '0.85rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' },
        statMetricValue: { fontSize: '2rem', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.02em' },
        
        deltaPositive: { color: '#059669', fontSize: '1rem', fontWeight: '600', marginLeft: '0.5rem' },
        deltaNegative: { color: '#dc2626', fontSize: '1rem', fontWeight: '600', marginLeft: '0.5rem' }
    };

    return (
        <div style={styles.pageWrapper}>
            <div style={styles.container}>
                <div style={{...styles.headerRow, alignItems: 'center'}}>
                    <div>
                        <h2 style={styles.headerText}>Pricing Simulator</h2>
                        <p style={styles.subText}>Model global portfolio impacts or analyze specific product variants</p>
                    </div>

                    <div style={styles.tabContainer}>
                        <button style={styles.tabBtn(mode === 'product')} onClick={() => setMode('product')}>Product Explorer</button>
                        <button style={styles.tabBtn(mode === 'portfolio')} onClick={() => setMode('portfolio')}>Portfolio Analysis</button>
                    </div>
                </div>

                {mode === 'portfolio' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div style={{...styles.card, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem'}}>
                            <div>
                                <label style={styles.inputLabel}>Price Increase Translation (%)</label>
                                <div style={{ position: 'relative' }}>
                                    <input type="number" step="0.5" style={{...styles.inputField, paddingRight: '2rem'}} value={priceIncreasePct} onChange={e => setPriceIncreasePct(parseFloat(e.target.value) || 0)} />
                                    <span style={{ position: 'absolute', right: '12px', top: '10px', color: '#94a3b8', fontWeight: '600' }}>%</span>
                                </div>
                            </div>
                            <div>
                                <label style={styles.inputLabel}>Cost Liability Increase (%)</label>
                                <div style={{ position: 'relative' }}>
                                    <input type="number" step="0.5" style={{...styles.inputField, paddingRight: '2rem'}} value={costIncreasePct} onChange={e => setCostIncreasePct(parseFloat(e.target.value) || 0)} />
                                    <span style={{ position: 'absolute', right: '12px', top: '10px', color: '#94a3b8', fontWeight: '600' }}>%</span>
                                </div>
                            </div>
                            <div>
                                <label style={styles.inputLabel}>Simulated Volume Basis</label>
                                <input type="number" style={styles.inputField} value={projectedVolume} onChange={e => setProjectedVolume(parseFloat(e.target.value) || 0)} />
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            {/* Current State */}
                            <div style={{...styles.card, backgroundColor: '#f8fafc', border: '1px solid #e2e8f0'}}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#475569', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Current Baseline</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                                        <span style={{ color: '#64748b', fontWeight: '500' }}>Total Revenue</span>
                                        <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '1.1rem' }}>{formatCurrency(currentMetrics.revenue)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid #e2e8f0' }}>
                                        <span style={{ color: '#64748b', fontWeight: '500' }}>Total Cost</span>
                                        <span style={{ fontWeight: '600', color: '#0f172a', fontSize: '1.1rem' }}>{formatCurrency(currentMetrics.cost)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem' }}>
                                        <span style={{ color: '#0f172a', fontWeight: '600', fontSize: '1.1rem' }}>Net Margin</span>
                                        <span style={{ fontWeight: '700', color: '#2563EB', fontSize: '1.3rem' }}>{formatPercent(currentMetrics.margin)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Projected State */}
                            <div style={{...styles.card, backgroundColor: '#EFF6FF', border: '1px solid #bfdbfe', boxShadow: '0 10px 15px -3px rgba(37,99,235,0.1)'}}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#1e40af', marginBottom: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Projected Outcome</h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid #bfdbfe' }}>
                                        <span style={{ color: '#1e40af', fontWeight: '500' }}>Total Revenue</span>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{ fontWeight: '600', color: '#1e3a8a', fontSize: '1.1rem' }}>{formatCurrency(projectedMetrics.revenue)}</span>
                                            <span style={revenueDelta >= 0 ? styles.deltaPositive : styles.deltaNegative}>({revenueDelta >= 0 ? '+' : ''}{formatCurrency(revenueDelta)})</span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '1rem', borderBottom: '1px solid #bfdbfe' }}>
                                        <span style={{ color: '#1e40af', fontWeight: '500' }}>Total Cost</span>
                                        <span style={{ fontWeight: '600', color: '#1e3a8a', fontSize: '1.1rem' }}>{formatCurrency(projectedMetrics.cost)}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.5rem' }}>
                                        <span style={{ color: '#1e3a8a', fontWeight: '700', fontSize: '1.1rem' }}>Net Margin</span>
                                        <div style={{ textAlign: 'right' }}>
                                            <span style={{ fontWeight: '700', color: '#1d4ed8', fontSize: '1.5rem', backgroundColor: '#ffffff', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>{formatPercent(projectedMetrics.margin)}</span>
                                            <span style={marginDelta >= 0 ? styles.deltaPositive : styles.deltaNegative}>({marginDelta >= 0 ? '+' : ''}{formatPercent(marginDelta)})</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div style={{...styles.card, display: 'flex', gap: '2rem', alignItems: 'flex-end', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0'}}>
                            <div style={{ flex: 1 }}>
                                <label style={styles.inputLabel}>Product Profile Base</label>
                                <select
                                    style={{...styles.inputField, height: '48px', fontWeight: '500'}}
                                    value={selectedProductId}
                                    onChange={e => { setSelectedProductId(e.target.value); setSelectedGauge(''); }}
                                >
                                    <option value="">-- Select Product Profile --</option>
                                    {products.filter(p => !p.isHidden).sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>

                            {isGaugeProduct && (
                                <div style={{ width: '320px' }}>
                                    <label style={styles.inputLabel}>Thickness Specification Target</label>
                                    <select
                                        style={{
                                            ...styles.inputField, 
                                            height: '48px', 
                                            fontWeight: '600',
                                            backgroundColor: selectedProductId ? '#ffffff' : '#f1f5f9',
                                            borderColor: selectedProductId ? '#3b82f6' : '#cbd5e1',
                                            color: selectedProductId ? '#1e3a8a' : '#94a3b8',
                                            cursor: selectedProductId ? 'pointer' : 'not-allowed'
                                        }}
                                        value={selectedGauge}
                                        onChange={e => setSelectedGauge(e.target.value)}
                                        disabled={!selectedProductId}
                                    >
                                        <option value="">{selectedProductId ? 'Select Gauge...' : 'Requires Profile...'}</option>
                                        {allGaugeOptions.map(opt => (
                                            <option key={opt.gauge} value={opt.gauge}>
                                                {opt.gauge} Gauge ({opt.weight?.toFixed?.(3) ?? '—'} lbs/ft)
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        {productMetrics ? (
                            <div style={{ display: 'flex', gap: '1.5rem' }}>
                                <div style={{...styles.statCard, borderTop: '4px solid #3b82f6'}}>
                                    <span style={styles.statMetricLabel}>Unit Price</span>
                                    <span style={{...styles.statMetricValue, color: '#2563EB'}}>{formatCurrency(productMetrics.price)}</span>
                                </div>
                                <div style={styles.statCard}>
                                    <span style={styles.statMetricLabel}>Unit Cost</span>
                                    <span style={styles.statMetricValue}>{formatCurrency(productMetrics.cost)}</span>
                                </div>
                                <div style={styles.statCard}>
                                    <span style={styles.statMetricLabel}>Profit Margin</span>
                                    <span style={{...styles.statMetricValue, color: productMetrics.margin >= 0.2 ? '#059669' : '#dc2626'}}>{formatPercent(productMetrics.margin)}</span>
                                </div>
                                <div style={{...styles.statCard, backgroundColor: '#f8fafc'}}>
                                    <span style={styles.statMetricLabel}>Configuration Active</span>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
                                        {productMetrics.gauge != null ? (
                                            <>
                                                <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a' }}>{productMetrics.gauge} Gauge</span>
                                                <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '500' }}>Variant Wt/ft: {productMetrics.weight?.toFixed(3)} lbs</span>
                                            </>
                                        ) : (
                                            <span style={{ fontSize: '1.1rem', fontWeight: '600', color: '#64748b' }}>Single Variation</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '6rem 2rem', backgroundColor: '#ffffff', borderRadius: '12px', border: '2px dashed #cbd5e1', color: '#64748b' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>📊</div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: '600', color: '#475569', marginBottom: '0.5rem' }}>Awaiting Selection</h3>
                                <p style={{ margin: 0, fontSize: '0.95rem' }}>
                                    {!selectedProductId
                                        ? "Select a product profile to begin price modeling."
                                        : isGaugeProduct
                                            ? "Select a gauge thickness to compute exact financials."
                                            : "Product selected. Metrics shown above."}
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

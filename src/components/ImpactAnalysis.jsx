import React, { useMemo } from 'react';
import {
    CUSTOMER_GROUPS,
    TIER_RULES,
    formatCurrency,
    formatPercent,
    aggregateCustomerStats
} from '../utils/pricingEngine';

const ImpactAnalysis = ({ customers, salesTransactions }) => {

    // --- 1. Aggregation Logic ---
    const tierData = useMemo(() => {
        const groups = {
            [CUSTOMER_GROUPS.DEALER]: {},
            [CUSTOMER_GROUPS.COMMERCIAL]: {},
            'Other': {} // Catch-all
        };

        // Initialize Tiers Structure
        Object.keys(TIER_RULES).forEach(group => {
            TIER_RULES[group].forEach(rule => {
                groups[group][rule.name] = {
                    name: rule.name,
                    customers: [],
                    totalRevenue: 0,
                    totalCOGS: 0,
                    totalProfit: 0,
                    avgMargin: 0
                };
            });
        });
        
        groups[CUSTOMER_GROUPS.DEALER]['Unassigned'] = { name: 'Unassigned', customers: [], totalRevenue: 0, totalCOGS: 0, totalProfit: 0, avgMargin: 0 };
        groups[CUSTOMER_GROUPS.COMMERCIAL]['Unassigned'] = { name: 'Unassigned', customers: [], totalRevenue: 0, totalCOGS: 0, totalProfit: 0, avgMargin: 0 };

        if (Array.isArray(customers)) {
            customers.forEach(cust => {
                if (!cust) return;
                const stats = aggregateCustomerStats(cust, salesTransactions);
                const groupKey = groups[cust.group] ? cust.group : 'Other';
                const effectiveSpend = Math.max(cust.annualSpend || 0, stats.revenue);

                let tierName = 'Unassigned';
                if (TIER_RULES[groupKey]) {
                    const matchedRule = TIER_RULES[groupKey].find(r => effectiveSpend >= r.minSpend);
                    if (matchedRule) tierName = matchedRule.name;
                }

                if (!groups[groupKey][tierName]) {
                    groups[groupKey][tierName] = { name: tierName, customers: [], totalRevenue: 0, totalCOGS: 0, totalProfit: 0, avgMargin: 0 };
                }

                const customerRecord = {
                    ...cust,
                    derivedRevenue: effectiveSpend,
                    derivedProfit: stats.profit,
                    derivedMargin: stats.margin
                };

                const bucket = groups[groupKey][tierName];
                bucket.customers.push(customerRecord);
                bucket.totalRevenue += effectiveSpend;
                bucket.totalCOGS += stats.cogs;
                bucket.totalProfit += stats.profit;
            });

            Object.values(groups).forEach(groupTiers => {
                Object.values(groupTiers).forEach(tier => {
                    if (tier.totalRevenue > 0) tier.avgMargin = tier.totalProfit / tier.totalRevenue;
                    tier.customers.sort((a, b) => b.derivedRevenue - a.derivedRevenue);
                });
            });
        }
        return groups;
    }, [customers, salesTransactions]);

    // --- 2. Chart Logic ---
    const chartData = useMemo(() => {
        const points = [];
        let maxRev = 0;

        Object.keys(tierData).forEach(group => {
            Object.values(tierData[group]).forEach(tier => {
                if (tier.totalRevenue > 0) {
                    points.push({
                        label: `${tier.name} (${group})`,
                        x: tier.totalRevenue,
                        y: tier.avgMargin,
                        size: tier.customers.length,
                        group
                    });
                    if (tier.totalRevenue > maxRev) maxRev = tier.totalRevenue;
                }
            });
        });
        return { points, maxRev: maxRev || 1 };
    }, [tierData]);

    // Premium SaaS UI Variables
    const styles = {
        pageWrapper: { width: '100%', minHeight: '100%' },
        container: { maxWidth: '1400px', margin: '0 auto', padding: '2.5rem', width: '100%', fontFamily: 'var(--font-base)' },
        headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' },
        headerText: { fontSize: '1.85rem', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.02em', margin: '0 0 0.5rem 0' },
        subText: { color: '#64748b', fontSize: '1.05rem', margin: 0, lineHeight: '1.5' },
        
        card: { backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.03)', border: '1px solid rgba(15, 23, 42, 0.08)', padding: '2rem', marginBottom: '2.5rem' },
        cardTitle: { margin: '0 0 1.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem', fontWeight: '600', color: '#0f172a', letterSpacing: '-0.01em' },
        cardSubTitle: { fontSize: '0.85rem', fontWeight: '500', color: '#64748b', marginTop: '0.2rem' },
        
        tableContainer: { backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.03)', border: '1px solid rgba(15, 23, 42, 0.08)', overflow: 'hidden' },
        table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
        th: { padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' },
        td: { padding: '1rem 1.5rem', fontSize: '0.95rem', color: '#0f172a', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
        
        badgeBlue: { backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '0.25rem 0.6rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: '600', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '2.5rem' },
        badgeGray: { backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #e2e8f0', padding: '0.25rem 0.6rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: '500', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: '2.5rem' }
    };

    return (
        <div style={styles.pageWrapper}>
            <div style={styles.container}>
                {/* Header */}
                <div style={styles.headerRow}>
                    <div>
                        <h2 style={styles.headerText}>Transition Analysis</h2>
                        <p style={styles.subText}>
                            Visualize profitability and volume across your customer tiers. <br/>
                            Data is aggregated from <strong style={{color: '#0f172a', fontWeight: '600'}}>Actual Sales Transactions</strong>.
                        </p>
                    </div>
                </div>

                {/* --- TOP: Visual Analysis (Scatter Plot) --- */}
                <div style={styles.card}>
                    <h3 style={styles.cardTitle}>
                        <span style={{ fontSize: '1.4rem' }}>📈</span> Performance Matrix
                        <span style={styles.cardSubTitle}>(Revenue vs. Margin Correlation)</span>
                    </h3>

                    <div style={{ position: 'relative', height: '360px', width: '90%', borderLeft: '2px solid #cbd5e1', borderBottom: '2px solid #cbd5e1', margin: '2rem auto 3rem auto', right: '-20px' }}>
                        {/* Axes Labels */}
                        <div style={{ position: 'absolute', left: '-60px', top: '50%', transform: 'rotate(-90deg)', fontWeight: '600', color: '#475569', fontSize: '0.9rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Gross Margin %</div>
                        <div style={{ position: 'absolute', bottom: '-50px', left: '50%', transform: 'translateX(-50%)', fontWeight: '600', color: '#475569', fontSize: '0.9rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Total Revenue ($)</div>

                        {/* Chart Area */}
                        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
                            {/* Grid Lines */}
                            <div style={{ position: 'absolute', left: 0, right: 0, bottom: '33.3%', borderTop: '1px dashed #e2e8f0' }}><span style={{ position: 'absolute', left: '-40px', top: '-10px', fontSize: '0.8rem', color: '#94a3b8', fontWeight: '500' }}>20%</span></div>
                            <div style={{ position: 'absolute', left: 0, right: 0, bottom: '66.6%', borderTop: '1px dashed #e2e8f0' }}><span style={{ position: 'absolute', left: '-40px', top: '-10px', fontSize: '0.8rem', color: '#94a3b8', fontWeight: '500' }}>40%</span></div>

                            {/* Plot Points */}
                            {chartData.points.map((pt, idx) => {
                                const xPos = (pt.x / (chartData.maxRev * 1.1)) * 100;
                                const yPos = (pt.y / 0.6) * 100; 
                                const size = Math.max(16, Math.min(50, 12 + Math.log2(pt.size) * 6));
                                const isDealer = pt.group === CUSTOMER_GROUPS.DEALER;
                                const color = isDealer ? 'rgba(37, 99, 235, 0.85)' : 'rgba(5, 150, 105, 0.85)'; // Blue / Green
                                const borderColor = isDealer ? '#1d4ed8' : '#047857';

                                if (isNaN(xPos) || isNaN(yPos) || yPos > 100 || xPos > 100) return null;

                                return (
                                    <div key={idx}
                                        title={`${pt.label}\nRevenue: ${formatCurrency(pt.x)}\nMargin: ${formatPercent(pt.y)}\nCustomers: ${pt.size}`}
                                        style={{
                                            position: 'absolute',
                                            left: `${xPos}%`,
                                            bottom: `${yPos}%`,
                                            width: `${size}px`,
                                            height: `${size}px`,
                                            backgroundColor: color,
                                            border: `2px solid ${borderColor}`,
                                            borderRadius: '50%',
                                            transform: 'translate(-50%, 50%)',
                                            cursor: 'pointer',
                                            boxShadow: '0 4px 6px rgba(0,0,0,0.1), inset 0 2px 4px rgba(255,255,255,0.3)',
                                            transition: 'all 0.2s',
                                            zIndex: 10
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translate(-50%, 50%) scale(1.1)'; e.currentTarget.style.zIndex = 20; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'translate(-50%, 50%) scale(1)'; e.currentTarget.style.zIndex = 10; }}
                                    >
                                        <span style={{
                                            position: 'absolute',
                                            top: `-${size/2 + 25}px`,
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                            fontSize: '0.75rem',
                                            whiteSpace: 'nowrap',
                                            fontWeight: '600',
                                            color: '#334155',
                                            backgroundColor: 'rgba(255,255,255,0.9)',
                                            padding: '2px 6px',
                                            borderRadius: '4px',
                                            pointerEvents: 'none',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                        }}>
                                            {pt.label.split(' ')[0]}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    {/* Legend */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginTop: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '500', color: '#475569' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'rgba(37, 99, 235, 0.85)', border: '2px solid #1d4ed8' }}></div>
                            Dealer Group
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '500', color: '#475569' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'rgba(5, 150, 105, 0.85)', border: '2px solid #047857' }}></div>
                            Commercial Group
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '500', color: '#475569' }}>
                            <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px dashed #94a3b8' }}></div>
                            Size = Customer Count
                        </div>
                    </div>
                </div>

                {/* --- BOTTOM: Tier Tables --- */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
                    <TierGroupTable
                        title="Dealer Network Breakdown"
                        color="#2563EB" 
                        bgColor="#EFF6FF"
                        borderColor="#BFDBFE"
                        tiers={TIER_RULES[CUSTOMER_GROUPS.DEALER]}
                        data={tierData[CUSTOMER_GROUPS.DEALER]}
                        styles={styles}
                    />
                    <TierGroupTable
                        title="Commercial Division Breakdown"
                        color="#059669"
                        bgColor="#ECFDF5"
                        borderColor="#A7F3D0"
                        tiers={TIER_RULES[CUSTOMER_GROUPS.COMMERCIAL]}
                        data={tierData[CUSTOMER_GROUPS.COMMERCIAL]}
                        styles={styles}
                    />
                </div>
            </div>
        </div>
    );
};

const TierGroupTable = ({ title, color, bgColor, borderColor, tiers, data, styles }) => {
    const sortedTiers = [
        ...tiers.map(r => data[r.name]), 
        data['Unassigned'] 
    ].filter(Boolean);

    return (
        <div style={styles.tableContainer}>
            <div style={{ backgroundColor: bgColor, borderBottom: `1px solid ${borderColor}`, padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center' }}>
                <div style={{ width: '4px', height: '24px', backgroundColor: color, borderRadius: '2px', marginRight: '12px' }}></div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '600', color: color, letterSpacing: '-0.01em' }}>
                    {title}
                </h3>
            </div>
            
            <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                    <thead>
                        <tr>
                            <th style={{...styles.th, textAlign: 'left', paddingLeft: '2rem'}}>Tier Classification</th>
                            <th style={{...styles.th, textAlign: 'center'}}>Coverage</th>
                            <th style={{...styles.th, textAlign: 'right'}}>Total Implied Spend</th>
                            <th style={{...styles.th, textAlign: 'right'}}>Net Profit Contribution</th>
                            <th style={{...styles.th, textAlign: 'right', paddingRight: '2rem'}}>Aggregate Margin</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedTiers.map(tier => {
                            const isUnassigned = tier.name === 'Unassigned';
                            const isEmpty = tier.customers.length === 0;

                            return (
                                <tr key={tier.name} style={{
                                    backgroundColor: isUnassigned ? '#fffbeb' : '#ffffff',
                                    borderTop: isUnassigned ? '2px solid #fde68a' : 'none',
                                    opacity: isEmpty ? 0.6 : 1,
                                    transition: 'background-color 0.2s'
                                }}>
                                    <td style={{...styles.td, paddingLeft: '2rem', fontWeight: isEmpty ? '500' : '600', color: isEmpty ? '#94a3b8' : color}}>
                                        {tier.name}
                                    </td>
                                    <td style={{...styles.td, textAlign: 'center'}}>
                                        <span style={isEmpty ? styles.badgeGray : styles.badgeBlue}>
                                            {tier.customers.length} Accounts
                                        </span>
                                    </td>
                                    <td style={{...styles.td, textAlign: 'right', fontWeight: '500'}}>
                                        {formatCurrency(tier.totalRevenue, 0)}
                                    </td>
                                    <td style={{...styles.td, textAlign: 'right', fontWeight: '500', color: tier.totalProfit > 0 ? '#10b981' : '#64748b'}}>
                                        {formatCurrency(tier.totalProfit, 0)}
                                    </td>
                                    <td style={{...styles.td, textAlign: 'right', paddingRight: '2rem'}}>
                                        <div style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '0.3rem 0.8rem',
                                            borderRadius: '6px',
                                            fontWeight: '600',
                                            fontSize: '0.9rem',
                                            backgroundColor: tier.avgMargin > 0.3 ? '#ecfdf5' : tier.avgMargin < 0.15 ? '#fef2f2' : '#f8fafc',
                                            color: tier.avgMargin > 0.3 ? '#059669' : tier.avgMargin < 0.15 ? '#dc2626' : '#475569',
                                            border: `1px solid ${tier.avgMargin > 0.3 ? '#a7f3d0' : tier.avgMargin < 0.15 ? '#fecaca' : '#e2e8f0'}`
                                        }}>
                                            {formatPercent(tier.avgMargin)}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ImpactAnalysis;

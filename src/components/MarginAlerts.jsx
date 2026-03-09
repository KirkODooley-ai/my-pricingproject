import React, { useMemo, useState } from 'react';
import {
    CUSTOMER_GROUPS,
    TIER_RULES,
    getCategoryGroup,
    getEffectiveCategoryGroup,
    getMarginFloor,
    getListMultiplier,
    formatPercent
} from '../utils/pricingEngine';
import { useAuth } from '../contexts/AuthContext';

const MarginAlerts = ({ strategy, setStrategy, categories }) => {
    const { user } = useAuth();
    const canEdit = user?.role === 'admin' || user?.can_edit === true;
    const [sortConfig, setSortConfig] = useState({ key: 'marginDiff', direction: 'ascending' });

    // Handler: Recalibrate (Set Net Margin to Floor + 3%)
    const handleRecalibrate = (item) => {
        const targetMargin = item.floorMargin + 0.03;
        const targetNetMult = 1 / (1 - targetMargin);
        const listMult = getListMultiplier(strategy, item.category);
        const newTierMult = targetNetMult / listMult;
        const safeVal = parseFloat(newTierMult.toFixed(3));

        setStrategy(prev => {
            const groupTiers = prev.tierMultipliers[item.group] || {};
            const tierConfig = groupTiers[item.tier] || {};

            return {
                ...prev,
                tierMultipliers: {
                    ...prev.tierMultipliers,
                    [item.group]: {
                        ...groupTiers,
                        [item.tier]: {
                            ...tierConfig,
                            [item.category]: safeVal
                        }
                    }
                }
            };
        });
    };

    // flatten data
    const alerts = useMemo(() => {
        const results = [];

        Object.keys(CUSTOMER_GROUPS).forEach(k => {
            const gType = CUSTOMER_GROUPS[k];
            const tiers = TIER_RULES[gType];

            tiers.forEach((tier, tIdx) => {
                const discountMap = strategy.tierMultipliers[gType]?.[tier.name] || {};

                categories.forEach(cat => {
                    const group = getEffectiveCategoryGroup(cat);
                    const floor = getMarginFloor(group, tIdx, tiers.length);

                    const listMult = getListMultiplier(strategy, cat.name);
                    const tierMult = discountMap[cat.name] ?? discountMap['Default'] ?? 1.0;
                    const netMult = listMult * tierMult;
                    const realizedMargin = 1 - (1 / netMult);

                    const marginDiff = realizedMargin - floor;

                    if (marginDiff < 0.02) {
                        results.push({
                            id: `${gType}-${tier.name}-${cat.name}`,
                            group: gType,
                            tier: tier.name,
                            category: cat.name,
                            catGroup: group,
                            currentMult: tierMult,
                            netMult: netMult,
                            realizedMargin: realizedMargin,
                            floorMargin: floor,
                            marginDiff,
                            listMult, // Pass for helper
                            type: realizedMargin < floor ? 'BELOW_FLOOR' : 'WARNING' // Extrapolating type for UI flags
                        });
                    }
                });
            });
        });
        return results;
    }, [strategy, categories]);

    // Sorting
    const sortedData = useMemo(() => {
        let sortable = [...alerts];
        if (sortConfig.key) {
            sortable.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortable;
    }, [alerts, sortConfig]);

    const requestSort = (key) => {
        let direction = 'ascending';
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const getSortIndicator = (key) => {
        if (sortConfig.key !== key) return '↕';
        return sortConfig.direction === 'ascending' ? '↑' : '↓';
    };

    // Premium SaaS UI Variables
    const styles = {
        pageWrapper: { width: '100%', minHeight: '100%' },
        container: { maxWidth: '1400px', margin: '0 auto', padding: '2.5rem', width: '100%', fontFamily: 'var(--font-base)' },
        headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #e2e8f0' },
        headerText: { fontSize: '1.85rem', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.02em', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.75rem' },
        subText: { color: '#64748b', fontSize: '1.05rem', margin: 0 },
        
        card: { backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.03)', border: '1px solid rgba(15, 23, 42, 0.08)', overflow: 'hidden' },
        
        table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
        th: { padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', cursor: 'pointer', userSelect: 'none', transition: 'background-color 0.2s' },
        td: { padding: '1.25rem 1.5rem', fontSize: '0.95rem', color: '#0f172a', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
        
        primaryBtn: { backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', boxShadow: '0 1px 3px rgba(37,99,235,0.2)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' },
        disabledBtn: { backgroundColor: '#f1f5f9', color: '#94a3b8', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: '500', cursor: 'not-allowed', width: '100%', textAlign: 'center' }
    };

    return (
        <div style={styles.pageWrapper}>
            <div style={styles.container}>
                {/* Header */}
                <div style={styles.headerRow}>
                    <div>
                        <h2 style={styles.headerText}>
                            <span style={{color: '#dc2626'}}>⚠️</span> Margin Alerts
                        </h2>
                        <p style={styles.subText}>
                            Monitoring <strong style={{color: '#dc2626', fontWeight: '600'}}>{alerts.length}</strong> tier-price structures that are near or below the safety floor.
                        </p>
                    </div>
                </div>

                <div style={styles.card}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.th} onClick={() => requestSort('group')}>Division {getSortIndicator('group')}</th>
                                    <th style={styles.th} onClick={() => requestSort('tier')}>Tier Classification {getSortIndicator('tier')}</th>
                                    <th style={styles.th} onClick={() => requestSort('category')}>Product Category {getSortIndicator('category')}</th>
                                    <th style={{...styles.th, textAlign: 'right'}} onClick={() => requestSort('currentMult')}>Active Multiplier {getSortIndicator('currentMult')}</th>
                                    <th style={{...styles.th, textAlign: 'right'}} onClick={() => requestSort('realizedMargin')}>Current Margin % {getSortIndicator('realizedMargin')}</th>
                                    <th style={{...styles.th, textAlign: 'right'}} onClick={() => requestSort('floorMargin')}>Margin Floor {getSortIndicator('floorMargin')}</th>
                                    <th style={{...styles.th, textAlign: 'right'}} onClick={() => requestSort('marginDiff')}>Safety Buffer {getSortIndicator('marginDiff')}</th>
                                    <th style={{...styles.th, textAlign: 'center'}}>Status Flag</th>
                                    <th style={{...styles.th, textAlign: 'center'}}>Quick Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedData.map(row => (
                                    <tr key={row.id} style={{ transition: 'background-color 0.2s' }}>
                                        <td style={{...styles.td, color: '#475569'}}>{row.group}</td>
                                        <td style={{...styles.td, fontWeight: '600'}}>{row.tier}</td>
                                        <td style={{...styles.td, fontWeight: '500'}}>
                                            {row.category}
                                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem', fontWeight: '400' }}>{row.catGroup}</span>
                                        </td>
                                        <td style={{...styles.td, textAlign: 'right', fontWeight: '600', color: '#334155'}}>{row.currentMult.toFixed(2)}x</td>
                                        <td style={{...styles.td, textAlign: 'right', fontWeight: '700', color: row.realizedMargin < row.floorMargin ? '#dc2626' : '#0f172a'}}>
                                            {formatPercent(row.realizedMargin)}
                                        </td>
                                        <td style={{...styles.td, textAlign: 'right', color: '#64748b'}}>
                                            {formatPercent(row.floorMargin)}
                                        </td>
                                        <td style={{...styles.td, textAlign: 'right', fontWeight: '700', color: row.marginDiff < 0 ? '#dc2626' : '#d97706'}}>
                                            {row.marginDiff > 0 ? '+' : ''}{formatPercent(row.marginDiff)}
                                        </td>
                                        <td style={{...styles.td, textAlign: 'center'}}>
                                            {row.type === 'INVERSION' ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <span style={{ backgroundColor: '#f3e8ff', border: '1px solid #d8b4fe', color: '#7e22ce', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.05em' }}>TIER INVERSION</span>
                                                    <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '4px' }}>{row.message}</span>
                                                </div>
                                            ) : row.type === 'LIST_PRICE' ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <span style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.05em' }}>FLOOR BREACH</span>
                                                    <span style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: '4px' }}>Check List Price</span>
                                                </div>
                                            ) : row.marginDiff < 0 ? (
                                                <span style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.05em', display: 'inline-block' }}>CRITICAL BREACH</span>
                                            ) : (
                                                <span style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', color: '#d97706', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.05em', display: 'inline-block' }}>AT RISK</span>
                                            )}
                                        </td>
                                        <td style={{...styles.td, textAlign: 'center'}}>
                                            {row.type === 'LIST_PRICE' ? (
                                                <button disabled style={styles.disabledBtn}>Maxed (1.0x)</button>
                                            ) : canEdit ? (
                                                <button
                                                    onClick={() => handleRecalibrate(row)}
                                                    style={styles.primaryBtn}
                                                    title={`Fix: Set to Floor + 3% (${formatPercent(row.floorMargin + 0.03)})`}
                                                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
                                                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#2563eb'; }}
                                                >
                                                    <span style={{fontSize: '1rem'}}>🔧</span> Recalibrate
                                                </button>
                                            ) : (
                                                <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {sortedData.length === 0 && (
                                    <tr>
                                        <td colSpan="9" style={{...styles.td, textAlign: 'center', padding: '4rem 2rem', color: '#64748b'}}>
                                            <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>✅</div>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#0f172a', margin: '0 0 0.5rem 0' }}>All Clear</h3>
                                            <p style={{ margin: 0 }}>No margin breaches detected across the pricing portfolio.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MarginAlerts;

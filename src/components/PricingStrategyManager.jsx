import React, { useState } from 'react';
import { CUSTOMER_GROUPS, TIER_RULES, FASTENER_TYPES, getCategoryGroup, getMarginFloor, enforceTierHierarchy, getListMultiplier, MARGIN_GAUGE_SPECIFIC_CATEGORIES, GAUGES_PER_MARGIN_CATEGORY } from '../utils/pricingEngine';
import { useAuth } from '../contexts/AuthContext';

const PricingStrategyManager = ({ strategy, setStrategy, categories, salesTransactions, customers, products = [], productVariants = [], onSave }) => {
    const { user } = useAuth();
    const isManager = user?.role === 'manager';
    const isAnalyst = user?.role === 'analyst';
    const canEdit = user?.role === 'admin' || user?.can_edit === true;

    // UI State
    const [activeTab, setActiveTab] = useState('markup'); // 'markup' | 'discounts'
    const [discountActiveGroup, setDiscountActiveGroup] = useState(CUSTOMER_GROUPS.DEALER);
    const [expandedFasteners, setExpandedFasteners] = useState(false);
    const [expandedMarkupRows, setExpandedMarkupRows] = useState(() => new Set());

    const toggleMarkupExpand = (catName) => {
        setExpandedMarkupRows(prev => {
            const next = new Set(prev);
            if (next.has(catName)) next.delete(catName);
            else next.add(catName);
            return next;
        });
    };

    // Gauge options per category - matches Admin/Product pages (only FA, FC36, I9, II6, FR, 12" Forma Loc, 16" Forma Loc)
    const categoryVariantsMap = React.useMemo(() => {
        const map = {};
        MARGIN_GAUGE_SPECIFIC_CATEGORIES.forEach(catName => {
            const gauges = GAUGES_PER_MARGIN_CATEGORY[catName];
            map[catName] = Array.isArray(gauges) ? [...gauges].sort((a, b) => b - a) : [];
        });
        return map;
    }, []);

    const handleListMultiplierChange = (group, value) => {
        if (isManager) return;
        const val = parseFloat(value);
        if (isNaN(val) || val < 0) return;
        setStrategy(prev => ({
            ...prev,
            listMultipliers: { ...prev.listMultipliers, [group]: val }
        }));
    };

    const handleTierDiscountChange = (groupType, tierName, productGroup, value) => {
        if (isManager) return;
        const val = parseFloat(value);
        if (isNaN(val) || val < 0) return;
        setStrategy(prev => {
            const groupTiers = prev.tierMultipliers[groupType] || {};
            const tierConfig = groupTiers[tierName] || {};
            return {
                ...prev,
                tierMultipliers: {
                    ...prev.tierMultipliers,
                    [groupType]: {
                        ...groupTiers,
                        [tierName]: { ...tierConfig, [productGroup]: val }
                    }
                }
            };
        });
    };

    const handleAutoCalculate = () => {
        if (!salesTransactions || salesTransactions.length === 0) {
            alert("No sales data available to analyze.");
            return;
        }
        const confirmCalc = window.confirm(
            "This will OVERWRITE your current discount settings based on your sales history.\n\n" +
            "Logic: For each Category & Tier, calculate the effective discount needed to match your historical pricing against a 3.0x multiplier.\n\n" +
            "Are you sure?"
        );
        if (!confirmCalc) return;

        import('../utils/pricingEngine').then(({ calculateAutoDiscounts }) => {
            const finalStrategy = calculateAutoDiscounts(strategy, salesTransactions, customers, categories);
            setStrategy(finalStrategy);
            alert("SUCCESS: Values updated.");
        });
    };

    const groupedCategories = categories.reduce((acc, cat) => {
        const group = getCategoryGroup(cat.name);
        if (!acc[group]) acc[group] = [];
        acc[group].push(cat.name);
        return acc;
    }, {});

    const groupOrder = ['Large Rolled Panel', 'Small Rolled Panels', 'Cladding Series', 'Parts'];
    Object.keys(groupedCategories).forEach(g => {
        if (!groupOrder.includes(g)) groupOrder.push(g);
    });

    // Premium SaaS UI Variables
    const styles = {
        pageWrapper: { width: '100%', minHeight: '100%' },
        container: { maxWidth: '1600px', margin: '0 auto', padding: '2.5rem', width: '100%', fontFamily: 'var(--font-base)' },
        headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' },
        headerText: { fontSize: '1.75rem', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.02em', margin: '0 0 0.5rem 0' },
        subText: { color: '#64748b', fontSize: '1rem', margin: 0 },
        headerActions: { display: 'flex', gap: '1rem', alignItems: 'center' },
        
        primaryBtn: { padding: '0.6rem 1.25rem', backgroundColor: '#2563EB', color: '#ffffff', border: 'none', borderRadius: '6px', fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' },
        outlineBtn: { padding: '0.5rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer', fontWeight: '500', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem' },
        actionTextBtn: { background: 'none', border: 'none', color: '#2563EB', fontWeight: '600', cursor: 'pointer', padding: '0.25rem 0.5rem', fontSize: '0.85rem' },

        card: { backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.03)', border: '1px solid rgba(15, 23, 42, 0.08)', overflow: 'hidden' },
        
        tableControlBar: { padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(15, 23, 42, 0.08)', backgroundColor: '#ffffff', display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' },
        
        inputField: { padding: '0.4rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '0.9rem', color: '#0f172a', transition: 'all 0.2s', outline: 'none' },

        table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
        th: { padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', borderBottom: '1px solid rgba(15, 23, 42, 0.08)' },
        td: { padding: '0.75rem 1.5rem', fontSize: '0.95rem', color: '#0f172a', borderBottom: '1px solid rgba(15, 23, 42, 0.04)', verticalAlign: 'middle' },
        
        groupRow: { backgroundColor: '#f8fafc' },
        groupText: { fontWeight: '600', color: '#64748b', padding: '0.8rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #e2e8f0', borderTop: '1px solid #e2e8f0' },
        
        tabContainer: { display: 'flex', gap: '0.5rem', backgroundColor: '#f1f5f9', padding: '0.35rem', borderRadius: '8px' },
        tabBtn: (isActive) => ({ padding: '0.5rem 1.25rem', border: 'none', borderRadius: '6px', background: isActive ? '#fff' : 'transparent', color: isActive ? '#0f172a' : '#64748b', fontWeight: isActive ? '600' : '500', cursor: 'pointer', boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s', fontSize: '0.9rem' })
    };

    return (
        <div style={styles.pageWrapper}>
            <div style={styles.container}>
                {/* Header */}
                <div style={styles.headerRow}>
                    <div>
                        <h2 style={styles.headerText}>Pricing Strategy</h2>
                        <p style={styles.subText}>Configure regional markups and tier-specific discount structures</p>
                    </div>

                    <div style={styles.headerActions}>
                        <div style={styles.tabContainer}>
                            <button style={styles.tabBtn(activeTab === 'markup')} onClick={() => setActiveTab('markup')}>Base Multipliers</button>
                            <button style={styles.tabBtn(activeTab === 'discounts')} onClick={() => setActiveTab('discounts')}>Tier Discounts</button>
                        </div>

                        {!isManager && canEdit && (
                            <button
                                onClick={onSave}
                                style={{...styles.primaryBtn, backgroundColor: isAnalyst ? '#f59e0b' : '#2563EB', display: 'flex', alignItems: 'center', gap: '0.5rem'}}
                            >
                                <span>{isAnalyst ? '📝' : '💾'}</span> {isAnalyst ? 'Propose Changes' : 'Save Structure'}
                            </button>
                        )}
                    </div>
                </div>

                <div style={styles.card}>
                    {/* --- TAB 1: MARKUP --- */}
                    {activeTab === 'markup' && (
                        <div>
                            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(15, 23, 42, 0.08)', backgroundColor: '#ffffff' }}>
                                <p style={{ color: '#475569', fontSize: '0.95rem', margin: 0 }}>
                                    Base Multiplier applied to <strong style={{ color: '#0f172a' }}>Cost</strong> to determine Regional <strong style={{ color: '#0f172a' }}>List Price</strong>.
                                </p>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                                <table style={styles.table}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#fafbfc' }}>
                                            <th style={{...styles.th, width: '40%'}}>Product Category</th>
                                            <th style={{...styles.th, width: '30%', textAlign: 'right'}}>Base Multiplier</th>
                                            <th style={{...styles.th, width: '30%', textAlign: 'right'}}>Projected ($100 Cost)</th>
                                        </tr>
                                    </thead>
                                    {groupOrder.map(groupName => {
                                        const cats = groupedCategories[groupName];
                                        if (!cats) return null;

                                        return (
                                            <tbody key={groupName}>
                                                <tr style={styles.groupRow}><td colSpan="3" style={styles.groupText}>{groupName}</td></tr>
                                                
                                                {cats.sort().map(catName => {
                                                    const variants = categoryVariantsMap[catName] || [];
                                                    const hasVariants = variants.length > 0;

                                                    return (
                                                        <React.Fragment key={catName}>
                                                            {hasVariants ? (
                                                                <>
                                                                    {/* Gauged category: parent row with expand toggle */}
                                                                    <tr style={{ backgroundColor: expandedMarkupRows.has(catName) ? '#fafbfc' : '#f8fafc' }}>
                                                                        <td colSpan="3" style={{...styles.td, fontWeight: '600', color: '#475569', fontSize: '0.9rem', borderBottom: '1px solid #e2e8f0'}}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                                                <button
                                                                                    onClick={() => toggleMarkupExpand(catName)}
                                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563EB', fontSize: '0.75rem', padding: 0 }}
                                                                                    title={expandedMarkupRows.has(catName) ? 'Collapse' : 'Expand'}
                                                                                >
                                                                                    {expandedMarkupRows.has(catName) ? '▼' : '▶'}
                                                                                </button>
                                                                                <span>{catName}</span>
                                                                                {!expandedMarkupRows.has(catName) && (
                                                                                    <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '500' }}>+ {variants.length} gauges</span>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                    {/* Explicit sub-rows for every gauge (only when expanded) */}
                                                                    {expandedMarkupRows.has(catName) && variants.map(gauge => {
                                                                        const variantKey = `${catName}:${gauge}`;
                                                                        const explicitVal = strategy.listMultipliers[variantKey];
                                                                        const fallbackVal = strategy.listMultipliers[catName] || 1.5;
                                                                        const currentVal = explicitVal !== undefined ? explicitVal : fallbackVal;
                                                                        const isOverridden = explicitVal !== undefined;

                                                                        return (
                                                                            <tr key={variantKey} style={{ backgroundColor: '#ffffff' }}>
                                                                                <td style={{...styles.td, paddingLeft: '3rem', fontSize: '0.9rem', color: '#334155', borderLeft: '3px solid #cbd5e1'}}>↳ {gauge} Gauge</td>
                                                                                <td style={{...styles.td, textAlign: 'right'}}>
                                                                                    <input
                                                                                        type="number" step="0.05"
                                                                                        style={{...styles.inputField, width: '100px', textAlign: 'right', backgroundColor: isOverridden ? '#fffbeb' : '#ffffff', borderColor: isOverridden ? '#fcd34d' : '#cbd5e1'}}
                                                                                        value={currentVal}
                                                                                        onChange={(e) => handleListMultiplierChange(variantKey, e.target.value)}
                                                                                        disabled={isManager}
                                                                                    />
                                                                                </td>
                                                                                <td style={{...styles.td, textAlign: 'right', color: isOverridden ? '#d97706' : '#2563EB', fontWeight: '600'}}>
                                                                                    ${(100 * currentVal).toFixed(2)}
                                                                                </td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    {/* Non-gauged: parent row has inputs */}
                                                                    <tr>
                                                                        <td style={{...styles.td, fontWeight: '500'}}>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                                                <div style={{ width: '16px' }}></div>
                                                                                <span>{catName}</span>
                                                                                {catName === 'Fasteners' && (
                                                                                    <button style={styles.actionTextBtn} onClick={() => setExpandedFasteners(!expandedFasteners)}>
                                                                                        {expandedFasteners ? 'Hide Spec' : 'Expand Spec'}
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td style={{...styles.td, textAlign: 'right'}}>
                                                                            <input
                                                                                type="number" step="0.05"
                                                                                style={{...styles.inputField, width: '100px', textAlign: 'right', fontWeight: '500'}}
                                                                                value={strategy.listMultipliers[catName] || 1.5}
                                                                                onChange={(e) => handleListMultiplierChange(catName, e.target.value)}
                                                                                disabled={isManager}
                                                                            />
                                                                        </td>
                                                                        <td style={{...styles.td, textAlign: 'right', color: '#2563EB', fontWeight: '600'}}>
                                                                            ${(100 * (strategy.listMultipliers[catName] || 1.5)).toFixed(2)}
                                                                        </td>
                                                                    </tr>
                                                                </>
                                                            )}

                                                            {/* Fasteners */}
                                                            {catName === 'Fasteners' && expandedFasteners && FASTENER_TYPES.map(type => {
                                                                const subKey = `Fasteners:${type}`;
                                                                return (
                                                                    <tr key={subKey} style={{ backgroundColor: '#fafbfc' }}>
                                                                        <td style={{...styles.td, paddingLeft: '3rem', fontSize: '0.85rem', color: '#64748b', borderLeft: '3px solid #cbd5e1'}}>↳ Class: {type}</td>
                                                                        <td style={{...styles.td, textAlign: 'right'}}>
                                                                            <input
                                                                                type="number" step="0.05"
                                                                                style={{...styles.inputField, width: '100px', textAlign: 'right'}}
                                                                                value={strategy.listMultipliers[subKey] || strategy.listMultipliers['Fasteners'] || 1.5}
                                                                                onChange={(e) => handleListMultiplierChange(subKey, e.target.value)}
                                                                                disabled={isManager}
                                                                            />
                                                                        </td>
                                                                        <td style={{...styles.td, textAlign: 'right', color: '#2563EB', fontWeight: '500'}}>
                                                                            ${(100 * (strategy.listMultipliers[subKey] || strategy.listMultipliers['Fasteners'] || 1.5)).toFixed(2)}
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        );
                                    })}
                                </table>
                            </div>
                        </div>
                    )}

                    {/* --- TAB 2: DISCOUNTS --- */}
                    {activeTab === 'discounts' && (
                        <div>
                            <div style={styles.tableControlBar}>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={() => setDiscountActiveGroup(CUSTOMER_GROUPS.DEALER)}
                                        style={{...styles.outlineBtn, ...(discountActiveGroup === CUSTOMER_GROUPS.DEALER ? { backgroundColor: '#EFF6FF', borderColor: '#bfdbfe', color: '#1e40af' } : {})}}
                                    >
                                        Dealer Pricing
                                    </button>
                                    <button
                                        onClick={() => setDiscountActiveGroup(CUSTOMER_GROUPS.COMMERCIAL)}
                                        style={{...styles.outlineBtn, ...(discountActiveGroup === CUSTOMER_GROUPS.COMMERCIAL ? { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' } : {})}}
                                    >
                                        Commercial Pricing
                                    </button>
                                </div>

                                {!isManager && canEdit && (
                                    <button onClick={handleAutoCalculate} style={{...styles.outlineBtn, borderColor: '#cbd5e1', color: '#0f172a'}}>
                                        ⚡ Auto-Align to Historic Data
                                    </button>
                                )}
                            </div>

                            <TransposedTierTable
                                groupType={discountActiveGroup}
                                tiers={TIER_RULES[discountActiveGroup]}
                                groupedCategories={groupedCategories}
                                groupOrder={groupOrder}
                                strategy={strategy}
                                onChange={handleTierDiscountChange}
                                categoryVariantsMap={categoryVariantsMap}
                                isManager={isManager}
                                styles={styles}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Transposed Table
const TransposedTierTable = ({ groupType, tiers, groupedCategories, groupOrder, strategy, onChange, categoryVariantsMap, isManager, styles }) => {
    const [expandedRows, setExpandedRows] = React.useState(() => new Set());

    const toggleExpand = (catName) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(catName)) next.delete(catName);
            else next.add(catName);
            return next;
        });
    };

    return (
        <div style={{ overflowX: 'auto' }}>
            <table style={{...styles.table, borderTop: 'none'}}>
                <thead>
                    <tr style={{ backgroundColor: '#ffffff' }}>
                        <th style={{...styles.th, minWidth: '220px', position: 'sticky', left: 0, zIndex: 10, backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0'}}>Classification</th>
                        {tiers.map(tier => (
                            <th key={tier.name} style={{...styles.th, textAlign: 'center', minWidth: '110px'}}>
                                {tier.name.replace('Authorized ', '').replace(' Partner', '')}
                            </th>
                        ))}
                    </tr>
                </thead>
                {groupOrder.map(groupName => {
                    const cats = groupedCategories[groupName];
                    if (!cats) return null;

                    return (
                        <tbody key={groupName}>
                            <tr style={styles.groupRow}>
                                <td style={{...styles.groupText, position: 'sticky', left: 0, zIndex: 5, backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0'}}>{groupName}</td>
                                {tiers.map(t => <td key={t.name} style={{ borderBottom: '1px solid #e2e8f0', borderTop: '1px solid #e2e8f0' }}></td>)}
                            </tr>

                            {cats.sort().map(catName => {
                                const variants = categoryVariantsMap[catName] || [];
                                const hasVariants = variants.length > 0;

                                return (
                                    <React.Fragment key={catName}>
                                        {hasVariants ? (
                                            <>
                                                {/* Gauged category: parent row with expand toggle */}
                                                <tr style={{ backgroundColor: expandedRows.has(catName) ? '#fafbfc' : '#f8fafc' }}>
                                                    <td colSpan={tiers.length + 1} style={{...styles.td, fontWeight: '600', color: '#475569', fontSize: '0.9rem', borderBottom: '1px solid #e2e8f0', position: 'sticky', left: 0, zIndex: 5, backgroundColor: expandedRows.has(catName) ? '#fafbfc' : '#f8fafc', borderRight: '1px solid #e2e8f0'}}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <button
                                                                onClick={() => toggleExpand(catName)}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563EB', fontSize: '0.75rem', padding: 0 }}
                                                                title={expandedRows.has(catName) ? 'Collapse' : 'Expand'}
                                                            >
                                                                {expandedRows.has(catName) ? '▼' : '▶'}
                                                            </button>
                                                            <span>{catName}</span>
                                                            {!expandedRows.has(catName) && (
                                                                <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: '500' }}>+ {variants.length} gauges</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                                {/* Explicit sub-rows for every gauge with ↳ (only when expanded) */}
                                                {expandedRows.has(catName) && variants.map(gauge => {
                                                    const variantKey = `${catName}:${gauge}`;
                                                    return (
                                                        <tr key={variantKey} style={{ backgroundColor: '#ffffff' }}>
                                                            <td style={{...styles.td, paddingLeft: '3rem', fontSize: '0.9rem', color: '#334155', borderLeft: '3px solid #cbd5e1', position: 'sticky', left: 0, zIndex: 5, backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0'}}>
                                                                ↳ {gauge} Gauge
                                                            </td>
                                                            {tiers.map(tier => {
                                                                const explicitVal = strategy.tierMultipliers[groupType]?.[tier.name]?.[variantKey];
                                                                const catVal = strategy.tierMultipliers[groupType]?.[tier.name]?.[catName]
                                                                    ?? strategy.tierMultipliers[groupType]?.[tier.name]?.['Default'] ?? 0.0;

                                                                const displayVal = explicitVal !== undefined ? explicitVal : catVal;
                                                                const isOverridden = explicitVal !== undefined && explicitVal !== catVal;

                                                                return (
                                                                    <td key={tier.name} style={{...styles.td, textAlign: 'center'}}>
                                                                        <input
                                                                            type="number" step="0.01" max="1.0" min="0.0"
                                                                            style={{
                                                                                ...styles.inputField, width: '80px', textAlign: 'center', padding: '0.4rem',
                                                                                backgroundColor: isOverridden ? '#fffbeb' : (displayVal > 0 ? '#ecfdf5' : '#ffffff'),
                                                                                borderColor: isOverridden ? '#fcd34d' : (displayVal > 0 ? '#34d399' : '#cbd5e1'),
                                                                                color: isOverridden ? '#b45309' : (displayVal > 0 ? '#065f46' : '#475569')
                                                                            }}
                                                                            value={displayVal}
                                                                            onChange={(e) => onChange(groupType, tier.name, variantKey, e.target.value)}
                                                                            disabled={isManager}
                                                                        />
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    );
                                                })}
                                            </>
                                        ) : (
                                            <>
                                                {/* Non-gauged: parent row has inputs */}
                                                <tr>
                                                    <td style={{...styles.td, fontWeight: '500', position: 'sticky', left: 0, zIndex: 5, backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0'}}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                            <div style={{ width: '16px' }}></div>
                                                            <span>{catName}</span>
                                                        </div>
                                                    </td>
                                                    {tiers.map(tier => {
                                                        const val = strategy.tierMultipliers[groupType]?.[tier.name]?.[catName]
                                                            ?? strategy.tierMultipliers[groupType]?.[tier.name]?.['Default']
                                                            ?? 0.0;

                                                        return (
                                                            <td key={tier.name} style={{...styles.td, textAlign: 'center'}}>
                                                                <input
                                                                    type="number" step="0.01" max="1.0" min="0.0"
                                                                    style={{
                                                                        ...styles.inputField, width: '80px', textAlign: 'center', padding: '0.4rem',
                                                                        backgroundColor: val > 0 ? '#ecfdf5' : '#ffffff',
                                                                        borderColor: val > 0 ? '#34d399' : '#cbd5e1',
                                                                        color: val > 0 ? '#065f46' : '#0f172a',
                                                                        fontWeight: val > 0 ? '600' : '400'
                                                                    }}
                                                                    value={val}
                                                                    onChange={(e) => onChange(groupType, tier.name, catName, e.target.value)}
                                                                    disabled={isManager}
                                                                />
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            </>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    );
                })}
            </table>
        </div>
    );
};

export default PricingStrategyManager;

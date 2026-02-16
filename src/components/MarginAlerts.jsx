import React, { useMemo, useState } from 'react'
import {
    CUSTOMER_GROUPS,
    TIER_RULES,
    getCategoryGroup,
    getMarginFloor,
    enforceTierHierarchy,
    getListMultiplier,
    formatPercent
} from '../utils/pricingEngine'
import './PricingTable.css' // Reuse styles

const MarginAlerts = ({ strategy, setStrategy, categories }) => {
    const [sortConfig, setSortConfig] = useState({ key: 'marginDiff', direction: 'ascending' })

    // Handler: Recalibrate (Set Net Margin to Floor + 3%)
    const handleRecalibrate = (item) => {
        // 1. Determine Target Margin (Floor + 3%)
        const targetMargin = item.floorMargin + 0.03

        // 2. Calculate Required Net Multiplier
        // Margin = 1 - (1 / NetMult) -> NetMult = 1 / (1 - Margin)
        const targetNetMult = 1 / (1 - targetMargin)

        // 3. Calculate Required Tier Multiplier
        // NetMult = ListMult * TierMult -> TierMult = NetMult / ListMult
        const listMult = getListMultiplier(strategy, item.category)
        const newTierMult = targetNetMult / listMult

        // 4. Update Strategy
        const safeVal = parseFloat(newTierMult.toFixed(3))

        setStrategy(prev => {
            const groupTiers = prev.tierMultipliers[item.group] || {}
            const tierConfig = groupTiers[item.tier] || {}

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
            }
        })
    }

    // flatten data
    const alerts = useMemo(() => {
        const results = []

        Object.keys(CUSTOMER_GROUPS).forEach(k => {
            const gType = CUSTOMER_GROUPS[k]
            const tiers = TIER_RULES[gType]

            tiers.forEach((tier, tIdx) => {
                const discountMap = strategy.tierMultipliers[gType]?.[tier.name] || {}

                categories.forEach(cat => {
                    const group = getCategoryGroup(cat.name)
                    const floor = getMarginFloor(group, tIdx, tiers.length)

                    const listMult = getListMultiplier(strategy, cat.name)
                    const tierMult = discountMap[cat.name] ?? discountMap['Default'] ?? 1.0
                    const netMult = listMult * tierMult
                    const realizedMargin = 1 - (1 / netMult)

                    const marginDiff = realizedMargin - floor

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
                            listMult // Pass for helper
                        })
                    }
                })
            })
        })
        return results
    }, [strategy, categories])

    // Sorting
    const sortedData = useMemo(() => {
        let sortable = [...alerts]
        if (sortConfig.key) {
            sortable.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? -1 : 1
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'ascending' ? 1 : -1
                }
                return 0
            })
        }
        return sortable
    }, [alerts, sortConfig])

    const requestSort = (key) => {
        let direction = 'ascending'
        if (sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending'
        }
        setSortConfig({ key, direction })
    }

    return (
        <div className="calculator-container" style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '4rem' }}>
            <div style={{ marginBottom: '2rem', borderBottom: '1px solid #e5e7eb' }}>
                <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.8rem', color: '#b91c1c' }}>⚠️ Margin Alerts</h2>
                <p style={{ color: '#6b7280' }}>
                    Monitoring <strong>{alerts.length}</strong> tier-prices that are near or below the safety floor.
                </p>
            </div>

            <div className="stat-card" style={{ padding: '0' }}>
                <table className="pricing-table" style={{ width: '100%' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#fef2f2' }}>
                            <th onClick={() => requestSort('group')}>Type ↕</th>
                            <th onClick={() => requestSort('tier')}>Tier ↕</th>
                            <th onClick={() => requestSort('category')}>Product Category ↕</th>
                            <th onClick={() => requestSort('currentMult')} style={{ textAlign: 'right' }}>Active Multiplier ↕</th>
                            <th onClick={() => requestSort('realizedMargin')} style={{ textAlign: 'right' }}>Current Margin % ↕</th>
                            <th onClick={() => requestSort('floorMargin')} style={{ textAlign: 'right' }}>Margin Floor ↕</th>
                            <th onClick={() => requestSort('marginDiff')} style={{ textAlign: 'right' }}>Safety Buffer ↕</th>
                            <th style={{ textAlign: 'center' }}>Status</th>
                            <th style={{ textAlign: 'center' }}>Quick Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedData.map(row => (
                            <tr key={row.id}>
                                <td>{row.group}</td>
                                <td style={{ fontWeight: 500 }}>{row.tier}</td>
                                <td>
                                    {row.category}
                                    <span style={{ display: 'block', fontSize: '0.75rem', color: '#9ca3af' }}>{row.catGroup}</span>
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{row.currentMult.toFixed(2)}x</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#111827' }}>
                                    {formatPercent(row.realizedMargin)}
                                </td>
                                <td style={{ textAlign: 'right', color: '#6b7280' }}>
                                    {formatPercent(row.floorMargin)}
                                </td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: row.marginDiff < 0 ? '#dc2626' : '#d97706' }}>
                                    {row.marginDiff > 0 ? '+' : ''}{formatPercent(row.marginDiff)}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    {row.type === 'INVERSION' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <span style={{ backgroundColor: '#e9d5ff', color: '#6b21a8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700 }}>TIER INVERSION</span>
                                            <span style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '2px' }}>{row.message}</span>
                                        </div>
                                    ) : row.type === 'LIST_PRICE' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                            <span style={{ backgroundColor: '#1f2937', color: '#f87171', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700 }}>FLOOR BREACH</span>
                                            <span style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: '2px' }}>Check List Price</span>
                                        </div>
                                    ) : row.marginDiff < 0 ? (
                                        <span style={{ backgroundColor: '#fecaca', color: '#991b1b', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700 }}>BELOW FLOOR</span>
                                    ) : (
                                        <span style={{ backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>WARNING</span>
                                    )}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    {row.type === 'LIST_PRICE' ? (
                                        <button disabled style={{ opacity: 0.5, cursor: 'not-allowed', border: '1px solid #ccc', background: '#eee', color: '#888', borderRadius: '4px', padding: '4px 8px' }}>
                                            Maxed (1.0x)
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleRecalibrate(row)}
                                            style={{
                                                backgroundColor: '#2563eb',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '4px',
                                                padding: '4px 8px',
                                                fontSize: '0.8rem',
                                                fontWeight: 600,
                                                cursor: 'pointer',
                                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
                                            }}
                                            title={`Fix: Set to Floor + 3% (${formatPercent(row.floorMargin + 0.03)})`}
                                        >
                                            Recalibrate 🔧
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export default MarginAlerts

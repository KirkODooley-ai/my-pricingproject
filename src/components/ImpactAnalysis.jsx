import React, { useMemo, useState } from 'react'
import {
    CUSTOMER_GROUPS,
    TIER_RULES,
    formatCurrency,
    formatPercent,
    aggregateCustomerStats
} from '../utils/pricingEngine'
import './PricingTable.css'

const ImpactAnalysis = ({
    customers,
    salesTransactions,
    categories = [],
    // Legacy props (kept for compatibility if we switch back)
    mix, setMix,
    tierCategoryDiscounts, setTierCategoryDiscounts,
    activeCategory, setActiveCategory
}) => {

    // --- 1. Aggregation Logic ---
    const tierData = useMemo(() => {
        const groups = {
            [CUSTOMER_GROUPS.DEALER]: {},
            [CUSTOMER_GROUPS.COMMERCIAL]: {},
            'Other': {} // Catch-all
        }

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
                }
            })
        })
        // Init 'Unassigned' buckets
        groups[CUSTOMER_GROUPS.DEALER]['Unassigned'] = { name: 'Unassigned', customers: [], totalRevenue: 0, totalCOGS: 0, totalProfit: 0, avgMargin: 0 }
        groups[CUSTOMER_GROUPS.COMMERCIAL]['Unassigned'] = { name: 'Unassigned', customers: [], totalRevenue: 0, totalCOGS: 0, totalProfit: 0, avgMargin: 0 }


        // Process Customers
        if (Array.isArray(customers)) {
            customers.forEach(cust => {
                if (!cust) return
                // Calculate Stats from Sales Data (Actuals)
                const stats = aggregateCustomerStats(cust, salesTransactions)

                // Determine Group & Tier
                const groupKey = groups[cust.group] ? cust.group : 'Other'

                // Re-calculate Tier dynamically based on ACTUAL spend (from Sales Data if avail, else manual)
                // Use the higher of Manual Annual Spend or Actual Sales Revenue
                const effectiveSpend = Math.max(cust.annualSpend || 0, stats.revenue)

                // Find Tier
                let tierName = 'Unassigned'
                if (TIER_RULES[groupKey]) {
                    const matchedRule = TIER_RULES[groupKey].find(r => effectiveSpend >= r.minSpend)
                    if (matchedRule) tierName = matchedRule.name
                }

                // Init bucket if missing (e.g. Other)
                if (!groups[groupKey][tierName]) {
                    groups[groupKey][tierName] = { name: tierName, customers: [], totalRevenue: 0, totalCOGS: 0, totalProfit: 0, avgMargin: 0 }
                }

                // Add to Bucket
                const customerRecord = {
                    ...cust,
                    derivedRevenue: effectiveSpend, // [FIX] Use Hybrid Spend
                    derivedProfit: stats.profit,
                    derivedMargin: stats.margin
                }

                const bucket = groups[groupKey][tierName]
                bucket.customers.push(customerRecord)
                bucket.totalRevenue += effectiveSpend // [FIX] Use Hybrid Spend
                bucket.totalCOGS += stats.cogs
                bucket.totalProfit += stats.profit
            })

            // Finalize Margin Calcs
            Object.values(groups).forEach(groupTiers => {
                Object.values(groupTiers).forEach(tier => {
                    if (tier.totalRevenue > 0) {
                        tier.avgMargin = tier.totalProfit / tier.totalRevenue
                    }
                    // Sort customers by Revenue Desc
                    tier.customers.sort((a, b) => b.derivedRevenue - a.derivedRevenue)
                })
            })

        }
        return groups
    }, [customers, salesTransactions])

    // --- 2. Chart Logic (SVG Scatter Plot) ---
    // Prepare data points: { x: Revenue, y: Margin, size: Count, label: Tier }
    const chartData = useMemo(() => {
        const points = []
        let maxRev = 0

        Object.keys(tierData).forEach(group => {
            Object.values(tierData[group]).forEach(tier => {
                if (tier.totalRevenue > 0) {
                    points.push({
                        label: `${tier.name} (${group})`,
                        x: tier.totalRevenue,
                        y: tier.avgMargin,
                        size: tier.customers.length,
                        group // 'Dealer' or 'Commercial'
                    })
                    if (tier.totalRevenue > maxRev) maxRev = tier.totalRevenue
                }
            })
        })
        return { points, maxRev: maxRev || 1 }
    }, [tierData])


    return (
        <div className="calculator-container" style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '4rem' }}>
            <div style={{ marginBottom: '2rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.8rem', color: '#111827' }}>Tier Performance Analysis</h2>
                <p style={{ color: '#6b7280', margin: '0.5rem 0 0 0' }}>
                    Analyze profitability and volume across your customer tiers. Data is aggregated from <strong>Actual Sales Transactions</strong>.
                </p>
            </div>

            {/* --- TOP: Visual Analysis (Scatter Plot) --- */}
            <div className="stat-card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>📊 value Matrix</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'normal', color: '#6b7280' }}>(Revenue vs. Margin)</span>
                </h3>

                <div style={{ position: 'relative', height: '300px', width: '100%', borderLeft: '2px solid #e5e7eb', borderBottom: '2px solid #e5e7eb', margin: '0 0 2rem 2rem' }}>
                    {/* Y-Axis Label */}
                    <div style={{ position: 'absolute', left: '-50px', top: '50%', transform: 'rotate(-90deg)', fontWeight: 'bold', color: '#6b7280', fontSize: '0.9rem' }}>Gross Margin %</div>

                    {/* X-Axis Label */}
                    <div style={{ position: 'absolute', bottom: '-40px', left: '50%', transform: 'translateX(-50%)', fontWeight: 'bold', color: '#6b7280', fontSize: '0.9rem' }}>Total Revenue ($)</div>

                    {/* Plot Points */}
                    {chartData.points.map((pt, idx) => {
                        // Scales
                        // X: 0 -> maxRev * 1.1
                        // Y: 0 -> 60% (0.6) fixed scale for Margin
                        const xPos = (pt.x / (chartData.maxRev * 1.1)) * 100
                        const yPos = (pt.y / 0.6) * 100 // Assume 60% max margin for scale

                        // Bubble Size (log scale)
                        const size = Math.max(12, Math.min(40, 10 + Math.log2(pt.size) * 5))
                        const color = pt.group === CUSTOMER_GROUPS.DEALER ? '#2563eb' : '#059669' // Blue vs Green

                        if (isNaN(xPos) || isNaN(yPos) || yPos > 100 || xPos > 100) return null // [FIX] Safety Guard

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
                                    borderRadius: '50%',
                                    opacity: 0.7,
                                    transform: 'translate(-50%, 50%)',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                    transition: 'all 0.2s',
                                    zIndex: 10
                                }}
                            >
                                <span style={{
                                    position: 'absolute',
                                    top: '-20px',
                                    left: '50%',
                                    transform: 'translateX(-50%)',
                                    fontSize: '0.7rem',
                                    whiteSpace: 'nowrap',
                                    fontWeight: 600,
                                    color: '#374151',
                                    pointerEvents: 'none'
                                }}>
                                    {pt.label.split(' ')[0]}
                                </span>
                            </div>
                        )
                    })}

                    {/* Grid Lines (20%, 40% Margin) */}
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: '33.3%', borderTop: '1px dashed #e5e7eb' }}><span style={{ position: 'absolute', left: '-35px', top: '-10px', fontSize: '0.75rem', color: '#9ca3af' }}>20%</span></div>
                    <div style={{ position: 'absolute', left: 0, right: 0, bottom: '66.6%', borderTop: '1px dashed #e5e7eb' }}><span style={{ position: 'absolute', left: '-35px', top: '-10px', fontSize: '0.75rem', color: '#9ca3af' }}>40%</span></div>
                </div>
            </div>

            {/* --- BOTTOM: Tier Tables --- */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '3rem' }}>

                {/* Dealer Table */}
                <TierGroupTable
                    title="Dealer Performance"
                    color="#1e3a8a" // Blue
                    tiers={TIER_RULES[CUSTOMER_GROUPS.DEALER]}
                    data={tierData[CUSTOMER_GROUPS.DEALER]}
                />

                {/* Commercial Table */}
                <TierGroupTable
                    title="Commercial Performance"
                    color="#065f46" // Green
                    tiers={TIER_RULES[CUSTOMER_GROUPS.COMMERCIAL]}
                    data={tierData[CUSTOMER_GROUPS.COMMERCIAL]}
                />

            </div>
        </div>
    )
}

// Sub-Component for Cleanliness
const TierGroupTable = ({ title, color, tiers, data }) => {
    // Merge Rules with actual buckets (ensure order matches Rules)
    const sortedTiers = [
        ...tiers.map(r => data[r.name]), // Expected Tiers
        data['Unassigned'] // Catch-all
    ].filter(Boolean)

    return (
        <div className="pricing-table-container">
            <h3 style={{ padding: '1rem', margin: 0, borderBottom: `4px solid ${color}`, color: color }}>
                {title}
            </h3>
            <table className="pricing-table" style={{ width: '100%' }}>
                <thead>
                    <tr style={{ backgroundColor: '#f9fafb', fontSize: '0.9rem' }}>
                        <th style={{ textAlign: 'left', paddingLeft: '1.5rem' }}>Tier Level</th>
                        <th style={{ textAlign: 'center' }}>Customers</th>
                        <th style={{ textAlign: 'right' }}>Total Spend</th>
                        <th style={{ textAlign: 'right' }}>Total Profit</th>
                        <th style={{ textAlign: 'right', paddingRight: '1.5rem' }}>Gross Margin</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedTiers.map(tier => {
                        const isUnassigned = tier.name === 'Unassigned'
                        const isEmpty = tier.customers.length === 0

                        return (
                            <React.Fragment key={tier.name}>
                                <tr style={{
                                    fontWeight: isEmpty ? 'normal' : '600',
                                    opacity: isEmpty ? 0.6 : 1,
                                    backgroundColor: isUnassigned ? '#fefce8' : 'white',
                                    borderTop: isUnassigned ? '2px solid #e5e7eb' : '1px solid #f3f4f6'
                                }}>
                                    <td style={{ paddingLeft: '1.5rem', color: color }}>{tier.name}</td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span className={`badge ${isEmpty ? 'gray' : 'blue'}`} style={{ fontSize: '0.8rem' }}>
                                            {tier.customers.length}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>{formatCurrency(tier.totalRevenue, 0)}</td>
                                    <td style={{ textAlign: 'right', color: tier.totalProfit > 0 ? '#16a34a' : '#6b7280' }}>
                                        {formatCurrency(tier.totalProfit, 0)}
                                    </td>
                                    <td style={{ textAlign: 'right', paddingRight: '1.5rem' }}>
                                        <div style={{
                                            display: 'inline-block',
                                            padding: '2px 8px',
                                            borderRadius: '4px',
                                            backgroundColor: tier.avgMargin > 0.3 ? '#dcfce7' : tier.avgMargin < 0.15 ? '#fee2e2' : '#f3f4f6',
                                            color: tier.avgMargin > 0.3 ? '#166534' : tier.avgMargin < 0.15 ? '#b91c1c' : '#374151'
                                        }}>
                                            {formatPercent(tier.avgMargin)}
                                        </div>
                                    </td>
                                </tr>
                                {/* Expandable / Inline Customers (If < 5 show inline, else just summary?) */}
                                {/* For now, simple summary row if active */}
                            </React.Fragment>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

export default ImpactAnalysis

import React from 'react'
import { formatCurrency } from '../utils/pricingEngine'
import './PricingTable.css'
import './PricingCalculator.css'

const Dashboard = ({ analysis, customers = [], categories = [] }) => {
    if (!analysis) return (
        <div className="empty-state">
            <h4>Loading Dashboard...</h4>
            <p>Please wait while we calculate your analytics.</p>
        </div>
    )

    const { totalCurrentRevenue, totalProjectedRevenue, totalDelta, customerImpacts } = analysis

    const winners = [...customerImpacts].sort((a, b) => a.delta - b.delta).slice(0, 5)
    const losers = [...customerImpacts].sort((a, b) => b.delta - a.delta).slice(0, 5)

    const totalCustomers = customers.length
    const totalSales = customers.reduce((acc, c) => acc + (c.annualSpend || 0), 0)

    const normalizeTerritory = (t) => {
        if (!t) return 'Other'
        let upper = String(t).toUpperCase().trim()
        if (['SASK', 'SASKATCHEWAN'].includes(upper)) return 'SK'
        if (['ALTA', 'ALBERTA'].includes(upper)) return 'AB'
        if (['BRITISH COLUMBIA'].includes(upper)) return 'BC'
        if (['MAN', 'MANITOBA'].includes(upper)) return 'MB'
        if (['ONT', 'ONTARIO'].includes(upper)) return 'ON'
        return upper
    }

    const uniqueTerritories = [...new Set(customers.map(c => normalizeTerritory(c.territory)))]

    const sortOrder = ['SK', 'AB', 'BC']
    uniqueTerritories.sort((a, b) => {
        const idxA = sortOrder.indexOf(a)
        const idxB = sortOrder.indexOf(b)
        if (idxA !== -1 && idxB !== -1) return idxA - idxB
        if (idxA !== -1) return -1
        if (idxB !== -1) return 1
        if (a === 'Other') return 1
        if (b === 'Other') return -1
        return a.localeCompare(b)
    })

    const displayTerritories = uniqueTerritories.length > 0 ? uniqueTerritories : ['SK', 'AB', 'BC', 'Other']

    const territoryStats = displayTerritories.map(terr => {
        const terrCustomers = customers.filter(c => normalizeTerritory(c.territory) === terr)
        const count = terrCustomers.length
        const sales = terrCustomers.reduce((acc, c) => acc + (c.annualSpend || 0), 0)
        const countPct = totalCustomers > 0 ? (count / totalCustomers) : 0
        const salesPct = totalSales > 0 ? (sales / totalSales) : 0

        return { name: terr, count, countPct, sales, salesPct }
    })

    const formatPercent = (val) => (val * 100).toFixed(1) + '%'

    return (
        <div className="dashboard-container">
            {/* Page Header */}
            <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', color: 'var(--text-primary)', fontWeight: 700, marginBottom: '0.25rem' }}>
                    Executive Dashboard
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    High-level overview of the pricing transition impact and business performance.
                </p>
            </div>

            {/* KPI Cards */}
            <div className="stats-grid" style={{ marginBottom: '2rem' }}>
                <div className="stat-card">
                    <h3>Current Revenue</h3>
                    <div className="metric-value">{formatCurrency(totalCurrentRevenue)}</div>
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Based on Annual Spend</small>
                </div>
                <div className="stat-card projected">
                    <h3>Projected Revenue</h3>
                    <div className="metric-value">{formatCurrency(totalProjectedRevenue)}</div>
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Post-Transition</small>
                </div>
                <div 
                    className="stat-card" 
                    style={{ 
                        borderLeft: totalDelta >= 0 ? '4px solid var(--success)' : '4px solid var(--danger)',
                        backgroundColor: totalDelta < 0 ? '#fef2f2' : 'var(--bg-surface)'
                    }}
                >
                    <h3>Net Impact</h3>
                    <div 
                        className="metric-value" 
                        style={{ color: totalDelta >= 0 ? 'var(--success)' : 'var(--danger)' }}
                    >
                        {totalDelta >= 0 ? '+' : ''}{formatCurrency(totalDelta)}
                    </div>
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total Delta</small>
                </div>
            </div>

            {/* Territory Performance */}
            <div className="pricing-table-container" style={{ marginBottom: '2rem' }}>
                <h4>Territory Performance</h4>
                <div className="table-wrapper" style={{ maxHeight: 'none' }}>
                    <table className="pricing-table">
                        <thead>
                            <tr>
                                <th style={{ width: '15%' }}>Territory</th>
                                <th style={{ width: '12%', textAlign: 'center' }}>Customers</th>
                                <th style={{ width: '28%' }}>% of List</th>
                                <th style={{ width: '17%', textAlign: 'right' }}>Total Sales</th>
                                <th style={{ width: '28%' }}>% of Revenue</th>
                            </tr>
                        </thead>
                        <tbody>
                            {territoryStats.map(stat => (
                                <tr key={stat.name}>
                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{stat.name}</td>
                                    <td style={{ textAlign: 'center' }}>{stat.count}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div className="progress-bar" style={{ flex: 1, maxWidth: '160px' }}>
                                                <div 
                                                    className="progress-bar-fill" 
                                                    style={{ width: formatPercent(stat.countPct) }}
                                                ></div>
                                            </div>
                                            <span style={{ 
                                                fontSize: '0.85rem', 
                                                fontWeight: 600,
                                                minWidth: '50px',
                                                color: 'var(--text-secondary)'
                                            }}>
                                                {formatPercent(stat.countPct)}
                                            </span>
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(stat.sales)}</td>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div className="progress-bar" style={{ flex: 1, maxWidth: '160px' }}>
                                                <div 
                                                    className="progress-bar-fill" 
                                                    style={{ 
                                                        width: formatPercent(stat.salesPct),
                                                        backgroundColor: 'var(--success)'
                                                    }}
                                                ></div>
                                            </div>
                                            <span style={{ 
                                                fontSize: '0.85rem', 
                                                fontWeight: 600,
                                                minWidth: '50px',
                                                color: 'var(--text-secondary)'
                                            }}>
                                                {formatPercent(stat.salesPct)}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Top 5 Product Lines */}
            <div className="pricing-table-container">
                <h4>Top 5 Product Lines (Revenue)</h4>
                <div className="table-wrapper" style={{ maxHeight: 'none' }}>
                    <table className="pricing-table">
                        <thead>
                            <tr>
                                <th style={{ width: '45%' }}>Product Line</th>
                                <th style={{ width: '20%', textAlign: 'right' }}>Revenue</th>
                                <th style={{ width: '35%' }}>% of Total Sales</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(() => {
                                const sortedCategories = [...categories].sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
                                const top5 = sortedCategories.slice(0, 5)
                                const totalRev = categories.reduce((sum, c) => sum + (parseFloat(c.revenue) || 0), 0)
                                const top5Total = top5.reduce((sum, c) => sum + (parseFloat(c.revenue) || 0), 0)
                                const top5Share = totalRev > 0 ? top5Total / totalRev : 0

                                return (
                                    <>
                                        {top5.map((cat, index) => {
                                            const rev = parseFloat(cat.revenue) || 0
                                            const share = totalRev > 0 ? rev / totalRev : 0

                                            return (
                                                <tr key={cat.id}>
                                                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                                        <span style={{ 
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            width: '24px',
                                                            height: '24px',
                                                            borderRadius: '50%',
                                                            backgroundColor: index === 0 ? 'var(--tier-gold-bg)' : 'var(--bg-muted)',
                                                            color: index === 0 ? 'var(--tier-bronze)' : 'var(--text-muted)',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 700,
                                                            marginRight: '0.75rem'
                                                        }}>
                                                            {index + 1}
                                                        </span>
                                                        {cat.name}
                                                    </td>
                                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(rev)}</td>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <div className="progress-bar" style={{ flex: 1, maxWidth: '180px' }}>
                                                                <div 
                                                                    className="progress-bar-fill" 
                                                                    style={{ width: formatPercent(share) }}
                                                                ></div>
                                                            </div>
                                                            <span style={{ 
                                                                fontSize: '0.85rem', 
                                                                fontWeight: 600,
                                                                minWidth: '50px',
                                                                color: 'var(--text-secondary)'
                                                            }}>
                                                                {formatPercent(share)}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                        {categories.length === 0 && (
                                            <tr>
                                                <td colSpan="3" className="empty-state" style={{ padding: '2.5rem' }}>
                                                    <p style={{ color: 'var(--text-muted)' }}>No categories defined</p>
                                                </td>
                                            </tr>
                                        )}
                                        {categories.length > 0 && (
                                            <tr style={{ 
                                                backgroundColor: 'var(--dark-blue)', 
                                                color: 'white'
                                            }}>
                                                <td style={{ 
                                                    fontWeight: 700,
                                                    color: 'white'
                                                }}>
                                                    Top 5 Combined
                                                </td>
                                                <td style={{ 
                                                    textAlign: 'right', 
                                                    fontWeight: 700,
                                                    color: 'white'
                                                }}>
                                                    {formatCurrency(top5Total)}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <div className="progress-bar" style={{ flex: 1, maxWidth: '180px', backgroundColor: 'rgba(255,255,255,0.2)' }}>
                                                            <div 
                                                                className="progress-bar-fill" 
                                                                style={{ 
                                                                    width: formatPercent(top5Share),
                                                                    backgroundColor: 'white'
                                                                }}
                                                            ></div>
                                                        </div>
                                                        <span style={{ 
                                                            fontSize: '0.9rem', 
                                                            fontWeight: 700,
                                                            minWidth: '50px',
                                                            color: 'white'
                                                        }}>
                                                            {formatPercent(top5Share)}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                )
                            })()}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default Dashboard

import React from 'react'
import { formatCurrency } from '../utils/pricingEngine'
import './PricingTable.css'
import './PricingCalculator.css'

const Dashboard = ({ analysis, customers = [], categories = [] }) => {
    if (!analysis) return <div>Loading Analysis...</div>

    const { totalCurrentRevenue, totalProjectedRevenue, totalDelta, customerImpacts } = analysis

    // Top 5 Winners (Price Drop)
    const winners = [...customerImpacts].sort((a, b) => a.delta - b.delta).slice(0, 5)
    // Top 5 Losers (Price Increase) - Sort desc by delta
    const losers = [...customerImpacts].sort((a, b) => b.delta - a.delta).slice(0, 5)

    // Territory Analytics
    const totalCustomers = customers.length
    const totalSales = customers.reduce((acc, c) => acc + (c.annualSpend || 0), 0)

    const normalizeTerritory = (t) => {
        if (!t) return 'Other'
        let upper = String(t).toUpperCase().trim()
        // Map known aliases
        if (['SASK', 'SASKATCHEWAN'].includes(upper)) return 'SK'
        if (['ALTA', 'ALBERTA'].includes(upper)) return 'AB'
        if (['BRITISH COLUMBIA'].includes(upper)) return 'BC'
        if (['MAN', 'MANITOBA'].includes(upper)) return 'MB'
        if (['ONT', 'ONTARIO'].includes(upper)) return 'ON'
        return upper
    }

    // Dynamic Territory List (Show whatever is in the data)
    const uniqueTerritories = [...new Set(customers.map(c => normalizeTerritory(c.territory)))]

    // Sort Priority: SK, AB, BC, then Alpha, then Other
    const sortOrder = ['SK', 'AB', 'BC']
    uniqueTerritories.sort((a, b) => {
        const idxA = sortOrder.indexOf(a)
        const idxB = sortOrder.indexOf(b)
        if (idxA !== -1 && idxB !== -1) return idxA - idxB // Both in priority list
        if (idxA !== -1) return -1 // A is priority
        if (idxB !== -1) return 1  // B is priority
        if (a === 'Other') return 1 // Other goes last
        if (b === 'Other') return -1
        return a.localeCompare(b) // Alphabetical for rest (MB, ON, US, etc)
    })

    // If empty (no customers), default to standard
    const displayTerritories = uniqueTerritories.length > 0 ? uniqueTerritories : ['SK', 'AB', 'BC', 'Other']

    const territoryStats = displayTerritories.map(terr => {
        const terrCustomers = customers.filter(c => normalizeTerritory(c.territory) === terr)
        const count = terrCustomers.length
        const sales = terrCustomers.reduce((acc, c) => acc + (c.annualSpend || 0), 0)

        // Avoid NaN if totals are 0
        const countPct = totalCustomers > 0 ? (count / totalCustomers) : 0
        const salesPct = totalSales > 0 ? (sales / totalSales) : 0

        return {
            name: terr,
            count,
            countPct,
            sales,
            salesPct
        }
    })

    const formatPercent = (val) => (val * 100).toFixed(1) + '%'

    return (
        <div className="dashboard-container">
            <div style={{ marginBottom: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', color: '#3363AF', fontWeight: 700 }}>Executive Dashboard</h2>
                <p style={{ color: '#3363AF' }}>
                    High-level overview of the pricing transition impact.
                </p>
            </div>

            {/* KPI Cards */}
            <div className="stats-grid" style={{ marginBottom: '2rem' }}>
                <div className="stat-card">
                    <h3>Current Revenue</h3>
                    <div className="metric-value">{formatCurrency(totalCurrentRevenue)}</div>
                    <small style={{ color: '#3363AF' }}>Based on Annual Spend</small>
                </div>
                <div className="stat-card projected">
                    <h3>Projected Revenue</h3>
                    <div className="metric-value">{formatCurrency(totalProjectedRevenue)}</div>
                    <small style={{ color: '#3363AF' }}>Post-Transition</small>
                </div>
                <div className={`stat-card ${totalDelta >= 0 ? 'projected' : ''}`} style={{ borderColor: totalDelta < 0 ? '#fca5a5' : undefined, backgroundColor: totalDelta < 0 ? '#fef2f2' : undefined }}>
                    <h3>Net Impact</h3>
                    <div className="metric-value" style={{ color: totalDelta >= 0 ? '#16a34a' : '#dc2626' }}>
                        {totalDelta >= 0 ? '+' : ''}{formatCurrency(totalDelta)}
                    </div>
                    <small style={{ color: '#3363AF' }}>Total Delta</small>
                </div>
            </div>

            {/* Territory Analytics */}
            <div className="pricing-table-container" style={{ marginBottom: '2rem' }}>
                <h4>Territory Performance</h4>
                <table className="pricing-table">
                    <thead>
                        <tr>
                            <th>Territory</th>
                            <th style={{ textAlign: 'center' }}>Customers</th>
                            <th style={{ width: '20%' }}>% of List</th>
                            <th style={{ textAlign: 'right' }}>Total Sales</th>
                            <th style={{ width: '20%' }}>% of Revenue</th>
                        </tr>
                    </thead>
                    <tbody>
                        {territoryStats.map(stat => (
                            <tr key={stat.name}>
                                <td style={{ fontWeight: 600 }}>{stat.name}</td>
                                <td style={{ textAlign: 'center' }}>{stat.count}</td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ flex: 1, backgroundColor: 'var(--border-color)', borderRadius: '4px', height: '8px' }}>
                                            <div style={{ width: formatPercent(stat.countPct), backgroundColor: 'var(--primary-color)', height: '100%', borderRadius: '4px' }}></div>
                                        </div>
                                        <span style={{ fontSize: '0.85rem', minWidth: '45px' }}>{formatPercent(stat.countPct)}</span>
                                    </div>
                                </td>
                                <td style={{ textAlign: 'right' }}>{formatCurrency(stat.sales)}</td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ flex: 1, backgroundColor: 'var(--border-color)', borderRadius: '4px', height: '8px' }}>
                                            <div style={{ width: formatPercent(stat.salesPct), backgroundColor: 'var(--primary-color)', height: '100%', borderRadius: '4px' }}></div>
                                        </div>
                                        <span style={{ fontSize: '0.85rem', minWidth: '45px' }}>{formatPercent(stat.salesPct)}</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Top 5 Product Lines */}
            <div className="pricing-table-container">
                <h4>Top 5 Product Lines (Revenue)</h4>
                <table className="pricing-table">
                    <thead>
                        <tr>
                            <th>Product Line</th>
                            <th style={{ textAlign: 'right' }}>Revenue</th>
                            <th style={{ width: '25%' }}>% of Total Sales</th>
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
                                    {top5.map(cat => {
                                        const rev = parseFloat(cat.revenue) || 0
                                        const share = totalRev > 0 ? rev / totalRev : 0

                                        return (
                                            <tr key={cat.id}>
                                                <td style={{ fontWeight: 600 }}>{cat.name}</td>
                                                <td style={{ textAlign: 'right' }}>{formatCurrency(rev)}</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <div style={{ flex: 1, backgroundColor: 'var(--border-color)', borderRadius: '4px', height: '8px' }}>
                                                            <div style={{ width: formatPercent(share), backgroundColor: 'var(--primary-color)', height: '100%', borderRadius: '4px' }}></div>
                                                        </div>
                                                        <span style={{ fontSize: '0.85rem', minWidth: '45px' }}>{formatPercent(share)}</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {categories.length === 0 && (
                                        <tr><td colSpan="3" style={{ textAlign: 'center', color: '#3363AF', padding: '2rem' }}>No categories defined</td></tr>
                                    )}
                                    {categories.length > 0 && (
                                        <tr style={{ backgroundColor: '#f0f4fa', borderTop: '2px solid var(--primary-color)' }}>
                                            <td style={{ fontWeight: 'bold', color: '#3363AF' }}>Top 5 Combined</td>
                                            <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#3363AF' }}>{formatCurrency(top5Total)}</td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ flex: 1, backgroundColor: 'var(--border-color)', borderRadius: '4px', height: '8px' }}>
                                                        <div style={{ width: formatPercent(top5Share), backgroundColor: 'var(--dark-blue)', height: '100%', borderRadius: '4px' }}></div>
                                                    </div>
                                                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: '#3363AF', minWidth: '45px' }}>{formatPercent(top5Share)}</span>
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
    )
}

export default Dashboard

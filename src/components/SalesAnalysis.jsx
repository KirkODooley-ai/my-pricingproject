import React, { useMemo, useState } from 'react'
import { formatCurrency, formatPercent } from '../utils/pricingEngine'

const SalesAnalysis = ({ customers, salesTransactions = [], customerAliases = {}, onUpdateAlias }) => {
    const [filter, setFilter] = useState('all') // all, mismatch, missing_erp, missing_sales
    const [linkTarget, setLinkTarget] = useState(null) // { variantName }

    // --- Defensive Coding: Safety First ---
    // Ensure all inputs are the correct type to prevent crashes
    const safeCustomers = Array.isArray(customers) ? customers : []
    const safeSales = Array.isArray(salesTransactions) ? salesTransactions : []
    const safeAliases = customerAliases || {}

    // --- Core Logic: Generate Report ---
    const report = useMemo(() => {
        // 0. Resolve Aliases in Sales Data
        // We do this dynamically here so we don't mutate the raw transactions
        const resolvedSales = safeSales
            .filter(t => t && typeof t === 'object' && t.customerName) // Filter bad data
            .map(t => {
                const alias = safeAliases[t.customerName]
                return {
                    ...t,
                    effectiveName: alias || t.customerName
                }
            })

        // 1. Get Union of All Names (Canonical + Effective Sales Names)
        const customerNames = new Set(safeCustomers.filter(c => c && c.name).map(c => c.name))
        const effectiveSalesNames = new Set(resolvedSales.map(t => t.effectiveName))
        const allNames = new Set([...customerNames, ...effectiveSalesNames])

        const rows = []

        allNames.forEach(name => {
            // ERP Data
            const cust = safeCustomers.find(c => c.name === name)
            const erpRevenue = cust ? (cust.annualSpend || 0) : 0

            // Sales Data (Sum by effectiveName)
            const sales = resolvedSales.filter(t => t.effectiveName === name)
            const salesRevenue = sales.reduce((sum, t) => sum + t.amount, 0)

            const variance = erpRevenue - salesRevenue
            const match = Math.abs(variance) < 0.01

            let status = 'match'
            if (!match) status = 'mismatch'
            if (!cust && salesRevenue > 0) status = 'missing_erp' // Has sales, no customer record
            if (cust && salesRevenue === 0 && erpRevenue > 0) status = 'missing_sales' // Has customer record, no sales data

            rows.push({
                name,
                erpRevenue,
                salesRevenue,
                variance,
                status,
                id: cust?.id || name,
                isAliasTarget: effectiveSalesNames.has(name) // Can see details of who mapped here? (Future)
            })
        })

        return rows.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)) // Sort by biggest problem first
    }, [safeCustomers, safeSales, safeAliases])

    // --- Filtering ---
    const filteredRows = useMemo(() => {
        if (filter === 'all') return report
        if (filter === 'mismatch') return report.filter(r => r.status === 'mismatch')
        if (filter === 'missing_erp') return report.filter(r => r.status === 'missing_erp')
        if (filter === 'missing_sales') return report.filter(r => r.status === 'missing_sales')
        return report
    }, [report, filter])

    // --- Actions ---
    const handleExport = () => {
        const headers = ['Customer Name', 'ERP Revenue (Goal)', 'Sales Transactions (Actual)', 'Variance', 'Status']
        const csvContent = [
            headers.join(','),
            ...filteredRows.map(row => [
                `"${row.name}"`,
                row.erpRevenue,
                row.salesRevenue,
                row.variance,
                row.status
            ].join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `variance_report_${new Date().toISOString().split('T')[0]}.csv`) // variance_report_2023-12-17.csv
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const handleLink = (variantName) => {
        setLinkTarget({ variantName })
    }

    const confirmLink = (canonicalName) => {
        if (onUpdateAlias && linkTarget) {
            onUpdateAlias(linkTarget.variantName, canonicalName)
            setLinkTarget(null)
        }
    }

    return (
        <div className="pricing-table-container">
            {/* LINK MODAL */}
            {linkTarget && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100
                }}>
                    <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', width: '400px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ marginTop: 0 }}>Link "{linkTarget.variantName}"</h3>
                        <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1rem' }}>
                            Select the correct customer from your list. Future imports will map this name automatically.
                        </p>

                        <select
                            className="input-field"
                            style={{ marginBottom: '1.5rem' }}
                            onChange={(e) => {
                                if (e.target.value) confirmLink(e.target.value)
                            }}
                            defaultValue=""
                        >
                            <option value="" disabled>-- Select Real Customer --</option>
                            {safeCustomers.sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                        </select>

                        <button
                            onClick={() => setLinkTarget(null)}
                            style={{ width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', backgroundColor: 'white', borderRadius: '4px', cursor: 'pointer' }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', padding: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Sales Variance Report</h2>
                    <span style={{ fontSize: '0.85rem', color: '#6b7280', backgroundColor: '#f3f4f6', padding: '2px 8px', borderRadius: '12px' }}>
                        Check & Balance
                    </span>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '2px', marginRight: '1rem' }}>
                        <button onClick={() => setFilter('all')} style={btnStyle(filter === 'all')}>All</button>
                        <button onClick={() => setFilter('mismatch')} style={btnStyle(filter === 'mismatch')}>Mismatches ⚠️</button>
                        <button onClick={() => setFilter('missing_erp')} style={btnStyle(filter === 'missing_erp')}>Unmatched Sales ❓</button>
                    </div>
                    <button
                        onClick={handleExport}
                        style={{
                            padding: '0.4rem 1rem',
                            backgroundColor: '#2563eb',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}
                    >
                        ⬇ Export CSV
                    </button>
                </div>
            </div>

            <div style={{ padding: '1.5rem' }}>
                {/* Stats Summary */}
                <div className="stat-card" style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                            <div style={{ fontSize: '0.85rem', color: '#166534' }}>Total ERP Revenue (Customer List)</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#14532d' }}>
                                {formatCurrency(safeCustomers.reduce((sum, c) => sum + (c.annualSpend || 0), 0))}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.85rem', color: '#166534' }}>Total Sales Data (Transactions)</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#14532d' }}>
                                {formatCurrency(safeSales.reduce((sum, t) => sum + t.amount, 0))}
                            </div>
                        </div>
                        <div style={{ textAlign: 'right', borderLeft: '1px solid #bbf7d0', paddingLeft: '2rem' }}>
                            <div style={{ fontSize: '0.85rem', color: '#166534' }}>Net Variance</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#14532d' }}>
                                {formatCurrency(safeCustomers.reduce((sum, c) => sum + (c.annualSpend || 0), 0) - safeSales.reduce((sum, t) => sum + t.amount, 0))}
                            </div>
                        </div>
                    </div>
                </div>

                <table className="pricing-table">
                    <thead>
                        <tr>
                            <th>Customer Name</th>
                            <th style={{ textAlign: 'right' }}>ERP Revenue (Goal)</th>
                            <th style={{ textAlign: 'right' }}>Sales Transactions (Actual)</th>
                            <th style={{ textAlign: 'right' }}>Variance</th>
                            <th style={{ textAlign: 'center' }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredRows.map(row => (
                            <tr key={row.id}>
                                <td style={{ fontWeight: 500 }}>{row.name}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(row.erpRevenue)}</td>
                                <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(row.salesRevenue)}</td>
                                <td style={{
                                    textAlign: 'right',
                                    fontFamily: 'monospace',
                                    fontWeight: 700,
                                    color: row.status === 'match' ? '#10b981' : '#ef4444'
                                }}>
                                    {row.variance > 0 ? '+' : ''}{formatCurrency(row.variance)}
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    {row.status === 'match' && <span style={{ color: '#10b981', fontWeight: 600 }}>✅ Match</span>}
                                    {row.status === 'mismatch' && <span style={{ color: '#ef4444', fontWeight: 600 }}>⚠️ Variance</span>}
                                    {row.status === 'missing_erp' && (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                            <span style={{ color: '#f59e0b', fontWeight: 600 }}>❓ Unmatched Sales</span>
                                            <button
                                                onClick={() => handleLink(row.name)}
                                                style={{ border: '1px solid #d1d5db', background: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', padding: '2px 6px' }}
                                                title="Link to existing customer"
                                            >
                                                🔗 Link
                                            </button>
                                        </div>
                                    )}
                                    {row.status === 'missing_sales' && <span style={{ color: '#9ca3af', fontWeight: 600 }}>∅ No Sales Data</span>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

const btnStyle = (active) => ({
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    border: active ? '1px solid #2563eb' : '1px solid #d1d5db',
    backgroundColor: active ? '#eff6ff' : 'white',
    color: active ? '#2563eb' : '#374151',
    cursor: 'pointer',
    fontWeight: 500
})

export default SalesAnalysis

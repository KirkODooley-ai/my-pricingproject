import React, { useMemo, useState } from 'react';
import { formatCurrency } from '../utils/pricingEngine';

const SalesAnalysis = ({ customers, salesTransactions = [], customerAliases = {}, onUpdateAlias }) => {
    const [filter, setFilter] = useState('all'); // all, mismatch, missing_erp, missing_sales
    const [linkTarget, setLinkTarget] = useState(null); // { variantName }

    // --- Defensive Coding: Safety First ---
    const safeCustomers = Array.isArray(customers) ? customers : [];
    const safeSales = Array.isArray(salesTransactions) ? salesTransactions : [];
    const safeAliases = customerAliases || {};

    // --- Core Logic: Generate Report ---
    const report = useMemo(() => {
        const resolvedSales = safeSales
            .filter(t => t && typeof t === 'object' && t.customerName)
            .map(t => {
                const alias = safeAliases[t.customerName];
                return {
                    ...t,
                    effectiveName: alias || t.customerName
                };
            });

        const customerNames = new Set(safeCustomers.filter(c => c && c.name).map(c => c.name));
        const effectiveSalesNames = new Set(resolvedSales.map(t => t.effectiveName));
        const allNames = new Set([...customerNames, ...effectiveSalesNames]);

        const rows = [];

        allNames.forEach(name => {
            const cust = safeCustomers.find(c => c.name === name);
            const erpRevenue = cust ? (cust.annualSpend || 0) : 0;

            const sales = resolvedSales.filter(t => t.effectiveName === name);
            const salesRevenue = sales.reduce((sum, t) => sum + t.amount, 0);

            const variance = erpRevenue - salesRevenue;
            const match = Math.abs(variance) < 0.01;

            let status = 'match';
            if (!match) status = 'mismatch';
            if (!cust && salesRevenue > 0) status = 'missing_erp'; 
            if (cust && salesRevenue === 0 && erpRevenue > 0) status = 'missing_sales';

            rows.push({
                name,
                erpRevenue,
                salesRevenue,
                variance,
                status,
                id: cust?.id || name,
                isAliasTarget: effectiveSalesNames.has(name) 
            });
        });

        return rows.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)); 
    }, [safeCustomers, safeSales, safeAliases]);

    // --- Filtering ---
    const filteredRows = useMemo(() => {
        if (filter === 'all') return report;
        if (filter === 'mismatch') return report.filter(r => r.status === 'mismatch');
        if (filter === 'missing_erp') return report.filter(r => r.status === 'missing_erp');
        if (filter === 'missing_sales') return report.filter(r => r.status === 'missing_sales');
        return report;
    }, [report, filter]);

    // --- Actions ---
    const handleExport = () => {
        const headers = ['Customer Name', 'ERP Revenue (Goal)', 'Sales Transactions (Actual)', 'Variance', 'Status'];
        const csvContent = [
            headers.join(','),
            ...filteredRows.map(row => [
                `"${row.name}"`,
                row.erpRevenue,
                row.salesRevenue,
                row.variance,
                row.status
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `variance_report_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleLink = (variantName) => {
        setLinkTarget({ variantName });
    };

    const confirmLink = (canonicalName) => {
        if (onUpdateAlias && linkTarget) {
            onUpdateAlias(linkTarget.variantName, canonicalName);
            setLinkTarget(null);
        }
    };

    // Premium SaaS UI Variables
    const styles = {
        pageWrapper: { width: '100%', minHeight: '100%' },
        container: { maxWidth: '1400px', margin: '0 auto', padding: '2.5rem', width: '100%', fontFamily: 'var(--font-base)' },
        headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' },
        headerText: { fontSize: '1.85rem', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.02em', margin: '0 0 0.5rem 0' },
        subText: { color: '#64748b', fontSize: '1.05rem', margin: 0 },
        
        card: { backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.03)', border: '1px solid rgba(15, 23, 42, 0.08)', overflow: 'hidden', padding: '2rem' },
        tableContainer: { backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.03)', border: '1px solid rgba(15, 23, 42, 0.08)', overflow: 'hidden' },
        
        table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
        th: { padding: '1rem 1.5rem', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#475569', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' },
        td: { padding: '1.25rem 1.5rem', fontSize: '0.95rem', color: '#0f172a', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle' },
        
        primaryBtn: { backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', padding: '0.6rem 1.25rem', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', boxShadow: '0 1px 3px rgba(37,99,235,0.2)', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' },
        outlineBtn: (isActive) => ({ padding: '0.5rem 1rem', border: isActive ? '1px solid #bfdbfe' : '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: isActive ? '#eff6ff' : 'white', cursor: 'pointer', fontWeight: isActive ? '600' : '500', color: isActive ? '#1d4ed8' : '#475569', transition: 'all 0.2s' }),
        
        statBoxContainer: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' },
        statBox: { backgroundColor: '#ffffff', borderRadius: '10px', padding: '1.5rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' },
        statBoxLabel: { fontSize: '0.85rem', fontWeight: '600', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' },
        statBoxValue: { fontSize: '1.85rem', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.02em' },
        
        statusBadge: (type) => {
            const types = {
                match: { bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' },
                mismatch: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
                missing_erp: { bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
                missing_sales: { bg: '#f1f5f9', color: '#64748b', border: '#e2e8f0' }
            };
            const config = types[type] || types.match;
            return { backgroundColor: config.bg, color: config.color, border: `1px solid ${config.border}`, padding: '0.35rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' };
        }
    };

    const totalERP = safeCustomers.reduce((sum, c) => sum + (c.annualSpend || 0), 0);
    const totalSales = safeSales.reduce((sum, t) => sum + t.amount, 0);
    const netVariance = totalERP - totalSales;

    return (
        <div style={styles.pageWrapper}>
            {/* LINK MODAL */}
            {linkTarget && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
                    <div style={{ backgroundColor: 'white', padding: '2.5rem', borderRadius: '12px', width: '450px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                        <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem', color: '#0f172a' }}>Link "{linkTarget.variantName}"</h3>
                        <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                            Select the correct customer from your registry. Future imports will map this name automatically.
                        </p>

                        <select
                            style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '1rem', color: '#0f172a', marginBottom: '2rem', outline: 'none' }}
                            onChange={(e) => { if (e.target.value) confirmLink(e.target.value); }}
                            defaultValue=""
                        >
                            <option value="" disabled>-- Select Canonical Customer --</option>
                            {safeCustomers.sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                                <option key={c.id} value={c.name}>{c.name}</option>
                            ))}
                        </select>

                        <button
                            onClick={() => setLinkTarget(null)}
                            style={{ width: '100%', padding: '0.75rem', border: '1px solid #cbd5e1', backgroundColor: 'white', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', color: '#475569', transition: 'all 0.2s' }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            <div style={styles.container}>
                {/* Header & Controls */}
                <div style={styles.headerRow}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                            <h2 style={{...styles.headerText, margin: 0}}>Variance Report</h2>
                            <span style={{ fontSize: '0.75rem', backgroundColor: '#e2e8f0', color: '#475569', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Check & Balance</span>
                        </div>
                        <p style={styles.subText}>Identify discrepancies between expected ERP revenue and actual sales data.</p>
                    </div>

                    <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#f8fafc', padding: '0.35rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <button onClick={() => setFilter('all')} style={styles.outlineBtn(filter === 'all')}>All</button>
                            <button onClick={() => setFilter('mismatch')} style={styles.outlineBtn(filter === 'mismatch')}>Mismatches</button>
                            <button onClick={() => setFilter('missing_erp')} style={styles.outlineBtn(filter === 'missing_erp')}>Unmatched</button>
                        </div>
                        <button onClick={handleExport} style={styles.primaryBtn}>
                            <span style={{fontSize: '1.1rem'}}>⬇</span> Export CSV
                        </button>
                    </div>
                </div>

                {/* Stats Summary */}
                <div style={styles.statBoxContainer}>
                    <div style={{...styles.statBox, backgroundColor: '#f8fafc', borderColor: '#e2e8f0'}}>
                        <span style={styles.statBoxLabel}>Total ERP Revenue (Target)</span>
                        <span style={styles.statBoxValue}>{formatCurrency(totalERP)}</span>
                    </div>
                    <div style={{...styles.statBox, backgroundColor: '#f8fafc', borderColor: '#e2e8f0'}}>
                        <span style={styles.statBoxLabel}>Total Sales Data (Actual)</span>
                        <span style={styles.statBoxValue}>{formatCurrency(totalSales)}</span>
                    </div>
                    <div style={{...styles.statBox, backgroundColor: Math.abs(netVariance) < 1000 ? '#ecfdf5' : '#fef2f2', borderColor: Math.abs(netVariance) < 1000 ? '#a7f3d0' : '#fecaca'}}>
                        <span style={{...styles.statBoxLabel, color: Math.abs(netVariance) < 1000 ? '#059669' : '#dc2626'}}>Net System Variance</span>
                        <span style={{...styles.statBoxValue, color: Math.abs(netVariance) < 1000 ? '#059669' : '#dc2626'}}>{formatCurrency(netVariance)}</span>
                    </div>
                </div>

                {/* Table */}
                <div style={styles.tableContainer}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={styles.table}>
                            <thead>
                                <tr>
                                    <th style={styles.th}>Customer Name</th>
                                    <th style={{...styles.th, textAlign: 'right'}}>ERP Revenue (Target)</th>
                                    <th style={{...styles.th, textAlign: 'right'}}>Sales Transactions (Actual)</th>
                                    <th style={{...styles.th, textAlign: 'right'}}>Variance</th>
                                    <th style={{...styles.th, textAlign: 'center'}}>Reconciliation Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.map(row => (
                                    <tr key={row.id} style={{ transition: 'background-color 0.2s' }}>
                                        <td style={{...styles.td, fontWeight: '600'}}>{row.name}</td>
                                        <td style={{...styles.td, textAlign: 'right', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', color: '#475569'}}>{formatCurrency(row.erpRevenue)}</td>
                                        <td style={{...styles.td, textAlign: 'right', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', color: '#475569'}}>{formatCurrency(row.salesRevenue)}</td>
                                        <td style={{
                                            ...styles.td,
                                            textAlign: 'right',
                                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                            fontWeight: '700',
                                            color: row.status === 'match' ? '#059669' : '#dc2626'
                                        }}>
                                            {row.variance > 0 ? '+' : ''}{formatCurrency(row.variance)}
                                        </td>
                                        <td style={{...styles.td, textAlign: 'center'}}>
                                            {row.status === 'match' && <span style={styles.statusBadge('match')}><span>✓</span> Aligned</span>}
                                            {row.status === 'mismatch' && <span style={styles.statusBadge('mismatch')}><span style={{fontSize: '0.9rem'}}>⚠️</span> Variance</span>}
                                            {row.status === 'missing_sales' && <span style={styles.statusBadge('missing_sales')}>∅ No Sales</span>}
                                            {row.status === 'missing_erp' && (
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                    <span style={styles.statusBadge('missing_erp')}><span style={{fontSize: '0.8rem'}}>❓</span> Unmatched</span>
                                                    <button
                                                        onClick={() => handleLink(row.name)}
                                                        style={{ border: '1px solid #cbd5e1', background: '#ffffff', color: '#475569', borderRadius: '6px', cursor: 'pointer', fontSize: '0.75rem', padding: '0.25rem 0.5rem', fontWeight: '600', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                                                        title="Link to canonical customer"
                                                        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; e.currentTarget.style.borderColor = '#94a3b8'; }}
                                                        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                                                    >
                                                        <span>🔗</span> Link
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {filteredRows.length === 0 && (
                                    <tr>
                                        <td colSpan="5" style={{...styles.td, textAlign: 'center', padding: '4rem 2rem', color: '#64748b'}}>
                                            <div style={{ fontSize: '2.5rem', marginBottom: '1rem', opacity: 0.5 }}>🔍</div>
                                            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#0f172a', margin: '0 0 0.5rem 0' }}>No Records Found</h3>
                                            <p style={{ margin: 0 }}>There are no items matching this filter criteria.</p>
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

export default SalesAnalysis;

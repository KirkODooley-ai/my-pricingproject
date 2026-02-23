import React from 'react';
import { formatCurrency } from '../utils/pricingEngine';

const Dashboard = ({ analysis, customers = [], categories = [] }) => {
    if (!analysis) return (
        <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <h4 style={{ fontWeight: 600, fontSize: '1.25rem' }}>Loading Dashboard...</h4>
            <p>Please wait while we calculate your analytics.</p>
        </div>
    );

    const { totalCurrentRevenue, totalProjectedRevenue, totalDelta } = analysis;
    const totalCustomers = customers.length;
    const totalSales = customers.reduce((acc, c) => acc + (c.annualSpend || 0), 0);

    const normalizeTerritory = (t) => {
        if (!t) return 'Other';
        let upper = String(t).toUpperCase().trim();
        if (['SASK', 'SASKATCHEWAN'].includes(upper)) return 'SK';
        if (['ALTA', 'ALBERTA'].includes(upper)) return 'AB';
        if (['BRITISH COLUMBIA'].includes(upper)) return 'BC';
        if (['MAN', 'MANITOBA'].includes(upper)) return 'MB';
        if (['ONT', 'ONTARIO'].includes(upper)) return 'ON';
        return upper;
    };

    const uniqueTerritories = [...new Set(customers.map(c => normalizeTerritory(c.territory)))];

    const sortOrder = ['SK', 'AB', 'BC'];
    uniqueTerritories.sort((a, b) => {
        const idxA = sortOrder.indexOf(a);
        const idxB = sortOrder.indexOf(b);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        if (a === 'Other') return 1;
        if (b === 'Other') return -1;
        return a.localeCompare(b);
    });

    const displayTerritories = uniqueTerritories.length > 0 ? uniqueTerritories : ['SK', 'AB', 'BC', 'Other'];

    const territoryStats = displayTerritories.map(terr => {
        const terrCustomers = customers.filter(c => normalizeTerritory(c.territory) === terr);
        const count = terrCustomers.length;
        const sales = terrCustomers.reduce((acc, c) => acc + (c.annualSpend || 0), 0);
        const countPct = totalCustomers > 0 ? (count / totalCustomers) : 0;
        const salesPct = totalSales > 0 ? (sales / totalSales) : 0;
        return { name: terr, count, countPct, sales, salesPct };
    });

    const formatPercent = (val) => (val * 100).toFixed(1) + '%';

    // Premium SaaS UI Variables for inline styling isolated from global CSS
    const styles = {
        pageWrapper: {
            width: '100%',
            minHeight: '100%',
            overflowX: 'hidden'
        },
        container: {
            maxWidth: '1600px',
            margin: '0 auto',
            padding: '2.5rem',
            width: '100%',
            fontFamily: 'var(--font-base)'
        },
        headerText: {
            fontSize: '1.75rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            margin: '0 0 0.5rem 0'
        },
        subText: {
            color: 'var(--text-muted)',
            fontSize: '1rem',
            margin: '0 0 2rem 0'
        },
        kpiGrid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem'
        },
        kpiCard: {
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            padding: '1.5rem',
            boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.03), 0 2px 4px -2px rgba(15, 23, 42, 0.03)',
            border: '1px solid rgba(15, 23, 42, 0.08)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
        },
        kpiLabel: {
            fontSize: '0.85rem',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
            marginBottom: '0.75rem'
        },
        kpiValue: {
            fontSize: '2.25rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em'
        },
        layoutGrid: {
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
            gap: '1.5rem'
        },
        tableCard: {
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.03), 0 2px 4px -2px rgba(15, 23, 42, 0.03)',
            border: '1px solid rgba(15, 23, 42, 0.08)',
            overflow: 'hidden'
        },
        cardHeader: {
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid rgba(15, 23, 42, 0.06)',
            backgroundColor: '#fafbfc'
        },
        cardTitle: {
            fontSize: '1.05rem',
            fontWeight: '600',
            color: 'var(--text-primary)',
            margin: 0
        },
        tableWrapper: {
            overflowX: 'auto',
            width: '100%'
        },
        saasTable: {
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left'
        },
        th: {
            padding: '1rem 1.5rem',
            fontSize: '0.75rem',
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--text-muted)',
            borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
            backgroundColor: 'transparent'
        },
        td: {
            padding: '1rem 1.5rem',
            fontSize: '0.95rem',
            color: 'var(--text-primary)',
            borderBottom: '1px solid rgba(15, 23, 42, 0.04)',
            verticalAlign: 'middle'
        },
        progressBarTrack: {
            width: '100%',
            height: '6px',
            backgroundColor: '#f1f5f9',
            borderRadius: '9999px',
            overflow: 'hidden'
        },
        metricCell: {
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
        }
    };

    return (
        <div style={styles.pageWrapper}>
            <div style={styles.container}>
                {/* Header */}
                <div>
                    <h2 style={styles.headerText}>Executive Dashboard</h2>
                    <p style={styles.subText}>High-level overview of the pricing transition impact and business performance.</p>
                </div>

                {/* KPI Cards */}
                <div style={styles.kpiGrid}>
                    <div style={styles.kpiCard}>
                        <div style={styles.kpiLabel}>Current Revenue</div>
                        <div style={styles.kpiValue}>{formatCurrency(totalCurrentRevenue)}</div>
                    </div>
                    
                    <div style={styles.kpiCard}>
                        <div style={styles.kpiLabel}>Projected Revenue</div>
                        <div style={{ ...styles.kpiValue, color: 'var(--success, #059669)' }}>{formatCurrency(totalProjectedRevenue)}</div>
                    </div>
                    
                    <div style={{ ...styles.kpiCard, borderTop: totalDelta >= 0 ? '4px solid #059669' : '4px solid #DC2626' }}>
                        <div style={styles.kpiLabel}>Net Impact</div>
                        <div style={{ ...styles.kpiValue, color: totalDelta >= 0 ? '#059669' : '#DC2626' }}>
                            {totalDelta >= 0 ? '+' : ''}{formatCurrency(totalDelta)}
                        </div>
                    </div>
                </div>

                {/* Two Column Layout on Desktop */}
                <div style={styles.layoutGrid}>
                    
                    {/* Territory Performance */}
                    <div style={styles.tableCard}>
                        <div style={styles.cardHeader}>
                            <h4 style={styles.cardTitle}>Territory Performance</h4>
                        </div>
                        <div style={styles.tableWrapper}>
                            <table style={styles.saasTable}>
                                <thead>
                                    <tr>
                                        <th style={styles.th}>Territory</th>
                                        <th style={{ ...styles.th, textAlign: 'center' }}>Accounts</th>
                                        <th style={{ ...styles.th, textAlign: 'right' }}>Total Sales</th>
                                        <th style={styles.th}>Share of Revenue</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {territoryStats.map(stat => (
                                        <tr key={stat.name}>
                                            <td style={{ ...styles.td, fontWeight: '600' }}>{stat.name}</td>
                                            <td style={{ ...styles.td, textAlign: 'center', color: 'var(--text-secondary)' }}>{stat.count}</td>
                                            <td style={{ ...styles.td, textAlign: 'right', fontWeight: '500' }}>{formatCurrency(stat.sales)}</td>
                                            <td style={styles.td}>
                                                <div style={styles.metricCell}>
                                                    <div style={{ ...styles.progressBarTrack, flex: 1, maxWidth: '140px' }}>
                                                        <div style={{ height: '100%', backgroundColor: 'var(--primary-color, #3363AF)', width: formatPercent(stat.salesPct), borderRadius: '9999px' }}></div>
                                                    </div>
                                                    <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', minWidth: '45px' }}>
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
                    <div style={styles.tableCard}>
                        <div style={styles.cardHeader}>
                            <h4 style={styles.cardTitle}>Top Product Lines (Revenue)</h4>
                        </div>
                        <div style={styles.tableWrapper}>
                            <table style={styles.saasTable}>
                                <thead>
                                    <tr>
                                        <th style={styles.th}>Product Line</th>
                                        <th style={{ ...styles.th, textAlign: 'right' }}>Revenue</th>
                                        <th style={styles.th}>Share</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        const sortedCategories = [...categories].sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
                                        const top5 = sortedCategories.slice(0, 5);
                                        const totalRev = categories.reduce((sum, c) => sum + (parseFloat(c.revenue) || 0), 0);
                                        
                                        return top5.map((cat, index) => {
                                            const rev = parseFloat(cat.revenue) || 0;
                                            const share = totalRev > 0 ? rev / totalRev : 0;
                                            return (
                                                <tr key={cat.id || index}>
                                                    <td style={{ ...styles.td, fontWeight: '500' }}>
                                                        <span style={{ 
                                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                                            width: '24px', height: '24px', borderRadius: '50%', 
                                                            backgroundColor: index === 0 ? 'rgba(245, 158, 11, 0.15)' : '#f1f5f9',
                                                            color: index === 0 ? '#b45309' : 'var(--text-muted)',
                                                            fontSize: '0.75rem', fontWeight: 'bold', marginRight: '12px'
                                                        }}>
                                                            {index + 1}
                                                        </span>
                                                        {cat.name}
                                                    </td>
                                                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: '500' }}>{formatCurrency(rev)}</td>
                                                    <td style={styles.td}>
                                                        <div style={styles.metricCell}>
                                                            <div style={{ ...styles.progressBarTrack, flex: 1, maxWidth: '140px' }}>
                                                                <div style={{ height: '100%', backgroundColor: '#059669', width: formatPercent(share), borderRadius: '9999px' }}></div>
                                                            </div>
                                                            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)', minWidth: '45px' }}>
                                                                {formatPercent(share)}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        });
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default Dashboard;

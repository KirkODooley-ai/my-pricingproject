import React, { useState, useMemo } from 'react'
import { formatCurrency, formatPercent } from '../utils/pricingEngine'
import './PricingTable.css'

const SalesDataManager = ({ customers, salesTransactions = [], categories, onDeleteCustomer, onDeleteCategory, onBatchDeleteSales, onUpdateSale, onAddSale, onDeleteSale }) => {
    const [deleteId, setDeleteId] = useState(null)
    const [deleteCategory, setDeleteCategory] = useState(null)
    const [viewMode, setViewMode] = useState('category') // 'category' | 'customer'
    const [selectedId, setSelectedId] = useState('')

    // [NEW] Editor State
    const [editTx, setEditTx] = useState(null)
    const [isAdding, setIsAdding] = useState(false)
    const [newSale, setNewSale] = useState({ customerName: '', category: '', amount: 0, cogs: 0 })
    const [expandedGroup, setExpandedGroup] = useState(null)

    // Derived Lists from SALES DATA (Decoupled from Customer Registry)
    const validSales = useMemo(() => Array.isArray(salesTransactions) ? salesTransactions : [], [salesTransactions])

    const categoryNames = useMemo(() => categories.map(c => c.name), [categories])

    // Get unique customers present in Sales Data
    const salesCustomers = useMemo(() => {
        const names = new Set(validSales.map(tx => tx.customerName))
        return Array.from(names).sort()
    }, [validSales])

    // Default selection logic
    React.useEffect(() => {
        if (!selectedId) {
            if (viewMode === 'category' && categoryNames.length > 0) setSelectedId(categoryNames[0])
            if (viewMode === 'customer' && salesCustomers.length > 0) setSelectedId(salesCustomers[0])
        }
    }, [viewMode, categoryNames, salesCustomers, selectedId])

    // Aggregation Logic
    const stats = useMemo(() => {
        if (viewMode === 'category') {
            // Show all customers who bought this category
            const catName = selectedId

            // 1. Filter Transactions
            const relevantTx = validSales.filter(tx => tx.category === catName)

            // 2. Aggregate by Customer
            const aggMap = {}
            let total = 0
            let totalCogs = 0 // [NEW] Track Total COGS

            relevantTx.forEach(tx => {
                const currentFn = aggMap[tx.customerName] || { amount: 0, cogs: 0 }
                aggMap[tx.customerName] = {
                    amount: currentFn.amount + tx.amount,
                    cogs: currentFn.cogs + (tx.cogs || 0)
                }
                total += tx.amount
                totalCogs += (tx.cogs || 0)
            })

            const buyers = Object.entries(aggMap).map(([name, data]) => ({
                id: name, // Use name as ID for sales view
                name,
                amount: data.amount,
                cogs: data.cogs
            })).sort((a, b) => b.amount - a.amount)

            return { items: buyers, total, totalCogs }
        } else {
            // Show all categories bought by this customer
            const customerName = selectedId

            // 1. Filter Transactions
            const relevantTx = validSales.filter(tx => tx.customerName === customerName)

            // 2. Aggregate by Category
            const aggMap = {}
            let total = 0
            let totalCogs = 0

            relevantTx.forEach(tx => {
                const currentFn = aggMap[tx.category] || { amount: 0, cogs: 0 }
                aggMap[tx.category] = {
                    amount: currentFn.amount + tx.amount,
                    cogs: currentFn.cogs + (tx.cogs || 0)
                }
                total += tx.amount
                totalCogs += (tx.cogs || 0)
            })

            const items = Object.entries(aggMap).map(([cat, data]) => ({
                id: cat,
                name: cat,
                amount: data.amount,
                cogs: data.cogs
            })).sort((a, b) => b.amount - a.amount)

            return { items, total, totalCogs }
        }
    }, [viewMode, selectedId, validSales])

    return (
        <div className="pricing-table-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', padding: '1rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Sales Data Explorer</h2>

                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    {viewMode === 'customer' && selectedId && (
                        <button
                            onClick={() => setDeleteId(selectedId)}
                            style={{
                                padding: '0.4rem 0.8rem',
                                backgroundColor: '#fee2e2',
                                color: '#b91c1c',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: 600
                            }}
                        >
                            Clear Customer Sales
                        </button>
                    )}

                    {viewMode === 'category' && selectedId && onDeleteCategory && (
                        <button
                            onClick={() => setDeleteCategory(selectedId)}
                            style={{
                                padding: '0.4rem 0.8rem',
                                backgroundColor: '#fee2e2',
                                color: '#b91c1c',
                                border: '1px solid #fecaca',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: 600
                            }}
                        >
                            Clear Category Sales
                        </button>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', backgroundColor: '#f3f4f6', padding: '4px', borderRadius: '8px' }}>
                        <button
                            onClick={() => { setViewMode('category'); setSelectedId(''); }}
                            style={{
                                padding: '0.4rem 1rem',
                                borderRadius: '6px',
                                border: 'none',
                                background: viewMode === 'category' ? 'white' : 'transparent',
                                color: viewMode === 'category' ? '#2563eb' : '#6b7280',
                                fontWeight: 600,
                                boxShadow: viewMode === 'category' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                cursor: 'pointer'
                            }}
                        >
                            By Category
                        </button>
                        <button
                            onClick={() => { setViewMode('customer'); setSelectedId(''); }}
                            style={{
                                padding: '0.4rem 1rem',
                                borderRadius: '6px',
                                border: 'none',
                                background: viewMode === 'customer' ? 'white' : 'transparent',
                                color: viewMode === 'customer' ? '#2563eb' : '#6b7280',
                                fontWeight: 600,
                                boxShadow: viewMode === 'customer' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                                cursor: 'pointer'
                            }}
                        >
                            By Customer
                        </button>
                    </div>
                </div>
            </div>

            <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '250px 1fr', gap: '2rem' }}>

                {/* Selector Column */}
                <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#6b7280', marginBottom: '0.5rem' }}>
                        Select {viewMode === 'category' ? 'Category' : 'Customer'}
                    </label>
                    <div style={{ maxHeight: '600px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px' }}>
                        {viewMode === 'category' ? (
                            categoryNames.map(cat => (
                                <div
                                    key={cat}
                                    onClick={() => setSelectedId(cat)}
                                    style={{
                                        padding: '0.75rem',
                                        cursor: 'pointer',
                                        backgroundColor: selectedId === cat ? '#eff6ff' : 'white',
                                        borderLeft: selectedId === cat ? '4px solid #2563eb' : '4px solid transparent',
                                        fontSize: '0.9rem',
                                        borderBottom: '1px solid #f9fafb'
                                    }}
                                >
                                    {cat}
                                </div>
                            ))
                        ) : (
                            salesCustomers.map(name => (
                                <div
                                    key={name}
                                    onClick={() => setSelectedId(name)}
                                    style={{
                                        padding: '0.75rem',
                                        cursor: 'pointer',
                                        backgroundColor: selectedId === name ? '#eff6ff' : 'white',
                                        borderLeft: selectedId === name ? '4px solid #2563eb' : '4px solid transparent',
                                        fontSize: '0.9rem',
                                        borderBottom: '1px solid #f9fafb'
                                    }}
                                >
                                    <div style={{ fontWeight: 500 }}>{name}</div>
                                </div>
                            ))
                        )}
                        {viewMode === 'customer' && salesCustomers.length === 0 && (
                            <div style={{ padding: '1rem', color: '#9ca3af', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                No sales data recorded yet.
                            </div>
                        )}
                    </div>
                </div>

                {/* Data Table Column */}
                <div>
                    <div className="stat-card" style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <div style={{ fontSize: '0.9rem', color: '#6b7280' }}>Total spend for <span style={{ fontWeight: 700, color: '#111827' }}>{selectedId}</span></div>
                                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#111827', marginTop: '0.25rem' }}>
                                    {formatCurrency(stats.total)}
                                </div>
                            </div>
                            {/* ADD SALE BUTTON */}
                            {onAddSale && (
                                <button
                                    onClick={() => {
                                        setNewSale({
                                            customerName: viewMode === 'customer' ? selectedId : '',
                                            category: viewMode === 'category' ? selectedId : '',
                                            amount: 0,
                                            cogs: 0
                                        })
                                        setIsAdding(true)
                                    }}
                                    style={{
                                        padding: '0.5rem 1rem',
                                        backgroundColor: '#16a34a',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    + Add Manual Sale
                                </button>
                            )}
                        </div>
                    </div>

                    <table className="pricing-table">
                        <thead>
                            <tr>
                                <th>{viewMode === 'category' ? 'Customer' : 'Category'}</th>
                                <th style={{ textAlign: 'right' }}>Amount</th>
                                <th style={{ textAlign: 'right' }}>COGS</th>
                                <th style={{ textAlign: 'right' }}>% Share</th>
                                <th style={{ textAlign: 'center', width: '80px' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.items.length > 0 ? (
                                stats.items.map(item => (
                                    <React.Fragment key={item.id || item.name}>
                                        <tr>
                                            <td style={{ fontWeight: 500 }}>{item.name}</td>
                                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '1rem' }}>
                                                {formatCurrency(item.amount)}
                                            </td>
                                            <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: '1rem', color: '#6b7280' }}>
                                                {formatCurrency(item.cogs || 0)}
                                            </td>
                                            <td style={{ textAlign: 'right', color: '#6b7280' }}>
                                                {formatPercent((item.amount / stats.total) || 0)}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <button
                                                    onClick={() => setExpandedGroup(expandedGroup === item.id ? null : item.id)}
                                                    style={{ border: '1px solid #d1d5db', borderRadius: '4px', background: 'white', cursor: 'pointer', fontSize: '0.8rem', padding: '2px 8px' }}
                                                >
                                                    {expandedGroup === item.id ? 'Hide' : 'View'}
                                                </button>
                                            </td>
                                        </tr>
                                        {/* EXPANDED ROWS */}
                                        {expandedGroup === item.id && (
                                            <tr style={{ backgroundColor: '#f9fafb' }}>
                                                <td colSpan="5" style={{ padding: '0 1rem 1rem 1rem' }}>
                                                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '4px', background: 'white', padding: '0.5rem' }}>
                                                        <table style={{ width: '100%', fontSize: '0.85rem' }}>
                                                            <thead>
                                                                <tr style={{ color: '#6b7280', textAlign: 'left' }}>
                                                                    <th style={{ padding: '4px' }}>Date/ID</th>
                                                                    {viewMode === 'customer' && <th style={{ padding: '4px' }}>Category</th>}
                                                                    {viewMode === 'category' && <th style={{ padding: '4px' }}>Customer</th>}
                                                                    <th style={{ padding: '4px', textAlign: 'right' }}>Amount</th>
                                                                    <th style={{ padding: '4px', textAlign: 'right' }}>COGS</th>
                                                                    <th style={{ padding: '4px', textAlign: 'right' }}>Edit</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {validSales
                                                                    .filter(tx =>
                                                                        (viewMode === 'category' && tx.category === selectedId && tx.customerName === item.name) ||
                                                                        (viewMode === 'customer' && tx.customerName === selectedId && tx.category === item.name)
                                                                    )
                                                                    .map(tx => (
                                                                        <tr key={tx.id || Math.random()}>
                                                                            <td style={{ padding: '4px', color: '#9ca3af' }}>{tx.id ? tx.id.substring(tx.id.length - 6) : 'N/A'}</td>
                                                                            {viewMode === 'customer' && <td style={{ padding: '4px' }}>{tx.category}</td>}
                                                                            {viewMode === 'category' && <td style={{ padding: '4px' }}>{tx.customerName}</td>}
                                                                            <td style={{ padding: '4px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(tx.amount)}</td>
                                                                            <td style={{ padding: '4px', textAlign: 'right', fontFamily: 'monospace', color: '#6b7280' }}>
                                                                                {formatCurrency(tx.cogs || 0)}
                                                                            </td>
                                                                            <td style={{ padding: '4px', textAlign: 'right' }}>
                                                                                <button
                                                                                    onClick={() => setEditTx(tx)}
                                                                                    style={{ color: '#2563eb', border: 'none', background: 'transparent', cursor: 'pointer', textDecoration: 'underline' }}
                                                                                >
                                                                                    Edit
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    ))
                                                                }
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                                        No sales data found for this selection.
                                        <br />
                                        <small>Import data via "Sales Data" mode in Import Tab.</small>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODALS SECTION */}

            {/* DELETE CUSTOMER CONFIRMATION */}
            {deleteId && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100
                }}>
                    <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '400px', width: '90%', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ marginTop: 0, color: '#b91c1c' }}>Confirm Clear Sales</h3>
                        <p>Are you sure you want to clear all sales data for <strong>{deleteId}</strong>?</p>
                        <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                            This only removes the sales records. The Customer Identity (Group/Territory) will remain in the Customers tab.
                        </p>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                            <button
                                onClick={() => setDeleteId(null)}
                                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (onBatchDeleteSales) onBatchDeleteSales(deleteId, null)
                                    setDeleteId(null);
                                    setSelectedId('');
                                }}
                                style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', backgroundColor: '#dc2626', color: 'white', cursor: 'pointer', fontWeight: 600 }}
                            >
                                Clear Sales
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE CATEGORY CONFIRMATION */}
            {deleteCategory && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100
                }}>
                    <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '400px', width: '90%', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ marginTop: 0, color: '#b91c1c' }}>Confirm Category Clear</h3>
                        <p>Are you sure you want to clear all sales data for <strong>{deleteCategory}</strong>?</p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                            <button
                                onClick={() => setDeleteCategory(null)}
                                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (onBatchDeleteSales) onBatchDeleteSales(null, deleteCategory)
                                    setDeleteCategory(null);
                                    setSelectedId('');
                                }}
                                style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', backgroundColor: '#dc2626', color: 'white', cursor: 'pointer', fontWeight: 600 }}
                            >
                                Clear Data
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DETAIL EDITOR MODAL */}
            {editTx && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100
                }}>
                    <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '500px', width: '90%', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ marginTop: 0 }}>Edit Sale Record</h3>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Customer</label>
                            <div style={{ padding: '0.5rem', backgroundColor: '#f3f4f6', borderRadius: '4px' }}>{editTx.name}</div>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Category</label>
                            <select
                                value={editTx.category}
                                onChange={e => setEditTx({ ...editTx, category: e.target.value })}
                                className="input-field"
                            >
                                {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Amount ($)</label>
                            <input
                                type="number"
                                value={editTx.amount}
                                onChange={e => setEditTx({ ...editTx, amount: parseFloat(e.target.value) || 0 })}
                                className="input-field"
                            />
                        </div>

                        {/* COGS Input */}
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>COGS ($)</label>
                            <input
                                type="number"
                                value={editTx.cogs || 0}
                                onChange={e => setEditTx({ ...editTx, cogs: parseFloat(e.target.value) || 0 })}
                                className="input-field"
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'space-between', marginTop: '1.5rem' }}>
                            <button
                                onClick={() => {
                                    if (onDeleteSale) onDeleteSale(editTx.id)
                                    setEditTx(null)
                                }}
                                style={{ padding: '0.5rem 1rem', border: '1px solid #fecaca', borderRadius: '6px', backgroundColor: '#fee2e2', color: '#b91c1c', cursor: 'pointer', fontWeight: 600 }}
                            >
                                Delete Record
                            </button>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    onClick={() => { setEditTx(null) }}
                                    style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        if (onUpdateSale) onUpdateSale(editTx.id, {
                                            amount: editTx.amount,
                                            category: editTx.category,
                                            cogs: editTx.cogs
                                        })
                                        setEditTx(null);
                                    }}
                                    style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', backgroundColor: '#2563eb', color: 'white', cursor: 'pointer', fontWeight: 600 }}
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ADD SALE MODAL */}
            {isAdding && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100
                }}>
                    <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '500px', width: '90%', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ marginTop: 0 }}>Add Manual Sale</h3>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Customer Name</label>
                            <input
                                type="text"
                                placeholder="Enter Customer Name"
                                value={newSale.customerName}
                                onChange={e => setNewSale({ ...newSale, customerName: e.target.value })}
                                className="input-field"
                            />
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Category</label>
                            <select
                                value={newSale.category}
                                onChange={e => setNewSale({ ...newSale, category: e.target.value })}
                                className="input-field"
                            >
                                <option value="" disabled>-- Select --</option>
                                {categoryNames.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Amount ($)</label>
                            <input
                                type="number"
                                placeholder="0.00"
                                value={newSale.amount}
                                onChange={e => setNewSale({ ...newSale, amount: parseFloat(e.target.value) || 0 })}
                                className="input-field"
                            />
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>COGS ($)</label>
                            <input
                                type="number"
                                placeholder="0.00"
                                value={newSale.cogs || ''}
                                onChange={e => setNewSale({ ...newSale, cogs: parseFloat(e.target.value) || 0 })}
                                className="input-field"
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                            <button
                                onClick={() => setIsAdding(false)}
                                style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: '6px', backgroundColor: 'white', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    if (onAddSale && newSale.customerName && newSale.category) {
                                        onAddSale({
                                            name: newSale.customerName,
                                            customerName: newSale.customerName,
                                            category: newSale.category,
                                            amount: newSale.amount || 0,
                                            cogs: newSale.cogs || 0,
                                            customerId: ''
                                        })
                                        setIsAdding(false)
                                    }
                                }}
                                style={{ padding: '0.5rem 1rem', border: 'none', borderRadius: '6px', backgroundColor: '#16a34a', color: 'white', cursor: 'pointer', fontWeight: 600 }}
                            >
                                Add Sale
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default SalesDataManager

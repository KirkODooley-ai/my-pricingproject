import React, { useState } from 'react'
import { calculateTier, formatCurrency, CUSTOMER_GROUPS } from '../utils/pricingEngine'
import './PricingTable.css'

const CustomerManager = ({ customers, onAddCustomer, onUpdateCustomer, onDeleteCustomer }) => {
    const [activeTab, setActiveTab] = useState(CUSTOMER_GROUPS.DEALER)
    const [newCustomer, setNewCustomer] = useState({
        name: '',
        territory: 'SK', // Default to first priority
        group: CUSTOMER_GROUPS.DEALER,
        annualSpend: 0
    })

    const handleChange = (e) => {
        const { name, value } = e.target
        setNewCustomer(prev => ({
            ...prev,
            [name]: name === 'annualSpend' ? (parseFloat(value) || 0) : value
        }))
    }

    const handleAdd = () => {
        if (!newCustomer.name) return
        onAddCustomer({ ...newCustomer, id: Date.now().toString() })
        setNewCustomer({ name: '', territory: 'SK', group: CUSTOMER_GROUPS.DEALER, annualSpend: 0 })
    }

    // Sort Logic: Spend (High->Low) > Territory (SK->AB->BC)
    const territoryRank = { 'SK': 1, 'AB': 2, 'BC': 3, 'Other': 4 }
    const getRank = (t) => territoryRank[t] || 4

    const sortedCustomers = [...customers]
        .filter(c => {
            if (activeTab === 'Other') {
                return c.group !== CUSTOMER_GROUPS.DEALER && c.group !== CUSTOMER_GROUPS.COMMERCIAL
            }
            return c.group === activeTab
        })
        .sort((a, b) => {
            // Primary: Spend (Desc)
            const spendDiff = b.annualSpend - a.annualSpend
            if (spendDiff !== 0) return spendDiff

            // Secondary: Territory
            const rankA = getRank(a.territory)
            const rankB = getRank(b.territory)
            return rankA - rankB
        })

    return (
        <div className="pricing-table-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee', padding: '0 1rem' }}>
                <h3 style={{ margin: '1rem 0' }}>Customer Management</h3>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={() => setActiveTab(CUSTOMER_GROUPS.DEALER)}
                        style={{
                            padding: '0.5rem 1rem',
                            border: 'none',
                            borderBottom: activeTab === CUSTOMER_GROUPS.DEALER ? '2px solid #2563eb' : '2px solid transparent',
                            background: 'transparent',
                            color: activeTab === CUSTOMER_GROUPS.DEALER ? '#2563eb' : '#6b7280',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Dealers
                    </button>
                    <button
                        onClick={() => setActiveTab(CUSTOMER_GROUPS.COMMERCIAL)}
                        style={{
                            padding: '0.5rem 1rem',
                            border: 'none',
                            borderBottom: activeTab === CUSTOMER_GROUPS.COMMERCIAL ? '2px solid #2563eb' : '2px solid transparent',
                            background: 'transparent',
                            color: activeTab === CUSTOMER_GROUPS.COMMERCIAL ? '#2563eb' : '#6b7280',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Commercial
                    </button>
                    <button
                        onClick={() => setActiveTab('Other')}
                        style={{
                            padding: '0.5rem 1rem',
                            border: 'none',
                            borderBottom: activeTab === 'Other' ? '2px solid #ef4444' : '2px solid transparent',
                            background: 'transparent',
                            color: activeTab === 'Other' ? '#ef4444' : '#6b7280',
                            fontWeight: 600,
                            cursor: 'pointer'
                        }}
                    >
                        Other ({customers.filter(c => c.group !== CUSTOMER_GROUPS.DEALER && c.group !== CUSTOMER_GROUPS.COMMERCIAL).length})
                    </button>
                </div>
            </div>
            <table className="pricing-table">
                <thead>
                    <tr>
                        <th>Customer Name</th>
                        <th>Territory</th>
                        <th>Customer Group</th>
                        <th>Annual Spend ($)</th>
                        <th>Computed Tier</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedCustomers.map(customer => {
                        const tierName = calculateTier(customer.group, customer.annualSpend)
                        return (
                            <tr key={customer.id}>
                                <td>{customer.name}</td>
                                <td>
                                    <select
                                        className="input-field"
                                        value={customer.territory || 'Other'}
                                        onChange={(e) => onUpdateCustomer(customer.id, { territory: e.target.value })}
                                        style={{ height: '36px', padding: '0 0.5rem', fontWeight: 500 }}
                                    >
                                        <option value="SK">SK</option>
                                        <option value="AB">AB</option>
                                        <option value="BC">BC</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </td>
                                <td>{customer.group}</td>
                                <td>{formatCurrency(customer.annualSpend)}</td>
                                <td>
                                    <span style={{ fontWeight: 600, color: '#2563eb' }}>
                                        {tierName}
                                    </span>
                                </td>
                                <td>
                                    <button className="action-btn" onClick={() => onDeleteCustomer(customer.id)}>Delete</button>
                                </td>
                            </tr>
                        )
                    })}
                    <tr style={{ backgroundColor: '#f0f9ff' }}>
                        <td>
                            <input
                                className="input-field"
                                name="name"
                                placeholder="Customer Name"
                                value={newCustomer.name}
                                onChange={handleChange}
                            />
                        </td>
                        <td>
                            <select
                                className="input-field"
                                name="territory"
                                value={newCustomer.territory}
                                onChange={handleChange}
                            >
                                <option value="SK">SK</option>
                                <option value="AB">AB</option>
                                <option value="BC">BC</option>
                                <option value="Other">Other</option>
                            </select>
                        </td>
                        <td>
                            <select
                                className="input-field"
                                name="group"
                                value={newCustomer.group}
                                onChange={handleChange}
                                style={{ minWidth: '150px' }}
                            >
                                <option value={activeTab}>{activeTab}</option>
                                {Object.values(CUSTOMER_GROUPS).filter(g => g !== activeTab).map(group => (
                                    <option key={group} value={group}>{group}</option>
                                ))}
                            </select>
                        </td>
                        <td>
                            <input
                                className="input-field"
                                name="annualSpend"
                                type="number"
                                placeholder="Annual Spend"
                                value={newCustomer.annualSpend || ''}
                                onChange={handleChange}
                            />
                        </td>
                        <td>
                            <span style={{ fontStyle: 'italic', color: '#6b7280' }}>
                                {calculateTier(newCustomer.group, newCustomer.annualSpend)}
                            </span>
                        </td>
                        <td>
                            <button className="add-btn" onClick={handleAdd}>Add</button>
                        </td>
                    </tr>
                    {/* GRAND TOTAL ROW */}
                    <tr style={{ backgroundColor: '#e5e7eb', borderTop: '2px solid #9ca3af', fontWeight: 'bold' }}>
                        <td colSpan="3" style={{ textAlign: 'right', paddingRight: '1rem' }}>Total (All Customers):</td>
                        <td style={{ color: '#111827' }}>
                            {formatCurrency(customers.reduce((sum, c) => sum + (c.annualSpend || 0), 0))}
                        </td>
                        <td colSpan="2"></td>
                    </tr>
                </tbody>
            </table>
        </div>
    )
}

export default CustomerManager

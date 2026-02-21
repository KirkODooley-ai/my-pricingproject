import React, { useState } from 'react'
import { calculateTier, formatCurrency, CUSTOMER_GROUPS } from '../utils/pricingEngine'
import './PricingTable.css'

const getTierBadgeClass = (tierName) => {
    const name = (tierName || '').toLowerCase()
    if (name.includes('obsidian')) return 'tier-badge tier-obsidian'
    if (name.includes('platinum')) return 'tier-badge tier-platinum'
    if (name.includes('diamond')) return 'tier-badge tier-diamond'
    if (name.includes('gold')) return 'tier-badge tier-gold'
    if (name.includes('silver')) return 'tier-badge tier-silver'
    if (name.includes('bronze')) return 'tier-badge tier-bronze'
    return 'tier-badge badge-gray'
}

const CustomerManager = ({ customers, onAddCustomer, onUpdateCustomer, onDeleteCustomer }) => {
    const [activeTab, setActiveTab] = useState(CUSTOMER_GROUPS.DEALER)
    const [newCustomer, setNewCustomer] = useState({
        name: '',
        territory: 'SK',
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
            const spendDiff = b.annualSpend - a.annualSpend
            if (spendDiff !== 0) return spendDiff
            const rankA = getRank(a.territory)
            const rankB = getRank(b.territory)
            return rankA - rankB
        })

    return (
        <div>
            <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Customer Management</h2>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.9rem' }}>
                    Manage dealer and commercial partner accounts
                </p>
            </div>

            <div className="pricing-table-container">
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    borderBottom: '1px solid var(--border-light)', 
                    padding: '0.75rem 1.5rem',
                    backgroundColor: 'var(--bg-muted)'
                }}>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button
                            onClick={() => setActiveTab(CUSTOMER_GROUPS.DEALER)}
                            className={`tab ${activeTab === CUSTOMER_GROUPS.DEALER ? 'active' : ''}`}
                            style={{
                                padding: '0.625rem 1.25rem',
                                border: 'none',
                                borderBottom: activeTab === CUSTOMER_GROUPS.DEALER ? '2px solid var(--primary-color)' : '2px solid transparent',
                                background: 'transparent',
                                color: activeTab === CUSTOMER_GROUPS.DEALER ? 'var(--primary-color)' : 'var(--text-muted)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                marginBottom: '-1px',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            Dealers
                        </button>
                        <button
                            onClick={() => setActiveTab(CUSTOMER_GROUPS.COMMERCIAL)}
                            style={{
                                padding: '0.625rem 1.25rem',
                                border: 'none',
                                borderBottom: activeTab === CUSTOMER_GROUPS.COMMERCIAL ? '2px solid var(--primary-color)' : '2px solid transparent',
                                background: 'transparent',
                                color: activeTab === CUSTOMER_GROUPS.COMMERCIAL ? 'var(--primary-color)' : 'var(--text-muted)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                marginBottom: '-1px',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            Commercial
                        </button>
                        <button
                            onClick={() => setActiveTab('Other')}
                            style={{
                                padding: '0.625rem 1.25rem',
                                border: 'none',
                                borderBottom: activeTab === 'Other' ? '2px solid var(--danger)' : '2px solid transparent',
                                background: 'transparent',
                                color: activeTab === 'Other' ? 'var(--danger)' : 'var(--text-muted)',
                                fontWeight: 600,
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                marginBottom: '-1px',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            Other ({customers.filter(c => c.group !== CUSTOMER_GROUPS.DEALER && c.group !== CUSTOMER_GROUPS.COMMERCIAL).length})
                        </button>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <strong style={{ color: 'var(--text-secondary)' }}>{sortedCustomers.length}</strong> customers in this group
                    </div>
                </div>

                <div className="table-wrapper" style={{ maxHeight: '60vh' }}>
                    <table className="pricing-table">
                        <thead>
                            <tr>
                                <th style={{ width: '30%' }}>Customer Name</th>
                                <th style={{ width: '10%', textAlign: 'center' }}>Territory</th>
                                <th style={{ width: '15%' }}>Customer Group</th>
                                <th style={{ width: '15%', textAlign: 'right' }}>Annual Spend</th>
                                <th style={{ width: '18%' }}>Computed Tier</th>
                                <th style={{ width: '12%', textAlign: 'center' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedCustomers.map(customer => {
                                const tierName = calculateTier(customer.group, customer.annualSpend)
                                return (
                                    <tr key={customer.id}>
                                        <td style={{ fontWeight: 500 }}>{customer.name}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <select
                                                className="input-field"
                                                value={customer.territory || 'Other'}
                                                onChange={(e) => onUpdateCustomer(customer.id, { territory: e.target.value })}
                                                style={{ 
                                                    height: '34px', 
                                                    padding: '0 0.5rem', 
                                                    fontWeight: 500,
                                                    maxWidth: '80px',
                                                    textAlign: 'center'
                                                }}
                                            >
                                                <option value="SK">SK</option>
                                                <option value="AB">AB</option>
                                                <option value="BC">BC</option>
                                                <option value="MB">MB</option>
                                                <option value="ON">ON</option>
                                                <option value="Other">Other</option>
                                            </select>
                                        </td>
                                        <td style={{ color: 'var(--text-secondary)' }}>{customer.group}</td>
                                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                                            {formatCurrency(customer.annualSpend)}
                                        </td>
                                        <td>
                                            <span className={getTierBadgeClass(tierName)}>
                                                {tierName.replace('Authorized ', '').replace(' Partner', '')}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <button 
                                                className="action-btn delete-btn" 
                                                onClick={() => onDeleteCustomer(customer.id)}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}

                            {/* Add New Customer Row */}
                            <tr style={{ backgroundColor: 'var(--bg-muted)' }}>
                                <td>
                                    <input
                                        className="input-field"
                                        name="name"
                                        placeholder="Customer Name"
                                        value={newCustomer.name}
                                        onChange={handleChange}
                                        style={{ maxWidth: '100%' }}
                                    />
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    <select
                                        className="input-field"
                                        name="territory"
                                        value={newCustomer.territory}
                                        onChange={handleChange}
                                        style={{ maxWidth: '80px' }}
                                    >
                                        <option value="SK">SK</option>
                                        <option value="AB">AB</option>
                                        <option value="BC">BC</option>
                                        <option value="MB">MB</option>
                                        <option value="ON">ON</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </td>
                                <td>
                                    <select
                                        className="input-field"
                                        name="group"
                                        value={newCustomer.group}
                                        onChange={handleChange}
                                        style={{ minWidth: '130px' }}
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
                                        placeholder="0.00"
                                        value={newCustomer.annualSpend || ''}
                                        onChange={handleChange}
                                        style={{ textAlign: 'right', maxWidth: '140px' }}
                                    />
                                </td>
                                <td>
                                    <span className={getTierBadgeClass(calculateTier(newCustomer.group, newCustomer.annualSpend))} style={{ opacity: 0.7 }}>
                                        {calculateTier(newCustomer.group, newCustomer.annualSpend).replace('Authorized ', '').replace(' Partner', '')}
                                    </span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                    <button className="add-btn" onClick={handleAdd} style={{ marginBottom: 0 }}>
                                        + Add
                                    </button>
                                </td>
                            </tr>

                            {/* Grand Total Row */}
                            <tr style={{ 
                                backgroundColor: 'var(--dark-blue)', 
                                color: 'white',
                                fontWeight: 600 
                            }}>
                                <td colSpan="3" style={{ 
                                    textAlign: 'right', 
                                    paddingRight: '1.5rem',
                                    color: 'rgba(255,255,255,0.8)',
                                    textTransform: 'uppercase',
                                    fontSize: '0.75rem',
                                    letterSpacing: '0.05em'
                                }}>
                                    Total (All Customers):
                                </td>
                                <td style={{ 
                                    textAlign: 'right', 
                                    color: 'white',
                                    fontWeight: 700,
                                    fontSize: '1.1rem'
                                }}>
                                    {formatCurrency(customers.reduce((sum, c) => sum + (c.annualSpend || 0), 0))}
                                </td>
                                <td colSpan="2"></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

export default CustomerManager

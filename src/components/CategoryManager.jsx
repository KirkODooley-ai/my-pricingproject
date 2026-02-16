import React, { useState } from 'react'
import { calculateCategoryMargin, formatCurrency, formatPercent, getCategoryGroup } from '../utils/pricingEngine'
import './PricingTable.css' // Reusing table styles

const CategoryManager = ({ categories, onAddCategory, onUpdateCategory, onDeleteCategory, onRestoreDefaults, onSwapCategories }) => {
    // Edit Mode State
    const [editingId, setEditingId] = useState(null)
    const [editFormData, setEditFormData] = useState({})

    const [newCategory, setNewCategory] = useState({
        name: '',
        revenue: 0,
        materialCost: 0,
        laborPercentage: 0 // [NEW] Labor %
    })

    // Edit Handlers
    const handleEditClick = (category) => {
        setEditingId(category.id)
        // [UX Fix] Convert decimal to whole number for editing (0.15 -> 15)
        setEditFormData({
            ...category,
            laborPercentage: (category.laborPercentage || 0) * 100
        })
    }

    const handleCancelEdit = () => {
        setEditingId(null)
        setEditFormData({})
    }

    const handleSaveClick = (id) => {
        // [NEW] Calculate derived labor cost
        const rev = parseFloat(editFormData.revenue) || 0
        // [UX Fix] Convert whole number back to decimal for logic (15 -> 0.15)
        const labPct = (parseFloat(editFormData.laborPercentage) || 0) / 100
        const calculatedLaborCost = rev * labPct

        onUpdateCategory(id, {
            ...editFormData,
            revenue: rev,
            materialCost: parseFloat(editFormData.materialCost) || 0,
            laborPercentage: labPct,
            laborCost: calculatedLaborCost // Derive cost from %
        })
        setEditingId(null)
    }

    const handleEditChange = (e) => {
        const { name, value } = e.target
        setEditFormData(prev => ({
            ...prev,
            [name]: name === 'name' ? value : value, // Keep as string for input
            // [NEW] Real-time preview of calculation?
            // If user changes revenue or percentage, we could update cost in UI...
            // but margin calc depends on the saved object unless we change how we calculate.
            // For now, simple state update.
        }))
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setNewCategory(prev => ({
            ...prev,
            [name]: name === 'name' ? value : parseFloat(value) || 0
        }))
    }

    // Toggle Form
    const [showAddForm, setShowAddForm] = useState(false)

    const handleAdd = (e) => {
        e.preventDefault()
        if (!newCategory.name) return

        // [UX Fix] Convert whole number back to decimal for logic (15 -> 0.15)
        const rev = newCategory.revenue || 0
        const labPct = (newCategory.laborPercentage || 0) / 100
        const calculatedLaborCost = rev * labPct

        onAddCategory({
            ...newCategory,
            laborPercentage: labPct,
            laborCost: calculatedLaborCost,
            id: Date.now().toString()
        })
        setNewCategory({ name: '', revenue: 0, materialCost: 0, laborPercentage: 0 })
        setShowAddForm(false)
    }

    return (
        <div className="pricing-table-container">
            <div style={{ padding: '1rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Category Analysis</h3>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="add-btn" onClick={() => setShowAddForm(!showAddForm)}>
                        {showAddForm ? 'Cancel' : '+ Add Category'}
                    </button>
                    {categories.length === 0 && (
                        <button
                            onClick={onRestoreDefaults}
                            style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: '#2563eb',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 600
                            }}
                        >
                            ⟳ Load Default Categories
                        </button>
                    )}
                </div>
            </div>

            {showAddForm && (
                <form onSubmit={handleAdd} className="add-form" style={{ margin: '1rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                    <h4>New Category</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
                        <input
                            className="input-field"
                            name="name"
                            placeholder="Category Name"
                            value={newCategory.name}
                            onChange={handleChange}
                            autoFocus
                        />
                        <input
                            className="input-field"
                            name="revenue"
                            type="number"
                            placeholder="Revenue ($)"
                            value={newCategory.revenue || ''}
                            onChange={handleChange}
                        />
                        <input
                            className="input-field"
                            name="materialCost"
                            type="number"
                            placeholder="Material Cost ($)"
                            value={newCategory.materialCost || ''}
                            onChange={handleChange}
                        />
                        {/* [NEW] Labor % Input */}
                        <div style={{ position: 'relative' }}>
                            <input
                                className="input-field"
                                name="laborPercentage"
                                type="number"
                                step="0.5"
                                placeholder="Labor % (e.g. 15)"
                                value={newCategory.laborPercentage || ''}
                                onChange={handleChange}
                            />
                            <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', fontSize: '0.8rem' }}>%</span>
                        </div>
                    </div>
                    <button type="submit" className="action-btn save-btn" style={{ marginTop: '1rem' }}>Save Category</button>
                </form>
            )}

            <table className="pricing-table">
                <thead>
                    <tr>
                        <th>Category Name</th>
                        <th>Revenue ($)</th>
                        <th>Sales Mix (%)</th>
                        <th>Material Cost ($)</th>
                        <th>Labor %</th>
                        <th style={{ color: '#6b7280' }}>Labor Cost ($)</th>
                        <th>Total Margin (%)</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                {/* Render Groups */}
                {['Large Rolled Panel', 'Small Rolled Panels', 'Cladding Series', 'Parts'].map(groupName => {
                    // Filter categories for this group
                    const groupCats = categories.filter(cat => {
                        const calculatedGroup = getCategoryGroup(cat.name) // Use helper
                        return calculatedGroup === groupName
                    })

                    if (groupCats.length === 0) return null

                    return (
                        <tbody key={groupName}>
                            {/* Group Header */}
                            {/* Group Header */}
                            <tr style={{ backgroundColor: '#fafafa' }}>
                                <td colSpan={8} style={{
                                    padding: '0.8rem 1rem',
                                    borderBottom: '1px solid #e5e7eb',
                                    borderTop: '1px solid #e5e7eb',
                                    color: '#6b7280',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.08em'
                                }}>
                                    {groupName}
                                </td>
                            </tr>
                            {/* Category Rows */}
                            {groupCats.map((cat, index) => {
                                const margin = calculateCategoryMargin(cat)
                                const totalRevenue = categories.reduce((sum, c) => sum + (c.revenue || 0), 0)
                                const salesMix = totalRevenue > 0 ? (cat.revenue || 0) / totalRevenue : 0
                                const isEditing = editingId === cat.id

                                // Swap Logic
                                const canMoveUp = index > 0
                                const canMoveDown = index < groupCats.length - 1
                                const prevCat = canMoveUp ? groupCats[index - 1] : null
                                const nextCat = canMoveDown ? groupCats[index + 1] : null

                                return (
                                    <tr key={cat.id}>
                                        {isEditing ? (
                                            <>
                                                <td><input type="text" name="name" value={editFormData.name} onChange={handleEditChange} className="input-field" autoFocus /></td>
                                                <td><input type="number" name="revenue" value={editFormData.revenue} onChange={handleEditChange} className="input-field" /></td>
                                                <td>-</td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        name="materialCost"
                                                        value={editFormData.materialCost}
                                                        disabled
                                                        title="Auto-calculated from Sales Data COGS"
                                                        style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed', color: '#6b7280' }}
                                                        className="input-field"
                                                    />
                                                </td>
                                                <td><input type="number" step="0.5" name="laborPercentage" value={editFormData.laborPercentage || 0} onChange={handleEditChange} className="input-field" /></td>
                                                <td style={{ color: '#9ca3af' }}>{formatCurrency((parseFloat(editFormData.revenue) || 0) * (parseFloat(editFormData.laborPercentage) / 100 || 0))}</td>
                                                <td>-</td>
                                                <td>
                                                    <button className="action-btn save-btn" onClick={() => handleSaveClick(cat.id)}>Save</button>
                                                    <button className="action-btn cancel-btn" onClick={handleCancelEdit}>Cancel</button>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td>{cat.name}</td>
                                                <td>{formatCurrency(cat.revenue)}</td>
                                                <td style={{ fontWeight: 500, color: '#2563eb' }}>{formatPercent(salesMix)}</td>
                                                <td>{formatCurrency(cat.materialCost)}</td>
                                                <td>{cat.laborPercentage ? formatPercent(cat.laborPercentage) : <span style={{ color: '#d1d5db' }}>-</span>}</td>
                                                <td>{formatCurrency(cat.laborCost)}</td>
                                                <td>
                                                    <span style={{ color: margin < 0.2 ? 'orange' : 'green', fontWeight: 'bold' }}>
                                                        {formatPercent(margin)}
                                                    </span>
                                                </td>
                                                <td style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                    <button className="action-btn edit-btn" onClick={() => handleEditClick(cat)}>Edit</button>
                                                    <button className="action-btn delete-btn" onClick={() => onDeleteCategory(cat.id)}>Delete</button>

                                                    {/* [NEW] Reordering Arrows (Premium SVGs) */}
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                        <button
                                                            disabled={!canMoveUp}
                                                            onClick={() => onSwapCategories(cat.id, prevCat.id)}
                                                            style={{
                                                                border: 'none',
                                                                background: 'transparent',
                                                                cursor: canMoveUp ? 'pointer' : 'default',
                                                                opacity: canMoveUp ? 1 : 0.1,
                                                                padding: '2px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                borderRadius: '4px',
                                                                transition: 'background 0.2s',
                                                                color: '#6b7280'
                                                            }}
                                                            title="Move Up"
                                                            onMouseEnter={(e) => canMoveUp && (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                                                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="18 15 12 9 6 15"></polyline>
                                                            </svg>
                                                        </button>
                                                        <button
                                                            disabled={!canMoveDown}
                                                            onClick={() => onSwapCategories(cat.id, nextCat.id)}
                                                            style={{
                                                                border: 'none',
                                                                background: 'transparent',
                                                                cursor: canMoveDown ? 'pointer' : 'default',
                                                                opacity: canMoveDown ? 1 : 0.1,
                                                                padding: '2px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                borderRadius: '4px',
                                                                transition: 'background 0.2s',
                                                                color: '#6b7280'
                                                            }}
                                                            title="Move Down"
                                                            onMouseEnter={(e) => canMoveDown && (e.currentTarget.style.backgroundColor = '#f3f4f6')}
                                                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="6 9 12 15 18 9"></polyline>
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                )
                            })}
                        </tbody>
                    )
                })}
            </table>
        </div>
    )
}

export default CategoryManager

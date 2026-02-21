import React, { useState, useEffect, useMemo } from 'react'
import PricingTable from './components/PricingTable'
import PricingCalculator from './components/PricingCalculator'
import CategoryManager from './components/CategoryManager'
import CustomerManager from './components/CustomerManager'
import DataImporter from './components/DataImporter'
import ImpactAnalysis from './components/ImpactAnalysis'
import SalesDataManager from './components/SalesDataManager'

import SalesAnalysis from './components/SalesAnalysis'
import PricingStrategyManager from './components/PricingStrategyManager' // [NEW] Phase 14
import MarginAlerts from './components/MarginAlerts' // [NEW] Phase 15
import Dashboard from './components/Dashboard'
import Login from './components/Login' // [NEW]
import UserManagement from './components/UserManagement'
import { useAuth } from './contexts/AuthContext' // [NEW]
import { calculateImpact } from './utils/analysisEngine'
import { api } from './services/api'

import { DEFAULT_CATEGORIES } from './utils/pricingEngine'
import './App.css'

// Forma Steel branding - white logo for dark sidebar
import logoSidebar from '../Assests and Branding/Logos/Forma-Primary-Logo-RGB-White.png'

function App() {
  const { user, logout } = useAuth();

  // Redirect to Login if not authenticated
  if (!user) {
    return <Login />;
  }

  // --- Lazy Initialization (Load immediately) ---
  const [isHydrated, setIsHydrated] = useState(false)

  // Hydration: Load ALL data from Backend
  useEffect(() => {
    async function load() {
      const data = await api.loadData()
      if (data) {
        if (data.products) setProducts(data.products)
        else setProducts([{ id: '1', name: 'Widget A', cost: 10, price: 15 }])

        if (data.categories) setCategories(data.categories)
        else setCategories(DEFAULT_CATEGORIES.map((name, idx) => ({ id: String(idx + 1), name })))

        if (data.customers) setCustomers(data.customers)
        if (data.salesTransactions) setSalesTransactions(data.salesTransactions)
        if (data.pricingStrategy) setPricingStrategy(data.pricingStrategy)
        if (data.customerAliases) setCustomerAliases(data.customerAliases)
        if (data.productVariants) setProductVariants(data.productVariants) // [NEW] Phase 18 variants

        // [NEW] Load Settings
        if (data.settings) {
          const settingsMap = data.settings.reduce((acc, item) => {
            acc[item.key] = item.value.value; // Unpack JSONB wrapper
            return acc;
          }, {});
          setGlobalSettings(prev => ({ ...prev, ...settingsMap }));
        }
      }
      setIsHydrated(true)
    }
    load()
  }, [])

  const [products, setProducts] = useState([])
  const [productVariants, setProductVariants] = useState([]) // [NEW] Variants State

  const [categories, setCategories] = useState([])

  const [customers, setCustomers] = useState([])

  // [NEW] Decoupled Sales Data Store
  const [salesTransactions, setSalesTransactions] = useState([])

  // [NEW] Global Settings Store
  const [globalSettings, setGlobalSettings] = useState({
    global_multiplier: 1.5 // Default Fallback
  })

  // ... (Customer Aliases state stays same)

  // ... (Customer Aliases state stays same)

  // ... (Effects stay same)

  // ... (Sales CRUD handled via upsert logic below)

  const [pricingStrategy, setPricingStrategy] = useState({
    listMultipliers: { 'Default': 1.5, 'Fasteners': 1.65 },
    tierMultipliers: { 'Dealer': {}, 'Commercial': {} }
  })

  // [REMOVED] localStorage persistence for pricingStrategy.
  // Now relies on initial hydration and API calls via persistence helper.
  const handleUpdateSale = (id, updatedFields) => {
    setSalesTransactions(prev => prev.map(tx =>
      tx.id === id ? { ...tx, ...updatedFields } : tx
    ))
  }

  const handleAddSale = (newSale) => {
    const saleWithId = { ...newSale, id: newSale.id || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` }
    setSalesTransactions(prev => [...prev, saleWithId])
  }

  const handleDeleteSale = (id) => {
    setSalesTransactions(prev => prev.filter(tx => tx.id !== id))
  }

  // ... (rest of component) ...



  // [NEW] Customer Aliases (Smart Link)
  const [customerAliases, setCustomerAliases] = useState({})

  const [activeTab, setActiveTab] = useState('dashboard')

  // --- Pricing Config State (Lifted) ---
  const [mix, setMix] = useState({})

  // [REF] Removed legacy categoryMarkups/tierCategoryDiscounts. Using pricingStrategy instead.

  // --- Initialize Pricing Config (One-time or when Categories change) ---
  useEffect(() => {
    const categoryNames = categories.map(c => c.name)
    if (categoryNames.length === 0) return

    setMix(prev => {
      const newMix = { ...prev }

      // Calculate Mix from Category Revenue
      const totalRev = categories.reduce((sum, c) => sum + (parseFloat(c.revenue) || 0), 0)
      const count = categories.length

      categories.forEach(cat => {
        if (totalRev > 0) {
          // Dynamic Share based on Revenue
          const rev = parseFloat(cat.revenue) || 0
          newMix[cat.name] = rev / totalRev
        } else {
          // Fallback: Equal Share if no revenue data
          if (newMix[cat.name] === undefined) newMix[cat.name] = 1 / Math.max(1, count)
        }
      })
      return newMix
    })

    // [REF] Removed legacy Markup/Discount seeding logic. 
    // Defaults are now handled via `pricingStrategy` initialization or fallbacks in analysisEngine.
  }, [categories])





  // --- MIGRATION: Extract Embedded Sales Data ---
  // If we have Customers with `categorySpend` but NO `salesTransactions` (Legacy Mode),
  // we extract the data to the new store to prevent data loss.
  useEffect(() => {
    if (!isHydrated) return

    if (salesTransactions.length === 0 && customers.some(c => c.categorySpend && Object.keys(c.categorySpend).length > 0)) {
      console.log("Migrating Legacy Sales Data...")
      const migratedSales = []

      customers.forEach(c => {
        if (c.categorySpend) {
          Object.entries(c.categorySpend).forEach(([cat, amount]) => {
            if (amount > 0) {
              migratedSales.push({
                id: Date.now() + Math.random().toString(), // Unique ID
                customerName: c.name,
                category: cat,
                amount: amount,
                date: new Date().toISOString() // Timestamp
              })
            }
          })
        }
      })

      if (migratedSales.length > 0) {
        setSalesTransactions(migratedSales)
        // Optional: We could clear c.categorySpend here, but for safety we'll leave it 
        // and just ignore it in the UI going forward.
      }
    }
  }, [isHydrated, customers.length]) // check on mount/load

  // --- Save Data --
  // ONLY save if we are hydrated AND we have data, OR if we are explicitly in a "ready" state.
  // To be safe, we only write if the state is non-empty, OR if we know for sure we've been running for a bit.
  // For now, blocking empty writes on load is the best safety net.

  // --- Consolidated Persistence Helper (API Version) ---
  const saveData = (key, data) => {
    if (!isHydrated) return
    // Safety: Don't overwrite with empty if we expect data
    if (Array.isArray(data) && data.length === 0) return

    api.save(key, data)
  }

  useEffect(() => saveData('products', products), [products, isHydrated])
  useEffect(() => saveData('categories', categories), [categories, isHydrated])
  useEffect(() => saveData('customers', customers), [customers, isHydrated])
  useEffect(() => saveData('salesTransactions', salesTransactions), [salesTransactions, isHydrated])

  // [FIX] Missing Auto-Save for Pricing Strategy
  // Only save if we have meaningful data (not just the default state)
  useEffect(() => {
    if (!isHydrated) return;

    // Check if it's just the default
    const isDefault = Object.keys(pricingStrategy.tierMultipliers['Dealer']).length === 0 &&
      Object.keys(pricingStrategy.tierMultipliers['Commercial']).length === 0 &&
      pricingStrategy.listMultipliers['Default'] === 1.5;

    if (!isDefault) {
      saveData('pricingStrategy', pricingStrategy)
    }
  }, [pricingStrategy, isHydrated])

  useEffect(() => saveData('customerAliases', customerAliases), [customerAliases, isHydrated])
  useEffect(() => saveData('productVariants', productVariants), [productVariants, isHydrated]) // [NEW] Auto-Save Variants

  // [NEW] Sync Global Settings to Pricing Strategy
  useEffect(() => {
    if (!isHydrated) return;
    const globalMult = globalSettings.global_multiplier;

    // If Strategy Default differs from Global Setting, update Strategy to match
    if (pricingStrategy.listMultipliers['Default'] !== globalMult) {
      console.log(`Syncing Default Multiplier to ${globalMult}`);
      setPricingStrategy(prev => ({
        ...prev,
        listMultipliers: {
          ...prev.listMultipliers,
          'Default': globalMult
        }
      }));
    }
  }, [globalSettings.global_multiplier, isHydrated]); // Depend on the setting change

  // --- Sync Category Revenue (Updated Source) ---
  // Now sums from `salesTransactions` instead of `customers[].categorySpend`
  useEffect(() => {
    if (!isHydrated) return

    setCategories(prevCats => {
      // 1. Calculate Totals from Sales Transactions
      const revenueMap = {}
      const cogsMap = {}

      if (Array.isArray(salesTransactions)) {
        salesTransactions.forEach(tx => {
          if (!tx) return
          const k = (tx.category || '').toLowerCase().trim()
          if (k) {
            revenueMap[k] = (revenueMap[k] || 0) + (parseFloat(tx.amount) || 0)
            cogsMap[k] = (cogsMap[k] || 0) + (parseFloat(tx.cogs) || 0)
          }
        })
      }

      // 2. Check for changes
      let hasChanges = false
      const newCats = prevCats.map(cat => {
        if (!cat || !cat.name) return cat // Safety Guard

        const key = (cat.name || '').toLowerCase().trim()

        const salesRevenue = revenueMap[key] || 0
        const aggregatedCogs = cogsMap[key] || 0

        const currentRevenue = parseFloat(cat.revenue) || 0
        const currentMatCost = parseFloat(cat.materialCost) || 0

        let shouldUpdate = false
        const updates = {}

        // 2a. Sync Revenue
        if (Math.abs(currentRevenue - salesRevenue) > 0.01) {
          shouldUpdate = true
          updates.revenue = salesRevenue
        }

        // 2b. Sync Material Cost (COGS)
        if (Math.abs(currentMatCost - aggregatedCogs) > 0.01) {
          shouldUpdate = true
          updates.materialCost = aggregatedCogs
        }

        // 2c. Sync Labor Cost
        if (cat.laborPercentage !== undefined) {
          const derivedLaborCost = salesRevenue * (parseFloat(cat.laborPercentage) || 0)
          const currentLaborCost = parseFloat(cat.laborCost) || 0
          if (Math.abs(currentLaborCost - derivedLaborCost) > 0.01) {
            shouldUpdate = true
            updates.laborCost = derivedLaborCost
          }
        }

        if (shouldUpdate) {
          hasChanges = true
          return { ...cat, ...updates }
        }
        return cat
      })

      return hasChanges ? newCats : prevCats
    })
  }, [salesTransactions, isHydrated]) // depend on salesTransactions now!


  // --- Handlers ---
  const handleUpdateProduct = (id, updates) => setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p))
  const handleAddProduct = (item) => setProducts(prev => [...prev, item])
  const handleDeleteProduct = (id) => setProducts(prev => prev.filter(p => p.id !== id))
  const handleImportProducts = (items) => setProducts(prev => [...prev, ...items])

  const handleAddCategory = (item) => setCategories(prev => [...prev, item])
  const handleDeleteCategory = (id) => setCategories(prev => prev.filter(p => p.id !== id))
  // [Added] Delete Category Data (Clean from SalesTransactions)
  const handleDeleteCategoryData = (categoryName) => {
    setSalesTransactions(prev => prev.filter(tx => tx.category !== categoryName))
    // Also clean legacy data from customers just in case
    setCustomers(prev => prev.map(c => {
      if (!c.categorySpend || !c.categorySpend[categoryName]) return c
      const newSpend = { ...c.categorySpend }
      delete newSpend[categoryName]
      return { ...c, categorySpend: newSpend }
    }))
  }

  const handleAddCustomer = (item) => setCustomers(prev => [...prev, item])
  const handleUpdateCustomer = (id, updates) => setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
  const handleDeleteCustomer = (id) => setCustomers(prev => prev.filter(p => p.id !== id))
  // [NEW] Batch Delete Customers
  const handleBatchDeleteCustomers = (ids) => {
    const idSet = new Set(ids);
    setCustomers(prev => prev.filter(c => !idSet.has(c.id)))
    // NOTE: We do NOT delete sales transactions here. "Strict Separation".
    // Only the identity is deleted. Variance report will show "Missing Customer".
  }

  // [NEW] Delete Sales Transactions
  const handleDeleteSalesTransaction = (txId) => setSalesTransactions(prev => prev.filter(tx => tx.id !== txId))
  const handleBatchDeleteSales = (customerName, categoryName) => {
    setSalesTransactions(prev => prev.filter(tx => {
      if (customerName && categoryName) return !(tx.customerName === customerName && tx.category === categoryName)
      if (customerName) return tx.customerName !== customerName
      if (categoryName) return tx.category !== categoryName
      return true
    }))
  }

  const handleImportCustomers = (importedItems, skipExisting = false) => {
    // ... (Use existing logic, this is fine)
    setCustomers(prev => {
      const merged = [...prev]
      const indexMap = new Map()
      merged.forEach((c, idx) => { if (c.name) indexMap.set(c.name.toLowerCase().trim(), idx) })

      importedItems.forEach(newItem => {
        if (!newItem.name) return
        const key = newItem.name.toLowerCase().trim()
        if (indexMap.has(key)) {
          if (skipExisting) return
          const idx = indexMap.get(key)
          merged[idx] = { ...merged[idx], annualSpend: newItem.annualSpend, group: newItem.group || merged[idx].group, territory: newItem.territory || merged[idx].territory || 'Other' }
        } else {
          merged.push(newItem)
          indexMap.set(key, merged.length - 1)
        }
      })
      return merged
    })
  }

  // [REFACTORED] Import Sales Handler -> Write to salesTransactions
  // [REFACTORED] Import Sales Handler -> Upsert (Prevent Duplicates)
  const handleImportSales = (salesItems) => {
    setSalesTransactions(prev => {
      // Create a Map of existing transactions: Key -> Transaction Index
      // Key: Normalized "CustomerName|Category"
      const existingMap = new Map()
      const merged = [...prev]

      merged.forEach((tx, idx) => {
        const key = `${tx.customerName.toLowerCase().trim()}|${tx.category.toLowerCase().trim()}`
        existingMap.set(key, idx)
      })

      salesItems.forEach(item => {
        if (!item.name || !item.category) return

        const key = `${item.name.toLowerCase().trim()}|${item.category.toLowerCase().trim()}`

        if (existingMap.has(key)) {
          // UPDATE Existing Record (Replace amount)
          const idx = existingMap.get(key)
          merged[idx] = {
            ...merged[idx],
            amount: item.amount,
            cogs: item.cogs || 0, // [NEW] Update COGS
            date: new Date().toISOString()
          }
        } else {
          // ADD New Record
          merged.push({
            id: Date.now() + Math.random().toString(),
            customerName: item.name,
            category: item.category,
            amount: item.amount,
            cogs: item.cogs || 0, // [NEW] Add COGS
            date: new Date().toISOString()
          })
          // Update map so subsequent rows in same file also upsert correctly
          existingMap.set(key, merged.length - 1)
        }
      })

      return merged
    })
  }


  const handleClearData = (type) => {
    if (type === 'products') {
      setProducts([])
      api.save('products', [])
    }
    if (type === 'customers') {
      setCustomers([])
      api.save('customers', [])
    }
    if (type === 'categories') {
      setCategories([])
      api.save('categories', [])
    }
    if (type === 'sales') {
      setSalesTransactions([])
      api.save('salesTransactions', [])
    }
    if (type === 'aliases') {
      setCustomerAliases({})
      api.save('customerAliases', {})
    }
  }

  // [NEW] Info: Update Alias
  const handleUpdateAlias = (variant, canonical) => {
    setCustomerAliases(prev => ({
      ...prev,
      [variant]: canonical
    }))
  }

  // [NEW] Update Global Setting
  const handleUpdateSetting = (key, value) => {
    setGlobalSettings(prev => ({ ...prev, [key]: value }));
    // Persist immediately
    api.saveSetting(key, value);
  }

  // [NEW] Reordering Logic (Category Swap)
  const handleSwapCategories = (id1, id2) => {
    setCategories(prev => {
      const idx1 = prev.findIndex(c => c.id === id1)
      const idx2 = prev.findIndex(c => c.id === id2)
      if (idx1 === -1 || idx2 === -1) return prev

      const newCats = [...prev]
      const temp = newCats[idx1]
      newCats[idx1] = newCats[idx2]
      newCats[idx2] = temp

      // Persist immediately via API
      api.save('categories', newCats)
      return newCats
    })
  }

  const tabStyle = (tabName) => ({
    padding: '0.75rem 1.0rem',
    cursor: 'pointer',
    borderBottom: activeTab === tabName ? '2px solid var(--primary-color)' : '2px solid transparent',
    color: activeTab === tabName ? 'var(--primary-color)' : '#3363AF',
    fontWeight: 600,
    marginBottom: '-1px',
    fontSize: '0.9rem',
    whiteSpace: 'nowrap'
  })

  // --- Analysis Calculation (Lifted) ---
  const analysis = useMemo(() => {
    // [REF] Now passes `pricingStrategy` directly
    return calculateImpact(customers, pricingStrategy, mix)
  }, [customers, pricingStrategy, mix])

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src={logoSidebar} alt="Forma Steel" className="sidebar-logo" />
          <h1 className="app-title">Pricing Strategy</h1>
          <p className="app-subtitle">Creative Solutions in Steel</p>
        </div>

        <nav className="nav-section">
          {/* Main Navigation */}
          <div
            className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            Dashboard
          </div>

          <div className="nav-group-label">Data Management</div>
          <div
            className={`nav-link ${activeTab === 'sales-data' ? 'active' : ''}`}
            onClick={() => setActiveTab('sales-data')}
          >
            <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            Sales Data
          </div>
          <div
            className={`nav-link ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
            Products
          </div>
          <div
            className={`nav-link ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
            Categories
          </div>
          <div
            className={`nav-link ${activeTab === 'customers' ? 'active' : ''}`}
            onClick={() => setActiveTab('customers')}
          >
            <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
            Customers
          </div>

          <div className="nav-group-label">Pricing Tools</div>
          <div
            className={`nav-link ${activeTab === 'product-pricing' ? 'active' : ''}`}
            onClick={() => setActiveTab('product-pricing')}
          >
            <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
            Product Pricing
          </div>
          <div
            className={`nav-link ${activeTab === 'strategy' ? 'active' : ''}`}
            onClick={() => setActiveTab('strategy')}
          >
            <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Pricing Strategy
          </div>

          <div className="nav-group-label">Analysis</div>
          <div
            className={`nav-link ${activeTab === 'analysis' ? 'active' : ''}`}
            onClick={() => setActiveTab('analysis')}
          >
            <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            Transition Analysis
          </div>
          <div
            className={`nav-link ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => setActiveTab('alerts')}
          >
            <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            Margin Alerts
          </div>
          <div
            className={`nav-link ${activeTab === 'variance' ? 'active' : ''}`}
            onClick={() => setActiveTab('variance')}
          >
            <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Variance Report
          </div>

          {/* Admin Section */}
          <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
            {user.role === 'admin' && (
              <>
                <div className="nav-group-label">Administration</div>
                <div
                  className={`nav-link ${activeTab === 'users' ? 'active' : ''}`}
                  onClick={() => setActiveTab('users')}
                >
                  <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                  Users
                </div>
                <div
                  className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`}
                  onClick={() => setActiveTab('settings')}
                >
                  <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  Admin Settings
                </div>
              </>
            )}
            <div
              className={`nav-link ${activeTab === 'import' ? 'active' : ''}`}
              onClick={() => setActiveTab('import')}
            >
              <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              Import Data
            </div>
          </div>

          {/* User Info & Logout */}
          <div className="sidebar-user">
            <div className="sidebar-user-info">
              Logged in as
              <span className="sidebar-user-name">{user.username}</span>
              <span className="sidebar-user-role">{user.role} {user.region ? `· ${user.region}` : ''}</span>
            </div>
            <button
              onClick={logout}
              className="nav-link nav-link-logout"
              style={{ marginTop: '0.75rem', width: '100%', justifyContent: 'flex-start' }}
            >
              <svg className="nav-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              Logout
            </button>
          </div>
        </nav>
      </aside>

      <main className="main-content">
        <header className="main-header">
          <h1 className="main-header-brand">FORMA STEEL</h1>
          <p className="main-header-tagline">Creative Solutions in Steel · Pricing Strategy</p>
        </header>
        <div className="main-content-inner">
        {activeTab === 'dashboard' && (
          <Dashboard analysis={analysis} customers={customers} categories={categories} />
        )}

        {activeTab === 'products' && (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Product List</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.9rem' }}>Manage your product catalog and pricing data</p>
            </div>
            <PricingTable
              products={products}
              categories={categories}
              onUpdateProduct={handleUpdateProduct}
              onAddProduct={handleAddProduct}
              onDeleteProduct={handleDeleteProduct}
              pricingStrategy={pricingStrategy}
              salesTransactions={salesTransactions} // [NEW] For History Projections
              customers={customers} // [NEW] For Tier Lookup
              customerAliases={customerAliases} // [NEW] For Manual Customer Matching
              productVariants={productVariants} // [NEW]
              onUpdateVariants={setProductVariants} // [NEW] Manual Edit
            />
          </>
        )}

        {activeTab === 'categories' && (
          <CategoryManager
            categories={categories}
            onAddCategory={handleAddCategory}
            onUpdateCategory={(id, updates) => {
              setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c))
            }}
            onDeleteCategory={handleDeleteCategory}
            onRestoreDefaults={() => {
              const defaults = DEFAULT_CATEGORIES.map((name, idx) => ({ id: String(idx + 1), name }))
              setCategories(defaults)
            }}
            onSwapCategories={handleSwapCategories} // [NEW] Pass Swap Handler
          />
        )}

        {activeTab === 'customers' && (
          <CustomerManager
            customers={customers}
            onAddCustomer={handleAddCustomer}
            onUpdateCustomer={handleUpdateCustomer}
            onDeleteCustomer={handleDeleteCustomer}
          />
        )}

        {activeTab === 'product-pricing' && (
          <>
            <div style={{ marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Product Pricing</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.9rem' }}>Calculate tier-specific pricing and margins</p>
            </div>
            <PricingCalculator
              products={products}
              productVariants={productVariants} // [NEW]
            />
          </>
        )}

        {activeTab === 'import' && (
          <DataImporter
            onImportProducts={handleImportProducts}
            onImportCustomers={handleImportCustomers}
            onImportSales={handleImportSales}
            categories={categories}
            // Props for Full Backup/Restore
            fullState={{ products, customers, categories, salesTransactions }} // [NEW] Backup State
            onRestoreState={(state) => {
              if (state.products) setProducts(state.products)
              if (state.customers) setCustomers(state.customers)
              if (state.categories) setCategories(state.categories)
              if (state.salesTransactions) setSalesTransactions(state.salesTransactions) // [NEW] Restore Sales
              if (state.pricingStrategy) setPricingStrategy(state.pricingStrategy) // [NEW] Restore Strategy
            }}
            onClearData={handleClearData}
          />
        )}

        {activeTab === 'users' && user.role === 'admin' && <UserManagement />}

        {activeTab === 'settings' && user.role === 'admin' && (
          <div style={{ maxWidth: '700px' }}>
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem', color: 'var(--text-primary)' }}>Admin Settings</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Configure global system settings and pricing parameters.</p>
            </div>

            <div className="card">
              <div style={{ marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border-light)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Global Pricing Configuration</h3>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ 
                  display: 'block', 
                  textTransform: 'uppercase', 
                  fontSize: '0.7rem', 
                  fontWeight: 600, 
                  color: 'var(--text-muted)', 
                  marginBottom: '0.5rem',
                  letterSpacing: '0.05em'
                }}>
                  Global Markup Multiplier (Default)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="1.0"
                    value={globalSettings.global_multiplier || 1.5}
                    onChange={(e) => handleUpdateSetting('global_multiplier', parseFloat(e.target.value))}
                    className="input-field"
                    style={{
                      width: '120px',
                      fontSize: '1rem',
                      fontWeight: 600
                    }}
                  />
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                    Base List Price = Cost × {globalSettings.global_multiplier || 1.5}
                  </span>
                </div>
                <div className="alert alert-warning" style={{ marginTop: '1rem' }}>
                  <strong>Warning:</strong> Changing this affects all products using the "Default" multiplier immediately.
                </div>
              </div>
            </div>
          </div>
        )}



        {activeTab === 'strategy' && ( // [NEW] Pricing Strategy Tab
          <PricingStrategyManager
            strategy={pricingStrategy}
            setStrategy={setPricingStrategy}
            categories={categories}
            // [NEW] Props for Analysis
            salesTransactions={salesTransactions}
            customers={customers}
            // [NEW] Phase 18: Variants
            products={products}
            productVariants={productVariants}
            // [NEW] Manual Save Hook
            onSave={() => {
              api.save('pricingStrategy', pricingStrategy);
              alert("Pricing Strategy Saved Successfully!");
            }}
          />
        )}

        {activeTab === 'alerts' && (
          <MarginAlerts
            strategy={pricingStrategy}
            setStrategy={setPricingStrategy}
            categories={categories}
          />
        )}

        {activeTab === 'analysis' && (
          <ImpactAnalysis
            customers={customers}
            categories={categories}
            products={products}
            salesTransactions={salesTransactions} // [NEW] Pass Sales Data
            // Lifted State Props
            mix={mix}
            setMix={setMix}
            // [REF] Removed legacy props pass-through
            analysis={analysis}
          />
        )}

        {activeTab === 'variance' && ( // [NEW] Tab Render
          <SalesAnalysis
            customers={customers}
            salesTransactions={salesTransactions}
            customerAliases={customerAliases} // [NEW]
            onUpdateAlias={handleUpdateAlias} // [NEW]
          />
        )}

        {activeTab === 'sales-data' && (
          <SalesDataManager
            customers={customers}
            salesTransactions={salesTransactions} // [FIX] Pass Data
            categories={categories}
            onDeleteCustomer={handleDeleteCustomer} // Legacy (should arguably be removed or remapped)
            onDeleteCategory={handleDeleteCategoryData} // Legacy
            onBatchDeleteSales={handleBatchDeleteSales} // [FIX] New Handler
            onUpdateSale={handleUpdateSale}
            onAddSale={handleAddSale}
            onDeleteSale={handleDeleteSale}
          />
        )}
        </div>
      </main>
    </div>
  )
}

export default App

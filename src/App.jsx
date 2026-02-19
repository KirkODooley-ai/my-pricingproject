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
import ProposalsManager from './components/ProposalsManager' // [NEW]
import { useAuth } from './contexts/AuthContext' // [NEW]
import { calculateImpact } from './utils/analysisEngine'
import { api } from './services/api'

import { DEFAULT_CATEGORIES } from './utils/pricingEngine'
import './App.css'

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
    borderBottom: activeTab === tabName ? '2px solid #2563eb' : '2px solid transparent',
    color: activeTab === tabName ? '#2563eb' : '#6b7280',
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
          <h1 className="app-title">Pricing Manager</h1>
        </div>

        <nav className="nav-section">
          <div
            className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </div>
          <div
            className={`nav-link ${activeTab === 'analysis' ? 'active' : ''}`}
            onClick={() => setActiveTab('analysis')}
          >
            Transition Analysis
          </div>
          <div
            className={`nav-link ${activeTab === 'sales-data' ? 'active' : ''}`}
            onClick={() => setActiveTab('sales-data')}
          >
            Sales Data
          </div>
          <div
            className={`nav-link ${activeTab === 'variance' ? 'active' : ''}`}
            onClick={() => setActiveTab('variance')}
          >
            Variance Report
          </div>
          <div
            className={`nav-link ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            Products
          </div>
          <div
            className={`nav-link ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            Categories
          </div>

          {/* Admin Only Tabs */}
          {user.role === 'admin' && (
            <>
              <div
                className={`nav-link ${activeTab === 'proposals' ? 'active' : ''}`}
                onClick={() => setActiveTab('proposals')}
              >
                Proposals
              </div>
              <div
                className={`nav-link ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => setActiveTab('settings')}
              >
                Admin Settings
              </div>
            </>
          )}
          <div
            className={`nav-link ${activeTab === 'customers' ? 'active' : ''}`}
            onClick={() => setActiveTab('customers')}
          >
            Customers
          </div>
          <div
            className={`nav-link ${activeTab === 'product-pricing' ? 'active' : ''}`}
            onClick={() => setActiveTab('product-pricing')}
          >
            Product Pricing
          </div>
          <div // [NEW] Pricing Strategy
            className={`nav-link ${activeTab === 'strategy' ? 'active' : ''}`}
            onClick={() => setActiveTab('strategy')}
          >
            Pricing Strategy
          </div>
          <div
            className={`nav-link ${activeTab === 'alerts' ? 'active' : ''}`}
            onClick={() => setActiveTab('alerts')}
          >
            Margin Alerts
          </div>
          <div
            className={`nav-link ${activeTab === 'import' ? 'active' : ''}`}
            onClick={() => setActiveTab('import')}
          >
            Import Data
          </div>
          <div style={{ marginTop: 'auto', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
            <div style={{ padding: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
              Logged in as <br />
              <strong style={{ color: '#111827' }}>{user.username}</strong> <br />
              <span style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>{user.role} {user.region ? `(${user.region})` : ''}</span>
            </div>
            <button
              onClick={logout}
              className="nav-link"
              style={{ color: '#ef4444', marginTop: '0.5rem', width: '100%', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              Logout
            </button>
          </div>
        </nav>
      </aside>

      <main className="main-content">
        {activeTab === 'dashboard' && (
          <Dashboard analysis={analysis} customers={customers} categories={categories} />
        )}

        {activeTab === 'products' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Product List</h2>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Product Pricing</h2>
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

        {activeTab === 'proposals' && <ProposalsManager />}

        {activeTab === 'settings' && user.role === 'admin' && (
          <div style={{ padding: '2rem', maxWidth: '600px' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '2rem' }}>Admin Settings</h2>

            <div className="card" style={{ padding: '1.5rem', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Global Pricing Configuration</h3>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', marginBottom: '0.5rem' }}>
                  Global Markup Multiplier (Default)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="1.0"
                    value={globalSettings.global_multiplier || 1.5}
                    onChange={(e) => handleUpdateSetting('global_multiplier', parseFloat(e.target.value))}
                    style={{
                      padding: '0.5rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '4px',
                      width: '120px',
                      fontSize: '1rem'
                    }}
                  />
                  <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                    (Base List Price = Cost × {globalSettings.global_multiplier || 1.5})
                  </span>
                </div>
                <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#ef4444' }}>
                  ⚠ Changing this affects all products using the "Default" multiplier immediately.
                </p>
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
      </main>
    </div>
  )
}

export default App

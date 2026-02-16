import React, { useState } from 'react'
import * as XLSX from 'xlsx'
import { CUSTOMER_GROUPS } from '../utils/pricingEngine'
import './PricingTable.css'

const DataImporter = ({ onImportProducts, onImportCustomers, onImportSales, categories = [], fullState, onRestoreState, onClearData }) => {
    const [importType, setImportType] = useState('products')
    const [status, setStatus] = useState('')
    const [fileName, setFileName] = useState('')
    const [debugInfo, setDebugInfo] = useState(null)
    const [mappingDebug, setMappingDebug] = useState(null)

    // Validation State
    const [importReview, setImportReview] = useState(null) // Array of new customers to confirm
    const [pendingSalesData, setPendingSalesData] = useState(null) // Full dataset waiting for confirmation

    // Default group for 2-col imports (Customers)
    const [importGroup, setImportGroup] = useState(CUSTOMER_GROUPS.DEALER)
    // Default category for imports (Products) or Sales Data
    const [importCategory, setImportCategory] = useState('')

    const [confirmAction, setConfirmAction] = useState(null)

    const handleFileUpload = (e) => {
        const file = e.target.files[0]
        if (!file) return

        setFileName(file.name)
        const reader = new FileReader()

        reader.onload = (evt) => {
            try {
                // JSON RESTORE
                if (file.name.endsWith('.json')) {
                    const json = JSON.parse(evt.target.result)
                    if (json.products && json.customers && json.categories) {
                        onRestoreState(json)
                        setStatus(`Success! Restored system backup from ${file.name}`)
                    } else {
                        setStatus('Error: Invalid backup file format.')
                    }
                    return
                }

                // EXCEL IMPORT
                const data = new Uint8Array(evt.target.result)
                const wb = XLSX.read(data, { type: 'array' })
                const wsname = wb.SheetNames[0]
                const ws = wb.Sheets[wsname]
                const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }) // Get array of arrays

                processData(jsonData)
            } catch (err) {
                console.error(err)
                setStatus(`Error: ${err.message || 'Unknown parsing error'}`)
            }
        }

        if (file.name.endsWith('.json')) {
            reader.readAsText(file)
        } else {
            reader.readAsArrayBuffer(file)
        }
    }

    const handleExportBackup = () => {
        if (!fullState) return
        const dataStr = JSON.stringify(fullState, null, 2)
        const blob = new Blob([dataStr], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.download = `pricing_backup_${new Date().toISOString().split('T')[0]}.json`
        link.href = url
        link.click()
        setStatus('Backup exported successfully.')
    }

    const findColumnIndex = (headers, possibleNames) => {
        if (!headers) return -1
        const lowerHeaders = headers.map(h => String(h).toLowerCase().trim())

        // Strategy 1: Exact Match (Safe)
        for (const name of possibleNames) {
            const idx = lowerHeaders.indexOf(name.toLowerCase())
            if (idx !== -1) return idx
        }

        // Strategy 2: Ends With (e.g. "Product Cost" matches "Cost")
        for (const name of possibleNames) {
            const idx = lowerHeaders.findIndex(h => h.endsWith(name.toLowerCase()))
            if (idx !== -1) return idx
        }

        // Strategy 3: Includes (Fuzzy - e.g. "Unit Cost ($)" matches "Cost")
        // Use with caution, but necessary for messy files
        for (const name of possibleNames) {
            const idx = lowerHeaders.findIndex(h => h.includes(name.toLowerCase()))
            if (idx !== -1) return idx
        }

        return -1
    }

    const cleanCurrency = (val) => {
        if (!val) return 0
        if (typeof val === 'number') return val
        const str = String(val).replace(/[$,]/g, '').trim()
        return parseFloat(str) || 0
    }

    const processData = (rows) => {
        let count = 0
        if (!rows || rows.length < 2) {
            setStatus('File appears empty or missing headers.')
            return
        }

        let headers = rows[0]
        let startRow = 1

        // HEADLESS CHECK (For Customers)
        if (importType === 'customers' && rows.length > 0) {
            // Check if Row 0, Col 1 looks like Money (Spend) OR Territory
            const val1 = rows[0][1]
            const isMoney = val1 && !isNaN(parseFloat(String(val1).replace(/[$,]/g, '')))
            const isTerritory = /^(SK|AB|BC|MB|ON|QC|NB|NS|PE|NL|YT|NT|NU|OTHER|SASKATCHEWAN|ALBERTA|BRITISH COLUMBIA)$/i.test(String(val1 || '').trim())

            // Heuristic: If Col 1 is money/territory AND Col 0 is not a known header name
            const col0 = String(rows[0][0] || '').toLowerCase()
            const isHeaderName = ['name', 'customer', 'customer name'].includes(col0)

            if ((isMoney || isTerritory) && !isHeaderName) {
                // Detected Headless!
                headers = [] // No headers
                startRow = 0 // Start from the very first row
            }
        }

        setDebugInfo({ headers, firstRow: rows[startRow] || [] })

        // --- SMART DETECT MISMATCH ---
        const headerStr = headers.map(h => String(h).toLowerCase()).join(' ')

        // Scenario 1: User is on 'products' but file looks like Sales (Customer ID + Revenue)
        if (importType === 'products') {
            const hasCustomer = headerStr.includes('customer name') || headerStr.includes('customer id')
            const hasRevenue = headerStr.includes('revenue') || headerStr.includes('amount')
            const hasVendor = headerStr.includes('vendor') || headerStr.includes('supplier')

            if (hasCustomer && !hasVendor) {
                setStatus('⚠️ It looks like you uploaded a Sales/Customer file but "Import Type" is set to "Products". Please switch to "Sales Data" or "Customers".')
                return
            }
        }

        // Scenario 2: User is on 'products' but file looks like Sales (2 columns: Name, Spend)
        if (importType === 'products' && headers.length <= 3) {
            const hasSpend = headerStr.includes('spend') || headerStr.includes('sales')
            if (hasSpend) {
                setStatus('⚠️ It looks like you uploaded a simple Sales file but "Import Type" is set to "Products". Please switch to "Customers" or "Sales Data".')
                return
            }
        }

        if (importType === 'sales') {
            // SALES DATA IMPORT

            // --- SMART HEADER SCAN ---
            // Scan first 10 rows to find the real header row (skips Report Titles, empty lines)
            let headerRowIndex = 0
            let detectedHeaders = rows[0]
            let startRow = 1

            // Heuristic: Look for a row that has BOTH "Customer" (or synonym) AND "Amount" (or synonym)
            const customerKeywords = ['customer', 'name', 'client', 'bill to']
            const amountKeywords = ['amount', 'sales', 'revenue', 'spend', 'total', 'price', 'value']

            for (let r = 0; r < Math.min(rows.length, 10); r++) {
                const rowStr = rows[r].map(c => String(c).toLowerCase()).join(' ')
                const hasCustomer = customerKeywords.some(k => rowStr.includes(k))
                const hasAmount = amountKeywords.some(k => rowStr.includes(k))

                if (hasCustomer && hasAmount) {
                    headerRowIndex = r
                    detectedHeaders = rows[r]
                    startRow = r + 1 // Data starts after this
                    break
                }
            }

            // Use the detected headers (or fallback to row 0)
            headers = detectedHeaders

            const nameIdx = findColumnIndex(headers, ['Customer Name', 'Name', 'Customer', 'Bill To', 'Client', 'Cust Name', 'Bill'])
            const idIdx = findColumnIndex(headers, ['Customer ID', 'ID', 'Cust #', 'Account #', 'Account'])
            const amountIdx = findColumnIndex(headers, ['Amount', 'Sales', 'Total Sales', 'Revenue', 'Spend', 'Total', 'Ext Price', 'Extension', 'Value', 'Net Sales'])
            // [NEW] COGS Support - Added 'Material'
            const cogsIdx = findColumnIndex(headers, ['COGS', 'Cost of Goods Sold', 'Cost', 'Unit Cost', 'Total Cost', 'COGS Amount', 'Material', 'Material Cost'])
            // [NEW] Category Detection
            const catIdx = findColumnIndex(headers, ['Category', 'Product Category', 'Type', 'Item Class'])

            // VALIDATION: Ensure we have a Category source
            if (catIdx === -1 && !importCategory) {
                setStatus('Error: Could not find a "Category" column in your file. Please select a specific Category from the dropdown (e.g., Fasteners) to force-assign one.')
                return
            }

            const debugNameStr = nameIdx !== -1 ? `${headers[nameIdx]} (Col ${nameIdx + 1})` : 'NOT FOUND (Will try Col 2 if 3 cols exist)'
            const debugAmountStr = amountIdx !== -1 ? `${headers[amountIdx]} (Col ${amountIdx + 1})` : 'NOT FOUND (Will try Col 3 if 3 cols exist)'
            const debugCogsStr = cogsIdx !== -1 ? `${headers[cogsIdx]} (Col ${cogsIdx + 1})` : 'NOT FOUND (Default set to 0)'
            const debugCatStr = catIdx !== -1 ? `${headers[catIdx]} (Col ${catIdx + 1})` : 'NOT FOUND (Will use Dropdown Selection)'

            setMappingDebug({
                HeaderRow: { index: headerRowIndex, foundHeader: `Row ${headerRowIndex + 1}` },
                CustomerName: { index: nameIdx, foundHeader: debugNameStr },
                Amount: { index: amountIdx, foundHeader: debugAmountStr },
                Category: { index: catIdx, foundHeader: debugCatStr },
                COGS: { index: cogsIdx, foundHeader: debugCogsStr }, // Debugging help
            })

            const salesData = []
            let totalCogsImported = 0 // Track if we found any COGS
            let multiCategoriesFound = new Set()

            for (let i = startRow; i < rows.length; i++) {
                const row = rows[i]
                if (!row || row.length === 0) continue

                let name, amount, customerId, cogs = 0, rowCategory = ''

                // HEADER-BASED LOOKUP
                if (nameIdx !== -1 && amountIdx !== -1) {
                    name = row[nameIdx]
                    customerId = idIdx !== -1 ? row[idIdx] : ''
                    amount = cleanCurrency(row[amountIdx])
                    if (cogsIdx !== -1) cogs = cleanCurrency(row[cogsIdx])
                    if (catIdx !== -1) rowCategory = row[catIdx]
                }
                // FALLBACK: ID (0), Name (1), Revenue (2), COGS? (3) OR Name (0), Revenue (1), COGS? (2)
                else {
                    // Try 3-Col first (ID, Name, Amount)
                    if (rows[0].length >= 3) {
                        customerId = row[0]
                        name = row[1]
                        amount = cleanCurrency(row[2])
                        // If there happens to be a 4th col, maybe it's COGS? Conservative approach: only if explicit.
                        // But if headers completely failed, check if row has 4 cols
                        if (row.length >= 4) cogs = cleanCurrency(row[3])
                    }
                    // Try 2-Col (Name, Amount)
                    else {
                        name = row[0]
                        amount = cleanCurrency(row[1])
                        if (row.length >= 3) cogs = cleanCurrency(row[2])
                    }
                }

                // Determine Final Category
                // Priority: 1. Row Data, 2. Dropdown Selection, 3. 'Uncategorized'
                const finalCategory = (rowCategory && String(rowCategory).trim())
                    ? String(rowCategory).trim()
                    : (importCategory || 'Uncategorized')

                if ((name || customerId) && amount > 0) {
                    salesData.push({
                        id: `tx_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`, // [NEW] Unique ID
                        name: name || `Customer ${customerId}`, // Fallback name if only ID
                        customerId: String(customerId || '').trim(),
                        amount,
                        cogs: cogs || 0,
                        category: finalCategory
                    })
                    totalCogsImported += (cogs || 0)
                    multiCategoriesFound.add(finalCategory)
                    count++
                }
            }

            if (salesData.length === 0) {
                setStatus('Error: No valid sales records found. Check headers (Customer, Amount) or try a simpler format (Name, Amount).')
                return
            }

            onImportSales(salesData)

            // Enhanced Status Message
            const catCount = multiCategoriesFound.size
            if (totalCogsImported > 0) {
                setStatus(`Success! Imported ${count} records across ${catCount} categories (${Array.from(multiCategoriesFound).slice(0, 3).join(', ')}${catCount > 3 ? '...' : ''}). Found Total COGS: $${totalCogsImported.toLocaleString()}.`)
            } else {
                setStatus(`Success! Imported ${count} records across ${catCount} categories. (Warning: No COGS data detected. Check if column is named "COGS", "Cost", or "Material")`)
            }

        }
        else if (importType === 'products') {
            // MAPPING STRATEGY:
            // Revised to match User's Simplified Structure:
            // 1. Item Code
            // 2. Description (Name)
            // 3. Category
            // 4. Sub-Category (New)
            // 5. Sell Unit
            // 6. Bag Units (New - for Calc)
            // 7. Unit Cost (New - for Calc)
            // 8. Unit Price (New - for Calc)

            const itemCodeIdx = findColumnIndex(headers, ['Item Code', 'ItemCode', 'SKU', 'Part Number', 'Item #', 'Code'])
            const nameIdx = findColumnIndex(headers, ['Description', 'Item Description', 'Product Name', 'Name'])
            const catIdx = findColumnIndex(headers, ['Category', 'Product Category'])
            const subCatIdx = findColumnIndex(headers, ['Sub-Category', 'Sub Category', 'SubCategory', 'Type'])
            const sellUnitIdx = findColumnIndex(headers, ['Sell Unit', 'Unit', 'UOM'])
            const bagUnitsIdx = findColumnIndex(headers, ['Bag Units', 'Units', 'Qty', 'Quantity', 'Units Per Bag'])
            const unitCostIdx = findColumnIndex(headers, ['Unit Cost', 'Cost Per Unit', 'Cost'])
            const unitPriceIdx = findColumnIndex(headers, ['Unit Price', 'Price Per Unit', 'Price'])

            // DEBUG MAPPING
            const missingCount = [itemCodeIdx, nameIdx, unitCostIdx, unitPriceIdx].filter(i => i === -1).length
            if (missingCount >= 3) { // If critical cols missing
                setStatus('⚠️ Error: Could not match key Product columns (Description, Item Code, Unit Cost). Did you mean to select "Sales Data" or "Customers"?')
                setMappingDebug({
                    Message: { index: -1, foundHeader: 'Missing Key Headers' },
                    Missing: { index: -1, foundHeader: 'Description, Unit Cost, Unit Price, or Bag Units' }
                })
                return
            }

            setMappingDebug({
                ItemCode: { index: itemCodeIdx, foundHeader: itemCodeIdx !== -1 ? headers[itemCodeIdx] : 'NOT FOUND' },
                Description: { index: nameIdx, foundHeader: nameIdx !== -1 ? headers[nameIdx] : 'NOT FOUND' },
                SubCategory: { index: subCatIdx, foundHeader: subCatIdx !== -1 ? headers[subCatIdx] : 'NOT FOUND' },
                UnitCost: { index: unitCostIdx, foundHeader: unitCostIdx !== -1 ? headers[unitCostIdx] : 'NOT FOUND' },
                UnitPrice: { index: unitPriceIdx, foundHeader: unitPriceIdx !== -1 ? headers[unitPriceIdx] : 'NOT FOUND' }
            })

            const newProducts = []
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i]
                if (!row || row.length === 0) continue

                let product = { id: Date.now() + i + '' }

                // Full Mapping
                product.itemCode = itemCodeIdx !== -1 ? row[itemCodeIdx] : ''
                product.name = nameIdx !== -1 ? row[nameIdx] : (row[0] || 'Unknown Product')
                product.category = catIdx !== -1 ? row[catIdx] : 'Uncategorized'
                product.subCategory = subCatIdx !== -1 ? row[subCatIdx] : '' // [NEW]
                product.sellUnit = sellUnitIdx !== -1 ? row[sellUnitIdx] : 'Each'

                // CALCULATION LOGIC
                const units = bagUnitsIdx !== -1 ? (parseFloat(row[bagUnitsIdx]) || 1) : 1
                const uCost = unitCostIdx !== -1 ? cleanCurrency(row[unitCostIdx]) : 0
                const uPrice = unitPriceIdx !== -1 ? cleanCurrency(row[unitPriceIdx]) : 0

                product.bagUnits = units
                product.unitCost = uCost
                product.unitPrice = uPrice

                // Derived
                product.bagCost = uCost * units
                product.cost = product.bagCost // Standardizing 'cost' as the bag cost
                product.price = uPrice * units

                // Legacy/Compat
                product.vendor = '' // Removed
                product.itemClass = '' // Deprecated by SubCat
                product.importedMargin = 0 // Calculated dynamically now

                // Override with Force-Selected Category if present
                if (importCategory) {
                    product.category = importCategory
                }

                if (product.name || product.itemCode) {
                    newProducts.push(product)
                    count++
                }
            }
            onImportProducts(newProducts)

        } else {
            // CUSTOMERS MAPPING (unchanged)
            const nameIdx = findColumnIndex(headers, ['Customer Name', 'Name', 'Customer'])
            const groupIdx = findColumnIndex(headers, ['Group', 'Customer Group', 'Type', 'Segment'])
            const spendIdx = findColumnIndex(headers, ['Annual Spend', 'Spend', 'Total Sales', 'Revenue', 'Sales', 'Amount', 'Total Spend'])
            const territoryIdx = findColumnIndex(headers, ['Territory', 'Province', 'State', 'Region'])

            const useIndices = (nameIdx === -1 && groupIdx === -1 && spendIdx === -1 && territoryIdx === -1)

            // DEBUG MAPPING
            if (useIndices) {
                setMappingDebug({
                    Status: { index: -1, foundHeader: 'Detected No Headers. Using 2-column fallback (Name, Spend).', mode: 'fallback' }
                })
            } else {
                setMappingDebug({
                    CustomerName: { index: nameIdx, foundHeader: nameIdx !== -1 ? headers[nameIdx] : 'NOT FOUND' },
                    Group: { index: groupIdx, foundHeader: groupIdx !== -1 ? headers[groupIdx] : 'NOT FOUND' },
                    Spend: { index: spendIdx, foundHeader: spendIdx !== -1 ? headers[spendIdx] : 'NOT FOUND' },
                    Territory: { index: territoryIdx, foundHeader: territoryIdx !== -1 ? headers[territoryIdx] : 'NOT FOUND' },
                })
            }

            const newCustomers = []
            for (let i = startRow; i < rows.length; i++) {
                const row = rows[i]
                if (!row || row.length === 0) continue

                let name, groupRaw, spend, territory

                if (useIndices) {
                    // Smart detection: Check if Col 2 (index 1) is a Territory
                    // Regex for 2-letter codes or full names
                    const val2 = String(row[1] || '').trim()
                    const isTerritory = /^(SK|AB|BC|MB|ON|QC|NB|NS|PE|NL|YT|NT|NU|OTHER|SASKATCHEWAN|ALBERTA|BRITISH COLUMBIA)$/i.test(val2)

                    // Smart detection for 2-column format (Name, Spend)
                    // If row[1] looks like a number and row[2] is empty, assume col 2 is spend
                    const col1IsMoney = !isNaN(parseFloat(String(row[1]).replace(/[$,]/g, '')))
                    const col2IsEmpty = !row[2]

                    if (isTerritory) {
                        // Format: Name, Territory, Spend
                        name = row[0]
                        territory = row[1] // Use original casing or normalized
                        spend = cleanCurrency(row[2])
                        groupRaw = '' // Fallback to importGroup (dropdown)
                    } else if (col1IsMoney && col2IsEmpty) {
                        name = row[0]
                        groupRaw = '' // Will fallback to selected Default Group
                        spend = cleanCurrency(row[1])
                        territory = 'Other'
                    } else {
                        // Standard 3-col format (Name, Group, Spend)
                        name = row[0]
                        groupRaw = row[1] || ''
                        spend = cleanCurrency(row[2])
                        territory = 'Other'
                    }
                } else {
                    name = nameIdx !== -1 ? row[nameIdx] : (row[0] || 'Unknown Customer')
                    groupRaw = groupIdx !== -1 ? row[groupIdx] : ''
                    spend = spendIdx !== -1 ? cleanCurrency(row[spendIdx]) : 0

                    const tRaw = territoryIdx !== -1 ? row[territoryIdx] : 'Other'
                    // Normalize on import for consistency
                    if (/^(SK|SASK|SASKATCHEWAN)$/i.test(tRaw)) territory = 'SK'
                    else if (/^(AB|ALTA|ALBERTA)$/i.test(tRaw)) territory = 'AB'
                    else if (/^(BC|BRITISH COLUMBIA)$/i.test(tRaw)) territory = 'BC'
                    else territory = 'Other'
                }

                let group = importGroup // Use selected default
                if (groupRaw && String(groupRaw).toLowerCase().includes('commercial')) {
                    group = CUSTOMER_GROUPS.COMMERCIAL
                } else if (groupRaw && String(groupRaw).toLowerCase().includes('dealer')) {
                    group = CUSTOMER_GROUPS.DEALER
                }

                if (name) {
                    newCustomers.push({ id: Date.now() + i + '', name, group, annualSpend: spend, territory: territory || 'Other' })
                    count++
                }
            }
            onImportCustomers(newCustomers)
        }
        setStatus(`Success! Imported ${count} ${importType} from ${fileName}.`)
    }

    return (
        <div className="pricing-table-container" style={{ padding: '2rem' }}>
            <h3>Data Import (Excel)</h3>
            <div style={{ marginBottom: '1rem' }}>
                <label style={{ marginRight: '1rem', fontWeight: 'bold' }}>Import Type:</label>
                <select
                    className="input-field"
                    value={importType}
                    onChange={e => { setImportType(e.target.value); setStatus(''); setFileName(''); setDebugInfo(null); setMappingDebug(null); }}
                    style={{ width: 'auto' }}
                >
                    <option value="products">Products</option>
                    <option value="customers">Customers</option>
                    <option value="sales">Sales Data (Per Category)</option>
                </select>

                {(importType === 'products' || importType === 'sales') && (
                    <select
                        className="input-field"
                        value={importCategory}
                        onChange={e => setImportCategory(e.target.value)}
                        style={{ width: 'auto', marginLeft: '0.5rem', borderColor: '#7c3aed', color: '#7c3aed', fontWeight: 500 }}
                    >
                        <option value="">{importType === 'sales' ? '(Auto-Detect / Optional)' : '(Auto-Detect Category)'}</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.name}>Force Import to: {cat.name}</option>
                        ))}
                    </select>
                )}

                {importType === 'customers' && (
                    <select
                        className="input-field"
                        value={importGroup}
                        onChange={e => setImportGroup(e.target.value)}
                        style={{ width: 'auto', marginLeft: '0.5rem', borderColor: '#2563eb', color: '#2563eb', fontWeight: 500 }}
                    >
                        {Object.values(CUSTOMER_GROUPS).map(g => (
                            <option key={g} value={g}>Import as {g}</option>
                        ))}
                    </select>
                )}

                <button
                    onClick={handleExportBackup}
                    style={{
                        marginLeft: 'auto',
                        backgroundColor: '#4b5563',
                        color: 'white',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    ⬇ Export Backup (JSON)
                </button>
            </div>

            <div style={{ marginBottom: '2rem', fontSize: '0.9rem', color: '#555', backgroundColor: '#f9fafb', padding: '1rem', borderRadius: '8px' }}>
                <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Supported Headers:</p>
                {importType === 'products' ? (
                    <>
                        <p style={{ marginBottom: '0.5rem' }}>Requries the following columns:</p>
                        <ul style={{ paddingLeft: '1.5rem', marginTop: 0, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                            <li><strong>Item Code</strong></li>
                            <li><strong>Description</strong> (Name)</li>
                            <li><strong>Category</strong></li>
                            <li><strong>Sub-Category</strong> (Sort Group)</li>
                            <li><strong>Sell Unit</strong> (e.g. Bag100)</li>
                            <li><strong>Bag Units</strong> (Qty per Bag)</li>
                            <li><strong>Unit Cost</strong> (Cost per screw)</li>
                            <li><strong>Unit Price</strong> (Price per screw)</li>
                        </ul>
                    </>
                ) : importType === 'sales' ? (
                    <ul style={{ paddingLeft: '1.5rem', marginTop: 0 }}>
                        <li><strong>Customer ID</strong> (Optional, Col 1)</li>
                        <li><strong>Customer Name</strong> (Col 2)</li>
                        <li><strong>Revenue</strong> (Col 3)</li>
                        <li><strong>COGS</strong> (Optional, Col 4)</li>
                        <li><strong>Category</strong> (Optional)</li>
                    </ul>
                ) : (
                    <ul style={{ paddingLeft: '1.5rem', marginTop: 0 }}>
                        <li><strong>Name</strong> / Customer Name</li>
                        <li><strong>Group</strong> (Dealer / Commercial)</li>
                        <li><strong>Annual Spend</strong> / Spend / Revenue</li>
                    </ul>
                )}
            </div>

            <div style={{ border: '2px dashed #d1d5db', borderRadius: '8px', padding: '2rem', textAlign: 'center' }}>
                <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleFileUpload}
                    style={{ marginBottom: '1rem' }}
                />
                <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Supports .xlsx, .xls, .csv, and .json (Backup)</p>
            </div>


            {/* NEW CUSTOMER VALIDATION MODAL */}
            {
                importReview && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100
                    }}>
                        <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '8px', maxWidth: '500px', width: '90%', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                            <h3 style={{ marginTop: 0, color: '#b91c1c' }}>⚠️ New Customers Detected</h3>
                            <p>
                                Your import file contains <strong>{importReview.length}</strong> customers that don't match any existing records in the system.
                            </p>
                            <div style={{ maxHeight: '150px', overflowY: 'auto', backgroundColor: '#f9fafb', padding: '0.5rem', marginBottom: '1.5rem', border: '1px solid #e5e7eb', fontSize: '0.9rem' }}>
                                {importReview.slice(0, 5).map((c, i) => (
                                    <div key={i} style={{ padding: '2px 0' }}>• {c.name || 'Unknown'} {c.customerId ? `(ID: ${c.customerId})` : ''}</div>
                                ))}
                                {importReview.length > 5 && <div style={{ color: '#6b7280', fontStyle: 'italic', marginTop: '4px' }}>...and {importReview.length - 5} more</div>}
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => {
                                        // Skip New
                                        const allowedNames = new Set(fullState.customers.map(c => c.name.toLowerCase().trim()))
                                        const filtered = pendingSalesData.filter(d => allowedNames.has(d.name.toLowerCase().trim()))
                                        onImportSales(filtered)
                                        setImportReview(null)
                                        setPendingSalesData(null)
                                        setStatus(`Imported ${filtered.length} sales records (Skipped ${importReview.length} new customers).`)
                                    }}
                                    style={{
                                        padding: '0.75rem 1rem',
                                        border: '1px solid #d1d5db',
                                        backgroundColor: 'white',
                                        color: '#374151',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: 600
                                    }}
                                >
                                    No, Skip New Customers
                                </button>
                                <button
                                    onClick={() => {
                                        // Add All
                                        onImportSales(pendingSalesData)
                                        setImportReview(null)
                                        setPendingSalesData(null)
                                        setStatus(`Success! Imported ${pendingSalesData.length} sales records and created ${importReview.length} new customers.`)
                                    }}
                                    style={{
                                        padding: '0.75rem 1rem',
                                        border: 'none',
                                        backgroundColor: '#2563eb',
                                        color: 'white',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: 600
                                    }}
                                >
                                    Yes, Add & Import All
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {status && <div style={{ marginTop: '1rem', color: status.includes('Success') || status.includes('successfully') ? 'green' : 'red', fontWeight: '500' }}>{status}</div>}

            {/* Data Cleanup Section */}
            <div style={{ marginTop: '3rem', paddingTop: '2rem', borderTop: '1px solid #e5e7eb' }}>
                <h4 style={{ color: '#b91c1c', marginTop: 0 }}>Data Cleanup (Danger Zone)</h4>

                {confirmAction ? (
                    <div style={{ padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                            Are you sure you want to delete ALL {confirmAction}? This cannot be undone.
                        </span>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => {
                                    onClearData(confirmAction)
                                    setStatus(`All ${confirmAction} cleared.`)
                                    setConfirmAction(null)
                                }}
                                style={{ backgroundColor: '#dc2626', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                            >
                                Yes, Delete All
                            </button>
                            <button
                                onClick={() => setConfirmAction(null)}
                                style={{ backgroundColor: 'white', color: '#4b5563', border: '1px solid #d1d5db', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <button
                            onClick={() => setConfirmAction('products')}
                            style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #ef4444', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                        >
                            🗑 Clear All Products
                        </button>
                        <button
                            onClick={() => setConfirmAction('customers')}
                            style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #ef4444', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                        >
                            🗑 Clear All Customers
                        </button>
                        <button
                            onClick={() => setConfirmAction('categories')}
                            style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #ef4444', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                        >
                            🗑 Clear All Categories
                        </button>
                        <button
                            onClick={() => setConfirmAction('sales')}
                            style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #ef4444', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                        >
                            🗑 Clear All Sales Data
                        </button>
                    </div>
                )}
            </div>


            {
                debugInfo && (
                    <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f3f4f6', borderRadius: '8px', border: '1px solid #e5e7eb', fontSize: '0.85rem' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', color: '#374151' }}>Debug Info</h4>
                        <div style={{ marginBottom: '0.5rem' }}>
                            <strong>Detected Headers:</strong>
                            <pre style={{ margin: '0.25rem 0', whiteSpace: 'pre-wrap', color: '#4b5563' }}>{JSON.stringify(debugInfo.headers, null, 2)}</pre>
                        </div>
                        <div>
                            <strong>First Data Row:</strong>
                            <pre style={{ margin: '0.25rem 0', whiteSpace: 'pre-wrap', color: '#4b5563' }}>{JSON.stringify(debugInfo.firstRow, null, 2)}</pre>
                        </div>
                    </div>
                )
            }

            {
                mappingDebug && (
                    <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#eef2ff', borderRadius: '8px', border: '1px solid #c7d2fe', fontSize: '0.85rem' }}>
                        <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e3a8a' }}>Mapping Status</h4>
                        <ul style={{ margin: 0, paddingLeft: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                            {Object.entries(mappingDebug).map(([key, val]) => (
                                <li key={key} style={{ color: val.mode === 'fallback' ? '#059669' : (val.index === -1 ? 'red' : 'green') }}>
                                    <strong>{key}:</strong> {val.foundHeader} {val.index !== -1 && `(Index: ${val.index})`}
                                </li>
                            ))}
                        </ul>
                    </div>
                )
            }
        </div >
    )
}

export default DataImporter

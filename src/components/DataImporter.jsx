import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { CUSTOMER_GROUPS } from '../utils/pricingEngine';

const DataImporter = ({ onImportProducts, onImportCustomers, onImportSales, categories = [], fullState, onRestoreState, onClearData }) => {
    const [importType, setImportType] = useState('products');
    const [status, setStatus] = useState('');
    const [fileName, setFileName] = useState('');
    const [debugInfo, setDebugInfo] = useState(null);
    const [mappingDebug, setMappingDebug] = useState(null);

    // Validation State
    const [importReview, setImportReview] = useState(null); // Array of new customers to confirm
    const [pendingSalesData, setPendingSalesData] = useState(null); // Full dataset waiting for confirmation

    // Default group for 2-col imports (Customers)
    const [importGroup, setImportGroup] = useState(CUSTOMER_GROUPS.DEALER);
    // Default category for imports (Products) or Sales Data
    const [importCategory, setImportCategory] = useState('');

    const [confirmAction, setConfirmAction] = useState(null);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setFileName(file.name);
        const reader = new FileReader();

        reader.onload = (evt) => {
            try {
                // JSON RESTORE
                if (file.name.endsWith('.json')) {
                    const json = JSON.parse(evt.target.result);
                    if (json.products && json.customers && json.categories) {
                        onRestoreState(json);
                        setStatus(`Success! Restored system backup from ${file.name}`);
                    } else {
                        setStatus('Error: Invalid backup file format.');
                    }
                    return;
                }

                // EXCEL IMPORT
                const data = new Uint8Array(evt.target.result);
                const wb = XLSX.read(data, { type: 'array' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 }); // Get array of arrays

                processData(jsonData);
            } catch (err) {
                console.error(err);
                setStatus(`Error: ${err.message || 'Unknown parsing error'}`);
            }
        };

        if (file.name.endsWith('.json')) {
            reader.readAsText(file);
        } else {
            reader.readAsArrayBuffer(file);
        }
    };

    const handleExportBackup = () => {
        if (!fullState) return;
        const dataStr = JSON.stringify(fullState, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `pricing_backup_${new Date().toISOString().split('T')[0]}.json`;
        link.href = url;
        link.click();
        setStatus('Backup exported successfully.');
    };

    const findColumnIndex = (headers, possibleNames) => {
        if (!headers) return -1;
        const lowerHeaders = headers.map(h => String(h).toLowerCase().trim());

        // Strategy 1: Exact Match (Safe)
        for (const name of possibleNames) {
            const idx = lowerHeaders.indexOf(name.toLowerCase());
            if (idx !== -1) return idx;
        }

        // Strategy 2: Ends With (e.g. "Product Cost" matches "Cost")
        for (const name of possibleNames) {
            const idx = lowerHeaders.findIndex(h => h.endsWith(name.toLowerCase()));
            if (idx !== -1) return idx;
        }

        // Strategy 3: Includes (Fuzzy - e.g. "Unit Cost ($)" matches "Cost")
        for (const name of possibleNames) {
            const idx = lowerHeaders.findIndex(h => h.includes(name.toLowerCase()));
            if (idx !== -1) return idx;
        }

        return -1;
    };

    const cleanCurrency = (val) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        const str = String(val).replace(/[$,]/g, '').trim();
        return parseFloat(str) || 0;
    };

    const processData = (rows) => {
        let count = 0;
        if (!rows || rows.length < 2) {
            setStatus('File appears empty or missing headers.');
            return;
        }

        let headers = rows[0];
        let startRow = 1;

        // HEADLESS CHECK (For Customers)
        if (importType === 'customers' && rows.length > 0) {
            const val1 = rows[0][1];
            const isMoney = val1 && !isNaN(parseFloat(String(val1).replace(/[$,]/g, '')));
            const isTerritory = /^(SK|AB|BC|MB|ON|QC|NB|NS|PE|NL|YT|NT|NU|OTHER|SASKATCHEWAN|ALBERTA|BRITISH COLUMBIA)$/i.test(String(val1 || '').trim());

            const col0 = String(rows[0][0] || '').toLowerCase();
            const isHeaderName = ['name', 'customer', 'customer name'].includes(col0);

            if ((isMoney || isTerritory) && !isHeaderName) {
                headers = []; // No headers
                startRow = 0; // Start from the very first row
            }
        }

        setDebugInfo({ headers, firstRow: rows[startRow] || [] });

        // --- SMART DETECT MISMATCH ---
        const headerStr = headers.map(h => String(h).toLowerCase()).join(' ');

        if (importType === 'products') {
            const hasCustomer = headerStr.includes('customer name') || headerStr.includes('customer id');
            const hasRevenue = headerStr.includes('revenue') || headerStr.includes('amount');
            const hasVendor = headerStr.includes('vendor') || headerStr.includes('supplier');

            if (hasCustomer && !hasVendor) {
                setStatus('⚠️ It looks like you uploaded a Sales/Customer file but "Import Type" is set to "Products". Please switch to "Sales Data" or "Customers".');
                return;
            }
        }

        if (importType === 'products' && headers.length <= 3) {
            const hasSpend = headerStr.includes('spend') || headerStr.includes('sales');
            if (hasSpend) {
                setStatus('⚠️ It looks like you uploaded a simple Sales file but "Import Type" is set to "Products". Please switch to "Customers" or "Sales Data".');
                return;
            }
        }

        if (importType === 'sales') {
            // SALES DATA IMPORT
            let headerRowIndex = 0;
            let detectedHeaders = rows[0];
            let startRow = 1;

            const customerKeywords = ['customer', 'name', 'client', 'bill to'];
            const amountKeywords = ['amount', 'sales', 'revenue', 'spend', 'total', 'price', 'value'];

            for (let r = 0; r < Math.min(rows.length, 10); r++) {
                const rowStr = rows[r].map(c => String(c).toLowerCase()).join(' ');
                const hasCustomer = customerKeywords.some(k => rowStr.includes(k));
                const hasAmount = amountKeywords.some(k => rowStr.includes(k));

                if (hasCustomer && hasAmount) {
                    headerRowIndex = r;
                    detectedHeaders = rows[r];
                    startRow = r + 1;
                    break;
                }
            }

            headers = detectedHeaders;

            const nameIdx = findColumnIndex(headers, ['Customer Name', 'Name', 'Customer', 'Bill To', 'Client', 'Cust Name', 'Bill']);
            const idIdx = findColumnIndex(headers, ['Customer ID', 'ID', 'Cust #', 'Account #', 'Account']);
            const amountIdx = findColumnIndex(headers, ['Amount', 'Sales', 'Total Sales', 'Revenue', 'Spend', 'Total', 'Ext Price', 'Extension', 'Value', 'Net Sales']);
            const cogsIdx = findColumnIndex(headers, ['COGS', 'Cost of Goods Sold', 'Cost', 'Unit Cost', 'Total Cost', 'COGS Amount', 'Material', 'Material Cost']);
            const catIdx = findColumnIndex(headers, ['Category', 'Product Category', 'Type', 'Item Class']);

            if (catIdx === -1 && !importCategory) {
                setStatus('Error: Could not find a "Category" column in your file. Please select a specific Category from the dropdown (e.g., Fasteners) to force-assign one.');
                return;
            }

            const debugNameStr = nameIdx !== -1 ? `${headers[nameIdx]} (Col ${nameIdx + 1})` : 'NOT FOUND (Will try Col 2 if 3 cols exist)';
            const debugAmountStr = amountIdx !== -1 ? `${headers[amountIdx]} (Col ${amountIdx + 1})` : 'NOT FOUND (Will try Col 3 if 3 cols exist)';
            const debugCogsStr = cogsIdx !== -1 ? `${headers[cogsIdx]} (Col ${cogsIdx + 1})` : 'NOT FOUND (Default set to 0)';
            const debugCatStr = catIdx !== -1 ? `${headers[catIdx]} (Col ${catIdx + 1})` : 'NOT FOUND (Will use Dropdown Selection)';

            setMappingDebug({
                HeaderRow: { index: headerRowIndex, foundHeader: `Row ${headerRowIndex + 1}` },
                CustomerName: { index: nameIdx, foundHeader: debugNameStr },
                Amount: { index: amountIdx, foundHeader: debugAmountStr },
                Category: { index: catIdx, foundHeader: debugCatStr },
                COGS: { index: cogsIdx, foundHeader: debugCogsStr },
            });

            const salesData = [];
            let totalCogsImported = 0;
            let multiCategoriesFound = new Set();

            for (let i = startRow; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;

                let name, amount, customerId, cogs = 0, rowCategory = '';

                if (nameIdx !== -1 && amountIdx !== -1) {
                    name = row[nameIdx];
                    customerId = idIdx !== -1 ? row[idIdx] : '';
                    amount = cleanCurrency(row[amountIdx]);
                    if (cogsIdx !== -1) cogs = cleanCurrency(row[cogsIdx]);
                    if (catIdx !== -1) rowCategory = row[catIdx];
                } else {
                    if (rows[0].length >= 3) {
                        customerId = row[0];
                        name = row[1];
                        amount = cleanCurrency(row[2]);
                        if (row.length >= 4) cogs = cleanCurrency(row[3]);
                    } else {
                        name = row[0];
                        amount = cleanCurrency(row[1]);
                        if (row.length >= 3) cogs = cleanCurrency(row[2]);
                    }
                }

                const finalCategory = (rowCategory && String(rowCategory).trim())
                    ? String(rowCategory).trim()
                    : (importCategory || 'Uncategorized');

                if ((name || customerId) && amount > 0) {
                    salesData.push({
                        id: `tx_${Date.now()}_${i}_${Math.random().toString(36).substr(2, 5)}`,
                        name: name || `Customer ${customerId}`,
                        customerId: String(customerId || '').trim(),
                        amount,
                        cogs: cogs || 0,
                        category: finalCategory
                    });
                    totalCogsImported += (cogs || 0);
                    multiCategoriesFound.add(finalCategory);
                    count++;
                }
            }

            if (salesData.length === 0) {
                setStatus('Error: No valid sales records found. Check headers (Customer, Amount) or try a simpler format (Name, Amount).');
                return;
            }

            onImportSales(salesData);

            const catCount = multiCategoriesFound.size;
            if (totalCogsImported > 0) {
                setStatus(`Success! Imported ${count} records across ${catCount} categories (${Array.from(multiCategoriesFound).slice(0, 3).join(', ')}${catCount > 3 ? '...' : ''}). Found Total COGS: $${totalCogsImported.toLocaleString()}.`);
            } else {
                setStatus(`Success! Imported ${count} records across ${catCount} categories. (Warning: No COGS data detected. Check if column is named "COGS", "Cost", or "Material")`);
            }
            return;
        }
        else if (importType === 'products') {
            const itemCodeIdx = findColumnIndex(headers, ['Item Code', 'ItemCode', 'SKU', 'Part Number', 'Item #', 'Code']);
            const nameIdx = findColumnIndex(headers, ['Description', 'Item Description', 'Product Name', 'Name']);
            const catIdx = findColumnIndex(headers, ['Category', 'Product Category']);
            const subCatIdx = findColumnIndex(headers, ['Sub-Category', 'Sub Category', 'SubCategory', 'Type']);
            const sellUnitIdx = findColumnIndex(headers, ['Sell Unit', 'Unit', 'UOM']);
            const bagUnitsIdx = findColumnIndex(headers, ['Bag Units', 'Units', 'Qty', 'Quantity', 'Units Per Bag']);
            const unitCostIdx = findColumnIndex(headers, ['Unit Cost', 'Cost Per Unit', 'Cost']);
            const unitPriceIdx = findColumnIndex(headers, ['Unit Price', 'Price Per Unit', 'Price']);

            const missingCount = [itemCodeIdx, nameIdx, unitCostIdx, unitPriceIdx].filter(i => i === -1).length;
            if (missingCount >= 3) {
                setStatus('⚠️ Error: Could not match key Product columns (Description, Item Code, Unit Cost). Did you mean to select "Sales Data" or "Customers"?');
                setMappingDebug({
                    Message: { index: -1, foundHeader: 'Missing Key Headers' },
                    Missing: { index: -1, foundHeader: 'Description, Unit Cost, Unit Price, or Bag Units' }
                });
                return;
            }

            setMappingDebug({
                ItemCode: { index: itemCodeIdx, foundHeader: itemCodeIdx !== -1 ? headers[itemCodeIdx] : 'NOT FOUND' },
                Description: { index: nameIdx, foundHeader: nameIdx !== -1 ? headers[nameIdx] : 'NOT FOUND' },
                SubCategory: { index: subCatIdx, foundHeader: subCatIdx !== -1 ? headers[subCatIdx] : 'NOT FOUND' },
                UnitCost: { index: unitCostIdx, foundHeader: unitCostIdx !== -1 ? headers[unitCostIdx] : 'NOT FOUND' },
                UnitPrice: { index: unitPriceIdx, foundHeader: unitPriceIdx !== -1 ? headers[unitPriceIdx] : 'NOT FOUND' }
            });

            const newProducts = [];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;

                let product = { id: Date.now() + i + '' };

                product.itemCode = itemCodeIdx !== -1 ? row[itemCodeIdx] : '';
                product.name = nameIdx !== -1 ? row[nameIdx] : (row[0] || 'Unknown Product');
                product.category = catIdx !== -1 ? row[catIdx] : 'Uncategorized';
                product.subCategory = subCatIdx !== -1 ? row[subCatIdx] : '';
                product.sellUnit = sellUnitIdx !== -1 ? row[sellUnitIdx] : 'Each';

                const units = bagUnitsIdx !== -1 ? (parseFloat(row[bagUnitsIdx]) || 1) : 1;
                const uCost = unitCostIdx !== -1 ? cleanCurrency(row[unitCostIdx]) : 0;
                const uPrice = unitPriceIdx !== -1 ? cleanCurrency(row[unitPriceIdx]) : 0;

                product.bagUnits = units;
                product.unitCost = uCost;
                product.unitPrice = uPrice;

                product.bagCost = uCost * units;
                product.cost = product.bagCost;
                product.price = uPrice * units;

                product.vendor = '';
                product.itemClass = '';
                product.importedMargin = 0;

                if (importCategory) {
                    product.category = importCategory;
                }

                if (product.name || product.itemCode) {
                    newProducts.push(product);
                    count++;
                }
            }
            onImportProducts(newProducts);

        } else {
            // CUSTOMERS MAPPING
            const nameIdx = findColumnIndex(headers, ['Customer Name', 'Name', 'Customer']);
            const groupIdx = findColumnIndex(headers, ['Group', 'Customer Group', 'Type', 'Segment']);
            const spendIdx = findColumnIndex(headers, ['Annual Spend', 'Spend', 'Total Sales', 'Revenue', 'Sales', 'Amount', 'Total Spend']);
            const territoryIdx = findColumnIndex(headers, ['Territory', 'Province', 'State', 'Region']);

            const useIndices = (nameIdx === -1 && groupIdx === -1 && spendIdx === -1 && territoryIdx === -1);

            if (useIndices) {
                setMappingDebug({
                    Status: { index: -1, foundHeader: 'Detected No Headers. Using 2-column fallback (Name, Spend).', mode: 'fallback' }
                });
            } else {
                setMappingDebug({
                    CustomerName: { index: nameIdx, foundHeader: nameIdx !== -1 ? headers[nameIdx] : 'NOT FOUND' },
                    Group: { index: groupIdx, foundHeader: groupIdx !== -1 ? headers[groupIdx] : 'NOT FOUND' },
                    Spend: { index: spendIdx, foundHeader: spendIdx !== -1 ? headers[spendIdx] : 'NOT FOUND' },
                    Territory: { index: territoryIdx, foundHeader: territoryIdx !== -1 ? headers[territoryIdx] : 'NOT FOUND' },
                });
            }

            const newCustomers = [];
            for (let i = startRow; i < rows.length; i++) {
                const row = rows[i];
                if (!row || row.length === 0) continue;

                let name, groupRaw, spend, territory;

                if (useIndices) {
                    const val2 = String(row[1] || '').trim();
                    const isTerritory = /^(SK|AB|BC|MB|ON|QC|NB|NS|PE|NL|YT|NT|NU|OTHER|SASKATCHEWAN|ALBERTA|BRITISH COLUMBIA)$/i.test(val2);
                    const col1IsMoney = !isNaN(parseFloat(String(row[1]).replace(/[$,]/g, '')));
                    const col2IsEmpty = !row[2];

                    if (isTerritory) {
                        name = row[0];
                        territory = row[1];
                        spend = cleanCurrency(row[2]);
                        groupRaw = '';
                    } else if (col1IsMoney && col2IsEmpty) {
                        name = row[0];
                        groupRaw = '';
                        spend = cleanCurrency(row[1]);
                        territory = 'Other';
                    } else {
                        name = row[0];
                        groupRaw = row[1] || '';
                        spend = cleanCurrency(row[2]);
                        territory = 'Other';
                    }
                } else {
                    name = nameIdx !== -1 ? row[nameIdx] : (row[0] || 'Unknown Customer');
                    groupRaw = groupIdx !== -1 ? row[groupIdx] : '';
                    spend = spendIdx !== -1 ? cleanCurrency(row[spendIdx]) : 0;

                    const tRaw = territoryIdx !== -1 ? row[territoryIdx] : 'Other';
                    if (/^(SK|SASK|SASKATCHEWAN)$/i.test(tRaw)) territory = 'SK';
                    else if (/^(AB|ALTA|ALBERTA)$/i.test(tRaw)) territory = 'AB';
                    else if (/^(BC|BRITISH COLUMBIA)$/i.test(tRaw)) territory = 'BC';
                    else territory = 'Other';
                }

                let group = importGroup;
                if (groupRaw && String(groupRaw).toLowerCase().includes('commercial')) {
                    group = CUSTOMER_GROUPS.COMMERCIAL;
                } else if (groupRaw && String(groupRaw).toLowerCase().includes('dealer')) {
                    group = CUSTOMER_GROUPS.DEALER;
                }

                if (name) {
                    newCustomers.push({ id: Date.now() + i + '', name, group, annualSpend: spend, territory: territory || 'Other' });
                    count++;
                }
            }
            onImportCustomers(newCustomers);
        }
        setStatus(`Success! Imported ${count} ${importType} from ${fileName}.`);
    };

    // Premium SaaS UI Variables
    const styles = {
        pageWrapper: { width: '100%', minHeight: '100%' },
        container: { maxWidth: '1200px', margin: '0 auto', padding: '2.5rem', width: '100%', fontFamily: 'var(--font-base)' },
        headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem' },
        headerText: { fontSize: '1.85rem', fontWeight: '700', color: '#0f172a', letterSpacing: '-0.02em', margin: '0 0 0.5rem 0' },
        subText: { color: '#64748b', fontSize: '1.05rem', margin: 0 },
        
        card: { backgroundColor: '#ffffff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(15, 23, 42, 0.03)', border: '1px solid rgba(15, 23, 42, 0.08)', padding: '2.5rem', marginBottom: '2rem' },
        
        inputField: { padding: '0.65rem 1rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.95rem', color: '#0f172a', backgroundColor: '#ffffff', outline: 'none', fontWeight: '500', minWidth: '200px', cursor: 'pointer' },
        label: { display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' },
        
        outlineBtn: { backgroundColor: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.65rem 1.25rem', fontSize: '0.9rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' },
        dangerBtn: { backgroundColor: '#ffffff', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '8px', padding: '0.65rem 1rem', fontSize: '0.85rem', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, justifyContent: 'center' },
        
        uploadZone: { border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '4rem 2rem', textAlign: 'center', backgroundColor: '#f8fafc', transition: 'all 0.2s', cursor: 'pointer' },
        
        infoBox: { backgroundColor: '#f0fdfa', borderRadius: '10px', padding: '1.5rem', border: '1px solid #ccfbf1', display: 'flex', gap: '1rem', alignItems: 'flex-start' }
    };

    return (
        <div style={styles.pageWrapper}>
            <div style={styles.container}>
                {/* Header */}
                <div style={styles.headerRow}>
                    <div>
                        <h2 style={styles.headerText}>Data Importer</h2>
                        <p style={styles.subText}>Upload and map spreadsheet data to update the pricing matrix.</p>
                    </div>

                    <button
                        onClick={handleExportBackup}
                        style={{...styles.outlineBtn, borderColor: '#e2e8f0', backgroundColor: '#f8fafc'}}
                        onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                        onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                    >
                        <span>⬇️</span> Export JSON Backup
                    </button>
                </div>

                {/* Import Controls Card */}
                <div style={{...styles.card, borderTop: '4px solid #3b82f6'}}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginBottom: '2.5rem', alignItems: 'flex-end', paddingBottom: '2rem', borderBottom: '1px solid #f1f5f9' }}>
                        <div>
                            <label style={styles.label}>Import Target</label>
                            <select
                                style={styles.inputField}
                                value={importType}
                                onChange={e => { setImportType(e.target.value); setStatus(''); setFileName(''); setDebugInfo(null); setMappingDebug(null); }}
                            >
                                <option value="products">Product Catalog</option>
                                <option value="customers">Customer Registry</option>
                                <option value="sales">Sales Transactions</option>
                            </select>
                        </div>

                        {(importType === 'products' || importType === 'sales') && (
                            <div>
                                <label style={styles.label}>Force Category Link</label>
                                <select
                                    style={{...styles.inputField, borderColor: '#bae6fd', backgroundColor: '#f0f9ff', color: '#0369a1'}}
                                    value={importCategory}
                                    onChange={e => setImportCategory(e.target.value)}
                                >
                                    <option value="">{importType === 'sales' ? 'Auto-Detect via Column' : 'Auto-Detect via Column'}</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.name}>Force to: {cat.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {importType === 'customers' && (
                            <div>
                                <label style={styles.label}>Default Segment</label>
                                <select
                                    style={{...styles.inputField, borderColor: '#bae6fd', backgroundColor: '#f0f9ff', color: '#0369a1'}}
                                    value={importGroup}
                                    onChange={e => setImportGroup(e.target.value)}
                                >
                                    {Object.values(CUSTOMER_GROUPS).map(g => (
                                        <option key={g} value={g}>Import as {g}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem' }}>
                        {/* File Upload Zone */}
                        <div>
                            <div style={styles.uploadZone} onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#eff6ff'; e.currentTarget.style.borderColor = '#93c5fd'; }} onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; e.currentTarget.style.borderColor = '#cbd5e1'; }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem', color: '#94a3b8' }}>📄</div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#0f172a', margin: '0 0 0.5rem 0' }}>Select File to Import</h3>
                                <p style={{ color: '#64748b', fontSize: '0.9rem', margin: '0 0 1.5rem 0' }}>Supports .xlsx, .xls, .csv, and .json</p>
                                
                                <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block' }}>
                                    <button style={{ backgroundColor: '#ffffff', border: '1px solid #cbd5e1', color: '#0f172a', padding: '0.6rem 1.5rem', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', pointerEvents: 'none' }}>
                                        Browse Files
                                    </button>
                                    <input
                                        type="file"
                                        accept=".xlsx, .xls, .csv, .json"
                                        onChange={handleFileUpload}
                                        style={{ position: 'absolute', left: 0, top: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                                    />
                                </div>
                                {fileName && <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#2563eb', fontWeight: '500' }}>Selected: {fileName}</div>}
                            </div>
                            
                            {status && (
                                <div style={{ marginTop: '1.5rem', color: status.includes('Success') || status.includes('successfully') ? '#059669' : '#dc2626', backgroundColor: status.includes('Success') || status.includes('successfully') ? '#ecfdf5' : '#fef2f2', padding: '1rem', borderRadius: '8px', border: `1px solid ${status.includes('Success') || status.includes('successfully') ? '#a7f3d0' : '#fecaca'}`, fontSize: '0.95rem', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span>{status.includes('Success') || status.includes('successfully') ? '✓' : '⚠️'}</span> {status}
                                </div>
                            )}
                        </div>

                        {/* Allowed Headers Info */}
                        <div>
                            <div style={{ backgroundColor: '#f8fafc', borderRadius: '12px', padding: '1.5rem', border: '1px solid #e2e8f0', height: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#0f172a', margin: 0 }}>Required Data Schema</h3>
                                    <span style={{ backgroundColor: '#e2e8f0', color: '#475569', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: '700', textTransform: 'uppercase' }}>Auto-Mapped</span>
                                </div>
                                
                                {importType === 'products' ? (
                                    <>
                                        <p style={{ fontSize: '0.9rem', color: '#64748b', margin: '0 0 1rem 0' }}>The system will attempt to automatically map columns with the following names:</p>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.9rem', color: '#334155' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                <span>• <strong>Item Code</strong> (SKU)</span>
                                                <span>• <strong>Description</strong> (Name)</span>
                                                <span>• <strong>Category</strong></span>
                                                <span>• <strong>Sub-Category</strong></span>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                <span>• <strong>Sell Unit</strong></span>
                                                <span>• <strong>Bag Units</strong> (Qty)</span>
                                                <span>• <strong>Unit Cost</strong></span>
                                                <span>• <strong>Unit Price</strong></span>
                                            </div>
                                        </div>
                                    </>
                                ) : importType === 'sales' ? (
                                    <>
                                        <p style={{ fontSize: '0.9rem', color: '#64748b', margin: '0 0 1rem 0' }}>The system will attempt to extract transactions using these columns:</p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', color: '#334155' }}>
                                            <span>• <strong>Customer ID</strong> <span style={{ color: '#94a3b8' }}>(Optional, Col 1)</span></span>
                                            <span>• <strong>Customer Name</strong> <span style={{ color: '#94a3b8' }}>(Col 2)</span></span>
                                            <span>• <strong>Revenue / Amount</strong> <span style={{ color: '#94a3b8' }}>(Col 3)</span></span>
                                            <span>• <strong>COGS / Cost</strong> <span style={{ color: '#94a3b8' }}>(Optional, Col 4)</span></span>
                                            <span>• <strong>Category</strong> <span style={{ color: '#94a3b8' }}>(Optional)</span></span>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <p style={{ fontSize: '0.9rem', color: '#64748b', margin: '0 0 1rem 0' }}>The system will attempt to link customers based on these headers:</p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.9rem', color: '#334155' }}>
                                            <span>• <strong>Name</strong> / Customer Name</span>
                                            <span>• <strong>Group</strong> <span style={{ color: '#94a3b8' }}>(Dealer / Commercial)</span></span>
                                            <span>• <strong>Annual Spend</strong> / Revenue</span>
                                            <span>• <strong>Territory</strong> <span style={{ color: '#94a3b8' }}>(Auto-normalized)</span></span>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Debugging Info (Collapsed by default visually, but rendered if exists) */}
                {(debugInfo || mappingDebug) && (
                    <div style={{...styles.card, padding: '1.5rem', backgroundColor: '#fafaf9', borderColor: '#e7e5e4'}}>
                        <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#44403c', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>🔧</span> Parsing Diagnostics</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem' }}>
                            {debugInfo && (
                                <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e7e5e4', overflowX: 'auto' }}>
                                    <strong style={{ display: 'block', fontSize: '0.8rem', textTransform: 'uppercase', color: '#78716c', marginBottom: '0.5rem' }}>Raw Headers</strong>
                                    <pre style={{ margin: 0, fontSize: '0.8rem', color: '#44403c', whiteSpace: 'pre-wrap' }}>{JSON.stringify(debugInfo.headers, null, 2)}</pre>
                                </div>
                            )}
                            {mappingDebug && (
                                <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e7e5e4', overflowX: 'auto' }}>
                                     <strong style={{ display: 'block', fontSize: '0.8rem', textTransform: 'uppercase', color: '#78716c', marginBottom: '0.5rem' }}>Column Mapping Results</strong>
                                    <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.85rem' }}>
                                        {Object.entries(mappingDebug).map(([key, val]) => (
                                            <li key={key} style={{ color: val.mode === 'fallback' ? '#059669' : (val.index === -1 ? '#dc2626' : '#059669'), marginBottom: '0.25rem' }}>
                                                <strong>{key}:</strong> {val.foundHeader} {val.index !== -1 && `(Idx: ${val.index})`}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* NEW CUSTOMER VALIDATION MODAL */}
                {importReview && (
                    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
                        <div style={{ backgroundColor: 'white', padding: '2.5rem', borderRadius: '12px', maxWidth: '550px', width: '90%', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', fontSize: '1.25rem' }}>⚠️</div>
                                <h3 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>Unrecognized Customers Detected</h3>
                            </div>
                            
                            <p style={{ color: '#475569', fontSize: '0.95rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                                Your import file contains <strong>{importReview.length}</strong> transactions assigned to customers that do not currently exist in your directory.
                            </p>
                            
                            <div style={{ maxHeight: '180px', overflowY: 'auto', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.9rem', marginBottom: '2rem' }}>
                                {importReview.slice(0, 5).map((c, i) => (
                                    <div key={i} style={{ padding: '4px 0', borderBottom: i < 4 && i < importReview.length -1  ? '1px solid #f1f5f9' : 'none', color: '#334155', fontWeight: '500' }}>
                                        <span style={{ color: '#94a3b8', marginRight: '8px' }}>•</span> 
                                        {c.name || 'Unknown'} {c.customerId ? <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '4px' }}>(ID: {c.customerId})</span> : ''}
                                    </div>
                                ))}
                                {importReview.length > 5 && <div style={{ color: '#64748b', fontStyle: 'italic', marginTop: '8px', fontSize: '0.85rem', textAlign: 'center' }}>...and {importReview.length - 5} more records</div>}
                            </div>

                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <button
                                    onClick={() => {
                                        const allowedNames = new Set(fullState.customers.map(c => c.name.toLowerCase().trim()));
                                        const filtered = pendingSalesData.filter(d => allowedNames.has(d.name.toLowerCase().trim()));
                                        onImportSales(filtered);
                                        setImportReview(null);
                                        setPendingSalesData(null);
                                        setStatus(`Imported ${filtered.length} sales records (Skipped ${importReview.length} unrecognized matches).`);
                                    }}
                                    style={{...styles.outlineBtn, flex: 1, justifyContent: 'center'}}
                                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f8fafc'; }}
                                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'white'; }}
                                >
                                    Skip Invalid Records
                                </button>
                                <button
                                    onClick={() => {
                                        onImportSales(pendingSalesData);
                                        setImportReview(null);
                                        setPendingSalesData(null);
                                        setStatus(`Success! Imported ${pendingSalesData.length} records and auto-created ${importReview.length} new customer profiles.`);
                                    }}
                                    style={{...styles.outlineBtn, backgroundColor: '#2563eb', color: 'white', borderColor: '#2563eb', flex: 1, justifyContent: 'center'}}
                                >
                                    Force Import All
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Data Cleanup Section (Danger Zone) */}
                <div style={{ marginTop: '3rem', paddingTop: '2.5rem', borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <h4 style={{ color: '#0f172a', fontSize: '1.1rem', margin: 0, fontWeight: '700' }}>Data Reset Tools</h4>
                        <span style={{ backgroundColor: '#fef2f2', color: '#ef4444', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Danger Zone</span>
                    </div>

                    {confirmAction ? (
                        <div style={{ padding: '1.5rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 auto' }}>
                                <h4 style={{ margin: '0 0 0.25rem 0', color: '#991b1b', fontSize: '1rem' }}>Confirm Permanent Deletion</h4>
                                <span style={{ color: '#b91c1c', fontSize: '0.95rem' }}>
                                    Are you sure you want to permanently erase all <strong style={{ textTransform: 'uppercase' }}>{confirmAction}</strong>? This action cannot be undone unless you have a JSON backup.
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
                                <button
                                    onClick={() => setConfirmAction(null)}
                                    style={{ backgroundColor: 'white', color: '#475569', border: '1px solid #cbd5e1', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        onClearData(confirmAction);
                                        setStatus(`System reset: All ${confirmAction} have been erased.`);
                                        setConfirmAction(null);
                                    }}
                                    style={{ backgroundColor: '#dc2626', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', boxShadow: '0 1px 2px rgba(220, 38, 38, 0.2)' }}
                                >
                                    Yes, Erase Data
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <button onClick={() => setConfirmAction('products')} style={styles.dangerBtn} onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; }} onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}>
                                <span>🗑</span> Reset Catalog
                            </button>
                            <button onClick={() => setConfirmAction('customers')} style={styles.dangerBtn} onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; }} onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}>
                                <span>🗑</span> Reset Customers
                            </button>
                            <button onClick={() => setConfirmAction('categories')} style={styles.dangerBtn} onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; }} onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}>
                                <span>🗑</span> Reset Categories
                            </button>
                            <button onClick={() => setConfirmAction('sales')} style={styles.dangerBtn} onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; }} onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#ffffff'; }}>
                                <span>🗑</span> Reset Sales History
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DataImporter;

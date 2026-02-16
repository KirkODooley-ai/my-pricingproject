/**
 * Pricing Engine for calculating margins, prices, and impacts.
 */

// --- Constants ---

export const CUSTOMER_GROUPS = {
    DEALER: 'Dealer',
    COMMERCIAL: 'Commercial'
}

// [NEW] Category Groups Definition
export const CATEGORY_GROUPS = {
    'Large Rolled Panel': [
        'FC36', 'FR', 'I9', 'II6', '32 7/8" Corrugated', '37 7/8 Corrugated', 'FA'
    ],
    'Small Rolled Panels': [
        '1 1/2" Mechanical Loc', '1" Nail Strip 11 3/4"', '1" Nail Strip 16"', '1" Nail Strip 17 1/2"',
        '1" Nail Strip 18"', '1 1/2" Clip Loc', '1 1/2" Nail Strip 12 1/8"', '1 1/2" Nail Strip 16"',
        '8" Inter Loc', '12" Interloc', '12" Forma Loc', '16" Forma Loc', '17" Forma Loc',
        '10" Forma Batten', '12 3/8" Forma Batten', '7 1/5" Inter Loc'
    ],
    'Cladding Series': [
        '13 1/2" Board & Batten', '9 3/4" Board & Batten', 'Expand Modular', 'ShipLap',
        '5.2" Box Rib', '6" Box Rib', '6" Box Rib Reverse', '7.2 " Box Rib',
        '6 1/4" Forma Plank', '8 1/2" Forma Plank', '5.625" Slimline', '7.125" Slimline Wide', '6" Shiplap'
    ]
}

// Flatten groups plus 'Parts' defaults for the main list
const GROUPED_CATS = [
    ...CATEGORY_GROUPS['Large Rolled Panel'],
    ...CATEGORY_GROUPS['Small Rolled Panels'],
    ...CATEGORY_GROUPS['Cladding Series']
]

export const DEFAULT_CATEGORIES = [
    ...GROUPED_CATS,
    // Parts / Legacy
    'Clips', 'Closures', 'Coils', 'Cupolas', 'Fasteners', 'Flats', 'Gutters',
    'Hand Tools', 'Misc', 'Packaging', 'Paint', 'Plumbing Flashing', 'Polycarbonate',
    'Sealants', 'Sliding Doors', 'Snow Guards', 'Steel Shingles', 'Structural',
    'Underlay', 'Walk Door'
]

export const getCategoryGroup = (catName) => {
    for (const [group, items] of Object.entries(CATEGORY_GROUPS)) {
        if (items.includes(catName)) return group
    }
    return 'Parts'
}

export const TIER_RULES = {
    [CUSTOMER_GROUPS.DEALER]: [
        { name: 'Authorized Obsidian', minSpend: 2000000 },
        { name: 'Authorized Platinum', minSpend: 1000000 },
        { name: 'Authorized Diamond', minSpend: 500000 },
        { name: 'Authorized Gold', minSpend: 225000 },
        { name: 'Authorized Silver', minSpend: 50000 },
        { name: 'Authorized Bronze', minSpend: 0 },
    ],
    [CUSTOMER_GROUPS.COMMERCIAL]: [
        { name: 'Obsidian Partner', minSpend: 4000000 },
        { name: 'Platinum Partner', minSpend: 2000000 },
        { name: 'Diamond Partner', minSpend: 1000000 },
        { name: 'Gold Partner', minSpend: 500000 },
        { name: 'Silver Partner', minSpend: 150000 },
        { name: 'Bronze Partner', minSpend: 0 },
    ]
}

// --- Types (JSDoc) ---

/**
 * @typedef {Object} Product
 * @property {string} id
 * @property {string} name
 * @property {number} cost
 * @property {number} price
 * @property {string} [tierId]
 * @property {string} [categoryId]
 */

/**
 * @typedef {Object} Category
 * @property {string} id
 * @property {string} name
 * @property {number} revenue
 * @property {number} materialCost
 * @property {number} laborCost
 */

/**
 * @typedef {Object} Customer
 * @property {string} id
 * @property {string} name
 * @property {string} group // 'Dealer' or 'Commercial Partner'
 * @property {number} annualSpend
 * @property {string} tierName // Computed
 */


// --- Formatting ---

export const formatCurrency = (value, precision = 2) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
    }).format(value)
}

export const formatPercent = (value) => {
    return new Intl.NumberFormat('en-US', {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 2,
    }).format(value)
}

// --- Calculations ---

/**
 * Calculate margin based on price and cost.
 * Margin = (Price - Cost) / Price
 */
export const calculateMargin = (price, cost) => {
    if (price === 0) return 0
    return (price - cost) / price
}

/**
 * Calculates margin for a category based on its aggregates.
 * @param {Category} category 
 */
export const calculateCategoryMargin = (category) => {
    const totalCost = (category.materialCost || 0) + (category.laborCost || 0)
    return calculateMargin(category.revenue || 0, totalCost)
}

/**
 * Determines the tier for a customer based on their group and spend.
 * @param {string} group 
 * @param {number} annualSpend 
 * @returns {string} Tier Name
 */
export const calculateTier = (group, annualSpend) => {
    if (!group) return 'Unassigned'

    // Normalize group name: 'Dealer ' -> 'Dealer', 'dealer' -> 'Dealer'
    // Safe conversion to string to prevent crashes if numeric or object
    const safeGroup = String(group).trim()

    // Find the matching key in TIER_RULES (case-insensitive)
    const normalizedGroupKey = Object.keys(TIER_RULES).find(k => k.toLowerCase() === safeGroup.toLowerCase())
    const rules = TIER_RULES[normalizedGroupKey]

    if (!rules) return 'Unknown Info'

    // Rules are ordered high to low in the constant, so find the first one that matches
    const tier = rules.find(r => annualSpend >= r.minSpend)
    return tier ? tier.name : 'Unassigned'
}

/**
 * Calculate price needed to achieve a target margin.
 */
export const calculatePriceFromMargin = (cost, targetMargin) => {
    if (targetMargin >= 1) return cost
    return cost / (1 - targetMargin)
}

/**
 * Calculate the revenue impact of a price change.
 */
export const calculateRevenueImpact = (oldPrice, newPrice, volume = 1) => {
    return (newPrice - oldPrice) * volume
}

// [NEW] Aggregate Sales Data per Customer
export const aggregateCustomerStats = (customer, salesTransactions = []) => {
    // Normalize Customer Name for matching
    const safeName = (customer.name || '').toLowerCase().trim()

    let totalRevenue = 0
    let totalCOGS = 0

    if (Array.isArray(salesTransactions)) {
        salesTransactions.forEach(tx => {
            // Match on Customer Name
            // NOTE: In a real app we'd use ID, but imports use Name
            if ((tx.customerName || '').toLowerCase().trim() === safeName) {
                totalRevenue += parseFloat(tx.amount) || 0
                totalCOGS += parseFloat(tx.cogs) || 0
            }
        })
    }

    // Fallback: If no transactions found, use the customer record's annualSpend
    // But then we have 0 COGS (100% Margin), which is misleading.
    // Better to return 0 profit if unknown.
    if (totalRevenue === 0 && customer.annualSpend > 0) {
        totalRevenue = customer.annualSpend
        // Assume 0 COGS if not found (High Margin Alert)
    }

    const margin = totalRevenue > 0 ? (totalRevenue - totalCOGS) / totalRevenue : 0

    return {
        revenue: totalRevenue,
        cogs: totalCOGS,
        profit: totalRevenue - totalCOGS,
        margin
    }
}

// [NEW] Phase 14: Pricing Strategy Helpers

/**
 * Helper to get the correct List Price Multiplier for a category.
 * Hierarchy: Defined Group (e.g. Fasteners) > Default
 * @param {Object} strategy - Full pricingStrategy object
 * @param {string} categoryName
 */
export const getListMultiplier = (strategy, categoryName, gauge = null) => {
    const cat = categoryName ? String(categoryName).trim() : ''

    // 0a. Check Variant Override (e.g. "FC36:29")
    if (gauge) {
        const variantKey = `${cat}:${gauge}`
        if (strategy.listMultipliers[variantKey]) {
            return strategy.listMultipliers[variantKey]
        }
    }

    // 1. Direct Match
    if (strategy.listMultipliers[cat]) {
        return strategy.listMultipliers[cat]
    }

    // 1b. Try Fasteners:Prefix (Shared logic with UI)
    // The UI saves specific fastener types as "Fasteners:Type S"
    const fastKey = `Fasteners:${cat}`
    if (strategy.listMultipliers[fastKey]) {
        return strategy.listMultipliers[fastKey]
    }

    // 2. Fastener Fallback (e.g. "General Fasteners" -> "Fasteners")
    // If it is a known fastener type, fallback to the main "Fasteners" group multiplier
    // Note: We check case-insensitive match against known types
    const isKnownFastener = FASTENER_TYPES.some(t => t.toLowerCase() === cat.toLowerCase()) ||
        getFastenerType(cat) !== 'General Fasteners' || // heuristic check
        cat.toLowerCase().includes('fastener') // broad check

    if (isKnownFastener && strategy.listMultipliers['Fasteners']) {
        return strategy.listMultipliers['Fasteners']
    }

    // 4. Default
    return strategy.listMultipliers['Default'] || 1.5
}

/**
 * Calculates the New List Price based on multipliers.
 * Hierarchy: Defined Group (e.g. Fasteners) > Default
 * @param {number} baseCost 
 * @param {string} groupName - e.g. "Fasteners" or "Default"
 * @param {Object} multipliers - { 'Default': 1.5, 'Fasteners': 2.0 }
 */
export const calculateListPrice = (baseCost, groupName, multipliers) => {
    // Deprecated? Or just simple version.
    const multiplier = multipliers[groupName] || multipliers['Default'] || 1.0
    return baseCost * multiplier
}

/**
 * Calculates the Net Dealer Cost based on List Price and Tier Discount.
 * @param {number} listPrice 
 * @param {string} customerGroup - 'Dealer' or 'Commercial'
 * @param {string} tierName - e.g. 'Authorized Obsidian'
 * @param {string} productGroup - e.g. 'Fasteners' or 'Default'
 * @param {Object} strategy - Full pricingStrategy object
 */
export const calculateNetPrice = (listPrice, customerGroup, tierName, productGroup, strategy) => {
    // 1. Find the Tier Config
    const tierConfig = strategy.tierMultipliers[customerGroup]?.[tierName]

    // 2. Determine Discount Multiplier (Default to 1.0/No Discount if missing)
    let discountMultiplier = 1.0
    if (tierConfig) {
        // [NEW] Check for Variant/Product Specific Key first (if passed in productGroup)
        // If productGroup is "Category:Gauge", it checks that first.
        // If not found, it checks "Category".
        // HOWEVER, caller usually passes "Category". 
        // We should encourage passing correct key or handling lookup here?
        // Since productGroup is just a string key, we rely on Caller to pass "FC36:29" if they want variant lookup.
        // But if they pass "FC36:29" and it's missing, we must fallback to "FC36".

        if (tierConfig[productGroup] !== undefined) {
            discountMultiplier = tierConfig[productGroup]
        } else if (productGroup.includes(':')) {
            // Fallback to Base Category
            const [cat] = productGroup.split(':')
            discountMultiplier = tierConfig[cat] ?? tierConfig['Default'] ?? 1.0
        } else {
            discountMultiplier = tierConfig['Default'] ?? 1.0
        }
    }

    return listPrice * discountMultiplier
}

// [NEW] Phase 17: Fastener Sub-Category Logic
export const FASTENER_TYPES = [
    'Pan Socket Type S', // Specific first
    'Driller',
    'Pancake',
    'Lap Stitch',
    'Type 17',
    'Type A',
    'Type S',
    'General Fasteners' // Default Fallback
]

export const getFastenerType = (productName = '') => {
    const name = productName.trim()

    // Check specific types (Case Insensitive)
    // Order matters: 'Pan Socket Type S' before 'Type S'
    if (/Pan Socket Type S/i.test(name)) return 'Pan Socket Type S'
    if (/Driller/i.test(name)) return 'Driller'
    if (/Pancake/i.test(name)) return 'Pancake'
    if (/Lap Stitch/i.test(name)) return 'Lap Stitch'
    if (/Type 17/i.test(name)) return 'Type 17'
    if (/Type A/i.test(name)) return 'Type A'
    if (/Type S/i.test(name)) return 'Type S'

    return 'General Fasteners'
}

/**
 * Returns the minimum margin floor for a given category group and tier.
 * @param {string} categoryGroup 
 * @param {number} tierIndex - 0 for Top Tier (Obsidian)
 * @param {number} totalTiers - Total number of tiers (usually 6)
 */
export const getMarginFloor = (categoryGroup, tierIndex = 0, totalTiers = 6) => {
    // 1. Large/Small Rolled Panels -> 20% Min
    if (categoryGroup === 'Large Rolled Panel' || categoryGroup === 'Small Rolled Panels') {
        return 0.20
    }

    // 2. Cladding Series -> Scaled 30% (Obsidian) to 40% (Bronze/Auth)
    if (categoryGroup === 'Cladding Series') {
        // Linear Interpolation: 0.30 + (Ratio * 0.10)
        // Ratio 0 = Obsidian, Ratio 1 = Bottom
        const ratio = totalTiers > 1 ? (tierIndex / (totalTiers - 1)) : 0
        return 0.30 + (ratio * 0.10)
    }

    // 3. Fasteners, Parts -> 40% Min
    if (categoryGroup === 'Fasteners' || categoryGroup === 'Parts') {
        return 0.40
    }

    // Default Fallback
    return 0.20
}

/**
 * Enforces Tier Hierarchy Rule: Obsidian <= Platinum <= Diamond ...
 * Ensures at least 0.02 spread between tiers.
 * @param {Object} strategy - The pricing strategy object
 * @returns {Object} A new strategy object with enforced rules
 */
export const enforceTierHierarchy = (strategy) => {
    const newStrategy = { ...strategy, tierMultipliers: { ...strategy.tierMultipliers } }

    Object.keys(CUSTOMER_GROUPS).forEach(k => {
        const gType = CUSTOMER_GROUPS[k]
        // Make deep copy of this group's tiers to avoid mutation issues
        newStrategy.tierMultipliers[gType] = JSON.parse(JSON.stringify(newStrategy.tierMultipliers[gType] || {}))

        const tiers = TIER_RULES[gType] // Ordered: Obsidian (0) -> Bronze (N)

        // We must check every category present in the strategy
        // Get all unique categories across all tiers for this group
        const categorySet = new Set()
        Object.values(newStrategy.tierMultipliers[gType]).forEach(tData => {
            if (tData) Object.keys(tData).forEach(c => categorySet.add(c))
        })

        if (categorySet.size === 0) return

        categorySet.forEach(catName => {
            // Forward Pass: Obsidian -> Bronze
            // Rule: Tier N (Lower Status/Higher Price) must be >= Tier N-1 (Higher Status/Lower Price) + 0.02
            // e.g. Obsidian (0.80) -> Platinum must be at least 0.82

            let prevMult = -1.0

            tiers.forEach((tier, idx) => {
                // Ensure tier object exists
                if (!newStrategy.tierMultipliers[gType][tier.name]) {
                    newStrategy.tierMultipliers[gType][tier.name] = {}
                }
                const discountMap = newStrategy.tierMultipliers[gType][tier.name]

                // Get current or default to 1.0 (no discount)
                // If it's missing, we default to 1.0, but should we write it back? 
                // Only if we are forcing a structure. For safety, let's treat missing as 1.0.
                let currentMult = discountMap[catName] !== undefined ? discountMap[catName] : 1.0

                if (idx === 0) {
                    // Obsidian (Top Tier): Just cap at 1.0
                    if (currentMult > 1.0) currentMult = 1.0
                    prevMult = currentMult
                    // Write back only if it existed or we changed it? 
                    // Safest: Write back to ensure key exists for future passes
                    discountMap[catName] = currentMult
                } else {
                    // Subsequent Tiers
                    // Rule: Current >= Prev + 0.02
                    let minMult = parseFloat((prevMult + 0.02).toFixed(3)) // 3 decimals for safety

                    // HARD CEILING: Max 1.0
                    if (minMult > 1.0) minMult = 1.0

                    if (currentMult < minMult) {
                        currentMult = minMult
                    }

                    // Also clamp if > 1.0
                    if (currentMult > 1.0) currentMult = 1.0

                    // Write back
                    discountMap[catName] = currentMult
                    prevMult = currentMult
                }
            })
        })
    })

    return newStrategy
}


/**
 * Centralized Logic for Auto-Calculating Tier Discounts based on Sales History.
 * Replaces the ad-hoc logic in PricingStrategyManager.jsx.
 * 
 * @param {Object} currentStrategy 
 * @param {Array} salesTransactions 
 * @param {Array} customers 
 * @param {Array} categories 
 * @returns {Object} New Pricing Strategy
 */
export const calculateAutoDiscounts = (currentStrategy, salesTransactions, customers, categories) => {
    // 1. Deep Copy Strategy
    const strategy = JSON.parse(JSON.stringify(currentStrategy))
    if (!strategy.tierMultipliers) strategy.tierMultipliers = {}

    // Initialize missing structures in strategy
    Object.keys(CUSTOMER_GROUPS).forEach(k => {
        const gType = CUSTOMER_GROUPS[k]
        if (!strategy.tierMultipliers[gType]) strategy.tierMultipliers[gType] = {}
        TIER_RULES[gType].forEach(t => {
            if (!strategy.tierMultipliers[gType][t.name]) strategy.tierMultipliers[gType][t.name] = {}
        })
    })

    // 2. Build Analysis Data from History
    // { GroupType: { TierName: { Category: { rev, cogs } } } }
    const analysis = {}

    // Helper: Map Customer Name to Group
    const getCustomerGroup = (custName) => {
        const c = customers.find(c => c.name === custName)
        if (!c) return null
        if (c.group === 'Dealer') return CUSTOMER_GROUPS.DEALER
        if (c.group === 'Commercial') return CUSTOMER_GROUPS.COMMERCIAL
        return null
    }

    salesTransactions.forEach(tx => {
        const groupType = getCustomerGroup(tx.customerName)
        if (!groupType) return

        const tiers = TIER_RULES[groupType]
        if (!tiers) return

        // Determine Tier based on Customer's Current Spend
        const cust = customers.find(c => c.name === tx.customerName)
        if (!cust) return

        const spend = parseFloat(cust.annualSpend) || 0
        const tier = tiers.find(t => spend >= t.minSpend)
        if (!tier) return // Should not happen if tiers cover 0

        const tName = tier.name
        const catName = tx.category

        if (!analysis[groupType]) analysis[groupType] = {}
        if (!analysis[groupType][tName]) analysis[groupType][tName] = {}
        if (!analysis[groupType][tName][catName]) analysis[groupType][tName][catName] = { rev: 0, cogs: 0 }

        analysis[groupType][tName][catName].rev += parseFloat(tx.amount) || 0
        analysis[groupType][tName][catName].cogs += parseFloat(tx.cogs) || 0
    })

    // Helper for safe float parsing
    const safeMult = (val) => {
        let d = parseFloat(val)
        if (isNaN(d)) return 1.0
        if (d < 0) return 0
        if (d > 1.5) return 1.5 // Cap at 1.5x List? (Actually discounts are usually < 1.0, but margins > 1.0. Here we want Multiplier of List)
        return parseFloat(d.toFixed(2))
    }

    // 3. Calculate Discounts per Category
    // We iterate ALL categories defined in the system, not just those with sales.
    categories.forEach(catObj => {
        const catName = catObj.name
        const group = getCategoryGroup(catName)

        // Universal Logic: "Rolled" products get special Flattening for Top 2 tiers
        const isRolled = group === 'Large Rolled Panel' || group === 'Small Rolled Panels'

        Object.keys(CUSTOMER_GROUPS).forEach(k => {
            const gType = CUSTOMER_GROUPS[k]
            const tiers = TIER_RULES[gType] // Ordered High to Low

            // A. Find Baseline (Obsidian) Multiplier
            // Target: We want a multiplier X such that Cost / (List * X) = Margin?
            // No, Multiplier = NetPrice / ListPrice.
            // And NetPrice = Revenue / Units? Or just maintain Historical Margin?
            // Formula: RealizedListMult = (Revenue / COGS)
            // But we want to express this relative to the *Category List Multiplier*.
            // ListPrice = Cost * ListMult.
            // NetPrice = Cost * RealizedListMult.
            // DiscountMult = NetPrice / ListPrice = (Cost * RealizedListMult) / (Cost * ListMult) = RealizedListMult / ListMult.

            // Get target List Multiplier from Strategy (Markup Tab)
            const listMarginMult = getListMultiplier(strategy, catName) // e.g. 1.50

            let baselineMult = 0.70 // Default start (30% off list)

            // Try to set baseline from History (Obsidian or Platinum)
            const obsData = analysis[gType]?.[tiers[0].name]?.[catName]
            const platData = tiers.length > 1 ? analysis[gType]?.[tiers[1].name]?.[catName] : null

            if (obsData && obsData.cogs > 0) {
                const realizedMarkup = obsData.rev / obsData.cogs
                baselineMult = realizedMarkup / listMarginMult
            } else if (platData && platData.cogs > 0) {
                const realizedMarkup = platData.rev / platData.cogs
                baselineMult = realizedMarkup / listMarginMult
            }

            // B. Enforce Floor on Baseline
            // Ensure even Obsidian pays enough to meet the Margin Floor
            const minMarginObs = getMarginFloor(group, 0, tiers.length)
            // NetPrice >= Cost / (1 - Margin)
            // ListPrice * Disc >= Cost / (1 - Margin)
            // Disc >= (Cost / ListPrice) / (1 - Margin)
            // Disc >= (1 / ListMult) / (1 - Margin)
            const floorMult = 1 / (listMarginMult * (1 - minMarginObs))

            if (baselineMult < floorMult) {
                baselineMult = parseFloat(floorMult.toFixed(2))
            }
            if (baselineMult > 1.0) baselineMult = 1.0

            // C. Apply Scaling Rules to All Tiers
            tiers.forEach((tier, idx) => {
                let multiplier = 1.0

                if (idx === 0) {
                    // Obsidian
                    multiplier = baselineMult
                } else if (idx === 1 && isRolled) {
                    // Platinum Rolled Exception: Same as Obsidian (Flat)
                    multiplier = baselineMult
                } else {
                    // Standard Scaling (+2% per step)
                    // If Rolled, we skipped a step (idx 1 was flat).
                    // So Gold (idx 2) is effectively + 1 step from baseline? 
                    // Previous logic: stepCount = isRolled ? (idx - 1) : idx.
                    // If Rolled: idx 1 (Plat) -> step 0 -> Base.
                    //            idx 2 (Gold) -> step 1 -> Base + 0.02.
                    // If Not Rolled: idx 1 (Plat) -> step 1 -> Base + 0.02.

                    const stepCount = isRolled ? (idx - 1) : idx
                    const stepUp = stepCount * 0.02
                    multiplier = baselineMult + stepUp
                }

                // Clamp
                if (multiplier > 1.0) multiplier = 1.0

                // Save to Strategy
                strategy.tierMultipliers[gType][tier.name][catName] = safeMult(multiplier)
            })
        })
    })

    // 4. Enforce Hierarchy (Safety Net)
    return enforceTierHierarchy(strategy)
}

import { calculateTier } from './pricingEngine'

/**
 * Calculates the impact of moving from Net Price to List Price + Discount.
 * 
 * @param {Array} customers List of customers with annualSpend
 * @param {Object} pricingStrategy contains { listMultipliers, tierMultipliers }
 * @param {Object} mix Category Mix (Revenue Share)
 */
export const calculateImpact = (customers, pricingStrategy, mix) => {
    let totalCurrentRevenue = 0
    let totalProjectedRevenue = 0

    // Impact per group
    const impactByGroup = {}

    // Extract Strategy Components for easier access
    // Fallbacks provided to prevent crash if strategy is malformed
    const listMultipliers = pricingStrategy?.listMultipliers || {}
    const tierMultipliers = pricingStrategy?.tierMultipliers || {}

    // Impact per customer
    const customerImpacts = customers.map(customer => {
        const tierName = calculateTier(customer.group, customer.annualSpend)
        const currentRevenue = customer.annualSpend || 0

        // Projected Revenue Calculation (Category Split)
        let projectedRevenue = 0

        // If no mix provided, or empty, assume 100% "General" (mapped to Default logic if exists)
        const activeCategories = Object.keys(mix || {})

        if (activeCategories.length === 0) {
            // [Fallback] If no categories, apply 'Default' multiplier if exists, else 1.5
            const defaultMarkup = listMultipliers['Default'] || 1.5
            // Discounts
            const groupDiscounts = tierMultipliers[customer.group] || {}
            const tierConfig = groupDiscounts[tierName] || {}
            const discount = tierConfig['Default'] || 0

            projectedRevenue = (currentRevenue * defaultMarkup) * (1 - discount)
        } else {
            // [USER FIX] Normalize Category Spend
            let totalRawCatSpend = 0
            if (customer.categorySpend) {
                totalRawCatSpend = Object.values(customer.categorySpend).reduce((a, b) => a + b, 0)
            }

            activeCategories.forEach(cat => {
                const catMix = mix[cat] || 0
                let effectiveCatSpend = 0

                if (customer.categorySpend && customer.categorySpend[cat] !== undefined && totalRawCatSpend > 0) {
                    // Use the RATIO from the category spend
                    const ratio = customer.categorySpend[cat] / totalRawCatSpend
                    effectiveCatSpend = currentRevenue * ratio
                } else {
                    // Fallback: Estimate using Global Mix
                    effectiveCatSpend = currentRevenue * catMix
                }

                // 1. Get List Price Markup
                // Try specific category, then Default, then 1.5
                const markup = listMultipliers[cat] || listMultipliers['Default'] || 1.5

                // 2. Get Tier Discount
                // Look up: TierRules -> CustomerGroup -> TierName -> Category
                const groupDiscounts = tierMultipliers[customer.group] || {}
                const tierConfig = groupDiscounts[tierName] || {}
                const discount = tierConfig[cat] || tierConfig['Default'] || 0

                projectedRevenue += (effectiveCatSpend * markup) * (1 - discount)
            })
        }

        const delta = projectedRevenue - currentRevenue

        totalCurrentRevenue += currentRevenue
        totalProjectedRevenue += projectedRevenue

        // Group Aggregation
        if (!impactByGroup[customer.group]) {
            impactByGroup[customer.group] = { current: 0, projected: 0, delta: 0, count: 0 }
        }
        impactByGroup[customer.group].current += currentRevenue
        impactByGroup[customer.group].projected += projectedRevenue
        impactByGroup[customer.group].delta += delta
        impactByGroup[customer.group].count += 1

        return {
            ...customer,
            tierName,
            currentRevenue,
            projectedRevenue,
            delta
        }
    })

    // Calculate Tier Counts
    const tierCounts = {}
    customerImpacts.forEach(c => {
        tierCounts[c.tierName] = (tierCounts[c.tierName] || 0) + 1
    })

    return {
        totalCurrentRevenue,
        totalProjectedRevenue,
        totalDelta: totalProjectedRevenue - totalCurrentRevenue,
        impactByGroup,
        tierCounts,
        customerImpacts: customerImpacts.sort((a, b) => a.delta - b.delta) // Losers first
    }
}

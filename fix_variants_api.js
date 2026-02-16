// Native Fetch in Node 18+

const MISSING_VARIANTS = [
    { name: 'FC36', gauges: [26, 29] },
    { name: 'I9', gauges: [24, 26, 29] },
    { name: 'II6', gauges: [26, 29] },
    { name: 'FR', gauges: [26, 29] },
    { name: 'FA', gauges: [24, 26] },
    { name: 'Forma Loc 12"', gauges: [26, 29] },
    { name: 'Forma Loc 16"', gauges: [26, 29] }
];

async function fixVariantsViaAPI() {
    try {
        console.log("Fetching Products via API...");
        const dataRes = await fetch('http://localhost:3001/api/data');
        if (!dataRes.ok) throw new Error(`Fetch failed: ${dataRes.status}`);

        const data = await dataRes.json();
        const products = data.products || [];
        const existingVariants = data.productVariants || [];

        const payload = [];

        for (const target of MISSING_VARIANTS) {
            // Find Product ID (Try strict then fuzzy)
            let product = products.find(p => p.name === target.name + ' Panel');
            if (!product) {
                product = products.find(p => p.name.includes(target.name));
            }
            if (!product) {
                console.warn(`Could not find product matching: ${target.name}`);
                continue;
            }

            console.log(`Matched: ${product.name} (ID: ${product.id})`);

            for (const gauge of target.gauges) {
                // Check if already exists in fetched variants
                const exists = existingVariants.some(v => v.productId === product.id && v.gauge == gauge);

                if (!exists) {
                    console.log(`  -> Adding ${gauge} Gauge`);

                    // Default Weights
                    let weight = 0;
                    if (gauge === 29) weight = 2.0;
                    if (gauge === 26) weight = 2.7;
                    if (gauge === 24) weight = 3.4;

                    payload.push({
                        productId: product.id,
                        gauge: gauge,
                        weight: weight,
                        priceOverride: 0 // Default
                    });
                } else {
                    console.log(`  -> ${gauge} Gauge already exists.`);
                }
            }
        }

        if (payload.length > 0) {
            console.log(`Inserting ${payload.length} variants...`);
            const saveRes = await fetch('http://localhost:3001/api/save/productVariants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!saveRes.ok) {
                const err = await saveRes.text();
                throw new Error(`Save failed: ${saveRes.status} ${err}`);
            }
            console.log("Variants Inserted Successfully via API.");
        } else {
            console.log("No new variants to insert.");
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

fixVariantsViaAPI();

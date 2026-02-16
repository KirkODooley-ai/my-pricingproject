// Native Fetch in Node 18+

async function debugAPI() {
    try {
        console.log("Fetching /api/data...");
        const res = await fetch('http://localhost:3001/api/data');
        if (!res.ok) throw new Error(`API Error: ${res.status} ${res.statusText}`);

        const data = await res.json();
        console.log("Keys returned:", Object.keys(data));

        const products = data.products || [];
        const variants = data.productVariants || [];

        console.log(`Total Products: ${products.length}`);
        console.log(`Total Variants: ${variants.length}`);

        // Check for specific products
        const targets = ['FC36', 'I9', 'II6', 'FR', 'Forma Loc'];

        targets.forEach(target => {
            const matches = products.filter(p => p.name.includes(target) || (p.itemCode && p.itemCode.includes(target)));
            console.log(`\n--- ${target} ---`);
            if (matches.length === 0) {
                console.log("No matching products found.");
            } else {
                matches.forEach(m => {
                    console.log(`Found Product: [${m.id}] ${m.name} (Cat: ${m.category})`);
                    // Check variants for this product ID
                    const prodVariants = variants.filter(v => v.productId === m.id);
                    if (prodVariants.length === 0) {
                        console.log("  -> NO VARIANTS found in productVariants array.");
                    } else {
                        prodVariants.forEach(v => console.log(`  -> Variant: ${v.gauge} Gauge (Wt: ${v.weight})`));
                    }
                });
            }
        });

    } catch (e) {
        console.error("Error:", e);
    }
}

debugAPI();

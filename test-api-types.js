// Native fetch is available in Node 18+
// No imports needed

async function checkTypes() {
    try {
        const res = await fetch('http://localhost:3001/api/data');
        const data = await res.json();

        console.log("Checking Data Types...");

        if (data.salesTransactions && data.salesTransactions.length > 0) {
            const tx = data.salesTransactions[0];
            console.log(`Sale Amount: ${tx.amount} (Type: ${typeof tx.amount})`);
        } else {
            console.log("No sales transactions found to check.");
        }

        if (data.customers && data.customers.length > 0) {
            const c = data.customers[0];
            console.log(`Customer Goal: ${c.annual_spend_goal} (Type: ${typeof c.annual_spend_goal})`);
        }

        if (data.categories && data.categories.length > 0) {
            const cat = data.categories[0];
            console.log(`Category Revenue: ${cat.revenue} (Type: ${typeof cat.revenue})`);
        }

    } catch (e) {
        console.error("Fetch failed:", e);
    }
}

checkTypes();

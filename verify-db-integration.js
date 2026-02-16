import { query, getClient } from './server/db.js';

async function testIntegration() {
    console.log("Testing Database Integration...");

    try {
        // 1. Test GET /api/data queries
        console.log("1. Testing GET queries...");

        // Products
        const prod = await query(`SELECT p.*, c.name as category FROM products p LEFT JOIN categories c ON p.category_id = c.id LIMIT 1`);
        console.log(`- Products: OK (${prod.rowCount} rows)`);

        // Customers
        const cust = await query('SELECT * FROM customers LIMIT 1');
        console.log(`- Customers: OK (${cust.rowCount} rows)`);

        // Sales
        const sales = await query(`
            SELECT st.*, COALESCE(c.name, st.customer_name_snapshot) as "customerName", COALESCE(cat.name, st.category_name_snapshot) as category
            FROM sales_transactions st
            LEFT JOIN customers c ON st.customer_id = c.id
            LEFT JOIN categories cat ON st.category_id = cat.id
            LIMIT 1
        `);
        console.log(`- Sales: OK (${sales.rowCount} rows)`);

        // Aliases
        const aliases = await query(`SELECT ca.alias_name, c.name as canonical_name FROM customer_aliases ca JOIN customers c ON ca.customer_id = c.id LIMIT 1`);
        console.log(`- Aliases: OK (${aliases.rowCount} rows)`);

        // Strategy
        const strat = await query('SELECT * FROM pricing_strategies WHERE is_active = TRUE LIMIT 1');
        console.log(`- Strategy: OK (${strat.rowCount} rows)`);

        // 2. Test UPSERT Logic (Dry Run/Validation)
        console.log("\n2. Testing SAVE (Upsert) Logic validity...");
        const client = await getClient();
        try {
            await client.query('BEGIN');

            // Test Product Upsert Syntax
            await client.query(`
                INSERT INTO products (id, item_code, name, description, category_id, vendor, cost, price, unit_cost, unit_price, bag_units, bag_cost, sell_unit, imported_margin)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
            `, ['test-id', 'test-code', 'Test Product', 'Desc', null, 'Vendor', 0, 0, 0, 0, 0, 0, 0, 0]);
            console.log("- Product Upsert SQL: Valid");

            await client.query('ROLLBACK'); // Don't actually keep test data
            console.log("Transaction Rolled Back (Clean State).");

        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        console.log("\nSUCCESS: All DB Integrations verified!");
        process.exit(0);

    } catch (error) {
        console.error("FAILURE:", error);
        process.exit(1);
    }
}

testIntegration();

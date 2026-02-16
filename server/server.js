
import express from 'express';
import cors from 'cors';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

// DB Connection
import { query } from './db.js';

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const ENTITIES = ['products', 'categories', 'customers', 'salesTransactions', 'pricingStrategy', 'customerAliases', 'productVariants'];


// GET ALL DATA
app.get('/api/data', async (req, res) => {
    try {
        const result = {};

        // 1. Products
        // Map snake_case -> camelCase for frontend
        const productsRes = await query(`
            SELECT 
                p.id, p.name, p.description, p.vendor, p.cost, p.price,
                p.item_code as "itemCode",
                p.category_id as "categoryId",
                p.sub_category as "subCategory",
                p.unit_cost as "unitCost",
                p.unit_price as "unitPrice",
                p.bag_units as "bagUnits",
                p.bag_cost as "bagCost",
                p.sell_unit as "sellUnit",
                p.imported_margin as "importedMargin",
                c.name as category 
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id
        `);
        result.products = productsRes.rows;

        // 2. Categories
        const catRes = await query(`
            SELECT 
                id, name, revenue, 
                material_cost as "materialCost"
            FROM categories 
            ORDER BY id
        `);
        result.categories = catRes.rows;

        // 3. Customers
        const custRes = await query(`
            SELECT 
                id, name, "group", territory, 
                annual_spend_goal as "annualSpend" 
            FROM customers 
            ORDER BY name
        `);
        result.customers = custRes.rows;

        // 4. Sales Transactions
        // Frontend expects 'customerName' and 'category'. Map SQL columns.
        const salesRes = await query(`
            SELECT 
                st.id, st.amount, st.cogs,
                st.customer_id as "customerId",
                st.category_id as "categoryId",
                st.transaction_date as "date",
                COALESCE(c.name, st.customer_name_snapshot) as "customerName",
                COALESCE(cat.name, st.category_name_snapshot) as category
            FROM sales_transactions st
            LEFT JOIN customers c ON st.customer_id = c.id
            LEFT JOIN categories cat ON st.category_id = cat.id
        `);
        result.salesTransactions = salesRes.rows;

        // 5. Pricing Strategy (Assuming single row)
        // [FIX] Always get the LATEST one (Highest ID) since updated_at column might be missing
        const stratRes = await query('SELECT * FROM pricing_strategies WHERE is_active = TRUE ORDER BY id DESC LIMIT 1');
        result.pricingStrategy = stratRes.rows[0]?.strategy_data || null;

        // 6. Customer Aliases (Convert table rows back to Key-Value object for frontend compatibility)
        const aliasRes = await query(`
            SELECT ca.alias_name, c.name as canonical_name 
            FROM customer_aliases ca
            JOIN customers c ON ca.customer_id = c.id
        `);

        result.customerAliases = {};
        aliasRes.rows.forEach(row => {
            result.customerAliases[row.alias_name] = row.canonical_name;
        });

        // 7. Product Variants
        try {
            const varRes = await query(`
                SELECT id, product_id as "productId", gauge, weight_lbs_ft as "weight", price_override as "priceOverride"
                FROM product_variants
                WHERE is_active = TRUE
            `);
            result.productVariants = varRes.rows;
        } catch (e) {
            console.warn("Product variants table might not exist yet:", e.message);
            result.productVariants = [];
        }

        res.json(result);
    } catch (error) {
        console.error('Load Error:', error);
        res.status(500).json({ error: 'Failed to load data from DB' });
    }
});

// SAVE DATA
// SAVE DATA with BACKUP
// SAVE DATA (Upsert Logic)
app.post('/api/save/:type', async (req, res) => {
    const { type } = req.params;
    const data = req.body;

    // Basic validation
    if (!ENTITIES.includes(type)) {
        return res.status(400).json({ error: 'Invalid entity type' });
    }

    const client = await import('./db.js').then(m => m.getClient());

    try {
        await client.query('BEGIN');

        if (type === 'products') {
            for (const item of data) {
                // Determine Category ID from Name if needed, or use existing ID.
                let catId = item.categoryId || item.category_id; // Handle both
                if (!catId && item.category) {
                    const catRes = await client.query('SELECT id FROM categories WHERE name = $1', [item.category]);
                    if (catRes.rows.length > 0) catId = catRes.rows[0].id;
                }

                await client.query(`
                    INSERT INTO products (id, item_code, name, description, category_id, vendor, cost, price, unit_cost, unit_price, bag_units, bag_cost, sell_unit, imported_margin)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                    ON CONFLICT (id) DO UPDATE SET
                        item_code = EXCLUDED.item_code,
                        name = EXCLUDED.name,
                        description = EXCLUDED.description,
                        category_id = EXCLUDED.category_id,
                        vendor = EXCLUDED.vendor,
                        cost = EXCLUDED.cost,
                        price = EXCLUDED.price,
                        unit_cost = EXCLUDED.unit_cost,
                        unit_price = EXCLUDED.unit_price,
                        bag_units = EXCLUDED.bag_units,
                        bag_cost = EXCLUDED.bag_cost,
                        sell_unit = EXCLUDED.sell_unit,
                        imported_margin = EXCLUDED.imported_margin,
                        updated_at = CURRENT_TIMESTAMP
                `, [
                    item.id,
                    item.itemCode || item.item_code,
                    item.name,
                    item.description,
                    catId,
                    item.vendor,
                    item.cost || 0,
                    item.price || 0,
                    item.unitCost || item.unit_cost,
                    item.unitPrice || item.unit_price,
                    item.bagUnits || item.bag_units,
                    item.bagCost || item.bag_cost,
                    item.sellUnit || item.sell_unit,
                    item.importedMargin || item.imported_margin
                ]);
            }
        }
        else if (type === 'customers') {
            for (const item of data) {
                await client.query(`
                    INSERT INTO customers (id, name, "group", territory, annual_spend_goal)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        "group" = EXCLUDED."group",
                        territory = EXCLUDED.territory,
                        annual_spend_goal = EXCLUDED.annual_spend_goal,
                        updated_at = CURRENT_TIMESTAMP
                `, [
                    item.id,
                    item.name,
                    item.group,
                    item.territory,
                    item.annualSpend || item.annual_spend_goal || 0
                ]);
            }
        }
        else if (type === 'categories') {
            for (const item of data) {
                await client.query(`
                    INSERT INTO categories (id, name, revenue, material_cost)
                    VALUES ($1, $2, $3, $4)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        revenue = EXCLUDED.revenue,
                        material_cost = EXCLUDED.material_cost,
                        updated_at = CURRENT_TIMESTAMP
                `, [
                    item.id,
                    item.name,
                    item.revenue || 0,
                    item.materialCost || item.material_cost || 0
                ]);
            }
        }
        else if (type === 'salesTransactions') {
            for (const item of data) {
                // Lookup Customer ID & Category ID
                let custId = item.customerId || item.customer_id;
                if (!custId && item.customerName) {
                    const cRes = await client.query('SELECT id FROM customers WHERE name = $1', [item.customerName]);
                    if (cRes.rows.length > 0) custId = cRes.rows[0].id;
                }

                let catId = item.categoryId || item.category_id;
                if (!catId && item.category) {
                    const catRes = await client.query('SELECT id FROM categories WHERE name = $1', [item.category]);
                    if (catRes.rows.length > 0) catId = catRes.rows[0].id;
                }

                await client.query(`
                    INSERT INTO sales_transactions (id, customer_id, customer_name_snapshot, category_id, category_name_snapshot, amount, cogs, transaction_date)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (id) DO UPDATE SET
                        customer_id = EXCLUDED.customer_id,
                        amount = EXCLUDED.amount,
                        cogs = EXCLUDED.cogs,
                        transaction_date = EXCLUDED.transaction_date,
                        updated_at = CURRENT_TIMESTAMP
                `, [
                    item.id,
                    custId,
                    item.customerName, // Snapshot
                    catId,
                    item.category, // Snapshot
                    item.amount || 0,
                    item.cogs || 0,
                    item.date || item.transaction_date // Correct property name from frontend is 'date'
                ]);
            }
        }
        else if (type === 'customerAliases') {
            // Full replace for aliases is safest/easiest as it's a small map
            await client.query('DELETE FROM customer_aliases');
            for (const [alias, canonical] of Object.entries(data)) {
                // We need customer_id for the canonical name
                const cRes = await client.query('SELECT id FROM customers WHERE name = $1', [canonical]);
                if (cRes.rows.length > 0) {
                    await client.query(`
                        INSERT INTO customer_aliases (customer_id, alias_name)
                        VALUES ($1, $2)
                     `, [cRes.rows[0].id, alias]);
                }
            }
        }
        else if (type === 'pricingStrategy') {
            // [FIX] Upsert Logic: Check for active strategy (Latest by ID), Update if exists, else Insert.
            const check = await client.query('SELECT id FROM pricing_strategies WHERE is_active = TRUE ORDER BY id DESC LIMIT 1');

            if (check.rows.length > 0) {
                // Update existing - removed updated_at column
                await client.query(
                    'UPDATE pricing_strategies SET strategy_data = $1 WHERE id = $2',
                    [JSON.stringify(data), check.rows[0].id]
                );
            } else {
                // Insert new
                await client.query(
                    "INSERT INTO pricing_strategies (name, strategy_data, is_active) VALUES ('Default Strategy', $1, TRUE)",
                    [JSON.stringify(data)]
                );
            }
        }
        else if (type === 'productVariants') {
            for (const item of data) {
                // Upsert Variant
                // We use product_id + gauge as unique key usually, unless we have ID.
                // Assuming payload has productId, gauge, weight, priceOverride
                if (item.productId && item.gauge) {
                    await client.query(`
                        INSERT INTO product_variants (product_id, gauge, weight_lbs_ft, price_override)
                        VALUES ($1, $2, $3, $4)
                        ON CONFLICT (product_id, gauge) DO UPDATE SET
                            weight_lbs_ft = EXCLUDED.weight_lbs_ft,
                            price_override = EXCLUDED.price_override,
                            updated_at = CURRENT_TIMESTAMP
                    `, [
                        item.productId,
                        item.gauge,
                        item.weight || 0,
                        item.priceOverride
                    ]);
                }
            }
        }

        await client.query('COMMIT');
        console.log(`Saved ${type} to Database.`);
        res.json({ success: true });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Save Error (${type}):`, error);
        res.status(500).json({ error: 'Failed to save data' });
    } finally {
        client.release();
    }
});

// RESET DATA
// RESET DATA with BACKUP
app.post('/api/reset', async (req, res) => {
    try {
        // 1. Create System-Wide Backup
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupRoot = path.join(DATA_DIR, 'backups', 'RESET_SAFETY', timestamp);
        await fs.ensureDir(backupRoot);

        for (const entity of ENTITIES) {
            const filePath = getFilePath(entity);
            if (await fs.pathExists(filePath)) {
                await fs.copy(filePath, path.join(backupRoot, `${entity}.json`));
            }
        }
        console.log(`Safety Backup for Reset created at: ${backupRoot}`);

        // 2. Clear Data (Preserve Backups folder)
        // We only delete entity files, not the whole dir which contains backups
        for (const entity of ENTITIES) {
            await fs.remove(getFilePath(entity));
        }

        res.json({ success: true });
    } catch (error) {
        console.error("Reset Error:", error);
        res.status(500).json({ error: 'Failed to reset data' });
    }
});

app.listen(PORT, () => {
    console.log(`Local Database Server running at http://localhost:${PORT}`);
    console.log(`Connected to PostgreSQL on port ${process.env.PGPORT || 3006}`);
});

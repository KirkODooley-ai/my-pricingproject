import express from 'express';
import cors from 'cors';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3001; // [FIX] Use Railway's dynamic port
// DB Connection
import { query, killZombieConnections } from './db.js';
app.use(cors());
app.use(express.json({ limit: '50mb' }));
const ENTITIES = ['products', 'categories', 'customers', 'salesTransactions', 'pricingStrategy', 'customerAliases', 'productVariants', 'settings', 'users', 'proposals'];
// [NEW] Auth Dependencies
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
// [NEW] Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

// [NEW] Master Gate: Block POST/PUT/PATCH/DELETE if can_edit is false (Admins bypass)
const requireCanEdit = (req, res, next) => {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    if (req.user?.role === 'admin') return next();
    if (req.user?.can_edit === true) return next();
    return res.status(403).json({ error: 'You do not have permission to make changes.' });
};
// [NEW] Login Route
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await query('SELECT * FROM users WHERE username = $1', [username]);
        if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
        const user = result.rows[0];
        if (user.is_active === false) return res.status(401).json({ error: 'Account is deactivated' });
        if (await bcrypt.compare(password, user.password_hash)) {
            // Parse permissions for login response and JWT (JSONB may be array or need parsing)
            let perms = user.permissions;
            if (typeof perms === 'string') try { perms = JSON.parse(perms); } catch { perms = []; }
            if (!Array.isArray(perms)) perms = [];
            // Parse regions (sales territory)
            let regions = user.regions;
            if (typeof regions === 'string') try { regions = JSON.parse(regions); } catch { regions = []; }
            if (!Array.isArray(regions)) regions = [];
            // Admin role: if no permissions in DB, use full set (backward compat)
            if (user.role === 'admin' && perms.length === 0) {
                perms = ['view_costs', 'edit_pricing', 'submit_proposals', 'approve_proposals', 'manage_users', 'view_all_regions', 'view_variance_report', 'view_margin_alerts', 'view_transition_analysis', 'import_data'];
            }
            // can_edit: Admins always true; others use DB value (default false if column missing)
            const canEdit = user.role === 'admin' || user.can_edit === true;
            // Create Token (include can_edit and regions for backend middleware)
            const token = jwt.sign(
                { id: user.id, username: user.username, role: user.role, region: user.region, regions, permissions: perms, can_edit: canEdit },
                JWT_SECRET,
                { expiresIn: '8h' }
            );
            res.json({ token, user: { id: user.id, username: user.username, role: user.role, region: user.region, regions, permissions: perms, can_edit: canEdit } });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (e) {
        console.error("Login Error:", e);
        res.status(500).json({ error: 'Server error' });
    }
});
// GET ALL DATA (Protected)
app.get('/api/data', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        const isAdmin = user.role === 'admin';
        const isManager = user.role === 'manager';
        const result = {};
        // 1. Products
        // RBAC: Managers cannot see Costs or Imported Margin
        const productFields = isManager
            ? `p.id, p.name, p.description, p.vendor, 
               p.price, p.item_code as "itemCode", p.category_id as "categoryId", 
               p.sub_category as "subCategory", p.unit_price as "unitPrice", 
               p.bag_units as "bagUnits", p.sell_unit as "sellUnit",
               p.margin_floor as "marginFloor", p.margin_ceiling as "marginCeiling",
               c.name as category`
            : `p.id, p.name, p.description, p.vendor, p.cost, p.price,
               p.item_code as "itemCode", p.category_id as "categoryId",
               p.sub_category as "subCategory", p.unit_cost as "unitCost",
               p.unit_price as "unitPrice", p.bag_units as "bagUnits",
               p.bag_cost as "bagCost", p.sell_unit as "sellUnit",
               p.imported_margin as "importedMargin",
               p.margin_floor as "marginFloor", p.margin_ceiling as "marginCeiling",
               c.name as category`;
        const productsRes = await query(`
            SELECT ${productFields}
            FROM products p 
            LEFT JOIN categories c ON p.category_id = c.id
        `);
        result.products = productsRes.rows;
        // 2. Categories
        // RBAC: Managers cannot see material_cost
        const catFields = isManager
            ? `id, name, revenue`
            : `id, name, revenue, material_cost as "materialCost",
               COALESCE(total_footage, 0) as "totalFootage",
               COALESCE(quantity, 0) as "quantity",
               COALESCE(labor_percentage, 0) as "laborPercentage",
               COALESCE(labor_cost, 0) as "laborCost"`;
        const catRes = await query(`SELECT ${catFields} FROM categories ORDER BY id`);
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
        // RBAC: Managers only see their Region (Territory)
        let salesQuery = `
            SELECT 
                st.id, st.amount, st.cogs,
                st.customer_id as "customerId",
                st.category_id as "categoryId",
                st.transaction_date as "date",
                COALESCE(c.name, st.customer_name_snapshot) as "customerName",
                COALESCE(cat.name, st.category_name_snapshot) as category,
                c.territory -- Needed for filtering
            FROM sales_transactions st
            LEFT JOIN customers c ON st.customer_id = c.id
            LEFT JOIN categories cat ON st.category_id = cat.id
        `;
        let salesParams = [];
        const userRegions = Array.isArray(user.regions) && user.regions.length > 0 ? user.regions : (user.region ? [user.region] : []);
        if (userRegions.length > 0 && (isManager || ['outside_sales', 'sales_manager', 'sales_support'].includes(user.role))) {
            salesQuery += ` WHERE c.territory = ANY($1::text[])`;
            salesParams.push(userRegions);
        }
        const salesRes = await query(salesQuery, salesParams);
        result.salesTransactions = salesRes.rows;
        // 5. Pricing Strategy
        const stratRes = await query('SELECT * FROM pricing_strategies WHERE is_active = TRUE ORDER BY id DESC LIMIT 1');
        result.pricingStrategy = stratRes.rows[0]?.strategy_data || null;
        // 6. Customer Aliases
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
            result.productVariants = [];
        }
        // 8. Settings
        try {
            const settingsRes = await query('SELECT key, value FROM settings');
            result.settings = settingsRes.rows;
        } catch (e) {
            result.settings = [];
        }
        // 8b. Margin Rules (Product Line + Gauge level)
        try {
            const mrRes = await query(`
                SELECT id, target_name as "targetName", gauge, margin_floor as "marginFloor", margin_ceiling as "marginCeiling"
                FROM margin_rules ORDER BY target_name, gauge NULLS FIRST
            `);
            result.marginRules = mrRes.rows;
        } catch (e) {
            result.marginRules = [];
        }
        // 9. Proposals (Admins Only)
        if (isAdmin) {
            const proposalsRes = await query(`
                SELECT p.id, p.type, p.data, p.status, p.created_at, u.username 
                FROM proposals p
                JOIN users u ON p.user_id = u.id
                WHERE p.status = 'pending'
            `);
            result.proposals = proposalsRes.rows;
        }
        res.json(result);
    } catch (error) {
        console.error('Load Error:', error);
        res.status(500).json({ error: error.message });
    }
});
// SAVE DATA
// [NEW] Proposal Submission (Analyst)
app.post('/api/proposals', authenticateToken, requireCanEdit, async (req, res) => {
    try {
        if (req.user.role !== 'analyst') return res.status(403).json({ error: 'Only analysts can submit proposals' });
        const { type, data } = req.body;
        await query(
            'INSERT INTO proposals (user_id, type, data, status) VALUES ($1, $2, $3, $4)',
            [req.user.id, type, { strategy: data }, 'pending']
        );
        res.json({ success: true, message: 'Proposal submitted for approval.' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// [NEW] Proposal Approval (Admin)
app.post('/api/proposals/:id/approve', authenticateToken, requireCanEdit, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can approve proposals' });
        const { id } = req.params;
        const result = await query('SELECT * FROM proposals WHERE id = $1', [id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Proposal not found' });
        const proposal = result.rows[0];
        // Execute the change
        if (proposal.type === 'pricingStrategy') {
            await query(
                'INSERT INTO pricing_strategies (strategy_data, is_active) VALUES ($1, TRUE)',
                [proposal.data.strategy]
            );
        }
        // Mark as approved (Set status to 'approved')
        await query("UPDATE proposals SET status = 'approved' WHERE id = $1", [id]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.post('/api/save/:type', authenticateToken, requireCanEdit, async (req, res) => {
    const { type } = req.params;
    const user = req.user;
    // RBAC: Manager cannot save global strategy
    if (user.role === 'manager' && type === 'pricingStrategy') {
        return res.status(403).json({ error: 'Managers cannot edit pricing strategy.' });
    }
    // RBAC: Analyst cannot save directly
    if (user.role === 'analyst' && type === 'pricingStrategy') {
        return res.status(403).json({ error: 'Analysts must submit proposals.' });
    }
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
                    INSERT INTO products (id, item_code, name, description, category_id, vendor, cost, price, unit_cost, unit_price, bag_units, bag_cost, sell_unit, imported_margin, margin_floor, margin_ceiling)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
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
                        margin_floor = EXCLUDED.margin_floor,
                        margin_ceiling = EXCLUDED.margin_ceiling,
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
                    item.importedMargin || item.imported_margin,
                    item.marginFloor ?? item.margin_floor ?? null,
                    item.marginCeiling ?? item.margin_ceiling ?? null
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
                    INSERT INTO categories (id, name, revenue, material_cost, total_footage, quantity, labor_percentage, labor_cost)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        revenue = EXCLUDED.revenue,
                        material_cost = EXCLUDED.material_cost,
                        total_footage = COALESCE(EXCLUDED.total_footage, 0),
                        quantity = COALESCE(EXCLUDED.quantity, 0),
                        labor_percentage = COALESCE(EXCLUDED.labor_percentage, 0),
                        labor_cost = COALESCE(EXCLUDED.labor_cost, 0),
                        updated_at = CURRENT_TIMESTAMP
                `, [
                    item.id,
                    item.name,
                    item.revenue || 0,
                    item.materialCost || item.material_cost || 0,
                    item.totalFootage ?? item.total_footage ?? 0,
                    item.quantity ?? 0,
                    item.laborPercentage ?? item.labor_percentage ?? 0,
                    item.laborCost ?? item.labor_cost ?? 0
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
app.post('/api/reset', authenticateToken, requireCanEdit, async (req, res) => {
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
// [NEW] Paginated Sales Endpoint
app.get('/api/sales', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;
        const category = req.query.category;
        const search = req.query.search;
        let queryText = `
            SELECT 
                st.id, st.amount, st.cogs, st.transaction_date as "date",
                COALESCE(c.name, st.customer_name_snapshot) as "customerName",
                COALESCE(cat.name, st.category_name_snapshot) as "category", 
                st.customer_name_snapshot as "rawCustomer",
                st.category_name_snapshot as "rawCategory"
            FROM sales_transactions st
            LEFT JOIN customers c ON st.customer_id = c.id
            LEFT JOIN categories cat ON st.category_id = cat.id
        `;
        const params = [];
        const conditions = [];
        if (category && category !== 'All') {
            conditions.push(`(cat.name = $${params.length + 1} OR st.category_name_snapshot = $${params.length + 1})`);
            params.push(category);
        }
        if (search) {
            conditions.push(`(
                LOWER(COALESCE(c.name, st.customer_name_snapshot)) LIKE $${params.length + 1} OR
                LOWER(st.customer_name_snapshot) LIKE $${params.length + 1}
            )`);
            params.push(`%${search.toLowerCase()}%`);
        }
        if (conditions.length > 0) {
            queryText += ' WHERE ' + conditions.join(' AND ');
        }
        // Count Total
        const countRes = await query(`SELECT COUNT(*) FROM (${queryText}) as sub`, params);
        const total = parseInt(countRes.rows[0].count);
        // Fetch Page
        queryText += ` ORDER BY st.transaction_date DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);
        const dataRes = await query(queryText, params);
        res.json({
            data: dataRes.rows,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (e) {
        console.error("Sales API Error:", e);
        res.status(500).json({ error: e.message });
    }
});
// [NEW] Settings API
app.get('/api/settings', async (req, res) => {
    try {
        const result = await query('SELECT key, value FROM settings');
        res.json(result.rows);
    } catch (e) {
        console.error("Settings Fetch Error:", e);
        res.status(500).json({ error: e.message });
    }
});
app.post('/api/settings', authenticateToken, requireCanEdit, async (req, res) => {
    try {
        const { key, value } = req.body;
        if (!key || value === undefined) {
            return res.status(400).json({ error: 'Missing key or value' });
        }
        await query(`
            INSERT INTO settings (key, value, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (key) DO UPDATE 
            SET value = EXCLUDED.value, updated_at = NOW()
        `, [key, { value }]); // Store value wrapped in object for extensibility
        res.json({ success: true, key, value });
    } catch (e) {
        console.error("Settings Update Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// Margin Rules (Product Line + Gauge level) - Admin only
app.post('/api/margin-rules', authenticateToken, requireCanEdit, async (req, res) => {
    const client = await import('./db.js').then(m => m.getClient());
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can update margin rules.' });
        }
        const data = Array.isArray(req.body) ? req.body : req.body.rules || [];
        await client.query('BEGIN');
        for (const r of data) {
            const targetName = r.targetName || r.target_name || r.target;
            const gauge = r.gauge != null && r.gauge !== '' ? parseInt(r.gauge, 10) : null;
            const floor = r.marginFloor != null && r.marginFloor !== '' ? parseFloat(r.marginFloor) : 0.2;
            const ceiling = r.marginCeiling != null && r.marginCeiling !== '' ? parseFloat(r.marginCeiling) : null;
            if (!targetName) continue;
            const up = await client.query(`
                UPDATE margin_rules SET margin_floor = $1, margin_ceiling = $2, updated_at = CURRENT_TIMESTAMP
                WHERE target_name = $3 AND (gauge IS NOT DISTINCT FROM $4)
            `, [floor, ceiling, targetName, gauge]);
            if (up.rowCount === 0) {
                await client.query(`
                    INSERT INTO margin_rules (target_name, gauge, margin_floor, margin_ceiling)
                    VALUES ($1, $2, $3, $4)
                `, [targetName, gauge, floor, ceiling]);
            }
        }
        await client.query('COMMIT');
        res.json({ success: true });
    } catch (e) {
        await client.query('ROLLBACK').catch(() => {});
        console.error("Margin Rules Update Error:", e);
        res.status(500).json({ error: e.message });
    } finally {
        client.release();
    }
});

// Customer alias: link transaction name (alias) to canonical customer - upsert for persistence
app.post('/api/customer-aliases', authenticateToken, requireCanEdit, async (req, res) => {
    try {
        const { aliasName, alias_name, canonicalId, canonical_id, canonicalName, canonical_name } = req.body;
        const alias = (aliasName || alias_name || '').trim();
        let custId = canonicalId || canonical_id;
        const canonical = (canonicalName || canonical_name || '').trim();

        if (!alias) return res.status(400).json({ error: 'aliasName is required' });

        if (!custId && canonical) {
            const cRes = await query('SELECT id FROM customers WHERE name = $1', [canonical]);
            if (cRes.rows.length === 0) return res.status(404).json({ error: 'Canonical customer not found' });
            custId = cRes.rows[0].id;
        }
        if (!custId) return res.status(400).json({ error: 'canonicalId or canonicalName is required' });

        await query(`
            INSERT INTO customer_aliases (alias_name, customer_id)
            VALUES ($1, $2)
            ON CONFLICT (alias_name) DO UPDATE SET customer_id = EXCLUDED.customer_id
        `, [alias, custId]);

        res.json({ success: true });
    } catch (e) {
        console.error('Customer Alias Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// Admin-only: Update per-product margin bounds (and optionally price) with server-side validation
app.put('/api/admin/products/:id', authenticateToken, requireCanEdit, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Only admins can update product margin bounds.' });
        }

        const { id } = req.params;
        const {
            marginFloor,
            marginCeiling,
            price,
            cost,
        } = req.body;

        // Load current product to derive missing values
        const currentRes = await query(
            'SELECT cost, price, margin_floor, margin_ceiling FROM products WHERE id = $1',
            [id]
        );
        if (currentRes.rowCount === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }
        const current = currentRes.rows[0];

        const newCost = typeof cost === 'number' ? cost : (typeof cost === 'string' ? parseFloat(cost) : current.cost || 0);
        const newPrice = typeof price === 'number' ? price : (typeof price === 'string' ? parseFloat(price) : current.price || 0);

        const newMarginFloor = marginFloor !== undefined && marginFloor !== null
            ? Number(marginFloor)
            : current.margin_floor;
        const newMarginCeiling = marginCeiling !== undefined && marginCeiling !== null
            ? Number(marginCeiling)
            : current.margin_ceiling;

        if (newPrice <= 0 || newCost < 0) {
            return res.status(400).json({ error: 'Invalid cost or price values.' });
        }

        const margin = (newPrice - newCost) / newPrice;

        if (newMarginFloor != null && margin < newMarginFloor) {
            return res.status(400).json({
                error: 'Price would result in margin below configured floor.',
                details: { margin, marginFloor: newMarginFloor }
            });
        }

        if (newMarginCeiling != null && margin > newMarginCeiling) {
            return res.status(400).json({
                error: 'Price would result in margin above configured ceiling.',
                details: { margin, marginCeiling: newMarginCeiling }
            });
        }

        await query(
            `
            UPDATE products
            SET margin_floor = $1,
                margin_ceiling = $2,
                cost = $3,
                price = $4,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $5
            `,
            [
                newMarginFloor,
                newMarginCeiling,
                newCost,
                newPrice,
                id
            ]
        );

        res.json({ success: true });
    } catch (e) {
        console.error('Admin Product Update Error:', e);
        res.status(500).json({ error: e.message });
    }
});

// [NEW] Users API (Admin only)
app.get('/api/users', authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can list users' });
        let result;
        try {
            result = await query(
                'SELECT id, username, role, region, is_active as "isActive", permissions, COALESCE(can_edit, false) as "canEdit", COALESCE(regions, \'[]\')::jsonb as "regions", created_at as "createdAt" FROM users ORDER BY username'
            );
            // Ensure permissions and regions are always arrays (pg returns JSONB parsed; handle null/string)
            result.rows = result.rows.map(r => {
                let perms = r.permissions;
                if (typeof perms === 'string') try { perms = JSON.parse(perms); } catch { perms = []; }
                if (!Array.isArray(perms)) perms = [];
                let regions = r.regions;
                if (typeof regions === 'string') try { regions = JSON.parse(regions); } catch { regions = []; }
                if (!Array.isArray(regions)) regions = [];
                return { ...r, permissions: perms, regions };
            });
        } catch (colErr) {
            if (colErr.message && (colErr.message.includes('is_active') || colErr.message.includes('permissions') || colErr.message.includes('can_edit') || colErr.message.includes('regions'))) {
                result = await query(
                    'SELECT id, username, role, region, created_at as "createdAt" FROM users ORDER BY username'
                );
                result.rows = result.rows.map(r => ({ ...r, isActive: true, permissions: [], canEdit: r.role === 'admin', regions: [] }));
            } else throw colErr;
        }
        res.json(result.rows);
    } catch (e) {
        console.error("Users GET Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/users', authenticateToken, requireCanEdit, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can create users' });
        const { username, password, role, region, regions, permissions, canEdit } = req.body;
        if (!username || !password || !role) {
            return res.status(400).json({ error: 'Username, password, and role are required' });
        }
        const password_hash = await bcrypt.hash(password, 10);
        const permsJson = JSON.stringify(Array.isArray(permissions) ? permissions : []);
        const regionsJson = JSON.stringify(Array.isArray(regions) ? regions : []);
        const canEditVal = role === 'admin' ? true : !!canEdit;
        try {
            await query(
                'INSERT INTO users (username, password_hash, role, region, regions, permissions, can_edit) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)',
                [username.trim(), password_hash, role, region || null, regionsJson, permsJson, canEditVal]
            );
        } catch (colErr) {
            if (colErr.message && (colErr.message.includes('permissions') || colErr.message.includes('can_edit') || colErr.message.includes('regions'))) {
                await query(
                    'INSERT INTO users (username, password_hash, role, region) VALUES ($1, $2, $3, $4)',
                    [username.trim(), password_hash, role, region || null]
                );
            } else throw colErr;
        }
        res.json({ success: true });
    } catch (e) {
        if (e.code === '23505') return res.status(400).json({ error: 'Username already exists' });
        if (e.code === '23514') return res.status(400).json({ error: 'Invalid role or region value' });
        console.error("Users POST Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// PATCH user (update role, region, permissions, password, is_active)
app.patch('/api/users/:id', authenticateToken, requireCanEdit, async (req, res) => {
    try {
        if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only admins can update users' });
        const { id } = req.params;
        const { username, password, role, region, regions, permissions, isActive, canEdit } = req.body;

        const updates = [];
        const values = [];
        let idx = 1;

        if (username !== undefined) { updates.push(`username = $${idx++}`); values.push(String(username).trim()); }
        if (role !== undefined) { updates.push(`role = $${idx++}`); values.push(role); }
        if (region !== undefined) { updates.push(`region = $${idx++}`); values.push(region || null); }
        if (regions !== undefined) { updates.push(`regions = $${idx++}::jsonb`); values.push(JSON.stringify(Array.isArray(regions) ? regions : [])); }
        if (permissions !== undefined) { updates.push(`permissions = $${idx++}::jsonb`); values.push(JSON.stringify(Array.isArray(permissions) ? permissions : [])); }
        if (isActive !== undefined) { updates.push(`is_active = $${idx++}`); values.push(!!isActive); }
        if (canEdit !== undefined) { updates.push(`can_edit = $${idx++}`); values.push(role === 'admin' ? true : !!canEdit); }
        if (password !== undefined && password !== '') {
            const password_hash = await bcrypt.hash(password, 10);
            updates.push(`password_hash = $${idx++}`);
            values.push(password_hash);
        }

        if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

        values.push(id);
        const setClause = updates.join(', ');
        const fullQuery = `UPDATE users SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx}`;
        const fallbackUpdates = [];
        const fallbackValues = [];
        let fi = 1;
        if (username !== undefined) { fallbackUpdates.push(`username = $${fi++}`); fallbackValues.push(String(username).trim()); }
        if (role !== undefined) { fallbackUpdates.push(`role = $${fi++}`); fallbackValues.push(role); }
        if (region !== undefined) { fallbackUpdates.push(`region = $${fi++}`); fallbackValues.push(region || null); }
        if (password !== undefined && password !== '') {
            const password_hash = await bcrypt.hash(password, 10);
            fallbackUpdates.push(`password_hash = $${fi++}`);
            fallbackValues.push(password_hash);
        }
        fallbackValues.push(id);

        try {
            await query(fullQuery, values);
        } catch (colErr) {
            const msg = colErr.message || '';
            if (msg.includes('updated_at') || msg.includes('permissions') || msg.includes('is_active') || msg.includes('can_edit') || msg.includes('regions')) {
                if (fallbackUpdates.length === 0) {
                    return res.status(400).json({
                        error: 'User management upgrade required. Run: npm run migrate:users'
                    });
                }
                await query(
                    `UPDATE users SET ${fallbackUpdates.join(', ')} WHERE id = $${fi}`,
                    fallbackValues
                );
            } else throw colErr;
        }
        res.json({ success: true });
    } catch (e) {
        if (e.code === '23505') return res.status(400).json({ error: 'Username already exists' });
        if (e.code === '23514') return res.status(400).json({ error: 'Invalid role or region value' });
        console.error("Users PATCH Error:", e);
        const msg = e.message || 'Failed to update user';
        res.status(500).json({ error: msg.includes('column') ? 'Run migration: npm run migrate:users' : msg });
    }
});

// DELETE user (requires MANAGE_USERS permission or admin role)
app.delete('/api/users/:id', authenticateToken, requireCanEdit, async (req, res) => {
    try {
        const canManage = req.user.role === 'admin' || (Array.isArray(req.user.permissions) && req.user.permissions.includes('manage_users'));
        if (!canManage) return res.status(403).json({ error: 'manage_users permission required to delete users' });
        const { id } = req.params;
        const targetId = parseInt(id, 10);
        if (Number(req.user.id) === targetId) return res.status(400).json({ error: 'You cannot delete your own account' });
        // Remove proposals referencing this user first (avoids FK violation)
        await query('DELETE FROM proposals WHERE user_id = $1', [targetId]);
        const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [targetId]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ success: true });
    } catch (e) {
        console.error("Users DELETE Error:", e);
        const msg = e.message || 'Failed to delete user';
        res.status(500).json({ error: msg });
    }
});

// [NEW] Serve Static Files (Production) - MOVED TO BOTTOM
// [NEW] Serve Static Files (ALWAYS for debugging/production) - MOVED TO BOTTOM
const distPath = path.resolve(__dirname, '..', 'dist'); // [FIX] Explicit path segments
console.log(`[Static] Serving static files from: ${distPath}`);

if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));

    // Handle React Routing
    // [FIX] Express 5.x: Use Regex for catch-all to avoid "Missing parameter name" error
    app.get(/.*/, (req, res) => {
        // Exclude API routes from React routing
        if (req.path.startsWith('/api')) {
            return res.status(404).json({ error: 'API Endpoint Not Found' });
        }

        const indexPath = path.join(distPath, 'index.html');
        if (fs.existsSync(indexPath)) {
            res.sendFile(indexPath);
        } else {
            console.error(`[Error] index.html not found at ${indexPath}`);
            res.status(500).send('Application Build Not Found (index.html missing)');
        }
    });
} else {
    console.error(`[Error] Dist folder not found at ${distPath}. Did 'npm run build' run?`);
}
const HOST = '0.0.0.0'; // [FIX] Required for Railway/Render
app.listen(PORT, HOST, async () => {
    console.log(`API Server running at http://${HOST}:${PORT}`);
    if (process.env.DATABASE_URL) {
        console.log(`Connected to Cloud Database (Neon)`);
        // [FIX] Wrap in try/catch to prevent server crash on startup connectivity issues
        try {
            await killZombieConnections();
        } catch (e) {
            console.warn("⚠ Failed to cleanup zombie connections on startup:", e.message);
        }
    } else {
        console.log(`Connected to Local PostgreSQL on port ${process.env.PGPORT || 3006}`);
    }
});
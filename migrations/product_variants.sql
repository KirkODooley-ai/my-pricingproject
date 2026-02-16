
-- Migration: Support for Product Variants (Gauges)
-- Goal: Link variants to a 'Base Product' representing the profile.

-- 1. Add Weight/Gauge to Products (The Base Profile)
-- Default Gauge: 29 (most common) or specified override.
-- Weight: Lbs per linear foot.
ALTER TABLE products ADD COLUMN IF NOT EXISTS weight_lbs_ft NUMERIC(10, 4) DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS gauge INTEGER DEFAULT 29; -- Default Base Gauge

-- 2. Create Product Variants Table
CREATE TABLE IF NOT EXISTS product_variants (
    id SERIAL PRIMARY KEY,
    product_id VARCHAR(255) REFERENCES products(id) ON DELETE CASCADE,
    gauge INTEGER NOT NULL, -- e.g. 26
    weight_lbs_ft NUMERIC(10, 4) NOT NULL,
    price_override NUMERIC(15, 4), -- Optional: If NULL, calculated from weight ratio
    cost_override NUMERIC(15, 4),  -- Optional
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, gauge) -- Prevent duplicate gauges per product
);

-- 3. Seed Base Products & Variants
DO $$
DECLARE
    cat_rec RECORD;
    prod_id VARCHAR(255);
    base_price NUMERIC := 1.00; -- Placeholder
    base_cost NUMERIC := 0.50;  -- Placeholder
BEGIN
    -- List of Profiles to Seed
    -- Format: 'CategoryName', [Gauges]
    -- We will handle each manually for clarity

    -- --- FC36 (29ga Base, add 26) ---
    SELECT id INTO cat_rec FROM categories WHERE name = 'FC36';
    IF FOUND THEN
        -- Find or Create Base Product
        SELECT id INTO prod_id FROM products WHERE category_id = cat_rec.id LIMIT 1;
        
        IF prod_id IS NULL THEN
            prod_id := uuid_generate_v4();
            INSERT INTO products (id, item_code, name, category_id, cost, price, weight_lbs_ft, gauge)
            VALUES (prod_id, 'FC36-PANEL', 'FC36 Panel', cat_rec.id, base_cost, base_price, 2.00, 29);
        ELSE
            -- Update existing to secure defaults
            UPDATE products SET weight_lbs_ft = 2.00, gauge = 29 WHERE id = prod_id;
        END IF;

        -- Add Variant: 26ga (Weight ~1.35x 29ga)
        INSERT INTO product_variants (product_id, gauge, weight_lbs_ft)
        VALUES (prod_id, 26, 2.70)
        ON CONFLICT (product_id, gauge) DO NOTHING;
    END IF;

    -- --- II6 (29ga Base, add 26) ---
    SELECT id INTO cat_rec FROM categories WHERE name = 'II6';
    IF FOUND THEN
        SELECT id INTO prod_id FROM products WHERE category_id = cat_rec.id LIMIT 1;
        IF prod_id IS NULL THEN
            prod_id := uuid_generate_v4();
            INSERT INTO products (id, item_code, name, category_id, cost, price, weight_lbs_ft, gauge)
            VALUES (prod_id, 'II6-PANEL', 'II6 Panel', cat_rec.id, base_cost, base_price, 2.00, 29);
        ELSE
            UPDATE products SET weight_lbs_ft = 2.00, gauge = 29 WHERE id = prod_id;
        END IF;
        INSERT INTO product_variants (product_id, gauge, weight_lbs_ft)
        VALUES (prod_id, 26, 2.70)
        ON CONFLICT (product_id, gauge) DO NOTHING;
    END IF;

    -- --- FR (29ga Base, add 26) ---
    SELECT id INTO cat_rec FROM categories WHERE name = 'FR';
    IF FOUND THEN
        SELECT id INTO prod_id FROM products WHERE category_id = cat_rec.id LIMIT 1;
        IF prod_id IS NULL THEN
            prod_id := uuid_generate_v4();
            INSERT INTO products (id, item_code, name, category_id, cost, price, weight_lbs_ft, gauge)
            VALUES (prod_id, 'FR-PANEL', 'FR Panel', cat_rec.id, base_cost, base_price, 2.00, 29);
        ELSE
             UPDATE products SET weight_lbs_ft = 2.00, gauge = 29 WHERE id = prod_id;
        END IF;
        INSERT INTO product_variants (product_id, gauge, weight_lbs_ft)
        VALUES (prod_id, 26, 2.70)
        ON CONFLICT (product_id, gauge) DO NOTHING;
    END IF;

    -- --- Forma Loc 12" (29ga Base, add 26) ---
    SELECT id INTO cat_rec FROM categories WHERE name = '12" Forma Loc';
    IF FOUND THEN
        SELECT id INTO prod_id FROM products WHERE category_id = cat_rec.id LIMIT 1;
        IF prod_id IS NULL THEN
            prod_id := uuid_generate_v4();
            INSERT INTO products (id, item_code, name, category_id, cost, price, weight_lbs_ft, gauge)
            VALUES (prod_id, 'FL12-PANEL', 'Forma Loc 12" Panel', cat_rec.id, base_cost, base_price, 2.00, 29);
        ELSE
             UPDATE products SET weight_lbs_ft = 2.00, gauge = 29 WHERE id = prod_id;
        END IF;
        INSERT INTO product_variants (product_id, gauge, weight_lbs_ft)
        VALUES (prod_id, 26, 2.70)
        ON CONFLICT (product_id, gauge) DO NOTHING;
    END IF;

    -- --- Forma Loc 16" (29ga Base, add 26) ---
    SELECT id INTO cat_rec FROM categories WHERE name = '16" Forma Loc';
    IF FOUND THEN
        SELECT id INTO prod_id FROM products WHERE category_id = cat_rec.id LIMIT 1;
        IF prod_id IS NULL THEN
            prod_id := uuid_generate_v4();
            INSERT INTO products (id, item_code, name, category_id, cost, price, weight_lbs_ft, gauge)
            VALUES (prod_id, 'FL16-PANEL', 'Forma Loc 16" Panel', cat_rec.id, base_cost, base_price, 2.00, 29);
        ELSE
             UPDATE products SET weight_lbs_ft = 2.00, gauge = 29 WHERE id = prod_id;
        END IF;
        INSERT INTO product_variants (product_id, gauge, weight_lbs_ft)
        VALUES (prod_id, 26, 2.70)
        ON CONFLICT (product_id, gauge) DO NOTHING;
    END IF;

    -- --- I9 (29ga Base, add 24, 26) ---
    SELECT id INTO cat_rec FROM categories WHERE name = 'I9';
    IF FOUND THEN
        SELECT id INTO prod_id FROM products WHERE category_id = cat_rec.id LIMIT 1;
        IF prod_id IS NULL THEN
            prod_id := uuid_generate_v4();
            INSERT INTO products (id, item_code, name, category_id, cost, price, weight_lbs_ft, gauge)
            VALUES (prod_id, 'I9-PANEL', 'I9 Panel', cat_rec.id, base_cost, base_price, 2.00, 29);
        ELSE
             UPDATE products SET weight_lbs_ft = 2.00, gauge = 29 WHERE id = prod_id;
        END IF;
        INSERT INTO product_variants (product_id, gauge, weight_lbs_ft)
        VALUES 
            (prod_id, 26, 2.70),
            (prod_id, 24, 3.40) -- Approx 1.7x 29ga
        ON CONFLICT (product_id, gauge) DO NOTHING;
    END IF;

    -- --- FA (26ga Base? Or 29? Assumed 29 base for uniformity, add 24, 26 variants) ---
    -- Wait, user said "FA: Add 24 and 26 gauge".
    -- If Base is 29, then adding 26 and 24 is clear.
    -- If Base is 26, then we add 24.
    -- I'll assume Base is 29 (Standard Ag Panel) unless known otherwise.
    SELECT id INTO cat_rec FROM categories WHERE name = 'FA';
    IF FOUND THEN
        SELECT id INTO prod_id FROM products WHERE category_id = cat_rec.id LIMIT 1;
        IF prod_id IS NULL THEN
            prod_id := uuid_generate_v4();
            INSERT INTO products (id, item_code, name, category_id, cost, price, weight_lbs_ft, gauge)
            VALUES (prod_id, 'FA-PANEL', 'FA Panel', cat_rec.id, base_cost, base_price, 2.00, 29);
        ELSE
             UPDATE products SET weight_lbs_ft = 2.00, gauge = 29 WHERE id = prod_id;
        END IF;
        INSERT INTO product_variants (product_id, gauge, weight_lbs_ft)
        VALUES 
            (prod_id, 26, 2.70),
            (prod_id, 24, 3.40)
        ON CONFLICT (product_id, gauge) DO NOTHING;
    END IF;

END $$;

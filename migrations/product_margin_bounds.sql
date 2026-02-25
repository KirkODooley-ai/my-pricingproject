-- Migration: Per-Product Margin Bounds
-- Adds margin_floor and margin_ceiling columns to products for dynamic margin controls.

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS margin_floor NUMERIC(5, 4),
    ADD COLUMN IF NOT EXISTS margin_ceiling NUMERIC(5, 4);


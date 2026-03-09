-- Add group column to categories for user-selectable header (Large Rolled Panel, Small Rolled Panels, Cladding Series, Parts)
ALTER TABLE categories ADD COLUMN IF NOT EXISTS "group" VARCHAR(100);

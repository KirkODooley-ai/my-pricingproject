-- Labor Rate Management: category group labor rates and category footage/quantity
-- Labor Cost = (Total Footage / Quantity) * Category Labor Rate
-- Equivalently: Labor Cost = Total Footage * Labor Rate (rate in $/foot)

-- Add columns to categories if they don't exist
ALTER TABLE categories ADD COLUMN IF NOT EXISTS total_footage NUMERIC DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS labor_percentage NUMERIC DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS labor_cost NUMERIC DEFAULT 0;

-- Labor rates stored in settings (key: labor_rates, value: JSONB matching settings format)
INSERT INTO settings (key, value)
VALUES ('labor_rates', '{"value":{"Large Rolled Panel":0,"Small Rolled Panels":0,"Cladding Series":0,"Parts":0}}'::jsonb)
ON CONFLICT (key) DO NOTHING;

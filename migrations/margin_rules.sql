-- Migration: Margin Rules (Product Line + Gauge Level)
-- Centralized margin_floor and margin_ceiling by target_name (e.g., 'Fasteners', 'FC36') and optional gauge.

CREATE TABLE IF NOT EXISTS margin_rules (
    id SERIAL PRIMARY KEY,
    target_name TEXT NOT NULL,
    gauge INTEGER,
    margin_floor NUMERIC(5, 4) NOT NULL,
    margin_ceiling NUMERIC(5, 4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS margin_rules_target_gauge_idx ON margin_rules (target_name, COALESCE(gauge, -1));

-- Seed defaults: blanket Fasteners 40%, FC36/I9/II6 rolled at 20% (gauge NULL = blanket)
INSERT INTO margin_rules (target_name, gauge, margin_floor, margin_ceiling)
SELECT v.target_name, v.gauge, v.margin_floor, v.margin_ceiling
FROM (VALUES
    ('Fasteners', NULL::int, 0.40::numeric, NULL::numeric),
    ('FC36', NULL, 0.20, NULL),
    ('I9', NULL, 0.20, NULL),
    ('II6', NULL, 0.20, NULL),
    ('FR', NULL, 0.20, NULL),
    ('FA', NULL, 0.20, NULL)
) AS v(target_name, gauge, margin_floor, margin_ceiling)
WHERE NOT EXISTS (
    SELECT 1 FROM margin_rules m
    WHERE m.target_name = v.target_name AND (m.gauge IS NOT DISTINCT FROM v.gauge)
);

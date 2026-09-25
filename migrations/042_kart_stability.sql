-- Buja migration 042: Stability, the fifth Buja Kart upgrade (steadier steering, less bounce in bumps).
-- Until this runs, the shop simply does not show Stability.
USE buja;

ALTER TABLE kart_profiles ADD COLUMN stability TINYINT UNSIGNED NOT NULL DEFAULT 0;

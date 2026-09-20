-- Buja migration 015: places discovered from OpenStreetMap, and coordinates on spots.
USE buja;
ALTER TABLE spots ADD COLUMN source VARCHAR(12) NOT NULL DEFAULT 'buja';
ALTER TABLE spots ADD COLUMN osm_id VARCHAR(24) NULL;
ALTER TABLE spots ADD UNIQUE INDEX uq_spot_osm (osm_id);

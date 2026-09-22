-- Buja migration 031: boarding a vehicle safely. Trip Share grows a "ride" kind that carries the plate,
-- the route and the destination, so the person you share with sees which vehicle you entered.
USE buja;

ALTER TABLE safety_sessions ADD COLUMN kind ENUM('meet','ride') NOT NULL DEFAULT 'meet';
ALTER TABLE safety_sessions ADD COLUMN plate VARCHAR(16) NULL;
ALTER TABLE safety_sessions ADD COLUMN vehicle VARCHAR(80) NULL;
ALTER TABLE safety_sessions ADD COLUMN route_id BIGINT UNSIGNED NULL;
ALTER TABLE safety_sessions ADD COLUMN from_place BIGINT UNSIGNED NULL;
ALTER TABLE safety_sessions ADD COLUMN to_place BIGINT UNSIGNED NULL;
ALTER TABLE safety_sessions ADD COLUMN mode VARCHAR(10) NULL;
ALTER TABLE safety_sessions ADD COLUMN fare_asked TINYINT(1) NOT NULL DEFAULT 0;

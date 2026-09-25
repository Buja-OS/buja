-- Buja migration 040: every order is trackable.
-- 1. Artisan orders (cook / caterer, laundry, errands): a "preparing" stage with a ready time, then live tracking.
-- 2. Declutter "Buy safely" deliveries: where to deliver, and a live tracker while the seller brings it.
-- Run the whole file in TiDB. If it stops at a "Duplicate column" error, that part is already done: run the lines below it.
USE buja;

ALTER TABLE service_jobs ADD COLUMN kind VARCHAR(10) NOT NULL DEFAULT 'callout';
ALTER TABLE service_jobs ADD COLUMN ready_at DATETIME NULL;
ALTER TABLE service_jobs ADD COLUMN prep_min SMALLINT UNSIGNED NULL;

ALTER TABLE escrow_orders ADD COLUMN handover VARCHAR(10) NULL;
ALTER TABLE escrow_orders ADD COLUMN drop_lat DECIMAL(9,6) NULL;
ALTER TABLE escrow_orders ADD COLUMN drop_lng DECIMAL(9,6) NULL;
ALTER TABLE escrow_orders ADD COLUMN drop_note VARCHAR(160) NULL;

-- One live journey per thing being delivered (today: kind = 'escrow'). The courier's phone updates it every few seconds.
CREATE TABLE IF NOT EXISTS live_tracks (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kind        VARCHAR(16) NOT NULL,
  ref_id      BIGINT UNSIGNED NOT NULL,
  courier_id  BIGINT UNSIGNED NOT NULL,
  watcher_id  BIGINT UNSIGNED NOT NULL,
  dest_lat    DECIMAL(9,6) NOT NULL,
  dest_lng    DECIMAL(9,6) NOT NULL,
  status      VARCHAR(12) NOT NULL DEFAULT 'enroute',   -- enroute, arrived, ended
  a_lat       DECIMAL(9,6) NULL,
  a_lng       DECIMAL(9,6) NULL,
  a_heading   SMALLINT NULL,
  a_speed     DECIMAL(6,2) NULL,
  a_at        DATETIME NULL,
  moved_at    DATETIME NULL,
  eta_min     SMALLINT NULL,
  eta_at      DATETIME NULL,
  route_km    DECIMAL(6,2) NULL,
  route_json  MEDIUMTEXT NULL,
  route_at    DATETIME NULL,
  started_at  DATETIME NOT NULL,
  arrived_at  DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY ux_live_track (kind, ref_id),
  KEY ix_live_courier (courier_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

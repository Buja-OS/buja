-- Buja migration 033: the mechanic-near-me dispatch. Richer artisan profiles, a request that reaches several
-- nearby mechanics at once (first to accept gets it), a precise customer pin, and fast lookups by position.
USE buja;

ALTER TABLE artisans ADD COLUMN owner_name VARCHAR(80) NULL;
ALTER TABLE artisans ADD COLUMN services TEXT NULL;               -- JSON list: engine, electrical, brakes ...
ALTER TABLE artisans ADD COLUMN brands TEXT NULL;                 -- JSON list: toyota, honda ... or all
ALTER TABLE artisans ADD COLUMN mobile_service TINYINT(1) NOT NULL DEFAULT 1;   -- comes to the customer
ALTER TABLE artisans ADD COLUMN emergency TINYINT(1) NOT NULL DEFAULT 0;        -- takes night and weekend calls
ALTER TABLE artisans ADD COLUMN hours VARCHAR(80) NULL;
ALTER TABLE artisans ADD COLUMN callout_fee INT UNSIGNED NULL;
ALTER TABLE artisans ADD COLUMN address VARCHAR(160) NULL;
ALTER TABLE artisans ADD COLUMN landmark VARCHAR(160) NULL;
ALTER TABLE artisans ADD COLUMN id_upload BIGINT UNSIGNED NULL;   -- a photo of an ID, seen only by admins, for the verified badge
ALTER TABLE artisans ADD COLUMN last_online_at DATETIME NULL;
ALTER TABLE artisans ADD INDEX ix_artisans_geo (trade, available, lat, lng);

ALTER TABLE service_jobs ADD COLUMN mode ENUM('direct','nearest') NOT NULL DEFAULT 'direct';
ALTER TABLE service_jobs ADD COLUMN accuracy_m SMALLINT UNSIGNED NULL;
ALTER TABLE service_jobs ADD COLUMN near_place VARCHAR(120) NULL;
ALTER TABLE service_jobs ADD COLUMN ring TINYINT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE service_jobs ADD COLUMN ring_at DATETIME NULL;
ALTER TABLE service_jobs ADD COLUMN trades VARCHAR(80) NULL;

CREATE TABLE IF NOT EXISTS job_offers (
  job_id        BIGINT UNSIGNED NOT NULL,
  artisan_id    BIGINT UNSIGNED NOT NULL,
  km            DECIMAL(6,2) NOT NULL,
  ring          TINYINT UNSIGNED NOT NULL,
  status        ENUM('offered','declined','taken','won','expired') NOT NULL DEFAULT 'offered',
  offered_at    DATETIME NOT NULL,
  renotified_at DATETIME NULL,
  answered_at   DATETIME NULL,
  PRIMARY KEY (job_id, artisan_id),
  KEY ix_offers_artisan (artisan_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Settings the admin controls without a deploy (ads first).
CREATE TABLE IF NOT EXISTS app_settings (
  k          VARCHAR(60) NOT NULL,
  v          TEXT NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (k)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Buja migration 030: fuel-indexed Waka pricing, road-route cache, and on-demand service jobs with live tracking.
USE buja;

CREATE TABLE IF NOT EXISTS waka_config (
  k          VARCHAR(40) NOT NULL,
  v          VARCHAR(200) NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (k)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Abuja pump price, September 2026 (Daily Trust 16 Sept 2026: N1,395-1,460; NAN 20 Sept: N1,410-1,450)
INSERT INTO waka_config (k, v, updated_at) VALUES ('pump_price', '1420', NOW()), ('reviewed_at', '2026-09-22', NOW())
  ON DUPLICATE KEY UPDATE k = k;

CREATE TABLE IF NOT EXISTS route_cache (
  k          CHAR(40) NOT NULL,
  body       MEDIUMTEXT NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (k)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS service_jobs (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id   BIGINT UNSIGNED NOT NULL,
  artisan_id    BIGINT UNSIGNED NOT NULL,
  trade         VARCHAR(20) NOT NULL,
  problem       VARCHAR(400) NOT NULL,
  lat           DECIMAL(9,6) NOT NULL,
  lng           DECIMAL(9,6) NOT NULL,
  landmark      VARCHAR(160) NULL,
  status        ENUM('requested','accepted','enroute','arrived','done','declined','cancelled','expired') NOT NULL DEFAULT 'requested',
  a_lat         DECIMAL(9,6) NULL,
  a_lng         DECIMAL(9,6) NULL,
  a_heading     SMALLINT NULL,
  a_speed       DECIMAL(6,2) NULL,
  a_at          DATETIME NULL,
  moved_at      DATETIME NULL,
  eta_min       SMALLINT NULL,
  route_km      DECIMAL(6,2) NULL,
  eta_at        DATETIME NULL,
  route_json    MEDIUMTEXT NULL,
  route_at      DATETIME NULL,
  thread_id     BIGINT UNSIGNED NULL,
  rated         TINYINT(1) NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL,
  accepted_at   DATETIME NULL,
  started_at    DATETIME NULL,
  arrived_at    DATETIME NULL,
  done_at       DATETIME NULL,
  PRIMARY KEY (id),
  KEY ix_sj_customer (customer_id, status),
  KEY ix_sj_artisan (artisan_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS service_trail (
  job_id     BIGINT UNSIGNED NOT NULL,
  lat        DECIMAL(9,6) NOT NULL,
  lng        DECIMAL(9,6) NOT NULL,
  at         DATETIME NOT NULL,
  KEY ix_trail (job_id, at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

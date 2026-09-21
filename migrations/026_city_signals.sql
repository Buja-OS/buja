-- Buja migration 026: Light Watch, fuel board, blood donors, lost and found, one-chance plates, market prices.
USE buja;

CREATE TABLE IF NOT EXISTS light_reports (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  district   VARCHAR(60) NOT NULL,
  lat        DECIMAL(9,6) NULL,
  lng        DECIMAL(9,6) NULL,
  state      TINYINT(1) NOT NULL,
  source     ENUM('tap','charging') NOT NULL DEFAULT 'tap',
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_light_district (district, created_at),
  KEY ix_light_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fuel_stations (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(90) NOT NULL,
  brand      VARCHAR(40) NULL,
  district   VARCHAR(60) NOT NULL,
  lat        DECIMAL(9,6) NOT NULL,
  lng        DECIMAL(9,6) NOT NULL,
  osm_id     VARCHAR(40) NULL,
  added_by   BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_fuel_osm (osm_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fuel_reports (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  station_id BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  petrol     INT UNSIGNED NULL,
  diesel     INT UNSIGNED NULL,
  queue      ENUM('none','short','long','closed') NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_fuel_station (station_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS donors (
  user_id        BIGINT UNSIGNED NOT NULL,
  blood_group    VARCHAR(3) NOT NULL,
  willing        TINYINT(1) NOT NULL DEFAULT 1,
  radius_km      TINYINT UNSIGNED NOT NULL DEFAULT 10,
  last_donated   DATE NULL,
  share_phone    TINYINT(1) NOT NULL DEFAULT 1,
  created_at     DATETIME NOT NULL,
  PRIMARY KEY (user_id),
  KEY ix_donor_group (blood_group, willing)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS blood_requests (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  blood_group VARCHAR(3) NOT NULL,
  units       TINYINT UNSIGNED NOT NULL DEFAULT 1,
  hospital    VARCHAR(120) NOT NULL,
  district    VARCHAR(60) NOT NULL,
  lat         DECIMAL(9,6) NULL,
  lng         DECIMAL(9,6) NULL,
  phone       VARCHAR(30) NOT NULL,
  note        VARCHAR(500) NULL,
  urgency     ENUM('today','48h','week') NOT NULL DEFAULT 'today',
  status      ENUM('open','fulfilled','closed') NOT NULL DEFAULT 'open',
  responders  INT UNSIGNED NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_blood_open (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS blood_responses (
  request_id BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (request_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lost_found (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  kind        ENUM('lost','found') NOT NULL,
  item        VARCHAR(20) NOT NULL,
  name_on_it  VARCHAR(90) NULL,
  district    VARCHAR(60) NOT NULL,
  place       VARCHAR(120) NULL,
  description VARCHAR(800) NOT NULL,
  upload_id   BIGINT UNSIGNED NULL,
  status      ENUM('open','closed') NOT NULL DEFAULT 'open',
  created_at  DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_lf_open (status, kind, item, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS plate_reports (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  plate      VARCHAR(16) NOT NULL,
  vehicle    VARCHAR(80) NULL,
  what       VARCHAR(600) NOT NULL,
  district   VARCHAR(60) NULL,
  happened   DATE NOT NULL,
  hurt       TINYINT(1) NOT NULL DEFAULT 0,
  told_police TINYINT(1) NOT NULL DEFAULT 0,
  hidden_at  DATETIME NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_plate (plate, hidden_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS price_reports (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  item       VARCHAR(30) NOT NULL,
  market     VARCHAR(60) NOT NULL,
  price      INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_price_item (item, market, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE threads MODIFY COLUMN kind ENUM('work','match','homes','declutter','artisan','event','city') NOT NULL DEFAULT 'work';

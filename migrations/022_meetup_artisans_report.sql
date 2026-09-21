-- Buja migration 022: Meetup (called meetups here, because "events" is already the analytics log), Artisans (find a mechanic near you),
-- and Citizen Report (the right agency, with real contacts). One change per statement for TiDB.
USE buja;

CREATE TABLE IF NOT EXISTS meetups (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  host_id      BIGINT UNSIGNED NOT NULL,
  title        VARCHAR(120) NOT NULL,
  category     VARCHAR(20) NOT NULL,
  description  VARCHAR(4000) NOT NULL,
  starts_at    DATETIME NOT NULL,
  ends_at      DATETIME NULL,
  venue        VARCHAR(160) NOT NULL,
  district     VARCHAR(60) NOT NULL,
  lat          DECIMAL(9,6) NULL,
  lng          DECIMAL(9,6) NULL,
  online_url   VARCHAR(300) NULL,
  capacity     INT UNSIGNED NULL,
  price        INT UNSIGNED NOT NULL DEFAULT 0,
  cover_upload BIGINT UNSIGNED NULL,
  going        INT UNSIGNED NOT NULL DEFAULT 0,
  status       ENUM('live','cancelled') NOT NULL DEFAULT 'live',
  created_at   DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_meetups_when (status, starts_at),
  KEY ix_meetups_host (host_id, id),
  CONSTRAINT fk_meetups_host FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS meetup_rsvps (
  event_id   BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  status     ENUM('going','waitlist','cancelled') NOT NULL DEFAULT 'going',
  guests     TINYINT UNSIGNED NOT NULL DEFAULT 0,
  checked_in DATETIME NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (event_id, user_id),
  KEY ix_mrsvp_user (user_id, event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS meetup_posts (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id   BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  body       VARCHAR(1500) NOT NULL,
  is_update  TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_mp_event (event_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS artisans (
  user_id      BIGINT UNSIGNED NOT NULL,
  trade        VARCHAR(30) NOT NULL,
  business     VARCHAR(80) NULL,
  about        VARCHAR(600) NULL,
  phone        VARCHAR(30) NOT NULL,
  whatsapp     VARCHAR(30) NULL,
  base_district VARCHAR(60) NOT NULL,
  lat          DECIMAL(9,6) NULL,
  lng          DECIMAL(9,6) NULL,
  radius_km    TINYINT UNSIGNED NOT NULL DEFAULT 15,
  years        TINYINT UNSIGNED NOT NULL DEFAULT 0,
  available    TINYINT(1) NOT NULL DEFAULT 1,
  photo_upload BIGINT UNSIGNED NULL,
  jobs_done    INT UNSIGNED NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL,
  updated_at   DATETIME NOT NULL,
  PRIMARY KEY (user_id),
  KEY ix_artisan_trade (trade, available),
  CONSTRAINT fk_artisan_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS citizen_reports (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  agency     VARCHAR(30) NOT NULL,
  category   VARCHAR(30) NOT NULL,
  body       VARCHAR(2000) NOT NULL,
  district   VARCHAR(60) NULL,
  lat        DECIMAL(9,6) NULL,
  lng        DECIMAL(9,6) NULL,
  upload_id  BIGINT UNSIGNED NULL,
  channel    VARCHAR(12) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_cr_user (user_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE threads MODIFY COLUMN kind ENUM('work','match','homes','declutter','artisan','event') NOT NULL DEFAULT 'work';

-- Buja migration 006: Homes (properties, landlord profiles, photos, saved), thread links, Waka road geometry.
-- Run once in the buja database.

USE buja;

-- TiDB wants one schema change per statement.
ALTER TABLE threads ADD COLUMN property_id BIGINT UNSIGNED NULL AFTER application_id;
ALTER TABLE threads ADD COLUMN listing_id BIGINT UNSIGNED NULL AFTER property_id;
ALTER TABLE threads ADD INDEX ix_threads_property (property_id);
ALTER TABLE threads ADD INDEX ix_threads_listing (listing_id);

ALTER TABLE messages MODIFY COLUMN type ENUM('text','interview','inspection','offer') NOT NULL DEFAULT 'text';

ALTER TABLE routes ADD COLUMN geometry MEDIUMTEXT NULL;

CREATE TABLE IF NOT EXISTS landlord_profiles (
  user_id      BIGINT UNSIGNED NOT NULL,
  display_name VARCHAR(80) NOT NULL,
  is_company   TINYINT(1) NOT NULL DEFAULT 0,
  about        VARCHAR(600) NULL,
  verified_at  DATETIME NULL,
  created_at   DATETIME NOT NULL,
  updated_at   DATETIME NOT NULL,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_landlord_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS properties (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_id      BIGINT UNSIGNED NOT NULL,
  kind          ENUM('rent','sale') NOT NULL,
  type          VARCHAR(20) NOT NULL,
  title         VARCHAR(100) NOT NULL,
  district      VARCHAR(60) NOT NULL,
  area          VARCHAR(100) NULL,
  price         BIGINT UNSIGNED NOT NULL,
  beds          TINYINT UNSIGNED NOT NULL DEFAULT 0,
  baths         TINYINT UNSIGNED NOT NULL DEFAULT 0,
  facilities    JSON NULL,
  description   TEXT NOT NULL,
  upfront_years TINYINT UNSIGNED NULL,
  legal_fee     INT UNSIGNED NULL,
  caution_fee   INT UNSIGNED NULL,
  status        ENUM('available','let','sold','hidden') NOT NULL DEFAULT 'available',
  views         INT UNSIGNED NOT NULL DEFAULT 0,
  created_at    DATETIME NOT NULL,
  updated_at    DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_prop_owner (owner_id),
  KEY ix_prop_search (status, kind, district, price),
  CONSTRAINT fk_prop_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS property_photos (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  property_id BIGINT UNSIGNED NOT NULL,
  position    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  mime        VARCHAR(40) NOT NULL,
  size        INT UNSIGNED NOT NULL,
  data        MEDIUMBLOB NOT NULL,
  created_at  DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_pphoto (property_id, position),
  CONSTRAINT fk_pphoto_prop FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saved_properties (
  user_id     BIGINT UNSIGNED NOT NULL,
  property_id BIGINT UNSIGNED NOT NULL,
  created_at  DATETIME NOT NULL,
  PRIMARY KEY (user_id, property_id),
  CONSTRAINT fk_sp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_sp_prop FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

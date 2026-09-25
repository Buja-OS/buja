-- Buja migration 043: chat presence (online, typing, last seen), status updates, restaurant menus and food orders,
-- and real photos for places.
-- Run the whole file in TiDB. If it stops at a "Duplicate column" or "already exists" error, that part is already
-- done: run the lines below it.
USE buja;

-- 1. Chat: who is typing where, and the "show my last seen" switch
CREATE TABLE IF NOT EXISTS typing_state (
  thread_id BIGINT UNSIGNED NOT NULL,
  user_id   BIGINT UNSIGNED NOT NULL,
  at        DATETIME NOT NULL,
  PRIMARY KEY (thread_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE users ADD COLUMN show_last_seen TINYINT(1) NOT NULL DEFAULT 1;

-- 2. Status updates (24 hours, seen by your Buja friends) and who viewed each one
CREATE TABLE IF NOT EXISTS statuses (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  kind       VARCHAR(8) NOT NULL DEFAULT 'text',     -- text, image
  body       VARCHAR(700) NULL,
  bg         VARCHAR(9) NULL,
  upload_id  BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY ix_status_user (user_id, expires_at),
  KEY ix_status_upload (upload_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS status_views (
  status_id  BIGINT UNSIGNED NOT NULL,
  viewer_id  BIGINT UNSIGNED NOT NULL,
  viewed_at  DATETIME NOT NULL,
  PRIMARY KEY (status_id, viewer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Places: real photos (Wikimedia Commons, matched by name and position), phone, website, and the finer kind of place
ALTER TABLE spots ADD COLUMN subtype VARCHAR(30) NULL;
ALTER TABLE spots ADD COLUMN religion VARCHAR(20) NULL;
ALTER TABLE spots ADD COLUMN phone VARCHAR(40) NULL;
ALTER TABLE spots ADD COLUMN website VARCHAR(200) NULL;
ALTER TABLE spots ADD COLUMN wikidata VARCHAR(20) NULL;
ALTER TABLE spots ADD COLUMN commons VARCHAR(200) NULL;
ALTER TABLE spots ADD COLUMN notable TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE spots ADD COLUMN photo_url VARCHAR(500) NULL;
ALTER TABLE spots ADD COLUMN photo_credit VARCHAR(160) NULL;
ALTER TABLE spots ADD COLUMN photo_checked_at DATETIME NULL;
CREATE INDEX ix_spots_photo ON spots (photo_checked_at);

-- 4. Businesses on Buja: a menu or price list, a delivery fee, and orders that carry the items
CREATE TABLE IF NOT EXISTS artisan_menu (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  artisan_id   BIGINT UNSIGNED NOT NULL,
  section      VARCHAR(40) NULL,
  name         VARCHAR(80) NOT NULL,
  description  VARCHAR(240) NULL,
  price        INT UNSIGNED NOT NULL,
  photo_upload BIGINT UNSIGNED NULL,
  available    TINYINT(1) NOT NULL DEFAULT 1,
  sort         SMALLINT NOT NULL DEFAULT 0,
  created_at   DATETIME NOT NULL,
  deleted_at   DATETIME NULL,
  PRIMARY KEY (id),
  KEY ix_menu_artisan (artisan_id, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE artisans ADD COLUMN delivery_fee INT UNSIGNED NULL;
ALTER TABLE artisans ADD COLUMN min_order INT UNSIGNED NULL;
ALTER TABLE service_jobs ADD COLUMN items_json TEXT NULL;
ALTER TABLE service_jobs ADD COLUMN subtotal INT UNSIGNED NULL;
ALTER TABLE service_jobs ADD COLUMN delivery_fee INT UNSIGNED NULL;

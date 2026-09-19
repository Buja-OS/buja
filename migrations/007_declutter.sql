-- Buja migration 007: Declutter (buy and sell). One schema change per statement for TiDB. Run once in the buja database.

USE buja;

CREATE TABLE IF NOT EXISTS listings (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  seller_id   BIGINT UNSIGNED NOT NULL,
  title       VARCHAR(80) NOT NULL,
  category    VARCHAR(40) NOT NULL,
  cond        VARCHAR(12) NOT NULL,
  price       BIGINT UNSIGNED NOT NULL,
  negotiable  TINYINT(1) NOT NULL DEFAULT 1,
  district    VARCHAR(60) NOT NULL,
  description VARCHAR(2000) NOT NULL,
  delivery    ENUM('pickup','delivery','both') NOT NULL DEFAULT 'pickup',
  escrow_ok   TINYINT(1) NOT NULL DEFAULT 0,
  status      ENUM('active','sold','hidden') NOT NULL DEFAULT 'active',
  views       INT UNSIGNED NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL,
  updated_at  DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_listings_seller (seller_id),
  KEY ix_listings_feed (status, created_at),
  KEY ix_listings_cat (status, category, price),
  CONSTRAINT fk_listings_seller FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS listing_photos (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  listing_id BIGINT UNSIGNED NOT NULL,
  position   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  mime       VARCHAR(40) NOT NULL,
  size       INT UNSIGNED NOT NULL,
  data       MEDIUMBLOB NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_lphoto (listing_id, position),
  CONSTRAINT fk_lphoto_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saved_listings (
  user_id    BIGINT UNSIGNED NOT NULL,
  listing_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (user_id, listing_id),
  CONSTRAINT fk_sl_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_sl_listing FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

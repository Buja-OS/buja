-- Buja migration 036: friends, saved mechanics and re-booking, and the Buja Kart garage.
USE buja;

CREATE TABLE IF NOT EXISTS friendships (
  user_id     BIGINT UNSIGNED NOT NULL,     -- who sent the request
  friend_id   BIGINT UNSIGNED NOT NULL,     -- who received it
  status      ENUM('pending','accepted') NOT NULL DEFAULT 'pending',
  created_at  DATETIME NOT NULL,
  accepted_at DATETIME NULL,
  PRIMARY KEY (user_id, friend_id),
  KEY ix_fr_friend (friend_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saved_artisans (
  user_id     BIGINT UNSIGNED NOT NULL,
  artisan_id  BIGINT UNSIGNED NOT NULL,     -- the artisan's user id
  created_at  DATETIME NOT NULL,
  PRIMARY KEY (user_id, artisan_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE service_jobs ADD COLUMN preferred_artisan_id BIGINT UNSIGNED NULL;

CREATE TABLE IF NOT EXISTS kart_profiles (
  user_id     BIGINT UNSIGNED NOT NULL,
  coins       INT UNSIGNED NOT NULL DEFAULT 0,
  engine      TINYINT UNSIGNED NOT NULL DEFAULT 0,
  accel       TINYINT UNSIGNED NOT NULL DEFAULT 0,
  handling    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  boost       TINYINT UNSIGNED NOT NULL DEFAULT 0,
  paints      VARCHAR(200) NOT NULL DEFAULT '',   -- unlocked paint ids, comma separated
  paint       VARCHAR(20) NULL,                   -- chosen paint, or NULL for the driver's colour
  races       INT UNSIGNED NOT NULL DEFAULT 0,
  wins        INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at  DATETIME NOT NULL,
  PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Buja migration 020: photographs of places, and saved searches that tell you when something new matches.
USE buja;

CREATE TABLE IF NOT EXISTS spot_photos (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  spot_id    BIGINT UNSIGNED NOT NULL,
  upload_id  BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  hidden_at  DATETIME NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_sp_spot (spot_id, hidden_at, id),
  CONSTRAINT fk_sp_spot FOREIGN KEY (spot_id) REFERENCES spots(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saved_searches (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  module      ENUM('work','homes','declutter') NOT NULL,
  label       VARCHAR(90) NOT NULL,
  filters     VARCHAR(1000) NOT NULL,
  alerts      TINYINT(1) NOT NULL DEFAULT 1,
  last_hit_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  hits        INT UNSIGNED NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_ss_user (user_id, id),
  KEY ix_ss_module (module, alerts),
  CONSTRAINT fk_ss_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

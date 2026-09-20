-- Buja migration 013: real distances in Match, and Trip Share for safety.
-- One schema change per statement for TiDB. Run once in the buja database.

USE buja;

ALTER TABLE users ADD COLUMN lat DECIMAL(9,6) NULL;
ALTER TABLE users ADD COLUMN lng DECIMAL(9,6) NULL;
ALTER TABLE users ADD COLUMN loc_updated_at DATETIME NULL;
ALTER TABLE match_profiles ADD COLUMN radius_km SMALLINT UNSIGNED NULL;

CREATE TABLE IF NOT EXISTS trusted_contacts (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  name       VARCHAR(60) NOT NULL,
  phone      VARCHAR(30) NULL,
  email      VARCHAR(190) NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_tc_user (user_id),
  CONSTRAINT fk_tc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A Trip Share: while you are out meeting someone, a private link shows your friend where you are.
CREATE TABLE IF NOT EXISTS safety_sessions (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      BIGINT UNSIGNED NOT NULL,
  with_user_id BIGINT UNSIGNED NULL,
  with_name    VARCHAR(60) NULL,
  place        VARCHAR(120) NOT NULL,
  note         VARCHAR(300) NULL,
  token        CHAR(32) NOT NULL,
  contact_name VARCHAR(60) NULL,
  status       ENUM('active','safe','alarm','expired') NOT NULL DEFAULT 'active',
  expected_end DATETIME NOT NULL,
  ended_at     DATETIME NULL,
  created_at   DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_safety_token (token),
  KEY ix_safety_user (user_id, id),
  CONSTRAINT fk_safety_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS safety_pings (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id BIGINT UNSIGNED NOT NULL,
  lat        DECIMAL(9,6) NOT NULL,
  lng        DECIMAL(9,6) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_ping_session (session_id, id),
  CONSTRAINT fk_ping_session FOREIGN KEY (session_id) REFERENCES safety_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

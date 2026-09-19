-- Buja migration 001: users, sessions, rate limits.
-- Run once in cPanel > phpMyAdmin > your database > SQL tab. Safe to re-run (IF NOT EXISTS).
-- MySQL 8 / MariaDB 10.6+. utf8mb4 so names in any language and emoji in messages work.

CREATE TABLE IF NOT EXISTS users (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kind              ENUM('resident','company','landlord') NOT NULL DEFAULT 'resident',
  name              VARCHAR(80)  NOT NULL,
  email             VARCHAR(190) NOT NULL,
  phone             VARCHAR(20)  NULL,
  password_hash     VARCHAR(255) NULL,
  google_sub        VARCHAR(64)  NULL,
  avatar_url        VARCHAR(500) NULL,
  district          VARCHAR(60)  NULL,
  email_verified_at DATETIME     NULL,
  created_at        DATETIME     NOT NULL,
  updated_at        DATETIME     NOT NULL,
  deleted_at        DATETIME     NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  UNIQUE KEY uq_users_phone (phone),
  UNIQUE KEY uq_users_google (google_sub),
  KEY ix_users_kind (kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  jti         CHAR(32)     NOT NULL,
  ip          VARCHAR(45)  NULL,
  user_agent  VARCHAR(255) NULL,
  expires_at  DATETIME     NOT NULL,
  revoked_at  DATETIME     NULL,
  created_at  DATETIME     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_jti (jti),
  KEY ix_sessions_user (user_id, expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rate_limits (
  k          CHAR(64)  NOT NULL,
  window_id  INT UNSIGNED NOT NULL,
  hits       INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (k, window_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Housekeeping you can schedule in cPanel > Cron Jobs (daily):
--   DELETE FROM sessions WHERE expires_at < UTC_TIMESTAMP() OR revoked_at IS NOT NULL;
--   DELETE FROM rate_limits WHERE window_id < UNIX_TIMESTAMP()/900 - 4;

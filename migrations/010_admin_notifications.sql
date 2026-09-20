-- Buja migration 010: roles, notifications centre, avatars, activity log, admin invites. One change per statement. Run once in the buja database.

USE buja;

ALTER TABLE users ADD COLUMN role ENUM('user','moderator','admin') NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN last_seen_at DATETIME NULL;
UPDATE users SET role = 'admin' WHERE is_admin = 1;

CREATE TABLE IF NOT EXISTS notifications (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  category   VARCHAR(20) NOT NULL,
  title      VARCHAR(120) NOT NULL,
  body       VARCHAR(300) NULL,
  url        VARCHAR(200) NULL,
  read_at    DATETIME NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_notif_user (user_id, id),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS avatars (
  user_id     BIGINT UNSIGNED NOT NULL,
  mime        VARCHAR(40) NOT NULL,
  size        INT UNSIGNED NOT NULL,
  data        MEDIUMBLOB NULL,
  storage_key VARCHAR(200) NULL,
  updated_at  DATETIME NOT NULL,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_avatar_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS events (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NULL,
  module     VARCHAR(20) NOT NULL,
  action     VARCHAR(30) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_events_time (created_at),
  KEY ix_events_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS invites (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email      VARCHAR(190) NOT NULL,
  role       ENUM('moderator','admin') NOT NULL,
  token_hash CHAR(64) NOT NULL,
  invited_by BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at    DATETIME NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_invite_token (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Buja migration 029: learning reminders, admin broadcasts, and the notification-permission nudge.
USE buja;

ALTER TABLE users ADD COLUMN notify_learn TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN learn_nudged_at DATETIME NULL;
ALTER TABLE users ADD COLUMN push_asked_at DATETIME NULL;

CREATE TABLE IF NOT EXISTS broadcasts (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id    BIGINT UNSIGNED NOT NULL,
  audience    VARCHAR(40) NOT NULL,
  district    VARCHAR(60) NULL,
  title       VARCHAR(120) NOT NULL,
  body        VARCHAR(300) NOT NULL,
  url         VARCHAR(200) NOT NULL DEFAULT '/#/home',
  recipients  INT UNSIGNED NOT NULL DEFAULT 0,
  pushed      INT UNSIGNED NOT NULL DEFAULT 0,
  sent_at     DATETIME NULL,
  created_at  DATETIME NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS broadcast_queue (
  broadcast_id BIGINT UNSIGNED NOT NULL,
  user_id      BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (broadcast_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

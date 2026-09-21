-- Buja migration 023: paid tickets and recurring events for Meetup, moderation for the new modules.
USE buja;

ALTER TABLE meetups ADD COLUMN repeat_rule ENUM('none','weekly','fortnightly','monthly') NOT NULL DEFAULT 'none';
ALTER TABLE meetups ADD COLUMN series_id BIGINT UNSIGNED NULL;
ALTER TABLE meetups ADD COLUMN hidden_at DATETIME NULL;
ALTER TABLE meetups ADD COLUMN ticket_count INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE artisans ADD COLUMN hidden_at DATETIME NULL;
ALTER TABLE artisans ADD COLUMN verified_at DATETIME NULL;

CREATE TABLE IF NOT EXISTS tickets (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id    BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  code        CHAR(10) NOT NULL,
  qty         TINYINT UNSIGNED NOT NULL DEFAULT 1,
  amount      INT UNSIGNED NOT NULL,
  fee         INT UNSIGNED NOT NULL DEFAULT 0,
  reference   VARCHAR(60) NOT NULL,
  status      ENUM('pending','paid','used','refunded') NOT NULL DEFAULT 'pending',
  used_at     DATETIME NULL,
  created_at  DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ticket_code (code),
  UNIQUE KEY uq_ticket_ref (reference),
  KEY ix_ticket_event (event_id, status),
  KEY ix_ticket_user (user_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

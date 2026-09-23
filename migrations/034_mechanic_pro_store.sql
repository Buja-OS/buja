-- Buja migration 034: the mechanic side (quotes, fair dispatch, working hours, recruitment source)
-- and what the Play Store and App Store require (account deletion, including a web request form).
USE buja;

ALTER TABLE service_jobs ADD COLUMN cancelled_by BIGINT UNSIGNED NULL;
ALTER TABLE service_jobs ADD COLUMN quote_amount INT UNSIGNED NULL;
ALTER TABLE service_jobs ADD COLUMN quote_note VARCHAR(200) NULL;
ALTER TABLE service_jobs ADD COLUMN quote_status ENUM('none','sent','accepted','declined') NOT NULL DEFAULT 'none';
ALTER TABLE service_jobs ADD COLUMN quoted_at DATETIME NULL;

ALTER TABLE artisans ADD COLUMN source VARCHAR(30) NULL;      -- which flyer or page brought them (apo, kugbo ...)
ALTER TABLE artisans ADD COLUMN schedule TEXT NULL;           -- JSON: {"mon":[8,18], ... } in Abuja hours; empty means any time

CREATE TABLE IF NOT EXISTS deletion_requests (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email       VARCHAR(190) NOT NULL,
  reason      VARCHAR(400) NULL,
  user_id     BIGINT UNSIGNED NULL,
  created_at  DATETIME NOT NULL,
  handled_at  DATETIME NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

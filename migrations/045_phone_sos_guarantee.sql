-- Buja migration 045: launch hardening, phone sign-in, languages, review photos, SOS, and the no-show guarantee.
-- TiDB Cloud > SQL Editor: run each statement on its own (TiDB does one ALTER at a time).
-- Safe to re-run the CREATE statements. If an ALTER says the column already exists, skip it.

-- Errors from the server and from people's phones, grouped. Admin, System shows them.
CREATE TABLE IF NOT EXISTS app_errors (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sig         CHAR(40) NOT NULL,
  source      VARCHAR(8) NOT NULL,
  message     VARCHAR(500) NOT NULL,
  where_at    VARCHAR(300) NULL,
  path        VARCHAR(200) NULL,
  sample      TEXT NULL,
  count       INT UNSIGNED NOT NULL DEFAULT 1,
  user_id     BIGINT UNSIGNED NULL,
  first_at    DATETIME NOT NULL,
  last_at     DATETIME NOT NULL,
  alerted_at  DATETIME NULL,
  resolved_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY ux_errors_sig (sig),
  KEY ix_errors_last (last_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sign-in codes sent by SMS. Only a hash of the code is kept.
CREATE TABLE IF NOT EXISTS phone_otps (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  phone       VARCHAR(20) NOT NULL,
  code_hash   CHAR(64) NOT NULL,
  attempts    TINYINT UNSIGNED NOT NULL DEFAULT 0,
  ip          VARCHAR(45) NULL,
  created_at  DATETIME NOT NULL,
  expires_at  DATETIME NOT NULL,
  used_at     DATETIME NULL,
  PRIMARY KEY (id),
  KEY ix_otp_phone (phone, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE users ADD COLUMN phone_verified_at DATETIME NULL;

ALTER TABLE users ADD COLUMN lang VARCHAR(5) NULL;

-- Up to three photos with an artisan review.
CREATE TABLE IF NOT EXISTS rating_photos (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  rating_id   BIGINT UNSIGNED NOT NULL,
  upload_id   BIGINT UNSIGNED NOT NULL,
  created_at  DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_rphoto_rating (rating_id),
  KEY ix_rphoto_upload (upload_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE safety_sessions ADD COLUMN sos TINYINT(1) NOT NULL DEFAULT 0;

ALTER TABLE service_jobs ADD COLUMN no_show TINYINT(1) NOT NULL DEFAULT 0;

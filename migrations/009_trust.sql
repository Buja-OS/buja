-- Buja migration 009: trust and money (admin, Plus, verification, payments, object storage keys).
-- One schema change per statement for TiDB. Run once in the buja database.

USE buja;

ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN plus_until DATETIME NULL;
ALTER TABLE users ADD COLUMN selfie_verified_at DATETIME NULL;

-- The first account created becomes the admin. Change the email if you want a different one.
UPDATE users SET is_admin = 1 WHERE id = (SELECT id FROM (SELECT MIN(id) AS id FROM users) AS t);

ALTER TABLE match_photos    ADD COLUMN storage_key VARCHAR(200) NULL;
ALTER TABLE property_photos ADD COLUMN storage_key VARCHAR(200) NULL;
ALTER TABLE listing_photos  ADD COLUMN storage_key VARCHAR(200) NULL;
ALTER TABLE cv_files        ADD COLUMN storage_key VARCHAR(200) NULL;
ALTER TABLE match_photos    MODIFY COLUMN data MEDIUMBLOB NULL;
ALTER TABLE property_photos MODIFY COLUMN data MEDIUMBLOB NULL;
ALTER TABLE listing_photos  MODIFY COLUMN data MEDIUMBLOB NULL;
ALTER TABLE cv_files        MODIFY COLUMN data MEDIUMBLOB NULL;

ALTER TABLE reports ADD COLUMN reviewed_by BIGINT UNSIGNED NULL;
ALTER TABLE reports ADD COLUMN outcome VARCHAR(20) NULL;

CREATE TABLE IF NOT EXISTS verifications (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  kind        ENUM('selfie','landlord') NOT NULL,
  mime        VARCHAR(40) NOT NULL,
  size        INT UNSIGNED NOT NULL,
  data        MEDIUMBLOB NULL,
  storage_key VARCHAR(200) NULL,
  status      ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  note        VARCHAR(200) NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  created_at  DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_verif_queue (status, id),
  KEY ix_verif_user (user_id, kind),
  CONSTRAINT fk_verif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payments (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  purpose    VARCHAR(20) NOT NULL,
  amount     INT UNSIGNED NOT NULL,
  reference  VARCHAR(60) NOT NULL,
  status     ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending',
  meta       JSON NULL,
  created_at DATETIME NOT NULL,
  paid_at    DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pay_ref (reference),
  KEY ix_pay_user (user_id, created_at),
  CONSTRAINT fk_pay_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

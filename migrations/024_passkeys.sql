-- Buja migration 024: fingerprint / face sign-in (WebAuthn passkeys). One change per statement for TiDB.
USE buja;

CREATE TABLE IF NOT EXISTS passkeys (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       BIGINT UNSIGNED NOT NULL,
  credential_id VARCHAR(600) NOT NULL,
  public_key    TEXT NOT NULL,
  alg           SMALLINT NOT NULL,
  sign_count    INT UNSIGNED NOT NULL DEFAULT 0,
  label         VARCHAR(60) NULL,
  created_at    DATETIME NOT NULL,
  last_used_at  DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_passkey_cred (credential_id(255)),
  KEY ix_passkey_user (user_id),
  CONSTRAINT fk_passkey_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

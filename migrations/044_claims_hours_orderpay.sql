-- Buja migration 044: businesses claim their listing, residents suggest opening hours, orders can be paid in the app
-- (held by Buja until the customer has the order), and a "busy" pause for businesses.
-- Run the whole file in TiDB. If it stops at a "Duplicate column" or "already exists" error, that part is already
-- done: run the lines below it.
USE buja;

-- 1. Claims: "this is my business". An admin checks the proof, then the place is linked to its owner.
CREATE TABLE IF NOT EXISTS spot_claims (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  spot_id       BIGINT UNSIGNED NOT NULL,
  user_id       BIGINT UNSIGNED NOT NULL,
  role          VARCHAR(20) NOT NULL,            -- owner, manager, staff
  phone         VARCHAR(40) NOT NULL,
  proof_upload  BIGINT UNSIGNED NULL,            -- shopfront, signboard, CAC certificate: seen by admins only
  note          VARCHAR(300) NULL,
  status        ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  reason        VARCHAR(200) NULL,
  created_at    DATETIME NOT NULL,
  decided_at    DATETIME NULL,
  decided_by    BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY ix_claim_status (status, created_at),
  KEY ix_claim_spot (spot_id),
  KEY ix_claim_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE spots ADD COLUMN owner_id BIGINT UNSIGNED NULL;
ALTER TABLE artisans ADD COLUMN spot_id BIGINT UNSIGNED NULL;
ALTER TABLE artisans ADD COLUMN busy_until DATETIME NULL;

-- 2. Suggestions from residents: opening hours, phone, "this place has closed". Owners' changes apply at once.
CREATE TABLE IF NOT EXISTS spot_edits (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  spot_id     BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  field       VARCHAR(12) NOT NULL,             -- hours, phone, closed
  value       VARCHAR(200) NULL,
  status      ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_at  DATETIME NOT NULL,
  decided_at  DATETIME NULL,
  decided_by  BIGINT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY ix_edit_status (status, created_at),
  KEY ix_edit_spot (spot_id, field)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Paying for an order in the app. The order is only sent to the business once the payment clears; Buja holds
-- the money until the customer has it, then pays the business. Refunded if the order is declined or cancelled.
CREATE TABLE IF NOT EXISTS job_payments (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reference      VARCHAR(60) NOT NULL,
  customer_id    BIGINT UNSIGNED NOT NULL,
  artisan_id     BIGINT UNSIGNED NOT NULL,
  job_id         BIGINT UNSIGNED NULL,
  subtotal       INT UNSIGNED NOT NULL,
  delivery_fee   INT UNSIGNED NOT NULL DEFAULT 0,
  fee            INT UNSIGNED NOT NULL DEFAULT 0,  -- Buja's protection fee, paid by the customer
  total          INT UNSIGNED NOT NULL,
  draft_json     TEXT NOT NULL,                     -- the order as checked against the menu when the customer paid
  status         ENUM('pending','paid','released','refunded','disputed','cancelled') NOT NULL DEFAULT 'pending',
  note           VARCHAR(300) NULL,
  paid_at        DATETIME NULL,
  release_at     DATETIME NULL,
  released_at    DATETIME NULL,
  refunded_at    DATETIME NULL,
  payout_status  ENUM('none','queued','sending','sent','failed') NOT NULL DEFAULT 'none',
  payout_ref     VARCHAR(60) NULL,
  transfer_code  VARCHAR(60) NULL,
  payout_error   VARCHAR(200) NULL,
  payout_sent_at DATETIME NULL,
  created_at     DATETIME NOT NULL,
  updated_at     DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY ux_jobpay_ref (reference),
  KEY ix_jobpay_job (job_id),
  KEY ix_jobpay_status (status, release_at),
  KEY ix_jobpay_artisan (artisan_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE service_jobs ADD COLUMN pay_mode VARCHAR(8) NULL;

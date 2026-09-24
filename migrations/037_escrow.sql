-- Buja migration 037: Declutter escrow. The buyer pays through Paystack, Buja holds it, the seller is paid when the
-- buyer confirms the item arrived (or after 3 days with no complaint). Refunds when the seller never hands it over.
USE buja;

CREATE TABLE IF NOT EXISTS escrow_orders (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  listing_id    BIGINT UNSIGNED NOT NULL,
  buyer_id      BIGINT UNSIGNED NOT NULL,
  seller_id     BIGINT UNSIGNED NOT NULL,
  price         INT UNSIGNED NOT NULL,          -- what the seller receives, naira
  fee           INT UNSIGNED NOT NULL,          -- buyer protection fee, naira
  total         INT UNSIGNED NOT NULL,          -- what the buyer paid
  reference     VARCHAR(60) NOT NULL,
  status        ENUM('pending','paid','shipped','released','disputed','refunded','cancelled') NOT NULL DEFAULT 'pending',
  note          VARCHAR(300) NULL,              -- the buyer's problem, or the admin's decision
  paid_at       DATETIME NULL,
  shipped_at    DATETIME NULL,
  release_at    DATETIME NULL,                  -- automatic release if the buyer says nothing
  released_at   DATETIME NULL,
  refunded_at   DATETIME NULL,
  created_at    DATETIME NOT NULL,
  updated_at    DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY ux_escrow_ref (reference),
  KEY ix_escrow_buyer (buyer_id, created_at),
  KEY ix_escrow_seller (seller_id, created_at),
  KEY ix_escrow_status (status, release_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payout_accounts (
  user_id         BIGINT UNSIGNED NOT NULL,
  bank_code       VARCHAR(10) NOT NULL,
  bank_name       VARCHAR(80) NOT NULL,
  account_last4   CHAR(4) NOT NULL,             -- only the last four digits are kept; Paystack holds the full number
  account_name    VARCHAR(120) NOT NULL,
  recipient_code  VARCHAR(40) NOT NULL,
  updated_at      DATETIME NOT NULL,
  PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payouts (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id      BIGINT UNSIGNED NOT NULL,
  seller_id     BIGINT UNSIGNED NOT NULL,
  amount        INT UNSIGNED NOT NULL,
  status        ENUM('queued','sending','sent','failed') NOT NULL DEFAULT 'queued',
  reference     VARCHAR(60) NOT NULL,
  transfer_code VARCHAR(60) NULL,
  error         VARCHAR(200) NULL,
  created_at    DATETIME NOT NULL,
  sent_at       DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY ux_payout_order (order_id),
  UNIQUE KEY ux_payout_ref (reference),
  KEY ix_payout_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

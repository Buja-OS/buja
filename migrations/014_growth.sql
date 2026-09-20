-- Buja migration 014: invites, reporting any content, search helpers. One change per statement for TiDB.

USE buja;

ALTER TABLE users ADD COLUMN invite_code CHAR(8) NULL;
ALTER TABLE users ADD COLUMN referred_by BIGINT UNSIGNED NULL;
ALTER TABLE reports ADD COLUMN target_kind VARCHAR(12) NOT NULL DEFAULT 'user';
ALTER TABLE reports ADD COLUMN target_id BIGINT UNSIGNED NULL;
ALTER TABLE users ADD UNIQUE INDEX uq_invite_code (invite_code);

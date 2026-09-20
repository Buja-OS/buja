-- Buja migration 019: peer-to-peer calls in chat. The two phones talk directly; Buja only passes
-- the handshake between them and never sees or stores any audio or video.
USE buja;

ALTER TABLE calls ADD COLUMN engine ENUM('rtc','jitsi') NOT NULL DEFAULT 'rtc';
ALTER TABLE calls ADD COLUMN status ENUM('ringing','active','ended','declined','missed') NOT NULL DEFAULT 'ringing';
ALTER TABLE calls ADD COLUMN callee BIGINT UNSIGNED NULL;
UPDATE calls SET engine = 'jitsi' WHERE kind = 'interview';

CREATE TABLE IF NOT EXISTS call_signals (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  call_id    BIGINT UNSIGNED NOT NULL,
  from_user  BIGINT UNSIGNED NOT NULL,
  kind       VARCHAR(12) NOT NULL,
  payload    TEXT NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_sig_call (call_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

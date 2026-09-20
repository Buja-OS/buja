-- Buja migration 018: video and audio calls, inside Buja. One change per statement for TiDB.
USE buja;

ALTER TABLE messages MODIFY COLUMN type ENUM('text','interview','inspection','offer','media','call') NOT NULL DEFAULT 'text';

CREATE TABLE IF NOT EXISTS calls (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room       CHAR(40) NOT NULL,
  kind       ENUM('interview','match') NOT NULL,
  mode       ENUM('video','audio') NOT NULL DEFAULT 'video',
  thread_id  BIGINT UNSIGNED NOT NULL,
  created_by BIGINT UNSIGNED NOT NULL,
  starts_at  DATETIME NULL,
  joined_at  DATETIME NULL,
  ended_at   DATETIME NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_call_room (room),
  KEY ix_call_thread (thread_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

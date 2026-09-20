-- Buja migration 021: ratings for people, live road alerts, and the weekly digest.
USE buja;

CREATE TABLE IF NOT EXISTS user_ratings (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  rater      BIGINT UNSIGNED NOT NULL,
  rated      BIGINT UNSIGNED NOT NULL,
  thread_id  BIGINT UNSIGNED NOT NULL,
  module     VARCHAR(12) NOT NULL,
  stars      TINYINT UNSIGNED NOT NULL,
  tags       VARCHAR(400) NULL,
  comment    VARCHAR(400) NULL,
  hidden_at  DATETIME NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rating_thread (thread_id, rater),
  KEY ix_rating_rated (rated, hidden_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS waka_alerts (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  kind       VARCHAR(16) NOT NULL,
  place_id   BIGINT UNSIGNED NULL,
  route_id   BIGINT UNSIGNED NULL,
  district   VARCHAR(60) NULL,
  note       VARCHAR(300) NULL,
  confirms   INT UNSIGNED NOT NULL DEFAULT 1,
  cleared    INT UNSIGNED NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_alert_live (expires_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS waka_alert_votes (
  alert_id   BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  vote       TINYINT NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (alert_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE users ADD COLUMN notify_digest TINYINT(1) NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN digest_sent_at DATETIME NULL;

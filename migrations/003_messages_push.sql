-- Buja migration 003: messages, interview invitations, push notifications, email tokens, notification preferences.
-- Run once in TiDB SQL Editor (or phpMyAdmin) in the buja database.

USE buja;

ALTER TABLE users
  ADD COLUMN notify_work   TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN notify_match  TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN notify_waka   TINYINT(1) NOT NULL DEFAULT 1,
  ADD COLUMN notify_offers TINYINT(1) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS app_keys (
  k VARCHAR(40) NOT NULL,
  v TEXT NOT NULL,
  PRIMARY KEY (k)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS threads (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  kind            ENUM('work','match','homes','declutter') NOT NULL DEFAULT 'work',
  application_id  BIGINT UNSIGNED NULL,
  user_a          BIGINT UNSIGNED NOT NULL,
  user_b          BIGINT UNSIGNED NOT NULL,
  last_message_at DATETIME NOT NULL,
  created_at      DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_threads_application (application_id),
  KEY ix_threads_a (user_a, last_message_at),
  KEY ix_threads_b (user_b, last_message_at),
  CONSTRAINT fk_threads_a FOREIGN KEY (user_a) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_threads_b FOREIGN KEY (user_b) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS messages (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  thread_id  BIGINT UNSIGNED NOT NULL,
  sender_id  BIGINT UNSIGNED NOT NULL,
  type       ENUM('text','interview') NOT NULL DEFAULT 'text',
  body       VARCHAR(2000) NOT NULL,
  meta       JSON NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_messages_thread (thread_id, id),
  CONSTRAINT fk_messages_thread FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS thread_reads (
  thread_id    BIGINT UNSIGNED NOT NULL,
  user_id      BIGINT UNSIGNED NOT NULL,
  last_read_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (thread_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  endpoint   VARCHAR(500) NOT NULL,
  p256dh     VARCHAR(200) NOT NULL,
  auth       VARCHAR(50)  NOT NULL,
  user_agent VARCHAR(255) NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_push_endpoint (endpoint(191)),
  KEY ix_push_user (user_id),
  CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS email_tokens (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  purpose    ENUM('verify','reset') NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_token (token_hash),
  KEY ix_token_user (user_id, purpose)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

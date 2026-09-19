-- Buja migration 004: Match module.
-- Run once in TiDB SQL Editor (or phpMyAdmin) in the buja database.

USE buja;

CREATE TABLE IF NOT EXISTS match_profiles (
  user_id     BIGINT UNSIGNED NOT NULL,
  birthdate   DATE NOT NULL,
  gender      ENUM('woman','man') NOT NULL,
  seeking     ENUM('women','men','everyone') NOT NULL,
  bio         VARCHAR(300) NULL,
  interests   JSON NULL,
  prompts     JSON NULL,
  faith       VARCHAR(30) NULL,
  drinking    VARCHAR(20) NULL,
  smoking     VARCHAR(20) NULL,
  kids        VARCHAR(30) NULL,
  height      SMALLINT UNSIGNED NULL,
  work        VARCHAR(80) NULL,
  education   VARCHAR(80) NULL,
  languages   VARCHAR(80) NULL,
  age_min     TINYINT UNSIGNED NOT NULL DEFAULT 21,
  age_max     TINYINT UNSIGNED NOT NULL DEFAULT 40,
  nearby_only TINYINT(1) NOT NULL DEFAULT 0,
  visible     TINYINT(1) NOT NULL DEFAULT 1,
  active_at   DATETIME NOT NULL,
  created_at  DATETIME NOT NULL,
  updated_at  DATETIME NOT NULL,
  PRIMARY KEY (user_id),
  KEY ix_mp_discover (visible, gender, seeking, birthdate),
  CONSTRAINT fk_mp_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Photos live in the database for now (compressed on the phone before upload, 700 KB cap). Object storage later.
CREATE TABLE IF NOT EXISTS match_photos (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  position   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  mime       VARCHAR(40) NOT NULL,
  size       INT UNSIGNED NOT NULL,
  data       MEDIUMBLOB NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_photos_user (user_id, position),
  CONSTRAINT fk_photos_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS swipes (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  from_user  BIGINT UNSIGNED NOT NULL,
  to_user    BIGINT UNSIGNED NOT NULL,
  action     ENUM('like','pass','superlike') NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_swipe (from_user, to_user),
  KEY ix_swipe_to (to_user, action, created_at),
  CONSTRAINT fk_swipe_from FOREIGN KEY (from_user) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_swipe_to   FOREIGN KEY (to_user)   REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS matches (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_a     BIGINT UNSIGNED NOT NULL,
  user_b     BIGINT UNSIGNED NOT NULL,
  thread_id  BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_match_pair (user_a, user_b),
  KEY ix_match_b (user_b),
  CONSTRAINT fk_match_thread FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS blocks (
  blocker    BIGINT UNSIGNED NOT NULL,
  blocked    BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (blocker, blocked)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reports (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  reporter   BIGINT UNSIGNED NOT NULL,
  reported   BIGINT UNSIGNED NOT NULL,
  reason     VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL,
  reviewed_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY ix_reports_reported (reported)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

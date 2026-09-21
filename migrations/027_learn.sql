-- Buja migration 027: Buja Learn. Course content lives in code (api/src/Curriculum.php) so it ships with deploys;
-- the database keeps only what belongs to a person: progress, exercise attempts and certificates.
USE buja;

CREATE TABLE IF NOT EXISTS learn_progress (
  user_id      BIGINT UNSIGNED NOT NULL,
  course       VARCHAR(40) NOT NULL,
  lesson       SMALLINT UNSIGNED NOT NULL,
  score        TINYINT UNSIGNED NOT NULL DEFAULT 100,
  attempts     SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  completed_at DATETIME NOT NULL,
  PRIMARY KEY (user_id, course, lesson),
  KEY ix_lp_course (course, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS learn_saves (
  user_id    BIGINT UNSIGNED NOT NULL,
  course     VARCHAR(40) NOT NULL,
  lesson     SMALLINT UNSIGNED NOT NULL,
  code       TEXT NOT NULL,
  updated_at DATETIME NOT NULL,
  PRIMARY KEY (user_id, course, lesson)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS certificates (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code       CHAR(12) NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  course     VARCHAR(40) NOT NULL,
  holder     VARCHAR(90) NOT NULL,
  score      TINYINT UNSIGNED NOT NULL,
  issued_at  DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cert_code (code),
  UNIQUE KEY uq_cert_user_course (user_id, course)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

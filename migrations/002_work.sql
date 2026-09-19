-- Buja migration 002: Work module (jobs board).
-- Run once in TiDB SQL Editor or phpMyAdmin, in the buja database. Safe to re-run.

USE buja;

CREATE TABLE IF NOT EXISTS companies (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_id    BIGINT UNSIGNED NOT NULL,
  name        VARCHAR(120) NOT NULL,
  district    VARCHAR(60)  NOT NULL,
  about       TEXT         NULL,
  website     VARCHAR(200) NULL,
  logo_url    VARCHAR(500) NULL,
  verified_at DATETIME     NULL,
  created_at  DATETIME     NOT NULL,
  updated_at  DATETIME     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_companies_owner (owner_id),
  CONSTRAINT fk_companies_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS jobs (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id  BIGINT UNSIGNED NOT NULL,
  title       VARCHAR(120) NOT NULL,
  district    VARCHAR(60)  NOT NULL,
  type        ENUM('full_time','part_time','contract','internship','remote') NOT NULL DEFAULT 'full_time',
  salary_min  INT UNSIGNED NULL,
  salary_max  INT UNSIGNED NULL,
  description TEXT         NOT NULL,
  deadline    DATE         NULL,
  openings    SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  status      ENUM('open','closed') NOT NULL DEFAULT 'open',
  created_at  DATETIME     NOT NULL,
  updated_at  DATETIME     NOT NULL,
  PRIMARY KEY (id),
  KEY ix_jobs_company (company_id),
  KEY ix_jobs_feed (status, created_at),
  KEY ix_jobs_district (district, status),
  CONSTRAINT fk_jobs_company FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS job_requirements (
  id      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id  BIGINT UNSIGNED NOT NULL,
  label   VARCHAR(120) NOT NULL,
  weight  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY ix_req_job (job_id),
  CONSTRAINT fk_req_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS seeker_profiles (
  user_id      BIGINT UNSIGNED NOT NULL,
  headline     VARCHAR(120) NULL,
  years        TINYINT UNSIGNED NOT NULL DEFAULT 0,
  open_to_work TINYINT(1) NOT NULL DEFAULT 1,
  skills       JSON NULL,
  updated_at   DATETIME NOT NULL,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_seeker_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CVs live in the database for now (2 MB cap). Phase 4 moves them to object storage.
CREATE TABLE IF NOT EXISTS cv_files (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  name       VARCHAR(120) NOT NULL,
  mime       VARCHAR(100) NOT NULL,
  size       INT UNSIGNED NOT NULL,
  data       MEDIUMBLOB   NOT NULL,
  updated_at DATETIME     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cv_user (user_id),
  CONSTRAINT fk_cv_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS applications (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_id      BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  cv_file_id  BIGINT UNSIGNED NULL,
  note        VARCHAR(600) NULL,
  met_ids     JSON NULL,
  match_score TINYINT UNSIGNED NOT NULL DEFAULT 0,
  status      ENUM('new','shortlisted','interview','rejected','hired') NOT NULL DEFAULT 'new',
  created_at  DATETIME NOT NULL,
  updated_at  DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_app_job_user (job_id, user_id),
  KEY ix_app_user (user_id, created_at),
  KEY ix_app_job_score (job_id, match_score),
  CONSTRAINT fk_app_job  FOREIGN KEY (job_id)  REFERENCES jobs(id)  ON DELETE CASCADE,
  CONSTRAINT fk_app_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saved_jobs (
  user_id    BIGINT UNSIGNED NOT NULL,
  job_id     BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (user_id, job_id),
  CONSTRAINT fk_saved_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_saved_job  FOREIGN KEY (job_id)  REFERENCES jobs(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

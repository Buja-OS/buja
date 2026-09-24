-- Buja migration 039: how Buja Kart runs on real phones, achievements, and weekly tournament prizes.
USE buja;

CREATE TABLE IF NOT EXISTS kart_perf (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  tier        VARCHAR(8) NOT NULL,           -- low, medium, high
  auto_tier   TINYINT(1) NOT NULL DEFAULT 1, -- chosen by Auto, or by hand
  gpu         VARCHAR(120) NOT NULL,         -- the graphics chip the browser reports
  device      VARCHAR(80) NULL,              -- phone model from the browser, when it says
  mem_gb      DECIMAL(4,1) NULL,
  cores       TINYINT UNSIGNED NULL,
  fps_avg     DECIMAL(5,1) NOT NULL,
  fps_low     DECIMAL(5,1) NOT NULL,         -- the slowest tenth of frames
  draw_calls  SMALLINT UNSIGNED NULL,
  track       VARCHAR(20) NULL,
  seconds     SMALLINT UNSIGNED NOT NULL,
  created_at  DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_perf_gpu (gpu(60), tier),
  KEY ix_perf_time (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kart_achievements (
  user_id    BIGINT UNSIGNED NOT NULL,
  code       VARCHAR(30) NOT NULL,
  earned_at  DATETIME NOT NULL,
  PRIMARY KEY (user_id, code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kart_prizes (
  week       CHAR(10) NOT NULL,                -- the Monday the week began, Abuja time
  track      VARCHAR(20) NOT NULL,
  place      TINYINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  lap_ms     INT UNSIGNED NOT NULL,
  coins      INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (week, track, place)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

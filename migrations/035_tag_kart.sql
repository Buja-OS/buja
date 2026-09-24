-- Buja migration 035: Buja Tag (a unique @handle for every account) and Buja Kart (races, rooms, chat, leaderboards).
USE buja;

ALTER TABLE users ADD COLUMN tag VARCHAR(20) NULL;
CREATE UNIQUE INDEX ux_users_tag ON users (tag);

CREATE TABLE IF NOT EXISTS kart_times (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  track       VARCHAR(20) NOT NULL,
  lap_ms      INT UNSIGNED NOT NULL,       -- best lap of the race
  race_ms     INT UNSIGNED NOT NULL,       -- three laps
  mode        VARCHAR(10) NOT NULL,        -- solo, bots, room
  ghost       MEDIUMTEXT NULL,             -- the best lap, sampled, so others can race against it
  created_at  DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_kt_board (track, lap_ms),
  KEY ix_kt_user (user_id, track, lap_ms)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kart_rooms (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code        CHAR(5) NOT NULL,
  host_id     BIGINT UNSIGNED NOT NULL,
  track       VARCHAR(20) NOT NULL,
  laps        TINYINT UNSIGNED NOT NULL DEFAULT 3,
  status      ENUM('lobby','racing','done') NOT NULL DEFAULT 'lobby',
  start_at    DATETIME(3) NULL,
  created_at  DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY ux_room_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kart_players (
  room_id     BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  colour      VARCHAR(9) NOT NULL,
  ready       TINYINT(1) NOT NULL DEFAULT 0,
  state       VARCHAR(160) NULL,           -- x,z,heading,speed,lap,progress: tiny, sent 5 times a second
  state_at    DATETIME(3) NULL,
  finish_ms   INT UNSIGNED NULL,
  joined_at   DATETIME NOT NULL,
  PRIMARY KEY (room_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kart_chat (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id     BIGINT UNSIGNED NOT NULL,
  user_id     BIGINT UNSIGNED NOT NULL,
  body        VARCHAR(140) NOT NULL,
  created_at  DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_kc_room (room_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

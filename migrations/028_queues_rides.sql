-- Buja migration 028: office queue reports (NIN, passport, licence) and commute sharing.
USE buja;

CREATE TABLE IF NOT EXISTS queue_offices (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(90) NOT NULL,
  service    VARCHAR(20) NOT NULL,
  district   VARCHAR(60) NOT NULL,
  lat        DECIMAL(9,6) NULL,
  lng        DECIMAL(9,6) NULL,
  added_by   BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_qo_service (service)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS queue_reports (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  office_id  BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  wait_min   SMALLINT UNSIGNED NOT NULL,
  crowd      ENUM('empty','busy','packed','closed') NOT NULL,
  note       VARCHAR(200) NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_qr_office (office_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO queue_offices (name, service, district, lat, lng, created_at) VALUES
('NIMC Headquarters (NIN)', 'nin', 'Wuse', 9.0655, 7.4744, NOW()),
('NIMC Garki Enrolment Centre', 'nin', 'Garki', 9.0310, 7.4890, NOW()),
('Nigeria Immigration Service HQ (Passport)', 'passport', 'Lugbe', 8.9880, 7.3960, NOW()),
('Immigration Passport Office, Gwagwalada', 'passport', 'Gwagwalada', 8.9430, 7.0900, NOW()),
('FRSC Driver''s Licence Centre, Wuse Zone 3', 'licence', 'Wuse', 9.0687, 7.4600, NOW()),
('DRTS (VIO) Headquarters, Mabushi', 'vehicle', 'Utako', 9.0760, 7.4460, NOW()),
('FRSC Number Plate Centre, Mabushi', 'vehicle', 'Utako', 9.0770, 7.4470, NOW()),
('AMAC Secretariat', 'council', 'Garki', 9.0295, 7.4920, NOW()),
('Federal High Court Registry', 'court', 'Central Area', 9.0520, 7.4920, NOW()),
('FCT Tax Office (FIRS Wuse)', 'tax', 'Wuse', 9.0700, 7.4700, NOW());

CREATE TABLE IF NOT EXISTS rides (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  driver_id   BIGINT UNSIGNED NOT NULL,
  from_place  BIGINT UNSIGNED NOT NULL,
  to_place    BIGINT UNSIGNED NOT NULL,
  leaves_at   TIME NOT NULL,
  days        VARCHAR(20) NOT NULL,
  seats       TINYINT UNSIGNED NOT NULL DEFAULT 2,
  share       INT UNSIGNED NOT NULL DEFAULT 0,
  note        VARCHAR(300) NULL,
  active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_rides_from (from_place, active),
  KEY ix_rides_driver (driver_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ride_requests (
  ride_id    BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  status     ENUM('asked','accepted','declined') NOT NULL DEFAULT 'asked',
  created_at DATETIME NOT NULL,
  PRIMARY KEY (ride_id, user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

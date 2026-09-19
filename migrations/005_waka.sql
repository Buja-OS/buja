-- Buja migration 005: Waka (routes, stops, crowd fares, check-ins, saved routes) with Abuja seed data.
-- Coordinates and fares are estimates to be corrected by riders' reports. Run once in the buja database.

USE buja;

CREATE TABLE IF NOT EXISTS places (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(80) NOT NULL,
  district   VARCHAR(60) NOT NULL,
  lat        DECIMAL(9,6) NOT NULL,
  lng        DECIMAL(9,6) NOT NULL,
  kind       ENUM('park','stop','landmark') NOT NULL DEFAULT 'stop',
  popularity SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  active     TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY ix_places_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS routes (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name         VARCHAR(80) NOT NULL,
  mode         ENUM('bus','keke','taxi','train') NOT NULL DEFAULT 'bus',
  origin_place BIGINT UNSIGNED NOT NULL,
  dest_place   BIGINT UNSIGNED NOT NULL,
  color        CHAR(7) NOT NULL DEFAULT '#7ED957',
  notes        VARCHAR(255) NULL,
  active       TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS route_stops (
  route_id BIGINT UNSIGNED NOT NULL,
  place_id BIGINT UNSIGNED NOT NULL,
  position TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (route_id, position),
  KEY ix_rs_place (place_id),
  CONSTRAINT fk_rs_route FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE,
  CONSTRAINT fk_rs_place FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Starting fares from origin to end, used until riders report real ones.
CREATE TABLE IF NOT EXISTS fare_seeds (
  route_id   BIGINT UNSIGNED NOT NULL,
  from_place BIGINT UNSIGNED NOT NULL,
  to_place   BIGINT UNSIGNED NOT NULL,
  amount     INT UNSIGNED NOT NULL,
  PRIMARY KEY (route_id, from_place, to_place)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- What riders actually paid. The fare shown is the median of the last 30 days.
CREATE TABLE IF NOT EXISTS fare_reports (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  route_id   BIGINT UNSIGNED NOT NULL,
  from_place BIGINT UNSIGNED NOT NULL,
  to_place   BIGINT UNSIGNED NOT NULL,
  amount     INT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_fare_lookup (route_id, from_place, to_place, created_at),
  CONSTRAINT fk_fare_route FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS route_checkins (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  route_id   BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_checkin (route_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saved_routes (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  from_place BIGINT UNSIGNED NOT NULL,
  to_place   BIGINT UNSIGNED NOT NULL,
  label      VARCHAR(40) NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_saved_user (user_id),
  CONSTRAINT fk_saved_route_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed places
INSERT IGNORE INTO places (id, name, district, lat, lng, kind, popularity) VALUES
(1,'Berger Junction','Utako',9.0628,7.4522,'park',100),
(2,'Wuse Market','Wuse',9.0655,7.467,'park',95),
(3,'Jabi Motor Park','Jabi',9.0638,7.4262,'park',90),
(4,'Area 1, Garki','Garki',9.029,7.4842,'park',88),
(5,'Area 3 Junction','Garki',9.0435,7.487,'stop',60),
(6,'Central Area (Eagle Square)','Central Area',9.0505,7.493,'landmark',70),
(7,'Maitama (Transcorp Hilton)','Maitama',9.0845,7.4935,'landmark',55),
(8,'Banex Plaza, Wuse 2','Wuse 2',9.08,7.478,'stop',65),
(9,'Utako Market','Utako',9.0648,7.4405,'stop',58),
(10,'Mabushi Junction','Mabushi',9.0862,7.447,'stop',50),
(11,'Jahi Junction','Jahi',9.0985,7.4325,'stop',45),
(12,'Life Camp Gate','Life Camp',9.099,7.4205,'stop',48),
(13,'Gwarinpa 1st Avenue','Gwarinpa',9.106,7.406,'park',85),
(14,'Gwarinpa 3rd Avenue','Gwarinpa',9.115,7.4,'stop',55),
(15,'Dutse Alhaji Junction','Dutse',9.162,7.39,'stop',50),
(16,'Kubwa (Phase 2 Junction)','Kubwa',9.1545,7.329,'park',80),
(17,'Bwari Market','Bwari',9.282,7.382,'park',35),
(18,'Nyanya (Under Bridge)','Nyanya',9.0335,7.585,'park',78),
(19,'Karu Site','Karu',9.014,7.607,'stop',45),
(20,'Mararaba','Mararaba',9.006,7.64,'park',60),
(21,'AYA Junction, Asokoro','Asokoro',9.04,7.515,'stop',62),
(22,'Apo (Legislative Quarters Gate)','Apo',8.988,7.482,'stop',40),
(23,'Lokogoma Junction','Lokogoma',8.98,7.45,'stop',38),
(24,'Galadimawa Roundabout','Galadimawa',8.977,7.423,'stop',48),
(25,'Lugbe (Police Signboard)','Lugbe',8.975,7.366,'park',72),
(26,'Airport (Nnamdi Azikiwe)','Airport',9.0068,7.2632,'landmark',52),
(27,'Kuje Motor Park','Kuje',8.879,7.227,'park',40),
(28,'Gwagwalada Park','Gwagwalada',8.943,7.081,'park',50),
(29,'Zuba Motor Park','Zuba',9.102,7.209,'park',44),
(30,'Jabi Lake Mall','Jabi',9.0705,7.418,'landmark',58),
(31,'Wuse Zone 4 (Federal Secretariat Road)','Wuse',9.0705,7.482,'stop',42),
(32,'Idu Train Station','Idu',9.043,7.382,'landmark',36),
(33,'Kado Estate Gate','Kado',9.08,7.416,'stop',34),
(34,'Gudu Market','Gudu',8.999,7.468,'stop',40);

-- Seed routes
INSERT IGNORE INTO routes (id, name, mode, origin_place, dest_place, color, notes) VALUES
(1,'Berger to Gwarinpa','bus',1,14,'#7ED957','Green and white buses. Board at Berger under bridge, Gwarinpa side.'),
(2,'Berger to Kubwa','bus',1,16,'#FF7A1A','Fills fast after 5pm. Dutse Alhaji is a common drop.'),
(3,'Wuse Market to Nyanya','bus',2,20,'#1F4E9C','Via Area 3, AYA and Nyanya. Long queue on weekday evenings.'),
(4,'Area 1 to Nyanya','bus',4,18,'#8E44AD','Garki side. Shorter than the Wuse route if you are already in Garki.'),
(5,'Berger to Lugbe (Airport Road)','bus',1,25,'#0E7C86','Airport Road buses. Galadimawa is the transfer for Lokogoma.'),
(6,'Jabi to Gwagwalada','bus',3,28,'#C0392B','Jabi Motor Park loading bay. Stops at Zuba on request.'),
(7,'Berger to Kuje','bus',1,27,'#E8620E','Via Airport Road and Galadimawa.'),
(8,'Berger to Wuse Market','bus',1,2,'#2E7D1E','Short hop, very frequent.'),
(9,'Wuse Market to Maitama','keke',2,7,'#8B4513','Keke from the market side of Wuse to Banex and Maitama.'),
(10,'Jabi Park to Jabi Lake Mall','keke',3,30,'#6E4A2E','Keke, five minutes. Ask for Jabi Lake.'),
(11,'Area 1 to Apo and Gudu','bus',4,22,'#3E5C76','Garki to Apo via Gudu.'),
(12,'Apo to Lokogoma','keke',22,23,'#7A5C8C','Keke only. Price changes with fuel.'),
(13,'Berger to Central Area','bus',1,6,'#1B1B1F','For Eagle Square, ministries and the CBD.'),
(14,'Kubwa to Bwari','bus',16,17,'#4E6E58','From Kubwa Phase 2 junction.'),
(15,'Idu to Kubwa (Abuja light rail)','train',32,16,'#101014','Abuja Rail Mass Transit. Check timetable; not all days run.');

INSERT IGNORE INTO route_stops (route_id, place_id, position) VALUES
(1,1,0),
(1,9,1),
(1,10,2),
(1,11,3),
(1,12,4),
(1,13,5),
(1,14,6),
(2,1,0),
(2,9,1),
(2,10,2),
(2,11,3),
(2,12,4),
(2,13,5),
(2,15,6),
(2,16,7),
(3,2,0),
(3,31,1),
(3,5,2),
(3,21,3),
(3,18,4),
(3,19,5),
(3,20,6),
(4,4,0),
(4,5,1),
(4,21,2),
(4,18,3),
(5,1,0),
(5,3,1),
(5,24,2),
(5,25,3),
(6,3,0),
(6,24,1),
(6,25,2),
(6,26,3),
(6,29,4),
(6,28,5),
(7,1,0),
(7,3,1),
(7,24,2),
(7,25,3),
(7,27,4),
(8,1,0),
(8,9,1),
(8,2,2),
(9,2,0),
(9,8,1),
(9,7,2),
(10,3,0),
(10,33,1),
(10,30,2),
(11,4,0),
(11,34,1),
(11,22,2),
(12,22,0),
(12,23,1),
(13,1,0),
(13,9,1),
(13,2,2),
(13,31,3),
(13,6,4),
(14,16,0),
(14,17,1),
(15,32,0),
(15,16,1);

INSERT IGNORE INTO fare_seeds (route_id, from_place, to_place, amount) VALUES
(1,1,14,400),
(2,1,16,500),
(3,2,20,500),
(4,4,18,350),
(5,1,25,400),
(6,3,28,900),
(7,1,27,800),
(8,1,2,200),
(9,2,7,300),
(10,3,30,200),
(11,4,22,300),
(12,22,23,250),
(13,1,6,250),
(14,16,17,400),
(15,32,16,500);

-- Common segment fares
INSERT IGNORE INTO fare_seeds (route_id, from_place, to_place, amount) VALUES
(1,1,13,350),
(2,1,13,350),
(2,1,15,450),
(1,1,11,250),
(2,1,11,250),
(5,1,3,150),
(5,1,24,300),
(6,3,25,400),
(6,3,26,600),
(7,1,25,400),
(3,2,21,300),
(3,2,18,400),
(13,1,2,200),
(5,3,25,300);

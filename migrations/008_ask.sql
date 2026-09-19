-- Buja migration 008: Ask Buja (spots directory, ratings, query log) with a starter directory of well-known places.
-- Descriptions and price levels are starting points; residents rate and correct them. Run once in the buja database.

USE buja;

CREATE TABLE IF NOT EXISTS spots (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(80) NOT NULL,
  category    VARCHAR(20) NOT NULL,
  district    VARCHAR(60) NOT NULL,
  area        VARCHAR(100) NULL,
  tags        JSON NULL,
  price_level TINYINT UNSIGNED NOT NULL DEFAULT 2,
  price_note  VARCHAR(60) NULL,
  description VARCHAR(400) NOT NULL,
  hours       VARCHAR(60) NULL,
  lat         DECIMAL(9,6) NULL,
  lng         DECIMAL(9,6) NULL,
  added_by    BIGINT UNSIGNED NULL,
  verified_at DATETIME NULL,
  active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_spots_cat (active, category, district)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS spot_ratings (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  spot_id    BIGINT UNSIGNED NOT NULL,
  user_id    BIGINT UNSIGNED NOT NULL,
  stars      TINYINT UNSIGNED NOT NULL,
  comment    VARCHAR(300) NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rating (spot_id, user_id),
  CONSTRAINT fk_rating_spot FOREIGN KEY (spot_id) REFERENCES spots(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ask_log (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    BIGINT UNSIGNED NOT NULL,
  question   VARCHAR(300) NOT NULL,
  district   VARCHAR(60) NULL,
  spot_ids   JSON NULL,
  mode       VARCHAR(10) NOT NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO spots (id, name, category, district, area, tags, price_level, price_note, description, hours, verified_at, created_at) VALUES
(1,'Jabi Lake Mall','shopping','Jabi','Jabi Lake','["mall", "cinema", "shopping", "food court", "shoprite", "date"]',3,NULL,'Big mall on the lake with a cinema, Shoprite, restaurants and a lakeside walk. Busy at weekends.','10:00 – 22:00',NOW(),NOW()),
(2,'Jabi Lake (waterfront)','relax','Jabi','Jabi','["lake", "boat", "picnic", "sunset", "walk", "serene", "quiet", "date"]',1,'Boat rides extra','Open water, boat rides, evening breeze and street food along the shore. Good for a slow evening.','Daylight',NOW(),NOW()),
(3,'Millennium Park','relax','Maitama','Maitama','["park", "picnic", "walk", "family", "serene", "quiet", "green"]',1,'Free entry','Abuja''s biggest public park: lawns, fountains, walkways. Free, popular with families on Sundays.','07:00 – 18:00',NOW(),NOW()),
(4,'Ceddi Plaza','shopping','Central Area','Central Area','["mall", "shopping", "cinema", "food"]',3,NULL,'Central Business District mall with shops, a cinema and cafes. Quieter than Jabi Lake Mall.','10:00 – 21:00',NOW(),NOW()),
(5,'Silverbird Entertainment Centre','shopping','Central Area','Central Area','["cinema", "mall", "movies", "shopping"]',3,NULL,'Cinema and shops in the CBD. Common first-date choice for a film.','10:00 – 22:00',NOW(),NOW()),
(6,'Wuse Market','shopping','Wuse','Wuse Zone 5','["market", "shopping", "fabric", "phones", "food", "cheap", "bargain"]',1,'Bargain expected','The main open market: fabrics, phones, electronics, foodstuffs. Go with someone who can bargain.','07:00 – 19:00',NOW(),NOW()),
(7,'Arts and Crafts Village','culture','Central Area','Central Area, near Sheraton','["art", "craft", "gifts", "souvenir", "culture", "market"]',2,'Bargain expected','Stalls of carvings, beads, leather and fabric from across Nigeria. Bargain, but not too hard.','09:00 – 18:00',NOW(),NOW()),
(8,'National Mosque','worship','Central Area','Central Area','["mosque", "pray", "friday", "islam", "landmark"]',1,'Free','The National Mosque with the gold dome. Visitors welcome outside prayer times, dress modestly.','Daily',NOW(),NOW()),
(9,'National Christian Centre','worship','Central Area','Central Area','["church", "sunday", "christian", "landmark", "service"]',1,'Free','The National Ecumenical Centre opposite the mosque. Sunday services and a striking building.','Daily',NOW(),NOW()),
(10,'Magicland Amusement Park','kids','Central Area','Kalakuta, near Central Area','["kids", "children", "rides", "amusement", "family", "fun"]',2,'Rides paid per ride','Rides, bumper cars and a fairground feel. Best with children on a weekend afternoon.','12:00 – 20:00',NOW(),NOW()),
(11,'Transcorp Hilton','hotel','Maitama','Maitama','["hotel", "lounge", "pool", "fancy", "premium", "bar", "brunch"]',4,NULL,'The landmark hotel. Poolside lounge, restaurants and a bar people go to for a fancy evening.','24 hours',NOW(),NOW()),
(12,'Blu Cabana','lounge','Mabushi','Mabushi','["lounge", "pool", "bar", "cocktail", "fancy", "hangout", "date", "lounge"]',3,NULL,'Poolside lounge and restaurant, big at weekends. Book ahead for a Saturday.','12:00 – late',NOW(),NOW()),
(13,'Jevinik Restaurant','food','Wuse 2','Wuse 2','["nigerian", "food", "afang", "egusi", "pounded yam", "lunch", "dinner", "native"]',2,'₦4,000 – ₦8,000 a plate','Nigerian dishes done properly: afang, egusi, pounded yam. Busy at lunch with office workers.','11:00 – 22:00',NOW(),NOW()),
(14,'Nkoyo Restaurant','food','Central Area','Ceddi Plaza','["nigerian", "food", "buffet", "lunch", "dinner", "native", "fancy"]',3,NULL,'Upmarket Nigerian food in the CBD, known for its buffet and a calm room.','11:00 – 22:00',NOW(),NOW()),
(15,'Wakkis Restaurant','food','Wuse 2','Wuse 2','["indian", "food", "curry", "naan", "dinner", "date"]',3,NULL,'Long-running Indian restaurant, reliable for a dinner out.','12:00 – 22:30',NOW(),NOW()),
(16,'Salamander Cafe','food','Wuse 2','Wuse 2','["cafe", "coffee", "brunch", "breakfast", "pancakes", "wifi", "quiet", "date"]',2,NULL,'Cafe with breakfast all day, coffee and a bookish corner. Good for a quiet catch-up.','08:00 – 22:00',NOW(),NOW()),
(17,'Abuja Wonderland','kids','Central Area','Airport Road end, Central','["kids", "children", "amusement", "rides", "family"]',2,'Per ride','Amusement park with rides and games, mainly for families and school outings.','12:00 – 20:00',NOW(),NOW()),
(18,'Zuma Rock','culture','Zuba','Zuba, Abuja–Kaduna road','["rock", "landmark", "sight", "photo", "drive", "tour"]',1,'Free to view','The giant monolith at the edge of the city. A drive-out for photos, not a place to spend the day.','Daylight',NOW(),NOW()),
(19,'Gurara Falls (day trip)','relax','Gurara','Niger State, about 1.5 hours','["waterfall", "nature", "picnic", "day trip", "swim", "serene"]',1,'Small entry fee','Waterfalls a drive from Abuja. Best in the rainy season. Go in a group.','Daylight',NOW(),NOW()),
(20,'Berger Junction suya spot','food','Utako','Berger Junction','["suya", "night", "cheap", "street food", "late", "meat"]',1,'From ₦1,000','Evening suya by the junction. Cheap, smoky, best after dark.','18:00 – late',NOW(),NOW());

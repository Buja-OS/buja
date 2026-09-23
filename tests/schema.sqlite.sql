CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL DEFAULT 'resident', name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, phone TEXT UNIQUE, password_hash TEXT, google_sub TEXT UNIQUE, avatar_url TEXT, district TEXT, email_verified_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT);
CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, jti TEXT NOT NULL UNIQUE, ip TEXT, user_agent TEXT, expires_at TEXT NOT NULL, revoked_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS rate_limits (k TEXT NOT NULL, window_id INTEGER NOT NULL, hits INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (k, window_id));
CREATE TABLE IF NOT EXISTS companies (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL UNIQUE, name TEXT NOT NULL, district TEXT NOT NULL, about TEXT, website TEXT, logo_url TEXT, verified_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS jobs (id INTEGER PRIMARY KEY AUTOINCREMENT, company_id INTEGER NOT NULL, title TEXT NOT NULL, district TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'full_time', salary_min INTEGER, salary_max INTEGER, description TEXT NOT NULL, deadline TEXT, openings INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS job_requirements (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id INTEGER NOT NULL, label TEXT NOT NULL, weight INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS seeker_profiles (user_id INTEGER PRIMARY KEY, headline TEXT, years INTEGER NOT NULL DEFAULT 0, open_to_work INTEGER NOT NULL DEFAULT 1, skills TEXT, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS cv_files (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL UNIQUE, name TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, data BLOB NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS applications (id INTEGER PRIMARY KEY AUTOINCREMENT, job_id INTEGER NOT NULL, user_id INTEGER NOT NULL, cv_file_id INTEGER, note TEXT, met_ids TEXT, match_score INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(job_id, user_id));
CREATE TABLE IF NOT EXISTS saved_jobs (user_id INTEGER NOT NULL, job_id INTEGER NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (user_id, job_id));
ALTER TABLE users ADD COLUMN notify_work INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN notify_match INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN notify_waka INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN notify_offers INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS app_keys (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS threads (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL DEFAULT 'work', application_id INTEGER UNIQUE, user_a INTEGER NOT NULL, user_b INTEGER NOT NULL, last_message_at TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, thread_id INTEGER NOT NULL, sender_id INTEGER NOT NULL, type TEXT NOT NULL DEFAULT 'text', body TEXT NOT NULL, meta TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS thread_reads (thread_id INTEGER NOT NULL, user_id INTEGER NOT NULL, last_read_id INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (thread_id, user_id));
CREATE TABLE IF NOT EXISTS push_subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, endpoint TEXT NOT NULL UNIQUE, p256dh TEXT NOT NULL, auth TEXT NOT NULL, user_agent TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS email_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, purpose TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS match_profiles (user_id INTEGER PRIMARY KEY, birthdate TEXT NOT NULL, gender TEXT NOT NULL, seeking TEXT NOT NULL, bio TEXT, interests TEXT, prompts TEXT, faith TEXT, drinking TEXT, smoking TEXT, kids TEXT, height INTEGER, work TEXT, education TEXT, languages TEXT, age_min INTEGER NOT NULL DEFAULT 21, age_max INTEGER NOT NULL DEFAULT 40, nearby_only INTEGER NOT NULL DEFAULT 0, visible INTEGER NOT NULL DEFAULT 1, active_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS match_photos (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, position INTEGER NOT NULL DEFAULT 0, mime TEXT NOT NULL, size INTEGER NOT NULL, data BLOB NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS swipes (id INTEGER PRIMARY KEY AUTOINCREMENT, from_user INTEGER NOT NULL, to_user INTEGER NOT NULL, action TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(from_user, to_user));
CREATE TABLE IF NOT EXISTS matches (id INTEGER PRIMARY KEY AUTOINCREMENT, user_a INTEGER NOT NULL, user_b INTEGER NOT NULL, thread_id INTEGER NOT NULL, created_at TEXT NOT NULL, UNIQUE(user_a, user_b));
CREATE TABLE IF NOT EXISTS blocks (blocker INTEGER NOT NULL, blocked INTEGER NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (blocker, blocked));
CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, reporter INTEGER NOT NULL, reported INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL, reviewed_at TEXT);
CREATE TABLE IF NOT EXISTS places (id INTEGER PRIMARY KEY, name TEXT NOT NULL, district TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL, kind TEXT NOT NULL DEFAULT 'stop', popularity INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS routes (id INTEGER PRIMARY KEY, name TEXT NOT NULL, mode TEXT NOT NULL DEFAULT 'bus', origin_place INTEGER NOT NULL, dest_place INTEGER NOT NULL, color TEXT NOT NULL DEFAULT '#7ED957', notes TEXT, active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS route_stops (route_id INTEGER NOT NULL, place_id INTEGER NOT NULL, position INTEGER NOT NULL, PRIMARY KEY (route_id, position));
CREATE TABLE IF NOT EXISTS fare_seeds (route_id INTEGER NOT NULL, from_place INTEGER NOT NULL, to_place INTEGER NOT NULL, amount INTEGER NOT NULL, PRIMARY KEY (route_id, from_place, to_place));
CREATE TABLE IF NOT EXISTS fare_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, route_id INTEGER NOT NULL, from_place INTEGER NOT NULL, to_place INTEGER NOT NULL, amount INTEGER NOT NULL, user_id INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS route_checkins (id INTEGER PRIMARY KEY AUTOINCREMENT, route_id INTEGER NOT NULL, user_id INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS saved_routes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, from_place INTEGER NOT NULL, to_place INTEGER NOT NULL, label TEXT, created_at TEXT NOT NULL);
INSERT OR IGNORE INTO places (id,name,district,lat,lng,kind,popularity) VALUES (1,'Berger Junction','Utako',9.0628,7.4522,'park',100),(2,'Wuse Market','Wuse',9.0655,7.467,'park',95),(3,'Jabi Motor Park','Jabi',9.0638,7.4262,'park',90),(4,'Area 1, Garki','Garki',9.029,7.4842,'park',88),(5,'Area 3 Junction','Garki',9.0435,7.487,'stop',60),(6,'Central Area (Eagle Square)','Central Area',9.0505,7.493,'landmark',70),(7,'Maitama (Transcorp Hilton)','Maitama',9.0845,7.4935,'landmark',55),(8,'Banex Plaza, Wuse 2','Wuse 2',9.08,7.478,'stop',65),(9,'Utako Market','Utako',9.0648,7.4405,'stop',58),(10,'Mabushi Junction','Mabushi',9.0862,7.447,'stop',50),(11,'Jahi Junction','Jahi',9.0985,7.4325,'stop',45),(12,'Life Camp Gate','Life Camp',9.099,7.4205,'stop',48),(13,'Gwarinpa 1st Avenue','Gwarinpa',9.106,7.406,'park',85),(14,'Gwarinpa 3rd Avenue','Gwarinpa',9.115,7.4,'stop',55),(15,'Dutse Alhaji Junction','Dutse',9.162,7.39,'stop',50),(16,'Kubwa (Phase 2 Junction)','Kubwa',9.1545,7.329,'park',80),(17,'Bwari Market','Bwari',9.282,7.382,'park',35),(18,'Nyanya (Under Bridge)','Nyanya',9.0335,7.585,'park',78),(19,'Karu Site','Karu',9.014,7.607,'stop',45),(20,'Mararaba','Mararaba',9.006,7.64,'park',60),(21,'AYA Junction, Asokoro','Asokoro',9.04,7.515,'stop',62),(22,'Apo (Legislative Quarters Gate)','Apo',8.988,7.482,'stop',40),(23,'Lokogoma Junction','Lokogoma',8.98,7.45,'stop',38),(24,'Galadimawa Roundabout','Galadimawa',8.977,7.423,'stop',48),(25,'Lugbe (Police Signboard)','Lugbe',8.975,7.366,'park',72),(26,'Airport (Nnamdi Azikiwe)','Airport',9.0068,7.2632,'landmark',52),(27,'Kuje Motor Park','Kuje',8.879,7.227,'park',40),(28,'Gwagwalada Park','Gwagwalada',8.943,7.081,'park',50),(29,'Zuba Motor Park','Zuba',9.102,7.209,'park',44),(30,'Jabi Lake Mall','Jabi',9.0705,7.418,'landmark',58),(31,'Wuse Zone 4 (Federal Secretariat Road)','Wuse',9.0705,7.482,'stop',42),(32,'Idu Train Station','Idu',9.043,7.382,'landmark',36),(33,'Kado Estate Gate','Kado',9.08,7.416,'stop',34),(34,'Gudu Market','Gudu',8.999,7.468,'stop',40);
INSERT OR IGNORE INTO routes (id,name,mode,origin_place,dest_place,color,notes) VALUES (1,'Berger to Gwarinpa','bus',1,14,'#7ED957','Green and white buses. Board at Berger under bridge, Gwarinpa side.'),(2,'Berger to Kubwa','bus',1,16,'#FF7A1A','Fills fast after 5pm. Dutse Alhaji is a common drop.'),(3,'Wuse Market to Nyanya','bus',2,20,'#1F4E9C','Via Area 3, AYA and Nyanya. Long queue on weekday evenings.'),(4,'Area 1 to Nyanya','bus',4,18,'#8E44AD','Garki side. Shorter than the Wuse route if you are already in Garki.'),(5,'Berger to Lugbe (Airport Road)','bus',1,25,'#0E7C86','Airport Road buses. Galadimawa is the transfer for Lokogoma.'),(6,'Jabi to Gwagwalada','bus',3,28,'#C0392B','Jabi Motor Park loading bay. Stops at Zuba on request.'),(7,'Berger to Kuje','bus',1,27,'#E8620E','Via Airport Road and Galadimawa.'),(8,'Berger to Wuse Market','bus',1,2,'#2E7D1E','Short hop, very frequent.'),(9,'Wuse Market to Maitama','keke',2,7,'#8B4513','Keke from the market side of Wuse to Banex and Maitama.'),(10,'Jabi Park to Jabi Lake Mall','keke',3,30,'#6E4A2E','Keke, five minutes. Ask for Jabi Lake.'),(11,'Area 1 to Apo and Gudu','bus',4,22,'#3E5C76','Garki to Apo via Gudu.'),(12,'Apo to Lokogoma','keke',22,23,'#7A5C8C','Keke only. Price changes with fuel.'),(13,'Berger to Central Area','bus',1,6,'#1B1B1F','For Eagle Square, ministries and the CBD.'),(14,'Kubwa to Bwari','bus',16,17,'#4E6E58','From Kubwa Phase 2 junction.'),(15,'Idu to Kubwa (Abuja light rail)','train',32,16,'#101014','Abuja Rail Mass Transit. Check timetable; not all days run.');
INSERT OR IGNORE INTO route_stops VALUES (1,1,0),(1,9,1),(1,10,2),(1,11,3),(1,12,4),(1,13,5),(1,14,6),(2,1,0),(2,9,1),(2,10,2),(2,11,3),(2,12,4),(2,13,5),(2,15,6),(2,16,7),(3,2,0),(3,31,1),(3,5,2),(3,21,3),(3,18,4),(3,19,5),(3,20,6),(4,4,0),(4,5,1),(4,21,2),(4,18,3),(5,1,0),(5,3,1),(5,24,2),(5,25,3),(6,3,0),(6,24,1),(6,25,2),(6,26,3),(6,29,4),(6,28,5),(7,1,0),(7,3,1),(7,24,2),(7,25,3),(7,27,4),(8,1,0),(8,9,1),(8,2,2),(9,2,0),(9,8,1),(9,7,2),(10,3,0),(10,33,1),(10,30,2),(11,4,0),(11,34,1),(11,22,2),(12,22,0),(12,23,1),(13,1,0),(13,9,1),(13,2,2),(13,31,3),(13,6,4),(14,16,0),(14,17,1),(15,32,0),(15,16,1);
INSERT OR IGNORE INTO fare_seeds VALUES (1,1,14,400),(2,1,16,500),(3,2,20,500),(4,4,18,350),(5,1,25,400),(6,3,28,900),(7,1,27,800),(8,1,2,200),(9,2,7,300),(10,3,30,200),(11,4,22,300),(12,22,23,250),(13,1,6,250),(14,16,17,400),(15,32,16,500);
INSERT OR IGNORE INTO fare_seeds VALUES (1,1,13,350),(2,1,13,350),(2,1,15,450),(1,1,11,250),(2,1,11,250),(5,1,3,150),(5,1,24,300),(6,3,25,400),(6,3,26,600),(7,1,25,400),(3,2,21,300),(3,2,18,400),(13,1,2,200),(5,3,25,300);
ALTER TABLE threads ADD COLUMN property_id INTEGER;
ALTER TABLE threads ADD COLUMN listing_id INTEGER;
ALTER TABLE routes ADD COLUMN geometry TEXT;
CREATE TABLE IF NOT EXISTS landlord_profiles (user_id INTEGER PRIMARY KEY, display_name TEXT NOT NULL, is_company INTEGER NOT NULL DEFAULT 0, about TEXT, verified_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS properties (id INTEGER PRIMARY KEY AUTOINCREMENT, owner_id INTEGER NOT NULL, kind TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, district TEXT NOT NULL, area TEXT, price INTEGER NOT NULL, beds INTEGER NOT NULL DEFAULT 0, baths INTEGER NOT NULL DEFAULT 0, facilities TEXT, description TEXT NOT NULL, upfront_years INTEGER, legal_fee INTEGER, caution_fee INTEGER, status TEXT NOT NULL DEFAULT 'available', views INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS property_photos (id INTEGER PRIMARY KEY AUTOINCREMENT, property_id INTEGER NOT NULL, position INTEGER NOT NULL DEFAULT 0, mime TEXT NOT NULL, size INTEGER NOT NULL, data BLOB NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS saved_properties (user_id INTEGER NOT NULL, property_id INTEGER NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (user_id, property_id));
CREATE TABLE IF NOT EXISTS listings (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL, cond TEXT NOT NULL, price INTEGER NOT NULL, negotiable INTEGER NOT NULL DEFAULT 1, district TEXT NOT NULL, description TEXT NOT NULL, delivery TEXT NOT NULL DEFAULT 'pickup', escrow_ok INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active', views INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS listing_photos (id INTEGER PRIMARY KEY AUTOINCREMENT, listing_id INTEGER NOT NULL, position INTEGER NOT NULL DEFAULT 0, mime TEXT NOT NULL, size INTEGER NOT NULL, data BLOB NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS saved_listings (user_id INTEGER NOT NULL, listing_id INTEGER NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (user_id, listing_id));
CREATE TABLE IF NOT EXISTS spots (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, category TEXT NOT NULL, district TEXT NOT NULL, area TEXT, tags TEXT, price_level INTEGER NOT NULL DEFAULT 2, price_note TEXT, description TEXT NOT NULL, hours TEXT, lat REAL, lng REAL, added_by INTEGER, verified_at TEXT, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS spot_ratings (id INTEGER PRIMARY KEY AUTOINCREMENT, spot_id INTEGER NOT NULL, user_id INTEGER NOT NULL, stars INTEGER NOT NULL, comment TEXT, created_at TEXT NOT NULL, UNIQUE(spot_id, user_id));
CREATE TABLE IF NOT EXISTS ask_log (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, question TEXT NOT NULL, district TEXT, spot_ids TEXT, mode TEXT NOT NULL, created_at TEXT NOT NULL);
INSERT OR IGNORE INTO spots (id,name,category,district,area,tags,price_level,price_note,description,hours,verified_at,created_at) VALUES (1,'Jabi Lake Mall','shopping','Jabi','Jabi Lake','["mall", "cinema", "shopping", "food court", "shoprite", "date"]',3,NULL,'Big mall on the lake with a cinema, Shoprite, restaurants and a lakeside walk. Busy at weekends.','10:00 – 22:00','2026-09-19','2026-09-19'),(2,'Jabi Lake (waterfront)','relax','Jabi','Jabi','["lake", "boat", "picnic", "sunset", "walk", "serene", "quiet", "date"]',1,'Boat rides extra','Open water, boat rides, evening breeze and street food along the shore. Good for a slow evening.','Daylight','2026-09-19','2026-09-19'),(3,'Millennium Park','relax','Maitama','Maitama','["park", "picnic", "walk", "family", "serene", "quiet", "green"]',1,'Free entry','Abuja''s biggest public park: lawns, fountains, walkways. Free, popular with families on Sundays.','07:00 – 18:00','2026-09-19','2026-09-19'),(4,'Ceddi Plaza','shopping','Central Area','Central Area','["mall", "shopping", "cinema", "food"]',3,NULL,'Central Business District mall with shops, a cinema and cafes. Quieter than Jabi Lake Mall.','10:00 – 21:00','2026-09-19','2026-09-19'),(5,'Silverbird Entertainment Centre','shopping','Central Area','Central Area','["cinema", "mall", "movies", "shopping"]',3,NULL,'Cinema and shops in the CBD. Common first-date choice for a film.','10:00 – 22:00','2026-09-19','2026-09-19'),(6,'Wuse Market','shopping','Wuse','Wuse Zone 5','["market", "shopping", "fabric", "phones", "food", "cheap", "bargain"]',1,'Bargain expected','The main open market: fabrics, phones, electronics, foodstuffs. Go with someone who can bargain.','07:00 – 19:00','2026-09-19','2026-09-19'),(7,'Arts and Crafts Village','culture','Central Area','Central Area, near Sheraton','["art", "craft", "gifts", "souvenir", "culture", "market"]',2,'Bargain expected','Stalls of carvings, beads, leather and fabric from across Nigeria. Bargain, but not too hard.','09:00 – 18:00','2026-09-19','2026-09-19'),(8,'National Mosque','worship','Central Area','Central Area','["mosque", "pray", "friday", "islam", "landmark"]',1,'Free','The National Mosque with the gold dome. Visitors welcome outside prayer times, dress modestly.','Daily','2026-09-19','2026-09-19'),(9,'National Christian Centre','worship','Central Area','Central Area','["church", "sunday", "christian", "landmark", "service"]',1,'Free','The National Ecumenical Centre opposite the mosque. Sunday services and a striking building.','Daily','2026-09-19','2026-09-19'),(10,'Magicland Amusement Park','kids','Central Area','Kalakuta, near Central Area','["kids", "children", "rides", "amusement", "family", "fun"]',2,'Rides paid per ride','Rides, bumper cars and a fairground feel. Best with children on a weekend afternoon.','12:00 – 20:00','2026-09-19','2026-09-19'),(11,'Transcorp Hilton','hotel','Maitama','Maitama','["hotel", "lounge", "pool", "fancy", "premium", "bar", "brunch"]',4,NULL,'The landmark hotel. Poolside lounge, restaurants and a bar people go to for a fancy evening.','24 hours','2026-09-19','2026-09-19'),(12,'Blu Cabana','lounge','Mabushi','Mabushi','["lounge", "pool", "bar", "cocktail", "fancy", "hangout", "date", "lounge"]',3,NULL,'Poolside lounge and restaurant, big at weekends. Book ahead for a Saturday.','12:00 – late','2026-09-19','2026-09-19'),(13,'Jevinik Restaurant','food','Wuse 2','Wuse 2','["nigerian", "food", "afang", "egusi", "pounded yam", "lunch", "dinner", "native"]',2,'₦4,000 – ₦8,000 a plate','Nigerian dishes done properly: afang, egusi, pounded yam. Busy at lunch with office workers.','11:00 – 22:00','2026-09-19','2026-09-19'),(14,'Nkoyo Restaurant','food','Central Area','Ceddi Plaza','["nigerian", "food", "buffet", "lunch", "dinner", "native", "fancy"]',3,NULL,'Upmarket Nigerian food in the CBD, known for its buffet and a calm room.','11:00 – 22:00','2026-09-19','2026-09-19'),(15,'Wakkis Restaurant','food','Wuse 2','Wuse 2','["indian", "food", "curry", "naan", "dinner", "date"]',3,NULL,'Long-running Indian restaurant, reliable for a dinner out.','12:00 – 22:30','2026-09-19','2026-09-19'),(16,'Salamander Cafe','food','Wuse 2','Wuse 2','["cafe", "coffee", "brunch", "breakfast", "pancakes", "wifi", "quiet", "date"]',2,NULL,'Cafe with breakfast all day, coffee and a bookish corner. Good for a quiet catch-up.','08:00 – 22:00','2026-09-19','2026-09-19'),(17,'Abuja Wonderland','kids','Central Area','Airport Road end, Central','["kids", "children", "amusement", "rides", "family"]',2,'Per ride','Amusement park with rides and games, mainly for families and school outings.','12:00 – 20:00','2026-09-19','2026-09-19'),(18,'Zuma Rock','culture','Zuba','Zuba, Abuja–Kaduna road','["rock", "landmark", "sight", "photo", "drive", "tour"]',1,'Free to view','The giant monolith at the edge of the city. A drive-out for photos, not a place to spend the day.','Daylight','2026-09-19','2026-09-19'),(19,'Gurara Falls (day trip)','relax','Gurara','Niger State, about 1.5 hours','["waterfall", "nature", "picnic", "day trip", "swim", "serene"]',1,'Small entry fee','Waterfalls a drive from Abuja. Best in the rainy season. Go in a group.','Daylight','2026-09-19','2026-09-19'),(20,'Berger Junction suya spot','food','Utako','Berger Junction','["suya", "night", "cheap", "street food", "late", "meat"]',1,'From ₦1,000','Evening suya by the junction. Cheap, smoky, best after dark.','18:00 – late','2026-09-19','2026-09-19');
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN plus_until TEXT;
ALTER TABLE users ADD COLUMN selfie_verified_at TEXT;
UPDATE users SET is_admin = 1 WHERE id = (SELECT MIN(id) FROM users);
ALTER TABLE match_photos ADD COLUMN storage_key TEXT;
ALTER TABLE property_photos ADD COLUMN storage_key TEXT;
ALTER TABLE listing_photos ADD COLUMN storage_key TEXT;
ALTER TABLE cv_files ADD COLUMN storage_key TEXT;
ALTER TABLE reports ADD COLUMN reviewed_by INTEGER;
ALTER TABLE reports ADD COLUMN outcome TEXT;
CREATE TABLE IF NOT EXISTS verifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, kind TEXT NOT NULL, mime TEXT NOT NULL, size INTEGER NOT NULL, data BLOB, storage_key TEXT, status TEXT NOT NULL DEFAULT 'pending', note TEXT, reviewed_by INTEGER, reviewed_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, purpose TEXT NOT NULL, amount INTEGER NOT NULL, reference TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'pending', meta TEXT, created_at TEXT NOT NULL, paid_at TEXT);
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN last_seen_at TEXT;
UPDATE users SET role = 'admin' WHERE is_admin = 1;
CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, category TEXT NOT NULL, title TEXT NOT NULL, body TEXT, url TEXT, read_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS avatars (user_id INTEGER PRIMARY KEY, mime TEXT NOT NULL, size INTEGER NOT NULL, data BLOB, storage_key TEXT, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, module TEXT NOT NULL, action TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS invites (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, role TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, invited_by INTEGER NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL);

-- Radio stations (frequencies from Wikipedia's list of Nigerian radio stations and station pages).
-- stream_url is left empty: none of these stations publish a stable public stream URL.
-- An admin can paste one per station later and the play button switches on by itself.
CREATE TABLE IF NOT EXISTS radio_stations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  frequency  TEXT NOT NULL,
  genre      TEXT NULL,
  website    TEXT NULL,
  stream_url TEXT NULL,
  active     INTEGER NOT NULL DEFAULT 1
);

INSERT OR IGNORE INTO radio_stations (id, name, frequency, genre, website, stream_url) VALUES
(1,'Cool FM','96.9','Music, pop and Afrobeats','https://www.coolfm.ng/abuja/',NULL),
(2,'Wazobia FM','99.5','Pidgin talk and music','https://www.wazobiafm.com/',NULL),
(3,'Nigeria Info','95.1','Talk radio, news and current affairs','https://www.nigeriainfo.fm/',NULL),
(4,'Rhythm FM','94.7','Music and entertainment','https://rhythm947.com/',NULL),
(5,'Hot FM','98.3','Contemporary, hip-hop and talk','https://hotfm.ng/',NULL),
(6,'Kapital FM (FRCN)','92.9','Federal Radio Corporation, news and talk','https://kapitalfm.gov.ng/',NULL),
(7,'Aso Radio','93.5','FCT Administration station, Abuja news','https://asoradio.com/',NULL),
(8,'Vision FM','92.1','News and Hausa programming','https://visionfmnigeria.com/',NULL),
(9,'Ray Power','100.5','Music, news and talk','https://raypower.fm/',NULL),
(10,'Human Rights Radio (Brekete)','101.1','Brekete Family, public complaints and advocacy','https://humanrightsradio.org/',NULL),
(11,'Love FM (FRCN)','104.5','Music and lifestyle','https://lovefm.gov.ng/',NULL),
(12,'Brila FM','88.9','Sports radio','https://brila.net/',NULL),
(13,'WE FM','106.3','Talk and music','https://wefm1063.com/',NULL),
(14,'Kiss FM','99.9','Music and entertainment','https://kissfmabuja.com/',NULL),
(15,'Soundcity Radio','96.3','Afrobeats and urban music','https://soundcity.tv/radio/',NULL),
(16,'The Beat FM','97.9','Afrobeats and pop','https://thebeat999.com/',NULL),
(17,'Armed Forces Radio','107.7','Military and community programming',NULL,NULL),
(18,'National Traffic Radio (FRSC)','107.1','Road and traffic advisories for the FCT','https://frsc.gov.ng/live-radio/',NULL),
(19,'Liberty Radio','103.3','Hausa and English talk',NULL,NULL),
(20,'Best Afro FM','87.9','Afro music',NULL,NULL),
(21,'Urban Radio','96.1','Urban music and talk',NULL,NULL),
(22,'Greetings FM','105.7','Community and greetings',NULL,NULL),
(23,'University of Abuja Radio','89.9','Campus radio',NULL,NULL),
(24,'Trust Radio','92.7','News and talk from the Daily Trust group','https://trustradio.com.ng/',NULL);

-- News: cached articles from Nigerian outlets, filtered to Abuja and the FCT.
CREATE TABLE IF NOT EXISTS news_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  summary     TEXT NULL,
  url         TEXT NOT NULL,
  source      TEXT NOT NULL,
  category    TEXT NOT NULL DEFAULT 'general',
  priority    INTEGER NOT NULL DEFAULT 0,
  published_at TEXT NOT NULL,
  url_hash    TEXT NOT NULL,
  pushed_at   TEXT NULL,
  created_at  TEXT NOT NULL, published_at)
) ;

-- Abuja Social: a forum. Posts belong to a board, carry optional district, and can be answered and liked.
CREATE TABLE IF NOT EXISTS social_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  board      TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  district   TEXT NULL,
  replies    INTEGER NOT NULL DEFAULT 0,
  likes      INTEGER NOT NULL DEFAULT 0,
  views      INTEGER NOT NULL DEFAULT 0,
  pinned     INTEGER NOT NULL DEFAULT 0,
  hidden_at  TEXT NULL,
  last_activity_at TEXT NOT NULL,
  created_at TEXT NOT NULL
) ;

CREATE TABLE IF NOT EXISTS social_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  body       TEXT NOT NULL,
  likes      INTEGER NOT NULL DEFAULT 0,
  hidden_at  TEXT NULL,
  created_at TEXT NOT NULL
) ;

CREATE TABLE IF NOT EXISTS social_likes (
  user_id    INTEGER NOT NULL,
  kind       TEXT NOT NULL,
  target_id  INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, kind, target_id)
) ;

-- Match: remember who we have already suggested, so nobody is pinged twice about the same person.
CREATE TABLE IF NOT EXISTS match_suggestions (
  user_id     INTEGER NOT NULL,
  suggested   INTEGER NOT NULL,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, suggested)
) ;

ALTER TABLE users ADD COLUMN notify_news INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN notify_social INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN notify_news INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN notify_social INTEGER NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS uploads (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, kind TEXT NOT NULL, mime TEXT, size INTEGER NOT NULL DEFAULT 0, name TEXT, meta TEXT, data BLOB, storage_key TEXT, created_at TEXT NOT NULL);
ALTER TABLE messages ADD COLUMN upload_id INTEGER;
ALTER TABLE social_posts ADD COLUMN upload_id INTEGER;
ALTER TABLE social_replies ADD COLUMN upload_id INTEGER;
ALTER TABLE companies ADD COLUMN logo_upload_id INTEGER;
ALTER TABLE landlord_profiles ADD COLUMN photo_upload_id INTEGER;
UPDATE radio_stations SET stream_url = 'https://nigeriainfofmabuja951-atunwadigital.streamguys1.com/nigeriainfofmabuja951' WHERE frequency = '95.1';
UPDATE radio_stations SET stream_url = 'https://streamlive2.hearthis.at:8000/9065169.ogg' WHERE frequency = '100.5';
UPDATE radio_stations SET stream_url = 'https://wazobiafmabuja995-atunwadigital.streamguys1.com/wazobiafmabuja995' WHERE frequency = '99.5';
UPDATE radio_stations SET stream_url = 'https://coolfmabuja969-atunwadigital.streamguys1.com/coolfmabuja969' WHERE frequency = '96.9';
UPDATE radio_stations SET stream_url = 'https://beatfmabuja-atunwadigital.streamguys1.com/beatfmabuja' WHERE frequency = '97.9';
UPDATE radio_stations SET stream_url = 'https://stream.zeno.fm/v1ukdpefou2uv' WHERE frequency = '92.1';
UPDATE radio_stations SET stream_url = 'https://cast4.asurahosting.com/proxy/radioni1/stream' WHERE frequency = '92.9';
UPDATE radio_stations SET stream_url = 'https://stream.zenolive.com/sh70ask7da5tv' WHERE frequency = '103.3';
INSERT INTO radio_stations (name, frequency, genre, stream_url, active) VALUES ('Classic FM','94.3','Music and lifestyle','https://classicfmabuja-atunwadigital.streamguys1.com/classicfmabuja',1),('Real FM','99.3','Music and talk','https://stream-14.aiir.com/c1h9e8se8kluv',1),('Bright FM','98.7','Music and community','https://stream.zeno.fm/9ai1bvgwammtv',1),('Voice of the People','96.1','Talk and community','https://stream.zeno.fm/xexa5a33bcnvv',1),('World FM','97.3','Music and talk','https://stream.zeno.fm/28d5bx9bwp8uv',1),('Oganiru Radio','93.9','Igbo language music and talk','https://stream.zeno.fm/4zc2xh1z9f8uv',1),('Liberty Radio Abuja','—','Hausa and English talk','https://stream.zeno.fm/ebt2pkyfxuquv',1),('Summit Radio','—','Online community radio','https://cast6.my-control-panel.com/proxy/summit/stream',1),('Air Radio','—','Online music radio','https://stream.zeno.fm/w2rzf12tzv8uv',1),('Antenna Web Abuja','—','Online radio','https://tinyurl.com/AntennaWebAbuja',1);
ALTER TABLE users ADD COLUMN lat REAL;
ALTER TABLE users ADD COLUMN lng REAL;
ALTER TABLE users ADD COLUMN loc_updated_at TEXT;
ALTER TABLE match_profiles ADD COLUMN radius_km INTEGER;
CREATE TABLE IF NOT EXISTS trusted_contacts (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, name TEXT NOT NULL, phone TEXT, email TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS safety_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, with_user_id INTEGER, with_name TEXT, place TEXT NOT NULL, note TEXT, token TEXT NOT NULL UNIQUE, contact_name TEXT, status TEXT NOT NULL DEFAULT 'active', expected_end TEXT NOT NULL, ended_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS safety_pings (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL, created_at TEXT NOT NULL);
ALTER TABLE users ADD COLUMN invite_code TEXT;
ALTER TABLE users ADD COLUMN referred_by INTEGER;
ALTER TABLE reports ADD COLUMN target_kind TEXT NOT NULL DEFAULT 'user';
ALTER TABLE reports ADD COLUMN target_id INTEGER;
ALTER TABLE spots ADD COLUMN source TEXT NOT NULL DEFAULT 'buja';
ALTER TABLE spots ADD COLUMN osm_id TEXT;
CREATE TABLE IF NOT EXISTS app_keys (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS calls (id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, mode TEXT NOT NULL DEFAULT 'video', thread_id INTEGER NOT NULL, created_by INTEGER NOT NULL, starts_at TEXT, joined_at TEXT, ended_at TEXT, created_at TEXT NOT NULL);

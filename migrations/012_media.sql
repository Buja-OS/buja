-- Buja migration 012: real radio streams, attachments in chat and Social, company and landlord photos.
-- One schema change per statement for TiDB. Run once in the buja database.

USE buja;

-- Streams confirmed from station players (onlineradiobox listings).
UPDATE radio_stations SET stream_url = 'https://nigeriainfofmabuja951-atunwadigital.streamguys1.com/nigeriainfofmabuja951' WHERE frequency = '95.1';
UPDATE radio_stations SET stream_url = 'https://streamlive2.hearthis.at:8000/9065169.ogg' WHERE frequency = '100.5';
UPDATE radio_stations SET stream_url = 'https://wazobiafmabuja995-atunwadigital.streamguys1.com/wazobiafmabuja995' WHERE frequency = '99.5';
UPDATE radio_stations SET stream_url = 'https://coolfmabuja969-atunwadigital.streamguys1.com/coolfmabuja969' WHERE frequency = '96.9';
UPDATE radio_stations SET stream_url = 'https://beatfmabuja-atunwadigital.streamguys1.com/beatfmabuja' WHERE frequency = '97.9';
UPDATE radio_stations SET stream_url = 'https://stream.zeno.fm/v1ukdpefou2uv' WHERE frequency = '92.1';
UPDATE radio_stations SET stream_url = 'https://cast4.asurahosting.com/proxy/radioni1/stream' WHERE frequency = '92.9';
UPDATE radio_stations SET stream_url = 'https://stream.zenolive.com/sh70ask7da5tv' WHERE frequency = '103.3';

INSERT INTO radio_stations (name, frequency, genre, stream_url, active) VALUES
('Classic FM','94.3','Music and lifestyle','https://classicfmabuja-atunwadigital.streamguys1.com/classicfmabuja',1),
('Real FM','99.3','Music and talk','https://stream-14.aiir.com/c1h9e8se8kluv',1),
('Bright FM','98.7','Music and community','https://stream.zeno.fm/9ai1bvgwammtv',1),
('Voice of the People','96.1','Talk and community','https://stream.zeno.fm/xexa5a33bcnvv',1),
('World FM','97.3','Music and talk','https://stream.zeno.fm/28d5bx9bwp8uv',1),
('Oganiru Radio','93.9','Igbo language music and talk','https://stream.zeno.fm/4zc2xh1z9f8uv',1),
('Liberty Radio Abuja','—','Hausa and English talk','https://stream.zeno.fm/ebt2pkyfxuquv',1),
('Summit Radio','—','Online community radio','https://cast6.my-control-panel.com/proxy/summit/stream',1),
('Air Radio','—','Online music radio','https://stream.zeno.fm/w2rzf12tzv8uv',1),
('Antenna Web Abuja','—','Online radio','https://tinyurl.com/AntennaWebAbuja',1);

-- One table for everything people attach: photos, video, voice notes, documents, a pinned location.
CREATE TABLE IF NOT EXISTS uploads (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  kind        ENUM('image','video','audio','file','location') NOT NULL,
  mime        VARCHAR(60) NULL,
  size        INT UNSIGNED NOT NULL DEFAULT 0,
  name        VARCHAR(120) NULL,
  meta        JSON NULL,
  data        MEDIUMBLOB NULL,
  storage_key VARCHAR(200) NULL,
  created_at  DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_uploads_user (user_id, id),
  CONSTRAINT fk_uploads_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE messages MODIFY COLUMN type ENUM('text','interview','inspection','offer','media') NOT NULL DEFAULT 'text';
ALTER TABLE messages MODIFY COLUMN body VARCHAR(2000) NULL;
ALTER TABLE messages ADD COLUMN upload_id BIGINT UNSIGNED NULL;
ALTER TABLE social_posts ADD COLUMN upload_id BIGINT UNSIGNED NULL;
ALTER TABLE social_replies ADD COLUMN upload_id BIGINT UNSIGNED NULL;
ALTER TABLE companies ADD COLUMN logo_upload_id BIGINT UNSIGNED NULL;
ALTER TABLE landlord_profiles ADD COLUMN photo_upload_id BIGINT UNSIGNED NULL;

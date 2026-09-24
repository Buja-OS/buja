-- Buja migration 038: the Buja Kart shop. What each player owns and has equipped (designs, helmets, environments,
-- engine sounds), and a daily streak for the first-race-of-the-day bonus.
USE buja;
ALTER TABLE kart_profiles ADD COLUMN owned VARCHAR(600) NOT NULL DEFAULT '';
ALTER TABLE kart_profiles ADD COLUMN equipped VARCHAR(300) NULL;
ALTER TABLE kart_profiles ADD COLUMN daily_on DATE NULL;
ALTER TABLE kart_profiles ADD COLUMN streak SMALLINT UNSIGNED NOT NULL DEFAULT 0;

-- Buja migration 016: a tiny key/value note-pad the server uses to remember things like
-- "we already looked for pharmacies near here an hour ago and the map had none".
USE buja;
CREATE TABLE IF NOT EXISTS app_keys (
  k VARCHAR(120) NOT NULL,
  v VARCHAR(190) NOT NULL,
  PRIMARY KEY (k)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

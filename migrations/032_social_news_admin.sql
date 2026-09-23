-- Buja migration 032: several photos on a Social post, news with a picture and a readable body in the app.
USE buja;

CREATE TABLE IF NOT EXISTS social_images (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  post_id    BIGINT UNSIGNED NULL,
  reply_id   BIGINT UNSIGNED NULL,
  upload_id  BIGINT UNSIGNED NOT NULL,
  position   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (id),
  KEY ix_si_post (post_id, position),
  KEY ix_si_reply (reply_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Photos already posted keep working: move them into the new table.
INSERT INTO social_images (post_id, upload_id, position, created_at)
  SELECT id, upload_id, 0, created_at FROM social_posts WHERE upload_id IS NOT NULL;
INSERT INTO social_images (reply_id, upload_id, position, created_at)
  SELECT id, upload_id, 0, created_at FROM social_replies WHERE upload_id IS NOT NULL;

ALTER TABLE news_items ADD COLUMN image_url VARCHAR(500) NULL;
ALTER TABLE news_items ADD COLUMN body MEDIUMTEXT NULL;
ALTER TABLE news_items ADD COLUMN body_at DATETIME NULL;
ALTER TABLE news_items ADD COLUMN reads INT UNSIGNED NOT NULL DEFAULT 0;
ALTER TABLE news_items ADD COLUMN hidden_at DATETIME NULL;

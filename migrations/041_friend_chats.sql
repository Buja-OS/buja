-- Buja migration 041: chats between friends (added with Buja Tag). Adds 'friend' to the end of the chat kinds;
-- every existing kind stays exactly as it was. Run it in TiDB before uploading the code (the code copes if you forget:
-- friend chats then open as plain person-to-person chats until this runs).
USE buja;

ALTER TABLE threads MODIFY COLUMN kind ENUM('work','match','homes','declutter','artisan','event','city','friend') NOT NULL DEFAULT 'work';

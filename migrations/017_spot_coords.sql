-- Buja migration 017: coordinates for the seeded Ask places, so they get distances and map thumbnails.
USE buja;

UPDATE spots SET lat = 9.0705, lng = 7.418 WHERE id = 1 AND lat IS NULL;
UPDATE spots SET lat = 9.0723, lng = 7.415 WHERE id = 2 AND lat IS NULL;
UPDATE spots SET lat = 9.0663, lng = 7.4925 WHERE id = 3 AND lat IS NULL;
UPDATE spots SET lat = 9.0616, lng = 7.4879 WHERE id = 4 AND lat IS NULL;
UPDATE spots SET lat = 9.0586, lng = 7.4885 WHERE id = 5 AND lat IS NULL;
UPDATE spots SET lat = 9.0648, lng = 7.4788 WHERE id = 6 AND lat IS NULL;
UPDATE spots SET lat = 9.0546, lng = 7.488 WHERE id = 7 AND lat IS NULL;
UPDATE spots SET lat = 9.0466, lng = 7.4869 WHERE id = 8 AND lat IS NULL;
UPDATE spots SET lat = 9.043, lng = 7.4905 WHERE id = 9 AND lat IS NULL;
UPDATE spots SET lat = 9.0483, lng = 7.457 WHERE id = 10 AND lat IS NULL;
UPDATE spots SET lat = 9.0839, lng = 7.4932 WHERE id = 11 AND lat IS NULL;
UPDATE spots SET lat = 9.085, lng = 7.455 WHERE id = 12 AND lat IS NULL;
UPDATE spots SET lat = 9.0787, lng = 7.4759 WHERE id = 13 AND lat IS NULL;
UPDATE spots SET lat = 9.0572, lng = 7.4912 WHERE id = 14 AND lat IS NULL;
UPDATE spots SET lat = 9.08, lng = 7.488 WHERE id = 15 AND lat IS NULL;
UPDATE spots SET lat = 9.0812, lng = 7.4855 WHERE id = 16 AND lat IS NULL;
UPDATE spots SET lat = 9.049, lng = 7.46 WHERE id = 17 AND lat IS NULL;
UPDATE spots SET lat = 9.1289, lng = 7.235 WHERE id = 18 AND lat IS NULL;
UPDATE spots SET lat = 9.206, lng = 6.912 WHERE id = 19 AND lat IS NULL;
UPDATE spots SET lat = 9.076, lng = 7.456 WHERE id = 20 AND lat IS NULL;
UPDATE spots SET lat = 9.0655, lng = 7.4739 WHERE id = 21 AND lat IS NULL;
UPDATE spots SET lat = 9.0795, lng = 7.484 WHERE id = 22 AND lat IS NULL;

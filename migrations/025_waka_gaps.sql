-- Buja migration 025: two places no route served. Maitama gets its own along from Wuse, and the Mpape bus
-- now actually stops there as its notes always claimed. Gwarinpa 3rd Avenue joins the Berger along.
USE buja;

INSERT INTO routes (id, name, mode, origin_place, dest_place, color, notes, active) VALUES
(27, 'Wuse to Maitama', 'along', 2, 7, '#E8620E', 'Short hop from Wuse Market past Banex to the Hilton side. Plentiful until late.', 1);

INSERT INTO route_stops (route_id, place_id, position) VALUES
(27, 2, 0), (27, 8, 1), (27, 7, 2);

-- Mpape to Wuse: slot Maitama in after Mpape, before the descent. Shift the later positions up by one.
-- Two steps, because (route_id, position) is unique and a single +1 would collide with itself.
UPDATE route_stops SET position = position + 100 WHERE route_id = 10 AND position >= 1;
UPDATE route_stops SET position = position - 99 WHERE route_id = 10 AND position >= 100;
INSERT INTO route_stops (route_id, place_id, position) VALUES (10, 7, 1);

-- Berger to Gwarinpa continues one stop to 3rd Avenue.
INSERT INTO route_stops (route_id, place_id, position) VALUES (16, 14, 6);

INSERT INTO fare_seeds (route_id, from_place, to_place, amount) VALUES
(27, 2, 7, 200),
(27, 2, 8, 150),
(10, 51, 7, 150),
(16, 1, 14, 450);

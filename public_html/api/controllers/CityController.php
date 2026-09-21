<?php
declare(strict_types=1);

/**
 * City signals: what the crowd knows right now. Light, fuel, blood, lost and found, plates, prices.
 * Every one of these is people reporting, and the code is about weighting, decaying and clustering
 * what they say so one confused tap cannot mislead everyone.
 */
final class CityController
{
    /* ------------------------------------------------ LIGHT WATCH ------------------------------------------------ */

    /** A report's weight: full at 5 minutes, a quarter at an hour, nothing after three. Charging counts half. */
    private static function weight(string $at, string $source): float
    {
        $age = max(0, time() - strtotime($at . ' UTC'));
        if ($age > 3 * 3600) return 0.0;
        $w = $age < 300 ? 1.0 : max(0.0, 1.0 - ($age - 300) / (3 * 3600 - 300));
        return $source === 'charging' ? $w * 0.5 : $w;
    }

    /** GET /light : every district's status, yours first; plus a week of history for yours */
    public function light(): void
    {
        $u = Auth::require();
        $st = Db::pdo()->prepare('SELECT district, state, source, created_at, lat, lng FROM light_reports WHERE created_at > ? ORDER BY created_at DESC');
        $st->execute([gmdate('Y-m-d H:i:s', time() - 3 * 3600)]);
        $by = [];
        foreach ($st->fetchAll() as $r) {
            $w = self::weight($r['created_at'], $r['source']); if ($w <= 0) continue;
            $d = &$by[$r['district']]; $d = $d ?? ['on' => 0.0, 'off' => 0.0, 'n' => 0, 'last' => $r['created_at'], 'onPts' => [], 'offPts' => []];
            $d[$r['state'] ? 'on' : 'off'] += $w; $d['n']++;
            if ($r['lat'] !== null) $d[$r['state'] ? 'onPts' : 'offPts'][] = [(float) $r['lat'], (float) $r['lng']];
        }
        unset($d);
        $out = [];
        foreach (DistrictList::all() as $name) {
            $d = $by[$name] ?? null;
            if (!$d || $d['n'] === 0) { $out[] = ['district' => $name, 'state' => null, 'label' => 'No recent reports', 'confidence' => 0, 'n' => 0, 'mixed' => false]; continue; }
            $tot = $d['on'] + $d['off']; $share = $d['on'] / max(0.001, $tot);
            $mixed = $d['n'] >= 4 && $share > 0.38 && $share < 0.62;
            $state = $share >= 0.5;
            $conf = (int) round(abs($share - 0.5) * 2 * min(1, $d['n'] / 5) * 100);
            $out[] = ['district' => $name, 'state' => $state, 'label' => $mixed ? 'Mixed: some streets on, some off' : ($state ? 'Light is on' : 'Light is off'), 'confidence' => $conf, 'n' => $d['n'], 'mixed' => $mixed, 'last' => $d['last']];
        }
        usort($out, fn($a, $b) => ($b['district'] === ($u['district'] ?? '')) <=> ($a['district'] === ($u['district'] ?? '')) ?: ($b['n'] <=> $a['n']));
        // Seven-day history for the person's own district: share of hourly buckets that said "on"
        $hist = [];
        if (!empty($u['district'])) {
            $hs = Db::pdo()->prepare('SELECT state, created_at FROM light_reports WHERE district = ? AND created_at > ? ORDER BY created_at');
            $hs->execute([$u['district'], gmdate('Y-m-d H:i:s', time() - 7 * 86400)]);
            $days = [];
            foreach ($hs->fetchAll() as $r) { $day = date('D', strtotime($r['created_at'] . ' UTC')); $hour = (int) date('G', strtotime($r['created_at'] . ' UTC')); $days[$day][$hour][] = (int) $r['state']; }
            foreach ($days as $day => $hours) { $on = 0; foreach ($hours as $vals) $on += array_sum($vals) / count($vals) >= 0.5 ? 1 : 0; $hist[] = ['day' => $day, 'hoursOn' => $on, 'hoursSeen' => count($hours)]; }
        }
        $mine = Db::one('SELECT state, created_at FROM light_reports WHERE user_id = ? AND created_at > ? ORDER BY id DESC LIMIT 1', [$u['id'], gmdate('Y-m-d H:i:s', time() - 6 * 3600)]);
        Http::json(['districts' => $out, 'history' => $hist, 'mine' => $mine ? ['state' => (bool) $mine['state'], 'at' => $mine['created_at']] : null, 'district' => $u['district']]);
    }

    /** POST /light/report { state, lat, lng, source } */
    public function lightReport(): void
    {
        $u = Auth::require(); RateLimit::hit('light', 60, 3600);
        $b = Http::body();
        $source = ($b['source'] ?? 'tap') === 'charging' ? 'charging' : 'tap';
        $district = (string) ($u['district'] ?? '');
        if (!empty($b['lat']) && !empty($b['lng'])) { $near = Osm::districtFor((float) $b['lat'], (float) $b['lng']); if ($near !== '') $district = $near; }
        if ($district === '') Http::json(['error' => 'validation', 'message' => 'Set your district first, under Me.'], 422);
        // Charging signals only count from around home, so a phone charging in the office does not vote for Lugbe.
        if ($source === 'charging') { $home = Db::one('SELECT lat, lng FROM users WHERE id = ?', [$u['id']]); if (!$home || $home['lat'] === null || empty($b['lat']) || WakaRules::km((float) $home['lat'], (float) $home['lng'], (float) $b['lat'], (float) $b['lng']) > 0.4) Http::json(['ignored' => true]); }
        $last = Db::one('SELECT created_at FROM light_reports WHERE user_id = ? AND source = ? ORDER BY id DESC LIMIT 1', [$u['id'], $source]);
        if ($last && strtotime($last['created_at'] . ' UTC') > time() - ($source === 'charging' ? 600 : 60)) Http::json(['ignored' => true]);
        $state = empty($b['state']) ? 0 : 1;
        // Did this flip the district? Then tell the people who live there.
        $before = $this->districtState($district);
        Db::run('INSERT INTO light_reports (user_id, district, lat, lng, state, source, created_at) VALUES (?,?,?,?,?,?,?)', [$u['id'], $district, !empty($b['lat']) ? round((float) $b['lat'], 4) : null, !empty($b['lng']) ? round((float) $b['lng'], 4) : null, $state, $source, Db::now()]);
        $after = $this->districtState($district);
        if ($before !== null && $after !== null && $before !== $after) {
            $st = Db::pdo()->prepare('SELECT id FROM users WHERE district = ? AND deleted_at IS NULL AND notify_waka = 1 AND id <> ? LIMIT 300'); $st->execute([$district, $u['id']]);
            foreach ($st->fetchAll() as $r) Notify::user((int) $r['id'], 'waka', ($after ? 'Light is back in ' : 'Light has gone in ') . $district, 'Neighbours are reporting it. Tap to see and confirm.', '/#/light');
        }
        Track::hit($u, 'city', 'light:' . ($state ? 'on' : 'off'));
        Http::json(['ok' => true, 'district' => $district]);
    }
    private function districtState(string $district): ?bool
    {
        $st = Db::pdo()->prepare('SELECT state, source, created_at FROM light_reports WHERE district = ? AND created_at > ?'); $st->execute([$district, gmdate('Y-m-d H:i:s', time() - 3 * 3600)]);
        $on = 0.0; $off = 0.0; $n = 0;
        foreach ($st->fetchAll() as $r) { $w = self::weight($r['created_at'], $r['source']); if ($w <= 0) continue; $n++; if ($r['state']) $on += $w; else $off += $w; }
        if ($n < 3) return null;
        return $on >= $off;
    }

    /* ------------------------------------------------ FUEL BOARD ------------------------------------------------ */

    /** GET /fuel?lat&lng : stations nearest first with the last report on each */
    public function fuel(): void
    {
        $u = Auth::require(); $q = $_GET;
        $at = (!empty($q['lat']) && !empty($q['lng'])) ? [(float) $q['lat'], (float) $q['lng']] : null;
        $rows = Db::pdo()->query('SELECT * FROM fuel_stations LIMIT 400')->fetchAll();
        $out = [];
        foreach ($rows as $s) {
            $r = Db::one('SELECT r.*, u.name FROM fuel_reports r JOIN users u ON u.id = r.user_id WHERE r.station_id = ? ORDER BY r.id DESC LIMIT 1', [$s['id']]);
            $o = ['id' => (int) $s['id'], 'name' => $s['name'], 'brand' => $s['brand'], 'district' => $s['district'], 'lat' => (float) $s['lat'], 'lng' => (float) $s['lng'],
                'report' => $r ? ['petrol' => $r['petrol'] !== null ? (int) $r['petrol'] : null, 'diesel' => $r['diesel'] !== null ? (int) $r['diesel'] : null, 'queue' => $r['queue'], 'at' => $r['created_at'], 'by' => explode(' ', trim((string) $r['name']))[0], 'stale' => strtotime($r['created_at'] . ' UTC') < time() - 6 * 3600] : null];
            if ($at) $o['km'] = round(WakaRules::km($at[0], $at[1], $o['lat'], $o['lng']), 1);
            $out[] = $o;
        }
        if ($at) usort($out, fn($a, $b) => $a['km'] <=> $b['km']); else usort($out, fn($a, $b) => (($b['report']['at'] ?? '') <=> ($a['report']['at'] ?? '')));
        Http::json(['stations' => array_slice($out, 0, 60), 'count' => count($rows)]);
    }
    /** POST /fuel/stations { name, brand, lat, lng } */
    public function fuelStation(): void
    {
        $u = Auth::require(); RateLimit::hit('fuelstation', 10, 86400); $b = Http::body();
        $name = mb_substr(trim((string) ($b['name'] ?? '')), 0, 90); if (mb_strlen($name) < 3 || empty($b['lat']) || empty($b['lng'])) Http::json(['error' => 'validation', 'message' => 'A name and your position at the station.'], 422);
        Db::run('INSERT INTO fuel_stations (name, brand, district, lat, lng, added_by, created_at) VALUES (?,?,?,?,?,?,?)', [$name, mb_substr(trim((string) ($b['brand'] ?? '')), 0, 40) ?: null, Osm::districtFor((float) $b['lat'], (float) $b['lng']) ?: ($u['district'] ?? 'Abuja'), round((float) $b['lat'], 5), round((float) $b['lng'], 5), $u['id'], Db::now()]);
        Http::json(['id' => (int) Db::lastId()], 201);
    }
    /** POST /fuel/{id}/report { petrol, diesel, queue } */
    public function fuelReport(int $id): void
    {
        $u = Auth::require(); RateLimit::hit('fuelreport', 40, 86400); $b = Http::body();
        if (!Db::one('SELECT id FROM fuel_stations WHERE id = ?', [$id])) Http::json(['error' => 'not_found'], 404);
        $queue = in_array($b['queue'] ?? '', ['none', 'short', 'long', 'closed'], true) ? $b['queue'] : null; if (!$queue) Http::json(['error' => 'validation', 'message' => 'How long is the queue?'], 422);
        $p = !empty($b['petrol']) ? (int) $b['petrol'] : null; $d = !empty($b['diesel']) ? (int) $b['diesel'] : null;
        if (($p !== null && ($p < 200 || $p > 5000)) || ($d !== null && ($d < 200 || $d > 8000))) Http::json(['error' => 'validation', 'message' => 'That price does not look right. Naira per litre.'], 422);
        Db::run('INSERT INTO fuel_reports (station_id, user_id, petrol, diesel, queue, created_at) VALUES (?,?,?,?,?,?)', [$id, $u['id'], $p, $d, $queue, Db::now()]);
        Track::hit($u, 'city', 'fuel');
        Http::json(['ok' => true]);
    }
    /** POST /fuel/import : admin pulls every fuel station in the FCT from OpenStreetMap */
    public function fuelImport(): void
    {
        $u = Auth::require(); if (empty($u['is_admin']) && !in_array($u['role'] ?? '', ['admin', 'moderator'], true)) Http::json(['error' => 'forbidden'], 403);
        set_time_limit(60);
        $r = Osm::importFuelStations();
        Http::json(['result' => $r, 'total' => (int) (Db::one('SELECT COUNT(*) AS n FROM fuel_stations')['n'] ?? 0)]);
    }

    /* ------------------------------------------------ BLOOD ------------------------------------------------ */

    public const GROUPS = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];
    /** Who can give to whom. Key: the patient's group. Value: donor groups that work. */
    public const CAN_RECEIVE = ['O-' => ['O-'], 'O+' => ['O-', 'O+'], 'A-' => ['O-', 'A-'], 'A+' => ['O-', 'O+', 'A-', 'A+'], 'B-' => ['O-', 'B-'], 'B+' => ['O-', 'O+', 'B-', 'B+'], 'AB-' => ['O-', 'A-', 'B-', 'AB-'], 'AB+' => ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']];

    /** GET /blood : open requests near me, my donor card */
    public function blood(): void
    {
        $u = Auth::require();
        $me = Db::one('SELECT * FROM donors WHERE user_id = ?', [$u['id']]);
        $pos = Db::one('SELECT lat, lng FROM users WHERE id = ?', [$u['id']]);
        $st = Db::pdo()->prepare("SELECT r.*, u.name FROM blood_requests r JOIN users u ON u.id = r.user_id WHERE r.status = 'open' AND r.created_at > ? ORDER BY r.created_at DESC LIMIT 40"); $st->execute([gmdate('Y-m-d H:i:s', time() - 7 * 86400)]);
        $reqs = [];
        foreach ($st->fetchAll() as $r) {
            $o = ['id' => (int) $r['id'], 'group' => $r['blood_group'], 'units' => (int) $r['units'], 'hospital' => $r['hospital'], 'district' => $r['district'], 'urgency' => $r['urgency'], 'note' => $r['note'], 'by' => explode(' ', trim((string) $r['name']))[0], 'mine' => (int) $r['user_id'] === (int) $u['id'], 'responders' => (int) $r['responders'], 'at' => $r['created_at'],
                'phone' => (int) $r['user_id'] === (int) $u['id'] || Db::one('SELECT 1 AS x FROM blood_responses WHERE request_id = ? AND user_id = ?', [$r['id'], $u['id']]) ? $r['phone'] : null,
                'canGive' => $me && $me['willing'] && in_array($me['blood_group'], self::CAN_RECEIVE[$r['blood_group']] ?? [], true),
                'responded' => (bool) Db::one('SELECT 1 AS x FROM blood_responses WHERE request_id = ? AND user_id = ?', [$r['id'], $u['id']])];
            if ($pos && $pos['lat'] !== null && $r['lat'] !== null) $o['km'] = round(WakaRules::km((float) $pos['lat'], (float) $pos['lng'], (float) $r['lat'], (float) $r['lng']));
            $reqs[] = $o;
        }
        Http::json(['requests' => $reqs, 'donor' => $me ? ['group' => $me['blood_group'], 'willing' => (bool) $me['willing'], 'radiusKm' => (int) $me['radius_km'], 'lastDonated' => $me['last_donated'], 'sharePhone' => (bool) $me['share_phone']] : null, 'groups' => self::GROUPS, 'donors' => (int) (Db::one('SELECT COUNT(*) AS n FROM donors WHERE willing = 1')['n'] ?? 0)]);
    }
    /** POST /blood/me { group, willing, radiusKm, lastDonated, sharePhone } */
    public function donorSave(): void
    {
        $u = Auth::require(); $b = Http::body();
        $g = strtoupper(trim((string) ($b['group'] ?? ''))); if (!in_array($g, self::GROUPS, true)) Http::json(['error' => 'validation', 'message' => 'Pick your blood group.'], 422);
        $vals = [$g, empty($b['willing']) ? 0 : 1, max(2, min(50, (int) ($b['radiusKm'] ?? 10))), !empty($b['lastDonated']) ? substr((string) $b['lastDonated'], 0, 10) : null, empty($b['sharePhone']) ? 0 : 1];
        if (Db::one('SELECT user_id FROM donors WHERE user_id = ?', [$u['id']])) Db::run('UPDATE donors SET blood_group=?, willing=?, radius_km=?, last_donated=?, share_phone=? WHERE user_id = ?', array_merge($vals, [$u['id']]));
        else Db::run('INSERT INTO donors (blood_group, willing, radius_km, last_donated, share_phone, user_id, created_at) VALUES (?,?,?,?,?,?,?)', array_merge($vals, [$u['id'], Db::now()]));
        Track::hit($u, 'city', 'donor');
        $this->blood();
    }
    /** POST /blood/request { group, units, hospital, district, lat, lng, phone, note, urgency } */
    public function bloodRequest(): void
    {
        $u = Auth::require(); RateLimit::hit('blood', 5, 86400); $b = Http::body(); $e = [];
        $g = strtoupper(trim((string) ($b['group'] ?? ''))); if (!in_array($g, self::GROUPS, true)) $e['group'] = 'Which blood group is needed?';
        $hospital = mb_substr(trim((string) ($b['hospital'] ?? '')), 0, 120); if (mb_strlen($hospital) < 3) $e['hospital'] = 'Which hospital?';
        $phone = Validator::ngPhone((string) ($b['phone'] ?? ($u['phone'] ?? ''))); if (!$phone) $e['phone'] = 'A number donors can call.';
        $district = mb_substr(trim((string) ($b['district'] ?? ($u['district'] ?? ''))), 0, 60); if ($district === '') $e['district'] = 'Which district is the hospital in?';
        if ($e) Http::json(['error' => 'validation', 'fields' => $e], 422);
        $urg = in_array($b['urgency'] ?? '', ['today', '48h', 'week'], true) ? $b['urgency'] : 'today';
        Db::run('INSERT INTO blood_requests (user_id, blood_group, units, hospital, district, lat, lng, phone, note, urgency, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            [$u['id'], $g, max(1, min(10, (int) ($b['units'] ?? 1))), $hospital, $district, !empty($b['lat']) ? (float) $b['lat'] : null, !empty($b['lng']) ? (float) $b['lng'] : null, $phone, mb_substr(trim((string) ($b['note'] ?? '')), 0, 500) ?: null, $urg, Db::now()]);
        $id = (int) Db::lastId();
        // Tell compatible donors nearby, closest first, up to 60.
        $ok = self::CAN_RECEIVE[$g];
        $st = Db::pdo()->prepare('SELECT d.user_id, d.radius_km, u.lat, u.lng, u.district FROM donors d JOIN users u ON u.id = d.user_id WHERE d.willing = 1 AND d.blood_group IN (' . implode(',', array_fill(0, count($ok), '?')) . ') AND u.deleted_at IS NULL AND d.user_id <> ?');
        $st->execute(array_merge($ok, [$u['id']]));
        $cands = [];
        foreach ($st->fetchAll() as $d) {
            $km = ($d['lat'] !== null && !empty($b['lat'])) ? WakaRules::km((float) $d['lat'], (float) $d['lng'], (float) $b['lat'], (float) $b['lng']) : (($d['district'] ?? '') === $district ? 2 : 25);
            if ($km <= max(10, (int) $d['radius_km'])) $cands[] = [$km, (int) $d['user_id']];
        }
        usort($cands, fn($a, $b2) => $a[0] <=> $b2[0]);
        $told = 0;
        foreach (array_slice($cands, 0, 60) as [$km, $uid]) { Notify::user($uid, 'waka', $g . ' blood needed at ' . $hospital, ($urg === 'today' ? 'Needed today. ' : '') . 'About ' . round($km) . ' km from you. You are a match.', '/#/blood', true); $told++; }
        Track::hit($u, 'city', 'blood_request');
        Http::json(['id' => $id, 'told' => $told], 201);
    }
    /** POST /blood/requests/{id}/respond : "I can come". The requester gets your first name and, if you allow it, your phone. */
    public function bloodRespond(int $id): void
    {
        $u = Auth::require();
        $r = Db::one("SELECT * FROM blood_requests WHERE id = ? AND status = 'open'", [$id]); if (!$r) Http::json(['error' => 'not_found', 'message' => 'That request is closed.'], 404);
        if (!Db::one('SELECT 1 AS x FROM blood_responses WHERE request_id = ? AND user_id = ?', [$id, $u['id']])) {
            Db::run('INSERT INTO blood_responses (request_id, user_id, created_at) VALUES (?,?,?)', [$id, $u['id'], Db::now()]);
            Db::run('UPDATE blood_requests SET responders = responders + 1 WHERE id = ?', [$id]);
            $d = Db::one('SELECT share_phone, blood_group FROM donors WHERE user_id = ?', [$u['id']]);
            $first = explode(' ', trim((string) $u['name']))[0];
            Notify::user((int) $r['user_id'], 'waka', $first . ' can donate ' . ($d['blood_group'] ?? '') . ' blood', ($d && $d['share_phone'] && $u['phone'] ? 'Call ' . $u['phone'] . '. ' : 'They will call you. ') . 'For ' . $r['hospital'] . '.', '/#/blood', true);
        }
        Http::json(['ok' => true, 'phone' => $r['phone']]);
    }
    /** POST /blood/requests/{id}/close { fulfilled } */
    public function bloodClose(int $id): void
    {
        $u = Auth::require();
        Db::run('UPDATE blood_requests SET status = ? WHERE id = ? AND user_id = ?', [empty(Http::body()['fulfilled']) ? 'closed' : 'fulfilled', $id, $u['id']]);
        $this->blood();
    }

    /* ------------------------------------------------ LOST AND FOUND ------------------------------------------------ */

    public const ITEMS = ['nin' => 'NIN slip', 'passport' => 'Passport', 'licence' => 'Driver\'s licence', 'voter' => 'Voter\'s card', 'atm' => 'ATM card', 'keys' => 'Keys', 'phone' => 'Phone', 'wallet' => 'Wallet or purse', 'bag' => 'Bag', 'documents' => 'Other documents', 'pet' => 'Pet', 'other' => 'Something else'];

    /** GET /lostfound?kind=&item=&q= */
    public function lostFound(): void
    {
        $u = Auth::require(); $q = $_GET;
        $where = ["l.status = 'open'", 'l.created_at > ?']; $p = [gmdate('Y-m-d H:i:s', time() - 60 * 86400)];
        if (in_array($q['kind'] ?? '', ['lost', 'found'], true)) { $where[] = 'l.kind = ?'; $p[] = $q['kind']; }
        if (!empty($q['item']) && isset(self::ITEMS[$q['item']])) { $where[] = 'l.item = ?'; $p[] = $q['item']; }
        if (!empty($q['q'])) { $where[] = '(l.name_on_it LIKE ? OR l.description LIKE ? OR l.place LIKE ?)'; $like = '%' . $q['q'] . '%'; array_push($p, $like, $like, $like); }
        $st = Db::pdo()->prepare('SELECT l.*, u.name FROM lost_found l JOIN users u ON u.id = l.user_id WHERE ' . implode(' AND ', $where) . ' ORDER BY l.id DESC LIMIT 80'); $st->execute($p);
        Http::json(['items' => array_map(fn($l) => ['id' => (int) $l['id'], 'kind' => $l['kind'], 'item' => $l['item'], 'itemLabel' => self::ITEMS[$l['item']] ?? $l['item'], 'nameOnIt' => $l['name_on_it'], 'district' => $l['district'], 'place' => $l['place'], 'description' => $l['description'], 'photo' => $l['upload_id'] ? '/api/uploads/' . (int) $l['upload_id'] : null, 'by' => explode(' ', trim((string) $l['name']))[0], 'mine' => (int) $l['user_id'] === (int) $u['id'], 'userId' => (int) $l['user_id'], 'at' => $l['created_at']], $st->fetchAll()), 'types' => self::ITEMS]);
    }
    /** POST /lostfound { kind, item, nameOnIt, district, place, description, uploadId } */
    public function lostFoundCreate(): void
    {
        $u = Auth::require(); RateLimit::hit('lostfound', 10, 86400); $b = Http::body(); $e = [];
        $kind = in_array($b['kind'] ?? '', ['lost', 'found'], true) ? $b['kind'] : null; if (!$kind) $e['kind'] = 'Lost it, or found it?';
        $item = (string) ($b['item'] ?? ''); if (!isset(self::ITEMS[$item])) $e['item'] = 'What is it?';
        $desc = mb_substr(trim((string) ($b['description'] ?? '')), 0, 800); if (mb_strlen($desc) < 10) $e['description'] = 'Describe it: colour, where, when.';
        $district = mb_substr(trim((string) ($b['district'] ?? ($u['district'] ?? ''))), 0, 60); if ($district === '') $e['district'] = 'Which district?';
        if ($e) Http::json(['error' => 'validation', 'fields' => $e], 422);
        $upload = !empty($b['uploadId']) ? UploadsController::claim((int) $b['uploadId'], $u) : null;
        Db::run('INSERT INTO lost_found (user_id, kind, item, name_on_it, district, place, description, upload_id, created_at) VALUES (?,?,?,?,?,?,?,?,?)', [$u['id'], $kind, $item, mb_substr(trim((string) ($b['nameOnIt'] ?? '')), 0, 90) ?: null, $district, mb_substr(trim((string) ($b['place'] ?? '')), 0, 120) ?: null, $desc, $upload, Db::now()]);
        $id = (int) Db::lastId();
        // A found item with a name on it: tell anyone who posted losing the same kind with that name.
        $name = mb_strtolower(trim((string) ($b['nameOnIt'] ?? '')));
        if ($name !== '') {
            $other = $kind === 'found' ? 'lost' : 'found';
            $st = Db::pdo()->prepare("SELECT user_id, name_on_it FROM lost_found WHERE status = 'open' AND kind = ? AND item = ? AND user_id <> ?"); $st->execute([$other, $item, $u['id']]);
            foreach ($st->fetchAll() as $m) { if ($m['name_on_it'] && (str_contains(mb_strtolower($m['name_on_it']), $name) || str_contains($name, mb_strtolower($m['name_on_it'])))) Notify::user((int) $m['user_id'], 'offers', 'Somebody ' . $kind . ' a ' . self::ITEMS[$item] . ' with your name', 'It may be yours. Tap to see.', '/#/lostfound/' . $id, true); }
        }
        Track::hit($u, 'city', 'lostfound:' . $kind);
        Http::json(['id' => $id], 201);
    }
    /** POST /lostfound/{id}/close and POST /lostfound/{id}/contact */
    public function lostFoundClose(int $id): void { $u = Auth::require(); Db::run("UPDATE lost_found SET status = 'closed' WHERE id = ? AND user_id = ?", [$id, $u['id']]); Http::json(['ok' => true]); }
    public function lostFoundContact(int $id): void
    {
        $u = Auth::require();
        $l = Db::one("SELECT user_id FROM lost_found WHERE id = ? AND status = 'open'", [$id]); if (!$l) Http::json(['error' => 'not_found'], 404);
        if ((int) $l['user_id'] === (int) $u['id']) Http::json(['error' => 'self'], 422);
        Http::json(['threadId' => self::cityThread((int) $u['id'], (int) $l['user_id'])]);
    }
    public static function cityThread(int $a, int $b): int
    {
        $lo = min($a, $b); $hi = max($a, $b);
        $t = Db::one("SELECT id FROM threads WHERE kind = 'city' AND user_a = ? AND user_b = ?", [$lo, $hi]);
        if ($t) return (int) $t['id'];
        Db::run("INSERT INTO threads (kind, user_a, user_b, last_message_at, created_at) VALUES ('city', ?, ?, ?, ?)", [$lo, $hi, Db::now(), Db::now()]);
        return (int) Db::lastId();
    }

    /* ------------------------------------------------ ONE-CHANCE PLATES ------------------------------------------------ */

    private static function normPlate(string $p): string { return strtoupper(preg_replace('/[^A-Z0-9]/i', '', $p)); }

    /** GET /plates/check?plate= : how many reports, how recent, what happened. Never who reported. */
    public function plateCheck(): void
    {
        $u = Auth::require(); RateLimit::hit('platecheck', 120, 3600);
        $plate = self::normPlate((string) ($_GET['plate'] ?? '')); if (strlen($plate) < 5) Http::json(['error' => 'validation', 'message' => 'Type the plate number.'], 422);
        $st = Db::pdo()->prepare('SELECT what, vehicle, district, happened, hurt FROM plate_reports WHERE plate = ? AND hidden_at IS NULL ORDER BY happened DESC LIMIT 10'); $st->execute([$plate]);
        $rows = $st->fetchAll();
        Track::hit($u, 'city', 'plate_check');
        Http::json(['plate' => $plate, 'reports' => count($rows), 'latest' => $rows[0]['happened'] ?? null, 'anyHurt' => (bool) array_sum(array_column($rows, 'hurt')), 'items' => array_map(fn($r) => ['what' => $r['what'], 'vehicle' => $r['vehicle'], 'district' => $r['district'], 'when' => $r['happened'], 'hurt' => (bool) $r['hurt']], $rows), 'verdict' => count($rows) === 0 ? 'No reports on Buja. That is not proof of anything; stay alert.' : (count($rows) === 1 ? 'One report. Be careful.' : count($rows) . ' reports. Do not enter this vehicle.')]);
    }
    /** POST /plates/report { plate, vehicle, what, district, happened, hurt, toldPolice } */
    public function plateReport(): void
    {
        $u = Auth::require(); RateLimit::hit('platereport', 5, 86400); $b = Http::body(); $e = [];
        $plate = self::normPlate((string) ($b['plate'] ?? '')); if (strlen($plate) < 5 || strlen($plate) > 12) $e['plate'] = 'The plate number, as written on the car.';
        $what = mb_substr(trim((string) ($b['what'] ?? '')), 0, 600); if (mb_strlen($what) < 20) $e['what'] = 'What happened, in a few lines. Only what you saw yourself.';
        $when = !empty($b['happened']) ? substr((string) $b['happened'], 0, 10) : date('Y-m-d'); if (strtotime($when) > time() + 86400 || strtotime($when) < time() - 400 * 86400) $e['happened'] = 'When did it happen?';
        if ($e) Http::json(['error' => 'validation', 'fields' => $e], 422);
        if (Db::one('SELECT id FROM plate_reports WHERE plate = ? AND user_id = ?', [$plate, $u['id']])) Http::json(['error' => 'done', 'message' => 'You already reported this plate.'], 409);
        Db::run('INSERT INTO plate_reports (user_id, plate, vehicle, what, district, happened, hurt, told_police, created_at) VALUES (?,?,?,?,?,?,?,?,?)', [$u['id'], $plate, mb_substr(trim((string) ($b['vehicle'] ?? '')), 0, 80) ?: null, $what, mb_substr(trim((string) ($b['district'] ?? ($u['district'] ?? ''))), 0, 60) ?: null, $when, empty($b['hurt']) ? 0 : 1, empty($b['toldPolice']) ? 0 : 1, Db::now()]);
        Track::hit($u, 'city', 'plate_report');
        Http::json(['ok' => true, 'plate' => $plate], 201);
    }

    /* ------------------------------------------------ MARKET PRICES ------------------------------------------------ */

    public const STAPLES = ['rice50' => 'Rice, 50kg bag', 'beans' => 'Beans, 1 paint bucket', 'garri' => 'Garri, 1 paint bucket', 'yam' => 'Yam, 1 medium tuber', 'tomato' => 'Tomatoes, 1 basket', 'pepper' => 'Pepper, 1 paint bucket', 'onion' => 'Onions, 1 bag', 'palmoil' => 'Palm oil, 5 litres', 'gnut' => 'Groundnut oil, 5 litres', 'gas' => 'Cooking gas, 12.5kg refill', 'eggs' => 'Eggs, 1 crate', 'chicken' => 'Chicken, 1 whole', 'bread' => 'Bread, family loaf', 'water' => 'Sachet water, 1 bag', 'cement' => 'Cement, 1 bag', 'sugar' => 'Sugar, 1kg'];
    public const MARKETS = ['Wuse Market', 'Garki Market', 'Utako Market', 'Kubwa Market', 'Nyanya Market', 'Gwagwalada Market', 'Dei-Dei Market', 'Lugbe Market', 'Kado Fish Market', 'Gudu Market', 'Dutse Market', 'Mararaba Market', 'Bwari Market', 'Jabi Motor Park market', 'Kuje Market', 'Supermarket'];

    /** GET /prices : each staple, cheapest market first, from the last 14 days */
    public function prices(): void
    {
        Auth::require();
        $st = Db::pdo()->prepare('SELECT item, market, price, created_at FROM price_reports WHERE created_at > ? ORDER BY created_at DESC'); $st->execute([gmdate('Y-m-d H:i:s', time() - 14 * 86400)]);
        $by = [];
        foreach ($st->fetchAll() as $r) { $by[$r['item']][$r['market']][] = ['p' => (int) $r['price'], 'at' => $r['created_at']]; }
        $out = [];
        foreach (self::STAPLES as $k => $label) {
            $markets = [];
            foreach ($by[$k] ?? [] as $m => $rows) { $ps = array_column(array_slice($rows, 0, 5), 'p'); sort($ps); $med = $ps[(int) floor(count($ps) / 2)]; $markets[] = ['market' => $m, 'price' => $med, 'n' => count($rows), 'at' => $rows[0]['at']]; }
            usort($markets, fn($a, $b) => $a['price'] <=> $b['price']);
            $out[] = ['key' => $k, 'label' => $label, 'markets' => $markets, 'cheapest' => $markets[0] ?? null, 'spread' => count($markets) > 1 ? end($markets)['price'] - $markets[0]['price'] : 0];
        }
        Http::json(['staples' => $out, 'markets' => self::MARKETS, 'reports' => (int) (Db::one('SELECT COUNT(*) AS n FROM price_reports WHERE created_at > ?', [gmdate('Y-m-d H:i:s', time() - 14 * 86400)])['n'] ?? 0)]);
    }
    /** POST /prices/report { item, market, price } */
    public function priceReport(): void
    {
        $u = Auth::require(); RateLimit::hit('price', 60, 86400); $b = Http::body();
        $item = (string) ($b['item'] ?? ''); if (!isset(self::STAPLES[$item])) Http::json(['error' => 'validation', 'message' => 'Pick the item.'], 422);
        $market = trim((string) ($b['market'] ?? '')); if (!in_array($market, self::MARKETS, true)) Http::json(['error' => 'validation', 'message' => 'Pick the market.'], 422);
        $price = (int) ($b['price'] ?? 0); if ($price < 50 || $price > 2000000) Http::json(['error' => 'validation', 'message' => 'That price does not look right.'], 422);
        Db::run('INSERT INTO price_reports (user_id, item, market, price, created_at) VALUES (?,?,?,?,?)', [$u['id'], $item, $market, $price, Db::now()]);
        Track::hit($u, 'city', 'price');
        $this->prices();
    }
}

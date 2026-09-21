<?php
declare(strict_types=1);

/** Queues at government offices, commute sharing, the rent index, and Learn analytics for the admin. */
final class CityController2
{
    public const SERVICES = ['nin' => 'NIN enrolment', 'passport' => 'Passport', 'licence' => 'Driver\'s licence', 'vehicle' => 'Vehicle papers and plates', 'council' => 'Area council', 'court' => 'Court registry', 'tax' => 'Tax office', 'other' => 'Other office'];
    public const CROWD = ['empty' => 'Walked straight in', 'busy' => 'Busy', 'packed' => 'Packed', 'closed' => 'Closed or not attending'];

    /** GET /queues?lat&lng&service */
    public function queues(): void
    {
        $u = Auth::require(); $q = $_GET;
        $at = (!empty($q['lat']) && !empty($q['lng'])) ? [(float) $q['lat'], (float) $q['lng']] : null;
        $where = '1=1'; $p = [];
        if (!empty($q['service']) && isset(self::SERVICES[$q['service']])) { $where = 'service = ?'; $p[] = $q['service']; }
        $st = Db::pdo()->prepare("SELECT * FROM queue_offices WHERE $where LIMIT 200"); $st->execute($p);
        $out = [];
        foreach ($st->fetchAll() as $o) {
            $rs = Db::pdo()->prepare('SELECT r.*, u.name FROM queue_reports r JOIN users u ON u.id = r.user_id WHERE r.office_id = ? AND r.created_at > ? ORDER BY r.id DESC LIMIT 5'); $rs->execute([$o['id'], gmdate('Y-m-d H:i:s', time() - 12 * 3600)]);
            $reports = $rs->fetchAll();
            $waits = array_column($reports, 'wait_min'); sort($waits);
            $x = ['id' => (int) $o['id'], 'name' => $o['name'], 'service' => $o['service'], 'serviceLabel' => self::SERVICES[$o['service']] ?? $o['service'], 'district' => $o['district'], 'lat' => $o['lat'] !== null ? (float) $o['lat'] : null, 'lng' => $o['lng'] !== null ? (float) $o['lng'] : null,
                'today' => $reports ? ['wait' => $waits[(int) floor(count($waits) / 2)], 'crowd' => $reports[0]['crowd'], 'crowdLabel' => self::CROWD[$reports[0]['crowd']] ?? $reports[0]['crowd'], 'n' => count($reports), 'at' => $reports[0]['created_at'], 'by' => explode(' ', trim((string) $reports[0]['name']))[0], 'note' => $reports[0]['note']] : null];
            if ($at && $x['lat'] !== null) $x['km'] = round(WakaRules::km($at[0], $at[1], $x['lat'], $x['lng']), 1);
            $out[] = $x;
        }
        if ($at) usort($out, fn($a, $b) => ($a['km'] ?? 999) <=> ($b['km'] ?? 999));
        Http::json(['offices' => $out, 'services' => self::SERVICES, 'crowd' => self::CROWD]);
    }
    /** POST /queues/{id}/report { waitMin, crowd, note } */
    public function queueReport(int $id): void
    {
        $u = Auth::require(); RateLimit::hit('queue', 20, 86400); $b = Http::body();
        if (!Db::one('SELECT id FROM queue_offices WHERE id = ?', [$id])) Http::json(['error' => 'not_found'], 404);
        $crowd = in_array($b['crowd'] ?? '', array_keys(self::CROWD), true) ? $b['crowd'] : null; if (!$crowd) Http::json(['error' => 'validation', 'message' => 'How crowded is it?'], 422);
        $wait = max(0, min(720, (int) ($b['waitMin'] ?? 0)));
        Db::run('INSERT INTO queue_reports (office_id, user_id, wait_min, crowd, note, created_at) VALUES (?,?,?,?,?,?)', [$id, $u['id'], $wait, $crowd, mb_substr(trim((string) ($b['note'] ?? '')), 0, 200) ?: null, Db::now()]);
        Track::hit($u, 'city', 'queue'); Http::json(['ok' => true]);
    }
    /** POST /queues/offices { name, service, lat, lng } */
    public function queueOffice(): void
    {
        $u = Auth::require(); RateLimit::hit('queueoffice', 5, 86400); $b = Http::body();
        $name = mb_substr(trim((string) ($b['name'] ?? '')), 0, 90); $service = isset(self::SERVICES[$b['service'] ?? '']) ? $b['service'] : 'other';
        if (mb_strlen($name) < 4) Http::json(['error' => 'validation', 'message' => 'Name the office.'], 422);
        Db::run('INSERT INTO queue_offices (name, service, district, lat, lng, added_by, created_at) VALUES (?,?,?,?,?,?,?)', [$name, $service, !empty($b['lat']) ? (Osm::districtFor((float) $b['lat'], (float) $b['lng']) ?: ($u['district'] ?? 'Abuja')) : ($u['district'] ?? 'Abuja'), !empty($b['lat']) ? (float) $b['lat'] : null, !empty($b['lng']) ? (float) $b['lng'] : null, $u['id'], Db::now()]);
        Http::json(['id' => (int) Db::lastId()], 201);
    }

    /* ------------------------------------------------ COMMUTE SHARE ------------------------------------------------ */
    private function ride(array $r, array $u): array
    {
        $from = Db::one('SELECT name, district FROM places WHERE id = ?', [$r['from_place']]); $to = Db::one('SELECT name, district FROM places WHERE id = ?', [$r['to_place']]);
        $d = Db::one('SELECT name, selfie_verified_at FROM users WHERE id = ?', [$r['driver_id']]);
        $mine = Db::one('SELECT status FROM ride_requests WHERE ride_id = ? AND user_id = ?', [$r['id'], $u['id']]);
        $taken = (int) (Db::one("SELECT COUNT(*) AS n FROM ride_requests WHERE ride_id = ? AND status = 'accepted'", [$r['id']])['n'] ?? 0);
        return ['id' => (int) $r['id'], 'from' => $from['name'] ?? '?', 'fromDistrict' => $from['district'] ?? '', 'to' => $to['name'] ?? '?', 'toDistrict' => $to['district'] ?? '', 'leavesAt' => substr((string) $r['leaves_at'], 0, 5), 'days' => $r['days'], 'seats' => (int) $r['seats'], 'left' => max(0, (int) $r['seats'] - $taken), 'share' => (int) $r['share'], 'note' => $r['note'], 'active' => (bool) $r['active'],
            'driver' => ['id' => (int) $r['driver_id'], 'name' => explode(' ', trim((string) ($d['name'] ?? 'Driver')))[0], 'verified' => !empty($d['selfie_verified_at']), 'rating' => RatingController::summary((int) $r['driver_id']), 'avatar' => Auth::picture((int) $r['driver_id'])],
            'mine' => (int) $r['driver_id'] === (int) $u['id'], 'my' => $mine ? $mine['status'] : null,
            'requests' => (int) $r['driver_id'] === (int) $u['id'] ? array_map(fn($x) => ['id' => (int) $x['user_id'], 'name' => explode(' ', trim((string) $x['name']))[0], 'status' => $x['status'], 'rating' => RatingController::summary((int) $x['user_id'])], Db::pdo()->query('SELECT q.user_id, q.status, u.name FROM ride_requests q JOIN users u ON u.id = q.user_id WHERE q.ride_id = ' . (int) $r['id'] . ' ORDER BY q.created_at')->fetchAll()) : null];
    }
    /** GET /rides?from&to */
    public function rides(): void
    {
        $u = Auth::require(); $q = $_GET; $where = ['r.active = 1']; $p = [];
        if (!empty($q['from'])) { $where[] = 'r.from_place = ?'; $p[] = (int) $q['from']; }
        if (!empty($q['to'])) { $where[] = 'r.to_place = ?'; $p[] = (int) $q['to']; }
        if (!empty($q['mine'])) { $where = ['(r.driver_id = ? OR r.id IN (SELECT ride_id FROM ride_requests WHERE user_id = ?))']; $p = [$u['id'], $u['id']]; }
        $st = Db::pdo()->prepare('SELECT r.* FROM rides r WHERE ' . implode(' AND ', $where) . ' ORDER BY r.leaves_at LIMIT 60'); $st->execute($p);
        Http::json(['rides' => array_map(fn($r) => $this->ride($r, $u), $st->fetchAll())]);
    }
    /** POST /rides { from, to, leavesAt, days, seats, share, note } */
    public function rideCreate(): void
    {
        $u = Auth::require(); RateLimit::hit('ride', 10, 86400); $b = Http::body(); $e = [];
        if (empty($u['selfie_verified_at'])) Http::json(['error' => 'verify', 'message' => 'Verify with a selfie under Me before offering seats. Riders need to know you are real.'], 403);
        $from = (int) ($b['from'] ?? 0); $to = (int) ($b['to'] ?? 0); if (!$from || !$to || $from === $to) $e['from'] = 'Pick where you leave from and where you go.';
        $time = (string) ($b['leavesAt'] ?? ''); if (!preg_match('/^\d{2}:\d{2}$/', $time)) $e['leavesAt'] = 'When do you leave? Like 07:15.';
        $days = trim((string) ($b['days'] ?? 'Mon-Fri')); if ($days === '') $days = 'Mon-Fri';
        if ($e) Http::json(['error' => 'validation', 'fields' => $e], 422);
        Db::run('INSERT INTO rides (driver_id, from_place, to_place, leaves_at, days, seats, share, note, created_at) VALUES (?,?,?,?,?,?,?,?,?)', [$u['id'], $from, $to, $time . ':00', mb_substr($days, 0, 20), max(1, min(6, (int) ($b['seats'] ?? 2))), max(0, (int) ($b['share'] ?? 0)), mb_substr(trim((string) ($b['note'] ?? '')), 0, 300) ?: null, Db::now()]);
        $id = (int) Db::lastId(); // before Track::hit, which inserts its own row
        Track::hit($u, 'city', 'ride_offer');
        Http::json(['id' => $id], 201);
    }
    /** POST /rides/{id}/ask : a rider asks for a seat; POST /rides/{id}/decide { userId, accept } : the driver answers */
    public function rideAsk(int $id): void
    {
        $u = Auth::require();
        $r = Db::one('SELECT * FROM rides WHERE id = ? AND active = 1', [$id]); if (!$r) Http::json(['error' => 'not_found'], 404);
        if ((int) $r['driver_id'] === (int) $u['id']) Http::json(['error' => 'self'], 422);
        if (!Db::one('SELECT 1 AS x FROM ride_requests WHERE ride_id = ? AND user_id = ?', [$id, $u['id']])) {
            Db::run('INSERT INTO ride_requests (ride_id, user_id, status, created_at) VALUES (?,?,?,?)', [$id, $u['id'], 'asked', Db::now()]);
            Notify::user((int) $r['driver_id'], 'waka', explode(' ', trim((string) $u['name']))[0] . ' wants a seat on your ' . substr((string) $r['leaves_at'], 0, 5) . ' ride', 'Tap to accept or decline.', '/#/rides/' . $id, true);
        }
        Http::json(['threadId' => CityController::cityThread((int) $u['id'], (int) $r['driver_id'])]);
    }
    public function rideDecide(int $id): void
    {
        $u = Auth::require(); $b = Http::body();
        $r = Db::one('SELECT * FROM rides WHERE id = ? AND driver_id = ?', [$id, $u['id']]); if (!$r) Http::json(['error' => 'forbidden'], 403);
        $status = empty($b['accept']) ? 'declined' : 'accepted';
        Db::run('UPDATE ride_requests SET status = ? WHERE ride_id = ? AND user_id = ?', [$status, $id, (int) ($b['userId'] ?? 0)]);
        Notify::user((int) ($b['userId'] ?? 0), 'waka', $status === 'accepted' ? 'Seat confirmed for the ' . substr((string) $r['leaves_at'], 0, 5) . ' ride' : 'No seat this time', $status === 'accepted' ? 'Message the driver to agree the exact pickup point.' : 'The driver could not take you. Other rides are listed.', '/#/rides/' . $id, true);
        Http::json(['rides' => [$this->ride(Db::one('SELECT * FROM rides WHERE id = ?', [$id]), $u)]]);
    }
    public function rideStop(int $id): void { $u = Auth::require(); Db::run('UPDATE rides SET active = 0 WHERE id = ? AND driver_id = ?', [$id, $u['id']]); Http::json(['ok' => true]); }

    /* ------------------------------------------------ RENT INDEX ------------------------------------------------ */
    /** GET /rent-index : median asking rent per year by district and bedrooms, from live listings */
    public function rentIndex(): void
    {
        Auth::require();
        $st = Db::pdo()->query("SELECT district, beds, price FROM properties WHERE status = 'available' AND kind = 'rent' AND price > 0 ORDER BY district, beds, price");
        $by = []; foreach ($st->fetchAll() as $r) $by[$r['district']][(int) $r['beds']][] = (int) $r['price'];
        $out = [];
        foreach ($by as $d => $beds) { $row = ['district' => $d, 'beds' => []]; ksort($beds); foreach ($beds as $b => $prices) { $row['beds'][] = ['beds' => $b, 'median' => $prices[(int) floor(count($prices) / 2)], 'low' => $prices[0], 'high' => end($prices), 'n' => count($prices)]; } $out[] = $row; }
        usort($out, fn($a, $b) => strcmp($a['district'], $b['district']));
        Http::json(['index' => $out, 'listings' => array_sum(array_map(fn($r) => array_sum(array_column($r['beds'], 'n')), $out))]);
    }

    /* ------------------------------------------------ LEARN ANALYTICS ------------------------------------------------ */
    /** GET /admin/learn */
    public function learnStats(): void
    {
        $u = Auth::require(); if (empty($u['is_admin']) && !in_array($u['role'] ?? '', ['admin', 'moderator'], true)) Http::json(['error' => 'forbidden'], 403);
        $out = [];
        foreach (Curriculum::all() as $slug => $c) {
            $n = count($c['lessons']);
            $starters = (int) (Db::one('SELECT COUNT(DISTINCT user_id) AS n FROM learn_progress WHERE course = ?', [$slug])['n'] ?? 0);
            $certs = (int) (Db::one('SELECT COUNT(*) AS n FROM certificates WHERE course = ? AND revoked_at IS NULL', [$slug])['n'] ?? 0);
            $st = Db::pdo()->prepare('SELECT lesson, COUNT(*) AS n, AVG(score) AS avg, AVG(attempts) AS tries FROM learn_progress WHERE course = ? GROUP BY lesson ORDER BY lesson'); $st->execute([$slug]);
            $byLesson = []; foreach ($st->fetchAll() as $r) $byLesson[(int) $r['lesson']] = ['done' => (int) $r['n'], 'avg' => (int) round((float) $r['avg']), 'tries' => round((float) $r['tries'], 1)];
            $lessons = []; $prev = $starters;
            foreach ($c['lessons'] as $i => $l) { $d = $byLesson[$i]['done'] ?? 0; $lessons[] = ['index' => $i, 'title' => $l['title'], 'kind' => $l['kind'], 'done' => $d, 'dropFromPrev' => $prev > 0 ? (int) round((1 - $d / $prev) * 100) : 0, 'avg' => $byLesson[$i]['avg'] ?? null, 'tries' => $byLesson[$i]['tries'] ?? null]; if ($d > 0) $prev = $d; }
            $out[] = ['slug' => $slug, 'title' => $c['title'], 'level' => $c['level'], 'starters' => $starters, 'certificates' => $certs, 'completion' => $starters ? (int) round($certs / $starters * 100) : 0, 'lessons' => $lessons];
        }
        usort($out, fn($a, $b) => $b['starters'] <=> $a['starters']);
        Http::json(['courses' => $out, 'learners' => (int) (Db::one('SELECT COUNT(DISTINCT user_id) AS n FROM learn_progress')['n'] ?? 0), 'certificates' => (int) (Db::one('SELECT COUNT(*) AS n FROM certificates WHERE revoked_at IS NULL')['n'] ?? 0), 'last7' => (int) (Db::one('SELECT COUNT(DISTINCT user_id) AS n FROM learn_progress WHERE completed_at > ?', [gmdate('Y-m-d H:i:s', time() - 7 * 86400)])['n'] ?? 0)]);
    }
}

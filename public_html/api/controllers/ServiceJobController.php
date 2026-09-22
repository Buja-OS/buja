<?php
declare(strict_types=1);

/**
 * "Mechanic near me": a customer asks a nearby artisan to come, the artisan accepts and shares live location
 * while travelling, the customer watches them approach with an ETA, and rates them when the job is done.
 *
 * Privacy: until the artisan accepts, they see only the customer's area (about 500 m), never the exact spot.
 * Location is shared only while a job is on the way; the trail is deleted a day after the job ends.
 * Live updates are plain HTTP polling, which works on a free host without websockets.
 */
final class ServiceJobController
{
    public const OPEN = ['requested', 'accepted', 'enroute', 'arrived'];
    public const ARRIVE_M = 80;          // within this many metres counts as arrived
    public const STOP_M = 25;            // moving less than this ...
    public const STOP_SEC = 180;         // ... for this long while on the way counts as stopped
    public const LOST_SEC = 75;          // no ping for this long: signal lost
    public const REQUEST_TTL_MIN = 20;   // unanswered requests expire

    private function job(int $id, array $u): array
    {
        $j = Db::one('SELECT * FROM service_jobs WHERE id = ?', [$id]);
        if (!$j || ((int) $j['customer_id'] !== (int) $u['id'] && (int) $j['artisan_id'] !== (int) $u['id'])) Http::json(['error' => 'not_found', 'message' => 'That job is not yours.'], 404);
        if ($j['status'] === 'requested' && strtotime($j['created_at'] . ' UTC') < time() - self::REQUEST_TTL_MIN * 60) {
            Db::run("UPDATE service_jobs SET status = 'expired' WHERE id = ? AND status = 'requested'", [$id]); $j['status'] = 'expired';
        }
        return $j;
    }
    private static function metres(float $a, float $b, float $c, float $d): float { return WakaRules::km($a, $b, $c, $d) * 1000; }

    private function shape(array $j, array $u): array
    {
        $isCustomer = (int) $j['customer_id'] === (int) $u['id'];
        $other = (int) ($isCustomer ? $j['artisan_id'] : $j['customer_id']);
        $o = Db::one('SELECT name, phone FROM users WHERE id = ?', [$other]);
        $art = Db::one('SELECT business, trade, phone FROM artisans WHERE user_id = ?', [$j['artisan_id']]);
        $accepted = !in_array($j['status'], ['requested', 'declined', 'expired'], true) || (!$isCustomer && false);
        $showExact = $isCustomer || in_array($j['status'], ['accepted', 'enroute', 'arrived', 'done'], true);
        $now = time();
        $live = null;
        if ($j['a_lat'] !== null && in_array($j['status'], ['enroute', 'arrived'], true)) {
            $age = $now - strtotime($j['a_at'] . ' UTC');
            $stoppedFor = $j['moved_at'] ? $now - strtotime($j['moved_at'] . ' UTC') : 0;
            $live = ['lat' => (float) $j['a_lat'], 'lng' => (float) $j['a_lng'], 'heading' => $j['a_heading'] !== null ? (int) $j['a_heading'] : null, 'speedKmh' => $j['a_speed'] !== null ? round((float) $j['a_speed'] * 3.6) : null,
                'age' => $age, 'lost' => $age > self::LOST_SEC, 'stopped' => $j['status'] === 'enroute' && $stoppedFor >= self::STOP_SEC && $age <= self::LOST_SEC, 'stoppedMin' => (int) floor($stoppedFor / 60),
                'etaMin' => $j['eta_min'] !== null ? (int) $j['eta_min'] : null, 'etaAt' => $j['eta_at'], 'routeKm' => $j['route_km'] !== null ? (float) $j['route_km'] : null,
                'metres' => (int) round(self::metres((float) $j['a_lat'], (float) $j['a_lng'], (float) $j['lat'], (float) $j['lng']))];
        }
        return [
            'id' => (int) $j['id'], 'status' => $j['status'], 'role' => $isCustomer ? 'customer' : 'artisan', 'trade' => $j['trade'], 'tradeLabel' => ArtisanController::TRADES[$j['trade']] ?? $j['trade'],
            'problem' => $j['problem'], 'landmark' => $showExact ? $j['landmark'] : null,
            'place' => $showExact ? ['lat' => (float) $j['lat'], 'lng' => (float) $j['lng'], 'exact' => true] : ['lat' => round((float) $j['lat'] / 0.005) * 0.005, 'lng' => round((float) $j['lng'] / 0.005) * 0.005, 'exact' => false],
            'other' => ['id' => $other, 'name' => $isCustomer ? ($art['business'] ?: explode(' ', trim((string) ($o['name'] ?? '')))[0]) : explode(' ', trim((string) ($o['name'] ?? '')))[0],
                'phone' => in_array($j['status'], ['accepted', 'enroute', 'arrived'], true) ? ($isCustomer ? ($art['phone'] ?: $o['phone']) : $o['phone']) : null,
                'avatar' => Auth::picture($other), 'rating' => RatingController::summary($other)],
            'live' => $live, 'route' => ($live && $j['route_json']) ? json_decode($j['route_json'], true) : null,
            'threadId' => $j['thread_id'] ? (int) $j['thread_id'] : null, 'rated' => (bool) $j['rated'],
            'times' => ['created' => $j['created_at'], 'accepted' => $j['accepted_at'], 'started' => $j['started_at'], 'arrived' => $j['arrived_at'], 'done' => $j['done_at']],
            'km' => (function () use ($j) { $from = $j['a_lat'] !== null ? ['lat' => $j['a_lat'], 'lng' => $j['a_lng']] : Db::one('SELECT lat, lng FROM artisans WHERE user_id = ?', [$j['artisan_id']]); return ($from && $from['lat'] !== null) ? round(WakaRules::km((float) $j['lat'], (float) $j['lng'], (float) $from['lat'], (float) $from['lng']), 1) : null; })(),
        ];
    }

    /** GET /service-jobs : mine, open first, as customer and as artisan */
    public function index(): void
    {
        $u = Auth::require();
        $st = Db::pdo()->prepare('SELECT * FROM service_jobs WHERE customer_id = ? OR artisan_id = ? ORDER BY id DESC LIMIT 40'); $st->execute([$u['id'], $u['id']]);
        $rows = array_map(fn($j) => $this->shape($this->job((int) $j['id'], $u), $u), $st->fetchAll());
        usort($rows, fn($a, $b) => (in_array($b['status'], self::OPEN, true) <=> in_array($a['status'], self::OPEN, true)) ?: ($b['id'] <=> $a['id']));
        Http::json(['jobs' => $rows]);
    }

    /** POST /service-jobs { artisanId, problem, lat, lng, landmark } */
    public function create(): void
    {
        $u = Auth::require(); RateLimit::hit('servicejob', 8, 3600); $b = Http::body();
        $aid = (int) ($b['artisanId'] ?? 0);
        if ($aid === (int) $u['id']) Http::json(['error' => 'validation', 'message' => 'You cannot book yourself.'], 422);
        $a = Db::one('SELECT * FROM artisans WHERE user_id = ? AND hidden_at IS NULL', [$aid]); if (!$a) Http::json(['error' => 'not_found', 'message' => 'That artisan is not listed.'], 404);
        if (!(int) $a['available']) Http::json(['error' => 'validation', 'message' => 'They are not taking jobs right now. Try another.'], 422);
        $lat = (float) ($b['lat'] ?? 0); $lng = (float) ($b['lng'] ?? 0);
        if ($lat < 8 || $lat > 10 || $lng < 6.5 || $lng > 8) Http::json(['error' => 'validation', 'message' => 'Turn on location so they can find you. Buja works inside the FCT.'], 422);
        $problem = mb_substr(trim((string) ($b['problem'] ?? '')), 0, 400); if (mb_strlen($problem) < 5) Http::json(['error' => 'validation', 'fields' => ['problem' => 'Say what is wrong in a few words.']], 422);
        if (Db::one("SELECT id FROM service_jobs WHERE customer_id = ? AND artisan_id = ? AND status IN ('requested','accepted','enroute','arrived')", [$u['id'], $aid])) Http::json(['error' => 'validation', 'message' => 'You already have an open job with them.'], 409);
        Db::run('INSERT INTO service_jobs (customer_id, artisan_id, trade, problem, lat, lng, landmark, created_at) VALUES (?,?,?,?,?,?,?,?)', [$u['id'], $aid, $a['trade'], $problem, round($lat, 6), round($lng, 6), mb_substr(trim((string) ($b['landmark'] ?? '')), 0, 160) ?: null, Db::now()]);
        $id = (int) Db::lastId();
        $km = WakaRules::km((float) ($a['lat'] ?? $lat), (float) ($a['lng'] ?? $lng), $lat, $lng);
        Notify::user($aid, 'work', explode(' ', trim((string) $u['name']))[0] . ' needs a ' . strtolower(ArtisanController::TRADES[$a['trade']] ?? 'hand') . ' about ' . ($km < 1 ? 'under 1' : round($km)) . ' km away', mb_substr($problem, 0, 90) . ' Tap to accept or decline.', '/#/jobs/' . $id, true);
        Track::hit($u, 'artisan', 'job_request');
        Http::json(['id' => $id], 201);
    }

    /** GET /service-jobs/{id} : polled every few seconds by both sides */
    public function show(int $id): void { $u = Auth::require(); Http::json(['job' => $this->shape($this->job($id, $u), $u)]); }

    /** POST /service-jobs/{id}/{action} : accept, decline, start, arrived, done, cancel */
    public function act(int $id, string $action): void
    {
        $u = Auth::require(); $j = $this->job($id, $u);
        $isArtisan = (int) $j['artisan_id'] === (int) $u['id']; $isCustomer = !$isArtisan;
        $biz = $isArtisan ? (Db::one('SELECT business FROM artisans WHERE user_id = ?', [$u['id']])['business'] ?? '') : '';
        $name = $biz ?: explode(' ', trim((string) $u['name']))[0];
        $to = (int) ($isArtisan ? $j['customer_id'] : $j['artisan_id']);
        $url = '/#/jobs/' . $id;
        $bad = fn() => Http::json(['error' => 'validation', 'message' => 'That is not possible at this stage (' . $j['status'] . ').'], 422);
        switch ($action) {
            case 'accept':
                if (!$isArtisan || $j['status'] !== 'requested') $bad();
                $a = min((int) $j['customer_id'], (int) $j['artisan_id']); $b = max((int) $j['customer_id'], (int) $j['artisan_id']);
                $t = Db::one("SELECT id FROM threads WHERE kind = 'artisan' AND user_a = ? AND user_b = ?", [$a, $b]);
                if (!$t) { Db::run("INSERT INTO threads (kind, user_a, user_b, last_message_at, created_at) VALUES ('artisan', ?, ?, ?, ?)", [$a, $b, Db::now(), Db::now()]); $tid = (int) Db::lastId(); } else $tid = (int) $t['id'];
                Db::run("UPDATE service_jobs SET status = 'accepted', accepted_at = ?, thread_id = ? WHERE id = ?", [Db::now(), $tid, $id]);
                Notify::user($to, 'work', $name . ' accepted your job', 'They will set off soon. You can follow them on the map.', $url, true);
                break;
            case 'decline':
                if (!$isArtisan || $j['status'] !== 'requested') $bad();
                Db::run("UPDATE service_jobs SET status = 'declined' WHERE id = ?", [$id]);
                Notify::user($to, 'work', $name . ' cannot come this time', 'Try another one near you.', '/#/artisans/map?trade=' . $j['trade'], true);
                break;
            case 'start':
                if (!$isArtisan || !in_array($j['status'], ['accepted', 'enroute'], true)) $bad();
                $b = Http::body();
                Db::run("UPDATE service_jobs SET status = 'enroute', started_at = COALESCE(started_at, ?) WHERE id = ?", [Db::now(), $id]);
                if (!empty($b['lat'])) $this->recordPing($id, (float) $b['lat'], (float) $b['lng'], null, null, true);
                if ($j['status'] === 'accepted') Notify::user($to, 'work', $name . ' is on the way', 'Tap to watch them come and see when they will arrive.', $url, true);
                break;
            case 'arrived':
                if (!$isArtisan || $j['status'] !== 'enroute') $bad();
                Db::run("UPDATE service_jobs SET status = 'arrived', arrived_at = ? WHERE id = ?", [Db::now(), $id]);
                Notify::user($to, 'work', $name . ' has arrived', 'They are at your location.', $url, true);
                break;
            case 'done':
                if (!in_array($j['status'], ['arrived', 'enroute', 'accepted'], true)) $bad();
                Db::run("UPDATE service_jobs SET status = 'done', done_at = ? WHERE id = ?", [Db::now(), $id]);
                Db::run('UPDATE artisans SET jobs_done = jobs_done + 1 WHERE user_id = ?', [$j['artisan_id']]);
                Db::run('DELETE FROM service_trail WHERE job_id = ?', [$id]);
                if ($isArtisan) Notify::user($to, 'work', 'Job marked done', 'How did ' . $name . ' do? Rate them so others know.', $url, true);
                break;
            case 'cancel':
                if (!in_array($j['status'], ['requested', 'accepted', 'enroute'], true)) $bad();
                Db::run("UPDATE service_jobs SET status = 'cancelled' WHERE id = ?", [$id]);
                Db::run('DELETE FROM service_trail WHERE job_id = ?', [$id]);
                Notify::user($to, 'work', 'Job cancelled', $name . ' cancelled the job.', $url);
                break;
            default: Http::json(['error' => 'not_found'], 404);
        }
        Track::hit($u, 'artisan', 'job_' . $action);
        $this->show($id);
    }

    /** POST /service-jobs/{id}/ping { lat, lng, heading, speed } : the artisan's phone, every few seconds while on the way */
    public function ping(int $id): void
    {
        $u = Auth::require(); $j = $this->job($id, $u);
        if ((int) $j['artisan_id'] !== (int) $u['id']) Http::json(['error' => 'forbidden'], 403);
        if (!in_array($j['status'], ['enroute', 'arrived'], true)) Http::json(['job' => $this->shape($j, $u), 'stop' => true]); // tells the phone to stop sharing
        $b = Http::body(); $lat = (float) ($b['lat'] ?? 0); $lng = (float) ($b['lng'] ?? 0);
        if ($lat < 8 || $lat > 10 || $lng < 6.5 || $lng > 8) Http::json(['error' => 'validation'], 422);
        $this->recordPing($id, $lat, $lng, isset($b['heading']) ? (int) $b['heading'] : null, isset($b['speed']) ? (float) $b['speed'] : null, false);
        Http::json(['job' => $this->shape(Db::one('SELECT * FROM service_jobs WHERE id = ?', [$id]), $u)]);
    }

    /** Stores a position; updates "moved" time, the road route and ETA when useful, and auto-arrives. */
    private function recordPing(int $id, float $lat, float $lng, ?int $heading, ?float $speed, bool $force): void
    {
        $j = Db::one('SELECT * FROM service_jobs WHERE id = ?', [$id]); $now = Db::now();
        $moved = $j['a_lat'] === null || self::metres((float) $j['a_lat'], (float) $j['a_lng'], $lat, $lng) >= self::STOP_M;
        // Heading from movement when the phone does not report one
        if ($heading === null && $j['a_lat'] !== null && $moved) { $y = sin(deg2rad($lng - (float) $j['a_lng'])) * cos(deg2rad($lat)); $x = cos(deg2rad((float) $j['a_lat'])) * sin(deg2rad($lat)) - sin(deg2rad((float) $j['a_lat'])) * cos(deg2rad($lat)) * cos(deg2rad($lng - (float) $j['a_lng'])); $heading = ((int) round(rad2deg(atan2($y, $x))) + 360) % 360; }
        Db::run('UPDATE service_jobs SET a_lat = ?, a_lng = ?, a_heading = COALESCE(?, a_heading), a_speed = ?, a_at = ?' . ($moved || $j['moved_at'] === null ? ', moved_at = ?' : '') . ' WHERE id = ?',
            array_merge([round($lat, 6), round($lng, 6), $heading, $speed, $now], $moved || $j['moved_at'] === null ? [$now] : [], [$id]));
        if ($moved) Db::run('INSERT INTO service_trail (job_id, lat, lng, at) VALUES (?,?,?,?)', [$id, round($lat, 6), round($lng, 6), $now]);
        $dist = self::metres($lat, $lng, (float) $j['lat'], (float) $j['lng']);
        // Road route and ETA: at the start, then every 90 s or after 400 m of movement, so the free router is not hammered.
        $lastRouteAge = $j['route_at'] ? time() - strtotime($j['route_at'] . ' UTC') : 99999;
        $movedSinceRoute = $j['route_json'] ? (function () use ($j, $lat, $lng) { $r = json_decode($j['route_json'], true); $p = $r[0] ?? null; return $p ? self::metres((float) $p[1], (float) $p[0], $lat, $lng) : 99999; })() : 99999;
        if ($force || $lastRouteAge > 90 || $movedSinceRoute > 400) {
            $r = Routing::route([[$lat, $lng], [(float) $j['lat'], (float) $j['lng']]]);
            Db::run('UPDATE service_jobs SET route_json = ?, route_at = ?, route_km = ?, eta_min = ?, eta_at = ? WHERE id = ?', [json_encode($r['coords']), $now, $r['km'], $r['minutes'], gmdate('Y-m-d H:i:s', time() + $r['minutes'] * 60), $id]);
        } elseif ($j['route_km'] !== null && (float) $j['route_km'] > 0) {
            // Between routings, scale the last ETA by how much straight-line distance is left
            $share = min(1.0, ($dist / 1000 * WakaFares::ROAD_FACTOR) / max(0.05, (float) $j['route_km']));
            $eta = max(1, (int) round((int) $j['eta_min'] * $share));
            Db::run('UPDATE service_jobs SET eta_min = ?, eta_at = ? WHERE id = ?', [$eta, gmdate('Y-m-d H:i:s', time() + $eta * 60), $id]);
        }
        if ($j['status'] === 'enroute' && $dist <= self::ARRIVE_M) {
            Db::run("UPDATE service_jobs SET status = 'arrived', arrived_at = ?, eta_min = 0 WHERE id = ?", [$now, $id]);
            $name = (Db::one('SELECT business FROM artisans WHERE user_id = ?', [$j['artisan_id']])['business'] ?? '') ?: explode(' ', trim((string) (Db::one('SELECT name FROM users WHERE id = ?', [$j['artisan_id']])['name'] ?? 'They')))[0];
            Notify::user((int) $j['customer_id'], 'work', $name . ' has arrived', 'They are at your location.', '/#/jobs/' . $id, true);
        }
    }

    /** POST /service-jobs/{id}/rate { stars, tags, comment } : the customer, once, after the job */
    public function rate(int $id): void
    {
        $u = Auth::require(); $j = $this->job($id, $u);
        if ((int) $j['customer_id'] !== (int) $u['id']) Http::json(['error' => 'forbidden'], 403);
        if ($j['status'] !== 'done' && $j['status'] !== 'arrived') Http::json(['error' => 'validation', 'message' => 'Rate them once the job is done.'], 422);
        if ((int) $j['rated']) Http::json(['error' => 'validation', 'message' => 'You already rated this job.'], 409);
        $b = Http::body(); $stars = max(1, min(5, (int) ($b['stars'] ?? 0)));
        $allowed = RatingController::TAGS['artisan'] ?? []; $tags = array_values(array_intersect((array) ($b['tags'] ?? []), $allowed));
        if ($j['status'] === 'arrived') Db::run("UPDATE service_jobs SET status = 'done', done_at = ? WHERE id = ?", [Db::now(), $id]);
        // One rating per person per artisan: a later job updates it, so it always reflects the most recent visit.
        $comment = mb_substr(trim((string) ($b['comment'] ?? '')), 0, 400) ?: null;
        $prev = $j['thread_id'] ? Db::one('SELECT id FROM user_ratings WHERE thread_id = ? AND rater = ?', [$j['thread_id'], $u['id']]) : null;
        if ($prev) Db::run('UPDATE user_ratings SET stars = ?, tags = ?, comment = ?, module = ?, hidden_at = NULL, created_at = ? WHERE id = ?', [$stars, json_encode($tags), $comment, 'artisan', Db::now(), $prev['id']]);
        else Db::run('INSERT INTO user_ratings (rater, rated, thread_id, module, stars, tags, comment, created_at) VALUES (?,?,?,?,?,?,?,?)', [$u['id'], $j['artisan_id'], $j['thread_id'], 'artisan', $stars, json_encode($tags), $comment, Db::now()]);
        Db::run('UPDATE service_jobs SET rated = 1 WHERE id = ?', [$id]);
        if ($stars >= 4) Notify::user((int) $j['artisan_id'], 'work', 'You got ' . $stars . ' stars', explode(' ', trim((string) $u['name']))[0] . ' rated your work.', '/#/people/' . (int) $j['artisan_id']);
        $this->show($id);
    }
}

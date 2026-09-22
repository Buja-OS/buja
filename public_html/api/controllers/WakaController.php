<?php
declare(strict_types=1);

final class WakaController
{
    private function place(array $p): array { return ['id' => (int) $p['id'], 'name' => $p['name'], 'district' => $p['district'], 'lat' => (float) $p['lat'], 'lng' => (float) $p['lng'], 'kind' => $p['kind']]; }

    /** GET /waka/admin/geometry?key=ADMIN_KEY : fetch road geometry for every route once from OpenRouteService and store it. */
    public function buildGeometry(): void
    {
        $adminKey = (string) Http::config('admin_key', ''); $ors = (string) Http::config('ors_api_key', '');
        if ($adminKey === '' || ($_GET['key'] ?? '') !== $adminKey) Http::json(['error' => 'forbidden', 'message' => 'Set ADMIN_KEY in the environment and pass it as ?key='], 403);
        if ($ors === '') Http::json(['error' => 'config', 'message' => 'Set ORS_API_KEY in the environment first.'], 409);
        $done = []; $failed = [];
        foreach (Db::pdo()->query('SELECT * FROM routes WHERE active = 1')->fetchAll() as $r) {
            if (!empty($_GET['only']) && (int) $_GET['only'] !== (int) $r['id']) continue;
            $stops = $this->stops((int) $r['id']); if (count($stops) < 2) continue;
            $profile = $r['mode'] === 'train' ? null : 'driving-car';
            if ($profile === null) { $segs = []; for ($i = 0; $i < count($stops) - 1; $i++) $segs[] = [[$stops[$i]['lat'], $stops[$i]['lng']], [$stops[$i + 1]['lat'], $stops[$i + 1]['lng']]]; Db::run('UPDATE routes SET geometry = ? WHERE id = ?', [json_encode($segs), $r['id']]); $done[] = $r['name']; continue; }
            $coords = array_map(fn($s) => [$s['lng'], $s['lat']], $stops);
            $ch = curl_init('https://api.openrouteservice.org/v2/directions/' . $profile . '/geojson');
            curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_POSTFIELDS => json_encode(['coordinates' => $coords]), CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: ' . $ors]]);
            $raw = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
            $g = json_decode((string) $raw, true);
            $line = $g['features'][0]['geometry']['coordinates'] ?? null; $wp = $g['features'][0]['properties']['way_points'] ?? null;
            if ($code !== 200 || !$line || !$wp) { $failed[] = $r['name'] . ' (' . $code . ')'; continue; }
            $segs = [];
            for ($i = 0; $i < count($wp) - 1; $i++) $segs[] = array_map(fn($c) => [round($c[1], 5), round($c[0], 5)], array_slice($line, $wp[$i], $wp[$i + 1] - $wp[$i] + 1));
            Db::run('UPDATE routes SET geometry = ? WHERE id = ?', [json_encode($segs), $r['id']]); $done[] = $r['name'];
            usleep(300000);
        }
        Http::json(['done' => $done, 'failed' => $failed]);
    }

    /** GET /waka/places?q= */
    public function places(): void
    {
        Auth::require(); $q = trim((string) ($_GET['q'] ?? ''));
        $st = Db::pdo()->prepare('SELECT * FROM places WHERE active = 1' . ($q !== '' ? ' AND (name LIKE ? OR district LIKE ?)' : '') . ' ORDER BY popularity DESC, name LIMIT 40');
        $st->execute($q !== '' ? ['%' . $q . '%', '%' . $q . '%'] : []);
        Http::json(['places' => array_map([$this, 'place'], $st->fetchAll())]);
    }

    private function stops(int $routeId): array
    {
        $st = Db::pdo()->prepare('SELECT p.*, rs.position FROM route_stops rs JOIN places p ON p.id = rs.place_id WHERE rs.route_id = ? ORDER BY rs.position'); $st->execute([$routeId]);
        return array_map(fn($r) => $this->place($r) + ['position' => (int) $r['position']], $st->fetchAll());
    }
    private function routeShape(array $r, bool $withStops = false): array
    {
        $out = ['id' => (int) $r['id'], 'name' => $r['name'], 'mode' => $r['mode'], 'modeLabel' => WakaRules::MODES[$r['mode']] ?? $r['mode'], 'origin' => (int) $r['origin_place'], 'dest' => (int) $r['dest_place'], 'color' => $r['color'], 'notes' => $r['notes'], 'ridersNow' => WakaRules::ridersNow((int) $r['id'])];
        if ($withStops) { $out['stops'] = $this->stops((int) $r['id']); $out['fare'] = WakaRules::fare((int) $r['id'], (int) $r['origin_place'], (int) $r['dest_place']); $out['geometry'] = !empty($r['geometry']) ? json_decode($r['geometry'], true) : null; }
        return $out;
    }

    /** GET /waka/routes */
    public function routes(): void
    {
        Auth::require();
        $st = Db::pdo()->query('SELECT * FROM routes WHERE active = 1 ORDER BY name');
        $rows = [];
        foreach ($st->fetchAll() as $r) { $s = $this->routeShape($r, true); $rows[] = $s; }
        Http::json(['routes' => $rows]);
    }

    /** GET /waka/routes/{id} : stops, fare table, recent reports, riders now */
    public function route(int $id): void
    {
        $u = Auth::require();
        $r = Db::one('SELECT * FROM routes WHERE id = ? AND active = 1', [$id]); if (!$r) Http::json(['error' => 'not_found'], 404);
        $out = $this->routeShape($r, true);
        $rep = Db::pdo()->prepare('SELECT f.amount, f.created_at, pa.name AS from_name, pb.name AS to_name FROM fare_reports f JOIN places pa ON pa.id = f.from_place JOIN places pb ON pb.id = f.to_place WHERE f.route_id = ? ORDER BY f.id DESC LIMIT 10'); $rep->execute([$id]);
        $out['recentReports'] = array_map(fn($x) => ['amount' => (int) $x['amount'], 'from' => $x['from_name'], 'to' => $x['to_name'], 'at' => $x['created_at']], $rep->fetchAll());
        $out['myCheckin'] = Db::one('SELECT 1 AS x FROM route_checkins WHERE route_id = ? AND user_id = ? AND created_at > ?', [$id, $u['id'], gmdate('Y-m-d H:i:s', time() - WakaRules::CHECKIN_WINDOW_MIN * 60)]) !== null;
        Http::json(['route' => $out]);
    }

    /** GET /waka/plan?from=&to= : direct routes, then one-transfer routes; each option priced and timed */
    public function plan(): void
    {
        Auth::require();
        $from = (int) ($_GET['from'] ?? 0); $to = (int) ($_GET['to'] ?? 0);
        $a = Db::one('SELECT * FROM places WHERE id = ?', [$from]); $b = Db::one('SELECT * FROM places WHERE id = ?', [$to]);
        if (!$a || !$b || $from === $to) Http::json(['error' => 'validation', 'message' => 'Choose two different places.'], 422);
        $routes = Db::pdo()->query('SELECT * FROM routes WHERE active = 1')->fetchAll();
        $stopsBy = []; foreach ($routes as $r) $stopsBy[$r['id']] = $this->stops((int) $r['id']);
        $pos = fn(int $rid, int $pid) => (function () use ($stopsBy, $rid, $pid) { foreach ($stopsBy[$rid] as $s) if ($s['id'] === $pid) return $s['position']; return null; })();
        $leg = function (array $r, int $x, int $y) use ($stopsBy): array {
            $sx = null; $sy = null; foreach ($stopsBy[$r['id']] as $s) { if ($s['id'] === $x) $sx = $s; if ($s['id'] === $y) $sy = $s; }
            $km = WakaRules::km($sx['lat'], $sx['lng'], $sy['lat'], $sy['lng']);
            $f = WakaRules::fare((int) $r['id'], $x, $y);
            $lo = min($sx['position'], $sy['position']); $hi = max($sx['position'], $sy['position']);
            $path = array_values(array_filter($stopsBy[$r['id']], fn($s) => $s['position'] >= $lo && $s['position'] <= $hi));
            if ($sx['position'] > $sy['position']) $path = array_reverse($path);
            $geom = null;
            if (!empty($r['geometry'])) { $segs = json_decode($r['geometry'], true); $lo2 = min($sx['position'], $sy['position']); $hi2 = max($sx['position'], $sy['position']); $pts = []; for ($i = $lo2; $i < $hi2; $i++) foreach ($segs[$i] ?? [] as $pt) $pts[] = $pt; if ($sx['position'] > $sy['position']) $pts = array_reverse($pts); $geom = $pts ?: null; }
            return ['routeId' => (int) $r['id'], 'routeName' => $r['name'], 'mode' => $r['mode'], 'modeLabel' => WakaRules::MODES[$r['mode']], 'color' => $r['color'], 'from' => $sx, 'to' => $sy, 'km' => round($km, 1), 'minutes' => WakaRules::minutes($km, $r['mode']), 'fare' => $f, 'ridersNow' => WakaRules::ridersNow((int) $r['id']), 'path' => $path, 'geometry' => $geom, 'say' => 'Tell the driver "' . $sy['name'] . '"'];
        };
        $options = [];
        foreach ($routes as $r) { $pa = $pos((int) $r['id'], $from); $pb = $pos((int) $r['id'], $to); if ($pa !== null && $pb !== null && $pa !== $pb) $options[] = ['legs' => [$leg($r, $from, $to)], 'transfers' => 0]; }
        // One transfer, but only where a single route cannot already do the trip.
        if (count($options) < 3) {
            $pairs = [];
            foreach ($routes as $r1) {
                $p1 = $pos((int) $r1['id'], $from); if ($p1 === null) continue;
                if ($pos((int) $r1['id'], $to) !== null) continue; // this route goes the whole way; it is already a direct option
                foreach ($routes as $r2) {
                    if ((int) $r2['id'] === (int) $r1['id']) continue;
                    $p2 = $pos((int) $r2['id'], $to); if ($p2 === null) continue;
                    if ($pos((int) $r2['id'], $from) !== null) continue; // same: r2 alone would be direct
                    $bestPair = null;
                    foreach ($stopsBy[$r1['id']] as $mid) {
                        if ((int) $mid['id'] === $from || (int) $mid['id'] === $to) continue;
                        $pm = $pos((int) $r2['id'], (int) $mid['id']); if ($pm === null || $pm === $p2) continue;
                        $cand = ['legs' => [$leg($r1, $from, (int) $mid['id']), $leg($r2, (int) $mid['id'], $to)], 'transfers' => 1];
                        $cost = array_sum(array_map(fn($l) => $l['fare']['amount'] ?? 99999, $cand['legs']));
                        if ($bestPair === null || $cost < $bestPair[0]) $bestPair = [$cost, $cand];
                    }
                    if ($bestPair) $pairs[] = $bestPair;
                }
            }
            usort($pairs, fn($a, $b) => $a[0] <=> $b[0]);
            foreach (array_slice($pairs, 0, 3) as $pair) $options[] = $pair[1];
        }
        // Two transfers, only when nothing else works: Maitama to the Airport is Wuse, then Berger, then the airport road.
        if (!$options) {
            $triples = [];
            foreach ($routes as $r1) {
                if ($pos((int) $r1['id'], $from) === null) continue;
                foreach ($stopsBy[$r1['id']] as $m1) {
                    if ((int) $m1['id'] === $from || (int) $m1['id'] === $to) continue;
                    foreach ($routes as $r2) {
                        if ((int) $r2['id'] === (int) $r1['id'] || $pos((int) $r2['id'], (int) $m1['id']) === null) continue;
                        foreach ($stopsBy[$r2['id']] as $m2) {
                            if (in_array((int) $m2['id'], [$from, $to, (int) $m1['id']], true)) continue;
                            foreach ($routes as $r3) {
                                if (in_array((int) $r3['id'], [(int) $r1['id'], (int) $r2['id']], true)) continue;
                                if ($pos((int) $r3['id'], (int) $m2['id']) === null || $pos((int) $r3['id'], $to) === null) continue;
                                $cand = ['legs' => [$leg($r1, $from, (int) $m1['id']), $leg($r2, (int) $m1['id'], (int) $m2['id']), $leg($r3, (int) $m2['id'], $to)], 'transfers' => 2];
                                $cost = array_sum(array_map(fn($l) => $l['fare']['amount'] ?? 99999, $cand['legs'])) + array_sum(array_map(fn($l) => $l['minutes'] ?? 0, $cand['legs']));
                                $triples[] = [$cost, $cand];
                            }
                        }
                    }
                }
            }
            usort($triples, fn($a, $b) => $a[0] <=> $b[0]);
            foreach (array_slice($triples, 0, 2) as $t3) $options[] = $t3[1];
        }
        foreach ($options as &$o) { $o['fare'] = array_sum(array_map(fn($l) => $l['fare']['amount'] ?? 0, $o['legs'])); $o['minutes'] = array_sum(array_column($o['legs'], 'minutes')) + $o['transfers'] * 8; $o['confirmed'] = !in_array(false, array_map(fn($l) => $l['fare']['confirmed'], $o['legs']), true); $o['ridersNow'] = array_sum(array_column($o['legs'], 'ridersNow')); }
        unset($o);
        usort($options, fn($x, $y) => [$x['fare'], $x['minutes']] <=> [$y['fare'], $y['minutes']]);
        $options = array_slice($options, 0, 4);
        if ($options) { $options[0]['tag'] = 'cheapest'; $fi = 0; foreach ($options as $i => $o) if ($o['minutes'] < $options[$fi]['minutes']) $fi = $i; if ($fi !== 0 || count($options) === 1) $options[$fi]['tag'] = $options[$fi]['tag'] ?? 'fastest'; if (count($options) > 1 && $fi === 0) $options[0]['tag'] = 'cheapest and fastest'; }
        Track::hit(Auth::user(), 'waka', 'plan');
        $km = WakaRules::km((float) $a['lat'], (float) $a['lng'], (float) $b['lat'], (float) $b['lng']);
        // Door to door: a chartered taxi, Bolt and inDrive, estimated from road distance and fuel. Uber left Nigeria on 2 Sept 2026.
        $airport = stripos($a['name'] . ' ' . $b['name'], 'airport') !== false;
        $mins = WakaRules::minutes($km * WakaFares::ROAD_FACTOR, 'taxi');
        $drop = WakaFares::drop($km, $airport);
        $taxi = ['legs' => [['mode' => 'taxi', 'modeLabel' => 'Taxi', 'routeName' => 'Taxi drop, direct', 'from' => $this->place($a), 'to' => $this->place($b), 'km' => round($km * WakaFares::ROAD_FACTOR, 1), 'minutes' => $mins, 'fare' => ['amount' => $drop, 'reports' => 0, 'confirmed' => false, 'source' => 'estimate']]], 'transfers' => 0, 'taxi' => true, 'fare' => $drop, 'minutes' => $mins, 'confirmed' => false, 'ridersNow' => 0];
        $rides = [
            ['kind' => 'drop', 'label' => 'Taxi drop (charter)', 'fare' => $drop, 'range' => [WakaFares::drop($km * 0.8, $airport), (int) (ceil($drop * 1.2 / 50) * 50)], 'minutes' => $mins, 'note' => $airport ? 'Airport runs cost more: e-hailing pickups there have been restricted since the FAAN directive of 30 July 2026.' : 'Agree the price before you enter. Roughly four along seats.'],
            ['kind' => 'bolt', 'label' => 'Bolt', 'fare' => WakaFares::bolt($km, $mins), 'range' => [WakaFares::bolt($km, $mins), (int) (ceil(WakaFares::bolt($km, $mins) * 1.6 / 50) * 50)], 'minutes' => $mins, 'note' => 'Estimate. Surge can push it higher at rush hour and in rain.'],
            ['kind' => 'indrive', 'label' => 'inDrive', 'fare' => WakaFares::indrive($km, $mins), 'range' => null, 'minutes' => $mins, 'note' => 'A fair opening offer. You propose, drivers accept or counter.'],
        ];
        Http::json(['from' => $this->place($a), 'to' => $this->place($b), 'km' => round($km, 1), 'options' => $options, 'taxi' => $taxi, 'rides' => $rides, 'pricing' => ['pumpPrice' => (int) WakaFares::config()['pump_price'], 'reviewedAt' => WakaFares::config()['reviewed_at']]]);
    }

    /** GET /waka/pricing : how fares are worked out, with live examples */
    public function pricing(): void { Auth::require(); Http::json(WakaFares::explain()); }

    /** POST /admin/waka/pricing { pumpPrice, adjust: {along, bus, keke, bolt} } */
    public function setPricing(): void
    {
        $u = Auth::require(); if (empty($u['is_admin']) && ($u['role'] ?? '') !== 'admin') Http::json(['error' => 'forbidden'], 403);
        $b = Http::body(); $p = (int) ($b['pumpPrice'] ?? 0);
        if ($p < 300 || $p > 5000) Http::json(['error' => 'validation', 'message' => 'Pump price per litre, between N300 and N5,000.'], 422);
        WakaFares::set('pump_price', (string) $p); WakaFares::set('reviewed_at', gmdate('Y-m-d'));
        foreach (['along', 'bus', 'keke', 'bolt'] as $m) if (isset($b['adjust'][$m])) WakaFares::set('adjust_' . $m, (string) max(-50, min(100, (float) $b['adjust'][$m])));
        Http::json(WakaFares::explain());
    }

    /** GET /route?pts=lat,lng;lat,lng : a road route for any map in Buja */
    public function road(): void
    {
        Auth::require(); RateLimit::hit('route', 120, 3600);
        $pts = array_map(fn($p) => array_map('floatval', explode(',', $p)), array_filter(explode(';', (string) ($_GET['pts'] ?? ''))));
        $pts = array_values(array_filter($pts, fn($p) => count($p) === 2 && $p[0] > 8 && $p[0] < 10 && $p[1] > 6.5 && $p[1] < 8)); // FCT and around
        if (count($pts) < 2 || count($pts) > 12) Http::json(['error' => 'validation', 'message' => 'Two to twelve points inside the FCT.'], 422);
        Http::json(Routing::route($pts));
    }

    /** POST /waka/fares { routeId, from, to, amount } : the crowd fare */
    public function reportFare(): void
    {
        $u = Auth::require(); RateLimit::hit('fare', 30, 3600);
        $b = Http::body(); $rid = (int) ($b['routeId'] ?? 0); $from = (int) ($b['from'] ?? 0); $to = (int) ($b['to'] ?? 0); $amt = (int) preg_replace('/\D+/', '', (string) ($b['amount'] ?? ''));
        if ($amt < 50 || $amt > 50000) Http::json(['error' => 'validation', 'fields' => ['amount' => 'Enter what you paid, between ₦50 and ₦50,000.']], 422);
        $ok = Db::one('SELECT 1 AS x FROM route_stops a JOIN route_stops b ON b.route_id = a.route_id WHERE a.route_id = ? AND a.place_id = ? AND b.place_id = ? AND a.position <> b.position', [$rid, $from, $to]);
        if (!$ok) Http::json(['error' => 'validation', 'message' => 'Those two stops are not both on this route.'], 422);
        Db::run('INSERT INTO fare_reports (route_id, from_place, to_place, amount, user_id, created_at) VALUES (?,?,?,?,?,?)', [$rid, $from, $to, $amt, $u['id'], Db::now()]); Track::hit($u, 'waka', 'fare_report');
        Http::json(['fare' => WakaRules::fare($rid, $from, $to)], 201);
    }

    /** POST /waka/checkin { routeId } : "I'm on this route now" */
    public function checkin(): void
    {
        $u = Auth::require(); RateLimit::hit('checkin', 60, 3600);
        $rid = (int) (Http::body()['routeId'] ?? 0);
        if (!Db::one('SELECT id FROM routes WHERE id = ? AND active = 1', [$rid])) Http::json(['error' => 'not_found'], 404);
        Db::run('DELETE FROM route_checkins WHERE route_id = ? AND user_id = ?', [$rid, $u['id']]);
        Db::run('INSERT INTO route_checkins (route_id, user_id, created_at) VALUES (?,?,?)', [$rid, $u['id'], Db::now()]);
        Http::json(['ridersNow' => WakaRules::ridersNow($rid)], 201);
    }

    /** GET /waka/saved, POST /waka/saved { from, to, label }, DELETE /waka/saved/{id} */
    public function saved(): void
    {
        $u = Auth::require();
        $st = Db::pdo()->prepare('SELECT s.*, a.name AS from_name, b.name AS to_name FROM saved_routes s JOIN places a ON a.id = s.from_place JOIN places b ON b.id = s.to_place WHERE s.user_id = ? ORDER BY s.id'); $st->execute([$u['id']]);
        Http::json(['saved' => array_map(fn($s) => ['id' => (int) $s['id'], 'label' => $s['label'], 'from' => (int) $s['from_place'], 'to' => (int) $s['to_place'], 'fromName' => $s['from_name'], 'toName' => $s['to_name']], $st->fetchAll())]);
    }
    public function save(): void
    {
        $u = Auth::require(); $b = Http::body(); $from = (int) ($b['from'] ?? 0); $to = (int) ($b['to'] ?? 0); $label = mb_substr(trim((string) ($b['label'] ?? '')), 0, 40);
        if (!$from || !$to || $from === $to) Http::json(['error' => 'validation', 'message' => 'Choose two places.'], 422);
        if ((int) (Db::one('SELECT COUNT(*) AS n FROM saved_routes WHERE user_id = ?', [$u['id']])['n'] ?? 0) >= 10) Http::json(['error' => 'validation', 'message' => 'Up to 10 saved routes.'], 422);
        Db::run('INSERT INTO saved_routes (user_id, from_place, to_place, label, created_at) VALUES (?,?,?,?,?)', [$u['id'], $from, $to, $label ?: null, Db::now()]);
        $this->saved();
    }
    public function unsave(int $id): void
    {
        $u = Auth::require(); Db::run('DELETE FROM saved_routes WHERE id = ? AND user_id = ?', [$id, $u['id']]); $this->saved();
    }
}

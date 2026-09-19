<?php
declare(strict_types=1);

final class WakaController
{
    private function place(array $p): array { return ['id' => (int) $p['id'], 'name' => $p['name'], 'district' => $p['district'], 'lat' => (float) $p['lat'], 'lng' => (float) $p['lng'], 'kind' => $p['kind']]; }

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
        if ($withStops) { $out['stops'] = $this->stops((int) $r['id']); $out['fare'] = WakaRules::fare((int) $r['id'], (int) $r['origin_place'], (int) $r['dest_place']); }
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
            return ['routeId' => (int) $r['id'], 'routeName' => $r['name'], 'mode' => $r['mode'], 'modeLabel' => WakaRules::MODES[$r['mode']], 'color' => $r['color'], 'from' => $sx, 'to' => $sy, 'km' => round($km, 1), 'minutes' => WakaRules::minutes($km, $r['mode']), 'fare' => $f, 'ridersNow' => WakaRules::ridersNow((int) $r['id']), 'path' => $path, 'say' => 'Tell the driver "' . $sy['name'] . '"'];
        };
        $options = [];
        foreach ($routes as $r) { $pa = $pos((int) $r['id'], $from); $pb = $pos((int) $r['id'], $to); if ($pa !== null && $pb !== null && $pa !== $pb) $options[] = ['legs' => [$leg($r, $from, $to)], 'transfers' => 0]; }
        if (count($options) < 2) {
            foreach ($routes as $r1) { $p1 = $pos((int) $r1['id'], $from); if ($p1 === null) continue;
                foreach ($routes as $r2) { if ($r2['id'] === $r1['id']) continue; $p2 = $pos((int) $r2['id'], $to); if ($p2 === null) continue;
                    foreach ($stopsBy[$r1['id']] as $mid) { if ($mid['position'] === $p1 || $mid['id'] === $to) continue; $pm = $pos((int) $r2['id'], $mid['id']); if ($pm !== null && $pm !== $p2) { $options[] = ['legs' => [$leg($r1, $from, $mid['id']), $leg($r2, $mid['id'], $to)], 'transfers' => 1]; break; } }
                } if (count($options) >= 6) break; }
        }
        foreach ($options as &$o) { $o['fare'] = array_sum(array_map(fn($l) => $l['fare']['amount'] ?? 0, $o['legs'])); $o['minutes'] = array_sum(array_column($o['legs'], 'minutes')) + $o['transfers'] * 8; $o['confirmed'] = !in_array(false, array_map(fn($l) => $l['fare']['confirmed'], $o['legs']), true); $o['ridersNow'] = array_sum(array_column($o['legs'], 'ridersNow')); }
        unset($o);
        usort($options, fn($x, $y) => [$x['fare'], $x['minutes']] <=> [$y['fare'], $y['minutes']]);
        $options = array_slice($options, 0, 4);
        if ($options) { $options[0]['tag'] = 'cheapest'; $fi = 0; foreach ($options as $i => $o) if ($o['minutes'] < $options[$fi]['minutes']) $fi = $i; if ($fi !== 0 || count($options) === 1) $options[$fi]['tag'] = $options[$fi]['tag'] ?? 'fastest'; if (count($options) > 1 && $fi === 0) $options[0]['tag'] = 'cheapest and fastest'; }
        $km = WakaRules::km((float) $a['lat'], (float) $a['lng'], (float) $b['lat'], (float) $b['lng']);
        $taxi = ['legs' => [['mode' => 'taxi', 'modeLabel' => 'Taxi', 'routeName' => 'Taxi drop, direct', 'from' => $this->place($a), 'to' => $this->place($b), 'km' => round($km, 1), 'minutes' => WakaRules::minutes($km, 'taxi'), 'fare' => ['amount' => (int) (round(max(1500, 400 + $km * 350) / 100) * 100), 'reports' => 0, 'confirmed' => false], 'path' => [$this->place($a), $this->place($b)], 'say' => 'Agree the price before you enter', 'color' => '#1B1B1F', 'ridersNow' => 0]], 'transfers' => 0, 'tag' => 'direct', 'taxi' => true];
        $taxi['fare'] = $taxi['legs'][0]['fare']['amount']; $taxi['minutes'] = $taxi['legs'][0]['minutes']; $taxi['confirmed'] = false; $taxi['ridersNow'] = 0;
        Http::json(['from' => $this->place($a), 'to' => $this->place($b), 'km' => round($km, 1), 'options' => $options, 'taxi' => $taxi]);
    }

    /** POST /waka/fares { routeId, from, to, amount } : the crowd fare */
    public function reportFare(): void
    {
        $u = Auth::require(); RateLimit::hit('fare', 30, 3600);
        $b = Http::body(); $rid = (int) ($b['routeId'] ?? 0); $from = (int) ($b['from'] ?? 0); $to = (int) ($b['to'] ?? 0); $amt = (int) preg_replace('/\D+/', '', (string) ($b['amount'] ?? ''));
        if ($amt < 50 || $amt > 50000) Http::json(['error' => 'validation', 'fields' => ['amount' => 'Enter what you paid, between ₦50 and ₦50,000.']], 422);
        $ok = Db::one('SELECT 1 AS x FROM route_stops a JOIN route_stops b ON b.route_id = a.route_id WHERE a.route_id = ? AND a.place_id = ? AND b.place_id = ? AND a.position <> b.position', [$rid, $from, $to]);
        if (!$ok) Http::json(['error' => 'validation', 'message' => 'Those two stops are not both on this route.'], 422);
        Db::run('INSERT INTO fare_reports (route_id, from_place, to_place, amount, user_id, created_at) VALUES (?,?,?,?,?,?)', [$rid, $from, $to, $amt, $u['id'], Db::now()]);
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

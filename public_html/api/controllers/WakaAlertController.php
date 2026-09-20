<?php
declare(strict_types=1);

/**
 * Live road alerts. Somebody stuck at Berger says so, and everyone who saved a route through that corridor,
 * or who lives around there, hears about it within seconds. Alerts die on their own so the map never fills
 * with yesterday's traffic.
 */
final class WakaAlertController
{
    public const KINDS = [
        'traffic' => ['Heavy traffic', 3],
        'blocked' => ['Road blocked', 4],
        'accident' => ['Accident', 4],
        'flood' => ['Flooded', 5],
        'police' => ['Police checkpoint', 3],
        'fuel' => ['Fuel queue', 4],
        'protest' => ['Protest or crowd', 4],
        'nofare' => ['No vehicles', 2],
        'clear' => ['Moving freely again', 2],
    ];

    private function shape(array $a, array $u): array
    {
        $place = $a['place_id'] ? Db::one('SELECT name, district FROM places WHERE id = ?', [$a['place_id']]) : null;
        $mine = Db::one('SELECT vote FROM waka_alert_votes WHERE alert_id = ? AND user_id = ?', [$a['id'], $u['id']]);
        return ['id' => (int) $a['id'], 'kind' => $a['kind'], 'label' => (self::KINDS[$a['kind']] ?? ['Something', 2])[0],
            'place' => $place ? $place['name'] : null, 'district' => $a['district'], 'note' => $a['note'],
            'confirms' => (int) $a['confirms'], 'cleared' => (int) $a['cleared'], 'my_vote' => $mine ? (int) $mine['vote'] : 0,
            'mine' => (int) $a['user_id'] === (int) $u['id'], 'at' => $a['created_at'], 'until' => $a['expires_at']];
    }

    /** GET /waka/alerts : what is happening on the roads right now */
    public function index(): void
    {
        $u = Auth::require();
        $st = Db::pdo()->prepare('SELECT * FROM waka_alerts WHERE expires_at > ? AND confirms > cleared ORDER BY id DESC LIMIT 40');
        $st->execute([Db::now()]);
        Http::json(['alerts' => array_map(fn($a) => $this->shape($a, $u), $st->fetchAll()), 'kinds' => array_map(fn($k) => $k[0], self::KINDS)]);
    }

    /** POST /waka/alerts { kind, placeId, note } */
    public function create(): void
    {
        $u = Auth::require(); RateLimit::hit('wakaalert', 10, 3600);
        $b = Http::body();
        $kind = (string) ($b['kind'] ?? ''); if (!isset(self::KINDS[$kind])) Http::json(['error' => 'validation', 'message' => 'Pick what is happening.'], 422);
        $placeId = !empty($b['placeId']) ? (int) $b['placeId'] : null;
        $place = $placeId ? Db::one('SELECT * FROM places WHERE id = ? AND active = 1', [$placeId]) : null;
        if ($placeId && !$place) Http::json(['error' => 'validation', 'fields' => ['placeId' => 'Pick a stop or junction.']], 422);
        $district = $place['district'] ?? ($u['district'] ?? null);
        $hours = (self::KINDS[$kind][1]);
        // Somebody already said this about the same place? Confirm theirs instead of adding a duplicate.
        $existing = $placeId ? Db::one('SELECT * FROM waka_alerts WHERE place_id = ? AND kind = ? AND expires_at > ?', [$placeId, $kind, Db::now()]) : null;
        if ($existing) {
            if (Db::one('SELECT vote FROM waka_alert_votes WHERE alert_id = ? AND user_id = ?', [$existing['id'], $u['id']])) Db::run('UPDATE waka_alert_votes SET vote = 1 WHERE alert_id = ? AND user_id = ?', [$existing['id'], $u['id']]);
            else Db::run('INSERT INTO waka_alert_votes (alert_id, user_id, vote, created_at) VALUES (?,?,?,?)', [$existing['id'], $u['id'], 1, Db::now()]);
            Db::run('UPDATE waka_alerts SET confirms = confirms + 1, expires_at = ? WHERE id = ?', [gmdate('Y-m-d H:i:s', time() + $hours * 3600), $existing['id']]);
            Http::json(['alert' => $this->shape(Db::one('SELECT * FROM waka_alerts WHERE id = ?', [$existing['id']]), $u), 'merged' => true]);
        }
        Db::run('INSERT INTO waka_alerts (user_id, kind, place_id, district, note, expires_at, created_at) VALUES (?,?,?,?,?,?,?)',
            [$u['id'], $kind, $placeId, $district, mb_substr(trim((string) ($b['note'] ?? '')), 0, 300) ?: null, gmdate('Y-m-d H:i:s', time() + $hours * 3600), Db::now()]);
        $id = (int) Db::lastId();
        Track::hit($u, 'waka', 'alert:' . $kind);
        $this->tell($id, $kind, $place, $district, (int) $u['id']);
        Http::json(['alert' => $this->shape(Db::one('SELECT * FROM waka_alerts WHERE id = ?', [$id]), $u)], 201);
    }

    /** Tells the people this actually affects: riders with a saved route through the place, then the district. */
    private function tell(int $alertId, string $kind, ?array $place, ?string $district, int $reporter): void
    {
        try {
            $label = (self::KINDS[$kind] ?? ['Something', 2])[0];
            $where = $place ? $place['name'] : ($district ?: 'Abuja');
            $seen = [$reporter => true]; $sent = 0;
            if ($place) {
                $st = Db::pdo()->prepare('SELECT DISTINCT s.user_id FROM saved_routes s JOIN route_stops rs ON rs.route_id = s.route_id WHERE rs.place_id = ? LIMIT 400');
                $st->execute([$place['id']]);
                foreach ($st->fetchAll() as $r) {
                    $uid = (int) $r['user_id']; if (isset($seen[$uid])) continue; $seen[$uid] = true;
                    Notify::user($uid, 'waka', $label . ' at ' . $where, 'Reported just now on a route you saved. Tap for what riders are saying.', '/#/waka/alerts');
                    $sent++;
                }
            }
            if ($sent < 60 && $district) {
                $st = Db::pdo()->prepare('SELECT id FROM users WHERE district = ? AND deleted_at IS NULL LIMIT 200');
                $st->execute([$district]);
                foreach ($st->fetchAll() as $r) {
                    $uid = (int) $r['id']; if (isset($seen[$uid])) continue; $seen[$uid] = true;
                    Notify::user($uid, 'waka', $label . ' at ' . $where, 'Reported just now near you.', '/#/waka/alerts');
                }
            }
        } catch (Throwable $e) { error_log('[buja waka alert] ' . $e->getMessage()); }
    }

    /** POST /waka/alerts/{id}/vote { vote: 1 still there, -1 it has cleared } */
    public function vote(int $id): void
    {
        $u = Auth::require();
        $a = Db::one('SELECT * FROM waka_alerts WHERE id = ?', [$id]); if (!$a) Http::json(['error' => 'not_found'], 404);
        $v = (int) (Http::body()['vote'] ?? 0); if ($v !== 1 && $v !== -1) Http::json(['error' => 'validation'], 422);
        $had = Db::one('SELECT vote FROM waka_alert_votes WHERE alert_id = ? AND user_id = ?', [$id, $u['id']]);
        if ($had) Db::run('UPDATE waka_alert_votes SET vote = ? WHERE alert_id = ? AND user_id = ?', [$v, $id, $u['id']]);
        else Db::run('INSERT INTO waka_alert_votes (alert_id, user_id, vote, created_at) VALUES (?,?,?,?)', [$id, $u['id'], $v, Db::now()]);
        $agg = Db::one('SELECT SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END) AS up, SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END) AS down FROM waka_alert_votes WHERE alert_id = ?', [$id]);
        Db::run('UPDATE waka_alerts SET confirms = ?, cleared = ? WHERE id = ?', [1 + (int) ($agg['up'] ?? 0), (int) ($agg['down'] ?? 0), $id]);
        Http::json(['alert' => $this->shape(Db::one('SELECT * FROM waka_alerts WHERE id = ?', [$id]), $u)]);
    }
}

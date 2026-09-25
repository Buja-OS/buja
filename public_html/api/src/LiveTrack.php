<?php
declare(strict_types=1);

/**
 * A live journey to a customer: whoever is bringing something shares their phone's position, the customer watches
 * them come with a road route and an arrival time. Artisan call-outs keep their own copy of this logic inside
 * service_jobs; everything else that gets delivered (today: Declutter "Buy safely" orders) uses this.
 */
final class LiveTrack
{
    public const STOP_M = 25;      // moved less than this: not moving
    public const STOP_SEC = 180;   // not moving this long while on the way: stopped
    public const LOST_SEC = 75;    // no position this long: signal lost
    public const ARRIVE_M = 60;    // this close to the drop-off: arrived

    public static function get(string $kind, int $ref): ?array
    {
        try { return Db::one('SELECT * FROM live_tracks WHERE kind = ? AND ref_id = ?', [$kind, $ref]); } catch (Throwable $e) { return null; }
    }

    /** Begin (or resume) a journey. Returns the row. */
    public static function start(string $kind, int $ref, int $courier, int $watcher, float $destLat, float $destLng, ?float $lat = null, ?float $lng = null): array
    {
        $now = Db::now();
        if ($t = self::get($kind, $ref)) {
            Db::run("UPDATE live_tracks SET status = 'enroute', dest_lat = ?, dest_lng = ?, arrived_at = NULL WHERE id = ?", [round($destLat, 6), round($destLng, 6), $t['id']]);
        } else {
            Db::run('INSERT INTO live_tracks (kind, ref_id, courier_id, watcher_id, dest_lat, dest_lng, started_at) VALUES (?,?,?,?,?,?,?)', [$kind, $ref, $courier, $watcher, round($destLat, 6), round($destLng, 6), $now]);
        }
        $t = self::get($kind, $ref);
        if ($lat !== null && $lng !== null) $t = self::ping($t, $lat, $lng, null, null, true);
        return $t;
    }

    /** Store a position; refresh the road route and ETA when useful; arrive when close. Returns the updated row. */
    public static function ping(array $t, float $lat, float $lng, ?int $heading, ?float $speed, bool $force = false): array
    {
        $now = Db::now(); $id = (int) $t['id'];
        $moved = $t['a_lat'] === null || self::metres((float) $t['a_lat'], (float) $t['a_lng'], $lat, $lng) >= self::STOP_M;
        if ($heading === null && $t['a_lat'] !== null && $moved) {
            $y = sin(deg2rad($lng - (float) $t['a_lng'])) * cos(deg2rad($lat));
            $x = cos(deg2rad((float) $t['a_lat'])) * sin(deg2rad($lat)) - sin(deg2rad((float) $t['a_lat'])) * cos(deg2rad($lat)) * cos(deg2rad($lng - (float) $t['a_lng']));
            $heading = ((int) round(rad2deg(atan2($y, $x))) + 360) % 360;
        }
        Db::run('UPDATE live_tracks SET a_lat = ?, a_lng = ?, a_heading = COALESCE(?, a_heading), a_speed = ?, a_at = ?' . ($moved || $t['moved_at'] === null ? ', moved_at = ?' : '') . ' WHERE id = ?',
            array_merge([round($lat, 6), round($lng, 6), $heading, $speed, $now], $moved || $t['moved_at'] === null ? [$now] : [], [$id]));
        $dist = self::metres($lat, $lng, (float) $t['dest_lat'], (float) $t['dest_lng']);
        // road route and ETA at the start, then every 90 s or 400 m, so the free router is not hammered
        $routeAge = $t['route_at'] ? time() - strtotime($t['route_at'] . ' UTC') : 99999;
        $sinceRoute = 99999; if ($t['route_json']) { $r = json_decode($t['route_json'], true); $p = $r[0] ?? null; if ($p) $sinceRoute = self::metres((float) $p[1], (float) $p[0], $lat, $lng); }
        if ($force || $routeAge > 90 || $sinceRoute > 400) {
            $r = Routing::route([[$lat, $lng], [(float) $t['dest_lat'], (float) $t['dest_lng']]]);
            Db::run('UPDATE live_tracks SET route_json = ?, route_at = ?, route_km = ?, eta_min = ?, eta_at = ? WHERE id = ?', [json_encode($r['coords']), $now, $r['km'], $r['minutes'], gmdate('Y-m-d H:i:s', time() + $r['minutes'] * 60), $id]);
        } elseif ($t['route_km'] !== null && (float) $t['route_km'] > 0) {
            $share = min(1.0, ($dist / 1000 * WakaFares::ROAD_FACTOR) / max(0.05, (float) $t['route_km']));
            $eta = max(1, (int) round((int) $t['eta_min'] * $share));
            Db::run('UPDATE live_tracks SET eta_min = ?, eta_at = ? WHERE id = ?', [$eta, gmdate('Y-m-d H:i:s', time() + $eta * 60), $id]);
        }
        if ($t['status'] === 'enroute' && $dist <= self::ARRIVE_M) Db::run("UPDATE live_tracks SET status = 'arrived', arrived_at = ?, eta_min = 0 WHERE id = ?", [$now, $id]);
        return Db::one('SELECT * FROM live_tracks WHERE id = ?', [$id]);
    }

    public static function end(string $kind, int $ref): void
    {
        try { Db::run("UPDATE live_tracks SET status = 'ended', route_json = NULL WHERE kind = ? AND ref_id = ?", [$kind, $ref]); } catch (Throwable $e) {}
    }

    /** What the app shows: where they are, heading, stopped or lost, ETA, the road line. */
    public static function shape(?array $t): ?array
    {
        if (!$t || $t['status'] === 'ended') return null;
        $now = time(); $live = null;
        if ($t['a_lat'] !== null) {
            $age = $now - strtotime($t['a_at'] . ' UTC'); $still = $t['moved_at'] ? $now - strtotime($t['moved_at'] . ' UTC') : 0;
            $live = ['lat' => (float) $t['a_lat'], 'lng' => (float) $t['a_lng'], 'heading' => $t['a_heading'] !== null ? (int) $t['a_heading'] : null,
                'speedKmh' => $t['a_speed'] !== null ? round((float) $t['a_speed'] * 3.6) : null, 'age' => $age, 'lost' => $age > self::LOST_SEC,
                'stopped' => $t['status'] === 'enroute' && $still >= self::STOP_SEC && $age <= self::LOST_SEC, 'stoppedMin' => (int) floor($still / 60),
                'etaMin' => $t['eta_min'] !== null ? (int) $t['eta_min'] : null, 'etaAt' => $t['eta_at'], 'routeKm' => $t['route_km'] !== null ? (float) $t['route_km'] : null,
                'metres' => (int) round(self::metres((float) $t['a_lat'], (float) $t['a_lng'], (float) $t['dest_lat'], (float) $t['dest_lng']))];
        }
        return ['status' => $t['status'], 'dest' => ['lat' => (float) $t['dest_lat'], 'lng' => (float) $t['dest_lng']], 'live' => $live,
            'route' => $live && $t['route_json'] ? json_decode($t['route_json'], true) : null, 'started' => $t['started_at'], 'arrived' => $t['arrived_at']];
    }

    /** Travel time with no route yet: straight line, road factor, city speed. */
    public static function guessMinutes(float $km): int { return max(3, (int) round($km * WakaFares::ROAD_FACTOR / 22 * 60)); }

    private static function metres(float $a, float $b, float $c, float $d): float { return WakaRules::km($a, $b, $c, $d) * 1000; }
}

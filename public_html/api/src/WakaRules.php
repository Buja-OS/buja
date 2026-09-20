<?php
declare(strict_types=1);

final class WakaRules
{
    public const MODES = ['bus' => 'Green bus', 'along' => 'Along cab', 'keke' => 'Keke', 'taxi' => 'Taxi', 'train' => 'Train'];
    /** Average speed in km/h by mode, for time estimates. Abuja traffic, not free flow. */
    public const SPEED = ['bus' => 20, 'along' => 26, 'keke' => 18, 'taxi' => 30, 'train' => 45];
    public const CHECKIN_WINDOW_MIN = 15;
    public const FARE_WINDOW_DAYS = 30;

    public static function km(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $r = 6371; $dLat = deg2rad($lat2 - $lat1); $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        return 2 * $r * asin(sqrt($a));
    }

    public static function minutes(float $km, string $mode): int
    {
        return max(3, (int) round($km / (self::SPEED[$mode] ?? 22) * 60 * 1.25)); // 1.25 for stops and waiting
    }

    /** Consensus fare between two stops of a route: median of recent reports, else the seeded estimate. */
    public static function fare(int $routeId, int $fromStop, int $toStop): array
    {
        $st = Db::pdo()->prepare('SELECT amount FROM fare_reports WHERE route_id = ? AND from_place = ? AND to_place = ? AND created_at > ? ORDER BY amount');
        $st->execute([$routeId, $fromStop, $toStop, gmdate('Y-m-d H:i:s', time() - self::FARE_WINDOW_DAYS * 86400)]);
        $amts = array_map('intval', array_column($st->fetchAll(), 'amount'));
        if ($amts) { $n = count($amts); $med = $n % 2 ? $amts[intdiv($n, 2)] : (int) round(($amts[$n / 2 - 1] + $amts[$n / 2]) / 2); return ['amount' => $med, 'reports' => $n, 'confirmed' => true]; }
        $seed = Db::one('SELECT amount FROM fare_seeds WHERE route_id = ? AND ((from_place = ? AND to_place = ?) OR (from_place = ? AND to_place = ?))', [$routeId, $fromStop, $toStop, $toStop, $fromStop]);
        if ($seed) return ['amount' => (int) $seed['amount'], 'reports' => 0, 'confirmed' => false];
        // No seed for this pair: estimate from the route's origin-to-end seed scaled by distance.
        $full = Db::one('SELECT s.amount, r.origin_place, r.dest_place FROM fare_seeds s JOIN routes r ON r.id = s.route_id WHERE s.route_id = ? AND s.from_place = r.origin_place AND s.to_place = r.dest_place', [$routeId]);
        if (!$full) return ['amount' => null, 'reports' => 0, 'confirmed' => false];
        $a = Db::one('SELECT lat, lng FROM places WHERE id = ?', [$fromStop]); $b = Db::one('SELECT lat, lng FROM places WHERE id = ?', [$toStop]);
        $o = Db::one('SELECT lat, lng FROM places WHERE id = ?', [$full['origin_place']]); $d = Db::one('SELECT lat, lng FROM places WHERE id = ?', [$full['dest_place']]);
        $part = self::km((float) $a['lat'], (float) $a['lng'], (float) $b['lat'], (float) $b['lng']); $whole = max(0.5, self::km((float) $o['lat'], (float) $o['lng'], (float) $d['lat'], (float) $d['lng']));
        return ['amount' => (int) (round(max(100, (int) $full['amount'] * $part / $whole) / 50) * 50), 'reports' => 0, 'confirmed' => false];
    }

    public static function ridersNow(int $routeId): int
    {
        return (int) (Db::one('SELECT COUNT(DISTINCT user_id) AS n FROM route_checkins WHERE route_id = ? AND created_at > ?', [$routeId, gmdate('Y-m-d H:i:s', time() - self::CHECKIN_WINDOW_MIN * 60)])['n'] ?? 0);
    }
}

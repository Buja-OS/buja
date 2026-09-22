<?php
declare(strict_types=1);

/** Road routes from a free routing service, cached, with a straight-line fallback so nothing ever breaks. */
final class Routing
{
    /** $pts: [[lat, lng], ...]. Returns ['km', 'minutes', 'coords' => [[lng, lat], ...], 'source']. */
    public static function route(array $pts): array
    {
        $pts = array_values(array_filter($pts, fn($p) => is_array($p) && count($p) === 2));
        if (count($pts) < 2) return ['km' => 0, 'minutes' => 0, 'coords' => [], 'source' => 'none'];
        $key = sha1(json_encode(array_map(fn($p) => [round((float) $p[0], 3), round((float) $p[1], 3)], $pts))); // ~100 m buckets
        try { $c = Db::one('SELECT body, created_at FROM route_cache WHERE k = ?', [$key]); if ($c && strtotime($c['created_at'] . ' UTC') > time() - 14 * 86400) return json_decode($c['body'], true); } catch (Throwable $e) {}
        $r = self::ors($pts) ?? self::osrm($pts) ?? self::straight($pts);
        if ($r['source'] !== 'straight') { try { Db::run('DELETE FROM route_cache WHERE k = ?', [$key]); Db::run('INSERT INTO route_cache (k, body, created_at) VALUES (?,?,?)', [$key, json_encode($r), Db::now()]); } catch (Throwable $e) {} }
        return $r;
    }
    private static function get(string $url, array $headers = [], ?string $post = null): ?array
    {
        if (!function_exists('curl_init')) return null;
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 6, CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_HTTPHEADER => $headers, CURLOPT_USERAGENT => 'Buja/1.0 (buja.onrender.com)']);
        if ($post !== null) { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, $post); }
        $raw = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        return $code === 200 && $raw ? json_decode((string) $raw, true) : null;
    }
    private static function ors(array $pts): ?array
    {
        $key = (string) Http::config('ors_api_key', ''); if ($key === '') return null;
        $j = self::get('https://api.openrouteservice.org/v2/directions/driving-car/geojson', ['Authorization: ' . $key, 'Content-Type: application/json'], json_encode(['coordinates' => array_map(fn($p) => [(float) $p[1], (float) $p[0]], $pts)]));
        $f = $j['features'][0] ?? null; if (!$f) return null;
        return ['km' => round(($f['properties']['summary']['distance'] ?? 0) / 1000, 2), 'minutes' => (int) round(($f['properties']['summary']['duration'] ?? 0) / 60 * 1.25), 'coords' => $f['geometry']['coordinates'] ?? [], 'source' => 'openrouteservice'];
    }
    /** The public OSRM server: fair use only, about one request a second, no guarantee. Cached above for that reason. */
    private static function osrm(array $pts): ?array
    {
        $coords = implode(';', array_map(fn($p) => ((float) $p[1]) . ',' . ((float) $p[0]), $pts));
        $j = self::get('https://router.project-osrm.org/route/v1/driving/' . $coords . '?overview=full&geometries=geojson');
        $r = $j['routes'][0] ?? null; if (!$r) return null;
        return ['km' => round($r['distance'] / 1000, 2), 'minutes' => (int) round($r['duration'] / 60 * 1.25), 'coords' => $r['geometry']['coordinates'] ?? [], 'source' => 'osrm']; // x1.25: Abuja traffic, not free flow
    }
    private static function straight(array $pts): array
    {
        $km = 0; for ($i = 1; $i < count($pts); $i++) $km += WakaRules::km((float) $pts[$i - 1][0], (float) $pts[$i - 1][1], (float) $pts[$i][0], (float) $pts[$i][1]);
        $road = $km * WakaFares::ROAD_FACTOR;
        return ['km' => round($road, 2), 'minutes' => max(2, (int) round($road / 24 * 60)), 'coords' => array_map(fn($p) => [(float) $p[1], (float) $p[0]], $pts), 'source' => 'straight'];
    }
}

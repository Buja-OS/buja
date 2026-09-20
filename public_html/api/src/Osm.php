<?php
declare(strict_types=1);

/**
 * Real places from OpenStreetMap, via the free Overpass API. Used when Buja's own directory has nothing
 * useful for a question. Anything found is written into spots marked source = osm so it is searchable
 * afterwards, rated by residents, and correctable by a moderator. No key, no bill.
 */
final class Osm
{
    private const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
    /** Which OSM tags to ask for, per Buja category. */
    private const TAGS = [
        'food' => ['amenity' => ['restaurant', 'fast_food', 'cafe', 'food_court']],
        'lounge' => ['amenity' => ['bar', 'pub', 'biergarten']],
        'nightlife' => ['amenity' => ['nightclub']],
        'relax' => ['leisure' => ['park', 'garden', 'nature_reserve'], 'tourism' => ['viewpoint', 'picnic_site']],
        'shopping' => ['shop' => ['mall', 'supermarket', 'department_store'], 'amenity' => ['marketplace']],
        'kids' => ['leisure' => ['playground', 'water_park'], 'tourism' => ['theme_park']],
        'worship' => ['amenity' => ['place_of_worship']],
        'hotel' => ['tourism' => ['hotel', 'guest_house']],
        'culture' => ['tourism' => ['museum', 'gallery', 'attraction'], 'historic' => ['monument', 'memorial']],
        'services' => ['shop' => ['hairdresser', 'laundry', 'car_repair', 'mobile_phone'], 'amenity' => ['pharmacy', 'bank', 'hospital', 'fuel']],
    ];

    /** Finds up to $limit real places of a category near a point. Returns rows already saved to spots. */
    public static function nearby(string $category, float $lat, float $lng, int $radiusM = 6000, int $limit = 12): array
    {
        if (!isset(self::TAGS[$category])) return [];
        $clauses = '';
        foreach (self::TAGS[$category] as $key => $values) {
            $v = implode('|', $values);
            foreach (['node', 'way'] as $type) $clauses .= sprintf('%s["%s"~"^(%s)$"]["name"](around:%d,%F,%F);', $type, $key, $v, $radiusM, $lat, $lng);
        }
        $query = '[out:json][timeout:20];(' . $clauses . ');out center ' . ($limit * 3) . ';';
        $raw = null;
        foreach (self::ENDPOINTS as $url) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 22, CURLOPT_POSTFIELDS => 'data=' . rawurlencode($query), CURLOPT_USERAGENT => 'BujaApp/1.0 (Abuja city app; contact hello@buja.ng)']);
            $body = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
            if ($code === 200 && $body) { $raw = $body; break; }
            error_log('[buja osm] ' . $url . ' returned ' . $code);
        }
        if ($raw === null) return [];
        $els = json_decode($raw, true)['elements'] ?? [];
        $out = [];
        foreach ($els as $e) {
            $name = trim((string) ($e['tags']['name'] ?? '')); if ($name === '' || mb_strlen($name) > 70) continue;
            $plat = (float) ($e['lat'] ?? $e['center']['lat'] ?? 0); $plng = (float) ($e['lng'] ?? $e['lon'] ?? $e['center']['lon'] ?? 0);
            if (!$plat || !$plng) continue;
            $osmId = ($e['type'] ?? 'node') . '/' . ($e['id'] ?? '');
            $district = self::districtFor($plat, $plng);
            $existing = Db::one('SELECT * FROM spots WHERE osm_id = ? OR (name = ? AND district = ?)', [$osmId, $name, $district]);
            if ($existing) { if ((int) $existing['active']) $out[] = $existing; continue; }
            $t = $e['tags'];
            $desc = trim(implode(' · ', array_filter([
                $t['cuisine'] ?? null ? 'Serves ' . str_replace(';', ', ', $t['cuisine']) : null,
                $t['opening_hours'] ?? null ? null : null,
                $t['addr:street'] ?? null ? 'On ' . $t['addr:street'] : null,
                'Listed on OpenStreetMap, not yet reviewed by anyone on Buja.',
            ])));
            Db::run('INSERT INTO spots (name, category, district, area, tags, price_level, description, hours, lat, lng, source, osm_id, active, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?)',
                [$name, $category, $district, $t['addr:suburb'] ?? null, json_encode(array_values(array_filter([$t['cuisine'] ?? null, $t['amenity'] ?? null, $t['shop'] ?? null]))), 2, $desc, mb_substr((string) ($t['opening_hours'] ?? ''), 0, 60) ?: null, $plat, $plng, 'osm', $osmId, Db::now()]);
            $row = Db::one('SELECT * FROM spots WHERE id = ?', [Db::lastId()]);
            if ($row) $out[] = $row;
            if (count($out) >= $limit) break;
        }
        return $out;
    }

    /**
     * Which district a point is in. Buja's Waka stops are real surveyed points, so the nearest one is a
     * better answer than a district centroid; the centroids are only a fallback.
     */
    public static function districtFor(float $lat, float $lng): string
    {
        $best = null; $bestKm = 1e9;
        foreach (Db::pdo()->query('SELECT district, lat, lng FROM places WHERE active = 1')->fetchAll() as $p) {
            $km = WakaRules::km($lat, $lng, (float) $p['lat'], (float) $p['lng']);
            if ($km < $bestKm) { $bestKm = $km; $best = $p['district']; }
        }
        if ($best !== null && $bestKm < 4) return $best;
        foreach (HomesRules::CENTROID as $name => [$dlat, $dlng]) {
            $km = WakaRules::km($lat, $lng, $dlat, $dlng);
            if ($km < $bestKm) { $bestKm = $km; $best = $name; }
        }
        return $best ?? 'Abuja';
    }
}

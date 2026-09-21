<?php
declare(strict_types=1);

/**
 * Real places from OpenStreetMap, via the free Overpass API. Used when Buja's own directory has nothing
 * useful for a question. Anything found is written into spots marked source = osm so it is searchable
 * afterwards, rated by residents, and correctable by a moderator. No key, no bill.
 */
final class Osm
{
    private const ENDPOINTS = ['https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter'];
    private const UA = 'BujaApp/1.0 (Abuja city app; contact hello@buja.ng)';
    /** Plain words to search Nominatim with, when Overpass is unavailable. */
    private const WORDS = ['food' => 'restaurant', 'lounge' => 'bar', 'nightlife' => 'nightclub', 'relax' => 'park', 'shopping' => 'supermarket', 'kids' => 'playground', 'worship' => 'church', 'hotel' => 'hotel', 'culture' => 'museum', 'services' => 'pharmacy'];
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
        // Nobody should wait on a slow map server. Short timeouts, one retry, then a different source.
        $query = '[out:json][timeout:5];(' . $clauses . ');out center ' . ($limit * 3) . ';';
        $raw = null;
        foreach (self::ENDPOINTS as $url) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 6, CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_POSTFIELDS => 'data=' . rawurlencode($query), CURLOPT_USERAGENT => self::UA]);
            $body = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
            if ($code === 200 && $body) { $raw = $body; break; }
            error_log('[buja osm] overpass ' . parse_url($url, PHP_URL_HOST) . ' returned ' . $code);
        }
        $els = $raw !== null ? (json_decode($raw, true)['elements'] ?? []) : self::viaNominatim($category, $lat, $lng, $radiusM, $limit);
        if (!$els) return [];
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

    /** Second source: Nominatim free-text search, which is lighter than Overpass and usually up. */
    private static function viaNominatim(string $category, float $lat, float $lng, int $radiusM, int $limit): array
    {
        $word = self::WORDS[$category] ?? null; if (!$word) return [];
        $d = $radiusM / 111000;
        $url = 'https://nominatim.openstreetmap.org/search?' . http_build_query([
            'q' => $word, 'format' => 'jsonv2', 'limit' => $limit * 2, 'addressdetails' => 1, 'extratags' => 1,
            'viewbox' => ($lng - $d) . ',' . ($lat + $d) . ',' . ($lng + $d) . ',' . ($lat - $d), 'bounded' => 1,
        ]);
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 6, CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_USERAGENT => self::UA, CURLOPT_HTTPHEADER => ['Accept-Language: en']]);
        $body = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($code !== 200 || !$body) { error_log('[buja osm] nominatim returned ' . $code); return []; }
        $out = [];
        foreach ((json_decode($body, true) ?: []) as $r) {
            $name = trim((string) ($r['name'] ?? '')); if ($name === '') continue;
            $out[] = ['type' => $r['osm_type'] ?? 'node', 'id' => $r['osm_id'] ?? 0, 'lat' => (float) $r['lat'], 'lon' => (float) $r['lon'],
                'tags' => array_filter(['name' => $name, 'cuisine' => $r['extratags']['cuisine'] ?? null, 'opening_hours' => $r['extratags']['opening_hours'] ?? null, 'addr:street' => $r['address']['road'] ?? null, 'addr:suburb' => $r['address']['suburb'] ?? null])];
        }
        return $out;
    }

    /**
     * Which district a point is in. Buja's Waka stops are real surveyed points, so the nearest one is a
     * better answer than a district centroid; the centroids are only a fallback.
     */
    /** Imports every named place of a category across the city in one pass. Returns how many were new. */
    public static function importCategory(string $category, int $limit = 400): array
    {
        if (!isset(self::TAGS[$category])) return ['added' => 0, 'seen' => 0, 'error' => 'unknown category'];
        // The FCT's built-up area, roughly: Bwari and Kubwa in the north to Kuje and the airport in the south.
        $bbox = '8.85,7.15,9.25,7.65';
        $clauses = '';
        foreach (self::TAGS[$category] as $key => $values) { $v = implode('|', $values); foreach (['node', 'way'] as $type) $clauses .= sprintf('%s["%s"~"^(%s)$"]["name"](%s);', $type, $key, $v, $bbox); }
        $query = '[out:json][timeout:25];(' . $clauses . ');out center ' . $limit . ';';
        $raw = null; $err = '';
        foreach (self::ENDPOINTS as $url) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_POSTFIELDS => 'data=' . urlencode($query), CURLOPT_USERAGENT => self::UA]);
            $body = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
            if ($code === 200 && $body) { $raw = $body; break; }
            $err = 'overpass ' . parse_url($url, PHP_URL_HOST) . ' returned ' . $code;
        }
        if ($raw === null) return ['added' => 0, 'seen' => 0, 'error' => $err ?: 'no map server answered'];
        $els = json_decode($raw, true)['elements'] ?? [];
        $added = 0; $seen = 0;
        foreach ($els as $e) {
            $name = trim((string) ($e['tags']['name'] ?? '')); if ($name === '' || mb_strlen($name) > 70) continue;
            $plat = (float) ($e['lat'] ?? $e['center']['lat'] ?? 0); $plng = (float) ($e['lon'] ?? $e['center']['lon'] ?? 0);
            if (!$plat || !$plng) continue;
            $seen++;
            $osmId = ($e['type'] ?? 'node') . '/' . ($e['id'] ?? '');
            $district = self::districtFor($plat, $plng);
            if (Db::one('SELECT id FROM spots WHERE osm_id = ? OR (name = ? AND district = ?)', [$osmId, $name, $district])) continue;
            $t = $e['tags'];
            $desc = trim(implode('. ', array_filter([$t['cuisine'] ? 'Serves ' . str_replace([';', '_'], [', ', ' '], (string) $t['cuisine']) : null, $t['addr:street'] ?? null, $t['phone'] ?? $t['contact:phone'] ?? null])));
            Db::run('INSERT INTO spots (name, category, district, area, tags, price_level, description, hours, lat, lng, source, osm_id, active, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?)',
                [$name, $category, $district, $t['addr:street'] ?? null, json_encode(array_values(array_filter([$t['cuisine'] ?? null, $t['amenity'] ?? $t['shop'] ?? $t['leisure'] ?? $t['tourism'] ?? null]))), 2,
                 mb_substr($desc !== '' ? $desc : 'Found on OpenStreetMap. Nobody on Buja has reviewed it yet.', 0, 400), isset($t['opening_hours']) ? mb_substr((string) $t['opening_hours'], 0, 60) : null, $plat, $plng, 'osm', $osmId, Db::now()]);
            $added++;
        }
        return ['added' => $added, 'seen' => $seen, 'error' => null];
    }

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

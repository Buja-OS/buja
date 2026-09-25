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
    private const WORDS = ['food' => 'restaurant', 'lounge' => 'bar', 'nightlife' => 'nightclub', 'relax' => 'park', 'shopping' => 'supermarket', 'kids' => 'playground', 'worship' => 'church', 'hotel' => 'hotel', 'culture' => 'museum', 'services' => 'bank', 'health' => 'hospital'];
    /** Which OSM tags to ask for, per Buja category. */
    private const TAGS = [
        'food' => ['amenity' => ['restaurant', 'fast_food', 'cafe', 'food_court', 'ice_cream'], 'shop' => ['bakery']],
        'lounge' => ['amenity' => ['bar', 'pub', 'biergarten']],   // plus anything with "lounge" in its name (see LOUNGE_NAMES)
        'nightlife' => ['amenity' => ['nightclub']],
        'relax' => ['leisure' => ['park', 'garden', 'nature_reserve'], 'tourism' => ['viewpoint', 'picnic_site']],
        'shopping' => ['shop' => ['mall', 'supermarket', 'department_store'], 'amenity' => ['marketplace']],
        'kids' => ['leisure' => ['playground', 'water_park'], 'tourism' => ['theme_park']],
        'worship' => ['amenity' => ['place_of_worship']],
        'hotel' => ['tourism' => ['hotel', 'guest_house']],
        'culture' => ['tourism' => ['museum', 'gallery', 'attraction'], 'historic' => ['monument', 'memorial']],
        'services' => ['shop' => ['hairdresser', 'beauty', 'laundry', 'dry_cleaning', 'car_repair', 'mobile_phone', 'tailor'], 'amenity' => ['bank', 'fuel', 'car_wash']],
        'health' => ['amenity' => ['hospital', 'clinic', 'doctors', 'pharmacy', 'dentist'], 'healthcare' => ['hospital', 'clinic', 'laboratory']],
    ];
    /** Every category the city-wide import walks through, one per run. */
    public const IMPORT_ORDER = ['food', 'lounge', 'worship', 'health', 'hotel', 'shopping', 'relax', 'nightlife', 'culture', 'kids', 'services'];

    /** The finer kind of place, from its OSM tags: church or mosque, hospital or pharmacy, restaurant or fast food. */
    public static function subtype(array $t): ?string
    {
        if (($t['amenity'] ?? '') === 'place_of_worship') { $r = strtolower((string) ($t['religion'] ?? '')); return $r === 'christian' ? 'church' : ($r === 'muslim' ? 'mosque' : 'worship'); }
        if (preg_match('/lounge/i', (string) ($t['name'] ?? '')) && in_array($t['amenity'] ?? '', ['bar', 'pub', 'restaurant', 'nightclub', 'cafe', 'biergarten'], true)) return 'lounge';
        foreach (['amenity', 'healthcare', 'shop', 'tourism', 'leisure', 'historic'] as $k) if (!empty($t[$k])) return mb_substr((string) $t[$k], 0, 30);
        return null;
    }

    /**
     * Saves one OSM element as a place, or fills in details an older copy lacked (phone, website, photo links).
     * Returns [row, isNew] or null when it has no name or position.
     */
    public static function save(array $e, string $category): ?array
    {
        $t = $e['tags'] ?? [];
        $name = trim((string) ($t['name'] ?? '')); if ($name === '' || mb_strlen($name) > 70) return null;
        $plat = (float) ($e['lat'] ?? $e['center']['lat'] ?? 0); $plng = (float) ($e['lon'] ?? $e['lng'] ?? $e['center']['lon'] ?? 0);
        if (!$plat || !$plng) return null;
        $osmId = ($e['type'] ?? 'node') . '/' . ($e['id'] ?? '');
        $district = self::districtFor($plat, $plng);
        $phone = $t['phone'] ?? $t['contact:phone'] ?? null; $web = $t['website'] ?? $t['contact:website'] ?? null;
        $wd = isset($t['wikidata']) && preg_match('/^Q\d{1,12}$/', (string) $t['wikidata']) ? (string) $t['wikidata'] : null;
        $commons = isset($t['wikimedia_commons']) && str_starts_with((string) $t['wikimedia_commons'], 'File:') ? mb_substr((string) $t['wikimedia_commons'], 0, 200) : null;
        $notable = $wd || !empty($t['wikipedia']) ? 1 : 0;
        $extra = ['subtype' => self::subtype($t), 'religion' => isset($t['religion']) ? mb_substr((string) $t['religion'], 0, 20) : null, 'phone' => $phone ? mb_substr((string) $phone, 0, 40) : null,
            'website' => $web && preg_match('#^https?://#i', (string) $web) ? mb_substr((string) $web, 0, 200) : null, 'wikidata' => $wd, 'commons' => $commons, 'notable' => $notable];
        $existing = Db::one('SELECT * FROM spots WHERE osm_id = ? OR (name = ? AND district = ?)', [$osmId, $name, $district]);
        if ($existing) {
            // fill only what is missing; never overwrite what a moderator or resident corrected
            $sets = []; $p = [];
            foreach ($extra as $col => $v) if ($v !== null && $v !== 0 && array_key_exists($col, $existing) && ($existing[$col] === null || $existing[$col] === '' || ($col === 'notable' && !(int) $existing[$col]))) { $sets[] = "$col = ?"; $p[] = $v; }
            if ($sets) { try { $p[] = $existing['id']; Db::run('UPDATE spots SET ' . implode(', ', $sets) . ' WHERE id = ?', $p); } catch (Throwable $ex) {} }
            return [$existing, false];
        }
        $cuisine = isset($t['cuisine']) ? str_replace([';', '_'], [', ', ' '], (string) $t['cuisine']) : null;
        $desc = trim(implode('. ', array_filter([$cuisine ? 'Serves ' . $cuisine : null, $t['addr:street'] ?? null, isset($t['denomination']) ? ucfirst(str_replace('_', ' ', (string) $t['denomination'])) : null])));
        $tags = array_values(array_unique(array_filter([$t['cuisine'] ?? null, $extra['subtype'], $t['amenity'] ?? $t['shop'] ?? $t['leisure'] ?? $t['tourism'] ?? null])));
        $cols = ['name' => $name, 'category' => $category, 'district' => $district, 'area' => $t['addr:street'] ?? ($t['addr:suburb'] ?? null), 'tags' => json_encode($tags), 'price_level' => 2,
            'description' => mb_substr($desc !== '' ? $desc . '. Listed on OpenStreetMap; not yet reviewed on Buja.' : 'Listed on OpenStreetMap; not yet reviewed on Buja.', 0, 400),
            'hours' => isset($t['opening_hours']) ? mb_substr((string) $t['opening_hours'], 0, 60) : null, 'lat' => $plat, 'lng' => $plng, 'source' => 'osm', 'osm_id' => $osmId, 'active' => 1, 'created_at' => Db::now()];
        try { $all = $cols + $extra; Db::run('INSERT INTO spots (' . implode(', ', array_keys($all)) . ') VALUES (' . implode(',', array_fill(0, count($all), '?')) . ')', array_values($all)); }
        catch (Throwable $ex) { Db::run('INSERT INTO spots (' . implode(', ', array_keys($cols)) . ') VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')', array_values($cols)); }   // before migration 043
        $row = Db::one('SELECT * FROM spots WHERE id = ?', [Db::lastId()]);
        return $row ? [$row, true] : null;
    }

    /** Overpass clauses for a category, around a point or inside a box. */
    private static function clauses(string $category, string $area): string
    {
        $c = '';
        foreach (self::TAGS[$category] as $key => $values) { $v = implode('|', $values); foreach (['node', 'way'] as $type) $c .= sprintf('%s["%s"~"^(%s)$"]["name"](%s);', $type, $key, $v, $area); }
        if ($category === 'lounge') foreach (['node', 'way'] as $type) $c .= sprintf('%s["name"~"lounge",i]["amenity"~"^(restaurant|bar|pub|nightclub|cafe)$"](%s);', $type, $area);
        return $c;
    }

    /** Finds up to $limit real places of a category near a point. Returns rows already saved to spots. */
    public static function nearby(string $category, float $lat, float $lng, int $radiusM = 6000, int $limit = 12): array
    {
        if (!isset(self::TAGS[$category])) return [];
        $clauses = self::clauses($category, sprintf('around:%d,%F,%F', $radiusM, $lat, $lng));
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
            $r = self::save($e, $category); if (!$r) continue;
            if ((int) $r[0]['active']) $out[] = $r[0];
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

    /** Imports every named place of a category across the city in one pass. Returns how many were new. */
    public static function importCategory(string $category, int $limit = 3000): array
    {
        if (!isset(self::TAGS[$category])) return ['added' => 0, 'seen' => 0, 'error' => 'unknown category'];
        // The FCT's built-up area, roughly: Bwari and Kubwa in the north to Kuje and the airport in the south.
        $query = '[out:json][timeout:25];(' . self::clauses($category, '8.85,7.15,9.25,7.65') . ');out center ' . $limit . ';';
        $raw = null; $err = '';
        foreach (self::ENDPOINTS as $url) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_POSTFIELDS => 'data=' . urlencode($query), CURLOPT_USERAGENT => self::UA]);
            $body = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
            if ($code === 200 && $body) { $raw = $body; break; }
            $err = 'overpass ' . parse_url($url, PHP_URL_HOST) . ' returned ' . $code;
        }
        if ($raw === null) return ['added' => 0, 'seen' => 0, 'error' => $err ?: 'no map server answered'];
        return self::saveAll(json_decode($raw, true)['elements'] ?? [], $category);
    }

    /** Saves a batch of OSM elements; returns counts. Split out so it can be tested without a network. */
    public static function saveAll(array $els, string $category): array
    {
        $added = 0; $seen = 0;
        foreach ($els as $e) { $r = self::save($e, $category); if (!$r) continue; $seen++; if ($r[1]) $added++; }
        return ['added' => $added, 'seen' => $seen, 'error' => null];
    }

    /** Every fuel station in the FCT, for the fuel board. */
    public static function importFuelStations(): array
    {
        $query = '[out:json][timeout:25];(node["amenity"="fuel"](8.85,7.15,9.25,7.65);way["amenity"="fuel"](8.85,7.15,9.25,7.65););out center 600;';
        $raw = null; $err = '';
        foreach (self::ENDPOINTS as $url) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_POSTFIELDS => 'data=' . urlencode($query), CURLOPT_USERAGENT => self::UA]);
            $body = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
            if ($code === 200 && $body) { $raw = $body; break; }
            $err = 'overpass returned ' . $code;
        }
        if ($raw === null) return ['added' => 0, 'seen' => 0, 'error' => $err ?: 'no map server answered'];
        $added = 0; $seen = 0;
        foreach (json_decode($raw, true)['elements'] ?? [] as $e) {
            $plat = (float) ($e['lat'] ?? $e['center']['lat'] ?? 0); $plng = (float) ($e['lon'] ?? $e['center']['lon'] ?? 0); if (!$plat || !$plng) continue;
            $seen++; $t = $e['tags'] ?? []; $osmId = ($e['type'] ?? 'node') . '/' . ($e['id'] ?? '');
            if (Db::one('SELECT id FROM fuel_stations WHERE osm_id = ?', [$osmId])) continue;
            $brand = $t['brand'] ?? $t['operator'] ?? null;
            $name = trim((string) ($t['name'] ?? '')) ?: (($brand ?: 'Filling station') . ($t['addr:street'] ? ', ' . $t['addr:street'] : ''));
            Db::run('INSERT INTO fuel_stations (name, brand, district, lat, lng, osm_id, created_at) VALUES (?,?,?,?,?,?,?)', [mb_substr($name, 0, 90), $brand ? mb_substr((string) $brand, 0, 40) : null, self::districtFor($plat, $plng) ?: 'Abuja', $plat, $plng, $osmId, Db::now()]);
            $added++;
        }
        return ['added' => $added, 'seen' => $seen, 'error' => null];
    }

    /**
     * Which district a point is in. Buja's Waka stops are real surveyed points, so the nearest one is a
     * better answer than a district centroid; the centroids are only a fallback.
     */
    public static function districtFor(float $lat, float $lng): string
    {
        static $stops = null;
        if ($stops === null) $stops = Db::pdo()->query('SELECT district, lat, lng FROM places WHERE active = 1')->fetchAll();
        $best = null; $bestKm = 1e9;
        foreach ($stops as $p) {
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

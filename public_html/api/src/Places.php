<?php
declare(strict_types=1);

/**
 * The places directory's slow work, done a little at a time by the hourly scheduler (never while someone waits):
 *  - import every named place of one category across the FCT from OpenStreetMap (a different category each run),
 *  - find a real photo for places that lack one, from Wikimedia Commons, and credit the photographer.
 *
 * A photo is only attached when we are sure it shows that place: the place's own Wikidata or Commons link, or a
 * geotagged Commons photo taken within 120 m whose title names the place. Otherwise the card shows the map, and
 * says so. Opening hours in OpenStreetMap's format are read here too, so "open now" is only ever said when known.
 */
final class Places
{
    private const UA = 'BujaApp/1.0 (Abuja city app; hello@buja.ng)';
    /** Words that say what a place is but not which one; they never count as a name match on their own. */
    private const GENERIC = ['the', 'and', 'of', 'abuja', 'fct', 'nigeria', 'plc', 'ltd', 'limited', 'restaurant', 'restaurants', 'hotel', 'hotels', 'suites', 'lounge', 'bar', 'club', 'church', 'mosque', 'masjid', 'hospital', 'clinic', 'pharmacy', 'market', 'plaza', 'mall', 'shop', 'store', 'stores', 'centre', 'center', 'park', 'garden', 'gardens', 'kitchen', 'cafe', 'jpg', 'jpeg', 'png', 'file', 'view', 'front', 'entrance', 'building', 'img', 'dsc', 'photo', 'international', 'national', 'general', 'district', 'road', 'street', 'way'];

    /** Kinds of place: if the place's name has one, a matching photo's title must too (or a synonym). */
    private const KINDS = ['mall' => ['shopping'], 'hotel' => ['suites'], 'church' => ['cathedral', 'chapel', 'parish'], 'mosque' => ['masjid', 'jumma'], 'hospital' => [], 'clinic' => ['medical'], 'pharmacy' => ['chemist'], 'market' => [], 'park' => ['garden'], 'restaurant' => ['eatery'], 'lounge' => [], 'stadium' => ['arena'], 'museum' => [], 'gallery' => [], 'plaza' => [], 'school' => ['college'], 'university' => ['campus']];

    /** @var callable|null A stand-in for the network in tests: fn(string $url): ?string */
    public static $http = null;

    private static function get(string $url, int $timeout = 6): ?string
    {
        if (self::$http) return (self::$http)($url);
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_USERAGENT => self::UA, CURLOPT_FOLLOWLOCATION => true]);
        $body = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        return $code === 200 && is_string($body) ? $body : null;
    }

    /* ------------------------------------------------ photos ------------------------------------------------ */

    /** The distinctive words of a name: "Transcorp Hilton Abuja" -> [transcorp, hilton]. */
    public static function words(string $s): array
    {
        $s = mb_strtolower(preg_replace('/\.(jpe?g|png|gif|webp|tiff?)$/i', '', $s));
        $w = preg_split('/[^\p{L}\p{N}]+/u', $s, -1, PREG_SPLIT_NO_EMPTY);
        return array_values(array_unique(array_filter($w, fn($x) => mb_strlen($x) >= 3 && !in_array($x, self::GENERIC, true) && !preg_match('/^\d+$/', $x))));
    }

    /** Does a photo's file title name this place? Two distinctive words, or the only one when it is long enough. */
    public static function titleMatches(string $placeName, string $fileTitle): bool
    {
        $need = self::words($placeName); if (!$need) return false;
        $have = self::words(preg_replace('/^File:/i', '', $fileTitle));
        $hit = count(array_intersect($need, $have));
        if (!(count($need) === 1 ? ($hit === 1 && mb_strlen($need[0]) >= 5) : $hit >= 2)) return false;
        // "Jabi Lake Mall" must not take a photo of Jabi Lake: when the name says what kind of place it is, so must the photo
        $pn = mb_strtolower($placeName); $ft = mb_strtolower($fileTitle);
        foreach (self::KINDS as $kind => $alts) if (preg_match('/\b' . $kind . '\b/u', $pn)) { $seen = false; foreach (array_merge([$kind], $alts) as $k) if (preg_match('/\b' . $k . '/u', $ft)) $seen = true; if (!$seen) return false; }
        return true;
    }

    /** Thumbnail URL and credit for a Commons file, or null. */
    public static function commonsInfo(string $file): ?array
    {
        $title = str_starts_with($file, 'File:') ? $file : 'File:' . $file;
        $raw = self::get('https://commons.wikimedia.org/w/api.php?' . http_build_query(['action' => 'query', 'titles' => $title, 'prop' => 'imageinfo', 'iiprop' => 'url|extmetadata|mime', 'iiurlwidth' => 640, 'format' => 'json']));
        $j = $raw ? json_decode($raw, true) : null;
        foreach ((array) ($j['query']['pages'] ?? []) as $pg) {
            $ii = $pg['imageinfo'][0] ?? null; if (!$ii) continue;
            if (!preg_match('#^image/(jpeg|png|webp)$#', (string) ($ii['mime'] ?? ''))) return null;   // no drawings, maps or PDFs
            $url = (string) ($ii['thumburl'] ?? $ii['url'] ?? ''); if (!str_starts_with($url, 'https://upload.wikimedia.org/')) return null;
            $m = $ii['extmetadata'] ?? [];
            $artist = trim(html_entity_decode(strip_tags((string) ($m['Artist']['value'] ?? '')), ENT_QUOTES)); $lic = trim((string) ($m['LicenseShortName']['value'] ?? ''));
            $credit = 'Photo: ' . ($artist !== '' ? mb_substr($artist, 0, 60) : 'Wikimedia Commons') . ($lic !== '' ? ', ' . mb_substr($lic, 0, 30) : '') . ' (Wikimedia Commons)';
            return ['url' => $url, 'credit' => mb_substr($credit, 0, 160)];
        }
        return null;
    }

    /** A real photo for one place, or null when none can be matched with confidence. */
    public static function photoFor(array $s): ?array
    {
        // 1. the place's own Commons photo, named in OpenStreetMap
        if (!empty($s['commons'])) { $i = self::commonsInfo((string) $s['commons']); if ($i) return $i; }
        // 2. the image on its Wikidata entry
        if (!empty($s['wikidata'])) {
            $raw = self::get('https://www.wikidata.org/wiki/Special:EntityData/' . rawurlencode((string) $s['wikidata']) . '.json');
            $j = $raw ? json_decode($raw, true) : null;
            $file = $j['entities'][$s['wikidata']]['claims']['P18'][0]['mainsnak']['datavalue']['value'] ?? null;
            if (is_string($file) && $file !== '') { $i = self::commonsInfo($file); if ($i) return $i; }
        }
        // 3. a geotagged Commons photo taken right there, whose title names the place
        if ($s['lat'] === null || $s['lng'] === null) return null;
        $raw = self::get('https://commons.wikimedia.org/w/api.php?' . http_build_query(['action' => 'query', 'list' => 'geosearch', 'gscoord' => $s['lat'] . '|' . $s['lng'], 'gsradius' => 120, 'gslimit' => 40, 'gsnamespace' => 6, 'format' => 'json']));
        $j = $raw ? json_decode($raw, true) : null;
        $hits = array_values(array_filter((array) ($j['query']['geosearch'] ?? []), fn($g) => ($g['dist'] ?? 999) <= 120 && self::titleMatches((string) $s['name'], (string) ($g['title'] ?? ''))));
        usort($hits, fn($a, $b) => ($a['dist'] ?? 999) <=> ($b['dist'] ?? 999));
        foreach (array_slice($hits, 0, 2) as $g) { $i = self::commonsInfo((string) $g['title']); if ($i) return $i; }
        return null;
    }

    /** Looks for photos for up to $max places that have never been checked (famous places first). Bounded by time. */
    public static function photoBatch(int $max = 30, float $budget = 18.0): array
    {
        $t0 = microtime(true); $found = 0; $checked = 0;
        try { $st = Db::pdo()->prepare("SELECT * FROM spots WHERE active = 1 AND photo_checked_at IS NULL AND lat IS NOT NULL ORDER BY notable DESC, (wikidata IS NOT NULL OR commons IS NOT NULL) DESC, id ASC LIMIT " . (int) $max); $st->execute(); $rows = $st->fetchAll(); }
        catch (Throwable $e) { return ['checked' => 0, 'found' => 0, 'error' => 'run migration 043']; }
        foreach ($rows as $s) {
            if (microtime(true) - $t0 > $budget) break;
            $p = null; try { $p = self::photoFor($s); } catch (Throwable $e) {}
            Db::run('UPDATE spots SET photo_checked_at = ?, photo_url = COALESCE(photo_url, ?), photo_credit = COALESCE(photo_credit, ?) WHERE id = ?', [Db::now(), $p['url'] ?? null, $p['credit'] ?? null, $s['id']]);
            $checked++; if ($p) $found++;
        }
        return ['checked' => $checked, 'found' => $found];
    }

    /** One step of the directory's upkeep, for the hourly scheduler: import one category if due, then photos. */
    public static function step(): array
    {
        $out = [];
        $last = Db::one("SELECT v FROM app_keys WHERE k = 'places_import_at'");
        if (!$last || strtotime((string) $last['v'] . ' UTC') < time() - 3 * 3600) {
            $i = Db::one("SELECT v FROM app_keys WHERE k = 'places_import_i'"); $n = $i ? (int) $i['v'] : 0;
            $cat = Osm::IMPORT_ORDER[$n % count(Osm::IMPORT_ORDER)];
            foreach ([['places_import_at', Db::now()], ['places_import_i', (string) ($n + 1)]] as [$k, $v]) { Db::run('DELETE FROM app_keys WHERE k = ?', [$k]); Db::run('INSERT INTO app_keys (k, v) VALUES (?,?)', [$k, $v]); }
            try { $out['import'] = ['category' => $cat] + Osm::importCategory($cat); } catch (Throwable $e) { $out['import'] = ['category' => $cat, 'error' => $e->getMessage()]; }
            $out['photos'] = self::photoBatch(10, 6.0);
        } else $out['photos'] = self::photoBatch(40, 20.0);
        return $out;
    }

    /* -------------------------------------------- opening hours -------------------------------------------- */

    /**
     * Is it open at $when (Abuja time)? Reads the common OpenStreetMap forms: "24/7", "Mo-Su 08:00-22:00",
     * "Mo-Fr 09:00-17:00; Sa 10:00-14:00", "18:00-02:00", "Su off". Returns ['open' => bool, 'until' => 'HH:MM'|null]
     * or null when the hours are missing or written in a way we cannot read for certain.
     */
    public static function openAt(?string $hours, ?DateTimeInterface $when = null): ?array
    {
        $h = trim((string) $hours); if ($h === '') return null;
        $when = $when ?? new DateTime('now', new DateTimeZone('Africa/Lagos'));
        if (preg_match('#^24/7$#', $h)) return ['open' => true, 'until' => null, 'allDay' => true];
        $days = ['mo' => 1, 'tu' => 2, 'we' => 3, 'th' => 4, 'fr' => 5, 'sa' => 6, 'su' => 7];
        $today = (int) $when->format('N'); $yday = $today === 1 ? 7 : $today - 1; $mins = (int) $when->format('G') * 60 + (int) $when->format('i');
        $rules = []; // day => list of [from, to] in minutes, or 'off'
        foreach (preg_split('/\s*;\s*/', $h) as $part) {
            if ($part === '') continue;
            if (!preg_match('/^(?:((?:[A-Za-z]{2}(?:-[A-Za-z]{2})?)(?:,[A-Za-z]{2}(?:-[A-Za-z]{2})?)*)\s+)?(off|closed|(?:\d{1,2}:\d{2}-\d{1,2}:\d{2}(?:,\s*\d{1,2}:\d{2}-\d{1,2}:\d{2})*))$/i', trim($part), $m)) return null;   // PH, weeks, months: not sure, say nothing
            $ds = [];
            if ($m[1] === '') $ds = range(1, 7);
            else foreach (explode(',', strtolower($m[1])) as $r) {
                $ab = explode('-', $r); if (!isset($days[$ab[0]]) || (isset($ab[1]) && !isset($days[$ab[1]]))) return null;
                $a = $days[$ab[0]]; $b = isset($ab[1]) ? $days[$ab[1]] : $a;
                for ($d = $a; ; $d = $d % 7 + 1) { $ds[] = $d; if ($d === $b) break; }
            }
            $spans = [];
            if (!preg_match('/^(off|closed)$/i', $m[2])) foreach (preg_split('/,\s*/', $m[2]) as $sp) { [$f, $t] = explode('-', $sp); [$fh, $fm] = array_map('intval', explode(':', $f)); [$th, $tm] = array_map('intval', explode(':', $t)); $spans[] = [$fh * 60 + $fm, $th * 60 + $tm]; }
            foreach ($ds as $d) $rules[$d] = $spans ?: 'off';   // later rules win, as in OSM
        }
        $fmt = fn($x) => sprintf('%02d:%02d', intdiv($x % 1440, 60), $x % 60);
        foreach ((is_array($rules[$today] ?? null) ? $rules[$today] : []) as [$f, $t]) {
            if ($t > $f && $mins >= $f && $mins < $t) return ['open' => true, 'until' => $fmt($t)];
            if ($t <= $f && $mins >= $f) return ['open' => true, 'until' => $fmt($t)];   // runs past midnight
        }
        foreach ((is_array($rules[$yday] ?? null) ? $rules[$yday] : []) as [$f, $t]) if ($t <= $f && $mins < $t) return ['open' => true, 'until' => $fmt($t)];   // last night's hours still going
        if (!$rules) return null;   // days not listed are closed, as OpenStreetMap intends
        $next = null; foreach ((is_array($rules[$today] ?? null) ? $rules[$today] : []) as [$f, $t]) if ($f > $mins && ($next === null || $f < $next)) $next = $f;
        return ['open' => false, 'until' => null, 'opens' => $next !== null ? $fmt($next) : null];
    }
}

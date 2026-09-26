<?php
declare(strict_types=1);

/** Ask Buja: a guide to the city grounded on the spots table. The model ranks and explains; it never invents a place. */
final class AskController
{
    public const CATEGORIES = ['food' => 'Food', 'lounge' => 'Lounge & bar', 'relax' => 'Relax & outdoors', 'nightlife' => 'Nightlife', 'shopping' => 'Shopping', 'kids' => 'Kids & family', 'worship' => 'Worship', 'health' => 'Hospitals & health', 'services' => 'Services', 'hotel' => 'Hotel', 'culture' => 'Culture & sights'];
    /** What kind of place, from its map tags, in plain words. */
    public const KIND = ['church' => 'Church', 'mosque' => 'Mosque', 'worship' => 'Place of worship', 'hospital' => 'Hospital', 'clinic' => 'Clinic', 'doctors' => 'Doctor', 'pharmacy' => 'Pharmacy', 'dentist' => 'Dentist', 'laboratory' => 'Laboratory',
        'restaurant' => 'Restaurant', 'fast_food' => 'Fast food', 'cafe' => 'Café', 'food_court' => 'Food court', 'ice_cream' => 'Ice cream', 'bakery' => 'Bakery', 'bar' => 'Bar', 'pub' => 'Pub', 'lounge' => 'Lounge', 'nightclub' => 'Nightclub', 'biergarten' => 'Beer garden',
        'hotel' => 'Hotel', 'guest_house' => 'Guest house', 'mall' => 'Mall', 'supermarket' => 'Supermarket', 'department_store' => 'Store', 'marketplace' => 'Market', 'park' => 'Park', 'garden' => 'Garden', 'nature_reserve' => 'Nature reserve', 'viewpoint' => 'Viewpoint', 'picnic_site' => 'Picnic site',
        'playground' => 'Playground', 'water_park' => 'Water park', 'theme_park' => 'Theme park', 'museum' => 'Museum', 'gallery' => 'Gallery', 'attraction' => 'Attraction', 'monument' => 'Monument', 'memorial' => 'Memorial',
        'bank' => 'Bank', 'fuel' => 'Fuel station', 'car_wash' => 'Car wash', 'hairdresser' => 'Salon', 'beauty' => 'Beauty', 'laundry' => 'Laundry', 'dry_cleaning' => 'Dry cleaner', 'car_repair' => 'Mechanic', 'mobile_phone' => 'Phone shop', 'tailor' => 'Tailor'];
    /**
     * Dishes and specific wants, and the words that honestly mean a place serves them. Used to rank places that
     * name the thing first, and to say plainly when none nearby does.
     */
    private const DISHES = ['suya' => ['suya', 'grill', 'barbecue', 'bbq', 'kebab', 'asun', 'kilishi'], 'shawarma' => ['shawarma', 'kebab'], 'pizza' => ['pizza'], 'chicken' => ['chicken', 'kfc'],
        'amala' => ['amala', 'buka', 'yoruba', 'swallow'], 'pepper soup' => ['pepper soup', 'point and kill', 'fish'], 'coffee' => ['coffee', 'cafe', 'café', 'espresso'], 'cake' => ['cake', 'bakery', 'pastry'], 'bread' => ['bread', 'bakery'],
        'jollof' => ['jollof', 'nigerian', 'african', 'local'], 'burger' => ['burger'], 'ice cream' => ['ice cream', 'gelato'], 'chinese' => ['chinese'], 'indian' => ['indian'], 'lebanese' => ['lebanese', 'shawarma'], 'fish' => ['fish', 'seafood'], 'shisha' => ['shisha', 'hookah', 'lounge'],
        'pharmacy' => ['pharmacy', 'chemist'], 'hospital' => ['hospital'], 'clinic' => ['clinic', 'medical'], 'church' => ['church', 'cathedral', 'chapel', 'parish', 'christian'], 'mosque' => ['mosque', 'masjid', 'muslim', 'islamic']];
    public const PRICE = [1 => 'Budget', 2 => 'Moderate', 3 => 'Pricey', 4 => 'Premium'];

    private function spot(array $s, ?array $u = null): array
    {
        $r = Db::one('SELECT COUNT(*) AS n, AVG(stars) AS avg FROM spot_ratings WHERE spot_id = ?', [$s['id']]);
        $out = ['id' => (int) $s['id'], 'name' => $s['name'], 'category' => $s['category'], 'categoryLabel' => self::CATEGORIES[$s['category']] ?? $s['category'], 'district' => $s['district'], 'area' => $s['area'], 'tags' => json_decode($s['tags'] ?? '[]', true) ?: [], 'priceLevel' => in_array($s['source'] ?? 'buja', ['osm', 'overture'], true) ? null : (int) $s['price_level'], 'priceLabel' => in_array($s['source'] ?? 'buja', ['osm', 'overture'], true) ? '' : (self::PRICE[(int) $s['price_level']] ?? ''), 'priceNote' => $s['price_note'], 'description' => $s['description'], 'hours' => $s['hours'], 'verified' => $s['verified_at'] !== null, 'source' => $s['source'] ?? 'buja', 'lat' => $s['lat'] !== null ? (float) $s['lat'] : null, 'lng' => $s['lng'] !== null ? (float) $s['lng'] : null, 'thumb' => $this->thumb($s), 'photos' => $this->photos((int) $s['id']), 'away' => $this->away($s, $u), 'rating' => $r && $r['n'] ? round((float) $r['avg'], 1) : null, 'ratings' => (int) ($r['n'] ?? 0), 'wakaTo' => $s['district'],
            'kind' => self::KIND[$s['subtype'] ?? ''] ?? (self::CATEGORIES[$s['category']] ?? $s['category']),
            'photo' => !empty($s['photo_url']) ? ['url' => $s['photo_url'], 'credit' => $s['photo_credit'] ?? 'Wikimedia Commons'] : null,
            'open' => Places::openAt($s['hours'] ?? null), 'phone' => $s['phone'] ?? null, 'website' => $s['website'] ?? null, 'notable' => (bool) ($s['notable'] ?? false)];
        if ($out['away'] !== null) { $road = $out['away'] * WakaFares::ROAD_FACTOR; $out['driveMin'] = max(2, (int) round($road / 22 * 60)); if ($road <= 2.5) $out['walkMin'] = max(1, (int) round($road / 4.8 * 60)); }
        if ($u) $out['myRating'] = (int) (Db::one('SELECT stars FROM spot_ratings WHERE spot_id = ? AND user_id = ?', [$s['id'], $u['id']])['stars'] ?? 0);
        return $out;
    }
    private function directory(): array
    {
        return Db::pdo()->query("SELECT * FROM spots WHERE active = 1 ORDER BY id")->fetchAll();
    }

    /** Photographs residents have added to this place. */
    private function photos(int $spotId): array
    {
        $st = Db::pdo()->prepare('SELECT id, upload_id FROM spot_photos WHERE spot_id = ? AND hidden_at IS NULL ORDER BY id LIMIT 8');
        $st->execute([$spotId]);
        return array_map(fn($p) => ['id' => (int) $p['id'], 'url' => '/api/uploads/' . (int) $p['upload_id']], $st->fetchAll());
    }

    /** POST /spots/{id}/photos { uploadId } */
    public function addPhoto(int $id): void
    {
        $u = Auth::require(); RateLimit::hit('spotphoto', 20, 86400);
        if (!Db::one('SELECT id FROM spots WHERE id = ? AND active = 1', [$id])) Http::json(['error' => 'not_found'], 404);
        if ((int) (Db::one('SELECT COUNT(*) AS n FROM spot_photos WHERE spot_id = ? AND hidden_at IS NULL', [$id])['n'] ?? 0) >= 8) Http::json(['error' => 'validation', 'message' => 'This place already has eight photos.'], 422);
        if ((int) (Db::one('SELECT COUNT(*) AS n FROM spot_photos WHERE spot_id = ? AND user_id = ? AND hidden_at IS NULL', [$id, $u['id']])['n'] ?? 0) >= 3) Http::json(['error' => 'validation', 'message' => 'You have added three photos here already.'], 422);
        $upload = UploadsController::claim((int) (Http::body()['uploadId'] ?? 0), $u);
        Db::run('INSERT INTO spot_photos (spot_id, upload_id, user_id, created_at) VALUES (?,?,?,?)', [$id, $upload, $u['id'], Db::now()]);
        Track::hit($u, 'ask', 'photo');
        Http::json(['photos' => $this->photos($id)], 201);
    }

    /** DELETE /spots/photos/{id} : whoever added it, or a moderator */
    public function removePhoto(int $id): void
    {
        $u = Auth::require();
        $p = Db::one('SELECT * FROM spot_photos WHERE id = ?', [$id]); if (!$p) Http::json(['error' => 'not_found'], 404);
        $staff = in_array($u['role'] ?? '', ['admin', 'moderator'], true) || !empty($u['is_admin']);
        if ((int) $p['user_id'] !== (int) $u['id'] && !$staff) Http::json(['error' => 'forbidden', 'message' => 'Only the person who added that photo can remove it.'], 403);
        Db::run('UPDATE spot_photos SET hidden_at = ? WHERE id = ?', [Db::now(), $id]);
        Http::json(['photos' => $this->photos((int) $p['spot_id'])]);
    }

    /**
     * A thumbnail for a place: the map tile it sits on, with the exact spot's position inside that tile so
     * the card can centre it. Free, works for every place with coordinates, and honest about being a map.
     */
    private function thumb(array $s): ?array
    {
        if ($s['lat'] === null || $s['lng'] === null) return null;
        $lat = (float) $s['lat']; $lng = (float) $s['lng']; $z = 16; $n = 2 ** $z;
        $xf = ($lng + 180) / 360 * $n;
        $yf = (1 - log(tan(deg2rad($lat)) + 1 / cos(deg2rad($lat))) / M_PI) / 2 * $n;
        return ['url' => 'https://tile.openstreetmap.org/' . $z . '/' . (int) $xf . '/' . (int) $yf . '.png',
            'fx' => round($xf - floor($xf), 3), 'fy' => round($yf - floor($yf), 3)];
    }

    /** Where the person asking is: the position their phone just sent, else the last one we stored. */
    private ?array $me = null;
    private bool $meLoaded = false;

    /** How far this place is from them, when both positions are known. */
    private function away(array $s, ?array $u): ?float
    {
        if (!$u) return null;
        if ($s['lat'] === null) return null;
        if ($this->me === null && !$this->meLoaded) {
            $this->meLoaded = true;
            $r = Db::one('SELECT lat, lng FROM users WHERE id = ?', [$u['id']]);
            $this->me = ($r && $r['lat'] !== null) ? [(float) $r['lat'], (float) $r['lng']] : null;
        }
        if ($this->me === null) return null;
        $km = WakaRules::km($this->me[0], $this->me[1], (float) $s['lat'], (float) $s['lng']);
        return $km < 1 ? round($km, 2) : round($km, 1);
    }

    /** The category a question is about, or null if it is not about a kind of place. */
    private function categoryOf(string $q): ?string
    {
        $ql = mb_strtolower($q);
        foreach (['food' => ['amala', 'eat', 'food', 'restaurant', 'suya', 'jollof', 'rice', 'chop', 'buka', 'breakfast', 'lunch', 'dinner', 'brunch', 'shawarma', 'pepper soup', 'nkwobi', 'pounded', 'cafe', 'coffee', 'pizza', 'chicken'], 'lounge' => ['lounge', 'bar', 'drink', 'beer', 'cocktail', 'hangout', 'chill', 'shisha'], 'relax' => ['relax', 'serene', 'quiet', 'park', 'lake', 'garden', 'peaceful', 'nature', 'picnic', 'calm'], 'nightlife' => ['club', 'night out', 'party', 'dance', 'dj'], 'shopping' => ['shop', 'mall', 'market', 'buy', 'supermarket', 'groceries'], 'kids' => ['kids', 'children', 'family', 'playground', 'amusement'], 'worship' => ['church', 'mosque', 'masjid', 'pray', 'mass', 'jumat', 'worship', 'cathedral', 'chapel'], 'health' => ['hospital', 'clinic', 'pharmacy', 'chemist', 'doctor', 'emergency', 'dentist', 'lab test', 'laboratory', 'health centre', 'health center', 'medical'], 'culture' => ['art', 'gallery', 'museum', 'sight', 'tour', 'monument'], 'hotel' => ['hotel', 'stay', 'sleep', 'room', 'lodge'], 'services' => ['fix', 'repair', 'barber', 'salon', 'laundry', 'mechanic', 'bank', 'fuel', 'petrol', 'car wash']] as $c => $ws)
            foreach ($ws as $w) if (str_contains($ql, $w)) return $c;
        return null;
    }

    /**
     * Where to search around. "Near me" and a live position from the phone beat everything; then a district
     * named in the question; then the last position we stored; then the district on the account.
     */
    private function whereIs(array $u, string $q, ?array $live = null): array
    {
        $ql = mb_strtolower($q);
        $nearMe = str_contains($ql, 'near me') || str_contains($ql, 'close to me') || str_contains($ql, 'around me') || str_contains($ql, 'nearby') || str_contains($ql, 'closest') || str_contains($ql, 'nearest');
        if ($live && $nearMe) return [$live[0], $live[1]];
        foreach (HomesRules::CENTROID as $name => [$lat, $lng]) if (str_contains($ql, mb_strtolower($name))) return [$lat, $lng];
        if ($live) return [$live[0], $live[1]];
        $row = Db::one('SELECT lat, lng FROM users WHERE id = ?', [$u['id']]);
        if ($row && $row['lat'] !== null) return [(float) $row['lat'], (float) $row['lng']];
        $c = HomesRules::CENTROID[$u['district'] ?? ''] ?? null;
        return $c ? [$c[0], $c[1]] : [9.0578, 7.4951]; // Central Area
    }

    /** Narrows the directory to what this question could plausibly be about, so requests stay small however big Buja grows. */
    private function relevant(string $q, array $spots, array $u, int $max = 40, ?array $live = null): array
    {
        $ql = mb_strtolower($q);
        $cats = [];
        foreach (['food' => ['amala', 'eat', 'food', 'restaurant', 'suya', 'jollof', 'rice', 'chop', 'buka', 'breakfast', 'lunch', 'dinner', 'brunch', 'shawarma', 'pepper soup', 'nkwobi', 'pounded', 'cafe', 'coffee'], 'lounge' => ['lounge', 'bar', 'drink', 'beer', 'cocktail', 'hangout', 'chill', 'shisha', 'vibe'], 'relax' => ['relax', 'serene', 'quiet', 'park', 'lake', 'garden', 'peaceful', 'nature', 'picnic', 'calm', 'walk'], 'nightlife' => ['club', 'night', 'party', 'dance', 'dj'], 'shopping' => ['shop', 'mall', 'market', 'buy', 'gift'], 'kids' => ['kids', 'children', 'family', 'playground', 'amusement'], 'worship' => ['church', 'mosque', 'masjid', 'pray', 'mass', 'worship', 'cathedral'], 'health' => ['hospital', 'clinic', 'pharmacy', 'chemist', 'doctor', 'emergency', 'dentist', 'lab', 'medical'], 'culture' => ['art', 'gallery', 'museum', 'sight', 'tour', 'monument', 'photo'], 'hotel' => ['hotel', 'stay', 'sleep', 'room'], 'services' => ['fix', 'repair', 'barber', 'salon', 'laundry', 'mechanic', 'bank', 'fuel']] as $c => $ws)
            foreach ($ws as $w) if (str_contains($ql, $w)) { $cats[$c] = true; break; }
        $near = $u['district'] ? MatchRules::nearby((string) $u['district']) : [];
        $scored = [];
        foreach ($spots as $sp) {
            $score = 0;
            if (isset($cats[$sp['category']])) $score += 6;
            foreach (json_decode($sp['tags'] ?? '[]', true) ?: [] as $t) if ($t && str_contains($ql, mb_strtolower($t))) $score += 4;
            foreach (preg_split('/\W+/u', mb_strtolower($sp['name'])) as $w) if (mb_strlen($w) > 3 && !$this->placeWord($w) && str_contains($ql, $w)) $score += 8;
            if (str_contains($ql, mb_strtolower($sp['district']))) $score += 5;
            elseif (in_array($sp['district'], $near, true)) $score += 2;
            $score += $this->wantScore($ql, $sp);
            // With a real position, close places win: full marks within a kilometre, nothing beyond ten.
            if ($live && $sp['lat'] !== null) {
                $km = WakaRules::km($live[0], $live[1], (float) $sp['lat'], (float) $sp['lng']);
                $score += $km < 1 ? 10 : ($km < 3 ? 7 : ($km < 6 ? 4 : ($km < 10 ? 1 : -3)));
            }
            $scored[] = [$score, $sp];
        }
        // Nothing matched the words? Send the most popular places rather than nothing, so the model can still be useful.
        usort($scored, fn($a, $b) => $b[0] <=> $a[0]);
        return array_map(fn($x) => $x[1], array_slice($scored, 0, $max));
    }

    /** The specific things asked for ("suya", "mosque", "pharmacy") that appear in this question. */
    private function wants(string $ql): array
    {
        $out = [];
        foreach (self::DISHES as $w => $syn) if (preg_match('/\b' . preg_quote($w, '/') . '/u', $ql)) $out[$w] = $syn;
        return $out;
    }
    /** District and area names ("Garki" in "Garki Hospital") say where, not what: they never make a name match. */
    private function placeWord(string $w): bool
    {
        static $set = null;
        if ($set === null) { $set = []; foreach (array_keys(HomesRules::CENTROID) as $d) foreach (preg_split('/\W+/u', mb_strtolower($d)) as $x) if ($x !== '') $set[$x] = true; foreach (['abuja', 'fct', 'area', 'phase', 'district', 'junction', 'road', 'street', 'close', 'estate', 'plaza'] as $x) $set[$x] = true; }
        return isset($set[$w]);
    }
    /** Kinds of place that, when asked for, must be exactly that kind (a church, not any place of worship). */
    private const STRICT = ['church', 'mosque', 'pharmacy', 'hospital', 'clinic'];
    private function strictKinds(string $ql): array { return array_values(array_intersect(array_keys($this->wants($ql)), self::STRICT)); }
    private function isKind(array $sp, array $kinds): bool
    {
        // what the place IS: its name, tags and map type. Not its description ("opposite the National Mosque").
        $txt = mb_strtolower($sp['name'] . ' ' . ($sp['tags'] ?? '') . ' ' . ($sp['subtype'] ?? ''));
        foreach ($kinds as $k) { if (($sp['subtype'] ?? '') === $k) return true; foreach (self::DISHES[$k] as $w) if (str_contains($txt, $w)) return true; }
        return false;
    }
    /** Text a place is known by: its name, tags, kind and description. */
    private function textOf(array $sp): string { return mb_strtolower($sp['name'] . ' ' . ($sp['tags'] ?? '') . ' ' . ($sp['subtype'] ?? '') . ' ' . ($sp['description'] ?? '')); }
    /** Extra points when a place names what was asked for, and when it is open for a late-night question. */
    private function wantScore(string $ql, array $sp): int
    {
        $score = 0; $txt = $this->textOf($sp);
        foreach ($this->wants($ql) as $syn) foreach ($syn as $w) if (str_contains($txt, $w)) { $score += 9; break; }
        if ($this->late($ql)) { $o = Places::openAt($sp['hours'] ?? null); if ($o) $score += $o['open'] ? 6 : -8; }
        return $score;
    }
    private function late(string $ql): bool { return (bool) preg_match('/late|night|midnight|open now|still open|24 ?hours|24\/7|right now|tonight/u', $ql); }

    /** Where Buja searched around, in words the person will recognise. */
    private function whereLabel(array $u, string $q, ?array $live): array
    {
        $ql = mb_strtolower($q);
        foreach (HomesRules::CENTROID as $name => [$lat, $lng]) if (preg_match('/\b' . preg_quote(mb_strtolower($name), '/') . '\b/u', $ql)) return ['label' => $name, 'lat' => $lat, 'lng' => $lng, 'source' => 'named'];
        if ($live) return ['label' => 'you (' . Osm::districtFor($live[0], $live[1]) . ')', 'lat' => $live[0], 'lng' => $live[1], 'source' => 'gps'];
        $row = Db::one('SELECT lat, lng FROM users WHERE id = ?', [$u['id']]);
        if ($row && $row['lat'] !== null) return ['label' => 'your last known spot (' . Osm::districtFor((float) $row['lat'], (float) $row['lng']) . ')', 'lat' => (float) $row['lat'], 'lng' => (float) $row['lng'], 'source' => 'saved'];
        $c = HomesRules::CENTROID[$u['district'] ?? ''] ?? null;
        return $c ? ['label' => $u['district'], 'lat' => $c[0], 'lng' => $c[1], 'source' => 'account'] : ['label' => 'Abuja', 'lat' => 9.0578, 'lng' => 7.4951, 'source' => 'city'];
    }

    /** Buja businesses and artisans who do what was asked, nearest first: they can be ordered from or called inside Buja. */
    private const TRADE_WORDS = ['restaurant' => ['food', 'eat', 'restaurant', 'lunch', 'dinner', 'breakfast', 'jollof', 'rice', 'amala', 'soup', 'chop', 'buka', 'hungry', 'shawarma', 'chicken', 'pizza'], 'suya' => ['suya', 'grill', 'barbecue', 'bbq', 'asun', 'kilishi'], 'cook' => ['cook', 'caterer', 'catering', 'small chops', 'party food'], 'bakery' => ['cake', 'bread', 'bakery', 'pastry'], 'drinks' => ['drink', 'drinks', 'beer', 'wine', 'lounge', 'cocktail', 'zobo'], 'grocery' => ['grocer', 'provision', 'foodstuff', 'market'], 'water' => ['water delivery', 'pure water', 'bottled water', 'dispenser'], 'gas' => ['cooking gas', 'gas refill', 'lpg'],
        'mechanic' => ['mechanic', 'car repair', 'car fault', 'engine'], 'vulcanizer' => ['tyre', 'tire', 'vulcan', 'flat'], 'towing' => ['tow', 'towing'], 'electrician' => ['electrician', 'wiring', 'light fault'], 'plumber' => ['plumber', 'leak', 'pipe'], 'laundry' => ['laundry', 'dry clean', 'wash clothes'], 'cleaning' => ['cleaning', 'cleaner'], 'hair' => ['hair', 'barber', 'salon', 'makeup', 'nails'], 'tailor' => ['tailor', 'sew'], 'errand' => ['errand', 'dispatch', 'delivery', 'send a package'], 'generator' => ['generator'], 'ac' => [' ac ', 'air condition'], 'phone' => ['phone repair', 'screen'], 'carwash' => ['car wash']];
    private function providers(string $ql, ?array $pos, array $u): array
    {
        $trades = [];
        foreach (self::TRADE_WORDS as $t => $ws) foreach ($ws as $w) if (str_contains(' ' . $ql . ' ', $w)) { $trades[] = $t; break; }
        $trades = array_values(array_intersect(array_unique($trades), array_keys(ArtisanController::TRADES)));
        // a business whose menu lists what was asked for counts too (a restaurant that sells suya)
        $menuIds = [];
        $words = []; foreach ($this->wants($ql) as $w => $syn) $words[] = $w;
        if ($words) { try { $st = Db::pdo()->prepare('SELECT DISTINCT artisan_id FROM artisan_menu WHERE deleted_at IS NULL AND available = 1 AND (' . implode(' OR ', array_fill(0, count($words), 'LOWER(name) LIKE ?')) . ')'); $st->execute(array_map(fn($w) => '%' . $w . '%', $words)); $menuIds = array_map('intval', array_column($st->fetchAll(), 'artisan_id')); } catch (Throwable $e) {} }
        if (!$trades && !$menuIds) return [];
        $cond = []; $p = [$u['id']];
        if ($trades) { $cond[] = 'a.trade IN (' . implode(',', array_fill(0, count($trades), '?')) . ')'; $p = array_merge($p, $trades); }
        if ($menuIds) $cond[] = 'a.user_id IN (' . implode(',', $menuIds) . ')';
        try {
            $st = Db::pdo()->prepare('SELECT a.* FROM artisans a JOIN users u ON u.id = a.user_id WHERE a.available = 1 AND a.hidden_at IS NULL AND u.deleted_at IS NULL AND a.user_id <> ? AND (' . implode(' OR ', $cond) . ') LIMIT 200');
            $st->execute($p);
        } catch (Throwable $e) { return []; }
        $ac = new ArtisanController();
        $rows = array_map(fn($a) => $ac->shape($a, $pos), $st->fetchAll());
        // within reach only: their delivery or travel radius, plus a little
        $rows = array_values(array_filter($rows, fn($r) => !isset($r['km']) || $r['km'] <= max(8, $r['radiusKm'] + 3)));
        usort($rows, fn($x, $y) => ($x['km'] ?? 9999) <=> ($y['km'] ?? 9999));
        $rows = array_slice($rows, 0, 3);
        foreach ($rows as &$r) {
            $r['orderable'] = in_array($r['trade'], ServiceJobController::ORDER_TRADES, true);
            try { $r['menuCount'] = (int) (Db::one('SELECT COUNT(*) AS n FROM artisan_menu WHERE artisan_id = ? AND deleted_at IS NULL AND available = 1', [$r['id']])['n'] ?? 0); } catch (Throwable $e) { $r['menuCount'] = 0; }
            $r['online'] = $r['onlineAgo'] !== null && $r['onlineAgo'] < 900;
        }
        unset($r);
        return $rows;
    }

    /** One line of plain facts for a card: distance, hours, what it serves, rating. Nothing the data does not say. */
    private function why(array $c, array $wants): string
    {
        $parts = [];   // the distance is already on the card
        $o = $c['open'];
        $parts[] = $o === null ? 'hours not listed' : ($o['open'] ? (!empty($o['allDay']) ? 'open 24 hours' : 'open now' . ($o['until'] ? ', until ' . $o['until'] : '')) : 'closed now' . (!empty($o['opens']) ? ', opens ' . $o['opens'] : ''));
        $txt = mb_strtolower($c['name'] . ' ' . implode(' ', $c['tags']) . ' ' . $c['description']);
        foreach ($wants as $syn) foreach ($syn as $x) if (str_contains($txt, $x)) { $parts[] = 'lists ' . $x; break; }
        if ($c['rating']) $parts[] = $c['rating'] . '★ from ' . $c['ratings'];
        return ucfirst(implode(' · ', array_slice($parts, 0, 4)));
    }

    /** Turns the chosen places into the reply: cards in a sensible order and a summary built only from their facts. */
    private function present(string $q, array $rows, array $u, string $mode, array $where): array
    {
        $ql = mb_strtolower($q); $wants = $this->wants($ql); $late = $this->late($ql);
        $strict = $this->strictKinds($ql);
        if ($strict) $rows = array_values(array_filter($rows, fn($s) => $this->isKind($s, $strict)));   // the model may not bend this either
        if ($where['source'] === 'named') {   // "in Garki": keep to Garki and its edges when there is enough there
            $close = array_values(array_filter($rows, fn($s) => $s['lat'] !== null && WakaRules::km($where['lat'], $where['lng'], (float) $s['lat'], (float) $s['lng']) <= 5));
            if ($close) $rows = $close;
        }
        $cards = array_map(fn($s) => $this->spot($s, $u), $rows);
        $namesIt = function ($c) use ($wants) { $t = mb_strtolower($c['name'] . ' ' . implode(' ', $c['tags']) . ' ' . $c['description']); foreach ($wants as $syn) foreach ($syn as $x) if (str_contains($t, $x)) return 0; return 1; };
        $rank = fn($c) => $late ? ($c['open'] === null ? 1 : ($c['open']['open'] ? 0 : 2)) : 0;
        // order by closeness to where the question points: a district named in it, else the person
        $near = fn($c) => $c['lat'] === null ? 9999 : ($where['source'] === 'named' ? WakaRules::km($where['lat'], $where['lng'], $c['lat'], $c['lng']) : ($c['away'] ?? 9999));
        // late questions: closed places last; then places that name what was asked; then open before unknown hours; then nearest
        $closed = fn($c) => $late && $c['open'] && !$c['open']['open'] ? 1 : 0;
        usort($cards, fn($a, $b) => ($closed($a) <=> $closed($b)) ?: ($namesIt($a) <=> $namesIt($b)) ?: ($rank($a) <=> $rank($b)) ?: ($near($a) <=> $near($b)));
        $cards = array_slice($cards, 0, 5);
        foreach ($cards as &$c) $c['why'] = $this->why($c, $wants);
        unset($c);
        $named = 0; foreach ($cards as $c) { $t = mb_strtolower($c['name'] . ' ' . implode(' ', $c['tags']) . ' ' . $c['description']); foreach ($wants as $syn) foreach ($syn as $x) if (str_contains($t, $x)) { $named++; continue 3; } }
        $n = count($cards);
        if (!$n) $answer = 'Buja has no place on record for that near ' . $where['label'] . ' yet. If you know one, add it so the next person finds it.';
        else {
            $first = $cards[0];
            $answer = $n . ($n === 1 ? ' place' : ' places') . ' near ' . $where['label'] . '.' . ($first['away'] !== null ? ' ' . ($where['source'] === 'named' ? 'First up' : 'Nearest') . ': ' . $first['name'] . ', ' . ($first['away'] < 1 ? round($first['away'] * 1000, -1) . ' m' : $first['away'] . ' km') . ' from you.' : '');
            if ($wants && $named === 0) $answer .= ' None of them lists ' . implode(' or ', array_keys($wants)) . ' by name, so these are the closest likely places. Call or check before you go.';
            elseif ($wants && $named < $n) $answer .= ' ' . $named . ' of them list ' . implode(' or ', array_keys($wants)) . ' by name.';
            if ($late) { $open = count(array_filter($cards, fn($c) => $c['open'] && $c['open']['open'])); $unknown = count(array_filter($cards, fn($c) => $c['open'] === null));
                $answer .= $open ? ' ' . $open . ' ' . ($open === 1 ? 'is' : 'are') . ' open now by their listed hours.' : ' None lists hours that show it open now.';
                if ($unknown) $answer .= ' ' . $unknown . ' ' . ($unknown === 1 ? 'does' : 'do') . ' not list hours.'; }
        }
        $follow = $late ? ['Open now near me', 'Something cheaper'] : ['Open now near me', 'Something cheaper', 'Best rated nearby'];
        return ['answer' => $answer, 'spots' => $cards, 'followups' => $follow, 'mode' => $mode];
    }

    /** POST /ask { question, history: [{q,a}] } */
    public function ask(): void
    {
        $u = Auth::require(); RateLimit::hit('ask', (int) Http::config('ask_daily_limit', 40), 86400);
        $b = Http::body();
        $q = mb_substr(trim((string) ($b['question'] ?? '')), 0, 300);
        if ($q === '') Http::json(['error' => 'validation', 'fields' => ['question' => 'Ask something.']], 422);
        $live = null;
        if (!empty($b['lat']) && !empty($b['lng'])) {
            $la = (float) $b['lat']; $ln = (float) $b['lng'];
            if ($la > 4 && $la < 14 && $ln > 2 && $ln < 15) {
                $live = [$la, $ln]; $this->me = $live;
                Db::run('UPDATE users SET lat = ?, lng = ?, loc_updated_at = ? WHERE id = ?', [round($la, 3), round($ln, 3), Db::now(), $u['id']]);
            }
        }
        $spots = $this->directory();
        $shortlist = $this->relevant($q, $spots, $u, 40, $live);
        $cat = $this->categoryOf($q);
        // If Buja knows little about what was asked, look it up on the map and keep what it finds.
        $onTopic = array_values(array_filter($shortlist, fn($s) => $s['category'] === $cat));
        if ($cat && count($onTopic) < 4) {
            [$lat, $lng] = $this->whereIs($u, $q, $live);
            $tried = 'osm:' . $cat . ':' . round($lat, 2) . ',' . round($lng, 2);
            if ($lat && !Db::one('SELECT 1 AS x FROM app_keys WHERE k = ? AND v > ?', [$tried, gmdate('Y-m-d H:i:s', time() - 3600)])) {
                $found = [];
                try { RateLimit::hit('osm', 60, 3600); $found = Osm::nearby($cat, $lat, $lng); } catch (Throwable $e) {}
                if ($found) { $spots = $this->directory(); $shortlist = $this->relevant($q, $spots, $u, 40, $live); }
                else { Db::run('DELETE FROM app_keys WHERE k = ?', [$tried]); Db::run('INSERT INTO app_keys (k, v) VALUES (?,?)', [$tried, Db::now()]); }
            }
        }
        // The model, when there is one, only chooses which places fit. Everything shown is then built from the
        // places' own records, so the reply cannot say anything the directory does not.
        $where = $this->whereLabel($u, $q, $live);
        if (!$this->me) $this->me = [$where['lat'], $where['lng']];
        $rows = null; $mode = 'rules';
        foreach ($this->providerChain() as $p) { $ids = $this->askModel($p, $q, $shortlist, $u); if ($ids !== null) { $byId = []; foreach ($shortlist as $s) $byId[(int) $s['id']] = $s; $rows = array_values(array_filter(array_map(fn($i) => $byId[$i] ?? null, $ids))); $mode = $p; break; } }
        if (!$rows) { $rows = $this->rulePick($q, $spots, $u); if ($mode !== 'rules' && $rows) $mode .= '+rules'; }
        $result = $this->present($q, $rows, $u, $mode, $where);
        $result['where'] = $where;
        $result['providers'] = $this->providers(mb_strtolower($q), [$where['lat'], $where['lng']], $u);
        $ids = array_map(fn($s) => $s['id'], $result['spots']);
        Db::run('INSERT INTO ask_log (user_id, question, district, spot_ids, mode, created_at) VALUES (?,?,?,?,?,?)', [$u['id'], $q, $u['district'], json_encode($ids), $result['mode'], Db::now()]); Track::hit($u, 'ask', 'ask');
        Http::json($result);
    }

    /** Which providers to try, in order. ASK_PROVIDER picks the first; the rest are fallbacks so Ask never simply breaks. */
    private function providerChain(): array
    {
        $want = strtolower((string) Http::config('ask_provider', 'gemini'));
        $have = array_values(array_filter(['gemini', 'groq', 'anthropic'], fn($p) => Http::config($p . '_api_key', '') !== ''));
        if ($want === 'rules') return [];
        usort($have, fn($a, $b) => ($b === $want) <=> ($a === $want));
        return $have;
    }

    private function systemPrompt(array $spots, array $u): string
    {
        $compact = array_map(fn($s) => ['id' => (int) $s['id'], 'name' => $s['name'], 'cat' => $s['category'], 'district' => $s['district'], 'tags' => json_decode($s['tags'] ?? '[]', true) ?: [], 'kind' => $s['subtype'] ?? null, 'price' => in_array($s['source'] ?? 'buja', ['osm', 'overture'], true) ? null : (int) $s['price_level'], 'note' => $s['price_note'], 'desc' => mb_substr((string) $s['description'], 0, 140), 'hours' => $s['hours'], 'rating' => (Db::one('SELECT ROUND(AVG(stars),1) AS a, COUNT(*) AS n FROM spot_ratings WHERE spot_id = ?', [$s['id']]) ?: ['a' => null, 'n' => 0])], $spots);
        return "You are Ask Buja, a local guide to Abuja, Nigeria, inside the Buja app. The user is in " . ($u['district'] ?: 'Abuja') . ". You may ONLY recommend places from the DIRECTORY below, by id. Never invent, rename or guess a place. Choose the places that genuinely fit the question (kind of place, food named, mood, price level 1 budget to 4 premium, tags, ratings, hours in OpenStreetMap format). If nothing fits, return an empty list. Respond with JSON only, no markdown fences: {\"spots\": [id, id, ...]}. Pick up to 6 ids, best first. Time now (Abuja): " . date('D H:i') . ".\n\nDIRECTORY:\n" . json_encode($compact, JSON_UNESCAPED_UNICODE);
    }

    /** Calls one provider. Returns null on any failure so the chain can move on. */
    private function askModel(string $provider, string $q, array $spots, array $u): ?array   // chosen place ids, or null on failure
    {
        $system = $this->systemPrompt($spots, $u);
        $key = (string) Http::config($provider . '_api_key', '');
        if ($key === '') return null;
        [$url, $headers, $body] = match ($provider) {
            'gemini' => [
                rtrim((string) Http::config('gemini_endpoint', 'https://generativelanguage.googleapis.com/v1beta/models'), '/') . '/' . (string) Http::config('gemini_model', 'gemini-3.6-flash') . ':generateContent?key=' . rawurlencode($key),
                ['content-type: application/json'],
                json_encode(['systemInstruction' => ['parts' => [['text' => $system]]], 'contents' => [['role' => 'user', 'parts' => [['text' => $q]]]], 'generationConfig' => ['temperature' => 0.4, 'maxOutputTokens' => 1400, 'responseMimeType' => 'application/json']], JSON_UNESCAPED_UNICODE),
            ],
            'groq' => [
                'https://api.groq.com/openai/v1/chat/completions',
                ['content-type: application/json', 'authorization: Bearer ' . $key],
                json_encode(['model' => (string) Http::config('groq_model', 'llama-3.3-70b-versatile'), 'temperature' => 0.4, 'max_tokens' => 1400, 'response_format' => ['type' => 'json_object'], 'messages' => [['role' => 'system', 'content' => $system], ['role' => 'user', 'content' => $q]]], JSON_UNESCAPED_UNICODE),
            ],
            'anthropic' => [
                'https://api.anthropic.com/v1/messages',
                ['content-type: application/json', 'x-api-key: ' . $key, 'anthropic-version: 2023-06-01'],
                json_encode(['model' => (string) Http::config('ask_model', 'claude-haiku-4-5-20251001'), 'max_tokens' => 1400, 'system' => $system, 'messages' => [['role' => 'user', 'content' => $q]]], JSON_UNESCAPED_UNICODE),
            ],
            default => [null, [], null],
        };
        if ($url === null) return null;
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25, CURLOPT_POSTFIELDS => $body, CURLOPT_HTTPHEADER => $headers]);
        $raw = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($code !== 200) {
            $msg = json_decode((string) $raw, true)['error']['message'] ?? substr((string) $raw, 0, 160);
            error_log('[buja ask] ' . $provider . ' returned ' . $code . ': ' . $msg);
            return null;
        }
        $j = json_decode((string) $raw, true);
        $text = match ($provider) {
            'gemini' => $j['candidates'][0]['content']['parts'][0]['text'] ?? '',
            'groq' => $j['choices'][0]['message']['content'] ?? '',
            'anthropic' => implode('', array_map(fn($b) => $b['text'] ?? '', array_filter($j['content'] ?? [], fn($b) => ($b['type'] ?? '') === 'text'))),
            default => '',
        };
        $text = trim(preg_replace('/^```(?:json)?|```$/m', '', (string) $text));
        $parsed = json_decode($text, true);
        if (!is_array($parsed) || !array_key_exists('spots', $parsed)) { error_log('[buja ask] ' . $provider . ' unparseable: ' . substr($text, 0, 200)); return null; }
        // only ids that were on the shortlist count; anything else the model wrote is ignored
        $ok = []; foreach ($spots as $s) $ok[(int) $s['id']] = true;
        $ids = [];
        foreach ((array) $parsed['spots'] as $x) { $id = (int) (is_array($x) ? ($x['id'] ?? 0) : $x); if (isset($ok[$id]) && !in_array($id, $ids, true)) $ids[] = $id; if (count($ids) >= 6) break; }
        return $ids;
    }

    /** Keyword fallback: category words, tags, district names, price words, what was named, distance. Honest and predictable. */
    private function rulePick(string $q, array $spots, array $u): array
    {
        $ql = mb_strtolower($q);
        $catWords = ['food' => ['amala', 'eat', 'food', 'restaurant', 'suya', 'jollof', 'rice', 'chop', 'buka', 'breakfast', 'lunch', 'dinner', 'brunch', 'shawarma', 'pepper soup', 'nkwobi', 'ewa', 'pounded'], 'lounge' => ['lounge', 'bar', 'drink', 'beer', 'cocktail', 'hangout', 'chill', 'shisha'], 'relax' => ['relax', 'serene', 'quiet', 'park', 'lake', 'garden', 'peaceful', 'nature', 'picnic', 'calm'], 'nightlife' => ['club', 'night', 'party', 'dance', 'dj'], 'shopping' => ['shop', 'mall', 'market', 'buy'], 'kids' => ['kids', 'children', 'family', 'playground', 'amusement'], 'worship' => ['church', 'mosque', 'masjid', 'pray', 'mass', 'worship'], 'health' => ['hospital', 'clinic', 'pharmacy', 'chemist', 'doctor', 'emergency', 'dentist', 'medical'], 'culture' => ['art', 'gallery', 'museum', 'sight', 'tour', 'monument'], 'hotel' => ['hotel', 'stay', 'sleep', 'room'], 'services' => ['bank', 'fuel', 'petrol', 'salon', 'barber', 'laundry']];
        $cats = []; foreach ($catWords as $c => $ws) foreach ($ws as $w) if (preg_match('/\b' . preg_quote($w, '/') . '/u', $ql)) { $cats[$c] = true; break; }
        $cheap = (bool) preg_match('/cheap|budget|affordable|pocket|not too pricey|inexpensive/', $ql); $fancy = (bool) preg_match('/fancy|premium|luxury|classy|expensive|upscale/', $ql);
        $near = (bool) preg_match('/near|close|around|nearby|my area/', $ql);
        $scored = [];
        $strict = $this->strictKinds($ql);
        foreach ($spots as $s) {
            // 1. is it about what was asked? kind of place, its tags, its name, the dish or thing named
            $topic = 0; $tags = array_map('mb_strtolower', json_decode($s['tags'] ?? '[]', true) ?: []);
            if (isset($cats[$s['category']])) $topic += 5;
            foreach ($tags as $t) if ($t !== '' && preg_match('/\b' . preg_quote($t, '/') . '\b/u', $ql)) $topic += 4;
            foreach (preg_split('/\W+/u', mb_strtolower($s['name'])) as $w) if (mb_strlen($w) > 3 && !$this->placeWord($w) && str_contains($ql, $w)) $topic += 6;
            $txt = $this->textOf($s); $named = false;
            foreach ($this->wants($ql) as $syn) foreach ($syn as $w) if (str_contains($txt, $w)) { $topic += 9; $named = true; break; }
            if ($topic < 4) continue;
            if ($strict && !$this->isKind($s, $strict)) continue;   // asked for a church: mosques do not qualify, and the other way round
            // 2. among those, rank: the district named, price wish, open for a late question, nearer
            $score = $topic;
            if (str_contains($ql, mb_strtolower($s['district']))) $score += 4;
            elseif ($near && $u['district'] && ($s['district'] === $u['district'] || in_array($s['district'], MatchRules::nearby($u['district']), true))) $score += 3;
            if ($cheap) $score += (int) $s['price_level'] <= 2 ? 2 : -3; if ($fancy) $score += (int) $s['price_level'] >= 3 ? 2 : -3;
            if ($this->late($ql)) { $o = Places::openAt($s['hours'] ?? null); if ($o) $score += $o['open'] ? 6 : -8; }
            if ($this->me && $s['lat'] !== null) { $km = WakaRules::km($this->me[0], $this->me[1], (float) $s['lat'], (float) $s['lng']); $score += $km < 1 ? 6 : ($km < 3 ? 4 : ($km < 6 ? 2 : ($km < 12 ? 0 : -4))); }
            $scored[] = [$score, $s];
        }
        usort($scored, fn($a, $b) => $b[0] <=> $a[0]);
        return array_map(fn($x) => $x[1], array_slice($scored, 0, 6));
    }

    /** GET /spots/{id} */
    public function show(int $id): void
    {
        $u = Auth::require(); $s = Db::one('SELECT * FROM spots WHERE id = ? AND active = 1', [$id]); if (!$s) Http::json(['error' => 'not_found'], 404);
        $la = (float) ($_GET['lat'] ?? 0); $ln = (float) ($_GET['lng'] ?? 0); if ($la > 8 && $la < 10 && $ln > 6.5 && $ln < 8) $this->me = [$la, $ln];   // the phone's position right now, when sent
        $st = Db::pdo()->prepare('SELECT r.stars, r.comment, r.created_at, us.name FROM spot_ratings r JOIN users us ON us.id = r.user_id WHERE r.spot_id = ? ORDER BY r.id DESC LIMIT 20'); $st->execute([$id]);
        Http::json(['spot' => $this->spot($s, $u), 'reviews' => array_map(fn($r) => ['stars' => (int) $r['stars'], 'comment' => $r['comment'], 'name' => explode(' ', $r['name'])[0], 'at' => substr($r['created_at'], 0, 10)], $st->fetchAll())]);
    }

    /** POST /spots/{id}/rate { stars 1-5, comment } */
    public function rate(int $id): void
    {
        $u = Auth::require(); RateLimit::hit('rate', 60, 86400);
        if (!Db::one('SELECT id FROM spots WHERE id = ?', [$id])) Http::json(['error' => 'not_found'], 404);
        $b = Http::body(); $stars = (int) ($b['stars'] ?? 0); $c = mb_substr(trim((string) ($b['comment'] ?? '')), 0, 300);
        if ($stars < 1 || $stars > 5) Http::json(['error' => 'validation', 'fields' => ['stars' => 'Pick 1 to 5 stars.']], 422);
        Db::run('DELETE FROM spot_ratings WHERE spot_id = ? AND user_id = ?', [$id, $u['id']]);
        Db::run('INSERT INTO spot_ratings (spot_id, user_id, stars, comment, created_at) VALUES (?,?,?,?,?)', [$id, $u['id'], $stars, $c ?: null, Db::now()]);
        $this->show($id);
    }

    /** GET /spots?q=&category= and POST /spots (community-added, unverified until reviewed) */
    /** Browse: a category or a kind (church, mosque, pharmacy...), a search, nearest first when a position is sent. */
    public const BROWSE = ['food' => ['Restaurants & food', 'utensils'], 'lounge' => ['Lounges & bars', 'martini-glass'], 'nightlife' => ['Nightlife', 'moon'], 'church' => ['Churches', 'church'], 'mosque' => ['Mosques', 'mosque'], 'hospital' => ['Hospitals', 'hospital'], 'pharmacy' => ['Pharmacies', 'pills'],
        'health' => ['Clinics & health', 'stethoscope'], 'hotel' => ['Hotels', 'hotel'], 'shopping' => ['Malls & markets', 'bag-shopping'], 'relax' => ['Parks & outdoors', 'seedling'], 'culture' => ['Culture & sights', 'building-columns'], 'kids' => ['Kids & family', 'users'], 'services' => ['Banks, fuel & services', 'building']];
    public function index(): void
    {
        $u = Auth::require(); $q = trim((string) ($_GET['q'] ?? '')); $cat = (string) ($_GET['category'] ?? '');
        $lat = (float) ($_GET['lat'] ?? 0); $lng = (float) ($_GET['lng'] ?? 0); $pos = $lat > 8 && $lat < 10 && $lng > 6.5 && $lng < 8 ? [$lat, $lng] : null;
        if ($pos) $this->me = $pos;
        $where = ['active = 1']; $p = [];
        if ($q !== '') { $where[] = '(name LIKE ? OR district LIKE ? OR tags LIKE ? OR area LIKE ?)'; array_push($p, "%$q%", "%$q%", "%$q%", "%$q%"); }
        $hasSub = true; try { Db::one('SELECT subtype FROM spots LIMIT 1'); } catch (Throwable $e) { $hasSub = false; }
        if (in_array($cat, ['church', 'mosque', 'hospital', 'pharmacy'], true)) {
            $like = ['church' => ['%church%', '%cathedral%', '%chapel%'], 'mosque' => ['%mosque%', '%masjid%'], 'hospital' => ['%hospital%'], 'pharmacy' => ['%pharmacy%', '%chemist%']][$cat];
            $where[] = '(' . ($hasSub ? 'subtype = ? OR ' : '') . implode(' OR ', array_fill(0, count($like), 'LOWER(name) LIKE ?')) . ')';
            if ($hasSub) $p[] = $cat; $p = array_merge($p, $like);
        } elseif (isset(self::CATEGORIES[$cat])) { $where[] = 'category = ?'; $p[] = $cat; }
        // nearest first when we know where you are (a box first, so the database does the heavy lifting)
        if ($pos && $q === '') { $where[] = 'lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?'; array_push($p, $lat - 0.18, $lat + 0.18, $lng - 0.18, $lng + 0.18); }
        $order = $hasSub ? 'ORDER BY (photo_url IS NOT NULL) DESC, notable DESC, name' : 'ORDER BY name';
        $st = Db::pdo()->prepare('SELECT * FROM spots WHERE ' . implode(' AND ', $where) . ' ' . $order . ' LIMIT ' . ($pos ? 600 : 120)); $st->execute($p);
        $rows = $st->fetchAll();
        if ($pos) { usort($rows, fn($a, $b) => ($a['lat'] === null ? 1e9 : WakaRules::km($lat, $lng, (float) $a['lat'], (float) $a['lng'])) <=> ($b['lat'] === null ? 1e9 : WakaRules::km($lat, $lng, (float) $b['lat'], (float) $b['lng']))); }
        $rows = array_slice($rows, 0, 60);
        $total = (int) (Db::one('SELECT COUNT(*) AS n FROM spots WHERE active = 1')['n'] ?? 0);
        Http::json(['spots' => array_map(fn($s) => $this->spot($s, $u), $rows), 'categories' => self::CATEGORIES, 'browse' => array_map(fn($x) => ['label' => $x[0], 'icon' => $x[1]], self::BROWSE), 'total' => $total]);
    }
    public function create(): void
    {
        $u = Auth::require(); RateLimit::hit('addspot', 10, 86400); $b = Http::body(); $e = [];
        $name = mb_substr(trim((string) ($b['name'] ?? '')), 0, 80); if (mb_strlen($name) < 3) $e['name'] = 'The name of the place.';
        $cat = isset(self::CATEGORIES[$b['category'] ?? '']) ? $b['category'] : null; if (!$cat) $e['category'] = 'Choose a category.';
        $district = mb_substr(trim((string) ($b['district'] ?? '')), 0, 60); if ($district === '') $e['district'] = 'Which district?';
        $area = mb_substr(trim((string) ($b['area'] ?? '')), 0, 100); $desc = mb_substr(trim((string) ($b['description'] ?? '')), 0, 400); if (mb_strlen($desc) < 10) $e['description'] = 'A line on what it is known for.';
        $price = max(1, min(4, (int) ($b['priceLevel'] ?? 2))); $note = mb_substr(trim((string) ($b['priceNote'] ?? '')), 0, 60); $hours = mb_substr(trim((string) ($b['hours'] ?? '')), 0, 60);
        $tags = array_slice(array_values(array_unique(array_filter(array_map(fn($t) => mb_substr(mb_strtolower(trim((string) $t)), 0, 30), (array) ($b['tags'] ?? []))))), 0, 8);
        // pinned where the person is standing, when they chose to: inside the FCT only
        $plat = isset($b['lat']) ? (float) $b['lat'] : null; $plng = isset($b['lng']) ? (float) $b['lng'] : null;
        if ($plat !== null && !($plat > 8.3 && $plat < 9.6 && $plng > 6.7 && $plng < 7.9)) { $plat = $plng = null; $e['district'] = $e['district'] ?? null; }
        $e = array_filter($e);
        if ($e) Http::json(['error' => 'validation', 'fields' => $e], 422);
        if (Db::one('SELECT id FROM spots WHERE name = ? AND district = ?', [$name, $district])) Http::json(['error' => 'validation', 'fields' => ['name' => 'That place is already on Buja.']], 422);
        Db::run('INSERT INTO spots (name, category, district, area, tags, price_level, price_note, description, hours, lat, lng, added_by, active, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?)', [$name, $cat, $district, $area ?: null, json_encode($tags), $price, $note ?: null, $desc, $hours ?: null, $plat !== null ? round($plat, 6) : null, $plng !== null ? round($plng, 6) : null, $u['id'], Db::now()]);
        Http::json(['spot' => $this->spot(Db::one('SELECT * FROM spots WHERE id = ?', [Db::lastId()]), $u)], 201);
    }
}

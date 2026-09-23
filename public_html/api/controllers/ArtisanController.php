<?php
declare(strict_types=1);

/**
 * Artisans: the mechanic, plumber or electrician nearest to where you are standing, with a phone number
 * that works and ratings from people who actually used them.
 */
final class ArtisanController
{
    public const TRADES = ['mechanic' => 'Mechanic', 'vulcanizer' => 'Vulcanizer / tyres', 'towing' => 'Towing', 'electrician' => 'Electrician', 'plumber' => 'Plumber', 'mason' => 'Mason / bricklayer', 'carpenter' => 'Carpenter', 'painter' => 'Painter', 'tiler' => 'Tiler', 'welder' => 'Welder', 'ac' => 'AC repair', 'generator' => 'Generator repair', 'solar' => 'Solar & inverter', 'cctv' => 'CCTV installer', 'dstv' => 'DStv / GOtv installer', 'phone' => 'Phone repair', 'laptop' => 'Laptop repair', 'carwash' => 'Car wash', 'laundry' => 'Laundry', 'cleaning' => 'Cleaning', 'errand' => 'Errand / dispatch', 'cook' => 'Cook / caterer', 'hair' => 'Hair & beauty', 'tailor' => 'Tailor', 'gardener' => 'Gardener', 'pest' => 'Pest control', 'locksmith' => 'Locksmith', 'movers' => 'Movers'];

    private function shape(array $a, ?array $at = null): array
    {
        $u = Db::one('SELECT name, selfie_verified_at, district FROM users WHERE id = ?', [$a['user_id']]);
        $out = ['id' => (int) $a['user_id'], 'name' => $a['business'] ?: explode(' ', trim((string) ($u['name'] ?? 'Artisan')))[0], 'person' => explode(' ', trim((string) ($u['name'] ?? '')))[0],
            'trade' => $a['trade'], 'tradeLabel' => self::TRADES[$a['trade']] ?? $a['trade'], 'about' => $a['about'], 'phone' => $a['phone'], 'whatsapp' => $a['whatsapp'] ?: $a['phone'],
            'district' => $a['base_district'], 'radiusKm' => (int) $a['radius_km'], 'years' => (int) $a['years'], 'available' => (bool) $a['available'],
            'verified' => !empty($a['verified_at']) || !empty($u['selfie_verified_at']), 'bujaVerified' => !empty($a['verified_at']), 'photo' => $a['photo_upload'] ? '/api/uploads/' . (int) $a['photo_upload'] : (Db::one('SELECT 1 AS x FROM avatars WHERE user_id = ?', [$a['user_id']]) ? '/api/avatar/' . (int) $a['user_id'] : null),
            'rating' => RatingController::summary((int) $a['user_id']), 'jobs' => (int) $a['jobs_done'], 'lat' => $a['lat'] !== null ? (float) $a['lat'] : null, 'lng' => $a['lng'] !== null ? (float) $a['lng'] : null,
            'owner' => $a['owner_name'] ?? null, 'services' => json_decode((string) ($a['services'] ?? '[]'), true) ?: [], 'brands' => json_decode((string) ($a['brands'] ?? '[]'), true) ?: [],
            'mobileService' => (bool) ($a['mobile_service'] ?? 1), 'emergency' => (bool) ($a['emergency'] ?? 0), 'hours' => $a['hours'] ?? null, 'calloutFee' => isset($a['callout_fee']) && $a['callout_fee'] !== null ? (int) $a['callout_fee'] : null,
            'address' => $a['address'] ?? null, 'landmark' => $a['landmark'] ?? null, 'hasId' => !empty($a['id_upload']),
            'onlineAgo' => !empty($a['last_online_at']) ? max(0, time() - strtotime($a['last_online_at'] . ' UTC')) : null];
        if ($at && $a['lat'] !== null) { $km = WakaRules::km($at[0], $at[1], (float) $a['lat'], (float) $a['lng']); $out['km'] = $km < 1 ? round($km, 1) : round($km); }
        return $out;
    }

    /** GET /artisans?trade=&lat=&lng=&district=&q= : nearest first when a position is given */
    public function index(): void
    {
        $u = Auth::require(); $q = $_GET;
        $at = (!empty($q['lat']) && !empty($q['lng'])) ? [(float) $q['lat'], (float) $q['lng']] : null;
        $where = ['a.available = 1', 'a.hidden_at IS NULL', 'u.deleted_at IS NULL']; $p = [];
        if (!empty($q['trade']) && isset(self::TRADES[$q['trade']])) { $where[] = 'a.trade = ?'; $p[] = $q['trade']; }
        if (!empty($q['district'])) { $where[] = 'a.base_district = ?'; $p[] = $q['district']; }
        if (!empty($q['q'])) { $where[] = '(a.business LIKE ? OR a.about LIKE ? OR u.name LIKE ?)'; $like = '%' . $q['q'] . '%'; array_push($p, $like, $like, $like); }
        $st = Db::pdo()->prepare('SELECT a.* FROM artisans a JOIN users u ON u.id = a.user_id WHERE ' . implode(' AND ', $where) . ' LIMIT 200'); $st->execute($p);
        $rows = array_map(fn($a) => $this->shape($a, $at), $st->fetchAll());
        if ($at) {
            // Inside their working radius first, then by distance; people with no position go last.
            usort($rows, function ($x, $y) {
                $xin = isset($x['km']) && $x['km'] <= $x['radiusKm']; $yin = isset($y['km']) && $y['km'] <= $y['radiusKm'];
                if ($xin !== $yin) return $xin ? -1 : 1;
                return ($x['km'] ?? 9999) <=> ($y['km'] ?? 9999);
            });
        } else usort($rows, fn($x, $y) => ($y['rating']['count'] <=> $x['rating']['count']) ?: ($y['jobs'] <=> $x['jobs']));
        Http::json(['artisans' => array_slice($rows, 0, 40), 'trades' => self::TRADES]);
    }

    /** GET /artisans/{id} */
    public function show(int $id): void
    {
        $u = Auth::require();
        $a = Db::one('SELECT * FROM artisans WHERE user_id = ?', [$id]); if (!$a) Http::json(['error' => 'not_found', 'message' => 'No artisan profile there.'], 404);
        $me = Db::one('SELECT lat, lng FROM users WHERE id = ?', [$u['id']]);
        Http::json(['artisan' => $this->shape($a, $me && $me['lat'] !== null ? [(float) $me['lat'], (float) $me['lng']] : null)]);
    }

    /** GET /artisans/me and POST /artisans/me : register or update your own listing */
    public function me(): void
    {
        $u = Auth::require();
        $a = Db::one('SELECT * FROM artisans WHERE user_id = ?', [$u['id']]);
        Http::json(['artisan' => $a ? $this->shape($a) : null, 'trades' => self::TRADES]);
    }
    /**
     * POST /artisans/me : register or update. Everything a customer needs to trust and find them:
     * owner and business name, trade and the jobs they do (and car makes, for mechanics), phones, a photo of
     * their face, where the workshop is (a map pin), how far they travel, hours, call-out fee, whether they come
     * to the customer and take night calls, and an ID photo that only admins see.
     */
    public function save(): void
    {
        $u = Auth::require(); $b = Http::body(); $e = [];
        $had = Db::one('SELECT * FROM artisans WHERE user_id = ?', [$u['id']]);
        $trade = (string) ($b['trade'] ?? ''); if (!isset(self::TRADES[$trade])) $e['trade'] = 'Pick your trade.';
        $owner = mb_substr(trim((string) ($b['ownerName'] ?? $u['name'] ?? '')), 0, 80); if (mb_strlen($owner) < 3) $e['ownerName'] = 'Your full name.';
        $phone = Validator::ngPhone((string) ($b['phone'] ?? ($u['phone'] ?? ''))); if (!$phone) $e['phone'] = 'A Nigerian phone number customers can call.';
        $wa = !empty($b['whatsapp']) ? Validator::ngPhone((string) $b['whatsapp']) : null;
        $lat = isset($b['lat']) ? (float) $b['lat'] : 0; $lng = isset($b['lng']) ? (float) $b['lng'] : 0;
        if ($lat < 8 || $lat > 10 || $lng < 6.5 || $lng > 8) $e['lat'] = 'Put the pin on your workshop so customers nearby can find you.';
        $photo = !empty($b['uploadId']) ? UploadsController::claim((int) $b['uploadId'], $u) : null;
        if (!$photo && !($had['photo_upload'] ?? null)) $e['photo'] = 'Add a clear photo of your face. Customers want to know who is coming.';
        if ($e) Http::json(['error' => 'validation', 'fields' => $e], 422);
        $idUp = !empty($b['idUploadId']) ? UploadsController::claim((int) $b['idUploadId'], $u) : null;
        $district = mb_substr(trim((string) ($b['district'] ?? '')), 0, 60) ?: (Osm::districtFor($lat, $lng) ?: ($u['district'] ?? 'Abuja'));
        $list = fn($k, $n) => json_encode(array_values(array_slice(array_filter(array_map(fn($x) => mb_substr(trim((string) $x), 0, 30), (array) ($b[$k] ?? []))), 0, $n)));
        $cols = [
            'trade' => $trade, 'business' => mb_substr(trim((string) ($b['business'] ?? '')), 0, 80) ?: null, 'owner_name' => $owner,
            'about' => mb_substr(trim((string) ($b['about'] ?? '')), 0, 600) ?: null, 'phone' => $phone, 'whatsapp' => $wa, 'base_district' => $district,
            'lat' => round($lat, 6), 'lng' => round($lng, 6), 'radius_km' => max(2, min(60, (int) ($b['radiusKm'] ?? 15))), 'years' => max(0, min(60, (int) ($b['years'] ?? 0))),
            'available' => empty($b['available']) ? 0 : 1, 'services' => $list('services', 20), 'brands' => $list('brands', 20),
            'mobile_service' => array_key_exists('mobileService', $b) ? (empty($b['mobileService']) ? 0 : 1) : 1, 'emergency' => empty($b['emergency']) ? 0 : 1,
            'hours' => mb_substr(trim((string) ($b['hours'] ?? '')), 0, 80) ?: null, 'callout_fee' => isset($b['calloutFee']) && $b['calloutFee'] !== '' ? max(0, (int) $b['calloutFee']) : null,
            'address' => mb_substr(trim((string) ($b['address'] ?? '')), 0, 160) ?: null, 'landmark' => mb_substr(trim((string) ($b['landmark'] ?? '')), 0, 160) ?: null,
            'updated_at' => Db::now(), 'last_online_at' => Db::now(),
        ];
        if ($photo) $cols['photo_upload'] = $photo;
        if ($idUp) $cols['id_upload'] = $idUp;
        if ($had) {
            Db::run('UPDATE artisans SET ' . implode(', ', array_map(fn($k) => "$k = ?", array_keys($cols))) . ' WHERE user_id = ?', array_merge(array_values($cols), [$u['id']]));
        } else {
            $cols['user_id'] = $u['id']; $cols['created_at'] = Db::now(); $cols['jobs_done'] = 0;
            Db::run('INSERT INTO artisans (' . implode(', ', array_keys($cols)) . ') VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')', array_values($cols));
            // Tell admins a new mechanic wants the verified badge
            foreach (Db::pdo()->query("SELECT id FROM users WHERE is_admin = 1 OR role = 'admin' LIMIT 5")->fetchAll() as $a) Notify::user((int) $a['id'], 'offers', 'New ' . strtolower(self::TRADES[$trade]) . ' registered', $owner . ($cols['business'] ? ', ' . $cols['business'] : '') . ' in ' . $district . ($idUp ? '. ID attached for checking.' : '.'), '/#/admin/artisans');
        }
        Track::hit($u, 'artisan', $had ? 'update' : 'register');
        $this->me();
    }

    /** POST /artisans/me/online { available } : the switch that decides whether they get jobs right now */
    public function online(): void
    {
        $u = Auth::require();
        if (!Db::one('SELECT user_id FROM artisans WHERE user_id = ?', [$u['id']])) Http::json(['error' => 'not_found', 'message' => 'Register as an artisan first.'], 404);
        Db::run('UPDATE artisans SET available = ?, last_online_at = ? WHERE user_id = ?', [empty(Http::body()['available']) ? 0 : 1, Db::now(), $u['id']]);
        $this->me();
    }

    /** POST /artisans/{id}/chat : opens (or reopens) a conversation, so in-app message and call work */
    public function chat(int $id): void
    {
        $u = Auth::require();
        if ((int) $u['id'] === $id) Http::json(['error' => 'self', 'message' => 'That is you.'], 422);
        if (!Db::one('SELECT user_id FROM artisans WHERE user_id = ?', [$id])) Http::json(['error' => 'not_found'], 404);
        $a = min((int) $u['id'], $id); $b = max((int) $u['id'], $id);
        $t = Db::one("SELECT id FROM threads WHERE kind = 'artisan' AND user_a = ? AND user_b = ?", [$a, $b]);
        if (!$t) { Db::run("INSERT INTO threads (kind, user_a, user_b, last_message_at, created_at) VALUES ('artisan', ?, ?, ?, ?)", [$a, $b, Db::now(), Db::now()]); $t = ['id' => Db::lastId()]; Db::run('UPDATE artisans SET jobs_done = jobs_done + 1 WHERE user_id = ?', [$id]); }
        Track::hit($u, 'artisan', 'contact');
        Http::json(['threadId' => (int) $t['id']]);
    }
}

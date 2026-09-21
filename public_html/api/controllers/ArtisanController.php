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
            'verified' => !empty($u['selfie_verified_at']), 'photo' => $a['photo_upload'] ? '/api/uploads/' . (int) $a['photo_upload'] : (Db::one('SELECT 1 AS x FROM avatars WHERE user_id = ?', [$a['user_id']]) ? '/api/avatar/' . (int) $a['user_id'] : null),
            'rating' => RatingController::summary((int) $a['user_id']), 'jobs' => (int) $a['jobs_done'], 'lat' => $a['lat'] !== null ? (float) $a['lat'] : null, 'lng' => $a['lng'] !== null ? (float) $a['lng'] : null];
        if ($at && $a['lat'] !== null) { $km = WakaRules::km($at[0], $at[1], (float) $a['lat'], (float) $a['lng']); $out['km'] = $km < 1 ? round($km, 1) : round($km); }
        return $out;
    }

    /** GET /artisans?trade=&lat=&lng=&district=&q= : nearest first when a position is given */
    public function index(): void
    {
        $u = Auth::require(); $q = $_GET;
        $at = (!empty($q['lat']) && !empty($q['lng'])) ? [(float) $q['lat'], (float) $q['lng']] : null;
        $where = ['a.available = 1', 'u.deleted_at IS NULL']; $p = [];
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
    public function save(): void
    {
        $u = Auth::require(); $b = Http::body(); $e = [];
        $trade = (string) ($b['trade'] ?? ''); if (!isset(self::TRADES[$trade])) $e['trade'] = 'Pick your trade.';
        $phone = Validator::ngPhone((string) ($b['phone'] ?? ($u['phone'] ?? ''))); if (!$phone) $e['phone'] = 'A Nigerian phone number people can call.';
        $wa = !empty($b['whatsapp']) ? Validator::ngPhone((string) $b['whatsapp']) : null;
        $district = mb_substr(trim((string) ($b['district'] ?? ($u['district'] ?? ''))), 0, 60); if ($district === '') $e['district'] = 'Where are you based?';
        if ($e) Http::json(['error' => 'validation', 'fields' => $e], 422);
        $photo = !empty($b['uploadId']) ? UploadsController::claim((int) $b['uploadId'], $u) : null;
        $vals = [$trade, mb_substr(trim((string) ($b['business'] ?? '')), 0, 80) ?: null, mb_substr(trim((string) ($b['about'] ?? '')), 0, 600) ?: null, $phone, $wa, $district,
            !empty($b['lat']) ? round((float) $b['lat'], 5) : null, !empty($b['lng']) ? round((float) $b['lng'], 5) : null, max(2, min(60, (int) ($b['radiusKm'] ?? 15))), max(0, min(60, (int) ($b['years'] ?? 0))), empty($b['available']) && array_key_exists('available', $b) ? 0 : 1];
        if (Db::one('SELECT user_id FROM artisans WHERE user_id = ?', [$u['id']])) {
            Db::run('UPDATE artisans SET trade=?, business=?, about=?, phone=?, whatsapp=?, base_district=?, lat=?, lng=?, radius_km=?, years=?, available=?, updated_at=?' . ($photo ? ', photo_upload=?' : '') . ' WHERE user_id = ?', array_merge($vals, [Db::now()], $photo ? [$photo] : [], [$u['id']]));
        } else {
            Db::run('INSERT INTO artisans (trade, business, about, phone, whatsapp, base_district, lat, lng, radius_km, years, available, photo_upload, created_at, updated_at, user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', array_merge($vals, [$photo, Db::now(), Db::now(), $u['id']]));
        }
        Track::hit($u, 'artisan', 'save');
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

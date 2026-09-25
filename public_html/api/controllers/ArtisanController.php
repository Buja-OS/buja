<?php
declare(strict_types=1);

/**
 * Artisans: the mechanic, plumber or electrician nearest to where you are standing, with a phone number
 * that works and ratings from people who actually used them.
 */
final class ArtisanController
{
    // Businesses first (food and deliveries can be ordered from and tracked), then trades that come to you.
    public const TRADES = ['restaurant' => 'Restaurant / food vendor', 'suya' => 'Suya & grills', 'bakery' => 'Bakery & cakes', 'drinks' => 'Drinks & lounge', 'grocery' => 'Groceries & provisions', 'water' => 'Water delivery', 'gas' => 'Cooking gas refill', 'events' => 'Events & decor', 'printing' => 'Printing & branding', 'photography' => 'Photographer', 'mechanic' => 'Mechanic', 'vulcanizer' => 'Vulcanizer / tyres', 'towing' => 'Towing', 'electrician' => 'Electrician', 'plumber' => 'Plumber', 'mason' => 'Mason / bricklayer', 'carpenter' => 'Carpenter', 'painter' => 'Painter', 'tiler' => 'Tiler', 'welder' => 'Welder', 'ac' => 'AC repair', 'generator' => 'Generator repair', 'solar' => 'Solar & inverter', 'cctv' => 'CCTV installer', 'dstv' => 'DStv / GOtv installer', 'phone' => 'Phone repair', 'laptop' => 'Laptop repair', 'carwash' => 'Car wash', 'laundry' => 'Laundry', 'cleaning' => 'Cleaning', 'errand' => 'Errand / dispatch', 'cook' => 'Cook / caterer', 'hair' => 'Hair & beauty', 'tailor' => 'Tailor', 'gardener' => 'Gardener', 'pest' => 'Pest control', 'locksmith' => 'Locksmith', 'movers' => 'Movers'];

    /** $contact: the artisan's own phone numbers, only for the artisan themselves. Everyone else reaches them inside Buja. */
    public function shape(array $a, ?array $at = null, bool $contact = false): array
    {
        $u = Db::one('SELECT * FROM users WHERE id = ?', [$a['user_id']]) ?: [];
        $out = ['id' => (int) $a['user_id'], 'name' => $a['business'] ?: explode(' ', trim((string) ($u['name'] ?? 'Artisan')))[0], 'person' => explode(' ', trim((string) ($u['name'] ?? '')))[0],
            'trade' => $a['trade'], 'tradeLabel' => self::TRADES[$a['trade']] ?? $a['trade'], 'about' => $a['about'], 'phone' => $contact ? $a['phone'] : null, 'whatsapp' => $contact ? ($a['whatsapp'] ?: $a['phone']) : null,
            'district' => $a['base_district'], 'radiusKm' => (int) $a['radius_km'], 'years' => (int) $a['years'], 'available' => (bool) $a['available'],
            'verified' => !empty($a['verified_at']) || !empty($u['selfie_verified_at']), 'bujaVerified' => !empty($a['verified_at']), 'photo' => $a['photo_upload'] ? '/api/uploads/' . (int) $a['photo_upload'] : (Db::one('SELECT 1 AS x FROM avatars WHERE user_id = ?', [$a['user_id']]) ? '/api/avatar/' . (int) $a['user_id'] : null),
            'rating' => RatingController::summary((int) $a['user_id'], 'artisan'), 'jobs' => (int) $a['jobs_done'], 'lat' => $a['lat'] !== null ? (float) $a['lat'] : null, 'lng' => $a['lng'] !== null ? (float) $a['lng'] : null,
            'owner' => $a['owner_name'] ?? null, 'services' => json_decode((string) ($a['services'] ?? '[]'), true) ?: [], 'brands' => json_decode((string) ($a['brands'] ?? '[]'), true) ?: [],
            'mobileService' => (bool) ($a['mobile_service'] ?? 1), 'emergency' => (bool) ($a['emergency'] ?? 0), 'hours' => $a['hours'] ?? null, 'calloutFee' => isset($a['callout_fee']) && $a['callout_fee'] !== null ? (int) $a['callout_fee'] : null,
            'address' => $a['address'] ?? null, 'landmark' => $a['landmark'] ?? null, 'hasId' => !empty($a['id_upload']),
            'onlineAgo' => !empty($a['last_online_at']) ? max(0, time() - strtotime($a['last_online_at'] . ' UTC')) : null,
            'onDuty' => ServiceJobController::onDuty($a['schedule'] ?? null), 'orderable' => in_array($a['trade'], ServiceJobController::ORDER_TRADES, true),
            'online' => Presence::shows($u) && !empty($u['last_seen_at']) && time() - strtotime($u['last_seen_at'] . ' UTC') <= Presence::ONLINE_SEC * 2];
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
        $sort = (string) ($q['sort'] ?? '');
        if ($sort === 'rating') usort($rows, fn($x, $y) => ((float) ($y['rating']['count'] ? $y['rating']['stars'] : 0) <=> (float) ($x['rating']['count'] ? $x['rating']['stars'] : 0)) ?: ($y['rating']['count'] <=> $x['rating']['count']) ?: (($x['km'] ?? 9999) <=> ($y['km'] ?? 9999)));
        elseif ($sort === 'open') usort($rows, fn($x, $y) => ((int) $y['onDuty'] <=> (int) $x['onDuty']) ?: ((int) $y['online'] <=> (int) $x['online']) ?: (($x['km'] ?? 9999) <=> ($y['km'] ?? 9999)));
        Http::json(['artisans' => array_slice($rows, 0, 40), 'trades' => self::TRADES]);
    }

    /** GET /artisans/{id} */
    public function show(int $id): void
    {
        $u = Auth::require();
        $a = Db::one('SELECT * FROM artisans WHERE user_id = ?', [$id]); if (!$a) Http::json(['error' => 'not_found', 'message' => 'No artisan profile there.'], 404);
        $me = Db::one('SELECT lat, lng FROM users WHERE id = ?', [$u['id']]);
        $out = $this->shape($a, $me && $me['lat'] !== null ? [(float) $me['lat'], (float) $me['lng']] : null);
        $out['orderable'] = in_array($a['trade'], ServiceJobController::ORDER_TRADES, true);
        $out['menu'] = $out['orderable'] ? self::menuOf($id, false) : [];
        $out['deliveryFee'] = isset($a['delivery_fee']) && $a['delivery_fee'] !== null ? (int) $a['delivery_fee'] : null;
        $out['minOrder'] = isset($a['min_order']) && $a['min_order'] !== null ? (int) $a['min_order'] : null;
        Http::json(['artisan' => $out]);
    }

    /* ---------------- Menus and price lists: restaurants, bakeries, grills, groceries, water, gas ---------------- */

    public static function menuOf(int $artisanId, bool $all): array
    {
        try {
            $st = Db::pdo()->prepare('SELECT * FROM artisan_menu WHERE artisan_id = ? AND deleted_at IS NULL' . ($all ? '' : ' AND available = 1') . ' ORDER BY sort, id');
            $st->execute([$artisanId]);
        } catch (Throwable $e) { return []; }
        return array_map(fn($m) => ['id' => (int) $m['id'], 'section' => $m['section'], 'name' => $m['name'], 'description' => $m['description'], 'price' => (int) $m['price'],
            'photo' => $m['photo_upload'] ? '/api/uploads/' . (int) $m['photo_upload'] : null, 'available' => (bool) $m['available']], $st->fetchAll());
    }
    private function mine(array $u): array
    {
        $a = Db::one('SELECT * FROM artisans WHERE user_id = ?', [$u['id']]);
        if (!$a) Http::json(['error' => 'not_found', 'message' => 'Register your business first.'], 404);
        if (!in_array($a['trade'], ServiceJobController::ORDER_TRADES, true)) Http::json(['error' => 'validation', 'message' => 'Menus are for food, drinks, groceries, water, gas, laundry and errands. Change your trade on your profile to add one.'], 422);
        return $a;
    }
    private function menuInput(array $b, array $u, ?array $old = null): array
    {
        $e = []; $row = [];
        if ($old === null || array_key_exists('name', $b)) { $n = mb_substr(trim((string) ($b['name'] ?? '')), 0, 80); if (mb_strlen($n) < 2) $e['name'] = 'Name the dish or item.'; $row['name'] = $n; }
        if ($old === null || array_key_exists('price', $b)) { $pr = (int) preg_replace('/\D+/', '', (string) ($b['price'] ?? '')); if ($pr < 50 || $pr > 2000000) $e['price'] = 'A price between ₦50 and ₦2,000,000.'; $row['price'] = $pr; }
        if (array_key_exists('section', $b)) $row['section'] = mb_substr(trim((string) $b['section']), 0, 40) ?: null;
        if (array_key_exists('description', $b)) $row['description'] = mb_substr(trim((string) $b['description']), 0, 240) ?: null;
        if (array_key_exists('available', $b)) $row['available'] = !empty($b['available']) ? 1 : 0;
        if (array_key_exists('sort', $b)) $row['sort'] = max(-999, min(999, (int) $b['sort']));
        if (!empty($b['uploadId'])) $row['photo_upload'] = UploadsController::claim((int) $b['uploadId'], $u);
        if (array_key_exists('removePhoto', $b) && $b['removePhoto']) $row['photo_upload'] = null;
        if ($e) Http::json(['error' => 'validation', 'fields' => $e], 422);
        return $row;
    }
    /** GET /artisans/me/menu */
    public function myMenu(): void
    {
        $u = Auth::require(); $a = $this->mine($u);
        Http::json(['menu' => self::menuOf((int) $u['id'], true), 'deliveryFee' => isset($a['delivery_fee']) ? ($a['delivery_fee'] !== null ? (int) $a['delivery_fee'] : null) : null, 'minOrder' => isset($a['min_order']) && $a['min_order'] !== null ? (int) $a['min_order'] : null]);
    }
    /** POST /artisans/me/menu { section, name, description, price, uploadId, available } */
    public function addMenuItem(): void
    {
        $u = Auth::require(); $this->mine($u); RateLimit::hit('menu', 200, 86400);
        if ((int) (Db::one('SELECT COUNT(*) AS n FROM artisan_menu WHERE artisan_id = ? AND deleted_at IS NULL', [$u['id']])['n'] ?? 0) >= 150) Http::json(['error' => 'validation', 'message' => 'A menu can hold 150 items.'], 422);
        $row = $this->menuInput(Http::body(), $u) + ['artisan_id' => $u['id'], 'available' => 1, 'created_at' => Db::now()];
        Db::run('INSERT INTO artisan_menu (' . implode(', ', array_keys($row)) . ') VALUES (' . implode(',', array_fill(0, count($row), '?')) . ')', array_values($row));
        Http::json(['menu' => self::menuOf((int) $u['id'], true)], 201);
    }
    /** PATCH /artisans/me/menu/{id} */
    public function updateMenuItem(int $id): void
    {
        $u = Auth::require(); $this->mine($u);
        $old = Db::one('SELECT * FROM artisan_menu WHERE id = ? AND artisan_id = ? AND deleted_at IS NULL', [$id, $u['id']]); if (!$old) Http::json(['error' => 'not_found'], 404);
        $row = $this->menuInput(Http::body(), $u, $old);
        if ($row) Db::run('UPDATE artisan_menu SET ' . implode(', ', array_map(fn($k) => "$k = ?", array_keys($row))) . ' WHERE id = ?', array_merge(array_values($row), [$id]));
        Http::json(['menu' => self::menuOf((int) $u['id'], true)]);
    }
    /** DELETE /artisans/me/menu/{id} */
    public function deleteMenuItem(int $id): void
    {
        $u = Auth::require();
        Db::run('UPDATE artisan_menu SET deleted_at = ? WHERE id = ? AND artisan_id = ?', [Db::now(), $id, $u['id']]);
        Http::json(['menu' => self::menuOf((int) $u['id'], true)]);
    }
    /** PATCH /artisans/me/delivery { deliveryFee, minOrder } */
    public function delivery(): void
    {
        $u = Auth::require(); $this->mine($u); $b = Http::body();
        $fee = !isset($b['deliveryFee']) || $b['deliveryFee'] === '' ? null : (int) preg_replace('/\D+/', '', (string) $b['deliveryFee']);
        $min = !isset($b['minOrder']) || $b['minOrder'] === null || $b['minOrder'] === '' ? null : (int) preg_replace('/\D+/', '', (string) $b['minOrder']);
        if ($fee !== null && $fee > 50000) Http::json(['error' => 'validation', 'fields' => ['deliveryFee' => 'Up to ₦50,000.']], 422);
        try { Db::run('UPDATE artisans SET delivery_fee = ?, min_order = ? WHERE user_id = ?', [$fee, $min ?: null, $u['id']]); }
        catch (Throwable $e) { Http::json(['error' => 'validation', 'message' => 'Delivery fees are coming very soon. Try again shortly.'], 422); }
        Http::json(['deliveryFee' => $fee, 'minOrder' => $min ?: null]);
    }

    /** GET /artisans/me and POST /artisans/me : register or update your own listing */
    public function me(): void
    {
        $u = Auth::require();
        $a = Db::one('SELECT * FROM artisans WHERE user_id = ?', [$u['id']]);
        Http::json(['artisan' => $a ? $this->shape($a, null, true) : null, 'trades' => self::TRADES]);
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
        if ($lat < 8 || $lat > 10 || $lng < 6.5 || $lng > 8) $e['lat'] = 'Put the pin on your workshop or shop so customers nearby can find you.';
        $photo = !empty($b['uploadId']) ? UploadsController::claim((int) $b['uploadId'], $u) : null;
        if (!$photo && !($had['photo_upload'] ?? null)) $e['photo'] = in_array($trade, ServiceJobController::ORDER_TRADES, true) ? 'Add a photo of you or your shop, so customers know who they are ordering from.' : 'Add a clear photo of your face. Customers want to know who is coming.';
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
            'hours' => mb_substr(trim((string) ($b['hours'] ?? '')), 0, 80) ?: null,
            'source' => $had ? ($had['source'] ?? null) : (preg_replace('/[^a-z0-9_-]/', '', strtolower((string) ($b['source'] ?? ''))) ?: null), 'callout_fee' => isset($b['calloutFee']) && $b['calloutFee'] !== '' ? max(0, (int) $b['calloutFee']) : null,
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

    /**
     * GET /artisans/dashboard : the mechanic's own view. Jobs and earnings this week and month (from prices customers
     * accepted), how quickly they answer, rating, no-shows, what is ringing now, recent jobs, and their hours.
     */
    public function dashboard(): void
    {
        $u = Auth::require();
        $a = Db::one('SELECT * FROM artisans WHERE user_id = ?', [$u['id']]); if (!$a) Http::json(['artisan' => null]);
        $span = function (int $days) use ($u): array {
            $since = gmdate('Y-m-d H:i:s', time() - $days * 86400);
            $r = Db::one("SELECT COUNT(*) AS jobs, SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done, SUM(CASE WHEN status = 'done' AND quote_status = 'accepted' THEN quote_amount ELSE 0 END) AS earned FROM service_jobs WHERE artisan_id = ? AND created_at > ? AND status NOT IN ('requested','expired','declined')", [$u['id'], $since]) ?: [];
            return ['jobs' => (int) ($r['jobs'] ?? 0), 'done' => (int) ($r['done'] ?? 0), 'earned' => (int) ($r['earned'] ?? 0)];
        };
        $rel = ServiceJobController::reliability((int) $u['id']);
        $offers = Db::pdo()->prepare("SELECT o.km, o.offered_at, j.id, j.problem, j.trade FROM job_offers o JOIN service_jobs j ON j.id = o.job_id WHERE o.artisan_id = ? AND o.status = 'offered' AND j.status = 'requested' ORDER BY o.offered_at DESC LIMIT 5");
        $offers->execute([$u['id']]);
        $recent = Db::pdo()->prepare("SELECT j.id, j.problem, j.status, j.created_at, j.quote_amount, j.quote_status, u.name FROM service_jobs j JOIN users u ON u.id = j.customer_id WHERE j.artisan_id = ? ORDER BY j.id DESC LIMIT 12");
        $recent->execute([$u['id']]);
        Http::json(['artisan' => ['name' => $a['business'] ?: $a['owner_name'], 'trade' => self::TRADES[$a['trade']] ?? $a['trade'], 'available' => (bool) $a['available'], 'verified' => !empty($a['verified_at']),
                'photo' => $a['photo_upload'] ? '/api/uploads/' . (int) $a['photo_upload'] : null, 'schedule' => $a['schedule'] ? json_decode($a['schedule'], true) : null, 'onDuty' => ServiceJobController::onDuty($a['schedule'] ?? null),
                'profileUrl' => rtrim((string) Http::config('app_origin'), '/') . '/#/artisans/' . (int) $u['id'], 'idSent' => !empty($a['id_upload']),
                'tradeKey' => $a['trade'], 'orderable' => in_array($a['trade'], ServiceJobController::ORDER_TRADES, true), 'menuCount' => count(self::menuOf((int) $u['id'], true)), 'deliveryFee' => isset($a['delivery_fee']) && $a['delivery_fee'] !== null ? (int) $a['delivery_fee'] : null],
            'week' => $span(7), 'month' => $span(30), 'reliability' => $rel,
            'offers' => array_map(fn($o) => ['id' => (int) $o['id'], 'problem' => $o['problem'], 'km' => round((float) $o['km'], 1), 'at' => $o['offered_at']], $offers->fetchAll()),
            'recent' => array_map(fn($r) => ['id' => (int) $r['id'], 'problem' => $r['problem'], 'status' => $r['status'], 'at' => $r['created_at'], 'customer' => explode(' ', trim((string) $r['name']))[0], 'price' => $r['quote_status'] === 'accepted' ? (int) $r['quote_amount'] : null], $recent->fetchAll())]);
    }

    /** POST /artisans/schedule { available, schedule: { mon: [8, 18], ... } | null } : on/off and working hours */
    public function schedule(): void
    {
        $u = Auth::require(); $b = Http::body();
        if (!Db::one('SELECT user_id FROM artisans WHERE user_id = ?', [$u['id']])) Http::json(['error' => 'not_found', 'message' => 'Register your trade first.'], 404);
        $clean = null;
        if (!empty($b['schedule']) && is_array($b['schedule'])) {
            $clean = [];
            foreach (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as $d) {
                $v = $b['schedule'][$d] ?? null;
                if (is_array($v) && count($v) === 2) { $f = max(0, min(24, (float) $v[0])); $t = max(0, min(24, (float) $v[1])); if ($f !== $t) $clean[$d] = [$f, $t]; }
            }
        }
        $sets = ['schedule = ?', 'updated_at = ?']; $vals = [$clean ? json_encode($clean) : null, Db::now()];
        if (array_key_exists('available', $b)) { $sets[] = 'available = ?'; $vals[] = empty($b['available']) ? 0 : 1; $sets[] = 'last_online_at = ?'; $vals[] = Db::now(); }
        $vals[] = $u['id'];
        Db::run('UPDATE artisans SET ' . implode(', ', $sets) . ' WHERE user_id = ?', $vals);
        $this->dashboard();
    }
}

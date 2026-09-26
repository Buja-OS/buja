<?php
declare(strict_types=1);

/**
 * "Mechanic near me": a customer asks a nearby artisan to come, the artisan accepts and shares live location
 * while travelling, the customer watches them approach with an ETA, and rates them when the job is done.
 *
 * Privacy: until the artisan accepts, they see only the customer's area (about 500 m), never the exact spot.
 * Location is shared only while a job is on the way; the trail is deleted a day after the job ends.
 * Live updates are plain HTTP polling, which works on a free host without websockets.
 */
final class ServiceJobController
{
    public const OPEN = ['requested', 'accepted', 'enroute', 'arrived'];
    public const ARRIVE_M = 80;          // within this many metres counts as arrived
    public const STOP_M = 25;            // moving less than this ...
    public const STOP_SEC = 180;         // ... for this long while on the way counts as stopped
    public const LOST_SEC = 75;          // no ping for this long: signal lost
    public const REQUEST_TTL_MIN = 20;   // unanswered requests expire
    public const RING_SIZE = 3;          // mechanics alerted at once
    public const RING_SEC = 60;          // wait this long before alerting the next ones
    public const MAX_RINGS = 5;
    /** Trades whose jobs are orders: prepared first, then brought to the customer (food, laundry, errands). */
    public const ORDER_TRADES = ['cook', 'laundry', 'errand', 'restaurant', 'suya', 'bakery', 'drinks', 'grocery', 'water', 'gas'];          // five rounds, widening each time, then the customer is told

    private function job(int $id, array $u): array
    {
        $j = Db::one('SELECT * FROM service_jobs WHERE id = ?', [$id]);
        $offered = $j && (int) $j['artisan_id'] !== (int) $u['id'] && (int) $j['customer_id'] !== (int) $u['id'] && ($j['mode'] ?? 'direct') === 'nearest' && $j['status'] === 'requested'
            && Db::one("SELECT 1 AS x FROM job_offers WHERE job_id = ? AND artisan_id = ? AND status = 'offered'", [$id, $u['id']]);
        if (!$j || ((int) $j['customer_id'] !== (int) $u['id'] && (int) $j['artisan_id'] !== (int) $u['id'] && !$offered)) Http::json(['error' => 'not_found', 'message' => 'That job is no longer available.'], 404);
        if (($j['mode'] ?? 'direct') === 'nearest' && $j['status'] === 'requested') { self::escalate($j); $j = Db::one('SELECT * FROM service_jobs WHERE id = ?', [$id]); }
        if ($j['status'] === 'requested' && strtotime($j['created_at'] . ' UTC') < time() - self::REQUEST_TTL_MIN * 60) {
            Db::run("UPDATE service_jobs SET status = 'expired' WHERE id = ? AND status = 'requested'", [$id]); $j['status'] = 'expired';
            OrderPay::sync($id);
        }
        return $j;
    }
    /** The FCT and its immediate edges (Mararaba, Madalla, Suleja): where a breakdown can be answered. */
    public static function inFct(float $lat, float $lng): bool { return $lat > 8.35 && $lat < 9.65 && $lng > 6.7 && $lng < 7.95; }
    private static function metres(float $a, float $b, float $c, float $d): float { return WakaRules::km($a, $b, $c, $d) * 1000; }
    private function shape(array $j, array $u): array
    {
        $isCustomer = (int) $j['customer_id'] === (int) $u['id'];
        $other = (int) ($isCustomer ? $j['artisan_id'] : $j['customer_id']);
        $pending = (int) $j['artisan_id'] === 0; // a nearest-mechanic request nobody has accepted yet
        if ($pending) $other = $isCustomer ? 0 : (int) $j['customer_id'];
        $o = Db::one('SELECT name, phone FROM users WHERE id = ?', [$other]);
        $art = Db::one('SELECT business, trade, phone FROM artisans WHERE user_id = ?', [$j['artisan_id']]);
        $accepted = !in_array($j['status'], ['requested', 'declined', 'expired'], true) || (!$isCustomer && false);
        $showExact = $isCustomer || in_array($j['status'], ['accepted', 'enroute', 'arrived', 'done'], true);
        $now = time();
        $live = null;
        if ($j['a_lat'] !== null && in_array($j['status'], ['enroute', 'arrived'], true)) {
            $age = $now - strtotime($j['a_at'] . ' UTC');
            $stoppedFor = $j['moved_at'] ? $now - strtotime($j['moved_at'] . ' UTC') : 0;
            $live = ['lat' => (float) $j['a_lat'], 'lng' => (float) $j['a_lng'], 'heading' => $j['a_heading'] !== null ? (int) $j['a_heading'] : null, 'speedKmh' => $j['a_speed'] !== null ? round((float) $j['a_speed'] * 3.6) : null,
                'age' => $age, 'lost' => $age > self::LOST_SEC, 'stopped' => $j['status'] === 'enroute' && $stoppedFor >= self::STOP_SEC && $age <= self::LOST_SEC, 'stoppedMin' => (int) floor($stoppedFor / 60),
                'etaMin' => $j['eta_min'] !== null ? (int) $j['eta_min'] : null, 'etaAt' => $j['eta_at'], 'routeKm' => $j['route_km'] !== null ? (float) $j['route_km'] : null,
                'metres' => (int) round(self::metres((float) $j['a_lat'], (float) $j['a_lng'], (float) $j['lat'], (float) $j['lng']))];
        }
        // Orders: a preparing stage with a ready time, and an arrival estimate from the moment it is accepted
        $kind = $j['kind'] ?? 'callout'; $prep = null; $etaTotal = null;
        if (!empty($j['ready_at']) && $j['status'] === 'accepted') { $left = max(0, (int) ceil((strtotime($j['ready_at'] . ' UTC') - $now) / 60)); $prep = ['readyAt' => $j['ready_at'], 'minutesLeft' => $left, 'minutes' => (int) ($j['prep_min'] ?? 0)]; }
        if ($j['status'] === 'accepted') {
            $base = Db::one('SELECT lat, lng FROM artisans WHERE user_id = ?', [$j['artisan_id']]);
            if ($base && $base['lat'] !== null) $etaTotal = ($prep ? $prep['minutesLeft'] : 0) + LiveTrack::guessMinutes(WakaRules::km((float) $base['lat'], (float) $base['lng'], (float) $j['lat'], (float) $j['lng']));
        } elseif ($live && $live['etaMin'] !== null) $etaTotal = $live['etaMin'];
        return [
            'kind' => $kind, 'prep' => $prep, 'etaTotalMin' => $etaTotal, 'payMode' => $j['pay_mode'] ?? null, 'pay' => ($j['pay_mode'] ?? '') === 'online' ? OrderPay::shape((int) $j['id']) : null,
            'items' => !empty($j['items_json']) ? (json_decode((string) $j['items_json'], true) ?: null) : null, 'subtotal' => isset($j['subtotal']) && $j['subtotal'] !== null ? (int) $j['subtotal'] : null, 'deliveryFee' => isset($j['delivery_fee']) && $j['delivery_fee'] !== null ? (int) $j['delivery_fee'] : null,
            'id' => (int) $j['id'], 'status' => $j['status'], 'role' => $isCustomer ? 'customer' : 'artisan', 'trade' => $j['trade'], 'tradeLabel' => ArtisanController::TRADES[$j['trade']] ?? $j['trade'],
            'problem' => $j['problem'], 'landmark' => $showExact ? $j['landmark'] : null,
            'place' => $showExact ? ['lat' => (float) $j['lat'], 'lng' => (float) $j['lng'], 'exact' => true] : ['lat' => round((float) $j['lat'] / 0.005) * 0.005, 'lng' => round((float) $j['lng'] / 0.005) * 0.005, 'exact' => false],
            'mode' => $j['mode'] ?? 'direct', 'accuracyM' => isset($j['accuracy_m']) && $j['accuracy_m'] !== null ? (int) $j['accuracy_m'] : null,
            'quote' => !empty($j['quote_amount']) ? ['amount' => (int) $j['quote_amount'], 'note' => $j['quote_note'] ?? null, 'status' => $j['quote_status'] ?? 'sent', 'at' => $j['quoted_at'] ?? null] : null,
            'dispatch' => ($j['mode'] ?? '') === 'nearest' ? ['ring' => (int) $j['ring'], 'maxRings' => self::MAX_RINGS, 'alerted' => (int) (Db::one('SELECT COUNT(*) AS n FROM job_offers WHERE job_id = ?', [$j['id']])['n'] ?? 0), 'declined' => (int) (Db::one("SELECT COUNT(*) AS n FROM job_offers WHERE job_id = ? AND status = 'declined'", [$j['id']])['n'] ?? 0)] : null,
            'photo' => $isCustomer && !$pending ? (($p = Db::one('SELECT photo_upload FROM artisans WHERE user_id = ?', [$j['artisan_id']])) && $p['photo_upload'] ? '/api/uploads/' . (int) $p['photo_upload'] : Auth::picture((int) $j['artisan_id'])) : null,
            'other' => ($pending && $isCustomer) ? ['id' => 0, 'name' => 'Finding the nearest ' . strtolower(ArtisanController::TRADES[$j['trade']] ?? 'hand'), 'phone' => null, 'avatar' => null, 'rating' => ['count' => 0]] : ['id' => $other, 'name' => $isCustomer ? ($art['business'] ?: explode(' ', trim((string) ($o['name'] ?? '')))[0]) : explode(' ', trim((string) ($o['name'] ?? '')))[0],
                'phone' => null,   // calls go through Buja (the chat thread below), never a phone number
                'avatar' => Auth::picture($other), 'rating' => RatingController::summary($other, $isCustomer ? 'artisan' : null)],
            'live' => $live, 'route' => ($live && $j['route_json']) ? json_decode($j['route_json'], true) : null,
            'threadId' => $j['thread_id'] ? (int) $j['thread_id'] : null, 'rated' => (bool) $j['rated'],
            'times' => ['created' => $j['created_at'], 'accepted' => $j['accepted_at'], 'started' => $j['started_at'], 'arrived' => $j['arrived_at'], 'done' => $j['done_at']],
            'km' => (function () use ($j) { $from = $j['a_lat'] !== null ? ['lat' => $j['a_lat'], 'lng' => $j['a_lng']] : Db::one('SELECT lat, lng FROM artisans WHERE user_id = ?', [$j['artisan_id']]); return ($from && $from['lat'] !== null) ? round(WakaRules::km((float) $j['lat'], (float) $j['lng'], (float) $from['lat'], (float) $from['lng']), 1) : null; })(),
        ];
    }

    /** GET /service-jobs : mine, open first, as customer and as artisan */
    public function index(): void
    {
        $u = Auth::require();
        $st = Db::pdo()->prepare('SELECT * FROM service_jobs WHERE customer_id = ? OR artisan_id = ? ORDER BY id DESC LIMIT 40'); $st->execute([$u['id'], $u['id']]);
        $rows = array_map(fn($j) => $this->shape($this->job((int) $j['id'], $u), $u), $st->fetchAll());
        usort($rows, fn($a, $b) => (in_array($b['status'], self::OPEN, true) <=> in_array($a['status'], self::OPEN, true)) ?: ($b['id'] <=> $a['id']));
        Http::json(['jobs' => $rows]);
    }

    /** Checks ordered items against the live menu. Returns [items with names and prices, subtotal] or [null, 0]. */
    public static function priceItems(int $artisanId, array $want): array
    {
        $qty = [];
        foreach ($want as $w) { $id = (int) ($w['id'] ?? 0); $q = (int) ($w['qty'] ?? 0); if ($id > 0 && $q > 0) $qty[$id] = min(50, ($qty[$id] ?? 0) + $q); }
        if (!$qty || count($qty) > 40) return [null, 0];
        try {
            $st = Db::pdo()->prepare('SELECT id, name, price FROM artisan_menu WHERE artisan_id = ? AND deleted_at IS NULL AND available = 1 AND id IN (' . implode(',', array_map('intval', array_keys($qty))) . ')');
            $st->execute([$artisanId]);
        } catch (Throwable $e) { return [null, 0]; }
        $items = []; $sum = 0;
        foreach ($st->fetchAll() as $r) { $n = $qty[(int) $r['id']]; $items[] = ['id' => (int) $r['id'], 'name' => $r['name'], 'price' => (int) $r['price'], 'qty' => $n]; $sum += (int) $r['price'] * $n; }
        if (count($items) !== count($qty)) return [null, 0];   // something was taken off the menu: ask the customer to look again
        return [$items, $sum];
    }

    /**
     * Checks a request or order and returns it ready to save: who, where, what, and for a menu order the items
     * priced from the business's own menu. Stops with a clear message when something is wrong.
     */
    public static function prepare(array $u, array $b): array
    {
        $aid = (int) ($b['artisanId'] ?? 0);
        if ($aid === (int) $u['id']) Http::json(['error' => 'validation', 'message' => 'You cannot book yourself.'], 422);
        $a = Db::one('SELECT * FROM artisans WHERE user_id = ? AND hidden_at IS NULL', [$aid]); if (!$a) Http::json(['error' => 'not_found', 'message' => 'That artisan is not listed.'], 404);
        if (!(int) $a['available']) Http::json(['error' => 'validation', 'message' => 'They are not taking jobs right now. Try another, or let Buja find the nearest.'], 422);
        if (!empty($a['busy_until']) && $a['busy_until'] > Db::now()) { $t = (new DateTime($a['busy_until'] . ' UTC'))->setTimezone(new DateTimeZone('Africa/Lagos'))->format('g:ia'); Http::json(['error' => 'validation', 'message' => 'They are very busy right now and have paused new orders until ' . $t . '. Try again then, or order from another place.'], 422); }
        $lat = (float) ($b['lat'] ?? 0); $lng = (float) ($b['lng'] ?? 0);
        if (!self::inFct($lat, $lng)) Http::json(['error' => 'validation', 'message' => 'Your location is outside the FCT. Buja businesses and artisans work inside Abuja; on a phone, turn on GPS so the pin is exact.'], 422);
        // A menu order: the items and prices come from the business's menu here, never from the phone.
        $items = null; $subtotal = null; $fee = null;
        if (!empty($b['items']) && is_array($b['items'])) {
            [$items, $subtotal] = self::priceItems($aid, $b['items']);
            if (!$items) Http::json(['error' => 'validation', 'message' => 'Those items are no longer on the menu. Refresh and try again.'], 422);
            $fee = isset($a['delivery_fee']) && $a['delivery_fee'] !== null ? (int) $a['delivery_fee'] : 0;
            if (!empty($a['min_order']) && $subtotal < (int) $a['min_order']) Http::json(['error' => 'validation', 'message' => 'The smallest order here is ₦' . number_format((int) $a['min_order']) . '.'], 422);
            $note = mb_substr(trim((string) ($b['problem'] ?? '')), 0, 160);
            $b['problem'] = implode(', ', array_map(fn($i) => $i['qty'] . '× ' . $i['name'], $items)) . ($note !== '' ? '. Note: ' . $note : '');
        }
        $problem = mb_substr(trim((string) ($b['problem'] ?? '')), 0, 400); if (mb_strlen($problem) < 5) { $msg = in_array($a['trade'], self::ORDER_TRADES, true) ? 'Say what you would like in a few words.' : 'Say what is wrong in a few words.'; Http::json(['error' => 'validation', 'message' => $msg, 'fields' => ['problem' => $msg]], 422); }
        if (Db::one("SELECT id FROM service_jobs WHERE customer_id = ? AND artisan_id = ? AND status IN ('requested','accepted','enroute','arrived')", [$u['id'], $aid])) Http::json(['error' => 'validation', 'message' => 'You already have an open job with them.'], 409);
        return ['artisanId' => $aid, 'trade' => $a['trade'], 'lat' => round($lat, 6), 'lng' => round($lng, 6), 'landmark' => mb_substr(trim((string) ($b['landmark'] ?? '')), 0, 160) ?: null, 'problem' => $problem,
            'items' => $items, 'subtotal' => $subtotal, 'deliveryFee' => $fee, 'isOrder' => in_array($a['trade'], self::ORDER_TRADES, true) && ($b['kind'] ?? 'order') === 'order'];
    }

    /** Saves a checked request or order and tells the business. Used directly, and once an in-app payment clears. */
    public static function insert(array $u, array $o, ?string $payMode = null): int
    {
        $aid = (int) $o['artisanId']; $a = Db::one('SELECT * FROM artisans WHERE user_id = ?', [$aid]) ?: ['lat' => null, 'lng' => null, 'trade' => $o['trade']];
        Db::run('INSERT INTO service_jobs (customer_id, artisan_id, trade, problem, lat, lng, landmark, created_at) VALUES (?,?,?,?,?,?,?,?)', [$u['id'], $aid, $o['trade'], $o['problem'], $o['lat'], $o['lng'], $o['landmark'], Db::now()]);
        $id = (int) Db::lastId();
        if ($o['isOrder']) { try { Db::run("UPDATE service_jobs SET kind = 'order' WHERE id = ?", [$id]); } catch (Throwable $e) {} }   // before migration 040 it simply stays a call-out
        $items = $o['items']; $subtotal = (int) ($o['subtotal'] ?? 0); $fee = (int) ($o['deliveryFee'] ?? 0);
        if ($items) {   // the price is agreed by the menu: recorded as an accepted quote, so both sides see the same total
            try { Db::run("UPDATE service_jobs SET items_json = ?, subtotal = ?, delivery_fee = ?, quote_amount = ?, quote_note = ?, quote_status = 'accepted', quoted_at = ? WHERE id = ?", [json_encode($items, JSON_UNESCAPED_UNICODE), $subtotal, $fee, $subtotal + $fee, $payMode === 'online' ? 'Menu order, paid in the app' : 'Menu order', Db::now(), $id]); } catch (Throwable $e) {}
        }
        if ($payMode) { try { Db::run('UPDATE service_jobs SET pay_mode = ? WHERE id = ?', [$payMode, $id]); } catch (Throwable $e) {} }
        $km = WakaRules::km((float) ($a['lat'] ?? $o['lat']), (float) ($a['lng'] ?? $o['lng']), (float) $o['lat'], (float) $o['lng']);
        $who = explode(' ', trim((string) $u['name']))[0]; $far = ($km < 1 ? 'under 1' : round($km)) . ' km away';
        Notify::user($aid, 'work', $o['isOrder'] ? ($payMode === 'online' ? 'New paid order from ' : 'New order from ') . $who . ($items ? ' · ₦' . number_format($subtotal + $fee) : '') . ', ' . $far : $who . ' needs a ' . strtolower(ArtisanController::TRADES[$o['trade']] ?? 'hand') . ' about ' . $far, mb_substr($o['problem'], 0, 90) . ' Tap to accept or decline.', '/#/jobs/' . $id, true);
        Track::hit($u, 'artisan', 'job_request');
        return $id;
    }

    /** POST /service-jobs { artisanId, problem, lat, lng, landmark, items: [{id, qty}], pay: 'online' | 'delivery' } */
    public function create(): void
    {
        $u = Auth::require(); RateLimit::hit('servicejob', 8, 3600); $b = Http::body();
        $o = self::prepare($u, $b);
        if (($b['pay'] ?? '') === 'online') {
            if (!$o['items']) Http::json(['error' => 'validation', 'message' => 'Paying in the app works for orders from a menu. For anything else, agree the price with them first.'], 422);
            $r = OrderPay::start($u, $o);
            Http::json(['payUrl' => $r['url'], 'reference' => $r['reference'], 'total' => $r['total'], 'fee' => $r['fee']], 201);
        }
        Http::json(['id' => self::insert($u, $o, $o['items'] ? 'delivery' : null)], 201);
    }

    /** GET /service-jobs/{id} : polled every few seconds by both sides */
    public function show(int $id): void { $u = Auth::require(); Http::json(['job' => $this->shape($this->job($id, $u), $u)]); }

    /** POST /service-jobs/{id}/{action} : accept, decline, start, arrived, done, cancel */
    public function act(int $id, string $action): void
    {
        $u = Auth::require(); $j = $this->job($id, $u);
        $isArtisan = (int) $j['artisan_id'] === (int) $u['id']; $isCustomer = !$isArtisan;
        $biz = $isArtisan ? (Db::one('SELECT business FROM artisans WHERE user_id = ?', [$u['id']])['business'] ?? '') : '';
        $name = $biz ?: explode(' ', trim((string) $u['name']))[0];
        $to = (int) ($isArtisan ? $j['customer_id'] : $j['artisan_id']);
        $url = '/#/jobs/' . $id;
        $bad = fn() => Http::json(['error' => 'validation', 'message' => 'That is not possible at this stage (' . $j['status'] . ').'], 422);
        switch ($action) {
            case 'accept':
                if (($j['mode'] ?? 'direct') === 'nearest' && (int) $j['artisan_id'] !== (int) $u['id']) {
                    // First to accept wins: one guarded update decides, even if two mechanics tap at the same instant.
                    $won = Db::run("UPDATE service_jobs SET artisan_id = ? WHERE id = ? AND status = 'requested' AND artisan_id = 0", [$u['id'], $id]);
                    if ($won !== 1) { Db::run("UPDATE job_offers SET status = 'taken', answered_at = ? WHERE job_id = ? AND artisan_id = ?", [Db::now(), $id, $u['id']]); Http::json(['error' => 'taken', 'message' => 'Another mechanic took this one a moment ago.'], 409); }
                    Db::run("UPDATE job_offers SET status = 'won', answered_at = ? WHERE job_id = ? AND artisan_id = ?", [Db::now(), $id, $u['id']]);
                    Db::run("UPDATE job_offers SET status = 'taken' WHERE job_id = ? AND artisan_id <> ? AND status = 'offered'", [$id, $u['id']]);
                    $j = Db::one('SELECT * FROM service_jobs WHERE id = ?', [$id]); $isArtisan = true; $to = (int) $j['customer_id'];
                    $name = (Db::one('SELECT business FROM artisans WHERE user_id = ?', [$u['id']])['business'] ?? '') ?: explode(' ', trim((string) $u['name']))[0];
                }
                if (!$isArtisan || $j['status'] !== 'requested') $bad();
                $a = min((int) $j['customer_id'], (int) $j['artisan_id']); $b = max((int) $j['customer_id'], (int) $j['artisan_id']);
                $t = Db::one("SELECT id FROM threads WHERE kind = 'artisan' AND user_a = ? AND user_b = ?", [$a, $b]);
                if (!$t) { Db::run("INSERT INTO threads (kind, user_a, user_b, last_message_at, created_at) VALUES ('artisan', ?, ?, ?, ?)", [$a, $b, Db::now(), Db::now()]); $tid = (int) Db::lastId(); } else $tid = (int) $t['id'];
                Db::run("UPDATE service_jobs SET status = 'accepted', accepted_at = ?, thread_id = ? WHERE id = ?", [Db::now(), $tid, $id]);
                Notify::user($to, 'work', ($j['kind'] ?? '') === 'order' ? $name . ' accepted your order' : $name . ' accepted your job', ($j['kind'] ?? '') === 'order' ? 'They will tell you when it will be ready, then you can watch it come.' : 'They will set off soon. You can follow them on the map.', $url, true);
                break;
            case 'decline':
                if (($j['mode'] ?? 'direct') === 'nearest' && (int) $j['artisan_id'] !== (int) $u['id']) {
                    Db::run("UPDATE job_offers SET status = 'declined', answered_at = ? WHERE job_id = ? AND artisan_id = ? AND status = 'offered'", [Db::now(), $id, $u['id']]);
                    self::escalate(Db::one('SELECT * FROM service_jobs WHERE id = ?', [$id]));
                    Http::json(['ok' => true, 'declined' => true]);
                }
                if (!$isArtisan || $j['status'] !== 'requested') $bad();
                Db::run("UPDATE service_jobs SET status = 'declined' WHERE id = ?", [$id]);
                Notify::user($to, 'work', $name . ' cannot come this time', 'Try another one near you.', '/#/artisans/map?trade=' . $j['trade'], true);
                break;
            case 'prepare':
                // an order is being made: the customer sees a countdown, then live tracking once it leaves
                if (!$isArtisan || $j['status'] !== 'accepted') $bad();
                $mins = max(5, min(240, (int) (Http::body()['minutes'] ?? 20)));
                Db::run('UPDATE service_jobs SET ready_at = ?, prep_min = ? WHERE id = ?', [gmdate('Y-m-d H:i:s', time() + $mins * 60), $mins, $id]);
                Notify::user($to, 'work', $name . ' is preparing your order', 'Ready in about ' . $mins . ' minutes. You will see it on the map when it leaves.', $url, true);
                break;
            case 'start':
                if (!$isArtisan || !in_array($j['status'], ['accepted', 'enroute'], true)) $bad();
                $b = Http::body();
                Db::run("UPDATE service_jobs SET status = 'enroute', started_at = COALESCE(started_at, ?) WHERE id = ?", [Db::now(), $id]);
                if (!empty($b['lat'])) $this->recordPing($id, (float) $b['lat'], (float) $b['lng'], null, null, true);
                if ($j['status'] === 'accepted') Notify::user($to, 'work', ($j['kind'] ?? '') === 'order' ? 'Your order is on the way' : $name . ' is on the way', 'Tap to watch it come and see when it will arrive.', $url, true);
                break;
            case 'arrived':
                if (!$isArtisan || $j['status'] !== 'enroute') $bad();
                Db::run("UPDATE service_jobs SET status = 'arrived', arrived_at = ? WHERE id = ?", [Db::now(), $id]);
                Notify::user($to, 'work', $name . ' has arrived', 'They are at your location.', $url, true);
                break;
            case 'done':
                if (!in_array($j['status'], ['arrived', 'enroute', 'accepted'], true)) $bad();
                Db::run("UPDATE service_jobs SET status = 'done', done_at = ? WHERE id = ?", [Db::now(), $id]);
                Db::run('UPDATE artisans SET jobs_done = jobs_done + 1 WHERE user_id = ?', [$j['artisan_id']]);
                Db::run('DELETE FROM service_trail WHERE job_id = ?', [$id]);
                if ($isArtisan) Notify::user($to, 'work', 'Job marked done', 'How did ' . $name . ' do? Rate them so others know.', $url, true);
                break;
            case 'received':
                // the customer has the order: the business is paid now instead of a day later
                if ($isArtisan || !in_array($j['status'], ['arrived', 'done', 'enroute'], true)) $bad();
                if ($j['status'] !== 'done') { Db::run("UPDATE service_jobs SET status = 'done', done_at = ? WHERE id = ?", [Db::now(), $id]); Db::run('UPDATE artisans SET jobs_done = jobs_done + 1 WHERE user_id = ?', [$j['artisan_id']]); Db::run('DELETE FROM service_trail WHERE job_id = ?', [$id]); }
                OrderPay::sync($id, true);
                break;
            case 'problem':
                if ($isArtisan) $bad();
                OrderPay::dispute($id, $u, (string) (Http::body()['note'] ?? ''));
                break;
            case 'cancel':
                if (!in_array($j['status'], ['requested', 'accepted', 'enroute'], true)) $bad();
                if (!$isArtisan && ($j['pay_mode'] ?? '') === 'online' && $j['status'] !== 'requested') Http::json(['error' => 'validation', 'message' => 'They have started on your order. Message them first; if they agree, they can cancel it and you get all your money back.'], 422);
                Db::run("UPDATE service_jobs SET status = 'cancelled', cancelled_by = ? WHERE id = ?", [$u['id'], $id]);
                Db::run('DELETE FROM service_trail WHERE job_id = ?', [$id]);
                Notify::user($to, 'work', 'Job cancelled', $name . ' cancelled the job.', $url);
                break;
            default: Http::json(['error' => 'not_found'], 404);
        }
        Track::hit($u, 'artisan', 'job_' . $action);
        OrderPay::sync($id);
        $this->show($id);
    }

    /** POST /service-jobs/{id}/ping { lat, lng, heading, speed } : the artisan's phone, every few seconds while on the way */
    public function ping(int $id): void
    {
        $u = Auth::require(); $j = $this->job($id, $u);
        if ((int) $j['artisan_id'] !== (int) $u['id']) Http::json(['error' => 'forbidden'], 403);
        if (!in_array($j['status'], ['enroute', 'arrived'], true)) Http::json(['job' => $this->shape($j, $u), 'stop' => true]); // tells the phone to stop sharing
        $b = Http::body(); $lat = (float) ($b['lat'] ?? 0); $lng = (float) ($b['lng'] ?? 0);
        if ($lat < 8 || $lat > 10 || $lng < 6.5 || $lng > 8) Http::json(['error' => 'validation'], 422);
        $this->recordPing($id, $lat, $lng, isset($b['heading']) ? (int) $b['heading'] : null, isset($b['speed']) ? (float) $b['speed'] : null, false);
        Http::json(['job' => $this->shape(Db::one('SELECT * FROM service_jobs WHERE id = ?', [$id]), $u)]);
    }

    /** Stores a position; updates "moved" time, the road route and ETA when useful, and auto-arrives. */
    private function recordPing(int $id, float $lat, float $lng, ?int $heading, ?float $speed, bool $force): void
    {
        $j = Db::one('SELECT * FROM service_jobs WHERE id = ?', [$id]); $now = Db::now();
        $moved = $j['a_lat'] === null || self::metres((float) $j['a_lat'], (float) $j['a_lng'], $lat, $lng) >= self::STOP_M;
        // Heading from movement when the phone does not report one
        if ($heading === null && $j['a_lat'] !== null && $moved) { $y = sin(deg2rad($lng - (float) $j['a_lng'])) * cos(deg2rad($lat)); $x = cos(deg2rad((float) $j['a_lat'])) * sin(deg2rad($lat)) - sin(deg2rad((float) $j['a_lat'])) * cos(deg2rad($lat)) * cos(deg2rad($lng - (float) $j['a_lng'])); $heading = ((int) round(rad2deg(atan2($y, $x))) + 360) % 360; }
        Db::run('UPDATE service_jobs SET a_lat = ?, a_lng = ?, a_heading = COALESCE(?, a_heading), a_speed = ?, a_at = ?' . ($moved || $j['moved_at'] === null ? ', moved_at = ?' : '') . ' WHERE id = ?',
            array_merge([round($lat, 6), round($lng, 6), $heading, $speed, $now], $moved || $j['moved_at'] === null ? [$now] : [], [$id]));
        if ($moved) Db::run('INSERT INTO service_trail (job_id, lat, lng, at) VALUES (?,?,?,?)', [$id, round($lat, 6), round($lng, 6), $now]);
        $dist = self::metres($lat, $lng, (float) $j['lat'], (float) $j['lng']);
        // Road route and ETA: at the start, then every 90 s or after 400 m of movement, so the free router is not hammered.
        $lastRouteAge = $j['route_at'] ? time() - strtotime($j['route_at'] . ' UTC') : 99999;
        $movedSinceRoute = $j['route_json'] ? (function () use ($j, $lat, $lng) { $r = json_decode($j['route_json'], true); $p = $r[0] ?? null; return $p ? self::metres((float) $p[1], (float) $p[0], $lat, $lng) : 99999; })() : 99999;
        if ($force || $lastRouteAge > 90 || $movedSinceRoute > 400) {
            $r = Routing::route([[$lat, $lng], [(float) $j['lat'], (float) $j['lng']]]);
            Db::run('UPDATE service_jobs SET route_json = ?, route_at = ?, route_km = ?, eta_min = ?, eta_at = ? WHERE id = ?', [json_encode($r['coords']), $now, $r['km'], $r['minutes'], gmdate('Y-m-d H:i:s', time() + $r['minutes'] * 60), $id]);
        } elseif ($j['route_km'] !== null && (float) $j['route_km'] > 0) {
            // Between routings, scale the last ETA by how much straight-line distance is left
            $share = min(1.0, ($dist / 1000 * WakaFares::ROAD_FACTOR) / max(0.05, (float) $j['route_km']));
            $eta = max(1, (int) round((int) $j['eta_min'] * $share));
            Db::run('UPDATE service_jobs SET eta_min = ?, eta_at = ? WHERE id = ?', [$eta, gmdate('Y-m-d H:i:s', time() + $eta * 60), $id]);
        }
        if ($j['status'] === 'enroute' && $dist <= self::ARRIVE_M) {
            Db::run("UPDATE service_jobs SET status = 'arrived', arrived_at = ?, eta_min = 0 WHERE id = ?", [$now, $id]);
            $name = (Db::one('SELECT business FROM artisans WHERE user_id = ?', [$j['artisan_id']])['business'] ?? '') ?: explode(' ', trim((string) (Db::one('SELECT name FROM users WHERE id = ?', [$j['artisan_id']])['name'] ?? 'They')))[0];
            Notify::user((int) $j['customer_id'], 'work', ($j['kind'] ?? '') === 'order' ? 'Your order has arrived' : $name . ' has arrived', ($j['kind'] ?? '') === 'order' ? $name . ' is at your location with it.' : 'They are at your location.', '/#/jobs/' . $id, true);
        }
    }

    /* ------------------------------------------------ NEAREST-MECHANIC DISPATCH ------------------------------------------------ */

    /**
     * POST /service-jobs/nearest { trade, problem, lat, lng, accuracy, landmark }
     * The breakdown button: no need to choose someone. The request goes to the closest available mechanics, a few
     * at a time, widening every minute, and the first to accept gets the job.
     */
    public function nearest(): void
    {
        $u = Auth::require(); RateLimit::hit('servicejob', 8, 3600); $b = Http::body();
        $trade = (string) ($b['trade'] ?? 'mechanic'); if (!isset(ArtisanController::TRADES[$trade])) Http::json(['error' => 'validation', 'message' => 'Which kind of help?'], 422);
        $lat = (float) ($b['lat'] ?? 0); $lng = (float) ($b['lng'] ?? 0);
        if (!self::inFct($lat, $lng)) Http::json(['error' => 'validation', 'message' => 'Turn on location and place the pin where you are. Buja works inside the FCT.'], 422);
        $problem = mb_substr(trim((string) ($b['problem'] ?? '')), 0, 400); if (mb_strlen($problem) < 5) Http::json(['error' => 'validation', 'fields' => ['problem' => 'Say what is wrong in a few words.']], 422);
        if ($open = Db::one("SELECT id FROM service_jobs WHERE customer_id = ? AND mode = 'nearest' AND status IN ('requested','accepted','enroute','arrived')", [$u['id']])) Http::json(['error' => 'open', 'message' => 'You already have a request running.', 'id' => (int) $open['id']], 409);
        $pref = isset($b['preferredId']) ? (int) $b['preferredId'] : 0;
        if ($pref && !Db::one('SELECT user_id FROM artisans WHERE user_id = ? AND hidden_at IS NULL AND user_id <> ?', [$pref, $u['id']])) $pref = 0;
        Db::run('INSERT INTO service_jobs (customer_id, artisan_id, trade, problem, lat, lng, landmark, created_at, mode, accuracy_m, trades) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
            [$u['id'], 0, $trade, $problem, round($lat, 6), round($lng, 6), mb_substr(trim((string) ($b['landmark'] ?? '')), 0, 160) ?: null, Db::now(), 'nearest', isset($b['accuracy']) ? max(1, min(9999, (int) $b['accuracy'])) : null, $trade]);
        $id = (int) Db::lastId();
        if ($pref) Db::run('UPDATE service_jobs SET preferred_artisan_id = ? WHERE id = ?', [$pref, $id]);
        $n = self::ring($id);
        Track::hit($u, 'artisan', $pref ? 'job_again' : 'job_nearest');
        Http::json(['id' => $id, 'alerted' => $n], 201);
    }

    /** Alerts the next few mechanics, nearest and most recently online first, inside a radius that grows each round. */
    public static function ring(int $id): int
    {
        $j = Db::one('SELECT * FROM service_jobs WHERE id = ?', [$id]);
        if (!$j || $j['status'] !== 'requested') return 0;
        $ring = (int) $j['ring'] + 1;
        if ($ring > self::MAX_RINGS + ((int) ($j['preferred_artisan_id'] ?? 0) ? 1 : 0)) {
            Db::run("UPDATE service_jobs SET status = 'expired' WHERE id = ? AND status = 'requested'", [$id]);
            Db::run("UPDATE job_offers SET status = 'expired' WHERE job_id = ? AND status = 'offered'", [$id]);
            Notify::user((int) $j['customer_id'], 'work', 'No one could take it just now', 'Open the map to call a mechanic directly, or try again in a few minutes.', '/#/artisans/map?trade=' . $j['trade'], true);
            return 0;
        }
        // Calling a known mechanic again: round one goes to them alone. If they do not take it, the normal rounds follow.
        $pref = (int) ($j['preferred_artisan_id'] ?? 0);
        if ($pref && $ring === 1) {
            $a = Db::one('SELECT user_id, lat, lng FROM artisans WHERE user_id = ? AND hidden_at IS NULL', [$pref]);
            if ($a) {
                $km = ($a['lat'] !== null) ? WakaRules::km((float) $j['lat'], (float) $j['lng'], (float) $a['lat'], (float) $a['lng']) : 0;
                Db::run('INSERT INTO job_offers (job_id, artisan_id, km, ring, status, offered_at) VALUES (?,?,?,?,?,?)', [$id, $pref, round($km, 2), 1, 'offered', Db::now()]);
                $cust = Db::one('SELECT name FROM users WHERE id = ?', [$j['customer_id']]);
                Notify::user($pref, 'work', explode(' ', trim((string) ($cust['name'] ?? 'A customer')))[0] . ' wants you again', mb_substr((string) $j['problem'], 0, 90) . ' You get the first chance, for one minute.', '/#/jobs/' . $id, true);
                Db::run('UPDATE service_jobs SET ring = 1, ring_at = ? WHERE id = ?', [Db::now(), $id]);
                return 1;
            }
        }
        $rr = $pref ? $ring - 1 : $ring;                                     // the widening circles start after the favourite's turn
        $lat = (float) $j['lat']; $lng = (float) $j['lng'];
        $radius = min(60, 6 * $rr + 2);                                     // 8, 14, 20, 26, 32 km
        $dLat = $radius / 111; $dLng = $radius / (111 * max(0.2, cos(deg2rad($lat))));
        // Bounding box first, so this stays fast with thousands of artisans (index: trade, available, lat, lng)
        $st = Db::pdo()->prepare("SELECT a.user_id, a.lat, a.lng, a.radius_km, a.last_online_at, a.schedule FROM artisans a WHERE a.trade = ? AND a.available = 1 AND a.hidden_at IS NULL
            AND a.lat BETWEEN ? AND ? AND a.lng BETWEEN ? AND ? AND a.user_id <> ? AND a.user_id NOT IN (SELECT artisan_id FROM job_offers WHERE job_id = ?) LIMIT 200");
        $st->execute([$j['trade'], $lat - $dLat, $lat + $dLat, $lng - $dLng, $lng + $dLng, $j['customer_id'], $id]);
        $c = [];
        foreach ($st->fetchAll() as $a) {
            $km = WakaRules::km($lat, $lng, (float) $a['lat'], (float) $a['lng']);
            if ($km > $radius || ($rr < 3 && $km > max(3, (float) $a['radius_km'] * 1.2))) continue; // early rounds respect how far they said they travel
            if (!self::onDuty($a['schedule'] ?? null)) continue;              // outside the hours they set
            $recent = $a['last_online_at'] && strtotime($a['last_online_at'] . ' UTC') > time() - 900;
            // Fair dispatch: nearest first, but quick and reliable mechanics rise and no-shows sink.
            $rel = self::reliability((int) $a['user_id']);
            $c[] = ['id' => (int) $a['user_id'], 'km' => $km, 'score' => $km - ($recent ? 3 : 0) + $rel['penalty']];
        }
        usort($c, fn($x, $y) => $x['score'] <=> $y['score']);
        $pick = array_slice($c, 0, self::RING_SIZE);
        foreach ($pick as $p) {
            Db::run('INSERT INTO job_offers (job_id, artisan_id, km, ring, status, offered_at) VALUES (?,?,?,?,?,?)', [$id, $p['id'], round($p['km'], 2), $ring, 'offered', Db::now()]);
            Notify::user($p['id'], 'work', 'Breakdown ' . ($p['km'] < 1 ? 'under 1' : round($p['km'], 1)) . ' km from you', mb_substr((string) $j['problem'], 0, 90) . ' First to accept gets the job.', '/#/jobs/' . $id, true);
        }
        Db::run('UPDATE service_jobs SET ring = ?, ring_at = ? WHERE id = ?', [$ring, Db::now(), $id]);
        if (!$pick && $rr < self::MAX_RINGS) return self::ring($id); // nobody in this circle: widen straight away
        return count($pick);
    }

    /** GET /artisans/mine : mechanics and other artisans who have worked for me, and the ones I saved */
    public function mine(): void
    {
        $u = Auth::require(); $me = (int) $u['id']; $rows = [];
        $st = Db::pdo()->prepare("SELECT artisan_id, COUNT(*) AS n, MAX(created_at) AS last FROM service_jobs WHERE customer_id = ? AND artisan_id > 0 AND status = 'done' GROUP BY artisan_id"); $st->execute([$me]);
        foreach ($st->fetchAll() as $r) $rows[(int) $r['artisan_id']] = ['jobs' => (int) $r['n'], 'last' => $r['last'], 'saved' => false];
        $st = Db::pdo()->prepare('SELECT artisan_id FROM saved_artisans WHERE user_id = ?'); $st->execute([$me]);
        foreach ($st->fetchAll() as $r) { $id = (int) $r['artisan_id']; $rows[$id] = ($rows[$id] ?? ['jobs' => 0, 'last' => null]); $rows[$id]['saved'] = true; }
        $out = [];
        foreach ($rows as $id => $meta) {
            $a = Db::one('SELECT a.*, u.name AS person FROM artisans a JOIN users u ON u.id = a.user_id WHERE a.user_id = ? AND a.hidden_at IS NULL AND u.deleted_at IS NULL', [$id]); if (!$a) continue;
            $out[] = ['id' => $id, 'name' => $a['business'] ?: $a['person'], 'trade' => $a['trade'], 'tradeLabel' => ArtisanController::TRADES[$a['trade']] ?? $a['trade'], 'photo' => $a['photo_upload'] ? '/api/uploads/' . (int) $a['photo_upload'] : Auth::picture($id),
                'available' => (bool) $a['available'], 'onDuty' => self::onDuty($a['schedule'] ?? null), 'rating' => RatingController::summary($id, 'artisan'), 'jobs' => $meta['jobs'], 'last' => $meta['last'], 'saved' => $meta['saved']];
        }
        usort($out, fn($x, $y) => [$y['saved'], $y['jobs'], (string) $y['last']] <=> [$x['saved'], $x['jobs'], (string) $x['last']]);
        Http::json(['artisans' => $out]);
    }
    /** POST /artisans/{id}/save : keep an artisan in My mechanics (again to remove) */
    public function save(int $id): void
    {
        $u = Auth::require();
        if (Db::one('SELECT 1 AS x FROM saved_artisans WHERE user_id = ? AND artisan_id = ?', [$u['id'], $id])) { Db::run('DELETE FROM saved_artisans WHERE user_id = ? AND artisan_id = ?', [$u['id'], $id]); Http::json(['saved' => false]); }
        if (!Db::one('SELECT user_id FROM artisans WHERE user_id = ? AND hidden_at IS NULL', [$id])) Http::json(['error' => 'not_found'], 404);
        Db::run('INSERT INTO saved_artisans (user_id, artisan_id, created_at) VALUES (?,?,?)', [$u['id'], $id, Db::now()]);
        Http::json(['saved' => true]);
    }

    /** Called whenever the customer's screen polls, and by Cron: next round when the current one has gone quiet. */
    public static function escalate(array $j): void
    {
        if (($j['mode'] ?? '') !== 'nearest' || $j['status'] !== 'requested') return;
        $quiet = !$j['ring_at'] || strtotime($j['ring_at'] . ' UTC') < time() - self::RING_SEC;
        $allNo = !Db::one("SELECT 1 AS x FROM job_offers WHERE job_id = ? AND status = 'offered'", [$j['id']]);
        if ($quiet || $allNo) self::ring((int) $j['id']);
    }
    public static function escalateAll(int $limit = 20): int
    {
        $n = 0;
        foreach (Db::pdo()->query("SELECT * FROM service_jobs WHERE mode = 'nearest' AND status = 'requested' ORDER BY id LIMIT " . (int) $limit)->fetchAll() as $j) {
            if (strtotime($j['created_at'] . ' UTC') < time() - self::REQUEST_TTL_MIN * 60) { Db::run("UPDATE service_jobs SET status = 'expired' WHERE id = ? AND status = 'requested'", [$j['id']]); OrderPay::sync((int) $j['id']); continue; }
            self::escalate($j); $n++;
        }
        return $n;
    }

    /**
     * GET /service-jobs/offers : what is ringing for this mechanic right now. The app polls this in the
     * background, which also marks them as online, so dispatch prefers people who are actually looking.
     */
    public function offers(): void
    {
        $u = Auth::require();
        Db::run('UPDATE artisans SET last_online_at = ? WHERE user_id = ?', [Db::now(), $u['id']]);
        $st = Db::pdo()->prepare("SELECT o.km, o.offered_at, j.* FROM job_offers o JOIN service_jobs j ON j.id = o.job_id WHERE o.artisan_id = ? AND o.status = 'offered' AND j.status = 'requested' AND j.created_at > ? ORDER BY o.offered_at DESC LIMIT 5");
        $st->execute([$u['id'], gmdate('Y-m-d H:i:s', time() - self::REQUEST_TTL_MIN * 60)]);
        Http::json(['offers' => array_map(fn($r) => ['id' => (int) $r['id'], 'trade' => $r['trade'], 'tradeLabel' => ArtisanController::TRADES[$r['trade']] ?? $r['trade'], 'problem' => $r['problem'], 'km' => (float) $r['km'],
            'district' => Osm::districtFor((float) $r['lat'], (float) $r['lng']) ?: null, 'age' => max(0, time() - strtotime($r['offered_at'] . ' UTC'))], $st->fetchAll())]);
    }

    /** POST /service-jobs/{id}/where { lat, lng, accuracy } : the customer corrects or updates where they are */
    public function where(int $id): void
    {
        $u = Auth::require(); $j = $this->job($id, $u);
        if ((int) $j['customer_id'] !== (int) $u['id']) Http::json(['error' => 'forbidden'], 403);
        if (!in_array($j['status'], ['requested', 'accepted', 'enroute'], true)) Http::json(['job' => $this->shape($j, $u)]);
        $b = Http::body(); $lat = (float) ($b['lat'] ?? 0); $lng = (float) ($b['lng'] ?? 0);
        if (!self::inFct($lat, $lng)) Http::json(['error' => 'validation'], 422);
        if (self::metres((float) $j['lat'], (float) $j['lng'], $lat, $lng) >= 15) {
            Db::run('UPDATE service_jobs SET lat = ?, lng = ?, accuracy_m = ?, route_at = NULL WHERE id = ?', [round($lat, 6), round($lng, 6), isset($b['accuracy']) ? (int) $b['accuracy'] : null, $id]);
            if ((int) $j['artisan_id'] && in_array($j['status'], ['accepted', 'enroute'], true)) Notify::user((int) $j['artisan_id'], 'work', 'Your customer moved their pin', 'Check the map for the new spot.', '/#/jobs/' . $id);
        }
        Http::json(['job' => $this->shape(Db::one('SELECT * FROM service_jobs WHERE id = ?', [$id]), $u)]);
    }

    /**
     * POST /service-jobs/{id}/quote { amount, note } : the artisan names a price before starting work.
     * POST /service-jobs/{id}/quote/{answer} : the customer accepts or declines it. Agreeing a price in the app,
     * before the work, prevents most arguments afterwards; both sides can see exactly what was agreed and when.
     */
    public function quote(int $id): void
    {
        $u = Auth::require(); $j = $this->job($id, $u); $b = Http::body();
        if ((int) $j['artisan_id'] !== (int) $u['id']) Http::json(['error' => 'forbidden'], 403);
        if (!in_array($j['status'], ['accepted', 'enroute', 'arrived'], true)) Http::json(['error' => 'validation', 'message' => 'Send a price once you have accepted the job.'], 422);
        $amount = (int) ($b['amount'] ?? 0); if ($amount < 500 || $amount > 5000000) Http::json(['error' => 'validation', 'fields' => ['amount' => 'The price in naira, for example 15000.']], 422);
        if (($j['quote_status'] ?? 'none') === 'accepted') Http::json(['error' => 'validation', 'message' => 'Your customer already accepted a price. Talk to them before changing it.'], 409);
        Db::run("UPDATE service_jobs SET quote_amount = ?, quote_note = ?, quote_status = 'sent', quoted_at = ? WHERE id = ?", [$amount, mb_substr(trim((string) ($b['note'] ?? '')), 0, 200) ?: null, Db::now(), $id]);
        $biz = (Db::one('SELECT business FROM artisans WHERE user_id = ?', [$u['id']])['business'] ?? '') ?: explode(' ', trim((string) $u['name']))[0];
        Notify::user((int) $j['customer_id'], 'work', $biz . ' quoted ₦' . number_format($amount), 'Tap to accept or decline before they start.', '/#/jobs/' . $id, true);
        $this->show($id);
    }
    public function answerQuote(int $id, string $answer): void
    {
        $u = Auth::require(); $j = $this->job($id, $u);
        if ((int) $j['customer_id'] !== (int) $u['id']) Http::json(['error' => 'forbidden'], 403);
        if (($j['quote_status'] ?? 'none') !== 'sent') Http::json(['error' => 'validation', 'message' => 'There is no price waiting for you.'], 422);
        $ok = $answer === 'accept';
        Db::run('UPDATE service_jobs SET quote_status = ? WHERE id = ?', [$ok ? 'accepted' : 'declined', $id]);
        Notify::user((int) $j['artisan_id'], 'work', $ok ? 'Price accepted: ₦' . number_format((int) $j['quote_amount']) : 'Your price was declined', $ok ? 'You can start the work.' : 'Talk to your customer and send a new price, or cancel.', '/#/jobs/' . $id, true);
        $this->show($id);
    }

    /**
     * How reliable an artisan has been, for fair dispatch and their own dashboard. Newcomers start from a fair
     * middle rather than zero, so a new mechanic still gets alerted.
     */
    public static function reliability(int $artisanId): array
    {
        $since = gmdate('Y-m-d H:i:s', time() - 60 * 86400);
        $o = Db::one("SELECT COUNT(*) AS offered, SUM(CASE WHEN status IN ('won','declined','taken') OR answered_at IS NOT NULL THEN 1 ELSE 0 END) AS answered, SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS won FROM job_offers WHERE artisan_id = ? AND offered_at > ?", [$artisanId, $since]) ?: [];
        $j = Db::one("SELECT SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done, SUM(CASE WHEN status = 'cancelled' AND cancelled_by = artisan_id THEN 1 ELSE 0 END) AS dropped, COUNT(*) AS taken FROM service_jobs WHERE artisan_id = ? AND created_at > ? AND status NOT IN ('requested','expired','declined')", [$artisanId, $since]) ?: [];
        $offered = (int) ($o['offered'] ?? 0); $answered = (int) ($o['answered'] ?? 0);
        $resp = $offered >= 3 ? $answered / $offered : 0.8;
        $r = RatingController::summary($artisanId, 'artisan');
        return ['offered' => $offered, 'answered' => $answered, 'won' => (int) ($o['won'] ?? 0), 'responseRate' => round($resp, 2),
            'done' => (int) ($j['done'] ?? 0), 'dropped' => (int) ($j['dropped'] ?? 0), 'stars' => $r['stars'], 'ratings' => (int) $r['count'],
            'penalty' => round((1 - $resp) * 4 + (int) ($j['dropped'] ?? 0) * 2.5 - (($r['stars'] ?? 0) >= 4.5 && $r['count'] >= 3 ? 1.5 : 0), 2)];
    }
    /** Is this artisan working now, by the hours they set? No hours set means any time. */
    public static function onDuty(?string $schedule): bool
    {
        $s = $schedule ? json_decode($schedule, true) : null; if (!$s) return true;
        $now = new DateTime('now', new DateTimeZone('Africa/Lagos'));
        $day = strtolower($now->format('D')); $h = (int) $now->format('G') + ((int) $now->format('i')) / 60;
        if (empty($s[$day]) || !is_array($s[$day])) return false;
        [$from, $to] = [(float) $s[$day][0], (float) $s[$day][1]];
        return $to > $from ? ($h >= $from && $h < $to) : ($h >= $from || $h < $to); // overnight shifts
    }

    /** POST /service-jobs/{id}/rate { stars, tags, comment } : the customer, once, after the job */
    public function rate(int $id): void
    {
        $u = Auth::require(); $j = $this->job($id, $u);
        if ((int) $j['customer_id'] !== (int) $u['id']) Http::json(['error' => 'forbidden'], 403);
        if ($j['status'] !== 'done' && $j['status'] !== 'arrived') Http::json(['error' => 'validation', 'message' => 'Rate them once the job is done.'], 422);
        if ((int) $j['rated']) Http::json(['error' => 'validation', 'message' => 'You already rated this job.'], 409);
        $b = Http::body(); $stars = max(1, min(5, (int) ($b['stars'] ?? 0)));
        $allowed = RatingController::TAGS['artisan'] ?? []; $tags = array_values(array_intersect((array) ($b['tags'] ?? []), $allowed));
        if ($j['status'] === 'arrived') Db::run("UPDATE service_jobs SET status = 'done', done_at = ? WHERE id = ?", [Db::now(), $id]);
        // One rating per person per artisan: a later job updates it, so it always reflects the most recent visit.
        $comment = mb_substr(trim((string) ($b['comment'] ?? '')), 0, 400) ?: null;
        $prev = $j['thread_id'] ? Db::one('SELECT id FROM user_ratings WHERE thread_id = ? AND rater = ?', [$j['thread_id'], $u['id']]) : null;
        if ($prev) Db::run('UPDATE user_ratings SET stars = ?, tags = ?, comment = ?, module = ?, hidden_at = NULL, created_at = ? WHERE id = ?', [$stars, json_encode($tags), $comment, 'artisan', Db::now(), $prev['id']]);
        else Db::run('INSERT INTO user_ratings (rater, rated, thread_id, module, stars, tags, comment, created_at) VALUES (?,?,?,?,?,?,?,?)', [$u['id'], $j['artisan_id'], $j['thread_id'], 'artisan', $stars, json_encode($tags), $comment, Db::now()]);
        Db::run('UPDATE service_jobs SET rated = 1 WHERE id = ?', [$id]);
        OrderPay::sync($id, true);   // rating it means they have it
        if ($stars >= 4) Notify::user((int) $j['artisan_id'], 'work', 'You got ' . $stars . ' stars', explode(' ', trim((string) $u['name']))[0] . ' rated your work.', '/#/people/' . (int) $j['artisan_id']);
        $this->show($id);
    }
}

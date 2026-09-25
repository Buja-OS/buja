<?php
declare(strict_types=1);

/**
 * Declutter escrow, "Buy safely". The buyer pays through Paystack and Buja holds the money. The seller hands the item
 * over and says so; the buyer confirms it arrived, or reports a problem within 3 days, after which it releases by
 * itself. Released money goes to the seller's bank through a Paystack transfer, or to the admin payout list when
 * automatic transfers are not switched on. A seller who never hands the item over within 7 days means a refund.
 *
 *   pending -> paid -> shipped -> released
 *                 \        \-> disputed -> released | refunded   (an admin decides)
 *                  \-> refunded (not handed over in time, or cancelled by the seller)
 */
final class EscrowController
{
    private static function admin(): array
    {
        $u = Auth::require(); $role = $u['role'] ?? (!empty($u['is_admin']) ? 'admin' : 'user');
        if ($role !== 'admin') Http::json(['error' => 'forbidden', 'message' => 'Admins only.'], 403);
        return $u;
    }
    /** Tell every admin: a dispute to look at, a payout that failed. */
    private static function tellAdmins(string $title, string $body, string $url): void
    {
        $st = Db::pdo()->prepare("SELECT id FROM users WHERE (role = 'admin' OR is_admin = 1) AND deleted_at IS NULL"); $st->execute();
        foreach ($st->fetchAll() as $a) Notify::user((int) $a['id'], 'offers', $title, $body, $url, true);
    }

    public const RELEASE_HOURS = 72;
    public const HANDOVER_DAYS = 7;

    /** Buyer protection: 2.5%, at least ₦100, at most ₦2,500. It covers Paystack's own charges. */
    public static function fee(int $price): int { return (int) max(100, min(2500, (int) round($price * 0.025))); }

    private static function first(string $n): string { return explode(' ', trim($n))[0]; }

    private function order(int $id, array $u): array
    {
        $o = Db::one('SELECT * FROM escrow_orders WHERE id = ?', [$id]);
        if (!$o) Http::json(['error' => 'not_found', 'message' => 'That order does not exist.'], 404);
        if ((int) $o['buyer_id'] !== (int) $u['id'] && (int) $o['seller_id'] !== (int) $u['id'] && empty($u['is_admin'])) Http::json(['error' => 'forbidden'], 403);
        return $o;
    }

    public static function shape(array $o, ?array $viewer = null): array
    {
        $l = Db::one('SELECT id, title, district FROM listings WHERE id = ?', [$o['listing_id']]);
        $ph = Db::one('SELECT id FROM listing_photos WHERE listing_id = ? ORDER BY position, id LIMIT 1', [$o['listing_id']]);
        $b = Db::one('SELECT id, name FROM users WHERE id = ?', [$o['buyer_id']]); $s = Db::one('SELECT id, name FROM users WHERE id = ?', [$o['seller_id']]);
        $po = Db::one('SELECT status, sent_at FROM payouts WHERE order_id = ?', [$o['id']]);
        $role = $viewer ? ((int) $viewer['id'] === (int) $o['buyer_id'] ? 'buyer' : ((int) $viewer['id'] === (int) $o['seller_id'] ? 'seller' : 'admin')) : null;
        return ['id' => (int) $o['id'], 'status' => $o['status'], 'role' => $role, 'price' => (int) $o['price'], 'fee' => (int) $o['fee'], 'total' => (int) $o['total'],
            'listing' => $l ? ['id' => (int) $l['id'], 'title' => $l['title'], 'district' => $l['district'], 'photo' => $ph ? '/api/declutter/photos/' . $ph['id'] : null] : null,
            'buyer' => $b ? ['id' => (int) $b['id'], 'name' => self::first($b['name'])] : null, 'seller' => $s ? ['id' => (int) $s['id'], 'name' => self::first($s['name'])] : null,
            'note' => $o['note'], 'paidAt' => $o['paid_at'], 'shippedAt' => $o['shipped_at'], 'releaseAt' => $o['release_at'], 'releasedAt' => $o['released_at'], 'refundedAt' => $o['refunded_at'], 'createdAt' => $o['created_at'],
            'payout' => $po ? ['status' => $po['status'], 'sentAt' => $po['sent_at']] : null,
            'handover' => $o['handover'] ?? null,
            'drop' => $role && ($o['drop_lat'] ?? null) !== null ? ['lat' => (float) $o['drop_lat'], 'lng' => (float) $o['drop_lng'], 'note' => $o['drop_note'] ?? null] : null,
            'track' => $role ? LiveTrack::shape(LiveTrack::get('escrow', (int) $o['id'])) : null];
    }
    /** Where the buyer wants it delivered, if they chose delivery. Quietly skipped until migration 040 has run. */
    private static function saveDrop(int $id, array $b): void
    {
        $h = ($b['handover'] ?? '') === 'delivery' ? 'delivery' : (($b['handover'] ?? '') === 'pickup' ? 'pickup' : null); if (!$h) return;
        $lat = isset($b['lat']) ? (float) $b['lat'] : null; $lng = isset($b['lng']) ? (float) $b['lng'] : null;
        if ($h === 'delivery' && ($lat === null || !ServiceJobController::inFct($lat, $lng))) { $lat = $lng = null; }
        try { Db::run('UPDATE escrow_orders SET handover = ?, drop_lat = ?, drop_lng = ?, drop_note = ? WHERE id = ?', [$h, $lat !== null ? round($lat, 6) : null, $lng !== null ? round($lng, 6) : null, mb_substr(trim((string) ($b['note'] ?? '')), 0, 160) ?: null, $id]); } catch (Throwable $e) {}
    }

    /** POST /escrow/buy/{listingId} : start paying; the price is the listing's, or an offer the seller accepted from this buyer */
    public function buy(int $listingId): void
    {
        $u = Auth::require(); RateLimit::hit('escrowbuy', 10, 3600);
        $l = Db::one("SELECT * FROM listings WHERE id = ? AND status = 'active'", [$listingId]);
        if (!$l) Http::json(['error' => 'not_found', 'message' => 'This item is no longer for sale.'], 404);
        if ((int) $l['seller_id'] === (int) $u['id']) Http::json(['error' => 'validation', 'message' => 'You cannot buy your own item.'], 422);
        if (empty($u['email'])) Http::json(['error' => 'validation', 'message' => 'Add an email to your account first; Paystack sends the receipt there.'], 422);
        if (Db::one("SELECT id FROM escrow_orders WHERE listing_id = ? AND status IN ('paid','shipped','disputed')", [$listingId])) Http::json(['error' => 'validation', 'message' => 'Someone has already paid for this item.'], 409);
        $price = (int) $l['price'];
        // an accepted offer from this buyer on this item sets the price
        $st = Db::pdo()->prepare("SELECT m.meta FROM messages m JOIN threads t ON t.id = m.thread_id WHERE t.listing_id = ? AND t.user_b = ? AND m.type = 'offer' ORDER BY m.id DESC");
        $st->execute([$listingId, $u['id']]);
        foreach ($st->fetchAll() as $m) { $meta = json_decode((string) $m['meta'], true); if (($meta['status'] ?? '') === 'accepted') { $price = (int) $meta['amount']; break; } }
        if ($price < 500) Http::json(['error' => 'validation', 'message' => 'Buy safely is for items of ₦500 or more.'], 422);
        $fee = self::fee($price); $total = $price + $fee;
        $ref = 'BJE-' . $listingId . '-' . bin2hex(random_bytes(5));
        Db::run('INSERT INTO escrow_orders (listing_id, buyer_id, seller_id, price, fee, total, reference, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)', [$listingId, $u['id'], $l['seller_id'], $price, $fee, $total, $ref, Db::now(), Db::now()]);
        $id = (int) Db::pdo()->lastInsertId();
        self::saveDrop($id, Http::body());
        try { $p = Paystack::initialize($u['email'], $total, $ref, ['purpose' => 'escrow', 'order_id' => $id, 'listing_id' => $listingId]); }
        catch (Throwable $e) { Db::run("UPDATE escrow_orders SET status = 'cancelled', updated_at = ? WHERE id = ?", [Db::now(), $id]); Http::json(['error' => 'unavailable', 'message' => 'Payments are not available right now. Try again shortly.'], 503); }
        Track::hit($u, 'declutter', 'escrow_start');
        Http::json(['orderId' => $id, 'url' => $p['url'], 'price' => $price, 'fee' => $fee, 'total' => $total], 201);
    }

    /** Called by the Paystack callback and webhook for BJE- references. Safe to call twice. */
    public static function settle(string $ref): ?array
    {
        $o = Db::one('SELECT * FROM escrow_orders WHERE reference = ?', [$ref]); if (!$o) return null;
        if ($o['status'] !== 'pending') return $o;
        $paid = Paystack::verify($ref);
        if ($paid === null || $paid < (int) $o['total']) return $o;
        $st = Db::pdo()->prepare("UPDATE escrow_orders SET status = 'paid', paid_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'"); $st->execute([Db::now(), Db::now(), $o['id']]);
        if ($st->rowCount() === 1) {
            $l = Db::one('SELECT title FROM listings WHERE id = ?', [$o['listing_id']]); $b = Db::one('SELECT name FROM users WHERE id = ?', [$o['buyer_id']]);
            Notify::user((int) $o['seller_id'], 'offers', 'Paid and held: ' . ($l['title'] ?? 'your item'), self::first($b['name'] ?? 'The buyer') . ' paid ₦' . number_format((int) $o['price']) . '. Buja is holding it. Hand the item over, then tap "I have handed it over".', '/#/orders/' . $o['id'], true);
            Notify::user((int) $o['buyer_id'], 'offers', 'Payment held safely', 'The seller is paid only when you confirm the item arrived.', '/#/orders/' . $o['id']);
        }
        return Db::one('SELECT * FROM escrow_orders WHERE id = ?', [$o['id']]);
    }

    /** GET /escrow/orders : what I am buying and selling */
    public function mine(): void
    {
        $u = Auth::require();
        $q = fn($col) => (function () use ($col, $u) { $st = Db::pdo()->prepare("SELECT * FROM escrow_orders WHERE $col = ? AND status <> 'pending' ORDER BY id DESC LIMIT 50"); $st->execute([$u['id']]); return array_map(fn($o) => self::shape($o, $u), $st->fetchAll()); })();
        $acct = Db::one('SELECT bank_name, account_last4, account_name FROM payout_accounts WHERE user_id = ?', [$u['id']]);
        Http::json(['buying' => $q('buyer_id'), 'selling' => $q('seller_id'), 'payoutAccount' => $acct ? ['bank' => $acct['bank_name'], 'last4' => $acct['account_last4'], 'name' => $acct['account_name']] : null]);
    }

    /** GET /escrow/orders/{id} ; also settles a payment the phone just came back from */
    public function show(int $id): void
    {
        $u = Auth::require(); $o = $this->order($id, $u);
        if ($o['status'] === 'pending') { self::settle($o['reference']); $o = Db::one('SELECT * FROM escrow_orders WHERE id = ?', [$id]); }
        $acct = (int) $o['seller_id'] === (int) $u['id'] ? Db::one('SELECT bank_name, account_last4 FROM payout_accounts WHERE user_id = ?', [$u['id']]) : null;
        Http::json(['order' => self::shape($o, $u), 'hasPayoutAccount' => (bool) $acct]);
    }

    /** POST /escrow/orders/{id}/{action} : ship (seller), confirm or dispute (buyer), cancel (seller, before handover) */
    public function act(int $id, string $action): void
    {
        $u = Auth::require(); $o = $this->order($id, $u); $isBuyer = (int) $o['buyer_id'] === (int) $u['id']; $isSeller = (int) $o['seller_id'] === (int) $u['id'];
        $l = Db::one('SELECT title FROM listings WHERE id = ?', [$o['listing_id']]); $title = $l['title'] ?? 'your item';
        if ($action === 'ship') {
            if (!$isSeller || $o['status'] !== 'paid') Http::json(['error' => 'validation', 'message' => 'Only the seller can do this, once the buyer has paid.'], 422);
            Db::run("UPDATE escrow_orders SET status = 'shipped', shipped_at = ?, release_at = ?, updated_at = ? WHERE id = ?", [Db::now(), gmdate('Y-m-d H:i:s', time() + self::RELEASE_HOURS * 3600), Db::now(), $id]);
            LiveTrack::end('escrow', $id);
            Notify::user((int) $o['buyer_id'], 'offers', 'Your item is on its way', 'When ' . $title . ' is in your hands and as described, tap "I received it". If there is a problem, report it within 3 days.', '/#/orders/' . $id, true);
        } elseif ($action === 'where') {
            // the buyer sets or moves the delivery spot
            if (!$isBuyer || !in_array($o['status'], ['pending', 'paid'], true)) Http::json(['error' => 'validation', 'message' => 'The delivery spot can only change before the item is handed over.'], 422);
            $b = Http::body(); if (!isset($b['lat']) || !ServiceJobController::inFct((float) $b['lat'], (float) $b['lng'])) Http::json(['error' => 'validation', 'message' => 'That spot is outside the FCT. Turn on GPS and try again.'], 422);
            self::saveDrop($id, ['handover' => 'delivery'] + $b);
            if ($t = LiveTrack::get('escrow', $id)) { if ($t['status'] !== 'ended') LiveTrack::start('escrow', $id, (int) $o['seller_id'], (int) $o['buyer_id'], (float) $b['lat'], (float) $b['lng']); }
        } elseif ($action === 'deliver') {
            // the seller sets off: the buyer watches them come
            if (!$isSeller || $o['status'] !== 'paid') Http::json(['error' => 'validation', 'message' => 'You can start delivering once the buyer has paid.'], 422);
            $o = Db::one('SELECT * FROM escrow_orders WHERE id = ?', [$id]);
            if (($o['drop_lat'] ?? null) === null) Http::json(['error' => 'validation', 'message' => 'The buyer has not set where to deliver yet. Message them, or meet up and hand it over.'], 422);
            $b = Http::body();
            LiveTrack::start('escrow', $id, (int) $o['seller_id'], (int) $o['buyer_id'], (float) $o['drop_lat'], (float) $o['drop_lng'], isset($b['lat']) ? (float) $b['lat'] : null, isset($b['lng']) ? (float) $b['lng'] : null);
            Notify::user((int) $o['buyer_id'], 'offers', self::first((string) (Db::one('SELECT name FROM users WHERE id = ?', [$o['seller_id']])['name'] ?? 'The seller')) . ' is bringing ' . $title, 'Tap to watch it come to you and see when it will arrive.', '/#/orders/' . $id, true);
        } elseif ($action === 'ping') {
            if (!$isSeller) Http::json(['error' => 'forbidden'], 403);
            $t = LiveTrack::get('escrow', $id);
            if (!$t || $t['status'] === 'ended' || $o['status'] !== 'paid') Http::json(['order' => self::shape($o, $u), 'stop' => true]);
            $b = Http::body(); $lat = (float) ($b['lat'] ?? 0); $lng = (float) ($b['lng'] ?? 0);
            if ($lat < 8 || $lat > 10 || $lng < 6.5 || $lng > 8) Http::json(['error' => 'validation'], 422);
            $was = $t['status']; $t = LiveTrack::ping($t, $lat, $lng, isset($b['heading']) ? (int) $b['heading'] : null, isset($b['speed']) ? (float) $b['speed'] : null);
            if ($was === 'enroute' && $t['status'] === 'arrived') Notify::user((int) $o['buyer_id'], 'offers', 'Your item has arrived', 'Check it, then confirm in Buja so the seller is paid.', '/#/orders/' . $id, true);
        } elseif ($action === 'confirm') {
            if (!$isBuyer || !in_array($o['status'], ['paid', 'shipped'], true)) Http::json(['error' => 'validation', 'message' => 'This order cannot be confirmed now.'], 422);
            self::release($o, 'The buyer confirmed the item arrived.'); LiveTrack::end('escrow', $id);
        } elseif ($action === 'dispute') {
            if (!$isBuyer || !in_array($o['status'], ['paid', 'shipped'], true)) Http::json(['error' => 'validation', 'message' => 'This order cannot be disputed now.'], 422);
            $note = trim(mb_substr((string) (Http::body()['note'] ?? ''), 0, 300)); if (mb_strlen($note) < 10) Http::json(['error' => 'validation', 'fields' => ['note' => 'Tell us what went wrong, in a sentence or two.']], 422);
            Db::run("UPDATE escrow_orders SET status = 'disputed', note = ?, updated_at = ? WHERE id = ?", [$note, Db::now(), $id]);
            Notify::user((int) $o['seller_id'], 'offers', 'The buyer reported a problem', 'Buja is holding the payment while we look into it: "' . $note . '"', '/#/orders/' . $id, true);
            self::tellAdmins('Escrow dispute: ' . $title, $note, '/#/admin/escrow');
        } elseif ($action === 'cancel') {
            if (!$isSeller || $o['status'] !== 'paid') Http::json(['error' => 'validation', 'message' => 'Only the seller can cancel, before handing the item over.'], 422);
            self::refund($o, 'The seller cancelled the sale.'); LiveTrack::end('escrow', $id);
        } else Http::json(['error' => 'not_found'], 404);
        Http::json(['order' => self::shape(Db::one('SELECT * FROM escrow_orders WHERE id = ?', [$id]), $u)]);
    }

    /** Money to the seller: the order is released, and a payout is sent or queued. */
    public static function release(array $o, string $why): void
    {
        $st = Db::pdo()->prepare("UPDATE escrow_orders SET status = 'released', released_at = ?, note = COALESCE(note, ?), updated_at = ? WHERE id = ? AND status IN ('paid','shipped','disputed')");
        $st->execute([Db::now(), $why, Db::now(), $o['id']]); if ($st->rowCount() !== 1) return;
        Db::run("UPDATE listings SET status = 'sold', updated_at = ? WHERE id = ?", [Db::now(), $o['listing_id']]);
        $ref = 'BJP-' . $o['id'] . '-' . bin2hex(random_bytes(4));
        try { Db::run('INSERT INTO payouts (order_id, seller_id, amount, reference, created_at) VALUES (?,?,?,?,?)', [$o['id'], $o['seller_id'], $o['price'], $ref, Db::now()]); } catch (Throwable $e) { return; }
        self::sendPayout((int) $o['id']);
        Notify::user((int) $o['seller_id'], 'offers', 'Released: ₦' . number_format((int) $o['price']) . ' is yours', 'The money is on its way to your bank account.', '/#/orders/' . $o['id'], true);
    }

    /** Sends a payout through Paystack when transfers are switched on and the seller has an account; otherwise it waits for an admin. */
    public static function sendPayout(int $orderId): void
    {
        $p = Db::one('SELECT * FROM payouts WHERE order_id = ?', [$orderId]); if (!$p || !in_array($p['status'], ['queued', 'failed'], true)) return;
        $acct = Db::one('SELECT recipient_code FROM payout_accounts WHERE user_id = ?', [$p['seller_id']]);
        if (!$acct || !(bool) Http::config('paystack_transfers', false)) return;   // stays queued for the admin payout list
        Db::run("UPDATE payouts SET status = 'sending' WHERE id = ?", [$p['id']]);
        try { $code = Paystack::transfer($acct['recipient_code'], (int) $p['amount'], $p['reference'], 'Buja Declutter sale #' . $orderId); Db::run("UPDATE payouts SET status = 'sent', transfer_code = ?, sent_at = ?, error = NULL WHERE id = ?", [$code, Db::now(), $p['id']]); }
        catch (Throwable $e) { Db::run("UPDATE payouts SET status = 'failed', error = ? WHERE id = ?", [mb_substr($e->getMessage(), 0, 200), $p['id']]); }
    }

    /** Money back to the buyer. */
    public static function refund(array $o, string $why): void
    {
        $st = Db::pdo()->prepare("UPDATE escrow_orders SET status = 'refunded', refunded_at = ?, note = ?, updated_at = ? WHERE id = ? AND status IN ('paid','shipped','disputed')");
        $st->execute([Db::now(), $why, Db::now(), $o['id']]); if ($st->rowCount() !== 1) return;
        try { Paystack::refund($o['reference']); } catch (Throwable $e) { Db::run("UPDATE escrow_orders SET note = ? WHERE id = ?", [$why . ' The refund needs an admin: ' . mb_substr($e->getMessage(), 0, 100), $o['id']]); self::tellAdmins('Escrow refund needs attention', 'Order #' . $o['id'], '/#/admin/escrow'); }
        Notify::user((int) $o['buyer_id'], 'offers', 'Refund on its way: ₦' . number_format((int) $o['total']), $why . ' Paystack returns it to how you paid, usually within 5 working days.', '/#/orders/' . $o['id'], true);
        Notify::user((int) $o['seller_id'], 'offers', 'Sale cancelled and refunded', $why, '/#/orders/' . $o['id']);
    }

    /** Automatic steps, run by the scheduler: release after 3 quiet days, refund after 7 days without a handover. */
    public static function tick(): void
    {
        $st = Db::pdo()->prepare("SELECT * FROM escrow_orders WHERE status = 'shipped' AND release_at <= ? LIMIT 20"); $st->execute([Db::now()]);
        foreach ($st->fetchAll() as $o) self::release($o, 'Released automatically: no problem was reported within 3 days.');
        $st = Db::pdo()->prepare("SELECT * FROM escrow_orders WHERE status = 'paid' AND paid_at <= ? LIMIT 20"); $st->execute([gmdate('Y-m-d H:i:s', time() - self::HANDOVER_DAYS * 86400)]);
        foreach ($st->fetchAll() as $o) self::refund($o, 'Refunded automatically: the item was not handed over within 7 days.');
        $st = Db::pdo()->prepare("SELECT order_id FROM payouts WHERE status = 'failed' LIMIT 10"); $st->execute(); foreach ($st->fetchAll() as $p) self::sendPayout((int) $p['order_id']);
    }

    /* ------------------------------ where sellers get paid ------------------------------ */
    /** GET /escrow/banks */
    public function banks(): void { Auth::require(); try { Http::json(['banks' => Paystack::banks()]); } catch (Throwable $e) { Http::json(['error' => 'unavailable', 'message' => 'Could not load banks right now.'], 503); } }

    /** GET /escrow/account ?bank=&number= checks the name without saving */
    public function account(): void
    {
        $u = Auth::require();
        if (!empty($_GET['bank']) && !empty($_GET['number'])) {
            $n = preg_replace('/\\D/', '', (string) $_GET['number']); if (strlen($n) !== 10) Http::json(['error' => 'validation', 'fields' => ['number' => 'Account numbers have 10 digits.']], 422);
            RateLimit::hit('bankresolve', 20, 3600); $name = Paystack::resolveAccount((string) $_GET['bank'], $n);
            Http::json(['name' => $name]);
        }
        $a = Db::one('SELECT bank_name, account_last4, account_name, updated_at FROM payout_accounts WHERE user_id = ?', [$u['id']]);
        Http::json(['account' => $a ? ['bank' => $a['bank_name'], 'last4' => $a['account_last4'], 'name' => $a['account_name'], 'updatedAt' => $a['updated_at']] : null]);
    }

    /** POST /escrow/account { bank, number } : checked with the bank, then saved at Paystack; Buja keeps only the last four digits */
    public function saveAccount(): void
    {
        $u = Auth::require(); RateLimit::hit('bankresolve', 20, 3600); $b = Http::body();
        $bank = (string) ($b['bank'] ?? ''); $n = preg_replace('/\\D/', '', (string) ($b['number'] ?? ''));
        if (strlen($n) !== 10) Http::json(['error' => 'validation', 'fields' => ['number' => 'Account numbers have 10 digits.']], 422);
        $banks = []; try { foreach (Paystack::banks() as $x) $banks[$x['code']] = $x['name']; } catch (Throwable $e) {}
        if (!isset($banks[$bank])) Http::json(['error' => 'validation', 'fields' => ['bank' => 'Choose your bank from the list.']], 422);
        $name = Paystack::resolveAccount($bank, $n); if (!$name) Http::json(['error' => 'validation', 'fields' => ['number' => 'That account number does not match the bank. Check it and try again.']], 422);
        try { $rcp = Paystack::createRecipient($name, $bank, $n); } catch (Throwable $e) { Http::json(['error' => 'unavailable', 'message' => 'Could not save the account right now.'], 503); }
        Db::run('DELETE FROM payout_accounts WHERE user_id = ?', [$u['id']]);
        Db::run('INSERT INTO payout_accounts (user_id, bank_code, bank_name, account_last4, account_name, recipient_code, updated_at) VALUES (?,?,?,?,?,?,?)', [$u['id'], $bank, $banks[$bank], substr($n, -4), $name, $rcp, Db::now()]);
        // anything already released and waiting can go now
        $st = Db::pdo()->prepare("SELECT order_id FROM payouts WHERE seller_id = ? AND status IN ('queued','failed')"); $st->execute([$u['id']]); foreach ($st->fetchAll() as $p) self::sendPayout((int) $p['order_id']);
        Http::json(['account' => ['bank' => $banks[$bank], 'last4' => substr($n, -4), 'name' => $name]]);
    }

    /* ------------------------------ admin ------------------------------ */
    /** GET /admin/escrow : disputes first, then payouts waiting, then everything recent */
    public function adminIndex(): void
    {
        self::admin();
        $rows = fn($sql, $p = []) => (function () use ($sql, $p) { $st = Db::pdo()->prepare($sql); $st->execute($p); return $st->fetchAll(); })();
        $shape = function ($o) { $x = self::shape($o); $po = Db::one('SELECT * FROM payouts WHERE order_id = ?', [$o['id']]); $a = Db::one('SELECT bank_name, account_last4, account_name FROM payout_accounts WHERE user_id = ?', [$o['seller_id']]);
            $x['payout'] = $po ? ['status' => $po['status'], 'error' => $po['error'], 'reference' => $po['reference']] : null; $x['sellerBank'] = $a ? $a['bank_name'] . ' ····' . $a['account_last4'] . ' (' . $a['account_name'] . ')' : null; return $x; };
        $held = Db::one("SELECT COALESCE(SUM(total),0) AS s FROM escrow_orders WHERE status IN ('paid','shipped','disputed')");
        $owed = Db::one("SELECT COALESCE(SUM(amount),0) AS s FROM payouts WHERE status IN ('queued','failed','sending')");
        Http::json(['held' => (int) $held['s'], 'owed' => (int) $owed['s'], 'transfersOn' => (bool) Http::config('paystack_transfers', false),
            'disputes' => array_map($shape, $rows("SELECT * FROM escrow_orders WHERE status = 'disputed' ORDER BY updated_at")),
            'payouts' => array_map($shape, $rows("SELECT o.* FROM escrow_orders o JOIN payouts p ON p.order_id = o.id WHERE p.status IN ('queued','failed','sending') ORDER BY p.created_at")),
            'recent' => array_map($shape, $rows("SELECT * FROM escrow_orders WHERE status <> 'pending' ORDER BY id DESC LIMIT 30"))]);
    }

    /** POST /admin/escrow/{id}/{action} : release or refund a dispute; mark a payout paid by hand; retry a transfer */
    public function adminAct(int $id, string $action): void
    {
        $admin = self::admin(); $o = Db::one('SELECT * FROM escrow_orders WHERE id = ?', [$id]); if (!$o) Http::json(['error' => 'not_found'], 404);
        if ($action === 'release') self::release($o, 'Released by Buja after checking the problem.');
        elseif ($action === 'refund') self::refund($o, 'Refunded by Buja after checking the problem.');
        elseif ($action === 'paid') Db::run("UPDATE payouts SET status = 'sent', sent_at = ?, error = ? WHERE order_id = ? AND status <> 'sent'", [Db::now(), 'Paid by hand by ' . self::first((string) $admin['name']), $id]);
        elseif ($action === 'retry') { Db::run("UPDATE payouts SET status = 'failed' WHERE order_id = ? AND status = 'queued'", [$id]); self::sendPayout($id); }
        else Http::json(['error' => 'not_found'], 404);
        Http::json(['ok' => true]);
    }

    /** Paystack transfer webhooks keep payouts honest. */
    public static function transferEvent(string $event, array $data): void
    {
        $ref = (string) ($data['reference'] ?? ''); if (!str_starts_with($ref, 'BJP-')) return;
        if ($event === 'transfer.success') Db::run("UPDATE payouts SET status = 'sent', sent_at = COALESCE(sent_at, ?) WHERE reference = ?", [Db::now(), $ref]);
        if ($event === 'transfer.failed' || $event === 'transfer.reversed') { Db::run("UPDATE payouts SET status = 'failed', error = ? WHERE reference = ?", [$event, $ref]); self::tellAdmins('A seller payout failed', $ref, '/#/admin/escrow'); }
    }
}

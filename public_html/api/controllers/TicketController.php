<?php
declare(strict_types=1);

/**
 * Tickets for paid Meetup events. Paystack takes the money, Buja keeps 5% plus ₦100, the host gets the rest
 * paid out by transfer (for now by hand, from the admin panel). Each ticket has a code the host scans or
 * types at the door; a code can be used once.
 */
final class TicketController
{
    public const FEE_PCT = 5; public const FEE_FLAT = 100;

    public static function fee(int $amount, int $qty = 1): int { return (int) round($amount * self::FEE_PCT / 100) + self::FEE_FLAT * max(1, $qty); }

    private function code(): string
    {
        for ($i = 0; $i < 6; $i++) { $c = strtoupper(substr(str_replace(['0', 'O', 'I', '1'], '', base_convert(bin2hex(random_bytes(5)), 16, 36)), 0, 8)); if (strlen($c) === 8 && !Db::one('SELECT id FROM tickets WHERE code = ?', [$c])) return $c; }
        return strtoupper(substr(sha1((string) microtime(true)), 0, 8));
    }

    /** POST /events/{id}/tickets { qty } : starts payment, returns the Paystack page to open */
    public function buy(int $id): void
    {
        $u = Auth::require(); RateLimit::hit('ticket', 20, 3600);
        $e = Db::one("SELECT * FROM meetups WHERE id = ? AND status = 'live' AND hidden_at IS NULL", [$id]); if (!$e) Http::json(['error' => 'not_found'], 404);
        if ((int) $e['price'] <= 0) Http::json(['error' => 'free', 'message' => 'This event is free. Just register.'], 422);
        $qty = max(1, min(6, (int) (Http::body()['qty'] ?? 1)));
        if ($e['capacity'] !== null && (int) $e['going'] + $qty > (int) $e['capacity']) Http::json(['error' => 'full', 'message' => 'Not enough spaces left.'], 409);
        if (Db::one("SELECT id FROM tickets WHERE event_id = ? AND user_id = ? AND status IN ('paid','used')", [$id, $u['id']])) Http::json(['error' => 'have', 'message' => 'You already have a ticket for this.'], 409);
        if ((string) Http::config('paystack_secret', '') === '' && !Http::config('paystack_mock')) Http::json(['error' => 'unavailable', 'message' => 'Paid tickets are not switched on yet. Message the host to pay directly.'], 503);
        $amount = (int) $e['price'] * $qty; $fee = self::fee($amount, $qty);
        $ref = 'BJT-' . $id . '-' . $u['id'] . '-' . bin2hex(random_bytes(4));
        Db::run('INSERT INTO tickets (event_id, user_id, code, qty, amount, fee, reference, status, created_at) VALUES (?,?,?,?,?,?,?,?,?)', [$id, $u['id'], $this->code(), $qty, $amount, $fee, $ref, 'pending', Db::now()]);
        if (Http::config('paystack_mock')) { $this->settle($ref); Http::json(['url' => (string) Http::config('app_origin') . '/#/meetup/' . $id . '?paid=1', 'reference' => $ref, 'mock' => true]); }
        $init = Paystack::initialize((string) $u['email'], $amount, $ref, ['type' => 'ticket', 'event' => $id, 'user' => (int) $u['id']]);
        if (!$init['url']) Http::json(['error' => 'paystack', 'message' => 'Could not start payment. Try again in a moment.'], 502);
        Http::json(['url' => $init['url'], 'reference' => $ref]);
    }

    /** Marks a ticket paid and registers the buyer. Idempotent. Called by the Paystack callback/webhook. */
    public static function settle(string $ref): ?array
    {
        $t = Db::one('SELECT * FROM tickets WHERE reference = ?', [$ref]); if (!$t) return null;
        if ($t['status'] !== 'pending') return $t;
        if (!Http::config('paystack_mock')) { $paid = Paystack::verify($ref); if ($paid === null || $paid < (int) $t['amount']) return $t; }
        Db::run("UPDATE tickets SET status = 'paid' WHERE id = ?", [$t['id']]);
        $has = Db::one('SELECT status FROM meetup_rsvps WHERE event_id = ? AND user_id = ?', [$t['event_id'], $t['user_id']]);
        if ($has) Db::run("UPDATE meetup_rsvps SET status = 'going', guests = ? WHERE event_id = ? AND user_id = ?", [(int) $t['qty'] - 1, $t['event_id'], $t['user_id']]);
        else Db::run("INSERT INTO meetup_rsvps (event_id, user_id, status, guests, created_at) VALUES (?,?,'going',?,?)", [$t['event_id'], $t['user_id'], (int) $t['qty'] - 1, Db::now()]);
        Db::run("UPDATE meetups SET going = (SELECT COALESCE(SUM(1 + guests), 0) FROM meetup_rsvps WHERE event_id = ? AND status = 'going'), ticket_count = ticket_count + ? WHERE id = ?", [$t['event_id'], (int) $t['qty'], $t['event_id']]);
        $e = Db::one('SELECT title, host_id FROM meetups WHERE id = ?', [$t['event_id']]);
        Notify::user((int) $t['user_id'], 'offers', 'Your ticket: ' . $e['title'], 'Code ' . $t['code'] . '. Show it at the door.', '/#/meetup/' . (int) $t['event_id']);
        Notify::user((int) $e['host_id'], 'offers', 'Ticket sold for ' . $e['title'], '₦' . number_format((int) $t['amount']) . ' for ' . (int) $t['qty'] . '. Payout after the event.', '/#/meetup/' . (int) $t['event_id']);
        return Db::one('SELECT * FROM tickets WHERE id = ?', [$t['id']]);
    }

    /** GET /tickets/mine */
    public function mine(): void
    {
        $u = Auth::require();
        $st = Db::pdo()->prepare("SELECT t.*, m.title, m.starts_at, m.venue FROM tickets t JOIN meetups m ON m.id = t.event_id WHERE t.user_id = ? AND t.status IN ('paid','used') ORDER BY m.starts_at DESC LIMIT 50"); $st->execute([$u['id']]);
        Http::json(['tickets' => array_map(fn($t) => ['code' => $t['code'], 'qty' => (int) $t['qty'], 'amount' => (int) $t['amount'], 'status' => $t['status'], 'eventId' => (int) $t['event_id'], 'title' => $t['title'], 'startsAt' => $t['starts_at'], 'venue' => $t['venue']], $st->fetchAll())]);
    }

    /** POST /events/{id}/scan { code } : host checks a ticket at the door */
    public function scan(int $id): void
    {
        $u = Auth::require();
        if (!Db::one('SELECT id FROM meetups WHERE id = ? AND host_id = ?', [$id, $u['id']])) Http::json(['error' => 'forbidden', 'message' => 'Only the host can scan.'], 403);
        $code = strtoupper(preg_replace('/[^A-Z0-9]/i', '', (string) (Http::body()['code'] ?? '')));
        $t = Db::one('SELECT t.*, u.name FROM tickets t JOIN users u ON u.id = t.user_id WHERE t.code = ? AND t.event_id = ?', [$code, $id]);
        if (!$t) Http::json(['ok' => false, 'message' => 'No such ticket for this event.'], 404);
        if ($t['status'] === 'used') Http::json(['ok' => false, 'message' => 'Already used at ' . date('H:i', strtotime($t['used_at'] . ' UTC')) . ' by ' . explode(' ', trim((string) $t['name']))[0] . '.'], 409);
        if ($t['status'] !== 'paid') Http::json(['ok' => false, 'message' => 'That ticket was not paid.'], 409);
        Db::run("UPDATE tickets SET status = 'used', used_at = ? WHERE id = ?", [Db::now(), $t['id']]);
        Db::run('UPDATE meetup_rsvps SET checked_in = ? WHERE event_id = ? AND user_id = ?', [Db::now(), $id, $t['user_id']]);
        Http::json(['ok' => true, 'name' => explode(' ', trim((string) $t['name']))[0], 'qty' => (int) $t['qty'], 'message' => explode(' ', trim((string) $t['name']))[0] . ', ' . (int) $t['qty'] . ' ' . ((int) $t['qty'] === 1 ? 'person' : 'people') . '. Welcome.']);
    }

    /** GET /events/{id}/sales : host sees money in, Buja fee, what they are owed */
    public function sales(int $id): void
    {
        $u = Auth::require();
        if (!Db::one('SELECT id FROM meetups WHERE id = ? AND host_id = ?', [$id, $u['id']])) Http::json(['error' => 'forbidden'], 403);
        $a = Db::one("SELECT COUNT(*) AS n, COALESCE(SUM(qty),0) AS q, COALESCE(SUM(amount),0) AS gross, COALESCE(SUM(fee),0) AS fee, SUM(CASE WHEN status='used' THEN qty ELSE 0 END) AS used FROM tickets WHERE event_id = ? AND status IN ('paid','used')", [$id]);
        Http::json(['sales' => ['orders' => (int) $a['n'], 'tickets' => (int) $a['q'], 'gross' => (int) $a['gross'], 'fee' => (int) $a['fee'], 'payout' => (int) $a['gross'] - (int) $a['fee'], 'checkedIn' => (int) $a['used']]]);
    }
}

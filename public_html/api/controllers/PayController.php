<?php
declare(strict_types=1);

final class PayController
{
    public const PLUS_NAIRA = 3500; public const PLUS_DAYS = 30;

    public static function plusActive(array $u): bool { return !empty($u['plus_until']) && $u['plus_until'] > Db::now(); }

    /** GET /pay/status */
    public function status(): void
    {
        $u = Auth::require(); $row = Db::one('SELECT plus_until FROM users WHERE id = ?', [$u['id']]);
        $st = Db::pdo()->prepare('SELECT purpose, amount, status, created_at FROM payments WHERE user_id = ? ORDER BY id DESC LIMIT 10'); $st->execute([$u['id']]);
        Http::json(['configured' => (string) Http::config('paystack_secret', '') !== '', 'plus' => ['active' => !empty($row['plus_until']) && $row['plus_until'] > Db::now(), 'until' => $row['plus_until'], 'price' => self::PLUS_NAIRA, 'days' => self::PLUS_DAYS], 'payments' => $st->fetchAll()]);
    }

    /** POST /pay/plus : start a Buja Plus payment, returns the Paystack page to open */
    public function plus(): void
    {
        // Google Play requires its own billing for subscriptions sold inside Play apps, so the Android app never sells Plus.
        if (($_SERVER['HTTP_X_BUJA_SHELL'] ?? '') === 'android') Http::json(['error' => 'forbidden', 'message' => "Buja Plus isn't available to buy in this app."], 403);
        $u = Auth::require(); RateLimit::hit('pay', 10, 3600);
        if ((string) Http::config('paystack_secret', '') === '') Http::json(['error' => 'unavailable', 'message' => 'Payments are not switched on yet.'], 409);
        if (empty($u['email'])) Http::json(['error' => 'validation', 'message' => 'Add an email to your account first.'], 422);
        $ref = 'plus_' . $u['id'] . '_' . bin2hex(random_bytes(6));
        Db::run('INSERT INTO payments (user_id, purpose, amount, reference, status, meta, created_at) VALUES (?,?,?,?,?,?,?)', [$u['id'], 'plus', self::PLUS_NAIRA, $ref, 'pending', json_encode(['days' => self::PLUS_DAYS]), Db::now()]);
        try { $p = Paystack::initialize($u['email'], self::PLUS_NAIRA, $ref, ['user_id' => $u['id'], 'purpose' => 'plus']); }
        catch (Throwable $e) { Http::json(['error' => 'pay_failed', 'message' => $e->getMessage()], 502); }
        Http::json(['url' => $p['url'], 'reference' => $ref]);
    }

    private function settle(string $ref): ?array
    {
        $p = Db::one('SELECT * FROM payments WHERE reference = ?', [$ref]); if (!$p) return null;
        if ($p['status'] === 'paid') return $p;
        $paid = Paystack::verify($ref); if ($paid === null || $paid < (int) $p['amount']) { Db::run("UPDATE payments SET status = 'failed' WHERE id = ? AND status = 'pending'", [$p['id']]); return null; }
        Db::run("UPDATE payments SET status = 'paid', paid_at = ? WHERE id = ?", [Db::now(), $p['id']]);
        if ($p['purpose'] === 'plus') {
            $u = Db::one('SELECT plus_until FROM users WHERE id = ?', [$p['user_id']]);
            $from = (!empty($u['plus_until']) && $u['plus_until'] > Db::now()) ? strtotime($u['plus_until'] . ' UTC') : time();
            Db::run('UPDATE users SET plus_until = ? WHERE id = ?', [gmdate('Y-m-d H:i:s', $from + self::PLUS_DAYS * 86400), $p['user_id']]);
            Notify::user((int) $p['user_id'], 'offers', 'Buja Plus is on', 'See everyone who liked you, five super likes a day, invisible mode.', '/#/match/likes');
        }
        return Db::one('SELECT * FROM payments WHERE id = ?', [$p['id']]);
    }

    /** GET /pay/callback?reference= : Paystack sends the user back here */
    public function callback(): void
    {
        $ref = (string) ($_GET['reference'] ?? $_GET['trxref'] ?? ''); $origin = (string) Http::config('app_origin');
        if (str_starts_with($ref, 'BJE-')) { $o = EscrowController::settle($ref); header('Location: ' . $origin . '/#/orders/' . ($o ? (int) $o['id'] : '') . '?paid=' . ($o && $o['status'] !== 'pending' ? '1' : '0')); exit; }
        if (str_starts_with($ref, OrderPay::PREFIX)) { $o = OrderPay::settle($ref); $ok = $o && !in_array($o['status'], ['pending', 'cancelled'], true) && !empty($o['job_id']);
            header('Location: ' . $origin . ($ok ? '/#/jobs/' . (int) $o['job_id'] . '?paid=1' : '/#/artisans/' . (int) ($o['artisan_id'] ?? 0) . '?menu=1&paid=0')); exit; }
        if (str_starts_with($ref, 'BJT-')) { $t = TicketController::settle($ref); header('Location: ' . $origin . '/#/meetup/' . ($t ? (int) $t['event_id'] : '') . '?paid=' . ($t && in_array($t['status'], ['paid', 'used'], true) ? '1' : '0')); exit; }
        $p = $ref !== '' ? $this->settle($ref) : null;
        header('Location: ' . $origin . '/#/plus?paid=' . ($p && $p['status'] === 'paid' ? '1' : '0')); exit;
    }

    /** POST /pay/webhook : Paystack server-to-server confirmation (belt and braces) */
    public function webhook(): void
    {
        $raw = file_get_contents('php://input') ?: '';
        if (!Paystack::webhookValid($raw, $_SERVER['HTTP_X_PAYSTACK_SIGNATURE'] ?? '')) { http_response_code(401); exit; }
        $j = json_decode($raw, true);
        try { Db::run("DELETE FROM app_keys WHERE k = 'paystack_webhook_last'"); Db::run("INSERT INTO app_keys (k, v) VALUES ('paystack_webhook_last', ?)", [Db::now() . ' ' . (string) ($j['event'] ?? '')]); } catch (Throwable $e) {}
        if (($j['event'] ?? '') === 'charge.success' && !empty($j['data']['reference'])) { $r = (string) $j['data']['reference']; if (str_starts_with($r, 'BJT-')) TicketController::settle($r); elseif (str_starts_with($r, 'BJE-')) EscrowController::settle($r); elseif (str_starts_with($r, OrderPay::PREFIX)) OrderPay::settle($r); else $this->settle($r); }
        if (str_starts_with((string) ($j['event'] ?? ''), 'transfer.') && is_array($j['data'] ?? null)) { EscrowController::transferEvent((string) $j['event'], $j['data']); OrderPay::transferEvent((string) $j['event'], $j['data']); }
        http_response_code(200); echo 'ok'; exit;
    }
}

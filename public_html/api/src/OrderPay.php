<?php
declare(strict_types=1);

/**
 * Paying for a food, drinks or grocery order inside Buja. The customer pays through Paystack; only then is the order
 * sent to the business. Buja holds the money while it is prepared and delivered, and pays the business when the
 * customer says they have it, or a day after the business marks it delivered if the customer says nothing.
 * If the business declines, never answers, or the order is cancelled, the customer is refunded in full.
 *
 *   pending -> paid -> released            (payout to the business: queued -> sent)
 *                 \-> refunded             (declined, expired, cancelled)
 *                 \-> disputed -> released | refunded   (an admin decides)
 */
final class OrderPay
{
    public const PREFIX = 'BJO-';
    public const PAYOUT_PREFIX = 'BJQ-';
    public const RELEASE_HOURS = 24;       // after the business marks it delivered
    public const PENDING_MIN = 45;         // an unfinished payment is forgotten after this

    /** Buyer protection, the same as Declutter: 2.5%, at least ₦100, at most ₦2,500. It covers Paystack's charges. */
    public static function fee(int $total): int { return EscrowController::fee($total); }

    /** Starts a payment for a checked order. Nothing is sent to the business yet. */
    public static function start(array $u, array $o): array
    {
        if ((string) Http::config('paystack_secret', '') === '') Http::json(['error' => 'unavailable', 'message' => 'Paying in the app is not switched on yet. Choose pay on delivery.'], 409);
        if (empty($u['email'])) Http::json(['error' => 'validation', 'message' => 'Add an email to your account first; Paystack sends the receipt there. Or choose pay on delivery.'], 422);
        $sub = (int) $o['subtotal']; $del = (int) ($o['deliveryFee'] ?? 0); $fee = self::fee($sub + $del); $total = $sub + $del + $fee;
        $ref = self::PREFIX . $o['artisanId'] . '-' . bin2hex(random_bytes(5));
        Db::run('INSERT INTO job_payments (reference, customer_id, artisan_id, subtotal, delivery_fee, fee, total, draft_json, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [$ref, $u['id'], $o['artisanId'], $sub, $del, $fee, $total, json_encode($o, JSON_UNESCAPED_UNICODE), Db::now(), Db::now()]);
        try { $p = Paystack::initialize($u['email'], $total, $ref, ['purpose' => 'order', 'artisan_id' => $o['artisanId']]); }
        catch (Throwable $e) { Db::run("UPDATE job_payments SET status = 'cancelled', updated_at = ? WHERE reference = ?", [Db::now(), $ref]); Http::json(['error' => 'unavailable', 'message' => 'Payments are not available right now. Choose pay on delivery, or try again shortly.'], 503); }
        Track::hit($u, 'artisan', 'orderpay_start');
        return ['url' => $p['url'], 'reference' => $ref, 'total' => $total, 'fee' => $fee];
    }

    /** Called by the Paystack callback and webhook for BJO- references. Safe to call twice. Returns the row. */
    public static function settle(string $ref): ?array
    {
        $p = Db::one('SELECT * FROM job_payments WHERE reference = ?', [$ref]); if (!$p) return null;
        if ($p['status'] !== 'pending') return $p;
        $paid = Paystack::verify($ref);
        if ($paid === null || $paid < (int) $p['total']) return $p;
        $st = Db::pdo()->prepare("UPDATE job_payments SET status = 'paid', paid_at = ?, updated_at = ? WHERE id = ? AND status = 'pending'"); $st->execute([Db::now(), Db::now(), $p['id']]);
        if ($st->rowCount() !== 1) return Db::one('SELECT * FROM job_payments WHERE id = ?', [$p['id']]);
        // Paid: now the order goes to the business, exactly as it was checked when the customer paid.
        $u = Db::one('SELECT * FROM users WHERE id = ?', [$p['customer_id']]);
        $o = json_decode((string) $p['draft_json'], true);
        $jobId = ServiceJobController::insert($u, $o, 'online');
        Db::run('UPDATE job_payments SET job_id = ?, updated_at = ? WHERE id = ?', [$jobId, Db::now(), $p['id']]);
        Notify::user((int) $p['customer_id'], 'work', 'Paid: ₦' . number_format((int) $p['total']), 'Buja holds your payment until you have your order. If they cannot take it, you get it all back.', '/#/jobs/' . $jobId);
        return Db::one('SELECT * FROM job_payments WHERE id = ?', [$p['id']]);
    }

    /** What the job screen shows about payment. */
    public static function shape(int $jobId): ?array
    {
        try { $p = Db::one('SELECT * FROM job_payments WHERE job_id = ?', [$jobId]); } catch (Throwable $e) { return null; }
        if (!$p) return null;
        return ['status' => $p['status'], 'total' => (int) $p['total'], 'fee' => (int) $p['fee'], 'subtotal' => (int) $p['subtotal'], 'deliveryFee' => (int) $p['delivery_fee'],
            'paidAt' => $p['paid_at'], 'releaseAt' => $p['release_at'], 'releasedAt' => $p['released_at'], 'refundedAt' => $p['refunded_at'], 'note' => $p['note'],
            'payout' => $p['payout_status'], 'payoutSentAt' => $p['payout_sent_at']];
    }

    /**
     * Keeps the money in step with the order. Called after every change to a job, and by the scheduler.
     * Declined, expired or cancelled: refund. Delivered: release a day later, or at once when the customer confirms.
     */
    public static function sync(int $jobId, bool $customerConfirmed = false): void
    {
        try { $p = Db::one('SELECT * FROM job_payments WHERE job_id = ?', [$jobId]); } catch (Throwable $e) { return; }
        if (!$p || $p['status'] !== 'paid') return;
        $j = Db::one('SELECT status, cancelled_by, customer_id FROM service_jobs WHERE id = ?', [$jobId]); if (!$j) return;
        if (in_array($j['status'], ['declined', 'expired'], true)) { self::refund($p, $j['status'] === 'declined' ? 'The business could not take this order.' : 'The business did not answer in time.'); return; }
        if ($j['status'] === 'cancelled') { self::refund($p, (int) $j['cancelled_by'] === (int) $j['customer_id'] ? 'You cancelled the order.' : 'The business cancelled the order.'); return; }
        if ($j['status'] === 'done') {
            if ($customerConfirmed) { self::release($p, 'The customer confirmed they have the order.'); return; }
            if (empty($p['release_at'])) Db::run('UPDATE job_payments SET release_at = ?, updated_at = ? WHERE id = ?', [gmdate('Y-m-d H:i:s', time() + self::RELEASE_HOURS * 3600), Db::now(), $p['id']]);
        }
    }

    /** The customer reports a problem before the money is released. */
    public static function dispute(int $jobId, array $u, string $note): void
    {
        $p = Db::one('SELECT * FROM job_payments WHERE job_id = ?', [$jobId]);
        if (!$p || (int) $p['customer_id'] !== (int) $u['id'] || $p['status'] !== 'paid') Http::json(['error' => 'validation', 'message' => 'There is no payment waiting on this order to report a problem about.'], 422);
        $note = mb_substr(trim($note), 0, 300); if (mb_strlen($note) < 10) Http::json(['error' => 'validation', 'fields' => ['note' => 'Tell us what went wrong, in a sentence or two.']], 422);
        Db::run("UPDATE job_payments SET status = 'disputed', note = ?, updated_at = ? WHERE id = ?", [$note, Db::now(), $p['id']]);
        Notify::user((int) $p['artisan_id'], 'work', 'The customer reported a problem', 'Buja is holding the payment while we look into it: "' . $note . '"', '/#/jobs/' . $jobId, true);
        self::tellAdmins('Order payment problem', $note, '/#/admin/escrow');
    }

    public static function release(array $p, string $why): void
    {
        $st = Db::pdo()->prepare("UPDATE job_payments SET status = 'released', released_at = ?, note = COALESCE(note, ?), payout_status = 'queued', payout_ref = ?, updated_at = ? WHERE id = ? AND status IN ('paid','disputed')");
        $st->execute([Db::now(), $why, self::PAYOUT_PREFIX . $p['id'] . '-' . bin2hex(random_bytes(4)), Db::now(), $p['id']]); if ($st->rowCount() !== 1) return;
        self::sendPayout((int) $p['id']);
        $amt = (int) $p['subtotal'] + (int) $p['delivery_fee'];
        Notify::user((int) $p['artisan_id'], 'work', 'Released: ₦' . number_format($amt) . ' is yours', Db::one('SELECT 1 AS x FROM payout_accounts WHERE user_id = ?', [$p['artisan_id']]) ? 'The money is on its way to your bank account.' : 'Add your bank account in Buja so we can send it.', '/#/artisans/dashboard', true);
    }

    /** Sends the business its money through Paystack when transfers are on and it has a bank account; otherwise it waits for an admin. */
    public static function sendPayout(int $payId): void
    {
        $p = Db::one('SELECT * FROM job_payments WHERE id = ?', [$payId]); if (!$p || !in_array($p['payout_status'], ['queued', 'failed'], true)) return;
        $acct = Db::one('SELECT recipient_code FROM payout_accounts WHERE user_id = ?', [$p['artisan_id']]);
        if (!$acct || !(bool) Http::config('paystack_transfers', false)) return;
        Db::run("UPDATE job_payments SET payout_status = 'sending' WHERE id = ?", [$p['id']]);
        try { $code = Paystack::transfer($acct['recipient_code'], (int) $p['subtotal'] + (int) $p['delivery_fee'], (string) $p['payout_ref'], 'Buja order #' . (int) $p['job_id']); Db::run("UPDATE job_payments SET payout_status = 'sent', transfer_code = ?, payout_sent_at = ?, payout_error = NULL WHERE id = ?", [$code, Db::now(), $p['id']]); }
        catch (Throwable $e) { Db::run("UPDATE job_payments SET payout_status = 'failed', payout_error = ? WHERE id = ?", [mb_substr($e->getMessage(), 0, 200), $p['id']]); }
    }

    public static function refund(array $p, string $why): void
    {
        $st = Db::pdo()->prepare("UPDATE job_payments SET status = 'refunded', refunded_at = ?, note = ?, updated_at = ? WHERE id = ? AND status IN ('paid','disputed')");
        $st->execute([Db::now(), $why, Db::now(), $p['id']]); if ($st->rowCount() !== 1) return;
        try { Paystack::refund((string) $p['reference']); }
        catch (Throwable $e) { Db::run('UPDATE job_payments SET note = ? WHERE id = ?', [mb_substr($why . ' The refund needs an admin: ' . $e->getMessage(), 0, 300), $p['id']]); self::tellAdmins('Order refund needs attention', 'Order #' . (int) $p['job_id'], '/#/admin/escrow'); }
        Notify::user((int) $p['customer_id'], 'work', 'Refund on its way: ₦' . number_format((int) $p['total']), $why . ' Paystack returns it to how you paid, usually within 5 working days.', '/#/jobs/' . (int) $p['job_id'], true);
    }

    /** Scheduler: release what is due, refund what went wrong, forget abandoned payments, retry failed payouts. */
    public static function tick(): void
    {
        $st = Db::pdo()->prepare("SELECT * FROM job_payments WHERE status = 'paid' AND release_at IS NOT NULL AND release_at <= ? LIMIT 20"); $st->execute([Db::now()]);
        foreach ($st->fetchAll() as $p) self::release($p, 'Released automatically: no problem was reported within a day of delivery.');
        $st = Db::pdo()->prepare("SELECT job_id FROM job_payments WHERE status = 'paid' AND job_id IS NOT NULL LIMIT 50"); $st->execute();
        foreach ($st->fetchAll() as $p) self::sync((int) $p['job_id']);
        Db::run("UPDATE job_payments SET status = 'cancelled', updated_at = ? WHERE status = 'pending' AND created_at < ?", [Db::now(), gmdate('Y-m-d H:i:s', time() - self::PENDING_MIN * 60)]);
        $st = Db::pdo()->prepare("SELECT id FROM job_payments WHERE payout_status = 'failed' LIMIT 10"); $st->execute(); foreach ($st->fetchAll() as $p) self::sendPayout((int) $p['id']);
    }

    /** Paystack transfer webhooks keep order payouts honest. */
    public static function transferEvent(string $event, array $data): void
    {
        $ref = (string) ($data['reference'] ?? ''); if (!str_starts_with($ref, self::PAYOUT_PREFIX)) return;
        if ($event === 'transfer.success') Db::run("UPDATE job_payments SET payout_status = 'sent', payout_sent_at = COALESCE(payout_sent_at, ?) WHERE payout_ref = ?", [Db::now(), $ref]);
        if ($event === 'transfer.failed' || $event === 'transfer.reversed') { Db::run("UPDATE job_payments SET payout_status = 'failed', payout_error = ? WHERE payout_ref = ?", [$event, $ref]); self::tellAdmins('A business payout failed', $ref, '/#/admin/escrow'); }
    }

    /** Admin: GET list for the money screen, POST decisions. */
    public static function adminList(): array
    {
        $rows = function (string $sql) { try { $st = Db::pdo()->prepare($sql); $st->execute(); return $st->fetchAll(); } catch (Throwable $e) { return []; } };
        $shape = function ($p) {
            $c = Db::one('SELECT name FROM users WHERE id = ?', [$p['customer_id']]); $a = Db::one('SELECT business FROM artisans WHERE user_id = ?', [$p['artisan_id']]); $b = Db::one('SELECT bank_name, account_last4, account_name FROM payout_accounts WHERE user_id = ?', [$p['artisan_id']]);
            return ['id' => (int) $p['id'], 'jobId' => $p['job_id'] !== null ? (int) $p['job_id'] : null, 'status' => $p['status'], 'total' => (int) $p['total'], 'owed' => (int) $p['subtotal'] + (int) $p['delivery_fee'], 'fee' => (int) $p['fee'],
                'customer' => explode(' ', trim((string) ($c['name'] ?? '')))[0], 'business' => $a['business'] ?? 'Business', 'bank' => $b ? $b['bank_name'] . ' ····' . $b['account_last4'] . ' (' . $b['account_name'] . ')' : null,
                'note' => $p['note'], 'payout' => $p['payout_status'], 'payoutError' => $p['payout_error'], 'paidAt' => $p['paid_at']];
        };
        $held = Db::one("SELECT COALESCE(SUM(total),0) AS s FROM job_payments WHERE status IN ('paid','disputed')");
        return ['held' => (int) ($held['s'] ?? 0),
            'disputes' => array_map($shape, $rows("SELECT * FROM job_payments WHERE status = 'disputed' ORDER BY updated_at")),
            'payouts' => array_map($shape, $rows("SELECT * FROM job_payments WHERE payout_status IN ('queued','failed','sending') ORDER BY released_at")),
            'recent' => array_map($shape, $rows("SELECT * FROM job_payments WHERE status <> 'pending' AND status <> 'cancelled' ORDER BY id DESC LIMIT 30"))];
    }
    public static function adminAct(int $id, string $action, array $admin): void
    {
        $p = Db::one('SELECT * FROM job_payments WHERE id = ?', [$id]); if (!$p) Http::json(['error' => 'not_found'], 404);
        if ($action === 'release') self::release($p, 'Released by Buja after checking the problem.');
        elseif ($action === 'refund') self::refund($p, 'Refunded by Buja after checking the problem.');
        elseif ($action === 'paid') Db::run("UPDATE job_payments SET payout_status = 'sent', payout_sent_at = ?, payout_error = ? WHERE id = ? AND payout_status <> 'sent'", [Db::now(), 'Paid by hand by ' . explode(' ', trim((string) $admin['name']))[0], $id]);
        elseif ($action === 'retry') { Db::run("UPDATE job_payments SET payout_status = 'failed' WHERE id = ? AND payout_status = 'queued'", [$id]); self::sendPayout($id); }
        else Http::json(['error' => 'not_found'], 404);
    }

    private static function tellAdmins(string $title, string $body, string $url): void
    {
        $st = Db::pdo()->prepare("SELECT id FROM users WHERE (role = 'admin' OR is_admin = 1) AND deleted_at IS NULL"); $st->execute();
        foreach ($st->fetchAll() as $a) Notify::user((int) $a['id'], 'offers', $title, $body, $url, true);
    }
}

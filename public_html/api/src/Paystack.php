<?php
declare(strict_types=1);

/** Paystack over cURL: initialize a transaction, verify it, check a webhook signature. PAYSTACK_MOCK=1 simulates success for local tests. */
final class Paystack
{
    private static function call(string $method, string $path, ?array $body = null): array
    {
        $secret = (string) Http::config('paystack_secret', '');
        if ($secret === '') throw new RuntimeException('Paystack is not configured.');
        if ((bool) Http::config('paystack_mock', false)) {
            if (str_starts_with($path, '/transaction/initialize')) return ['status' => true, 'data' => ['authorization_url' => (string) Http::config('app_origin') . '/api/pay/callback?reference=' . $body['reference'], 'reference' => $body['reference']]];
            if (str_starts_with($path, '/transaction/verify/')) { $ref = basename($path); $row = Db::one('SELECT amount FROM payments WHERE reference = ?', [$ref]) ?: Db::one('SELECT total AS amount FROM escrow_orders WHERE reference = ?', [$ref]) ?: Db::one('SELECT total AS amount FROM job_payments WHERE reference = ?', [$ref]); return ['status' => true, 'data' => ['status' => 'success', 'amount' => ($row ? (int) $row['amount'] : 3500) * 100, 'reference' => $ref, 'paid_at' => Db::now()]]; }
            if (str_starts_with($path, '/bank?')) return ['status' => true, 'data' => [['name' => 'Access Bank', 'code' => '044'], ['name' => 'GTBank', 'code' => '058'], ['name' => 'Moniepoint MFB', 'code' => '50515'], ['name' => 'OPay', 'code' => '999992'], ['name' => 'Zenith Bank', 'code' => '057']]];
            if (str_starts_with($path, '/bank/resolve')) return ['status' => true, 'data' => ['account_name' => 'TEST ACCOUNT HOLDER', 'account_number' => '0123456789']];
            if ($path === '/transferrecipient') return ['status' => true, 'data' => ['recipient_code' => 'RCP_mock' . substr(md5((string) microtime(true)), 0, 8)]];
            if ($path === '/transfer') return ['status' => true, 'data' => ['status' => 'success', 'transfer_code' => 'TRF_mock' . substr(md5((string) microtime(true)), 0, 8)]];
            if ($path === '/refund') return ['status' => true, 'data' => ['status' => 'pending']];;
        }
        $ch = curl_init('https://api.paystack.co' . $path);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_CUSTOMREQUEST => $method, CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $secret, 'Content-Type: application/json'], CURLOPT_POSTFIELDS => $body !== null ? json_encode($body) : null]);
        $raw = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        $j = json_decode((string) $raw, true);
        if ($code >= 400 || !is_array($j)) { error_log('[buja paystack] ' . $code . ' ' . substr((string) $raw, 0, 200)); throw new RuntimeException('Payment service error.'); }
        return $j;
    }

    /** Returns ['url' => ..., 'reference' => ...] for the user to pay. Amount in naira. */
    public static function initialize(string $email, int $naira, string $reference, array $metadata): array
    {
        $r = self::call('POST', '/transaction/initialize', ['email' => $email, 'amount' => $naira * 100, 'reference' => $reference, 'currency' => 'NGN', 'callback_url' => (string) Http::config('app_origin') . '/api/pay/callback', 'metadata' => $metadata, 'channels' => ['card', 'bank', 'ussd', 'bank_transfer']]);
        return ['url' => (string) ($r['data']['authorization_url'] ?? ''), 'reference' => (string) ($r['data']['reference'] ?? $reference)];
    }

    /** Verifies with Paystack; returns amount in naira on success, null otherwise. */
    public static function verify(string $reference): ?int
    {
        $r = self::call('GET', '/transaction/verify/' . rawurlencode($reference));
        return (($r['data']['status'] ?? '') === 'success') ? (int) round(((int) $r['data']['amount']) / 100) : null;
    }

    public static function webhookValid(string $rawBody, string $signature): bool
    {
        $secret = (string) Http::config('paystack_secret', ''); if ($secret === '') return false;
        return hash_equals(hash_hmac('sha512', $rawBody, $secret), $signature);
    }

    /* ---------- Escrow payouts and refunds ---------- */
    /** Nigerian banks for the payout form, cached for a day. */
    public static function banks(): array
    {
        $c = Db::one("SELECT v FROM app_keys WHERE k = 'paystack_banks'");
        if ($c && ($j = json_decode((string) $c['v'], true)) && ($j['at'] ?? 0) > time() - 86400) return $j['banks'];
        $r = self::call('GET', '/bank?country=nigeria&perPage=200');
        $banks = array_values(array_map(fn($b) => ['code' => (string) $b['code'], 'name' => (string) $b['name']], $r['data'] ?? []));
        try { Db::run("DELETE FROM app_keys WHERE k = 'paystack_banks'"); Db::run("INSERT INTO app_keys (k, v) VALUES ('paystack_banks', ?)", [json_encode(['at' => time(), 'banks' => $banks])]); } catch (Throwable $e) {}
        return $banks;
    }
    /** The account holder's name for a bank and account number, or null if the number is wrong. */
    public static function resolveAccount(string $bank, string $number): ?string
    {
        try { $r = self::call('GET', '/bank/resolve?account_number=' . rawurlencode($number) . '&bank_code=' . rawurlencode($bank)); } catch (Throwable $e) { return null; }
        return $r['data']['account_name'] ?? null;
    }
    public static function createRecipient(string $name, string $bank, string $number): string
    {
        $r = self::call('POST', '/transferrecipient', ['type' => 'nuban', 'name' => $name, 'account_number' => $number, 'bank_code' => $bank, 'currency' => 'NGN']);
        return (string) ($r['data']['recipient_code'] ?? '');
    }
    /** Sends naira to a saved recipient. Returns the transfer code; Paystack confirms it later by webhook. */
    public static function transfer(string $recipient, int $naira, string $reference, string $reason): string
    {
        $r = self::call('POST', '/transfer', ['source' => 'balance', 'amount' => $naira * 100, 'recipient' => $recipient, 'reference' => $reference, 'reason' => $reason]);
        return (string) ($r['data']['transfer_code'] ?? '');
    }
    public static function refund(string $reference): void { self::call('POST', '/refund', ['transaction' => $reference]); }
}

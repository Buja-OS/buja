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
            if (str_starts_with($path, '/transaction/verify/')) return ['status' => true, 'data' => ['status' => 'success', 'amount' => 350000, 'reference' => basename($path), 'paid_at' => Db::now()]];
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
}

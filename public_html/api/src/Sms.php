<?php
declare(strict_types=1);

/**
 * Text messages through Termii (termii.com), the Nigerian SMS gateway. Used for sign-in codes and SOS alerts.
 * Needs TERMII_API_KEY, TERMII_SENDER (an approved sender ID) and TERMII_BASE_URL from the Termii dashboard.
 * SMS_MOCK=1 writes the message to the server log instead, for testing without spending credit.
 */
final class Sms
{
    public static function configured(): bool { return self::mock() || ((string) Http::config('termii_api_key', '') !== '' && (string) Http::config('termii_sender', '') !== ''); }
    public static function mock(): bool { return (bool) Http::config('sms_mock', false); }

    /** $to is a Nigerian number in any common form. Returns true when Termii accepted it. */
    public static function send(string $to, string $text): bool
    {
        $phone = Validator::ngPhone($to); if ($phone === null) return false;
        $digits = ltrim($phone, '+');
        if (self::mock()) { error_log('[buja sms mock] to ' . $digits . ': ' . $text); return true; }
        $key = (string) Http::config('termii_api_key', ''); $from = (string) Http::config('termii_sender', '');
        if ($key === '' || $from === '') { error_log('[buja sms] skipped, Termii is not configured'); return false; }
        $base = rtrim((string) Http::config('termii_base_url', 'https://v3.api.termii.com'), '/');
        $body = json_encode(['to' => $digits, 'from' => $from, 'sms' => $text, 'type' => 'plain', 'channel' => (string) Http::config('termii_channel', 'dnd'), 'api_key' => $key]);
        $ch = curl_init($base . '/api/sms/send');
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_POSTFIELDS => $body, CURLOPT_HTTPHEADER => ['Content-Type: application/json']]);
        $raw = (string) curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($code < 200 || $code >= 300) { error_log('[buja sms] Termii returned ' . $code . ' ' . substr($raw, 0, 160)); return false; }
        return true;
    }
}

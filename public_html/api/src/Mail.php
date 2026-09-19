<?php
declare(strict_types=1);

/** Transactional email through Brevo's API over cURL. Silently skips when no key is configured. */
final class Mail
{
    public static function send(string $to, string $toName, string $subject, string $html): bool
    {
        $key = (string) Http::config('brevo_api_key', '');
        if ($key === '') { error_log('[buja mail] skipped, no BREVO_API_KEY: ' . $subject . ' to ' . $to); return false; }
        $from = (string) Http::config('mail_from', 'hello@buja.ng');
        $body = json_encode(['sender' => ['name' => 'Buja', 'email' => $from], 'to' => [['email' => $to, 'name' => $toName ?: $to]], 'subject' => $subject,
            'htmlContent' => '<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1B1B1F"><div style="font-size:22px;font-weight:700;letter-spacing:2px;margin-bottom:16px">Buja</div>' . $html . '<p style="color:#6F6F78;font-size:12px;margin-top:28px">Jobs, people and movement across Abuja. If you did not expect this email you can ignore it.</p></div>']);
        $ch = curl_init('https://api.brevo.com/v3/smtp/email');
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => ['accept: application/json', 'content-type: application/json', 'api-key: ' . $key]]);
        curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($code < 200 || $code >= 300) error_log('[buja mail] Brevo returned ' . $code);
        return $code >= 200 && $code < 300;
    }

    /** One-time token for email verification or password reset. Stored hashed; returns the raw token for the link. */
    public static function token(int $userId, string $purpose, int $minutes): string
    {
        $raw = WebPush::b64u(random_bytes(24));
        Db::run('DELETE FROM email_tokens WHERE user_id = ? AND purpose = ?', [$userId, $purpose]);
        Db::run('INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at, created_at) VALUES (?,?,?,?,?)', [$userId, $purpose, hash('sha256', $raw), gmdate('Y-m-d H:i:s', time() + $minutes * 60), Db::now()]);
        return $raw;
    }

    public static function consume(string $raw, string $purpose): ?int
    {
        $row = Db::one('SELECT * FROM email_tokens WHERE token_hash = ? AND purpose = ? AND expires_at > ?', [hash('sha256', $raw), $purpose, Db::now()]);
        if ($row === null) return null;
        Db::run('DELETE FROM email_tokens WHERE id = ?', [$row['id']]);
        return (int) $row['user_id'];
    }
}

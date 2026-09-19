<?php
declare(strict_types=1);

/**
 * Verifies a Google Identity Services ID token.
 * Uses Google's tokeninfo endpoint over cURL, which works on shared hosting with no libraries.
 * Returns ['sub','email','name','picture'] or null.
 */
final class Google
{
    public static function verify(string $idToken): ?array
    {
        $clientId = (string) Http::config('google_client_id', '');
        if ($clientId === '' || $idToken === '') return null;

        $ch = curl_init('https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken));
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_SSL_VERIFYPEER => true]);
        $raw = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($raw === false || $code !== 200) return null;

        $info = json_decode((string) $raw, true);
        if (!is_array($info)) return null;
        if (($info['aud'] ?? '') !== $clientId) return null;
        if (!in_array($info['iss'] ?? '', ['accounts.google.com', 'https://accounts.google.com'], true)) return null;
        if ((int) ($info['exp'] ?? 0) < time()) return null;
        if (($info['email_verified'] ?? 'false') !== 'true') return null;

        return [
            'sub'     => (string) $info['sub'],
            'email'   => strtolower((string) $info['email']),
            'name'    => (string) ($info['name'] ?? ''),
            'picture' => (string) ($info['picture'] ?? ''),
        ];
    }
}

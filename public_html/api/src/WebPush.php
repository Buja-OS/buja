<?php
declare(strict_types=1);

/**
 * Web Push (RFC 8030 + 8291 + 8292) with no library: VAPID ES256 signing and aes128gcm payload
 * encryption using OpenSSL. Keys are generated once and kept in the app_keys table.
 */
final class WebPush
{
    private const CURVE_DER_PUB = "\x30\x59\x30\x13\x06\x07\x2a\x86\x48\xce\x3d\x02\x01\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07\x03\x42\x00";

    public static function b64u(string $s): string   { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
    public static function unb64u(string $s): string { return base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4)) ?: ''; }

    /** Returns ['pem' => private key PEM, 'public' => 65-byte uncompressed point], creating them on first use. */
    public static function keys(): array
    {
        $row = Db::one("SELECT v FROM app_keys WHERE k = 'vapid'");
        if ($row) {
            $j = json_decode((string) $row['v'], true);
            // Stored base64 so the binary public key survives JSON. Older broken rows (json_encode of raw bytes) decode to null and are regenerated.
            if (is_array($j) && !empty($j['pem']) && !empty($j['public_b64'])) return ['pem' => $j['pem'], 'public' => base64_decode($j['public_b64'])];
            Db::run("DELETE FROM app_keys WHERE k = 'vapid'");
            Db::run('DELETE FROM push_subscriptions'); // subscriptions were signed against the lost key and would be rejected
        }
        $key = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
        openssl_pkey_export($key, $pem);
        $d = openssl_pkey_get_details($key);
        $pub = "\x04" . str_pad($d['ec']['x'], 32, "\0", STR_PAD_LEFT) . str_pad($d['ec']['y'], 32, "\0", STR_PAD_LEFT);
        Db::run("INSERT INTO app_keys (k, v) VALUES ('vapid', ?)", [json_encode(['pem' => $pem, 'public_b64' => base64_encode($pub)])]);
        return ['pem' => $pem, 'public' => $pub];
    }

    public static function publicKeyB64u(): string { return self::b64u(self::keys()['public']); }

    /** PEM public key from a raw 65-byte uncompressed P-256 point. */
    private static function pubPem(string $raw): string
    {
        return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode(self::CURVE_DER_PUB . $raw), 64, "\n") . "-----END PUBLIC KEY-----\n";
    }

    /** PEM private key from raw 32-byte scalar + 65-byte public point (used by the RFC test). */
    public static function privPem(string $d, string $pub): string
    {
        $der = "\x30\x77\x02\x01\x01\x04\x20" . $d . "\xa0\x0a\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07\xa1\x44\x03\x42\x00" . $pub;
        return "-----BEGIN EC PRIVATE KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END EC PRIVATE KEY-----\n";
    }

    private static function rawPublic($key): string
    {
        $d = openssl_pkey_get_details($key);
        return "\x04" . str_pad($d['ec']['x'], 32, "\0", STR_PAD_LEFT) . str_pad($d['ec']['y'], 32, "\0", STR_PAD_LEFT);
    }

    /** RFC 8291 aes128gcm encryption. $asPem and $salt are injectable for the test vector. */
    public static function encrypt(string $payload, string $uaPublic, string $auth, ?string $asPem = null, ?string $salt = null): string
    {
        $as = $asPem ? openssl_pkey_get_private($asPem) : openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
        $asPublic = self::rawPublic($as);
        $ecdh = openssl_pkey_derive(openssl_pkey_get_public(self::pubPem($uaPublic)), $as, 32);
        if ($ecdh === false) throw new RuntimeException('ECDH failed');
        $ikm = hash_hkdf('sha256', $ecdh, 32, "WebPush: info\0" . $uaPublic . $asPublic, $auth);
        $salt = $salt ?? random_bytes(16);
        $cek = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", $salt);
        $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", $salt);
        $padded = $payload . "\x02";
        $tag = '';
        $ct = openssl_encrypt($padded, 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag, '', 16);
        if ($ct === false) throw new RuntimeException('AES-GCM failed');
        return $salt . pack('N', 4096) . chr(65) . $asPublic . $ct . $tag;
    }

    /** VAPID Authorization header value for the given push endpoint. */
    public static function vapid(string $endpoint, string $subject): string
    {
        $k = self::keys();
        $aud = parse_url($endpoint, PHP_URL_SCHEME) . '://' . parse_url($endpoint, PHP_URL_HOST);
        $h = self::b64u(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
        $p = self::b64u(json_encode(['aud' => $aud, 'exp' => time() + 12 * 3600, 'sub' => $subject]));
        openssl_sign("$h.$p", $der, openssl_pkey_get_private($k['pem']), OPENSSL_ALGO_SHA256);
        // DER ECDSA signature -> raw r||s
        $pos = 2; $rLen = ord($der[$pos + 1]); $r = substr($der, $pos + 2, $rLen); $pos += 2 + $rLen; $sLen = ord($der[$pos + 1]); $s = substr($der, $pos + 2, $sLen);
        $r = str_pad(ltrim($r, "\0"), 32, "\0", STR_PAD_LEFT); $s = str_pad(ltrim($s, "\0"), 32, "\0", STR_PAD_LEFT);
        return 'vapid t=' . "$h.$p." . self::b64u($r . $s) . ', k=' . self::b64u($k['public']);
    }

    /** Sends one notification. Returns HTTP status; 404/410 mean the subscription is dead. */
    /** Urgency 'high' asks Android to wake the phone at once (calls); 'normal' may be held back to save battery. */
    public static function send(array $sub, array $payload, string $subject, int $ttl = 86400, string $urgency = 'normal'): int
    {
        $urgency = in_array($urgency, ['very-low', 'low', 'normal', 'high'], true) ? $urgency : 'normal';
        $body = self::encrypt(json_encode($payload, JSON_UNESCAPED_UNICODE), self::unb64u($sub['p256dh']), self::unb64u($sub['auth']));
        $ch = curl_init($sub['endpoint']);
        curl_setopt_array($ch, [
            CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 6, CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => ['Content-Type: application/octet-stream', 'Content-Encoding: aes128gcm', 'Content-Length: ' . strlen($body), 'TTL: ' . $ttl, 'Urgency: ' . $urgency, 'Authorization: ' . self::vapid($sub['endpoint'], $subject)],
        ]);
        curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return $code;
    }
}

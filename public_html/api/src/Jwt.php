<?php
declare(strict_types=1);

/** Minimal HS256 JWT. Enough for a first-party session cookie; no third-party claims are ever trusted from it. */
final class Jwt
{
    public static function encode(array $claims, string $secret): string
    {
        $h = self::b64(json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
        $p = self::b64(json_encode($claims));
        $s = self::b64(hash_hmac('sha256', "$h.$p", $secret, true));
        return "$h.$p.$s";
    }

    public static function decode(string $jwt, string $secret): ?array
    {
        $parts = explode('.', $jwt);
        if (count($parts) !== 3) return null;
        [$h, $p, $s] = $parts;
        $expected = self::b64(hash_hmac('sha256', "$h.$p", $secret, true));
        if (!hash_equals($expected, $s)) return null;
        $claims = json_decode(self::unb64($p), true);
        if (!is_array($claims)) return null;
        if (isset($claims['exp']) && time() >= (int) $claims['exp']) return null;
        return $claims;
    }

    private static function b64(string $s): string   { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }
    private static function unb64(string $s): string { return base64_decode(strtr($s, '-_', '+/')) ?: ''; }
}

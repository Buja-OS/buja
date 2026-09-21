<?php
declare(strict_types=1);

/**
 * Fingerprint and face sign-in, using the phone's own authenticator (WebAuthn). No library: a small CBOR
 * reader for the registration blob, and OpenSSL to check the signature at sign-in. Supports ES256, which
 * every modern phone uses, and RS256 for Windows Hello.
 */
final class WebAuthn
{
    public static function b64u(string $bin): string { return rtrim(strtr(base64_encode($bin), '+/', '-_'), '='); }
    public static function unb64u(string $s): string { return base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4)) ?: ''; }
    public static function rpId(): string { return (string) parse_url((string) Http::config('app_origin'), PHP_URL_HOST) ?: 'localhost'; }

    /** Minimal CBOR decoder: enough for attestation objects and COSE keys. */
    public static function cbor(string $d, int &$p = 0)
    {
        $ib = ord($d[$p++]); $mt = $ib >> 5; $ai = $ib & 0x1f;
        $len = $ai;
        if ($ai === 24) { $len = ord($d[$p++]); }
        elseif ($ai === 25) { $len = unpack('n', substr($d, $p, 2))[1]; $p += 2; }
        elseif ($ai === 26) { $len = unpack('N', substr($d, $p, 4))[1]; $p += 4; }
        elseif ($ai === 27) { $len = unpack('J', substr($d, $p, 8))[1]; $p += 8; }
        switch ($mt) {
            case 0: return $len;
            case 1: return -1 - $len;
            case 2: $v = substr($d, $p, $len); $p += $len; return $v;
            case 3: $v = substr($d, $p, $len); $p += $len; return $v;
            case 4: $a = []; for ($i = 0; $i < $len; $i++) $a[] = self::cbor($d, $p); return $a;
            case 5: $m = []; for ($i = 0; $i < $len; $i++) { $k = self::cbor($d, $p); $m[$k] = self::cbor($d, $p); } return $m;
            case 7: if ($ai === 20) return false; if ($ai === 21) return true; if ($ai === 22) return null; return null;
        }
        return null;
    }

    /** Pulls the credential id and public key (as PEM) out of a registration's attestationObject. */
    public static function parseAttestation(string $attestationObject): ?array
    {
        $p = 0; $att = self::cbor($attestationObject, $p);
        $auth = $att['authData'] ?? null; if (!is_string($auth) || strlen($auth) < 37) return null;
        $flags = ord($auth[32]);
        if (!($flags & 0x40)) return null; // no attested credential data
        $off = 37; $off += 16; // aaguid
        $credLen = unpack('n', substr($auth, $off, 2))[1]; $off += 2;
        $credId = substr($auth, $off, $credLen); $off += $credLen;
        $q = $off; $cose = self::cbor($auth, $q);
        $pem = self::coseToPem($cose); if (!$pem) return null;
        return ['credentialId' => $credId, 'pem' => $pem, 'alg' => (int) ($cose[3] ?? -7), 'signCount' => unpack('N', substr($auth, 33, 4))[1], 'rpIdHash' => substr($auth, 0, 32), 'flags' => $flags];
    }

    private static function coseToPem(array $k): ?string
    {
        $alg = (int) ($k[3] ?? 0);
        if ($alg === -7 && (int) ($k[1] ?? 0) === 2) { // EC2 P-256
            $x = $k[-2] ?? ''; $y = $k[-3] ?? ''; if (strlen($x) !== 32 || strlen($y) !== 32) return null;
            $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . "\x04" . $x . $y;
        } elseif ($alg === -257 && (int) ($k[1] ?? 0) === 3) { // RSA
            $n = $k[-1] ?? ''; $e = $k[-2] ?? ''; if ($n === '' || $e === '') return null;
            $int = fn(string $b) => "\x02" . self::derLen(strlen(ltrim($b, "\x00")) + (ord(ltrim($b, "\x00")[0]) & 0x80 ? 1 : 0)) . ((ord(ltrim($b, "\x00")[0]) & 0x80) ? "\x00" : '') . ltrim($b, "\x00");
            $seq = $int($n) . $int($e); $rsa = "\x30" . self::derLen(strlen($seq)) . $seq;
            $bit = "\x03" . self::derLen(strlen($rsa) + 1) . "\x00" . $rsa;
            $algId = hex2bin('300d06092a864886f70d0101010500');
            $der = "\x30" . self::derLen(strlen($algId) + strlen($bit)) . $algId . $bit;
        } else return null;
        return "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
    }
    private static function derLen(int $n): string { if ($n < 128) return chr($n); $b = ltrim(pack('N', $n), "\x00"); return chr(0x80 | strlen($b)) . $b; }

    /** True if the assertion signature checks out against the stored key. */
    public static function verifyAssertion(string $pem, int $alg, string $authData, string $clientDataJSON, string $signature): bool
    {
        $signed = $authData . hash('sha256', $clientDataJSON, true);
        $key = openssl_pkey_get_public($pem); if (!$key) return false;
        return openssl_verify($signed, $signature, $key, OPENSSL_ALGO_SHA256) === 1;
    }

    /** Challenges live briefly in app_keys, keyed by a random token the client hands back. */
    public static function newChallenge(string $purpose, ?int $userId): array
    {
        $token = bin2hex(random_bytes(16)); $challenge = random_bytes(32);
        Db::run('DELETE FROM app_keys WHERE k = ?', ['wa:' . $token]);
        Db::run('INSERT INTO app_keys (k, v) VALUES (?,?)', ['wa:' . $token, json_encode(['c' => self::b64u($challenge), 'p' => $purpose, 'u' => $userId, 't' => time()])]);
        return ['token' => $token, 'challenge' => self::b64u($challenge)];
    }
    public static function takeChallenge(string $token, string $purpose): ?array
    {
        $row = Db::one('SELECT v FROM app_keys WHERE k = ?', ['wa:' . $token]); if (!$row) return null;
        Db::run('DELETE FROM app_keys WHERE k = ?', ['wa:' . $token]);
        $j = json_decode((string) $row['v'], true);
        if (!$j || $j['p'] !== $purpose || $j['t'] < time() - 300) return null;
        return $j;
    }

    /** Checks the clientDataJSON the browser signed: right type, our challenge, our origin. */
    public static function clientDataOk(string $clientDataJSON, string $type, string $challengeB64u): bool
    {
        $c = json_decode($clientDataJSON, true); if (!$c) return false;
        if (($c['type'] ?? '') !== $type) return false;
        if (!hash_equals($challengeB64u, (string) ($c['challenge'] ?? ''))) return false;
        $origin = rtrim((string) Http::config('app_origin'), '/');
        return rtrim((string) ($c['origin'] ?? ''), '/') === $origin;
    }
}

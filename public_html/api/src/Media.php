<?php
declare(strict_types=1);

/**
 * Media storage. With R2 (or any S3-compatible bucket) configured, files are stored there under a key and
 * served via a short-lived signed URL. Without it, files stay in the database column as before.
 * Signing is AWS Signature V4, implemented here so shared hosting needs no SDK.
 */
final class Media
{
    public static function configured(): bool { return (string) Http::config('r2_bucket', '') !== '' && (string) Http::config('r2_access_key', '') !== ''; }

    /** Stores bytes; returns the object key, or null if R2 is not configured (caller keeps the bytes in the DB). */
    public static function put(string $folder, string $data, string $mime, string $ext): ?string
    {
        if (!self::configured()) return null;
        $key = $folder . '/' . date('Y/m') . '/' . bin2hex(random_bytes(12)) . '.' . $ext;
        $res = self::request('PUT', $key, $data, ['content-type' => $mime]);
        if ($res['code'] < 200 || $res['code'] >= 300) { error_log('[buja media] PUT ' . $res['code'] . ' ' . substr($res['body'], 0, 200)); return null; }
        return $key;
    }
    public static function delete(string $key): void { if (self::configured()) self::request('DELETE', $key); }

    /** Signed GET URL valid for a few minutes; the browser fetches straight from the bucket. */
    public static function url(string $key, int $ttl = 600): string { return self::presign('GET', $key, $ttl); }

    public static function get(string $key): ?string { $r = self::request('GET', $key); return $r['code'] === 200 ? $r['body'] : null; }

    /** One-click check used by the admin panel: write, read back, delete. */
    public static function selfTest(): array
    {
        if (!self::configured()) return ['ok' => false, 'message' => 'R2 is not configured (R2_BUCKET, R2_ACCOUNT_ID, R2_ACCESS_KEY, R2_SECRET_KEY).'];
        $k = self::put('selftest', 'buja ' . time(), 'text/plain', 'txt'); if (!$k) return ['ok' => false, 'message' => 'Write failed. Check the keys and bucket name.'];
        $back = self::get($k); self::delete($k);
        return $back !== null ? ['ok' => true, 'message' => 'Wrote, read and deleted a test object. Storage works.'] : ['ok' => false, 'message' => 'Wrote but could not read back.'];
    }

    // ---- SigV4 -------------------------------------------------------------
    private static function cfg(): array
    {
        $acct = (string) Http::config('r2_account_id', ''); $endpoint = (string) Http::config('r2_endpoint', '') ?: ('https://' . $acct . '.r2.cloudflarestorage.com');
        return ['bucket' => (string) Http::config('r2_bucket'), 'endpoint' => rtrim($endpoint, '/'), 'region' => (string) Http::config('r2_region', 'auto'), 'ak' => (string) Http::config('r2_access_key'), 'sk' => (string) Http::config('r2_secret_key')];
    }
    private static function host(array $c): string { return (string) parse_url($c['endpoint'], PHP_URL_HOST); }
    private static function enc(string $s): string { return str_replace('%2F', '/', rawurlencode($s)); }
    private static function sigKey(string $sk, string $date, string $region): string
    {
        $k = hash_hmac('sha256', $date, 'AWS4' . $sk, true); $k = hash_hmac('sha256', $region, $k, true); $k = hash_hmac('sha256', 's3', $k, true); return hash_hmac('sha256', 'aws4_request', $k, true);
    }

    private static function request(string $method, string $key, string $body = '', array $extra = []): array
    {
        $c = self::cfg(); $now = time(); $amz = gmdate('Ymd\THis\Z', $now); $date = gmdate('Ymd', $now);
        $path = '/' . $c['bucket'] . '/' . self::enc($key);
        $payloadHash = hash('sha256', $body);
        $headers = ['host' => self::host($c), 'x-amz-content-sha256' => $payloadHash, 'x-amz-date' => $amz] + $extra;
        ksort($headers);
        $canonHeaders = ''; foreach ($headers as $k => $v) $canonHeaders .= $k . ':' . trim($v) . "\n";
        $signed = implode(';', array_keys($headers));
        $canon = "$method\n$path\n\n$canonHeaders\n$signed\n$payloadHash";
        $scope = "$date/{$c['region']}/s3/aws4_request";
        $sts = "AWS4-HMAC-SHA256\n$amz\n$scope\n" . hash('sha256', $canon);
        $sig = hash_hmac('sha256', $sts, self::sigKey($c['sk'], $date, $c['region']));
        $auth = "AWS4-HMAC-SHA256 Credential={$c['ak']}/$scope, SignedHeaders=$signed, Signature=$sig";
        $hdrs = ['Authorization: ' . $auth]; foreach ($headers as $k => $v) if ($k !== 'host') $hdrs[] = $k . ': ' . $v;
        $ch = curl_init($c['endpoint'] . $path);
        curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30, CURLOPT_HTTPHEADER => $hdrs, CURLOPT_POSTFIELDS => $method === 'PUT' ? $body : null]);
        $out = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        return ['code' => $code, 'body' => (string) $out];
    }

    private static function presign(string $method, string $key, int $ttl): string
    {
        $c = self::cfg(); $now = time(); $amz = gmdate('Ymd\THis\Z', $now); $date = gmdate('Ymd', $now);
        $path = '/' . $c['bucket'] . '/' . self::enc($key); $scope = "$date/{$c['region']}/s3/aws4_request";
        $q = ['X-Amz-Algorithm' => 'AWS4-HMAC-SHA256', 'X-Amz-Credential' => $c['ak'] . '/' . $scope, 'X-Amz-Date' => $amz, 'X-Amz-Expires' => (string) $ttl, 'X-Amz-SignedHeaders' => 'host'];
        ksort($q); $qs = http_build_query($q, '', '&', PHP_QUERY_RFC3986);
        $canon = "$method\n$path\n$qs\nhost:" . self::host($c) . "\n\nhost\nUNSIGNED-PAYLOAD";
        $sts = "AWS4-HMAC-SHA256\n$amz\n$scope\n" . hash('sha256', $canon);
        $sig = hash_hmac('sha256', $sts, self::sigKey($c['sk'], $date, $c['region']));
        return $c['endpoint'] . $path . '?' . $qs . '&X-Amz-Signature=' . $sig;
    }
}

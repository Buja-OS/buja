<?php
declare(strict_types=1);

final class Http
{
    private static array $config = [];
    private static ?array $body = null;

    public static function init(array $config): void
    {
        self::$config = $config;
        $origin = $config['app_origin'] ?? '';
        $reqOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if ($origin !== '' && $reqOrigin === $origin) {
            header('Access-Control-Allow-Origin: ' . $origin);
            header('Access-Control-Allow-Credentials: true');
            header('Access-Control-Allow-Headers: Content-Type, X-Buja-Client');
            header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
        }
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') { http_response_code(204); exit; }
    }

    public static function config(string $key, mixed $default = null): mixed
    {
        return self::$config[$key] ?? $default;
    }

    public static function path(): string
    {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $uri = preg_replace('#^/api#', '', $uri) ?: '/';
        return '/' . trim($uri, '/');
    }

    public static function body(): array
    {
        if (self::$body !== null) return self::$body;
        $ct = $_SERVER['CONTENT_TYPE'] ?? '';
        if (str_starts_with($ct, 'multipart/form-data')) { self::$body = $_POST; return self::$body; }
        $raw = file_get_contents('php://input') ?: '';
        $data = json_decode($raw, true);
        self::$body = is_array($data) ? $data : [];
        return self::$body;
    }

    /** Uploaded file by field name, or null. */
    public static function file(string $field): ?array
    {
        $f = $_FILES[$field] ?? null;
        return ($f && ($f['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK) ? $f : null;
    }

    /** Every state-changing call must carry this header. Cross-site forms cannot set it, so it blocks CSRF. */
    public static function requireClientHeader(): void
    {
        if (($_SERVER['HTTP_X_BUJA_CLIENT'] ?? '') !== 'pwa') {
            self::json(['error' => 'bad_client', 'message' => 'Missing client header.'], 400);
        }
    }

    public static function ip(): string
    {
        if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) return $_SERVER['HTTP_CF_CONNECTING_IP'];
        if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) return trim(explode(',', $_SERVER['HTTP_X_FORWARDED_FOR'])[0]);
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }

    public static function json(mixed $data, int $status = 200): never
    {
        http_response_code($status);
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function setSessionCookie(string $jwt, int $days): void
    {
        setcookie('buja_session', $jwt, [
            'expires'  => time() + $days * 86400,
            'path'     => '/',
            'secure'   => !(bool) self::config('insecure_cookies', false),
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    public static function clearSessionCookie(): void
    {
        setcookie('buja_session', '', ['expires' => time() - 3600, 'path' => '/', 'secure' => !(bool) self::config('insecure_cookies', false), 'httponly' => true, 'samesite' => 'Lax']);
    }
}

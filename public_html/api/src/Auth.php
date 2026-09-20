<?php
declare(strict_types=1);

final class Auth
{
    /** Returns the signed-in user row or null. Checks the cookie, the JWT and that the session is not revoked. */
    public static function user(): ?array
    {
        $jwt = $_COOKIE['buja_session'] ?? '';
        if ($jwt === '') return null;
        $claims = Jwt::decode($jwt, (string) Http::config('jwt_secret'));
        if ($claims === null || !isset($claims['sub'], $claims['jti'])) return null;
        $session = Db::one('SELECT id FROM sessions WHERE jti = ? AND user_id = ? AND revoked_at IS NULL AND expires_at > ?', [$claims['jti'], (int) $claims['sub'], Db::now()]);
        if ($session === null) return null;
        return Db::one('SELECT id, kind, name, email, phone, district, avatar_url, google_sub, email_verified_at, created_at, is_admin, plus_until, selfie_verified_at, role, avatar_url, last_seen_at FROM users WHERE id = ? AND deleted_at IS NULL', [(int) $claims['sub']]);
    }

    public static function require(): array
    {
        $u = self::user();
        if ($u === null) Http::json(['error' => 'unauthenticated', 'message' => 'Please sign in.'], 401);
        return $u;
    }

    /** Creates a session row and sets the cookie. */
    public static function signIn(int $userId): void
    {
        $days = (int) Http::config('session_days', 30);
        $jti = bin2hex(random_bytes(16));
        $exp = time() + $days * 86400;
        Db::run('INSERT INTO sessions (user_id, jti, ip, user_agent, expires_at, created_at) VALUES (?,?,?,?,?,?)',
            [$userId, $jti, Http::ip(), substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255), gmdate('Y-m-d H:i:s', $exp), Db::now()]);
        $jwt = Jwt::encode(['sub' => $userId, 'jti' => $jti, 'iat' => time(), 'exp' => $exp], (string) Http::config('jwt_secret'));
        Http::setSessionCookie($jwt, $days);
    }

    public static function signOut(): void
    {
        $jwt = $_COOKIE['buja_session'] ?? '';
        $claims = $jwt !== '' ? Jwt::decode($jwt, (string) Http::config('jwt_secret')) : null;
        if ($claims !== null && isset($claims['jti'])) {
            Db::run('UPDATE sessions SET revoked_at = ? WHERE jti = ?', [Db::now(), $claims['jti']]);
        }
        Http::clearSessionCookie();
    }

    public static function publicUser(array $u): array
    {
        return [
            'id'       => (int) $u['id'],
            'kind'     => $u['kind'],
            'name'     => $u['name'],
            'email'    => $u['email'],
            'phone'    => $u['phone'],
            'district' => $u['district'],
            'avatar'   => $u['avatar_url'],
            'verified' => $u['email_verified_at'] !== null,
            'google'   => $u['google_sub'] !== null,
            'admin'    => !empty($u['is_admin']) || ($u['role'] ?? '') === 'admin',
            'role'     => $u['role'] ?? (!empty($u['is_admin']) ? 'admin' : 'user'),
            'plus'     => !empty($u['plus_until']) && $u['plus_until'] > Db::now(),
            'plusUntil'=> $u['plus_until'] ?? null,
            'selfieVerified' => !empty($u['selfie_verified_at']),
        ];
    }
}

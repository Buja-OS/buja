<?php
declare(strict_types=1);

/** Email verification, password reset, notification preferences, upcoming events. */
final class AccountController
{
    public static function sendVerification(array $u): void
    {
        if ($u['email_verified_at'] !== null) return;
        $token = Mail::token((int) $u['id'], 'verify', 60 * 24);
        $link = (string) Http::config('app_origin') . '/api/auth/verify?token=' . $token;
        Mail::send($u['email'], $u['name'], 'Confirm your email for Buja', '<p>Hi ' . htmlspecialchars($u['name']) . ', tap the button to confirm this email address.</p><p><a href="' . htmlspecialchars($link) . '" style="display:inline-block;background:#FF7A1A;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:700">Confirm email</a></p><p style="color:#6F6F78;font-size:12px">The link works for 24 hours.</p>');
    }

    /** POST /auth/resend-verification */
    public function resend(): void
    {
        $u = Auth::require(); RateLimit::hit('verify', 5, 3600);
        $row = Db::one('SELECT * FROM users WHERE id = ?', [$u['id']]);
        self::sendVerification($row);
        Http::json(['ok' => true, 'configured' => Http::config('brevo_api_key', '') !== '']);
    }

    /** GET /auth/verify?token= : link from the email, redirects into the app */
    public function verify(): void
    {
        $uid = Mail::consume((string) ($_GET['token'] ?? ''), 'verify');
        $origin = (string) Http::config('app_origin');
        if ($uid === null) { header('Location: ' . $origin . '/#/me?verified=0'); exit; }
        Db::run('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?', [Db::now(), Db::now(), $uid]);
        header('Location: ' . $origin . '/#/me?verified=1'); exit;
    }

    /** POST /auth/forgot { email } : always 200 so accounts cannot be enumerated */
    public function forgot(): void
    {
        RateLimit::hit('forgot', 5, 900);
        $email = Validator::email((string) (Http::body()['email'] ?? ''));
        if ($email) {
            $u = Db::one('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL', [$email]);
            if ($u) {
                $token = Mail::token((int) $u['id'], 'reset', 30);
                $link = (string) Http::config('app_origin') . '/#/reset?token=' . $token;
                Mail::send($u['email'], $u['name'], 'Reset your Buja password', '<p>Hi ' . htmlspecialchars($u['name']) . ', tap the button to choose a new password.</p><p><a href="' . htmlspecialchars($link) . '" style="display:inline-block;background:#1B1B1F;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:700">Reset password</a></p><p style="color:#6F6F78;font-size:12px">The link works for 30 minutes. If you did not ask for this, ignore it.</p>');
            }
        }
        Http::json(['ok' => true, 'configured' => Http::config('brevo_api_key', '') !== '']);
    }

    /** POST /auth/reset { token, password } */
    public function reset(): void
    {
        RateLimit::hit('reset', 10, 900);
        $b = Http::body(); $pass = Validator::password((string) ($b['password'] ?? ''));
        if ($pass === null) Http::json(['error' => 'validation', 'fields' => ['password' => 'Password must be at least 8 characters.']], 422);
        $uid = Mail::consume((string) ($b['token'] ?? ''), 'reset');
        if ($uid === null) Http::json(['error' => 'invalid_token', 'message' => 'This reset link has expired. Request a new one.'], 400);
        Db::run('UPDATE users SET password_hash = ?, email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?', [password_hash($pass, PASSWORD_DEFAULT), Db::now(), Db::now(), $uid]);
        Db::run('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [Db::now(), $uid]);
        Auth::signIn($uid);
        Http::json(['user' => Auth::publicUser(Db::one('SELECT * FROM users WHERE id = ?', [$uid])), 'next' => 'home']);
    }

    /** PATCH /me/notifications { work, match, waka, offers } */
    public function notifications(): void
    {
        $u = Auth::require(); $b = Http::body(); $sets = []; $p = [];
        foreach (['work', 'match', 'waka', 'offers'] as $k) if (array_key_exists($k, $b)) { $sets[] = "notify_$k = ?"; $p[] = !empty($b[$k]) ? 1 : 0; }
        if (!$sets) Http::json(['error' => 'validation', 'message' => 'Nothing to update.'], 422);
        $p[] = $u['id'];
        Db::run('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?', $p);
        $row = Db::one('SELECT notify_work, notify_match, notify_waka, notify_offers FROM users WHERE id = ?', [$u['id']]);
        Http::json(['notifications' => ['work' => (bool) $row['notify_work'], 'match' => (bool) $row['notify_match'], 'waka' => (bool) $row['notify_waka'], 'offers' => (bool) $row['notify_offers']]]);
    }

    /** GET /me/today : confirmed interviews coming up, unread messages */
    public function today(): void
    {
        $u = Auth::require();
        $st = Db::pdo()->prepare("SELECT m.id, m.meta, t.id AS thread_id, t.application_id FROM messages m JOIN threads t ON t.id = m.thread_id WHERE m.type = 'interview' AND (t.user_a = ? OR t.user_b = ?) ORDER BY m.id DESC LIMIT 20");
        $st->execute([$u['id'], $u['id']]);
        $items = [];
        foreach ($st->fetchAll() as $m) {
            $meta = json_decode($m['meta'], true);
            if (($meta['status'] ?? '') !== 'confirmed' || strtotime($meta['at']) < time() - 3600) continue;
            $a = Db::one('SELECT j.title, c.name, us.name AS applicant FROM applications a JOIN jobs j ON j.id = a.job_id JOIN companies c ON c.id = j.company_id JOIN users us ON us.id = a.user_id WHERE a.id = ?', [$m['application_id']]);
            $items[] = ['kind' => 'interview', 'title' => $u['kind'] === 'company' ? 'Interview: ' . $a['applicant'] : 'Interview with ' . $a['name'], 'sub' => date('D j M · H:i', strtotime($meta['at'])) . ' · ' . $meta['place'], 'url' => '/inbox/' . $m['thread_id'], 'at' => $meta['at']];
        }
        usort($items, fn($x, $y) => strcmp($x['at'], $y['at']));
        $unread = (int) (Db::one('SELECT COUNT(*) AS n FROM messages m JOIN threads t ON t.id = m.thread_id WHERE (t.user_a = ? OR t.user_b = ?) AND m.sender_id <> ? AND m.id > COALESCE((SELECT last_read_id FROM thread_reads r WHERE r.thread_id = t.id AND r.user_id = ?), 0)', [$u['id'], $u['id'], $u['id'], $u['id']])['n'] ?? 0);
        $n = Db::one('SELECT notify_work, notify_match, notify_waka, notify_offers FROM users WHERE id = ?', [$u['id']]);
        Http::json(['items' => array_slice($items, 0, 5), 'unread' => $unread, 'notifications' => ['work' => (bool) $n['notify_work'], 'match' => (bool) $n['notify_match'], 'waka' => (bool) $n['notify_waka'], 'offers' => (bool) $n['notify_offers']], 'pushEnabled' => Db::one('SELECT 1 AS x FROM push_subscriptions WHERE user_id = ?', [$u['id']]) !== null]);
    }
}

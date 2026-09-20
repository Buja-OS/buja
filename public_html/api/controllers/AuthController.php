<?php
declare(strict_types=1);

final class AuthController
{
    public function register(): void
    {
        RateLimit::hit('register', 10, 900);
        $b = Http::body();
        $name  = Validator::name((string) ($b['name'] ?? ''));
        $email = Validator::email((string) ($b['email'] ?? ''));
        $phone = Validator::ngPhone((string) ($b['phone'] ?? ''));
        $pass  = Validator::password((string) ($b['password'] ?? ''));
        $errors = [];
        if ($name === null)  $errors['name']     = 'Enter your full name.';
        if ($email === null) $errors['email']    = 'Enter a valid email address.';
        if ($phone === null) $errors['phone']    = 'Enter a valid Nigerian phone number.';
        if ($pass === null)  $errors['password'] = 'Password must be at least 8 characters.';
        if (empty($b['agree'])) $errors['agree']  = 'You need to agree to the terms.';
        if ($errors) Http::json(['error' => 'validation', 'fields' => $errors], 422);

        if (Db::one('SELECT id FROM users WHERE email = ?', [$email])) {
            Http::json(['error' => 'validation', 'fields' => ['email' => 'An account with this email already exists. Sign in instead.']], 422);
        }
        if (Db::one('SELECT id FROM users WHERE phone = ?', [$phone])) {
            Http::json(['error' => 'validation', 'fields' => ['phone' => 'This phone number is already in use.']], 422);
        }

        Db::run('INSERT INTO users (kind, name, email, phone, password_hash, created_at, updated_at) VALUES (?,?,?,?,?,?,?)',
            ['resident', $name, $email, $phone, password_hash($pass, PASSWORD_DEFAULT), Db::now(), Db::now()]);
        $id = Db::lastId();
        if (!empty($b['invite'])) { $inv = Db::one('SELECT * FROM invites WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?', [hash('sha256', (string) $b['invite']), Db::now()]); if ($inv && strtolower($inv['email']) === $email) { Db::run('UPDATE users SET role = ?, is_admin = ?, email_verified_at = ? WHERE id = ?', [$inv['role'], $inv['role'] === 'admin' ? 1 : 0, Db::now(), $id]); Db::run('UPDATE invites SET used_at = ? WHERE id = ?', [Db::now(), $inv['id']]); } }
        if (!empty($b['ref'])) { $ref = Db::one('SELECT id FROM users WHERE invite_code = ? AND deleted_at IS NULL', [strtoupper((string) $b['ref'])]); if ($ref && (int) $ref['id'] !== (int) $id) { Db::run('UPDATE users SET referred_by = ? WHERE id = ?', [$ref['id'], $id]); Notify::user((int) $ref['id'], 'offers', $name . ' joined Buja on your invite', 'That is one more person in the city using it.', '/#/invite'); } }
        Track::hit(['id' => $id], 'account', 'register');
        Auth::signIn($id);
        $u = Db::one('SELECT * FROM users WHERE id = ?', [$id]);
        try { AccountController::sendVerification($u); } catch (Throwable $e) { error_log('[buja] verification email failed: ' . $e->getMessage()); }
        Http::json(['user' => Auth::publicUser($u), 'next' => 'onboarding'], 201);
    }

    public function login(): void
    {
        RateLimit::hit('login', 20, 900);
        $b = Http::body();
        $id = trim((string) ($b['identifier'] ?? ''));
        $pass = (string) ($b['password'] ?? '');
        $email = Validator::email($id);
        $phone = Validator::ngPhone($id);
        $u = null;
        if ($email !== null)      $u = Db::one('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL', [$email]);
        elseif ($phone !== null)  $u = Db::one('SELECT * FROM users WHERE phone = ? AND deleted_at IS NULL', [$phone]);

        // Same message for unknown user and wrong password, so accounts cannot be enumerated.
        if ($u === null || $u['password_hash'] === null || !password_verify($pass, $u['password_hash'])) {
            Http::json(['error' => 'invalid_credentials', 'message' => 'That email or phone and password do not match.'], 401);
        }
        if (password_needs_rehash($u['password_hash'], PASSWORD_DEFAULT)) {
            Db::run('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($pass, PASSWORD_DEFAULT), $u['id']]);
        }
        Auth::signIn((int) $u['id']); Track::hit($u, 'account', 'login');
        Http::json(['user' => Auth::publicUser($u), 'next' => $u['district'] === null ? 'onboarding' : 'home']);
    }

    public function google(): void
    {
        RateLimit::hit('google', 20, 900);
        $b = Http::body();
        $g = Google::verify((string) ($b['credential'] ?? ''));
        if ($g === null) Http::json(['error' => 'google_failed', 'message' => 'Google sign-in could not be verified. Please try again.'], 401);

        $u = Db::one('SELECT * FROM users WHERE google_sub = ? AND deleted_at IS NULL', [$g['sub']]);
        $created = false;
        if ($u === null) {
            $u = Db::one('SELECT * FROM users WHERE email = ? AND deleted_at IS NULL', [$g['email']]);
            if ($u !== null) {
                // Same verified email: link Google to the existing account.
                Db::run('UPDATE users SET google_sub = ?, avatar_url = COALESCE(avatar_url, ?), email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?',
                    [$g['sub'], $g['picture'] ?: null, Db::now(), Db::now(), $u['id']]);
            } else {
                Db::run('INSERT INTO users (kind, name, email, google_sub, avatar_url, email_verified_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)',
                    ['resident', $g['name'] !== '' ? $g['name'] : 'Buja user', $g['email'], $g['sub'], $g['picture'] ?: null, Db::now(), Db::now(), Db::now()]);
                $created = true;
            }
            $u = Db::one('SELECT * FROM users WHERE email = ?', [$g['email']]);
        }
        Auth::signIn((int) $u['id']);
        Http::json(['user' => Auth::publicUser($u), 'next' => ($created || $u['district'] === null) ? 'onboarding' : 'home'], $created ? 201 : 200);
    }

    public function logout(): void
    {
        Auth::signOut();
        Http::json(['ok' => true]);
    }
}

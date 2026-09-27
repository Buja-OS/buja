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
            Http::json(['error' => 'invalid_credentials', 'message' => 'That email or phone and password do not match.' . ($phone !== null && Sms::configured() ? ' If you joined with your phone number, sign in with a code by text instead.' : '')], 401);
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

    /* ---------------- Phone number sign-in: a 6-digit code by SMS, no password ---------------- */
    private const OTP_MIN = 10;          // a code lasts this long
    private const OTP_TRIES = 5;         // wrong guesses before the code is burnt

    private static function otpHash(string $phone, string $code): string { return hash('sha256', $phone . '|' . $code . '|' . (string) Http::config('jwt_secret')); }

    /** POST /auth/otp/request { phone } : texts a code. The same answer whether or not the number has an account. */
    public function otpRequest(): void
    {
        if (!Sms::configured()) Http::json(['error' => 'unavailable', 'message' => 'Sign-in by phone is not switched on yet. Use email or Google for now.'], 409);
        RateLimit::hit('otp', 8, 3600);
        $phone = Validator::ngPhone((string) (Http::body()['phone'] ?? ''));
        if ($phone === null) Http::json(['error' => 'validation', 'fields' => ['phone' => 'Enter a Nigerian phone number, like 0803 000 0000.']], 422);
        // per number too, so nobody can flood one person's phone from many addresses
        $recent = (int) (Db::one('SELECT COUNT(*) AS n FROM phone_otps WHERE phone = ? AND created_at > ?', [$phone, gmdate('Y-m-d H:i:s', time() - 3600)])['n'] ?? 0);
        if ($recent >= 5) Http::json(['error' => 'rate_limited', 'message' => 'Too many codes for this number. Wait an hour, or sign in another way.'], 429);
        $last = Db::one('SELECT created_at FROM phone_otps WHERE phone = ? ORDER BY id DESC LIMIT 1', [$phone]);
        if ($last && strtotime($last['created_at'] . ' UTC') > time() - 45) Http::json(['error' => 'rate_limited', 'message' => 'A code is on its way. You can ask for another in a minute.'], 429);
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        Db::run('UPDATE phone_otps SET used_at = ? WHERE phone = ? AND used_at IS NULL', [Db::now(), $phone]);   // only the newest code works
        Db::run('INSERT INTO phone_otps (phone, code_hash, attempts, ip, created_at, expires_at) VALUES (?,?,?,?,?,?)', [$phone, self::otpHash($phone, $code), 0, Http::ip(), Db::now(), gmdate('Y-m-d H:i:s', time() + self::OTP_MIN * 60)]);
        $sent = Sms::send($phone, 'Your Buja code is ' . $code . '. It expires in ' . self::OTP_MIN . ' minutes. Never share it; Buja will never call to ask for it.');
        if (!$sent) Http::json(['error' => 'unavailable', 'message' => 'We could not send the text just now. Try again, or sign in with email.'], 503);
        $out = ['sent' => true, 'phone' => $phone, 'expiresIn' => self::OTP_MIN * 60];
        if (Sms::mock()) $out['devCode'] = $code;   // test mode only: the code comes back so the flow can be tried without SMS credit
        Http::json($out);
    }

    /**
     * POST /auth/otp/verify { phone, code, name?, agree? } : signs in, or creates the account when the number is new.
     * A new number without a name gets { needName: true } and the code stays valid for the second tap.
     */
    public function otpVerify(): void
    {
        RateLimit::hit('otpverify', 30, 900);
        $b = Http::body();
        $phone = Validator::ngPhone((string) ($b['phone'] ?? '')); $code = preg_replace('/\D/', '', (string) ($b['code'] ?? '')) ?? '';
        if ($phone === null || strlen($code) !== 6) Http::json(['error' => 'validation', 'fields' => ['code' => 'Enter the 6-digit code from the text.']], 422);
        $o = Db::one('SELECT * FROM phone_otps WHERE phone = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1', [$phone]);
        if (!$o || $o['expires_at'] < Db::now()) Http::json(['error' => 'expired', 'fields' => ['code' => 'That code has expired. Ask for a new one.']], 422);
        if ((int) $o['attempts'] >= self::OTP_TRIES) Http::json(['error' => 'expired', 'fields' => ['code' => 'Too many wrong tries. Ask for a new code.']], 422);
        if (!hash_equals($o['code_hash'], self::otpHash($phone, $code))) {
            Db::run('UPDATE phone_otps SET attempts = attempts + 1 WHERE id = ?', [$o['id']]);
            $left = self::OTP_TRIES - (int) $o['attempts'] - 1;
            Http::json(['error' => 'validation', 'fields' => ['code' => $left > 0 ? 'That code is not right. ' . $left . ' tr' . ($left === 1 ? 'y' : 'ies') . ' left.' : 'Too many wrong tries. Ask for a new code.']], 422);
        }
        $u = Db::one('SELECT * FROM users WHERE phone = ? AND deleted_at IS NULL', [$phone]);
        $created = false;
        if ($u === null) {
            $name = Validator::name((string) ($b['name'] ?? ''));
            if ($name === null) Http::json(['needName' => true, 'phone' => $phone]);   // the code is still good
            if (empty($b['agree'])) Http::json(['error' => 'validation', 'fields' => ['agree' => 'You need to agree to the terms.']], 422);
            if (Db::one('SELECT id FROM users WHERE phone = ?', [$phone])) Http::json(['error' => 'validation', 'fields' => ['phone' => 'This number belonged to a deleted account. Contact Buja support.']], 422);
            $mail = 'p' . ltrim($phone, '+') . '@' . Auth::PHONE_MAIL_DOMAIN;
            Db::run('INSERT INTO users (kind, name, email, phone, created_at, updated_at) VALUES (?,?,?,?,?,?)', ['resident', $name, $mail, $phone, Db::now(), Db::now()]);
            $id = (int) Db::lastId(); $created = true;
            if (!empty($b['ref'])) { $ref = Db::one('SELECT id FROM users WHERE invite_code = ? AND deleted_at IS NULL', [strtoupper((string) $b['ref'])]); if ($ref && (int) $ref['id'] !== $id) { Db::run('UPDATE users SET referred_by = ? WHERE id = ?', [$ref['id'], $id]); Notify::user((int) $ref['id'], 'offers', $name . ' joined Buja on your invite', 'That is one more person in the city using it.', '/#/invite'); } }
            Track::hit(['id' => $id], 'account', 'register_phone');
            $u = Db::one('SELECT * FROM users WHERE id = ?', [$id]);
        } else Track::hit($u, 'account', 'login_phone');
        Db::run('UPDATE phone_otps SET used_at = ? WHERE id = ?', [Db::now(), $o['id']]);
        Db::run('UPDATE users SET phone_verified_at = COALESCE(phone_verified_at, ?) WHERE id = ?', [Db::now(), $u['id']]);
        Auth::signIn((int) $u['id']);
        Http::json(['user' => Auth::publicUser($u), 'next' => ($created || $u['district'] === null) ? 'onboarding' : 'home'], $created ? 201 : 200);
    }

    public function logout(): void
    {
        Auth::signOut();
        Http::json(['ok' => true]);
    }
}

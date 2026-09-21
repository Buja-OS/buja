<?php
declare(strict_types=1);

/** Fingerprint and face sign-in. Register after sign-up or from Settings; sign in with a tap. */
final class PasskeyController
{
    /** GET /auth/passkeys : mine */
    public function index(): void
    {
        $u = Auth::require();
        $st = Db::pdo()->prepare('SELECT id, label, created_at, last_used_at FROM passkeys WHERE user_id = ? ORDER BY id'); $st->execute([$u['id']]);
        Http::json(['passkeys' => array_map(fn($p) => ['id' => (int) $p['id'], 'label' => $p['label'] ?: 'This phone', 'at' => $p['created_at'], 'lastUsed' => $p['last_used_at']], $st->fetchAll())]);
    }

    /** POST /auth/passkey/register/options : what the browser needs to create one */
    public function registerOptions(): void
    {
        $u = Auth::require();
        $ch = WebAuthn::newChallenge('register', (int) $u['id']);
        $st = Db::pdo()->prepare('SELECT credential_id FROM passkeys WHERE user_id = ?'); $st->execute([$u['id']]);
        Http::json(['token' => $ch['token'], 'options' => [
            'challenge' => $ch['challenge'],
            'rp' => ['name' => 'Buja', 'id' => WebAuthn::rpId()],
            'user' => ['id' => WebAuthn::b64u('buja-user-' . (int) $u['id']), 'name' => (string) $u['email'], 'displayName' => (string) $u['name']],
            'pubKeyCredParams' => [['type' => 'public-key', 'alg' => -7], ['type' => 'public-key', 'alg' => -257]],
            'authenticatorSelection' => ['authenticatorAttachment' => 'platform', 'residentKey' => 'preferred', 'userVerification' => 'required'],
            'excludeCredentials' => array_map(fn($r) => ['type' => 'public-key', 'id' => $r['credential_id']], $st->fetchAll()),
            'timeout' => 60000, 'attestation' => 'none',
        ]]);
    }

    /** POST /auth/passkey/register { token, id, rawId, response: { clientDataJSON, attestationObject }, label } */
    public function register(): void
    {
        $u = Auth::require(); RateLimit::hit('passkey', 20, 3600);
        $b = Http::body();
        $ch = WebAuthn::takeChallenge((string) ($b['token'] ?? ''), 'register');
        if (!$ch || (int) $ch['u'] !== (int) $u['id']) Http::json(['error' => 'challenge', 'message' => 'That took too long. Try again.'], 422);
        $cd = WebAuthn::unb64u((string) ($b['response']['clientDataJSON'] ?? ''));
        if (!WebAuthn::clientDataOk($cd, 'webauthn.create', $ch['c'])) Http::json(['error' => 'client', 'message' => 'The phone returned something Buja did not ask for.'], 422);
        $att = WebAuthn::parseAttestation(WebAuthn::unb64u((string) ($b['response']['attestationObject'] ?? '')));
        if (!$att) Http::json(['error' => 'attestation', 'message' => 'This phone did not give a usable key.'], 422);
        if (!hash_equals(hash('sha256', WebAuthn::rpId(), true), $att['rpIdHash'])) Http::json(['error' => 'rp', 'message' => 'Wrong site.'], 422);
        if (!($att['flags'] & 0x04)) Http::json(['error' => 'uv', 'message' => 'The phone did not check your fingerprint or face.'], 422);
        $credId = WebAuthn::b64u($att['credentialId']);
        if ((int) (Db::one('SELECT COUNT(*) AS n FROM passkeys WHERE user_id = ?', [$u['id']])['n'] ?? 0) >= 5) Http::json(['error' => 'limit', 'message' => 'Up to five devices.'], 422);
        Db::run('INSERT INTO passkeys (user_id, credential_id, public_key, alg, sign_count, label, created_at) VALUES (?,?,?,?,?,?,?)',
            [$u['id'], $credId, $att['pem'], $att['alg'], $att['signCount'], mb_substr(trim((string) ($b['label'] ?? '')), 0, 60) ?: null, Db::now()]);
        Track::hit($u, 'account', 'passkey');
        $this->index();
    }

    /** POST /auth/passkey/login/options { identifier? } : signed out. With an email, offers that person's keys; without, lets the phone pick. */
    public function loginOptions(): void
    {
        RateLimit::hit('passkeyopt', 60, 900);
        $ident = trim((string) (Http::body()['identifier'] ?? ''));
        $allow = [];
        if ($ident !== '') {
            $u = Db::one('SELECT id FROM users WHERE (email = ? OR phone = ?) AND deleted_at IS NULL', [$ident, Validator::ngPhone($ident) ?: $ident]);
            if ($u) { $st = Db::pdo()->prepare('SELECT credential_id FROM passkeys WHERE user_id = ?'); $st->execute([$u['id']]); $allow = array_map(fn($r) => ['type' => 'public-key', 'id' => $r['credential_id']], $st->fetchAll()); }
        }
        $ch = WebAuthn::newChallenge('login', null);
        Http::json(['token' => $ch['token'], 'options' => ['challenge' => $ch['challenge'], 'rpId' => WebAuthn::rpId(), 'allowCredentials' => $allow, 'userVerification' => 'required', 'timeout' => 60000]]);
    }

    /** POST /auth/passkey/login { token, id, response: { clientDataJSON, authenticatorData, signature } } */
    public function login(): void
    {
        RateLimit::hit('passkeylogin', 30, 900);
        $b = Http::body();
        $ch = WebAuthn::takeChallenge((string) ($b['token'] ?? ''), 'login');
        if (!$ch) Http::json(['error' => 'challenge', 'message' => 'That took too long. Try again.'], 422);
        $credId = (string) ($b['id'] ?? '');
        $pk = Db::one('SELECT p.*, u.deleted_at FROM passkeys p JOIN users u ON u.id = p.user_id WHERE p.credential_id = ?', [$credId]);
        if (!$pk) Http::json(['error' => 'unknown', 'message' => 'This phone is not set up for Buja. Sign in with your password once, then turn on fingerprint in Settings.'], 401);
        if ($pk['deleted_at']) Http::json(['error' => 'account', 'message' => 'That account cannot sign in.'], 403);
        $cd = WebAuthn::unb64u((string) ($b['response']['clientDataJSON'] ?? ''));
        if (!WebAuthn::clientDataOk($cd, 'webauthn.get', $ch['c'])) Http::json(['error' => 'client', 'message' => 'The phone returned something Buja did not ask for.'], 422);
        $auth = WebAuthn::unb64u((string) ($b['response']['authenticatorData'] ?? ''));
        if (strlen($auth) < 37 || !hash_equals(hash('sha256', WebAuthn::rpId(), true), substr($auth, 0, 32))) Http::json(['error' => 'rp'], 422);
        if (!(ord($auth[32]) & 0x01)) Http::json(['error' => 'presence', 'message' => 'No touch registered.'], 422);
        $sig = WebAuthn::unb64u((string) ($b['response']['signature'] ?? ''));
        if (!WebAuthn::verifyAssertion((string) $pk['public_key'], (int) $pk['alg'], $auth, $cd, $sig)) Http::json(['error' => 'signature', 'message' => 'Fingerprint did not verify. Use your password.'], 401);
        $count = unpack('N', substr($auth, 33, 4))[1];
        Db::run('UPDATE passkeys SET sign_count = ?, last_used_at = ? WHERE id = ?', [max($count, (int) $pk['sign_count']), Db::now(), $pk['id']]);
        Auth::signIn((int) $pk['user_id']);
        Db::run('UPDATE users SET last_seen_at = ? WHERE id = ?', [Db::now(), $pk['user_id']]);
        Track::hit(['id' => (int) $pk['user_id']], 'account', 'login:passkey');
        Http::json(['user' => Auth::publicUser(Db::one('SELECT * FROM users WHERE id = ?', [$pk['user_id']]))]);
    }

    /** DELETE /auth/passkeys/{id} */
    public function remove(int $id): void
    {
        $u = Auth::require();
        Db::run('DELETE FROM passkeys WHERE id = ? AND user_id = ?', [$id, $u['id']]);
        $this->index();
    }
}

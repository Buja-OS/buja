<?php
declare(strict_types=1);

final class AdminController
{
    /** Admins can do everything; moderators can work the queues. */
    private function admin(bool $moderatorOk = false): array
    {
        $u = Auth::require();
        $role = $u['role'] ?? (!empty($u['is_admin']) ? 'admin' : 'user');
        if ($role === 'admin' || ($moderatorOk && $role === 'moderator')) return $u;
        Http::json(['error' => 'forbidden', 'message' => $moderatorOk ? 'Admins and moderators only.' : 'Admins only.'], 403);
    }

    /** GET /admin/users?q=&kind=&page= */
    public function users(): void
    {
        $this->admin(); $q = trim((string) ($_GET['q'] ?? '')); $kind = (string) ($_GET['kind'] ?? ''); $page = max(1, (int) ($_GET['page'] ?? 1)); $per = 30;
        $where = ['1=1']; $p = [];
        if ($q !== '') { $where[] = '(name LIKE ? OR email LIKE ? OR phone LIKE ?)'; array_push($p, "%$q%", "%$q%", "%$q%"); }
        if (in_array($kind, ['resident', 'company', 'landlord'], true)) { $where[] = 'kind = ?'; $p[] = $kind; }
        if ($kind === 'suspended') $where[] = 'deleted_at IS NOT NULL';
        if ($kind === 'staff') $where[] = "(role IN ('admin','moderator') OR is_admin = 1)";
        $sql = 'SELECT id, name, email, phone, kind, district, role, is_admin, plus_until, selfie_verified_at, email_verified_at, created_at, last_seen_at, deleted_at FROM users WHERE ' . implode(' AND ', $where) . ' ORDER BY id DESC LIMIT ' . $per . ' OFFSET ' . (($page - 1) * $per);
        $st = Db::pdo()->prepare($sql); $st->execute($p);
        $total = (int) (Db::one('SELECT COUNT(*) AS n FROM users WHERE ' . implode(' AND ', $where), $p)['n'] ?? 0);
        Http::json(['users' => array_map(fn($r) => ['id' => (int) $r['id'], 'name' => $r['name'], 'email' => $r['email'], 'phone' => $r['phone'], 'kind' => $r['kind'], 'district' => $r['district'], 'role' => $r['role'] ?: (!empty($r['is_admin']) ? 'admin' : 'user'), 'plus' => !empty($r['plus_until']) && $r['plus_until'] > Db::now(), 'selfieVerified' => !empty($r['selfie_verified_at']), 'emailVerified' => !empty($r['email_verified_at']), 'createdAt' => $r['created_at'], 'lastSeenAt' => $r['last_seen_at'], 'suspended' => $r['deleted_at'] !== null, 'avatar' => Db::one('SELECT 1 AS x FROM avatars WHERE user_id = ?', [$r['id']]) ? '/api/avatar/' . (int) $r['id'] : null], $st->fetchAll()), 'total' => $total, 'page' => $page]);
    }

    /** GET /admin/users/{id} : everything about one user */
    public function user(int $id): void
    {
        $this->admin(); $u = Db::one('SELECT * FROM users WHERE id = ?', [$id]); if (!$u) Http::json(['error' => 'not_found'], 404);
        $n = fn(string $sql) => (int) (Db::one($sql, [$id])['n'] ?? 0);
        Http::json(['user' => ['id' => (int) $u['id'], 'name' => $u['name'], 'email' => $u['email'], 'phone' => $u['phone'], 'kind' => $u['kind'], 'district' => $u['district'], 'role' => $u['role'] ?: (!empty($u['is_admin']) ? 'admin' : 'user'), 'createdAt' => $u['created_at'], 'lastSeenAt' => $u['last_seen_at'], 'suspended' => $u['deleted_at'] !== null, 'plusUntil' => $u['plus_until'], 'selfieVerified' => !empty($u['selfie_verified_at']), 'emailVerified' => !empty($u['email_verified_at']), 'google' => $u['google_sub'] !== null, 'avatar' => Db::one('SELECT 1 AS x FROM avatars WHERE user_id = ?', [$id]) ? '/api/avatar/' . $id : null],
            'activity' => ['applications' => $n('SELECT COUNT(*) AS n FROM applications WHERE user_id = ?'), 'jobsPosted' => $n('SELECT COUNT(*) AS n FROM jobs j JOIN companies c ON c.id = j.company_id WHERE c.owner_id = ?'), 'swipes' => $n('SELECT COUNT(*) AS n FROM swipes WHERE from_user = ?'), 'matches' => $n('SELECT COUNT(*) AS n FROM matches WHERE user_a = ?') + $n('SELECT COUNT(*) AS n FROM matches WHERE user_b = ?'), 'properties' => $n('SELECT COUNT(*) AS n FROM properties WHERE owner_id = ?'), 'listings' => $n('SELECT COUNT(*) AS n FROM listings WHERE seller_id = ?'), 'fareReports' => $n('SELECT COUNT(*) AS n FROM fare_reports WHERE user_id = ?'), 'asks' => $n('SELECT COUNT(*) AS n FROM ask_log WHERE user_id = ?'), 'reportsAgainst' => $n('SELECT COUNT(*) AS n FROM reports WHERE reported = ?'), 'payments' => $n("SELECT COUNT(*) AS n FROM payments WHERE user_id = ? AND status = 'paid'")],
            'sessions' => (int) (Db::one('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?', [$id, Db::now()])['n'] ?? 0)]);
    }

    /** POST /admin/users/{id} { action: suspend|restore|delete|signout, role: user|moderator|admin } */
    public function userAction(int $id): void
    {
        $me = $this->admin(); if ($id === (int) $me['id']) Http::json(['error' => 'validation', 'message' => 'You cannot change your own account here.'], 422);
        $u = Db::one('SELECT * FROM users WHERE id = ?', [$id]); if (!$u) Http::json(['error' => 'not_found'], 404);
        $b = Http::body(); $act = (string) ($b['action'] ?? '');
        if (isset($b['role'])) { if (!in_array($b['role'], ['user', 'moderator', 'admin'], true)) Http::json(['error' => 'validation'], 422); Db::run('UPDATE users SET role = ?, is_admin = ? WHERE id = ?', [$b['role'], $b['role'] === 'admin' ? 1 : 0, $id]); Track::hit($me, 'admin', 'role:' . $b['role']); }
        if ($act === 'suspend') { Db::run('UPDATE users SET deleted_at = ? WHERE id = ?', [Db::now(), $id]); Db::run('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [Db::now(), $id]); Db::run('UPDATE match_profiles SET visible = 0 WHERE user_id = ?', [$id]); Db::run("UPDATE listings SET status = 'hidden' WHERE seller_id = ?", [$id]); Db::run("UPDATE properties SET status = 'hidden' WHERE owner_id = ?", [$id]); }
        if ($act === 'restore') Db::run('UPDATE users SET deleted_at = NULL WHERE id = ?', [$id]);
        if ($act === 'signout') Db::run('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [Db::now(), $id]);
        if ($act === 'delete') { Db::run('DELETE FROM users WHERE id = ?', [$id]); Track::hit($me, 'admin', 'delete_user'); Http::json(['ok' => true, 'deleted' => true]); }
        if ($act) Track::hit($me, 'admin', $act);
        $this->user($id);
    }

    /** POST /admin/invite { email, role } : emails a sign-up link that carries the role */
    public function invite(): void
    {
        $me = $this->admin(); $b = Http::body(); $email = Validator::email((string) ($b['email'] ?? '')); $role = in_array($b['role'] ?? '', ['moderator', 'admin'], true) ? $b['role'] : 'moderator';
        if (!$email) Http::json(['error' => 'validation', 'fields' => ['email' => 'Enter a valid email.']], 422);
        $existing = Db::one('SELECT id FROM users WHERE email = ?', [$email]);
        if ($existing) { Db::run('UPDATE users SET role = ?, is_admin = ? WHERE id = ?', [$role, $role === 'admin' ? 1 : 0, $existing['id']]); Notify::user((int) $existing['id'], 'offers', 'You are now a Buja ' . $role, 'Open Me to find the admin panel.', '/#/admin', true); Http::json(['ok' => true, 'message' => 'That person already had an account; they are now a ' . $role . '.']); }
        $token = WebPush::b64u(random_bytes(18));
        Db::run('INSERT INTO invites (email, role, token_hash, invited_by, expires_at, created_at) VALUES (?,?,?,?,?,?)', [$email, $role, hash('sha256', $token), $me['id'], gmdate('Y-m-d H:i:s', time() + 7 * 86400), Db::now()]);
        $link = (string) Http::config('app_origin') . '/#/signup?invite=' . $token;
        $sent = Mail::send($email, $email, 'You are invited to help run Buja', '<p>' . htmlspecialchars($me['name']) . ' has invited you to be a ' . $role . ' on Buja.</p><p><a href="' . htmlspecialchars($link) . '" style="display:inline-block;background:#FF7A1A;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:700">Create your account</a></p><p style="color:#6F6F78;font-size:12px">The link works for 7 days.</p>');
        Http::json(['ok' => true, 'sent' => $sent, 'link' => $sent ? null : $link, 'message' => $sent ? 'Invitation sent.' : 'Email is not set up, so share this link yourself.']);
    }

    /** GET /admin/analytics?days=30 */
    public function analytics(): void
    {
        $this->admin(); $days = max(7, min(90, (int) ($_GET['days'] ?? 30))); $since = gmdate('Y-m-d', time() - $days * 86400);
        $byDay = fn(string $sql, array $p = []) => (function () use ($sql, $p) { $st = Db::pdo()->prepare($sql); $st->execute($p); $o = []; foreach ($st->fetchAll() as $r) $o[$r['d']] = (int) $r['n']; return $o; })();
        $signups = $byDay("SELECT SUBSTR(created_at,1,10) AS d, COUNT(*) AS n FROM users WHERE created_at >= ? GROUP BY SUBSTR(created_at,1,10)", [$since]);
        $dau = $byDay("SELECT SUBSTR(created_at,1,10) AS d, COUNT(DISTINCT user_id) AS n FROM events WHERE created_at >= ? AND user_id IS NOT NULL GROUP BY SUBSTR(created_at,1,10)", [$since]);
        $series = []; for ($i = $days - 1; $i >= 0; $i--) { $d = gmdate('Y-m-d', time() - $i * 86400); $series[] = ['d' => $d, 'signups' => $signups[$d] ?? 0, 'active' => $dau[$d] ?? 0]; }
        $mau = (int) (Db::one('SELECT COUNT(DISTINCT user_id) AS n FROM events WHERE created_at >= ? AND user_id IS NOT NULL', [gmdate('Y-m-d H:i:s', time() - 30 * 86400)])['n'] ?? 0);
        $wau = (int) (Db::one('SELECT COUNT(DISTINCT user_id) AS n FROM events WHERE created_at >= ? AND user_id IS NOT NULL', [gmdate('Y-m-d H:i:s', time() - 7 * 86400)])['n'] ?? 0);
        $today = (int) (Db::one('SELECT COUNT(DISTINCT user_id) AS n FROM events WHERE created_at >= ? AND user_id IS NOT NULL', [gmdate('Y-m-d 00:00:00')])['n'] ?? 0);
        $st = Db::pdo()->prepare('SELECT module, action, COUNT(*) AS n, COUNT(DISTINCT user_id) AS u FROM events WHERE created_at >= ? GROUP BY module, action ORDER BY n DESC'); $st->execute([$since]);
        $modules = []; foreach ($st->fetchAll() as $r) { $modules[$r['module']]['events'] = ($modules[$r['module']]['events'] ?? 0) + (int) $r['n']; $modules[$r['module']]['actions'][$r['action']] = ['events' => (int) $r['n'], 'users' => (int) $r['u']]; }
        $kinds = []; foreach (Db::pdo()->query('SELECT kind, COUNT(*) AS n FROM users WHERE deleted_at IS NULL GROUP BY kind')->fetchAll() as $r) $kinds[$r['kind']] = (int) $r['n'];
        $districts = []; foreach (Db::pdo()->query('SELECT district, COUNT(*) AS n FROM users WHERE deleted_at IS NULL AND district IS NOT NULL GROUP BY district ORDER BY n DESC LIMIT 10')->fetchAll() as $r) $districts[] = ['district' => $r['district'], 'users' => (int) $r['n']];
        $rev = Db::pdo()->prepare("SELECT SUBSTR(paid_at,1,7) AS m, SUM(amount) AS n, COUNT(*) AS c FROM payments WHERE status = 'paid' GROUP BY SUBSTR(paid_at,1,7) ORDER BY m DESC LIMIT 12"); $rev->execute();
        Http::json(['days' => $days, 'series' => $series, 'active' => ['today' => $today, 'week' => $wau, 'month' => $mau], 'totalUsers' => (int) (Db::one('SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL')['n'] ?? 0), 'signupsInRange' => array_sum($signups), 'modules' => $modules, 'kinds' => $kinds, 'districts' => $districts, 'revenueByMonth' => array_map(fn($r) => ['month' => $r['m'], 'naira' => (int) $r['n'], 'payments' => (int) $r['c']], $rev->fetchAll())]);
    }

    /** GET /admin/overview */
    public function overview(): void
    {
        $this->admin(true);
        $n = fn(string $sql) => (int) (Db::one($sql)['n'] ?? 0);
        Http::json(['counts' => ['users' => $n('SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL'), 'plus' => $n("SELECT COUNT(*) AS n FROM users WHERE plus_until > '" . Db::now() . "'"), 'jobs' => $n("SELECT COUNT(*) AS n FROM jobs WHERE status = 'open'"), 'applications' => $n('SELECT COUNT(*) AS n FROM applications'), 'matches' => $n('SELECT COUNT(*) AS n FROM matches'), 'properties' => $n("SELECT COUNT(*) AS n FROM properties WHERE status = 'available'"), 'listings' => $n("SELECT COUNT(*) AS n FROM listings WHERE status = 'active'"), 'fareReports' => $n('SELECT COUNT(*) AS n FROM fare_reports'), 'asks' => $n('SELECT COUNT(*) AS n FROM ask_log'), 'spots' => $n('SELECT COUNT(*) AS n FROM spots WHERE active = 1')],
            'queues' => ['verifications' => $n("SELECT COUNT(*) AS n FROM verifications WHERE status = 'pending'"), 'reports' => $n('SELECT COUNT(*) AS n FROM reports WHERE reviewed_at IS NULL'), 'spots' => $n('SELECT COUNT(*) AS n FROM spots WHERE active = 1 AND verified_at IS NULL')],
            'storage' => ['configured' => Media::configured(), 'inDb' => ['matchPhotos' => $n('SELECT COUNT(*) AS n FROM match_photos WHERE storage_key IS NULL'), 'propertyPhotos' => $n('SELECT COUNT(*) AS n FROM property_photos WHERE storage_key IS NULL'), 'listingPhotos' => $n('SELECT COUNT(*) AS n FROM listing_photos WHERE storage_key IS NULL'), 'cvs' => $n('SELECT COUNT(*) AS n FROM cv_files WHERE storage_key IS NULL')]],
            'city' => ['meetups' => (int) (Db::one("SELECT COUNT(*) AS n FROM meetups WHERE status = 'live' AND starts_at > '" . gmdate('Y-m-d H:i:s') . "'")['n'] ?? 0), 'artisans' => (int) (Db::one('SELECT COUNT(*) AS n FROM artisans')['n'] ?? 0), 'reports30' => (int) (Db::one('SELECT COUNT(*) AS n FROM citizen_reports WHERE created_at > \'' . gmdate('Y-m-d H:i:s', time() - 30 * 86400) . '\'')['n'] ?? 0), 'ticketSales' => (int) (Db::one("SELECT COALESCE(SUM(amount),0) AS s FROM tickets WHERE status IN ('paid','used')")['s'] ?? 0), 'bujaFees' => (int) (Db::one("SELECT COALESCE(SUM(fee),0) AS s FROM tickets WHERE status IN ('paid','used')")['s'] ?? 0)],
            'ask' => ['provider' => (string) Http::config('ask_provider', 'gemini'),
                'keys' => array_values(array_filter(['gemini', 'groq', 'anthropic'], fn($p) => Http::config($p . '_api_key', '') !== '')),
                'today' => (int) (Db::one('SELECT COUNT(*) AS n FROM ask_log WHERE created_at >= ?', [gmdate('Y-m-d 00:00:00')])['n'] ?? 0),
                'byMode' => (function () { $st = Db::pdo()->prepare('SELECT mode, COUNT(*) AS n FROM ask_log WHERE created_at >= ? GROUP BY mode'); $st->execute([gmdate('Y-m-d H:i:s', time() - 7 * 86400)]); $o = []; foreach ($st->fetchAll() as $r) $o[$r['mode']] = (int) $r['n']; return $o; })()],
            'payments' => ['configured' => (string) Http::config('paystack_secret', '') !== '', 'paid' => $n("SELECT COUNT(*) AS n FROM payments WHERE status = 'paid'"), 'revenue' => (int) (Db::one("SELECT COALESCE(SUM(amount),0) AS n FROM payments WHERE status = 'paid'")['n'] ?? 0)]]);
    }

    /** GET /admin/verifications */
    public function verifications(): void
    {
        $this->admin(true);
        $st = Db::pdo()->query("SELECT v.id, v.user_id, v.kind, v.mime, v.status, v.created_at, u.name, u.email, u.district FROM verifications v JOIN users u ON u.id = v.user_id WHERE v.status = 'pending' ORDER BY v.id ASC LIMIT 50");
        $rows = [];
        foreach ($st->fetchAll() as $v) {
            $ph = Db::one('SELECT id FROM match_photos WHERE user_id = ? ORDER BY position LIMIT 1', [$v['user_id']]);
            $rows[] = ['id' => (int) $v['id'], 'kind' => $v['kind'], 'mime' => $v['mime'], 'createdAt' => $v['created_at'], 'user' => ['id' => (int) $v['user_id'], 'name' => $v['name'], 'email' => $v['email'], 'district' => $v['district']], 'fileUrl' => '/api/admin/verifications/' . (int) $v['id'] . '/file', 'comparePhoto' => $ph ? '/api/match/photo/' . (int) $ph['id'] : null];
        }
        Http::json(['items' => $rows]);
    }
    /** GET /admin/verifications/{id}/file */
    public function verificationFile(int $id): void
    {
        $this->admin(true); $v = Db::one('SELECT * FROM verifications WHERE id = ?', [$id]); if (!$v) Http::json(['error' => 'not_found'], 404);
        if ($v['storage_key']) { header('Location: ' . Media::url($v['storage_key'])); exit; }
        header('Content-Type: ' . $v['mime']); header('Content-Length: ' . (int) $v['size']); header('Cache-Control: private, no-store'); echo $v['data']; exit;
    }
    /** POST /admin/verifications/{id} { action: approve|reject, note } */
    public function decide(int $id): void
    {
        $a = $this->admin(true); $v = Db::one('SELECT * FROM verifications WHERE id = ?', [$id]); if (!$v) Http::json(['error' => 'not_found'], 404);
        $b = Http::body(); $act = (string) ($b['action'] ?? ''); $note = mb_substr(trim((string) ($b['note'] ?? '')), 0, 200);
        if (!in_array($act, ['approve', 'reject'], true)) Http::json(['error' => 'validation', 'fields' => ['action' => 'approve or reject']], 422);
        Db::run('UPDATE verifications SET status = ?, note = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?', [$act === 'approve' ? 'approved' : 'rejected', $note ?: null, Db::now(), $a['id'], $id]);
        if ($act === 'approve') {
            if ($v['kind'] === 'selfie') Db::run('UPDATE users SET selfie_verified_at = ? WHERE id = ?', [Db::now(), $v['user_id']]);
            else Db::run('UPDATE landlord_profiles SET verified_at = ? WHERE user_id = ?', [Db::now(), $v['user_id']]);
            Db::run('UPDATE verifications SET data = NULL WHERE id = ?', [$id]);
            if ($v['storage_key']) Media::delete($v['storage_key']);
        }
        Notify::user((int) $v['user_id'], $v['kind'] === 'selfie' ? 'match' : 'work', $act === 'approve' ? ($v['kind'] === 'selfie' ? 'You are verified on Match' : 'You are a verified landlord') : 'Verification not approved', $act === 'approve' ? 'The badge is now on your profile.' : ($note ?: 'Please submit a clearer photo or document.'), '/#/verify');
        Http::json(['ok' => true]);
    }

    /** GET /admin/reports and POST /admin/reports/{id} { action: dismiss|suspend } */
    public function reports(): void
    {
        $this->admin(true);
        $st = Db::pdo()->query('SELECT r.*, a.name AS reporter_name, b.name AS reported_name, b.email AS reported_email, (SELECT COUNT(*) FROM reports x WHERE x.reported = r.reported) AS total FROM reports r JOIN users a ON a.id = r.reporter JOIN users b ON b.id = r.reported WHERE r.reviewed_at IS NULL ORDER BY total DESC, r.id ASC LIMIT 50');
        $titleOf = function (string $kind, ?int $id) {
            if (!$id) return null;
            $q = ['listing' => ['listings', 'title', '/declutter/'], 'property' => ['properties', 'title', '/homes/'], 'post' => ['social_posts', 'title', '/social/'], 'job' => ['jobs', 'title', '/work/job/'], 'spot' => ['spots', 'name', '/ask/place/']][$kind] ?? null;
            if (!$q) return null;
            $row = Db::one("SELECT {$q[1]} AS t FROM {$q[0]} WHERE id = ?", [$id]);
            return $row ? ['title' => $row['t'], 'url' => $q[2] . $id] : null;
        };
        Http::json(['items' => array_map(fn($r) => ['id' => (int) $r['id'], 'reason' => $r['reason'], 'createdAt' => $r['created_at'], 'reporter' => $r['reporter_name'], 'kind' => $r['target_kind'] ?? 'user', 'target' => $titleOf((string) ($r['target_kind'] ?? 'user'), $r['target_id'] ? (int) $r['target_id'] : null), 'reported' => ['id' => (int) $r['reported'], 'name' => $r['reported_name'], 'email' => $r['reported_email'], 'totalReports' => (int) $r['total']]], $st->fetchAll())]);
    }
    public function decideReport(int $id): void
    {
        $a = $this->admin(true); $r = Db::one('SELECT * FROM reports WHERE id = ?', [$id]); if (!$r) Http::json(['error' => 'not_found'], 404);
        $act = (string) (Http::body()['action'] ?? ''); if (!in_array($act, ['dismiss', 'suspend', 'hide'], true)) Http::json(['error' => 'validation'], 422);
        if ($act === 'hide' && !empty($r['target_id'])) {
            $k = (string) $r['target_kind'];
            if ($k === 'listing') Db::run("UPDATE listings SET status = 'hidden' WHERE id = ?", [$r['target_id']]);
            if ($k === 'property') Db::run("UPDATE properties SET status = 'hidden' WHERE id = ?", [$r['target_id']]);
            if ($k === 'post') Db::run('UPDATE social_posts SET hidden_at = ? WHERE id = ?', [Db::now(), $r['target_id']]);
            if ($k === 'job') Db::run("UPDATE jobs SET status = 'closed' WHERE id = ?", [$r['target_id']]);
            if ($k === 'spot') Db::run('UPDATE spots SET active = 0 WHERE id = ?', [$r['target_id']]);
            Notify::user((int) $r['reported'], 'work', 'Something you posted was taken down', 'A moderator removed it after a report. Message support if you think that is wrong.', '/#/home');
        }
        Db::run('UPDATE reports SET reviewed_at = ?, reviewed_by = ?, outcome = ? WHERE id = ?', [Db::now(), $a['id'], $act, $id]);
        if ($act === 'suspend') { Db::run('UPDATE users SET deleted_at = ? WHERE id = ?', [Db::now(), $r['reported']]); Db::run('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [Db::now(), $r['reported']]); Db::run('UPDATE match_profiles SET visible = 0 WHERE user_id = ?', [$r['reported']]); Db::run("UPDATE listings SET status = 'hidden' WHERE seller_id = ?", [$r['reported']]); Db::run("UPDATE properties SET status = 'hidden' WHERE owner_id = ?", [$r['reported']]); }
        Http::json(['ok' => true]);
    }

    /** GET /admin/spots (unverified) and POST /admin/spots/{id} { action: verify|remove } */
    public function spots(): void
    {
        $this->admin(true); $st = Db::pdo()->query('SELECT s.*, u.name AS added_name FROM spots s LEFT JOIN users u ON u.id = s.added_by WHERE s.active = 1 AND s.verified_at IS NULL ORDER BY s.id ASC LIMIT 50');
        Http::json(['items' => array_map(fn($s) => ['id' => (int) $s['id'], 'name' => $s['name'], 'category' => $s['category'], 'district' => $s['district'], 'area' => $s['area'], 'description' => $s['description'], 'tags' => json_decode($s['tags'] ?? '[]', true) ?: [], 'addedBy' => $s['added_name'], 'createdAt' => $s['created_at']], $st->fetchAll())]);
    }
    public function decideSpot(int $id): void
    {
        $this->admin(true); $act = (string) (Http::body()['action'] ?? ''); if (!in_array($act, ['verify', 'remove'], true)) Http::json(['error' => 'validation'], 422);
        if ($act === 'verify') Db::run('UPDATE spots SET verified_at = ? WHERE id = ?', [Db::now(), $id]); else Db::run('UPDATE spots SET active = 0 WHERE id = ?', [$id]);
        Http::json(['ok' => true]);
    }

    /**
     * POST /admin/radio/sync : pulls Abuja's station list from Radio Garden and attaches a playable
     * stream to each station we already list, adding any we are missing. Safe to run again any time.
     */
    public function syncRadio(): void
    {
        $this->admin();
        $place = (string) (Http::body()['place'] ?? 'Z1N4bsO2'); // radio.garden place id for Abuja
        if (!preg_match('/^[A-Za-z0-9_-]{4,20}$/', $place)) Http::json(['error' => 'validation', 'message' => 'Bad place id.'], 422);
        $ch = curl_init('https://radio.garden/api/ara/content/page/' . $place . '/channels');
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20, CURLOPT_FOLLOWLOCATION => true, CURLOPT_USERAGENT => 'BujaBot/1.0']);
        $raw = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($code !== 200) Http::json(['error' => 'upstream', 'message' => 'Radio Garden returned ' . $code . '.'], 502);
        Http::json($this->applyRadio((string) $raw));
    }

    /** Separated so it can be tested without the network. */
    public function applyRadio(string $raw): array
    {
        $j = json_decode($raw, true);
        $list = $j['data']['content'][0]['items'] ?? $j['data']['items'] ?? [];
        if (!$list) return ['matched' => 0, 'added' => 0, 'message' => 'No stations in that response.'];
        $norm = fn(string $s) => preg_replace('/[^a-z0-9]/', '', mb_strtolower(preg_replace('/\b(fm|radio|abuja|nigeria|frcn|the)\b/i', '', $s)));
        $ours = Db::pdo()->query('SELECT id, name, frequency FROM radio_stations')->fetchAll();
        $matched = 0; $added = 0; $names = [];
        foreach ($list as $it) {
            $title = trim((string) ($it['title'] ?? '')); $href = (string) ($it['href'] ?? '');
            if ($title === '' || !preg_match('#/listen/[^/]+/([A-Za-z0-9_-]+)#', $href, $m)) continue;
            $stream = 'https://radio.garden/api/ara/content/listen/' . $m[1] . '/channel.mp3';
            $freq = preg_match('/(\d{2,3}\.\d)/', $title, $f) ? $f[1] : null;
            $hit = null;
            foreach ($ours as $o) {
                if ($freq && $o['frequency'] === $freq) { $hit = $o; break; }
                if ($norm($o['name']) !== '' && $norm($o['name']) === $norm($title)) { $hit = $o; break; }
            }
            if ($hit) { Db::run('UPDATE radio_stations SET stream_url = ? WHERE id = ?', [$stream, $hit['id']]); $matched++; $names[] = $hit['name']; }
            else { Db::run('INSERT INTO radio_stations (name, frequency, genre, stream_url, active) VALUES (?,?,?,?,1)', [mb_substr(trim(preg_replace('/\s*\d{2,3}\.\d\s*(FM)?/i', ' ', $title)) ?: $title, 0, 60), $freq ?: '—', 'From Radio Garden', $stream]); $added++; $names[] = $title; }
        }
        return ['matched' => $matched, 'added' => $added, 'stations' => array_slice($names, 0, 40), 'message' => $matched + $added . ' stations now have a stream.'];
    }

    private function staff(): array
    {
        $u = Auth::require();
        if (!in_array($u['role'] ?? '', ['admin', 'moderator'], true) && empty($u['is_admin'])) Http::json(['error' => 'forbidden', 'message' => 'Staff only.'], 403);
        return $u;
    }

    /** GET /admin/meetups : everything upcoming, newest first, with the host */
    public function meetups(): void
    {
        $this->staff();
        $st = Db::pdo()->query("SELECT m.*, u.name AS host_name FROM meetups m JOIN users u ON u.id = m.host_id WHERE m.starts_at > '" . gmdate('Y-m-d H:i:s', time() - 86400) . "' ORDER BY m.id DESC LIMIT 80");
        Http::json(['items' => array_map(fn($m) => ['id' => (int) $m['id'], 'title' => $m['title'], 'host' => $m['host_name'], 'hostId' => (int) $m['host_id'], 'startsAt' => $m['starts_at'], 'district' => $m['district'], 'price' => (int) $m['price'], 'going' => (int) $m['going'], 'tickets' => (int) $m['ticket_count'], 'status' => $m['status'], 'hidden' => $m['hidden_at'] !== null, 'sales' => (int) (Db::one("SELECT COALESCE(SUM(amount - fee),0) AS p FROM tickets WHERE event_id = ? AND status IN ('paid','used')", [$m['id']])['p'] ?? 0)], $st->fetchAll())]);
    }
    /** POST /admin/meetups/{id} { action: hide|show|cancel } */
    public function decideMeetup(int $id): void
    {
        $this->staff(); $act = (string) (Http::body()['action'] ?? '');
        if ($act === 'hide') Db::run('UPDATE meetups SET hidden_at = ? WHERE id = ?', [Db::now(), $id]);
        elseif ($act === 'show') Db::run('UPDATE meetups SET hidden_at = NULL WHERE id = ?', [$id]);
        elseif ($act === 'cancel') { Db::run("UPDATE meetups SET status = 'cancelled' WHERE id = ?", [$id]); $e = Db::one('SELECT title FROM meetups WHERE id = ?', [$id]); $st = Db::pdo()->prepare("SELECT user_id FROM meetup_rsvps WHERE event_id = ? AND status IN ('going','waitlist')"); $st->execute([$id]); foreach ($st->fetchAll() as $r) Notify::user((int) $r['user_id'], 'offers', 'Cancelled: ' . ($e['title'] ?? 'event'), 'Removed by Buja moderators.', '/#/meetup'); }
        else Http::json(['error' => 'validation'], 422);
        $this->meetups();
    }
    /** GET /admin/artisans and POST /admin/artisans/{id} { action: verify|unverify|hide|show } */
    public function artisans(): void
    {
        $this->staff();
        $st = Db::pdo()->query('SELECT a.*, u.name, u.phone AS user_phone, u.selfie_verified_at FROM artisans a JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 120');
        Http::json(['bySource' => Db::pdo()->query("SELECT COALESCE(source, 'app') AS source, COUNT(*) AS n FROM artisans GROUP BY COALESCE(source, 'app') ORDER BY n DESC")->fetchAll(), 'items' => array_map(fn($x) => ['idPhoto' => !empty($x['id_upload']) ? '/api/uploads/' . (int) $x['id_upload'] : null, 'source' => $x['source'] ?? null, 'photo' => !empty($x['photo_upload']) ? '/api/uploads/' . (int) $x['photo_upload'] : null, 'pending' => empty($x['verified_at']) && !empty($x['id_upload']) && empty($x['hidden_at']), 'id' => (int) $x['user_id'], 'name' => $x['business'] ?: $x['name'], 'person' => $x['name'], 'trade' => ArtisanController::TRADES[$x['trade']] ?? $x['trade'], 'phone' => $x['phone'], 'district' => $x['base_district'], 'selfie' => $x['selfie_verified_at'] !== null, 'verified' => $x['verified_at'] !== null, 'hidden' => $x['hidden_at'] !== null, 'contacts' => (int) $x['jobs_done'], 'rating' => RatingController::summary((int) $x['user_id']), 'since' => substr((string) $x['created_at'], 0, 10)], $st->fetchAll())]);
    }
    public function decideArtisan(int $id): void
    {
        $this->staff(); $act = (string) (Http::body()['action'] ?? '');
        $sql = ['verify' => 'verified_at = ?', 'unverify' => 'verified_at = NULL', 'hide' => 'hidden_at = ?', 'show' => 'hidden_at = NULL'][$act] ?? null; if (!$sql) Http::json(['error' => 'validation'], 422);
        Db::run('UPDATE artisans SET ' . $sql . ' WHERE user_id = ?', str_contains($sql, '= ?') ? [Db::now(), $id] : [$id]);
        if ($act === 'verify') Notify::user($id, 'offers', 'Your artisan listing is verified', 'Buja checked your details. The badge shows on your profile.', '/#/artisans/' . $id);
        $this->artisans();
    }
    /** GET /admin/citizen : what residents have been reporting, by agency and category */
    public function citizen(): void
    {
        $this->staff();
        $by = Db::pdo()->query("SELECT category, COUNT(*) AS n FROM citizen_reports WHERE created_at > '" . gmdate('Y-m-d H:i:s', time() - 30 * 86400) . "' GROUP BY category ORDER BY n DESC")->fetchAll();
        $recent = Db::pdo()->query('SELECT r.*, u.name FROM citizen_reports r JOIN users u ON u.id = r.user_id ORDER BY r.id DESC LIMIT 60')->fetchAll();
        $names = array_column(CitizenController::AGENCIES, 'name', 'id');
        Http::json(['byCategory' => array_map(fn($r) => ['category' => CitizenController::CATS[$r['category']] ?? $r['category'], 'n' => (int) $r['n']], $by),
            'recent' => array_map(fn($r) => ['ref' => 'BJ-' . strtoupper(base_convert((string) ((int) $r['id'] * 7919), 10, 36)), 'by' => explode(' ', trim((string) $r['name']))[0], 'agency' => $names[$r['agency']] ?? $r['agency'], 'category' => CitizenController::CATS[$r['category']] ?? $r['category'], 'district' => $r['district'], 'body' => mb_substr($r['body'], 0, 160), 'channel' => $r['channel'], 'at' => $r['created_at']], $recent)]);
    }

    /** POST /admin/spots/import { category } : fill the Ask directory from OpenStreetMap, one category per call */
    public function importSpots(): void
    {
        $this->staff();
        @set_time_limit(0); ignore_user_abort(true);
        $b = Http::body(); $cat = (string) ($b['category'] ?? '');
        $r = Osm::importCategory($cat, 3000, isset($b['tile']) && $b['tile'] !== '' ? (int) $b['tile'] : null);
        $total = (int) (Db::one('SELECT COUNT(*) AS n FROM spots WHERE active = 1')['n'] ?? 0);
        Http::json(['result' => $r, 'category' => $cat, 'total' => $total]);
    }

    /** POST /admin/storage/test and POST /admin/storage/migrate { batch } */
    public function storageTest(): void { $this->admin(); Http::json(Media::selfTest()); }
    public function migrate(): void
    {
        $this->admin(); if (!Media::configured()) Http::json(['error' => 'unavailable', 'message' => 'R2 is not configured.'], 409);
        $batch = max(1, min(50, (int) (Http::body()['batch'] ?? 20))); $moved = 0;
        foreach ([['match_photos', 'match', 'jpg'], ['property_photos', 'homes', 'jpg'], ['listing_photos', 'declutter', 'jpg'], ['cv_files', 'cv', 'pdf']] as [$table, $folder, $ext]) {
            $st = Db::pdo()->prepare("SELECT id, mime, data FROM $table WHERE storage_key IS NULL AND data IS NOT NULL LIMIT " . ($batch - $moved)); $st->execute();
            foreach ($st->fetchAll() as $row) { $e = str_contains($row['mime'], 'pdf') ? 'pdf' : (str_contains($row['mime'], 'png') ? 'png' : (str_contains($row['mime'], 'webp') ? 'webp' : 'jpg')); if (str_contains($row['mime'], 'word')) $e = str_contains($row['mime'], 'openxml') ? 'docx' : 'doc'; $key = Media::put($folder, $row['data'], $row['mime'], $e); if ($key) { Db::run("UPDATE $table SET storage_key = ?, data = NULL WHERE id = ?", [$key, $row['id']]); $moved++; } if ($moved >= $batch) break 2; }
        }
        Http::json(['moved' => $moved, 'remaining' => (int) (Db::one('SELECT (SELECT COUNT(*) FROM match_photos WHERE storage_key IS NULL) + (SELECT COUNT(*) FROM property_photos WHERE storage_key IS NULL) + (SELECT COUNT(*) FROM listing_photos WHERE storage_key IS NULL) + (SELECT COUNT(*) FROM cv_files WHERE storage_key IS NULL) AS n')['n'] ?? 0)]);
    }
}

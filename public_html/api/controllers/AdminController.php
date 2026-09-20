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
        Http::json(['items' => array_map(fn($r) => ['id' => (int) $r['id'], 'reason' => $r['reason'], 'createdAt' => $r['created_at'], 'reporter' => $r['reporter_name'], 'reported' => ['id' => (int) $r['reported'], 'name' => $r['reported_name'], 'email' => $r['reported_email'], 'totalReports' => (int) $r['total']]], $st->fetchAll())]);
    }
    public function decideReport(int $id): void
    {
        $a = $this->admin(true); $r = Db::one('SELECT * FROM reports WHERE id = ?', [$id]); if (!$r) Http::json(['error' => 'not_found'], 404);
        $act = (string) (Http::body()['action'] ?? ''); if (!in_array($act, ['dismiss', 'suspend'], true)) Http::json(['error' => 'validation'], 422);
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

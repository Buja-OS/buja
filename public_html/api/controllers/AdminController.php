<?php
declare(strict_types=1);

final class AdminController
{
    private function admin(): array { $u = Auth::require(); if (empty($u['is_admin'])) Http::json(['error' => 'forbidden', 'message' => 'Admins only.'], 403); return $u; }

    /** GET /admin/overview */
    public function overview(): void
    {
        $this->admin();
        $n = fn(string $sql) => (int) (Db::one($sql)['n'] ?? 0);
        Http::json(['counts' => ['users' => $n('SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL'), 'plus' => $n("SELECT COUNT(*) AS n FROM users WHERE plus_until > '" . Db::now() . "'"), 'jobs' => $n("SELECT COUNT(*) AS n FROM jobs WHERE status = 'open'"), 'applications' => $n('SELECT COUNT(*) AS n FROM applications'), 'matches' => $n('SELECT COUNT(*) AS n FROM matches'), 'properties' => $n("SELECT COUNT(*) AS n FROM properties WHERE status = 'available'"), 'listings' => $n("SELECT COUNT(*) AS n FROM listings WHERE status = 'active'"), 'fareReports' => $n('SELECT COUNT(*) AS n FROM fare_reports'), 'asks' => $n('SELECT COUNT(*) AS n FROM ask_log'), 'spots' => $n('SELECT COUNT(*) AS n FROM spots WHERE active = 1')],
            'queues' => ['verifications' => $n("SELECT COUNT(*) AS n FROM verifications WHERE status = 'pending'"), 'reports' => $n('SELECT COUNT(*) AS n FROM reports WHERE reviewed_at IS NULL'), 'spots' => $n('SELECT COUNT(*) AS n FROM spots WHERE active = 1 AND verified_at IS NULL')],
            'storage' => ['configured' => Media::configured(), 'inDb' => ['matchPhotos' => $n('SELECT COUNT(*) AS n FROM match_photos WHERE storage_key IS NULL'), 'propertyPhotos' => $n('SELECT COUNT(*) AS n FROM property_photos WHERE storage_key IS NULL'), 'listingPhotos' => $n('SELECT COUNT(*) AS n FROM listing_photos WHERE storage_key IS NULL'), 'cvs' => $n('SELECT COUNT(*) AS n FROM cv_files WHERE storage_key IS NULL')]],
            'payments' => ['configured' => (string) Http::config('paystack_secret', '') !== '', 'paid' => $n("SELECT COUNT(*) AS n FROM payments WHERE status = 'paid'"), 'revenue' => (int) (Db::one("SELECT COALESCE(SUM(amount),0) AS n FROM payments WHERE status = 'paid'")['n'] ?? 0)]]);
    }

    /** GET /admin/verifications */
    public function verifications(): void
    {
        $this->admin();
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
        $this->admin(); $v = Db::one('SELECT * FROM verifications WHERE id = ?', [$id]); if (!$v) Http::json(['error' => 'not_found'], 404);
        if ($v['storage_key']) { header('Location: ' . Media::url($v['storage_key'])); exit; }
        header('Content-Type: ' . $v['mime']); header('Content-Length: ' . (int) $v['size']); header('Cache-Control: private, no-store'); echo $v['data']; exit;
    }
    /** POST /admin/verifications/{id} { action: approve|reject, note } */
    public function decide(int $id): void
    {
        $a = $this->admin(); $v = Db::one('SELECT * FROM verifications WHERE id = ?', [$id]); if (!$v) Http::json(['error' => 'not_found'], 404);
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
        $this->admin();
        $st = Db::pdo()->query('SELECT r.*, a.name AS reporter_name, b.name AS reported_name, b.email AS reported_email, (SELECT COUNT(*) FROM reports x WHERE x.reported = r.reported) AS total FROM reports r JOIN users a ON a.id = r.reporter JOIN users b ON b.id = r.reported WHERE r.reviewed_at IS NULL ORDER BY total DESC, r.id ASC LIMIT 50');
        Http::json(['items' => array_map(fn($r) => ['id' => (int) $r['id'], 'reason' => $r['reason'], 'createdAt' => $r['created_at'], 'reporter' => $r['reporter_name'], 'reported' => ['id' => (int) $r['reported'], 'name' => $r['reported_name'], 'email' => $r['reported_email'], 'totalReports' => (int) $r['total']]], $st->fetchAll())]);
    }
    public function decideReport(int $id): void
    {
        $a = $this->admin(); $r = Db::one('SELECT * FROM reports WHERE id = ?', [$id]); if (!$r) Http::json(['error' => 'not_found'], 404);
        $act = (string) (Http::body()['action'] ?? ''); if (!in_array($act, ['dismiss', 'suspend'], true)) Http::json(['error' => 'validation'], 422);
        Db::run('UPDATE reports SET reviewed_at = ?, reviewed_by = ?, outcome = ? WHERE id = ?', [Db::now(), $a['id'], $act, $id]);
        if ($act === 'suspend') { Db::run('UPDATE users SET deleted_at = ? WHERE id = ?', [Db::now(), $r['reported']]); Db::run('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [Db::now(), $r['reported']]); Db::run('UPDATE match_profiles SET visible = 0 WHERE user_id = ?', [$r['reported']]); Db::run("UPDATE listings SET status = 'hidden' WHERE seller_id = ?", [$r['reported']]); Db::run("UPDATE properties SET status = 'hidden' WHERE owner_id = ?", [$r['reported']]); }
        Http::json(['ok' => true]);
    }

    /** GET /admin/spots (unverified) and POST /admin/spots/{id} { action: verify|remove } */
    public function spots(): void
    {
        $this->admin(); $st = Db::pdo()->query('SELECT s.*, u.name AS added_name FROM spots s LEFT JOIN users u ON u.id = s.added_by WHERE s.active = 1 AND s.verified_at IS NULL ORDER BY s.id ASC LIMIT 50');
        Http::json(['items' => array_map(fn($s) => ['id' => (int) $s['id'], 'name' => $s['name'], 'category' => $s['category'], 'district' => $s['district'], 'area' => $s['area'], 'description' => $s['description'], 'tags' => json_decode($s['tags'] ?? '[]', true) ?: [], 'addedBy' => $s['added_name'], 'createdAt' => $s['created_at']], $st->fetchAll())]);
    }
    public function decideSpot(int $id): void
    {
        $this->admin(); $act = (string) (Http::body()['action'] ?? ''); if (!in_array($act, ['verify', 'remove'], true)) Http::json(['error' => 'validation'], 422);
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

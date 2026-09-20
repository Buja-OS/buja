<?php
declare(strict_types=1);

/** Selfie verification (Match) and landlord document verification (Homes). Files are private; only admins see them. */
final class VerifyController
{
    private function latest(int $uid, string $kind): ?array { return Db::one('SELECT id, status, note, created_at AS createdAt, reviewed_at AS reviewedAt FROM verifications WHERE user_id = ? AND kind = ? ORDER BY id DESC LIMIT 1', [$uid, $kind]); }

    /** GET /verify/status */
    public function status(): void
    {
        $u = Auth::require(); $row = Db::one('SELECT selfie_verified_at FROM users WHERE id = ?', [$u['id']]);
        $ll = Db::one('SELECT verified_at FROM landlord_profiles WHERE user_id = ?', [$u['id']]);
        Http::json(['selfie' => ['verified' => !empty($row['selfie_verified_at']), 'request' => $this->latest((int) $u['id'], 'selfie')], 'landlord' => ['verified' => !empty($ll['verified_at']), 'request' => $this->latest((int) $u['id'], 'landlord'), 'applicable' => $u['kind'] === 'landlord']]);
    }

    /** POST /verify/{kind} multipart "file" : selfie (image) or landlord (image or PDF of a title / tenancy / C of O) */
    public function submit(string $kind): void
    {
        $u = Auth::require(); RateLimit::hit('verify', 6, 86400);
        if (!in_array($kind, ['selfie', 'landlord'], true)) Http::json(['error' => 'not_found'], 404);
        if ($kind === 'landlord' && $u['kind'] !== 'landlord') Http::json(['error' => 'forbidden', 'message' => 'Only landlord accounts can verify property ownership.'], 403);
        $open = Db::one("SELECT id FROM verifications WHERE user_id = ? AND kind = ? AND status = 'pending'", [$u['id'], $kind]); if ($open) Http::json(['error' => 'pending', 'message' => 'Your last submission is still being reviewed.'], 409);
        $f = Http::file('file'); if (!$f) Http::json(['error' => 'validation', 'fields' => ['file' => 'Choose a file.']], 422);
        if ((int) $f['size'] > 4 * 1024 * 1024) Http::json(['error' => 'validation', 'fields' => ['file' => 'Up to 4 MB.']], 422);
        $data = file_get_contents($f['tmp_name']) ?: ''; $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($data) ?: '';
        $ok = $kind === 'selfie' ? ['image/jpeg', 'image/png', 'image/webp'] : ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!in_array($mime, $ok, true)) Http::json(['error' => 'validation', 'fields' => ['file' => $kind === 'selfie' ? 'A photo, please.' : 'A photo or PDF of the document.']], 422);
        $key = Media::put('verify/' . $kind, $data, $mime, $mime === 'application/pdf' ? 'pdf' : 'jpg');
        Db::run('INSERT INTO verifications (user_id, kind, mime, size, data, storage_key, status, created_at) VALUES (?,?,?,?,?,?,?,?)', [$u['id'], $kind, $mime, strlen($data), $key ? null : $data, $key, 'pending', Db::now()]);
        $this->status();
    }
}

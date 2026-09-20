<?php
declare(strict_types=1);

final class AvatarController
{
    /** POST /me/avatar multipart "photo" (square-cropped on the phone) */
    public function upload(): void
    {
        $u = Auth::require(); RateLimit::hit('avatar', 20, 3600);
        $f = Http::file('photo'); if (!$f) Http::json(['error' => 'validation', 'fields' => ['photo' => 'Choose a photo.']], 422);
        if ((int) $f['size'] > 400 * 1024) Http::json(['error' => 'validation', 'fields' => ['photo' => 'Photo too large.']], 422);
        $data = file_get_contents($f['tmp_name']) ?: ''; $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($data) ?: '';
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) Http::json(['error' => 'validation', 'fields' => ['photo' => 'JPEG, PNG or WebP only.']], 422);
        $key = Media::put('avatar', $data, $mime, 'jpg');
        $old = Db::one('SELECT storage_key FROM avatars WHERE user_id = ?', [$u['id']]); if ($old && $old['storage_key']) Media::delete($old['storage_key']);
        Db::run('DELETE FROM avatars WHERE user_id = ?', [$u['id']]);
        Db::run('INSERT INTO avatars (user_id, mime, size, data, storage_key, updated_at) VALUES (?,?,?,?,?,?)', [$u['id'], $mime, strlen($data), $key ? null : $data, $key, Db::now()]);
        Db::run('UPDATE users SET avatar_url = ?, updated_at = ? WHERE id = ?', ['/api/avatar/' . $u['id'] . '?v=' . time(), Db::now(), $u['id']]);
        Http::json(['user' => Auth::publicUser(Db::one('SELECT * FROM users WHERE id = ?', [$u['id']]))]);
    }
    /** GET /avatar/{userId} : public within the app */
    public function show(int $id): void
    {
        $a = Db::one('SELECT * FROM avatars WHERE user_id = ?', [$id]); if (!$a) Http::json(['error' => 'not_found'], 404);
        if ($a['storage_key']) { header('Location: ' . Media::url($a['storage_key'], 3600)); header('Cache-Control: private, max-age=300'); exit; }
        header('Content-Type: ' . $a['mime']); header('Content-Length: ' . (int) $a['size']); header('Cache-Control: private, max-age=86400'); header('X-Content-Type-Options: nosniff'); echo $a['data']; exit;
    }
    /** DELETE /me/avatar */
    public function delete(): void
    {
        $u = Auth::require(); $old = Db::one('SELECT storage_key FROM avatars WHERE user_id = ?', [$u['id']]); if ($old && $old['storage_key']) Media::delete($old['storage_key']);
        Db::run('DELETE FROM avatars WHERE user_id = ?', [$u['id']]); Db::run('UPDATE users SET avatar_url = NULL WHERE id = ?', [$u['id']]);
        Http::json(['user' => Auth::publicUser(Db::one('SELECT * FROM users WHERE id = ?', [$u['id']]))]);
    }
}

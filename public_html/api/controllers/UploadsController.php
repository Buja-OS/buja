<?php
declare(strict_types=1);

/** Everything people attach: photos, video, voice notes, documents, a pinned location. */
final class UploadsController
{
    public const LIMITS = ['image' => 5, 'video' => 40, 'audio' => 12, 'file' => 15]; // megabytes
    private const MIMES = [
        'image' => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        'video' => ['video/mp4', 'video/webm', 'video/quicktime'],
        'audio' => ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/wav', 'audio/x-m4a', 'audio/x-wav'],
        'file'  => ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'application/zip'],
    ];

    public static function shape(?int $id): ?array
    {
        if (!$id) return null;
        $u = Db::one('SELECT id, kind, mime, size, name, meta FROM uploads WHERE id = ?', [$id]);
        if (!$u) return null;
        return ['id' => (int) $u['id'], 'kind' => $u['kind'], 'mime' => $u['mime'], 'size' => (int) $u['size'], 'name' => $u['name'], 'meta' => $u['meta'] ? json_decode($u['meta'], true) : null, 'url' => $u['kind'] === 'location' ? null : '/api/uploads/' . (int) $u['id']];
    }

    /** POST /uploads  multipart: file, kind */
    public function create(): void
    {
        $u = Auth::require(); RateLimit::hit('upload', 120, 3600);
        $kind = (string) ($_POST['kind'] ?? 'image');
        if (!isset(self::LIMITS[$kind])) Http::json(['error' => 'validation', 'message' => 'Unknown attachment type.'], 422);
        $f = Http::file('file'); if (!$f) Http::json(['error' => 'validation', 'fields' => ['file' => 'Choose a file.']], 422);
        if ((int) $f['size'] > self::LIMITS[$kind] * 1024 * 1024) Http::json(['error' => 'validation', 'fields' => ['file' => ucfirst($kind) . ' is too large. Limit is ' . self::LIMITS[$kind] . ' MB.']], 422);
        $data = file_get_contents($f['tmp_name']) ?: '';
        $mime = self::sniff($data, $kind, (string) ($f['type'] ?? ''));
        if ($mime === null) Http::json(['error' => 'validation', 'fields' => ['file' => 'That file type is not allowed here.']], 422);
        $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif', 'video/mp4' => 'mp4', 'video/webm' => 'webm', 'video/quicktime' => 'mov', 'audio/webm' => 'webm', 'audio/ogg' => 'ogg', 'audio/mpeg' => 'mp3', 'audio/mp4' => 'm4a', 'audio/aac' => 'aac', 'audio/wav' => 'wav', 'audio/x-m4a' => 'm4a', 'application/pdf' => 'pdf'][$mime] ?? 'bin';
        $key = Media::put('chat/' . $kind, $data, $mime, $ext);
        $meta = null;
        if ($kind === 'audio' && !empty($_POST['seconds'])) $meta = json_encode(['seconds' => max(1, min(600, (int) $_POST['seconds']))]);
        if ($kind === 'image' || $kind === 'video') { $d = @getimagesizefromstring($data); if ($d) $meta = json_encode(['w' => $d[0], 'h' => $d[1]]); }
        Db::run('INSERT INTO uploads (user_id, kind, mime, size, name, meta, data, storage_key, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
            [$u['id'], $kind, $mime, strlen($data), mb_substr((string) ($f['name'] ?? ''), 0, 120) ?: null, $meta, $key ? null : $data, $key, Db::now()]);
        Http::json(['upload' => self::shape((int) Db::lastId())], 201);
    }

    /**
     * Works out what a file really is. PHP's mime sniffer calls a browser voice note video/webm or plain
     * bytes, because webm and mp4 are containers that hold either. So we read the magic bytes ourselves and
     * trust the recorder's own label only when the container agrees with it.
     */
    private static function sniff(string $data, string $kind, string $declared): ?string
    {
        $sniffed = (new finfo(FILEINFO_MIME_TYPE))->buffer($data) ?: '';
        if (in_array($sniffed, self::MIMES[$kind], true)) return $sniffed;
        $head = substr($data, 0, 16);
        $container = match (true) {
            str_starts_with($head, "\x1A\x45\xDF\xA3") => 'webm',   // EBML, used by webm
            substr($head, 4, 4) === 'ftyp' => 'mp4',
            str_starts_with($head, 'OggS') => 'ogg',
            str_starts_with($head, 'RIFF') && substr($head, 8, 4) === 'WAVE' => 'wav',
            str_starts_with($head, 'ID3') || (ord($head[0] ?? "\0") === 0xFF && (ord($head[1] ?? "\0") & 0xE0) === 0xE0) => 'mp3',
            default => null,
        };
        if ($container === null) return null;
        if ($kind === 'audio') return match ($container) { 'webm' => 'audio/webm', 'mp4' => 'audio/mp4', 'ogg' => 'audio/ogg', 'wav' => 'audio/wav', 'mp3' => 'audio/mpeg', default => null };
        if ($kind === 'video') return match ($container) { 'webm' => 'video/webm', 'mp4' => str_contains($declared, 'quicktime') ? 'video/quicktime' : 'video/mp4', default => null };
        return null;
    }

    /** POST /uploads/location { lat, lng, label } */
    public function location(): void
    {
        $u = Auth::require(); $b = Http::body();
        $lat = (float) ($b['lat'] ?? 0); $lng = (float) ($b['lng'] ?? 0);
        if ($lat < 4 || $lat > 14 || $lng < 2 || $lng > 15) Http::json(['error' => 'validation', 'message' => 'That location is not in Nigeria.'], 422);
        $meta = json_encode(['lat' => round($lat, 5), 'lng' => round($lng, 5), 'label' => mb_substr(trim((string) ($b['label'] ?? '')), 0, 80)]);
        Db::run('INSERT INTO uploads (user_id, kind, meta, created_at) VALUES (?,?,?,?)', [$u['id'], 'location', $meta, Db::now()]);
        Http::json(['upload' => self::shape((int) Db::lastId())], 201);
    }

    /** GET /uploads/{id} : the owner, or anyone in a thread or post it is attached to. */
    /**
     * GET /uploads/{id}. Two kinds of picture:
     *  - public: shown on listings anyone can open, including signed-out visitors and Google (Social posts and
     *    their photo sets, artisans' faces, company logos, landlord photos, place photos, event covers,
     *    open lost-and-found posts). Anyone may load them.
     *  - private: chat attachments and a breakdown's photo. Only the people in that conversation or job.
     * Everything else is visible to its owner only.
     */
    public function show(int $id): void
    {
        $u = Auth::user();
        $f = Db::one('SELECT * FROM uploads WHERE id = ?', [$id]); if (!$f) Http::json(['error' => 'not_found'], 404);
        $public = (function () use ($id): bool {
            $checks = [
                'SELECT 1 AS x FROM social_posts WHERE upload_id = ? AND hidden_at IS NULL',
                'SELECT 1 AS x FROM social_replies WHERE upload_id = ? AND hidden_at IS NULL',
                'SELECT 1 AS x FROM social_images i LEFT JOIN social_posts p ON p.id = i.post_id LEFT JOIN social_replies r ON r.id = i.reply_id WHERE i.upload_id = ? AND (p.hidden_at IS NULL AND (i.post_id IS NOT NULL) OR r.hidden_at IS NULL AND (i.reply_id IS NOT NULL))',
                'SELECT 1 AS x FROM artisans WHERE photo_upload = ? AND hidden_at IS NULL',
                'SELECT 1 AS x FROM companies WHERE logo_upload_id = ?',
                'SELECT 1 AS x FROM landlord_profiles WHERE photo_upload_id = ?',
                'SELECT 1 AS x FROM spot_photos WHERE upload_id = ? AND hidden_at IS NULL',
                'SELECT 1 AS x FROM meetups WHERE cover_upload = ? AND hidden_at IS NULL',
                "SELECT 1 AS x FROM lost_found WHERE upload_id = ? AND status = 'open'",
            ];
            foreach ($checks as $q) { try { if (Db::one($q, [$id]) !== null) return true; } catch (Throwable $e) { /* a table not migrated yet */ } }
            return false;
        })();
        $allowed = $public;
        // Admins may see any upload: ID photos sent for the Verified badge are only ever seen by them.
        if (!$allowed && $u && (!empty($u['is_admin']) || ($u['role'] ?? '') === 'admin')) $allowed = true;
        if (!$allowed && $u) {
            $allowed = (int) $f['user_id'] === (int) $u['id']
                || Db::one('SELECT 1 AS x FROM messages m JOIN threads t ON t.id = m.thread_id WHERE m.upload_id = ? AND (t.user_a = ? OR t.user_b = ?)', [$id, $u['id'], $u['id']]) !== null
                || (function () use ($id, $u): bool { try { return Db::one('SELECT 1 AS x FROM service_jobs WHERE photo_upload = ? AND (customer_id = ? OR artisan_id = ?)', [$id, $u['id'], $u['id']]) !== null; } catch (Throwable $e) { return false; } })();
        }
        if (!$allowed) Http::json(['error' => $u ? 'forbidden' : 'unauthorized'], $u ? 403 : 401);
        if ($public) header('Cache-Control: public, max-age=86400'); // listings: safe to cache for everyone
        if ($f['storage_key']) { header('Location: ' . Media::url($f['storage_key'], 900)); header('Cache-Control: private, max-age=300'); exit; }
        header('Content-Type: ' . ($f['mime'] ?: 'application/octet-stream'));
        header('Content-Length: ' . (int) $f['size']);
        header('Accept-Ranges: none');
        if ($f['kind'] === 'file') header('Content-Disposition: inline; filename="' . preg_replace('/[^A-Za-z0-9._-]/', '_', (string) ($f['name'] ?? 'file')) . '"');
        if (!$public) header('Cache-Control: private, max-age=86400'); header('X-Content-Type-Options: nosniff');
        echo $f['data']; exit;
    }

    /** Confirms an upload belongs to this user and is not already attached somewhere. */
    public static function claim(?int $id, array $u): ?int
    {
        if (!$id) return null;
        $f = Db::one('SELECT id FROM uploads WHERE id = ? AND user_id = ?', [$id, $u['id']]);
        if (!$f) Http::json(['error' => 'validation', 'message' => 'That attachment is not yours.'], 422);
        if (Db::one('SELECT 1 AS x FROM messages WHERE upload_id = ?', [$id]) || Db::one('SELECT 1 AS x FROM social_posts WHERE upload_id = ?', [$id]) || Db::one('SELECT 1 AS x FROM spot_photos WHERE upload_id = ?', [$id])) Http::json(['error' => 'validation', 'message' => 'That attachment is already used.'], 422);
        return (int) $id;
    }
}

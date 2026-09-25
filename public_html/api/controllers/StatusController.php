<?php
declare(strict_types=1);

/**
 * Status updates, like WhatsApp: a line of text on a colour, or a photo with a caption. Each one lasts 24 hours and is
 * seen by your Buja friends (people you added by Buja tag). You can see exactly who viewed each of yours.
 * Blocks win both ways: someone you blocked, or who blocked you, never sees your status and you never see theirs.
 */
final class StatusController
{
    public const HOURS = 24;
    private const BGS = ['#1F5FBF', '#2E7D1E', '#7A3E96', '#C2185B', '#E8620E', '#0E7C86', '#101014', '#B7791F'];

    /** Friend ids of $uid (accepted, not blocked either way). */
    public static function friendIds(int $uid): array
    {
        $st = Db::pdo()->prepare("SELECT CASE WHEN user_id = ? THEN friend_id ELSE user_id END AS f FROM friendships WHERE (user_id = ? OR friend_id = ?) AND status = 'accepted'");
        $st->execute([$uid, $uid, $uid]);
        $ids = array_map('intval', array_column($st->fetchAll(), 'f'));
        if (!$ids) return [];
        $in = implode(',', $ids);
        $blocked = [];
        try { foreach (Db::pdo()->query("SELECT blocker, blocked FROM blocks WHERE (blocker = $uid AND blocked IN ($in)) OR (blocked = $uid AND blocker IN ($in))")->fetchAll() as $b) $blocked[(int) $b['blocker'] === $uid ? (int) $b['blocked'] : (int) $b['blocker']] = true; } catch (Throwable $e) {}
        return array_values(array_filter($ids, fn($i) => !isset($blocked[$i])));
    }

    private function shape(array $s, ?array $views = null): array
    {
        return ['id' => (int) $s['id'], 'kind' => $s['kind'], 'body' => $s['body'], 'bg' => $s['bg'],
            'image' => $s['upload_id'] ? '/api/uploads/' . (int) $s['upload_id'] : null, 'at' => $s['created_at'], 'expiresAt' => $s['expires_at']]
            + ($views !== null ? $views : []);
    }

    /** GET /statuses : your own (with view counts) and your friends' (unseen first). */
    public function index(): void
    {
        $u = Auth::require(); $now = Db::now(); $uid = (int) $u['id'];
        $mine = Db::pdo()->prepare('SELECT s.*, (SELECT COUNT(*) FROM status_views v WHERE v.status_id = s.id) AS views FROM statuses s WHERE s.user_id = ? AND s.deleted_at IS NULL AND s.expires_at > ? ORDER BY s.id ASC');
        $mine->execute([$uid, $now]);
        $mineOut = array_map(fn($s) => $this->shape($s, ['views' => (int) $s['views']]), $mine->fetchAll());
        $friends = [];
        $ids = self::friendIds($uid);
        if ($ids) {
            $st = Db::pdo()->prepare('SELECT s.*, u.name, (SELECT 1 FROM status_views v WHERE v.status_id = s.id AND v.viewer_id = ?) AS seen FROM statuses s JOIN users u ON u.id = s.user_id
                                      WHERE s.user_id IN (' . implode(',', $ids) . ') AND s.deleted_at IS NULL AND s.expires_at > ? AND u.deleted_at IS NULL ORDER BY s.id ASC');
            $st->execute([$uid, $now]);
            foreach ($st->fetchAll() as $s) {
                $k = (int) $s['user_id'];
                if (!isset($friends[$k])) $friends[$k] = ['user' => ['id' => $k, 'name' => explode(' ', trim((string) $s['name']))[0], 'avatar' => Auth::picture($k)], 'items' => [], 'unseen' => 0, 'last' => ''];
                $friends[$k]['items'][] = $this->shape($s, ['seen' => (bool) $s['seen']]);
                if (!$s['seen']) $friends[$k]['unseen']++;
                $friends[$k]['last'] = $s['created_at'];
            }
        }
        $friends = array_values($friends);
        usort($friends, fn($a, $b) => [($b['unseen'] > 0), $b['last']] <=> [($a['unseen'] > 0), $a['last']]);   // new ones first, then most recent
        Http::json(['me' => ['id' => $uid, 'name' => explode(' ', trim((string) $u['name']))[0], 'avatar' => Auth::picture($uid)], 'mine' => $mineOut, 'friends' => $friends, 'hasFriends' => count($ids) > 0]);
    }

    /** POST /statuses { kind: text|image, body, bg, uploadId } */
    public function create(): void
    {
        $u = Auth::require(); RateLimit::hit('status', 30, 86400); $b = Http::body();
        $kind = ($b['kind'] ?? 'text') === 'image' ? 'image' : 'text';
        $body = trim((string) ($b['body'] ?? ''));
        if (mb_strlen($body) > 700) Http::json(['error' => 'validation', 'fields' => ['body' => 'Up to 700 characters.']], 422);
        $upload = null;
        if ($kind === 'image') {
            $upload = UploadsController::claim(isset($b['uploadId']) ? (int) $b['uploadId'] : null, $u);
            if (!$upload) Http::json(['error' => 'validation', 'message' => 'Choose a photo.'], 422);
            $f = Db::one('SELECT kind FROM uploads WHERE id = ?', [$upload]);
            if (!$f || $f['kind'] !== 'image') Http::json(['error' => 'validation', 'message' => 'A status photo must be a picture.'], 422);
        } elseif ($body === '') Http::json(['error' => 'validation', 'fields' => ['body' => 'Write something first.']], 422);
        $bg = in_array($b['bg'] ?? '', self::BGS, true) ? $b['bg'] : self::BGS[0];
        Db::run('INSERT INTO statuses (user_id, kind, body, bg, upload_id, created_at, expires_at) VALUES (?,?,?,?,?,?,?)',
            [$u['id'], $kind, $body !== '' ? $body : null, $bg, $upload, Db::now(), gmdate('Y-m-d H:i:s', time() + self::HOURS * 3600)]);
        $id = (int) Db::lastId();
        Track::hit($u, 'status', $kind);
        Http::json(['status' => $this->shape(Db::one('SELECT * FROM statuses WHERE id = ?', [$id]), ['views' => 0])], 201);
    }

    /** POST /statuses/{id}/view : you opened a friend's status. */
    public function view(int $id): void
    {
        $u = Auth::require();
        $s = Db::one('SELECT * FROM statuses WHERE id = ? AND deleted_at IS NULL AND expires_at > ?', [$id, Db::now()]);
        if (!$s) Http::json(['error' => 'not_found', 'message' => 'That status has gone.'], 404);
        if ((int) $s['user_id'] === (int) $u['id']) Http::json(['ok' => true]);
        if (!in_array((int) $s['user_id'], self::friendIds((int) $u['id']), true)) Http::json(['error' => 'forbidden'], 403);
        if (!Db::one('SELECT 1 AS x FROM status_views WHERE status_id = ? AND viewer_id = ?', [$id, $u['id']]))
            Db::run('INSERT INTO status_views (status_id, viewer_id, viewed_at) VALUES (?,?,?)', [$id, $u['id'], Db::now()]);
        Http::json(['ok' => true]);
    }

    /** GET /statuses/{id}/viewers : who saw one of your statuses, most recent first. Yours only. */
    public function viewers(int $id): void
    {
        $u = Auth::require();
        $s = Db::one('SELECT * FROM statuses WHERE id = ? AND user_id = ?', [$id, $u['id']]);
        if (!$s) Http::json(['error' => 'not_found'], 404);
        $st = Db::pdo()->prepare('SELECT v.viewed_at, u.id, u.name FROM status_views v JOIN users u ON u.id = v.viewer_id WHERE v.status_id = ? AND u.deleted_at IS NULL ORDER BY v.viewed_at DESC');
        $st->execute([$id]);
        Http::json(['viewers' => array_map(fn($r) => ['id' => (int) $r['id'], 'name' => $r['name'], 'avatar' => Auth::picture((int) $r['id']), 'at' => $r['viewed_at']], $st->fetchAll())]);
    }

    /** DELETE /statuses/{id} */
    public function destroy(int $id): void
    {
        $u = Auth::require();
        Db::run('UPDATE statuses SET deleted_at = ? WHERE id = ? AND user_id = ?', [Db::now(), $id, $u['id']]);
        Http::json(['ok' => true]);
    }
}

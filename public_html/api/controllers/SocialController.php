<?php
declare(strict_types=1);

final class SocialController
{
    public const BOARDS = ['general' => 'General', 'ask' => 'Ask Abuja', 'traffic' => 'Traffic & roads', 'power' => 'Power & water', 'events' => 'What\'s on', 'market' => 'Recommendations', 'housing' => 'Housing talk', 'jobs' => 'Work talk', 'banter' => 'Banter'];

    private function author(int $id): array
    {
        $u = Db::one('SELECT id, name, district, selfie_verified_at, plus_until FROM users WHERE id = ?', [$id]);
        if (!$u) return ['id' => 0, 'name' => 'Someone', 'district' => null, 'verified' => false, 'plus' => false, 'avatar' => null];
        return ['id' => (int) $u['id'], 'name' => explode(' ', trim($u['name']))[0] . ' ' . mb_substr(explode(' ', trim($u['name']))[1] ?? '', 0, 1) . (isset(explode(' ', trim($u['name']))[1]) ? '.' : ''), 'district' => $u['district'], 'verified' => !empty($u['selfie_verified_at']), 'plus' => !empty($u['plus_until']) && $u['plus_until'] > Db::now(), 'avatar' => Db::one('SELECT 1 AS x FROM avatars WHERE user_id = ?', [$id]) ? '/api/avatar/' . $id : null];
    }

    /** Every photo on a post or a reply, in order. Posts made before Phase 26 had one, and it still shows. */
    public static function images(?int $postId, ?int $replyId): array
    {
        $st = Db::pdo()->prepare('SELECT upload_id FROM social_images WHERE ' . ($postId ? 'post_id = ?' : 'reply_id = ?') . ' ORDER BY position, id LIMIT 8');
        $st->execute([$postId ?: $replyId]);
        return array_map(fn($r) => '/api/uploads/' . (int) $r['upload_id'], $st->fetchAll());
    }
    /** Stores up to six uploads against a new post or reply. */
    private function saveImages(array $ids, array $u, ?int $postId, ?int $replyId): int
    {
        $n = 0;
        foreach (array_slice(array_values(array_unique(array_map('intval', $ids))), 0, 6) as $i => $uid) {
            $claimed = UploadsController::claim($uid, $u); if (!$claimed) continue;
            Db::run('INSERT INTO social_images (post_id, reply_id, upload_id, position, created_at) VALUES (?,?,?,?,?)', [$postId, $replyId, $claimed, $i, Db::now()]);
            $n++;
        }
        return $n;
    }

    private function shape(array $p, ?array $u): array
    {
        return ['images' => self::images((int) $p['id'], null), 'id' => (int) $p['id'], 'board' => $p['board'], 'boardLabel' => self::BOARDS[$p['board']] ?? $p['board'], 'title' => $p['title'], 'body' => $p['body'], 'district' => $p['district'], 'replies' => (int) $p['replies'], 'likes' => (int) $p['likes'], 'views' => (int) $p['views'], 'pinned' => (bool) $p['pinned'], 'at' => $p['created_at'], 'lastAt' => $p['last_activity_at'], 'author' => $this->author((int) $p['user_id']), 'attachment' => UploadsController::shape($p['upload_id'] ? (int) $p['upload_id'] : null),
            'liked' => $u ? Db::one("SELECT 1 AS x FROM social_likes WHERE user_id = ? AND kind = 'post' AND target_id = ?", [$u['id'], $p['id']]) !== null : false,
            'mine' => $u ? (int) $p['user_id'] === (int) $u['id'] : false];
    }

    /** GET /social?board=&sort=latest|top&district=mine */
    public function index(): void
    {
        $u = Auth::require();
        $where = ['hidden_at IS NULL']; $p = [];
        $board = (string) ($_GET['board'] ?? ''); if (isset(self::BOARDS[$board])) { $where[] = 'board = ?'; $p[] = $board; }
        if (($_GET['district'] ?? '') === 'mine' && $u['district']) { $where[] = 'district = ?'; $p[] = $u['district']; }
        $q = trim((string) ($_GET['q'] ?? '')); if ($q !== '') { $where[] = '(title LIKE ? OR body LIKE ?)'; array_push($p, "%$q%", "%$q%"); }
        $order = ($_GET['sort'] ?? '') === 'top' ? 'likes DESC, replies DESC' : 'last_activity_at DESC';
        $st = Db::pdo()->prepare('SELECT * FROM social_posts WHERE ' . implode(' AND ', $where) . ' ORDER BY pinned DESC, ' . $order . ' LIMIT 40'); $st->execute($p);
        Http::json(['posts' => array_map(fn($r) => $this->shape($r, $u), $st->fetchAll()), 'boards' => self::BOARDS]);
    }

    /** GET /social/{id} */
    public function show(int $id): void
    {
        $u = Auth::require();
        $p = Db::one('SELECT * FROM social_posts WHERE id = ? AND hidden_at IS NULL', [$id]); if (!$p) Http::json(['error' => 'not_found', 'message' => 'That post is gone.'], 404);
        if ((int) $p['user_id'] !== (int) $u['id']) Db::run('UPDATE social_posts SET views = views + 1 WHERE id = ?', [$id]);
        $st = Db::pdo()->prepare('SELECT * FROM social_replies WHERE post_id = ? AND hidden_at IS NULL ORDER BY id ASC LIMIT 200'); $st->execute([$id]);
        $replies = array_map(fn($r) => ['id' => (int) $r['id'], 'body' => $r['body'], 'likes' => (int) $r['likes'], 'at' => $r['created_at'], 'images' => self::images(null, (int) $r['id']), 'attachment' => UploadsController::shape($r['upload_id'] ? (int) $r['upload_id'] : null), 'author' => $this->author((int) $r['user_id']), 'mine' => (int) $r['user_id'] === (int) $u['id'], 'liked' => Db::one("SELECT 1 AS x FROM social_likes WHERE user_id = ? AND kind = 'reply' AND target_id = ?", [$u['id'], $r['id']]) !== null], $st->fetchAll());
        Http::json(['post' => $this->shape($p, $u), 'replies' => $replies]);
    }

    /** POST /social { board, title, body, district } */
    public function create(): void
    {
        $u = Auth::require(); RateLimit::hit('post', 20, 3600);
        $b = Http::body(); $e = [];
        $board = isset(self::BOARDS[$b['board'] ?? '']) ? $b['board'] : null; if (!$board) $e['board'] = 'Choose a board.';
        $title = mb_substr(trim((string) ($b['title'] ?? '')), 0, 140); if (mb_strlen($title) < 5) $e['title'] = 'Give it a clear title.';
        $body = mb_substr(trim((string) ($b['body'] ?? '')), 0, 4000); if (mb_strlen($body) < 10) $e['body'] = 'Say a bit more.';
        if ($e) Http::json(['error' => 'validation', 'fields' => $e], 422);
        $district = !empty($b['district']) ? mb_substr((string) $b['district'], 0, 60) : null;
        $upload = UploadsController::claim(isset($b['uploadId']) ? (int) $b['uploadId'] : null, $u);
        Db::run('INSERT INTO social_posts (user_id, board, title, body, district, upload_id, last_activity_at, created_at) VALUES (?,?,?,?,?,?,?,?)', [$u['id'], $board, $title, $body, $district, $upload, Db::now(), Db::now()]);
        $id = (int) Db::lastId(); // read the id before Track::hit inserts its own row
        if ($upload) Db::run('INSERT INTO social_images (post_id, upload_id, position, created_at) VALUES (?,?,?,?)', [$id, $upload, 0, Db::now()]);
        $this->saveImages((array) ($b['uploadIds'] ?? []), $u, $id, null);
        Track::hit($u, 'social', 'post');
        Http::json(['post' => $this->shape(Db::one('SELECT * FROM social_posts WHERE id = ?', [$id]), $u)], 201);
    }

    /** POST /social/{id}/reply { body } */
    public function reply(int $id): void
    {
        $u = Auth::require(); RateLimit::hit('reply', 80, 3600);
        $p = Db::one('SELECT * FROM social_posts WHERE id = ? AND hidden_at IS NULL', [$id]); if (!$p) Http::json(['error' => 'not_found'], 404);
        $rb = Http::body(); $body = mb_substr(trim((string) ($rb['body'] ?? '')), 0, 2000);
        $upload = UploadsController::claim(isset($rb['uploadId']) ? (int) $rb['uploadId'] : null, $u);
        if (mb_strlen($body) < 2 && !$upload) Http::json(['error' => 'validation', 'fields' => ['body' => 'Write a reply or attach something.']], 422);
        Db::run('INSERT INTO social_replies (post_id, user_id, body, upload_id, created_at) VALUES (?,?,?,?,?)', [$id, $u['id'], $body ?: '', $upload, Db::now()]);
        $rid = (int) Db::lastId();
        if ($upload) Db::run('INSERT INTO social_images (reply_id, upload_id, position, created_at) VALUES (?,?,?,?)', [$rid, $upload, 0, Db::now()]);
        $this->saveImages((array) ($rb['uploadIds'] ?? []), $u, null, $rid);
        Db::run('UPDATE social_posts SET replies = replies + 1, last_activity_at = ? WHERE id = ?', [Db::now(), $id]);
        Track::hit($u, 'social', 'reply');
        if ((int) $p['user_id'] !== (int) $u['id']) Notify::user((int) $p['user_id'], 'social', explode(' ', $u['name'])[0] . ' replied to your post', mb_substr($body, 0, 120), '/#/social/' . $id);
        $this->show($id);
    }

    public function likePost(int $id): void { $this->like('post', $id); }
    public function likeReply(int $id): void { $this->like('reply', $id); }

    /** Toggles a like on a post or a reply. */
    private function like(string $kind, int $id): void
    {
        $u = Auth::require();
        $table = $kind === 'post' ? 'social_posts' : 'social_replies';
        if (!Db::one("SELECT id FROM $table WHERE id = ?", [$id])) Http::json(['error' => 'not_found'], 404);
        $has = Db::one('SELECT 1 AS x FROM social_likes WHERE user_id = ? AND kind = ? AND target_id = ?', [$u['id'], $kind, $id]);
        if ($has) { Db::run('DELETE FROM social_likes WHERE user_id = ? AND kind = ? AND target_id = ?', [$u['id'], $kind, $id]); Db::run("UPDATE $table SET likes = CASE WHEN likes > 0 THEN likes - 1 ELSE 0 END WHERE id = ?", [$id]); }
        else { Db::run('INSERT INTO social_likes (user_id, kind, target_id, created_at) VALUES (?,?,?,?)', [$u['id'], $kind, $id, Db::now()]); Db::run("UPDATE $table SET likes = likes + 1 WHERE id = ?", [$id]); }
        Http::json(['liked' => !$has, 'likes' => (int) (Db::one("SELECT likes FROM $table WHERE id = ?", [$id])['likes'] ?? 0)]);
    }

    /** DELETE /social/{id} : author, moderator or admin */
    public function remove(int $id): void
    {
        $u = Auth::require(); $p = Db::one('SELECT * FROM social_posts WHERE id = ?', [$id]); if (!$p) Http::json(['error' => 'not_found'], 404);
        $staff = in_array($u['role'] ?? '', ['admin', 'moderator'], true) || !empty($u['is_admin']);
        if ((int) $p['user_id'] !== (int) $u['id'] && !$staff) Http::json(['error' => 'forbidden'], 403);
        Db::run('UPDATE social_posts SET hidden_at = ? WHERE id = ?', [Db::now(), $id]);
        Http::json(['ok' => true]);
    }

    /** GET /admin/social : the newest posts with what moderators need, and the ones people reported */
    public function adminIndex(): void
    {
        $u = Auth::require(); if (empty($u['is_admin']) && !in_array($u['role'] ?? '', ['admin', 'moderator'], true)) Http::json(['error' => 'forbidden'], 403);
        $q = trim((string) ($_GET['q'] ?? '')); $only = (string) ($_GET['filter'] ?? '');
        $where = ['1=1']; $p = [];
        if ($q !== '') { $where[] = '(p.title LIKE ? OR p.body LIKE ?)'; $p[] = "%$q%"; $p[] = "%$q%"; }
        if ($only === 'hidden') $where[] = 'p.hidden_at IS NOT NULL';
        if ($only === 'live') $where[] = 'p.hidden_at IS NULL';
        $st = Db::pdo()->prepare('SELECT p.*, u.name FROM social_posts p JOIN users u ON u.id = p.user_id WHERE ' . implode(' AND ', $where) . ' ORDER BY p.id DESC LIMIT 80');
        $st->execute($p);
        Http::json(['posts' => array_map(fn($r) => ['id' => (int) $r['id'], 'title' => $r['title'], 'body' => mb_substr((string) $r['body'], 0, 240), 'board' => self::BOARDS[$r['board']] ?? $r['board'],
            'author' => ['id' => (int) $r['user_id'], 'name' => $r['name']], 'images' => self::images((int) $r['id'], null), 'replies' => (int) $r['replies'], 'likes' => (int) $r['likes'], 'views' => (int) $r['views'],
            'pinned' => !empty($r['pinned']), 'hidden' => $r['hidden_at'] !== null, 'at' => $r['created_at']], $st->fetchAll()),
            'counts' => ['live' => (int) (Db::one('SELECT COUNT(*) AS n FROM social_posts WHERE hidden_at IS NULL')['n'] ?? 0), 'hidden' => (int) (Db::one('SELECT COUNT(*) AS n FROM social_posts WHERE hidden_at IS NOT NULL')['n'] ?? 0),
                'today' => (int) (Db::one('SELECT COUNT(*) AS n FROM social_posts WHERE created_at > ?', [gmdate('Y-m-d H:i:s', time() - 86400)])['n'] ?? 0)]]);
    }

    /** POST /admin/social/{id}/{action} : hide, show, pin, unpin */
    public function adminAct(int $id, string $action): void
    {
        $u = Auth::require(); if (empty($u['is_admin']) && !in_array($u['role'] ?? '', ['admin', 'moderator'], true)) Http::json(['error' => 'forbidden'], 403);
        $p = Db::one('SELECT * FROM social_posts WHERE id = ?', [$id]); if (!$p) Http::json(['error' => 'not_found'], 404);
        match ($action) {
            'hide' => Db::run('UPDATE social_posts SET hidden_at = ? WHERE id = ?', [Db::now(), $id]),
            'show' => Db::run('UPDATE social_posts SET hidden_at = NULL WHERE id = ?', [$id]),
            'pin' => Db::run('UPDATE social_posts SET pinned = 1 WHERE id = ?', [$id]),
            'unpin' => Db::run('UPDATE social_posts SET pinned = 0 WHERE id = ?', [$id]),
            default => Http::json(['error' => 'not_found'], 404),
        };
        if ($action === 'hide' && (int) $p['user_id'] !== (int) $u['id']) Notify::user((int) $p['user_id'], 'social', 'Your post was taken down', mb_substr((string) $p['title'], 0, 80) . '. It broke Buja\'s rules. Reply to this to ask why.', '/#/social');
        Http::json(['ok' => true]);
    }
}

<?php
declare(strict_types=1);

/**
 * Friends. A request goes one way (user_id -> friend_id) and becomes a friendship when accepted. Blocks win: nobody can
 * send or receive a request across a block. Only names, tags, photos and districts are ever shown, never contacts.
 */
final class FriendsController
{
    private static function blocked(int $a, int $b): bool
    {
        return (bool) Db::one('SELECT 1 AS x FROM blocks WHERE (blocker = ? AND blocked = ?) OR (blocker = ? AND blocked = ?)', [$a, $b, $b, $a]);
    }
    private static function card(array $u, string $state, array $extra = []): array
    {
        return array_merge(['id' => (int) $u['id'], 'name' => explode(' ', trim((string) $u['name']))[0], 'fullName' => $u['name'], 'tag' => $u['tag'] ?: Tag::ensure((int) $u['id']),
            'avatar' => Auth::picture((int) $u['id']), 'district' => $u['district'] ?? null, 'state' => $state], $extra);
    }
    /** How two people are connected: none, sent, received, friends */
    public static function state(int $me, int $other): string
    {
        $r = Db::one('SELECT user_id, status FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)', [$me, $other, $other, $me]);
        if (!$r) return 'none';
        if ($r['status'] === 'accepted') return 'friends';
        return (int) $r['user_id'] === $me ? 'sent' : 'received';
    }
    public static function friendIds(int $me): array
    {
        $st = Db::pdo()->prepare("SELECT CASE WHEN user_id = ? THEN friend_id ELSE user_id END AS f FROM friendships WHERE (user_id = ? OR friend_id = ?) AND status = 'accepted'");
        $st->execute([$me, $me, $me]); return array_map('intval', array_column($st->fetchAll(), 'f'));
    }

    /** GET /friends : my friends, requests to me, requests I sent, and people I may know */
    public function index(): void
    {
        $u = Auth::require(); $me = (int) $u['id'];
        $friends = []; foreach (self::friendIds($me) as $fid) { $f = Db::one('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL', [$fid]); if ($f) $friends[] = self::card($f, 'friends', ['online' => $f['last_seen_at'] && strtotime($f['last_seen_at'] . ' UTC') > time() - 600]); }
        usort($friends, fn($a, $b) => ($b['online'] <=> $a['online']) ?: strcmp($a['name'], $b['name']));
        $in = Db::pdo()->prepare("SELECT u.*, f.created_at AS at FROM friendships f JOIN users u ON u.id = f.user_id WHERE f.friend_id = ? AND f.status = 'pending' AND u.deleted_at IS NULL ORDER BY f.created_at DESC"); $in->execute([$me]);
        $out = Db::pdo()->prepare("SELECT u.* FROM friendships f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ? AND f.status = 'pending' AND u.deleted_at IS NULL ORDER BY f.created_at DESC"); $out->execute([$me]);
        Http::json(['friends' => $friends, 'requests' => array_map(fn($r) => self::card($r, 'received'), $in->fetchAll()),
            'sent' => array_map(fn($r) => self::card($r, 'sent'), $out->fetchAll()), 'suggestions' => $this->suggest($u)]);
    }

    /** People you may know: friends of friends, people you raced, people in your district. Never someone blocked. */
    private function suggest(array $u): array
    {
        $me = (int) $u['id']; $mine = self::friendIds($me); $score = [];
        foreach ($mine as $fid) foreach (self::friendIds($fid) as $ff) if ($ff !== $me && !in_array($ff, $mine, true)) $score[$ff] = ($score[$ff] ?? 0) + 5;
        $st = Db::pdo()->prepare('SELECT DISTINCT p2.user_id FROM kart_players p1 JOIN kart_players p2 ON p2.room_id = p1.room_id AND p2.user_id <> p1.user_id WHERE p1.user_id = ? LIMIT 40'); $st->execute([$me]);
        foreach ($st->fetchAll() as $r) $score[(int) $r['user_id']] = ($score[(int) $r['user_id']] ?? 0) + 4;
        if (!empty($u['district'])) { $st = Db::pdo()->prepare('SELECT id FROM users WHERE district = ? AND id <> ? AND deleted_at IS NULL ORDER BY last_seen_at DESC LIMIT 30'); $st->execute([$u['district'], $me]); foreach ($st->fetchAll() as $r) $score[(int) $r['id']] = ($score[(int) $r['id']] ?? 0) + 1; }
        arsort($score); $out = [];
        foreach (array_keys($score) as $id) {
            if (count($out) >= 12) break;
            if (in_array($id, $mine, true) || self::blocked($me, $id) || self::state($me, $id) !== 'none') continue;
            $p = Db::one('SELECT * FROM users WHERE id = ? AND deleted_at IS NULL', [$id]); if (!$p) continue;
            $mutual = count(array_intersect($mine, self::friendIds($id)));
            $out[] = self::card($p, 'none', ['why' => $mutual ? $mutual . ' mutual friend' . ($mutual > 1 ? 's' : '') : (($p['district'] ?? '') === ($u['district'] ?? '-') ? 'Also in ' . $p['district'] : 'Raced with you')]);
        }
        return $out;
    }

    /** POST /friends { userId | tag } : send a request, or accept theirs if they already asked */
    public function add(): void
    {
        $u = Auth::require(); RateLimit::hit('friendadd', 60, 86400); $me = (int) $u['id']; $b = Http::body();
        $other = isset($b['userId']) ? (int) $b['userId'] : 0;
        if (!$other && !empty($b['tag'])) { $r = Db::one('SELECT id FROM users WHERE tag = ? AND deleted_at IS NULL', [Tag::clean((string) $b['tag'])]); $other = $r ? (int) $r['id'] : 0; }
        if (!$other || !Db::one('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL', [$other])) Http::json(['error' => 'not_found', 'message' => 'Could not find that person.'], 404);
        if ($other === $me) Http::json(['error' => 'validation', 'message' => 'That is you.'], 422);
        if (self::blocked($me, $other)) Http::json(['error' => 'forbidden', 'message' => 'You cannot add this person.'], 403);
        $state = self::state($me, $other);
        if ($state === 'friends' || $state === 'sent') Http::json(['state' => $state]);
        if ($state === 'received') { $this->accept($other, $u); Http::json(['state' => 'friends']); }
        Db::run('INSERT INTO friendships (user_id, friend_id, status, created_at) VALUES (?,?,?,?)', [$me, $other, 'pending', Db::now()]);
        Notify::user($other, 'social', explode(' ', trim($u['name']))[0] . ' wants to be friends', 'Tap to see their request.', '/#/friends', true);
        Http::json(['state' => 'sent'], 201);
    }
    private function accept(int $from, array $u): void
    {
        Db::run("UPDATE friendships SET status = 'accepted', accepted_at = ? WHERE user_id = ? AND friend_id = ? AND status = 'pending'", [Db::now(), $from, $u['id']]);
        Notify::user($from, 'social', explode(' ', trim($u['name']))[0] . ' accepted your friend request', 'Race them in Buja Kart or say hi.', '/#/friends', true);
    }
    /** POST /friends/{id}/{action} : accept | decline | remove | cancel */
    public function act(int $id, string $action): void
    {
        $u = Auth::require(); $me = (int) $u['id'];
        if ($action === 'accept') { if (self::state($me, $id) !== 'received') Http::json(['error' => 'validation', 'message' => 'No request from them.'], 422); $this->accept($id, $u); Http::json(['state' => 'friends']); }
        if ($action === 'decline') { Db::run("DELETE FROM friendships WHERE user_id = ? AND friend_id = ? AND status = 'pending'", [$id, $me]); Http::json(['state' => 'none']); }
        if ($action === 'cancel') { Db::run("DELETE FROM friendships WHERE user_id = ? AND friend_id = ? AND status = 'pending'", [$me, $id]); Http::json(['state' => 'none']); }
        if ($action === 'chat') {
            // friends can message and call each other inside Buja: one chat per pair, reused every time
            if (self::state($me, $id) !== 'friends') Http::json(['error' => 'forbidden', 'message' => 'Add them as a friend first. When they accept, you can message and call.'], 403);
            if (self::blocked($me, $id)) Http::json(['error' => 'forbidden', 'message' => 'You cannot message this person.'], 403);
            $a = min($me, $id); $b = max($me, $id);
            $t = Db::one("SELECT id FROM threads WHERE kind IN ('friend','artisan','city') AND user_a = ? AND user_b = ? ORDER BY (kind = 'friend') DESC, id DESC LIMIT 1", [$a, $b]);
            if (!$t) {
                try { Db::run("INSERT INTO threads (kind, user_a, user_b, last_message_at, created_at) VALUES ('friend', ?, ?, ?, ?)", [$a, $b, Db::now(), Db::now()]); }
                catch (Throwable $e) { Db::run("INSERT INTO threads (kind, user_a, user_b, last_message_at, created_at) VALUES ('artisan', ?, ?, ?, ?)", [$a, $b, Db::now(), Db::now()]); }   // before migration 041
                $t = ['id' => Db::lastId()];
            }
            Http::json(['threadId' => (int) $t['id']]);
        }
        if ($action === 'remove') { Db::run('DELETE FROM friendships WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)', [$me, $id, $id, $me]); Http::json(['state' => 'none']); }
        Http::json(['error' => 'not_found'], 404);
    }
}

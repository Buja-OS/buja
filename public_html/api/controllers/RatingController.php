<?php
declare(strict_types=1);

/**
 * Ratings for people. You can only rate somebody you actually dealt with, once per conversation, and only
 * after both of you have said something. That keeps it honest: no rating a stranger you never met.
 */
final class RatingController
{
    public const TAGS = [
        'homes' => ['Showed up on time', 'Property as described', 'No hidden fees', 'Answered questions', 'Late or no-show', 'Not as described', 'Asked for money upfront'],
        'declutter' => ['Item as described', 'Fair on price', 'On time', 'Easy to deal with', 'Item not as described', 'Did not turn up', 'Changed the price'],
        'work' => ['Clear about the role', 'Interview happened', 'Replied quickly', 'Never replied', 'Interview cancelled', 'Asked for money'],
        'match' => ['Photos were real', 'Respectful', 'Met in public', 'Photos were not real', 'Pushy', 'Did not turn up'],
    ];
    private const GOOD = ['Showed up on time', 'Property as described', 'No hidden fees', 'Answered questions', 'Item as described', 'Fair on price', 'On time', 'Easy to deal with', 'Clear about the role', 'Interview happened', 'Replied quickly', 'Photos were real', 'Respectful', 'Met in public'];

    /** The public summary of how somebody deals with people. */
    public static function summary(int $userId): array
    {
        $agg = Db::one('SELECT COUNT(*) AS n, ROUND(AVG(stars), 1) AS avg FROM user_ratings WHERE rated = ? AND hidden_at IS NULL', [$userId]);
        $n = (int) ($agg['n'] ?? 0);
        if ($n === 0) return ['count' => 0, 'stars' => null, 'top' => []];
        $st = Db::pdo()->prepare('SELECT tags FROM user_ratings WHERE rated = ? AND hidden_at IS NULL ORDER BY id DESC LIMIT 40');
        $st->execute([$userId]);
        $tally = [];
        foreach ($st->fetchAll() as $r) foreach (json_decode($r['tags'] ?? '[]', true) ?: [] as $t) $tally[$t] = ($tally[$t] ?? 0) + 1;
        arsort($tally);
        return ['count' => $n, 'stars' => (float) $agg['avg'], 'top' => array_slice(array_keys($tally), 0, 3)];
    }

    /** GET /users/{id}/ratings */
    public function show(int $id): void
    {
        Auth::require();
        $st = Db::pdo()->prepare('SELECT r.*, u.name FROM user_ratings r JOIN users u ON u.id = r.rater WHERE r.rated = ? AND r.hidden_at IS NULL ORDER BY r.id DESC LIMIT 30');
        $st->execute([$id]);
        $who = Db::one('SELECT name FROM users WHERE id = ?', [$id]);
        Http::json(['summary' => self::summary($id), 'name' => explode(' ', trim((string) ($who['name'] ?? 'Someone')))[0],
            'ratings' => array_map(fn($r) => ['stars' => (int) $r['stars'], 'tags' => json_decode($r['tags'] ?? '[]', true) ?: [], 'comment' => $r['comment'],
                'by' => explode(' ', trim((string) $r['name']))[0], 'module' => $r['module'], 'at' => substr((string) $r['created_at'], 0, 10)], $st->fetchAll())]);
    }

    /** GET /threads/{id}/rating : can I rate this person, and have I already? */
    public function status(int $id): void
    {
        $u = Auth::require();
        $t = Db::one('SELECT * FROM threads WHERE id = ? AND (user_a = ? OR user_b = ?)', [$id, $u['id'], $u['id']]); if (!$t) Http::json(['error' => 'not_found'], 404);
        $other = (int) $t['user_a'] === (int) $u['id'] ? (int) $t['user_b'] : (int) $t['user_a'];
        $mine = Db::one('SELECT stars FROM user_ratings WHERE thread_id = ? AND rater = ?', [$id, $u['id']]);
        $bothSpoke = (int) (Db::one('SELECT COUNT(DISTINCT sender_id) AS n FROM messages WHERE thread_id = ?', [$id])['n'] ?? 0) >= 2;
        $o = Db::one('SELECT name FROM users WHERE id = ?', [$other]);
        Http::json(['canRate' => $bothSpoke && !$mine, 'rated' => $mine ? (int) $mine['stars'] : null, 'module' => $t['kind'],
            'tags' => self::TAGS[$t['kind']] ?? self::TAGS['declutter'], 'other' => ['id' => $other, 'name' => explode(' ', trim((string) ($o['name'] ?? 'Someone')))[0]],
            'summary' => self::summary($other)]);
    }

    /** POST /threads/{id}/rate { stars, tags, comment } */
    public function create(int $id): void
    {
        $u = Auth::require(); RateLimit::hit('rate', 30, 86400);
        $t = Db::one('SELECT * FROM threads WHERE id = ? AND (user_a = ? OR user_b = ?)', [$id, $u['id'], $u['id']]); if (!$t) Http::json(['error' => 'not_found'], 404);
        if (Db::one('SELECT id FROM user_ratings WHERE thread_id = ? AND rater = ?', [$id, $u['id']])) Http::json(['error' => 'done', 'message' => 'You have already rated this one.'], 409);
        if ((int) (Db::one('SELECT COUNT(DISTINCT sender_id) AS n FROM messages WHERE thread_id = ?', [$id])['n'] ?? 0) < 2) Http::json(['error' => 'validation', 'message' => 'You can rate someone once you have both spoken.'], 422);
        $b = Http::body();
        $stars = (int) ($b['stars'] ?? 0); if ($stars < 1 || $stars > 5) Http::json(['error' => 'validation', 'fields' => ['stars' => 'Pick one to five stars.']], 422);
        $allowed = self::TAGS[$t['kind']] ?? self::TAGS['declutter'];
        $tags = array_values(array_intersect((array) ($b['tags'] ?? []), $allowed));
        $other = (int) $t['user_a'] === (int) $u['id'] ? (int) $t['user_b'] : (int) $t['user_a'];
        Db::run('INSERT INTO user_ratings (rater, rated, thread_id, module, stars, tags, comment, created_at) VALUES (?,?,?,?,?,?,?,?)',
            [$u['id'], $other, $id, $t['kind'], $stars, json_encode($tags), mb_substr(trim((string) ($b['comment'] ?? '')), 0, 400) ?: null, Db::now()]);
        Track::hit($u, 'trust', 'rate:' . $t['kind']);
        if ($stars >= 4) Notify::user($other, 'offers', explode(' ', trim((string) $u['name']))[0] . ' rated you ' . $stars . ' stars', $tags ? implode(', ', array_slice($tags, 0, 2)) : 'Thanks for dealing well.', '/#/people/' . $other);
        Http::json(['summary' => self::summary($other)], 201);
    }
}

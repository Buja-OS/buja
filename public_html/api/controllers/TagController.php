<?php
declare(strict_types=1);

final class TagController
{
    /** GET /tag/{tag} : find anyone by their Buja Tag */
    public function find(string $tag): void
    {
        $viewer = Auth::require(); RateLimit::hit('taglookup', 120, 3600);
        $t = Tag::clean($tag);
        $u = $t !== '' ? Db::one('SELECT * FROM users WHERE tag = ? AND deleted_at IS NULL', [$t]) : null;
        if (!$u) {
            // Suggestions for a typo: tags that start the same way
            $st = Db::pdo()->prepare('SELECT * FROM users WHERE tag LIKE ? AND deleted_at IS NULL ORDER BY LENGTH(tag) LIMIT 5'); $st->execute([substr($t, 0, 3) . '%']);
            Http::json(['error' => 'not_found', 'message' => 'Nobody on Buja uses @' . $t . '.', 'suggestions' => array_map(fn($x) => Tag::card($x, $viewer), $st->fetchAll())], 404);
        }
        Http::json(['card' => Tag::card($u, $viewer)]);
    }

    /** GET /tags?q= : tags starting with what was typed, for search-as-you-type */
    public function search(): void
    {
        $viewer = Auth::require();
        $q = Tag::clean((string) ($_GET['q'] ?? '')); if (strlen($q) < 2) Http::json(['cards' => []]);
        $st = Db::pdo()->prepare('SELECT * FROM users WHERE tag LIKE ? AND deleted_at IS NULL ORDER BY (tag = ?) DESC, LENGTH(tag) LIMIT 8'); $st->execute([$q . '%', $q]);
        Http::json(['cards' => array_map(fn($x) => Tag::card($x, $viewer), $st->fetchAll())]);
    }

    /** GET /me/tag : my tag (created if needed), and whether a new one is free: ?try= */
    public function mine(): void
    {
        $u = Auth::require(); $tag = Tag::ensure((int) $u['id']);
        $try = isset($_GET['try']) ? Tag::clean((string) $_GET['try']) : null;
        Http::json(['tag' => $tag, 'link' => rtrim((string) Http::config('app_origin'), '/') . '/#/@' . $tag, 'try' => $try === null ? null : ['tag' => $try, 'problem' => Tag::problem($try, (int) $u['id'])]]);
    }

    /** POST /me/tag { tag } : choose my own. Limited to 3 changes a month so tags stay findable. */
    public function change(): void
    {
        $u = Auth::require(); RateLimit::hit('tagchange', 3, 30 * 86400);
        $t = Tag::clean((string) (Http::body()['tag'] ?? ''));
        if ($p = Tag::problem($t, (int) $u['id'])) Http::json(['error' => 'validation', 'fields' => ['tag' => $p]], 422);
        try { Db::run('UPDATE users SET tag = ? WHERE id = ?', [$t, $u['id']]); } catch (Throwable $e) { Http::json(['error' => 'validation', 'fields' => ['tag' => '@' . $t . ' was just taken.']], 409); }
        Http::json(['tag' => $t]);
    }
}

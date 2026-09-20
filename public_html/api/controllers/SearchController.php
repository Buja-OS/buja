<?php
declare(strict_types=1);

/** One search across the whole of Buja. */
final class SearchController
{
    /** GET /search?q= */
    public function index(): void
    {
        $u = Auth::require();
        $q = trim((string) ($_GET['q'] ?? ''));
        if (mb_strlen($q) < 2) Http::json(['results' => [], 'query' => $q]);
        $like = '%' . $q . '%';
        $out = [];
        $add = function (string $type, array $rows) use (&$out) { foreach ($rows as $r) $out[] = ['type' => $type] + $r; };

        $st = Db::pdo()->prepare("SELECT j.id, j.title, j.district, c.name AS company FROM jobs j JOIN companies c ON c.id = j.company_id WHERE j.status = 'open' AND (j.title LIKE ? OR c.name LIKE ? OR j.description LIKE ?) ORDER BY j.id DESC LIMIT 6");
        $st->execute([$like, $like, $like]);
        $add('job', array_map(fn($r) => ['id' => (int) $r['id'], 'title' => $r['title'], 'sub' => $r['company'] . ' · ' . $r['district'], 'url' => '/work/job/' . (int) $r['id']], $st->fetchAll()));

        $st = Db::pdo()->prepare("SELECT id, title, district, kind, price FROM properties WHERE status = 'available' AND (title LIKE ? OR district LIKE ? OR description LIKE ?) ORDER BY id DESC LIMIT 6");
        $st->execute([$like, $like, $like]);
        $add('home', array_map(fn($r) => ['id' => (int) $r['id'], 'title' => $r['title'], 'sub' => ($r['kind'] === 'rent' ? 'For rent' : 'For sale') . ' · ₦' . number_format((int) $r['price']) . ' · ' . $r['district'], 'url' => '/homes/' . (int) $r['id']], $st->fetchAll()));

        $st = Db::pdo()->prepare("SELECT id, title, district, price FROM listings WHERE status = 'active' AND (title LIKE ? OR description LIKE ? OR category LIKE ?) ORDER BY id DESC LIMIT 6");
        $st->execute([$like, $like, $like]);
        $add('item', array_map(fn($r) => ['id' => (int) $r['id'], 'title' => $r['title'], 'sub' => '₦' . number_format((int) $r['price']) . ' · ' . $r['district'], 'url' => '/declutter/' . (int) $r['id']], $st->fetchAll()));

        $st = Db::pdo()->prepare('SELECT id, name, district, category FROM spots WHERE active = 1 AND (name LIKE ? OR district LIKE ? OR tags LIKE ?) ORDER BY id LIMIT 6');
        $st->execute([$like, $like, $like]);
        $add('place', array_map(fn($r) => ['id' => (int) $r['id'], 'title' => $r['name'], 'sub' => ucfirst($r['category']) . ' · ' . $r['district'], 'url' => '/ask/place/' . (int) $r['id']], $st->fetchAll()));

        $st = Db::pdo()->prepare('SELECT id, title, board, replies FROM social_posts WHERE hidden_at IS NULL AND (title LIKE ? OR body LIKE ?) ORDER BY last_activity_at DESC LIMIT 6');
        $st->execute([$like, $like]);
        $add('post', array_map(fn($r) => ['id' => (int) $r['id'], 'title' => $r['title'], 'sub' => (SocialController::BOARDS[$r['board']] ?? $r['board']) . ' · ' . (int) $r['replies'] . ' replies', 'url' => '/social/' . (int) $r['id']], $st->fetchAll()));

        $st = Db::pdo()->prepare('SELECT id, name, district FROM places WHERE active = 1 AND (name LIKE ? OR district LIKE ?) ORDER BY popularity DESC LIMIT 4');
        $st->execute([$like, $like]);
        $add('stop', array_map(fn($r) => ['id' => (int) $r['id'], 'title' => $r['name'], 'sub' => 'Waka stop · ' . $r['district'], 'url' => '/waka?toq=' . rawurlencode($r['district'])], $st->fetchAll()));

        Track::hit($u, 'search', 'search');
        Http::json(['query' => $q, 'results' => $out]);
    }
}

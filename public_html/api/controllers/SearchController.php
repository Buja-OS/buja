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

        $st = Db::pdo()->prepare("SELECT id, title, district, starts_at FROM meetups WHERE status = 'live' AND hidden_at IS NULL AND starts_at > ? AND (title LIKE ? OR description LIKE ? OR venue LIKE ?) ORDER BY starts_at LIMIT 6");
        $st->execute([gmdate('Y-m-d H:i:s', time() - 3 * 3600), $like, $like, $like]);
        $add('event', array_map(fn($r) => ['id' => (int) $r['id'], 'title' => $r['title'], 'sub' => date('D j M, H:i', strtotime($r['starts_at'] . ' UTC')) . ' · ' . $r['district'], 'url' => '/meetup/' . (int) $r['id']], $st->fetchAll()));

        $tradeIds = array_keys(array_filter(ArtisanController::TRADES, fn($label, $k) => str_contains(mb_strtolower($label), mb_strtolower($q)) || str_contains($k, mb_strtolower($q)), ARRAY_FILTER_USE_BOTH));
        $tin = $tradeIds ? ' OR a.trade IN (' . implode(',', array_fill(0, count($tradeIds), '?')) . ')' : '';
        $st = Db::pdo()->prepare("SELECT a.user_id, a.business, a.trade, a.base_district, u.name FROM artisans a JOIN users u ON u.id = a.user_id WHERE a.available = 1 AND a.hidden_at IS NULL AND (a.business LIKE ? OR a.about LIKE ? OR u.name LIKE ?$tin) LIMIT 6");
        $st->execute(array_merge([$like, $like, $like], $tradeIds));
        $add('artisan', array_map(fn($r) => ['id' => (int) $r['user_id'], 'title' => $r['business'] ?: explode(' ', trim((string) $r['name']))[0], 'sub' => (ArtisanController::TRADES[$r['trade']] ?? $r['trade']) . ' · ' . $r['base_district'], 'url' => '/artisans/' . (int) $r['user_id']], $st->fetchAll()));

        $ql = mb_strtolower($q);
        $ag = array_values(array_filter(CitizenController::AGENCIES, fn($a) => str_contains(mb_strtolower($a['name'] . ' ' . $a['note'] . ' ' . implode(' ', array_map(fn($c) => CitizenController::CATS[$c] ?? $c, $a['cats']))), $ql)));
        $add('agency', array_map(fn($a) => ['id' => $a['id'], 'title' => $a['name'], 'sub' => $a['phones'][0] ?? 'see website', 'url' => '/report?category=' . ($a['cats'][0] ?? '')], array_slice($ag, 0, 4)));

        Track::hit($u, 'search', 'search');
        Http::json(['query' => $q, 'results' => $out]);
    }
}

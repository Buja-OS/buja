<?php
declare(strict_types=1);

final class NotificationsController
{
    /** GET /notifications */
    public function index(): void
    {
        $u = Auth::require();
        $st = Db::pdo()->prepare('SELECT id, category, title, body, url, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 60'); $st->execute([$u['id']]);
        $rows = array_map(fn($r) => ['id' => (int) $r['id'], 'category' => $r['category'], 'title' => $r['title'], 'body' => $r['body'], 'url' => $r['url'], 'read' => $r['read_at'] !== null, 'at' => $r['created_at']], $st->fetchAll());
        Http::json(['notifications' => $rows, 'unread' => count(array_filter($rows, fn($r) => !$r['read']))]);
    }
    /** POST /notifications/read { ids: [] } or { all: true } */
    public function read(): void
    {
        $u = Auth::require(); $b = Http::body();
        if (!empty($b['all'])) Db::run('UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL', [Db::now(), $u['id']]);
        else foreach (array_map('intval', (array) ($b['ids'] ?? [])) as $id) Db::run('UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL', [Db::now(), $id, $u['id']]);
        Http::json(['ok' => true]);
    }
}

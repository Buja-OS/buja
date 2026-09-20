<?php
declare(strict_types=1);

/** One-line activity log for analytics. Never throws; never slows a request noticeably. */
final class Track
{
    public static function hit(?array $u, string $module, string $action): void
    {
        try { Db::run('INSERT INTO events (user_id, module, action, created_at) VALUES (?,?,?,?)', [$u['id'] ?? null, $module, $action, Db::now()]); } catch (Throwable $e) {}
    }
}

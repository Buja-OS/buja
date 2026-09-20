<?php
declare(strict_types=1);

final class HealthController
{
    public function show(): void
    {
        $db = 'ok';
        try { Db::one('SELECT 1'); } catch (Throwable $e) { $db = 'unreachable'; }
        Http::json(['ok' => $db === 'ok', 'app' => 'buja', 'phase' => '9b', 'php' => PHP_VERSION, 'db' => $db, 'time' => Db::now()]);
    }
}

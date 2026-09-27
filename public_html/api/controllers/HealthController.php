<?php
declare(strict_types=1);

final class HealthController
{
    public function show(): void
    {
        $db = 'ok';
        try { Db::one('SELECT 1'); } catch (Throwable $e) { $db = 'unreachable'; }
        Http::json(['ok' => $db === 'ok', 'app' => 'buja', 'phase' => '53', 'googleClientId' => (string) Http::config('google_client_id', ''), 'phoneLogin' => Sms::configured(), 'php' => PHP_VERSION, 'db' => $db, 'time' => Db::now()]);
    }
}

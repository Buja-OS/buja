<?php
declare(strict_types=1);

/** Fixed-window limiter in MySQL. Shared hosting has no Redis, and this is plenty for auth endpoints. */
final class RateLimit
{
    public static function hit(string $bucket, int $max, int $windowSeconds): void
    {
        $key = hash('sha256', $bucket . '|' . Http::ip());
        $window = (int) floor(time() / $windowSeconds);
        $row = Db::one('SELECT hits FROM rate_limits WHERE k = ? AND window_id = ?', [$key, $window]);
        if ($row === null) {
            Db::run('INSERT INTO rate_limits (k, window_id, hits) VALUES (?,?,1)', [$key, $window]);
            return;
        }
        if ((int) $row['hits'] >= $max) {
            Http::json(['error' => 'rate_limited', 'message' => 'Too many attempts. Please wait a few minutes and try again.'], 429);
        }
        Db::run('UPDATE rate_limits SET hits = hits + 1 WHERE k = ? AND window_id = ?', [$key, $window]);
    }
}

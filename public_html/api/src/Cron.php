<?php
declare(strict_types=1);

/**
 * Jobs that run themselves on ordinary traffic. Every open phone polls /today; the first poll after a job is
 * due runs it, bounded so no single request does much work. An external scheduler is still the only cure for
 * a sleeping server, but nothing else depends on one.
 */
final class Cron
{
    private static function stamp(string $k): int { $r = Db::one('SELECT v FROM app_keys WHERE k = ?', [$k]); return $r ? (int) strtotime((string) $r['v'] . ' UTC') : 0; }
    private static function mark(string $k): void { Db::run('DELETE FROM app_keys WHERE k = ?', [$k]); Db::run('INSERT INTO app_keys (k, v) VALUES (?,?)', [$k, Db::now()]); }

    /** Called from /today. Cheap when nothing is due: two small reads. */
    public static function maybe(): void
    {
        try {
            $now = time();
            if (self::stamp('tidy_last') < $now - 3600) { self::mark('tidy_last'); self::tidy(); return; }
            // Digest: Monday mornings Abuja time, five people per poll until everyone due is done.
            $lagos = new DateTime('now', new DateTimeZone('Africa/Lagos'));
            if ((int) $lagos->format('N') === 1 && (int) $lagos->format('G') >= 7 && self::stamp('digest_tick') < $now - 60) { self::mark('digest_tick'); self::digest(5); }
        } catch (Throwable $e) { error_log('[buja cron] ' . $e->getMessage()); }
    }

    public static function tidy(): array
    {
        $done = [];
        $do = function (string $label, string $sql, array $p) use (&$done) { try { $st = Db::pdo()->prepare($sql); $st->execute($p); $done[$label] = $st->rowCount(); } catch (Throwable $e) { $done[$label] = 'skipped'; } };
        $do('call signals older than a day', 'DELETE FROM call_signals WHERE created_at < ?', [gmdate('Y-m-d H:i:s', time() - 86400)]);
        $do('chat calls left ringing', "UPDATE calls SET status = 'missed', ended_at = ? WHERE status = 'ringing' AND starts_at IS NULL AND created_at < ?", [Db::now(), gmdate('Y-m-d H:i:s', time() - 3600)]);
        $do('interviews more than a week past', "UPDATE calls SET ended_at = ? WHERE starts_at IS NOT NULL AND ended_at IS NULL AND starts_at < ?", [Db::now(), gmdate('Y-m-d H:i:s', time() - 7 * 86400)]);
        $do('expired road alerts', 'DELETE FROM waka_alerts WHERE expires_at < ?', [gmdate('Y-m-d H:i:s', time() - 7 * 86400)]);
        $do('unpaid ticket attempts', "DELETE FROM tickets WHERE status = 'pending' AND created_at < ?", [gmdate('Y-m-d H:i:s', time() - 2 * 3600)]);
        $do('old rate-limit counters', 'DELETE FROM rate_limits WHERE window_id < ?', [(int) floor((time() - 86400) / 60)]);
        $do('old analytics events', 'DELETE FROM events WHERE created_at < ?', [gmdate('Y-m-d H:i:s', time() - 120 * 86400)]);
        $do('news older than a month', 'DELETE FROM news_items WHERE published_at < ?', [gmdate('Y-m-d H:i:s', time() - 30 * 86400)]);
        $do('ask log older than 90 days', 'DELETE FROM ask_log WHERE created_at < ?', [gmdate('Y-m-d H:i:s', time() - 90 * 86400)]);
        $do('expired sessions', 'DELETE FROM sessions WHERE expires_at < ?', [Db::now()]);
        try { $st = Db::pdo()->query("SELECT k, v FROM app_keys WHERE k LIKE 'wa:%'"); $n = 0; foreach ($st->fetchAll() as $r) { $j = json_decode((string) $r['v'], true); if (!$j || ($j['t'] ?? 0) < time() - 900) { Db::run('DELETE FROM app_keys WHERE k = ?', [$r['k']]); $n++; } } $done['stale sign-in challenges'] = $n; } catch (Throwable $e) {}
        return $done;
    }

    /** Sends the weekly email to up to $limit people who have not had one this week. Returns how many went. */
    public static function digest(int $limit): array
    {
        $d = new DigestController();
        return $d->runBatch($limit);
    }
}

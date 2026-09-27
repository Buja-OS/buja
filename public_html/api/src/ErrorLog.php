<?php
declare(strict_types=1);

/**
 * Errors worth knowing about, from the server and from people's phones, grouped by where they happen.
 * The same error a thousand times is one row with a count. The first time an error appears (and again if it
 * comes back a day after it was last mailed), the admin gets one email, so a broken screen is noticed the same day.
 */
final class ErrorLog
{
    private static bool $busy = false;

    public static function php(Throwable $e): void
    {
        $where = basename($e->getFile()) . ':' . $e->getLine();
        self::record('php', get_class($e) . ': ' . $e->getMessage(), $where, $e->getTraceAsString());
    }

    /** $source is php or js. Never throws: logging must not become the next error. */
    public static function record(string $source, string $message, string $where, string $sample = '', ?int $userId = null, ?string $path = null): void
    {
        if (self::$busy) return; self::$busy = true;
        try {
            $message = mb_substr(trim(preg_replace('/\s+/', ' ', $message) ?? ''), 0, 480);
            $where = mb_substr(trim($where), 0, 280);
            $path = mb_substr($path ?? ((string) ($_SERVER['REQUEST_METHOD'] ?? '') . ' ' . Http::path()), 0, 190);
            // numbers vary between occurrences of the same fault (ids, line offsets in minified code): group without them
            $sig = sha1($source . '|' . preg_replace('/\d+/', '#', $message) . '|' . preg_replace('/:\d+(:\d+)?$/', '', $where));
            $row = Db::one('SELECT id, count, alerted_at FROM app_errors WHERE sig = ?', [$sig]);
            if ($row) {
                Db::run('UPDATE app_errors SET count = count + 1, last_at = ?, path = ?, resolved_at = NULL WHERE id = ?', [Db::now(), $path, $row['id']]);
                $alert = !$row['alerted_at'] || strtotime($row['alerted_at'] . ' UTC') < time() - 86400;
                $id = (int) $row['id']; $count = (int) $row['count'] + 1;
            } else {
                Db::run('INSERT INTO app_errors (sig, source, message, where_at, path, sample, count, user_id, first_at, last_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
                    [$sig, $source, $message, $where, $path, mb_substr($sample, 0, 3000) ?: null, 1, $userId, Db::now(), Db::now()]);
                $alert = true; $id = (int) Db::lastId(); $count = 1;
            }
            if ($alert) self::alert($id, $source, $message, $where, $path, $count);
        } catch (Throwable $ignored) {
            // the table may not exist yet (migration 045): the server log still has it
        } finally { self::$busy = false; }
    }

    private static function alert(int $id, string $source, string $message, string $where, string $path, int $count): void
    {
        Db::run('UPDATE app_errors SET alerted_at = ? WHERE id = ?', [Db::now(), $id]);
        $to = (string) Http::config('admin_email', '');
        if ($to === '') { $a = Db::one("SELECT email FROM users WHERE (is_admin = 1 OR role = 'admin') AND deleted_at IS NULL ORDER BY id LIMIT 1"); $to = (string) ($a['email'] ?? ''); }
        if ($to === '' || str_ends_with($to, '@' . Auth::PHONE_MAIL_DOMAIN)) return;
        $origin = (string) Http::config('app_origin');
        Mail::send($to, 'Buja admin', 'Buja error: ' . mb_substr($message, 0, 70),
            '<p>' . ($count > 1 ? 'An error is back (' . $count . ' times so far)' : 'A new error just happened') . ' on ' . ($source === 'js' ? 'someone\'s phone' : 'the server') . '.</p>'
            . '<p style="font-family:monospace;font-size:13px;background:#F4F4F1;padding:12px;border-radius:8px">' . htmlspecialchars($message) . '<br>' . htmlspecialchars($where) . '<br>' . htmlspecialchars($path) . '</p>'
            . '<p><a href="' . htmlspecialchars($origin) . '/#/admin/system">Open Admin, System</a>. You get one email per error per day.</p>');
    }
}

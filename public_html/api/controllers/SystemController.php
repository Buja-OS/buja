<?php
declare(strict_types=1);

/**
 * Launch hardening: the error log, a one-tap database backup, and a system check that says in plain words
 * what is working and what is not. Everything here is admin-only except the endpoint phones report errors to.
 */
final class SystemController
{
    private function admin(): array
    {
        $u = Auth::require();
        if (empty($u['is_admin']) && ($u['role'] ?? '') !== 'admin') Http::json(['error' => 'forbidden', 'message' => 'Admins only.'], 403);
        return $u;
    }

    /** POST /errors { message, where, stack, path } : a phone reporting a JavaScript error. Throttled hard. */
    public function report(): void
    {
        RateLimit::hit('jserr', 30, 3600);
        $b = Http::body(); $u = Auth::user();
        $msg = trim((string) ($b['message'] ?? '')); if ($msg === '' || mb_strlen($msg) < 3) Http::json(['ok' => true]);
        // noise nobody can fix: browser extensions, cancelled loads, old cached code
        foreach (['ResizeObserver loop', 'Script error', 'extension://', 'Failed to fetch dynamically imported module', 'Load failed', 'NetworkError', 'AbortError'] as $skip) if (stripos($msg . ' ' . (string) ($b['where'] ?? ''), $skip) !== false) Http::json(['ok' => true]);
        ErrorLog::record('js', $msg, (string) ($b['where'] ?? ''), mb_substr((string) ($b['stack'] ?? ''), 0, 2500) . "\n" . mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 200), $u ? (int) $u['id'] : null, 'screen #' . mb_substr((string) ($b['path'] ?? ''), 0, 180));
        Http::json(['ok' => true]);
    }

    /** GET /admin/errors : newest first, open ones on top */
    public function errors(): void
    {
        $this->admin();
        try { $st = Db::pdo()->query('SELECT * FROM app_errors ORDER BY (resolved_at IS NULL) DESC, last_at DESC LIMIT 100'); $rows = $st->fetchAll(); }
        catch (Throwable $e) { Http::json(['errors' => [], 'missing' => true]); }
        Http::json(['errors' => array_map(fn($r) => ['id' => (int) $r['id'], 'source' => $r['source'], 'message' => $r['message'], 'where' => $r['where_at'], 'path' => $r['path'], 'sample' => $r['sample'],
            'count' => (int) $r['count'], 'first' => $r['first_at'], 'last' => $r['last_at'], 'resolved' => $r['resolved_at'] !== null], $rows)]);
    }

    /** POST /admin/errors/{id}/resolve, or id 0 to mark them all fixed */
    public function resolve(int $id): void
    {
        $this->admin();
        if ($id === 0) Db::run('UPDATE app_errors SET resolved_at = ? WHERE resolved_at IS NULL', [Db::now()]);
        else Db::run('UPDATE app_errors SET resolved_at = ? WHERE id = ?', [Db::now(), $id]);
        $this->errors();
    }

    /** GET /admin/system : is everything working, in plain words */
    public function check(): void
    {
        $this->admin();
        $cfg = fn(string $k) => (string) Http::config($k, '') !== '';
        $t0 = microtime(true); $dbOk = true; try { Db::one('SELECT 1'); } catch (Throwable $e) { $dbOk = false; }
        $ms = (int) round((microtime(true) - $t0) * 1000);
        $has = function (string $sql): bool { try { Db::one($sql); return true; } catch (Throwable $e) { return false; } };
        $m045 = $has('SELECT 1 FROM app_errors LIMIT 1') && $has('SELECT 1 FROM phone_otps LIMIT 1') && $has('SELECT 1 FROM rating_photos LIMIT 1') && $has('SELECT phone_verified_at, lang FROM users LIMIT 1') && $has('SELECT sos FROM safety_sessions LIMIT 1') && $has('SELECT no_show FROM service_jobs LIMIT 1');
        $open = 0; $day = 0;
        try { $open = (int) (Db::one('SELECT COUNT(*) AS n FROM app_errors WHERE resolved_at IS NULL')['n'] ?? 0); $day = (int) (Db::one('SELECT COALESCE(SUM(count),0) AS n FROM app_errors WHERE last_at > ?', [gmdate('Y-m-d H:i:s', time() - 86400)])['n'] ?? 0); } catch (Throwable $e) {}
        $inDb = 0; foreach (['uploads', 'avatars', 'match_photos', 'property_photos', 'listing_photos', 'cv_files', 'verifications'] as $t) { try { $inDb += (int) (Db::one("SELECT COUNT(*) AS n FROM $t WHERE data IS NOT NULL")['n'] ?? 0); } catch (Throwable $e) {} }
        $backup = Db::one("SELECT v FROM app_keys WHERE k = 'backup_last'");
        $mock = (bool) Http::config('paystack_mock');
        $checks = [
            ['id' => 'db', 'title' => 'Database', 'ok' => $dbOk && $ms < 800, 'detail' => $dbOk ? 'Answering in ' . $ms . ' ms.' : 'Not reachable.', 'fix' => 'Check DB_DSN, DB_USER and DB_PASS in Render, and that TiDB is not paused.'],
            ['id' => 'm045', 'title' => 'Migration 045', 'ok' => $m045, 'detail' => $m045 ? 'Error log, phone sign-in, review photos, SOS and no-show refunds are in.' : 'Not run yet. Phone sign-in, SOS alerts and review photos need it.', 'fix' => 'TiDB Cloud, SQL Editor: run migrations/045_phone_sos_guarantee.sql one statement at a time.'],
            ['id' => 'errors', 'title' => 'Errors in the last day', 'ok' => $day < 20, 'detail' => $day . ' error' . ($day === 1 ? '' : 's') . ' in 24 hours, ' . $open . ' kind' . ($open === 1 ? '' : 's') . ' not yet marked fixed.', 'fix' => 'Look at the list below. Send the top one to your developer.'],
            ['id' => 'mail', 'title' => 'Email', 'ok' => $cfg('brevo_api_key'), 'detail' => $cfg('brevo_api_key') ? 'Brevo is set. Error alerts go to ' . ((string) Http::config('admin_email', '') ?: 'the first admin account') . '.' : 'No BREVO_API_KEY: no confirmation emails, no password resets, no error alerts.', 'fix' => 'Brevo, SMTP and API, API keys: add BREVO_API_KEY in Render.'],
            ['id' => 'sms', 'title' => 'Text messages (sign-in codes, SOS)', 'ok' => Sms::configured() && !Sms::mock(), 'detail' => Sms::mock() ? 'SMS_MOCK is on: codes are only written to the server log.' : (Sms::configured() ? 'Termii is set, sending as ' . Http::config('termii_sender') . '.' : 'Not set. Phone sign-in is hidden and SOS alerts go by push and email only.'), 'fix' => 'termii.com: register a sender ID, then add TERMII_API_KEY, TERMII_SENDER and TERMII_BASE_URL in Render.'],
            ['id' => 'pay', 'title' => 'Payments', 'ok' => $cfg('paystack_secret') && !$mock, 'detail' => $mock ? 'MOCK MODE: every payment succeeds without money moving.' : ($cfg('paystack_secret') ? 'Live Paystack key set. Card, bank transfer and USSD are offered.' : 'No Paystack key: paying in the app is switched off.'), 'fix' => 'Render: PAYSTACK_SECRET set to your live key, PAYSTACK_MOCK removed or false.'],
            ['id' => 'transfers', 'title' => 'Automatic payouts', 'ok' => (bool) Http::config('paystack_transfers'), 'detail' => Http::config('paystack_transfers') ? 'Sellers and artisans are paid by Paystack transfer.' : 'Off: payouts wait in Admin, Escrow for you to send by hand.', 'fix' => 'Turn on Transfers in Paystack, fund the balance, then set PAYSTACK_TRANSFERS=true.'],
            ['id' => 'storage', 'title' => 'Photo storage', 'ok' => Media::configured() && $inDb === 0, 'detail' => (Media::configured() ? 'Bucket set. ' : 'No bucket: photos live inside the database, which fills it up. ') . ($inDb ? $inDb . ' file' . ($inDb === 1 ? '' : 's') . ' still in the database.' : 'Nothing left in the database.'), 'fix' => Media::configured() ? 'Tap "Move photos to the bucket" below until it says 0 remaining.' : 'Create a Cloudflare R2 or Backblaze B2 bucket and set the R2_ variables in Render (see DEPLOY-RENDER.md).'],
            ['id' => 'backup', 'title' => 'Backup', 'ok' => $backup && strtotime(substr((string) $backup['v'], 0, 19) . ' UTC') > time() - 8 * 86400, 'detail' => $backup ? 'Last downloaded ' . $backup['v'] . ' UTC.' : 'Never downloaded from here.', 'fix' => 'Download one below every week and keep it in Google Drive. TiDB also keeps its own daily backups.'],
            ['id' => 'php', 'title' => 'Server', 'ok' => true, 'detail' => 'PHP ' . PHP_VERSION . ', memory limit ' . ini_get('memory_limit') . ', peak ' . round(memory_get_peak_usage() / 1048576, 1) . ' MB on this request.', 'fix' => ''],
        ];
        $counts = [];
        foreach (['users', 'service_jobs', 'job_payments', 'escrow_orders', 'listings', 'jobs', 'messages', 'uploads', 'safety_sessions'] as $t) { try { $counts[$t] = (int) (Db::one("SELECT COUNT(*) AS n FROM $t")['n'] ?? 0); } catch (Throwable $e) {} }
        Http::json(['checks' => $checks, 'counts' => $counts, 'storage' => ['configured' => Media::configured(), 'inDatabase' => $inDb]]);
    }

    /** POST /admin/system/test { what: email | sms, phone } */
    public function test(): void
    {
        $u = $this->admin(); RateLimit::hit('systest', 10, 3600); $b = Http::body();
        if (($b['what'] ?? '') === 'sms') {
            $ok = Sms::send((string) ($b['phone'] ?? $u['phone'] ?? ''), 'Buja test message. If you can read this, texts work.');
            Http::json(['ok' => $ok, 'message' => $ok ? (Sms::mock() ? 'Mock mode: written to the server log, not sent.' : 'Sent. It should arrive within a minute.') : 'Termii did not accept it. Check the key, sender ID and base URL.']);
        }
        $to = (string) Http::config('admin_email', '') ?: (string) $u['email'];
        $ok = Mail::send($to, 'Buja admin', 'Buja test email', '<p>Email works. Error alerts will arrive at this address.</p>');
        Http::json(['ok' => $ok, 'message' => $ok ? 'Sent to ' . $to . '.' : 'Brevo did not accept it. Check BREVO_API_KEY and MAIL_FROM.']);
    }

    /**
     * GET /admin/backup?media=0|1 : the whole database as a gzipped SQL file, streamed in small pieces so it never
     * needs much memory. media=0 leaves out photo bytes (much smaller; photos in the bucket are not in the database anyway).
     */
    public function backup(): void
    {
        $this->admin();
        @set_time_limit(0); ignore_user_abort(false);
        $media = ($_GET['media'] ?? '0') === '1';
        $pdo = Db::pdo(); $driver = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
        $tables = $driver === 'sqlite' ? $pdo->query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name")->fetchAll(PDO::FETCH_COLUMN) : $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
        $skip = ['rate_limits'];
        Db::run("DELETE FROM app_keys WHERE k = 'backup_last'"); Db::run('INSERT INTO app_keys (k, v) VALUES (?,?)', ['backup_last', Db::now() . ($media ? ' with photos' : '')]);
        while (ob_get_level() > 0) @ob_end_clean();
        $name = 'buja-backup-' . gmdate('Y-m-d-Hi') . ($media ? '-full' : '') . '.sql.gz';
        header('Content-Type: application/gzip'); header('Content-Disposition: attachment; filename="' . $name . '"'); header('Cache-Control: no-store'); header('X-Accel-Buffering: no');
        $z = deflate_init(ZLIB_ENCODING_GZIP, ['level' => 6]);
        $out = function (string $s) use ($z): void { $c = deflate_add($z, $s, ZLIB_NO_FLUSH); if ($c !== '') { echo $c; flush(); } };
        $out("-- Buja backup " . gmdate('c') . ($media ? ' (with photo bytes)' : ' (photo bytes left out)') . "\n-- Restore: run this file in the TiDB SQL editor or with the mysql client.\nSET FOREIGN_KEY_CHECKS=0;\n\n");
        $blobs = ['uploads', 'avatars', 'match_photos', 'property_photos', 'listing_photos', 'cv_files', 'verifications'];
        foreach ($tables as $t) {
            if (in_array($t, $skip, true) || !preg_match('/^[a-z0-9_]+$/i', (string) $t)) continue;
            $create = $driver === 'sqlite' ? (string) $pdo->query("SELECT sql FROM sqlite_master WHERE name = " . $pdo->quote($t))->fetchColumn() : (string) ($pdo->query("SHOW CREATE TABLE `$t`")->fetch(PDO::FETCH_NUM)[1] ?? '');
            $out("DROP TABLE IF EXISTS `$t`;\n" . $create . ";\n");
            $off = 0; $step = in_array($t, $blobs, true) && $media ? 20 : 400;
            while (true) {
                $rows = $pdo->query("SELECT * FROM `$t` LIMIT $step OFFSET $off")->fetchAll(PDO::FETCH_ASSOC);
                if (!$rows) break;
                $cols = '`' . implode('`,`', array_keys($rows[0])) . '`'; $vals = [];
                foreach ($rows as $r) {
                    if (!$media && in_array($t, $blobs, true) && array_key_exists('data', $r)) $r['data'] = null;
                    $vals[] = '(' . implode(',', array_map(fn($v) => $v === null ? 'NULL' : (is_int($v) || is_float($v) ? (string) $v : (mb_check_encoding((string) $v, 'UTF-8') ? $pdo->quote((string) $v) : '0x' . bin2hex((string) $v))), $r)) . ')';
                }
                $out("INSERT INTO `$t` ($cols) VALUES\n" . implode(",\n", $vals) . ";\n");
                $off += $step; if (count($rows) < $step) break;
            }
            $out("\n");
        }
        $out("SET FOREIGN_KEY_CHECKS=1;\n");
        echo deflate_add($z, '', ZLIB_FINISH); flush();
        exit;
    }
}

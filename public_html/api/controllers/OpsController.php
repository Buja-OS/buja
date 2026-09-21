<?php
declare(strict_types=1);

/**
 * Operations. A cheap ping for the keep-alive scheduler, a housekeeping run so the free database never
 * fills with dead rows, and a launch checklist that tells the admin exactly what is switched on.
 */
final class OpsController
{
    /** GET /ping : no database, no session. The thing a scheduler hits every ten minutes so Render never sleeps. */
    public function ping(): void
    {
        header('Content-Type: text/plain'); header('Cache-Control: no-store'); echo 'ok ' . gmdate('c'); exit;
    }

    /** GET /cron/tidy?key=ADMIN_KEY : deletes what nobody will read again. Safe to run hourly. */
    public function tidy(): void
    {
        $key = (string) Http::config('admin_key', '');
        if ($key === '' || (string) ($_GET['key'] ?? '') !== $key) Http::json(['error' => 'forbidden'], 403);
        $done = [];
        $do = function (string $label, string $sql, array $p) use (&$done) { try { $st = Db::pdo()->prepare($sql); $st->execute($p); $done[$label] = $st->rowCount(); } catch (Throwable $e) { $done[$label] = 'skipped: ' . substr($e->getMessage(), 0, 60); } };
        $do('call signals older than a day', 'DELETE FROM call_signals WHERE created_at < ?', [gmdate('Y-m-d H:i:s', time() - 86400)]);
        $do('calls left ringing', "UPDATE calls SET status = 'missed', ended_at = ? WHERE status = 'ringing' AND created_at < ?", [Db::now(), gmdate('Y-m-d H:i:s', time() - 3600)]);
        $do('expired road alerts', 'DELETE FROM waka_alerts WHERE expires_at < ?', [gmdate('Y-m-d H:i:s', time() - 7 * 86400)]);
        $do('unpaid ticket attempts', "DELETE FROM tickets WHERE status = 'pending' AND created_at < ?", [gmdate('Y-m-d H:i:s', time() - 2 * 3600)]);
        $do('old rate-limit counters', 'DELETE FROM rate_limits WHERE window_id < ?', [(int) floor((time() - 86400) / 60)]);
        try { $st = Db::pdo()->query("SELECT k, v FROM app_keys WHERE k LIKE 'wa:%'"); $n = 0; foreach ($st->fetchAll() as $r) { $j = json_decode((string) $r['v'], true); if (!$j || ($j['t'] ?? 0) < time() - 900) { Db::run('DELETE FROM app_keys WHERE k = ?', [$r['k']]); $n++; } } $done['stale sign-in challenges'] = $n; } catch (Throwable $e) { $done['stale sign-in challenges'] = 'skipped'; }
        $do('old analytics events', 'DELETE FROM events WHERE created_at < ?', [gmdate('Y-m-d H:i:s', time() - 120 * 86400)]);
        $do('news older than a month', 'DELETE FROM news_items WHERE published_at < ?', [gmdate('Y-m-d H:i:s', time() - 30 * 86400)]);
        $do('ask log older than 90 days', 'DELETE FROM ask_log WHERE created_at < ?', [gmdate('Y-m-d H:i:s', time() - 90 * 86400)]);
        $do('expired sessions', 'DELETE FROM sessions WHERE expires_at < ?', [Db::now()]);
        Db::run('DELETE FROM app_keys WHERE k = ?', ['tidy_last']); Db::run('INSERT INTO app_keys (k, v) VALUES (?,?)', ['tidy_last', Db::now()]);
        Http::json(['tidied' => $done, 'at' => Db::now()]);
    }

    /** GET /admin/launch : everything an admin needs to know before telling people about Buja */
    public function launch(): void
    {
        $u = Auth::require(); if (empty($u['is_admin']) && ($u['role'] ?? '') !== 'admin') Http::json(['error' => 'forbidden'], 403);
        $cfg = fn(string $k) => (string) Http::config($k, '') !== '';
        $one = fn(string $sql, array $p = []) => Db::one($sql, $p);
        $mediaRows = (int) ($one('SELECT COUNT(*) AS n FROM uploads WHERE data IS NOT NULL')['n'] ?? 0);
        $mediaMb = round(((int) ($one('SELECT COALESCE(SUM(size),0) AS s FROM uploads WHERE data IS NOT NULL')['s'] ?? 0)) / 1048576, 1);
        $tidy = $one('SELECT v FROM app_keys WHERE k = ?', ['tidy_last']);
        $digestSent = $one('SELECT COUNT(*) AS n FROM users WHERE digest_sent_at > ?', [gmdate('Y-m-d H:i:s', time() - 8 * 86400)]);
        $lastDigest = $one('SELECT MAX(digest_sent_at) AS m FROM users');
        $users = (int) ($one('SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL')['n'] ?? 0);
        $active7 = (int) ($one('SELECT COUNT(DISTINCT user_id) AS n FROM events WHERE created_at > ?', [gmdate('Y-m-d H:i:s', time() - 7 * 86400)])['n'] ?? 0);
        $pushSubs = (int) ($one('SELECT COUNT(*) AS n FROM push_subscriptions')['n'] ?? 0);
        $checks = [
            ['id' => 'keepalive', 'title' => 'Server kept awake', 'ok' => $tidy && strtotime((string) $tidy['v'] . ' UTC') > time() - 2 * 3600, 'detail' => $tidy ? 'Last housekeeping run ' . $tidy['v'] . ' UTC' : 'No scheduler has ever called Buja. On the free plan the server sleeps after 15 minutes and the next visitor waits about a minute.', 'fix' => 'Set up a free scheduler (cron-job.org) to call /api/ping every 10 minutes and /api/cron/tidy?key=… every hour.', 'weight' => 3],
            ['id' => 'admin_key', 'title' => 'ADMIN_KEY set', 'ok' => $cfg('admin_key'), 'detail' => $cfg('admin_key') ? 'Set. Needed by the scheduler and the geometry builder.' : 'Not set. The digest and housekeeping URLs cannot be called without it.', 'fix' => 'Add ADMIN_KEY in Render: any long random string.', 'weight' => 3],
            ['id' => 'digest', 'title' => 'Weekly digest running', 'ok' => $lastDigest && $lastDigest['m'] && strtotime((string) $lastDigest['m'] . ' UTC') > time() - 8 * 86400, 'detail' => $lastDigest && $lastDigest['m'] ? 'Last sent ' . $lastDigest['m'] . ' UTC to ' . (int) ($digestSent['n'] ?? 0) . ' people this week' : 'Never sent.', 'fix' => 'Scheduler: call /api/cron/digest?key=… once a week, Monday 7am works well.', 'weight' => 1],
            ['id' => 'email', 'title' => 'Email (Brevo)', 'ok' => $cfg('brevo_api_key') && $cfg('mail_from'), 'detail' => $cfg('brevo_api_key') ? 'Sending as ' . Http::config('mail_from') : 'Not set. Confirmation emails, password resets and the digest cannot send.', 'fix' => 'Add BREVO_API_KEY and MAIL_FROM in Render.', 'weight' => 3],
            ['id' => 'push', 'title' => 'Push notifications', 'ok' => $pushSubs > 0, 'detail' => $pushSubs . ' phone' . ($pushSubs === 1 ? '' : 's') . ' subscribed', 'fix' => 'Nothing to configure. People turn it on in Settings; installing the app on iPhone is required there.', 'weight' => 1],
            ['id' => 'storage', 'title' => 'Media storage', 'ok' => $cfg('r2_bucket') && $cfg('r2_access_key'), 'detail' => ($cfg('r2_bucket') ? 'Files go to object storage. ' : 'Files are inside the database. ') . $mediaRows . ' file' . ($mediaRows === 1 ? '' : 's') . ', ' . $mediaMb . ' MB still in the database.', 'fix' => 'Supabase storage (free, no card) or Cloudflare R2. Add the four R2_ variables in Render, then Test storage and Move files in the admin panel.', 'weight' => $mediaMb > 200 ? 3 : 2],
            ['id' => 'ask', 'title' => 'Ask Buja (AI)', 'ok' => $cfg('gemini_api_key') || $cfg('groq_api_key') || $cfg('anthropic_api_key'), 'detail' => $cfg('gemini_api_key') || $cfg('groq_api_key') || $cfg('anthropic_api_key') ? 'Provider: ' . Http::config('ask_provider', 'gemini') : 'No AI key. Ask answers by keyword only.', 'fix' => 'GEMINI_API_KEY from aistudio.google.com, free.', 'weight' => 2],
            ['id' => 'google', 'title' => 'Google sign-in', 'ok' => $cfg('google_client_id'), 'detail' => $cfg('google_client_id') ? 'Client ID set.' : 'Not set. The Google button says "not switched on".', 'fix' => 'GOOGLE_CLIENT_ID from console.cloud.google.com, with https://buja.onrender.com as an authorised origin.', 'weight' => 2],
            ['id' => 'paystack', 'title' => 'Payments (Paystack)', 'ok' => $cfg('paystack_secret') && !Http::config('paystack_mock'), 'detail' => Http::config('paystack_mock') ? 'MOCK MODE IS ON. Every purchase is free. Remove PAYSTACK_MOCK before real users.' : ($cfg('paystack_secret') ? (str_starts_with((string) Http::config('paystack_secret'), 'sk_test') ? 'Test key. Real cards will not be charged.' : 'Live key set.') : 'Not set. Buja Plus and paid tickets are off.'), 'fix' => 'PAYSTACK_SECRET (sk_live_…) in Render, and the webhook URL https://buja.onrender.com/api/pay/webhook in the Paystack dashboard.', 'weight' => Http::config('paystack_mock') ? 3 : 1],
            ['id' => 'turn', 'title' => 'Call relay (TURN)', 'ok' => $cfg('turn_url'), 'detail' => $cfg('turn_url') ? 'Relay set.' : 'No relay. Calls connect directly; some mobile networks will refuse and the call will say it could not connect.', 'fix' => 'openrelay.metered.ca gives free TURN credentials. Add TURN_URL, TURN_USER, TURN_PASS.', 'weight' => 2],
            ['id' => 'origin', 'title' => 'App address', 'ok' => !str_contains((string) Http::config('app_origin'), 'onrender.com'), 'detail' => (string) Http::config('app_origin'), 'fix' => 'A .com.ng domain makes Buja look like a product and keeps email out of spam. Point it at Render, then change APP_ORIGIN and the Google origin.', 'weight' => 1],
            ['id' => 'content', 'title' => 'Enough to look alive', 'ok' => (int) ($one("SELECT COUNT(*) AS n FROM jobs WHERE status = 'open'")['n'] ?? 0) >= 10 && (int) ($one("SELECT COUNT(*) AS n FROM properties WHERE status = 'available'")['n'] ?? 0) >= 5, 'detail' => (int) ($one("SELECT COUNT(*) AS n FROM jobs WHERE status = 'open'")['n'] ?? 0) . ' open jobs, ' . (int) ($one("SELECT COUNT(*) AS n FROM properties WHERE status = 'available'")['n'] ?? 0) . ' homes, ' . (int) ($one("SELECT COUNT(*) AS n FROM listings WHERE status = 'active'")['n'] ?? 0) . ' items, ' . (int) ($one("SELECT COUNT(*) AS n FROM meetups WHERE status = 'live' AND starts_at > ?", [Db::now()])['n'] ?? 0) . ' events, ' . (int) ($one('SELECT COUNT(*) AS n FROM artisans')['n'] ?? 0) . ' artisans', 'fix' => 'An empty app tells a new user to leave. Ten real jobs and five real homes before the first invite.', 'weight' => 3],
        ];
        $score = 0; $max = 0; foreach ($checks as $c) { $max += $c['weight']; if ($c['ok']) $score += $c['weight']; }
        Http::json(['checks' => $checks, 'score' => $score, 'max' => $max, 'people' => ['users' => $users, 'active7' => $active7],
            'urls' => ['ping' => (string) Http::config('app_origin') . '/api/ping', 'tidy' => (string) Http::config('app_origin') . '/api/cron/tidy?key=' . ($cfg('admin_key') ? 'YOUR_ADMIN_KEY' : '…'), 'digest' => (string) Http::config('app_origin') . '/api/cron/digest?key=' . ($cfg('admin_key') ? 'YOUR_ADMIN_KEY' : '…')]]);
    }
}

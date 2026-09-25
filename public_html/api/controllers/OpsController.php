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
        try { $r = Db::one('SELECT v FROM app_keys WHERE k = ?', ['ping_last']); if (!$r || strtotime((string) $r['v'] . ' UTC') < time() - 300) { Db::run('DELETE FROM app_keys WHERE k = ?', ['ping_last']); Db::run('INSERT INTO app_keys (k, v) VALUES (?,?)', ['ping_last', Db::now()]); } } catch (Throwable $e) {}
        header('Content-Type: text/plain'); header('Cache-Control: no-store'); echo 'ok ' . gmdate('c'); exit;
    }

    /** GET /cron/tidy?key=ADMIN_KEY : the same housekeeping the app runs itself hourly; here for a scheduler or a manual run. */
    public function tidy(): void
    {
        $key = (string) Http::config('admin_key', '');
        if ($key === '' || (string) ($_GET['key'] ?? '') !== $key) Http::json(['error' => 'forbidden'], 403);
        $done = Cron::tidy();
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
        $ping = $one('SELECT v FROM app_keys WHERE k = ?', ['ping_last']);
        $digestSent = $one('SELECT COUNT(*) AS n FROM users WHERE digest_sent_at > ?', [gmdate('Y-m-d H:i:s', time() - 8 * 86400)]);
        $lastDigest = $one('SELECT MAX(digest_sent_at) AS m FROM users');
        $users = (int) ($one('SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL')['n'] ?? 0);
        $active7 = (int) ($one('SELECT COUNT(DISTINCT user_id) AS n FROM events WHERE created_at > ?', [gmdate('Y-m-d H:i:s', time() - 7 * 86400)])['n'] ?? 0);
        $pushSubs = (int) ($one('SELECT COUNT(*) AS n FROM push_subscriptions')['n'] ?? 0);
        $checks = [
            ['id' => 'keepalive', 'title' => 'Server kept awake', 'ok' => $ping && strtotime((string) $ping['v'] . ' UTC') > time() - 20 * 60, 'detail' => $ping ? 'Last ping ' . $ping['v'] . ' UTC' : 'No scheduler has ever pinged Buja. On the free plan the server sleeps after 15 minutes and the next visitor waits about a minute.', 'fix' => 'One free job on cron-job.org: call /api/ping every 10 minutes. Housekeeping and the digest now run themselves; this is the only job left.', 'weight' => 3],
            ['id' => 'admin_key', 'title' => 'ADMIN_KEY set', 'ok' => $cfg('admin_key'), 'detail' => $cfg('admin_key') ? 'Set. Needed by the scheduler and the geometry builder.' : 'Not set. The digest and housekeeping URLs cannot be called without it.', 'fix' => 'Add ADMIN_KEY in Render: any long random string.', 'weight' => 3],
            ['id' => 'digest', 'title' => 'Weekly digest', 'ok' => $cfg('brevo_api_key'), 'detail' => $lastDigest && $lastDigest['m'] ? 'Last sent ' . $lastDigest['m'] . ' UTC to ' . (int) ($digestSent['n'] ?? 0) . ' people this week. Runs itself on Monday mornings.' : 'Runs itself on Monday mornings from 7am Abuja time, as long as someone has the app open. Nothing to set up.', 'fix' => 'Needs email to be configured.', 'weight' => 1],
            ['id' => 'email', 'title' => 'Email (Brevo)', 'ok' => $cfg('brevo_api_key') && $cfg('mail_from'), 'detail' => $cfg('brevo_api_key') ? 'Sending as ' . Http::config('mail_from') : 'Not set. Confirmation emails, password resets and the digest cannot send.', 'fix' => 'Add BREVO_API_KEY and MAIL_FROM in Render.', 'weight' => 3],
            ['id' => 'push', 'title' => 'Push notifications', 'ok' => $pushSubs > 0, 'detail' => $pushSubs . ' phone' . ($pushSubs === 1 ? '' : 's') . ' subscribed', 'fix' => 'Nothing to configure. People turn it on in Settings; installing the app on iPhone is required there.', 'weight' => 1],
            ['id' => 'storage', 'title' => 'Media storage', 'ok' => $cfg('r2_bucket') && $cfg('r2_access_key'), 'detail' => ($cfg('r2_bucket') ? 'Files go to object storage. ' : 'Files are inside the database. ') . $mediaRows . ' file' . ($mediaRows === 1 ? '' : 's') . ', ' . $mediaMb . ' MB still in the database.', 'fix' => 'Supabase storage (free, no card) or Cloudflare R2. Add the four R2_ variables in Render, then Test storage and Move files in the admin panel.', 'weight' => $mediaMb > 200 ? 3 : 2],
            ['id' => 'ask', 'title' => 'Ask Buja (AI)', 'ok' => $cfg('gemini_api_key') || $cfg('groq_api_key') || $cfg('anthropic_api_key'), 'detail' => $cfg('gemini_api_key') || $cfg('groq_api_key') || $cfg('anthropic_api_key') ? 'Provider: ' . Http::config('ask_provider', 'gemini') : 'No AI key. Ask answers by keyword only.', 'fix' => 'GEMINI_API_KEY from aistudio.google.com, free.', 'weight' => 2],
            ['id' => 'google', 'title' => 'Google sign-in', 'ok' => $cfg('google_client_id'), 'detail' => $cfg('google_client_id') ? 'Client ID set.' : 'Not set. The Google button says "not switched on".', 'fix' => 'GOOGLE_CLIENT_ID from console.cloud.google.com, with https://buja.onrender.com as an authorised origin.', 'weight' => 2],
            ['id' => 'paystack', 'title' => 'Payments (Paystack)', 'ok' => $cfg('paystack_secret') && !Http::config('paystack_mock'), 'detail' => Http::config('paystack_mock') ? 'MOCK MODE IS ON. Every purchase is free. Remove PAYSTACK_MOCK before real users.' : ($cfg('paystack_secret') ? (str_starts_with((string) Http::config('paystack_secret'), 'sk_test') ? 'Test key. Real cards will not be charged.' : 'Live key set.') : 'Not set. Buja Plus and paid tickets are off.'), 'fix' => 'PAYSTACK_SECRET (sk_live_…) in Render, and the webhook URL https://buja.onrender.com/api/pay/webhook in the Paystack dashboard.', 'weight' => Http::config('paystack_mock') ? 3 : 1],
            ['id' => 'turn', 'title' => 'Call relay (TURN)', 'ok' => true, 'detail' => Http::config('turn_default') ? 'Using the free public Open Relay. Fine to launch on; a paid relay only matters once calls are heavy.' : 'Your own relay is set.', 'fix' => '', 'weight' => 2],
            ['id' => 'origin', 'title' => 'App address', 'ok' => !str_contains((string) Http::config('app_origin'), 'onrender.com'), 'detail' => (string) Http::config('app_origin'), 'fix' => 'A .com.ng domain makes Buja look like a product and keeps email out of spam. Point it at Render, then change APP_ORIGIN and the Google origin.', 'weight' => 1],
            ['id' => 'content', 'title' => 'Enough to look alive', 'ok' => (int) ($one("SELECT COUNT(*) AS n FROM jobs WHERE status = 'open'")['n'] ?? 0) >= 10 && (int) ($one("SELECT COUNT(*) AS n FROM properties WHERE status = 'available'")['n'] ?? 0) >= 5, 'detail' => (int) ($one("SELECT COUNT(*) AS n FROM jobs WHERE status = 'open'")['n'] ?? 0) . ' open jobs, ' . (int) ($one("SELECT COUNT(*) AS n FROM properties WHERE status = 'available'")['n'] ?? 0) . ' homes, ' . (int) ($one("SELECT COUNT(*) AS n FROM listings WHERE status = 'active'")['n'] ?? 0) . ' items, ' . (int) ($one("SELECT COUNT(*) AS n FROM meetups WHERE status = 'live' AND starts_at > ?", [Db::now()])['n'] ?? 0) . ' events, ' . (int) ($one('SELECT COUNT(*) AS n FROM artisans')['n'] ?? 0) . ' artisans', 'fix' => 'An empty app tells a new user to leave. Ten real jobs and five real homes before the first invite.', 'weight' => 3],
        ];
        // Tables from recent migrations: tried one by one, so the checklist says which migration still needs running.
        $has = function (string $sql): bool { try { Db::one($sql); return true; } catch (Throwable $e) { return false; } };
        $m036 = $has('SELECT 1 FROM friendships LIMIT 1') && $has('SELECT 1 FROM saved_artisans LIMIT 1') && $has('SELECT 1 FROM kart_profiles LIMIT 1') && $has('SELECT preferred_artisan_id FROM service_jobs LIMIT 1');
        $m037 = $has('SELECT 1 FROM escrow_orders LIMIT 1') && $has('SELECT 1 FROM payout_accounts LIMIT 1') && $has('SELECT 1 FROM payouts LIMIT 1');
        $m038 = $has('SELECT owned, equipped, daily_on, streak FROM kart_profiles LIMIT 1');
        $m039 = $has('SELECT 1 FROM kart_perf LIMIT 1') && $has('SELECT 1 FROM kart_achievements LIMIT 1') && $has('SELECT 1 FROM kart_prizes LIMIT 1');
        $m040 = $has('SELECT 1 FROM live_tracks LIMIT 1') && $has('SELECT kind, ready_at FROM service_jobs LIMIT 1') && $has('SELECT drop_lat FROM escrow_orders LIMIT 1');
        $m041 = (function () { try { $r = Db::one("SELECT COLUMN_TYPE AS t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'threads' AND COLUMN_NAME = 'kind'"); return !$r || str_contains((string) $r['t'], 'friend'); } catch (Throwable $e) { return true; } })();
        $m042 = $has('SELECT stability FROM kart_profiles LIMIT 1');
        $checks[] = ['id' => 'migrations', 'title' => 'Database up to date', 'ok' => $m036 && $m037 && $m038 && $m039 && $m040 && $m041 && $m042, 'weight' => 3,
            'detail' => ($m036 && $m037 && $m038 && $m039 && $m040 && $m041 && $m042) ? 'Migrations 036 to 042 are in (friends, escrow, kart shop, kart competition, order tracking, friend chats, kart stability).' : 'Missing: ' . implode(' and ', array_filter([$m036 ? '' : '036 (friends, saved mechanics, garage)', $m037 ? '' : '037 (escrow)', $m038 ? '' : '038 (kart shop)', $m039 ? '' : '039 (kart competition)', $m040 ? '' : '040 (order tracking)', $m041 ? '' : '041 (friend chats)', $m042 ? '' : '042 (kart stability)'])) . '.',
            'fix' => 'In TiDB Cloud, SQL Editor: run the missing migration file from the migrations folder on GitHub.'];
        $wh = $one('SELECT v FROM app_keys WHERE k = ?', ['paystack_webhook_last']);
        $mock = (bool) Http::config('paystack_mock');
        $checks[] = ['id' => 'webhook', 'title' => 'Paystack webhook arriving', 'ok' => (bool) $wh, 'weight' => 2,
            'detail' => $wh ? 'Last received ' . $wh['v'] . ' UTC.' : ($mock ? 'Not yet: payments are in mock mode, so Paystack is not calling.' : 'Paystack has not called Buja yet. Without it, a payment made while someone loses signal may never be credited.'),
            'fix' => 'Paystack dashboard, Settings, API Keys and Webhooks: set the webhook URL to ' . Http::config('app_origin') . '/api/pay/webhook'];
        if ($m037) {
            $owed = $one("SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS s FROM payouts WHERE status IN ('queued','failed','sending')");
            $disputes = (int) ($one("SELECT COUNT(*) AS n FROM escrow_orders WHERE status = 'disputed'")['n'] ?? 0);
            $checks[] = ['id' => 'escrow', 'title' => 'Escrow up to date', 'ok' => (int) $owed['n'] === 0 && $disputes === 0, 'weight' => 2,
                'detail' => ((int) $owed['n'] ? (int) $owed['n'] . ' seller payout' . ((int) $owed['n'] === 1 ? '' : 's') . ' waiting, ₦' . number_format((int) $owed['s']) . ' owed. ' : 'No payouts waiting. ') . ($disputes ? $disputes . ' problem' . ($disputes === 1 ? '' : 's') . ' to decide. ' : '') . (Http::config('paystack_transfers') ? 'Automatic transfers are on.' : 'Automatic transfers are off: pay sellers by hand, then tap Mark paid.'),
                'fix' => 'Admin, Money, Escrow.'];
        }
        $fps = array_filter(array_map('trim', explode(',', (string) Http::config('android_sha256', getenv('ANDROID_SHA256') ?: ''))));
        $pkg = (string) (Http::config('android_package', getenv('ANDROID_PACKAGE') ?: ''));
        $checks[] = ['id' => 'android', 'title' => 'Android app opens full screen', 'ok' => $pkg !== '' && count($fps) >= 2, 'weight' => 1,
            'detail' => $pkg === '' ? 'ANDROID_PACKAGE is not set.' : $pkg . ' with ' . count($fps) . ' signing fingerprint' . (count($fps) === 1 ? '' : 's') . '. ' . (count($fps) >= 2 ? 'Both your key and Google Play\'s are in.' : 'Add Google Play\'s app signing fingerprint once the app is uploaded, or the Play Store version shows an address bar.'),
            'fix' => 'Play Console, Test and release, App integrity, App signing: copy the SHA-256, add it to ANDROID_SHA256 in Render after a comma.'];
        $mech = (int) ($one("SELECT COUNT(*) AS n FROM artisans WHERE trade = 'mechanic' AND hidden_at IS NULL")['n'] ?? 0);
        $checks[] = ['id' => 'mechanics', 'title' => 'Mechanics signed up', 'ok' => $mech >= 20, 'weight' => 2,
            'detail' => $mech . ' mechanic' . ($mech === 1 ? '' : 's') . ' on Buja. Breakdown help needs at least 20 spread across Abuja.',
            'fix' => 'Print the flyers (/p/mechanics/flyer?src=apo) and visit Apo, Kugbo and the Wuse mechanic villages.'];
        $checks[] = ['id' => 'playbilling', 'title' => 'Play Store billing rules', 'ok' => true, 'weight' => 1, 'detail' => 'Buja Plus is not sold or advertised inside the Android app; members keep their benefits there.', 'fix' => ''];
        $score = 0; $max = 0; foreach ($checks as $c) { $max += $c['weight']; if ($c['ok']) $score += $c['weight']; }
        Http::json(['checks' => $checks, 'score' => $score, 'max' => $max, 'people' => ['users' => $users, 'active7' => $active7],
            'urls' => ['ping' => (string) Http::config('app_origin') . '/api/ping', 'tidy' => (string) Http::config('app_origin') . '/api/cron/tidy?key=' . ($cfg('admin_key') ? 'YOUR_ADMIN_KEY' : '…'), 'digest' => (string) Http::config('app_origin') . '/api/cron/digest?key=' . ($cfg('admin_key') ? 'YOUR_ADMIN_KEY' : '…')]]);
    }
}

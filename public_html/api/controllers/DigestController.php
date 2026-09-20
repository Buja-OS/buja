<?php
declare(strict_types=1);

/**
 * The weekly digest. One email a week: jobs in your district, homes and items matching your saved searches,
 * what Social talked about, and anything still waiting for you. Run by a scheduled request, a few people
 * at a time, so a free host never times out.
 */
final class DigestController
{
    /** GET|POST /cron/digest?key=ADMIN_KEY&limit=40 */
    public function run(): void
    {
        $key = (string) Http::config('admin_key', '');
        if ($key === '' || (string) ($_GET['key'] ?? '') !== $key) Http::json(['error' => 'forbidden'], 403);
        $limit = max(1, min(100, (int) ($_GET['limit'] ?? 40)));
        $st = Db::pdo()->prepare('SELECT * FROM users WHERE deleted_at IS NULL AND notify_digest = 1 AND email_verified_at IS NOT NULL
                                  AND (digest_sent_at IS NULL OR digest_sent_at < ?) ORDER BY digest_sent_at IS NULL DESC, digest_sent_at ASC LIMIT ?');
        $st->execute([gmdate('Y-m-d H:i:s', time() - 6 * 86400), $limit]);
        $sent = 0; $skipped = 0;
        foreach ($st->fetchAll() as $u) {
            $d = $this->gather($u);
            Db::run('UPDATE users SET digest_sent_at = ? WHERE id = ?', [Db::now(), $u['id']]);
            if ($d['total'] < 2) { $skipped++; continue; }   // nothing worth an email is worse than no email
            Mail::send((string) $u['email'], (string) $u['name'], 'Buja · ' . $d['subject'], $this->html($u, $d));
            $sent++;
        }
        Http::json(['sent' => $sent, 'skipped' => $skipped]);
    }

    /** GET /me/digest : the same content, shown in the app so it can be checked without waiting a week */
    public function preview(): void
    {
        $u = Auth::require();
        $d = $this->gather($u);
        Http::json(['digest' => ['subject' => $d['subject'], 'jobs' => $d['jobs'], 'homes' => $d['homes'], 'items' => $d['items'], 'posts' => $d['posts'], 'waiting' => $d['waiting'], 'total' => $d['total']]]);
    }

    private function gather(array $u): array
    {
        $since = gmdate('Y-m-d H:i:s', time() - 7 * 86400);
        $jobs = $homes = $items = [];
        $st = Db::pdo()->prepare("SELECT j.id, j.title, j.district, j.salary_min, j.salary_max, c.name AS company FROM jobs j JOIN companies c ON c.id = j.company_id
                                  WHERE j.status = 'open' AND j.created_at > ? AND (? = '' OR j.district = ?) ORDER BY j.id DESC LIMIT 5");
        $st->execute([$since, (string) ($u['district'] ?? ''), (string) ($u['district'] ?? '')]);
        $jobs = $st->fetchAll();

        // Anything matching what they asked to be told about
        $ss = Db::pdo()->prepare('SELECT * FROM saved_searches WHERE user_id = ?'); $ss->execute([$u['id']]);
        foreach ($ss->fetchAll() as $s) {
            $f = json_decode($s['filters'], true) ?: [];
            if ($s['module'] === 'homes') {
                $q = Db::pdo()->prepare("SELECT id, title, district, price, beds FROM properties WHERE status = 'available' AND created_at > ? ORDER BY id DESC LIMIT 12");
                $q->execute([$since]);
                foreach ($q->fetchAll() as $row) if (Alerts::matches('homes', $f, $row) && count($homes) < 5) $homes[$row['id']] = $row;
            } elseif ($s['module'] === 'declutter') {
                $q = Db::pdo()->prepare("SELECT id, title, district, price, category FROM listings WHERE status = 'active' AND created_at > ? ORDER BY id DESC LIMIT 12");
                $q->execute([$since]);
                foreach ($q->fetchAll() as $row) if (Alerts::matches('declutter', $f, $row) && count($items) < 5) $items[$row['id']] = $row;
            }
        }
        $ps = Db::pdo()->prepare('SELECT id, title, replies FROM social_posts WHERE hidden_at IS NULL AND created_at > ? ORDER BY (likes + replies) DESC LIMIT 3');
        $ps->execute([$since]); $posts = $ps->fetchAll();
        $waiting = (int) (Db::one('SELECT COUNT(*) AS n FROM threads t JOIN messages m ON m.thread_id = t.id
                                   LEFT JOIN thread_reads r ON r.thread_id = t.id AND r.user_id = ?
                                   WHERE (t.user_a = ? OR t.user_b = ?) AND m.sender_id <> ? AND m.id > COALESCE(r.last_read_id, 0)',
            [$u['id'], $u['id'], $u['id'], $u['id']])['n'] ?? 0);

        $homes = array_values($homes); $items = array_values($items);
        $total = count($jobs) + count($homes) + count($items) + count($posts) + ($waiting ? 1 : 0);
        $first = count($jobs) ? count($jobs) . ' new job' . (count($jobs) === 1 ? '' : 's') . ' in ' . ($u['district'] ?: 'Abuja')
            : (count($homes) ? count($homes) . ' home' . (count($homes) === 1 ? '' : 's') . ' matching your search'
            : (count($items) ? count($items) . ' new item' . (count($items) === 1 ? '' : 's') . ' near you' : 'Your week on Buja'));
        return ['subject' => $first, 'jobs' => $jobs, 'homes' => $homes, 'items' => $items, 'posts' => $posts, 'waiting' => $waiting, 'total' => $total];
    }

    private function html(array $u, array $d): string
    {
        $o = rtrim((string) Http::config('app_origin', 'https://buja.onrender.com'), '/');
        $esc = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
        $money = fn($n) => '₦' . number_format((int) $n);
        $row = fn($title, $sub, $url) => '<tr><td style="padding:10px 0;border-bottom:1px solid #EEEEE9"><a href="' . $url . '" style="color:#1B1B1F;text-decoration:none;font-weight:600;font-size:15px">' . $title . '</a><div style="color:#6B6B73;font-size:13px;margin-top:2px">' . $sub . '</div></td></tr>';
        $s = '<div style="font-family:Inter,Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px 18px;color:#1B1B1F">';
        $s .= '<div style="font-size:22px;font-weight:700;letter-spacing:2px">BUJA</div>';
        $s .= '<div style="color:#6B6B73;font-size:14px;margin:4px 0 18px">Your week in Abuja, ' . $esc(explode(' ', trim((string) $u['name']))[0]) . '</div>';
        if ($d['waiting']) $s .= '<div style="background:#FFF1E6;border-radius:12px;padding:12px 14px;margin-bottom:16px;font-size:14px"><strong>' . (int) $d['waiting'] . ' message' . ($d['waiting'] === 1 ? '' : 's') . ' waiting</strong> · <a href="' . $o . '/#/inbox" style="color:#C85A10">open your inbox</a></div>';
        if ($d['jobs']) { $s .= '<h3 style="font-size:13px;letter-spacing:1px;color:#6B6B73;margin:20px 0 4px">NEW JOBS</h3><table width="100%" cellspacing="0">';
            foreach ($d['jobs'] as $j) $s .= $row($esc($j['title']), $esc($j['company']) . ' · ' . $esc($j['district']) . ((int) $j['salary_min'] ? ' · from ' . $money($j['salary_min']) : ''), $o . '/#/work/job/' . (int) $j['id']);
            $s .= '</table>'; }
        if ($d['homes']) { $s .= '<h3 style="font-size:13px;letter-spacing:1px;color:#6B6B73;margin:20px 0 4px">HOMES MATCHING YOUR SEARCH</h3><table width="100%" cellspacing="0">';
            foreach ($d['homes'] as $p) $s .= $row($esc($p['title']), $money($p['price']) . ' · ' . $esc($p['district']) . ' · ' . (int) $p['beds'] . ' bed', $o . '/#/homes/' . (int) $p['id']);
            $s .= '</table>'; }
        if ($d['items']) { $s .= '<h3 style="font-size:13px;letter-spacing:1px;color:#6B6B73;margin:20px 0 4px">NEW NEARBY</h3><table width="100%" cellspacing="0">';
            foreach ($d['items'] as $i) $s .= $row($esc($i['title']), $money($i['price']) . ' · ' . $esc($i['district']), $o . '/#/declutter/' . (int) $i['id']);
            $s .= '</table>'; }
        if ($d['posts']) { $s .= '<h3 style="font-size:13px;letter-spacing:1px;color:#6B6B73;margin:20px 0 4px">THE CITY IS TALKING ABOUT</h3><table width="100%" cellspacing="0">';
            foreach ($d['posts'] as $p) $s .= $row($esc($p['title']), (int) $p['replies'] . ' repl' . ((int) $p['replies'] === 1 ? 'y' : 'ies'), $o . '/#/social/' . (int) $p['id']);
            $s .= '</table>'; }
        $s .= '<div style="margin-top:26px;padding-top:16px;border-top:1px solid #EEEEE9;color:#6B6B73;font-size:12px;line-height:1.6">You get this once a week. Turn it off in Buja under Settings, notifications.<br>Buja, for Abuja and the FCT.</div></div>';
        return $s;
    }
}

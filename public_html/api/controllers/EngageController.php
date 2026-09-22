<?php
declare(strict_types=1);

/**
 * Keeping people engaged without spamming them:
 *  - the admin sees what each person is learning, lesson by lesson, and their certificates
 *  - personal learning reminders ("7 of 12 in Frontend, next: The DOM, 14 min"), at most every 5 days
 *  - admin broadcasts to a chosen audience, queued and sent in batches so no request times out
 *  - a nudge for people who have never switched notifications on
 */
final class EngageController
{
    private function admin(): array
    {
        $u = Auth::require();
        // Admins only, not moderators: this is people's emails, their learning record, and messaging everyone.
        if (empty($u['is_admin']) && ($u['role'] ?? '') !== 'admin') Http::json(['error' => 'forbidden'], 403);
        return $u;
    }

    /* ------------------------------------------------ LEARNING, PER PERSON ------------------------------------------------ */

    /** Everything one person is doing in Learn. Used by the admin profile and by the reminder. */
    public static function learning(int $userId): array
    {
        $st = Db::pdo()->prepare('SELECT course, lesson, score, attempts, completed_at FROM learn_progress WHERE user_id = ? ORDER BY completed_at');
        $st->execute([$userId]);
        $by = [];
        foreach ($st->fetchAll() as $r) $by[$r['course']][(int) $r['lesson']] = $r;
        $sv = Db::pdo()->prepare('SELECT course, lesson FROM learn_saves WHERE user_id = ?'); $sv->execute([$userId]);
        $saved = []; foreach ($sv->fetchAll() as $r) $saved[$r['course'] . ':' . (int) $r['lesson']] = true;
        $certs = [];
        $cs = Db::pdo()->prepare('SELECT code, course, score, issued_at, revoked_at FROM certificates WHERE user_id = ? ORDER BY issued_at DESC'); $cs->execute([$userId]);
        foreach ($cs->fetchAll() as $c) $certs[$c['course']] = $c;
        $courses = [];
        foreach ($by as $slug => $done) {
            $c = Curriculum::find($slug); if (!$c) continue;
            $n = count($c['lessons']); $next = null;
            foreach ($c['lessons'] as $i => $l) if (!isset($done[$i])) { $next = ['index' => $i, 'title' => $l['title'], 'kind' => $l['kind'], 'minutes' => (int) $l['minutes']]; break; }
            $last = max(array_column($done, 'completed_at'));
            $scores = array_map(fn($r) => (int) $r['score'], $done);
            $cert = $certs[$slug] ?? null;
            $courses[] = [
                'slug' => $slug, 'title' => $c['title'], 'level' => $c['level'], 'track' => $c['track'], 'lessons' => $n, 'done' => count($done),
                'pct' => (int) round(count($done) / max(1, $n) * 100), 'avg' => $scores ? (int) round(array_sum($scores) / count($scores)) : null,
                'attempts' => array_sum(array_map(fn($r) => (int) $r['attempts'], $done)), 'last' => $last, 'next' => $next,
                'status' => $cert && !$cert['revoked_at'] ? 'certified' : ($next === null ? 'finished' : 'in_progress'),
                'certificate' => $cert && !$cert['revoked_at'] ? ['code' => $cert['code'], 'score' => (int) $cert['score'], 'at' => $cert['issued_at']] : null,
                'detail' => array_map(fn($i, $l) => ['index' => $i, 'title' => $l['title'], 'kind' => $l['kind'], 'done' => isset($done[$i]), 'score' => isset($done[$i]) ? (int) $done[$i]['score'] : null, 'attempts' => isset($done[$i]) ? (int) $done[$i]['attempts'] : null, 'at' => $done[$i]['completed_at'] ?? null, 'hasAnswer' => isset($saved[$slug . ':' . $i])], array_keys($c['lessons']), $c['lessons']),
            ];
        }
        usort($courses, fn($a, $b) => strcmp((string) $b['last'], (string) $a['last']) ?: ($b['pct'] <=> $a['pct']));
        return ['courses' => $courses, 'certificates' => count(array_filter($certs, fn($c) => !$c['revoked_at'])), 'lessonsDone' => array_sum(array_column($courses, 'done')), 'last' => $courses[0]['last'] ?? null];
    }

    /** GET /admin/learners?q=&filter=active|stuck|certified */
    public function learners(): void
    {
        $this->admin(); $q = trim((string) ($_GET['q'] ?? '')); $filter = (string) ($_GET['filter'] ?? '');
        $sql = 'SELECT u.id, u.name, u.email, u.district, u.avatar_url, MAX(p.completed_at) AS last, COUNT(*) AS lessons, COUNT(DISTINCT p.course) AS courses FROM learn_progress p JOIN users u ON u.id = p.user_id WHERE u.deleted_at IS NULL';
        $p = [];
        if ($q !== '') { $sql .= ' AND (u.name LIKE ? OR u.email LIKE ?)'; $p[] = "%$q%"; $p[] = "%$q%"; }
        $sql .= ' GROUP BY u.id, u.name, u.email, u.district, u.avatar_url ORDER BY last DESC LIMIT 300';
        $st = Db::pdo()->prepare($sql); $st->execute($p);
        $out = [];
        foreach ($st->fetchAll() as $r) {
            $certs = (int) (Db::one('SELECT COUNT(*) AS n FROM certificates WHERE user_id = ? AND revoked_at IS NULL', [$r['id']])['n'] ?? 0);
            $idleDays = (int) floor((time() - strtotime($r['last'] . ' UTC')) / 86400);
            $current = null;
            $cur = Db::one('SELECT course FROM learn_progress WHERE user_id = ? ORDER BY completed_at DESC LIMIT 1', [$r['id']]);
            if ($cur && ($c = Curriculum::find($cur['course']))) { $d = (int) (Db::one('SELECT COUNT(*) AS n FROM learn_progress WHERE user_id = ? AND course = ?', [$r['id'], $cur['course']])['n'] ?? 0); $current = ['title' => $c['title'], 'done' => $d, 'lessons' => count($c['lessons'])]; }
            $row = ['id' => (int) $r['id'], 'name' => $r['name'], 'email' => $r['email'], 'district' => $r['district'], 'avatar' => Auth::picture((int) $r['id']), 'last' => $r['last'], 'idleDays' => $idleDays, 'lessons' => (int) $r['lessons'], 'courses' => (int) $r['courses'], 'certificates' => $certs, 'current' => $current];
            if ($filter === 'active' && $idleDays > 7) continue;
            if ($filter === 'stuck' && ($idleDays <= 7 || ($current && $current['done'] >= $current['lessons']))) continue;
            if ($filter === 'certified' && !$certs) continue;
            $out[] = $row;
        }
        Http::json(['learners' => $out]);
    }

    /** GET /admin/users/{id}/learning */
    public function userLearning(int $id): void
    {
        $this->admin();
        $u = Db::one('SELECT id, name, email, district, created_at, learn_nudged_at, notify_learn FROM users WHERE id = ?', [$id]); if (!$u) Http::json(['error' => 'not_found'], 404);
        $push = (int) (Db::one('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?', [$id])['n'] ?? 0);
        Http::json(['user' => ['id' => (int) $u['id'], 'name' => $u['name'], 'email' => $u['email'], 'district' => $u['district'], 'joined' => $u['created_at'], 'avatar' => Auth::picture((int) $u['id']), 'lastReminder' => $u['learn_nudged_at'], 'remindersOn' => (bool) $u['notify_learn'], 'pushDevices' => $push], 'learning' => self::learning($id)]);
    }

    /** GET /admin/users/{id}/learning/{course}/{n} : what they actually wrote for one lesson */
    public function submission(int $id, string $course, int $n): void
    {
        $this->admin();
        $c = Curriculum::find($course); if (!$c || !isset($c['lessons'][$n])) Http::json(['error' => 'not_found'], 404);
        $l = $c['lessons'][$n];
        $save = Db::one('SELECT code, updated_at FROM learn_saves WHERE user_id = ? AND course = ? AND lesson = ?', [$id, $course, $n]);
        $prog = Db::one('SELECT score, attempts, completed_at FROM learn_progress WHERE user_id = ? AND course = ? AND lesson = ?', [$id, $course, $n]);
        Http::json(['lesson' => ['title' => $l['title'], 'kind' => $l['kind'], 'lang' => $l['lang'] ?? null, 'rubric' => $l['rubric'] ?? null, 'tests' => isset($l['tests']) ? array_column($l['tests'], 'msg') : null],
            'answer' => $save ? ['text' => $save['code'], 'at' => $save['updated_at']] : null, 'progress' => $prog ? ['score' => (int) $prog['score'], 'attempts' => (int) $prog['attempts'], 'at' => $prog['completed_at']] : null]);
    }

    /** GET /learn/continue : the one course this person should pick up, for the card on their Home */
    public function continue(): void
    {
        $u = Auth::require();
        foreach (self::learning((int) $u['id'])['courses'] as $c) if ($c['status'] === 'in_progress' && $c['next']) Http::json(['course' => ['slug' => $c['slug'], 'title' => $c['title'], 'done' => $c['done'], 'lessons' => $c['lessons'], 'pct' => $c['pct'], 'next' => $c['next']]]);
        Http::json(['course' => null]);
    }

    /** POST /admin/users/{id}/notify { title, body, url } : one message to one person */
    public function notifyUser(int $id): void
    {
        $me = $this->admin(); $b = Http::body();
        $title = mb_substr(trim((string) ($b['title'] ?? '')), 0, 120); $body = mb_substr(trim((string) ($b['body'] ?? '')), 0, 300);
        if (mb_strlen($title) < 3 || mb_strlen($body) < 3) Http::json(['error' => 'validation', 'message' => 'A title and a message.'], 422);
        if (!Db::one('SELECT id FROM users WHERE id = ? AND deleted_at IS NULL', [$id])) Http::json(['error' => 'not_found'], 404);
        Notify::user($id, 'buja', $title, $body, self::safeUrl((string) ($b['url'] ?? '')), true);
        Db::run('INSERT INTO broadcasts (admin_id, audience, title, body, url, recipients, sent_at, created_at) VALUES (?,?,?,?,?,?,?,?)', [$me['id'], 'user:' . $id, $title, $body, self::safeUrl((string) ($b['url'] ?? '')), 1, Db::now(), Db::now()]);
        Http::json(['ok' => true]);
    }

    /** POST /admin/users/{id}/nudge : send this person's learning reminder now */
    public function nudgeUser(int $id): void
    {
        $this->admin();
        $sent = self::remindOne($id, true);
        Http::json(['ok' => $sent !== null, 'message' => $sent ?? 'Nothing to remind: no course in progress.']);
    }

    /* ------------------------------------------------ PERSONAL REMINDERS ------------------------------------------------ */

    /** Builds and sends one person's reminder. Returns the text sent, or null when there is nothing worth saying. */
    public static function remindOne(int $userId, bool $force = false): ?string
    {
        $u = Db::one('SELECT id, name, notify_learn, learn_nudged_at FROM users WHERE id = ? AND deleted_at IS NULL', [$userId]);
        if (!$u || (!$force && !(int) $u['notify_learn'])) return null;
        $first = explode(' ', trim((string) $u['name']))[0] ?: 'there';
        $L = self::learning($userId);
        // 1. A course in progress: name it, say how far, and what the next lesson is.
        foreach ($L['courses'] as $c) {
            if ($c['status'] !== 'in_progress' || !$c['next']) continue;
            $left = $c['lessons'] - $c['done'];
            $title = $c['done'] === 0 ? "$first, start {$c['title']}" : "$first, you are {$c['done']} of {$c['lessons']} into {$c['title']}";
            $body = 'Next: ' . $c['next']['title'] . ' (' . $c['next']['minutes'] . ' min). ' . ($left === 1 ? 'One lesson from your certificate.' : ($left <= 3 ? "$left lessons from your certificate." : 'Pick up where you stopped.'));
            Notify::user($userId, 'learn', $title, $body, '/#/learn/' . $c['slug'] . '/' . $c['next']['index']);
            Db::run('UPDATE users SET learn_nudged_at = ? WHERE id = ?', [Db::now(), $userId]);
            return "$title. $body";
        }
        // 2. Finished a course but not started the next tier.
        foreach (Curriculum::all() as $slug => $c) {
            if (empty($c['after'])) continue;
            $hasPrev = false; foreach ($L['courses'] as $x) if ($x['slug'] === $c['after'] && $x['certificate']) $hasPrev = true;
            $started = false; foreach ($L['courses'] as $x) if ($x['slug'] === $slug) $started = true;
            if ($hasPrev && !$started) {
                $title = "$first, {$c['title']} is unlocked"; $body = 'You earned the certificate before it. ' . count($c['lessons']) . ' lessons, about ' . $c['hours'] . ' hours.';
                Notify::user($userId, 'learn', $title, $body, '/#/learn/' . $slug);
                Db::run('UPDATE users SET learn_nudged_at = ? WHERE id = ?', [Db::now(), $userId]);
                return "$title. $body";
            }
        }
        return null;
    }

    /** Run by Cron in daytime: people idle 2 to 30 days in a course, not reminded in 5 days, ten per tick. */
    public static function remindBatch(int $limit): array
    {
        $st = Db::pdo()->prepare('SELECT p.user_id, MAX(p.completed_at) AS last FROM learn_progress p JOIN users u ON u.id = p.user_id WHERE u.deleted_at IS NULL AND u.notify_learn = 1 AND (u.learn_nudged_at IS NULL OR u.learn_nudged_at < ?) GROUP BY p.user_id HAVING MAX(p.completed_at) < ? AND MAX(p.completed_at) > ? LIMIT ' . (int) $limit);
        $st->execute([gmdate('Y-m-d H:i:s', time() - 5 * 86400), gmdate('Y-m-d H:i:s', time() - 2 * 86400), gmdate('Y-m-d H:i:s', time() - 30 * 86400)]);
        $sent = 0; $skipped = 0;
        foreach ($st->fetchAll() as $r) {
            if (self::remindOne((int) $r['user_id']) !== null) $sent++;
            else { Db::run('UPDATE users SET learn_nudged_at = ? WHERE id = ?', [Db::now(), $r['user_id']]); $skipped++; } // nothing to say; do not look again for 5 days
        }
        return ['sent' => $sent, 'skipped' => $skipped];
    }

    /* ------------------------------------------------ BROADCASTS ------------------------------------------------ */

    public const AUDIENCES = [
        'all' => 'Everyone', 'district' => 'Everyone in one district', 'new' => 'Joined in the last 7 days', 'no_push' => 'Notifications not switched on',
        'learners' => 'Anyone learning', 'learners_idle' => 'Learners idle 7+ days', 'certified' => 'People with a certificate', 'companies' => 'Company accounts', 'inactive' => 'Not seen in 14 days',
    ];

    private static function audienceSql(string $a, ?string $district): array
    {
        $base = 'SELECT u.id FROM users u WHERE u.deleted_at IS NULL';
        return match ($a) {
            'district' => [$base . ' AND u.district = ?', [$district]],
            'new' => [$base . ' AND u.created_at > ?', [gmdate('Y-m-d H:i:s', time() - 7 * 86400)]],
            'no_push' => [$base . ' AND NOT EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = u.id)', []],
            'learners' => [$base . ' AND EXISTS (SELECT 1 FROM learn_progress p WHERE p.user_id = u.id)', []],
            'learners_idle' => [$base . ' AND EXISTS (SELECT 1 FROM learn_progress p WHERE p.user_id = u.id) AND NOT EXISTS (SELECT 1 FROM learn_progress p WHERE p.user_id = u.id AND p.completed_at > ?)', [gmdate('Y-m-d H:i:s', time() - 7 * 86400)]],
            'certified' => [$base . ' AND EXISTS (SELECT 1 FROM certificates c WHERE c.user_id = u.id AND c.revoked_at IS NULL)', []],
            'companies' => [$base . " AND u.kind = 'company'", []],
            'inactive' => [$base . ' AND (u.last_seen_at IS NULL OR u.last_seen_at < ?)', [gmdate('Y-m-d H:i:s', time() - 14 * 86400)]],
            default => [$base, []],
        };
    }
    private static function safeUrl(string $u): string { $u = trim($u); if ($u === '') return '/#/home'; if (str_starts_with($u, '#/')) $u = '/' . $u; return preg_match('#^/\#/[A-Za-z0-9/_\-?=&.]*$#', $u) ? $u : '/#/home'; }

    /** GET /admin/broadcasts : the audiences with live counts, and history */
    public function broadcasts(): void
    {
        $this->admin();
        self::sendQueued(40); // anything still queued moves forward whenever an admin looks
        $counts = [];
        foreach (array_keys(self::AUDIENCES) as $a) { if ($a === 'district') continue; [$sql, $p] = self::audienceSql($a, null); $st = Db::pdo()->prepare('SELECT COUNT(*) AS n FROM (' . $sql . ') x'); $st->execute($p); $counts[$a] = (int) $st->fetch()['n']; }
        $hist = Db::pdo()->query('SELECT b.*, (SELECT COUNT(*) FROM broadcast_queue q WHERE q.broadcast_id = b.id) AS waiting FROM broadcasts b ORDER BY b.id DESC LIMIT 30')->fetchAll();
        Http::json(['audiences' => self::AUDIENCES, 'counts' => $counts, 'districts' => DistrictList::all(), 'history' => array_map(fn($b) => ['id' => (int) $b['id'], 'audience' => $b['audience'], 'audienceLabel' => str_starts_with($b['audience'], 'user:') ? 'One person' : (self::AUDIENCES[$b['audience']] ?? $b['audience']) . ($b['district'] ? ': ' . $b['district'] : ''), 'title' => $b['title'], 'body' => $b['body'], 'recipients' => (int) $b['recipients'], 'waiting' => (int) $b['waiting'], 'at' => $b['created_at'], 'done' => $b['sent_at'] !== null], $hist)]);
    }

    /** GET /admin/broadcasts/count?audience=&district= */
    public function count(): void
    {
        $this->admin(); $a = (string) ($_GET['audience'] ?? 'all'); if (!isset(self::AUDIENCES[$a])) $a = 'all';
        [$sql, $p] = self::audienceSql($a, $_GET['district'] ?? null); $st = Db::pdo()->prepare('SELECT COUNT(*) AS n FROM (' . $sql . ') x'); $st->execute($p);
        Http::json(['count' => (int) $st->fetch()['n']]);
    }

    /** POST /admin/broadcasts { audience, district, title, body, url, test } */
    public function send(): void
    {
        $me = $this->admin(); RateLimit::hit('broadcast', 12, 86400); $b = Http::body();
        $a = (string) ($b['audience'] ?? ''); if (!isset(self::AUDIENCES[$a])) Http::json(['error' => 'validation', 'message' => 'Choose who it goes to.'], 422);
        $district = $a === 'district' ? trim((string) ($b['district'] ?? '')) : null; if ($a === 'district' && !in_array($district, DistrictList::all(), true)) Http::json(['error' => 'validation', 'message' => 'Choose the district.'], 422);
        $title = mb_substr(trim((string) ($b['title'] ?? '')), 0, 120); $body = mb_substr(trim((string) ($b['body'] ?? '')), 0, 300);
        if (mb_strlen($title) < 3) Http::json(['error' => 'validation', 'fields' => ['title' => 'A short title.']], 422);
        if (mb_strlen($body) < 5) Http::json(['error' => 'validation', 'fields' => ['body' => 'The message itself.']], 422);
        $url = self::safeUrl((string) ($b['url'] ?? ''));
        if (!empty($b['test'])) { Notify::user((int) $me['id'], 'buja', $title, $body, $url); Http::json(['test' => true, 'message' => 'Sent to you only. Check your notifications.']); }
        [$sql, $p] = self::audienceSql($a, $district); $st = Db::pdo()->prepare($sql); $st->execute($p); $ids = array_map(fn($r) => (int) $r['id'], $st->fetchAll());
        if (!$ids) Http::json(['error' => 'validation', 'message' => 'Nobody matches that audience yet.'], 422);
        Db::run('INSERT INTO broadcasts (admin_id, audience, district, title, body, url, recipients, created_at) VALUES (?,?,?,?,?,?,?,?)', [$me['id'], $a, $district, $title, $body, $url, count($ids), Db::now()]);
        $bid = (int) Db::lastId();
        foreach (array_chunk($ids, 200) as $chunk) { $ph = implode(',', array_fill(0, count($chunk), '(?,?)')); $vals = []; foreach ($chunk as $uid) { $vals[] = $bid; $vals[] = $uid; } Db::run('INSERT INTO broadcast_queue (broadcast_id, user_id) VALUES ' . $ph, $vals); }
        $first = self::sendQueued(40);
        Http::json(['id' => $bid, 'recipients' => count($ids), 'sentNow' => $first, 'message' => count($ids) > 40 ? 'Sending in batches of 40; the rest go out over the next few minutes as people use Buja.' : 'Sent.'], 201);
    }

    /** Sends up to $limit queued messages. Called on send, when an admin opens the page, and from Cron. */
    public static function sendQueued(int $limit): int
    {
        $rows = Db::pdo()->query('SELECT q.broadcast_id, q.user_id, b.title, b.body, b.url FROM broadcast_queue q JOIN broadcasts b ON b.id = q.broadcast_id ORDER BY q.broadcast_id LIMIT ' . (int) $limit)->fetchAll();
        $n = 0; $touched = [];
        foreach ($rows as $r) {
            Db::run('DELETE FROM broadcast_queue WHERE broadcast_id = ? AND user_id = ?', [$r['broadcast_id'], $r['user_id']]); // delete first: a crash never sends twice
            Notify::user((int) $r['user_id'], 'buja', (string) $r['title'], (string) $r['body'], (string) $r['url']);
            $n++; $touched[(int) $r['broadcast_id']] = true;
        }
        foreach (array_keys($touched) as $bid) if (!Db::one('SELECT 1 AS x FROM broadcast_queue WHERE broadcast_id = ? LIMIT 1', [$bid])) Db::run('UPDATE broadcasts SET sent_at = ? WHERE id = ? AND sent_at IS NULL', [Db::now(), $bid]);
        return $n;
    }

    /* ------------------------------------------------ PUSH NUDGE ------------------------------------------------ */

    /** GET /me/engage : what the Home screen needs to decide whether to ask for notifications */
    public function me(): void
    {
        $u = Auth::require();
        $devices = (int) (Db::one('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?', [$u['id']])['n'] ?? 0);
        $row = Db::one('SELECT push_asked_at, created_at FROM users WHERE id = ?', [$u['id']]);
        Http::json(['pushDevices' => $devices, 'askedAt' => $row['push_asked_at'] ?? null, 'joined' => $row['created_at'] ?? null]);
    }
    /** POST /me/engage/asked : the person saw the prompt (and dismissed or acted on it) */
    public function asked(): void
    {
        $u = Auth::require(); Db::run('UPDATE users SET push_asked_at = ? WHERE id = ?', [Db::now(), $u['id']]); Http::json(['ok' => true]);
    }

    /** Cron: an in-app notification, once, for people a day or more old who have never switched push on. */
    public static function pushReminderBatch(int $limit): int
    {
        $st = Db::pdo()->prepare("SELECT u.id, u.name FROM users u WHERE u.deleted_at IS NULL AND u.created_at < ? AND NOT EXISTS (SELECT 1 FROM push_subscriptions s WHERE s.user_id = u.id) AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = u.id AND n.category = 'setup') LIMIT " . (int) $limit);
        $st->execute([gmdate('Y-m-d H:i:s', time() - 86400)]);
        $n = 0;
        foreach ($st->fetchAll() as $r) {
            $first = explode(' ', trim((string) $r['name']))[0] ?: 'there';
            // In-app only by definition: this person has no push device. Category 'setup' has no switch.
            Db::run('INSERT INTO notifications (user_id, category, title, body, url, created_at) VALUES (?,?,?,?,?,?)', [$r['id'], 'setup', "$first, switch on notifications", 'Without them you miss messages, interview calls, seat requests and your learning reminders. One tap.', '/#/settings', Db::now()]);
            $n++;
        }
        return $n;
    }
}

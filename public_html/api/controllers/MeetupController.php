<?php
declare(strict_types=1);

/** Meetup: things happening in Abuja that people register to attend. */
final class MeetupController
{
    public const CATS = ['tech' => 'Tech & startups', 'business' => 'Business & networking', 'party' => 'Party & nightlife', 'faith' => 'Faith', 'sport' => 'Sport & fitness', 'arts' => 'Arts & culture', 'food' => 'Food & drink', 'learning' => 'Classes & talks', 'community' => 'Community & charity', 'family' => 'Family & kids', 'celebration' => 'Celebration', 'other' => 'Other'];

    private function host(int $id): array
    {
        $u = Db::one('SELECT id, name, district FROM users WHERE id = ?', [$id]);
        $co = Db::one('SELECT name, logo_upload_id FROM companies WHERE owner_id = ?', [$id]);
        return ['id' => $id, 'name' => $co ? $co['name'] : explode(' ', trim((string) ($u['name'] ?? 'Someone')))[0], 'isCompany' => (bool) $co,
            'photo' => $co && $co['logo_upload_id'] ? '/api/uploads/' . (int) $co['logo_upload_id'] : (Db::one('SELECT 1 AS x FROM avatars WHERE user_id = ?', [$id]) ? '/api/avatar/' . $id : null),
            'rating' => RatingController::summary($id)];
    }

    private function shape(array $e, ?array $u, bool $full = false): array
    {
        $mine = $u ? Db::one('SELECT status, guests FROM meetup_rsvps WHERE event_id = ? AND user_id = ?', [$e['id'], $u['id']]) : null;
        $out = ['id' => (int) $e['id'], 'title' => $e['title'], 'category' => $e['category'], 'categoryLabel' => self::CATS[$e['category']] ?? $e['category'],
            'startsAt' => $e['starts_at'], 'endsAt' => $e['ends_at'], 'venue' => $e['venue'], 'district' => $e['district'], 'online' => $e['online_url'] ? true : false,
            'lat' => $e['lat'] !== null ? (float) $e['lat'] : null, 'lng' => $e['lng'] !== null ? (float) $e['lng'] : null,
            'capacity' => $e['capacity'] !== null ? (int) $e['capacity'] : null, 'going' => (int) $e['going'], 'price' => (int) $e['price'],
            'full' => $e['capacity'] !== null && (int) $e['going'] >= (int) $e['capacity'], 'status' => $e['status'],
            'cover' => $e['cover_upload'] ? '/api/uploads/' . (int) $e['cover_upload'] : null,
            'repeat' => $e['repeat_rule'] ?? 'none', 'seriesId' => $e['series_id'] ? (int) $e['series_id'] : null, 'tickets' => (int) ($e['ticket_count'] ?? 0),
            'myTicket' => $u ? (function () use ($e, $u) { $t = Db::one("SELECT code, qty, status FROM tickets WHERE event_id = ? AND user_id = ? AND status IN ('paid','used') ORDER BY id DESC LIMIT 1", [$e['id'], $u['id']]); return $t ? ['code' => $t['code'], 'qty' => (int) $t['qty'], 'status' => $t['status']] : null; })() : null,
            'host' => $this->host((int) $e['host_id']), 'isHost' => $u ? (int) $e['host_id'] === (int) $u['id'] : false,
            'my' => $mine ? ['status' => $mine['status'], 'guests' => (int) $mine['guests']] : null,
            'past' => $e['starts_at'] < gmdate('Y-m-d H:i:s', time() - 6 * 3600)];
        if ($full) {
            $out['description'] = $e['description']; $out['onlineUrl'] = ($out['my'] && $out['my']['status'] === 'going') || $out['isHost'] ? $e['online_url'] : null;
            $st = Db::pdo()->prepare("SELECT r.user_id, r.guests, u.name FROM meetup_rsvps r JOIN users u ON u.id = r.user_id WHERE r.event_id = ? AND r.status = 'going' ORDER BY r.created_at LIMIT 60"); $st->execute([$e['id']]);
            $out['attendees'] = array_map(fn($r) => ['id' => (int) $r['user_id'], 'name' => explode(' ', trim((string) $r['name']))[0], 'guests' => (int) $r['guests'], 'avatar' => Db::one('SELECT 1 AS x FROM avatars WHERE user_id = ?', [$r['user_id']]) ? '/api/avatar/' . (int) $r['user_id'] : null], $st->fetchAll());
            $out['waitlist'] = (int) (Db::one("SELECT COUNT(*) AS n FROM meetup_rsvps WHERE event_id = ? AND status = 'waitlist'", [$e['id']])['n'] ?? 0);
            $ps = Db::pdo()->prepare('SELECT p.*, u.name FROM meetup_posts p JOIN users u ON u.id = p.user_id WHERE p.event_id = ? ORDER BY p.id DESC LIMIT 40'); $ps->execute([$e['id']]);
            $out['posts'] = array_map(fn($p) => ['id' => (int) $p['id'], 'body' => $p['body'], 'update' => (bool) $p['is_update'], 'by' => explode(' ', trim((string) $p['name']))[0], 'mine' => $u && (int) $p['user_id'] === (int) $u['id'], 'at' => $p['created_at']], $ps->fetchAll());
        }
        return $out;
    }

    /** GET /events?when=upcoming|weekend|mine|hosting&category=&district=&q= */
    public function index(): void
    {
        $u = Auth::require(); $q = $_GET;
        $where = ["e.status = 'live'", 'e.hidden_at IS NULL']; $p = [];
        $when = (string) ($q['when'] ?? 'upcoming');
        if ($when === 'mine') { $where[] = "e.id IN (SELECT event_id FROM meetup_rsvps WHERE user_id = ? AND status <> 'cancelled')"; $p[] = $u['id']; }
        elseif ($when === 'hosting') { $where = ['e.host_id = ?']; $p[] = $u['id']; }
        elseif ($when === 'weekend') { $sat = strtotime('next saturday', time() - 86400); if (date('N') >= 6) $sat = strtotime('today'); $where[] = 'e.starts_at BETWEEN ? AND ?'; $p[] = gmdate('Y-m-d 00:00:00', $sat); $p[] = gmdate('Y-m-d 23:59:59', $sat + 86400); }
        else { $where[] = 'e.starts_at > ?'; $p[] = gmdate('Y-m-d H:i:s', time() - 3 * 3600); }
        if (!empty($q['category']) && isset(self::CATS[$q['category']])) { $where[] = 'e.category = ?'; $p[] = $q['category']; }
        if (!empty($q['district'])) { $where[] = 'e.district = ?'; $p[] = $q['district']; }
        if (!empty($q['q'])) { $where[] = '(e.title LIKE ? OR e.description LIKE ? OR e.venue LIKE ?)'; $like = '%' . $q['q'] . '%'; array_push($p, $like, $like, $like); }
        $st = Db::pdo()->prepare('SELECT e.* FROM meetups e WHERE ' . implode(' AND ', $where) . ' ORDER BY e.starts_at ' . ($when === 'hosting' ? 'DESC' : 'ASC') . ' LIMIT 60'); $st->execute($p);
        Http::json(['events' => array_map(fn($e) => $this->shape($e, $u), $st->fetchAll()), 'categories' => self::CATS]);
    }

    /** GET /events/{id} */
    public function show(int $id): void
    {
        $u = Auth::require();
        $e = Db::one('SELECT * FROM meetups WHERE id = ?', [$id]); if (!$e) Http::json(['error' => 'not_found', 'message' => 'That event is gone.'], 404);
        Http::json(['event' => $this->shape($e, $u, true)]);
    }

    /** POST /events */
    public function create(): void
    {
        $u = Auth::require(); RateLimit::hit('event', 10, 86400);
        $b = Http::body(); $e = [];
        $title = mb_substr(trim((string) ($b['title'] ?? '')), 0, 120); if (mb_strlen($title) < 4) $e['title'] = 'Give it a name.';
        $cat = (string) ($b['category'] ?? ''); if (!isset(self::CATS[$cat])) $e['category'] = 'Pick a category.';
        $desc = mb_substr(trim((string) ($b['description'] ?? '')), 0, 4000); if (mb_strlen($desc) < 20) $e['description'] = 'Tell people what to expect, at least a couple of lines.';
        $ts = strtotime((string) ($b['startsAt'] ?? '')); if (!$ts || $ts < time() - 3600) $e['startsAt'] = 'Pick a date and time in the future.';
        $end = !empty($b['endsAt']) ? strtotime((string) $b['endsAt']) : null; if ($end && $ts && $end <= $ts) $e['endsAt'] = 'The end must be after the start.';
        $venue = mb_substr(trim((string) ($b['venue'] ?? '')), 0, 160); $online = !empty($b['onlineUrl']) ? mb_substr(trim((string) $b['onlineUrl']), 0, 300) : null;
        if ($venue === '' && !$online) $e['venue'] = 'Where is it? A venue, or a link if it is online.';
        if ($online && !preg_match('#^https?://#i', $online)) $e['onlineUrl'] = 'Paste the full link, starting with https://';
        $district = mb_substr(trim((string) ($b['district'] ?? ($u['district'] ?? ''))), 0, 60); if ($district === '') $e['district'] = 'Which district?';
        if ($e) Http::json(['error' => 'validation', 'fields' => $e], 422);
        $cover = !empty($b['coverUploadId']) ? UploadsController::claim((int) $b['coverUploadId'], $u) : null;
        Db::run('INSERT INTO meetups (host_id, title, category, description, starts_at, ends_at, venue, district, lat, lng, online_url, capacity, price, cover_upload, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [$u['id'], $title, $cat, $desc, gmdate('Y-m-d H:i:s', $ts), $end ? gmdate('Y-m-d H:i:s', $end) : null, $venue ?: 'Online', $district,
             !empty($b['lat']) ? (float) $b['lat'] : null, !empty($b['lng']) ? (float) $b['lng'] : null, $online, !empty($b['capacity']) ? max(1, (int) $b['capacity']) : null, max(0, (int) ($b['price'] ?? 0)), $cover, Db::now()]);
        $id = (int) Db::lastId();
        $repeat = in_array($b['repeat'] ?? 'none', ['weekly', 'fortnightly', 'monthly'], true) ? $b['repeat'] : 'none';
        if ($repeat !== 'none') {
            Db::run('UPDATE meetups SET repeat_rule = ?, series_id = ? WHERE id = ?', [$repeat, $id, $id]);
            $step = ['weekly' => '+1 week', 'fortnightly' => '+2 weeks', 'monthly' => '+1 month'][$repeat];
            $row = Db::one('SELECT * FROM meetups WHERE id = ?', [$id]);
            $s = $ts; $e2 = $end;
            for ($i = 0; $i < 7; $i++) {
                $s = strtotime($step, $s); $e2 = $e2 ? strtotime($step, $e2) : null;
                Db::run('INSERT INTO meetups (host_id, title, category, description, starts_at, ends_at, venue, district, lat, lng, online_url, capacity, price, cover_upload, repeat_rule, series_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
                    [$u['id'], $row['title'], $row['category'], $row['description'], gmdate('Y-m-d H:i:s', $s), $e2 ? gmdate('Y-m-d H:i:s', $e2) : null, $row['venue'], $row['district'], $row['lat'], $row['lng'], $row['online_url'], $row['capacity'], $row['price'], $row['cover_upload'], $repeat, $id, Db::now()]);
            }
        }
        Track::hit($u, 'meetup', 'create');
        Http::json(['event' => $this->shape(Db::one('SELECT * FROM meetups WHERE id = ?', [$id]), $u, true)], 201);
    }

    /** POST /events/{id}/rsvp { going: true|false, guests } */
    public function rsvp(int $id): void
    {
        $u = Auth::require(); RateLimit::hit('rsvp', 60, 86400);
        $e = Db::one("SELECT * FROM meetups WHERE id = ? AND status = 'live'", [$id]); if (!$e) Http::json(['error' => 'not_found'], 404);
        $b = Http::body(); $going = !empty($b['going']); $guests = max(0, min(5, (int) ($b['guests'] ?? 0)));
        if ($going && (int) $e['price'] > 0 && !Db::one("SELECT id FROM tickets WHERE event_id = ? AND user_id = ? AND status IN ('paid','used')", [$id, $u['id']])) Http::json(['error' => 'ticket', 'message' => 'This event is paid. Buy a ticket and you are in.'], 402);
        $cur = Db::one('SELECT * FROM meetup_rsvps WHERE event_id = ? AND user_id = ?', [$id, $u['id']]);
        if (!$going) {
            if ($cur && $cur['status'] !== 'cancelled') {
                Db::run("UPDATE meetup_rsvps SET status = 'cancelled' WHERE event_id = ? AND user_id = ?", [$id, $u['id']]);
                $this->recount($id);
                // A spot opened: promote the first person waiting.
                $next = Db::one("SELECT user_id FROM meetup_rsvps WHERE event_id = ? AND status = 'waitlist' ORDER BY created_at LIMIT 1", [$id]);
                if ($next && ($e['capacity'] === null || (int) Db::one('SELECT going FROM meetups WHERE id = ?', [$id])['going'] < (int) $e['capacity'])) {
                    Db::run("UPDATE meetup_rsvps SET status = 'going' WHERE event_id = ? AND user_id = ?", [$id, $next['user_id']]); $this->recount($id);
                    Notify::user((int) $next['user_id'], 'offers', 'A spot opened at ' . $e['title'], 'You are in. See you there.', '/#/meetup/' . $id);
                }
            }
            Http::json(['event' => $this->shape(Db::one('SELECT * FROM meetups WHERE id = ?', [$id]), $u, true)]);
        }
        $seats = 1 + $guests;
        $room = $e['capacity'] === null || ((int) $e['going'] - ($cur && $cur['status'] === 'going' ? 1 + (int) $cur['guests'] : 0) + $seats) <= (int) $e['capacity'];
        $status = $room ? 'going' : 'waitlist';
        if ($cur) Db::run('UPDATE meetup_rsvps SET status = ?, guests = ?, created_at = CASE WHEN status = ? THEN created_at ELSE ? END WHERE event_id = ? AND user_id = ?', [$status, $guests, $status, Db::now(), $id, $u['id']]);
        else Db::run('INSERT INTO meetup_rsvps (event_id, user_id, status, guests, created_at) VALUES (?,?,?,?,?)', [$id, $u['id'], $status, $guests, Db::now()]);
        $this->recount($id);
        Track::hit($u, 'meetup', $status);
        if ((int) $e['host_id'] !== (int) $u['id']) Notify::user((int) $e['host_id'], 'offers', explode(' ', trim((string) $u['name']))[0] . ($status === 'going' ? ' is coming to ' : ' joined the waitlist for ') . $e['title'], (int) Db::one('SELECT going FROM meetups WHERE id = ?', [$id])['going'] . ' going so far.', '/#/meetup/' . $id);
        Http::json(['event' => $this->shape(Db::one('SELECT * FROM meetups WHERE id = ?', [$id]), $u, true)]);
    }
    private function recount(int $id): void
    {
        Db::run("UPDATE meetups SET going = (SELECT COALESCE(SUM(1 + guests), 0) FROM meetup_rsvps WHERE event_id = ? AND status = 'going') WHERE id = ?", [$id, $id]);
    }

    /** POST /events/{id}/posts { body } : a comment, or a host update that notifies everyone going */
    public function post(int $id): void
    {
        $u = Auth::require(); RateLimit::hit('eventpost', 60, 3600);
        $e = Db::one('SELECT * FROM meetups WHERE id = ?', [$id]); if (!$e) Http::json(['error' => 'not_found'], 404);
        $body = mb_substr(trim((string) (Http::body()['body'] ?? '')), 0, 1500); if (mb_strlen($body) < 2) Http::json(['error' => 'validation', 'fields' => ['body' => 'Write something.']], 422);
        $isHost = (int) $e['host_id'] === (int) $u['id'];
        Db::run('INSERT INTO meetup_posts (event_id, user_id, body, is_update, created_at) VALUES (?,?,?,?,?)', [$id, $u['id'], $body, $isHost ? 1 : 0, Db::now()]);
        if ($isHost) {
            $st = Db::pdo()->prepare("SELECT user_id FROM meetup_rsvps WHERE event_id = ? AND status IN ('going','waitlist')"); $st->execute([$id]);
            foreach ($st->fetchAll() as $r) Notify::user((int) $r['user_id'], 'offers', 'Update: ' . $e['title'], mb_substr($body, 0, 120), '/#/meetup/' . $id);
        }
        $this->show($id);
    }

    /** POST /events/{id}/cancel : host only, tells everyone */
    public function cancel(int $id): void
    {
        $u = Auth::require();
        $e = Db::one('SELECT * FROM meetups WHERE id = ? AND host_id = ?', [$id, $u['id']]); if (!$e) Http::json(['error' => 'not_found'], 404);
        $all = !empty(Http::body()['series']) && $e['series_id'];
        if ($all) Db::run("UPDATE meetups SET status = 'cancelled' WHERE series_id = ? AND starts_at >= ?", [$e['series_id'], $e['starts_at']]);
        else Db::run("UPDATE meetups SET status = 'cancelled' WHERE id = ?", [$id]);
        $st = Db::pdo()->prepare("SELECT user_id FROM meetup_rsvps WHERE event_id = ? AND status IN ('going','waitlist')"); $st->execute([$id]);
        foreach ($st->fetchAll() as $r) Notify::user((int) $r['user_id'], 'offers', 'Cancelled: ' . $e['title'], 'The host called it off. Sorry.', '/#/meetup');
        Http::json(['ok' => true]);
    }

    /** POST /events/{id}/checkin { userId } : host marks someone as arrived */
    public function checkin(int $id): void
    {
        $u = Auth::require();
        if (!Db::one('SELECT id FROM meetups WHERE id = ? AND host_id = ?', [$id, $u['id']])) Http::json(['error' => 'forbidden'], 403);
        Db::run("UPDATE meetup_rsvps SET checked_in = ? WHERE event_id = ? AND user_id = ? AND status = 'going'", [Db::now(), $id, (int) (Http::body()['userId'] ?? 0)]);
        $this->show($id);
    }

    /** GET /events/{id}/ics : an .ics file so it lands in the phone calendar */
    public function ics(int $id): void
    {
        Auth::require();
        $e = Db::one('SELECT * FROM meetups WHERE id = ?', [$id]); if (!$e) Http::json(['error' => 'not_found'], 404);
        $fmt = fn($s) => gmdate('Ymd\THis\Z', strtotime($s . ' UTC'));
        $esc = fn($s) => str_replace(["\\", ';', ',', "\n"], ["\\\\", '\;', '\,', '\n'], (string) $s);
        $ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Buja//Meetup//EN\r\nBEGIN:VEVENT\r\nUID:buja-event-" . (int) $e['id'] . "@buja\r\nDTSTAMP:" . gmdate('Ymd\THis\Z') . "\r\nDTSTART:" . $fmt($e['starts_at']) . "\r\n" . ($e['ends_at'] ? 'DTEND:' . $fmt($e['ends_at']) . "\r\n" : '') . 'SUMMARY:' . $esc($e['title']) . "\r\nLOCATION:" . $esc($e['venue'] . ', ' . $e['district'] . ', Abuja') . "\r\nDESCRIPTION:" . $esc(mb_substr($e['description'], 0, 500)) . "\r\nURL:" . (string) Http::config('app_origin') . '/#/meetup/' . (int) $e['id'] . "\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
        header('Content-Type: text/calendar; charset=utf-8'); header('Content-Disposition: attachment; filename="buja-event-' . (int) $e['id'] . '.ics"'); echo $ics; exit;
    }
}

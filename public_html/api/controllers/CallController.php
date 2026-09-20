<?php
declare(strict_types=1);

/**
 * Video and audio calls, held inside Buja. Rooms run on Jitsi, embedded in a Buja screen so nobody is sent
 * off to another app. Room names are long random strings, so a room cannot be guessed or wandered into.
 */
final class CallController
{
    private function thread(int $id, array $u): array
    {
        $t = Db::one('SELECT * FROM threads WHERE id = ? AND (user_a = ? OR user_b = ?)', [$id, $u['id'], $u['id']]);
        if (!$t) Http::json(['error' => 'not_found', 'message' => 'That conversation is not yours.'], 404);
        return $t;
    }
    private function other(array $t, array $u): int { return (int) $t['user_a'] === (int) $u['id'] ? (int) $t['user_b'] : (int) $t['user_a']; }

    public static function shape(array $c): array
    {
        return ['id' => (int) $c['id'], 'room' => $c['room'], 'kind' => $c['kind'], 'mode' => $c['mode'],
            'engine' => $c['engine'] ?? ($c['kind'] === 'interview' ? 'jitsi' : 'rtc'), 'status' => $c['status'] ?? 'ringing',
            'startsAt' => $c['starts_at'], 'endedAt' => $c['ended_at'],
            'joinable' => $c['ended_at'] === null && ($c['starts_at'] === null || $c['starts_at'] < gmdate('Y-m-d H:i:s', time() + 900))];
    }

    /**
     * Where the two phones should meet. STUN is free and public; TURN is the relay used when a network will
     * not allow a direct connection, which is common on Nigerian mobile data. Set TURN_URL to add one.
     */
    private function iceServers(): array
    {
        $ice = [['urls' => ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302']]];
        $turn = (string) Http::config('turn_url', '');
        if ($turn !== '') $ice[] = ['urls' => array_map('trim', explode(',', $turn)), 'username' => (string) Http::config('turn_user', ''), 'credential' => (string) Http::config('turn_pass', '')];
        return $ice;
    }

    /** POST /threads/{id}/call { mode: video|audio, startsAt } : ring now, or book a time */
    public function create(int $id): void
    {
        $u = Auth::require(); RateLimit::hit('call', 40, 3600);
        $t = $this->thread($id, $u); $b = Http::body();
        $mode = ($b['mode'] ?? 'video') === 'audio' ? 'audio' : 'video';
        $kind = in_array($t['kind'], ['application', 'job'], true) ? 'interview' : 'match';
        $startsAt = null;
        if (!empty($b['startsAt'])) { $ts = strtotime((string) $b['startsAt']); if (!$ts || $ts < time() - 3600) Http::json(['error' => 'validation', 'fields' => ['startsAt' => 'Pick a time in the future.']], 422); $startsAt = gmdate('Y-m-d H:i:s', $ts); }
        $room = 'buja-' . bin2hex(random_bytes(16));
        $engine = 'rtc'; // every call, interviews included, runs phone to phone inside Buja
        Db::run('INSERT INTO calls (room, kind, mode, engine, status, callee, thread_id, created_by, starts_at, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [$room, $kind, $mode, $engine, 'ringing', $this->other($t, $u), $id, $u['id'], $startsAt, Db::now()]);
        $callId = (int) Db::lastId();
        $meta = json_encode(['callId' => $callId, 'room' => $room, 'mode' => $mode, 'engine' => $engine, 'startsAt' => $startsAt]);
        $body = $startsAt ? ($mode === 'audio' ? 'Audio call booked' : 'Video call booked') : ($mode === 'audio' ? 'Audio call started' : 'Video call started');
        Db::run('INSERT INTO messages (thread_id, sender_id, type, body, meta, created_at) VALUES (?,?,?,?,?,?)', [$id, $u['id'], 'call', $body, $meta, Db::now()]);
        Db::run('UPDATE threads SET last_message_at = ? WHERE id = ?', [Db::now(), $id]);
        Track::hit($u, 'call', $startsAt ? 'schedule' : 'start');
        $name = explode(' ', trim((string) $u['name']))[0];
        Notify::user($this->other($t, $u), $kind === 'interview' ? 'work' : 'match',
            $startsAt ? $name . ' booked a ' . $mode . ' call' : $name . ' is calling',
            $startsAt ? 'On ' . date('D j M, H:i', strtotime($startsAt . ' UTC')) . '. Open Buja to join.' : ($mode === 'audio' ? 'Incoming call on Buja' : 'Incoming video call on Buja'),
            $startsAt ? '/#/inbox/' . $id : '/#/rtc/' . $room, true,
            $startsAt ? [] : ['ring' => true, 'room' => $room, 'mode' => $mode]);
        Http::json(['call' => self::shape(Db::one('SELECT * FROM calls WHERE id = ?', [$callId]))], 201);
    }

    /** GET /call/{room} : the details needed to join, and who you are joining */
    public function show(string $room): void
    {
        $u = Auth::require();
        $c = Db::one('SELECT * FROM calls WHERE room = ?', [$room]); if (!$c) Http::json(['error' => 'not_found', 'message' => 'That call does not exist.'], 404);
        $t = $this->thread((int) $c['thread_id'], $u);
        if ($c['ended_at']) Http::json(['error' => 'ended', 'message' => 'That call has ended.'], 410);
        if ($c['starts_at'] && $c['starts_at'] > gmdate('Y-m-d H:i:s', time() + 900)) Http::json(['error' => 'early', 'message' => 'That call opens 15 minutes before the scheduled time.'], 425);
        if (($c['status'] ?? '') === 'declined') Http::json(['error' => 'declined', 'message' => 'That call was declined.'], 410);
        Db::run('UPDATE calls SET joined_at = COALESCE(joined_at, ?) WHERE id = ?', [Db::now(), $c['id']]);
        $o = Db::one('SELECT name FROM users WHERE id = ?', [$this->other($t, $u)]);
        Http::json(['call' => self::shape($c) + ['threadId' => (int) $c['thread_id'], 'with' => explode(' ', trim((string) ($o['name'] ?? 'Someone')))[0],
            'me' => explode(' ', trim((string) $u['name']))[0], 'domain' => (string) Http::config('jitsi_domain', 'meet.jit.si'),
            'caller' => (int) $c['created_by'] === (int) $u['id'], 'ice' => $this->iceServers()]]);
    }

    /** POST /call/{room}/signal { kind, payload } : one step of the handshake, passed to the other phone. */
    public function signal(string $room): void
    {
        $u = Auth::require();
        $c = Db::one('SELECT * FROM calls WHERE room = ?', [$room]); if (!$c) Http::json(['error' => 'not_found'], 404);
        $this->thread((int) $c['thread_id'], $u);
        $b = Http::body();
        $kind = (string) ($b['kind'] ?? ''); if (!in_array($kind, ['offer', 'answer', 'ice', 'accept', 'busy'], true)) Http::json(['error' => 'validation'], 422);
        $payload = json_encode($b['payload'] ?? null);
        if (strlen((string) $payload) > 60000) Http::json(['error' => 'validation', 'message' => 'Signal too large.'], 422);
        Db::run('INSERT INTO call_signals (call_id, from_user, kind, payload, created_at) VALUES (?,?,?,?,?)', [$c['id'], $u['id'], $kind, $payload, Db::now()]);
        if ($kind === 'answer' || $kind === 'accept') Db::run("UPDATE calls SET status = 'active', joined_at = COALESCE(joined_at, ?) WHERE id = ?", [Db::now(), $c['id']]);
        Http::json(['ok' => true]);
    }

    /** GET /call/{room}/signals?since=N : everything the other side has sent since you last asked. */
    public function signals(string $room): void
    {
        $u = Auth::require();
        $c = Db::one('SELECT * FROM calls WHERE room = ?', [$room]); if (!$c) Http::json(['error' => 'not_found'], 404);
        $this->thread((int) $c['thread_id'], $u);
        $since = (int) ($_GET['since'] ?? 0);
        $st = Db::pdo()->prepare('SELECT id, kind, payload FROM call_signals WHERE call_id = ? AND from_user <> ? AND id > ? ORDER BY id ASC LIMIT 60');
        $st->execute([$c['id'], $u['id'], $since]);
        $rows = array_map(fn($r) => ['id' => (int) $r['id'], 'kind' => $r['kind'], 'payload' => json_decode($r['payload'], true)], $st->fetchAll());
        Http::json(['signals' => $rows, 'status' => $c['status'] ?? 'ringing', 'ended' => $c['ended_at'] !== null]);
    }

    /** GET /call/incoming : is anyone ringing me right now? Used by the app while it is open. */
    public function incoming(): void
    {
        $u = Auth::require();
        $c = Db::one("SELECT c.*, u.name FROM calls c JOIN users u ON u.id = c.created_by
                      WHERE c.callee = ? AND c.status = 'ringing' AND c.ended_at IS NULL AND c.starts_at IS NULL AND c.created_at > ?
                      ORDER BY c.id DESC LIMIT 1", [$u['id'], gmdate('Y-m-d H:i:s', time() - 45)]);
        if (!$c) Http::json(['call' => null]);
        Http::json(['call' => self::shape($c) + ['from' => explode(' ', trim((string) $c['name']))[0], 'threadId' => (int) $c['thread_id']]]);
    }

    /** POST /call/{room}/decline */
    public function decline(string $room): void
    {
        $u = Auth::require();
        $c = Db::one('SELECT * FROM calls WHERE room = ?', [$room]); if (!$c) Http::json(['error' => 'not_found'], 404);
        $t = $this->thread((int) $c['thread_id'], $u);
        Db::run("UPDATE calls SET status = 'declined', ended_at = ? WHERE id = ? AND ended_at IS NULL", [Db::now(), $c['id']]);
        Notify::user((int) $c['created_by'], 'match', explode(' ', trim((string) $u['name']))[0] . ' could not take the call', 'Try again later, or send a message.', '/#/inbox/' . (int) $c['thread_id']);
        Http::json(['ok' => true]);
    }

    /** POST /call/{room}/end */
    public function end(string $room): void
    {
        $u = Auth::require();
        $c = Db::one('SELECT * FROM calls WHERE room = ?', [$room]); if (!$c) Http::json(['error' => 'not_found'], 404);
        $this->thread((int) $c['thread_id'], $u);
        if (!$c['ended_at']) Db::run("UPDATE calls SET ended_at = ?, status = CASE WHEN status = 'ringing' THEN 'missed' ELSE 'ended' END WHERE id = ?", [Db::now(), $c['id']]);
        Http::json(['ok' => true]);
    }
}

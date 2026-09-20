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
            'startsAt' => $c['starts_at'], 'endedAt' => $c['ended_at'],
            'joinable' => $c['ended_at'] === null && ($c['starts_at'] === null || $c['starts_at'] < gmdate('Y-m-d H:i:s', time() + 900))];
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
        Db::run('INSERT INTO calls (room, kind, mode, thread_id, created_by, starts_at, created_at) VALUES (?,?,?,?,?,?,?)', [$room, $kind, $mode, $id, $u['id'], $startsAt, Db::now()]);
        $callId = (int) Db::lastId();
        $meta = json_encode(['callId' => $callId, 'room' => $room, 'mode' => $mode, 'startsAt' => $startsAt]);
        $body = $startsAt ? ($mode === 'audio' ? 'Audio call booked' : 'Video call booked') : ($mode === 'audio' ? 'Audio call started' : 'Video call started');
        Db::run('INSERT INTO messages (thread_id, sender_id, type, body, meta, created_at) VALUES (?,?,?,?,?,?)', [$id, $u['id'], 'call', $body, $meta, Db::now()]);
        Db::run('UPDATE threads SET last_message_at = ? WHERE id = ?', [Db::now(), $id]);
        Track::hit($u, 'call', $startsAt ? 'schedule' : 'start');
        $name = explode(' ', trim((string) $u['name']))[0];
        Notify::user($this->other($t, $u), $kind === 'interview' ? 'work' : 'match',
            $startsAt ? $name . ' booked a ' . $mode . ' call' : $name . ' is calling',
            $startsAt ? 'On ' . date('D j M, H:i', strtotime($startsAt . ' UTC')) . '. Open Buja to join.' : 'Tap to join the call in Buja.',
            '/#/inbox/' . $id, true);
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
        Db::run('UPDATE calls SET joined_at = COALESCE(joined_at, ?) WHERE id = ?', [Db::now(), $c['id']]);
        $o = Db::one('SELECT name FROM users WHERE id = ?', [$this->other($t, $u)]);
        Http::json(['call' => self::shape($c) + ['threadId' => (int) $c['thread_id'], 'with' => explode(' ', trim((string) ($o['name'] ?? 'Someone')))[0],
            'me' => explode(' ', trim((string) $u['name']))[0], 'domain' => (string) Http::config('jitsi_domain', 'meet.jit.si')]]);
    }

    /** POST /call/{room}/end */
    public function end(string $room): void
    {
        $u = Auth::require();
        $c = Db::one('SELECT * FROM calls WHERE room = ?', [$room]); if (!$c) Http::json(['error' => 'not_found'], 404);
        $this->thread((int) $c['thread_id'], $u);
        if (!$c['ended_at']) Db::run('UPDATE calls SET ended_at = ? WHERE id = ?', [Db::now(), $c['id']]);
        Http::json(['ok' => true]);
    }
}

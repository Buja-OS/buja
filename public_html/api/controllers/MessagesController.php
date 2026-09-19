<?php
declare(strict_types=1);

final class MessagesController
{
    private function threadFor(int $threadId, array $u): array
    {
        $t = Db::one('SELECT * FROM threads WHERE id = ? AND (user_a = ? OR user_b = ?)', [$threadId, $u['id'], $u['id']]);
        if ($t === null) Http::json(['error' => 'not_found', 'message' => 'No such conversation.'], 404);
        return $t;
    }
    private function other(array $t, array $u): int { return (int) ((int) $t['user_a'] === (int) $u['id'] ? $t['user_b'] : $t['user_a']); }

    private function shapeMessage(array $m, int $me): array
    {
        return ['id' => (int) $m['id'], 'mine' => (int) $m['sender_id'] === $me, 'type' => $m['type'], 'body' => $m['body'], 'meta' => $m['meta'] ? json_decode($m['meta'], true) : null, 'createdAt' => $m['created_at']];
    }

    /** GET /inbox */
    public function inbox(): void
    {
        $u = Auth::require();
        $sql = 'SELECT t.*, o.name AS other_name, o.kind AS other_kind, c.name AS company_name, j.title AS job_title, j.id AS job_id,
                       (SELECT body FROM messages m WHERE m.thread_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_body,
                       (SELECT type FROM messages m WHERE m.thread_id = t.id ORDER BY m.id DESC LIMIT 1) AS last_type,
                       (SELECT COUNT(*) FROM messages m WHERE m.thread_id = t.id AND m.sender_id <> ? AND m.id > COALESCE((SELECT last_read_id FROM thread_reads r WHERE r.thread_id = t.id AND r.user_id = ?), 0)) AS unread
                FROM threads t
                JOIN users o ON o.id = CASE WHEN t.user_a = ? THEN t.user_b ELSE t.user_a END
                LEFT JOIN applications a ON a.id = t.application_id LEFT JOIN jobs j ON j.id = a.job_id LEFT JOIN companies c ON c.id = j.company_id
                WHERE t.user_a = ? OR t.user_b = ? ORDER BY t.last_message_at DESC';
        $st = Db::pdo()->prepare($sql); $st->execute([$u['id'], $u['id'], $u['id'], $u['id'], $u['id']]);
        $rows = array_map(fn($t) => [
            'id' => (int) $t['id'], 'kind' => $t['kind'], 'unread' => (int) $t['unread'], 'lastAt' => $t['last_message_at'],
            'title' => $u['kind'] === 'company' ? $t['other_name'] : ($t['company_name'] ?? $t['other_name']),
            'subtitle' => $t['job_title'] ? ($u['kind'] === 'company' ? 'Applied for ' . $t['job_title'] : $t['job_title']) : '',
            'preview' => $t['last_type'] === 'interview' ? 'Interview invitation' : ($t['last_body'] ?? ''),
            'jobId' => $t['job_id'] ? (int) $t['job_id'] : null,
        ], $st->fetchAll());
        Http::json(['threads' => $rows, 'unread' => array_sum(array_column($rows, 'unread'))]);
    }

    /** GET /threads/{id}?after=<messageId> */
    public function show(int $id): void
    {
        $u = Auth::require(); $t = $this->threadFor($id, $u);
        $after = (int) ($_GET['after'] ?? 0);
        $st = Db::pdo()->prepare('SELECT * FROM messages WHERE thread_id = ? AND id > ? ORDER BY id ASC LIMIT 200'); $st->execute([$id, $after]);
        $msgs = array_map(fn($m) => $this->shapeMessage($m, (int) $u['id']), $st->fetchAll());
        $last = $msgs ? end($msgs)['id'] : $after;
        if ($last) {
            if (Db::one('SELECT 1 AS x FROM thread_reads WHERE thread_id = ? AND user_id = ?', [$id, $u['id']])) Db::run('UPDATE thread_reads SET last_read_id = ? WHERE thread_id = ? AND user_id = ? AND last_read_id < ?', [$last, $id, $u['id'], $last]);
            else Db::run('INSERT INTO thread_reads (thread_id, user_id, last_read_id) VALUES (?,?,?)', [$id, $u['id'], $last]);
        }
        $out = ['id' => $id, 'messages' => $msgs];
        if ($after === 0) {
            $o = Db::one('SELECT id, name, kind FROM users WHERE id = ?', [$this->other($t, $u)]);
            $ctx = null;
            if ($t['application_id']) {
                $a = Db::one('SELECT a.id, a.status, a.match_score, j.id AS job_id, j.title, c.name AS company FROM applications a JOIN jobs j ON j.id = a.job_id JOIN companies c ON c.id = j.company_id WHERE a.id = ?', [$t['application_id']]);
                if ($a) $ctx = ['applicationId' => (int) $a['id'], 'status' => $a['status'], 'match' => (int) $a['match_score'], 'jobId' => (int) $a['job_id'], 'jobTitle' => $a['title'], 'company' => $a['company']];
            }
            $out['other'] = ['id' => (int) $o['id'], 'name' => $o['name'], 'kind' => $o['kind']];
            $out['title'] = $u['kind'] === 'company' ? $o['name'] : ($ctx['company'] ?? $o['name']);
            $out['context'] = $ctx; $out['canSchedule'] = $u['kind'] === 'company' && $ctx !== null;
        }
        Http::json($out);
    }

    /** POST /threads/{id}/messages { body } */
    public function send(int $id): void
    {
        $u = Auth::require(); $t = $this->threadFor($id, $u);
        RateLimit::hit('msg', 120, 3600);
        $body = trim((string) (Http::body()['body'] ?? '')); if ($body === '' || mb_strlen($body) > 2000) Http::json(['error' => 'validation', 'fields' => ['body' => 'Write something, up to 2000 characters.']], 422);
        Db::run('INSERT INTO messages (thread_id, sender_id, type, body, created_at) VALUES (?,?,?,?,?)', [$id, $u['id'], 'text', $body, Db::now()]);
        $mid = Db::lastId();
        Db::run('UPDATE threads SET last_message_at = ? WHERE id = ?', [Db::now(), $id]);
        Notify::user($this->other($t, $u), 'work', $u['kind'] === 'company' ? ($this->companyName($u) . ' sent you a message') : $u['name'] . ' sent you a message', mb_substr($body, 0, 120), '/#/inbox/' . $id);
        Http::json(['message' => $this->shapeMessage(Db::one('SELECT * FROM messages WHERE id = ?', [$mid]), (int) $u['id'])], 201);
    }

    /** POST /applications/{id}/thread : open (or fetch) the conversation for an application */
    public function openForApplication(int $appId): void
    {
        $u = Auth::require();
        $a = Db::one('SELECT a.*, j.company_id, c.owner_id FROM applications a JOIN jobs j ON j.id = a.job_id JOIN companies c ON c.id = j.company_id WHERE a.id = ?', [$appId]);
        if ($a === null) Http::json(['error' => 'not_found'], 404);
        $isOwner = (int) $a['owner_id'] === (int) $u['id']; $isApplicant = (int) $a['user_id'] === (int) $u['id'];
        if (!$isOwner && !$isApplicant) Http::json(['error' => 'forbidden'], 403);
        $t = Db::one('SELECT * FROM threads WHERE application_id = ?', [$appId]);
        if ($t === null) {
            Db::run('INSERT INTO threads (kind, application_id, user_a, user_b, last_message_at, created_at) VALUES (?,?,?,?,?,?)', ['work', $appId, $a['owner_id'], $a['user_id'], Db::now(), Db::now()]);
            $t = ['id' => Db::lastId()];
        }
        Http::json(['threadId' => (int) $t['id']]);
    }

    /** POST /threads/{id}/interview { at: 'YYYY-MM-DD HH:MM', place, with, note } (company only) */
    public function invite(int $id): void
    {
        $u = Auth::require(); $t = $this->threadFor($id, $u);
        if ($u['kind'] !== 'company' || !$t['application_id']) Http::json(['error' => 'forbidden', 'message' => 'Only the hiring company can schedule an interview.'], 403);
        $b = Http::body(); $errors = [];
        $at = trim((string) ($b['at'] ?? '')); $place = mb_substr(trim((string) ($b['place'] ?? '')), 0, 160); $with = mb_substr(trim((string) ($b['with'] ?? '')), 0, 120); $note = mb_substr(trim((string) ($b['note'] ?? '')), 0, 400);
        $ts = strtotime($at);
        if (!$ts || $ts < time()) $errors['at'] = 'Pick a date and time in the future.';
        if ($place === '') $errors['place'] = 'Where is the interview?';
        if ($errors) Http::json(['error' => 'validation', 'fields' => $errors], 422);
        $meta = ['at' => gmdate('Y-m-d H:i', $ts), 'place' => $place, 'with' => $with, 'note' => $note, 'status' => 'pending'];
        Db::run('INSERT INTO messages (thread_id, sender_id, type, body, meta, created_at) VALUES (?,?,?,?,?,?)', [$id, $u['id'], 'interview', 'Interview invitation', json_encode($meta), Db::now()]);
        $mid = Db::lastId();
        Db::run('UPDATE threads SET last_message_at = ? WHERE id = ?', [Db::now(), $id]);
        Db::run("UPDATE applications SET status = 'interview', updated_at = ? WHERE id = ? AND status IN ('new','shortlisted')", [Db::now(), $t['application_id']]);
        $when = date('D j M, H:i', $ts);
        Notify::user($this->other($t, $u), 'work', $this->companyName($u) . ' wants to interview you', "$when at $place. Tap to confirm.", '/#/inbox/' . $id, true);
        Http::json(['message' => $this->shapeMessage(Db::one('SELECT * FROM messages WHERE id = ?', [$mid]), (int) $u['id'])], 201);
    }

    /** POST /messages/{id}/respond { action: confirm|suggest, note } (applicant) */
    public function respond(int $mid): void
    {
        $u = Auth::require();
        $m = Db::one("SELECT m.*, t.user_a, t.user_b, t.application_id FROM messages m JOIN threads t ON t.id = m.thread_id WHERE m.id = ? AND m.type = 'interview'", [$mid]);
        if ($m === null || ((int) $m['user_a'] !== (int) $u['id'] && (int) $m['user_b'] !== (int) $u['id'])) Http::json(['error' => 'not_found'], 404);
        if ((int) $m['sender_id'] === (int) $u['id']) Http::json(['error' => 'forbidden', 'message' => 'You sent this invitation.'], 403);
        $b = Http::body(); $action = (string) ($b['action'] ?? ''); $note = mb_substr(trim((string) ($b['note'] ?? '')), 0, 400);
        if (!in_array($action, ['confirm', 'suggest'], true)) Http::json(['error' => 'validation', 'fields' => ['action' => 'confirm or suggest']], 422);
        if ($action === 'suggest' && $note === '') Http::json(['error' => 'validation', 'fields' => ['note' => 'Say which time works for you.']], 422);
        $meta = json_decode($m['meta'], true); $meta['status'] = $action === 'confirm' ? 'confirmed' : 'suggested';
        Db::run('UPDATE messages SET meta = ? WHERE id = ?', [json_encode($meta), $mid]);
        $reply = $action === 'confirm' ? 'Confirmed. See you on ' . date('D j M \a\t H:i', strtotime($meta['at'])) . '.' : 'That time does not work for me. ' . $note;
        Db::run('INSERT INTO messages (thread_id, sender_id, type, body, created_at) VALUES (?,?,?,?,?)', [$m['thread_id'], $u['id'], 'text', $reply, Db::now()]);
        Db::run('UPDATE threads SET last_message_at = ? WHERE id = ?', [Db::now(), $m['thread_id']]);
        Notify::user((int) $m['sender_id'], 'work', $u['name'] . ($action === 'confirm' ? ' confirmed the interview' : ' suggested another time'), $reply, '/#/inbox/' . $m['thread_id']);
        Http::json(['ok' => true, 'status' => $meta['status']]);
    }

    private function companyName(array $u): string { return Db::one('SELECT name FROM companies WHERE owner_id = ?', [$u['id']])['name'] ?? $u['name']; }
}

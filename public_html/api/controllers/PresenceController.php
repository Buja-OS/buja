<?php
declare(strict_types=1);

/** The open app's heartbeat, typing marks in chats, and the last-seen privacy switch. */
final class PresenceController
{
    /** GET /pulse : sent every few seconds while Buja is open. Marks you online and says if someone is ringing you. */
    public function pulse(): void
    {
        $u = Auth::require();
        Presence::touch($u);
        Http::json(['call' => CallController::ringing($u), 'at' => gmdate('Y-m-d\TH:i:s\Z')]);
    }

    /** POST /threads/{id}/typing : you are typing in this chat (the app sends it at most every 3 s while you type). */
    public function typing(int $id): void
    {
        $u = Auth::require();
        $t = Db::one('SELECT id FROM threads WHERE id = ? AND (user_a = ? OR user_b = ?)', [$id, $u['id'], $u['id']]);
        if (!$t) Http::json(['error' => 'not_found'], 404);
        Presence::typing($id, (int) $u['id']);
        Http::json(['ok' => true]);
    }

    /** PATCH /me/presence { showLastSeen } */
    public function settings(): void
    {
        $u = Auth::require(); $b = Http::body();
        if (!array_key_exists('showLastSeen', $b)) Http::json(['error' => 'validation', 'message' => 'Nothing to update.'], 422);
        try { Db::run('UPDATE users SET show_last_seen = ? WHERE id = ?', [!empty($b['showLastSeen']) ? 1 : 0, $u['id']]); }
        catch (Throwable $e) { Http::json(['error' => 'validation', 'message' => 'This setting is coming very soon. Try again shortly.'], 422); }
        Http::json(['showLastSeen' => !empty($b['showLastSeen'])]);
    }
}

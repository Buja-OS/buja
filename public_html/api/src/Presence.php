<?php
declare(strict_types=1);

/**
 * Who is on Buja right now. The open app checks in every few seconds (GET /pulse); the check-in stamps
 * users.last_seen_at at most every 20 s, so "online" means "the app was open on their phone in the last minute".
 * Typing is a short-lived mark per chat. People can hide their online status and last seen; like WhatsApp, if you
 * hide your last seen you do not see other people's either (you still see who is online and typing).
 */
final class Presence
{
    public const ONLINE_SEC = 60;   // seen within this: online
    public const TYPING_SEC = 6;    // typed within this: typing

    public static function touch(array $u): void
    {
        $last = $u['last_seen_at'] ?? null;
        if ($last && strtotime($last . ' UTC') > time() - 20) return;
        try { Db::run('UPDATE users SET last_seen_at = ? WHERE id = ?', [Db::now(), $u['id']]); } catch (Throwable $e) {}
    }

    public static function shows(array $row): bool { return !array_key_exists('show_last_seen', $row) || $row['show_last_seen'] === null || (int) $row['show_last_seen'] === 1; }

    /** What $viewer may see about $userId: online, when last seen, typing in this thread. */
    public static function of(int $userId, array $viewer, int $threadId = 0): array
    {
        $o = Db::one('SELECT * FROM users WHERE id = ?', [$userId]);
        if (!$o) return ['online' => false, 'lastSeen' => null, 'typing' => false];
        $seen = $o['last_seen_at'] ? strtotime($o['last_seen_at'] . ' UTC') : 0;
        $online = $seen > time() - self::ONLINE_SEC;
        $canSee = self::shows($o) && self::shows($viewer);
        $typing = false;
        if ($threadId) {
            try { $t = Db::one('SELECT at FROM typing_state WHERE thread_id = ? AND user_id = ?', [$threadId, $userId]); $typing = $t && strtotime($t['at'] . ' UTC') > time() - self::TYPING_SEC; } catch (Throwable $e) {}
        }
        return ['online' => self::shows($o) ? $online : false, 'lastSeen' => $canSee && !$online && $seen ? gmdate('Y-m-d\TH:i:s\Z', $seen) : null, 'typing' => $typing];
    }

    public static function typing(int $threadId, int $userId): void
    {
        try {
            if (Db::one('SELECT 1 AS x FROM typing_state WHERE thread_id = ? AND user_id = ?', [$threadId, $userId])) Db::run('UPDATE typing_state SET at = ? WHERE thread_id = ? AND user_id = ?', [Db::now(), $threadId, $userId]);
            else Db::run('INSERT INTO typing_state (thread_id, user_id, at) VALUES (?,?,?)', [$threadId, $userId, Db::now()]);
        } catch (Throwable $e) {}
    }

    /** Stop the dots at once when the message is sent. */
    public static function stopTyping(int $threadId, int $userId): void
    {
        try { Db::run('DELETE FROM typing_state WHERE thread_id = ? AND user_id = ?', [$threadId, $userId]); } catch (Throwable $e) {}
    }
}

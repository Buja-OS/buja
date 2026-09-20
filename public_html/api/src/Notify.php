<?php
declare(strict_types=1);

/** Sends a notification to a user through every channel they allow: push subscriptions now, email as fallback. Never throws. */
final class Notify
{
    public static function user(int $userId, string $category, string $title, string $body, string $url, bool $emailFallback = false, array $extra = []): void
    {
        try {
            $u = Db::one('SELECT id, email, name, notify_work, notify_match, notify_waka, notify_offers FROM users WHERE id = ?', [$userId]);
            if ($u === null) return;
            Db::run('INSERT INTO notifications (user_id, category, title, body, url, created_at) VALUES (?,?,?,?,?,?)', [$userId, $category, mb_substr($title, 0, 120), mb_substr($body, 0, 300), $url, Db::now()]);
            $col = 'notify_' . $category;
            if (isset($u[$col]) && !(int) $u[$col]) return;
            $pushed = 0;
            $st = Db::pdo()->prepare('SELECT * FROM push_subscriptions WHERE user_id = ?'); $st->execute([$userId]);
            foreach ($st->fetchAll() as $sub) {
                $code = WebPush::send($sub, ['title' => $title, 'body' => $body, 'url' => $url, 'tag' => $category] + $extra, 'mailto:' . (string) Http::config('mail_from', 'hello@buja.ng'));
                if ($code === 404 || $code === 410) Db::run('DELETE FROM push_subscriptions WHERE id = ?', [$sub['id']]);
                elseif ($code >= 200 && $code < 300) $pushed++;
            }
            if (!$pushed && $emailFallback && $u['email']) {
                Mail::send($u['email'], $u['name'], $title, "<p>" . htmlspecialchars($body) . "</p><p><a href=\"" . htmlspecialchars((string) Http::config('app_origin') . $url) . "\">Open in Buja</a></p>");
            }
        } catch (Throwable $e) { error_log('[buja notify] ' . $e->getMessage()); }
    }
}

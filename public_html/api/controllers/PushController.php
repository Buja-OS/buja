<?php
declare(strict_types=1);

final class PushController
{
    public function key(): void { Http::json(['key' => WebPush::publicKeyB64u()]); }

    /** POST /push/subscribe  { endpoint, keys: { p256dh, auth } } */
    public function subscribe(): void
    {
        $u = Auth::require(); $b = Http::body();
        $endpoint = (string) ($b['endpoint'] ?? ''); $p = (string) ($b['keys']['p256dh'] ?? ''); $a = (string) ($b['keys']['auth'] ?? '');
        if (!str_starts_with($endpoint, 'https://') || strlen($p) < 80 || strlen($a) < 16) Http::json(['error' => 'validation', 'message' => 'Invalid subscription.'], 422);
        Db::run('DELETE FROM push_subscriptions WHERE endpoint = ?', [$endpoint]);
        Db::run('INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, created_at) VALUES (?,?,?,?,?,?)', [$u['id'], $endpoint, $p, $a, substr($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 255), Db::now()]);
        Http::json(['ok' => true], 201);
    }

    /** DELETE /push/subscribe  { endpoint } */
    public function unsubscribe(): void
    {
        $u = Auth::require();
        Db::run('DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?', [$u['id'], (string) (Http::body()['endpoint'] ?? '')]);
        Http::json(['ok' => true]);
    }

    /** POST /push/test : sends a notification to the caller's own devices */
    public function test(): void
    {
        $u = Auth::require();
        Notify::user((int) $u['id'], 'work', 'Buja notifications are on', 'You will hear about interviews, messages and fare changes here.', '/#/settings');
        Http::json(['ok' => true]);
    }
}

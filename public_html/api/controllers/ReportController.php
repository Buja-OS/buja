<?php
declare(strict_types=1);

/** Report anything: a person, a listing, a property, a post, a vacancy. Everything lands in one admin queue. */
final class ReportController
{
    private const KINDS = ['user' => 'users', 'listing' => 'listings', 'property' => 'properties', 'post' => 'social_posts', 'job' => 'jobs', 'spot' => 'spots'];

    /** POST /report { kind, id, reason } */
    public function create(): void
    {
        $u = Auth::require(); RateLimit::hit('report', 20, 86400);
        $b = Http::body(); $kind = (string) ($b['kind'] ?? ''); $id = (int) ($b['id'] ?? 0);
        $reason = mb_substr(trim((string) ($b['reason'] ?? '')), 0, 500);
        if (!isset(self::KINDS[$kind]) || !$id) Http::json(['error' => 'validation', 'message' => 'Nothing to report.'], 422);
        if ($reason === '') Http::json(['error' => 'validation', 'fields' => ['reason' => 'Tell us what is wrong.']], 422);
        $table = self::KINDS[$kind];
        $owner = ['listing' => 'seller_id', 'property' => 'owner_id', 'post' => 'user_id'][$kind] ?? null;
        $row = Db::one("SELECT * FROM $table WHERE id = ?", [$id]); if (!$row) Http::json(['error' => 'not_found'], 404);
        $reported = $kind === 'user' ? $id : ($owner ? (int) $row[$owner] : (int) $u['id']);
        Db::run('INSERT INTO reports (reporter, reported, reason, target_kind, target_id, created_at) VALUES (?,?,?,?,?,?)',
            [$u['id'], $reported, $reason, $kind, $id, Db::now()]);
        if ($kind === 'user') { Db::run('DELETE FROM blocks WHERE blocker = ? AND blocked = ?', [$u['id'], $id]); Db::run('INSERT INTO blocks (blocker, blocked, created_at) VALUES (?,?,?)', [$u['id'], $id, Db::now()]); }
        Track::hit($u, 'moderation', 'report:' . $kind);
        Http::json(['ok' => true, 'message' => 'Reported. The Buja team will look at it.'], 201);
    }
}

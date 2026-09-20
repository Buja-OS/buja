<?php
declare(strict_types=1);

/**
 * Saved searches. When somebody posts a job, a property or an item, Buja checks the searches people asked
 * to be told about and notifies the ones that match. Matching happens in PHP against the new row only, so
 * it costs one small query per post rather than a scan of everything.
 */
final class Alerts
{
    public const MODULES = ['work' => 'Work', 'homes' => 'Homes', 'declutter' => 'Declutter'];

    /** Does this row satisfy the filters the person saved? */
    public static function matches(string $module, array $f, array $row): bool
    {
        $txt = mb_strtolower(implode(' ', array_filter([$row['title'] ?? '', $row['description'] ?? '', $row['district'] ?? '', $row['category'] ?? '', $row['company_name'] ?? ''])));
        if (!empty($f['q']) && !str_contains($txt, mb_strtolower((string) $f['q']))) return false;
        if (!empty($f['district']) && ($row['district'] ?? '') !== $f['district']) return false;
        if (!empty($f['type']) && ($row['type'] ?? '') !== $f['type']) return false;
        if (!empty($f['category']) && ($row['category'] ?? '') !== $f['category']) return false;
        if (!empty($f['kind']) && ($row['kind'] ?? '') !== $f['kind']) return false;
        if (!empty($f['condition']) && ($row['condition'] ?? '') !== $f['condition']) return false;
        if (!empty($f['beds']) && (int) ($row['beds'] ?? 0) < (int) $f['beds']) return false;
        $price = (int) ($row['price'] ?? $row['salary_min'] ?? 0);
        if (!empty($f['max']) && $price > 0 && $price > (int) $f['max']) return false;
        if (!empty($f['min']) && $price > 0 && $price < (int) $f['min']) return false;
        if ($module === 'work' && !empty($f['payMin']) && (int) ($row['salary_max'] ?? $row['salary_min'] ?? 0) > 0 && (int) ($row['salary_max'] ?? 0) < (int) $f['payMin']) return false;
        return true;
    }

    /** Tell everyone whose saved search this new thing matches. Never throws; an alert must not break a post. */
    public static function fanout(string $module, array $row, int $ownerId, string $title, string $url): void
    {
        try {
            $st = Db::pdo()->prepare('SELECT * FROM saved_searches WHERE module = ? AND alerts = 1 LIMIT 500');
            $st->execute([$module]);
            foreach ($st->fetchAll() as $s) {
                if ((int) $s['user_id'] === $ownerId) continue;
                $f = json_decode($s['filters'], true) ?: [];
                if (!self::matches($module, $f, $row)) continue;
                Db::run('UPDATE saved_searches SET hits = hits + 1, last_hit_id = ? WHERE id = ?', [(int) ($row['id'] ?? 0), $s['id']]);
                $cat = $module === 'work' ? 'work' : 'offers';
                Notify::user((int) $s['user_id'], $cat, 'New for "' . $s['label'] . '"', $title, $url);
            }
        } catch (Throwable $e) { error_log('[buja alerts] ' . $e->getMessage()); }
    }
}

<?php
declare(strict_types=1);

final class SavedSearchController
{
    private function shape(array $s): array
    {
        $f = json_decode($s['filters'], true) ?: [];
        return ['id' => (int) $s['id'], 'module' => $s['module'], 'moduleLabel' => Alerts::MODULES[$s['module']] ?? $s['module'],
            'label' => $s['label'], 'filters' => $f, 'alerts' => (bool) $s['alerts'], 'hits' => (int) $s['hits'], 'at' => $s['created_at'],
            'url' => '/' . ($s['module'] === 'work' ? 'work' : $s['module']) . '?' . http_build_query(array_filter($f, fn($v) => $v !== '' && $v !== null))];
    }

    /** GET /saved-searches */
    public function index(): void
    {
        $u = Auth::require();
        $st = Db::pdo()->prepare('SELECT * FROM saved_searches WHERE user_id = ? ORDER BY id DESC'); $st->execute([$u['id']]);
        Http::json(['searches' => array_map(fn($s) => $this->shape($s), $st->fetchAll())]);
    }

    /** POST /saved-searches { module, label, filters, alerts } */
    public function create(): void
    {
        $u = Auth::require(); $b = Http::body();
        $module = (string) ($b['module'] ?? ''); if (!isset(Alerts::MODULES[$module])) Http::json(['error' => 'validation', 'message' => 'Unknown module.'], 422);
        $filters = array_filter((array) ($b['filters'] ?? []), fn($v) => $v !== '' && $v !== null);
        if (!$filters) Http::json(['error' => 'validation', 'message' => 'Set at least one filter before saving the search.'], 422);
        if ((int) (Db::one('SELECT COUNT(*) AS n FROM saved_searches WHERE user_id = ?', [$u['id']])['n'] ?? 0) >= 12) Http::json(['error' => 'validation', 'message' => 'Up to twelve saved searches.'], 422);
        $label = mb_substr(trim((string) ($b['label'] ?? '')), 0, 90) ?: self::describe($module, $filters);
        Db::run('INSERT INTO saved_searches (user_id, module, label, filters, alerts, created_at) VALUES (?,?,?,?,?,?)',
            [$u['id'], $module, $label, json_encode($filters), empty($b['alerts']) ? 0 : 1, Db::now()]);
        $id = (int) Db::lastId();
        Track::hit($u, 'alerts', 'save:' . $module);
        Http::json(['search' => $this->shape(Db::one('SELECT * FROM saved_searches WHERE id = ?', [$id]))], 201);
    }

    /** A readable name when the person does not give one. */
    public static function describe(string $module, array $f): string
    {
        $bits = [];
        if (!empty($f['q'])) $bits[] = '"' . $f['q'] . '"';
        if (!empty($f['beds'])) $bits[] = $f['beds'] . '+ bed';
        if (!empty($f['category'])) $bits[] = $f['category'];
        if (!empty($f['type'])) $bits[] = str_replace('_', ' ', (string) $f['type']);
        if (!empty($f['kind'])) $bits[] = $f['kind'] === 'rent' ? 'to rent' : 'for sale';
        if (!empty($f['district'])) $bits[] = 'in ' . $f['district'];
        if (!empty($f['max'])) $bits[] = 'under ₦' . number_format((int) $f['max']);
        return mb_substr($bits ? implode(' ', $bits) : (Alerts::MODULES[$module] . ' search'), 0, 90);
    }

    /** PATCH /saved-searches/{id} { alerts } */
    public function update(int $id): void
    {
        $u = Auth::require();
        if (!Db::one('SELECT id FROM saved_searches WHERE id = ? AND user_id = ?', [$id, $u['id']])) Http::json(['error' => 'not_found'], 404);
        Db::run('UPDATE saved_searches SET alerts = ? WHERE id = ?', [empty(Http::body()['alerts']) ? 0 : 1, $id]);
        $this->index();
    }

    /** DELETE /saved-searches/{id} */
    public function remove(int $id): void
    {
        $u = Auth::require();
        Db::run('DELETE FROM saved_searches WHERE id = ? AND user_id = ?', [$id, $u['id']]);
        $this->index();
    }
}

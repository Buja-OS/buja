<?php
declare(strict_types=1);

final class RadioController
{
    /** GET /radio */
    public function index(): void
    {
        Auth::require();
        $st = Db::pdo()->query('SELECT * FROM radio_stations WHERE active = 1 ORDER BY CAST(frequency AS DECIMAL(5,1))');
        Http::json(['stations' => array_map(fn($s) => ['id' => (int) $s['id'], 'name' => $s['name'], 'frequency' => $s['frequency'], 'genre' => $s['genre'], 'website' => $s['website'], 'stream' => $s['stream_url']], $st->fetchAll())]);
    }
    /** PATCH /radio/{id} { stream } : admins paste a stream URL once they have a working one */
    public function update(int $id): void
    {
        $u = Auth::require(); if (empty($u['is_admin']) && ($u['role'] ?? '') !== 'admin') Http::json(['error' => 'forbidden', 'message' => 'Admins only.'], 403);
        $s = trim((string) (Http::body()['stream'] ?? ''));
        if ($s !== '' && !preg_match('#^https://#i', $s)) Http::json(['error' => 'validation', 'fields' => ['stream' => 'Must be an https stream URL.']], 422);
        Db::run('UPDATE radio_stations SET stream_url = ? WHERE id = ?', [$s ?: null, $id]);
        $this->index();
    }
}

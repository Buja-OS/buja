<?php
declare(strict_types=1);

final class JobsController
{
    /** GET /jobs?q=&district=&type=&page= */
    public function index(): void
    {
        $u = Auth::user();
        $q = trim((string) ($_GET['q'] ?? ''));
        $district = trim((string) ($_GET['district'] ?? ''));
        $type = trim((string) ($_GET['type'] ?? ''));
        $page = max(1, (int) ($_GET['page'] ?? 1)); $per = 20;
        $where = ["j.status = 'open'"]; $p = [];
        if ($q !== '')        { $where[] = '(j.title LIKE ? OR c.name LIKE ? OR j.description LIKE ?)'; $like = '%' . $q . '%'; array_push($p, $like, $like, $like); }
        if ($district !== '') { $where[] = 'j.district = ?'; $p[] = $district; }
        if ($type !== '' && in_array($type, Work::TYPES, true)) { $where[] = 'j.type = ?'; $p[] = $type; }
        $sql = 'SELECT j.*, c.id AS c_id, c.name AS c_name, c.district AS c_district, c.verified_at AS c_verified_at,
                       (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS applicants
                FROM jobs j JOIN companies c ON c.id = j.company_id WHERE ' . implode(' AND ', $where) . '
                ORDER BY j.created_at DESC LIMIT ' . $per . ' OFFSET ' . (($page - 1) * $per);
        $st = Db::pdo()->prepare($sql); $st->execute($p);
        $saved = []; $applied = [];
        if ($u) {
            $s = Db::pdo()->prepare('SELECT job_id FROM saved_jobs WHERE user_id = ?'); $s->execute([$u['id']]); $saved = array_map('intval', array_column($s->fetchAll(), 'job_id'));
            $a = Db::pdo()->prepare('SELECT job_id FROM applications WHERE user_id = ?'); $a->execute([$u['id']]); $applied = array_map('intval', array_column($a->fetchAll(), 'job_id'));
        }
        $jobs = [];
        foreach ($st->fetchAll() as $r) {
            $c = ['id' => $r['c_id'], 'name' => $r['c_name'], 'district' => $r['c_district'], 'verified_at' => $r['c_verified_at']];
            $jobs[] = Work::job($r, $c, ['applicants' => (int) $r['applicants'], 'saved' => in_array((int) $r['id'], $saved, true), 'applied' => in_array((int) $r['id'], $applied, true)]);
        }
        $count = Db::one('SELECT COUNT(*) AS n FROM jobs j JOIN companies c ON c.id = j.company_id WHERE ' . implode(' AND ', $where), $p);
        Http::json(['jobs' => $jobs, 'total' => (int) ($count['n'] ?? 0), 'page' => $page]);
    }

    /** GET /jobs/{id} */
    public function show(int $id): void
    {
        $u = Auth::user();
        $j = Db::one('SELECT * FROM jobs WHERE id = ?', [$id]);
        if ($j === null) Http::json(['error' => 'not_found', 'message' => 'This vacancy no longer exists.'], 404);
        $c = Db::one('SELECT * FROM companies WHERE id = ?', [$j['company_id']]);
        $extra = ['requirements' => Work::requirements($id), 'applicants' => (int) (Db::one('SELECT COUNT(*) AS n FROM applications WHERE job_id = ?', [$id])['n'] ?? 0)];
        if ($u) {
            $extra['saved'] = Db::one('SELECT 1 AS x FROM saved_jobs WHERE user_id = ? AND job_id = ?', [$u['id'], $id]) !== null;
            $app = Db::one('SELECT id, status, match_score, created_at FROM applications WHERE user_id = ? AND job_id = ?', [$u['id'], $id]);
            $extra['application'] = $app ? ['id' => (int) $app['id'], 'status' => $app['status'], 'match' => (int) $app['match_score'], 'createdAt' => $app['created_at']] : null;
            $cv = Db::one('SELECT id, name, size, updated_at FROM cv_files WHERE user_id = ?', [$u['id']]);
            $extra['cv'] = $cv ? ['id' => (int) $cv['id'], 'name' => $cv['name'], 'size' => (int) $cv['size'], 'updatedAt' => $cv['updated_at']] : null;
        }
        Http::json(['job' => Work::job($j, $c, $extra)]);
    }

    /** POST /jobs/{id}/apply  { note, met: [requirementId, ...] } */
    public function apply(int $id): void
    {
        $u = Auth::require();
        if ($u['kind'] === 'company') Http::json(['error' => 'forbidden', 'message' => 'Hiring accounts cannot apply for jobs.'], 403);
        RateLimit::hit('apply', 30, 3600);
        $j = Db::one("SELECT * FROM jobs WHERE id = ? AND status = 'open'", [$id]);
        if ($j === null) Http::json(['error' => 'not_found', 'message' => 'This vacancy is closed.'], 404);
        if ($j['deadline'] !== null && $j['deadline'] < gmdate('Y-m-d')) Http::json(['error' => 'closed', 'message' => 'The deadline for this vacancy has passed.'], 409);
        if (Db::one('SELECT id FROM applications WHERE user_id = ? AND job_id = ?', [$u['id'], $id])) Http::json(['error' => 'duplicate', 'message' => 'You have already applied for this role.'], 409);
        $cv = Db::one('SELECT id FROM cv_files WHERE user_id = ?', [$u['id']]);
        if ($cv === null) Http::json(['error' => 'validation', 'fields' => ['cv' => 'Add your CV before applying.']], 422);

        $b = Http::body();
        $note = trim((string) ($b['note'] ?? '')); if (mb_strlen($note) > 600) $note = mb_substr($note, 0, 600);
        $reqs = Work::requirements($id);
        $met = array_values(array_intersect(array_map('intval', (array) ($b['met'] ?? [])), array_column($reqs, 'id')));
        $score = Work::score($reqs, $met);
        Db::run('INSERT INTO applications (job_id, user_id, cv_file_id, note, met_ids, match_score, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
            [$id, $u['id'], $cv['id'], $note, json_encode($met), $score, 'new', Db::now(), Db::now()]);
        Http::json(['application' => ['id' => Db::lastId(), 'status' => 'new', 'match' => $score]], 201);
    }

    /** POST /jobs/{id}/save  and  DELETE /jobs/{id}/save */
    public function save(int $id): void
    {
        $u = Auth::require();
        if (!Db::one('SELECT id FROM jobs WHERE id = ?', [$id])) Http::json(['error' => 'not_found'], 404);
        if (!Db::one('SELECT 1 AS x FROM saved_jobs WHERE user_id = ? AND job_id = ?', [$u['id'], $id]))
            Db::run('INSERT INTO saved_jobs (user_id, job_id, created_at) VALUES (?,?,?)', [$u['id'], $id, Db::now()]);
        Http::json(['saved' => true]);
    }
    public function unsave(int $id): void
    {
        $u = Auth::require();
        Db::run('DELETE FROM saved_jobs WHERE user_id = ? AND job_id = ?', [$u['id'], $id]);
        Http::json(['saved' => false]);
    }

    /** GET /me/applications */
    public function mine(): void
    {
        $u = Auth::require();
        $st = Db::pdo()->prepare('SELECT a.id, a.status, a.match_score, a.created_at, j.id AS job_id, j.title, j.district, c.name AS company
                                  FROM applications a JOIN jobs j ON j.id = a.job_id JOIN companies c ON c.id = j.company_id
                                  WHERE a.user_id = ? ORDER BY a.created_at DESC');
        $st->execute([$u['id']]);
        Http::json(['applications' => array_map(fn($r) => ['id' => (int) $r['id'], 'status' => $r['status'], 'match' => (int) $r['match_score'], 'createdAt' => $r['created_at'],
            'job' => ['id' => (int) $r['job_id'], 'title' => $r['title'], 'district' => $r['district'], 'company' => $r['company']]], $st->fetchAll())]);
    }

    /** GET /me/saved */
    public function saved(): void
    {
        $u = Auth::require();
        $st = Db::pdo()->prepare('SELECT j.*, c.id AS c_id, c.name AS c_name, c.district AS c_district, c.verified_at AS c_verified_at FROM saved_jobs s JOIN jobs j ON j.id = s.job_id JOIN companies c ON c.id = j.company_id WHERE s.user_id = ? ORDER BY s.created_at DESC');
        $st->execute([$u['id']]);
        Http::json(['jobs' => array_map(fn($r) => Work::job($r, ['id' => $r['c_id'], 'name' => $r['c_name'], 'district' => $r['c_district'], 'verified_at' => $r['c_verified_at']], ['saved' => true]), $st->fetchAll())]);
    }
}

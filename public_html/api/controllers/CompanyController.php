<?php
declare(strict_types=1);

final class CompanyController
{
    private function shape(array $c): array
    {
        return ['id' => (int) $c['id'], 'name' => $c['name'], 'district' => $c['district'], 'about' => $c['about'], 'website' => $c['website'], 'verified' => $c['verified_at'] !== null];
    }

    /** GET /company : the caller's company profile, or null */
    public function show(): void
    {
        $u = Auth::require();
        $c = Db::one('SELECT * FROM companies WHERE owner_id = ?', [$u['id']]);
        Http::json(['company' => $c ? $this->shape($c) : null]);
    }

    /** POST /company : create or update the company profile */
    public function save(): void
    {
        $u = Auth::require();
        if ($u['kind'] !== 'company') Http::json(['error' => 'forbidden', 'message' => 'Switch your account to hiring in Settings to post jobs.'], 403);
        $b = Http::body(); $errors = [];
        $name = mb_substr(trim((string) ($b['name'] ?? '')), 0, 120);
        $district = mb_substr(trim((string) ($b['district'] ?? '')), 0, 60);
        $about = mb_substr(trim((string) ($b['about'] ?? '')), 0, 1000);
        $website = mb_substr(trim((string) ($b['website'] ?? '')), 0, 200);
        if (mb_strlen($name) < 2) $errors['name'] = 'Enter the company name.';
        if ($district === '') $errors['district'] = 'Choose a district.';
        if ($website !== '' && !preg_match('#^https?://#', $website)) $website = 'https://' . $website;
        if ($errors) Http::json(['error' => 'validation', 'fields' => $errors], 422);
        $c = Db::one('SELECT id FROM companies WHERE owner_id = ?', [$u['id']]);
        if ($c) Db::run('UPDATE companies SET name = ?, district = ?, about = ?, website = ?, updated_at = ? WHERE id = ?', [$name, $district, $about, $website ?: null, Db::now(), $c['id']]);
        else   Db::run('INSERT INTO companies (owner_id, name, district, about, website, created_at, updated_at) VALUES (?,?,?,?,?,?,?)', [$u['id'], $name, $district, $about, $website ?: null, Db::now(), Db::now()]);
        Http::json(['company' => $this->shape(Db::one('SELECT * FROM companies WHERE owner_id = ?', [$u['id']]))], $c ? 200 : 201);
    }

    /** GET /company/jobs : my vacancies with counters */
    public function jobs(): void
    {
        $c = Work::requireCompany(Auth::require());
        $st = Db::pdo()->prepare("SELECT j.*,
            (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS applicants,
            (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.match_score >= 80) AS strong,
            (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.status = 'shortlisted') AS shortlisted,
            (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id AND a.status = 'interview') AS interviews
            FROM jobs j WHERE j.company_id = ? ORDER BY j.created_at DESC");
        $st->execute([$c['id']]);
        Http::json(['jobs' => array_map(fn($j) => Work::job($j, $c, ['applicants' => (int) $j['applicants'], 'strong' => (int) $j['strong'], 'shortlisted' => (int) $j['shortlisted'], 'interviews' => (int) $j['interviews']]), $st->fetchAll())]);
    }

    private function validateJob(array $b): array
    {
        $errors = [];
        $title = mb_substr(trim((string) ($b['title'] ?? '')), 0, 120);
        $district = mb_substr(trim((string) ($b['district'] ?? '')), 0, 60);
        $type = (string) ($b['type'] ?? 'full_time');
        $desc = mb_substr(trim((string) ($b['description'] ?? '')), 0, 4000);
        $min = Work::money($b['salaryMin'] ?? null); $max = Work::money($b['salaryMax'] ?? null);
        $deadline = trim((string) ($b['deadline'] ?? ''));
        $openings = max(1, min(500, (int) ($b['openings'] ?? 1)));
        $reqs = [];
        foreach ((array) ($b['requirements'] ?? []) as $r) {
            $label = mb_substr(trim((string) ($r['label'] ?? '')), 0, 120); $w = max(0, min(100, (int) ($r['weight'] ?? 0)));
            if ($label !== '') $reqs[] = ['label' => $label, 'weight' => $w];
        }
        if (mb_strlen($title) < 3) $errors['title'] = 'Enter the job title.';
        if ($district === '') $errors['district'] = 'Choose a district.';
        if (!in_array($type, Work::TYPES, true)) $errors['type'] = 'Choose a job type.';
        if (mb_strlen($desc) < 20) $errors['description'] = 'Describe the role in a few sentences.';
        if ($min === null) $errors['salaryMin'] = 'Enter a salary. Ranges get more applicants.';
        if ($max !== null && $min !== null && $max < $min) $errors['salaryMax'] = 'Salary to must be at least salary from.';
        if ($deadline !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $deadline)) $errors['deadline'] = 'Use the date picker.';
        if (count($reqs) > 12) $errors['requirements'] = 'Up to 12 requirements.';
        $sum = array_sum(array_column($reqs, 'weight'));
        if ($reqs && $sum !== 100) $errors['requirements'] = 'Requirement weights must add up to 100 (currently ' . $sum . ').';
        return [$errors, compact('title', 'district', 'type', 'desc', 'min', 'max', 'deadline', 'openings', 'reqs')];
    }

    /** POST /company/jobs */
    public function createJob(): void
    {
        $c = Work::requireCompany(Auth::require());
        RateLimit::hit('postjob', 20, 3600);
        [$errors, $v] = $this->validateJob(Http::body());
        if ($errors) Http::json(['error' => 'validation', 'fields' => $errors], 422);
        $pdo = Db::pdo(); $pdo->beginTransaction();
        Db::run('INSERT INTO jobs (company_id, title, district, type, salary_min, salary_max, description, deadline, openings, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
            [$c['id'], $v['title'], $v['district'], $v['type'], $v['min'], $v['max'], $v['desc'], $v['deadline'] ?: null, $v['openings'], 'open', Db::now(), Db::now()]);
        $id = Db::lastId();
        foreach ($v['reqs'] as $r) Db::run('INSERT INTO job_requirements (job_id, label, weight) VALUES (?,?,?)', [$id, $r['label'], $r['weight']]);
        $pdo->commit();
        Http::json(['job' => Work::job(Db::one('SELECT * FROM jobs WHERE id = ?', [$id]), $c, ['requirements' => Work::requirements($id)])], 201);
    }

    /** PATCH /company/jobs/{id}  full update, or { status: 'open'|'closed' } alone */
    public function updateJob(int $id): void
    {
        $c = Work::requireCompany(Auth::require());
        $j = Db::one('SELECT * FROM jobs WHERE id = ? AND company_id = ?', [$id, $c['id']]);
        if ($j === null) Http::json(['error' => 'not_found'], 404);
        $b = Http::body();
        if (count($b) === 1 && isset($b['status'])) {
            if (!in_array($b['status'], ['open', 'closed'], true)) Http::json(['error' => 'validation', 'fields' => ['status' => 'open or closed']], 422);
            Db::run('UPDATE jobs SET status = ?, updated_at = ? WHERE id = ?', [$b['status'], Db::now(), $id]);
        } else {
            [$errors, $v] = $this->validateJob($b);
            if ($errors) Http::json(['error' => 'validation', 'fields' => $errors], 422);
            $pdo = Db::pdo(); $pdo->beginTransaction();
            Db::run('UPDATE jobs SET title=?, district=?, type=?, salary_min=?, salary_max=?, description=?, deadline=?, openings=?, updated_at=? WHERE id = ?',
                [$v['title'], $v['district'], $v['type'], $v['min'], $v['max'], $v['desc'], $v['deadline'] ?: null, $v['openings'], Db::now(), $id]);
            Db::run('DELETE FROM job_requirements WHERE job_id = ?', [$id]);
            foreach ($v['reqs'] as $r) Db::run('INSERT INTO job_requirements (job_id, label, weight) VALUES (?,?,?)', [$id, $r['label'], $r['weight']]);
            $pdo->commit();
        }
        Http::json(['job' => Work::job(Db::one('SELECT * FROM jobs WHERE id = ?', [$id]), $c, ['requirements' => Work::requirements($id)])]);
    }

    /** GET /company/jobs/{id}/applications?status= */
    public function applications(int $id): void
    {
        $c = Work::requireCompany(Auth::require());
        $j = Db::one('SELECT * FROM jobs WHERE id = ? AND company_id = ?', [$id, $c['id']]);
        if ($j === null) Http::json(['error' => 'not_found'], 404);
        $status = (string) ($_GET['status'] ?? '');
        $sql = 'SELECT a.*, u.name, u.district AS u_district, u.phone, u.email, sp.headline, sp.years, sp.skills, cf.id AS cv_id, cf.name AS cv_name
                FROM applications a JOIN users u ON u.id = a.user_id
                LEFT JOIN seeker_profiles sp ON sp.user_id = u.id LEFT JOIN cv_files cf ON cf.id = a.cv_file_id
                WHERE a.job_id = ?' . ($status !== '' && in_array($status, Work::APP_STATUS, true) ? ' AND a.status = ?' : '') . ' ORDER BY a.match_score DESC, a.created_at ASC';
        $st = Db::pdo()->prepare($sql); $st->execute($status !== '' && in_array($status, Work::APP_STATUS, true) ? [$id, $status] : [$id]);
        $reqs = Work::requirements($id);
        $rows = array_map(fn($a) => [
            'id' => (int) $a['id'], 'status' => $a['status'], 'match' => (int) $a['match_score'], 'note' => $a['note'], 'createdAt' => $a['created_at'],
            'met' => json_decode($a['met_ids'] ?? '[]', true) ?: [],
            'applicant' => ['id' => (int) $a['user_id'], 'name' => $a['name'], 'district' => $a['u_district'], 'phone' => $a['phone'], 'email' => $a['email'],
                            'headline' => $a['headline'] ?? '', 'years' => (int) ($a['years'] ?? 0), 'skills' => json_decode($a['skills'] ?? '[]', true) ?: []],
            'cv' => $a['cv_id'] ? ['id' => (int) $a['cv_id'], 'name' => $a['cv_name']] : null,
        ], $st->fetchAll());
        Http::json(['job' => Work::job($j, $c, ['requirements' => $reqs]), 'applications' => $rows]);
    }

    /** PATCH /company/applications/{id}  { status } */
    public function updateApplication(int $id): void
    {
        $c = Work::requireCompany(Auth::require());
        $a = Db::one('SELECT a.* FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ? AND j.company_id = ?', [$id, $c['id']]);
        if ($a === null) Http::json(['error' => 'not_found'], 404);
        $s = (string) (Http::body()['status'] ?? '');
        if (!in_array($s, Work::APP_STATUS, true)) Http::json(['error' => 'validation', 'fields' => ['status' => 'Unknown status.']], 422);
        Db::run('UPDATE applications SET status = ?, updated_at = ? WHERE id = ?', [$s, Db::now(), $id]);
        Http::json(['application' => ['id' => $id, 'status' => $s]]);
    }
}

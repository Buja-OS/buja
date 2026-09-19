<?php
declare(strict_types=1);

final class SeekerController
{
    private function profile(int $userId): array
    {
        $p = Db::one('SELECT * FROM seeker_profiles WHERE user_id = ?', [$userId]);
        $cv = Db::one('SELECT id, name, size, updated_at FROM cv_files WHERE user_id = ?', [$userId]);
        $used = (int) (Db::one('SELECT COUNT(*) AS n FROM applications WHERE user_id = ?', [$userId])['n'] ?? 0);
        return [
            'headline' => $p['headline'] ?? '', 'years' => (int) ($p['years'] ?? 0), 'openToWork' => (bool) ($p['open_to_work'] ?? 1),
            'skills' => $p ? (json_decode($p['skills'] ?? '[]', true) ?: []) : [],
            'cv' => $cv ? ['id' => (int) $cv['id'], 'name' => $cv['name'], 'size' => (int) $cv['size'], 'updatedAt' => $cv['updated_at'], 'usedIn' => $used] : null,
        ];
    }

    /** GET /me/seeker */
    public function show(): void
    {
        $u = Auth::require();
        Http::json(['profile' => $this->profile((int) $u['id'])]);
    }

    /** PATCH /me/seeker  { headline, years, openToWork, skills[] } */
    public function update(): void
    {
        $u = Auth::require();
        $b = Http::body(); $errors = [];
        $headline = mb_substr(trim((string) ($b['headline'] ?? '')), 0, 120);
        $years = max(0, min(50, (int) ($b['years'] ?? 0)));
        $open = !empty($b['openToWork']) ? 1 : 0;
        $skills = array_values(array_unique(array_filter(array_map(fn($s) => mb_substr(trim((string) $s), 0, 40), (array) ($b['skills'] ?? [])))));
        if (count($skills) > 20) $errors['skills'] = 'Up to 20 skills.';
        if ($errors) Http::json(['error' => 'validation', 'fields' => $errors], 422);
        if (Db::one('SELECT user_id FROM seeker_profiles WHERE user_id = ?', [$u['id']]))
            Db::run('UPDATE seeker_profiles SET headline = ?, years = ?, open_to_work = ?, skills = ?, updated_at = ? WHERE user_id = ?', [$headline, $years, $open, json_encode($skills), Db::now(), $u['id']]);
        else
            Db::run('INSERT INTO seeker_profiles (user_id, headline, years, open_to_work, skills, updated_at) VALUES (?,?,?,?,?,?)', [$u['id'], $headline, $years, $open, json_encode($skills), Db::now()]);
        Http::json(['profile' => $this->profile((int) $u['id'])]);
    }

    /** POST /me/cv  multipart field "cv" (PDF or Word, up to 2 MB). Replaces the existing CV. */
    public function uploadCv(): void
    {
        $u = Auth::require();
        RateLimit::hit('cv', 20, 3600);
        $f = Http::file('cv');
        if ($f === null) Http::json(['error' => 'validation', 'fields' => ['cv' => 'Choose a file.']], 422);
        if ((int) $f['size'] > Work::CV_MAX_BYTES) Http::json(['error' => 'validation', 'fields' => ['cv' => 'CV must be 2 MB or smaller.']], 422);
        $data = file_get_contents($f['tmp_name']) ?: '';
        $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($data) ?: '';
        $ok = ['application/pdf' => 'pdf', 'application/msword' => 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx'];
        if (!isset($ok[$mime])) Http::json(['error' => 'validation', 'fields' => ['cv' => 'PDF or Word only.']], 422);
        $name = preg_replace('/[^\w .()-]+/u', '_', (string) $f['name']) ?: 'cv';
        $name = mb_substr($name, 0, 120);
        if (Db::one('SELECT id FROM cv_files WHERE user_id = ?', [$u['id']]))
            Db::run('UPDATE cv_files SET name = ?, mime = ?, size = ?, data = ?, updated_at = ? WHERE user_id = ?', [$name, $mime, strlen($data), $data, Db::now(), $u['id']]);
        else
            Db::run('INSERT INTO cv_files (user_id, name, mime, size, data, updated_at) VALUES (?,?,?,?,?,?)', [$u['id'], $name, $mime, strlen($data), $data, Db::now()]);
        Http::json(['profile' => $this->profile((int) $u['id'])], 201);
    }

    /** DELETE /me/cv */
    public function deleteCv(): void
    {
        $u = Auth::require();
        Db::run('DELETE FROM cv_files WHERE user_id = ?', [$u['id']]);
        Http::json(['profile' => $this->profile((int) $u['id'])]);
    }

    /** GET /cv/{id}  Owner, or a company the owner applied to. Streams the file. */
    public function download(int $id): void
    {
        $u = Auth::require();
        $cv = Db::one('SELECT * FROM cv_files WHERE id = ?', [$id]);
        if ($cv === null) Http::json(['error' => 'not_found'], 404);
        $allowed = (int) $cv['user_id'] === (int) $u['id'];
        if (!$allowed && $u['kind'] === 'company') {
            $c = Db::one('SELECT id FROM companies WHERE owner_id = ?', [$u['id']]);
            $allowed = $c && Db::one('SELECT a.id FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.user_id = ? AND j.company_id = ?', [$cv['user_id'], $c['id']]) !== null;
        }
        if (!$allowed) Http::json(['error' => 'forbidden', 'message' => 'You can only see CVs from people who applied to you.'], 403);
        header('Content-Type: ' . $cv['mime']);
        header('Content-Length: ' . (int) $cv['size']);
        header('Content-Disposition: inline; filename="' . str_replace('"', '', $cv['name']) . '"');
        header('Cache-Control: private, no-store');
        header('X-Content-Type-Options: nosniff');
        echo $cv['data'];
        exit;
    }
}

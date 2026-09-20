<?php
declare(strict_types=1);

/** Shared shapes and rules for the Work module. */
final class Work
{
    public const TYPES = ['full_time', 'part_time', 'contract', 'internship', 'remote'];
    public const TYPE_LABEL = ['full_time' => 'Full time', 'part_time' => 'Part time', 'contract' => 'Contract', 'internship' => 'Internship', 'remote' => 'Remote'];
    public const APP_STATUS = ['new', 'shortlisted', 'interview', 'rejected', 'hired'];
    public const CV_MAX_BYTES = 2 * 1024 * 1024;

    public static function requireCompany(array $u): array
    {
        if ($u['kind'] !== 'company') Http::json(['error' => 'forbidden', 'message' => 'Only hiring accounts can do this.'], 403);
        $c = Db::one('SELECT * FROM companies WHERE owner_id = ?', [$u['id']]);
        if ($c === null) Http::json(['error' => 'no_company', 'message' => 'Set up your company profile first.'], 409);
        return $c;
    }

    public static function job(array $j, array $c, ?array $extra = null): array
    {
        $out = [
            'id' => (int) $j['id'], 'title' => $j['title'], 'district' => $j['district'], 'type' => $j['type'],
            'typeLabel' => self::TYPE_LABEL[$j['type']] ?? $j['type'],
            'salaryMin' => $j['salary_min'] !== null ? (int) $j['salary_min'] : null,
            'salaryMax' => $j['salary_max'] !== null ? (int) $j['salary_max'] : null,
            'description' => $j['description'], 'deadline' => $j['deadline'], 'openings' => (int) $j['openings'],
            'status' => $j['status'], 'createdAt' => $j['created_at'],
            'company' => ['id' => (int) $c['id'], 'logo' => !empty($c['logo_upload_id']) ? '/api/uploads/' . (int) $c['logo_upload_id'] : null, 'name' => $c['name'], 'district' => $c['district'], 'verified' => $c['verified_at'] !== null],
        ];
        return $extra ? $out + $extra : $out;
    }

    public static function requirements(int $jobId): array
    {
        $st = Db::pdo()->prepare('SELECT id, label, weight FROM job_requirements WHERE job_id = ? ORDER BY weight DESC, id');
        $st->execute([$jobId]);
        return array_map(fn($r) => ['id' => (int) $r['id'], 'label' => $r['label'], 'weight' => (int) $r['weight']], $st->fetchAll());
    }

    public static function score(array $reqs, array $metIds): int
    {
        $total = array_sum(array_column($reqs, 'weight'));
        if ($total <= 0) return 0;
        $met = 0;
        foreach ($reqs as $r) if (in_array($r['id'], $metIds, true)) $met += $r['weight'];
        return (int) round($met * 100 / $total);
    }

    public static function money(mixed $v): ?int
    {
        if ($v === null || $v === '') return null;
        $n = (int) preg_replace('/\D+/', '', (string) $v);
        return $n > 0 && $n < 1_000_000_000 ? $n : null;
    }
}

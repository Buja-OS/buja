<?php
declare(strict_types=1);

final class InviteController
{
    public static function codeFor(array $u): string
    {
        $row = Db::one('SELECT invite_code FROM users WHERE id = ?', [$u['id']]);
        if (!empty($row['invite_code'])) return (string) $row['invite_code'];
        for ($i = 0; $i < 5; $i++) {
            $code = strtoupper(substr(str_replace(['0', 'O', 'I', '1', 'l'], '', base_convert(bin2hex(random_bytes(6)), 16, 36)), 0, 6));
            if (mb_strlen($code) < 6) continue;
            if (!Db::one('SELECT id FROM users WHERE invite_code = ?', [$code])) { Db::run('UPDATE users SET invite_code = ? WHERE id = ?', [$code, $u['id']]); return $code; }
        }
        return 'BUJA' . $u['id'];
    }

    /** GET /me/invite */
    public function index(): void
    {
        $u = Auth::require();
        $code = self::codeFor($u);
        $joined = Db::pdo()->prepare('SELECT name, created_at, district FROM users WHERE referred_by = ? ORDER BY id DESC LIMIT 20'); $joined->execute([$u['id']]);
        $rows = $joined->fetchAll();
        Http::json(['code' => $code, 'link' => (string) Http::config('app_origin') . '/#/join/' . $code,
            'count' => count($rows),
            'friends' => array_map(fn($r) => ['name' => explode(' ', trim($r['name']))[0], 'district' => $r['district'], 'at' => $r['created_at']], $rows)]);
    }

    /** GET /invite/{code} : who is inviting me, shown before sign-up */
    public function show(string $code): void
    {
        $u = Db::one('SELECT id, name, district FROM users WHERE invite_code = ? AND deleted_at IS NULL', [strtoupper($code)]);
        if (!$u) Http::json(['error' => 'not_found', 'message' => 'That invite link is not valid.'], 404);
        Http::json(['from' => ['name' => explode(' ', trim($u['name']))[0], 'district' => $u['district']]]);
    }
}

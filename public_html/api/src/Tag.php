<?php
declare(strict_types=1);

/**
 * Buja Tag: one unique @handle per account, for finding people, businesses and mechanics anywhere in Buja.
 * Tags are 3 to 20 letters, digits or underscores, stored lowercase, compared case-insensitively.
 * Every account gets one automatically from its name the first time it is needed; anyone can change theirs.
 */
final class Tag
{
    public const RESERVED = ['admin', 'buja', 'support', 'help', 'root', 'staff', 'moderator', 'official', 'abuja', 'fct', 'police', 'security', 'system', 'null', 'undefined', 'api', 'me', 'you', 'everyone', 'kart', 'match', 'waka', 'work', 'homes', 'learn'];

    public static function clean(string $t): string { return strtolower(preg_replace('/[^a-z0-9_]/i', '', ltrim(trim($t), '@'))); }

    /** Why a tag cannot be used, or null when it can. */
    public static function problem(string $t, ?int $forUser = null): ?string
    {
        if (strlen($t) < 3) return 'At least 3 letters or numbers.';
        if (strlen($t) > 20) return 'At most 20 characters.';
        if (ctype_digit($t)) return 'Use at least one letter.';
        if (in_array($t, self::RESERVED, true) || str_starts_with($t, 'buja')) return 'That one is reserved.';
        $taken = Db::one('SELECT id FROM users WHERE tag = ?', [$t]);
        if ($taken && (int) $taken['id'] !== (int) $forUser) return '@' . $t . ' is taken.';
        return null;
    }

    /** The account's tag, creating one from its name (or business name) if it has none yet. */
    public static function ensure(int $userId): ?string
    {
        $u = Db::one('SELECT id, name, tag, kind FROM users WHERE id = ?', [$userId]); if (!$u) return null;
        if (!empty($u['tag'])) return $u['tag'];
        $base = $u['name'];
        if (($u['kind'] ?? '') === 'company') { $c = Db::one('SELECT name FROM companies WHERE owner_id = ?', [$userId]); if ($c) $base = $c['name']; }
        $art = Db::one('SELECT business FROM artisans WHERE user_id = ?', [$userId]); if ($art && !empty($art['business'])) $base = $art['business'];
        $root = substr(self::clean(str_replace(' ', '', (string) $base)), 0, 14);
        if (strlen($root) < 3) $root = 'user' . $root;
        if (in_array($root, self::RESERVED, true) || str_starts_with($root, 'buja')) $root = 'x' . $root;
        for ($i = 0; $i < 40; $i++) {
            $try = $i === 0 ? $root : $root . ($i < 10 ? $i : random_int(10, 9999));
            if (self::problem($try, $userId) === null) {
                try { Db::run('UPDATE users SET tag = ? WHERE id = ? AND tag IS NULL', [$try, $userId]); } catch (Throwable $e) { continue; } // lost a race for it
                return (string) (Db::one('SELECT tag FROM users WHERE id = ?', [$userId])['tag'] ?? $try);
            }
        }
        return null;
    }

    /** Everything someone can do with a tag: who it is, and what they are on Buja. Never contact details. */
    public static function card(array $u, ?array $viewer = null): array
    {
        $id = (int) $u['id'];
        $art = Db::one('SELECT trade, business, base_district, verified_at, available FROM artisans WHERE user_id = ? AND hidden_at IS NULL', [$id]);
        $co = Db::one('SELECT id, name, district, verified_at FROM companies WHERE owner_id = ?', [$id]);
        $jobs = $co ? (int) (Db::one("SELECT COUNT(*) AS n FROM jobs WHERE company_id = ? AND status = 'open'", [$co['id']])['n'] ?? 0) : 0;
        $best = Db::one("SELECT MIN(lap_ms) AS b FROM kart_times WHERE user_id = ?", [$id]);
        $isArtisan = (bool) $art; $isCompany = (bool) $co;
        return [
            'id' => $id, 'tag' => $u['tag'], 'name' => $isCompany ? $co['name'] : ($isArtisan && $art['business'] ? $art['business'] : $u['name']),
            'person' => explode(' ', trim((string) $u['name']))[0], 'kind' => $isCompany ? 'company' : ($isArtisan ? 'artisan' : 'person'),
            'avatar' => Auth::picture($id), 'district' => $u['district'] ?? null,
            'verified' => !empty($u['selfie_verified_at']) || ($co && !empty($co['verified_at'])) || ($art && !empty($art['verified_at'])),
            'artisan' => $art ? ['trade' => $art['trade'], 'tradeLabel' => ArtisanController::TRADES[$art['trade']] ?? $art['trade'], 'available' => (bool) $art['available'], 'rating' => RatingController::summary($id, 'artisan')] : null,
            'company' => $co ? ['id' => (int) $co['id'], 'openJobs' => $jobs] : null,
            'kart' => $best && $best['b'] ? ['bestLapMs' => (int) $best['b']] : null,
            // Match is shown only when both people use it; the Match profile page applies its own rules.
            'match' => $viewer && (int) $viewer['id'] !== $id && Db::one('SELECT user_id FROM match_profiles WHERE user_id = ?', [$id]) !== null && Db::one('SELECT user_id FROM match_profiles WHERE user_id = ?', [$viewer['id']]) !== null,
            'companyName' => $co ? $co['name'] : null,
            'self' => $viewer && (int) $viewer['id'] === $id,
        ];
    }
}

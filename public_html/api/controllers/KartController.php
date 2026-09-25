<?php
declare(strict_types=1);

/**
 * Buja Kart. Solo and bot races are played entirely on the phone; the server keeps lap times, leaderboards and the
 * best laps as "ghosts" to race against. Rooms let friends race together: each phone sends its position about five
 * times a second and gets everyone else's back in the same request, along with new chat, so a free host without
 * websockets can run it. Phones smooth the movement between updates.
 */
final class KartController
{
    public const TRACKS = ['gp' => 'Abuja Grand Prix Circuit', 'abuja' => 'Abuja city streets', 'gp-r' => 'Grand Prix, reversed', 'abuja-r' => 'City streets, reversed'];
    public const MIN_LAP_MS = 20000;          // anything faster is not a real lap on this track
    public const COLOURS = ['#FF7A1A', '#1F5FBF', '#2E7D1E', '#C2185B', '#7A3E96', '#0E7C86'];
    public const STATS = ['engine' => 'Speed', 'accel' => 'Acceleration', 'handling' => 'Wheels', 'boost' => 'Nitro', 'stability' => 'Stability'];
    /** The upgrades this database has columns for (Stability arrives with migration 042). */
    private static function statKeys(?array $p): array { return array_values(array_filter(array_keys(self::STATS), fn($k) => !$p || array_key_exists($k, $p))); }
    public const MAX_LEVEL = 5;
    public const COST = [150, 300, 500, 800, 1200];           // price of level 1..5
    public const PAINTS = ['green' => 0, 'red' => 0, 'yellow' => 0, 'blue' => 0, 'gold' => 600, 'chrome' => 900, 'naija' => 750, 'pink' => 400, 'black' => 500];
    /** The shop. Prices in coins; the first item of each kind is free and owned by everyone. */
    public const SHOP = [
        'design' => ['classic' => 0, 'stripes' => 300, 'naija' => 500, 'flames' => 700, 'carbon' => 900, 'neon' => 1200],
        'helmet' => ['classic' => 0, 'chevron' => 200, 'naija' => 400, 'gold' => 600, 'carbon' => 700, 'chrome' => 800],
        'env'    => ['day' => 0, 'sunset' => 400, 'harmattan' => 600, 'night' => 800],
        'sound'  => ['kart' => 0, 'okada' => 300, 'electric' => 400, 'v8' => 500],
    ];
    /** Achievements: [title, how to earn it, coins]. */
    public const ACH = [
        'first_race'    => ['First race', 'Finish any race', 50],
        'first_win'     => ['Winner', 'Win a race against rivals', 100],
        'wins_10'       => ['Ten wins', 'Win 10 races', 300],
        'gp_champion'   => ['Grand Prix champion', 'Win a Grand Prix', 300],
        'streak_7'      => ['Every day for a week', 'Race 7 days in a row', 300],
        'drifter'       => ['Drift king', '10 drift boosts in one race', 150],
        'banana'        => ['Slippery', 'Spin a rival out with a banana', 100],
        'ghost_beaten'  => ['Ghostbuster', "Beat a friend's ghost lap", 150],
        'friend_race'   => ['Race day', 'Finish a race against friends', 100],
        'collector'     => ['Collector', 'Own 5 things from the shop', 200],
        'maxed'         => ['Fully tuned', 'Max out any upgrade', 200],
        'weekly_podium' => ['On the podium', "Finish top 3 in a week's tournament", 500],
    ];
    public const WEEK_PRIZES = [1 => 1000, 2 => 600, 3 => 300];
    public const QUICK = ['Let\'s go!', 'Nice one', 'Wait for me', 'GG', 'Rematch?', 'Na so!'];

    /** Unlimited coins and every upgrade, for the people named in KART_UNLIMITED (by default femiayor@gmail.com). Checked here, on the server. */
    private static function unlimited(int $uid): bool
    {
        $list = array_filter(array_map(fn($e) => strtolower(trim($e)), explode(',', (string) Http::config('kart_unlimited', getenv('KART_UNLIMITED') ?: 'femiayor@gmail.com'))));
        $u = Db::one('SELECT email FROM users WHERE id = ?', [$uid]);
        return $u && in_array(strtolower((string) $u['email']), $list, true);
    }
    private static function equippedOf(array $p): array
    {
        $e = json_decode((string) ($p['equipped'] ?? ''), true); $e = is_array($e) ? $e : [];
        $out = []; foreach (self::SHOP as $cat => $items) $out[$cat] = isset($e[$cat], $items[$e[$cat]]) ? $e[$cat] : array_key_first($items);
        return $out;
    }
    /** How a kart looks, for other players in a race room. */
    public static function lookOf(int $uid): array
    {
        try { $p = Db::one('SELECT * FROM kart_profiles WHERE user_id = ?', [$uid]); } catch (Throwable $e) { $p = null; }
        $stats = []; foreach (array_keys(self::STATS) as $k) $stats[$k] = $p ? (int) ($p[$k] ?? 0) : 0;   // upgrades show on the kart for everyone in the room
        return ($p ? self::equippedOf($p) + ['paint' => $p['paint'] ?? null] : self::equippedOf([]) + ['paint' => null]) + ['stats' => $stats];
    }
    /** Monday 00:00 in Abuja, as UTC, $offset weeks from this one. The tournament week. */
    public static function weekStart(int $offset = 0): string
    {
        $d = new DateTime('monday this week', new DateTimeZone('Africa/Lagos'));
        if ($offset) $d->modify(($offset > 0 ? '+' : '') . $offset . ' week');
        return $d->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s');
    }
    private static function weekKey(int $offset = 0): string { $d = new DateTime('monday this week', new DateTimeZone('Africa/Lagos')); if ($offset) $d->modify(($offset > 0 ? '+' : '') . $offset . ' week'); return $d->format('Y-m-d'); }

    /** Give an achievement once, with its coins. Returns it if new. Quietly does nothing before migration 039. */
    public static function achieve(int $uid, string $code): ?array
    {
        if (!isset(self::ACH[$code])) return null;
        try { Db::run('INSERT INTO kart_achievements (user_id, code, earned_at) VALUES (?,?,?)', [$uid, $code, Db::now()]); } catch (Throwable $e) { return null; } // already earned, or no table yet
        [$title, $how, $coins] = self::ACH[$code];
        self::profile($uid); Db::run('UPDATE kart_profiles SET coins = coins + ? WHERE user_id = ?', [$coins, $uid]);
        return ['code' => $code, 'title' => $title, 'coins' => $coins];
    }
    /** Achievements that depend on what someone owns: 5 shop items, or a maxed upgrade. */
    private static function ownershipAchievements(int $uid): array
    {
        $p = self::profile($uid); $out = [];
        $owned = count(array_filter(explode(',', (string) ($p['owned'] ?? '')))) + count(array_filter(explode(',', (string) $p['paints'])));
        if ($owned >= 5 && ($a = self::achieve($uid, 'collector'))) $out[] = $a;
        foreach (self::statKeys($p) as $s) if ((int) ($p[$s] ?? 0) >= self::MAX_LEVEL) { if ($a = self::achieve($uid, 'maxed')) $out[] = $a; break; }
        return $out;
    }
    /** Pay last week's tournament: the top 3 on each circuit. Runs once per week, from the scheduler or the leaderboard. */
    public static function awardWeekly(): void
    {
        try {
            $wk = self::weekKey(-1); $done = Db::one('SELECT v FROM app_keys WHERE k = ?', ['kart_week_paid']);
            if ($done && $done['v'] === $wk) return;
            Db::run("DELETE FROM app_keys WHERE k = 'kart_week_paid'"); Db::run("INSERT INTO app_keys (k, v) VALUES ('kart_week_paid', ?)", [$wk]);
            $from = self::weekStart(-1); $to = self::weekStart(0);
            foreach (array_keys(self::TRACKS) as $track) {
                $st = Db::pdo()->prepare('SELECT k.user_id, MIN(k.lap_ms) AS best FROM kart_times k JOIN users u ON u.id = k.user_id WHERE k.track = ? AND k.created_at >= ? AND k.created_at < ? AND u.deleted_at IS NULL GROUP BY k.user_id ORDER BY best LIMIT 3');
                $st->execute([$track, $from, $to]);
                foreach ($st->fetchAll() as $i => $r) {
                    $place = $i + 1; $coins = self::WEEK_PRIZES[$place];
                    try { Db::run('INSERT INTO kart_prizes (week, track, place, user_id, lap_ms, coins, created_at) VALUES (?,?,?,?,?,?,?)', [$wk, $track, $place, $r['user_id'], $r['best'], $coins, Db::now()]); } catch (Throwable $e) { continue; }
                    self::profile((int) $r['user_id']); Db::run('UPDATE kart_profiles SET coins = coins + ? WHERE user_id = ?', [$coins, $r['user_id']]);
                    self::achieve((int) $r['user_id'], 'weekly_podium');
                    Notify::user((int) $r['user_id'], 'social', ['', '🥇 You won', '🥈 2nd place', '🥉 3rd place'][$place] . ' in last week\'s Buja Kart tournament', self::TRACKS[$track] . ': +' . number_format($coins) . ' coins are in your garage.', '/#/kart/board?track=' . $track, true);
                }
            }
        } catch (Throwable $e) { error_log('[buja kart weekly] ' . $e->getMessage()); }
    }
    private static function track(string $t): string { return isset(self::TRACKS[$t]) ? $t : 'gp'; }
    private static function first(string $n): string { return explode(' ', trim($n))[0]; }

    private static function profile(int $uid): array
    {
        $p = Db::one('SELECT * FROM kart_profiles WHERE user_id = ?', [$uid]);
        if (!$p) { Db::run('INSERT INTO kart_profiles (user_id, coins, updated_at) VALUES (?,?,?)', [$uid, 200, Db::now()]); $p = Db::one('SELECT * FROM kart_profiles WHERE user_id = ?', [$uid]); } // 200 coins to start
        return $p;
    }
    private static function shapeProfile(array $p): array
    {
        $uid = (int) $p['user_id']; $vip = self::unlimited($uid);
        $owned = array_values(array_filter(explode(',', (string) $p['paints'])));
        $have = array_values(array_filter(explode(',', (string) ($p['owned'] ?? ''))));
        $eq = self::equippedOf($p); $shopReady = array_key_exists('owned', $p);
        $shop = []; foreach (self::SHOP as $cat => $items) foreach ($items as $id => $price) $shop[$cat][] = ['id' => $id, 'price' => $price, 'owned' => $vip || $price === 0 || in_array("$cat:$id", $have, true), 'equipped' => $eq[$cat] === $id];
        return ['coins' => $vip ? 999999 : (int) $p['coins'], 'unlimited' => $vip, 'races' => (int) $p['races'], 'wins' => (int) $p['wins'], 'maxLevel' => self::MAX_LEVEL,
            'stats' => array_map(fn($k) => ['id' => $k, 'label' => self::STATS[$k], 'level' => (int) $p[$k], 'next' => (int) $p[$k] < self::MAX_LEVEL ? ($vip ? 0 : self::COST[(int) $p[$k]]) : null], self::statKeys($p)),
            'paints' => array_map(fn($id, $price) => ['id' => $id, 'price' => $price, 'owned' => $vip || $price === 0 || in_array($id, $owned, true)], array_keys(self::PAINTS), self::PAINTS), 'paint' => $p['paint'],
            'shop' => $shop, 'equipped' => $eq, 'shopReady' => $shopReady, 'streak' => (int) ($p['streak'] ?? 0)];
    }
    /** GET /kart/garage */
    public function garage(): void { $u = Auth::require(); Http::json(['garage' => self::shapeProfile(self::profile((int) $u['id']))]); }
    /** POST /kart/garage/upgrade { stat } */
    public function upgrade(): void
    {
        $u = Auth::require(); $stat = (string) (Http::body()['stat'] ?? '');
        if (!isset(self::STATS[$stat])) Http::json(['error' => 'validation', 'message' => 'Which part?'], 422);
        $p = self::profile((int) $u['id']); if (!array_key_exists($stat, $p)) Http::json(['error' => 'validation', 'message' => 'Stability is coming very soon. Try again shortly.'], 422);
        $lvl = (int) $p[$stat];
        if ($lvl >= self::MAX_LEVEL) Http::json(['error' => 'validation', 'message' => 'That is already fully upgraded.'], 422);
        $cost = self::unlimited((int) $u['id']) ? 0 : self::COST[$lvl];
        // pay and level up in one statement, so two taps cannot spend the same coins twice
        $st = Db::pdo()->prepare("UPDATE kart_profiles SET coins = coins - ?, $stat = $stat + 1, updated_at = ? WHERE user_id = ? AND coins >= ? AND $stat = ?");
        $st->execute([$cost, Db::now(), $u['id'], $cost, $lvl]);
        if ($st->rowCount() === 0) Http::json(['error' => 'validation', 'message' => 'Not enough coins yet. Race to earn more.'], 422);
        Http::json(['garage' => self::shapeProfile(self::profile((int) $u['id'])), 'achievements' => self::ownershipAchievements((int) $u['id'])]);
    }
    /** POST /kart/garage/paint { paint } : buy (if needed) and use a paint */
    public function paint(): void
    {
        $u = Auth::require(); $id = (string) (Http::body()['paint'] ?? '');
        if ($id === '') { self::profile((int) $u['id']); Db::run('UPDATE kart_profiles SET paint = NULL WHERE user_id = ?', [$u['id']]); Http::json(['garage' => self::shapeProfile(self::profile((int) $u['id']))]); } // back to the driver's own colour
        if (!array_key_exists($id, self::PAINTS)) Http::json(['error' => 'validation'], 422);
        $p = self::profile((int) $u['id']); $owned = array_filter(explode(',', (string) $p['paints'])); $price = self::PAINTS[$id];
        if (self::unlimited((int) $u['id'])) { if (!in_array($id, $owned, true)) Db::run('UPDATE kart_profiles SET paints = ? WHERE user_id = ?', [implode(',', array_merge($owned, [$id])), $u['id']]); }
        elseif ($price > 0 && !in_array($id, $owned, true)) {
            $st = Db::pdo()->prepare('UPDATE kart_profiles SET coins = coins - ?, paints = ?, updated_at = ? WHERE user_id = ? AND coins >= ?');
            $st->execute([$price, implode(',', array_merge($owned, [$id])), Db::now(), $u['id'], $price]);
            if ($st->rowCount() === 0) Http::json(['error' => 'validation', 'message' => 'Not enough coins for that paint yet.'], 422);
        }
        Db::run('UPDATE kart_profiles SET paint = ? WHERE user_id = ?', [$id, $u['id']]);
        Http::json(['garage' => self::shapeProfile(self::profile((int) $u['id']))]);
    }

    /** POST /kart/garage/item { cat, id } : buy it if needed (once), then use it */
    public function item(): void
    {
        $u = Auth::require(); $b = Http::body(); $cat = (string) ($b['cat'] ?? ''); $id = (string) ($b['id'] ?? '');
        if (!isset(self::SHOP[$cat][$id])) Http::json(['error' => 'validation', 'message' => 'That is not in the shop.'], 422);
        $p = self::profile((int) $u['id']);
        if (!array_key_exists('owned', $p)) Http::json(['error' => 'unavailable', 'message' => 'The kart shop opens once the latest update is installed (migration 038).'], 503);
        $have = array_values(array_filter(explode(',', (string) $p['owned']))); $token = "$cat:$id"; $price = self::SHOP[$cat][$id];
        if (!in_array($token, $have, true) && $price > 0) {
            if (self::unlimited((int) $u['id'])) Db::run('UPDATE kart_profiles SET owned = ? WHERE user_id = ?', [implode(',', array_merge($have, [$token])), $u['id']]);
            else {
                // pay and own in one statement, so two taps cannot spend the same coins twice
                $st = Db::pdo()->prepare('UPDATE kart_profiles SET coins = coins - ?, owned = ?, updated_at = ? WHERE user_id = ? AND coins >= ? AND owned = ?');
                $st->execute([$price, implode(',', array_merge($have, [$token])), Db::now(), $u['id'], $price, (string) $p['owned']]);
                if ($st->rowCount() === 0) Http::json(['error' => 'validation', 'message' => 'Not enough coins yet. Race to earn more.'], 422);
            }
        }
        $eq = self::equippedOf($p); $eq[$cat] = $id;
        Db::run('UPDATE kart_profiles SET equipped = ?, updated_at = ? WHERE user_id = ?', [json_encode($eq), Db::now(), $u['id']]);
        Http::json(['garage' => self::shapeProfile(self::profile((int) $u['id'])), 'achievements' => self::ownershipAchievements((int) $u['id'])]);
    }

    /** GET /kart/achievements : what I have and what is left */
    public function achievements(): void
    {
        $u = Auth::require(); $have = [];
        try { $st = Db::pdo()->prepare('SELECT code, earned_at FROM kart_achievements WHERE user_id = ?'); $st->execute([$u['id']]); foreach ($st->fetchAll() as $r) $have[$r['code']] = $r['earned_at']; } catch (Throwable $e) {}
        Http::json(['achievements' => array_map(fn($code, $a) => ['code' => $code, 'title' => $a[0], 'how' => $a[1], 'coins' => $a[2], 'earnedAt' => $have[$code] ?? null], array_keys(self::ACH), self::ACH)]);
    }

    /** GET /kart/friend-ghosts?track= : friends who have a best lap here to race against */
    public function friendGhosts(): void
    {
        $u = Auth::require(); $track = self::track((string) ($_GET['track'] ?? 'gp')); $out = [];
        $ids = class_exists('FriendsController') ? FriendsController::friendIds((int) $u['id']) : [];
        foreach (array_slice($ids, 0, 60) as $fid) {
            $r = Db::one('SELECT k.lap_ms, u.name, u.tag FROM kart_times k JOIN users u ON u.id = k.user_id WHERE k.user_id = ? AND k.track = ? AND k.ghost IS NOT NULL ORDER BY k.lap_ms LIMIT 1', [$fid, $track]);
            if ($r) $out[] = ['id' => (int) $fid, 'name' => self::first($r['name']), 'tag' => $r['tag'], 'lapMs' => (int) $r['lap_ms'], 'avatar' => Auth::picture((int) $fid)];
        }
        usort($out, fn($a, $b) => $a['lapMs'] <=> $b['lapMs']);
        Http::json(['track' => $track, 'friends' => $out]);
    }

    /** POST /kart/perf : how a race ran on this phone (frame rate, graphics level, chip). Up to 30 a day per person. */
    public function perf(): void
    {
        $u = Auth::require(); RateLimit::hit('kartperf', 30, 86400); $b = Http::body();
        $tier = in_array($b['tier'] ?? '', ['low', 'medium', 'high'], true) ? $b['tier'] : null;
        $avg = (float) ($b['fpsAvg'] ?? 0); $low = (float) ($b['fpsLow'] ?? 0); $sec = (int) ($b['seconds'] ?? 0);
        if (!$tier || $avg <= 0 || $avg > 240 || $low < 0 || $low > $avg + 1 || $sec < 15) Http::json(['error' => 'validation'], 422);
        try {
            Db::run('INSERT INTO kart_perf (user_id, tier, auto_tier, gpu, device, mem_gb, cores, fps_avg, fps_low, draw_calls, track, seconds, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
                [$u['id'], $tier, empty($b['auto']) ? 0 : 1, mb_substr((string) ($b['gpu'] ?? 'unknown'), 0, 120) ?: 'unknown', mb_substr((string) ($b['device'] ?? ''), 0, 80) ?: null, isset($b['mem']) ? (float) $b['mem'] : null, isset($b['cores']) ? (int) $b['cores'] : null, round($avg, 1), round($low, 1), isset($b['draws']) ? (int) $b['draws'] : null, self::track((string) ($b['track'] ?? 'gp')), min($sec, 3600), Db::now()]);
        } catch (Throwable $e) { Http::json(['ok' => false]); }
        Http::json(['ok' => true]);
    }

    /** GET /kart/tier-hint?gpu= : what Auto should pick for this graphics chip, learned from real races */
    public function tierHint(): void
    {
        Auth::require(); $gpu = mb_substr((string) ($_GET['gpu'] ?? ''), 0, 120); $best = null;
        try {
            foreach (['high', 'medium', 'low'] as $t) {
                $r = Db::one('SELECT COUNT(*) AS n, AVG(fps_avg) AS a, AVG(fps_low) AS l FROM kart_perf WHERE gpu = ? AND tier = ? AND created_at > ?', [$gpu, $t, gmdate('Y-m-d H:i:s', time() - 60 * 86400)]);
                if ($r && (int) $r['n'] >= 3 && (float) $r['a'] >= 40 && (float) $r['l'] >= 25) { $best = $t; break; }   // smooth enough, on at least 3 races
            }
        } catch (Throwable $e) {}
        Http::json(['gpu' => $gpu, 'tier' => $best]);
    }

    /** GET /admin/kart-perf : how the game runs on players' phones */
    public function adminPerf(): void
    {
        $u = Auth::require(); if (($u['role'] ?? (!empty($u['is_admin']) ? 'admin' : 'user')) !== 'admin') Http::json(['error' => 'forbidden', 'message' => 'Admins only.'], 403);
        $since = gmdate('Y-m-d H:i:s', time() - 30 * 86400); $q = function ($sql, $p = []) { $st = Db::pdo()->prepare($sql); $st->execute($p); return $st->fetchAll(); };
        try {
            $tiers = $q('SELECT tier, COUNT(*) AS n, AVG(fps_avg) AS a, AVG(fps_low) AS l, SUM(CASE WHEN fps_avg < 25 THEN 1 ELSE 0 END) AS choppy, SUM(auto_tier) AS auto FROM kart_perf WHERE created_at > ? GROUP BY tier', [$since]);
            $gpus = $q('SELECT gpu, COUNT(*) AS n, AVG(fps_avg) AS a, AVG(fps_low) AS l, MAX(device) AS device FROM kart_perf WHERE created_at > ? GROUP BY gpu ORDER BY n DESC LIMIT 15', [$since]);
            $recent = $q('SELECT p.tier, p.auto_tier, p.gpu, p.device, p.fps_avg, p.fps_low, p.track, p.created_at, u.name FROM kart_perf p JOIN users u ON u.id = p.user_id ORDER BY p.id DESC LIMIT 25');
        } catch (Throwable $e) { Http::json(['ready' => false]); }
        Http::json(['ready' => true,
            'tiers' => array_map(fn($r) => ['tier' => $r['tier'], 'races' => (int) $r['n'], 'fps' => round((float) $r['a'], 1), 'low' => round((float) $r['l'], 1), 'choppy' => (int) $r['choppy'], 'auto' => (int) $r['auto']], $tiers),
            'gpus' => array_map(fn($r) => ['gpu' => $r['gpu'], 'device' => $r['device'], 'races' => (int) $r['n'], 'fps' => round((float) $r['a'], 1), 'low' => round((float) $r['l'], 1)], $gpus),
            'recent' => array_map(fn($r) => ['tier' => $r['tier'], 'auto' => (bool) $r['auto_tier'], 'gpu' => $r['gpu'], 'device' => $r['device'], 'fps' => (float) $r['fps_avg'], 'low' => (float) $r['fps_low'], 'track' => $r['track'], 'at' => $r['created_at'], 'name' => self::first($r['name'])], $recent)]);
    }

    /** GET /kart/board?track=&span=week|all : best lap per driver, and where I stand */
    public function board(): void
    {
        $u = Auth::require(); $track = self::track((string) ($_GET['track'] ?? 'abuja'));
        $week = ($_GET['span'] ?? 'week') === 'week';
        if ($week) self::awardWeekly();
        $since = $week ? self::weekStart(0) : '2000-01-01';
        $st = Db::pdo()->prepare('SELECT k.user_id, MIN(k.lap_ms) AS best, u.name, u.tag FROM kart_times k JOIN users u ON u.id = k.user_id WHERE k.track = ? AND k.created_at > ? AND u.deleted_at IS NULL GROUP BY k.user_id, u.name, u.tag ORDER BY best LIMIT 50');
        $st->execute([$track, $since]); $rows = $st->fetchAll();
        $mine = null;
        foreach ($rows as $i => $r) if ((int) $r['user_id'] === (int) $u['id']) $mine = ['rank' => $i + 1, 'best' => (int) $r['best']];
        if (!$mine) { $b = Db::one('SELECT MIN(lap_ms) AS b FROM kart_times WHERE user_id = ? AND track = ? AND created_at > ?', [$u['id'], $track, $since]); if ($b && $b['b']) $mine = ['rank' => null, 'best' => (int) $b['b']]; }
        $last = []; try { $st = Db::pdo()->prepare('SELECT p.place, p.lap_ms, p.coins, u.name, u.tag FROM kart_prizes p JOIN users u ON u.id = p.user_id WHERE p.week = ? AND p.track = ? ORDER BY p.place'); $st->execute([self::weekKey(-1), $track]); $last = array_map(fn($r) => ['place' => (int) $r['place'], 'name' => self::first($r['name']), 'tag' => $r['tag'], 'lapMs' => (int) $r['lap_ms'], 'coins' => (int) $r['coins']], $st->fetchAll()); } catch (Throwable $e) {}
        $tournament = ['endsAt' => str_replace(' ', 'T', self::weekStart(1)) . 'Z', 'prizes' => self::WEEK_PRIZES, 'lastWeek' => $last];
        Http::json(['track' => $track, 'trackName' => self::TRACKS[$track], 'span' => $week ? 'week' : 'all', 'me' => $mine, 'tournament' => $tournament,
            'rows' => array_map(fn($r, $i) => ['rank' => $i + 1, 'userId' => (int) $r['user_id'], 'name' => self::first($r['name']), 'tag' => $r['tag'], 'avatar' => Auth::picture((int) $r['user_id']), 'lapMs' => (int) $r['best'], 'me' => (int) $r['user_id'] === (int) $u['id']], $rows, array_keys($rows))]);
    }

    /** POST /kart/times { track, lapMs, raceMs, mode, ghost } */
    public function saveTime(): void
    {
        $u = Auth::require(); RateLimit::hit('karttime', 60, 3600); $b = Http::body();
        $track = self::track((string) ($b['track'] ?? 'abuja'));
        $lap = (int) ($b['lapMs'] ?? 0); $race = (int) ($b['raceMs'] ?? 0);
        if ($lap < self::MIN_LAP_MS || $lap > 600000 || $race < $lap || $race > 3600000) Http::json(['error' => 'validation', 'message' => 'That time does not look like a real race.'], 422);
        $mode = in_array($b['mode'] ?? '', ['solo', 'bots', 'room', 'gp'], true) ? $b['mode'] : 'solo';
        $ghost = null;
        if (!empty($b['ghost']) && is_array($b['ghost']) && count($b['ghost']) <= 1200) $ghost = json_encode(array_map(fn($p) => [round((float) $p[0], 1), round((float) $p[1], 1), round((float) $p[2], 2)], array_values($b['ghost'])));
        $prev = Db::one('SELECT MIN(lap_ms) AS b FROM kart_times WHERE user_id = ? AND track = ?', [$u['id'], $track]);
        Db::run('INSERT INTO kart_times (user_id, track, lap_ms, race_ms, mode, ghost, created_at) VALUES (?,?,?,?,?,?,?)', [$u['id'], $track, $lap, $race, $mode, $ghost, Db::now()]);
        $rank = (int) (Db::one('SELECT COUNT(*) AS n FROM (SELECT user_id, MIN(lap_ms) AS best FROM kart_times WHERE track = ? GROUP BY user_id) t WHERE best < ?', [$track, $lap])['n'] ?? 0) + 1;
        Track::hit($u, 'kart', 'race_' . $mode);
        $place = max(1, min(8, (int) ($b['place'] ?? 4))); $pb = !$prev || !$prev['b'] || $lap < (int) $prev['b'];
        $earned = ($mode === 'solo' ? 40 : [1 => 120, 2 => 80, 3 => 60][$place] ?? 40) + ($mode === 'room' ? 30 : 0) + ($pb ? 50 : 0);
        self::profile((int) $u['id']);
        Db::run('UPDATE kart_profiles SET coins = coins + ?, races = races + 1, wins = wins + ?, updated_at = ? WHERE user_id = ?', [$earned, $place === 1 && $mode !== 'solo' ? 1 : 0, Db::now(), $u['id']]);
        // First race of the day: 100 coins, 25 more for each day in a row (up to a week). Abuja's calendar day.
        $daily = null;
        try {
            $today = (new DateTime('now', new DateTimeZone('Africa/Lagos')))->format('Y-m-d'); $yest = (new DateTime('yesterday', new DateTimeZone('Africa/Lagos')))->format('Y-m-d');
            $p = Db::one('SELECT daily_on, streak FROM kart_profiles WHERE user_id = ?', [$u['id']]);
            if ($p && (string) $p['daily_on'] !== $today) {
                $streak = (string) $p['daily_on'] === $yest ? min(7, (int) $p['streak'] + 1) : 1; $bonus = 100 + 25 * ($streak - 1);
                $st = Db::pdo()->prepare('UPDATE kart_profiles SET coins = coins + ?, daily_on = ?, streak = ? WHERE user_id = ? AND (daily_on IS NULL OR daily_on <> ?)');
                $st->execute([$bonus, $today, $streak, $u['id'], $today]);
                if ($st->rowCount() === 1) { $daily = ['bonus' => $bonus, 'streak' => $streak]; $earned += $bonus; }
            }
        } catch (Throwable $e) {} // before migration 038 there is simply no daily bonus
        $uid = (int) $u['id']; $got = []; $stats = is_array($b['stats'] ?? null) ? $b['stats'] : [];
        $add = function ($a) use (&$got) { if ($a) $got[] = $a; };
        $add(self::achieve($uid, 'first_race'));
        if ($place === 1 && $mode !== 'solo') $add(self::achieve($uid, 'first_win'));
        $pr = self::profile($uid);
        if ((int) $pr['wins'] >= 10) $add(self::achieve($uid, 'wins_10'));
        if ((int) ($pr['streak'] ?? 0) >= 7) $add(self::achieve($uid, 'streak_7'));
        if ((int) ($stats['drifts'] ?? 0) >= 10) $add(self::achieve($uid, 'drifter'));
        if ((int) ($stats['bananaHits'] ?? 0) >= 1 && $mode !== 'solo') $add(self::achieve($uid, 'banana'));
        if ($mode === 'room') $add(self::achieve($uid, 'friend_race'));
        // a friend's ghost is checked here, not taken on trust: the lap must beat that friend's real best
        $fid = (int) ($stats['ghostFriend'] ?? 0);
        if ($fid && class_exists('FriendsController') && FriendsController::state($uid, $fid) === 'friends') { $fb = Db::one('SELECT MIN(lap_ms) AS b FROM kart_times WHERE user_id = ? AND track = ?', [$fid, $track]); if ($fb && $fb['b'] && $lap < (int) $fb['b']) $add(self::achieve($uid, 'ghost_beaten')); }
        $bonusCoins = array_sum(array_map(fn($a) => $a['coins'], $got));
        Http::json(['personalBest' => $pb, 'previousBest' => $prev && $prev['b'] ? (int) $prev['b'] : null, 'rank' => $rank, 'coinsEarned' => $earned + $bonusCoins, 'daily' => $daily, 'achievements' => $got, 'coins' => (int) (Db::one('SELECT coins FROM kart_profiles WHERE user_id = ?', [$u['id']])['coins'] ?? 0)], 201);
    }

    /** POST /kart/gp { place } : a bonus for finishing all four Grand Prix races (a real Grand Prix takes 6 minutes or more) */
    public function gpFinish(): void
    {
        $u = Auth::require(); RateLimit::hit('kartgp', 1, 300);
        $place = max(1, min(4, (int) (Http::body()['place'] ?? 4))); $coins = [1 => 400, 2 => 250, 3 => 150, 4 => 80][$place];
        self::profile((int) $u['id']);
        Db::run('UPDATE kart_profiles SET coins = coins + ?, wins = wins + ?, updated_at = ? WHERE user_id = ?', [$coins, $place === 1 ? 1 : 0, Db::now(), $u['id']]);
        Track::hit($u, 'kart', 'gp_finish');
        $ach = $place === 1 ? self::achieve((int) $u['id'], 'gp_champion') : null;
        Http::json(['coinsEarned' => $coins, 'achievements' => $ach ? [$ach] : [], 'garage' => self::shapeProfile(self::profile((int) $u['id']))]);
    }

    /** GET /kart/ghost?track=&who=me|best : a lap to race against */
    public function ghost(): void
    {
        $u = Auth::require(); $track = self::track((string) ($_GET['track'] ?? 'abuja')); $who = (string) ($_GET['who'] ?? 'me');
        $where = ''; $label = null;
        if ($who === 'friend') {
            $fid = (int) ($_GET['id'] ?? 0);
            if (!$fid || !class_exists('FriendsController') || FriendsController::state((int) $u['id'], $fid) !== 'friends') Http::json(['error' => 'forbidden', 'message' => 'You can race the ghost of friends only.'], 403);
            $where = ' AND k.user_id = ' . $fid;
        } elseif ($who === 'me') { $where = ' AND k.user_id = ' . (int) $u['id']; $label = 'Your best'; }
        $r = Db::one('SELECT k.ghost, k.lap_ms, u.name FROM kart_times k JOIN users u ON u.id = k.user_id WHERE k.track = ? AND k.ghost IS NOT NULL' . $where . ' ORDER BY k.lap_ms LIMIT 1', [$track]);
        Http::json(['ghost' => $r ? ['name' => $label ?? self::first($r['name']), 'lapMs' => (int) $r['lap_ms'], 'path' => json_decode((string) $r['ghost'], true)] : null]);
    }

    /* ------------------------------ Rooms ------------------------------ */
    private function room(string $code): array
    {
        $r = Db::one('SELECT * FROM kart_rooms WHERE code = ?', [strtoupper(preg_replace('/[^A-Z0-9]/i', '', $code))]);
        if (!$r || strtotime($r['created_at'] . ' UTC') < time() - 6 * 3600) Http::json(['error' => 'not_found', 'message' => 'That race room has closed. Start a new one.'], 404);
        return $r;
    }
    private function seat(array $r, int $uid): ?array { return Db::one('SELECT * FROM kart_players WHERE room_id = ? AND user_id = ?', [$r['id'], $uid]); }
    private function join(array $r, array $u): void
    {
        if ($this->seat($r, (int) $u['id'])) return;
        $n = (int) (Db::one('SELECT COUNT(*) AS n FROM kart_players WHERE room_id = ?', [$r['id']])['n'] ?? 0);
        if ($n >= 6) Http::json(['error' => 'validation', 'message' => 'This room is full (6 drivers).'], 409);
        if ($r['status'] !== 'lobby') Http::json(['error' => 'validation', 'message' => 'This race has already started. Ask for a rematch.'], 409);
        Db::run('INSERT INTO kart_players (room_id, user_id, colour, joined_at) VALUES (?,?,?,?)', [$r['id'], $u['id'], self::COLOURS[$n % count(self::COLOURS)], Db::now()]);
        $this->say($r, (int) $u['id'], '👋 joined');
    }
    private function say(array $r, int $uid, string $body): void { Db::run('INSERT INTO kart_chat (room_id, user_id, body, created_at) VALUES (?,?,?,?)', [$r['id'], $uid, mb_substr($body, 0, 140), Db::now()]); }

    /** POST /kart/rooms { track } : a private room with a five-letter code */
    public function createRoom(): void
    {
        $u = Auth::require(); RateLimit::hit('kartroom', 20, 3600);
        $track = self::track((string) (Http::body()['track'] ?? 'abuja'));
        for ($i = 0; $i < 10; $i++) { $code = substr(str_shuffle('ABCDEFGHJKMNPQRSTUVWXYZ23456789'), 0, 5); if (!Db::one('SELECT id FROM kart_rooms WHERE code = ?', [$code])) break; }
        Db::run('INSERT INTO kart_rooms (code, host_id, track, created_at) VALUES (?,?,?,?)', [$code, $u['id'], $track, Db::now()]);
        $r = Db::one('SELECT * FROM kart_rooms WHERE code = ?', [$code]); $this->join($r, $u);
        Http::json(['code' => $code], 201);
    }

    /** POST /kart/rooms/{code}/join */
    public function joinRoom(string $code): void { $u = Auth::require(); $r = $this->room($code); $this->join($r, $u); $this->sync($code); }

    /** POST /kart/rooms/{code}/invite { tag } : a notification that opens the room */
    public function invite(string $code): void
    {
        $u = Auth::require(); RateLimit::hit('kartinvite', 30, 3600); $r = $this->room($code);
        if (!$this->seat($r, (int) $u['id'])) Http::json(['error' => 'forbidden', 'message' => 'Join the room first.'], 403);
        $t = Tag::clean((string) (Http::body()['tag'] ?? ''));
        $f = $t ? Db::one('SELECT id, name FROM users WHERE tag = ? AND deleted_at IS NULL', [$t]) : null;
        if (!$f) Http::json(['error' => 'not_found', 'message' => 'Nobody on Buja uses @' . $t . '.'], 404);
        if ((int) $f['id'] === (int) $u['id']) Http::json(['error' => 'validation', 'message' => 'That is you.'], 422);
        Notify::user((int) $f['id'], 'social', self::first($u['name']) . ' challenged you to Buja Kart 🏁', 'Race round Eagle Square and Aso Rock. Room ' . $r['code'] . '. Tap to join.', '/#/kart/room/' . $r['code'], true);
        $this->say($r, (int) $u['id'], '📨 invited @' . $t);
        Http::json(['ok' => true, 'name' => self::first($f['name'])]);
    }

    /**
     * POST /kart/rooms/{code}/sync { state: "x,z,h,s,lap,prog", ready, chatAfter } : the one request a racing phone
     * makes, about five times a second. Stores my position, returns everyone's, the room's status and new chat.
     */
    public function sync(string $code): void
    {
        $u = Auth::require(); $r = $this->room($code); $b = Http::body();
        $me = $this->seat($r, (int) $u['id']); if (!$me) Http::json(['error' => 'forbidden', 'message' => 'Join the room first.'], 403);
        if (isset($b['state']) && preg_match('/^-?[\d.]+(,-?[\d.]+){5}$/', (string) $b['state'])) Db::run('UPDATE kart_players SET state = ?, state_at = ? WHERE room_id = ? AND user_id = ?', [(string) $b['state'], gmdate('Y-m-d H:i:s') . substr(sprintf('%.3f', microtime(true) - floor(microtime(true))), 1), $r['id'], $u['id']]);
        if (array_key_exists('ready', $b)) Db::run('UPDATE kart_players SET ready = ? WHERE room_id = ? AND user_id = ?', [empty($b['ready']) ? 0 : 1, $r['id'], $u['id']]);
        $ps = Db::pdo()->prepare('SELECT p.*, u.name, u.tag FROM kart_players p JOIN users u ON u.id = p.user_id WHERE p.room_id = ? ORDER BY p.joined_at'); $ps->execute([$r['id']]);
        $after = (int) ($b['chatAfter'] ?? 0);
        $cs = Db::pdo()->prepare('SELECT c.id, c.body, c.user_id, u.name FROM kart_chat c JOIN users u ON u.id = c.user_id WHERE c.room_id = ? AND c.id > ? ORDER BY c.id LIMIT 30'); $cs->execute([$r['id'], $after]);
        $startMs = $r['start_at'] ? (int) round((strtotime(substr($r['start_at'], 0, 19) . ' UTC') + (float) ('0.' . (explode('.', $r['start_at'])[1] ?? '0'))) * 1000) : null;
        Http::json(['room' => ['code' => $r['code'], 'track' => $r['track'], 'laps' => (int) $r['laps'], 'status' => $r['status'], 'host' => (int) $r['host_id'] === (int) $u['id'], 'startAt' => $startMs, 'now' => (int) round(microtime(true) * 1000)],
            'players' => array_map(fn($p) => ['id' => (int) $p['user_id'], 'name' => self::first($p['name']), 'tag' => $p['tag'], 'colour' => $p['colour'], 'ready' => (bool) $p['ready'], 'me' => (int) $p['user_id'] === (int) $u['id'],
                'state' => $p['state'] ? array_map('floatval', explode(',', $p['state'])) : null, 'finishMs' => $p['finish_ms'] !== null ? (int) $p['finish_ms'] : null,
                'avatar' => Auth::picture((int) $p['user_id']), 'look' => self::lookOf((int) $p['user_id'])], $ps->fetchAll()),
            'chat' => array_map(fn($c) => ['id' => (int) $c['id'], 'body' => $c['body'], 'name' => self::first($c['name']), 'me' => (int) $c['user_id'] === (int) $u['id']], $cs->fetchAll()),
            'quick' => self::QUICK]);
    }

    /** POST /kart/rooms/{code}/start : the host starts; every phone counts down to the same moment */
    public function start(string $code): void
    {
        $u = Auth::require(); $r = $this->room($code);
        if ((int) $r['host_id'] !== (int) $u['id']) Http::json(['error' => 'forbidden', 'message' => 'Only the host can start the race.'], 403);
        if ($r['status'] === 'racing') $this->sync($code);
        $at = microtime(true) + 5; // five seconds of countdown, the same on every phone
        Db::run("UPDATE kart_rooms SET status = 'racing', start_at = ? WHERE id = ?", [gmdate('Y-m-d H:i:s', (int) $at) . substr(sprintf('%.3f', $at - floor($at)), 1), $r['id']]);
        Db::run('UPDATE kart_players SET finish_ms = NULL, state = NULL WHERE room_id = ?', [$r['id']]);
        $this->say($r, (int) $u['id'], '🏁 started the race');
        $this->sync($code);
    }

    /** POST /kart/rooms/{code}/finish { ms } */
    public function finish(string $code): void
    {
        $u = Auth::require(); $r = $this->room($code); $ms = (int) (Http::body()['ms'] ?? 0);
        if ($ms < self::MIN_LAP_MS * (int) $r['laps'] * 0.8) Http::json(['error' => 'validation'], 422);
        Db::run('UPDATE kart_players SET finish_ms = COALESCE(finish_ms, ?) WHERE room_id = ? AND user_id = ?', [$ms, $r['id'], $u['id']]);
        $left = (int) (Db::one('SELECT COUNT(*) AS n FROM kart_players WHERE room_id = ? AND finish_ms IS NULL', [$r['id']])['n'] ?? 0);
        if ($left === 0) Db::run("UPDATE kart_rooms SET status = 'done' WHERE id = ?", [$r['id']]);
        $this->say($r, (int) $u['id'], '🏆 finished in ' . sprintf('%d:%05.2f', intdiv($ms, 60000), ($ms % 60000) / 1000));
        $this->sync($code);
    }

    /** POST /kart/rooms/{code}/again : the host reopens the lobby for a rematch */
    public function again(string $code): void
    {
        $u = Auth::require(); $r = $this->room($code);
        if ((int) $r['host_id'] !== (int) $u['id']) Http::json(['error' => 'forbidden', 'message' => 'Only the host can start a rematch.'], 403);
        Db::run("UPDATE kart_rooms SET status = 'lobby', start_at = NULL WHERE id = ?", [$r['id']]);
        Db::run('UPDATE kart_players SET finish_ms = NULL, state = NULL, ready = 0 WHERE room_id = ?', [$r['id']]);
        $this->say($r, (int) $u['id'], '🔁 rematch');
        $this->sync($code);
    }

    /** POST /kart/rooms/{code}/chat { body } */
    public function chat(string $code): void
    {
        $u = Auth::require(); RateLimit::hit('kartchat', 40, 60); $r = $this->room($code);
        if (!$this->seat($r, (int) $u['id'])) Http::json(['error' => 'forbidden'], 403);
        $body = trim((string) (Http::body()['body'] ?? '')); if ($body === '') Http::json(['error' => 'validation'], 422);
        $this->say($r, (int) $u['id'], $body);
        Http::json(['ok' => true]);
    }
}

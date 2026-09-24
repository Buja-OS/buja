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
    public const TRACKS = ['gp' => 'Abuja Grand Prix Circuit', 'abuja' => 'Abuja city streets'];
    public const MIN_LAP_MS = 20000;          // anything faster is not a real lap on this track
    public const COLOURS = ['#FF7A1A', '#1F5FBF', '#2E7D1E', '#C2185B', '#7A3E96', '#0E7C86'];
    public const STATS = ['engine' => 'Engine', 'accel' => 'Acceleration', 'handling' => 'Handling', 'boost' => 'Boost'];
    public const MAX_LEVEL = 5;
    public const COST = [150, 300, 500, 800, 1200];           // price of level 1..5
    public const PAINTS = ['green' => 0, 'red' => 0, 'yellow' => 0, 'blue' => 0, 'gold' => 600, 'chrome' => 900, 'naija' => 750, 'pink' => 400, 'black' => 500];
    public const QUICK = ['Let\'s go!', 'Nice one', 'Wait for me', 'GG', 'Rematch?', 'Na so!'];

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
        $owned = array_values(array_filter(explode(',', (string) $p['paints'])));
        return ['coins' => (int) $p['coins'], 'races' => (int) $p['races'], 'wins' => (int) $p['wins'], 'maxLevel' => self::MAX_LEVEL,
            'stats' => array_map(fn($k, $label) => ['id' => $k, 'label' => $label, 'level' => (int) $p[$k], 'next' => (int) $p[$k] < self::MAX_LEVEL ? self::COST[(int) $p[$k]] : null], array_keys(self::STATS), self::STATS),
            'paints' => array_map(fn($id, $price) => ['id' => $id, 'price' => $price, 'owned' => $price === 0 || in_array($id, $owned, true)], array_keys(self::PAINTS), self::PAINTS), 'paint' => $p['paint']];
    }
    /** GET /kart/garage */
    public function garage(): void { $u = Auth::require(); Http::json(['garage' => self::shapeProfile(self::profile((int) $u['id']))]); }
    /** POST /kart/garage/upgrade { stat } */
    public function upgrade(): void
    {
        $u = Auth::require(); $stat = (string) (Http::body()['stat'] ?? '');
        if (!isset(self::STATS[$stat])) Http::json(['error' => 'validation', 'message' => 'Which part?'], 422);
        $p = self::profile((int) $u['id']); $lvl = (int) $p[$stat];
        if ($lvl >= self::MAX_LEVEL) Http::json(['error' => 'validation', 'message' => 'That is already fully upgraded.'], 422);
        $cost = self::COST[$lvl];
        // pay and level up in one statement, so two taps cannot spend the same coins twice
        $st = Db::pdo()->prepare("UPDATE kart_profiles SET coins = coins - ?, $stat = $stat + 1, updated_at = ? WHERE user_id = ? AND coins >= ? AND $stat = ?");
        $st->execute([$cost, Db::now(), $u['id'], $cost, $lvl]);
        if ($st->rowCount() === 0) Http::json(['error' => 'validation', 'message' => 'Not enough coins yet. Race to earn more.'], 422);
        Http::json(['garage' => self::shapeProfile(self::profile((int) $u['id']))]);
    }
    /** POST /kart/garage/paint { paint } : buy (if needed) and use a paint */
    public function paint(): void
    {
        $u = Auth::require(); $id = (string) (Http::body()['paint'] ?? '');
        if (!array_key_exists($id, self::PAINTS)) Http::json(['error' => 'validation'], 422);
        $p = self::profile((int) $u['id']); $owned = array_filter(explode(',', (string) $p['paints'])); $price = self::PAINTS[$id];
        if ($price > 0 && !in_array($id, $owned, true)) {
            $st = Db::pdo()->prepare('UPDATE kart_profiles SET coins = coins - ?, paints = ?, updated_at = ? WHERE user_id = ? AND coins >= ?');
            $st->execute([$price, implode(',', array_merge($owned, [$id])), Db::now(), $u['id'], $price]);
            if ($st->rowCount() === 0) Http::json(['error' => 'validation', 'message' => 'Not enough coins for that paint yet.'], 422);
        }
        Db::run('UPDATE kart_profiles SET paint = ? WHERE user_id = ?', [$id, $u['id']]);
        Http::json(['garage' => self::shapeProfile(self::profile((int) $u['id']))]);
    }

    /** GET /kart/board?track=&span=week|all : best lap per driver, and where I stand */
    public function board(): void
    {
        $u = Auth::require(); $track = self::track((string) ($_GET['track'] ?? 'abuja'));
        $week = ($_GET['span'] ?? 'week') === 'week';
        $since = $week ? gmdate('Y-m-d H:i:s', time() - 7 * 86400) : '2000-01-01';
        $st = Db::pdo()->prepare('SELECT k.user_id, MIN(k.lap_ms) AS best, u.name, u.tag FROM kart_times k JOIN users u ON u.id = k.user_id WHERE k.track = ? AND k.created_at > ? AND u.deleted_at IS NULL GROUP BY k.user_id, u.name, u.tag ORDER BY best LIMIT 50');
        $st->execute([$track, $since]); $rows = $st->fetchAll();
        $mine = null;
        foreach ($rows as $i => $r) if ((int) $r['user_id'] === (int) $u['id']) $mine = ['rank' => $i + 1, 'best' => (int) $r['best']];
        if (!$mine) { $b = Db::one('SELECT MIN(lap_ms) AS b FROM kart_times WHERE user_id = ? AND track = ? AND created_at > ?', [$u['id'], $track, $since]); if ($b && $b['b']) $mine = ['rank' => null, 'best' => (int) $b['b']]; }
        Http::json(['track' => $track, 'trackName' => self::TRACKS[$track], 'span' => $week ? 'week' : 'all', 'me' => $mine,
            'rows' => array_map(fn($r, $i) => ['rank' => $i + 1, 'userId' => (int) $r['user_id'], 'name' => self::first($r['name']), 'tag' => $r['tag'], 'avatar' => Auth::picture((int) $r['user_id']), 'lapMs' => (int) $r['best'], 'me' => (int) $r['user_id'] === (int) $u['id']], $rows, array_keys($rows))]);
    }

    /** POST /kart/times { track, lapMs, raceMs, mode, ghost } */
    public function saveTime(): void
    {
        $u = Auth::require(); RateLimit::hit('karttime', 60, 3600); $b = Http::body();
        $track = self::track((string) ($b['track'] ?? 'abuja'));
        $lap = (int) ($b['lapMs'] ?? 0); $race = (int) ($b['raceMs'] ?? 0);
        if ($lap < self::MIN_LAP_MS || $lap > 600000 || $race < $lap || $race > 3600000) Http::json(['error' => 'validation', 'message' => 'That time does not look like a real race.'], 422);
        $mode = in_array($b['mode'] ?? '', ['solo', 'bots', 'room'], true) ? $b['mode'] : 'solo';
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
        Http::json(['personalBest' => $pb, 'previousBest' => $prev && $prev['b'] ? (int) $prev['b'] : null, 'rank' => $rank, 'coinsEarned' => $earned, 'coins' => (int) (Db::one('SELECT coins FROM kart_profiles WHERE user_id = ?', [$u['id']])['coins'] ?? 0)], 201);
    }

    /** GET /kart/ghost?track=&who=me|best : a lap to race against */
    public function ghost(): void
    {
        $u = Auth::require(); $track = self::track((string) ($_GET['track'] ?? 'abuja'));
        $me = ($_GET['who'] ?? 'me') === 'me';
        $r = Db::one('SELECT k.ghost, k.lap_ms, u.name FROM kart_times k JOIN users u ON u.id = k.user_id WHERE k.track = ? AND k.ghost IS NOT NULL' . ($me ? ' AND k.user_id = ' . (int) $u['id'] : '') . ' ORDER BY k.lap_ms LIMIT 1', [$track]);
        Http::json(['ghost' => $r ? ['name' => $me ? 'Your best' : self::first($r['name']), 'lapMs' => (int) $r['lap_ms'], 'path' => json_decode((string) $r['ghost'], true)] : null]);
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
                'avatar' => Auth::picture((int) $p['user_id'])], $ps->fetchAll()),
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

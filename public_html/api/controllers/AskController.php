<?php
declare(strict_types=1);

/** Ask Buja: a guide to the city grounded on the spots table. The model ranks and explains; it never invents a place. */
final class AskController
{
    public const CATEGORIES = ['food' => 'Food', 'lounge' => 'Lounge & bar', 'relax' => 'Relax & outdoors', 'nightlife' => 'Nightlife', 'shopping' => 'Shopping', 'kids' => 'Kids & family', 'worship' => 'Worship', 'services' => 'Services', 'hotel' => 'Hotel', 'culture' => 'Culture & sights'];
    public const PRICE = [1 => 'Budget', 2 => 'Moderate', 3 => 'Pricey', 4 => 'Premium'];

    private function spot(array $s, ?array $u = null): array
    {
        $r = Db::one('SELECT COUNT(*) AS n, AVG(stars) AS avg FROM spot_ratings WHERE spot_id = ?', [$s['id']]);
        $out = ['id' => (int) $s['id'], 'name' => $s['name'], 'category' => $s['category'], 'categoryLabel' => self::CATEGORIES[$s['category']] ?? $s['category'], 'district' => $s['district'], 'area' => $s['area'], 'tags' => json_decode($s['tags'] ?? '[]', true) ?: [], 'priceLevel' => (int) $s['price_level'], 'priceLabel' => self::PRICE[(int) $s['price_level']] ?? '', 'priceNote' => $s['price_note'], 'description' => $s['description'], 'hours' => $s['hours'], 'verified' => $s['verified_at'] !== null, 'rating' => $r && $r['n'] ? round((float) $r['avg'], 1) : null, 'ratings' => (int) ($r['n'] ?? 0), 'wakaTo' => $s['district']];
        if ($u) $out['myRating'] = (int) (Db::one('SELECT stars FROM spot_ratings WHERE spot_id = ? AND user_id = ?', [$s['id'], $u['id']])['stars'] ?? 0);
        return $out;
    }
    private function directory(): array
    {
        return Db::pdo()->query("SELECT * FROM spots WHERE active = 1 ORDER BY id")->fetchAll();
    }

    /** POST /ask { question, history: [{q,a}] } */
    public function ask(): void
    {
        $u = Auth::require(); RateLimit::hit('ask', (int) Http::config('ask_daily_limit', 40), 86400);
        $q = mb_substr(trim((string) (Http::body()['question'] ?? '')), 0, 300);
        if ($q === '') Http::json(['error' => 'validation', 'fields' => ['question' => 'Ask something.']], 422);
        $spots = $this->directory();
        $key = (string) Http::config('anthropic_api_key', '');
        $result = $key !== '' ? $this->askModel($q, $spots, $u, $key) : null;
        if ($result === null) $result = $this->askRules($q, $spots, $u);
        $ids = array_map(fn($s) => $s['id'], $result['spots']);
        Db::run('INSERT INTO ask_log (user_id, question, district, spot_ids, mode, created_at) VALUES (?,?,?,?,?,?)', [$u['id'], $q, $u['district'], json_encode($ids), $result['mode'], Db::now()]); Track::hit($u, 'ask', 'ask');
        Http::json($result);
    }

    private function askModel(string $q, array $spots, array $u, string $key): ?array
    {
        $compact = array_map(fn($s) => ['id' => (int) $s['id'], 'name' => $s['name'], 'cat' => $s['category'], 'district' => $s['district'], 'tags' => json_decode($s['tags'] ?? '[]', true) ?: [], 'price' => (int) $s['price_level'], 'note' => $s['price_note'], 'desc' => mb_substr((string) $s['description'], 0, 140), 'hours' => $s['hours'], 'rating' => (Db::one('SELECT ROUND(AVG(stars),1) AS a, COUNT(*) AS n FROM spot_ratings WHERE spot_id = ?', [$s['id']]) ?: ['a' => null, 'n' => 0])], $spots);
        $system = "You are Ask Buja, a local guide to Abuja, Nigeria, inside the Buja app. The user is in " . ($u['district'] ?: 'Abuja') . ". You may ONLY recommend places from the DIRECTORY below, by id. Never invent, rename or guess a place. If nothing in the directory fits, say so plainly and suggest what the user could ask instead or invite them to add the place. Prefer places in or near the user's district when the question implies nearby. Consider price level (1 budget to 4 premium), tags, ratings and hours. Keep the answer to two or three sentences in warm, plain English; no lists in the text, the app shows cards. Respond with JSON only, no markdown: {\"answer\": string, \"spots\": [{\"id\": number, \"why\": string (max 12 words)}], \"followups\": [string, string]}. Pick 1 to 4 spots. Time now (Abuja): " . date('D H:i') . ".\n\nDIRECTORY:\n" . json_encode($compact, JSON_UNESCAPED_UNICODE);
        $body = json_encode(['model' => (string) Http::config('ask_model', 'claude-haiku-4-5-20251001'), 'max_tokens' => 600, 'system' => $system, 'messages' => [['role' => 'user', 'content' => $q]]], JSON_UNESCAPED_UNICODE);
        $ch = curl_init('https://api.anthropic.com/v1/messages');
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25, CURLOPT_POSTFIELDS => $body, CURLOPT_HTTPHEADER => ['content-type: application/json', 'x-api-key: ' . $key, 'anthropic-version: 2023-06-01']]);
        $raw = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($code !== 200) { error_log('[buja ask] model returned ' . $code . ' ' . substr((string) $raw, 0, 200)); return null; }
        $text = ''; foreach ((json_decode((string) $raw, true)['content'] ?? []) as $blk) if (($blk['type'] ?? '') === 'text') $text .= $blk['text'];
        $text = trim(preg_replace('/^```(?:json)?|```$/m', '', $text));
        $j = json_decode($text, true); if (!is_array($j) || !isset($j['answer'])) { error_log('[buja ask] unparseable: ' . substr($text, 0, 200)); return null; }
        $byId = []; foreach ($spots as $s) $byId[(int) $s['id']] = $s;
        $out = [];
        foreach ((array) ($j['spots'] ?? []) as $x) { $id = (int) ($x['id'] ?? 0); if (isset($byId[$id])) $out[] = $this->spot($byId[$id], $u) + ['why' => mb_substr((string) ($x['why'] ?? ''), 0, 80)]; if (count($out) >= 4) break; }
        return ['answer' => mb_substr((string) $j['answer'], 0, 600), 'spots' => $out, 'followups' => array_slice(array_map('strval', (array) ($j['followups'] ?? [])), 0, 3), 'mode' => 'model'];
    }

    /** Keyword fallback: category words, tags, district names, price words. Honest and predictable. */
    private function askRules(string $q, array $spots, array $u): array
    {
        $ql = mb_strtolower($q);
        $catWords = ['food' => ['amala', 'eat', 'food', 'restaurant', 'suya', 'jollof', 'rice', 'chop', 'buka', 'breakfast', 'lunch', 'dinner', 'brunch', 'shawarma', 'pepper soup', 'nkwobi', 'ewa', 'pounded'], 'lounge' => ['lounge', 'bar', 'drink', 'beer', 'cocktail', 'hangout', 'chill', 'shisha'], 'relax' => ['relax', 'serene', 'quiet', 'park', 'lake', 'garden', 'peaceful', 'nature', 'picnic', 'calm'], 'nightlife' => ['club', 'night', 'party', 'dance', 'dj'], 'shopping' => ['shop', 'mall', 'market', 'buy'], 'kids' => ['kids', 'children', 'family', 'playground', 'amusement'], 'worship' => ['church', 'mosque', 'pray', 'service', 'mass'], 'culture' => ['art', 'gallery', 'museum', 'sight', 'tour', 'monument'], 'hotel' => ['hotel', 'stay', 'sleep', 'room']];
        $cats = []; foreach ($catWords as $c => $ws) foreach ($ws as $w) if (preg_match('/\b' . preg_quote($w, '/') . '/u', $ql)) { $cats[$c] = true; break; }
        $cheap = (bool) preg_match('/cheap|budget|affordable|pocket|not too pricey|inexpensive/', $ql); $fancy = (bool) preg_match('/fancy|premium|luxury|classy|expensive|upscale/', $ql);
        $near = (bool) preg_match('/near|close|around|nearby|my area/', $ql);
        $scored = [];
        foreach ($spots as $s) {
            $score = 0; $tags = array_map('mb_strtolower', json_decode($s['tags'] ?? '[]', true) ?: []);
            if (isset($cats[$s['category']])) $score += 5;
            foreach ($tags as $t) if ($t !== '' && preg_match('/\b' . preg_quote($t, '/') . '\b/u', $ql)) $score += 4;
            foreach (preg_split('/\W+/u', mb_strtolower($s['name'])) as $w) if (mb_strlen($w) > 3 && str_contains($ql, $w)) $score += 6;
            if (str_contains($ql, mb_strtolower($s['district']))) $score += 4;
            elseif ($near && $u['district'] && ($s['district'] === $u['district'] || in_array($s['district'], MatchRules::nearby($u['district']), true))) $score += 3;
            if ($cheap) $score += (int) $s['price_level'] <= 2 ? 2 : -3; if ($fancy) $score += (int) $s['price_level'] >= 3 ? 2 : -3;
            $r = Db::one('SELECT AVG(stars) AS a FROM spot_ratings WHERE spot_id = ?', [$s['id']]); if ($r && $r['a']) $score += (float) $r['a'] / 2;
            if ($score >= 4) $scored[] = [$score, $s];
        }
        usort($scored, fn($a, $b) => $b[0] <=> $a[0]);
        $top = array_slice($scored, 0, 4);
        $out = array_map(fn($x) => $this->spot($x[1], $u) + ['why' => ($x[1]['district'] === $u['district'] ? 'In your district' : 'In ' . $x[1]['district']) . ' · ' . (self::PRICE[(int) $x[1]['price_level']] ?? '')], $top);
        $answer = $out ? 'Here is what Buja has on record for that. The list grows as people add and rate places, so tell us if something is missing.' : 'Buja has nothing on record for that yet. Try another district or category, or add the place so others can find it.';
        return ['answer' => $answer, 'spots' => $out, 'followups' => $out ? ['Something cheaper', 'Somewhere quieter'] : ['Best amala near me', 'Serene place to relax'], 'mode' => 'rules'];
    }

    /** GET /spots/{id} */
    public function show(int $id): void
    {
        $u = Auth::require(); $s = Db::one('SELECT * FROM spots WHERE id = ? AND active = 1', [$id]); if (!$s) Http::json(['error' => 'not_found'], 404);
        $st = Db::pdo()->prepare('SELECT r.stars, r.comment, r.created_at, us.name FROM spot_ratings r JOIN users us ON us.id = r.user_id WHERE r.spot_id = ? ORDER BY r.id DESC LIMIT 20'); $st->execute([$id]);
        Http::json(['spot' => $this->spot($s, $u), 'reviews' => array_map(fn($r) => ['stars' => (int) $r['stars'], 'comment' => $r['comment'], 'name' => explode(' ', $r['name'])[0], 'at' => substr($r['created_at'], 0, 10)], $st->fetchAll())]);
    }

    /** POST /spots/{id}/rate { stars 1-5, comment } */
    public function rate(int $id): void
    {
        $u = Auth::require(); RateLimit::hit('rate', 60, 86400);
        if (!Db::one('SELECT id FROM spots WHERE id = ?', [$id])) Http::json(['error' => 'not_found'], 404);
        $b = Http::body(); $stars = (int) ($b['stars'] ?? 0); $c = mb_substr(trim((string) ($b['comment'] ?? '')), 0, 300);
        if ($stars < 1 || $stars > 5) Http::json(['error' => 'validation', 'fields' => ['stars' => 'Pick 1 to 5 stars.']], 422);
        Db::run('DELETE FROM spot_ratings WHERE spot_id = ? AND user_id = ?', [$id, $u['id']]);
        Db::run('INSERT INTO spot_ratings (spot_id, user_id, stars, comment, created_at) VALUES (?,?,?,?,?)', [$id, $u['id'], $stars, $c ?: null, Db::now()]);
        $this->show($id);
    }

    /** GET /spots?q=&category= and POST /spots (community-added, unverified until reviewed) */
    public function index(): void
    {
        Auth::require(); $q = trim((string) ($_GET['q'] ?? '')); $cat = (string) ($_GET['category'] ?? '');
        $where = ['active = 1']; $p = []; if ($q !== '') { $where[] = '(name LIKE ? OR district LIKE ? OR tags LIKE ?)'; array_push($p, "%$q%", "%$q%", "%$q%"); } if (isset(self::CATEGORIES[$cat])) { $where[] = 'category = ?'; $p[] = $cat; }
        $st = Db::pdo()->prepare('SELECT * FROM spots WHERE ' . implode(' AND ', $where) . ' ORDER BY name LIMIT 100'); $st->execute($p);
        Http::json(['spots' => array_map(fn($s) => $this->spot($s), $st->fetchAll()), 'categories' => self::CATEGORIES]);
    }
    public function create(): void
    {
        $u = Auth::require(); RateLimit::hit('addspot', 10, 86400); $b = Http::body(); $e = [];
        $name = mb_substr(trim((string) ($b['name'] ?? '')), 0, 80); if (mb_strlen($name) < 3) $e['name'] = 'The name of the place.';
        $cat = isset(self::CATEGORIES[$b['category'] ?? '']) ? $b['category'] : null; if (!$cat) $e['category'] = 'Choose a category.';
        $district = mb_substr(trim((string) ($b['district'] ?? '')), 0, 60); if ($district === '') $e['district'] = 'Which district?';
        $area = mb_substr(trim((string) ($b['area'] ?? '')), 0, 100); $desc = mb_substr(trim((string) ($b['description'] ?? '')), 0, 400); if (mb_strlen($desc) < 10) $e['description'] = 'A line on what it is known for.';
        $price = max(1, min(4, (int) ($b['priceLevel'] ?? 2))); $note = mb_substr(trim((string) ($b['priceNote'] ?? '')), 0, 60); $hours = mb_substr(trim((string) ($b['hours'] ?? '')), 0, 60);
        $tags = array_slice(array_values(array_unique(array_filter(array_map(fn($t) => mb_substr(mb_strtolower(trim((string) $t)), 0, 30), (array) ($b['tags'] ?? []))))), 0, 8);
        if ($e) Http::json(['error' => 'validation', 'fields' => $e], 422);
        if (Db::one('SELECT id FROM spots WHERE name = ? AND district = ?', [$name, $district])) Http::json(['error' => 'validation', 'fields' => ['name' => 'That place is already on Buja.']], 422);
        Db::run('INSERT INTO spots (name, category, district, area, tags, price_level, price_note, description, hours, added_by, active, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,1,?)', [$name, $cat, $district, $area ?: null, json_encode($tags), $price, $note ?: null, $desc, $hours ?: null, $u['id'], Db::now()]);
        Http::json(['spot' => $this->spot(Db::one('SELECT * FROM spots WHERE id = ?', [Db::lastId()]), $u)], 201);
    }
}

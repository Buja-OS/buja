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
        $out = ['id' => (int) $s['id'], 'name' => $s['name'], 'category' => $s['category'], 'categoryLabel' => self::CATEGORIES[$s['category']] ?? $s['category'], 'district' => $s['district'], 'area' => $s['area'], 'tags' => json_decode($s['tags'] ?? '[]', true) ?: [], 'priceLevel' => (int) $s['price_level'], 'priceLabel' => self::PRICE[(int) $s['price_level']] ?? '', 'priceNote' => $s['price_note'], 'description' => $s['description'], 'hours' => $s['hours'], 'verified' => $s['verified_at'] !== null, 'source' => $s['source'] ?? 'buja', 'lat' => $s['lat'] !== null ? (float) $s['lat'] : null, 'lng' => $s['lng'] !== null ? (float) $s['lng'] : null, 'thumb' => $this->thumb($s), 'away' => $this->away($s, $u), 'rating' => $r && $r['n'] ? round((float) $r['avg'], 1) : null, 'ratings' => (int) ($r['n'] ?? 0), 'wakaTo' => $s['district']];
        if ($u) $out['myRating'] = (int) (Db::one('SELECT stars FROM spot_ratings WHERE spot_id = ? AND user_id = ?', [$s['id'], $u['id']])['stars'] ?? 0);
        return $out;
    }
    private function directory(): array
    {
        return Db::pdo()->query("SELECT * FROM spots WHERE active = 1 ORDER BY id")->fetchAll();
    }

    /**
     * A thumbnail for a place: the map tile it sits on, with the exact spot's position inside that tile so
     * the card can centre it. Free, works for every place with coordinates, and honest about being a map.
     */
    private function thumb(array $s): ?array
    {
        if ($s['lat'] === null || $s['lng'] === null) return null;
        $lat = (float) $s['lat']; $lng = (float) $s['lng']; $z = 16; $n = 2 ** $z;
        $xf = ($lng + 180) / 360 * $n;
        $yf = (1 - log(tan(deg2rad($lat)) + 1 / cos(deg2rad($lat))) / M_PI) / 2 * $n;
        return ['url' => 'https://tile.openstreetmap.org/' . $z . '/' . (int) $xf . '/' . (int) $yf . '.png',
            'fx' => round($xf - floor($xf), 3), 'fy' => round($yf - floor($yf), 3)];
    }

    /** Where the person asking is: the position their phone just sent, else the last one we stored. */
    private ?array $me = null;
    private bool $meLoaded = false;

    /** How far this place is from them, when both positions are known. */
    private function away(array $s, array $u): ?float
    {
        if ($s['lat'] === null) return null;
        if ($this->me === null && !$this->meLoaded) {
            $this->meLoaded = true;
            $r = Db::one('SELECT lat, lng FROM users WHERE id = ?', [$u['id']]);
            $this->me = ($r && $r['lat'] !== null) ? [(float) $r['lat'], (float) $r['lng']] : null;
        }
        if ($this->me === null) return null;
        $km = WakaRules::km($this->me[0], $this->me[1], (float) $s['lat'], (float) $s['lng']);
        return $km < 1 ? round($km, 2) : round($km, 1);
    }

    /** The category a question is about, or null if it is not about a kind of place. */
    private function categoryOf(string $q): ?string
    {
        $ql = mb_strtolower($q);
        foreach (['food' => ['amala', 'eat', 'food', 'restaurant', 'suya', 'jollof', 'rice', 'chop', 'buka', 'breakfast', 'lunch', 'dinner', 'brunch', 'shawarma', 'pepper soup', 'nkwobi', 'pounded', 'cafe', 'coffee', 'pizza', 'chicken'], 'lounge' => ['lounge', 'bar', 'drink', 'beer', 'cocktail', 'hangout', 'chill', 'shisha'], 'relax' => ['relax', 'serene', 'quiet', 'park', 'lake', 'garden', 'peaceful', 'nature', 'picnic', 'calm'], 'nightlife' => ['club', 'night out', 'party', 'dance', 'dj'], 'shopping' => ['shop', 'mall', 'market', 'buy', 'supermarket', 'groceries'], 'kids' => ['kids', 'children', 'family', 'playground', 'amusement'], 'worship' => ['church', 'mosque', 'pray', 'service', 'mass'], 'culture' => ['art', 'gallery', 'museum', 'sight', 'tour', 'monument'], 'hotel' => ['hotel', 'stay', 'sleep', 'room', 'lodge'], 'services' => ['fix', 'repair', 'barber', 'salon', 'laundry', 'mechanic', 'pharmacy', 'hospital', 'bank', 'fuel', 'petrol']] as $c => $ws)
            foreach ($ws as $w) if (str_contains($ql, $w)) return $c;
        return null;
    }

    /**
     * Where to search around. "Near me" and a live position from the phone beat everything; then a district
     * named in the question; then the last position we stored; then the district on the account.
     */
    private function whereIs(array $u, string $q, ?array $live = null): array
    {
        $ql = mb_strtolower($q);
        $nearMe = str_contains($ql, 'near me') || str_contains($ql, 'close to me') || str_contains($ql, 'around me') || str_contains($ql, 'nearby') || str_contains($ql, 'closest') || str_contains($ql, 'nearest');
        if ($live && $nearMe) return [$live[0], $live[1]];
        foreach (HomesRules::CENTROID as $name => [$lat, $lng]) if (str_contains($ql, mb_strtolower($name))) return [$lat, $lng];
        if ($live) return [$live[0], $live[1]];
        $row = Db::one('SELECT lat, lng FROM users WHERE id = ?', [$u['id']]);
        if ($row && $row['lat'] !== null) return [(float) $row['lat'], (float) $row['lng']];
        $c = HomesRules::CENTROID[$u['district'] ?? ''] ?? null;
        return $c ? [$c[0], $c[1]] : [9.0578, 7.4951]; // Central Area
    }

    /** Narrows the directory to what this question could plausibly be about, so requests stay small however big Buja grows. */
    private function relevant(string $q, array $spots, array $u, int $max = 40, ?array $live = null): array
    {
        $ql = mb_strtolower($q);
        $cats = [];
        foreach (['food' => ['amala', 'eat', 'food', 'restaurant', 'suya', 'jollof', 'rice', 'chop', 'buka', 'breakfast', 'lunch', 'dinner', 'brunch', 'shawarma', 'pepper soup', 'nkwobi', 'pounded', 'cafe', 'coffee'], 'lounge' => ['lounge', 'bar', 'drink', 'beer', 'cocktail', 'hangout', 'chill', 'shisha', 'vibe'], 'relax' => ['relax', 'serene', 'quiet', 'park', 'lake', 'garden', 'peaceful', 'nature', 'picnic', 'calm', 'walk'], 'nightlife' => ['club', 'night', 'party', 'dance', 'dj'], 'shopping' => ['shop', 'mall', 'market', 'buy', 'gift'], 'kids' => ['kids', 'children', 'family', 'playground', 'amusement'], 'worship' => ['church', 'mosque', 'pray', 'service', 'mass'], 'culture' => ['art', 'gallery', 'museum', 'sight', 'tour', 'monument', 'photo'], 'hotel' => ['hotel', 'stay', 'sleep', 'room'], 'services' => ['fix', 'repair', 'barber', 'salon', 'laundry', 'mechanic']] as $c => $ws)
            foreach ($ws as $w) if (str_contains($ql, $w)) { $cats[$c] = true; break; }
        $near = $u['district'] ? MatchRules::nearby((string) $u['district']) : [];
        $scored = [];
        foreach ($spots as $sp) {
            $score = 0;
            if (isset($cats[$sp['category']])) $score += 6;
            foreach (json_decode($sp['tags'] ?? '[]', true) ?: [] as $t) if ($t && str_contains($ql, mb_strtolower($t))) $score += 4;
            foreach (preg_split('/\W+/u', mb_strtolower($sp['name'])) as $w) if (mb_strlen($w) > 3 && str_contains($ql, $w)) $score += 8;
            if (str_contains($ql, mb_strtolower($sp['district']))) $score += 5;
            elseif (in_array($sp['district'], $near, true)) $score += 2;
            // With a real position, close places win: full marks within a kilometre, nothing beyond ten.
            if ($live && $sp['lat'] !== null) {
                $km = WakaRules::km($live[0], $live[1], (float) $sp['lat'], (float) $sp['lng']);
                $score += $km < 1 ? 10 : ($km < 3 ? 7 : ($km < 6 ? 4 : ($km < 10 ? 1 : -3)));
            }
            $scored[] = [$score, $sp];
        }
        // Nothing matched the words? Send the most popular places rather than nothing, so the model can still be useful.
        usort($scored, fn($a, $b) => $b[0] <=> $a[0]);
        return array_map(fn($x) => $x[1], array_slice($scored, 0, $max));
    }

    /** POST /ask { question, history: [{q,a}] } */
    public function ask(): void
    {
        $u = Auth::require(); RateLimit::hit('ask', (int) Http::config('ask_daily_limit', 40), 86400);
        $b = Http::body();
        $q = mb_substr(trim((string) ($b['question'] ?? '')), 0, 300);
        if ($q === '') Http::json(['error' => 'validation', 'fields' => ['question' => 'Ask something.']], 422);
        $live = null;
        if (!empty($b['lat']) && !empty($b['lng'])) {
            $la = (float) $b['lat']; $ln = (float) $b['lng'];
            if ($la > 4 && $la < 14 && $ln > 2 && $ln < 15) {
                $live = [$la, $ln]; $this->me = $live;
                Db::run('UPDATE users SET lat = ?, lng = ?, loc_updated_at = ? WHERE id = ?', [round($la, 3), round($ln, 3), Db::now(), $u['id']]);
            }
        }
        $spots = $this->directory();
        $shortlist = $this->relevant($q, $spots, $u, 40, $live);
        $cat = $this->categoryOf($q);
        // If Buja knows little about what was asked, look it up on the map and keep what it finds.
        $onTopic = array_values(array_filter($shortlist, fn($s) => $s['category'] === $cat));
        if ($cat && count($onTopic) < 4) {
            [$lat, $lng] = $this->whereIs($u, $q, $live);
            $tried = 'osm:' . $cat . ':' . round($lat, 2) . ',' . round($lng, 2);
            if ($lat && !Db::one('SELECT 1 AS x FROM app_keys WHERE k = ? AND v > ?', [$tried, gmdate('Y-m-d H:i:s', time() - 3600)])) {
                $found = [];
                try { RateLimit::hit('osm', 60, 3600); $found = Osm::nearby($cat, $lat, $lng); } catch (Throwable $e) {}
                if ($found) { $spots = $this->directory(); $shortlist = $this->relevant($q, $spots, $u, 40, $live); }
                else { Db::run('DELETE FROM app_keys WHERE k = ?', [$tried]); Db::run('INSERT INTO app_keys (k, v) VALUES (?,?)', [$tried, Db::now()]); }
            }
        }
        $result = null;
        foreach ($this->providerChain() as $p) { $result = $this->askModel($p, $q, $shortlist, $u); if ($result !== null) break; }
        if ($result === null) $result = $this->askRules($q, $spots, $u);
        $ids = array_map(fn($s) => $s['id'], $result['spots']);
        // When someone asks for what is near them, nearest goes first.
        if ($this->me && str_contains(mb_strtolower($q), 'near') || $this->me && str_contains(mb_strtolower($q), 'closest') || $this->me && str_contains(mb_strtolower($q), 'nearest')) {
            usort($result['spots'], fn($x, $y) => ($x['away'] ?? 9999) <=> ($y['away'] ?? 9999));
        }
        Db::run('INSERT INTO ask_log (user_id, question, district, spot_ids, mode, created_at) VALUES (?,?,?,?,?,?)', [$u['id'], $q, $u['district'], json_encode($ids), $result['mode'], Db::now()]); Track::hit($u, 'ask', 'ask');
        Http::json($result);
    }

    /** Which providers to try, in order. ASK_PROVIDER picks the first; the rest are fallbacks so Ask never simply breaks. */
    private function providerChain(): array
    {
        $want = strtolower((string) Http::config('ask_provider', 'gemini'));
        $have = array_values(array_filter(['gemini', 'groq', 'anthropic'], fn($p) => Http::config($p . '_api_key', '') !== ''));
        if ($want === 'rules') return [];
        usort($have, fn($a, $b) => ($b === $want) <=> ($a === $want));
        return $have;
    }

    private function systemPrompt(array $spots, array $u): string
    {
        $compact = array_map(fn($s) => ['id' => (int) $s['id'], 'name' => $s['name'], 'cat' => $s['category'], 'district' => $s['district'], 'tags' => json_decode($s['tags'] ?? '[]', true) ?: [], 'price' => (int) $s['price_level'], 'note' => $s['price_note'], 'desc' => mb_substr((string) $s['description'], 0, 140), 'hours' => $s['hours'], 'rating' => (Db::one('SELECT ROUND(AVG(stars),1) AS a, COUNT(*) AS n FROM spot_ratings WHERE spot_id = ?', [$s['id']]) ?: ['a' => null, 'n' => 0])], $spots);
        return "You are Ask Buja, a local guide to Abuja, Nigeria, inside the Buja app. The user is in " . ($u['district'] ?: 'Abuja') . ". You may ONLY recommend places from the DIRECTORY below, by id. Never invent, rename or guess a place. If nothing in the directory fits, say so plainly and invite the user to add the place. Prefer places in or near the user's district when the question implies nearby. Consider price level (1 budget to 4 premium), tags, ratings and hours. Keep the answer to two or three sentences in warm, plain English; no lists in the text, the app shows cards. Respond with JSON only, no markdown fences: {\"answer\": string, \"spots\": [{\"id\": number, \"why\": string (max 12 words)}], \"followups\": [string, string]}. Pick 1 to 4 spots. Time now (Abuja): " . date('D H:i') . ".\n\nDIRECTORY:\n" . json_encode($compact, JSON_UNESCAPED_UNICODE);
    }

    /** Calls one provider. Returns null on any failure so the chain can move on. */
    private function askModel(string $provider, string $q, array $spots, array $u): ?array
    {
        $system = $this->systemPrompt($spots, $u);
        $key = (string) Http::config($provider . '_api_key', '');
        if ($key === '') return null;
        [$url, $headers, $body] = match ($provider) {
            'gemini' => [
                rtrim((string) Http::config('gemini_endpoint', 'https://generativelanguage.googleapis.com/v1beta/models'), '/') . '/' . (string) Http::config('gemini_model', 'gemini-3.6-flash') . ':generateContent?key=' . rawurlencode($key),
                ['content-type: application/json'],
                json_encode(['systemInstruction' => ['parts' => [['text' => $system]]], 'contents' => [['role' => 'user', 'parts' => [['text' => $q]]]], 'generationConfig' => ['temperature' => 0.4, 'maxOutputTokens' => 700, 'responseMimeType' => 'application/json']], JSON_UNESCAPED_UNICODE),
            ],
            'groq' => [
                'https://api.groq.com/openai/v1/chat/completions',
                ['content-type: application/json', 'authorization: Bearer ' . $key],
                json_encode(['model' => (string) Http::config('groq_model', 'llama-3.3-70b-versatile'), 'temperature' => 0.4, 'max_tokens' => 700, 'response_format' => ['type' => 'json_object'], 'messages' => [['role' => 'system', 'content' => $system], ['role' => 'user', 'content' => $q]]], JSON_UNESCAPED_UNICODE),
            ],
            'anthropic' => [
                'https://api.anthropic.com/v1/messages',
                ['content-type: application/json', 'x-api-key: ' . $key, 'anthropic-version: 2023-06-01'],
                json_encode(['model' => (string) Http::config('ask_model', 'claude-haiku-4-5-20251001'), 'max_tokens' => 700, 'system' => $system, 'messages' => [['role' => 'user', 'content' => $q]]], JSON_UNESCAPED_UNICODE),
            ],
            default => [null, [], null],
        };
        if ($url === null) return null;
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25, CURLOPT_POSTFIELDS => $body, CURLOPT_HTTPHEADER => $headers]);
        $raw = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($code !== 200) {
            $msg = json_decode((string) $raw, true)['error']['message'] ?? substr((string) $raw, 0, 160);
            error_log('[buja ask] ' . $provider . ' returned ' . $code . ': ' . $msg);
            return null;
        }
        $j = json_decode((string) $raw, true);
        $text = match ($provider) {
            'gemini' => $j['candidates'][0]['content']['parts'][0]['text'] ?? '',
            'groq' => $j['choices'][0]['message']['content'] ?? '',
            'anthropic' => implode('', array_map(fn($b) => $b['text'] ?? '', array_filter($j['content'] ?? [], fn($b) => ($b['type'] ?? '') === 'text'))),
            default => '',
        };
        $text = trim(preg_replace('/^```(?:json)?|```$/m', '', (string) $text));
        $parsed = json_decode($text, true);
        if (!is_array($parsed) || !isset($parsed['answer'])) { error_log('[buja ask] ' . $provider . ' unparseable: ' . substr($text, 0, 200)); return null; }
        $byId = []; foreach ($spots as $s) $byId[(int) $s['id']] = $s;
        $out = [];
        foreach ((array) ($parsed['spots'] ?? []) as $x) { $id = (int) ($x['id'] ?? 0); if (isset($byId[$id])) $out[] = $this->spot($byId[$id], $u) + ['why' => mb_substr((string) ($x['why'] ?? ''), 0, 80)]; if (count($out) >= 4) break; }
        return ['answer' => mb_substr((string) $parsed['answer'], 0, 600), 'spots' => $out, 'followups' => array_slice(array_map('strval', (array) ($parsed['followups'] ?? [])), 0, 3), 'mode' => $provider];
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

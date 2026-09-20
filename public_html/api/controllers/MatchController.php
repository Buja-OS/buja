<?php
declare(strict_types=1);

final class MatchController
{
    private function profileRow(int $userId): ?array
    {
        return Db::one('SELECT p.*, u.name, u.district, u.email_verified_at, u.phone, u.selfie_verified_at, u.lat, u.lng FROM match_profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = ?', [$userId]);
    }
    private function photos(int $userId): array
    {
        $st = Db::pdo()->prepare('SELECT id, position FROM match_photos WHERE user_id = ? ORDER BY position, id'); $st->execute([$userId]);
        return array_map(fn($r) => ['id' => (int) $r['id'], 'url' => '/api/match/photo/' . (int) $r['id']], $st->fetchAll());
    }
    private function shape(array $p, ?array $me = null, bool $full = true): array
    {
        $out = [
            'id' => (int) $p['user_id'], 'name' => explode(' ', trim($p['name']))[0], 'age' => MatchRules::age($p['birthdate']), 'gender' => $p['gender'], 'district' => $p['district'],
            'bio' => $p['bio'], 'interests' => json_decode($p['interests'] ?? '[]', true) ?: [], 'prompts' => json_decode($p['prompts'] ?? '[]', true) ?: [],
            'work' => $p['work'], 'education' => $p['education'], 'height' => $p['height'] ? (int) $p['height'] : null, 'faith' => $p['faith'], 'drinking' => $p['drinking'], 'smoking' => $p['smoking'], 'kids' => $p['kids'], 'languages' => $p['languages'],
            'photos' => $this->photos((int) $p['user_id']), 'phoneAdded' => $p['phone'] !== null, 'emailVerified' => $p['email_verified_at'] !== null, 'verified' => !empty($p['selfie_verified_at']),
            'activeAt' => $p['active_at'],
        ];
        if ($me) {
            $out['match'] = MatchRules::score($me, $p);
            if (($me['lat'] ?? null) !== null && ($p['lat'] ?? null) !== null) {
                $km = WakaRules::km((float) $me['lat'], (float) $me['lng'], (float) $p['lat'], (float) $p['lng']);
                $out['km'] = $km < 1 ? round($km, 1) : (float) round($km); // under a kilometre stays deliberately vague
                $out['match']['proximity'] = $km <= 3 ? 'same' : ($km <= 10 ? 'nearby' : 'abuja');
            }
        }
        if (!$full) { unset($out['prompts'], $out['work'], $out['education'], $out['languages']); }
        return $out;
    }

    /** GET /match/me */
    public function me(): void
    {
        $u = Auth::require();
        $p = $this->profileRow((int) $u['id']);
        $likes = (int) (Db::one("SELECT COUNT(*) AS n FROM swipes s WHERE s.to_user = ? AND s.action IN ('like','superlike') AND NOT EXISTS (SELECT 1 FROM swipes r WHERE r.from_user = ? AND r.to_user = s.from_user)", [$u['id'], $u['id']])['n'] ?? 0);
        Http::json(['profile' => $p ? $this->shape($p) + ['seeking' => $p['seeking'], 'ageMin' => (int) $p['age_min'], 'ageMax' => (int) $p['age_max'], 'nearbyOnly' => (bool) $p['nearby_only'], 'radiusKm' => $p['radius_km'] ? (int) $p['radius_km'] : null, 'hasLocation' => $p['lat'] !== null, 'visible' => (bool) $p['visible'], 'birthdate' => $p['birthdate']] : null,
            'likes' => $likes, 'options' => ['interests' => MatchRules::INTERESTS, 'prompts' => MatchRules::PROMPTS, 'faith' => MatchRules::FAITH, 'habit' => MatchRules::HABIT, 'kids' => MatchRules::KIDS]]);
    }

    /** PATCH /match/me : create or update */
    public function update(): void
    {
        $u = Auth::require();
        if ($u['kind'] === 'company') Http::json(['error' => 'forbidden', 'message' => 'Match is for resident accounts.'], 403);
        $b = Http::body(); $e = [];
        $existing = Db::one('SELECT * FROM match_profiles WHERE user_id = ?', [$u['id']]);
        $bd = (string) ($b['birthdate'] ?? ($existing['birthdate'] ?? ''));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $bd) || !strtotime($bd)) $e['birthdate'] = 'Enter your date of birth.';
        elseif (MatchRules::age($bd) < 18) $e['birthdate'] = 'Buja Match is for adults, 18 and over.';
        elseif (MatchRules::age($bd) > 90) $e['birthdate'] = 'Check the year.';
        $gender = (string) ($b['gender'] ?? ($existing['gender'] ?? '')); if (!in_array($gender, MatchRules::GENDERS, true)) $e['gender'] = 'Choose one.';
        $seeking = (string) ($b['seeking'] ?? ($existing['seeking'] ?? '')); if (!in_array($seeking, MatchRules::SEEKING, true)) $e['seeking'] = 'Who would you like to meet?';
        $bio = mb_substr(trim((string) ($b['bio'] ?? ($existing['bio'] ?? ''))), 0, 300);
        $interests = array_values(array_intersect(array_map('strval', (array) ($b['interests'] ?? json_decode($existing['interests'] ?? '[]', true))), MatchRules::INTERESTS));
        if (count($interests) > 8) $e['interests'] = 'Pick up to 8.';
        $prompts = [];
        foreach ((array) ($b['prompts'] ?? json_decode($existing['prompts'] ?? '[]', true)) as $pr) { $q = (string) ($pr['q'] ?? ''); $a = mb_substr(trim((string) ($pr['a'] ?? '')), 0, 160); if (in_array($q, MatchRules::PROMPTS, true) && $a !== '') $prompts[] = ['q' => $q, 'a' => $a]; }
        $prompts = array_slice($prompts, 0, 3);
        $pick = fn(string $k, array $allowed) => in_array((string) ($b[$k] ?? ($existing[$k] ?? '')), $allowed, true) ? (string) ($b[$k] ?? ($existing[$k] ?? '')) : '';
        $faith = $pick('faith', MatchRules::FAITH); $drinking = $pick('drinking', MatchRules::HABIT); $smoking = $pick('smoking', MatchRules::HABIT); $kids = $pick('kids', MatchRules::KIDS);
        $height = (int) ($b['height'] ?? ($existing['height'] ?? 0)); if ($height && ($height < 120 || $height > 230)) $e['height'] = 'Height in cm, e.g. 168.';
        $work = mb_substr(trim((string) ($b['work'] ?? ($existing['work'] ?? ''))), 0, 80); $edu = mb_substr(trim((string) ($b['education'] ?? ($existing['education'] ?? ''))), 0, 80); $lang = mb_substr(trim((string) ($b['languages'] ?? ($existing['languages'] ?? ''))), 0, 80);
        $ageMin = max(18, min(80, (int) ($b['ageMin'] ?? ($existing['age_min'] ?? 21)))); $ageMax = max($ageMin, min(90, (int) ($b['ageMax'] ?? ($existing['age_max'] ?? 40))));
        $nearby = array_key_exists('nearbyOnly', $b) ? (!empty($b['nearbyOnly']) ? 1 : 0) : (int) ($existing['nearby_only'] ?? 0);
        $radiusKm = array_key_exists('radiusKm', $b) ? (empty($b['radiusKm']) ? null : max(1, min(60, (int) $b['radiusKm']))) : ($existing['radius_km'] ?? null);
        $visible = array_key_exists('visible', $b) ? (!empty($b['visible']) ? 1 : 0) : (int) ($existing['visible'] ?? 1);
        if ($e) Http::json(['error' => 'validation', 'fields' => $e], 422);
        $vals = [$bd, $gender, $seeking, $bio, json_encode($interests), json_encode($prompts), $faith, $drinking, $smoking, $kids, $height ?: null, $work, $edu, $lang, $ageMin, $ageMax, $nearby, $radiusKm, $visible, Db::now(), Db::now()];
        if ($existing) Db::run('UPDATE match_profiles SET birthdate=?, gender=?, seeking=?, bio=?, interests=?, prompts=?, faith=?, drinking=?, smoking=?, kids=?, height=?, work=?, education=?, languages=?, age_min=?, age_max=?, nearby_only=?, radius_km=?, visible=?, active_at=?, updated_at=? WHERE user_id = ?', [...$vals, $u['id']]);
        else Db::run('INSERT INTO match_profiles (birthdate, gender, seeking, bio, interests, prompts, faith, drinking, smoking, kids, height, work, education, languages, age_min, age_max, nearby_only, radius_km, visible, active_at, updated_at, created_at, user_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [...$vals, Db::now(), $u['id']]);
        $this->me();
    }

    /** POST /match/photos  multipart "photo" (jpeg/png/webp ≤ 700 KB after client compression) */
    public function addPhoto(): void
    {
        $u = Auth::require(); RateLimit::hit('photo', 40, 3600);
        $f = Http::file('photo'); if ($f === null) Http::json(['error' => 'validation', 'fields' => ['photo' => 'Choose a photo.']], 422);
        if ((int) $f['size'] > MatchRules::PHOTO_BYTES) Http::json(['error' => 'validation', 'fields' => ['photo' => 'Photo is too large. Try another.']], 422);
        $n = (int) (Db::one('SELECT COUNT(*) AS n FROM match_photos WHERE user_id = ?', [$u['id']])['n'] ?? 0);
        if ($n >= MatchRules::PHOTO_MAX) Http::json(['error' => 'validation', 'fields' => ['photo' => 'Up to 6 photos.']], 422);
        $data = file_get_contents($f['tmp_name']) ?: ''; $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($data) ?: '';
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) Http::json(['error' => 'validation', 'fields' => ['photo' => 'JPEG, PNG or WebP only.']], 422);
        $dim = @getimagesizefromstring($data);
        if (!$dim || $dim[0] < 200 || $dim[1] < 200) Http::json(['error' => 'validation', 'fields' => ['photo' => 'Photo is too small or unreadable.']], 422);
        if ($dim[0] > 2400 || $dim[1] > 2400) Http::json(['error' => 'validation', 'fields' => ['photo' => 'Photo is too large. The app resizes photos before upload; try again.']], 422);
        $key = Media::put('match', $data, $mime, $mime === 'image/png' ? 'png' : ($mime === 'image/webp' ? 'webp' : 'jpg'));
        Db::run('INSERT INTO match_photos (user_id, position, mime, size, data, storage_key, created_at) VALUES (?,?,?,?,?,?,?)', [$u['id'], $n, $mime, strlen($data), $key ? null : $data, $key, Db::now()]);
        Http::json(['photos' => $this->photos((int) $u['id'])], 201);
    }

    /** DELETE /match/photos/{id} */
    public function deletePhoto(int $id): void
    {
        $u = Auth::require();
        $old = Db::one('SELECT storage_key FROM match_photos WHERE id = ? AND user_id = ?', [$id, $u['id']]); if ($old && $old['storage_key']) Media::delete($old['storage_key']);
        Db::run('DELETE FROM match_photos WHERE id = ? AND user_id = ?', [$id, $u['id']]);
        $i = 0; foreach ($this->photos((int) $u['id']) as $p) Db::run('UPDATE match_photos SET position = ? WHERE id = ?', [$i++, $p['id']]);
        Http::json(['photos' => $this->photos((int) $u['id'])]);
    }

    /** PATCH /match/photos  { order: [ids] } */
    public function reorder(): void
    {
        $u = Auth::require(); $order = array_map('intval', (array) (Http::body()['order'] ?? []));
        foreach ($order as $i => $id) Db::run('UPDATE match_photos SET position = ? WHERE id = ? AND user_id = ?', [$i, $id, $u['id']]);
        Http::json(['photos' => $this->photos((int) $u['id'])]);
    }

    /** GET /match/photo/{id} : any signed-in resident with a profile may view; blocked users cannot */
    public function photo(int $id): void
    {
        $u = Auth::require();
        $p = Db::one('SELECT * FROM match_photos WHERE id = ?', [$id]);
        if ($p === null) Http::json(['error' => 'not_found'], 404);
        if ((int) $p['user_id'] !== (int) $u['id']) {
            if ($u['kind'] === 'company' || Db::one('SELECT 1 AS x FROM blocks WHERE (blocker = ? AND blocked = ?) OR (blocker = ? AND blocked = ?)', [$u['id'], $p['user_id'], $p['user_id'], $u['id']])) Http::json(['error' => 'forbidden'], 403);
        }
        if ($p['storage_key']) { header('Location: ' . Media::url($p['storage_key'])); header('Cache-Control: private, max-age=300'); exit; }
        header('Content-Type: ' . $p['mime']); header('Content-Length: ' . (int) $p['size']); header('Cache-Control: private, max-age=86400'); header('X-Content-Type-Options: nosniff');
        echo $p['data']; exit;
    }

    private function meProfile(array $u): array
    {
        $me = $this->profileRow((int) $u['id']);
        if ($me === null) Http::json(['error' => 'no_profile', 'message' => 'Set up your Match profile first.'], 409);
        return $me;
    }

    /** GET /match/discover */
    public function discover(): void
    {
        $u = Auth::require(); $me = $this->meProfile($u);
        if (!$this->photos((int) $u['id'])) Http::json(['error' => 'no_photo', 'message' => 'Add at least one photo to start seeing people.'], 409);
        Db::run('UPDATE match_profiles SET active_at = ? WHERE user_id = ?', [Db::now(), $u['id']]);
        $wantGender = $me['seeking'] === 'women' ? ['woman'] : ($me['seeking'] === 'men' ? ['man'] : MatchRules::GENDERS);
        $theySeek = $me['gender'] === 'woman' ? ['women', 'everyone'] : ['men', 'everyone'];
        $minBd = (new DateTime('today'))->modify('-' . ((int) $me['age_max'] + 1) . ' years')->format('Y-m-d'); $maxBd = (new DateTime('today'))->modify('-' . (int) $me['age_min'] . ' years')->format('Y-m-d');
        $in = fn(array $a) => implode(',', array_fill(0, count($a), '?'));
        $params = [$u['id'], ...$wantGender, ...$theySeek, $minBd, $maxBd, $u['id'], $u['id'], $u['id']];
        $districtSql = '';
        if ((int) $me['nearby_only']) { $near = MatchRules::nearby($me['district'] ?? ''); $districtSql = ' AND u.district IN (' . $in($near) . ')'; $params = [...$params, ...$near]; }
        $radius = $me['radius_km'] ? (int) $me['radius_km'] : null;
        $sql = "SELECT p.*, u.name, u.district, u.email_verified_at, u.phone, u.selfie_verified_at, u.lat, u.lng FROM match_profiles p JOIN users u ON u.id = p.user_id
                WHERE p.user_id <> ? AND p.visible = 1 AND u.deleted_at IS NULL AND u.kind <> 'company'
                  AND p.gender IN ({$in($wantGender)}) AND p.seeking IN ({$in($theySeek)}) AND p.birthdate > ? AND p.birthdate <= ?
                  AND EXISTS (SELECT 1 FROM match_photos ph WHERE ph.user_id = p.user_id)
                  AND NOT EXISTS (SELECT 1 FROM swipes s WHERE s.from_user = ? AND s.to_user = p.user_id)
                  AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker = ? AND b.blocked = p.user_id) OR (b.blocked = ? AND b.blocker = p.user_id))
                  $districtSql ORDER BY p.active_at DESC LIMIT 40";
        $st = Db::pdo()->prepare($sql); $st->execute($params);
        $cards = array_map(fn($r) => $this->shape($r, $me, false), $st->fetchAll());
        if ($radius && $me['lat'] !== null) $cards = array_values(array_filter($cards, fn($c) => !isset($c['km']) || $c['km'] <= $radius));
        usort($cards, fn($a, $b) => $b['match']['score'] <=> $a['match']['score']);
        Http::json(['cards' => array_slice($cards, 0, 12), 'superlikesLeft' => $this->superlikesLeft((int) $u['id'])]);
    }

    private function superlikesLeft(int $uid): int
    {
        $n = (int) (Db::one("SELECT COUNT(*) AS n FROM swipes WHERE from_user = ? AND action = 'superlike' AND created_at > ?", [$uid, gmdate('Y-m-d H:i:s', time() - 86400)])['n'] ?? 0);
        $u = Db::one('SELECT plus_until FROM users WHERE id = ?', [$uid]); $max = PayController::plusActive($u ?: []) ? 5 : 1;
        return max(0, $max - $n);
    }

    /** GET /match/profile/{id} */
    public function show(int $id): void
    {
        $u = Auth::require(); $me = $this->meProfile($u);
        $p = $this->profileRow($id); if ($p === null || (!(int) $p['visible'] && $id !== (int) $u['id'])) Http::json(['error' => 'not_found'], 404);
        if (Db::one('SELECT 1 AS x FROM blocks WHERE (blocker = ? AND blocked = ?) OR (blocker = ? AND blocked = ?)', [$u['id'], $id, $id, $u['id']])) Http::json(['error' => 'not_found'], 404);
        $out = $this->shape($p, $me);
        $out['likedYou'] = Db::one("SELECT action FROM swipes WHERE from_user = ? AND to_user = ? AND action IN ('like','superlike')", [$id, $u['id']])['action'] ?? null;
        $out['yourAction'] = Db::one('SELECT action FROM swipes WHERE from_user = ? AND to_user = ?', [$u['id'], $id])['action'] ?? null;
        $m = Db::one('SELECT thread_id FROM matches WHERE (user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?)', [$u['id'], $id, $id, $u['id']]);
        $out['threadId'] = $m ? (int) $m['thread_id'] : null;
        Http::json(['profile' => $out]);
    }

    /** POST /match/swipe { to, action: like|pass|superlike } */
    public function swipe(): void
    {
        $u = Auth::require(); $me = $this->meProfile($u); RateLimit::hit('swipe', 400, 3600);
        $b = Http::body(); $to = (int) ($b['to'] ?? 0); $action = (string) ($b['action'] ?? '');
        if (!in_array($action, ['like', 'pass', 'superlike'], true) || $to === (int) $u['id']) Http::json(['error' => 'validation', 'message' => 'Bad swipe.'], 422);
        if (!Db::one('SELECT 1 AS x FROM match_profiles WHERE user_id = ?', [$to])) Http::json(['error' => 'not_found'], 404);
        if ($action === 'superlike' && $this->superlikesLeft((int) $u['id']) <= 0) Http::json(['error' => 'limit', 'message' => PayController::plusActive($u) ? 'You have used your five super likes for today.' : 'One super like a day on the free plan. Buja Plus gives five.'], 429);
        Db::run('DELETE FROM swipes WHERE from_user = ? AND to_user = ?', [$u['id'], $to]);
        Db::run('INSERT INTO swipes (from_user, to_user, action, created_at) VALUES (?,?,?,?)', [$u['id'], $to, $action, Db::now()]); Track::hit($u, 'match', 'swipe');
        $matched = null;
        if ($action !== 'pass') {
            $back = Db::one("SELECT id FROM swipes WHERE from_user = ? AND to_user = ? AND action IN ('like','superlike')", [$to, $u['id']]);
            if ($back) {
                $ex = Db::one('SELECT * FROM matches WHERE (user_a = ? AND user_b = ?) OR (user_a = ? AND user_b = ?)', [$u['id'], $to, $to, $u['id']]);
                if ($ex === null) {
                    Db::run('INSERT INTO threads (kind, application_id, user_a, user_b, last_message_at, created_at) VALUES (?,?,?,?,?,?)', ['match', null, $u['id'], $to, Db::now(), Db::now()]);
                    $tid = Db::lastId();
                    Db::run('INSERT INTO matches (user_a, user_b, thread_id, created_at) VALUES (?,?,?,?)', [$u['id'], $to, $tid, Db::now()]); Track::hit($u, 'match', 'match');
                    $ex = ['thread_id' => $tid];
                    $them = $this->profileRow($to);
                    Notify::user($to, 'match', "It's a match with " . explode(' ', $u['name'])[0], 'You liked each other. Say hello.', '/#/inbox/' . $tid);
                    $matched = ['threadId' => (int) $tid, 'name' => explode(' ', $them['name'])[0], 'photo' => $this->photos($to)[0]['url'] ?? null, 'score' => MatchRules::score($me, $them)['score']];
                } else $matched = ['threadId' => (int) $ex['thread_id']];
            } elseif ($action === 'superlike') {
                Notify::user($to, 'match', explode(' ', $u['name'])[0] . ' super liked you', 'See who it is in Match.', '/#/match/likes');
            }
        }
        Http::json(['ok' => true, 'matched' => $matched, 'superlikesLeft' => $this->superlikesLeft((int) $u['id'])]);
    }

    /** POST /match/suggest : called by the app on open; tells you about new people near you, at most once a day. */
    public function suggest(): void
    {
        $u = Auth::require();
        $me = Db::one('SELECT p.*, u.district FROM match_profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = ?', [$u['id']]);
        if (!$me || !(int) $me['visible']) Http::json(['suggested' => 0]);
        if (Db::one('SELECT 1 AS x FROM match_suggestions WHERE user_id = ? AND created_at > ?', [$u['id'], gmdate('Y-m-d H:i:s', time() - 86400)])) Http::json(['suggested' => 0]);
        $near = MatchRules::nearby((string) ($me['district'] ?? ''));
        $in = implode(',', array_fill(0, max(1, count($near)), '?'));
        $wantGender = $me['seeking'] === 'women' ? ['woman'] : ($me['seeking'] === 'men' ? ['man'] : MatchRules::GENDERS);
        $theySeek = $me['gender'] === 'woman' ? ['women', 'everyone'] : ['men', 'everyone'];
        $minBd = (new DateTime('today'))->modify('-' . ((int) $me['age_max'] + 1) . ' years')->format('Y-m-d'); $maxBd = (new DateTime('today'))->modify('-' . (int) $me['age_min'] . ' years')->format('Y-m-d');
        $sql = "SELECT p.user_id, u.name, u.district FROM match_profiles p JOIN users u ON u.id = p.user_id
                WHERE p.user_id <> ? AND p.visible = 1 AND u.deleted_at IS NULL AND u.district IN ($in)
                  AND p.gender IN (" . implode(',', array_fill(0, count($wantGender), '?')) . ") AND p.seeking IN (" . implode(',', array_fill(0, count($theySeek), '?')) . ")
                  AND p.birthdate > ? AND p.birthdate <= ? AND p.created_at > ?
                  AND EXISTS (SELECT 1 FROM match_photos ph WHERE ph.user_id = p.user_id)
                  AND NOT EXISTS (SELECT 1 FROM swipes s WHERE s.from_user = ? AND s.to_user = p.user_id)
                  AND NOT EXISTS (SELECT 1 FROM match_suggestions ms WHERE ms.user_id = ? AND ms.suggested = p.user_id)
                  AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker = ? AND b.blocked = p.user_id) OR (b.blocked = ? AND b.blocker = p.user_id))
                ORDER BY p.created_at DESC LIMIT 3";
        $st = Db::pdo()->prepare($sql);
        $st->execute([$u['id'], ...($near ?: ['']), ...$wantGender, ...$theySeek, $minBd, $maxBd, gmdate('Y-m-d H:i:s', time() - 14 * 86400), $u['id'], $u['id'], $u['id'], $u['id']]);
        $rows = $st->fetchAll(); if (!$rows) Http::json(['suggested' => 0]);
        foreach ($rows as $r) Db::run('INSERT INTO match_suggestions (user_id, suggested, created_at) VALUES (?,?,?)', [$u['id'], $r['user_id'], Db::now()]);
        $first = $rows[0]; $more = count($rows) - 1;
        Notify::user((int) $u['id'], 'match', 'Someone new in ' . ($first['district'] ?? 'Abuja'), explode(' ', $first['name'])[0] . ($more ? ' and ' . $more . ' other' . ($more > 1 ? 's' : '') . ' just joined Match near you.' : ' just joined Match near you.'), '/#/match/discover');
        Http::json(['suggested' => count($rows)]);
    }

    /** GET /match/matches */
    public function matches(): void
    {
        $u = Auth::require();
        $st = Db::pdo()->prepare('SELECT m.*, CASE WHEN m.user_a = ? THEN m.user_b ELSE m.user_a END AS other FROM matches m WHERE m.user_a = ? OR m.user_b = ? ORDER BY m.created_at DESC'); $st->execute([$u['id'], $u['id'], $u['id']]);
        $rows = [];
        foreach ($st->fetchAll() as $m) {
            $p = $this->profileRow((int) $m['other']); if (!$p) continue;
            $ph = $this->photos((int) $m['other']);
            $last = Db::one('SELECT id FROM messages WHERE thread_id = ? LIMIT 1', [$m['thread_id']]);
            $rows[] = ['id' => (int) $m['other'], 'name' => explode(' ', $p['name'])[0], 'age' => MatchRules::age($p['birthdate']), 'district' => $p['district'], 'photo' => $ph[0]['url'] ?? null, 'threadId' => (int) $m['thread_id'], 'new' => $last === null, 'matchedAt' => $m['created_at']];
        }
        Http::json(['matches' => $rows]);
    }

    /** GET /match/likes : people who liked me and I have not answered. Newest shown in full, the rest locked (Buja Plus later). */
    public function likes(): void
    {
        $u = Auth::require();
        $st = Db::pdo()->prepare("SELECT s.from_user, s.action, s.created_at FROM swipes s WHERE s.to_user = ? AND s.action IN ('like','superlike') AND NOT EXISTS (SELECT 1 FROM swipes r WHERE r.from_user = ? AND r.to_user = s.from_user) AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker = ? AND b.blocked = s.from_user) OR (b.blocked = ? AND b.blocker = s.from_user)) ORDER BY s.created_at DESC LIMIT 30");
        $st->execute([$u['id'], $u['id'], $u['id'], $u['id']]);
        $rows = []; $i = 0; $plus = PayController::plusActive($u);
        foreach ($st->fetchAll() as $s) {
            $p = $this->profileRow((int) $s['from_user']); if (!$p) continue;
            $free = $plus || $i === 0 || $s['action'] === 'superlike';
            $rows[] = ['id' => $free ? (int) $s['from_user'] : null, 'name' => $free ? explode(' ', $p['name'])[0] : null, 'age' => $free ? MatchRules::age($p['birthdate']) : null, 'district' => $free ? $p['district'] : null, 'photo' => $free ? ($this->photos((int) $s['from_user'])[0]['url'] ?? null) : null, 'superlike' => $s['action'] === 'superlike', 'locked' => !$free];
            $i++;
        }
        Http::json(['likes' => $rows, 'total' => count($rows), 'plus' => $plus]);
    }

    /** POST /match/block { user } and POST /match/report { user, reason } */
    public function block(): void
    {
        $u = Auth::require(); $to = (int) (Http::body()['user'] ?? 0);
        if ($to && $to !== (int) $u['id']) { Db::run('DELETE FROM blocks WHERE blocker = ? AND blocked = ?', [$u['id'], $to]); Db::run('INSERT INTO blocks (blocker, blocked, created_at) VALUES (?,?,?)', [$u['id'], $to, Db::now()]); }
        Http::json(['ok' => true]);
    }
    public function report(): void
    {
        $u = Auth::require(); $b = Http::body(); $to = (int) ($b['user'] ?? 0); $reason = mb_substr(trim((string) ($b['reason'] ?? '')), 0, 500);
        if (!$to || $reason === '') Http::json(['error' => 'validation', 'fields' => ['reason' => 'Tell us what happened.']], 422);
        Db::run('INSERT INTO reports (reporter, reported, reason, created_at) VALUES (?,?,?,?)', [$u['id'], $to, $reason, Db::now()]);
        Db::run('DELETE FROM blocks WHERE blocker = ? AND blocked = ?', [$u['id'], $to]); Db::run('INSERT INTO blocks (blocker, blocked, created_at) VALUES (?,?,?)', [$u['id'], $to, Db::now()]);
        Http::json(['ok' => true]);
    }
}

<?php
declare(strict_types=1);

final class HomesController
{
    private function photos(int $propertyId): array
    {
        $st = Db::pdo()->prepare('SELECT id FROM property_photos WHERE property_id = ? ORDER BY position, id'); $st->execute([$propertyId]);
        return array_map(fn($r) => ['id' => (int) $r['id'], 'url' => '/api/homes/photo/' . (int) $r['id']], $st->fetchAll());
    }
    private function landlord(int $ownerId): ?array
    {
        $l = Db::one('SELECT lp.*, u.name AS user_name, u.phone FROM landlord_profiles lp JOIN users u ON u.id = lp.user_id WHERE lp.user_id = ?', [$ownerId]);
        return $l ? ['id' => (int) $l['user_id'], 'photo' => $l['photo_upload_id'] ? '/api/uploads/' . (int) $l['photo_upload_id'] : null, 'name' => $l['display_name'] ?: $l['user_name'], 'isCompany' => (bool) $l['is_company'], 'verified' => $l['verified_at'] !== null, 'about' => $l['about'], 'listings' => (int) (Db::one("SELECT COUNT(*) AS n FROM properties WHERE owner_id = ? AND status <> 'hidden'", [$ownerId])['n'] ?? 0)] : null;
    }
    private function shape(array $p, ?array $u = null, bool $full = false): array
    {
        $out = [
            'id' => (int) $p['id'], 'kind' => $p['kind'], 'type' => $p['type'], 'typeLabel' => HomesRules::TYPES[$p['type']] ?? $p['type'], 'title' => $p['title'], 'district' => $p['district'], 'area' => $p['area'],
            'price' => (int) $p['price'], 'period' => $p['kind'] === 'rent' ? 'year' : null, 'beds' => (int) $p['beds'], 'baths' => (int) $p['baths'], 'facilities' => json_decode($p['facilities'] ?? '[]', true) ?: [],
            'status' => $p['status'], 'createdAt' => $p['created_at'], 'views' => (int) $p['views'], 'photos' => $this->photos((int) $p['id']),
            'minutesToCentre' => HomesRules::minutesToCentre($p['district']), 'agentFeeSaved' => $p['kind'] === 'rent' ? (int) round((int) $p['price'] * HomesRules::AGENT_FEE) : null,
            'upfront' => $p['upfront_years'] ? (int) $p['upfront_years'] : null, 'legalFee' => $p['legal_fee'] !== null ? (int) $p['legal_fee'] : null, 'cautionFee' => $p['caution_fee'] !== null ? (int) $p['caution_fee'] : null,
        ];
        $out['landlord'] = $this->landlord((int) $p['owner_id']);
        $out['direct'] = $out['landlord'] && !$out['landlord']['isCompany'];
        if ($full) { $out['description'] = $p['description']; }
        if ($u) { $out['saved'] = Db::one('SELECT 1 AS x FROM saved_properties WHERE user_id = ? AND property_id = ?', [$u['id'], $p['id']]) !== null; $out['mine'] = (int) $p['owner_id'] === (int) $u['id']; $t = Db::one('SELECT id FROM threads WHERE property_id = ? AND (user_a = ? OR user_b = ?)', [$p['id'], $u['id'], $u['id']]); $out['threadId'] = $t ? (int) $t['id'] : null; }
        return $out;
    }

    /** GET /homes?kind=rent|sale&type=&district=A,B&priceMax=&beds=&facilities=A,B&near=1&page= */
    public function index(): void
    {
        $u = Auth::user();
        $kind = in_array($_GET['kind'] ?? '', HomesRules::KINDS, true) ? $_GET['kind'] : 'rent';
        $where = ["p.status = 'available'", 'p.kind = ?']; $params = [$kind];
        if (!empty($_GET['type']) && isset(HomesRules::TYPES[$_GET['type']])) { $where[] = 'p.type = ?'; $params[] = $_GET['type']; }
        $districts = array_filter(array_map('trim', explode(',', (string) ($_GET['district'] ?? ''))));
        if ($districts) { $where[] = 'p.district IN (' . implode(',', array_fill(0, count($districts), '?')) . ')'; array_push($params, ...$districts); }
        if (!empty($_GET['priceMax'])) { $where[] = 'p.price <= ?'; $params[] = (int) preg_replace('/\D+/', '', (string) $_GET['priceMax']); }
        if (!empty($_GET['beds'])) { $where[] = 'p.beds >= ?'; $params[] = (int) $_GET['beds']; }
        $sql = 'SELECT p.* FROM properties p WHERE ' . implode(' AND ', $where) . ' ORDER BY p.created_at DESC LIMIT 60';
        $st = Db::pdo()->prepare($sql); $st->execute($params);
        $rows = array_map(fn($p) => $this->shape($p, $u), $st->fetchAll());
        $fac = array_filter(array_map('trim', explode(',', (string) ($_GET['facilities'] ?? ''))));
        if ($fac) $rows = array_values(array_filter($rows, fn($r) => !array_diff($fac, $r['facilities'])));
        if (!empty($_GET['near'])) usort($rows, fn($a, $b) => ($a['minutesToCentre'] ?? 999) <=> ($b['minutesToCentre'] ?? 999));
        $direct = count(array_filter($rows, fn($r) => $r['direct']));
        Http::json(['properties' => array_slice($rows, 0, 40), 'total' => count($rows), 'direct' => $direct, 'facilities' => HomesRules::FACILITIES, 'types' => HomesRules::TYPES]);
    }

    /** GET /homes/{id} */
    public function show(int $id): void
    {
        $u = Auth::user();
        $p = Db::one('SELECT * FROM properties WHERE id = ?', [$id]);
        if (!$p || ($p['status'] === 'hidden' && (!$u || (int) $p['owner_id'] !== (int) $u['id']))) Http::json(['error' => 'not_found', 'message' => 'This listing is no longer available.'], 404);
        if (!$u || (int) $p['owner_id'] !== (int) $u['id']) Db::run('UPDATE properties SET views = views + 1 WHERE id = ?', [$id]);
        Http::json(['property' => $this->shape($p, $u, true)]);
    }

    private function requireLandlord(array $u): array
    {
        if ($u['kind'] !== 'landlord') Http::json(['error' => 'forbidden', 'message' => 'Only landlord accounts can list property. Choose "I have property" when you create an account.'], 403);
        $l = Db::one('SELECT * FROM landlord_profiles WHERE user_id = ?', [$u['id']]);
        if (!$l) Http::json(['error' => 'no_landlord', 'message' => 'Set up your landlord profile first.'], 409);
        return $l;
    }

    /** GET /landlord/me and POST /landlord/me { displayName, isCompany, about } */
    public function landlordMe(): void
    {
        $u = Auth::require();
        $l = Db::one('SELECT * FROM landlord_profiles WHERE user_id = ?', [$u['id']]);
        Http::json(['landlord' => $l ? ['displayName' => $l['display_name'], 'isCompany' => (bool) $l['is_company'], 'about' => $l['about'], 'verified' => $l['verified_at'] !== null, 'photo' => $l['photo_upload_id'] ? '/api/uploads/' . (int) $l['photo_upload_id'] : null] : null, 'types' => HomesRules::TYPES, 'facilities' => HomesRules::FACILITIES]);
    }
    public function landlordSave(): void
    {
        $u = Auth::require();
        if ($u['kind'] !== 'landlord') Http::json(['error' => 'forbidden', 'message' => 'Only landlord accounts can list property.'], 403);
        $b = Http::body(); $name = mb_substr(trim((string) ($b['displayName'] ?? '')), 0, 80); $about = mb_substr(trim((string) ($b['about'] ?? '')), 0, 600); $co = !empty($b['isCompany']) ? 1 : 0;
        $existing = Db::one('SELECT display_name, is_company, about FROM landlord_profiles WHERE user_id = ?', [$u['id']]);
        if ($name === '' && $existing) { $name = $existing['display_name']; $about = $about ?: (string) $existing['about']; $co = array_key_exists('isCompany', $b) ? $co : (int) $existing['is_company']; }
        if (mb_strlen($name) < 2) Http::json(['error' => 'validation', 'fields' => ['displayName' => 'Your name, or the company name.']], 422);
        $photo = isset($b['uploadId']) ? UploadsController::claim((int) $b['uploadId'], $u) : null;
        if ($photo) Db::run('UPDATE landlord_profiles SET photo_upload_id = ? WHERE user_id = ?', [$photo, $u['id']]);
        if (Db::one('SELECT user_id FROM landlord_profiles WHERE user_id = ?', [$u['id']])) Db::run('UPDATE landlord_profiles SET display_name = ?, is_company = ?, about = ?, updated_at = ? WHERE user_id = ?', [$name, $co, $about, Db::now(), $u['id']]);
        else Db::run('INSERT INTO landlord_profiles (user_id, display_name, is_company, about, created_at, updated_at) VALUES (?,?,?,?,?,?)', [$u['id'], $name, $co, $about, Db::now(), Db::now()]);
        $this->landlordMe();
    }

    private function validate(array $b): array
    {
        $e = [];
        $kind = in_array($b['kind'] ?? '', HomesRules::KINDS, true) ? $b['kind'] : null; if (!$kind) $e['kind'] = 'For rent or for sale?';
        $type = isset(HomesRules::TYPES[$b['type'] ?? '']) ? $b['type'] : null; if (!$type) $e['type'] = 'Choose the property type.';
        $title = mb_substr(trim((string) ($b['title'] ?? '')), 0, 100); if (mb_strlen($title) < 6) $e['title'] = 'A short title, e.g. 2-bedroom flat, upstairs, own compound.';
        $district = mb_substr(trim((string) ($b['district'] ?? '')), 0, 60); if ($district === '') $e['district'] = 'Choose the district.';
        $area = mb_substr(trim((string) ($b['area'] ?? '')), 0, 100);
        $price = (int) preg_replace('/\D+/', '', (string) ($b['price'] ?? '')); if ($price < 10000) $e['price'] = 'Enter the price in naira.';
        $beds = max(0, min(20, (int) ($b['beds'] ?? 0))); $baths = max(0, min(20, (int) ($b['baths'] ?? 0)));
        $fac = array_values(array_intersect(array_map('strval', (array) ($b['facilities'] ?? [])), HomesRules::FACILITIES));
        $desc = mb_substr(trim((string) ($b['description'] ?? '')), 0, 3000); if (mb_strlen($desc) < 20) $e['description'] = 'Describe the property in a few sentences.';
        $upfront = $kind === 'rent' ? max(1, min(3, (int) ($b['upfront'] ?? 1))) : null;
        $legal = ($b['legalFee'] ?? '') !== '' ? (int) preg_replace('/\D+/', '', (string) $b['legalFee']) : null; $caution = ($b['cautionFee'] ?? '') !== '' ? (int) preg_replace('/\D+/', '', (string) $b['cautionFee']) : null;
        return [$e, compact('kind', 'type', 'title', 'district', 'area', 'price', 'beds', 'baths', 'fac', 'desc', 'upfront', 'legal', 'caution')];
    }

    /** POST /homes */
    public function create(): void
    {
        $u = Auth::require(); $this->requireLandlord($u); RateLimit::hit('property', 20, 3600);
        [$e, $v] = $this->validate(Http::body()); if ($e) Http::json(['error' => 'validation', 'fields' => $e], 422);
        Db::run('INSERT INTO properties (owner_id, kind, type, title, district, area, price, beds, baths, facilities, description, upfront_years, legal_fee, caution_fee, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [$u['id'], $v['kind'], $v['type'], $v['title'], $v['district'], $v['area'] ?: null, $v['price'], $v['beds'], $v['baths'], json_encode($v['fac']), $v['desc'], $v['upfront'], $v['legal'], $v['caution'], 'available', Db::now(), Db::now()]);
        $id = Db::lastId();
        Track::hit($u, 'homes', 'post');
        $row = Db::one('SELECT * FROM properties WHERE id = ?', [$id]);
        if ($row) Alerts::fanout('homes', $row, (int) $u['id'], $row['title'] . ', ₦' . number_format((int) $row['price']) . ' in ' . $row['district'], '/#/homes/' . (int) $id);
        Http::json(['property' => $this->shape(Db::one('SELECT * FROM properties WHERE id = ?', [$id]), $u, true)], 201);
    }

    /** PATCH /homes/{id} : full update, or { status } alone */
    public function update(int $id): void
    {
        $u = Auth::require(); $this->requireLandlord($u);
        $p = Db::one('SELECT * FROM properties WHERE id = ? AND owner_id = ?', [$id, $u['id']]); if (!$p) Http::json(['error' => 'not_found'], 404);
        $b = Http::body();
        if (count($b) === 1 && isset($b['status'])) {
            if (!in_array($b['status'], ['available', 'let', 'sold', 'hidden'], true)) Http::json(['error' => 'validation', 'fields' => ['status' => 'Unknown status.']], 422);
            Db::run('UPDATE properties SET status = ?, updated_at = ? WHERE id = ?', [$b['status'], Db::now(), $id]);
        } else {
            [$e, $v] = $this->validate($b); if ($e) Http::json(['error' => 'validation', 'fields' => $e], 422);
            Db::run('UPDATE properties SET kind=?, type=?, title=?, district=?, area=?, price=?, beds=?, baths=?, facilities=?, description=?, upfront_years=?, legal_fee=?, caution_fee=?, updated_at=? WHERE id = ?',
                [$v['kind'], $v['type'], $v['title'], $v['district'], $v['area'] ?: null, $v['price'], $v['beds'], $v['baths'], json_encode($v['fac']), $v['desc'], $v['upfront'], $v['legal'], $v['caution'], Db::now(), $id]);
        }
        Http::json(['property' => $this->shape(Db::one('SELECT * FROM properties WHERE id = ?', [$id]), $u, true)]);
    }

    /** POST /homes/{id}/photos (multipart "photo"), DELETE /homes/photos/{id}, GET /homes/photo/{id} */
    public function addPhoto(int $id): void
    {
        $u = Auth::require(); RateLimit::hit('pphoto', 60, 3600);
        if (!Db::one('SELECT id FROM properties WHERE id = ? AND owner_id = ?', [$id, $u['id']])) Http::json(['error' => 'not_found'], 404);
        $f = Http::file('photo'); if (!$f) Http::json(['error' => 'validation', 'fields' => ['photo' => 'Choose a photo.']], 422);
        if ((int) $f['size'] > 800 * 1024) Http::json(['error' => 'validation', 'fields' => ['photo' => 'Photo too large. Try again.']], 422);
        $n = (int) (Db::one('SELECT COUNT(*) AS n FROM property_photos WHERE property_id = ?', [$id])['n'] ?? 0); if ($n >= HomesRules::PHOTO_MAX) Http::json(['error' => 'validation', 'fields' => ['photo' => 'Up to 10 photos.']], 422);
        $data = file_get_contents($f['tmp_name']) ?: ''; $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($data) ?: '';
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) Http::json(['error' => 'validation', 'fields' => ['photo' => 'JPEG, PNG or WebP only.']], 422);
        $dim = @getimagesizefromstring($data); if (!$dim || $dim[0] > 2400 || $dim[1] > 2400) Http::json(['error' => 'validation', 'fields' => ['photo' => 'Photo could not be read. Try another.']], 422);
        $key = Media::put('homes', $data, $mime, $mime === 'image/png' ? 'png' : ($mime === 'image/webp' ? 'webp' : 'jpg'));
        Db::run('INSERT INTO property_photos (property_id, position, mime, size, data, storage_key, created_at) VALUES (?,?,?,?,?,?,?)', [$id, $n, $mime, strlen($data), $key ? null : $data, $key, Db::now()]);
        Http::json(['photos' => $this->photos($id)], 201);
    }
    public function deletePhoto(int $photoId): void
    {
        $u = Auth::require();
        $ph = Db::one('SELECT pp.property_id FROM property_photos pp JOIN properties p ON p.id = pp.property_id WHERE pp.id = ? AND p.owner_id = ?', [$photoId, $u['id']]);
        if (!$ph) Http::json(['error' => 'not_found'], 404);
        Db::run('DELETE FROM property_photos WHERE id = ?', [$photoId]);
        Http::json(['photos' => $this->photos((int) $ph['property_id'])]);
    }
    public function photo(int $photoId): void
    {
        Auth::require();
        $p = Db::one('SELECT * FROM property_photos WHERE id = ?', [$photoId]); if (!$p) Http::json(['error' => 'not_found'], 404);
        if ($p['storage_key']) { header('Location: ' . Media::url($p['storage_key'])); header('Cache-Control: private, max-age=300'); exit; }
        header('Content-Type: ' . $p['mime']); header('Content-Length: ' . (int) $p['size']); header('Cache-Control: private, max-age=86400'); header('X-Content-Type-Options: nosniff');
        echo $p['data']; exit;
    }

    /** POST /homes/{id}/save, DELETE /homes/{id}/save, GET /homes/saved */
    public function save(int $id): void { $u = Auth::require(); if (!Db::one('SELECT id FROM properties WHERE id = ?', [$id])) Http::json(['error' => 'not_found'], 404); if (!Db::one('SELECT 1 AS x FROM saved_properties WHERE user_id = ? AND property_id = ?', [$u['id'], $id])) Db::run('INSERT INTO saved_properties (user_id, property_id, created_at) VALUES (?,?,?)', [$u['id'], $id, Db::now()]); Http::json(['saved' => true]); }
    public function unsave(int $id): void { $u = Auth::require(); Db::run('DELETE FROM saved_properties WHERE user_id = ? AND property_id = ?', [$u['id'], $id]); Http::json(['saved' => false]); }
    public function saved(): void
    {
        $u = Auth::require();
        $st = Db::pdo()->prepare("SELECT p.* FROM saved_properties s JOIN properties p ON p.id = s.property_id WHERE s.user_id = ? AND p.status <> 'hidden' ORDER BY s.created_at DESC"); $st->execute([$u['id']]);
        Http::json(['properties' => array_map(fn($p) => $this->shape($p, $u), $st->fetchAll())]);
    }

    /** GET /landlord/properties : my listings with enquiry counts */
    public function mine(): void
    {
        $u = Auth::require(); $this->requireLandlord($u);
        $st = Db::pdo()->prepare('SELECT p.*, (SELECT COUNT(*) FROM threads t WHERE t.property_id = p.id) AS enquiries, (SELECT COUNT(*) FROM threads t JOIN messages m ON m.thread_id = t.id WHERE t.property_id = p.id AND m.type = \'inspection\' AND m.meta LIKE \'%"status":"confirmed"%\') AS inspections FROM properties p WHERE p.owner_id = ? ORDER BY p.created_at DESC'); $st->execute([$u['id']]);
        $rows = array_map(fn($p) => $this->shape($p, $u) + ['enquiries' => (int) $p['enquiries'], 'inspections' => (int) $p['inspections']], $st->fetchAll());
        Http::json(['properties' => $rows, 'savedByOthers' => (int) (Db::one('SELECT COUNT(*) AS n FROM saved_properties s JOIN properties p ON p.id = s.property_id WHERE p.owner_id = ?', [$u['id']])['n'] ?? 0)]);
    }

    /** POST /homes/{id}/enquire : open (or fetch) the conversation with the landlord */
    public function enquire(int $id): void
    {
        $u = Auth::require();
        $p = Db::one("SELECT * FROM properties WHERE id = ? AND status = 'available'", [$id]); if (!$p) Http::json(['error' => 'not_found', 'message' => 'This listing is no longer available.'], 404);
        if ((int) $p['owner_id'] === (int) $u['id']) Http::json(['error' => 'validation', 'message' => 'This is your own listing.'], 422);
        $t = Db::one('SELECT id FROM threads WHERE property_id = ? AND user_b = ?', [$id, $u['id']]);
        if (!$t) { Db::run('INSERT INTO threads (kind, property_id, user_a, user_b, last_message_at, created_at) VALUES (?,?,?,?,?,?)', ['homes', $id, $p['owner_id'], $u['id'], Db::now(), Db::now()]); $t = ['id' => Db::lastId()]; Track::hit($u, 'homes', 'enquire'); Notify::user((int) $p['owner_id'], 'work', $u['name'] . ' is interested in your ' . $p['title'], 'Open the conversation to reply.', '/#/inbox/' . $t['id']); }
        Http::json(['threadId' => (int) $t['id']]);
    }
}

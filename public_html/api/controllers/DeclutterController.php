<?php
declare(strict_types=1);

final class DeclutterController
{
    public const CATEGORIES = ['Phones & tablets', 'Laptops & computers', 'TVs & audio', 'Home appliances', 'Furniture', 'Fashion & shoes', 'Beauty & health', 'Kids & baby', 'Cars & parts', 'Generators & solar', 'Kitchen', 'Books & hobbies', 'Other'];
    public const CONDITIONS = ['new' => 'Brand new', 'like_new' => 'Like new', 'good' => 'Good', 'used' => 'Used', 'parts' => 'For parts'];
    public const PHOTO_MAX = 8;

    private function photos(int $id): array
    {
        $st = Db::pdo()->prepare('SELECT id FROM listing_photos WHERE listing_id = ? ORDER BY position, id'); $st->execute([$id]);
        return array_map(fn($r) => ['id' => (int) $r['id'], 'url' => '/api/declutter/photo/' . (int) $r['id']], $st->fetchAll());
    }
    private function seller(int $uid): array
    {
        $u = Db::one('SELECT id, name, district, created_at, email_verified_at, phone FROM users WHERE id = ?', [$uid]);
        return ['id' => (int) $u['id'], 'name' => explode(' ', trim($u['name']))[0] . (strlen($u['name']) > strlen(explode(' ', $u['name'])[0]) ? ' ' . mb_substr(explode(' ', trim($u['name']))[1] ?? '', 0, 1) . '.' : ''), 'district' => $u['district'], 'since' => substr($u['created_at'], 0, 7), 'phoneVerified' => $u['phone'] !== null,
            'active' => (int) (Db::one("SELECT COUNT(*) AS n FROM listings WHERE seller_id = ? AND status = 'active'", [$uid])['n'] ?? 0), 'sold' => (int) (Db::one("SELECT COUNT(*) AS n FROM listings WHERE seller_id = ? AND status = 'sold'", [$uid])['n'] ?? 0)];
    }
    private function shape(array $l, ?array $u = null, bool $full = false): array
    {
        $out = ['id' => (int) $l['id'], 'title' => $l['title'], 'category' => $l['category'], 'condition' => $l['cond'], 'conditionLabel' => self::CONDITIONS[$l['cond']] ?? $l['cond'], 'price' => (int) $l['price'], 'negotiable' => (bool) $l['negotiable'], 'district' => $l['district'], 'delivery' => $l['delivery'], 'escrowOk' => (bool) $l['escrow_ok'], 'status' => $l['status'], 'views' => (int) $l['views'], 'createdAt' => $l['created_at'], 'photos' => $this->photos((int) $l['id'])];
        if ($full) { $out['description'] = $l['description']; $out['seller'] = $this->seller((int) $l['seller_id']); }
        if ($u) { $out['saved'] = Db::one('SELECT 1 AS x FROM saved_listings WHERE user_id = ? AND listing_id = ?', [$u['id'], $l['id']]) !== null; $out['mine'] = (int) $l['seller_id'] === (int) $u['id']; $t = Db::one('SELECT id FROM threads WHERE listing_id = ? AND user_b = ?', [$l['id'], $u['id']]); $out['threadId'] = $t ? (int) $t['id'] : null; }
        return $out;
    }

    /** GET /declutter?q=&category=&district=&priceMax=&condition=&sort=newest|cheapest|nearby */
    public function index(): void
    {
        $u = Auth::user(); $where = ["status = 'active'"]; $p = [];
        $qq = trim((string) ($_GET['q'] ?? '')); if ($qq !== '') { $where[] = '(title LIKE ? OR description LIKE ?)'; array_push($p, '%' . $qq . '%', '%' . $qq . '%'); }
        if (!empty($_GET['category']) && in_array($_GET['category'], self::CATEGORIES, true)) { $where[] = 'category = ?'; $p[] = $_GET['category']; }
        if (!empty($_GET['district'])) { $where[] = 'district = ?'; $p[] = $_GET['district']; }
        if (!empty($_GET['priceMax'])) { $where[] = 'price <= ?'; $p[] = (int) preg_replace('/\D+/', '', (string) $_GET['priceMax']); }
        if (!empty($_GET['condition']) && isset(self::CONDITIONS[$_GET['condition']])) { $where[] = 'cond = ?'; $p[] = $_GET['condition']; }
        $sort = ($_GET['sort'] ?? '') === 'cheapest' ? 'price ASC' : 'created_at DESC';
        $st = Db::pdo()->prepare('SELECT * FROM listings WHERE ' . implode(' AND ', $where) . ' ORDER BY ' . $sort . ' LIMIT 60'); $st->execute($p);
        $rows = array_map(fn($l) => $this->shape($l, $u), $st->fetchAll());
        if (($_GET['sort'] ?? '') === 'nearby' && $u && $u['district']) { $near = MatchRules::nearby($u['district']); usort($rows, fn($a, $b) => ($a['district'] === $u['district'] ? 0 : (in_array($a['district'], $near, true) ? 1 : 2)) <=> ($b['district'] === $u['district'] ? 0 : (in_array($b['district'], $near, true) ? 1 : 2))); }
        Http::json(['listings' => $rows, 'total' => count($rows), 'categories' => self::CATEGORIES, 'conditions' => self::CONDITIONS]);
    }

    /** GET /declutter/{id} */
    public function show(int $id): void
    {
        $u = Auth::user(); $l = Db::one('SELECT * FROM listings WHERE id = ?', [$id]);
        if (!$l || ($l['status'] === 'hidden' && (!$u || (int) $l['seller_id'] !== (int) $u['id']))) Http::json(['error' => 'not_found', 'message' => 'This item is no longer listed.'], 404);
        if (!$u || (int) $l['seller_id'] !== (int) $u['id']) Db::run('UPDATE listings SET views = views + 1 WHERE id = ?', [$id]);
        Http::json(['listing' => $this->shape($l, $u, true)]);
    }

    private function validate(array $b): array
    {
        $e = [];
        $title = mb_substr(trim((string) ($b['title'] ?? '')), 0, 80); if (mb_strlen($title) < 4) $e['title'] = 'Give it a clear title, e.g. iPhone 13, 128GB, UK used.';
        $cat = in_array($b['category'] ?? '', self::CATEGORIES, true) ? $b['category'] : null; if (!$cat) $e['category'] = 'Choose a category.';
        $cond = isset(self::CONDITIONS[$b['condition'] ?? '']) ? $b['condition'] : null; if (!$cond) $e['condition'] = 'What condition is it in?';
        $price = (int) preg_replace('/\D+/', '', (string) ($b['price'] ?? '')); if ($price < 100 || $price > 500000000) $e['price'] = 'Enter the price in naira.';
        $district = mb_substr(trim((string) ($b['district'] ?? '')), 0, 60); if ($district === '') $e['district'] = 'Where is the item?';
        $desc = mb_substr(trim((string) ($b['description'] ?? '')), 0, 2000); if (mb_strlen($desc) < 15) $e['description'] = 'A few words on age, what is included, why you are selling.';
        $delivery = in_array($b['delivery'] ?? '', ['pickup', 'delivery', 'both'], true) ? $b['delivery'] : 'pickup';
        return [$e, ['title' => $title, 'category' => $cat, 'cond' => $cond, 'price' => $price, 'negotiable' => !empty($b['negotiable']) ? 1 : 0, 'district' => $district, 'description' => $desc, 'delivery' => $delivery, 'escrow' => !empty($b['escrowOk']) ? 1 : 0]];
    }

    /** POST /declutter */
    public function create(): void
    {
        $u = Auth::require(); RateLimit::hit('listing', 30, 3600);
        [$e, $v] = $this->validate(Http::body()); if ($e) Http::json(['error' => 'validation', 'fields' => $e], 422);
        Db::run('INSERT INTO listings (seller_id, title, category, cond, price, negotiable, district, description, delivery, escrow_ok, status, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [$u['id'], $v['title'], $v['category'], $v['cond'], $v['price'], $v['negotiable'], $v['district'], $v['description'], $v['delivery'], $v['escrow'], 'active', Db::now(), Db::now()]);
        Http::json(['listing' => $this->shape(Db::one('SELECT * FROM listings WHERE id = ?', [Db::lastId()]), $u, true)], 201);
    }

    /** PATCH /declutter/{id} : full update, or { status } */
    public function update(int $id): void
    {
        $u = Auth::require(); $l = Db::one('SELECT * FROM listings WHERE id = ? AND seller_id = ?', [$id, $u['id']]); if (!$l) Http::json(['error' => 'not_found'], 404);
        $b = Http::body();
        if (count($b) === 1 && isset($b['status'])) { if (!in_array($b['status'], ['active', 'sold', 'hidden'], true)) Http::json(['error' => 'validation', 'fields' => ['status' => 'Unknown status.']], 422); Db::run('UPDATE listings SET status = ?, updated_at = ? WHERE id = ?', [$b['status'], Db::now(), $id]); }
        else { [$e, $v] = $this->validate($b); if ($e) Http::json(['error' => 'validation', 'fields' => $e], 422); Db::run('UPDATE listings SET title=?, category=?, cond=?, price=?, negotiable=?, district=?, description=?, delivery=?, escrow_ok=?, updated_at=? WHERE id = ?', [$v['title'], $v['category'], $v['cond'], $v['price'], $v['negotiable'], $v['district'], $v['description'], $v['delivery'], $v['escrow'], Db::now(), $id]); }
        Http::json(['listing' => $this->shape(Db::one('SELECT * FROM listings WHERE id = ?', [$id]), $u, true)]);
    }

    /** Photos */
    public function addPhoto(int $id): void
    {
        $u = Auth::require(); RateLimit::hit('lphoto', 80, 3600);
        if (!Db::one('SELECT id FROM listings WHERE id = ? AND seller_id = ?', [$id, $u['id']])) Http::json(['error' => 'not_found'], 404);
        $f = Http::file('photo'); if (!$f) Http::json(['error' => 'validation', 'fields' => ['photo' => 'Choose a photo.']], 422);
        if ((int) $f['size'] > 800 * 1024) Http::json(['error' => 'validation', 'fields' => ['photo' => 'Photo too large. Try again.']], 422);
        $n = (int) (Db::one('SELECT COUNT(*) AS n FROM listing_photos WHERE listing_id = ?', [$id])['n'] ?? 0); if ($n >= self::PHOTO_MAX) Http::json(['error' => 'validation', 'fields' => ['photo' => 'Up to 8 photos.']], 422);
        $data = file_get_contents($f['tmp_name']) ?: ''; $mime = (new finfo(FILEINFO_MIME_TYPE))->buffer($data) ?: '';
        if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true)) Http::json(['error' => 'validation', 'fields' => ['photo' => 'JPEG, PNG or WebP only.']], 422);
        $dim = @getimagesizefromstring($data); if (!$dim || $dim[0] > 2400 || $dim[1] > 2400) Http::json(['error' => 'validation', 'fields' => ['photo' => 'Photo could not be read. Try another.']], 422);
        Db::run('INSERT INTO listing_photos (listing_id, position, mime, size, data, created_at) VALUES (?,?,?,?,?,?)', [$id, $n, $mime, strlen($data), $data, Db::now()]);
        Http::json(['photos' => $this->photos($id)], 201);
    }
    public function deletePhoto(int $photoId): void
    {
        $u = Auth::require(); $ph = Db::one('SELECT lp.listing_id FROM listing_photos lp JOIN listings l ON l.id = lp.listing_id WHERE lp.id = ? AND l.seller_id = ?', [$photoId, $u['id']]); if (!$ph) Http::json(['error' => 'not_found'], 404);
        Db::run('DELETE FROM listing_photos WHERE id = ?', [$photoId]); Http::json(['photos' => $this->photos((int) $ph['listing_id'])]);
    }
    public function photo(int $photoId): void
    {
        Auth::require(); $p = Db::one('SELECT * FROM listing_photos WHERE id = ?', [$photoId]); if (!$p) Http::json(['error' => 'not_found'], 404);
        header('Content-Type: ' . $p['mime']); header('Content-Length: ' . (int) $p['size']); header('Cache-Control: private, max-age=86400'); header('X-Content-Type-Options: nosniff'); echo $p['data']; exit;
    }

    /** Saved, mine */
    public function save(int $id): void { $u = Auth::require(); if (!Db::one('SELECT id FROM listings WHERE id = ?', [$id])) Http::json(['error' => 'not_found'], 404); if (!Db::one('SELECT 1 AS x FROM saved_listings WHERE user_id = ? AND listing_id = ?', [$u['id'], $id])) Db::run('INSERT INTO saved_listings (user_id, listing_id, created_at) VALUES (?,?,?)', [$u['id'], $id, Db::now()]); Http::json(['saved' => true]); }
    public function unsave(int $id): void { $u = Auth::require(); Db::run('DELETE FROM saved_listings WHERE user_id = ? AND listing_id = ?', [$u['id'], $id]); Http::json(['saved' => false]); }
    public function saved(): void { $u = Auth::require(); $st = Db::pdo()->prepare("SELECT l.* FROM saved_listings s JOIN listings l ON l.id = s.listing_id WHERE s.user_id = ? AND l.status <> 'hidden' ORDER BY s.created_at DESC"); $st->execute([$u['id']]); Http::json(['listings' => array_map(fn($l) => $this->shape($l, $u), $st->fetchAll())]); }
    public function mine(): void
    {
        $u = Auth::require();
        $st = Db::pdo()->prepare('SELECT l.*, (SELECT COUNT(*) FROM threads t WHERE t.listing_id = l.id) AS chats, (SELECT COUNT(*) FROM threads t JOIN messages m ON m.thread_id = t.id WHERE t.listing_id = l.id AND m.type = \'offer\' AND m.meta LIKE \'%"status":"pending"%\') AS offers FROM listings l WHERE l.seller_id = ? ORDER BY l.created_at DESC'); $st->execute([$u['id']]);
        Http::json(['listings' => array_map(fn($l) => $this->shape($l, $u) + ['chats' => (int) $l['chats'], 'offers' => (int) $l['offers']], $st->fetchAll())]);
    }

    /** POST /declutter/{id}/chat : open (or fetch) the buyer's conversation with the seller */
    public function chat(int $id): void
    {
        $u = Auth::require(); $l = Db::one("SELECT * FROM listings WHERE id = ? AND status = 'active'", [$id]); if (!$l) Http::json(['error' => 'not_found', 'message' => 'This item is no longer listed.'], 404);
        if ((int) $l['seller_id'] === (int) $u['id']) Http::json(['error' => 'validation', 'message' => 'This is your own listing.'], 422);
        $t = Db::one('SELECT id FROM threads WHERE listing_id = ? AND user_b = ?', [$id, $u['id']]);
        if (!$t) { Db::run('INSERT INTO threads (kind, listing_id, user_a, user_b, last_message_at, created_at) VALUES (?,?,?,?,?,?)', ['declutter', $id, $l['seller_id'], $u['id'], Db::now(), Db::now()]); $t = ['id' => Db::lastId()]; Notify::user((int) $l['seller_id'], 'work', $u['name'] . ' is interested in your ' . $l['title'], 'Open the conversation to reply.', '/#/inbox/' . $t['id']); }
        Http::json(['threadId' => (int) $t['id']]);
    }

    /** POST /threads/{id}/offer { amount } (buyer) */
    public function offer(int $threadId): void
    {
        $u = Auth::require(); RateLimit::hit('offer', 40, 3600);
        $t = Db::one('SELECT * FROM threads WHERE id = ? AND kind = \'declutter\' AND user_b = ?', [$threadId, $u['id']]); if (!$t) Http::json(['error' => 'forbidden', 'message' => 'Only the buyer can make an offer here.'], 403);
        $l = Db::one("SELECT * FROM listings WHERE id = ? AND status = 'active'", [$t['listing_id']]); if (!$l) Http::json(['error' => 'not_found', 'message' => 'This item is no longer listed.'], 404);
        $amt = (int) preg_replace('/\D+/', '', (string) (Http::body()['amount'] ?? '')); if ($amt < 100) Http::json(['error' => 'validation', 'fields' => ['amount' => 'Enter your offer in naira.']], 422);
        if ($amt < (int) $l['price'] * 0.3) Http::json(['error' => 'validation', 'fields' => ['amount' => 'That is too far below the asking price to send.']], 422);
        $meta = ['amount' => $amt, 'asking' => (int) $l['price'], 'status' => 'pending'];
        Db::run('INSERT INTO messages (thread_id, sender_id, type, body, meta, created_at) VALUES (?,?,?,?,?,?)', [$threadId, $u['id'], 'offer', 'Offer', json_encode($meta), Db::now()]);
        $mid = Db::lastId(); Db::run('UPDATE threads SET last_message_at = ? WHERE id = ?', [Db::now(), $threadId]);
        Notify::user((int) $t['user_a'], 'work', $u['name'] . ' offered ₦' . number_format($amt) . ' for ' . $l['title'], 'Asking ₦' . number_format((int) $l['price']) . '. Accept or decline.', '/#/inbox/' . $threadId);
        Http::json(['message' => ['id' => $mid, 'mine' => true, 'type' => 'offer', 'body' => 'Offer', 'meta' => $meta, 'createdAt' => Db::now()]], 201);
    }

    /** POST /messages/{id}/offer-response { action: accept|decline } (seller) */
    public function respondOffer(int $mid): void
    {
        $u = Auth::require();
        $m = Db::one("SELECT m.*, t.user_a, t.user_b, t.listing_id FROM messages m JOIN threads t ON t.id = m.thread_id WHERE m.id = ? AND m.type = 'offer'", [$mid]);
        if (!$m || (int) $m['user_a'] !== (int) $u['id']) Http::json(['error' => 'forbidden', 'message' => 'Only the seller can answer an offer.'], 403);
        $action = (string) (Http::body()['action'] ?? ''); if (!in_array($action, ['accept', 'decline'], true)) Http::json(['error' => 'validation', 'fields' => ['action' => 'accept or decline']], 422);
        $meta = json_decode($m['meta'], true); if ($meta['status'] !== 'pending') Http::json(['error' => 'validation', 'message' => 'This offer was already answered.'], 422);
        $meta['status'] = $action === 'accept' ? 'accepted' : 'declined'; Db::run('UPDATE messages SET meta = ? WHERE id = ?', [json_encode($meta), $mid]);
        $reply = $action === 'accept' ? 'Offer of ₦' . number_format($meta['amount']) . ' accepted. Agree where to meet; pay only when you have the item in hand.' : 'Sorry, I cannot go that low.';
        Db::run('INSERT INTO messages (thread_id, sender_id, type, body, created_at) VALUES (?,?,?,?,?)', [$m['thread_id'], $u['id'], 'text', $reply, Db::now()]); Db::run('UPDATE threads SET last_message_at = ? WHERE id = ?', [Db::now(), $m['thread_id']]);
        Notify::user((int) $m['user_b'], 'work', $action === 'accept' ? 'Your offer was accepted' : 'Your offer was declined', $reply, '/#/inbox/' . $m['thread_id']);
        Http::json(['ok' => true, 'status' => $meta['status']]);
    }
}

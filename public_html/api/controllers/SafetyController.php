<?php
declare(strict_types=1);

/**
 * Trip Share. Before you go and meet someone from Buja, you start a trip: where, until when, and which
 * friend to tell. They get a private link showing your live position and when you are due back. If you
 * do not end the trip in time, or you hit the alarm, the link says so loudly.
 */
final class SafetyController
{
    private function shape(array $s, bool $withTrack = false): array
    {
        $last = Db::one('SELECT lat, lng, created_at FROM safety_pings WHERE session_id = ? ORDER BY id DESC LIMIT 1', [$s['id']]);
        $overdue = $s['status'] === 'active' && $s['expected_end'] < Db::now();
        $out = ['id' => (int) $s['id'], 'token' => $s['token'], 'place' => $s['place'], 'note' => $s['note'], 'with' => $s['with_name'], 'contact' => $s['contact_name'],
            'status' => $overdue ? 'overdue' : $s['status'], 'expectedEnd' => $s['expected_end'], 'startedAt' => $s['created_at'], 'endedAt' => $s['ended_at'],
            'last' => $last ? ['lat' => (float) $last['lat'], 'lng' => (float) $last['lng'], 'at' => $last['created_at']] : null,
            'link' => (string) Http::config('app_origin') . '/#/trip/' . $s['token'],
            'kind' => $s['kind'] ?? 'meet', 'plate' => $s['plate'] ?? null, 'vehicle' => $s['vehicle'] ?? null, 'mode' => $s['mode'] ?? null,
            'fareAsked' => !empty($s['fare_asked']), 'routeId' => !empty($s['route_id']) ? (int) $s['route_id'] : null,
            'from' => !empty($s['from_place']) ? Db::one('SELECT id, name, lat, lng FROM places WHERE id = ?', [$s['from_place']]) : null,
            'to' => !empty($s['to_place']) ? Db::one('SELECT id, name, lat, lng FROM places WHERE id = ?', [$s['to_place']]) : null];
        if ($withTrack) { $st = Db::pdo()->prepare('SELECT lat, lng, created_at FROM safety_pings WHERE session_id = ? ORDER BY id DESC LIMIT 60'); $st->execute([$s['id']]); $out['track'] = array_reverse(array_map(fn($p) => ['lat' => (float) $p['lat'], 'lng' => (float) $p['lng'], 'at' => $p['created_at']], $st->fetchAll())); }
        return $out;
    }

    /** GET /safety : my contacts and any running trip */
    public function index(): void
    {
        $u = Auth::require();
        $st = Db::pdo()->prepare('SELECT id, name, phone, email FROM trusted_contacts WHERE user_id = ? ORDER BY id'); $st->execute([$u['id']]);
        $active = Db::one("SELECT * FROM safety_sessions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", [$u['id']]);
        $past = Db::pdo()->prepare("SELECT * FROM safety_sessions WHERE user_id = ? AND status <> 'active' ORDER BY id DESC LIMIT 10"); $past->execute([$u['id']]);
        Http::json(['contacts' => array_map(fn($c) => ['id' => (int) $c['id'], 'name' => $c['name'], 'phone' => $c['phone'], 'email' => $c['email']], $st->fetchAll()),
            'active' => $active ? $this->shape($active) : null,
            'past' => array_map(fn($s) => $this->shape($s), $past->fetchAll())]);
    }

    /** POST /safety/contacts { name, phone, email } and DELETE /safety/contacts/{id} */
    public function addContact(): void
    {
        $u = Auth::require(); $b = Http::body();
        $name = mb_substr(trim((string) ($b['name'] ?? '')), 0, 60); $phone = Validator::ngPhone((string) ($b['phone'] ?? '')); $email = Validator::email((string) ($b['email'] ?? ''));
        if (mb_strlen($name) < 2) Http::json(['error' => 'validation', 'fields' => ['name' => 'Who is it?']], 422);
        if (!$phone && !$email) Http::json(['error' => 'validation', 'fields' => ['phone' => 'A phone number or an email, so you can send them the link.']], 422);
        if ((int) (Db::one('SELECT COUNT(*) AS n FROM trusted_contacts WHERE user_id = ?', [$u['id']])['n'] ?? 0) >= 5) Http::json(['error' => 'validation', 'message' => 'Up to five trusted contacts.'], 422);
        Db::run('INSERT INTO trusted_contacts (user_id, name, phone, email, created_at) VALUES (?,?,?,?,?)', [$u['id'], $name, $phone, $email ?: null, Db::now()]);
        $this->index();
    }
    public function removeContact(int $id): void { $u = Auth::require(); Db::run('DELETE FROM trusted_contacts WHERE id = ? AND user_id = ?', [$id, $u['id']]); $this->index(); }

    /** POST /safety/start { place, hours, withName, withUserId, contactId, note, lat, lng } */
    public function start(): void
    {
        $u = Auth::require(); RateLimit::hit('trip', 20, 86400);
        if (Db::one("SELECT id FROM safety_sessions WHERE user_id = ? AND status = 'active'", [$u['id']])) Http::json(['error' => 'active', 'message' => 'You already have a trip running. End it first.'], 409);
        $b = Http::body();
        $place = mb_substr(trim((string) ($b['place'] ?? '')), 0, 120); if (mb_strlen($place) < 3) Http::json(['error' => 'validation', 'fields' => ['place' => 'Where are you meeting?']], 422);
        $hours = max(1, min(12, (int) ($b['hours'] ?? 3)));
        $with = mb_substr(trim((string) ($b['withName'] ?? '')), 0, 60);
        $withId = !empty($b['withUserId']) ? (int) $b['withUserId'] : null;
        if ($withId) { $o = Db::one('SELECT name FROM users WHERE id = ?', [$withId]); if ($o) $with = $with ?: explode(' ', trim($o['name']))[0]; }
        $contact = null;
        if (!empty($b['contactId'])) { $c = Db::one('SELECT name FROM trusted_contacts WHERE id = ? AND user_id = ?', [(int) $b['contactId'], $u['id']]); $contact = $c['name'] ?? null; }
        $token = bin2hex(random_bytes(16));
        Db::run('INSERT INTO safety_sessions (user_id, with_user_id, with_name, place, note, token, contact_name, status, expected_end, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
            [$u['id'], $withId, $with ?: null, $place, mb_substr(trim((string) ($b['note'] ?? '')), 0, 300) ?: null, $token, $contact, 'active', gmdate('Y-m-d H:i:s', time() + $hours * 3600), Db::now()]);
        $id = (int) Db::lastId();
        if (!empty($b['lat'])) Db::run('INSERT INTO safety_pings (session_id, lat, lng, created_at) VALUES (?,?,?,?)', [$id, (float) $b['lat'], (float) $b['lng'], Db::now()]);
        Track::hit($u, 'safety', 'start');
        Http::json(['trip' => $this->shape(Db::one('SELECT * FROM safety_sessions WHERE id = ?', [$id]))], 201);
    }

    /**
     * POST /safety/ride { plate, vehicle, mode, routeId, from, to, minutes, contactId, lat, lng }
     * Boarding a vehicle: the same live trip, but carrying the plate and the journey, so whoever you share
     * with knows exactly which vehicle you entered and where you were going.
     */
    public function startRide(): void
    {
        $u = Auth::require(); RateLimit::hit('trip', 20, 86400);
        if (Db::one("SELECT id FROM safety_sessions WHERE user_id = ? AND status = 'active'", [$u['id']])) Http::json(['error' => 'active', 'message' => 'A trip is already running. End it first.'], 409);
        $b = Http::body();
        $plate = strtoupper(preg_replace('/[^A-Z0-9]/i', '', (string) ($b['plate'] ?? '')));
        $from = !empty($b['from']) ? Db::one('SELECT id, name FROM places WHERE id = ?', [(int) $b['from']]) : null;
        $to = !empty($b['to']) ? Db::one('SELECT id, name FROM places WHERE id = ?', [(int) $b['to']]) : null;
        $place = $to ? ('To ' . $to['name'] . ($from ? ' from ' . $from['name'] : '')) : mb_substr(trim((string) ($b['place'] ?? 'Journey')), 0, 120);
        $minutes = max(10, min(240, (int) ($b['minutes'] ?? 45)));
        $contact = null;
        if (!empty($b['contactId'])) { $c = Db::one('SELECT name FROM trusted_contacts WHERE id = ? AND user_id = ?', [(int) $b['contactId'], $u['id']]); $contact = $c['name'] ?? null; }
        $token = bin2hex(random_bytes(16));
        Db::run('INSERT INTO safety_sessions (user_id, place, note, token, contact_name, status, expected_end, created_at, kind, plate, vehicle, route_id, from_place, to_place, mode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [$u['id'], $place, mb_substr(trim((string) ($b['note'] ?? '')), 0, 300) ?: null, $token, $contact, 'active', gmdate('Y-m-d H:i:s', time() + ($minutes + 20) * 60), Db::now(), 'ride',
             $plate ?: null, mb_substr(trim((string) ($b['vehicle'] ?? '')), 0, 80) ?: null, !empty($b['routeId']) ? (int) $b['routeId'] : null, $from['id'] ?? null, $to['id'] ?? null, mb_substr((string) ($b['mode'] ?? ''), 0, 10) ?: null]);
        $id = (int) Db::lastId();
        if (!empty($b['lat'])) Db::run('INSERT INTO safety_pings (session_id, lat, lng, created_at) VALUES (?,?,?,?)', [$id, (float) $b['lat'], (float) $b['lng'], Db::now()]);
        Track::hit($u, 'safety', 'ride');
        Http::json(['trip' => $this->shape(Db::one('SELECT * FROM safety_sessions WHERE id = ?', [$id]))], 201);
    }

    /**
     * GET /safety/board?plate=&district=&hour= : everything worth knowing before entering a vehicle.
     * The plate's own history, and how often one-chance has been reported in this district.
     */
    public function board(): void
    {
        $u = Auth::require();
        $plate = strtoupper(preg_replace('/[^A-Z0-9]/i', '', (string) ($_GET['plate'] ?? '')));
        $district = trim((string) ($_GET['district'] ?? ($u['district'] ?? '')));
        $out = ['plate' => $plate, 'reports' => 0, 'items' => [], 'verdict' => 'No reports on Buja. That is not proof of safety; stay alert.'];
        if (strlen($plate) >= 5) {
            $st = Db::pdo()->prepare('SELECT what, vehicle, district, happened, hurt FROM plate_reports WHERE plate = ? AND hidden_at IS NULL ORDER BY happened DESC LIMIT 5'); $st->execute([$plate]);
            $rows = $st->fetchAll();
            $out['reports'] = count($rows);
            $out['items'] = array_map(fn($r) => ['what' => $r['what'], 'vehicle' => $r['vehicle'], 'district' => $r['district'], 'when' => $r['happened'], 'hurt' => (bool) $r['hurt']], $rows);
            $out['verdict'] = count($rows) === 0 ? $out['verdict'] : (count($rows) === 1 ? 'One report on this plate. Be careful.' : count($rows) . ' reports on this plate. Do not enter this vehicle.');
        }
        // District history: plates reported here, and live road alerts about robbery in this district.
        $year = gmdate('Y-m-d', time() - 365 * 86400);
        $out['district'] = $district;
        $out['districtReports'] = $district === '' ? 0 : (int) (Db::one('SELECT COUNT(*) AS n FROM plate_reports WHERE district = ? AND hidden_at IS NULL AND happened > ?', [$district, $year])['n'] ?? 0);
        $hour = (int) ($_GET['hour'] ?? (int) gmdate('G', time() + 3600));
        $out['night'] = $hour >= 18 || $hour < 6;
        $tips = ['Sit by the door and keep it unlocked if you can.', 'If the vehicle already has three or more passengers and they all stay quiet, step out.', 'Share this trip so someone knows the plate.', 'Never enter a vehicle that will not let you see the other passengers first.'];
        if ($out['night']) array_unshift($tips, 'It is dark. Board at a busy, lit park rather than a roadside.');
        if ($out['districtReports'] >= 2) array_unshift($tips, $out['districtReports'] . ' one-chance reports came from ' . $district . ' in the last year. Take extra care here.');
        $out['tips'] = array_slice($tips, 0, 4);
        Http::json($out);
    }

    /** POST /safety/ping { lat, lng } : the app sends this every couple of minutes while a trip runs */
    public function ping(): void
    {
        $u = Auth::require();
        $s = Db::one("SELECT * FROM safety_sessions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", [$u['id']]); if (!$s) Http::json(['active' => false]);
        $b = Http::body(); $lat = (float) ($b['lat'] ?? 0); $lng = (float) ($b['lng'] ?? 0);
        if ($lat && $lng) Db::run('INSERT INTO safety_pings (session_id, lat, lng, created_at) VALUES (?,?,?,?)', [$s['id'], $lat, $lng, Db::now()]);
        Http::json(['active' => true, 'trip' => $this->shape(Db::one('SELECT * FROM safety_sessions WHERE id = ?', [$s['id']]))]);
    }

    /** POST /safety/end { status: safe|alarm, hours } : end it, or raise the alarm, or add time */
    public function end(): void
    {
        $u = Auth::require();
        $s = Db::one("SELECT * FROM safety_sessions WHERE user_id = ? AND status = 'active' ORDER BY id DESC LIMIT 1", [$u['id']]); if (!$s) Http::json(['error' => 'not_found', 'message' => 'No trip is running.'], 404);
        $b = Http::body(); $what = (string) ($b['status'] ?? 'safe');
        if ($what === 'extend') { Db::run('UPDATE safety_sessions SET expected_end = ? WHERE id = ?', [gmdate('Y-m-d H:i:s', strtotime($s['expected_end'] . ' UTC') + max(1, min(6, (int) ($b['hours'] ?? 1))) * 3600), $s['id']]); Http::json(['trip' => $this->shape(Db::one('SELECT * FROM safety_sessions WHERE id = ?', [$s['id']]))]); }
        if (!in_array($what, ['safe', 'alarm'], true)) Http::json(['error' => 'validation'], 422);
        Db::run('UPDATE safety_sessions SET status = ?, ended_at = ? WHERE id = ?', [$what, Db::now(), $s['id']]);
        Track::hit($u, 'safety', $what);
        if ($what === 'alarm') Notify::user((int) $u['id'], 'match', 'Alarm raised on your trip', 'Your contact link now shows the alarm and your last position. Call someone you trust, and the police on 112 if you are in danger.', '/#/safety', true);
        Http::json(['trip' => $this->shape(Db::one('SELECT * FROM safety_sessions WHERE id = ?', [$s['id']]))]);
    }

    /** GET /safety/trip/{token} : the friend's view. No sign-in, link only, no personal details beyond a first name. */
    public function publicTrip(string $token): void
    {
        $s = Db::one('SELECT s.*, u.name FROM safety_sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?', [$token]);
        if (!$s) Http::json(['error' => 'not_found', 'message' => 'This link is not valid.'], 404);
        $t = $this->shape($s, true);
        $t['person'] = explode(' ', trim($s['name']))[0];
        unset($t['token'], $t['link'], $t['contact']);
        Http::json(['trip' => $t]);
    }
}

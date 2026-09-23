<?php
declare(strict_types=1);

/**
 * Public Buja. Real URLs that search engines can index, served as plain HTML by PHP: jobs, homes, places,
 * events and courses, with proper titles, descriptions and structured data, plus the landing page, the
 * sitemap and robots. Every page links into the app for the action (apply, message, register, enrol).
 * No phone numbers, no exact addresses, nothing a signed-out visitor should not see.
 */
date_default_timezone_set('Africa/Lagos');
error_reporting(E_ALL); ini_set('display_errors', '0');
spl_autoload_register(function (string $class): void {
    foreach ([__DIR__ . '/../api/src/', __DIR__ . '/../api/controllers/'] as $dir) { $f = $dir . $class . '.php'; if (is_file($f)) { require $f; return; } }
});
$config = require __DIR__ . '/../api/config.php';
Http::init($config);
set_exception_handler(function (Throwable $e): void { error_log('[buja public] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine()); http_response_code(500); echo 'Something went wrong.'; });

$origin = rtrim((string) Http::config('app_origin'), '/');
$path = (string) ($_GET['path'] ?? '');
if ($path === '') { $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/'; $path = trim(preg_replace('#^/p/?#', '', $uri), '/'); }
$seg = array_values(array_filter(explode('/', $path)));
$e = fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
$money = fn($n) => '₦' . number_format((int) $n);
$district = fn($s) => $s ? $e($s) . ', Abuja' : 'Abuja';

/* ---------- robots and sitemap ---------- */
if ($path === 'ads') { header('Content-Type: text/plain'); echo AdsController::adsTxt(); exit; }
if ($path === 'assetlinks') {
    header('Content-Type: application/json'); header('Cache-Control: public, max-age=3600');
    $pkg = trim((string) Http::config('android_package', '')); $fps = array_values(array_filter(array_map('trim', explode(',', (string) Http::config('android_sha256', '')))));
    echo json_encode($pkg && $fps ? [['relation' => ['delegate_permission/common.handle_all_urls'], 'target' => ['namespace' => 'android_app', 'package_name' => $pkg, 'sha256_cert_fingerprints' => $fps]]] : [], JSON_UNESCAPED_SLASHES); exit;
}
if ($path === 'robots') { header('Content-Type: text/plain'); echo "User-agent: *\nAllow: /p/\nDisallow: /api/\nSitemap: {$origin}/sitemap.xml\n"; exit; }
if ($path === 'sitemap') {
    header('Content-Type: application/xml; charset=utf-8');
    $urls = [['/p/', '1.0'], ['/p/jobs', '0.9'], ['/p/homes', '0.9'], ['/p/places', '0.8'], ['/p/events', '0.8'], ['/p/courses', '0.9']];
    foreach (Db::pdo()->query("SELECT id, updated_at FROM jobs WHERE status = 'open' ORDER BY id DESC LIMIT 2000") as $r) $urls[] = ['/p/jobs/' . (int) $r['id'], '0.7', $r['updated_at']];
    foreach (Db::pdo()->query("SELECT id, created_at FROM properties WHERE status = 'available' ORDER BY id DESC LIMIT 2000") as $r) $urls[] = ['/p/homes/' . (int) $r['id'], '0.7', $r['created_at']];
    foreach (Db::pdo()->query('SELECT id, created_at FROM spots WHERE active = 1 ORDER BY id DESC LIMIT 3000') as $r) $urls[] = ['/p/places/' . (int) $r['id'], '0.5', $r['created_at']];
    foreach (Db::pdo()->query("SELECT id, created_at FROM meetups WHERE status = 'live' AND hidden_at IS NULL AND starts_at > '" . gmdate('Y-m-d H:i:s', time() - 86400) . "' ORDER BY id DESC LIMIT 1000") as $r) $urls[] = ['/p/events/' . (int) $r['id'], '0.6', $r['created_at']];
    foreach (array_keys(Curriculum::all()) as $slug) $urls[] = ['/p/courses/' . $slug, '0.8'];
    echo '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
    foreach ($urls as $u) echo '<url><loc>' . $e($origin . $u[0]) . '</loc>' . (isset($u[2]) && $u[2] ? '<lastmod>' . substr((string) $u[2], 0, 10) . '</lastmod>' : '') . '<priority>' . $u[1] . '</priority></url>';
    echo '</urlset>'; exit;
}

/* ---------- page shell ---------- */
function page(string $title, string $description, string $body, array $opts = []): void
{
    global $origin, $e;
    $canon = $origin . '/p/' . ltrim((string) ($opts['path'] ?? ''), '/');
    $image = $opts['image'] ?? ($origin . '/assets/icons/icon-512.png');
    $jsonld = !empty($opts['jsonld']) ? '<script type="application/ld+json">' . json_encode($opts['jsonld'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . '</script>' : '';
    $app = $opts['app'] ?? '/#/welcome';
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<title>' . $e($title) . ' · Buja</title><meta name="description" content="' . $e($description) . '"><link rel="canonical" href="' . $e($canon) . '">'
        . '<meta property="og:title" content="' . $e($title) . '"><meta property="og:description" content="' . $e($description) . '"><meta property="og:image" content="' . $e($image) . '"><meta property="og:url" content="' . $e($canon) . '"><meta property="og:site_name" content="Buja"><meta name="twitter:card" content="summary_large_image">'
        . '<link rel="icon" href="/assets/icons/favicon.svg"><link rel="manifest" href="/manifest.webmanifest">' . $jsonld
        . '<style>:root{--ink:#1B1B1F;--ink2:#4A4A52;--muted:#6B6B73;--line:#E5E5DF;--bg:#F7F7F2;--card:#fff;--orange:#FF7A1A;--green:#7ED957;--night:#101014}*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--ink);line-height:1.55}a{color:inherit}.wrap{max-width:720px;margin:0 auto;padding:16px}header.top{display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--night);color:#fff}header.top a{color:#fff;text-decoration:none;font-weight:700}header.top nav{margin-left:auto;display:flex;gap:14px;font-size:14px}header.top nav a{opacity:.85;font-weight:500}.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;margin:12px 0}.card h3{margin:0 0 4px;font-size:17px}.muted{color:var(--muted);font-size:14px}.btn{display:inline-block;background:var(--orange);color:#fff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:12px;margin-top:8px}.btn.dark{background:var(--night)}.tag{display:inline-block;background:#FFF1E6;color:#C85A10;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700}h1{font-size:26px;line-height:1.2;margin:8px 0}h2{font-size:20px;margin:24px 0 8px}.grid{display:grid;grid-template-columns:1fr;gap:12px}@media(min-width:640px){.grid{grid-template-columns:1fr 1fr}}.hero{background:linear-gradient(135deg,#16161B,#0B0B0E);color:#fff;padding:40px 16px;text-align:center}.hero h1{font-size:34px;margin:12px 0}.hero p{color:#B5B5BC;max-width:520px;margin:0 auto 18px}footer{padding:24px 16px;color:var(--muted);font-size:13px;text-align:center}img.cover{width:100%;border-radius:12px;display:block}</style></head><body>'
        . '<header class="top"><a href="/p/"><img src="/assets/icons/mark-dark.svg" alt="" width="26" height="26" style="vertical-align:middle;margin-right:6px">Buja</a><nav><a href="/p/jobs">Jobs</a><a href="/p/homes">Homes</a><a href="/p/places">Places</a><a href="/p/events">Events</a><a href="/p/courses">Learn</a></nav></header>'
        . $body
        . '<footer>Buja is for residents of Abuja and the FCT. <a href="' . $e($app) . '">Open the app</a> · <a href="/#/terms">Terms</a> · <a href="/#/privacy">Privacy</a></footer></body></html>';
    exit;
}
function notFound(): void { http_response_code(404); page('Not found', 'That page does not exist.', '<div class="wrap"><h1>Not found</h1><p class="muted">That listing may have been taken down.</p><a class="btn dark" href="/p/">Back to Buja</a></div>'); }

$kind = $seg[0] ?? ''; $id = $seg[1] ?? null;

/* ---------- landing ---------- */
if ($kind === '') {
    $jobs = (int) (Db::one("SELECT COUNT(*) AS n FROM jobs WHERE status = 'open'")['n'] ?? 0); $homes = (int) (Db::one("SELECT COUNT(*) AS n FROM properties WHERE status = 'available'")['n'] ?? 0); $places = (int) (Db::one('SELECT COUNT(*) AS n FROM spots WHERE active = 1')['n'] ?? 0); $users = (int) (Db::one('SELECT COUNT(*) AS n FROM users WHERE deleted_at IS NULL')['n'] ?? 0);
    $body = '<section class="hero"><img src="/assets/icons/icon-192.png" alt="" width="72" height="72" style="border-radius:20px"><h1>Jobs, homes, people and movement across Abuja</h1><p>One free app for the FCT: find work, rent direct from landlords, get around without guessing the fare, learn to code, and know what the city knows right now.</p><a class="btn" href="/#/welcome">Open Buja, free</a></section>'
        . '<div class="wrap"><div class="grid">'
        . '<a class="card" href="/p/jobs" style="text-decoration:none"><h3>Work</h3><p class="muted">' . $jobs . ' open jobs across the FCT, with pay shown. Companies interview inside the app.</p></a>'
        . '<a class="card" href="/p/homes" style="text-decoration:none"><h3>Homes</h3><p class="muted">' . $homes . ' homes direct from landlords. No agent fee, inspections booked in the app.</p></a>'
        . '<a class="card" href="/p/places" style="text-decoration:none"><h3>Places</h3><p class="muted">' . $places . ' places to eat, relax, shop and pray, rated by residents.</p></a>'
        . '<a class="card" href="/p/events" style="text-decoration:none"><h3>Events</h3><p class="muted">Meetups, launches and hangouts happening in Abuja. Register in one tap.</p></a>'
        . '<a class="card" href="/p/courses" style="text-decoration:none"><h3>Buja Learn</h3><p class="muted">Free interactive courses in web development and AI, with a certificate anyone can verify.</p></a>'
        . '<div class="card"><h3>And in the app</h3><p class="muted">Bus and keke fares and routes, live road alerts, Light Watch, fuel prices, artisans near you, blood donors, lost and found, market prices, and the right agency to report anything to.</p><a class="btn dark" href="/#/welcome">Join ' . ($users ? number_format($users) . ' residents' : 'Buja') . '</a></div>'
        . '</div></div>';
    page('Buja, the Abuja super-app', 'Jobs, homes, places, events, transport and free courses for residents of Abuja and the FCT. Free, made in Abuja.', $body, ['path' => '', 'app' => '/#/welcome', 'jsonld' => ['@context' => 'https://schema.org', '@type' => 'WebSite', 'name' => 'Buja', 'url' => $origin . '/p/', 'description' => 'The Abuja super-app']]);
}

/* ---------- jobs ---------- */
if ($kind === 'jobs') {
    if ($id === null) {
        $rows = Db::pdo()->query("SELECT j.id, j.title, j.district, j.type, j.salary_min, j.salary_max, c.name AS company FROM jobs j JOIN companies c ON c.id = j.company_id WHERE j.status = 'open' ORDER BY j.id DESC LIMIT 100")->fetchAll();
        $body = '<div class="wrap"><h1>Jobs in Abuja</h1><p class="muted">' . count($rows) . ' open roles, pay shown, from companies on Buja.</p>' . implode('', array_map(fn($r) => '<a class="card" href="/p/jobs/' . (int) $r['id'] . '" style="text-decoration:none;display:block"><h3>' . $e($r['title']) . '</h3><div class="muted">' . $e($r['company']) . ' · ' . $district($r['district']) . ' · ' . $e(str_replace('_', ' ', (string) $r['type'])) . ((int) $r['salary_min'] ? ' · ' . $money($r['salary_min']) . ((int) $r['salary_max'] ? ' to ' . $money($r['salary_max']) : '+') : '') . '</div></a>', $rows)) . '</div>';
        page('Jobs in Abuja', 'Open jobs across Abuja and the FCT with pay shown. Apply in the Buja app.', $body, ['path' => 'jobs', 'app' => '/#/work']);
    }
    $j = Db::one("SELECT j.*, c.name AS company, c.about AS company_about FROM jobs j JOIN companies c ON c.id = j.company_id WHERE j.id = ? AND j.status = 'open'", [(int) $id]); if (!$j) notFound();
    $pay = (int) $j['salary_min'] ? $money($j['salary_min']) . ((int) $j['salary_max'] ? ' to ' . $money($j['salary_max']) : '+') . ' per month' : 'Pay not stated';
    $ld = ['@context' => 'https://schema.org', '@type' => 'JobPosting', 'title' => $j['title'], 'description' => strip_tags((string) $j['description']), 'datePosted' => substr((string) $j['created_at'], 0, 10), 'employmentType' => strtoupper(str_replace('-', '_', (string) $j['type'])), 'hiringOrganization' => ['@type' => 'Organization', 'name' => $j['company']], 'jobLocation' => ['@type' => 'Place', 'address' => ['@type' => 'PostalAddress', 'addressLocality' => $j['district'] ?: 'Abuja', 'addressRegion' => 'FCT', 'addressCountry' => 'NG']]];
    if ((int) $j['salary_min']) $ld['baseSalary'] = ['@type' => 'MonetaryAmount', 'currency' => 'NGN', 'value' => ['@type' => 'QuantitativeValue', 'minValue' => (int) $j['salary_min'], 'maxValue' => (int) $j['salary_max'] ?: (int) $j['salary_min'], 'unitText' => 'MONTH']];
    if ($j['deadline']) $ld['validThrough'] = substr((string) $j['deadline'], 0, 10);
    $body = '<div class="wrap"><span class="tag">' . $e(str_replace('_', ' ', (string) $j['type'])) . '</span><h1>' . $e($j['title']) . '</h1><div class="muted">' . $e($j['company']) . ' · ' . $district($j['district']) . ' · ' . $e($pay) . '</div><a class="btn" href="/#/work/job/' . (int) $j['id'] . '">Apply on Buja</a>'
        . '<div class="card"><h3>About the role</h3><p style="white-space:pre-line">' . $e($j['description']) . '</p></div>' . ($j['company_about'] ? '<div class="card"><h3>About ' . $e($j['company']) . '</h3><p>' . $e($j['company_about']) . '</p></div>' : '') . '<p class="muted">Posted ' . $e(substr((string) $j['created_at'], 0, 10)) . ($j['deadline'] ? ' · closes ' . $e(substr((string) $j['deadline'], 0, 10)) : '') . '. Companies on Buja interview by video inside the app.</p></div>';
    page($j['title'] . ' at ' . $j['company'], mb_substr(strip_tags((string) $j['description']), 0, 155), $body, ['path' => 'jobs/' . (int) $j['id'], 'app' => '/#/work/job/' . (int) $j['id'], 'jsonld' => $ld]);
}

/* ---------- homes ---------- */
if ($kind === 'homes') {
    if ($id === null) {
        $rows = Db::pdo()->query("SELECT id, title, district, kind, type, price, beds, baths FROM properties WHERE status = 'available' ORDER BY id DESC LIMIT 100")->fetchAll();
        $idx = Db::pdo()->query("SELECT district, beds, COUNT(*) AS n, AVG(price) AS avg FROM properties WHERE status = 'available' AND kind = 'rent' AND price > 0 GROUP BY district, beds HAVING n >= 1 ORDER BY district, beds")->fetchAll();
        $body = '<div class="wrap"><h1>Homes to rent and buy in Abuja</h1><p class="muted">Direct from landlords, no agent fee. Inspections booked in the app.</p>'
            . ($idx ? '<div class="card"><h3>Asking rent by district</h3><p class="muted">What landlords are asking on Buja right now, per year. Not a valuation.</p><table style="width:100%;font-size:14px;border-collapse:collapse">' . implode('', array_map(fn($r) => '<tr><td style="padding:4px 0">' . $e($r['district']) . '</td><td>' . (int) $r['beds'] . ' bed</td><td style="text-align:right;font-weight:700">' . $money(round((float) $r['avg'])) . '</td><td style="text-align:right" class="muted">' . (int) $r['n'] . '</td></tr>', array_slice($idx, 0, 30))) . '</table></div>' : '')
            . implode('', array_map(fn($r) => '<a class="card" href="/p/homes/' . (int) $r['id'] . '" style="text-decoration:none;display:block"><h3>' . $e($r['title']) . '</h3><div class="muted">' . $district($r['district']) . ' · ' . (int) $r['beds'] . ' bed, ' . (int) $r['baths'] . ' bath · ' . $money($r['price']) . ($r['kind'] === 'rent' ? ' per year' : '') . '</div></a>', $rows)) . '</div>';
        page('Homes to rent in Abuja, direct from landlords', 'Flats, houses and rooms across Abuja and the FCT, direct from landlords with no agent fee, plus the asking rent by district.', $body, ['path' => 'homes', 'app' => '/#/homes']);
    }
    $p = Db::one("SELECT * FROM properties WHERE id = ? AND status = 'available'", [(int) $id]); if (!$p) notFound();
    $photo = Db::one('SELECT id FROM property_photos WHERE property_id = ? ORDER BY position, id LIMIT 1', [$p['id']]);
    $img = $photo ? $origin . '/api/homes/photo/' . (int) $photo['id'] : null;
    $body = '<div class="wrap"><span class="tag">' . ($p['kind'] === 'rent' ? 'To rent' : 'For sale') . '</span><h1>' . $e($p['title']) . '</h1><div class="muted">' . $district($p['district']) . ' · ' . (int) $p['beds'] . ' bed, ' . (int) $p['baths'] . ' bath · ' . $e(str_replace('_', ' ', (string) $p['type'])) . '</div><div style="font-size:24px;font-weight:800;margin:8px 0">' . $money($p['price']) . ($p['kind'] === 'rent' ? ' <span class="muted" style="font-size:14px;font-weight:400">per year</span>' : '') . '</div>' . ($img ? '<img class="cover" src="' . $e($img) . '" alt="">' : '') . '<a class="btn" href="/#/homes/' . (int) $p['id'] . '">Book an inspection on Buja</a><div class="card"><p style="white-space:pre-line">' . $e($p['description']) . '</p></div><p class="muted">The landlord\'s contact is shown inside the app to signed-in residents, and every landlord is rated by people who dealt with them.</p></div>';
    page($p['title'] . ', ' . ($p['district'] ?: 'Abuja'), (int) $p['beds'] . ' bedroom ' . str_replace('_', ' ', (string) $p['type']) . ' in ' . ($p['district'] ?: 'Abuja') . ', ' . $money($p['price']) . ($p['kind'] === 'rent' ? ' per year' : '') . ', direct from the landlord on Buja.', $body, ['path' => 'homes/' . (int) $p['id'], 'app' => '/#/homes/' . (int) $p['id'], 'image' => $img ?? $origin . '/assets/icons/icon-512.png', 'jsonld' => ['@context' => 'https://schema.org', '@type' => 'Residence', 'name' => $p['title'], 'numberOfRooms' => (int) $p['beds'], 'address' => ['@type' => 'PostalAddress', 'addressLocality' => $p['district'] ?: 'Abuja', 'addressRegion' => 'FCT', 'addressCountry' => 'NG']]]);
}

/* ---------- places ---------- */
if ($kind === 'places') {
    if ($id === null) {
        $rows = Db::pdo()->query('SELECT s.id, s.name, s.category, s.district, (SELECT AVG(stars) FROM spot_ratings r WHERE r.spot_id = s.id) AS rating_avg, (SELECT COUNT(*) FROM spot_ratings r WHERE r.spot_id = s.id) AS rating_count FROM spots s WHERE s.active = 1 ORDER BY rating_count DESC, s.id DESC LIMIT 150')->fetchAll();
        $body = '<div class="wrap"><h1>Places in Abuja</h1><p class="muted">Restaurants, lounges, parks, markets, hotels and more, rated by residents. Ask Buja anything about them in the app.</p>' . implode('', array_map(fn($r) => '<a class="card" href="/p/places/' . (int) $r['id'] . '" style="text-decoration:none;display:block"><h3>' . $e($r['name']) . '</h3><div class="muted">' . $e(ucfirst((string) $r['category'])) . ' · ' . $district($r['district']) . ((int) $r['rating_count'] ? ' · ★ ' . number_format((float) $r['rating_avg'], 1) . ' (' . (int) $r['rating_count'] . ')' : '') . '</div></a>', $rows)) . '</div>';
        page('Places to eat, relax and shop in Abuja', 'Restaurants, lounges, parks, markets and hotels across Abuja, rated by residents on Buja.', $body, ['path' => 'places', 'app' => '/#/ask']);
    }
    $s = Db::one('SELECT s.*, (SELECT AVG(stars) FROM spot_ratings r WHERE r.spot_id = s.id) AS rating_avg, (SELECT COUNT(*) FROM spot_ratings r WHERE r.spot_id = s.id) AS rating_count FROM spots s WHERE s.id = ? AND s.active = 1', [(int) $id]); if (!$s) notFound();
    $photo = Db::one('SELECT upload_id FROM spot_photos WHERE spot_id = ? AND hidden_at IS NULL ORDER BY id LIMIT 1', [$s['id']]);
    $img = $photo ? $origin . '/api/uploads/' . (int) $photo['upload_id'] : null;
    $ld = ['@context' => 'https://schema.org', '@type' => 'LocalBusiness', 'name' => $s['name'], 'address' => ['@type' => 'PostalAddress', 'addressLocality' => $s['district'] ?: 'Abuja', 'addressRegion' => 'FCT', 'addressCountry' => 'NG']];
    if ($s['lat'] !== null) $ld['geo'] = ['@type' => 'GeoCoordinates', 'latitude' => (float) $s['lat'], 'longitude' => (float) $s['lng']];
    if ((int) $s['rating_count']) $ld['aggregateRating'] = ['@type' => 'AggregateRating', 'ratingValue' => round((float) $s['rating_avg'], 1), 'ratingCount' => (int) $s['rating_count']];
    $body = '<div class="wrap"><span class="tag">' . $e(ucfirst((string) $s['category'])) . '</span><h1>' . $e($s['name']) . '</h1><div class="muted">' . $district($s['district']) . ($s['area'] ? ' · ' . $e($s['area']) : '') . ((int) $s['rating_count'] ? ' · ★ ' . number_format((float) $s['rating_avg'], 1) . ' from ' . (int) $s['rating_count'] . ' residents' : '') . '</div>' . ($img ? '<img class="cover" src="' . $e($img) . '" alt="">' : '') . '<div class="card"><p>' . $e($s['description']) . '</p>' . ($s['hours'] ? '<p class="muted">Hours: ' . $e($s['hours']) . '</p>' : '') . '</div>' . ($s['lat'] !== null ? '<a class="btn dark" href="https://www.google.com/maps?q=' . (float) $s['lat'] . ',' . (float) $s['lng'] . '">Open in maps</a> ' : '') . '<a class="btn" href="/#/ask/place/' . (int) $s['id'] . '">Rate it on Buja</a></div>';
    page($s['name'] . ', ' . ($s['district'] ?: 'Abuja'), mb_substr((string) $s['description'], 0, 155), $body, ['path' => 'places/' . (int) $s['id'], 'app' => '/#/ask/place/' . (int) $s['id'], 'image' => $img ?? $origin . '/assets/icons/icon-512.png', 'jsonld' => $ld]);
}

/* ---------- events ---------- */
if ($kind === 'events') {
    $when = fn($s) => date('D j M Y, H:i', strtotime($s . ' UTC'));
    if ($id === null) {
        $rows = Db::pdo()->query("SELECT id, title, category, starts_at, venue, district, price, going FROM meetups WHERE status = 'live' AND hidden_at IS NULL AND starts_at > '" . gmdate('Y-m-d H:i:s', time() - 3 * 3600) . "' ORDER BY starts_at LIMIT 100")->fetchAll();
        $body = '<div class="wrap"><h1>Events in Abuja</h1><p class="muted">Meetups, launches, concerts and hangouts. Register in one tap in the app.</p>' . implode('', array_map(fn($r) => '<a class="card" href="/p/events/' . (int) $r['id'] . '" style="text-decoration:none;display:block"><h3>' . $e($r['title']) . '</h3><div class="muted">' . $e($when($r['starts_at'])) . ' · ' . $e($r['venue']) . ', ' . $e($r['district']) . ' · ' . ((int) $r['price'] ? $money($r['price']) : 'Free') . ' · ' . (int) $r['going'] . ' going</div></a>', $rows)) . '</div>';
        page('Events in Abuja this week', 'Meetups, launches, concerts and hangouts happening in Abuja. Register free on Buja.', $body, ['path' => 'events', 'app' => '/#/meetup']);
    }
    $m = Db::one("SELECT m.*, u.name AS host FROM meetups m JOIN users u ON u.id = m.host_id WHERE m.id = ? AND m.status = 'live' AND m.hidden_at IS NULL", [(int) $id]); if (!$m) notFound();
    $img = $m['cover_upload'] ? $origin . '/api/uploads/' . (int) $m['cover_upload'] : null;
    $ld = ['@context' => 'https://schema.org', '@type' => 'Event', 'name' => $m['title'], 'startDate' => date('c', strtotime($m['starts_at'] . ' UTC')), 'description' => mb_substr((string) $m['description'], 0, 500), 'eventAttendanceMode' => $m['online_url'] ? 'https://schema.org/OnlineEventAttendanceMode' : 'https://schema.org/OfflineEventAttendanceMode', 'location' => ['@type' => 'Place', 'name' => $m['venue'], 'address' => ['@type' => 'PostalAddress', 'addressLocality' => $m['district'], 'addressRegion' => 'FCT', 'addressCountry' => 'NG']], 'organizer' => ['@type' => 'Person', 'name' => explode(' ', trim((string) $m['host']))[0]], 'offers' => ['@type' => 'Offer', 'price' => (int) $m['price'], 'priceCurrency' => 'NGN', 'url' => $origin . '/#/meetup/' . (int) $m['id']]];
    if ($m['ends_at']) $ld['endDate'] = date('c', strtotime($m['ends_at'] . ' UTC'));
    if ($img) $ld['image'] = $img;
    $body = '<div class="wrap"><span class="tag">' . $e(MeetupController::CATS[$m['category']] ?? $m['category']) . '</span><h1>' . $e($m['title']) . '</h1><div class="muted">' . $e($when($m['starts_at'])) . ' · ' . $e($m['venue']) . ', ' . $e($m['district']) . '</div><div style="font-size:20px;font-weight:800;margin:8px 0">' . ((int) $m['price'] ? $money($m['price']) : 'Free') . ' <span class="muted" style="font-size:14px;font-weight:400">· ' . (int) $m['going'] . ' going' . ($m['capacity'] ? ' of ' . (int) $m['capacity'] : '') . '</span></div>' . ($img ? '<img class="cover" src="' . $e($img) . '" alt="">' : '') . '<a class="btn" href="/#/meetup/' . (int) $m['id'] . '">' . ((int) $m['price'] ? 'Buy a ticket on Buja' : 'Register free on Buja') . '</a><div class="card"><p style="white-space:pre-line">' . $e($m['description']) . '</p></div><p class="muted">Hosted by ' . $e(explode(' ', trim((string) $m['host']))[0]) . ' on Buja.</p></div>';
    page($m['title'], $when($m['starts_at']) . ' at ' . $m['venue'] . ', ' . $m['district'] . '. ' . mb_substr((string) $m['description'], 0, 110), $body, ['path' => 'events/' . (int) $m['id'], 'app' => '/#/meetup/' . (int) $m['id'], 'image' => $img ?? $origin . '/assets/icons/icon-512.png', 'jsonld' => $ld]);
}

/* ---------- courses ---------- */
if ($kind === 'courses') {
    $all = Curriculum::all();
    if ($id === null) {
        $body = '<div class="wrap"><h1>Buja Learn: free courses with a verifiable certificate</h1><p class="muted">Frontend, backend, full-stack, prompt engineering and AI, from beginner to advanced. Write real code on your phone, pass the tests, earn a certificate with a QR code anyone can check.</p>' . implode('', array_map(fn($slug, $c) => '<a class="card" href="/p/courses/' . $slug . '" style="text-decoration:none;display:block"><img class="cover" src="/assets/learn/' . $slug . (is_file(__DIR__ . '/../assets/learn/' . $slug . '.jpg') ? '.jpg' : '.svg') . '" alt="" style="margin-bottom:10px"><h3>' . $e($c['title']) . '</h3><div class="muted">' . $e($c['level']) . ' · ' . count($c['lessons']) . ' lessons · about ' . (int) $c['hours'] . ' hours</div></a>', array_keys($all), $all)) . '</div>';
        page('Free coding and AI courses in Abuja', 'Free interactive courses in frontend, backend, full-stack, prompt engineering and AI, beginner to advanced, with a verifiable certificate. Built in Abuja.', $body, ['path' => 'courses', 'app' => '/#/learn']);
    }
    $c = $all[$id] ?? null; if (!$c) notFound();
    $img = '/assets/learn/' . $id . (is_file(__DIR__ . '/../assets/learn/' . $id . '.jpg') ? '.jpg' : '.svg');
    $ld = ['@context' => 'https://schema.org', '@type' => 'Course', 'name' => $c['title'], 'description' => $c['blurb'], 'provider' => ['@type' => 'Organization', 'name' => 'Buja Learn', 'url' => $origin . '/p/courses'], 'educationalLevel' => $c['level'], 'hasCourseInstance' => ['@type' => 'CourseInstance', 'courseMode' => 'online', 'courseWorkload' => 'PT' . (int) $c['hours'] . 'H'], 'offers' => ['@type' => 'Offer', 'price' => 0, 'priceCurrency' => 'NGN']];
    $body = '<div class="wrap"><span class="tag">' . $e($c['level']) . '</span><h1>' . $e($c['title']) . '</h1><div class="muted">' . count($c['lessons']) . ' lessons · about ' . (int) $c['hours'] . ' hours · free · certificate on completion</div><img class="cover" src="' . $e($origin . $img) . '" alt="" style="margin:12px 0"><p>' . $e($c['blurb']) . '</p><a class="btn" href="/#/learn/' . $e($id) . '">Start free on Buja</a><div class="card"><h3>You will be able to</h3><ul>' . implode('', array_map(fn($o) => '<li>' . $e($o) . '</li>', $c['outcomes'])) . '</ul></div><div class="card"><h3>Lessons</h3><ol>' . implode('', array_map(fn($l) => '<li>' . $e($l['title']) . ' <span class="muted">· ' . (int) $l['minutes'] . ' min</span></li>', $c['lessons'])) . '</ol></div>' . (!empty($c['after']) ? '<p class="muted">Requires the ' . $e($all[$c['after']]['title'] ?? '') . ' certificate first.</p>' : '') . '</div>';
    page($c['title'] . ', a free course', $c['blurb'], $body, ['path' => 'courses/' . $id, 'app' => '/#/learn/' . $id, 'image' => $origin . $img, 'jsonld' => $ld]);
}

/* ---------- Recruiting mechanics: the page, the link on the flyer, and the printable flyer ---------- */
if ($kind === 'join') {
    // /p/join/mechanic?src=apo : where the flyer's QR code lands. Straight into registration, remembering which flyer.
    $trade = preg_replace('/[^a-z]/', '', (string) ($id ?? 'mechanic')) ?: 'mechanic';
    $src = preg_replace('/[^a-z0-9_-]/', '', strtolower((string) ($_GET['src'] ?? ''))) ?: 'web';
    try { Db::run("INSERT INTO events (user_id, module, action, created_at) VALUES (NULL, 'recruit', ?, ?)", ['scan:' . $src, Db::now()]); } catch (Throwable $ex) {}
    header('Location: /#/artisans/register?trade=' . rawurlencode($trade) . '&src=' . rawurlencode($src), true, 302); exit;
}
if ($kind === 'mechanics' && $id === 'flyer') {
    // Printable flyer. ?src= tags which village it is for; ?copies=2 prints two to a page to cut in half.
    $src = preg_replace('/[^a-z0-9_-]/', '', strtolower((string) ($_GET['src'] ?? 'apo'))) ?: 'apo';
    $place = ['apo' => 'Apo Mechanic Village', 'kugbo' => 'Kugbo Mechanic Village'][$src] ?? ucfirst($src);
    $copies = max(1, min(4, (int) ($_GET['copies'] ?? 1)));
    $url = $origin . '/p/join/mechanic?src=' . rawurlencode($src);
    $one = '<section class="fl"><div class="top"><img src="/assets/icons/icon-192.png" alt=""><div><b>Buja</b><span>Mechanic near me</span></div></div>
      <h1>Customers whose car don spoil <em>near you</em>, straight to your phone.</h1>
      <p class="lead">When a car breaks down in Abuja, Buja alerts the nearest mechanics. First to accept gets the job. Free to join, no commission.</p>
      <div class="mid"><div class="qr" data-url="' . $e($url) . '"></div><ol><li><b>Scan</b> this with your phone camera</li><li><b>Register</b>: your name, a photo of your face, your workshop pin</li><li><b>Keep Buja open</b>: it rings when a breakdown is near</li></ol></div>
' . ($copies === 1 ? '<div class="why"><div><b>You set the price</b><span>Send your price in the app. The customer accepts before you start.</span></div><div><b>Good work rises</b><span>Answer fast, get good ratings, and you are alerted first.</span></div><div><b>Your hours</b><span>Switch off when you are busy. Choose how far you travel.</span></div></div><div class="free">FREE TO JOIN · NO COMMISSION</div>' : '') . '
      <div class="foot"><span>Bring: your phone and a clear face photo. Five minutes.</span><span class="where">' . $e($place) . '</span></div>
      <div class="url">' . $e(preg_replace('#^https?://#', '', $url)) . '</div></section>';
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Buja mechanic flyer, ' . $e($place) . '</title><meta name="robots" content="noindex">
    <style>@page{size:A4;margin:10mm}*{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,Segoe UI,Roboto,sans-serif;color:#1B1B1F;background:#eee}
    .sheet{max-width:190mm;margin:0 auto;background:#fff}.fl{border:2px dashed #ccc;padding:9mm;margin:0 0 6mm;page-break-inside:avoid;' . ($copies > 1 ? 'min-height:128mm' : 'min-height:270mm') . '}
    .top{display:flex;align-items:center;gap:10px}.top img{width:46px;height:46px;border-radius:12px}.top b{display:block;font-size:22px}.top span{color:#D92D20;font-weight:700;font-size:13px;letter-spacing:.5px;text-transform:uppercase}
    h1{font-size:' . ($copies > 1 ? '24px' : '40px') . ';line-height:1.15;margin:14px 0 8px}h1 em{font-style:normal;color:#D92D20}.lead{font-size:' . ($copies > 1 ? '13px' : '16px') . ';color:#4A4A52;margin:0 0 12px;line-height:1.5}
    .mid{display:flex;gap:18px;align-items:center}.qr{flex-shrink:0;padding:8px;border:3px solid #101014;border-radius:12px;background:#fff}.qr img,.qr canvas{display:block}
    ol{margin:0;padding-left:20px;font-size:' . ($copies > 1 ? '13px' : '16px') . ';line-height:1.6}.foot{display:flex;justify-content:space-between;gap:10px;margin-top:12px;font-size:12px;color:#4A4A52}
    .where{font-weight:800;color:#101014}.why{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:18px}.why div{background:#FFF4EC;border-radius:12px;padding:12px}.why b{display:block;font-size:15px;margin-bottom:4px}.why span{font-size:13px;color:#4A4A52;line-height:1.45}
    .free{margin-top:16px;background:#D92D20;color:#fff;text-align:center;font-weight:900;font-size:22px;letter-spacing:1px;padding:14px;border-radius:12px}.url{margin-top:6px;font:600 11px ui-monospace,Menlo,monospace;color:#6B6B73}
    .bar{max-width:190mm;margin:0 auto 10px;padding:12px;display:flex;gap:10px;align-items:center;font-size:14px}.bar button{background:#FF7A1A;color:#fff;border:none;border-radius:10px;padding:10px 16px;font-weight:700;font-size:14px;cursor:pointer}
    @media print{body{background:#fff}.bar{display:none}.fl{border-color:#ddd}}</style></head><body>
    <div class="bar"><button onclick="print()">Print</button><span>' . $e($place) . ' · ' . ($copies > 1 ? $copies . ' flyers a page, cut along the dashes' : 'one flyer a page') . ' · <a href="?src=' . $e($src) . '&copies=' . ($copies > 1 ? 1 : 2) . '">' . ($copies > 1 ? 'one big flyer' : 'two to a page') . '</a></span></div>
    <div class="sheet">' . str_repeat($one, $copies) . '</div>
    <script src="/js/vendor/qrcode.js"></script><script>document.querySelectorAll(".qr").forEach(function(el){var q=qrcode(0,"M");q.addData(el.dataset.url);q.make();el.innerHTML=q.createImgTag(' . ($copies > 1 ? '4' : '9') . ',0);});</script></body></html>';
    exit;
}
if ($kind === 'mechanics') {
    $n = (int) (Db::one("SELECT COUNT(*) AS n FROM artisans WHERE trade = 'mechanic' AND hidden_at IS NULL")['n'] ?? 0);
    $body = '<section class="hero"><img src="/assets/icons/icon-192.png" alt="" width="72" height="72" style="border-radius:20px"><h1>Mechanics: get customers whose car has broken down near you</h1><p>Buja alerts the nearest mechanics when a car stops in Abuja. First to accept gets the job. Free to join. No commission on your work.</p><a class="btn" href="/p/join/mechanic?src=web">Join as a mechanic</a></section>
    <div class="wrap"><div class="grid">
      <div class="card"><h3>How jobs reach you</h3><p class="muted">A driver pins where their car stopped and says what is wrong. Your phone rings with the distance and the problem. Accept, and you see their exact spot and phone number.</p></div>
      <div class="card"><h3>You set the price</h3><p class="muted">Look at the car, send your price in the app, and the customer accepts before you start. No arguments afterwards.</p></div>
      <div class="card"><h3>Good work rises</h3><p class="muted">Mechanics who answer quickly and get good ratings are alerted first. Every finished job builds your rating for the next customer.</p></div>
      <div class="card"><h3>Your hours, your area</h3><p class="muted">Choose how far you travel and when you work. Switch off when you are busy and you will not be disturbed.</p></div>
    </div>
    <div class="card"><h3>What you need</h3><ul><li>A smartphone with data</li><li>A clear photo of your face (customers want to know who is coming)</li><li>Your workshop location</li><li>Optional: an ID photo for the Verified badge</li></ul><a class="btn" href="/p/join/mechanic?src=web">Join now, five minutes</a></div>
    <p class="muted">' . ($n ? $n . ' mechanics are already on Buja. ' : '') . 'Recruiting at a mechanic village? Print a flyer: <a href="/p/mechanics/flyer?src=apo">Apo</a> · <a href="/p/mechanics/flyer?src=kugbo">Kugbo</a> · <a href="/p/mechanics/flyer?src=apo&copies=2">two to a page</a>.</p></div>';
    page('Mechanics in Abuja: get customers near you', 'Buja alerts the nearest mechanics when a car breaks down in Abuja. Free to join, no commission. First to accept gets the job.', $body, ['path' => 'mechanics', 'app' => '/#/artisans/register?trade=mechanic']);
}

/* ---------- What the app stores require: privacy policy and a public account deletion page ---------- */
if ($kind === 'privacy') {
    $body = '<div class="wrap"><h1>Privacy policy</h1><p class="muted">Last updated 23 September 2026. Buja is operated in Abuja, Nigeria, for residents of the FCT.</p>
    <div class="card"><h3>What Buja collects</h3><ul>
      <li><b>Account:</b> name, email or phone, password (stored only as a hash), district, profile photo if you add one.</li>
      <li><b>Location:</b> only when you use a feature that needs it (Waka, a breakdown request, Trip Share, Light Watch, nearby lists). During an active job or shared trip, your position is sent every few seconds and deleted when it ends.</li>
      <li><b>What you post:</b> jobs, homes, items for sale, Social posts and photos, reviews, reports, messages you send to other people.</li>
      <li><b>Mechanics and other artisans:</b> business name, trade, phone and WhatsApp, workshop location, face photo, and an ID photo if you choose to send one; ID photos are seen only by Buja administrators.</li>
      <li><b>Device:</b> a push notification token if you switch notifications on; basic usage events (which screens are opened) to improve the app.</li></ul></div>
    <div class="card"><h3>How it is used</h3><p class="muted">To run the features you use: connecting customers with nearby mechanics, showing fares and routes, delivering messages and notifications, and keeping people safe (reports, moderation). Buja does not sell personal data.</p></div>
    <div class="card"><h3>Who sees what</h3><p class="muted">Public listings (jobs, homes, items, Social posts, artisan profiles) are visible to others. Your exact location is shown to a mechanic only after they accept your request. Phone numbers are shared only between people in an accepted job or a conversation.</p></div>
    <div class="card"><h3>Services Buja uses</h3><p class="muted">Hosting (Render), database (TiDB Cloud), email (Brevo), maps (OpenFreeMap, OpenStreetMap data), routing (OSRM or OpenRouteService), payments (Paystack), AI answers (Google Gemini), and, where shown, advertising (Google AdSense), which may use cookies to show relevant ads.</p></div>
    <div class="card"><h3>Your choices</h3><p class="muted">Switch any kind of notification off in Settings. Location is only used when you allow it. You can delete your account at any time in the app (Me, Settings, Delete my account) or <a href="/p/delete-account">on this page</a>.</p></div>
    <div class="card"><h3>Contact</h3><p class="muted">' . $e((string) Http::config('mail_from', 'the email address in the app')) . '</p></div></div>';
    page('Privacy policy', 'How Buja collects and uses personal data, and how to delete your account.', $body, ['path' => 'privacy']);
}
if ($kind === 'delete-account') {
    $body = '<div class="wrap"><h1>Delete your Buja account</h1>
    <div class="card"><h3>In the app, straight away</h3><p class="muted">Open Buja, go to <b>Me</b>, then <b>Settings</b>, then <b>Delete my account</b>, and type DELETE to confirm. You are signed out everywhere at once.</p></div>
    <div class="card"><h3>What is deleted</h3><ul><li>Your name, email, phone and profile photo are removed</li><li>Your listings, Social posts and artisan profile are taken down</li><li>Notification devices, trusted contacts and saved sign-in keys are deleted</li></ul>
      <p class="muted">Messages you already sent stay in the other person\'s chat, shown as from "Deleted user". Records we must keep for payments or fraud prevention are kept for as long as the law requires, then deleted.</p></div>
    <div class="card"><h3>Cannot open the app?</h3><p class="muted">Ask here with the email on your account. We delete it within 30 days and may email you first to confirm it is you.</p>
      <form id="dr"><input type="email" id="em" required placeholder="you@example.com" style="width:100%;padding:12px;border:1px solid #ccc;border-radius:10px;font-size:15px;margin:6px 0"><textarea id="rs" placeholder="Reason (optional)" style="width:100%;padding:12px;border:1px solid #ccc;border-radius:10px;font-size:15px;height:70px"></textarea><button class="btn" type="submit" style="border:none;cursor:pointer">Request deletion</button><p id="done" class="muted"></p></form></div></div>
    <script>document.getElementById("dr").addEventListener("submit",async function(e){e.preventDefault();var b=e.target.querySelector("button");b.disabled=true;try{var r=await fetch("/api/account/delete-request",{method:"POST",headers:{"Content-Type":"application/json","X-Buja-Client":"pwa"},body:JSON.stringify({email:document.getElementById("em").value,reason:document.getElementById("rs").value})});document.getElementById("done").textContent=r.ok?"Received. If an account uses that email, it will be deleted within 30 days.":"Please check the email and try again.";}catch(x){document.getElementById("done").textContent="Could not send. Check your connection.";}b.disabled=false;});</script>';
    page('Delete your Buja account', 'How to delete your Buja account and what is removed.', $body, ['path' => 'delete-account']);
}

notFound();

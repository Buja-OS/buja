<?php
declare(strict_types=1);

/**
 * Abuja news. Pulls from the RSS feeds of established Nigerian outlets, keeps only what is about Abuja
 * or the FCT, scores each item, and pushes only the high-priority ones so the drawer stays readable.
 * No API key needed. If NEWS_API_KEY is set, NewsData.io is used as an extra source.
 */
final class NewsController
{
    /** Feeds are chosen for reliability; the Abuja filter does the rest. */
    private const FEEDS = [
        'Punch' => 'https://punchng.com/topics/abuja/feed/',
        'Premium Times' => 'https://www.premiumtimesng.com/feed',
        'Daily Trust' => 'https://dailytrust.com/feed/',
        'Vanguard' => 'https://www.vanguardngr.com/feed/',
        'The Guardian Nigeria' => 'https://guardian.ng/feed/',
        'Channels TV' => 'https://www.channelstv.com/feed/',
        'Leadership' => 'https://leadership.ng/feed/',
        'TheCable' => 'https://www.thecable.ng/feed/',
    ];
    private const ABUJA = ['abuja', 'fct', 'federal capital territory', 'wike', 'gwagwalada', 'kubwa', 'nyanya', 'mararaba', 'maitama', 'wuse', 'garki', 'jabi', 'lugbe', 'gwarinpa', 'kuje', 'bwari', 'asokoro', 'nasarawa state', 'aso rock', 'national assembly', 'abuja airport'];
    /** Words that make an item worth a notification. Weighted; 3 or more means push. */
    private const HIGH = ['fuel scarcity' => 3, 'petrol scarcity' => 3, 'road closure' => 3, 'road closed' => 3, 'diversion' => 2, 'protest' => 2, 'strike' => 3, 'curfew' => 3, 'explosion' => 3, 'attack' => 2, 'kidnap' => 2, 'flood' => 3, 'collapse' => 2, 'accident' => 2, 'bomb' => 3, 'security alert' => 3, 'demolition' => 2, 'blackout' => 2, 'power outage' => 2, 'water shortage' => 2, 'school closure' => 3, 'election' => 1, 'fare' => 2, 'transport' => 1, 'emergency' => 2, 'warning' => 2, 'ban' => 1, 'shut' => 2];
    private const CATS = ['transport' => ['transport', 'fare', 'road', 'traffic', 'bus', 'keke', 'rail', 'airport', 'fuel', 'petrol'], 'security' => ['police', 'attack', 'kidnap', 'robbery', 'security', 'explosion', 'bomb', 'arrest', 'crime'], 'power' => ['electricity', 'power', 'blackout', 'band a', 'disco', 'water'], 'housing' => ['demolition', 'land', 'housing', 'estate', 'rent', 'c of o'], 'jobs' => ['recruitment', 'employment', 'salary', 'job', 'workers', 'strike'], 'life' => ['festival', 'concert', 'sport', 'match', 'award', 'school', 'health']];

    private function score(string $text): array
    {
        $t = mb_strtolower($text); $p = 0;
        foreach (self::HIGH as $w => $v) if (str_contains($t, $w)) $p += $v;
        $cat = 'general';
        foreach (self::CATS as $c => $ws) foreach ($ws as $w) if (str_contains($t, $w)) { $cat = $c; break 2; }
        return [min(9, $p), $cat];
    }
    private function isAbuja(string $text): bool
    {
        $t = mb_strtolower($text);
        foreach (self::ABUJA as $w) if (str_contains($t, $w)) return true;
        return false;
    }

    /** GET /news?category= */
    public function index(): void
    {
        $u = Auth::require();
        if ((int) (Db::one('SELECT COUNT(*) AS n FROM news_items WHERE created_at > ?', [gmdate('Y-m-d H:i:s', time() - 1800)])['n'] ?? 0) === 0) $this->refresh(false);
        $cat = (string) ($_GET['category'] ?? '');
        $where = '1=1'; $p = [];
        if ($cat !== '' && $cat !== 'all') { $where = 'category = ?'; $p[] = $cat; }
        $st = Db::pdo()->prepare("SELECT * FROM news_items WHERE $where AND hidden_at IS NULL ORDER BY published_at DESC LIMIT 60"); $st->execute($p);
        $rows = array_map(fn($r) => ['id' => (int) $r['id'], 'title' => $r['title'], 'summary' => $r['summary'], 'url' => $r['url'], 'image' => $r['image_url'] ?? null, 'hasBody' => !empty($r['body']), 'source' => $r['source'], 'category' => $r['category'], 'priority' => (int) $r['priority'], 'at' => $r['published_at']], $st->fetchAll());
        Http::json(['news' => $rows, 'categories' => array_merge(['all', 'general'], array_keys(self::CATS))]);
    }

    /** POST /news/refresh : pulls the feeds. Called by the app at most every 30 minutes, and by cron if you set one up. */
    public function refreshEndpoint(): void
    {
        Auth::require(); RateLimit::hit('news', 20, 3600);
        Http::json($this->refresh(true));
    }

    private function fetchAll(array $urls): array
    {
        $mh = curl_multi_init(); $handles = [];
        foreach ($urls as $name => $url) { $ch = curl_init($url); curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 12, CURLOPT_FOLLOWLOCATION => true, CURLOPT_USERAGENT => 'BujaBot/1.0 (+https://buja.ng)']); curl_multi_add_handle($mh, $ch); $handles[$name] = $ch; }
        do { $status = curl_multi_exec($mh, $running); if ($running) curl_multi_select($mh, 1.0); } while ($running && $status === CURLM_OK);
        $out = [];
        foreach ($handles as $name => $ch) { $out[$name] = (string) curl_multi_getcontent($ch); curl_multi_remove_handle($mh, $ch); curl_close($ch); }
        curl_multi_close($mh);
        return $out;
    }

    /** Parses the feeds, stores what is new, pushes the urgent ones. */
    public function refresh(bool $push): array
    {
        $added = 0; $pushed = 0; $seen = 0;
        foreach ($this->fetchAll(self::FEEDS) as $source => $body) {
            if ($body === '') continue;
            $xml = @simplexml_load_string($body, 'SimpleXMLElement', LIBXML_NOCDATA | LIBXML_NOERROR | LIBXML_NOWARNING);
            if (!$xml) continue;
            $items = $xml->channel->item ?? $xml->entry ?? [];
            foreach ($items as $it) {
                $seen++;
                $title = trim((string) ($it->title ?? '')); if ($title === '') continue;
                $link = trim((string) ($it->link['href'] ?? $it->link ?? '')); if ($link === '') continue;
                $desc = trim(strip_tags((string) ($it->description ?? $it->summary ?? '')));
                $date = strtotime((string) ($it->pubDate ?? $it->published ?? $it->updated ?? '')) ?: time();
                if ($date < time() - 5 * 86400) continue;
                if (!$this->isAbuja($title . ' ' . $desc)) continue;
                $hash = sha1($link);
                if (Db::one('SELECT id FROM news_items WHERE url_hash = ?', [$hash])) continue;
                [$prio, $cat] = $this->score($title . ' ' . $desc);
                $img = self::itemImage($it);
                Db::run('INSERT INTO news_items (title, summary, url, source, category, priority, published_at, url_hash, image_url, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
                    [mb_substr($title, 0, 250), mb_substr($desc, 0, 600) ?: null, mb_substr($link, 0, 500), $source, $cat, $prio, gmdate('Y-m-d H:i:s', $date), $hash, $img, Db::now()]);
                $added++;
                if ($push && $prio >= 3) { $id = Db::lastId(); $pushed += $this->pushItem((int) $id, $title, $source); }
            }
        }
        return ['seen' => $seen, 'added' => $added, 'pushed' => $pushed];
    }

    /** The picture a feed item carries: media:content, media:thumbnail, an enclosure, or the first img in the description. */
    private static function itemImage(SimpleXMLElement $it): ?string
    {
        $media = $it->children('http://search.yahoo.com/mrss/');
        foreach ([$media->content ?? null, $media->thumbnail ?? null] as $m) {
            if ($m && isset($m[0]['url'])) { $u = (string) $m[0]['url']; if (self::okImage($u)) return mb_substr($u, 0, 500); }
        }
        if (isset($it->enclosure['url']) && str_contains((string) ($it->enclosure['type'] ?? 'image'), 'image')) { $u = (string) $it->enclosure['url']; if (self::okImage($u)) return mb_substr($u, 0, 500); }
        $html = (string) ($it->description ?? $it->summary ?? '') . (string) ($it->children('http://purl.org/rss/1.0/modules/content/')->encoded ?? '');
        if (preg_match('/<img[^>]+src=["\']([^"\']+)["\']/i', $html, $m2) && self::okImage($m2[1])) return mb_substr($m2[1], 0, 500);
        return null;
    }
    private static function okImage(string $u): bool { return str_starts_with($u, 'https://') && !preg_match('/\\.(svg|gif)(\\?|$)/i', $u); }

    /**
     * GET /news/{id} : read it inside Buja. The article text is fetched once from the publisher, cached for a
     * week, and shown with the source's name and a link to the original, the way a reader view works.
     */
    public function item(int $id): void
    {
        $u = Auth::require();
        $r = Db::one('SELECT * FROM news_items WHERE id = ? AND hidden_at IS NULL', [$id]); if (!$r) Http::json(['error' => 'not_found'], 404);
        $body = $r['body']; $fresh = $r['body_at'] && strtotime($r['body_at'] . ' UTC') > time() - 7 * 86400;
        if (!$fresh) {
            $fetched = self::readable((string) $r['url']);
            if ($fetched !== null) {
                $body = $fetched['text'];
                Db::run('UPDATE news_items SET body = ?, body_at = ?, image_url = COALESCE(image_url, ?) WHERE id = ?', [$body, Db::now(), $fetched['image'], $id]);
                if ($fetched['image'] && !$r['image_url']) $r['image_url'] = $fetched['image'];
            } else Db::run('UPDATE news_items SET body_at = ? WHERE id = ?', [Db::now(), $id]); // do not retry for a week
        }
        Db::run('UPDATE news_items SET reads = reads + 1 WHERE id = ?', [$id]);
        Track::hit($u, 'news', 'read');
        $more = Db::pdo()->prepare('SELECT id, title, source, image_url, published_at FROM news_items WHERE id <> ? AND hidden_at IS NULL AND category = ? ORDER BY published_at DESC LIMIT 4');
        $more->execute([$id, $r['category']]);
        Http::json(['item' => ['id' => (int) $r['id'], 'title' => $r['title'], 'summary' => $r['summary'], 'url' => $r['url'], 'source' => $r['source'], 'category' => $r['category'],
            'image' => $r['image_url'], 'at' => $r['published_at'], 'body' => $body ?: null, 'minutes' => $body ? max(1, (int) round(str_word_count(strip_tags($body)) / 220)) : null, 'reads' => (int) $r['reads'] + 1],
            'more' => array_map(fn($m) => ['id' => (int) $m['id'], 'title' => $m['title'], 'source' => $m['source'], 'image' => $m['image_url'], 'at' => $m['published_at']], $more->fetchAll())]);
    }

    /** Pulls an article and keeps the paragraphs. Publishers who block us simply fall back to the summary. */
    private static function readable(string $url): ?array
    {
        if (!str_starts_with($url, 'https://') || !function_exists('curl_init')) return null;
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 9, CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 3,
            CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; BujaReader/1.0; +https://buja.onrender.com)']);
        $html = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($code !== 200 || !$html || strlen($html) > 4000000) return null;
        $image = null;
        if (preg_match('/<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']+)/i', $html, $m) && self::okImage($m[1])) $image = mb_substr($m[1], 0, 500);
        // Keep only the article's paragraphs; drop scripts, styles, navigation and comment blocks.
        $html = preg_replace('#<(script|style|noscript|iframe|form|nav|aside|footer|header)[^>]*>.*?</\\1>#is', ' ', $html);
        if (preg_match('#<article[^>]*>(.*?)</article>#is', $html, $a)) $html = $a[1];
        preg_match_all('#<p[^>]*>(.*?)</p>#is', $html, $ps);
        $paras = [];
        foreach ($ps[1] ?? [] as $p) {
            $t = trim(html_entity_decode(strip_tags($p), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            $t = preg_replace('/\\s+/u', ' ', $t);
            if (mb_strlen($t) < 60) continue;                                   // menus, captions, share prompts
            if (preg_match('/^(share|follow us|read also|also read|advertisement|click here|subscribe)/i', $t)) continue;
            $paras[] = $t;
            if (count($paras) >= 40) break;
        }
        if (count($paras) < 2) return null;
        return ['text' => mb_substr(implode("\n\n", $paras), 0, 12000), 'image' => $image];
    }

    /** Only high-priority items notify, and at most 3 a day, so the drawer stays useful. */
    private function pushItem(int $id, string $title, string $source): int
    {
        $today = (int) (Db::one('SELECT COUNT(*) AS n FROM news_items WHERE pushed_at > ?', [gmdate('Y-m-d 00:00:00')])['n'] ?? 0);
        if ($today >= 3) return 0;
        Db::run('UPDATE news_items SET pushed_at = ? WHERE id = ?', [Db::now(), $id]);
        $st = Db::pdo()->query('SELECT id FROM users WHERE deleted_at IS NULL AND notify_news = 1');
        $n = 0; foreach ($st->fetchAll() as $u) { Notify::user((int) $u['id'], 'news', 'Abuja: ' . mb_substr($title, 0, 90), $source, '/#/news'); $n++; }
        return $n;
    }

    /** GET /admin/news and POST /admin/news/{id}/{action} : what the feeds pulled in, and hide anything wrong */
    public function adminIndex(): void
    {
        $u = Auth::require(); if (empty($u['is_admin']) && !in_array($u['role'] ?? '', ['admin', 'moderator'], true)) Http::json(['error' => 'forbidden'], 403);
        $st = Db::pdo()->query('SELECT * FROM news_items ORDER BY published_at DESC LIMIT 60');
        Http::json(['news' => array_map(fn($r) => ['id' => (int) $r['id'], 'title' => $r['title'], 'source' => $r['source'], 'category' => $r['category'], 'priority' => (int) $r['priority'],
            'image' => $r['image_url'] ?? null, 'hasBody' => !empty($r['body']), 'reads' => (int) ($r['reads'] ?? 0), 'hidden' => !empty($r['hidden_at']), 'url' => $r['url'], 'at' => $r['published_at']], $st->fetchAll()),
            'counts' => ['total' => (int) (Db::one('SELECT COUNT(*) AS n FROM news_items')['n'] ?? 0), 'today' => (int) (Db::one('SELECT COUNT(*) AS n FROM news_items WHERE created_at > ?', [gmdate('Y-m-d H:i:s', time() - 86400)])['n'] ?? 0),
                'withImage' => (int) (Db::one('SELECT COUNT(*) AS n FROM news_items WHERE image_url IS NOT NULL')['n'] ?? 0), 'readable' => (int) (Db::one('SELECT COUNT(*) AS n FROM news_items WHERE body IS NOT NULL')['n'] ?? 0)]]);
    }
    public function adminAct(int $id, string $action): void
    {
        $u = Auth::require(); if (empty($u['is_admin']) && !in_array($u['role'] ?? '', ['admin', 'moderator'], true)) Http::json(['error' => 'forbidden'], 403);
        match ($action) {
            'hide' => Db::run('UPDATE news_items SET hidden_at = ? WHERE id = ?', [Db::now(), $id]),
            'show' => Db::run('UPDATE news_items SET hidden_at = NULL WHERE id = ?', [$id]),
            default => Http::json(['error' => 'not_found'], 404),
        };
        Http::json(['ok' => true]);
    }
}

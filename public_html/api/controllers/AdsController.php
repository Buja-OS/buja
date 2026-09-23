<?php
declare(strict_types=1);

/**
 * Ads, switched off until an admin turns them on. One configuration serves three places:
 *  - the website and installed PWA: Google AdSense (display and in-feed units, plus the Ad Placement API for
 *    interstitial and rewarded breaks)
 *  - a native wrapper that exposes the Buja ad bridge: Google AdMob (banner, interstitial, rewarded, app open)
 *  - nowhere at all on the screens where an ad would be unsafe or unkind: breakdowns, tracking, Trip Share,
 *    calls, payments, lessons, sign-in and admin. Buja Plus members never see ads.
 */
final class AdsController
{
    public const DEFAULTS = [
        'enabled' => false, 'adsenseClient' => '', 'bannerSlot' => '', 'infeedSlot' => '', 'webBreaks' => false,
        'native' => false, 'admobAppIdAndroid' => '', 'admobAppIdIos' => '', 'admobBanner' => '', 'admobInterstitial' => '', 'admobRewarded' => '', 'admobAppOpen' => '',
        'infeedEvery' => 6, 'interstitialEveryScreens' => 8, 'interstitialMinGapSec' => 240, 'sessionGraceSec' => 120, 'appOpenGapSec' => 14400,
        'places' => ['social' => true, 'news' => true, 'work' => true, 'homes' => true, 'declutter' => true, 'meetup' => true, 'waka' => false, 'learn' => false],
    ];
    public const NEVER = ['/breakdown', '/jobs', '/safety', '/trip', '/call', '/rtc', '/pay', '/tickets', '/signin', '/signup', '/welcome', '/onboarding', '/reset', '/admin', '/cert', '/plates', '/blood'];

    public static function config(): array
    {
        $row = null; try { $row = Db::one("SELECT v FROM app_settings WHERE k = 'ads'"); } catch (Throwable $e) {}
        $c = array_replace_recursive(self::DEFAULTS, $row ? (json_decode($row['v'], true) ?: []) : []);
        return $c;
    }

    /** GET /ads/config : what this person's app should show. Nothing, for Buja Plus members. */
    public function show(): void
    {
        $u = Auth::user();
        $c = self::config();
        $plus = $u && !empty($u['plus_until']) && strtotime($u['plus_until'] . ' UTC') > time();
        header('Cache-Control: private, max-age=300');
        Http::json(['ads' => $c['enabled'] && !$plus ? array_merge($c, ['never' => self::NEVER]) : ['enabled' => false], 'plus' => $plus]);
    }

    /** GET /admin/ads and POST /admin/ads */
    public function admin(): void
    {
        $u = Auth::require(); if (empty($u['is_admin']) && ($u['role'] ?? '') !== 'admin') Http::json(['error' => 'forbidden'], 403);
        Http::json(['ads' => self::config(), 'never' => self::NEVER]);
    }
    public function save(): void
    {
        $u = Auth::require(); if (empty($u['is_admin']) && ($u['role'] ?? '') !== 'admin') Http::json(['error' => 'forbidden'], 403);
        $b = Http::body(); $c = self::config();
        foreach (['enabled', 'webBreaks', 'native'] as $k) if (array_key_exists($k, $b)) $c[$k] = !empty($b[$k]);
        foreach (['adsenseClient', 'bannerSlot', 'infeedSlot', 'admobAppIdAndroid', 'admobAppIdIos', 'admobBanner', 'admobInterstitial', 'admobRewarded', 'admobAppOpen'] as $k) if (array_key_exists($k, $b)) $c[$k] = mb_substr(preg_replace('/[^A-Za-z0-9\-_~\/]/', '', (string) $b[$k]), 0, 80);
        if ($c['adsenseClient'] !== '' && !preg_match('/^ca-pub-\d{10,20}$/', $c['adsenseClient'])) Http::json(['error' => 'validation', 'message' => 'The AdSense publisher ID looks like ca-pub- followed by 16 digits.'], 422);
        foreach (['infeedEvery' => [3, 30], 'interstitialEveryScreens' => [3, 40], 'interstitialMinGapSec' => [60, 3600], 'sessionGraceSec' => [0, 900], 'appOpenGapSec' => [900, 86400]] as $k => [$lo, $hi]) if (isset($b[$k])) $c[$k] = max($lo, min($hi, (int) $b[$k]));
        if (isset($b['places']) && is_array($b['places'])) foreach (array_keys(self::DEFAULTS['places']) as $p) if (array_key_exists($p, $b['places'])) $c['places'][$p] = !empty($b['places'][$p]);
        $json = json_encode($c);
        if (Db::one("SELECT k FROM app_settings WHERE k = 'ads'")) Db::run("UPDATE app_settings SET v = ?, updated_at = ? WHERE k = 'ads'", [$json, Db::now()]);
        else Db::run("INSERT INTO app_settings (k, v, updated_at) VALUES ('ads', ?, ?)", [$json, Db::now()]);
        Http::json(['ads' => $c, 'never' => self::NEVER]);
    }

    /** ads.txt, which AdSense requires on the domain before it serves: built from the publisher ID. */
    public static function adsTxt(): string
    {
        $c = self::config();
        if ($c['adsenseClient'] === '') return "# Buja has no ad sellers configured yet.\n";
        return 'google.com, ' . str_replace('ca-', '', $c['adsenseClient']) . ", DIRECT, f08c47fec0942fa0\n";
    }
}

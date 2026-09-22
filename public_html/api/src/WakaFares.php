<?php
declare(strict_types=1);

/**
 * Waka fares, September 2026. One formula per mode, each fitted to verified Abuja fares and indexed to the
 * pump price, so a fuel change moves every estimate the way the market does. Rider reports override the
 * formula once three people agree within 30 days.
 *
 * Sources (see the Phase 24 research report):
 *  - along: fitted to seven Daily Trust fares of 17 March 2026 using Waka's own coordinates:
 *           N443 + N52.4 per straight-line km (Lugbe-Berger N1,000, Berger-Karmo N700, Nyanya-Jabi N1,700,
 *           Berger-Zuba N1,800, Mpape-Jabi N1,100, Life Camp-Wuse Market N800, Area 1-Secretariat N700).
 *           March pump price taken as N900.
 *  - bus:   mid-2026 street fares before the claimed CNG cut: Wuse N400, Nyanya N700, Area 1-Gwagwalada N1,500.
 *  - keke:  NAN, 20 Sept 2026: short hops N200-500.
 *  - train: Abuja light rail, reported N500-600 per ride (low confidence).
 *  - bolt:  Bolt Abuja card of Aug 2024 (min N1,495, base N884, N152/km, N25/min) marked up for 2026 fuel.
 *  - drop:  a chartered taxi costs about four along seats (market range four to six).
 * Elasticity: fares move about half as much as fuel within a week or two (2023 subsidy-removal pattern).
 */
final class WakaFares
{
    public const MODES = [
        'along' => ['anchor' => 900,  'e' => 0.5, 'base' => 443, 'km' => 52.4, 'min' => 300],
        'bus'   => ['anchor' => 1335, 'e' => 0.4, 'base' => 250, 'km' => 32,   'min' => 300],
        'keke'  => ['anchor' => 1420, 'e' => 0.5],
        'bolt'  => ['anchor' => 1420, 'e' => 0.6, 'base' => 1100, 'km' => 220, 'perMin' => 35, 'min' => 2000],
    ];
    public const ROAD_FACTOR = 1.3;     // straight line to road distance, Abuja average
    public const CROWD_MIN = 3;         // reports needed before riders' median replaces the estimate

    private static ?array $cfg = null;
    public static function config(): array
    {
        if (self::$cfg !== null) return self::$cfg;
        $c = ['pump_price' => 1420, 'reviewed_at' => null, 'adjust_along' => 0, 'adjust_bus' => 0, 'adjust_keke' => 0, 'adjust_bolt' => 0];
        try { foreach (Db::pdo()->query('SELECT k, v FROM waka_config')->fetchAll() as $r) $c[$r['k']] = is_numeric($r['v']) ? (float) $r['v'] : $r['v']; } catch (Throwable $e) {}
        return self::$cfg = $c;
    }
    public static function set(string $k, string $v): void
    {
        if (Db::one('SELECT k FROM waka_config WHERE k = ?', [$k])) Db::run('UPDATE waka_config SET v = ?, updated_at = ? WHERE k = ?', [$v, Db::now(), $k]);
        else Db::run('INSERT INTO waka_config (k, v, updated_at) VALUES (?,?,?)', [$k, $v, Db::now()]);
        self::$cfg = null;
    }

    /** How much fares have moved since the mode's anchor price, plus any admin adjustment in percent. */
    public static function factor(string $mode): float
    {
        $m = self::MODES[$mode] ?? null; if (!$m) return 1.0;
        $c = self::config(); $pump = max(300, (float) $c['pump_price']);
        $f = 1 + $m['e'] * ($pump / $m['anchor'] - 1);
        return max(0.5, $f) * (1 + ((float) ($c['adjust_' . $mode] ?? 0)) / 100);
    }
    private static function up50(float $n): int { return (int) (ceil($n / 50) * 50); }

    /** Estimated fare for one person, straight-line km between two stops. */
    public static function estimate(string $mode, float $km, ?string $routeName = null): ?int
    {
        return match ($mode) {
            'along' => self::up50(max(self::MODES['along']['min'], self::MODES['along']['base'] + self::MODES['along']['km'] * $km) * self::factor('along')),
            'bus'   => self::up50(max(self::MODES['bus']['min'], self::MODES['bus']['base'] + self::MODES['bus']['km'] * $km) * self::factor('bus')),
            'keke'  => self::up50(($km <= 2 ? 200 : ($km <= 4 ? 300 : ($km <= 6 ? 400 : 500))) * self::factor('keke')),
            'train' => (stripos((string) $routeName, 'airport') !== false) ? 600 : 500,
            'taxi'  => self::drop($km),
            default => null,
        };
    }

    /** A chartered taxi: about five along seats, never under N2,000. Airport runs carry a premium. */
    public static function drop(float $km, bool $airport = false): int
    {
        $n = max(2000, (self::estimate('along', $km) ?? 1000) * 4);
        if ($airport) $n = max($n, 12000); // FAAN restriction on e-hailing pickups pushed airport cabs to N10,000-20,000
        return self::up50($n);
    }
    /** Bolt-style: max(min, base + per-km on the road + per-minute), indexed to fuel. */
    public static function bolt(float $straightKm, int $minutes): int
    {
        $b = self::MODES['bolt']; $road = $straightKm * self::ROAD_FACTOR;
        return self::up50(max($b['min'], $b['base'] + $b['km'] * $road + $b['perMin'] * $minutes) * self::factor('bolt'));
    }
    public static function indrive(float $straightKm, int $minutes): int { return self::up50(self::bolt($straightKm, $minutes) * 0.85); }

    /** Where the numbers came from, for the "how fares work" sheet and the admin screen. */
    public static function explain(): array
    {
        $c = self::config();
        return ['pumpPrice' => (int) $c['pump_price'], 'reviewedAt' => $c['reviewed_at'], 'crowdMin' => self::CROWD_MIN,
            'factors' => array_map(fn($m) => round(self::factor($m), 2), ['along' => 'along', 'bus' => 'bus', 'keke' => 'keke', 'bolt' => 'bolt']),
            'adjust' => ['along' => (float) $c['adjust_along'], 'bus' => (float) $c['adjust_bus'], 'keke' => (float) $c['adjust_keke'], 'bolt' => (float) $c['adjust_bolt']],
            'examples' => ['Lugbe to Berger (along)' => self::estimate('along', 13.9), 'Area 1 to Secretariat (along)' => self::estimate('along', 3.3), 'Nyanya to Wuse (bus)' => self::estimate('bus', 12), 'Short keke hop' => self::estimate('keke', 1.5), 'Wuse to Airport (Bolt)' => self::bolt(33, 45)]];
    }
}

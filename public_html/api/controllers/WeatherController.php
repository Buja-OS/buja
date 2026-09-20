<?php
declare(strict_types=1);

/** Abuja weather for the home screen. Open-Meteo, free, no key. Cached for half an hour. */
final class WeatherController
{
    private const CODES = [0 => ['Clear', 'sun'], 1 => ['Mostly clear', 'sun'], 2 => ['Partly cloudy', 'cloud'], 3 => ['Overcast', 'cloud'],
        45 => ['Foggy', 'cloud'], 48 => ['Foggy', 'cloud'], 51 => ['Light drizzle', 'rain'], 53 => ['Drizzle', 'rain'], 55 => ['Heavy drizzle', 'rain'],
        61 => ['Light rain', 'rain'], 63 => ['Rain', 'rain'], 65 => ['Heavy rain', 'rain'], 80 => ['Showers', 'rain'], 81 => ['Showers', 'rain'], 82 => ['Heavy showers', 'rain'],
        95 => ['Thunderstorm', 'storm'], 96 => ['Thunderstorm', 'storm'], 99 => ['Thunderstorm', 'storm'],
        71 => ['Snow', 'cloud'], 73 => ['Snow', 'cloud'], 75 => ['Snow', 'cloud']];

    /** GET /weather */
    public function index(): void
    {
        Auth::require();
        $cached = Db::one('SELECT v FROM app_keys WHERE k = ?', ['weather']);
        if ($cached) { $j = json_decode((string) $cached['v'], true); if ($j && ($j['at'] ?? 0) > time() - 1800) Http::json(['weather' => $j['w']]); }
        $url = 'https://api.open-meteo.com/v1/forecast?latitude=9.0765&longitude=7.3986&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Africa%2FLagos&forecast_days=2';
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 6, CURLOPT_CONNECTTIMEOUT => 3, CURLOPT_USERAGENT => 'BujaApp/1.0']);
        $raw = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        if ($code !== 200 || !$raw) {
            error_log('[buja weather] open-meteo returned ' . $code);
            if ($cached) { $j = json_decode((string) $cached['v'], true); if ($j) Http::json(['weather' => $j['w'], 'stale' => true]); }
            Http::json(['weather' => null]);
        }
        $d = json_decode($raw, true);
        $cur = $d['current'] ?? []; $day = $d['daily'] ?? [];
        [$label, $icon] = self::CODES[(int) ($cur['weather_code'] ?? 0)] ?? ['—', 'cloud'];
        $rain = (int) ($day['precipitation_probability_max'][0] ?? 0);
        $w = ['temp' => (int) round((float) ($cur['temperature_2m'] ?? 0)), 'feels' => (int) round((float) ($cur['apparent_temperature'] ?? 0)),
            'label' => $label, 'icon' => $icon, 'humidity' => (int) ($cur['relative_humidity_2m'] ?? 0), 'wind' => (int) round((float) ($cur['wind_speed_10m'] ?? 0)),
            'high' => (int) round((float) ($day['temperature_2m_max'][0] ?? 0)), 'low' => (int) round((float) ($day['temperature_2m_min'][0] ?? 0)),
            'rainChance' => $rain,
            'advice' => $rain >= 70 ? 'Carry an umbrella, and leave earlier than usual.' : ($rain >= 40 ? 'Rain is likely later. Keep an umbrella in the bag.' : ((int) round((float) ($cur['temperature_2m'] ?? 0)) >= 34 ? 'Hot one. Water, and avoid the midday sun.' : 'Good day to be out.'))];
        Db::run('DELETE FROM app_keys WHERE k = ?', ['weather']);
        Db::run('INSERT INTO app_keys (k, v) VALUES (?,?)', ['weather', json_encode(['at' => time(), 'w' => $w])]);
        Http::json(['weather' => $w]);
    }
}

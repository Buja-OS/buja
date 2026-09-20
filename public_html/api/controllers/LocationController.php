<?php
declare(strict_types=1);

final class LocationController
{
    /** POST /me/location { lat, lng } : used for distances in Match. Stored to 3 decimals, about 100 metres. */
    public function update(): void
    {
        $u = Auth::require(); $b = Http::body();
        $lat = round((float) ($b['lat'] ?? 0), 3); $lng = round((float) ($b['lng'] ?? 0), 3);
        if ($lat < 4 || $lat > 14 || $lng < 2 || $lng > 15) Http::json(['error' => 'validation', 'message' => 'Buja is for Abuja. That location is outside Nigeria.'], 422);
        Db::run('UPDATE users SET lat = ?, lng = ?, loc_updated_at = ? WHERE id = ?', [$lat, $lng, Db::now(), $u['id']]);
        Http::json(['ok' => true, 'updatedAt' => Db::now()]);
    }
    /** DELETE /me/location */
    public function clear(): void { $u = Auth::require(); Db::run('UPDATE users SET lat = NULL, lng = NULL, loc_updated_at = NULL WHERE id = ?', [$u['id']]); Http::json(['ok' => true]); }
}

<?php
declare(strict_types=1);

final class HomesRules
{
    public const KINDS = ['rent', 'sale'];
    public const TYPES = ['flat' => 'Flat', 'selfcon' => 'Self-contained', 'room' => 'Room', 'bungalow' => 'Bungalow', 'duplex' => 'Duplex', 'terrace' => 'Terrace', 'land' => 'Land', 'office' => 'Office', 'shop' => 'Shop'];
    public const FACILITIES = ['Prepaid meter', 'Borehole', 'Parking', 'Gated / security', 'Fibre ready', 'Fitted kitchen', 'POP ceiling', 'Generator', 'Solar', 'Water heater', 'Tiled floors', 'Furnished', 'Serviced', '24-hour power', 'Elevator', 'Own compound'];
    public const PHOTO_MAX = 10;
    public const AGENT_FEE = 0.10;
    /** Approximate district centres, for "minutes to Central Area". */
    public const CENTROID = ['Asokoro' => [9.030, 7.520], 'Maitama' => [9.087, 7.495], 'Wuse' => [9.066, 7.470], 'Wuse 2' => [9.078, 7.475], 'Garki' => [9.030, 7.484], 'Central Area' => [9.050, 7.493], 'Jabi' => [9.064, 7.426], 'Utako' => [9.065, 7.440], 'Gwarinpa' => [9.106, 7.406], 'Life Camp' => [9.099, 7.420], 'Kado' => [9.080, 7.416], 'Katampe' => [9.105, 7.470], 'Guzape' => [9.020, 7.520], 'Durumi' => [9.010, 7.475], 'Apo' => [8.988, 7.482], 'Lokogoma' => [8.980, 7.450], 'Galadimawa' => [8.977, 7.423], 'Lugbe' => [8.975, 7.366], 'Kubwa' => [9.154, 7.329], 'Jahi' => [9.098, 7.432], 'Nyanya' => [9.033, 7.585], 'Karu' => [9.014, 7.607], 'Jikwoyi' => [9.010, 7.640], 'Kuje' => [8.879, 7.227], 'Gwagwalada' => [8.943, 7.081], 'Mabushi' => [9.086, 7.447], 'Gudu' => [8.999, 7.468], 'Dutse' => [9.162, 7.390], 'Bwari' => [9.282, 7.382]];

    public static function minutesToCentre(string $district): ?int
    {
        $c = self::CENTROID[$district] ?? null; if (!$c) return null;
        $km = WakaRules::km($c[0], $c[1], 9.050, 7.493);
        return $km < 1 ? 5 : WakaRules::minutes($km, 'taxi');
    }
}

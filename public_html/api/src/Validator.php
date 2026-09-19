<?php
declare(strict_types=1);

final class Validator
{
    public static function email(string $v): ?string
    {
        $v = strtolower(trim($v));
        return filter_var($v, FILTER_VALIDATE_EMAIL) ? $v : null;
    }

    /** Nigerian mobile: accepts 0803..., 803..., +234803..., 234803...; returns E.164 (+234803...). */
    public static function ngPhone(string $v): ?string
    {
        $d = preg_replace('/\D+/', '', $v) ?? '';
        if (str_starts_with($d, '234') && strlen($d) === 13) return '+' . $d;
        if (str_starts_with($d, '0') && strlen($d) === 11)   return '+234' . substr($d, 1);
        if (strlen($d) === 10)                                return '+234' . $d;
        return null;
    }

    public static function name(string $v): ?string
    {
        $v = trim(preg_replace('/\s+/', ' ', $v) ?? '');
        return (mb_strlen($v) >= 2 && mb_strlen($v) <= 80) ? $v : null;
    }

    public static function password(string $v): ?string
    {
        return (strlen($v) >= 8 && strlen($v) <= 200) ? $v : null;
    }

    public static function kind(string $v): ?string
    {
        return in_array($v, ['resident', 'company', 'landlord'], true) ? $v : null;
    }
}

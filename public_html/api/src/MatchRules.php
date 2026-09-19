<?php
declare(strict_types=1);

final class MatchRules
{
    public const GENDERS = ['woman', 'man'];
    public const SEEKING = ['women', 'men', 'everyone'];
    public const PHOTO_MAX = 6;
    public const PHOTO_BYTES = 700 * 1024;
    public const INTERESTS = ['Afrobeats', 'Amapiano', 'Gospel', 'Church', 'Mosque', 'Brunch', 'Suya nights', 'Cooking', 'Football', 'Gym', 'Running', 'Hiking', 'Jabi Lake', 'Movies', 'Series', 'Reading', 'Travel', 'Tech', 'Business', 'Fashion', 'Photography', 'Art', 'Gaming', 'Dancing', 'Volunteering', 'Politics', 'Cars', 'Pets', 'Nature', 'Board games'];
    public const PROMPTS = ['A perfect Abuja weekend looks like', 'I am looking for', 'You should know that', 'My go-to spot in Abuja is', 'I will win you over with', 'Two truths and a lie'];
    public const FAITH = ['', 'Christian', 'Muslim', 'Traditional', 'Spiritual', 'Other', 'Prefer not to say'];
    public const HABIT = ['', 'Never', 'Sometimes', 'Often'];
    public const KIDS = ['', 'Want kids', 'Do not want kids', 'Have kids', 'Open to it'];

    /** Neighbouring districts of the FCT, used for "nearby". */
    private const NEAR = [
        'Maitama' => ['Asokoro', 'Wuse', 'Wuse 2', 'Central Area', 'Katampe', 'Jahi'],
        'Asokoro' => ['Maitama', 'Central Area', 'Guzape', 'Garki'],
        'Wuse' => ['Wuse 2', 'Maitama', 'Central Area', 'Garki', 'Utako', 'Jabi', 'Mabushi'],
        'Wuse 2' => ['Wuse', 'Maitama', 'Utako', 'Jabi', 'Jahi', 'Central Area'],
        'Central Area' => ['Wuse', 'Wuse 2', 'Garki', 'Maitama', 'Asokoro'],
        'Garki' => ['Central Area', 'Wuse', 'Asokoro', 'Guzape', 'Durumi', 'Apo'],
        'Guzape' => ['Asokoro', 'Garki', 'Apo', 'Durumi'],
        'Durumi' => ['Garki', 'Guzape', 'Apo', 'Gudu', 'Lokogoma'],
        'Apo' => ['Garki', 'Guzape', 'Durumi', 'Gudu', 'Lokogoma'],
        'Lokogoma' => ['Apo', 'Durumi', 'Gudu', 'Galadimawa', 'Lugbe'],
        'Galadimawa' => ['Lokogoma', 'Lugbe', 'Gudu'],
        'Lugbe' => ['Galadimawa', 'Lokogoma', 'Kuje'],
        'Utako' => ['Wuse', 'Wuse 2', 'Jabi', 'Mabushi', 'Kado'],
        'Jabi' => ['Utako', 'Wuse 2', 'Jahi', 'Kado', 'Life Camp', 'Mabushi'],
        'Jahi' => ['Jabi', 'Wuse 2', 'Katampe', 'Kado', 'Life Camp', 'Gwarinpa'],
        'Kado' => ['Jabi', 'Jahi', 'Life Camp', 'Utako', 'Gwarinpa'],
        'Life Camp' => ['Jabi', 'Jahi', 'Kado', 'Gwarinpa', 'Katampe'],
        'Katampe' => ['Maitama', 'Jahi', 'Life Camp', 'Gwarinpa'],
        'Gwarinpa' => ['Life Camp', 'Kado', 'Jahi', 'Katampe', 'Kubwa', 'Dawaki'],
        'Kubwa' => ['Gwarinpa', 'Dawaki', 'Bwari'],
        'Nyanya' => ['Karu', 'Jikwoyi', 'Mararaba'],
        'Karu' => ['Nyanya', 'Jikwoyi'],
        'Jikwoyi' => ['Nyanya', 'Karu'],
        'Kuje' => ['Lugbe', 'Gwagwalada'],
        'Gwagwalada' => ['Kuje'],
    ];

    public static function nearby(string $district): array
    {
        return array_values(array_unique(array_merge([$district], self::NEAR[$district] ?? [])));
    }

    public static function proximity(string $a, string $b): string
    {
        if ($a === $b) return 'same';
        return in_array($b, self::NEAR[$a] ?? [], true) ? 'nearby' : 'abuja';
    }

    public static function age(string $birthdate): int
    {
        return (int) (new DateTime($birthdate))->diff(new DateTime('today'))->y;
    }

    /** Transparent compatibility score, 0 to 100. */
    public static function score(array $me, array $them): array
    {
        $mine = json_decode($me['interests'] ?? '[]', true) ?: []; $theirs = json_decode($them['interests'] ?? '[]', true) ?: [];
        $shared = array_values(array_intersect($mine, $theirs));
        $union = count(array_unique(array_merge($mine, $theirs)));
        $s = $union ? (int) round(count($shared) / $union * 55) : 20;
        $faith = 0; if (($me['faith'] ?? '') !== '' && $me['faith'] === ($them['faith'] ?? null)) $faith = 20;
        $prox = self::proximity($me['district'] ?? '', $them['district'] ?? ''); $near = $prox === 'same' ? 15 : ($prox === 'nearby' ? 10 : 3);
        $kids = 0; if (($me['kids'] ?? '') !== '' && $me['kids'] === ($them['kids'] ?? null)) $kids = 10;
        return ['score' => min(100, $s + $faith + $near + $kids), 'shared' => $shared, 'proximity' => $prox];
    }
}

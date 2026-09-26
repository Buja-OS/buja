<?php
declare(strict_types=1);

/**
 * Lets people ask Buja the way they talk: Nigerian Pidgin, Hausa and Yoruba phrases for places, food and "near me"
 * are turned into the plain English words Ask already understands. It does not translate whole sentences; it
 * recognises the words that decide what someone is looking for, and leaves everything else as it was.
 */
final class Lang
{
    /** Longest phrases first within each list, so "gidan abinci" wins over "abinci". */
    private const PHRASES = [
        'pidgin' => [
            'where i fit buy' => 'where can i buy', 'where i fit get' => 'where can i get', 'where i fit' => 'where can i', 'wey dey open now' => 'open now', 'wey dey open' => 'open', 'dey open' => 'open',
            'dey sell' => 'selling', 'e dey sell' => 'selling', 'mama put' => 'local food restaurant', 'beer parlour' => 'bar lounge', 'drink joint' => 'bar', 'pepper soup joint' => 'pepper soup',
            'suya spot' => 'suya', 'chop' => 'food', 'wetin' => 'what', 'wia' => 'where', 'wey' => 'that', 'abeg' => '', 'una' => '', 'dey' => '', 'beta' => 'good', 'sharp sharp' => 'quick',
            'for night' => 'late night', 'this night' => 'late night', 'for here' => 'near me', 'around here' => 'near me', 'near here' => 'near me', 'mechanic wey' => 'mechanic', 'vulcaniser' => 'vulcanizer',
            'chemist' => 'pharmacy', 'hospital wey' => 'hospital', 'fit' => 'can',
        ],
        'hausa' => [
            'gidan abinci' => 'restaurant', 'wurin cin abinci' => 'restaurant', 'kantin magani' => 'pharmacy', 'shagon magani' => 'pharmacy', 'gidan mai' => 'fuel station', 'mai gyaran mota' => 'mechanic',
            'gidan shakatawa' => 'lounge', 'wurin shakatawa' => 'park', 'kusa da ni' => 'near me', 'a kusa' => 'near me', 'a bude' => 'open', 'yanzu' => 'now', 'da dare' => 'late night',
            'abinci' => 'food', 'masallaci' => 'mosque', 'masallacin' => 'mosque', 'cocin' => 'church', 'coci' => 'church', 'asibiti' => 'hospital', 'magani' => 'pharmacy', 'otal' => 'hotel',
            'kasuwa' => 'market', 'banki' => 'bank', 'makanike' => 'mechanic', 'tsire' => 'suya', 'kilishi' => 'suya', 'kusa' => 'near me', 'ina' => 'where', 'nama' => 'meat grill', 'kifi' => 'fish',
            'shayi' => 'tea cafe', 'wanzami' => 'barber', 'aski' => 'barber', 'tela' => 'tailor', 'dinki' => 'tailor', 'arha' => 'cheap', 'mai kyau' => 'good',
        ],
        'yoruba' => [
            'ile itaja oogun' => 'pharmacy', 'ile oogun' => 'pharmacy', 'ile iwosan' => 'hospital', 'ile ijosin' => 'church', 'ile ounje' => 'restaurant', 'ile itura' => 'hotel', 'ile epo' => 'fuel station',
            'ile ifowopamo' => 'bank', 'nitosi mi' => 'near me', 'ni bayi' => 'now', 'to si' => 'open', 'ni ale' => 'late night', 'ounje' => 'food', 'onje' => 'food', 'soosi' => 'church', 'sosi' => 'church',
            'mosalasi' => 'mosque', 'osibitu' => 'hospital', 'oogun' => 'pharmacy', 'oja' => 'market', 'nitosi' => 'near me', 'nibo' => 'where', 'bayi' => 'now',
            'eran' => 'meat grill', 'eja' => 'fish', 'iyan' => 'pounded yam', 'ewa agoyin' => 'beans local food', 'onidiri' => 'hair salon', 'telo' => 'tailor', 'mekaniki' => 'mechanic', 'olowo poku' => 'cheap', 'to dara' => 'good',
        ],
    ];
    public const LABEL = ['pidgin' => 'Pidgin', 'hausa' => 'Hausa', 'yoruba' => 'Yoruba'];

    /** Yoruba and Hausa letters with tone marks and dots, reduced to plain letters so "ọjà" matches "oja". */
    public static function plain(string $s): string
    {
        $s = mb_strtolower($s);
        $map = ['ẹ' => 'e', 'ọ' => 'o', 'ṣ' => 's', 'ɗ' => 'd', 'ƙ' => 'k', 'ɓ' => 'b', 'ƴ' => 'y', 'à' => 'a', 'á' => 'a', 'â' => 'a', 'è' => 'e', 'é' => 'e', 'ê' => 'e', 'ì' => 'i', 'í' => 'i', 'ò' => 'o', 'ó' => 'o', 'ô' => 'o', 'ù' => 'u', 'ú' => 'u', 'ń' => 'n', 'ǹ' => 'n', 'ḿ' => 'm'];
        $s = strtr($s, $map);
        return preg_replace('/[\x{0300}-\x{036f}\x{0323}]/u', '', $s) ?? $s;   // combining accents and the dot below
    }

    /**
     * Returns [english words, language or null]. The language is the one whose words were found most;
     * a plain English question comes back unchanged with null.
     */
    public static function toEnglish(string $q): array
    {
        $out = ' ' . preg_replace('/\s+/', ' ', self::plain($q)) . ' ';
        $hits = ['pidgin' => 0, 'hausa' => 0, 'yoruba' => 0];
        foreach (self::PHRASES as $lang => $list) {
            $keys = array_keys($list); usort($keys, fn($a, $b) => mb_strlen($b) <=> mb_strlen($a));
            foreach ($keys as $k) {
                $rx = '/(?<=[\s,.?!])' . preg_quote($k, '/') . '(?=[\s,.?!])/u';
                $n = 0; $out = preg_replace($rx, ' ' . $list[$k] . ' ', $out, -1, $n);
                // common English words that happen to match are not evidence of the language
                if ($n && !in_array($k, ['ina', 'oja', 'fit', 'dey', 'wey', 'beta', 'chemist', 'chop'], true)) $hits[$lang] += $n;
                elseif ($n) $hits[$lang] += 0.4 * $n;
            }
        }
        $out = trim(preg_replace('/\s+/', ' ', $out));
        arsort($hits); $top = array_key_first($hits);
        return [$out, $hits[$top] >= 1 ? $top : null];
    }
}

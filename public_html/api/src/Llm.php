<?php
declare(strict_types=1);

/** One call to whichever AI provider is configured, expecting JSON back. Shared by Ask and Learn. */
final class Llm
{
    public static function chain(): array
    {
        $want = strtolower((string) Http::config('ask_provider', 'gemini'));
        $have = array_values(array_filter(['gemini', 'groq', 'anthropic'], fn($p) => Http::config($p . '_api_key', '') !== ''));
        if ($want === 'rules') return [];
        usort($have, fn($a, $b) => ($b === $want) <=> ($a === $want));
        return $have;
    }

    /** Returns the parsed JSON object the model replied with, or null when every provider fails. */
    public static function json(string $system, string $user, int $maxTokens = 900, float $temperature = 0.2): ?array
    {
        foreach (self::chain() as $provider) {
            $key = (string) Http::config($provider . '_api_key', '');
            [$url, $headers, $body] = match ($provider) {
                'gemini' => [rtrim((string) Http::config('gemini_endpoint', 'https://generativelanguage.googleapis.com/v1beta/models'), '/') . '/' . (string) Http::config('gemini_model', 'gemini-3.6-flash') . ':generateContent?key=' . $key, ['content-type: application/json'],
                    json_encode(['systemInstruction' => ['parts' => [['text' => $system]]], 'contents' => [['role' => 'user', 'parts' => [['text' => $user]]]], 'generationConfig' => ['temperature' => $temperature, 'maxOutputTokens' => $maxTokens, 'responseMimeType' => 'application/json']])],
                'groq' => ['https://api.groq.com/openai/v1/chat/completions', ['content-type: application/json', 'authorization: Bearer ' . $key],
                    json_encode(['model' => (string) Http::config('groq_model', 'llama-3.3-70b-versatile'), 'temperature' => $temperature, 'max_tokens' => $maxTokens, 'response_format' => ['type' => 'json_object'], 'messages' => [['role' => 'system', 'content' => $system], ['role' => 'user', 'content' => $user]]])],
                'anthropic' => ['https://api.anthropic.com/v1/messages', ['content-type: application/json', 'x-api-key: ' . $key, 'anthropic-version: 2023-06-01'],
                    json_encode(['model' => (string) Http::config('ask_model', 'claude-haiku-4-5-20251001'), 'max_tokens' => $maxTokens, 'system' => $system, 'messages' => [['role' => 'user', 'content' => $user]]])],
                default => [null, [], null],
            };
            if ($url === null) continue;
            $ch = curl_init($url);
            curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25, CURLOPT_POSTFIELDS => $body, CURLOPT_HTTPHEADER => $headers]);
            $raw = curl_exec($ch); $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
            if ($code !== 200) { error_log('[buja llm] ' . $provider . ' returned ' . $code); continue; }
            $j = json_decode((string) $raw, true);
            $text = match ($provider) {
                'gemini' => $j['candidates'][0]['content']['parts'][0]['text'] ?? '',
                'groq' => $j['choices'][0]['message']['content'] ?? '',
                'anthropic' => implode('', array_map(fn($b) => $b['text'] ?? '', array_filter($j['content'] ?? [], fn($b) => ($b['type'] ?? '') === 'text'))),
                default => '',
            };
            $text = trim(preg_replace('/^```(?:json)?|```$/m', '', (string) $text));
            $parsed = json_decode($text, true);
            if (is_array($parsed)) return $parsed;
            error_log('[buja llm] ' . $provider . ' unparseable');
        }
        return null;
    }
}

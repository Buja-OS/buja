<?php
/**
 * Buja API configuration.
 *
 * cPanel hosting:  copy this file to config.php and type the values in.
 * Render / Docker: leave this file alone; set the same values as Environment Variables
 *                  in the Render dashboard (DB_DSN, DB_USER, DB_PASS, DB_SSL, JWT_SECRET,
 *                  APP_ORIGIN, GOOGLE_CLIENT_ID). Environment variables win when present.
 * config.php is blocked from the web by .htaccess. Never commit it anywhere public.
 */
$env = fn(string $k, $d = '') => (($v = getenv($k)) !== false && $v !== '') ? $v : $d;

return [
    'db' => [
        // cPanel: mysql:host=localhost;dbname=cpaneluser_buja;charset=utf8mb4
        // TiDB / Aiven: mysql:host=gateway01.eu-central-1.prod.aws.tidbcloud.com;port=4000;dbname=buja;charset=utf8mb4
        'dsn'  => $env('DB_DSN',  'mysql:host=localhost;dbname=cpaneluser_buja;charset=utf8mb4'),
        'user' => $env('DB_USER', 'cpaneluser_buja'),
        'pass' => $env('DB_PASS', 'CHANGE-ME'),
        // true for cloud MySQL hosts that require TLS (TiDB Cloud, Aiven). false for cPanel localhost.
        'ssl'  => filter_var($env('DB_SSL', 'false'), FILTER_VALIDATE_BOOL),
    ],

    // Long random string. https://generate-secret.vercel.app/64
    'jwt_secret' => $env('JWT_SECRET', 'CHANGE-ME-TO-64-RANDOM-HEX-CHARACTERS'),

    'session_days' => (int) $env('SESSION_DAYS', '30'),

    // Google Cloud Console > Credentials > OAuth 2.0 Client ID (Web). Optional.
    'google_client_id' => $env('GOOGLE_CLIENT_ID', ''),

    // Public origin, no trailing slash. e.g. https://buja.onrender.com
    'app_origin' => $env('APP_ORIGIN', 'https://yourdomain.com'),

    // Brevo > SMTP & API > API Keys. Leave empty to skip email (verification and password reset then need push or a later phase).
    'brevo_api_key' => $env('BREVO_API_KEY', ''),
    // The sender address Brevo has verified for you.
    'mail_from' => $env('MAIL_FROM', 'hello@buja.ng'),

    // One-time admin actions (for example building Waka road geometry). Any long random string.
    'admin_key' => $env('ADMIN_KEY', ''),
    // openrouteservice.org free key, used once to fetch road paths for routes.
    'ors_api_key' => $env('ORS_API_KEY', ''),

    // Ask Buja. Set ASK_PROVIDER to gemini, groq, anthropic or rules. Whichever keys exist are tried in turn,
    // starting with the one you chose, and Ask falls back to keyword matching if they all fail. All optional.
    // Video calls. meet.jit.si is free and needs no account. Point this at your own Jitsi if you ever run one.
    'jitsi_domain' => $env('JITSI_DOMAIN', 'meet.jit.si'),
    'ask_provider' => $env('ASK_PROVIDER', 'gemini'),
    'gemini_api_key' => $env('GEMINI_API_KEY', ''),      // aistudio.google.com, free, no card
    'gemini_model' => $env('GEMINI_MODEL', 'gemini-3.6-flash'),
    'gemini_endpoint' => $env('GEMINI_ENDPOINT', 'https://generativelanguage.googleapis.com/v1beta/models'),
    'groq_api_key' => $env('GROQ_API_KEY', ''),          // console.groq.com, free, no card
    'groq_model' => $env('GROQ_MODEL', 'llama-3.3-70b-versatile'),
    'anthropic_api_key' => $env('ANTHROPIC_API_KEY', ''),
    'ask_model' => $env('ASK_MODEL', 'claude-haiku-4-5-20251001'),
    'ask_daily_limit' => (int) $env('ASK_DAILY_LIMIT', '40'),

    // Paystack (dashboard.paystack.com > Settings > API Keys). Test key sk_test_... first, then live.
    'paystack_secret' => $env('PAYSTACK_SECRET', ''),
    'paystack_mock' => filter_var($env('PAYSTACK_MOCK', 'false'), FILTER_VALIDATE_BOOL),

    // Cloudflare R2 (or any S3-compatible bucket) for photos and CVs. Leave empty to keep files in the database.
    'r2_account_id' => $env('R2_ACCOUNT_ID', ''),
    'r2_bucket'     => $env('R2_BUCKET', ''),
    'r2_access_key' => $env('R2_ACCESS_KEY', ''),
    'r2_secret_key' => $env('R2_SECRET_KEY', ''),
    'r2_endpoint'   => $env('R2_ENDPOINT', ''),
    'r2_region'     => $env('R2_REGION', 'auto'),

    // Only true when testing on http://localhost.
    'insecure_cookies' => filter_var($env('INSECURE_COOKIES', 'false'), FILTER_VALIDATE_BOOL),
];

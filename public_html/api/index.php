<?php
declare(strict_types=1);

/**
 * Buja API front controller.
 * Every /api/* request lands here. No framework, no Composer: plain PHP 8.1+.
 */

date_default_timezone_set('Africa/Lagos'); // everyone here is in Abuja; storage stays UTC via gmdate()
error_reporting(E_ALL);
ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');

spl_autoload_register(function (string $class): void {
    $file = __DIR__ . '/src/' . $class . '.php';
    if (is_file($file)) { require $file; return; }
    $file = __DIR__ . '/controllers/' . $class . '.php';
    if (is_file($file)) { require $file; }
});

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    Http::json(['error' => 'config_missing', 'message' => 'api/config.php is missing. Copy config.sample.php to config.php and fill it in.'], 500);
}
$config = require $configFile;

set_exception_handler(function (Throwable $e) use ($config): void {
    error_log('[buja] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
    ErrorLog::php($e);   // grouped in Admin, System, with one email to the admin when it is new
    Http::json(['error' => 'server_error', 'message' => 'Something went wrong on our side. Please try again.'], 500);
});

// Fatal errors (out of memory, a missing class) skip the exception handler: catch them on the way out.
register_shutdown_function(function (): void {
    $e = error_get_last();
    if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) ErrorLog::record('php', 'Fatal: ' . $e['message'], basename((string) $e['file']) . ':' . $e['line']);
});

Http::init($config);
$router = new Router();
require __DIR__ . '/routes.php';
$router->dispatch($_SERVER['REQUEST_METHOD'], Http::path());

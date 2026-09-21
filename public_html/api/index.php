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
    Http::json(['error' => 'server_error', 'message' => 'Something went wrong on our side. Please try again.'], 500);
});

Http::init($config);
$router = new Router();
require __DIR__ . '/routes.php';
$router->dispatch($_SERVER['REQUEST_METHOD'], Http::path());

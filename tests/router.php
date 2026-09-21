<?php
// Dev router for php -S: sends /api/* to the front controller, everything else to static files.
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (str_starts_with($path, '/api')) { require __DIR__ . '/../public_html/api/index.php'; return true; }
if (preg_match('#^/p(/|$)#', $path) || $path === '/sitemap.xml' || $path === '/robots.txt') { if ($path === '/sitemap.xml') $_GET['path'] = 'sitemap'; if ($path === '/robots.txt') $_GET['path'] = 'robots'; require __DIR__ . '/../public_html/p/index.php'; return true; }
return false;

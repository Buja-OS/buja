<?php
declare(strict_types=1);
/** @var Router $router */

$router->get('/health',            [HealthController::class, 'show']);

$router->post('/auth/register',    [AuthController::class, 'register']);
$router->post('/auth/login',       [AuthController::class, 'login']);
$router->post('/auth/google',      [AuthController::class, 'google']);
$router->post('/auth/logout',      [AuthController::class, 'logout']);

$router->get('/me',                [MeController::class, 'show']);
$router->patch('/me',              [MeController::class, 'update']);

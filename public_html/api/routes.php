<?php
declare(strict_types=1);
/** @var Router $router */

$router->get('/health',                      [HealthController::class, 'show']);

$router->post('/auth/register',              [AuthController::class, 'register']);
$router->post('/auth/login',                 [AuthController::class, 'login']);
$router->post('/auth/google',                [AuthController::class, 'google']);
$router->post('/auth/logout',                [AuthController::class, 'logout']);

$router->get('/me',                          [MeController::class, 'show']);
$router->patch('/me',                        [MeController::class, 'update']);

// Work: seekers
$router->get('/jobs',                        [JobsController::class, 'index']);
$router->get('/jobs/{id}',                   [JobsController::class, 'show']);
$router->post('/jobs/{id}/apply',            [JobsController::class, 'apply']);
$router->post('/jobs/{id}/save',             [JobsController::class, 'save']);
$router->delete('/jobs/{id}/save',           [JobsController::class, 'unsave']);
$router->get('/me/applications',             [JobsController::class, 'mine']);
$router->get('/me/saved',                    [JobsController::class, 'saved']);
$router->get('/me/seeker',                   [SeekerController::class, 'show']);
$router->patch('/me/seeker',                 [SeekerController::class, 'update']);
$router->post('/me/cv',                      [SeekerController::class, 'uploadCv']);
$router->delete('/me/cv',                    [SeekerController::class, 'deleteCv']);
$router->get('/cv/{id}',                     [SeekerController::class, 'download']);

// Work: companies
$router->get('/company',                     [CompanyController::class, 'show']);
$router->post('/company',                    [CompanyController::class, 'save']);
$router->get('/company/jobs',                [CompanyController::class, 'jobs']);
$router->post('/company/jobs',               [CompanyController::class, 'createJob']);
$router->patch('/company/jobs/{id}',         [CompanyController::class, 'updateJob']);
$router->get('/company/jobs/{id}/applications', [CompanyController::class, 'applications']);
$router->patch('/company/applications/{id}', [CompanyController::class, 'updateApplication']);

<?php
declare(strict_types=1);
/** @var Router $router */

$router->get('/health',                      [HealthController::class, 'show']);

$router->post('/auth/register',              [AuthController::class, 'register']);
$router->post('/auth/login',                 [AuthController::class, 'login']);
$router->post('/auth/google',                [AuthController::class, 'google']);
$router->post('/auth/logout',                [AuthController::class, 'logout']);
$router->post('/auth/forgot',                [AccountController::class, 'forgot']);
$router->post('/auth/reset',                 [AccountController::class, 'reset']);
$router->get('/auth/verify',                 [AccountController::class, 'verify']);
$router->post('/auth/resend-verification',   [AccountController::class, 'resend']);

$router->get('/me',                          [MeController::class, 'show']);
$router->patch('/me',                        [MeController::class, 'update']);
$router->patch('/me/notifications',          [AccountController::class, 'notifications']);
$router->get('/me/today',                    [AccountController::class, 'today']);

// Messages, interviews, push
$router->get('/inbox',                       [MessagesController::class, 'inbox']);
$router->get('/threads/{id}',                [MessagesController::class, 'show']);
$router->post('/threads/{id}/messages',      [MessagesController::class, 'send']);
$router->post('/threads/{id}/interview',     [MessagesController::class, 'invite']);
$router->post('/threads/{id}/inspection',    [MessagesController::class, 'inspection']);
$router->post('/messages/{id}/respond',      [MessagesController::class, 'respond']);
$router->post('/applications/{id}/thread',   [MessagesController::class, 'openForApplication']);
$router->get('/push/key',                    [PushController::class, 'key']);
$router->post('/push/subscribe',             [PushController::class, 'subscribe']);
$router->delete('/push/subscribe',           [PushController::class, 'unsubscribe']);
$router->post('/push/test',                  [PushController::class, 'test']);

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

// Match
$router->get('/match/me',                    [MatchController::class, 'me']);
$router->patch('/match/me',                  [MatchController::class, 'update']);
$router->post('/match/photos',               [MatchController::class, 'addPhoto']);
$router->patch('/match/photos',              [MatchController::class, 'reorder']);
$router->delete('/match/photos/{id}',        [MatchController::class, 'deletePhoto']);
$router->get('/match/photo/{id}',            [MatchController::class, 'photo']);
$router->get('/match/discover',              [MatchController::class, 'discover']);
$router->get('/match/profile/{id}',          [MatchController::class, 'show']);
$router->post('/match/swipe',                [MatchController::class, 'swipe']);
$router->get('/match/matches',               [MatchController::class, 'matches']);
$router->get('/match/likes',                 [MatchController::class, 'likes']);
$router->post('/match/block',                [MatchController::class, 'block']);
$router->post('/match/report',               [MatchController::class, 'report']);

// Waka
$router->get('/waka/places',                 [WakaController::class, 'places']);
$router->get('/waka/routes',                 [WakaController::class, 'routes']);
$router->get('/waka/routes/{id}',            [WakaController::class, 'route']);
$router->get('/waka/plan',                   [WakaController::class, 'plan']);
$router->post('/waka/fares',                 [WakaController::class, 'reportFare']);
$router->post('/waka/checkin',               [WakaController::class, 'checkin']);
$router->get('/waka/saved',                  [WakaController::class, 'saved']);
$router->post('/waka/saved',                 [WakaController::class, 'save']);
$router->delete('/waka/saved/{id}',          [WakaController::class, 'unsave']);

// Homes
$router->get('/homes',                       [HomesController::class, 'index']);
$router->get('/homes/saved',                 [HomesController::class, 'saved']);
$router->get('/homes/photo/{id}',            [HomesController::class, 'photo']);
$router->get('/homes/{id}',                  [HomesController::class, 'show']);
$router->post('/homes',                      [HomesController::class, 'create']);
$router->patch('/homes/{id}',                [HomesController::class, 'update']);
$router->post('/homes/{id}/photos',          [HomesController::class, 'addPhoto']);
$router->delete('/homes/photos/{id}',        [HomesController::class, 'deletePhoto']);
$router->post('/homes/{id}/save',            [HomesController::class, 'save']);
$router->delete('/homes/{id}/save',          [HomesController::class, 'unsave']);
$router->post('/homes/{id}/enquire',         [HomesController::class, 'enquire']);
$router->get('/landlord/me',                 [HomesController::class, 'landlordMe']);
$router->post('/landlord/me',                [HomesController::class, 'landlordSave']);
$router->get('/landlord/properties',         [HomesController::class, 'mine']);
$router->get('/waka/admin/geometry',         [WakaController::class, 'buildGeometry']);

// Declutter
$router->get('/declutter',                   [DeclutterController::class, 'index']);
$router->get('/declutter/saved',             [DeclutterController::class, 'saved']);
$router->get('/declutter/mine',              [DeclutterController::class, 'mine']);
$router->get('/declutter/photo/{id}',        [DeclutterController::class, 'photo']);
$router->get('/declutter/{id}',              [DeclutterController::class, 'show']);
$router->post('/declutter',                  [DeclutterController::class, 'create']);
$router->patch('/declutter/{id}',            [DeclutterController::class, 'update']);
$router->post('/declutter/{id}/photos',      [DeclutterController::class, 'addPhoto']);
$router->delete('/declutter/photos/{id}',    [DeclutterController::class, 'deletePhoto']);
$router->post('/declutter/{id}/save',        [DeclutterController::class, 'save']);
$router->delete('/declutter/{id}/save',      [DeclutterController::class, 'unsave']);
$router->post('/declutter/{id}/chat',        [DeclutterController::class, 'chat']);
$router->post('/threads/{id}/offer',         [DeclutterController::class, 'offer']);
$router->post('/messages/{id}/offer-response', [DeclutterController::class, 'respondOffer']);

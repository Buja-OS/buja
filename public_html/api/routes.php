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

// Ask
$router->post('/ask',                        [AskController::class, 'ask']);
$router->get('/spots',                       [AskController::class, 'index']);
$router->post('/spots',                      [AskController::class, 'create']);
$router->get('/spots/{id}',                  [AskController::class, 'show']);
$router->post('/spots/{id}/rate',            [AskController::class, 'rate']);

// Trust and money
$router->get('/pay/status',                  [PayController::class, 'status']);
$router->post('/pay/plus',                   [PayController::class, 'plus']);
$router->get('/pay/callback',                [PayController::class, 'callback']);
$router->post('/pay/webhook',                [PayController::class, 'webhook']);
$router->get('/verify/status',               [VerifyController::class, 'status']);
$router->post('/verify/{kind}',              [VerifyController::class, 'submit']);
$router->get('/admin/overview',              [AdminController::class, 'overview']);
$router->get('/admin/verifications',         [AdminController::class, 'verifications']);
$router->get('/admin/verifications/{id}/file', [AdminController::class, 'verificationFile']);
$router->post('/admin/verifications/{id}',   [AdminController::class, 'decide']);
$router->get('/admin/reports',               [AdminController::class, 'reports']);
$router->post('/admin/reports/{id}',         [AdminController::class, 'decideReport']);
$router->get('/admin/spots',                 [AdminController::class, 'spots']);
$router->post('/admin/spots/{id}',           [AdminController::class, 'decideSpot']);
$router->post('/admin/radio/sync',           [AdminController::class, 'syncRadio']);
$router->post('/admin/storage/test',         [AdminController::class, 'storageTest']);
$router->post('/admin/storage/migrate',      [AdminController::class, 'migrate']);

// Notifications, avatars, admin users and analytics
$router->get('/notifications',               [NotificationsController::class, 'index']);
$router->post('/notifications/read',         [NotificationsController::class, 'read']);
$router->post('/me/avatar',                  [AvatarController::class, 'upload']);
$router->delete('/me/avatar',                [AvatarController::class, 'delete']);
$router->get('/avatar/{id}',                 [AvatarController::class, 'show']);
$router->get('/admin/users',                 [AdminController::class, 'users']);
$router->get('/admin/users/{id}',            [AdminController::class, 'user']);
$router->post('/admin/users/{id}',           [AdminController::class, 'userAction']);
$router->post('/admin/invite',               [AdminController::class, 'invite']);
$router->get('/admin/analytics',             [AdminController::class, 'analytics']);

// News, Abuja Social, Radio, Match suggestions
$router->get('/news',                        [NewsController::class, 'index']);
$router->post('/news/refresh',               [NewsController::class, 'refreshEndpoint']);
$router->get('/social',                      [SocialController::class, 'index']);
$router->post('/social',                     [SocialController::class, 'create']);
$router->get('/social/{id}',                 [SocialController::class, 'show']);
$router->delete('/social/{id}',              [SocialController::class, 'remove']);
$router->post('/social/{id}/reply',          [SocialController::class, 'reply']);
$router->post('/social/post/{id}/like',      [SocialController::class, 'likePost']);
$router->post('/social/reply/{id}/like',     [SocialController::class, 'likeReply']);
$router->get('/radio',                       [RadioController::class, 'index']);
$router->patch('/radio/{id}',                [RadioController::class, 'update']);
$router->post('/match/suggest',              [MatchController::class, 'suggest']);

// Attachments
$router->post('/uploads',                    [UploadsController::class, 'create']);
$router->post('/uploads/location',           [UploadsController::class, 'location']);
$router->get('/uploads/{id}',                [UploadsController::class, 'show']);
$router->post('/company/logo',               [CompanyController::class, 'logo']);

// Location and Trip Share
$router->post('/me/location',                [LocationController::class, 'update']);
$router->delete('/me/location',              [LocationController::class, 'clear']);
$router->get('/safety',                      [SafetyController::class, 'index']);
$router->post('/safety/contacts',            [SafetyController::class, 'addContact']);
$router->delete('/safety/contacts/{id}',     [SafetyController::class, 'removeContact']);
$router->post('/safety/start',               [SafetyController::class, 'start']);
$router->post('/safety/ping',                [SafetyController::class, 'ping']);
$router->post('/safety/end',                 [SafetyController::class, 'end']);
$router->get('/safety/trip/{token}',         [SafetyController::class, 'publicTrip']);

// Search, invites, reporting
$router->get('/search',                      [SearchController::class, 'index']);
$router->get('/me/invite',                   [InviteController::class, 'index']);
$router->get('/invite/{code}',               [InviteController::class, 'show']);
$router->post('/report',                     [ReportController::class, 'create']);

// Calls and weather
$router->post('/threads/{id}/call',          [CallController::class, 'create']);
$router->get('/call/{room}',                 [CallController::class, 'show']);
$router->post('/call/{room}/end',            [CallController::class, 'end']);
$router->post('/call/{room}/signal',         [CallController::class, 'signal']);
$router->get('/call/{room}/signals',         [CallController::class, 'signals']);
$router->post('/call/{room}/decline',        [CallController::class, 'decline']);
$router->get('/calls/incoming',              [CallController::class, 'incoming']);
$router->get('/weather',                     [WeatherController::class, 'index']);

// Place photos and saved searches
$router->post('/spots/{id}/photos',          [AskController::class, 'addPhoto']);
$router->delete('/spots/photos/{id}',        [AskController::class, 'removePhoto']);
$router->get('/saved-searches',              [SavedSearchController::class, 'index']);
$router->post('/saved-searches',             [SavedSearchController::class, 'create']);
$router->patch('/saved-searches/{id}',       [SavedSearchController::class, 'update']);
$router->delete('/saved-searches/{id}',      [SavedSearchController::class, 'remove']);

// Ratings for people, road alerts, weekly digest
$router->get('/users/{id}/ratings',          [RatingController::class, 'show']);
$router->get('/threads/{id}/rating',         [RatingController::class, 'status']);
$router->post('/threads/{id}/rate',          [RatingController::class, 'create']);
$router->get('/waka/alerts',                 [WakaAlertController::class, 'index']);
$router->post('/waka/alerts',                [WakaAlertController::class, 'create']);
$router->post('/waka/alerts/{id}/vote',      [WakaAlertController::class, 'vote']);
$router->get('/me/digest',                   [DigestController::class, 'preview']);
$router->get('/cron/digest',                 [DigestController::class, 'run']);

// Meetup, Artisans, Citizen Report
$router->get('/events',                      [MeetupController::class, 'index']);
$router->post('/events',                     [MeetupController::class, 'create']);
$router->get('/events/{id}',                 [MeetupController::class, 'show']);
$router->post('/events/{id}/rsvp',           [MeetupController::class, 'rsvp']);
$router->post('/events/{id}/posts',          [MeetupController::class, 'post']);
$router->post('/events/{id}/cancel',         [MeetupController::class, 'cancel']);
$router->post('/events/{id}/checkin',        [MeetupController::class, 'checkin']);
$router->get('/events/{id}/ics',             [MeetupController::class, 'ics']);
$router->get('/artisans',                    [ArtisanController::class, 'index']);
$router->get('/artisans/me',                 [ArtisanController::class, 'me']);
$router->post('/artisans/me',                [ArtisanController::class, 'save']);
$router->get('/artisans/{id}',               [ArtisanController::class, 'show']);
$router->post('/artisans/{id}/chat',         [ArtisanController::class, 'chat']);
$router->get('/citizen/agencies',            [CitizenController::class, 'agencies']);
$router->get('/citizen/reports',             [CitizenController::class, 'mine']);
$router->post('/citizen/reports',            [CitizenController::class, 'create']);

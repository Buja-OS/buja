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

$router->get('/me/tag',                      [TagController::class, 'mine']);
$router->post('/me/tag',                     [TagController::class, 'change']);
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
$router->get('/news/{id}',                   [NewsController::class, 'item']);
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
$router->get('/pulse',                        [PresenceController::class, 'pulse']);
$router->get('/statuses',                     [StatusController::class, 'index']);
$router->post('/statuses',                    [StatusController::class, 'create']);
$router->post('/statuses/{id}/view',          [StatusController::class, 'view']);
$router->get('/statuses/{id}/viewers',        [StatusController::class, 'viewers']);
$router->delete('/statuses/{id}',             [StatusController::class, 'destroy']);
$router->post('/threads/{id}/typing',        [PresenceController::class, 'typing']);
$router->patch('/me/presence',               [PresenceController::class, 'settings']);
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
$router->post('/artisans/me/online',         [ArtisanController::class, 'online']);
$router->get('/artisans/dashboard',          [ArtisanController::class, 'dashboard']);
$router->post('/artisans/schedule',          [ArtisanController::class, 'schedule']);
$router->get('/artisans/me',                 [ArtisanController::class, 'me']);
$router->post('/artisans/me',                [ArtisanController::class, 'save']);
$router->get('/artisans/mine',               [ServiceJobController::class, 'mine']);   // before {id}, which would match 'mine'
$router->get('/artisans/{id}',               [ArtisanController::class, 'show']);
$router->post('/artisans/{id}/chat',         [ArtisanController::class, 'chat']);
$router->get('/artisans/me/menu',             [ArtisanController::class, 'myMenu']);
$router->post('/artisans/me/menu',            [ArtisanController::class, 'addMenuItem']);
$router->patch('/artisans/me/menu/{id}',      [ArtisanController::class, 'updateMenuItem']);
$router->delete('/artisans/me/menu/{id}',     [ArtisanController::class, 'deleteMenuItem']);
$router->patch('/artisans/me/delivery',       [ArtisanController::class, 'delivery']);
$router->get('/citizen/agencies',            [CitizenController::class, 'agencies']);
$router->get('/citizen/reports',             [CitizenController::class, 'mine']);
$router->post('/citizen/reports',            [CitizenController::class, 'create']);

// Tickets
$router->post('/events/{id}/tickets',        [TicketController::class, 'buy']);
$router->post('/events/{id}/scan',           [TicketController::class, 'scan']);
$router->get('/events/{id}/sales',           [TicketController::class, 'sales']);
$router->get('/tickets/mine',                [TicketController::class, 'mine']);

// Admin: the new modules
$router->get('/admin/meetups',               [AdminController::class, 'meetups']);
$router->post('/admin/meetups/{id}',         [AdminController::class, 'decideMeetup']);
$router->get('/admin/artisans',              [AdminController::class, 'artisans']);
$router->post('/admin/artisans/{id}',        [AdminController::class, 'decideArtisan']);
$router->get('/admin/citizen',               [AdminController::class, 'citizen']);

// Passkeys (fingerprint / face)
$router->get('/auth/passkeys',               [PasskeyController::class, 'index']);
$router->post('/auth/passkey/register/options', [PasskeyController::class, 'registerOptions']);
$router->post('/auth/passkey/register',      [PasskeyController::class, 'register']);
$router->post('/auth/passkey/login/options', [PasskeyController::class, 'loginOptions']);
$router->post('/auth/passkey/login',         [PasskeyController::class, 'login']);
$router->delete('/auth/passkeys/{id}',       [PasskeyController::class, 'remove']);

// Operations
$router->get('/ping',                        [OpsController::class, 'ping']);
$router->get('/cron/tidy',                   [OpsController::class, 'tidy']);
$router->get('/admin/launch',                [OpsController::class, 'launch']);

$router->post('/admin/spots-import',         [AdminController::class, 'importSpots']);

// City Pulse

// City signals
$router->get('/light',                       [CityController::class, 'light']);
$router->post('/light/report',               [CityController::class, 'lightReport']);
$router->get('/fuel',                        [CityController::class, 'fuel']);
$router->post('/fuel/stations',              [CityController::class, 'fuelStation']);
$router->post('/fuel/import',                [CityController::class, 'fuelImport']);
$router->post('/fuel/{id}/report',           [CityController::class, 'fuelReport']);
$router->get('/blood',                       [CityController::class, 'blood']);
$router->post('/blood/me',                   [CityController::class, 'donorSave']);
$router->post('/blood/request',              [CityController::class, 'bloodRequest']);
$router->post('/blood/requests/{id}/respond',[CityController::class, 'bloodRespond']);
$router->post('/blood/requests/{id}/close',  [CityController::class, 'bloodClose']);
$router->get('/lostfound',                   [CityController::class, 'lostFound']);
$router->post('/lostfound',                  [CityController::class, 'lostFoundCreate']);
$router->post('/lostfound/{id}/close',       [CityController::class, 'lostFoundClose']);
$router->post('/lostfound/{id}/contact',     [CityController::class, 'lostFoundContact']);
$router->get('/plates/check',                [CityController::class, 'plateCheck']);
$router->post('/plates/report',              [CityController::class, 'plateReport']);
$router->get('/prices',                      [CityController::class, 'prices']);
$router->post('/prices/report',              [CityController::class, 'priceReport']);

// Buja Learn
$router->get('/learn',                       [LearnController::class, 'index']);
$router->get('/learn/certificates',          [LearnController::class, 'mine']);
$router->get('/learn/continue',              [EngageController::class, 'continue']);
$router->get('/learn/{course}',              [LearnController::class, 'course']);
$router->get('/learn/{course}/certificate',  [LearnController::class, 'certificate']);
$router->get('/learn/{course}/{n}',          [LearnController::class, 'lesson']);
$router->post('/learn/{course}/{n}/save',    [LearnController::class, 'save']);
$router->post('/learn/{course}/{n}/complete',[LearnController::class, 'complete']);
$router->get('/cert/{code}',                 [LearnController::class, 'verify']);

// Queues, rides, rent index, learn analytics
$router->get('/queues',                      [CityController2::class, 'queues']);
$router->post('/queues/offices',             [CityController2::class, 'queueOffice']);
$router->post('/queues/{id}/report',         [CityController2::class, 'queueReport']);
$router->get('/rides',                       [CityController2::class, 'rides']);
$router->post('/rides',                      [CityController2::class, 'rideCreate']);
$router->post('/rides/{id}/ask',             [CityController2::class, 'rideAsk']);
$router->post('/rides/{id}/decide',          [CityController2::class, 'rideDecide']);
$router->post('/rides/{id}/stop',            [CityController2::class, 'rideStop']);
$router->get('/rent-index',                  [CityController2::class, 'rentIndex']);
$router->get('/admin/learn',                 [CityController2::class, 'learnStats']);

// Engagement: learner detail, reminders, broadcasts, push nudge
$router->get('/admin/learners',              [EngageController::class, 'learners']);
$router->get('/admin/users/{id}/learning',   [EngageController::class, 'userLearning']);
$router->get('/admin/users/{id}/learning/{course}/{n}', [EngageController::class, 'submission']);
$router->post('/admin/users/{id}/notify',    [EngageController::class, 'notifyUser']);
$router->post('/admin/users/{id}/nudge',     [EngageController::class, 'nudgeUser']);
$router->get('/admin/broadcasts',            [EngageController::class, 'broadcasts']);
$router->get('/admin/broadcasts/count',      [EngageController::class, 'count']);
$router->post('/admin/broadcasts',           [EngageController::class, 'send']);
$router->get('/me/engage',                   [EngageController::class, 'me']);
$router->post('/me/engage/asked',            [EngageController::class, 'asked']);

// Waka pricing and road routes
$router->get('/waka/pricing',                [WakaController::class, 'pricing']);
$router->post('/admin/waka/pricing',         [WakaController::class, 'setPricing']);
$router->get('/route',                       [WakaController::class, 'road']);

// On-demand service jobs with live tracking
$router->get('/service-jobs',                [ServiceJobController::class, 'index']);
$router->post('/service-jobs',               [ServiceJobController::class, 'create']);
$router->get('/service-jobs/offers',         [ServiceJobController::class, 'offers']);
$router->post('/service-jobs/nearest',       [ServiceJobController::class, 'nearest']);
$router->get('/service-jobs/{id}',           [ServiceJobController::class, 'show']);
$router->post('/service-jobs/{id}/where',    [ServiceJobController::class, 'where']);
$router->post('/service-jobs/{id}/ping',     [ServiceJobController::class, 'ping']);
$router->post('/service-jobs/{id}/rate',     [ServiceJobController::class, 'rate']);
$router->post('/service-jobs/{id}/quote',    [ServiceJobController::class, 'quote']);
$router->post('/service-jobs/{id}/quote/{answer}', [ServiceJobController::class, 'answerQuote']);
$router->post('/service-jobs/{id}/{action}', [ServiceJobController::class, 'act']);

// Boarding a vehicle safely
$router->post('/safety/ride',                [SafetyController::class, 'startRide']);
$router->get('/safety/board',                [SafetyController::class, 'board']);
$router->post('/safety/fare-asked',          [SafetyController::class, 'fareAsked']);

// Social and news moderation
$router->get('/admin/social',                [SocialController::class, 'adminIndex']);
$router->post('/admin/social/{id}/{action}', [SocialController::class, 'adminAct']);
$router->get('/admin/news',                  [NewsController::class, 'adminIndex']);
$router->post('/admin/news/{id}/{action}',   [NewsController::class, 'adminAct']);

// Ads (off until an admin switches them on)
$router->get('/ads/config',                  [AdsController::class, 'show']);
$router->get('/admin/ads',                   [AdsController::class, 'admin']);
$router->post('/admin/ads',                  [AdsController::class, 'save']);

// Account deletion (Play Store and App Store requirement)
$router->post('/me/delete',                  [AccountController::class, 'destroy']);
$router->post('/account/delete-request',     [AccountController::class, 'deleteRequest']);

// Buja Tag
$router->get('/tags',                        [TagController::class, 'search']);
$router->get('/tag/{tag}',                   [TagController::class, 'find']);

// Buja Kart
$router->get('/kart/board',                  [KartController::class, 'board']);
$router->post('/kart/times',                 [KartController::class, 'saveTime']);
$router->get('/kart/ghost',                  [KartController::class, 'ghost']);
$router->post('/kart/rooms',                 [KartController::class, 'createRoom']);
$router->post('/kart/rooms/{code}/join',     [KartController::class, 'joinRoom']);
$router->post('/kart/rooms/{code}/invite',   [KartController::class, 'invite']);
$router->post('/kart/rooms/{code}/sync',     [KartController::class, 'sync']);
$router->post('/kart/rooms/{code}/start',    [KartController::class, 'start']);
$router->post('/kart/rooms/{code}/finish',   [KartController::class, 'finish']);
$router->post('/kart/rooms/{code}/again',    [KartController::class, 'again']);
$router->post('/kart/rooms/{code}/chat',     [KartController::class, 'chat']);

// Friends
$router->get('/friends',                     [FriendsController::class, 'index']);
$router->post('/friends',                    [FriendsController::class, 'add']);
$router->post('/friends/{id}/{action}',      [FriendsController::class, 'act']);
// My mechanics
$router->post('/artisans/{id}/save',         [ServiceJobController::class, 'save']);
// Buja Kart garage
$router->post('/kart/gp',                    [KartController::class, 'gpFinish']);
$router->get('/kart/garage',                 [KartController::class, 'garage']);
$router->post('/kart/garage/upgrade',        [KartController::class, 'upgrade']);
$router->get('/kart/achievements',           [KartController::class, 'achievements']);
$router->get('/kart/friend-ghosts',          [KartController::class, 'friendGhosts']);
$router->post('/kart/perf',                  [KartController::class, 'perf']);
$router->get('/kart/tier-hint',             [KartController::class, 'tierHint']);
$router->get('/admin/kart-perf',            [KartController::class, 'adminPerf']);
$router->post('/kart/garage/item',         [KartController::class, 'item']);
$router->post('/kart/garage/paint',          [KartController::class, 'paint']);

// Declutter escrow: Buy safely
$router->post('/escrow/buy/{id}',             [EscrowController::class, 'buy']);
$router->get('/escrow/orders',                [EscrowController::class, 'mine']);
$router->get('/escrow/orders/{id}',           [EscrowController::class, 'show']);
$router->post('/escrow/orders/{id}/{action}', [EscrowController::class, 'act']);
$router->get('/escrow/banks',                 [EscrowController::class, 'banks']);
$router->get('/escrow/account',               [EscrowController::class, 'account']);
$router->post('/escrow/account',              [EscrowController::class, 'saveAccount']);
$router->get('/admin/escrow',                 [EscrowController::class, 'adminIndex']);
$router->post('/admin/escrow/{id}/{action}',  [EscrowController::class, 'adminAct']);

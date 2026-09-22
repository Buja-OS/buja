# Buja, Phase 25: boarding a vehicle safely, and fares that correct themselves

Abuja-only super-app PWA. Six modules: Work, Match, Waka, Homes, Declutter, Ask.
Phase 1 delivers the shell every module plugs into.

## What Phase 1 contains

- App shell: hash router, Home with the six-module grid, four global tabs (Home, Ask, Inbox, Me), placeholder screens for each module naming the phase it arrives in.
- Accounts: create account (name, email, Nigerian phone, password), sign in by email or phone, Continue with Google, sign out. Sessions are 30-day JWTs in an httpOnly cookie, revocable server-side.
- Onboarding: account type (resident, hiring, landlord) and district.
- Settings: Light / Dark / System appearance, notification toggles (wired in Phase 2), About.
- PWA: manifest with maskable icon, service worker (cache-first shell, network-only API), offline page, install to home screen.
- Security: password_hash, prepared statements everywhere, CSRF blocked by a required custom header, same-message login errors, fixed-window rate limiting on auth, HTTPS redirect, security headers, config blocked from the web.

## Stack, on purpose

Plain PHP 8.1+ with PDO and no framework, MySQL 8 or MariaDB 10.6+, vanilla ES modules on the client, Font Awesome 6 Free icons inlined as SVG, Inter from Google Fonts. Built to run on shared cPanel hosting today and move to a VPS later without a rewrite: stateless API, external storage from Phase 2, no server-side sessions.

## Layout

```
public_html/
  index.html              shell; add <meta name="google-client-id"> here to enable Google
  css/app.css             design tokens (light + dark) and components
  js/app.js               router and screens
  js/api.js               API client; falls back to a local mock when no API is reachable
  js/store.js             state, theme
  js/ui.js                small rendering helpers
  js/icons.js             inlined Font Awesome paths
  api/index.php           front controller: autoload, config, error handler, dispatch
  api/routes.php          the endpoint table
  api/src/                Http, Router, Db, Jwt, Auth, Validator, RateLimit, Google
  api/controllers/        AuthController, MeController, HealthController
migrations/001_init.sql   users, sessions, rate_limits
```

## API (Phase 1)

| Method | Path            | Body                                           | Notes |
|--------|-----------------|------------------------------------------------|-------|
| GET    | /api/health     |                                                | ok, php, db |
| POST   | /api/auth/register | name, email, phone, password, agree         | 201, sets cookie |
| POST   | /api/auth/login | identifier (email or phone), password          | sets cookie |
| POST   | /api/auth/google| credential (Google ID token)                   | creates or links |
| POST   | /api/auth/logout|                                                | revokes session |
| GET    | /api/me         |                                                | user or null |
| PATCH  | /api/me         | kind, district, phone, name (any subset)       | |

All non-GET calls require the header `X-Buja-Client: pwa`. Errors are JSON: `{ error, message }` or `{ error: "validation", fields: { field: message } }`.

## Phase 2a: Work (jobs board)

- Companies: company profile, post and edit vacancies with weighted requirements (weights total 100), open/close, applicants ranked by match score with status flow new → shortlisted → interview → hired / rejected, CV access limited to applicants who applied to you.
- Seekers: feed with search and district chips, job detail, CV on file (PDF or Word, 2 MB, stored in the database until Phase 4 moves it to object storage), requirements checklist with live match percentage, apply once per role, saved jobs, profile with headline, years, open-to-work, skills, application statuses.
- New files: `api/src/Work.php`, `api/controllers/JobsController.php`, `SeekerController.php`, `CompanyController.php`, `js/work.js`, `migrations/002_work.sql`. Router now supports `{id}` parameters; `Http::file()` reads multipart uploads.

## Phase 2b: messages, interviews, push, email

- Inbox and threads: one conversation per application, opened by either side from the applicant card or the seeker's application. Text messages, 5-second polling while a thread is open, unread counts on the Inbox tab and on Home.
- Interview invitation: a structured card (date, time, place, with, note) the company sends from the thread. The seeker confirms or suggests another time; confirming moves the application to Interview and puts the date on both Today lists.
- Push notifications: Web Push implemented natively in `api/src/WebPush.php` (VAPID ES256 + RFC 8291 aes128gcm, verified against the RFC test vector). VAPID keys are generated on first use and stored in `app_keys`, so there is nothing to configure. Sent on new application, new message, invitation, confirmation. Dead subscriptions are pruned on 404/410.
- Email via Brevo (`api/src/Mail.php`): verification link at sign-up, password reset link, and interview invitation fallback when the seeker has no push subscription. Needs `BREVO_API_KEY` and a verified `MAIL_FROM`; skips silently otherwise.
- Notification preferences per module in Settings, push toggle with a test notification, unverified-email banner with resend, forgot and reset password screens.
- New: `api/src/WebPush.php`, `Notify.php`, `Mail.php`, `api/controllers/MessagesController.php`, `PushController.php`, `AccountController.php`, `js/messages.js`, `migrations/003_messages_push.sql`.

## Phase 3: Match

- Profile: four-step setup (basics with an 18+ date-of-birth gate, photos, about, who you see), then editable from Me. Up to six photos, resized on the phone to 1200px JPEG before upload, capped at 700 KB and 2400px on the server, stored in the database for now.
- Discovery: candidates filtered by gender, mutual seeking, age range, optional "my district and nearby" using an FCT adjacency map in `api/src/MatchRules.php`, excluding anyone already swiped or blocked. Ranked by a transparent score: shared interests, same faith, proximity, same view on kids. Shared interests are highlighted on the card.
- Like, pass, super like (one a day on the free plan). Mutual like creates a match and a `match` thread in the shared Inbox, with a push notification and the It's a match overlay.
- Full profile with photo gallery, prompts and basics; block and report (report blocks too). Blocked users cannot see each other's photos, profiles or messages.
- Matches grid; Liked you with the newest like shown in full and the rest locked for the coming Buja Plus.
- New: `api/src/MatchRules.php`, `api/controllers/MatchController.php`, `js/match.js`, `migrations/004_match.sql`.

## Phase 4: Waka

- Directory of 34 Abuja parks, junctions and landmarks and 15 routes (bus, keke, one rail line) with ordered stops, seeded in `migrations/005_waka.sql`. Coordinates and starting fares are estimates flagged "est." until riders confirm.
- Planner: pick any two places; direct routes in either direction, then one-transfer options through a shared stop, each with per-leg fare, distance, time at Abuja speeds, what to tell the driver, and a taxi-drop estimate. Cheapest and fastest tagged.
- Crowd fares: riders report what they paid; the fare shown is the median of the last 30 days with the report count. Reports must be between two stops of that route.
- Riders now: "I'm on this route" check-ins count distinct riders in the last 15 minutes, shown on the map and in lists. This is what "live" means until a vehicle-tracking partner exists.
- Map: Leaflet 1.9 from cdnjs over OpenStreetMap tiles, loaded only when a map is shown, with a text fallback if the library cannot load. Route lines and stop markers; riders-now badge at the midpoint.
- Saved routes (up to 10) on the Waka home and under Me.
- New: `api/src/WakaRules.php`, `api/controllers/WakaController.php`, `js/waka.js`, `migrations/005_waka.sql`.

Note on tiles: OpenStreetMap's public tile server is fine for testing and early users. Before real traffic, switch the tile URL in `js/waka.js` to a MapTiler or Stadia free key, or self-host Protomaps.

## Phase 5: Homes

- Landlord accounts (chosen at onboarding) set up a landlord profile (person or real estate company), post properties for rent or sale with type, district, area or landmark, price, beds, baths, facilities, description, years upfront, legal and caution fees, and up to 10 photos (compressed on the phone). Status: available, let, sold, hidden.
- Search: rent or buy; filters for type, max price, bedrooms, districts, must-have facilities, and sort by minutes to Central Area (from district centres in `api/src/HomesRules.php`). Every card says Direct from landlord or Real estate company. Result line counts direct listings.
- Property page: photos, price, facts, facilities, landlord card with listing count, and for rent a savings strip (10% agent fee avoided) plus the legal and caution fees the landlord stated.
- Enquiry opens a `homes` thread in the shared Inbox. The enquirer requests an inspection (date, time, note) as a card; the landlord confirms or suggests another time; confirmed inspections appear on both Today lists. Landlord dashboard shows views, enquiries, inspections, saved-by-others.
- Waka: `/api/waka/admin/geometry?key=ADMIN_KEY` fetches real road paths for all routes once from OpenRouteService (`ORS_API_KEY`) and stores them; the map then draws roads instead of straight lines.
- New: `api/src/HomesRules.php`, `api/controllers/HomesController.php`, `js/homes.js`, `migrations/006_homes.sql` (also adds `threads.property_id`, `threads.listing_id`, `routes.geometry`, and the `inspection` and `offer` message types).

## Phase 6: Declutter

- Any resident lists an item: title, category (13 Abuja-relevant categories), condition, price with negotiable or fixed, district only, handover (pickup, delivery, either), description, up to 8 photos compressed on the phone, and an opt-in to Buja escrow when payments launch. Mark sold, hide, relist.
- Feed: search, category chips, sorted by Near me (own district, then neighbouring districts from the Match adjacency map, then the rest), Newest, or Cheapest. Saved items.
- Item page: photos, condition and handover chips, seller card (first name and initial, phone-verified, sold and listed counts, district, member since), safety line above the actions.
- Chat opens a `declutter` thread in the shared Inbox. Buyers make offers as cards (refused below 30% of asking); the seller accepts or declines and an automatic reply reminds both to pay only on handover. My listings shows chats and offers waiting.
- New: `api/controllers/DeclutterController.php`, `js/declutter.js`, `migrations/007_declutter.sql`.

## Phase 7: Ask Buja

- A directory of places (`spots`) seeded with 20 well-known Abuja spots and grown by residents: name, category, district, area, tags, price level and typical spend, description, hours. Community-added places show as such until the Buja team verifies them. Ratings with a one-line comment; pages show the average, count and recent reviews.
- Ask: with `ANTHROPIC_API_KEY` set, the question and the whole directory (compacted) go to the model (`ASK_MODEL`, default Claude Haiku 4.5) with a system prompt that only allows recommending places by id from the directory, returning JSON: a two-sentence answer, one to four spots with a short reason, two follow-ups. Without a key, or if the model fails, a keyword matcher over categories, tags, names, districts and price words answers from the same directory, and the app says so. Either way, nothing is invented.
- Every place card has Waka there, which opens the planner with the destination district pre-filled. Home's Ask bar sends the question straight in. Questions are logged with the returned ids so gaps in the directory are visible. Daily limit per user (`ASK_DAILY_LIMIT`, default 40).
- New: `api/controllers/AskController.php`, `js/ask.js`, `migrations/008_ask.sql`.

## Phase 8a: trust and money

- **Admin panel** (`/#/admin`, for users with `is_admin`; migration 009 makes the first account the admin): overview counters, verification queue with the submitted selfie beside the first Match photo, reports queue with dismiss or suspend (signs the user out everywhere and hides their listings), places-to-verify queue for Ask, storage test and one-click migration of files to R2.
- **Verification**: selfie for Match (badge on cards and profiles) and a title document for landlords (Verified badge on listings). Submissions are private to admins and the file is deleted on approval. Rejections carry a note back to the user.
- **Buja Plus** through Paystack (`PAYSTACK_SECRET`; `PAYSTACK_MOCK=true` simulates success for local tests): ₦3,500 for 30 days, no auto-renewal. Unlocks everyone who liked you, five super likes a day, invisible mode. Paid via the callback and confirmed again by the signed webhook (`/api/pay/webhook`, register it in Paystack).
- **Object storage**: `api/src/Media.php` speaks S3 Signature V4 to Cloudflare R2 (`R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY`, `R2_SECRET_KEY`). When configured, new photos and CVs go to the bucket and are served through short-lived signed URLs; existing files can be moved in batches from the admin panel. Not configured, everything stays in the database as before.
- New: `api/src/Paystack.php`, `api/src/Media.php`, `api/controllers/PayController.php`, `VerifyController.php`, `AdminController.php`, `js/trust.js`, `migrations/009_trust.sql`.

## Phase 9a: notification centre, profile pictures, real admin

- **Notification centre** behind the bell on Home: every push or email Buja sends is also stored in-app (`notifications`), with an unread dot, a list that deep-links to the thread, listing or screen, and mark-all-read. Fixes the bell that was only decorative.
- **Profile pictures** for every account: square-cropped on the phone, stored in R2 when configured, shown on Me and in the admin user list.
- **Admin, properly**: Users (search by name, email or phone; filter by kind, staff, suspended; paging), a user page with contact, trust status, activity counts and sessions, role control (user, moderator, admin), sign out everywhere, suspend and restore, delete with all data. Invite by email with a sign-up link that carries the role, or instant promotion for an existing account. Analytics: active users today, 7 days and 30 days, active users and sign-ups per day for 7, 30 or 90 days, usage by module and action with distinct people, accounts by kind, top districts, revenue by month. Moderators see only the queues.
- Activity is recorded in `events` from this version on (`api/src/Track.php`), so analytics start counting at deploy.
- New: `api/src/Track.php`, `api/controllers/NotificationsController.php`, `AvatarController.php`, `migrations/010_admin_notifications.sql`.

## Phase 9b: researched Waka, News, Abuja Social, Radio

- **Waka rebuilt from research.** 71 boarding points with coordinates (parks, junctions, landmarks and all 12 light-rail stations) and 26 routes across four modes:
  - **Green bus** (AUMTCO): published government fares, e.g. Kubwa–Wuse ₦200, Nyanya–Wuse ₦200, Wuse–Gwagwalada ₦400. Cheap but few buses run.
  - **Along cab**: the shared taxi most people actually take, often a worker filling their car. 2025 commuter prices: Kubwa–Berger ₦1,000, Nyanya–Secretariat ₦700, Mararaba–Wuse ₦800, Lugbe–Wuse ₦1,100.
  - **Keke** inside districts, and the **light rail** (Gbazango–Idu–Abuja Metro and Idu–Airport), free at present, four trips a day on weekdays, with Idu as the interchange.
  The planner offers both the cheap-and-slow and the quick-and-dear option for the same trip and tags them, with one transfer where no single route goes the whole way. Route notes carry local knowledge (which side of Berger to board, when the parks fill, night risk).
- **News**: every half hour Buja reads the RSS feeds of Punch, Premium Times, Daily Trust, Vanguard, Guardian, Channels, Leadership and TheCable, keeps only Abuja and FCT stories, scores them and files them by category (transport, security, power, housing, jobs, life). Only stories scoring 3 or more (road closures, strikes, fuel scarcity, floods, security alerts) send a notification, capped at three a day so the drawer stays readable. No API key needed.
- **Abuja Social**: a forum with nine boards, posts tagged to a district, replies, likes, and first-name-plus-initial identity. Authors are notified of replies; moderators and admins can remove posts.
- **Radio**: all 24 FCT stations by frequency with genre and station link, an in-app player, and a mini player that keeps going while you read. Streams come from Radio Garden: an admin taps Sync in the admin panel and Buja pulls the live stream for every Abuja station, matching them to the dial by frequency and adding any it does not have. Re-runnable any time the streams change.
- **Match** suggests people who have joined near you in the last fortnight, once a day at most, never the same person twice.

## Phase 9c: attachments, in-app radio, business photos

- **Radio plays inside Buja.** 21 of the 35 FCT stations now carry a confirmed stream (Cool FM, Wazobia, Nigeria Info, Ray Power, Vision, Kapital, Aso, Beat, Classic, Liberty, Real, Bright, World, Oganiru and more). The player is global: start a station and it keeps playing while you browse Work, Match or chat, with a bar showing what is on and a pause and stop control. Stations with no stream are listed separately and link to their own site.
- **Attachments everywhere**, on one `uploads` table: photo (5 MB), video (40 MB), voice note recorded in the app with MediaRecorder (12 MB), document (15 MB, PDF, Word, Excel, text, zip) and a pinned location from the phone's GPS, which renders as a card that opens in maps. Images are resized on the phone before upload; files go to R2 when configured. An upload belongs to the person who made it, can be attached once, and is readable only by people in that thread or post.
- **Social** takes a photo or video per post and per reply, turns any YouTube link into an embedded player, and makes plain links clickable.
- **Companies and landlords** upload a logo or photo, shown on every vacancy and every property listing.
- New: `api/controllers/UploadsController.php`, `migrations/012_media.sql`, attachment rendering in `js/ui.js`.

Bugs fixed in this pass: tracking calls that ran between an insert and reading back its id, which had broken posting in Homes, Declutter and Social; a variable in the Waka planner that clobbered the destination and produced a 1,300 km trip; a duplicate timer name that stopped the whole app loading; and the radio player being declared after first use.

## Phase 9d: Match on GPS, and Trip Share

- **Real distances in Match.** Tap once to share your location and every card shows how far away the person is ("4 km away", or "under 1 km" so nobody can be pinpointed). Positions are stored to three decimals, about 100 metres, never shown to anyone, and only ever turned into a distance. A new filter finds people within 2 to 40 km; the district filter still works for anyone who prefers not to share a position.
- **Trip Share**, for meeting someone from Buja. Start a trip with where you are going, who with, and how long before your friend should worry. Buja gives you a private link to send on WhatsApp. Your friend opens it with no account and sees a live map of where you are, when you are due back, and a plain instruction if something looks wrong. Position updates every two minutes while the app is open.
  - **I am home safe** ends it. **+1 hour** extends it. **Something is wrong** raises the alarm and the link turns red with "call them now, then call 112".
  - If you pass your time without ending the trip, the link says overdue by itself.
  - Up to five trusted contacts, and a Meeting up? shortcut inside every Match conversation.
  - The public page shows a first name and a position and nothing else: no phone, no email, no token, not even which contact was chosen.
- New: `api/controllers/SafetyController.php`, `LocationController.php`, `js/safety.js`, `migrations/013_location_safety.sql`.

## Phase 9e: finding things, bringing people, keeping it clean

- **One search** across the whole app from the Home header: jobs by title or company, homes, items for sale, places in Ask, Social posts and Waka stops, grouped by kind.
- **Invites.** Every account gets a six-character code and a link. Someone opening it sees who invited them before they sign up, and the inviter is told when they join and can see who came in through them. This is the honest answer to the cold-start problem: a jobs board with no jobs is useless until people bring their people.
- **Install Buja** as an app: the Android prompt where the browser offers it, and the three Safari steps on iPhone, which is also the only way to get notifications there.
- **Report anything**, not just people: listings, properties, posts, vacancies and places, with six common reasons and a free-text line. Everything lands in the one moderator queue, which now shows what was reported with a link to it and a Take it down button that hides the content and tells the owner.
- **Terms of use and Privacy** pages, written plainly, readable without an account, linked from Settings.
- **An honest fix:** Buja was showing "Phone verified" on Declutter and Match when all that had happened was somebody typed a number. That claim is gone. Sellers now show "Verified with a selfie" if they passed verification, or "Phone on file" if not. Real phone verification needs an SMS provider and will come with a budget for it.
- New: `api/controllers/SearchController.php`, `InviteController.php`, `ReportController.php`, `js/growth.js`, `migrations/014_growth.sql`.

## Phase 9f: Ask works on free AI

- **Any provider, one setting.** `ASK_PROVIDER` takes `gemini`, `groq`, `anthropic` or `rules`. Whichever keys exist are tried in turn starting with the one you chose, so a missing key, a spent daily quota or a provider outage drops to the next one and finally to the keyword matcher. Ask never breaks, it only gets simpler.
  - Gemini (`GEMINI_API_KEY`) from aistudio.google.com: free, no card, the largest daily allowance.
  - Groq (`GROQ_API_KEY`) from console.groq.com: free, no card, very fast.
  - Anthropic (`ANTHROPIC_API_KEY`): pay as you go, no free tier.
- **Only the relevant places are sent.** A question is matched against categories, tags, names and districts first, and at most 40 places go to the model. Measured: with 500 places in the directory the prompt stays about 2,900 tokens, so the free tier lasts and a paid provider would cost roughly a quarter of a cent a question.
- **Grounding is enforced after the answer, not just asked for.** Any place id the model returns that is not in what we sent is dropped, and an unparseable answer falls through to the keyword matcher. Tested by making a stub provider invent a place and return junk.
- Admin panel shows which provider is in use, the fallbacks behind it, questions asked today, and a seven-day split by provider so you can see when a free quota runs out.
- **What is never sent to an AI provider:** messages, CVs, profiles, photos, locations. Only the question and the public place directory.

## Phase 9g: your actual position, and real places from the map

- **Waka picks up where you are.** "Use where I am now" in the place picker reads the phone's GPS and lists the six nearest stops with real distances ("0 m from Jabi Motor Park", "665 m from Jabi Lake Mall"), so nobody has to guess which junction they are standing at. It also saves the position for Match distances.
- **Ask answers from the real map.** When Buja's own directory has fewer than four places matching the kind of thing asked about, Buja queries OpenStreetMap through the free Overpass API around the district named in the question, or the user's position, and writes what it finds into the directory: name, category, district resolved from Buja's own surveyed stops, coordinates, hours and cuisine where OSM has them. Those places are marked "found on OpenStreetMap, nobody on Buja has reviewed it yet" and carry a Map link, so residents can rate and correct them and a moderator can remove them. No key, no bill.
- **Map credit is now a small ⓘ** in the corner rather than a line of text across the map. The licence requires the credit to be reachable, not printed, so tapping it shows it.
- New: `api/src/Osm.php`, `migrations/015_osm.sql`.

## Phase 9h: two fixes found in the live log

- **Gemini was 404ing on every call.** Google retired `gemini-2.5-flash` for new keys and the error said to use `gemini-3.6-flash`. The default is updated and still overridable with `GEMINI_MODEL`. Provider errors now log the message rather than the first 200 bytes of HTML, so the next one is obvious.
- **The map lookup could hang for 44 seconds.** Both Overpass servers timed out at 22 seconds each before Buja gave up. Timeouts are now 6 seconds with a 3 second connect limit, Nominatim is a second source when Overpass is down, and a failed lookup for a category near a point is remembered for an hour so nobody waits on the same dead end twice. Measured: a failing lookup now costs under a second on the repeat.
- New: `migrations/016_appkeys.sql`, a small key/value table the server uses for notes like this.

## Phase 9i: live position, real distances, map thumbnails

- **Ask uses the phone's position.** Every question carries the current GPS fix if the phone gives one within four seconds, and never waits longer than that. "Near me", "closest" and "nearest" force it to win over anything stored; a district named in the question still wins over both. The fix is also saved so Match distances stay current.
- **Ranked by how far away things actually are.** Places within a kilometre get full marks, ten kilometres or more gets a penalty, and for any "near me" question the answer is sorted nearest first. Verified from three positions: standing in Maitama gives Wakkis at 0.95 km first; the same question at Jabi reorders the whole list.
- **Every card carries a real map thumbnail**, the OpenStreetMap tile the place sits on, shifted so the spot is centred with a pin over it. Free, works for any place with coordinates, and honest about being a map rather than a photograph. The place screen shows a large one that opens in maps.
- Coordinates added for all 22 seeded places (`migrations/017_spot_coords.sql`), so distances and thumbnails work from the first question rather than only for places found on the map.

Bugs fixed: the live position was read from a variable that was never defined, so it was always ignored; and distance was read from the stored position rather than the fix just sent.

## Phase 9j: video and audio calls, weather, and a voice-note fix

- **Voice notes were broken and now work.** The server checked a file's own bytes and a browser recording comes back as `application/octet-stream` or `video/webm`, neither of which was allowed, so every voice note was rejected. Buja now reads the container's magic bytes and maps it properly: webm, mp4, ogg, wav and mp3 from Android, iPhone and Firefox recorders. A jpeg or an executable renamed to .webm is still refused.
- **Calls inside Buja.** Jitsi embedded in a Buja screen, never handing anyone off to another app. Rooms are 32 random characters, so they cannot be guessed, and only the two people in that conversation can open one.
  - **Match chat**: Video and Call buttons at the top of the thread. A card lands in the conversation and the other person gets a push.
  - **Virtual interviews**: when scheduling, a company picks "Video call on Buja" instead of an address. Buja makes the room, the card carries a Join button, and the room opens 15 minutes before the time and refuses before that.
  - Audio calls start with the camera off. The Jitsi app promo, deep links and invite buttons are disabled so nobody leaves Buja.
  - `JITSI_DOMAIN` defaults to meet.jit.si, which is free and needs no account; point it at your own server later without touching code.
- **Abuja weather on the home screen**: temperature, what it feels like, today's range, rain chance and a line of advice ("Carry an umbrella, and leave earlier than usual"). Open-Meteo, free, no key, cached half an hour, and the last reading is reused if the service is slow.

Verified: voice notes from three recorder formats plus two forgeries; starting a call, joining, an outsider being refused, a scheduled call refusing early joins, and ending a call. Not verified end to end in the sandbox: the virtual-interview branch specifically, which reuses the same room and join code.

## Phase 9k: chat calls are peer to peer, not a meeting room

Jitsi stays where it belongs, on interviews, where a scheduled room with a lobby is the right shape. Chat calls
are now a real phone call: the two devices connect directly over WebRTC and Buja only passes the handshake.
No third party sits in the middle, no audio or video ever touches the server, and the screen is Buja's own.

- Full-screen call UI: the other person's video edge to edge, your own preview in the corner, mute, camera
  off, switch camera, hang up, and a running timer once connected. Audio calls show a large initial instead.
- An incoming call banner appears anywhere in the app with Answer and Decline, and a push notification covers
  the case where Buja is closed. Declining tells the caller; 45 seconds with no answer gives up.
- Signalling rides on Buja's own API: `/call/{room}/signal` and `/signals`. You never receive your own
  messages, and only the two people in that conversation can read any of it.
- STUN is free and public. `TURN_URL`, `TURN_USER` and `TURN_PASS` add a relay for networks that refuse a
  direct connection, which is worth adding once real users are on mobile data.

Verified with two browsers calling each other: ringing, the banner appearing on the second phone, answering,
audio flowing both ways with a timer running on both sides, and hanging up ending it for both.
Bug fixed on the way: the incoming-call watcher started before anyone was signed in, and the banner used a
CSS variable that did not exist so it sat off-screen.

## Phase 9l: one call system, WhatsApp placement, speaker and screen share

- **Jitsi is retired.** Every call in Buja, interviews included, now runs phone to phone over WebRTC on
  Buja's own screen. One system, one look, nothing handed to another service.
- **Call buttons sit in the chat header**, where people expect them: a video camera and a phone handset,
  in that order, top right of every conversation.
- **Proper call icons** added to the icon set: phone, phone-slash, video, video-slash, microphone-slash,
  speaker on and off, screen share, flip camera. Nine new Font Awesome paths inlined, still no icon font.
- **The call screen redesigned**: a soft gradient, a pulsing avatar while it rings, the other person's video
  edge to edge once connected, your preview in the corner, a round red handset to end. Controls in one row:
  Mute, Speaker, Camera, Flip, Share, each labelled and lighting up when active.
- **Speaker toggle** switches the audio output where the browser allows it, and says so plainly where it does not.
- **Screen sharing** for interviews, shown only where the browser supports it, and it drops back to the
  camera by itself when you stop sharing.
- **Ringing notifications** now carry Answer and Decline buttons, vibrate, and stay on screen until
  answered rather than fading away. Declining from the notification tells the caller without opening Buja.

Verified with two browsers: header buttons, ringing, the banner, answering, audio and video flowing both
ways with a timer on both sides, mute, speaker, camera and hang up.

## Phase 10: photographs, and saved searches with alerts

- **Places have photographs now.** Anyone can add up to three photos to a place, eight in total per place,
  resized on the phone before upload. The first photo becomes the card image in Ask, so the directory turns
  into something people browse rather than read. The map thumbnail stays as the fallback for places nobody
  has photographed yet. Whoever added a photo can remove it, and so can a moderator; nobody else.
- **Saved searches.** Set your filters in Work, Homes or Declutter, tap Save this search, and Buja names it
  for you ("to rent in Lugbe under ₦1,200,000", "\"generator\" under ₦250,000"). When somebody posts
  something that matches, you get a notification with the title and price. This is the feature that makes
  people open the app because it told them to, rather than out of habit.
  - Alerts can be turned off per search without losing the search, each one shows how many matches it has
    found, and Open it takes you back to exactly those filters.
  - Matching runs against the newly posted row only, so it costs one small query per post, not a scan.
  - Up to twelve saved searches, and your own posts never alert you.
- New: `api/src/Alerts.php`, `api/controllers/SavedSearchController.php`, `js/alerts.js`,
  `migrations/020_photos_alerts.sql`.

Verified: adding and viewing a photo, the same upload being refused twice, deletion allowed for the author
and a moderator but refused for anyone else; saving a search, a matching home and a matching item both
notifying, non-matching posts staying silent, the hit counter, and alerts going quiet when switched off.
Bug fixed: a tracking insert sat between saving a search and reading it back, the same last-insert-id
mistake I made in Phase 9c.

## Phase 11: rating people, roads right now, the weekly email, ringtones

- **Ratings for people.** You can rate someone only after you have both spoken in a conversation here, once
  per conversation, with stars, ready-made tags for what actually happened ("Showed up on time", "Item not
  as described", "Asked for money upfront") and an optional line. The summary shows on seller and landlord
  cards, and `#/people/{id}` is a public page of how somebody deals with people. Tags differ per module,
  because what matters in Homes is not what matters in Match.
- **Roads right now.** Nine kinds of report: heavy traffic, road blocked, accident, flooded, checkpoint,
  fuel queue, protest, no vehicles, and moving freely again. A report goes to people who saved a route
  through that stop first, then to people in that district, never to everybody. Duplicates merge into one
  alert and extend it rather than cluttering the list, riders vote "still there" or "it has cleared", and
  every alert dies on its own, in two to five hours depending on what it is.
- **The weekly digest.** New jobs in your district, homes and items matching your saved searches, the most
  talked-about Social posts, and anything waiting in your inbox. Sent to a few people per request so a free
  host never times out, and skipped entirely when there is nothing worth an email. Preview it any time at
  `/me/digest`, and turn it off in Settings. Schedule it by calling `/api/cron/digest?key=ADMIN_KEY` weekly.
- **Ringtones.** Calls now ring: a double tone for an incoming call with vibration, a softer ringback while
  you wait for an answer. Made with the browser's own audio, so nothing to download and it works offline.

Verified: rating once and being refused twice, a stranger being refused entirely, the summary appearing on
the seller card, the notification to the rated person; reporting an alert, a duplicate merging and bumping
the count, voting it cleared, and the notification reaching a rider with that route saved; the digest
preview, the cron running and then skipping people already sent this week.
Bugs fixed: a MySQL-only statement that broke alert merging on any other database, and the digest reading
pay columns by the wrong name.

## Phase 12: three new modules and a round of fixes

**Fixes**
- Virtual interviews open at the time set and stay open 30 minutes, then close. Early joins are told the time and how long to wait; late ones are told to ask for a reschedule. The card says so.
- Trip Share links now open for a signed-in person too; they were being bounced to Home by the guest-only flag.
- Weather shows on Home. The strip was never in the page (an edit that matched nothing), and Open-Meteo throttles Render's shared address, so wttr.in is a second source and a stale reading is kept for six hours.
- Radio has previous, play/pause, next and stop in a redesigned bar, and the phone's lock screen controls work through the Media Session API.
- The Meetup tables are named `meetups`, because `events` was already the analytics log; `CREATE TABLE IF NOT EXISTS` would have silently skipped it in production.
- Interview scheduling and the notification toggles were calling the wrong API functions after a name collision (fixed in the previous patch); a duplicate-name check now runs on every build.

**Meetup**: anyone posts an event (12 categories, venue or online, capacity, price, cover photo). People register with guests, a full event waitlists them and promotes the first in line when someone drops out, hosts post updates that notify everyone going, see who is coming, check people in at the door, and cancel with a notice to all. Add-to-calendar via .ics. Buja does not take payment; hosts collect at the door or by transfer.

**Artisans**: 28 trades from mechanic and vulcanizer to CCTV, DStv, laundry and errand. Artisans list themselves with a phone, WhatsApp, base district, how far they travel, years, a photo and a pinned shop location. Searching uses the phone's position and returns the nearest first, inside their working radius, with distance shown. Call, WhatsApp, message in Buja or Buja audio call, straight from the card. Ratings come only from people who contacted them through Buja, with artisan-specific tags.

**Citizen Report**: which agency handles what in Abuja, with contacts researched on 21 September 2026 against official sites and reputable outlets, tiered by how well verified they are. 112 sits at the top of every screen. Refuse and noise route to the FCTA central desk because AEPB publishes no working line. Pick the problem, call, WhatsApp or email straight from the card, or write it up: Buja saves it with a reference number and opens the phone or email with the text ready.

New: `MeetupController.php`, `ArtisanController.php`, `CitizenController.php`, `js/services.js`, `migrations/022_meetup_artisans_report.sql`.

## Phase 13: Meetup earns, admins can moderate, search knows everything

- **Paid tickets** on Paystack. Buja keeps 5% plus ₦100 per ticket, the host gets the rest by transfer after the event. Each ticket has an eight-letter code shown on a dashed card; the host has a Door screen that checks a code once and refuses it a second time, and a Sales screen showing gross, fee and what they are owed. Both buyer and host are notified on every sale. A paid event refuses free registration. `PAYSTACK_MOCK=true` settles instantly for testing; with a real `PAYSTACK_SECRET` the existing callback and webhook route ticket references too.
- **Recurring events**: weekly, fortnightly or monthly. Buja creates the next eight dates up front so they all appear in the list, and cancelling offers to remove the rest of the series.
- **Admin**: Events (hide, show, cancel with notice; shows tickets sold and payout owed), Artisans (verify after a phone call, which puts a Buja verified badge on the card; hide), Citizen reports (last 30 days by problem, and the recent copies residents kept). Overview shows upcoming events, artisans listed, reports this month, ticket sales and Buja's fees.
- **Search** now returns events, artisans (by name or trade) and the right agency for a problem.
- My tickets under Me.

Verified: a weekly series of nine dates; free RSVP refused on a paid event; buying two tickets; fee maths (₦600 on ₦10,000); buyer and host notified; second purchase refused; door scan accepting once and refusing the reuse with the time and name; a stranger refused at the door; series cancellation; search across the three new types; artisan verify and hide from the admin.

## Phase 14: Google, and sign in with a touch

- **Google sign-in works now.** The server side and the email linking were already built; the page just never received the client ID, so the button always said "not set up". The ID now travels from `GOOGLE_CLIENT_ID` in Render to the page through `/api/health`, the Google script loads on demand, and the official button is used rather than the One Tap prompt, which phones often block. Someone who signed up with an email and later taps Google with the same address is linked to their existing account, and a brand-new Google account still goes through onboarding to choose resident or company.
- **Fingerprint and face sign-in** (WebAuthn passkeys), with no library: a small CBOR reader for the registration blob and OpenSSL for the signature at sign-in. Supports ES256 (every modern phone) and RS256 (Windows Hello). After sign-up, one sheet offers to turn it on; never nagged again. Settings lists devices, up to five, and removes them. The sign-in screen shows a fingerprint button only on phones that can do it. Keys are bound to the site and to the phone; nothing about the fingerprint itself ever leaves the device.
- New: `api/src/WebAuthn.php`, `api/controllers/PasskeyController.php`, `js/passkey.js`, `migrations/024_passkeys.sql`.

Verified with Chrome's virtual authenticator: registering from Settings, a real resident key stored on the authenticator, signing out, signing back in by touch as the right user, and a phone with no key being told what to do.

## Phase 15: the launch checklist, housekeeping and keep-alive

- **Launch checklist** in the admin panel, `#/admin/launch`. Twelve live checks with a score and, for each thing that is off, the exact next step: server kept awake, ADMIN_KEY, digest running, email, push, media storage (with how many files and MB still sit in the database), Ask AI, Google sign-in, Paystack (and a loud warning if mock mode is on), TURN relay, app address, and whether there is enough content for a first visitor. Sorted with what blocks launch first. Shows the three scheduler URLs with copy buttons.
- **`/api/ping`**: no database, no session, the cheapest possible response for a scheduler to hit every ten minutes so the free server never sleeps.
- **`/api/cron/tidy?key=…`**: hourly housekeeping. Deletes call signals older than a day, marks calls left ringing as missed, removes expired road alerts, unpaid ticket attempts, old rate-limit counters, stale sign-in challenges, analytics older than 120 days, news older than a month, Ask logs older than 90 days and expired sessions. The free database stays small. Its last run is what the "server kept awake" check reads.

Verified: ping without a session, tidy refusing without the key and reporting what it removed with it, the checklist scoring and sorting correctly.

## Phase 16: three checklist items closed from the code side

- **Calls relay by default.** Every call now carries Metered's free public Open Relay (TURN over UDP and TCP on 80 and 443) alongside Google STUN, so calls on restrictive mobile networks connect without anyone setting TURN_ variables. Set your own TURN_URL later to override it.
- **Housekeeping and the digest run themselves.** The app polls `/me/today` every half minute while open; the first poll after a job is due runs it, bounded. Tidy at most hourly. The digest on Monday mornings from 7am Abuja time, five people per poll until everyone due is done. No external scheduler is needed for either. The only job left for a scheduler is `/api/ping` every ten minutes, because nothing inside a sleeping server can wake it.
- **The Ask directory fills from OpenStreetMap.** Admin → Places to verify → one button per category pulls every named place of that kind across the FCT (about 8.85 to 9.25 N, 7.15 to 7.65 E): real names, real coordinates, district resolved from the nearest Waka stop, marked as unreviewed until somebody rates them. Run each once.
- Checklist updated: "Server kept awake" now reads the ping, TURN passes on the default relay, and the digest check reflects that it runs itself.
- Interview time bug fixed (the phone sent Abuja wall-clock and the server read it as UTC, so every interview showed an hour late), and the room is open from creation until ended, no clock-watching.

## Phase 17: profile pictures in chat, and what a full sweep found

- **Pictures in the inbox and the chat header.** Uploaded avatar first, then the Google picture, then the initials. The chat header now shows the picture beside the name, and the name opens the person's ratings page.
- **A crawl of all 76 screens** as a signed-in user, catching script errors, server errors and broken pages. It found: the Ask directory returning a 500 when opened before sign-in (a helper insisted on a user), the landlord profile and the Waka planner binding controls that were not on the page, and the planner showing a server error when opened with no places chosen (it now returns you to the picker).
- **Ten real Waka journeys planned and checked.** Fares and distances were sane on all of them. Two places had no route at all, so nothing could start or end there: Maitama (Transcorp Hilton), which the Mpape bus even claimed to pass through in its notes, and Gwarinpa 3rd Avenue. Migration 025 adds a Wuse to Maitama along, puts Maitama on the Mpape bus, and extends the Berger along to 3rd Avenue. Maitama to the Airport is now one transfer at ₦300 instead of a ₦9,800 taxi. The planner also tries two transfers when one is not enough.
- The position shift in that migration is done in two steps because (route, position) is unique and a single +1 collides with itself, on TiDB as much as on SQLite.

## Phase 18: six city signals

All six are the same shape: people report, Buja weighs it, everyone sees the answer.

- **Light Watch** (`#/light`). One tap: light is on, light is off. A report is worth 1 at five minutes old, a quarter at an hour, nothing after three; a charging-state signal (Android only) counts half, and only from within 400 m of home so an office charger cannot vote for Lugbe. A district needs three fresh reports before it shows a state; otherwise it says "no recent reports" rather than guessing. When the weighted vote flips, everyone in the district is notified. A week of history: share of reported hours with light. Home asks once a day in the evening, one tap, never nags.
- **Fuel board** (`#/fuel`). Stations from OpenStreetMap (admin import) or added on the spot. The last person there reports petrol and diesel per litre and the queue: none, short, long, or no fuel. Nearest first from your position; reports older than six hours are shown faded.
- **Blood donors** (`#/blood`). Register your group once. A request for A+ alerts every willing, compatible donor (O-, O+, A-, A+) within their radius, closest first, by push. Donors see the hospital and district, never the patient. When you offer, the requester gets your first name and, if you allow it, your phone. Requester closes it when they have enough.
- **Lost and found** (`#/lostfound`). Documents, keys, phones, pets. When a found item carries a name that matches an open "lost" post of the same kind, the owner is told automatically. "That is mine" opens a Buja chat, so the handover is between rated, identifiable people.
- **Check a plate** (`#/plates`). Type a plate before entering a taxi; Buja says how many reports it has, how recent, whether anyone was hurt, and what happened, never who reported. Reports are anonymous, one per person per plate, and moderators can hide false ones.
- **Market prices** (`#/prices`). Sixteen staples across sixteen markets. Each shown price is the median of the last five reports at that market, so one typo cannot move it; verified with a ₦900,000 rice entry that left Wuse Market at ₦87,000. Cheapest market first, with the spread.

New: `CityController.php`, `js/citysignals.js`, `migrations/026_city_signals.sql`, fuel-station import in `Osm.php`. Threads gain a `city` kind for lost-and-found chats.

## Phase 19: Buja Learn

Free, interactive courses with a real editor, tests that run on the phone, AI-graded prompt work, and a
premium certificate with a QR code that verifies it.

- **Five courses, 41 lessons**: Frontend Web Development (12), Backend Development with JavaScript (8),
  Full-Stack Projects (7), Prompt Engineering (7), AI Fundamentals (7). Content lives in
  `api/src/Curriculum.php` so it ships with deploys and is reviewed like code. Every lesson is progressive:
  the next one unlocks when this one is passed.
- **Four lesson kinds.** Read (with a check quiz, 60% to pass, wrong answers explained). Quiz. Code: an
  editor with Run, a live preview for HTML or a console for JavaScript, and tests that execute in a sandboxed
  iframe on the learner's phone, so they work on a poor connection and cost the server nothing. Prompt lab:
  the learner writes a real prompt, the configured AI (Gemini, Groq or Anthropic, whichever Ask uses) grades
  it against a rubric item by item with feedback; without a key a keyword check keeps the lesson usable.
- **Certificate.** Issued once the last lesson passes: A4 landscape, drawn on a canvas with the Buja mark, the
  holder's name in serif, the course, the score, the date, a 12-character code, and a QR code that opens
  `#/cert/{code}`, a public page served by Buja that anyone can check without an account. Download as PNG
  or PDF (jsPDF and the QR generator are bundled under `js/vendor/`, so it works offline). Revocable by
  setting `revoked_at`.
- **Thumbnails** as SVG under `assets/learn/`, in the brand. Canva exposes no tools in this session, so they
  were designed by hand and can be redone there later.

Verified in the browser: the whole Frontend course completed with reference solutions, every code exercise
in all five courses passing with a correct solution, the certificate issued, drawn, downloaded as PNG and PDF,
its QR decoded back to the verification address, the verification page confirming it, and a fake code refused.
Bugs fixed on the way: a button reference used after an await, learner declarations hidden from tests by a
wrapper, a learner's closing script tag cutting the harness short, and cumulative test steps.

## Phase 20: intermediate and advanced tiers, and the quiz fix

- **Six new courses, 36 lessons**, in `api/src/Curriculum2.php`: Frontend Intermediate (components, accessibility, performance, debounce and throttle, browser APIs, PWA) and Advanced (a tiny virtual DOM, types, async that does not leak, testing, offline-first, an emitter and a store); Backend Intermediate (schema design, transactions and indexes, cursor pagination, caching with TTL and LRU, queues, a job queue) and Advanced (threat modelling, idempotent writes, token-bucket rate limiting, webhooks, observability, a redacting logger); AI Intermediate (RAG from scratch: chunking, embeddings and cosine, grounded prompts, evaluation, a full pipeline) and Advanced (tools and the agent loop, structured output with retries, guardrails, budgets and caching, a shippable feature design). Eleven courses and 77 lessons in all.
- **Ladders.** The course list groups by track and shows the levels. A higher tier is locked, on the list, on its page and in the API, until the certificate for the tier below is earned. Their thumbnails reuse the track card with a level ribbon until real cards exist.
- **The quiz.** Tapping an option was working but looked like nothing happened: a thin border. Now an orange border, a tick, bold text, and the button counts "1 of 2 answered" before turning into "Check my answers". One delegated listener so timing cannot matter.
- All 23 new coding exercises proven passable with reference solutions in the sandbox. Harness fixes: test strings containing a closing script tag no longer cut the harness short; a fake localStorage in a sandbox must be defined, not assigned.

## Phase 21: Public Buja, instant updates, queues, commute share, rent index, Learn analytics

- **The update bug, found at last.** The service worker never called `skipWaiting` or `clients.claim`, so a
  new version only reached a phone once every Buja window was fully closed. Every "close and reopen" since
  Phase 1 was working around this. Now a new worker takes over as soon as it is installed and the app reloads
  itself once with a "Buja updated" toast. This deploy is the last one that needs a full close; after it,
  updates land within a minute of Render going live.
- **Public Buja** (`public_html/p/index.php`). Real, indexable URLs rendered by PHP with titles, descriptions,
  Open Graph tags and schema.org structured data: a landing page at `/p/`, `/p/jobs` and `/p/jobs/{id}`
  (JobPosting, with salary), `/p/homes` (with the asking-rent table) and `/p/homes/{id}` (Residence),
  `/p/places` and `/p/places/{id}` (LocalBusiness with rating and geo), `/p/events` and `/p/events/{id}`
  (Event, with offers), `/p/courses` and `/p/courses/{slug}` (Course). `/sitemap.xml` lists every live
  listing; `/robots.txt` points at it. No phone numbers or contacts on public pages; every page links to the
  action in the app. Routing lives in the Dockerfile (and `.htaccess` for cPanel). Submit the sitemap in
  Google Search Console once the domain is set.
- **Office queues** (`#/queues`): ten real FCT offices seeded (NIMC, Immigration, FRSC, DRTS, AMAC, courts,
  tax). The wait shown is the median of the last 12 hours' reports; nearest first; anyone can add an office
  while standing at it.
- **Commute share** (`#/rides`): selfie-verified drivers offer seats along their own route at a time and cost
  share; riders ask; the driver accepts or declines; both are notified and a chat opens. Seats left counts down.
  Not a taxi and no payments in the app.
- **Rent index** (`#/rent-index`, and the tags icon on Homes): median asking rent per year by district and
  bedrooms from live listings, with the range and count.
- **Learn analytics** (Admin → Learn analytics): learners, active in 7 days, certificates; per course, who
  started and finished, and a bar per lesson with the drop-off flagged in red where more than 40% stopped.

Verified: every public page renders with the right title, description and JSON-LD; the sitemap holds 56 URLs
on the test data; the ride flow end to end with notifications; queue medians; the analytics screen.
Bug fixed on the way: reading a new row's id after the analytics insert (the Phase 10 bug, again).

## Phase 22: learners, reminders, broadcasts, the notification nudge, and a sweep

- **Learners in the admin.** Admin → Learners lists everyone who has started a course, with the current course and
  lesson, days idle (green, amber past 2, red past 7), lessons done and certificates; filters for active this week,
  stuck 7+ days, and certified; search by name or email. Opening a person's admin profile now shows a Learning
  section: every course with progress, average score, attempts, last activity and the next lesson; each lesson with
  its score and number of tries; each certificate with its code and a Verify link.
- **Personal learning reminders**, category `learn`, shown in notifications and pushed when push is on. The text
  is built from the person's own record: "Adaeze, you are 7 of 8 into Backend Development with JavaScript. Next:
  Final project: an in-memory API (25 min). One lesson from your certificate." When a course is finished and the
  next tier has not been started: "Frontend, Intermediate is unlocked". Sent automatically between 9am and 7pm
  Abuja time to people idle 2 to 30 days, never more than once every 5 days, ten per five minutes. The admin can
  send one on demand from the person's profile. People can switch them off: Settings, Learning reminders.
- **Admin notifications.** Admin → Send a notification: nine audiences with live counts (everyone, a district,
  joined this week, notifications not switched on, learners, idle learners, certified, companies, not seen in 14
  days), title and message with a live preview, which screen it opens, "Send to me first", a confirm, and history
  with delivery progress. Large audiences queue and go out forty at a time. Links can only point inside Buja.
  A single person can also be messaged from their admin profile (with email fallback when they have no push device).
  Admins only; moderators cannot see learner records or message anyone.
- **The notification nudge.** On Home, anyone whose device does not have push on sees a card: "Switch on
  notifications", one tap. If they once blocked Buja, the card says so and explains how to unblock it in the
  browser. Once a day at most, weekly after three dismissals. Separately, once per person, a day after joining,
  an in-app notification "switch on notifications" linking to Settings.
- **Search** now finds courses (by title, level, or any lesson title) and the city services by the words people
  use: "nimc", "petrol", "light", "one chance".

**Bugs found and fixed**
1. Notification switches: `Notify` read only four of seven switches, so turning off News, Social or Digest did
   not stop them. It now reads all of them.
2. Settings: after flipping any switch, the reply returned News, Social and Digest as off even when on.
3. Router: when a screen failed to load, its setup code still ran against the error page and crashed (seen on
   editing someone else's job). Setup now only runs on a screen that loaded.
4. Admin guard for the new screens let moderators in; tightened to admins, matching the existing user screens.

**Sweep:** all 126 routes visited as an admin, an ordinary resident and a second user: no crashes, no blank
screens, no server errors.

## Phase 23: a faster start, iPhone setup, Continue learning, learners' answers

- **Lazy loading.** Every one of the 23 modules used to download and run before Home appeared. Now Home,
  messages, calls, settings and the engagement code load at once; the other fourteen (Work, Match, Waka, Homes,
  Declutter, Ask, admin, News/Radio/Social, Safety, invites and search, Meetup and Artisans, the city signals,
  Learn, queues and rides) load the first time their screen opens, and all of them download quietly in the
  background once Home has painted. A prefix map in `app.js` (`LAZY`) routes each screen to its module, including
  `/admin` and `/report`, which several modules share. Measured on a cheap-phone profile (6x slower CPU,
  750 kbps, no cache): Home ready in 3.7 s instead of 8.1 s, 210 KB of JavaScript instead of 613 KB. After Home,
  opening Learn took 40 ms. All 115 screens opened cold, straight from a link, with no errors.
- **The setup card** on Home picks one message per phone: on an iPhone in Safari, "Add Buja to your Home Screen"
  with the three taps (notifications only work there, on iOS 16.4 or newer; older iPhones are told to update);
  otherwise "Switch on notifications" (or how to unblock them); otherwise, on Android, "Install Buja" using the
  browser's own install prompt, which Buja had been capturing since Phase 9 and never used.
- **Continue learning** on each learner's Home: the course, progress bar, and a button straight into the next
  lesson, with "one lesson from your certificate" near the end. Closable for the day.
- **Learners' answers.** On a person's admin profile, every lesson with saved work has an Answer link that opens
  the code or prompt they submitted, when they last saved it, their score and attempts, and the tests or rubric
  it was judged against.

## Phase 24: Waka fares, maps, and artisans who come to you

**Fares, rebuilt on researched 2026 prices.** The old seeds were badly out of date (Life Camp to Wuse Market
was N200; riders paid N800 in March 2026) and ignored fuel entirely. `api/src/WakaFares.php` now holds one
formula per mode, each indexed to the Abuja pump price:
- along cabs: `N443 + N52.4 per straight-line km`, fitted to seven Daily Trust fares of 17 March 2026 using
  Waka's own coordinates (Lugbe-Berger N1,000, Nyanya-Jabi N1,700, Berger-Zuba N1,800, Life Camp-Wuse N800 ...)
- buses: mid-2026 street fares (short N400, Nyanya-Wuse N700, Area 1-Gwagwalada N1,550)
- keke: NAN of 20 Sept 2026, N200-500, and never suggested inside the city centre, where they are banned
- light rail: N500-600, flagged as low confidence
- door to door: a charter is about four along seats; Bolt uses its Aug 2024 card marked up for fuel
  (Wuse-Airport N12,300 against a published N13,432); inDrive is shown as a fair opening offer; Uber is gone,
  having left Nigeria on 2 Sept 2026; airport trips carry the FAAN premium.
Fares move with fuel at about half the rate fuel moves, which is how Abuja has behaved since 2023. Once three
riders report a stretch within 30 days their median replaces the estimate, and every fare says which it is.
Admin -> Waka pricing sets the pump price and per-mode adjustments; `/waka/pricing` explains it all to riders.

**Maps, rebuilt.** `js/map.js` is a shared MapLibre GL module on OpenFreeMap vector tiles (free, no key), replacing
Leaflet on openstreetmap.org's own tile server, which its usage policy forbids for an app. It gives every screen
HTML pins with Font Awesome icons, markers that glide and turn, road route lines, a draggable bottom sheet, and a
plain-background fallback so pins and tracking still work when the street map cannot load. Road routes come from
`api/src/Routing.php` (OpenRouteService if a key is set, else the public OSRM server, else straight lines),
cached for 14 days in 100 m buckets so the free routers are not hammered. Rebuilt on it: Waka journeys, a new
live Waka map (stops near you, road alerts as warning pins, plan from a stop), the fuel board coloured by queue,
Trip Share, and the new artisan screens.

**Mechanic near me.** Artisans appear on a map with their trade's icon (wrench, scissors, faucet ... all 28),
name and rating. Ask one to come: they see only your area until they accept, then your exact spot. While they
travel their phone shares position (screen wake lock, sent at most every 4 s or every 20 m), and you watch them
approach with a live ETA, "stopped for N min" and "signal lost" warnings, auto-arrival within 80 m, and a rating
at the end. The camera follows both of you and stops following if you drag, with a recenter button. Their trail
is deleted when the job ends. Polling over plain HTTP, so it works on the free host.

Bugs fixed: a second job with the same artisan could not be rated (one rating per person per artisan, updated
each job); pins hidden behind the sheet; "0 km from you" on requests; road alerts had no coordinates.
Swept 121 screens cold as an admin and as a resident: no crashes, no server errors.

## Phase 25: board safely, arrive safely, and tell Waka what you paid

The research called one-chance robbery the sharpest problem an Abuja transport app can address, and Waka's new
fare engine needs rider reports to correct its estimates. Both happen at the moment somebody boards a vehicle,
so this phase is built around that moment.

- **Before you enter.** Every journey option now has "Board safely". It asks for the plate on the vehicle and
  checks it against other riders' reports (`GET /safety/board`), showing what happened and when if there is
  anything. It also shows how many one-chance reports came from that district in the last year, whether it is
  dark, and three or four specific things to do: sit by the door, step out if the other passengers are silent,
  board at a lit park after dark.
- **Share the ride, not just a meeting.** Trip Share grew a "ride" kind (migration 031) carrying the plate, the
  vehicle, the route and the destination. The private link now leads with the plate, so whoever you send it to
  knows exactly which vehicle you entered, and the Safety screen shows it too.
- **Arrival check-in.** While a ride is running, Buja notices when you come within 350 m of your destination and
  asks whether you arrived. One tap ends the trip and tells your contact you are safe.
- **Then: what did you pay?** Straight after, it asks the fare for that leg and files it against the route. Three
  riders on a stretch and Waka shows what riders paid instead of an estimate, which is how the Phase 24 engine
  was designed to correct itself.

Fixed on the way: sharing the trip link threw when a browser denied clipboard access; it now falls back to
showing the link. Swept all 121 screens cold as an admin and as a resident: no crashes, no server errors.

## What is next

Phase 26: Match on phone GPS (real distances, fuzzed for privacy) and a safety feature to share live location with a trusted contact while meeting someone. Waka directory expansion from researched routes and fares.

Phase 8b: Declutter escrow with Paystack transfers once the business is approved for payouts (seller bank details, hold on payment, release on confirmation, admin payout queue). Then growth: Waka rider GPS and driver mode, Protomaps tiles, and moving off Render's free plan.

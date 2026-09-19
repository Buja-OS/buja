# Buja, Phase 6

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

## What is next

Phase 7: Ask Buja (the AI guide, grounded on Buja's own places and ratings). Then trust and money: selfie verification, verified landlord and seller badges, Buja Plus and escrow with Paystack, object storage for photos and CVs.

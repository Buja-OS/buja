# Buja, Phase 1

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

## What is next

Phase 2, Work: jobs, CV upload to object storage, company dashboard, in-app messages, push notifications, email via Brevo (verification, password reset).

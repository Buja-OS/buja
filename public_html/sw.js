/* Buja service worker, phase 1.
   Cache-first for the app shell and static assets, network-only for /api.
   Bump VERSION whenever a shell file changes so users get the update. */
const VERSION = 'buja-shell-v3';
const SHELL = [
  '/', '/index.html', '/manifest.webmanifest', '/offline.html',
  '/css/app.css', '/js/app.js', '/js/api.js', '/js/ui.js', '/js/store.js', '/js/icons.js', '/js/work.js',
  '/assets/icons/mark-dark.svg', '/assets/icons/mark-light.svg', '/assets/icons/favicon.svg'
];

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser HTTP cache so a new worker never pre-fills itself with stale files.
  e.waitUntil(caches.open(VERSION).then((c) => Promise.all(SHELL.map((u) => fetch(u, { cache: 'reload' }).then((r) => { if (r.ok) return c.put(u, r); })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // API is always live; never cached
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).catch(() => caches.match('/index.html').then((r) => r || caches.match('/offline.html'))));
    return;
  }
  // Shell files: cache-first for speed, but refresh the cached copy in the background (stale-while-revalidate).
  e.respondWith(caches.match(e.request).then((hit) => {
    const net = fetch(e.request, { cache: 'no-cache' }).then((res) => { if (res.ok && e.request.method === 'GET') { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});

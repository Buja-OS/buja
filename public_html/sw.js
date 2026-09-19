/* Buja service worker, phase 1.
   Cache-first for the app shell and static assets, network-only for /api.
   Bump VERSION whenever a shell file changes so users get the update. */
const VERSION = 'buja-shell-v1';
const SHELL = [
  '/', '/index.html', '/manifest.webmanifest', '/offline.html',
  '/css/app.css', '/js/app.js', '/js/api.js', '/js/ui.js', '/js/store.js', '/js/icons.js',
  '/assets/icons/mark-dark.svg', '/assets/icons/mark-light.svg', '/assets/icons/favicon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
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
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
    if (res.ok && e.request.method === 'GET') { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
    return res;
  })));
});

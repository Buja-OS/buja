/* Buja service worker, phase 1.
   Cache-first for the app shell and static assets, network-only for /api.
   Bump VERSION whenever a shell file changes so users get the update. */
const VERSION = 'buja-shell-v13';
const SHELL = [
  '/', '/index.html', '/manifest.webmanifest', '/offline.html',
  '/css/app.css', '/js/app.js', '/js/api.js', '/js/ui.js', '/js/store.js', '/js/icons.js', '/js/work.js', '/js/messages.js', '/js/match.js', '/js/waka.js', '/js/homes.js', '/js/declutter.js', '/js/ask.js', '/js/trust.js', '/js/city.js',
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

self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: 'Buja', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Buja', { body: d.body || '', icon: '/assets/icons/icon-512.svg', badge: '/assets/icons/favicon.svg', tag: d.tag || 'buja', data: { url: d.url || '/#/home' }, renotify: true }));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url || '/#/home', location.origin).href;
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) { if (c.url.startsWith(location.origin)) { c.navigate(url); return c.focus(); } }
    return clients.openWindow(url);
  }));
});

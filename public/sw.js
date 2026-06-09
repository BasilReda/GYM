/**
 * GYMAWY Service Worker
 *
 * Strategy:
 *  - Static shell files (HTML/CSS/JS) → cache-first so the app loads fast
 *  - All /api/* requests        → network-only  (requires Docker to be running)
 *  - Everything else            → network-first, fall back to cache
 *
 * The app intentionally shows a "Server offline" screen when the Docker
 * container isn't running, because all real data lives on the server.
 */

const CACHE_NAME = 'gymawy-v6';

const SHELL_FILES = [
  '/',
  '/manifest.json',
  '/css/style.css',
  '/js/i18n.js',
  '/js/api.js',
  '/js/jsqr.min.js',
  '/js/stripe-loader.js',
  '/js/app.js',
  '/js/pages/dashboard.js',
  '/js/pages/members.js',
  '/js/pages/subscriptions.js',
  '/js/pages/attendance.js',
  '/js/pages/payments.js',
  '/js/pages/trainers.js',
  '/js/pages/classes.js',
  '/js/pages/users.js',
  '/js/pages/member-portal.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// ── Install: cache all shell files ──────────────────────────────────────────
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
});

// ── Activate: remove old caches ──────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // API calls always go to network — never serve stale data
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(
          JSON.stringify({ error: 'GYMAWY server is offline. Start Docker and try again.' }),
          { status: 503, headers: { 'Content-Type': 'application/json' } }
        )
      )
    );
    return;
  }

  // Shell / static files: cache-first
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const networkFetch = fetch(e.request).then((resp) => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        }
        return resp;
      });
      return cached || networkFetch;
    })
  );
});

const CACHE_NAME = 'trading-calc-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/assets/css/style.css',
  '/assets/css/animated.css',
  '/assets/js/calculator.js'
];

// Install: cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: network-first, fallback to cache
self.addEventListener('fetch', event => {
  // Skip non-GET and cross-origin requests
  if (event.request.method !== 'GET') return;
  if (!event.request.url.includes(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Fallback for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Resource not found', { status: 404 });
        });
      })
  );
});

// Handle messages from the main app
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
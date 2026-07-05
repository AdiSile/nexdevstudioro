// Minimal Service Worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Network-first strategy for navigation requests; cache-first for static assets is optional
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
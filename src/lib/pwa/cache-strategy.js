/**
 * Runtime caching strategies for Workbox (next-pwa v5).
 * @see https://developer.chrome.com/docs/workbox/reference/workbox-build/#type-RuntimeCachingOptions
 */

const CACHE_NAMES = {
  static: "nexus-static-v1",
  images: "nexus-images-v1",
  api: "nexus-api-v1",
  fonts: "nexus-fonts-v1",
  external: "nexus-external-v1",
};

module.exports = [
  // Fonts – Cache First (1 year immutable)
  {
    urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
    handler: "CacheFirst",
    options: {
      cacheName: CACHE_NAMES.fonts,
      expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
      cacheableResponse: { statuses: [0, 200] },
    },
  },
  // Images – Stale While Revalidate
  {
    urlPattern: /\.(?:png|jpg|jpeg|gif|webp|avif|svg|ico)$/i,
    handler: "StaleWhileRevalidate",
    options: {
      cacheName: CACHE_NAMES.images,
      expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
      cacheableResponse: { statuses: [0, 200] },
    },
  },
  // Static assets (JS, CSS) – Cache First
  {
    urlPattern: /\/_next\/static\/.*/i,
    handler: "CacheFirst",
    options: {
      cacheName: CACHE_NAMES.static,
      expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 365 },
      cacheableResponse: { statuses: [0, 200] },
    },
  },
  // API calls – Network First
  {
    urlPattern: /\/api\/.*/i,
    handler: "NetworkFirst",
    options: {
      cacheName: CACHE_NAMES.api,
      networkTimeoutSeconds: 10,
      expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 },
      cacheableResponse: { statuses: [0, 200] },
    },
  },
  // External CDN scripts – Stale While Revalidate
  {
    urlPattern: /^https:\/\/.*\.(?:jsdelivr|unpkg|cdnjs|cloudflare)\.(?:com|net)\/.*/i,
    handler: "StaleWhileRevalidate",
    options: {
      cacheName: CACHE_NAMES.external,
      expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 7 },
    },
  },
];
// @ts-check

const { resolve } = require("path");

// ---------------------------------------------------------------------------
// Plugins
// ---------------------------------------------------------------------------

/** PWA (next-pwa v5) – DEZACTIVAT temporar pentru compatibilitate Next.js 14 */
// const withPWA = require("next-pwa")({
//   dest: "public",
//   register: true,
//   skipWaiting: true,
//   disable: process.env.NODE_ENV === "development",
//   runtimeCaching: require("./src/lib/pwa/cache-strategy"),
//   buildExcludes: [/middleware-manifest\.json$/],
//   fallbacks: {
//     document: "/offline",
//   },
// });
const withPWA = (config) => config; // No-op passthrough (PWA dezactivat temporar)

/** Internationalisation (next-intl v3) */
const withNextIntl = require("next-intl/plugin")("./src/lib/i18n/request.ts");

// ---------------------------------------------------------------------------
// Security Headers (reusable helper)
// ---------------------------------------------------------------------------

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.amazonaws.com https://*.cloudfront.net https://*.digitaloceanspaces.com",
  "font-src 'self' https://fonts.gstatic.com",
  "connect-src 'self' https://*.stripe.com https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com wss://*.nexusdevstudio.ro",
  "frame-src 'self' https://js.stripe.com https://challenges.cloudflare.com https://www.youtube.com https://www.google.com",
  "media-src 'self' https://*.amazonaws.com https://*.cloudfront.net",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "form-action 'self' https://checkout.stripe.com",
].join("; ");

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "X-XSS-Protection", value: "0" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), interest-cohort=(), fullscreen=(self), clipboard-write=(self)",
  },
  {
    key: "Content-Security-Policy",
    value: cspDirectives,
  },
];

// ---------------------------------------------------------------------------
// Redirects (SEO, trailing slash, www → apex)
// ---------------------------------------------------------------------------

/** @type {import('next').NextConfig['redirects']} */
const redirects = async () => [
  // www → apex
  { source: "/:path*", has: [{ type: "host", value: "www.nexusdevstudio.ro" }], destination: "https://nexusdevstudio.ro/:path*", permanent: true },
  // Trailing slash
  { source: "/:path+/", destination: "/:path+", permanent: true, missing: [{ type: "host", value: "www.nexusdevstudio.ro", }] },
  // Legacy routes
  { source: "/home", destination: "/", permanent: true },
  { source: "/despre", destination: "/despre-noi", permanent: true },
  { source: "/servicii/:slug*", destination: "/servicii", permanent: true },
  { source: "/portfoliu", destination: "/portofoliu", permanent: true },
  { source: "/cariera", destination: "/cariere", permanent: true },
  { source: "/contacte", destination: "/contact", permanent: true },
  { source: "/admin", destination: "/admin/dashboard", permanent: false },
  { source: "/dashboard", destination: "/dashboard/overview", permanent: false },
  { source: "/eveniment", destination: "/evenimente", permanent: true },
  { source: "/magazin", destination: "/shop", permanent: true },
  { source: "/cos", destination: "/cart", permanent: true },
  { source: "/plata", destination: "/checkout", permanent: true },
];

// ---------------------------------------------------------------------------
// API Rewrites (proxy external services, hide internal structure)
// ---------------------------------------------------------------------------

/** @type {import('next').NextConfig['rewrites']} */
const rewrites = async () => ({
  beforeFiles: [
    // Health check
    { source: "/api/health", destination: "/api/system/health" },
  ],
  afterFiles: [
    // Internal API aliases (clean URLs)
    { source: "/api/v1/:path*", destination: "/api/:path*" },

    // AI proxy
    { source: "/api/ai/openai/:path*", destination: "https://api.openai.com/:path*" },
    { source: "/api/ai/anthropic/:path*", destination: "https://api.anthropic.com/:path*" },
    { source: "/api/ai/gemini/:path*", destination: "https://generativelanguage.googleapis.com/:path*" },

    // Stripe webhook proxy
    { source: "/api/webhooks/stripe", destination: "/api/payments/webhook" },
    { source: "/api/webhooks/svix", destination: "/api/webhooks/svix" },
  ],
  fallback: [
    // SPA-like client-side fallback for Admin
    { source: "/admin/:path*", destination: "/admin/dashboard" },
  ],
});

// ---------------------------------------------------------------------------
// Core Next.js config
// ---------------------------------------------------------------------------

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ----- React -----
  reactStrictMode: true,
  poweredByHeader: false,

  // ----- Compiler -----
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
    styledComponents: false,
  },

  // ----- Images (sharp) -----
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [320, 420, 640, 768, 1024, 1280, 1536, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.cloudfront.net" },
      { protocol: "https", hostname: "**.digitaloceanspaces.com" },
      { protocol: "https", hostname: "**.unsplash.com" },
      { protocol: "https", hostname: "**.githubusercontent.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },

  // ----- Headers -----
  headers: async () => [
    {
      source: "/(.*)",
      headers: securityHeaders,
    },
    {
      // Cache static assets aggressively
      source: "/_next/static/(.*)",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
    {
      // Fonts
      source: "/fonts/(.*)",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
    {
      // API endpoints: no cache
      source: "/api/(.*)",
      headers: [
        { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
        { key: "Pragma", value: "no-cache" },
        { key: "Expires", value: "0" },
      ],
    },
  ],

  // ----- Redirects & Rewrites -----
  redirects,
  rewrites,

  // ----- Experimental -----
  experimental: {
    optimizePackageImports: [
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
      "@radix-ui/react-popover",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-switch",
      "@radix-ui/react-accordion",
      "@radix-ui/react-toast",
      "@radix-ui/react-avatar",
      "@radix-ui/react-label",
      "@radix-ui/react-separator",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-slot",
      "lucide-react",
      "date-fns",
      "recharts",
      "framer-motion",
    ],
    turbo: {
      rules: {
        "*.svg": {
          loaders: ["@svgr/webpack"],
          as: "*.js",
        },
      },
    },
    serverActions: {
      bodySizeLimit: "10mb",
    },
    instrumentationHook: true,
  },

  // ----- Webpack -----
  webpack: (config, { dev, isServer }) => {
    // SVGR
    config.module.rules.push({
      test: /\.svg$/i,
      issuer: /\.[jt]sx?$/,
      use: ["@svgr/webpack"],
    });

    // Fallback for optional dependencies
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        child_process: false,
      };
    }

    return config;
  },

  // ----- Output -----
  output: process.env.DOCKER_BUILD === "true" ? "standalone" : undefined,

  // ----- Transpile external packages -----
  transpilePackages: [
    "next-intl",
    "next-pwa",
    "lucide-react",
    "@radix-ui/react-dialog",
    "@radix-ui/react-dropdown-menu",
    "@radix-ui/react-select",
    "@radix-ui/react-tabs",
    "@radix-ui/react-tooltip",
    "@radix-ui/react-popover",
    "@radix-ui/react-checkbox",
    "@radix-ui/react-switch",
    "@radix-ui/react-accordion",
    "@radix-ui/react-toast",
    "@radix-ui/react-avatar",
    "@radix-ui/react-label",
    "@radix-ui/react-separator",
    "@radix-ui/react-scroll-area",
    "@radix-ui/react-slot",
    "@tanstack/react-query",
    "@tanstack/react-table",
    "@tanstack/react-virtual",
  ],

  // ----- Env (public) -----
  env: {
    APP_NAME: "NexusDevStudio",
    APP_URL: process.env.NEXT_PUBLIC_APP_URL || "https://nexusdevstudio.ro",
    APP_ENV: process.env.NODE_ENV,
  },

  // ----- Page Extensions -----
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],

  // ----- Logging -----
  logging: {
    fetches: {
      fullUrl: process.env.NODE_ENV === "development",
    },
  },
};

// ---------------------------------------------------------------------------
// Compose plugins: withPWA ▪ withNextIntl
// ---------------------------------------------------------------------------

module.exports = withPWA(withNextIntl(nextConfig));
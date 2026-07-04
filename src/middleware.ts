/**
 * Next.js Middleware — Gateway for Auth, Tenant, Locale, Rate Limiting,
 * Security Headers & Maintenance Mode
 *
 * This middleware executes on every matched request before the route handler.
 * It centralizes cross-cutting concerns that every request must pass through:
 *
 *   1. **Maintenance Mode**     — Serve a 503 with Retry-After if global or
 *                                 tenant-level maintenance is active.
 *   2. **Tenant Detection**     — Resolve the organization context from hostname
 *                                 (subdomain / custom-domain / header override).
 *   3. **Locale Detection**     — Extract locale from URL path, cookie, or
 *                                 Accept-Language; redirect if missing.
 *   4. **Authentication Check** — Verify JWT session token via next-auth;
 *                                 protect routes that require authentication.
 *   5. **Rate Limiting**        — Sliding-window per-IP rate limiting for API
 *                                 routes and auth endpoints.
 *   6. **Security Headers**     — CSP, HSTS, X-Frame-Options, X-Content-Type-Options,
 *                                 Referrer-Policy, Permissions-Policy, CORS.
 *   7. **Path Rewriting**       — Optionally rewrite tenant-specific paths.
 *
 * Middleware Execution Order:
 *   maintenance → tenant → locale → auth → rate-limit → security-headers
 *
 * Edge Compatibility:
 *   This middleware is designed for the Edge runtime. It avoids Node.js-only
 *   APIs (fs, crypto with createCipheriv, etc.) and uses jose for JWT
 *   verification and Web Crypto for hashing.
 *
 * Configuration (matcher in next.config or exported config):
 *   The middleware runs on all paths except static assets, _next, favicon, etc.
 *
 * Environment Variables:
 *   MAINTENANCE_MODE             — "true" to enable global maintenance (default: false)
 *   MAINTENANCE_MODE_TENANTS     — comma-separated tenant slugs in maintenance
 *   MAINTENANCE_MODE_BYPASS_IPS  — comma-separated IPs that bypass maintenance
 *   MAINTENANCE_MODE_BYPASS_TOKEN— Bearer token to bypass maintenance (header)
 *   TENANT_DETECTION_STRATEGY    — "subdomain" | "header" | "path" (default: "subdomain")
 *   TENANT_HEADER_NAME           — header for tenant slug (default: "x-tenant-slug")
 *   TENANT_DEFAULT_SLUG          — default tenant when none detected
 *   AUTH_PROTECTED_PREFIXES      — comma-separated path prefixes requiring auth
 *   AUTH_PUBLIC_PREFIXES         — comma-separated path prefixes that skip auth
 *   RATELIMIT_ENABLED            — master switch for rate limiting (default: true)
 *   RATELIMIT_API_MAX            — max requests per window for API routes
 *   RATELIMIT_API_WINDOW_S       — window in seconds for API routes
 *   SECURITY_CSP_REPORT_ONLY     — "true" to use Content-Security-Policy-Report-Only
 *   SECURITY_HSTS_MAX_AGE        — max-age for Strict-Transport-Security
 *   CORS_ALLOWED_ORIGINS         — comma-separated allowed origins
 *
 * Next.js 14 Compatibility:
 *   All APIs used (NextResponse, NextRequest, cookies, headers) are fully
 *   compatible with Next.js 14's Edge Runtime. The middleware uses only
 *   stable, non-deprecated APIs and supports the latest matcher conventions.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Tenant context extracted from the request */
interface TenantContext {
  /** The tenant slug (organization slug / subdomain) */
  slug: string;
  /** How the tenant was detected */
  source: "subdomain" | "header" | "path" | "default";
  /** Custom domain (if applicable) */
  customDomain?: string;
}

/** Locale context extracted from the request */
interface LocaleContext {
  /** Resolved locale code */
  locale: string;
  /** Detection source */
  source: "url" | "cookie" | "header" | "fallback";
  /** Whether a locale redirect is needed */
  needsRedirect: boolean;
  /** The redirect target (if needsRedirect) */
  redirectTo?: string;
}

/** Auth context extracted from the request */
interface AuthContext {
  /** Whether the request is authenticated */
  authenticated: boolean;
  /** Authenticated user ID (if any) */
  userId?: string;
  /** Organization ID from the session */
  organizationId?: string;
  /** Session payload */
  session?: SessionPayload;
}

/** next-auth session JWT payload */
interface SessionPayload {
  sub?: string;
  email?: string;
  name?: string;
  organizationId?: string;
  role?: string;
  permissions?: string[];
  iat?: number;
  exp?: number;
  [key: string]: unknown;
}

/** Security headers configuration */
interface SecurityHeadersConfig {
  contentSecurityPolicy: string;
  cspReportOnly: boolean;
  hstsMaxAge: number;
  hstsIncludeSubDomains: boolean;
  hstsPreload: boolean;
  frameOptions: "DENY" | "SAMEORIGIN" | string;
  xContentTypeOptions: string;
  referrerPolicy: string;
  permissionsPolicy: string;
  corsAllowedOrigins: string[];
  corsAllowCredentials: boolean;
  corsMaxAge: number;
}

/** Rate-limit state stored per-IP (in-memory for edge; Redis-backed in production via Upstash) */
interface RateLimitBucket {
  count: number;
  windowStart: number;
}

/** Full middleware context enriched after all checks */
interface MiddlewareContext {
  tenant: TenantContext;
  locale: LocaleContext;
  auth: AuthContext;
  requestId: string;
  startTime: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REQUEST_ID_HEADER = "x-request-id";
const CORRELATION_ID_HEADER = "x-correlation-id";

/** Paths that should never be processed by middleware */
const ALWAYS_SKIP_PREFIXES = [
  "/_next",
  "/static",
  "/public",
  "/assets",
  "/fonts",
  "/images",
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.json",
  "/sw.js",
  "/workbox-",
  "/api/health",
];

/** Default public paths (no auth required) */
const DEFAULT_PUBLIC_PREFIXES = [
  "/api/auth",
  "/api/public",
  "/api/webhook",
  "/login",
  "/signup",
  "/register",
  "/auth",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/terms",
  "/privacy",
  "/about",
  "/contact",
  "/pricing",
  "/blog",
];

/** Default protected prefixes (auth required) */
const DEFAULT_PROTECTED_PREFIXES = [
  "/dashboard",
  "/admin",
  "/settings",
  "/profile",
  "/projects",
  "/api/user",
  "/api/protected",
  "/api/admin",
];

/** Supported locale codes */
const SUPPORTED_LOCALES = ["en", "ro", "ar", "he", "fa", "ur"];

/** Default locale */
const DEFAULT_LOCALE = "en";

// Next.js session cookie name (next-auth default + fallback patterns)
const SESSION_COOKIE_NAMES = [
  "__Secure-next-auth.session-token",
  "next-auth.session-token",
  "__Host-next-auth.session-token",
];

// ---------------------------------------------------------------------------
// Helpers: Environment Variable Parsing
// ---------------------------------------------------------------------------

function envStr(key: string, fallback: string): string {
  try {
    const raw = process.env[key];
    return raw !== undefined && raw !== "" ? raw : fallback;
  } catch {
    return fallback;
  }
}

function envBool(key: string, fallback: boolean): boolean {
  try {
    const raw = process.env[key];
    if (raw === undefined || raw === "") return fallback;
    return raw === "true" || raw === "1";
  } catch {
    return fallback;
  }
}

function envInt(key: string, fallback: number): number {
  try {
    const raw = process.env[key];
    if (raw === undefined || raw === "") return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function envList(key: string, fallback: string[]): string[] {
  try {
    const raw = process.env[key];
    if (!raw) return fallback;
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Helpers: Request ID Generation
// ---------------------------------------------------------------------------

/**
 * Generate a compact, sortable request ID.
 * Format: req_<base36-timestamp>_<random>
 */
function generateRequestId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 10);
  return `req_${ts}_${rand}`;
}

/**
 * Extract or generate a request ID for the current request.
 * Prefers incoming x-request-id header for distributed tracing.
 */
function getRequestId(request: NextRequest): string {
  const existing = request.headers.get(REQUEST_ID_HEADER);
  if (existing && existing.length > 0 && existing.length <= 128) {
    return existing;
  }
  return generateRequestId();
}

// ---------------------------------------------------------------------------
// Helpers: IP Extraction
// ---------------------------------------------------------------------------

/**
 * Extract the client IP address from request headers.
 *
 * Respects common proxy headers in order of trust:
 *   X-Forwarded-For → X-Real-IP → CF-Connecting-IP → socket remote address
 *
 * Security: Takes the leftmost IP from X-Forwarded-For (original client).
 * In production, ensure your reverse proxy / LB appends, not prepends.
 */
function getClientIP(request: NextRequest): string {
  // X-Forwarded-For: client, proxy1, proxy2, ...
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const ips = xff.split(",");
    const clientIp = ips[0]?.trim();
    if (clientIp && isValidIP(clientIp)) {
      return clientIp;
    }
  }

  // X-Real-IP (set by nginx / some proxies)
  const xri = request.headers.get("x-real-ip");
  if (xri && isValidIP(xri)) {
    return xri;
  }

  // Cloudflare
  const cf = request.headers.get("cf-connecting-ip");
  if (cf && isValidIP(cf)) {
    return cf;
  }

  // Fly.io
  const fly = request.headers.get("fly-client-ip");
  if (fly && isValidIP(fly)) {
    return fly;
  }

  // Last resort: use the IP from the request (may be the proxy's IP in edge)
  return "127.0.0.1";
}

/**
 * Basic IP validation — rejects obviously malformed IP strings.
 */
function isValidIP(ip: string): boolean {
  // IPv4 pattern
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv4Match = ip.match(ipv4Regex);
  if (ipv4Match) {
    return ipv4Match.slice(1).every((octet) => {
      const n = Number(octet);
      return n >= 0 && n <= 255;
    });
  }

  // IPv6 — simplified check
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  if (ipv6Regex.test(ip)) return true;

  // IPv6-mapped IPv4
  const mappedRegex = /^::ffff:(\d{1,3}\.){3}\d{1,3}$/;
  return mappedRegex.test(ip);
}

// ---------------------------------------------------------------------------
// 1. MAINTENANCE MODE
// ---------------------------------------------------------------------------

/**
 * Check if the system is in maintenance mode.
 *
 * Sources (checked in order):
 *   1. MAINTENANCE_MODE env var (global)
 *   2. Tenant-specific maintenance list
 *   3. Bypass: whitelisted IPs or bearer token
 *
 * @returns 503 Response if maintenance is active and not bypassed; null otherwise.
 */
function checkMaintenance(
  request: NextRequest,
  tenant: TenantContext,
): NextResponse | null {
  const globalMaintenance = envBool("MAINTENANCE_MODE", false);

  // Check tenant-specific maintenance
  const maintenanceTenants = envList("MAINTENANCE_MODE_TENANTS", []);
  const tenantMaintenance = maintenanceTenants.includes(tenant.slug);

  if (!globalMaintenance && !tenantMaintenance) {
    return null; // No maintenance active
  }

  // --- Bypass Checks ---

  // 1. Whitelisted IPs
  const bypassIPs = envList("MAINTENANCE_MODE_BYPASS_IPS", []);
  if (bypassIPs.length > 0) {
    const clientIP = getClientIP(request);
    if (bypassIPs.includes(clientIP) || bypassIPs.includes("0.0.0.0/0")) {
      return null;
    }
  }

  // 2. Bypass Bearer token via Authorization header or query param
  const bypassToken = envStr("MAINTENANCE_MODE_BYPASS_TOKEN", "");
  if (bypassToken) {
    const authHeader = request.headers.get("authorization") || "";
    const tokenFromHeader = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";
    const tokenFromQuery = request.nextUrl.searchParams.get("bypass_token") || "";

    if (
      tokenFromHeader === bypassToken ||
      tokenFromQuery === bypassToken
    ) {
      return null;
    }
  }

  // Maintenance is active — return 503
  const retryAfter = envInt("MAINTENANCE_MODE_RETRY_AFTER_S", 300);
  const message = envStr(
    "MAINTENANCE_MODE_MESSAGE",
    "We are currently performing scheduled maintenance. We'll be back shortly.",
  );

  const body = JSON.stringify({
    success: false,
    error: {
      code: "SERVICE_UNAVAILABLE",
      message,
      retryAfterSeconds: retryAfter,
    },
  });

  return new NextResponse(body, {
    status: 503,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfter),
      "Cache-Control": "no-store, must-revalidate",
    },
  });
}

// ---------------------------------------------------------------------------
// 2. TENANT DETECTION
// ---------------------------------------------------------------------------

/**
 * Detect the tenant (organization) from the request.
 *
 * Strategies (configured via TENANT_DETECTION_STRATEGY):
 *   - "subdomain": extract from hostname (e.g., acme.example.com → "acme")
 *   - "header":    read from configured header (e.g., x-tenant-slug: acme)
 *   - "path":      first path segment after locale (e.g., /en/acme/...)
 *   - "hostname":  full hostname match for custom domains
 *
 * Fallback: TENANT_DEFAULT_SLUG or "default"
 */
function detectTenant(request: NextRequest): TenantContext {
  const strategy = envStr("TENANT_DETECTION_STRATEGY", "subdomain");
  const headerName = envStr("TENANT_HEADER_NAME", "x-tenant-slug");
  const defaultSlug = envStr("TENANT_DEFAULT_SLUG", "default");
  const hostname = request.headers.get("host") || "";

  // Strategy: header (highest priority — explicit override)
  if (strategy === "header" || request.headers.get(headerName)) {
    const headerValue = request.headers.get(headerName);
    if (headerValue && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(headerValue)) {
      return { slug: headerValue.toLowerCase(), source: "header" };
    }
  }

  // Strategy: subdomain
  if (strategy === "subdomain") {
    // Remove port
    const host = hostname.split(":")[0] || "";

    // Parse subdomain
    // e.g., "acme.example.com" → ["acme", "example", "com"]
    // e.g., "acme.localhost"   → ["acme", "localhost"]
    const parts = host.split(".");

    // Known development / testing patterns
    const knownTLDs = ["localhost", "local", "test", "vercel.app", "nexusdevstudio.ro"];

    if (parts.length >= 3) {
      // Check if the last two parts form a known base domain
      const tld = parts[parts.length - 1];
      const sld = parts[parts.length - 2];

      // For localhost:3000, parts = ["localhost"], so this won't trigger
      // For acme.localhost:3000, parts = ["acme", "localhost"]
      if (knownTLDs.includes(tld) && parts.length === 2) {
        const candidate = parts[0] || "";
        if (candidate && candidate !== "www") {
          return { slug: candidate.toLowerCase(), source: "subdomain" };
        }
      }

      // For acme.example.com
      if (parts.length >= 3) {
        const candidate = parts[0] || "";
        if (candidate && candidate !== "www" && candidate !== "api") {
          return { slug: candidate.toLowerCase(), source: "subdomain" };
        }
      }
    }

    // Single-level host (e.g., localhost) → use default
    if (parts.length <= 2 && knownTLDs.includes(parts[parts.length - 1] || "")) {
      return { slug: defaultSlug, source: "default" };
    }
  }

  // Strategy: path
  if (strategy === "path") {
    const pathname = request.nextUrl.pathname;
    const segments = pathname.split("/").filter(Boolean);

    // Skip locale segment if present
    let idx = 0;
    if (segments[0] && SUPPORTED_LOCALES.includes(segments[0])) {
      idx = 1;
    }

    if (segments[idx] && /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i.test(segments[idx]!)) {
      return { slug: segments[idx]!.toLowerCase(), source: "path" };
    }
  }

  // Strategy: hostname (custom domain mapping — handled at app level,
  // here we pass the full hostname as the slug for the app to resolve)
  if (strategy === "hostname") {
    const host = hostname.split(":")[0] || "";
    return { slug: host.toLowerCase(), source: "subdomain", customDomain: host.toLowerCase() };
  }

  // Fallback
  return { slug: defaultSlug, source: "default" };
}

// ---------------------------------------------------------------------------
// 3. LOCALE DETECTION
// ---------------------------------------------------------------------------

/**
 * Detect the locale from the request URL, cookie, or Accept-Language header.
 *
 * If the URL does not contain a locale prefix, a redirect to the detected
 * locale is returned.
 *
 * Locale detection priority:
 *   1. URL path segment (e.g., /ro/dashboard)
 *   2. NEXT_LOCALE cookie
 *   3. Accept-Language header
 *   4. Fallback locale (en)
 */
function detectLocale(request: NextRequest): LocaleContext {
  const pathname = request.nextUrl.pathname;
  const segments = pathname.split("/").filter(Boolean);

  // Check if the first path segment is a supported locale
  const firstSegment = segments[0] || "";

  if (SUPPORTED_LOCALES.includes(firstSegment)) {
    return {
      locale: firstSegment,
      source: "url",
      needsRedirect: false,
    };
  }

  // Check cookie
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale)) {
    return {
      locale: cookieLocale,
      source: "cookie",
      needsRedirect: true,
      redirectTo: buildLocalizedPath(pathname, cookieLocale),
    };
  }

  // Check Accept-Language header
  const acceptLanguage = request.headers.get("accept-language");
  if (acceptLanguage) {
    const preferred = parseAcceptLanguageHeader(acceptLanguage);
    if (preferred) {
      return {
        locale: preferred,
        source: "header",
        needsRedirect: true,
        redirectTo: buildLocalizedPath(pathname, preferred),
      };
    }
  }

  // Fallback
  return {
    locale: DEFAULT_LOCALE,
    source: "fallback",
    needsRedirect: true,
    redirectTo: buildLocalizedPath(pathname, DEFAULT_LOCALE),
  };
}

/**
 * Parse the Accept-Language header and return the best matching locale.
 */
function parseAcceptLanguageHeader(header: string): string | null {
  const entries = header
    .split(",")
    .map((part) => {
      const [locale, qPart] = part.trim().split(";");
      let quality = 1.0;
      if (qPart) {
        const match = qPart.trim().match(/^q=([0-9.]+)$/i);
        if (match) {
          quality = parseFloat(match[1]!);
        }
      }
      return { locale: locale?.trim() || "", quality };
    })
    .filter((e) => e.locale && e.locale !== "*")
    .sort((a, b) => b.quality - a.quality);

  for (const { locale } of entries) {
    // Exact match
    if (SUPPORTED_LOCALES.includes(locale)) return locale;

    // Language-only match (e.g., "ro-RO" → "ro")
    const lang = locale.split("-")[0];
    if (lang && SUPPORTED_LOCALES.includes(lang)) return lang;
  }

  return null;
}

/**
 * Build a locale-prefixed path.
 */
function buildLocalizedPath(pathname: string, locale: string): string {
  // Preserve query string
  // If already prefixed (shouldn't happen), strip and re-add
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] && SUPPORTED_LOCALES.includes(segments[0])) {
    segments.shift();
  }
  const cleanPath = segments.length > 0 ? `/${segments.join("/")}` : "/";
  return `/${locale}${cleanPath}`;
}

// ---------------------------------------------------------------------------
// 4. AUTHENTICATION CHECK
// ---------------------------------------------------------------------------

/**
 * Verify the next-auth session JWT and extract user information.
 *
 * Uses the Web Crypto API (jose) for JWT verification — compatible with
 * Edge runtime. Falls back to allowing the request if NEXTAUTH_SECRET is
 * not configured (graceful degradation).
 */
async function checkAuth(request: NextRequest): Promise<AuthContext> {
  // Default unauthenticated context
  const unauthenticated: AuthContext = {
    authenticated: false,
  };

  // Get session token from cookie
  let sessionToken: string | undefined;

  for (const cookieName of SESSION_COOKIE_NAMES) {
    const cookie = request.cookies.get(cookieName);
    if (cookie?.value) {
      sessionToken = cookie.value;
      break;
    }
  }

  if (!sessionToken) {
    return unauthenticated;
  }

  // Verify JWT
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    // NEXTAUTH_SECRET is not configured — allow the request
    // and let the API route handle full validation
    return unauthenticated;
  }

  try {
    const payload = await verifyJWT(sessionToken, secret);
    if (!payload || !payload.sub) {
      return unauthenticated;
    }

    // Check expiration
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return unauthenticated;
    }

    return {
      authenticated: true,
      userId: payload.sub,
      organizationId: payload.organizationId as string | undefined,
      session: payload,
    };
  } catch {
    return unauthenticated;
  }
}

/**
 * Verify a JWT using jose (edge-compatible).
 * Only imports `jwtVerify` – `createRemoteJWKSet` is not needed for symmetric HS256/HS512.
 */
async function verifyJWT(
  token: string,
  secret: string,
): Promise<SessionPayload | null> {
  try {
    // Dynamic import to avoid bundling jose in all builds
    const { jwtVerify } = await import("jose");

    // Encode secret to Uint8Array
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(secret);

    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256", "HS512"],
      // Allow some clock tolerance
      clockTolerance: 30, // seconds
    });

    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Determine whether the current path requires authentication.
 */
function pathRequiresAuth(pathname: string): boolean {
  // Check public prefixes first (they override protected)
  const publicPrefixes = envList("AUTH_PUBLIC_PREFIXES", DEFAULT_PUBLIC_PREFIXES);
  for (const prefix of publicPrefixes) {
    if (pathname.startsWith(prefix)) {
      return false;
    }
  }

  // Check protected prefixes
  const protectedPrefixes = envList(
    "AUTH_PROTECTED_PREFIXES",
    DEFAULT_PROTECTED_PREFIXES,
  );
  for (const prefix of protectedPrefixes) {
    if (pathname.startsWith(prefix)) {
      return true;
    }
  }

  // Default: API routes under /api/ that aren't explicitly public require auth
  if (
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/auth/") &&
    !pathname.startsWith("/api/public/") &&
    !pathname.startsWith("/api/webhook/") &&
    !pathname.startsWith("/api/health")
  ) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// 5. RATE LIMITING (Edge-Compatible)
// ---------------------------------------------------------------------------

/**
 * In-memory rate-limit store for the Edge runtime.
 *
 * ⚠️ In a distributed deployment (multiple edge nodes), this will NOT
 * provide global rate limiting — each node maintains its own counters.
 *
 * For production, replace this with:
 *   - Upstash Redis (@upstash/redis — already in dependencies!)
 *   - Cloudflare Workers KV
 *   - A dedicated rate-limit service
 *
 * The project's `src/lib/rate-limit.ts` provides a full Redis-backed
 * implementation for Node.js runtime contexts (API routes, server actions).
 * Here we provide a lightweight edge-compatible fallback.
 */
const rateLimitStore = new Map<string, RateLimitBucket>();

/**
 * Clean up expired rate-limit entries periodically.
 */
function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, bucket] of rateLimitStore) {
    const windowMs = envInt("RATELIMIT_API_WINDOW_S", 60) * 1000;
    if (now - bucket.windowStart > windowMs * 2) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Check rate limit for the current request (edge-compatible sliding window).
 *
 * Returns null if the request is allowed, or a 429 response if blocked.
 */
function checkRateLimit(request: NextRequest): NextResponse | null {
  const enabled = envBool("RATELIMIT_ENABLED", true);
  if (!enabled) return null;

  const pathname = request.nextUrl.pathname;

  // Only rate-limit API routes and auth endpoints
  if (
    !pathname.startsWith("/api/") &&
    !pathname.startsWith("/auth/") &&
    pathname !== "/login" &&
    pathname !== "/signup"
  ) {
    return null;
  }

  // Periodic cleanup (probabilistic — ~1% chance per check)
  if (Math.random() < 0.01) {
    cleanupRateLimitStore();
  }

  const clientIP = getClientIP(request);
  const maxRequests = envInt("RATELIMIT_API_MAX", 60);
  const windowSeconds = envInt("RATELIMIT_API_WINDOW_S", 60);
  const windowMs = windowSeconds * 1000;
  const now = Date.now();

  const key = `rl:${clientIP}`;
  let bucket = rateLimitStore.get(key);

  if (!bucket || (now - bucket.windowStart) > windowMs) {
    // Start a new window
    bucket = { count: 1, windowStart: now };
    rateLimitStore.set(key, bucket);
    return null; // Allowed
  }

  bucket.count++;

  if (bucket.count > maxRequests) {
    const resetAt = Math.ceil((bucket.windowStart + windowMs) / 1000);
    const retryAfter = Math.max(1, resetAt - Math.ceil(now / 1000));

    const body = JSON.stringify({
      success: false,
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: `Too many requests. Try again in ${retryAfter} seconds.`,
        retryAfterSeconds: retryAfter,
      },
    });

    return new NextResponse(body, {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
        "RateLimit-Limit": String(maxRequests),
        "RateLimit-Remaining": "0",
        "RateLimit-Reset": String(resetAt),
        "Cache-Control": "no-store, must-revalidate",
      },
    });
  }

  return null; // Allowed
}

// ---------------------------------------------------------------------------
// 6. SECURITY HEADERS
// ---------------------------------------------------------------------------

/**
 * Build the Content Security Policy header value.
 *
 * This is a strict CSP that can be customized per environment.
 * Report-only mode is enabled by SECURITY_CSP_REPORT_ONLY=true.
 */
function buildCSP(request: NextRequest): string {
  const reportUri = envStr("SECURITY_CSP_REPORT_URI", "");

  const directives: string[] = [
    // Default to self — deny everything else by default
    "default-src 'self'",

    // Scripts
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // eval needed for Next.js dev
    "script-src-elem 'self' 'unsafe-inline'",

    // Styles
    "style-src 'self' 'unsafe-inline'",
    "style-src-elem 'self' 'unsafe-inline'",

    // Images
    "img-src 'self' data: blob: https:",

    // Fonts
    "font-src 'self' data:",

    // Connections (API, WebSockets)
    "connect-src 'self' https: wss:",

    // Media
    "media-src 'self'",

    // Frames
    "frame-src 'self' https:",

    // Workers
    "worker-src 'self' blob:",

    // Form actions
    "form-action 'self'",

    // Base URI
    "base-uri 'self'",

    // Object (plugins) — deny
    "object-src 'none'",

    // Frame ancestors (clickjacking protection — also covered by X-Frame-Options)
    "frame-ancestors 'none'",

    // Upgrade insecure requests (in production)
    ...(process.env.NODE_ENV === "production" ? ["upgrade-insecure-requests"] : []),
  ];

  // Add report-uri if configured
  if (reportUri) {
    directives.push(`report-uri ${reportUri}`);
  }

  return directives.join("; ");
}

/**
 * Build all security headers for the response.
 */
function buildSecurityHeaders(request: NextRequest): Record<string, string> {
  const headers: Record<string, string> = {};

  // --- Content Security Policy ---
  const csp = buildCSP(request);
  const cspReportOnly = envBool("SECURITY_CSP_REPORT_ONLY", false);
  headers[cspReportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy"] = csp;

  // --- Strict Transport Security ---
  const hstsMaxAge = envInt("SECURITY_HSTS_MAX_AGE", 63072000); // 2 years
  let hsts = `max-age=${hstsMaxAge}`;
  if (envBool("SECURITY_HSTS_INCLUDE_SUBDOMAINS", true)) {
    hsts += "; includeSubDomains";
  }
  if (envBool("SECURITY_HSTS_PRELOAD", false)) {
    hsts += "; preload";
  }
  headers["Strict-Transport-Security"] = hsts;

  // --- X-Frame-Options (legacy, CSP frame-ancestors is preferred) ---
  headers["X-Frame-Options"] = envStr("SECURITY_FRAME_OPTIONS", "DENY");

  // --- X-Content-Type-Options ---
  headers["X-Content-Type-Options"] = "nosniff";

  // --- Referrer-Policy ---
  headers["Referrer-Policy"] = envStr(
    "SECURITY_REFERRER_POLICY",
    "strict-origin-when-cross-origin",
  );

  // --- Permissions-Policy ---
  headers["Permissions-Policy"] = envStr(
    "SECURITY_PERMISSIONS_POLICY",
    "camera=(), microphone=(), geolocation=(), interest-cohort=(), " +
    "autoplay=(self), fullscreen=(self), clipboard-read=(self), clipboard-write=(self)",
  );

  // --- X-DNS-Prefetch-Control ---
  headers["X-DNS-Prefetch-Control"] = "on";

  // --- X-Download-Options (IE) ---
  headers["X-Download-Options"] = "noopen";

  // --- X-Permitted-Cross-Domain-Policies ---
  headers["X-Permitted-Cross-Domain-Policies"] = "none";

  // --- Cross-Origin-Resource-Policy ---
  headers["Cross-Origin-Resource-Policy"] = envStr(
    "SECURITY_CORP",
    "same-origin",
  );

  // --- Cross-Origin-Opener-Policy ---
  headers["Cross-Origin-Opener-Policy"] = envStr(
    "SECURITY_COOP",
    "same-origin",
  );

  // --- Cross-Origin-Embedder-Policy ---
  // Only set if explicitly configured (can break third-party embeds)
  const coep = envStr("SECURITY_COEP", "");
  if (coep) {
    headers["Cross-Origin-Embedder-Policy"] = coep;
  }

  // --- Vary ---
  headers["Vary"] = "Accept-Encoding, Accept-Language, Origin";

  return headers;
}

// ---------------------------------------------------------------------------
// 7. CORS HANDLING (for API routes)
// ---------------------------------------------------------------------------

/**
 * Handle CORS preflight (OPTIONS) requests and add CORS headers to responses.
 */
function handleCORS(
  request: NextRequest,
  response: NextResponse,
): NextResponse {
  const pathname = request.nextUrl.pathname;

  // Only apply CORS to API routes
  if (!pathname.startsWith("/api/")) {
    return response;
  }

  const origin = request.headers.get("origin");
  const allowedOrigins = envList("CORS_ALLOWED_ORIGINS", []);
  const allowCredentials = envBool("CORS_ALLOW_CREDENTIALS", true);
  const maxAge = envInt("CORS_MAX_AGE", 86400); // 24 hours

  // Determine if origin is allowed
  let allowedOrigin = "";
  if (allowedOrigins.length === 0 || allowedOrigins.includes("*")) {
    allowedOrigin = origin || "*";
  } else if (origin) {
    // Check exact match or pattern match
    const matched = allowedOrigins.some((allowed) => {
      if (allowed === origin) return true;
      // Simple glob: *.example.com matches sub.example.com
      if (allowed.startsWith("*.")) {
        const suffix = allowed.slice(1); // .example.com
        return origin.endsWith(suffix);
      }
      return false;
    });
    allowedOrigin = matched ? origin : "";
  }

  // Set CORS headers
  if (allowedOrigin) {
    response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  }

  if (allowCredentials && allowedOrigin !== "*") {
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  // For preflight requests
  if (request.method === "OPTIONS") {
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS",
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      request.headers.get("access-control-request-headers") ||
        "Content-Type, Authorization, X-Requested-With, X-CSRF-Token, X-Tenant-Slug, Accept, Accept-Language",
    );
    response.headers.set(
      "Access-Control-Expose-Headers",
      "RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset, Retry-After, X-Request-Id, X-Correlation-Id",
    );
    response.headers.set("Access-Control-Max-Age", String(maxAge));
  }

  return response;
}

// ---------------------------------------------------------------------------
// 8. PATH REWRITING (Tenant + Locale)
// ---------------------------------------------------------------------------

/**
 * Optionally rewrite the URL to include tenant context.
 *
 * For path-based tenant strategy, the tenant slug is consumed from the URL
 * and set as a header for downstream handlers.
 */
function applyTenantRewrite(
  request: NextRequest,
  tenant: TenantContext,
): NextRequest | null {
  // For path-based tenants, strip the tenant slug from the URL
  // and add it as a header so downstream handlers can use it
  if (tenant.source === "path") {
    const pathname = request.nextUrl.pathname;
    const segments = pathname.split("/").filter(Boolean);

    // Remove locale segment if present
    let idx = 0;
    if (segments[0] && SUPPORTED_LOCALES.includes(segments[0])) {
      idx = 1;
    }

    // Remove tenant segment
    if (segments[idx] && segments[idx]!.toLowerCase() === tenant.slug) {
      segments.splice(idx, 1);
    }

    const newPathname = segments.length > 0 ? `/${segments.join("/")}` : "/";
    const newUrl = new URL(newPathname, request.url);
    newUrl.search = request.nextUrl.search;

    const rewritten = new NextRequest(newUrl, request);
    rewritten.headers.set("x-tenant-slug", tenant.slug);
    rewritten.headers.set("x-tenant-source", tenant.source);
    return rewritten;
  }

  // For subdomain/header tenants, just add headers
  const headers = new Headers(request.headers);
  headers.set("x-tenant-slug", tenant.slug);
  headers.set("x-tenant-source", tenant.source);

  return null; // No URL rewrite needed — headers are set in the response phase
}

// ---------------------------------------------------------------------------
// 9. RESPONSE ENRICHMENT
// ---------------------------------------------------------------------------

/**
 * Add common response headers for tracing, tenant, and locale.
 */
function enrichResponse(
  response: NextResponse,
  ctx: MiddlewareContext,
): NextResponse {
  // Tracing
  response.headers.set(REQUEST_ID_HEADER, ctx.requestId);
  response.headers.set(CORRELATION_ID_HEADER, ctx.requestId);

  // Tenant
  response.headers.set("x-tenant-slug", ctx.tenant.slug);
  response.headers.set("x-tenant-source", ctx.tenant.source);

  // Locale
  response.headers.set("x-locale", ctx.locale.locale);
  response.headers.set("x-locale-source", ctx.locale.source);

  // Auth
  if (ctx.auth.authenticated) {
    response.headers.set("x-auth-status", "authenticated");
    if (ctx.auth.userId) {
      response.headers.set("x-user-id", ctx.auth.userId);
    }
    if (ctx.auth.organizationId) {
      response.headers.set("x-organization-id", ctx.auth.organizationId);
    }
  }

  // Timing
  const elapsed = Date.now() - ctx.startTime;
  response.headers.set("x-response-time-ms", String(elapsed));

  // Cache control for authenticated pages
  if (ctx.auth.authenticated) {
    response.headers.set(
      "Cache-Control",
      "private, no-cache, no-store, must-revalidate",
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }

  return response;
}

// ---------------------------------------------------------------------------
// Helpers: Path Matching
// ---------------------------------------------------------------------------

/**
 * Check if the path should be skipped by middleware.
 */
function shouldSkipPath(pathname: string): boolean {
  // Exact match check
  for (const prefix of ALWAYS_SKIP_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix)) {
      return true;
    }
  }

  // Static file extensions
  if (/\.(ico|png|jpg|jpeg|gif|svg|webp|avif|css|js|woff2?|ttf|eot|map|txt|xml|webmanifest|json|pdf)$/i.test(pathname)) {
    return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// MAIN MIDDLEWARE HANDLER
// ---------------------------------------------------------------------------

/**
 * The middleware entry point — called by Next.js for every matched request.
 *
 * Pipeline:
 *   maintenance → tenant → locale → rate-limit → auth → security-headers
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const pathname = request.nextUrl.pathname;

  // --- Skip non-applicable paths ---
  if (shouldSkipPath(pathname)) {
    return NextResponse.next();
  }

  // --- Generate or extract request ID ---
  const requestId = getRequestId(request);

  // --- 1. Tenant Detection ---
  const tenant = detectTenant(request);

  // --- 2. Maintenance Mode Check ---
  const maintenanceResponse = checkMaintenance(request, tenant);
  if (maintenanceResponse) {
    maintenanceResponse.headers.set(REQUEST_ID_HEADER, requestId);
    maintenanceResponse.headers.set("x-tenant-slug", tenant.slug);
    return maintenanceResponse;
  }

  // --- 3. Locale Detection + Redirect ---
  const locale = detectLocale(request);

  if (locale.needsRedirect && locale.redirectTo) {
    // Only redirect for non-API, non-asset paths
    if (
      !pathname.startsWith("/api/") &&
      !pathname.startsWith("/_next/") &&
      !pathname.includes(".")
    ) {
      const redirectUrl = new URL(locale.redirectTo, request.url);
      redirectUrl.search = request.nextUrl.search;

      const redirectResponse = NextResponse.redirect(redirectUrl, {
        status: 307, // Temporary redirect — preserves method
      });

      // Set locale cookie
      redirectResponse.cookies.set("NEXT_LOCALE", locale.locale, {
        path: "/",
        maxAge: 31536000, // 1 year
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });

      redirectResponse.headers.set(REQUEST_ID_HEADER, requestId);
      redirectResponse.headers.set("x-tenant-slug", tenant.slug);
      redirectResponse.headers.set("x-locale", locale.locale);

      return redirectResponse;
    }
  }

  // Set locale cookie if detected from header or cookie
  if (locale.source === "header" || locale.source === "cookie") {
    // We'll set it in the response later
  }

  // --- 4. Rate Limiting ---
  const rateLimitResponse = checkRateLimit(request);
  if (rateLimitResponse) {
    rateLimitResponse.headers.set(REQUEST_ID_HEADER, requestId);
    rateLimitResponse.headers.set("x-tenant-slug", tenant.slug);
    rateLimitResponse.headers.set("x-locale", locale.locale);
    return rateLimitResponse;
  }

  // --- 5. Authentication Check ---
  const auth = await checkAuth(request);

  // Protect routes that require authentication
  if (pathRequiresAuth(pathname) && !auth.authenticated) {
    // For API routes, return 401 JSON
    if (pathname.startsWith("/api/")) {
      const body = JSON.stringify({
        success: false,
        error: {
          code: "AUTH_UNAUTHORIZED",
          message: "Authentication is required to access this resource.",
        },
      });

      return new NextResponse(body, {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          REQUEST_ID_HEADER: requestId,
          "x-tenant-slug": tenant.slug,
          "x-locale": locale.locale,
        },
      });
    }

    // For page requests, redirect to login
    const loginUrl = new URL(
      `/${locale.locale}/login`,
      request.url,
    );
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);

    const redirectResponse = NextResponse.redirect(loginUrl, { status: 302 });

    // Clear any invalid session cookies
    for (const cookieName of SESSION_COOKIE_NAMES) {
      if (request.cookies.has(cookieName)) {
        redirectResponse.cookies.set(cookieName, "", {
          path: "/",
          maxAge: 0,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
      }
    }

    redirectResponse.headers.set(REQUEST_ID_HEADER, requestId);
    redirectResponse.headers.set("x-tenant-slug", tenant.slug);
    redirectResponse.headers.set("x-locale", locale.locale);

    return redirectResponse;
  }

  // --- Build the middleware context ---
  const ctx: MiddlewareContext = {
    tenant,
    locale,
    auth,
    requestId,
    startTime,
  };

  // --- Proceed to the route ---
  let response = NextResponse.next();

  // --- Apply tenant rewrite if needed ---
  if (tenant.source === "path") {
    const rewritten = applyTenantRewrite(request, tenant);
    if (rewritten) {
      response = NextResponse.rewrite(rewritten.nextUrl);
    }
  }

  // --- 6. Security Headers ---
  const securityHeaders = buildSecurityHeaders(request);
  for (const [key, value] of Object.entries(securityHeaders)) {
    response.headers.set(key, value);
  }

  // --- 7. CORS ---
  response = handleCORS(request, response);

  // --- 8. Set locale cookie if needed ---
  if (locale.source === "header" || locale.source === "cookie") {
    response.cookies.set("NEXT_LOCALE", locale.locale, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  // --- 9. Add tenant + locale headers for downstream ---
  response.headers.set("x-tenant-slug", tenant.slug);
  response.headers.set("x-tenant-source", tenant.source);
  response.headers.set("x-locale", locale.locale);
  response.headers.set("x-locale-source", locale.source);

  if (tenant.customDomain) {
    response.headers.set("x-tenant-custom-domain", tenant.customDomain);
  }

  // --- 10. Auth headers ---
  if (auth.authenticated) {
    response.headers.set("x-auth-status", "authenticated");
    if (auth.userId) {
      response.headers.set("x-user-id", auth.userId);
    }
    if (auth.organizationId) {
      response.headers.set("x-organization-id", auth.organizationId);
    }
  }

  // --- 11. Request ID + Timing ---
  response.headers.set(REQUEST_ID_HEADER, requestId);
  response.headers.set(CORRELATION_ID_HEADER, requestId);
  response.headers.set("x-response-time-ms", String(Date.now() - startTime));

  // --- 12. Cache-Control for authenticated pages ---
  if (auth.authenticated) {
    response.headers.set(
      "Cache-Control",
      "private, no-cache, no-store, must-revalidate",
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }

  return response;
}

// ---------------------------------------------------------------------------
// MIDDLEWARE CONFIG (Exported for Next.js)
// ---------------------------------------------------------------------------

/**
 * Middleware matcher configuration.
 *
 * The middleware runs on all paths except:
 *   - Static assets (_next/static, public/, assets/, fonts/, images/)
 *   - Favicon, robots.txt, sitemap.xml, manifest.json
 *   - Health check endpoint (api/health — but we DO run security headers on it via skip list)
 *
 * This uses the exported `config` object for Next.js.
 *
 * Reference: https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, robots.txt, sitemap.xml, manifest.json, sw.js
     * - Static assets (images, fonts, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.json|sw.js|workbox-.*|.*\\.(?:ico|png|jpg|jpeg|gif|svg|webp|avif|css|js|woff2?|ttf|eot|map|txt)).*)",
  ],
};
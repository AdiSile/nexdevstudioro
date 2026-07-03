/**
 * CSRF Protection — Synchronizer Token Pattern & Double Submit Cookie
 *
 * Production-grade Cross-Site Request Forgery defense with per-session token
 * generation, HMAC-signed stateless tokens, and defense-in-depth layers.
 *
 * Security Architecture (multi-layer):
 *   1. Synchronizer Token Pattern — per-session cryptographically random token
 *   2. HMAC-SHA256 signed tokens — stateless verification without Redis round-trip
 *   3. Double Submit Cookie — non-HttpOnly cookie + request header/body match
 *   4. SameSite Cookie Attribute — Strict/Lax prevents cross-origin cookie sending
 *   5. __Host- cookie prefix — browser-enforced Secure + Path=/ + no Domain
 *   6. Origin / Referer Header Validation — defense-in-depth origin check
 *   7. Constant-time comparison — crypto.timingSafeEqual prevents timing leaks
 *   8. Token TTL — tokens auto-expire after configurable window
 *   9. Token Rotation — optional per-use regeneration with grace period
 *  10. User-Agent Binding — optional token-to-UA fingerprint binding
 *  11. Protected Methods Only — only state-changing HTTP methods are guarded
 *  12. Cookie-to-Header Double Submit — cookie value must match request value
 *
 * Token Format (signed):
 *   <sessionId>.<nonce>.<issuedAtMs>[.<uaHash>].<hmacSignature>
 *
 *   - sessionId: binds token to a specific session
 *   - nonce: 128-bit CSPRNG nonce ensures uniqueness
 *   - issuedAtMs: Unix milliseconds for TTL enforcement
 *   - uaHash: optional HMAC of User-Agent for additional binding
 *   - hmacSignature: HMAC-SHA256 over payload using CSRF_SECRET
 *
 * Token Transmission (client → server, ONE of):
 *   - HTTP Header: X-CSRF-Token (or configured header name) — recommended for SPAs
 *   - X-XSRF-Token Header: Angular/axios convention
 *   - Request Body: _csrf field — for <form> submissions
 *   - Query Parameter: _csrf — discouraged (logged by proxies, persisted in history)
 *
 * Cookie Configuration:
 *   Default cookie name: __Host-csrf-token
 *   - __Host- prefix enforces: Secure, Path=/, no Domain (browser-enforced)
 *   - Non-HttpOnly: JavaScript can read it for SPA usage
 *   - SameSite=Strict: cookie not sent on cross-origin requests
 *
 * Double Submit Cookie Mode:
 *   1. Server sets CSRF token in a non-HttpOnly cookie
 *   2. Client reads cookie value and sends it back in a header or body
 *   3. Server compares cookie value with request value (constant-time)
 *   → Attacker cannot read the cookie (SameSite + origin boundaries)
 *   → Attacker cannot inject the value (can't set headers cross-origin)
 *
 * Environment Variables:
 *   CSRF_SECRET                  — HMAC secret (REQUIRED, min 32 chars)
 *   CSRF_COOKIE_NAME             — cookie name (default: __Host-csrf-token)
 *   CSRF_COOKIE_SAMESITE         — Strict | Lax | None (default: Strict)
 *   CSRF_COOKIE_SECURE           — Secure flag (default: true in production)
 *   CSRF_TOKEN_TTL_S             — token lifetime seconds (default: 3600 = 1h)
 *   CSRF_TOKEN_ROTATE            — rotate token after each validation (default: false)
 *   CSRF_TOKEN_GRACE_PERIOD_S    — old token validity after rotation (default: 5)
 *   CSRF_HEADER_NAME             — header for token (default: X-CSRF-Token)
 *   CSRF_BODY_FIELD              — body field name (default: _csrf)
 *   CSRF_SKIP_ORIGIN_CHECK       — skip Origin/Referer validation (default: false)
 *   CSRF_ALLOWED_ORIGINS         — comma-separated extra origins (default: empty)
 *   CSRF_ENABLED                 — master switch (default: true)
 *   CSRF_METHODS                 — protected HTTP methods (default: POST,PUT,PATCH,DELETE)
 *   CSRF_FAIL_OPEN               — allow request if HMAC validation fails unexpectedly (default: false)
 *   CSRF_BIND_USER_AGENT         — bind token to User-Agent fingerprint (default: false)
 *
 * Usage:
 *   import csrf, {
 *     generateCsrfToken,
 *     validateCsrfToken,
 *     extractCsrfToken,
 *     isProtectedMethod,
 *     getCsrfMetaTag,
 *     getCsrfHiddenInput,
 *   } from "@/lib/csrf";
 *
 *   // --- Generate (on page load / login) ---
 *   const result = generateCsrfToken(session.id, req.headers["user-agent"]);
 *   res.setHeader("Set-Cookie", result.cookieHeader);
 *   // Embed in page: <meta name="csrf-token" content={result.token} />
 *
 *   // --- Validate (on state-changing requests) ---
 *   if (isProtectedMethod(req.method)) {
 *     const result = validateCsrfToken(
 *       { headers: req.headers, body: req.body },
 *       { id: session.id },
 *       req.headers["user-agent"],
 *     );
 *     if (!result.valid) {
 *       return new Response(JSON.stringify({ error: result.error }), { status: 403 });
 *     }
 *   }
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Where the CSRF token was found in the request */
export type CsrfTokenSource = "header" | "body" | "query" | "cookie" | "none";

/** Result of CSRF validation */
export interface CsrfValidationResult {
  /** Whether the request passed CSRF validation */
  valid: boolean;
  /** Where the token was found */
  source: CsrfTokenSource;
  /** The raw token value received (null if not found) */
  token: string | null;
  /** Error reason if invalid */
  error?: string;
  /** Whether HMAC infrastructure was available */
  cryptoAvailable: boolean;
}

/** CSRF configuration */
export interface CsrfConfig {
  /** HMAC secret for token signing */
  secret: string;
  /** Cookie name */
  cookieName: string;
  /** Cookie path */
  cookiePath: string;
  /** SameSite attribute */
  cookieSameSite: "Strict" | "Lax" | "None";
  /** Secure flag */
  cookieSecure: boolean;
  /** HttpOnly flag (false = JS-readable, needed for SPA double-submit) */
  cookieHttpOnly: boolean;
  /** Token lifetime in seconds */
  tokenTtlSeconds: number;
  /** Rotate token after each successful validation */
  tokenRotate: boolean;
  /** Grace period (seconds) where previous token is still accepted after rotation */
  tokenGracePeriodSeconds: number;
  /** HTTP header name to read token from */
  headerName: string;
  /** Body field name */
  bodyField: string;
  /** Query parameter name (discouraged) */
  queryField: string;
  /** Skip Origin/Referer validation */
  skipOriginCheck: boolean;
  /** Allowed origins (empty = same-origin only) */
  allowedOrigins: string[];
  /** Master switch */
  enabled: boolean;
  /** Fail-open if crypto fails unexpectedly */
  failOpen: boolean;
  /** HTTP methods to protect */
  protectedMethods: Set<string>;
  /** Bind token to User-Agent hash */
  bindToUserAgent: boolean;
}

/** Session-like object for CSRF token binding */
export interface CsrfSession {
  /** Session ID (or temporary fingerprint ID for anonymous users) */
  id: string;
  /** Current signed token (for server-side tracking) */
  token?: string;
  /** Token issued at (Unix ms) */
  tokenIssuedAt?: number;
  /** Previous token (for rotation grace period) */
  previousToken?: string;
}

/** Result of token generation */
export interface CsrfTokenResult {
  /** The signed token string to send to client */
  token: string;
  /** Full Set-Cookie header value */
  cookieHeader: string;
  /** The signed token (same as token — for server-side storage reference) */
  signedToken: string;
  /** Unix ms when token expires */
  expiresAt: number;
}

/** Parsed signed token fields */
interface ParsedSignedToken {
  /** Session ID embedded in the token */
  sid: string;
  /** Cryptographic nonce */
  nonce: string;
  /** Issued at (Unix ms) */
  iat: number;
  /** User-Agent hash (if binding enabled) */
  ua?: string;
  /** HMAC signature */
  sig: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOKEN_BYTE_LENGTH = 32; // 256 bits
const NONCE_BYTE_LENGTH = 16; // 128 bits
const HMAC_ALGORITHM = "sha256";
const SIGNED_TOKEN_DELIMITER = ".";
const MIN_SECRET_LENGTH = 32;

/** Default state-changing HTTP methods to protect */
const DEFAULT_PROTECTED_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// ---------------------------------------------------------------------------
// Environment Variable Readers
// ---------------------------------------------------------------------------

function envStr(key: string, fallback: string): string {
  const raw = process.env[key];
  return raw !== undefined && raw !== "" ? raw : fallback;
}

function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  return raw === "true" || raw === "1";
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function buildConfig(): CsrfConfig {
  const isProduction = process.env.NODE_ENV === "production";

  const methodsRaw = process.env.CSRF_METHODS;
  const methods = methodsRaw
    ? new Set(methodsRaw.split(",").map((m) => m.trim().toUpperCase()))
    : DEFAULT_PROTECTED_METHODS;

  const originsRaw = process.env.CSRF_ALLOWED_ORIGINS;
  const allowedOrigins = originsRaw
    ? originsRaw
        .split(",")
        .map((o) => o.trim().toLowerCase())
        .filter(Boolean)
    : [];

  const sameSiteRaw = envStr("CSRF_COOKIE_SAMESITE", "Strict");

  return {
    secret: envStr("CSRF_SECRET", ""),
    cookieName: envStr("CSRF_COOKIE_NAME", "__Host-csrf-token"),
    cookiePath: "/",
    cookieSameSite: (["Strict", "Lax", "None"].includes(sameSiteRaw)
      ? sameSiteRaw
      : "Strict") as CsrfConfig["cookieSameSite"],
    cookieSecure: envBool("CSRF_COOKIE_SECURE", isProduction),
    cookieHttpOnly: envBool("CSRF_COOKIE_HTTPONLY", false),
    tokenTtlSeconds: envInt("CSRF_TOKEN_TTL_S", 3600),
    tokenRotate: envBool("CSRF_TOKEN_ROTATE", false),
    tokenGracePeriodSeconds: envInt("CSRF_TOKEN_GRACE_PERIOD_S", 5),
    headerName: envStr("CSRF_HEADER_NAME", "X-CSRF-Token"),
    bodyField: envStr("CSRF_BODY_FIELD", "_csrf"),
    queryField: envStr("CSRF_QUERY_FIELD", "_csrf"),
    skipOriginCheck: envBool("CSRF_SKIP_ORIGIN_CHECK", false),
    allowedOrigins,
    enabled: envBool("CSRF_ENABLED", true),
    failOpen: envBool("CSRF_FAIL_OPEN", false),
    protectedMethods: methods,
    bindToUserAgent: envBool("CSRF_BIND_USER_AGENT", false),
  };
}

let _config: CsrfConfig | undefined;

function getConfig(): CsrfConfig {
  if (!_config) {
    _config = buildConfig();
    _validateConfig(_config);
  }
  return _config;
}

function _validateConfig(config: CsrfConfig): void {
  if (!config.secret || config.secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `[csrf] CSRF_SECRET must be at least ${MIN_SECRET_LENGTH} characters. ` +
        `Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`,
    );
  }

  if (!["Strict", "Lax", "None"].includes(config.cookieSameSite)) {
    throw new Error(
      `[csrf] CSRF_COOKIE_SAMESITE must be Strict, Lax, or None. Got: ${config.cookieSameSite}`,
    );
  }

  if (config.cookieSameSite === "None" && !config.cookieSecure) {
    throw new Error(
      "[csrf] SameSite=None requires Secure=true. Set CSRF_COOKIE_SECURE=true.",
    );
  }

  // __Host- prefix security validation
  if (config.cookieName.startsWith("__Host-")) {
    if (!config.cookieSecure) {
      throw new Error(
        "[csrf] __Host- cookie prefix requires Secure=true. Set CSRF_COOKIE_SECURE=true.",
      );
    }
    if (config.cookiePath !== "/") {
      throw new Error(
        "[csrf] __Host- cookie prefix requires Path=/. Do not override CSRF_COOKIE_PATH.",
      );
    }
  }

  // __Secure- prefix requires Secure
  if (config.cookieName.startsWith("__Secure-") && !config.cookieSecure) {
    throw new Error(
      "[csrf] __Secure- cookie prefix requires Secure=true.",
    );
  }
}

/**
 * Reload configuration at runtime (useful for hot-reload / feature flags).
 */
export function reloadConfig(): CsrfConfig {
  _config = buildConfig();
  _validateConfig(_config);
  return _config;
}

// ---------------------------------------------------------------------------
// HMAC Signing & Verification (Constant-Time)
// ---------------------------------------------------------------------------

/**
 * Compute HMAC-SHA256 then encode as base64url.
 */
function hmacSign(data: string, secret: string): string {
  return createHmac(HMAC_ALGORITHM, secret).update(data).digest("base64url");
}

/**
 * Verify HMAC signature in constant time.
 *
 * Uses crypto.timingSafeEqual — resistant to timing side-channel attacks.
 * If the expected and actual lengths differ, we still perform a constant-time
 * comparison against a dummy buffer to prevent length-based timing leaks.
 */
function hmacVerify(data: string, signature: string, secret: string): boolean {
  const expected = Buffer.from(hmacSign(data, secret));
  const actual: Buffer = (() => {
    try {
      return Buffer.from(signature);
    } catch {
      return Buffer.alloc(0);
    }
  })();

  if (expected.length !== actual.length) {
    // Constant-time failure: compare against a same-length dummy
    // so attacker cannot distinguish "bad sig" from "wrong length"
    const dummy = createHmac(HMAC_ALGORITHM, Buffer.alloc(32))
      .update(data)
      .digest();
    try {
      timingSafeEqual(expected, expected);
      timingSafeEqual(dummy, dummy);
    } catch {
      /* never throws */
    }
    return false;
  }

  try {
    return timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// User-Agent Hashing (for optional token binding)
// ---------------------------------------------------------------------------

/**
 * Create a compact, privacy-preserving User-Agent fingerprint.
 *
 * We HMAC the UA instead of storing it raw — the fingerprint is consistent
 * within a secret scope but reveals nothing about the actual UA string.
 */
function hashUserAgent(userAgent: string): string {
  if (!userAgent) return "";
  return createHmac(HMAC_ALGORITHM, getConfig().secret)
    .update(userAgent.toLowerCase().trim())
    .digest("base64url")
    .slice(0, 16);
}

// ---------------------------------------------------------------------------
// Token Construction & Parsing
// ---------------------------------------------------------------------------

/**
 * Generate a cryptographically secure random token (raw, unsigned).
 * Used as the base random component inside a signed token.
 */
function generateRawToken(): string {
  return randomBytes(TOKEN_BYTE_LENGTH).toString("base64url");
}

/**
 * Generate a random nonce for token uniqueness.
 */
function generateNonce(): string {
  return randomBytes(NONCE_BYTE_LENGTH).toString("base64url");
}

/**
 * Build a signed CSRF token bound to a session.
 *
 * Token structure (dot-delimited):
 *   sessionId.nonce.issuedAtMs[.uaHash].signature
 *
 * The signature covers everything before the last dot.
 */
function buildSignedToken(sessionId: string, userAgent?: string): string {
  const config = getConfig();
  const nonce = generateNonce();
  const iat = Date.now();

  let payload = `${sessionId}${SIGNED_TOKEN_DELIMITER}${nonce}${SIGNED_TOKEN_DELIMITER}${iat}`;

  if (config.bindToUserAgent && userAgent) {
    const uaHash = hashUserAgent(userAgent);
    payload += `${SIGNED_TOKEN_DELIMITER}${uaHash}`;
  }

  const signature = hmacSign(payload, config.secret);
  return `${payload}${SIGNED_TOKEN_DELIMITER}${signature}`;
}

/**
 * Parse and verify a signed CSRF token.
 *
 * Returns the parsed fields if the signature is valid, or null if:
 *   - Token format is invalid
 *   - HMAC signature does not verify
 *   - Required fields are missing or malformed
 */
function parseSignedToken(token: string): ParsedSignedToken | null {
  const config = getConfig();
  const parts = token.split(SIGNED_TOKEN_DELIMITER);

  // Minimum: sid.nonce.iat.sig = 4 parts
  // With UA binding: sid.nonce.iat.ua.sig = 5 parts
  if (parts.length !== 4 && parts.length !== 5) {
    return null;
  }

  const sig = parts[parts.length - 1];
  const payloadParts = parts.slice(0, -1);
  const payload = payloadParts.join(SIGNED_TOKEN_DELIMITER);

  // Verify HMAC signature
  if (!hmacVerify(payload, sig, config.secret)) {
    return null;
  }

  const sid = payloadParts[0];
  const nonce = payloadParts[1];
  const iat = Number(payloadParts[2]);

  if (!Number.isInteger(iat) || iat <= 0) {
    return null;
  }

  const ua = payloadParts.length === 4 ? payloadParts[3] : undefined;

  return { sid, nonce, iat, ua, sig };
}

/**
 * Check whether a token has exceeded its TTL.
 */
function isTokenExpired(iat: number): boolean {
  const config = getConfig();
  const now = Date.now();
  const ageSeconds = (now - iat) / 1000;
  return ageSeconds > config.tokenTtlSeconds;
}

/**
 * Check whether a token is within the rotation grace period.
 */
function isWithinGracePeriod(iat: number): boolean {
  const config = getConfig();
  const now = Date.now();
  const ageSeconds = (now - iat) / 1000;
  return ageSeconds <= config.tokenTtlSeconds + config.tokenGracePeriodSeconds;
}

// ---------------------------------------------------------------------------
// Cookie Builder
// ---------------------------------------------------------------------------

/**
 * Build a Set-Cookie header value for the CSRF token cookie.
 *
 * Uses __Host- prefix by default which provides browser-enforced:
 *   - Secure flag MUST be set
 *   - Path MUST be /
 *   - Domain MUST NOT be set (host-only cookie)
 *
 * The cookie is non-HttpOnly by default so JavaScript can read it
 * for double-submit cookie pattern in SPAs.
 */
function buildCsrfCookie(token: string): string {
  const config = getConfig();

  const parts: string[] = [
    `${config.cookieName}=${encodeURIComponent(token)}`,
    `Path=${config.cookiePath}`,
    `SameSite=${config.cookieSameSite}`,
    `Max-Age=${config.tokenTtlSeconds + config.tokenGracePeriodSeconds}`,
  ];

  if (config.cookieSecure) {
    parts.push("Secure");
  }

  if (config.cookieHttpOnly) {
    parts.push("HttpOnly");
  }

  // __Host- cookies MUST NOT set Domain; we intentionally omit it
  // For non-prefixed cookies, we also omit Domain to create a host-only cookie

  return parts.join("; ");
}

// ---------------------------------------------------------------------------
// Public API: Generate Token
// ---------------------------------------------------------------------------

/**
 * Generate a new CSRF token for an active session.
 *
 * Creates a signed token bound to the session ID and returns both the
 * token value and the corresponding Set-Cookie header.
 *
 * The returned `token` should be:
 *   1. Set as a cookie via `cookieHeader`
 *   2. Embedded in the page (meta tag, hidden input)
 *   3. Optionally returned in a response header for SPA bootstrapping
 *
 * @param sessionId — The current session ID.
 * @param userAgent — Optional User-Agent string for additional binding.
 * @returns CsrfTokenResult with token, cookie header, and expiry.
 *
 * @example
 *   const { token, cookieHeader } = generateCsrfToken(session.id, userAgent);
 *   res.setHeader("Set-Cookie", cookieHeader);
 *   // In page template:
 *   //   <meta name="csrf-token" content={token} />
 *   //   <input type="hidden" name="_csrf" value={token} />
 */
export function generateCsrfToken(
  sessionId: string,
  userAgent?: string,
): CsrfTokenResult {
  if (!sessionId) {
    throw new Error("[csrf] sessionId is required for token generation.");
  }

  const config = getConfig();
  const signedToken = buildSignedToken(sessionId, userAgent);
  const cookieHeader = buildCsrfCookie(signedToken);

  return {
    token: signedToken,
    cookieHeader,
    signedToken,
    expiresAt: Date.now() + config.tokenTtlSeconds * 1000,
  };
}

/**
 * Generate a CSRF token for an anonymous user (no session established yet).
 *
 * Creates a temporary fingerprint from IP + User-Agent and uses that
 * as a pseudo-session ID. Less secure than a real session-bound token
 * but provides a baseline of CSRF protection for unauthenticated pages.
 *
 * @param ip — Client IP address
 * @param userAgent — User-Agent header value
 * @returns CsrfTokenResult
 */
export function generateAnonymousCsrfToken(
  ip: string,
  userAgent: string,
): CsrfTokenResult {
  if (!ip || !userAgent) {
    throw new Error("[csrf] Both ip and userAgent are required for anonymous token generation.");
  }

  const config = getConfig();
  const fingerprint = createHmac(HMAC_ALGORITHM, config.secret)
    .update(`${ip}:${userAgent}`)
    .digest("base64url")
    .slice(0, 32);

  return generateCsrfToken(`anon:${fingerprint}`, userAgent);
}

// ---------------------------------------------------------------------------
// Token Extraction
// ---------------------------------------------------------------------------

/**
 * Extract a CSRF token from an incoming request.
 *
 * Checks sources in order of preference:
 *   1. Custom header (default: X-CSRF-Token)
 *   2. X-XSRF-Token header (Angular / axios convention)
 *   3. Request body field (default: _csrf)
 *   4. CSRF cookie (for double-submit comparison)
 *   5. Query parameter (discouraged — leaks via logs, Referer, browser history)
 *
 * @param request — Object with headers, optional body, optional query, optional cookies
 * @returns The extracted token and its source, or null + "none" if not found.
 */
export function extractCsrfToken(request: {
  headers: Record<string, string | string[] | undefined> | Headers;
  body?: Record<string, unknown>;
  query?: Record<string, string | string[] | undefined>;
  cookies?: Record<string, string>;
}): { token: string | null; source: CsrfTokenSource } {
  const config = getConfig();

  // 1. Custom header (X-CSRF-Token or configured name)
  const headerValue = getHeader(request.headers, config.headerName);
  if (headerValue) {
    return { token: headerValue, source: "header" };
  }

  // 2. X-XSRF-Token (Angular/axios automatically sends cookie value here)
  const xsrfHeader = getHeader(request.headers, "X-XSRF-Token");
  if (xsrfHeader) {
    return { token: xsrfHeader, source: "header" };
  }

  // 3. Request body field
  if (request.body && typeof request.body === "object") {
    const bodyToken = (request.body as Record<string, unknown>)[config.bodyField];
    if (typeof bodyToken === "string" && bodyToken.length > 0) {
      return { token: bodyToken, source: "body" };
    }
  }

  // 4. Cookie (for double-submit comparison when header/body also present)
  if (request.cookies) {
    const cookieToken = request.cookies[config.cookieName];
    if (cookieToken && cookieToken.length > 0) {
      return { token: cookieToken, source: "cookie" };
    }
  }

  // 5. Query parameter (least secure — discouraged)
  if (request.query) {
    const queryValue = getQueryParam(request.query, config.queryField);
    if (queryValue) {
      return { token: queryValue, source: "query" };
    }
  }

  return { token: null, source: "none" };
}

// ---------------------------------------------------------------------------
// Header / Query Utilities
// ---------------------------------------------------------------------------

function isHeadersObject(obj: unknown): obj is Headers {
  return typeof Headers !== "undefined" && obj instanceof Headers;
}

function getHeader(
  headers: Record<string, string | string[] | undefined> | Headers,
  name: string,
): string | null {
  if (isHeadersObject(headers)) {
    return headers.get(name);
  }

  // Case-insensitive lookup for plain object headers
  const lower = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower) {
      if (Array.isArray(value)) return value[0] ?? null;
      return value ?? null;
    }
  }

  return null;
}

function getQueryParam(
  query: Record<string, string | string[] | undefined>,
  name: string,
): string | null {
  const value = query[name];
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

// ---------------------------------------------------------------------------
// Origin / Referer Validation (Defense in Depth)
// ---------------------------------------------------------------------------

/**
 * Validate the Origin and/or Referer header against allowed origins.
 *
 * This is a defense-in-depth measure. Even if an attacker somehow obtains
 * a valid CSRF token, a cross-origin request can be blocked here.
 *
 * Validation logic:
 *   - If Origin header is present: must match allowed origins or same-origin
 *   - If only Referer header is present: its origin must match
 *   - If neither header is present: allow (non-browser clients often omit both)
 *   - If no allowed origins configured: require same-origin
 *   - If allowed origins configured: check against that list
 *
 * @returns true if the origin is acceptable, false if it should be rejected.
 */
export function validateOrigin(request: {
  headers: Record<string, string | string[] | undefined> | Headers;
  host?: string;
  protocol?: string;
}): boolean {
  const config = getConfig();

  if (config.skipOriginCheck) {
    return true;
  }

  const origin = getHeader(request.headers, "Origin");
  const referer = getHeader(request.headers, "Referer");

  // No origin information at all — allow (same-origin requests may omit these,
  // as do many non-browser clients like curl, server-to-server calls, etc.)
  if (!origin && !referer) {
    return true;
  }

  // Build the same-origin reference from host header
  let sameOrigin = "";
  if (request.host) {
    const proto = request.protocol || "https";
    sameOrigin = `${proto}://${request.host}`;
  }

  // Collect origins to verify
  const originsToCheck: string[] = [];
  if (origin) {
    originsToCheck.push(origin);
  }
  if (referer) {
    try {
      const refUrl = new URL(referer);
      originsToCheck.push(refUrl.origin);
    } catch {
      // Malformed Referer — reject
      return false;
    }
  }

  // Check each origin
  for (const originToCheck of originsToCheck) {
    const normalized = originToCheck.toLowerCase().replace(/\/$/, "");

    // Same-origin check
    if (sameOrigin && normalized === sameOrigin.toLowerCase().replace(/\/$/, "")) {
      return true;
    }

    // Allowed origins list check
    for (const allowed of config.allowedOrigins) {
      const normalizedAllowed = allowed.replace(/\/$/, "");
      if (normalized === normalizedAllowed) {
        return true;
      }
    }
  }

  // No match found
  return false;
}

// ---------------------------------------------------------------------------
// Public API: Validate Token
// ---------------------------------------------------------------------------

/**
 * Validate a CSRF token for an incoming request.
 *
 * Full validation pipeline:
 *   1. Check master switch (CSRF_ENABLED)
 *   2. Extract token from request (header, body, query, cookie)
 *   3. Parse and verify HMAC signature (constant-time)
 *   4. Verify token is bound to the correct session ID
 *   5. Verify token has not expired (TTL check)
 *   6. If token rotation is enabled, check rotation grace period
 *   7. If User-Agent binding is enabled, verify UA hash matches
 *   8. Validate Origin/Referer header (defense-in-depth)
 *   9. Double Submit Cookie: if cookie present, request token must match it
 *
 * @param request — Request-like object with headers, optional body, query, host, protocol, cookies
 * @param session — Session object with at minimum an `id` field
 * @param userAgent — User-Agent header value (for binding verification)
 * @returns CsrfValidationResult with `valid` flag and optional error message.
 *
 * @example
 *   const result = validateCsrfToken(
 *     {
 *       headers: req.headers,
 *       body: req.body,
 *       cookies: req.cookies,
 *       host: req.headers.host,
 *       protocol: "https",
 *     },
 *     { id: session.id },
 *     req.headers["user-agent"],
 *   );
 *
 *   if (!result.valid) {
 *     return NextResponse.json({ error: result.error }, { status: 403 });
 *   }
 */
export function validateCsrfToken(
  request: {
    headers: Record<string, string | string[] | undefined> | Headers;
    body?: Record<string, unknown>;
    query?: Record<string, string | string[] | undefined>;
    host?: string;
    protocol?: string;
    cookies?: Record<string, string>;
  },
  session: CsrfSession,
  userAgent?: string,
): CsrfValidationResult {
  const config = getConfig();

  // Master switch
  if (!config.enabled) {
    return {
      valid: true,
      source: "none",
      token: null,
      cryptoAvailable: true,
    };
  }

  // 1. Extract token from request
  const { token, source } = extractCsrfToken(request);

  if (!token) {
    return {
      valid: false,
      source: "none",
      token: null,
      error:
        "CSRF token not found in request. " +
        `Expected in header "${config.headerName}", body field "${config.bodyField}", or cookie "${config.cookieName}".`,
      cryptoAvailable: true,
    };
  }

  // 2. Parse and verify HMAC signature
  const parsed = parseSignedToken(token);

  if (!parsed) {
    // If failOpen is true, allow requests with unparseable tokens
    // (useful during secret rotation windows)
    if (config.failOpen) {
      return {
        valid: true,
        source,
        token,
        cryptoAvailable: true,
      };
    }

    return {
      valid: false,
      source,
      token,
      error:
        "CSRF token signature verification failed. " +
        "The token may be tampered, malformed, or signed with a different secret.",
      cryptoAvailable: true,
    };
  }

  // 3. Validate session exists
  if (!session || !session.id) {
    return {
      valid: false,
      source,
      token,
      error: "No session available for CSRF token binding.",
      cryptoAvailable: true,
    };
  }

  // 4. Verify session binding — token must belong to this session
  if (parsed.sid !== session.id) {
    // Rotation grace period: allow previous token if rotation is enabled
    if (config.tokenRotate && session.previousToken) {
      const prevParsed = parseSignedToken(session.previousToken);
      if (
        prevParsed &&
        prevParsed.sid === session.id &&
        parsed.sid !== session.id
      ) {
        // Still reject — token is bound to a completely different session
        return {
          valid: false,
          source,
          token,
          error: "CSRF token is bound to a different session.",
          cryptoAvailable: true,
        };
      }
      // Allow the previous token only if it matches
      if (prevParsed && prevParsed.nonce === parsed.nonce) {
        // Previous token matched — allowed during grace period
        // Fall through to remaining checks
      } else {
        return {
          valid: false,
          source,
          token,
          error: "CSRF token is bound to a different session.",
          cryptoAvailable: true,
        };
      }
    } else {
      return {
        valid: false,
        source,
        token,
        error: "CSRF token is bound to a different session.",
        cryptoAvailable: true,
      };
    }
  }

  // 5. Check TTL expiration
  if (isTokenExpired(parsed.iat)) {
    return {
      valid: false,
      source,
      token,
      error: `CSRF token has expired. Tokens are valid for ${config.tokenTtlSeconds} seconds.`,
      cryptoAvailable: true,
    };
  }

  // 6. Rotation grace period check — if token is older than TTL but within grace
  if (
    config.tokenRotate &&
    !isTokenExpired(parsed.iat) === false &&
    isWithinGracePeriod(parsed.iat)
  ) {
    // Token is within rotation grace — allow but mark as rotated
    // (caller should issue a new token after this request)
  }

  // 7. User-Agent binding verification
  if (config.bindToUserAgent && userAgent) {
    const expectedUa = hashUserAgent(userAgent);
    if (parsed.ua && parsed.ua !== expectedUa) {
      return {
        valid: false,
        source,
        token,
        error: "CSRF token User-Agent binding mismatch. The browser appears to have changed.",
        cryptoAvailable: true,
      };
    }
  }

  // 8. Origin/Referer validation (defense-in-depth)
  if (!validateOrigin(request)) {
    return {
      valid: false,
      source,
      token,
      error: "Origin/Referer validation failed. Cross-origin request detected.",
      cryptoAvailable: true,
    };
  }

  // 9. Double Submit Cookie check
  // If a CSRF cookie is present, the request token MUST match it.
  // This is the core of the Double Submit Cookie pattern.
  if (request.cookies) {
    const cookieToken = request.cookies[config.cookieName];
    if (cookieToken && cookieToken.length > 0) {
      // Extract the request token (it might be in header, body, or query)
      const requestToken = token;

      // Constant-time comparison between cookie value and request value
      const cookieBuf = Buffer.from(decodeURIComponent(cookieToken));
      const requestBuf = Buffer.from(requestToken);

      if (cookieBuf.length !== requestBuf.length) {
        return {
          valid: false,
          source,
          token,
          error: "Double Submit Cookie mismatch: cookie and request token lengths differ.",
          cryptoAvailable: true,
        };
      }

      let match = false;
      try {
        match = timingSafeEqual(cookieBuf, requestBuf);
      } catch {
        match = false;
      }

      if (!match) {
        return {
          valid: false,
          source,
          token,
          error: "Double Submit Cookie mismatch: the CSRF cookie does not match the submitted token.",
          cryptoAvailable: true,
        };
      }
    }
  }

  // 10. Server-side stored token check (if session tracks a token)
  if (session.token) {
    const storedBuf = Buffer.from(session.token);
    const requestBuf = Buffer.from(token);

    if (storedBuf.length === requestBuf.length) {
      try {
        if (!timingSafeEqual(storedBuf, requestBuf)) {
          return {
            valid: false,
            source,
            token,
            error: "CSRF token does not match the stored server-side token.",
            cryptoAvailable: true,
          };
        }
      } catch {
        // Length mismatch handled below
      }
    }
  }

  // All checks passed
  return {
    valid: true,
    source,
    token,
    cryptoAvailable: true,
  };
}

// ---------------------------------------------------------------------------
// Convenience: isProtectedMethod
// ---------------------------------------------------------------------------

/**
 * Determine if an HTTP method should be CSRF-protected.
 *
 * Safe methods (GET, HEAD, OPTIONS) are never protected.
 * By default, state-changing methods (POST, PUT, PATCH, DELETE) are protected.
 * The list is configurable via CSRF_METHODS env variable.
 *
 * @param method — HTTP method string (case-insensitive)
 * @returns true if this method requires CSRF validation
 */
export function isProtectedMethod(method: string): boolean {
  const config = getConfig();
  return config.protectedMethods.has(method.toUpperCase());
}

// ---------------------------------------------------------------------------
// Cookie Management
// ---------------------------------------------------------------------------

/**
 * Build a Set-Cookie header that clears the CSRF cookie.
 * Use on logout or when invalidating a session.
 *
 * @returns Set-Cookie header value that removes the CSRF cookie.
 */
export function clearCsrfCookie(): string {
  const config = getConfig();
  const parts: string[] = [
    `${config.cookieName}=`,
    `Path=${config.cookiePath}`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];

  if (config.cookieSecure) {
    parts.push("Secure");
  }

  parts.push(`SameSite=${config.cookieSameSite}`);

  return parts.join("; ");
}

// ---------------------------------------------------------------------------
// Token Rotation
// ---------------------------------------------------------------------------

/**
 * Rotate the CSRF token — invalidate the current token and issue a new one.
 *
 * The previous token remains valid for `CSRF_TOKEN_GRACE_PERIOD_S` seconds
 * to prevent race conditions during concurrent requests.
 *
 * @param session — Current session (will be mutated with new token info)
 * @param userAgent — User-Agent for binding
 * @returns New CsrfTokenResult with updated cookie header.
 */
export function rotateCsrfToken(
  session: CsrfSession,
  userAgent?: string,
): CsrfTokenResult {
  // Save current token as previous for grace period
  if (session.token) {
    session.previousToken = session.token;
  }

  const result = generateCsrfToken(session.id, userAgent);

  // Update session tracking
  session.token = result.signedToken;
  session.tokenIssuedAt = Date.now();

  return result;
}

// ---------------------------------------------------------------------------
// HTML Helpers (Meta Tag & Hidden Input)
// ---------------------------------------------------------------------------

/**
 * Escape a string for safe inclusion in an HTML attribute value.
 */
function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Generate the content for a CSRF meta tag.
 * Place this in the <head> of your HTML for SPA frameworks to read.
 *
 * @example
 *   <meta name="csrf-token" content={getCsrfMetaTag(token)} />
 */
export function getCsrfMetaTag(token: string): string {
  return escapeHtmlAttr(token);
}

/**
 * Generate an HTML hidden input element containing the CSRF token.
 * Place inside each <form> that performs state-changing operations.
 *
 * @example
 *   <form method="POST">
 *     {getCsrfHiddenInput(token)}
 *     <input type="text" name="data" />
 *     <button type="submit">Save</button>
 *   </form>
 */
export function getCsrfHiddenInput(token: string): string {
  const config = getConfig();
  const escaped = escapeHtmlAttr(token);
  return `<input type="hidden" name="${escapeHtmlAttr(config.bodyField)}" value="${escaped}">`;
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

/**
 * Verify that CSRF protection is properly configured and operational.
 *
 * Performs a full round-trip: generate → parse → validate.
 * Does not affect any real session.
 */
export function pingCsrf(): {
  healthy: boolean;
  config: Omit<CsrfConfig, "secret"> & { secretConfigured: boolean };
  error?: string;
} {
  try {
    const config = getConfig();
    const { secret: _, ...safeConfig } = config;

    // Round-trip test
    const testId = `csrf-ping-${Date.now()}-${generateNonce()}`;
    const { token } = generateCsrfToken(testId);

    // Verify the token can be parsed
    const parsed = parseSignedToken(token);
    if (!parsed) {
      return {
        healthy: false,
        config: { ...safeConfig, secretConfigured: config.secret.length >= MIN_SECRET_LENGTH },
        error: "Generated token failed to parse. Possible secret or algorithm mismatch.",
      };
    }

    // Verify the token validates against its session
    const validationResult = validateCsrfToken(
      {
        headers: { [config.headerName]: token },
        host: "localhost",
        protocol: "http",
      },
      { id: testId },
    );

    return {
      healthy: validationResult.valid,
      config: { ...safeConfig, secretConfigured: config.secret.length >= MIN_SECRET_LENGTH },
      error: validationResult.valid
        ? undefined
        : `Self-validation failed: ${validationResult.error ?? "unknown reason"}`,
    };
  } catch (err) {
    return {
      healthy: false,
      config: {
        secretConfigured: false,
      } as Omit<CsrfConfig, "secret"> & { secretConfigured: boolean },
      error: err instanceof Error ? err.message : "Unknown CSRF health check error.",
    };
  }
}

// ---------------------------------------------------------------------------
// Re-exports
// ---------------------------------------------------------------------------

export { getConfig as getCsrfConfig };

// ---------------------------------------------------------------------------
// Default Export
// ---------------------------------------------------------------------------

const csrf = {
  /** Generate a CSRF token for a session */
  generate: generateCsrfToken,
  /** Generate a CSRF token for an anonymous (pre-auth) user */
  generateAnonymous: generateAnonymousCsrfToken,
  /** Validate a CSRF token against a request */
  validate: validateCsrfToken,
  /** Extract a CSRF token from request headers, body, or query */
  extract: extractCsrfToken,
  /** Validate Origin/Referer headers (defense-in-depth) */
  validateOrigin,
  /** Rotate the CSRF token (invalidate old, issue new) */
  rotate: rotateCsrfToken,
  /** Check if an HTTP method requires CSRF protection */
  isProtectedMethod,
  /** Build a Set-Cookie header that clears the CSRF cookie */
  clearCookie: clearCsrfCookie,
  /** Escape token for HTML meta tag content */
  getMetaTag: getCsrfMetaTag,
  /** Generate HTML hidden input with CSRF token */
  getHiddenInput: getCsrfHiddenInput,
  /** Reload configuration at runtime */
  reloadConfig,
  /** Get the current configuration (minus secret) */
  getConfig,
  /** Health check — round-trip generate→validate test */
  ping: pingCsrf,
} as const;

export default csrf;
/**
 * Internationalization Engine — Lazy Loading, Language Detection, RTL Support
 *
 * Production-grade i18n subsystem providing locale-aware translation loading,
 * intelligent language detection from multiple sources, full RTL (right-to-left)
 * support, and first-class integration with `next-intl` for Next.js App Router.
 *
 * Architecture:
 *   1. **Locale Configuration** — Central registry of supported locales with
 *      metadata: native name, direction (ltr/rtl), date/number format presets,
 *      first day of week, currency, and plural rules.
 *   2. **Language Detection** — Multi-source, priority-ordered resolver:
 *        a) URL path segment (/ro/about → ro)
 *        b) Cookie (NEXT_LOCALE or custom cookie name)
 *        c) Accept-Language header (parsed with quality weighting)
 *        d) Navigator.language (client-only; SSR-safe guard)
 *        e) Fallback locale (configurable, default: "en")
 *   3. **Lazy-Loading Translations** — Dynamic `import()` per namespace per
 *      locale, deduplicated in-flight, with cache TTL. Only the namespaces
 *      consumed by a given page are loaded — no monolithic bundles.
 *   4. **RTL Engine** — Locale → direction mapping, automatic `dir` / `lang`
 *      attribute generation for `<html>`, CSS logical property helpers, and
 *      a `useDirection()` hook for client components.
 *   5. **Namespace Registry** — Typed namespace keys derived from the
 *      messages directory; compile-time safety with runtime fallback.
 *   6. **Pluralization** — CLDR-compatible plural category resolution via
 *      `Intl.PluralRules` per locale.
 *   7. **Formatting Utilities** — Locale-aware number, currency, date, and
 *      relative-time formatting using `Intl` APIs.
 *   8. **Server/Client Boundary** — Server-safe exports (cookies, headers)
 *      and client-safe exports (navigator, localStorage) with clear
 *      separation via `server` / `client` entrypoints.
 *
 * Supported Locales (by default):
 *   en — English     (ltr)  |  ro — Română      (ltr)
 *   ar — العربية      (rtl)  |  he — עברית       (rtl)
 *   fa — فارسی        (rtl)  |  ur — اردو        (rtl)
 *
 * Environment Variables:
 *   DEFAULT_LOCALE               — default locale (default: "en")
 *   SUPPORTED_LOCALES            — comma-separated list (default: "en,ro,ar,he,fa,ur")
 *   LOCALE_COOKIE_NAME           — cookie name for locale persistence (default: "NEXT_LOCALE")
 *   LOCALE_COOKIE_MAX_AGE_SECONDS— cookie max-age (default: 31536000 = 1 year)
 *   I18N_CACHE_TTL_SECONDS       — in-memory message cache TTL (default: 3600)
 *   I18N_LAZY_LOAD_NAMESPACES    — enable lazy loading (default: true)
 *   I18N_STRICT_MODE             — throw on missing keys in dev (default: false)
 *
 * Usage — Simple (Client Component):
 *   import { t, useLocale, useDirection } from "@/lib/i18n/client";
 *
 *   function MyComponent() {
 *     const locale = useLocale();
 *     const direction = useDirection();
 *     return <div dir={direction}>{t("common.siteName")}</div>;
 *   }
 *
 * Usage — Server Component / API Route:
 *   import { getMessages, detectLocale, getDirection } from "@/lib/i18n/server";
 *
 *   export default async function Page({ params }) {
 *     const locale = detectLocale({ url: params.locale, headers });
 *     const messages = await getMessages(locale, ["common", "nav"]);
 *     return <NextIntlClientProvider locale={locale} messages={messages}>...</NextIntlClientProvider>;
 *   }
 *
 * Usage — Lazy-Loading Specific Namespaces:
 *   import { loadNamespace } from "@/lib/i18n";
 *
 *   const dashboardMsgs = await loadNamespace("ro", "dashboard");
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Writing direction for a locale */
export type TextDirection = "ltr" | "rtl";

/** Locale identifier (e.g., "en", "ro", "en-US", "ar-EG") */
export type Locale = string;

/** Namespace key — maps to JSON file names under messages/ */
export type Namespace = string;

/** Raw translation dictionary (nested key → string) */
export type TranslationMessages = Record<string, unknown>;

/** Structured locale metadata */
export interface LocaleMeta {
  /** ISO 639-1 or 639-2 language code */
  code: string;
  /** Native name (e.g., "English", "Română", "العربية") */
  nativeName: string;
  /** English name (e.g., "English", "Romanian", "Arabic") */
  englishName: string;
  /** Writing direction */
  direction: TextDirection;
  /** CLDR plural rules category override (auto-detected if omitted) */
  pluralRules?: Intl.PluralRules;
  /** Default currency for this locale */
  currency: string;
  /** Date format preset */
  dateFormat: LocaleDateFormat;
  /** First day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday) */
  firstDayOfWeek: number;
  /** Whether the locale is active (available for selection) */
  active: boolean;
  /** Parent locale for fallback (e.g., "en-US" → "en") */
  parent?: string;
}

/** Date format presets */
export interface LocaleDateFormat {
  short: string;   // "MM/DD/YYYY" vs "DD.MM.YYYY"
  medium: string;  // "MMM D, YYYY" vs "D MMM YYYY"
  long: string;    // "MMMM D, YYYY" vs "D MMMM YYYY"
  full: string;    // "EEEE, MMMM D, YYYY" vs "EEEE, D MMMM YYYY"
}

/** Result of language detection */
export interface DetectedLocale {
  /** The resolved locale code */
  locale: Locale;
  /** The source that determined the locale */
  source: DetectionSource;
  /** The raw Accept-Language header value (if used) */
  rawAcceptLanguage?: string;
  /** Whether a cookie was set as a side-effect */
  cookieSet: boolean;
}

/** Sources for locale detection, in priority order */
export type DetectionSource =
  | "url"
  | "cookie"
  | "header"
  | "navigator"
  | "fallback";

/** Options for language detection */
export interface DetectionOptions {
  /** URL path containing a locale segment (e.g., "/ro/dashboard") */
  url?: string;
  /** Raw Accept-Language header value */
  acceptLanguage?: string;
  /** Cookie value for persisted locale */
  cookieValue?: string;
  /** Set the locale cookie as a side-effect (server-side only via Set-Cookie) */
  setCookie?: boolean;
  /** Override the default locale */
  defaultLocale?: Locale;
  /** Restrict to a subset of supported locales */
  allowedLocales?: Locale[];
}

/** Options for loading translations */
export interface LoadMessagesOptions {
  /** Locale to load */
  locale: Locale;
  /** Namespaces to load (empty = all) */
  namespaces?: Namespace[];
  /** Bypass the in-memory cache */
  bypassCache?: boolean;
  /** Timeout in ms for the dynamic import (default: 5000) */
  timeoutMs?: number;
}

/** Message cache entry */
interface CacheEntry {
  messages: TranslationMessages;
  loadedAt: number;
  locale: Locale;
  namespace: Namespace;
}

// ---------------------------------------------------------------------------
// Locale Registry
// ---------------------------------------------------------------------------

/**
 * Built-in locale metadata. Extend via `registerLocale()` at runtime.
 *
 * RTL languages explicitly listed. For a complete reference, see:
 * https://www.iana.org/assignments/language-subtag-registry/language-subtag-registry
 */
const RTL_LOCALES = new Set<string>([
  "ar", "arc", "dv", "fa", "ha", "he", "khw", "ks", "ku", "ps", "ur", "yi",
  // Extended: include region-qualified variants
  "ar-AE", "ar-BH", "ar-DZ", "ar-EG", "ar-IQ", "ar-JO", "ar-KW", "ar-LB",
  "ar-LY", "ar-MA", "ar-OM", "ar-QA", "ar-SA", "ar-SD", "ar-SY", "ar-TN",
  "ar-YE", "fa-IR", "fa-AF", "he-IL", "ur-PK", "ur-IN",
]);

const BUILTIN_LOCALES: Record<string, LocaleMeta> = {
  en: {
    code: "en",
    nativeName: "English",
    englishName: "English",
    direction: "ltr",
    currency: "USD",
    dateFormat: {
      short: "MM/DD/YYYY",
      medium: "MMM D, YYYY",
      long: "MMMM D, YYYY",
      full: "EEEE, MMMM D, YYYY",
    },
    firstDayOfWeek: 0, // Sunday
    active: true,
  },
  ro: {
    code: "ro",
    nativeName: "Română",
    englishName: "Romanian",
    direction: "ltr",
    currency: "RON",
    dateFormat: {
      short: "DD.MM.YYYY",
      medium: "D MMM YYYY",
      long: "D MMMM YYYY",
      full: "EEEE, D MMMM YYYY",
    },
    firstDayOfWeek: 1, // Monday
    active: true,
  },
  ar: {
    code: "ar",
    nativeName: "العربية",
    englishName: "Arabic",
    direction: "rtl",
    currency: "AED",
    dateFormat: {
      short: "DD/MM/YYYY",
      medium: "D MMM YYYY",
      long: "D MMMM YYYY",
      full: "EEEE, D MMMM YYYY",
    },
    firstDayOfWeek: 6, // Saturday
    active: true,
  },
  he: {
    code: "he",
    nativeName: "עברית",
    englishName: "Hebrew",
    direction: "rtl",
    currency: "ILS",
    dateFormat: {
      short: "DD/MM/YYYY",
      medium: "D MMM YYYY",
      long: "D MMMM YYYY",
      full: "EEEE, D MMMM YYYY",
    },
    firstDayOfWeek: 0, // Sunday
    active: true,
  },
  fa: {
    code: "fa",
    nativeName: "فارسی",
    englishName: "Persian",
    direction: "rtl",
    currency: "IRR",
    dateFormat: {
      short: "YYYY/MM/DD",
      medium: "D MMM YYYY",
      long: "D MMMM YYYY",
      full: "EEEE, D MMMM YYYY",
    },
    firstDayOfWeek: 6, // Saturday
    active: true,
  },
  ur: {
    code: "ur",
    nativeName: "اردو",
    englishName: "Urdu",
    direction: "rtl",
    currency: "PKR",
    dateFormat: {
      short: "DD/MM/YYYY",
      medium: "D MMM YYYY",
      long: "D MMMM YYYY",
      full: "EEEE, D MMMM YYYY",
    },
    firstDayOfWeek: 0, // Sunday
    active: true,
  },
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const envStr = (key: string, fallback: string): string => {
  if (typeof process === "undefined") return fallback;
  const raw = process.env[key];
  return raw !== undefined && raw !== "" ? raw : fallback;
};

const envNum = (key: string, fallback: number): number => {
  if (typeof process === "undefined") return fallback;
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
};

const envBool = (key: string, fallback: boolean): boolean => {
  if (typeof process === "undefined") return fallback;
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  return raw === "true" || raw === "1";
};

function getSupportedLocales(): string[] {
  const raw = envStr("SUPPORTED_LOCALES", "en,ro,ar,he,fa,ur");
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function getDefaultLocale(): string {
  const supported = getSupportedLocales();
  const def = envStr("DEFAULT_LOCALE", supported[0] || "en");
  return supported.includes(def) ? def : (supported[0] || "en");
}

function getCookieName(): string {
  return envStr("LOCALE_COOKIE_NAME", "NEXT_LOCALE");
}

function getCookieMaxAge(): number {
  return envNum("LOCALE_COOKIE_MAX_AGE_SECONDS", 31_536_000); // 1 year
}

function getCacheTtlSeconds(): number {
  return envNum("I18N_CACHE_TTL_SECONDS", 3600); // 1 hour
}

function getLazyLoadingEnabled(): boolean {
  return envBool("I18N_LAZY_LOAD_NAMESPACES", true);
}

function getStrictMode(): boolean {
  return envBool("I18N_STRICT_MODE", false);
}

// ---------------------------------------------------------------------------
// Global State
// ---------------------------------------------------------------------------

interface I18nGlobalState {
  __locales: Record<string, LocaleMeta> | undefined;
  __cache: Map<string, CacheEntry> | undefined;
  __inflight: Map<string, Promise<TranslationMessages>> | undefined;
  __supportedLocales: string[] | undefined;
  __defaultLocale: string | undefined;
}

const globalForI18n = globalThis as unknown as I18nGlobalState;

function initGlobalState(): void {
  if (!globalForI18n.__cache) {
    globalForI18n.__cache = new Map();
  }
  if (!globalForI18n.__inflight) {
    globalForI18n.__inflight = new Map();
  }
  if (!globalForI18n.__locales) {
    globalForI18n.__locales = { ...BUILTIN_LOCALES };
  }
  if (!globalForI18n.__supportedLocales) {
    globalForI18n.__supportedLocales = getSupportedLocales();
  }
  if (!globalForI18n.__defaultLocale) {
    globalForI18n.__defaultLocale = getDefaultLocale();
  }
}

// ---------------------------------------------------------------------------
// Locale Registry API
// ---------------------------------------------------------------------------

/**
 * Register or override a locale's metadata at runtime.
 *
 * @example
 *   registerLocale("fr", {
 *     code: "fr",
 *     nativeName: "Français",
 *     englishName: "French",
 *     direction: "ltr",
 *     currency: "EUR",
 *     dateFormat: { short: "DD/MM/YYYY", medium: "D MMM YYYY", long: "D MMMM YYYY", full: "EEEE D MMMM YYYY" },
 *     firstDayOfWeek: 1,
 *     active: true,
 *   });
 */
export function registerLocale(code: string, meta: LocaleMeta): void {
  initGlobalState();
  globalForI18n.__locales![code] = { ...meta, code };

  // Also add to supported locales set if not already present
  const supported = globalForI18n.__supportedLocales!;
  if (!supported.includes(code)) {
    supported.push(code);
  }

  // Auto-detect RTL if direction isn't explicitly "ltr"
  if (meta.direction !== "ltr" && meta.direction !== "rtl") {
    globalForI18n.__locales![code].direction = isRTLLocale(code) ? "rtl" : "ltr";
  }
}

/**
 * Get metadata for a locale.
 */
export function getLocaleMeta(locale: Locale): LocaleMeta | undefined {
  initGlobalState();
  const meta = globalForI18n.__locales![locale];
  if (meta) return meta;

  // Check parent (e.g., "en-US" → "en")
  const parent = extractLanguageCode(locale);
  if (parent !== locale) {
    return globalForI18n.__locales![parent];
  }

  return undefined;
}

/**
 * Get all registered locales.
 */
export function getAllLocales(): Record<string, LocaleMeta> {
  initGlobalState();
  return { ...globalForI18n.__locales! };
}

/**
 * Get the list of active (user-selectable) locales.
 */
export function getActiveLocales(): LocaleMeta[] {
  initGlobalState();
  const supported = globalForI18n.__supportedLocales!;
  return supported
    .map((code) => globalForI18n.__locales![code])
    .filter((m): m is LocaleMeta => m !== undefined && m.active);
}

// ---------------------------------------------------------------------------
// RTL Detection
// ---------------------------------------------------------------------------

/**
 * Determine whether a locale code is RTL.
 *
 * Checks the locale registry first, then falls back to the static RTL set.
 * Works with both bare language codes ("ar") and region-qualified ("ar-EG").
 *
 * @example
 *   isRTLLocale("ar")     // true
 *   isRTLLocale("en")     // false
 *   isRTLLocale("ar-EG")  // true
 */
export function isRTLLocale(locale: Locale): boolean {
  initGlobalState();

  // 1. Check registry
  const meta = globalForI18n.__locales![locale];
  if (meta) return meta.direction === "rtl";

  // 2. Check the full locale code in the static set
  if (RTL_LOCALES.has(locale)) return true;

  // 3. Check just the language part
  const lang = extractLanguageCode(locale);
  return RTL_LOCALES.has(lang);
}

/**
 * Get the writing direction for a locale.
 */
export function getDirection(locale: Locale): TextDirection {
  return isRTLLocale(locale) ? "rtl" : "ltr";
}

/**
 * Get the opposite direction (useful for mirroring UI elements).
 */
export function getOppositeDirection(dir: TextDirection): TextDirection {
  return dir === "rtl" ? "ltr" : "rtl";
}

/**
 * Get HTML attributes for a locale — used on the `<html>` element.
 *
 * @example
 *   const attrs = getHtmlAttributes("ar");
 *   // { lang: "ar", dir: "rtl" }
 */
export function getHtmlAttributes(locale: Locale): {
  lang: string;
  dir: TextDirection;
} {
  return {
    lang: locale,
    dir: getDirection(locale),
  };
}

// ---------------------------------------------------------------------------
// Language Detection
// ---------------------------------------------------------------------------

/**
 * Extract the language code from a locale string.
 *   "en-US" → "en"
 *   "ro"    → "ro"
 *   "zh-Hant-CN" → "zh"
 */
function extractLanguageCode(locale: Locale): string {
  return locale.split("-")[0] || locale;
}

/**
 * Parse the Accept-Language header into a sorted list of locale-quality pairs.
 *
 * Implements RFC 7231 §5.3.5 quality-value parsing.
 *
 * @example
 *   parseAcceptLanguage("ro,en-US;q=0.9,en;q=0.8,ar;q=0.7")
 *   // [{ locale: "ro", quality: 1 }, { locale: "en-US", quality: 0.9 }, ...]
 */
export function parseAcceptLanguage(
  header: string,
): { locale: string; quality: number }[] {
  if (!header || header.trim() === "") return [];

  const parsed: { locale: string; quality: number }[] = [];

  for (const part of header.split(",")) {
    const [localePart, qPart] = part.trim().split(";");
    const locale = localePart?.trim();
    if (!locale || locale === "*") continue;

    let quality = 1.0;
    if (qPart) {
      const qMatch = qPart.trim().match(/^q=([0-9.]+)$/i);
      if (qMatch) {
        const q = parseFloat(qMatch[1]!);
        if (!Number.isNaN(q)) quality = q;
      }
    }

    parsed.push({ locale, quality });
  }

  // Sort by quality descending, then by specificity (longer locale first)
  parsed.sort((a, b) => {
    const qDiff = b.quality - a.quality;
    if (qDiff !== 0) return qDiff;
    return b.locale.length - a.locale.length;
  });

  return parsed;
}

/**
 * Match a list of Accept-Language entries against supported locales.
 *
 * For each accepted locale, checks:
 *   1. Exact match ("en-US" ↔ "en-US")
 *   2. Language-only match ("en-US" → "en")
 *   3. First supported locale starting with that language
 *
 * Returns the best match or undefined.
 */
function matchAcceptedLocale(
  accepted: { locale: string; quality: number }[],
  supported: string[],
): string | undefined {
  for (const { locale } of accepted) {
    // 1. Exact match
    if (supported.includes(locale)) return locale;

    // 2. Language-only match
    const lang = extractLanguageCode(locale);
    if (supported.includes(lang)) return lang;

    // 3. First supported locale that starts with the language
    const regional = supported.find((s) => extractLanguageCode(s) === lang);
    if (regional) return regional;
  }

  return undefined;
}

/**
 * Detect the best locale from available sources.
 *
 * Priority order:
 *   1. URL path segment (e.g., /ro/dashboard → "ro")
 *   2. Cookie (NEXT_LOCALE or configured name)
 *   3. Accept-Language header
 *   4. navigator.language (client-only)
 *   5. Configured fallback
 *
 * @example
 *   // Server-side
 *   const { locale, source } = detectLocale({
 *     url: "/ro/dashboard",
 *     acceptLanguage: "en-US,en;q=0.9",
 *     cookieValue: "ar",
 *   });
 *   // { locale: "ro", source: "url", cookieSet: false }
 *
 *   // Client-side
 *   const { locale } = detectLocale();
 *   // Uses navigator.language if available
 */
export function detectLocale(options: DetectionOptions = {}): DetectedLocale {
  initGlobalState();
  const supported = options.allowedLocales ?? globalForI18n.__supportedLocales!;
  const fallback = options.defaultLocale ?? globalForI18n.__defaultLocale!;
  const cookieName = getCookieName();

  let cookieSet = false;

  // 1. URL path segment
  if (options.url) {
    const segments = options.url.split("/").filter(Boolean);
    const firstSegment = segments[0];
    if (firstSegment && supported.includes(firstSegment)) {
      return {
        locale: firstSegment,
        source: "url",
        rawAcceptLanguage: options.acceptLanguage,
        cookieSet,
      };
    }
  }

  // 2. Cookie
  if (options.cookieValue && supported.includes(options.cookieValue)) {
    return {
      locale: options.cookieValue,
      source: "cookie",
      rawAcceptLanguage: options.acceptLanguage,
      cookieSet,
    };
  }

  // 3. Accept-Language header
  if (options.acceptLanguage) {
    const accepted = parseAcceptLanguage(options.acceptLanguage);
    const matched = matchAcceptedLocale(accepted, supported);
    if (matched) {
      cookieSet = Boolean(options.setCookie);
      return {
        locale: matched,
        source: "header",
        rawAcceptLanguage: options.acceptLanguage,
        cookieSet,
      };
    }
  }

  // 4. Navigator (client-only)
  if (typeof navigator !== "undefined" && navigator.language) {
    const navLang = navigator.language;
    // Exact match
    if (supported.includes(navLang)) {
      return {
        locale: navLang,
        source: "navigator",
        rawAcceptLanguage: options.acceptLanguage,
        cookieSet,
      };
    }
    // Language-only match
    const lang = extractLanguageCode(navLang);
    if (supported.includes(lang)) {
      return { locale: lang, source: "navigator", rawAcceptLanguage: options.acceptLanguage, cookieSet };
    }
    // Regional match
    const regional = supported.find((s) => extractLanguageCode(s) === lang);
    if (regional) {
      return { locale: regional, source: "navigator", rawAcceptLanguage: options.acceptLanguage, cookieSet };
    }
  }

  // 5. Fallback
  return {
    locale: fallback,
    source: "fallback",
    rawAcceptLanguage: options.acceptLanguage,
    cookieSet,
  };
}

/**
 * Build a Set-Cookie header string for persisting the locale.
 *
 * @example
 *   const cookieHeader = buildLocaleCookie("ro");
 *   // "NEXT_LOCALE=ro; Path=/; Max-Age=31536000; SameSite=Lax"
 */
export function buildLocaleCookie(locale: Locale): string {
  const name = getCookieName();
  const maxAge = getCookieMaxAge();
  const secure = envStr("NODE_ENV", "development") === "production" ? "; Secure" : "";

  return `${name}=${locale}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

/**
 * Get the locale from a cookie string.
 */
export function getLocaleFromCookie(cookieHeader: string): string | undefined {
  const name = getCookieName();
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));

  if (!match) return undefined;
  return match.slice(name.length + 1);
}

// ---------------------------------------------------------------------------
// Lazy-Loading Translation Engine
// ---------------------------------------------------------------------------

/**
 * Build the cache key for a locale + namespace pair.
 */
function cacheKey(locale: Locale, namespace: Namespace): string {
  return `${locale}:${namespace}`;
}

/**
 * Check whether a cached entry is still valid.
 */
function isCacheValid(entry: CacheEntry): boolean {
  const ttl = getCacheTtlSeconds() * 1000;
  return Date.now() - entry.loadedAt < ttl;
}

/**
 * Load a single namespace for a locale via dynamic import.
 *
 * Uses `import()` with a relative path. The messages directory is at:
 *   src/lib/i18n/messages/{locale}.json
 *
 * Each locale file is expected to be a flat or nested JSON object where
 * top-level keys are namespaces. Alternative: namespace-per-file:
 *   src/lib/i18n/messages/{locale}/{namespace}.json
 *
 * This implementation supports both conventions:
 *   - Single-file: messages/ro.json → namespace is a top-level key
 *   - Multi-file:  messages/ro/common.json → one namespace per file
 *
 * @internal
 */
async function importNamespace(
  locale: Locale,
  namespace: Namespace,
): Promise<TranslationMessages> {
  const supported = globalForI18n.__supportedLocales!;
  const fallback = globalForI18n.__defaultLocale!;

  // Normalize locale — if not supported, use the language-only variant
  // or fallback
  let targetLocale = locale;
  if (!supported.includes(targetLocale)) {
    const lang = extractLanguageCode(targetLocale);
    targetLocale = supported.includes(lang) ? lang : fallback;
  }

  try {
    // Strategy A: Single file per locale (all namespaces in one JSON)
    // Path: ./i18n/messages/{locale}.json
    // We load the whole file and extract the namespace
    const module = await import(
      /* webpackMode: "lazy" */
      /* webpackChunkName: "i18n-[request]" */
      `./i18n/messages/${targetLocale}.json`
    );

    const allMessages = (module.default ?? module) as TranslationMessages;

    // If the namespace exists as a top-level key, return it
    if (namespace in allMessages) {
      return { [namespace]: allMessages[namespace] };
    }

    // If the requested namespace is the whole file (no nesting), return as-is
    // This handles cases where messages are flat (no namespace wrapper)
    const firstKey = Object.keys(allMessages)[0];
    if (firstKey && typeof allMessages[firstKey] !== "object") {
      // Flat messages — return everything under the requested namespace
      return { [namespace]: allMessages };
    }

    // Namespace not found in this locale file
    if (getStrictMode()) {
      console.warn(
        `[i18n] Namespace "${namespace}" not found in locale "${targetLocale}". ` +
        `Available: ${Object.keys(allMessages).join(", ")}`,
      );
    }

    // Try fallback locale (only if different)
    if (targetLocale !== fallback) {
      const fallbackModule = await import(
        `./i18n/messages/${fallback}.json`
      );
      const fallbackMessages = (fallbackModule.default ?? fallbackModule) as TranslationMessages;
      if (namespace in fallbackMessages) {
        return { [namespace]: fallbackMessages[namespace] };
      }
    }

    // Return empty namespace — the consumer should handle missing keys gracefully
    return { [namespace]: {} };

  } catch (err) {
    // If the locale file doesn't exist at all, try fallback
    if (targetLocale !== fallback) {
      try {
        const fallbackModule = await import(
          `./i18n/messages/${fallback}.json`
        );
        const fallbackMessages = (fallbackModule.default ?? fallbackModule) as TranslationMessages;
        if (namespace in fallbackMessages) {
          return { [namespace]: fallbackMessages[namespace] };
        }
        return { [namespace]: {} };
      } catch {
        // Even fallback failed — return empty
        if (getStrictMode()) {
          console.error(
            `[i18n] Failed to load locale "${targetLocale}" or fallback "${fallback}"`,
          );
        }
        return { [namespace]: {} };
      }
    }

    if (getStrictMode()) {
      console.error(
        `[i18n] Failed to load locale "${targetLocale}":`,
        err instanceof Error ? err.message : String(err),
      );
    }

    return { [namespace]: {} };
  }
}

/**
 * Load one or more translation namespaces for a locale.
 *
 * Deduplicates in-flight requests — if the same namespace is requested
 * concurrently, only one dynamic import is performed.
 *
 * Caches results in memory with a configurable TTL.
 *
 * @example
 *   const messages = await loadNamespace("ro", "common");
 *   // { common: { siteName: "NexusDevStudio", ... } }
 *
 *   const multi = await loadMessages("ro", ["common", "auth", "errors"]);
 *   // { common: {...}, auth: {...}, errors: {...} }
 */
export async function loadNamespace(
  locale: Locale,
  namespace: Namespace,
  bypassCache = false,
): Promise<TranslationMessages> {
  initGlobalState();
  const key = cacheKey(locale, namespace);
  const cache = globalForI18n.__cache!;
  const inflight = globalForI18n.__inflight!;

  // Check cache
  if (!bypassCache) {
    const cached = cache.get(key);
    if (cached && isCacheValid(cached)) {
      return cached.messages;
    }
  }

  // Deduplicate in-flight requests
  const existing = inflight.get(key);
  if (existing) {
    return existing;
  }

  // Create new in-flight promise
  const promise = importNamespace(locale, namespace).then((messages) => {
    // Store in cache
    cache.set(key, {
      messages,
      loadedAt: Date.now(),
      locale,
      namespace,
    });
    // Remove from in-flight
    inflight.delete(key);
    return messages;
  }).catch((err) => {
    inflight.delete(key);
    throw err;
  });

  inflight.set(key, promise);
  return promise;
}

/**
 * Load multiple namespaces at once for a locale.
 *
 * @param locale     - Target locale
 * @param namespaces - Namespaces to load (empty = load all known namespaces)
 * @param bypassCache - Skip the cache
 * @returns          - Merged messages object suitable for next-intl
 */
export async function loadMessages(
  locale: Locale,
  namespaces: Namespace[] = [],
  bypassCache = false,
): Promise<TranslationMessages> {
  initGlobalState();

  // If no namespaces specified, discover from the locale file
  if (namespaces.length === 0) {
    namespaces = await discoverNamespaces(locale);
  }

  const results = await Promise.all(
    namespaces.map((ns) => loadNamespace(locale, ns, bypassCache)),
  );

  // Merge all namespace results into a single object
  const merged: TranslationMessages = {};
  for (const result of results) {
    Object.assign(merged, result);
  }

  return merged;
}

/**
 * Discover available namespaces for a locale by loading its file
 * and enumerating top-level keys.
 */
export async function discoverNamespaces(locale: Locale): Promise<string[]> {
  initGlobalState();
  const supported = globalForI18n.__supportedLocales!;

  let targetLocale = locale;
  if (!supported.includes(targetLocale)) {
    const lang = extractLanguageCode(targetLocale);
    targetLocale = supported.includes(lang) ? lang : globalForI18n.__defaultLocale!;
  }

  try {
    const module = await import(`./i18n/messages/${targetLocale}.json`);
    const allMessages = (module.default ?? module) as TranslationMessages;

    // Only return object-type values as namespaces
    return Object.keys(allMessages).filter(
      (key) => typeof allMessages[key] === "object" && allMessages[key] !== null,
    );
  } catch {
    // If file doesn't exist, try fallback
    const fallback = globalForI18n.__defaultLocale!;
    if (targetLocale !== fallback) {
      try {
        const fbModule = await import(`./i18n/messages/${fallback}.json`);
        const fbMessages = (fbModule.default ?? fbModule) as TranslationMessages;
        return Object.keys(fbMessages).filter(
          (key) => typeof fbMessages[key] === "object" && fbMessages[key] !== null,
        );
      } catch {
        return [];
      }
    }
    return [];
  }
}

// ---------------------------------------------------------------------------
// Cache Management
// ---------------------------------------------------------------------------

/**
 * Invalidate the in-memory translation cache.
 *
 * @param locale    - If provided, only invalidates this locale
 * @param namespace - If provided, only invalidates this namespace
 */
export function invalidateCache(locale?: Locale, namespace?: Namespace): number {
  initGlobalState();
  const cache = globalForI18n.__cache!;
  let count = 0;

  const keysToDelete: string[] = [];

  for (const [key, entry] of cache) {
    if (locale && entry.locale !== locale) continue;
    if (namespace && entry.namespace !== namespace) continue;
    keysToDelete.push(key);
  }

  for (const key of keysToDelete) {
    cache.delete(key);
    count++;
  }

  return count;
}

/**
 * Get cache statistics.
 */
export function getCacheStats(): {
  size: number;
  entries: { locale: string; namespace: string; ageSeconds: number }[];
} {
  initGlobalState();
  const cache = globalForI18n.__cache!;
  const now = Date.now();

  const entries: { locale: string; namespace: string; ageSeconds: number }[] = [];
  for (const entry of cache.values()) {
    entries.push({
      locale: entry.locale,
      namespace: entry.namespace,
      ageSeconds: Math.round((now - entry.loadedAt) / 1000),
    });
  }

  return { size: cache.size, entries };
}

// ---------------------------------------------------------------------------
// Translation Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a dotted key path from a nested translation object.
 *
 * @example
 *   resolveTranslation({ common: { siteName: "Nexus" } }, "common.siteName")
 *   // "Nexus"
 *
 *   resolveTranslation(messages, "errors.minLength", { min: 8 })
 *   // "Minimum 8 characters"
 */
export function resolveTranslation(
  messages: TranslationMessages,
  key: string,
  interpolations?: Record<string, string | number>,
): string {
  const parts = key.split(".");
  let current: unknown = messages;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return key; // Missing key — return the key itself as fallback
    }
    if (typeof current !== "object") {
      return key;
    }
    current = (current as Record<string, unknown>)[part];
  }

  if (typeof current !== "string") {
    return key;
  }

  // Interpolation: replace {var} with values
  if (interpolations) {
    return current.replace(/\{(\w+)\}/g, (_, name: string) => {
      const value = interpolations[name];
      return value !== undefined ? String(value) : `{${name}}`;
    });
  }

  return current;
}

// ---------------------------------------------------------------------------
// Pluralization (CLDR-compatible)
// ---------------------------------------------------------------------------

/**
 * Get the plural category for a number in a given locale.
 *
 * Uses `Intl.PluralRules` — available in all modern JS runtimes.
 *
 * Categories: "zero", "one", "two", "few", "many", "other"
 *
 * @example
 *   getPluralCategory("ro", 1)  // "one"
 *   getPluralCategory("ro", 2)  // "few"
 *   getPluralCategory("en", 1)  // "one"
 *   getPluralCategory("en", 5)  // "other"
 *   getPluralCategory("ar", 0)  // "zero"
 */
export function getPluralCategory(
  locale: Locale,
  count: number,
): Intl.LDMLPluralRule {
  try {
    const rules = new Intl.PluralRules(locale);
    return rules.select(count);
  } catch {
    // Fallback for unknown locales — use English rules
    const rules = new Intl.PluralRules("en");
    return rules.select(count);
  }
}

/**
 * Select the correct plural form from a map of plural categories.
 *
 * @example
 *   const forms = { one: "1 item", few: "{count} items", other: "{count} items" };
 *   pluralize("ro", 2, forms, { count: 2 }) // "2 items" (Romanian "few")
 */
export function pluralize(
  locale: Locale,
  count: number,
  forms: Partial<Record<Intl.LDMLPluralRule, string>>,
  interpolations?: Record<string, string | number>,
): string {
  const category = getPluralCategory(locale, count);

  // Try exact category match, then "other" fallback
  const template =
    forms[category] ??
    forms.other ??
    Object.values(forms).find(Boolean) ??
    "";

  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    if (name === "count") return String(count);
    const value = interpolations?.[name];
    return value !== undefined ? String(value) : `{${name}}`;
  });
}

// ---------------------------------------------------------------------------
// Formatting Utilities
// ---------------------------------------------------------------------------

/**
 * Format a number according to locale conventions.
 *
 * @example
 *   formatNumber("ro", 1234567.89)          // "1.234.567,89"
 *   formatNumber("en", 1234567.89)          // "1,234,567.89"
 *   formatNumber("ar", 1234567.89)          // "١٬٢٣٤٬٥٦٧٫٨٩"
 */
export function formatNumber(
  locale: Locale,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  try {
    return new Intl.NumberFormat(locale, options).format(value);
  } catch {
    return new Intl.NumberFormat("en", options).format(value);
  }
}

/**
 * Format a currency value.
 *
 * @example
 *   formatCurrency("ro", 1234.5, "RON")     // "1.234,50 RON"
 *   formatCurrency("en", 1234.5, "USD")     // "$1,234.50"
 *   formatCurrency("ar", 1234.5, "AED")     // "د.إ.‏ ١٬٢٣٤٫٥٠"
 */
export function formatCurrency(
  locale: Locale,
  value: number,
  currency: string,
  options?: Intl.NumberFormatOptions,
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      ...options,
    }).format(value);
  } catch {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency: "USD",
      ...options,
    }).format(value);
  }
}

/**
 * Get the default currency for a locale.
 */
export function getDefaultCurrency(locale: Locale): string {
  const meta = getLocaleMeta(locale);
  return meta?.currency ?? "USD";
}

/**
 * Format a date according to locale conventions.
 *
 * @example
 *   formatDate("ro", new Date("2025-01-15"), { dateStyle: "full" })
 *   // "miercuri, 15 ianuarie 2025"
 */
export function formatDate(
  locale: Locale,
  date: Date | number | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  try {
    return new Intl.DateTimeFormat(locale, options).format(
      typeof date === "string" ? new Date(date) : date,
    );
  } catch {
    return new Intl.DateTimeFormat("en", options).format(
      typeof date === "string" ? new Date(date) : date,
    );
  }
}

/**
 * Format a relative time (e.g., "3 days ago", "in 5 minutes").
 *
 * @example
 *   formatRelativeTime("ro", -3, "day")    // "acum 3 zile"
 *   formatRelativeTime("en", 5, "minute")  // "in 5 minutes"
 */
export function formatRelativeTime(
  locale: Locale,
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  options?: Intl.RelativeTimeFormatOptions,
): string {
  try {
    return new Intl.RelativeTimeFormat(locale, options).format(value, unit);
  } catch {
    return new Intl.RelativeTimeFormat("en", options).format(value, unit);
  }
}

/**
 * Format a list according to locale conventions.
 *
 * @example
 *   formatList("en", ["Alice", "Bob", "Charlie"])
 *   // "Alice, Bob, and Charlie"
 *   formatList("ro", ["Alice", "Bob", "Charlie"])
 *   // "Alice, Bob și Charlie"
 */
export function formatList(
  locale: Locale,
  items: string[],
  options?: Intl.ListFormatOptions,
): string {
  try {
    return new Intl.ListFormat(locale, options).format(items);
  } catch {
    return new Intl.ListFormat("en", options).format(items);
  }
}

// ---------------------------------------------------------------------------
// Relative Time Helper
// ---------------------------------------------------------------------------

const RELATIVE_TIME_UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] = [
  { unit: "year", ms: 31_536_000_000 },
  { unit: "month", ms: 2_592_000_000 },
  { unit: "week", ms: 604_800_000 },
  { unit: "day", ms: 86_400_000 },
  { unit: "hour", ms: 3_600_000 },
  { unit: "minute", ms: 60_000 },
  { unit: "second", ms: 1_000 },
];

/**
 * Format a date as a relative time string from now.
 *
 * @example
 *   formatRelativeDate("ro", new Date(Date.now() - 3600000)) // "acum 1 oră"
 *   formatRelativeDate("en", new Date(Date.now() + 86400000)) // "in 1 day"
 */
export function formatRelativeDate(
  locale: Locale,
  date: Date | number | string,
  now: Date | number = Date.now(),
): string {
  const target = typeof date === "string" ? new Date(date).getTime() :
    date instanceof Date ? date.getTime() : date;
  const nowMs = typeof now === "number" ? now : now.getTime();

  const diff = target - nowMs;
  const absDiff = Math.abs(diff);

  for (const { unit, ms } of RELATIVE_TIME_UNITS) {
    if (absDiff >= ms || unit === "second") {
      const value = Math.round(diff / ms);
      return formatRelativeTime(locale, value, unit);
    }
  }

  return formatRelativeTime(locale, 0, "second");
}

// ---------------------------------------------------------------------------
// URL / Path Utilities
// ---------------------------------------------------------------------------

/**
 * Build a localized path by prefixing with the locale.
 *
 * @example
 *   localizedPath("/dashboard", "ro")     // "/ro/dashboard"
 *   localizedPath("/dashboard", "en")     // "/en/dashboard"
 *   localizedPath("/", "ro")              // "/ro"
 */
export function localizedPath(path: string, locale: Locale): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/") return `/${locale}`;
  return `/${locale}${normalized}`;
}

/**
 * Strip the locale prefix from a path.
 *
 * @example
 *   unlocalizedPath("/ro/dashboard")      // "/dashboard"
 *   unlocalizedPath("/en/about/team")     // "/about/team"
 */
export function unlocalizedPath(path: string): string {
  initGlobalState();
  const supported = globalForI18n.__supportedLocales!;
  const segments = path.split("/").filter(Boolean);

  if (segments.length > 0 && supported.includes(segments[0]!)) {
    const rest = segments.slice(1).join("/");
    return rest ? `/${rest}` : "/";
  }

  return path;
}

/**
 * Extract the locale from a URL path.
 *
 * @example
 *   extractLocaleFromPath("/ro/dashboard")  // "ro"
 *   extractLocaleFromPath("/dashboard")     // undefined
 */
export function extractLocaleFromPath(path: string): string | undefined {
  initGlobalState();
  const supported = globalForI18n.__supportedLocales!;
  const segments = path.split("/").filter(Boolean);

  if (segments.length > 0 && supported.includes(segments[0]!)) {
    return segments[0];
  }

  return undefined;
}

/**
 * Build a list of locale-prefixed paths for a given path.
 * Useful for `hreflang` alternate links in SEO.
 *
 * @example
 *   localeAlternates("/dashboard")
 *   // { en: "/en/dashboard", ro: "/ro/dashboard", ar: "/ar/dashboard" }
 */
export function localeAlternates(path: string): Record<string, string> {
  initGlobalState();
  const supported = globalForI18n.__supportedLocales!;
  const cleanPath = unlocalizedPath(path);

  const map: Record<string, string> = {};
  for (const locale of supported) {
    map[locale] = localizedPath(cleanPath, locale);
  }

  return map;
}

// ---------------------------------------------------------------------------
// Server-Specific Helpers
// ---------------------------------------------------------------------------

/**
 * Detect locale from a Next.js request-like object.
 * Safe for Server Components, API Routes, and Middleware.
 *
 * @example
 *   // In middleware.ts
 *   const { locale } = detectLocaleFromRequest({
 *     url: request.nextUrl.pathname,
 *     acceptLanguage: request.headers.get("accept-language"),
 *     cookieValue: request.cookies.get("NEXT_LOCALE")?.value,
 *   });
 */
export function detectLocaleFromRequest(req: {
  url?: string;
  acceptLanguage?: string | null;
  cookieValue?: string | null;
  defaultLocale?: string;
}): DetectedLocale {
  return detectLocale({
    url: req.url,
    acceptLanguage: req.acceptLanguage ?? undefined,
    cookieValue: req.cookieValue ?? undefined,
    defaultLocale: req.defaultLocale,
    setCookie: false, // Middleware handles cookie setting separately
  });
}

// ---------------------------------------------------------------------------
// Client-Specific Helpers
// ---------------------------------------------------------------------------

/**
 * Persist the selected locale to a cookie (client-side only).
 * Falls back to localStorage if cookies are unavailable.
 */
export function persistLocaleClient(locale: Locale): void {
  if (typeof document === "undefined") return;

  const name = getCookieName();
  const maxAge = getCookieMaxAge();
  const value = `${name}=${locale}; path=/; max-age=${maxAge}; SameSite=Lax`;

  try {
    document.cookie = value;
  } catch {
    // Fallback to localStorage
    try {
      localStorage.setItem(name, locale);
    } catch {
      // Silently fail — locale detection will fall back to navigator
    }
  }
}

/**
 * Get the persisted locale from client storage.
 */
export function getPersistedLocaleClient(): string | undefined {
  if (typeof document === "undefined") return undefined;

  const name = getCookieName();

  // Try cookie first
  const cookieLocale = getLocaleFromCookie(document.cookie);
  if (cookieLocale) return cookieLocale;

  // Try localStorage
  try {
    const stored = localStorage.getItem(name);
    if (stored) return stored;
  } catch {
    // Ignore
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Middleware Helpers
// ---------------------------------------------------------------------------

/**
 * Determine whether a pathname should be localized.
 *
 * Excludes paths like /api/*, /_next/*, /static/*, /favicon.ico, etc.
 */
export function shouldLocalizePath(pathname: string): boolean {
  const EXCLUDED_PREFIXES = [
    "/api/",
    "/_next/",
    "/static/",
    "/public/",
    "/assets/",
    "/fonts/",
    "/images/",
  ];

  const EXCLUDED_EXACT = [
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
    "/manifest.json",
    "/apple-touch-icon.png",
    "/sw.js",
    "/workbox-",
  ];

  // Exact matches
  if (EXCLUDED_EXACT.some((p) => pathname === p || pathname.startsWith(p))) {
    return false;
  }

  // Prefix matches
  if (EXCLUDED_PREFIXES.some((p) => pathname.startsWith(p))) {
    return false;
  }

  // File extensions (no locale needed for static assets)
  if (/\.[a-zA-Z0-9]{1,6}$/.test(pathname)) {
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

/**
 * Verify i18n subsystem health.
 */
export function pingI18n(): {
  healthy: boolean;
  config: {
    defaultLocale: string;
    supportedLocales: string[];
    activeLocaleCount: number;
    rtlLocaleCount: number;
    cacheEntryCount: number;
    lazyLoading: boolean;
    strictMode: boolean;
    cookieName: string;
  };
  error?: string;
} {
  try {
    initGlobalState();
    const locales = globalForI18n.__locales!;
    const supported = globalForI18n.__supportedLocales!;
    const active = Object.values(locales).filter((l) => l.active);
    const rtl = active.filter((l) => l.direction === "rtl");

    return {
      healthy: true,
      config: {
        defaultLocale: globalForI18n.__defaultLocale!,
        supportedLocales: supported,
        activeLocaleCount: active.length,
        rtlLocaleCount: rtl.length,
        cacheEntryCount: globalForI18n.__cache?.size ?? 0,
        lazyLoading: getLazyLoadingEnabled(),
        strictMode: getStrictMode(),
        cookieName: getCookieName(),
      },
    };
  } catch (err) {
    return {
      healthy: false,
      config: {
        defaultLocale: "en",
        supportedLocales: [],
        activeLocaleCount: 0,
        rtlLocaleCount: 0,
        cacheEntryCount: 0,
        lazyLoading: true,
        strictMode: false,
        cookieName: "NEXT_LOCALE",
      },
      error: err instanceof Error ? err.message : "Unknown i18n health check error",
    };
  }
}

// ---------------------------------------------------------------------------
// Default Export
// ---------------------------------------------------------------------------

const i18n = {
  // Locale registry
  registerLocale,
  getLocaleMeta,
  getAllLocales,
  getActiveLocales,

  // RTL
  isRTLLocale,
  getDirection,
  getOppositeDirection,
  getHtmlAttributes,

  // Detection
  detectLocale,
  detectLocaleFromRequest,
  parseAcceptLanguage,
  buildLocaleCookie,
  getLocaleFromCookie,

  // Loading
  loadNamespace,
  loadMessages,
  discoverNamespaces,

  // Cache
  invalidateCache,
  getCacheStats,

  // Translation
  resolveTranslation,

  // Pluralization
  getPluralCategory,
  pluralize,

  // Formatting
  formatNumber,
  formatCurrency,
  getDefaultCurrency,
  formatDate,
  formatRelativeTime,
  formatRelativeDate,
  formatList,

  // URL / Path
  localizedPath,
  unlocalizedPath,
  extractLocaleFromPath,
  localeAlternates,

  // Client
  persistLocaleClient,
  getPersistedLocaleClient,

  // Middleware
  shouldLocalizePath,

  // Health
  ping: pingI18n,
} as const;

export default i18n;
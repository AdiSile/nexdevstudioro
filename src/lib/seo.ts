/**
 * SEO Utilities — Meta Tags, OpenGraph, Schema.org JSON-LD, Canonical URLs
 *
 * Production-grade SEO toolkit for NexusDevStudio.ro. Provides typed,
 * composable helpers for generating all on-page and structured-data SEO
 * signals consumed by Google, Bing, Yandex, social crawlers (Facebook,
 * Twitter/X, LinkedIn, Discord), and schema.org consumers.
 *
 * Architecture:
 *   1. Canonical URL builder — i18n-aware, trailing-slash control, query stripping
 *   2. Meta tag generators — title templates, safe description truncation, keywords
 *   3. OpenGraph builder — full og: profile with locale alternates, image sizing
 *   4. Twitter Card builder — summary / summary_large_image / player cards
 *   5. Schema.org JSON-LD generators (typed via schema-dts):
 *      - Organization / LocalBusiness
 *      - WebSite (with SitelinksSearchbox)
 *      - BreadcrumbList
 *      - Article / BlogPosting / NewsArticle
 *      - Product / Offer
 *      - FAQ
 *      - HowTo
 *      - Event
 *      - Person
 *      - VideoObject
 *      - Review / AggregateRating
 *   6. Robots.txt directives builder
 *   7. Hreflang alternate link generator
 *   8. Sitemap field helpers (lastmod, changefreq, priority)
 *   9. SEO audit utilities (missing-tags check, word-count scoring)
 *   10. Default brand configuration for NexusDevStudio
 *
 * Integration with next-seo:
 *   The types returned by this module are compatible with next-seo's
 *   `NextSeo` props. Use `buildNextSeoProps(pageSeo)` to get a ready-to-use
 *   props object for `<NextSeo />`.
 *
 * Usage — Page-level:
 *   import { buildPageSeo, buildNextSeoProps } from "@/lib/seo";
 *
 *   const seo = buildPageSeo({
 *     title: "Dezvoltare Web Profesională",
 *     description: "Servicii complete de dezvoltare web...",
 *     path: "/servicii/dezvoltare-web",
 *     locale: "ro",
 *     ogImage: { url: "https://...", width: 1200, height: 630 },
 *   });
 *
 *   // In page component:
 *   <NextSeo {...buildNextSeoProps(seo)} />
 *   <script type="application/ld+json">{JSON.stringify(seo.jsonLd)}</script>
 */

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import type {
  Article,
  BreadcrumbList,
  FAQPage,
  HowTo,
  Organization,
  Person,
  Product,
  VideoObject,
  WebSite,
  WithContext,
  Event,
  Review,
  AggregateRating,
  LocalBusiness,
  NewsArticle,
} from "schema-dts";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default brand / site identity */
export const BRAND = {
  name: "NexusDevStudio",
  legalName: "NexusDevStudio S.R.L.",
  alternateName: ["Nexus Dev Studio", "NexusDev"],
  url: "https://nexusdevstudio.ro",
  logo: "https://nexusdevstudio.ro/images/logo-512x512.png",
  logoSquare: "https://nexusdevstudio.ro/images/logo-512x512.png",
  logoWide: "https://nexusdevstudio.ro/images/og-default.png",
  description:
    "Dezvoltare software și servicii digitale complete: aplicații web, mobile, AI, cloud și automatizări pentru afacerea ta.",
  descriptionEn:
    "Full-stack software development and digital services: web, mobile, AI, cloud, and automation for your business.",
  email: "contact@nexusdevstudio.ro",
  phone: "+40 700 000 000",
  address: {
    street: "Str. Exemplu, Nr. 1",
    locality: "București",
    region: "București",
    country: "RO",
    postalCode: "010001",
  },
  social: {
    facebook: "https://facebook.com/nexusdevstudio",
    linkedin: "https://linkedin.com/company/nexusdevstudio",
    twitter: "https://twitter.com/nexusdevstudio",
    instagram: "https://instagram.com/nexusdevstudio",
    github: "https://github.com/nexusdevstudio",
    youtube: "https://youtube.com/@nexusdevstudio",
  },
  sameAs: [
    "https://facebook.com/nexusdevstudio",
    "https://linkedin.com/company/nexusdevstudio",
    "https://twitter.com/nexusdevstudio",
    "https://instagram.com/nexusdevstudio",
    "https://github.com/nexusdevstudio",
    "https://youtube.com/@nexusdevstudio",
  ],
  foundedYear: 2020,
  locale: "ro_RO",
  locales: ["ro_RO", "en_US"],
  defaultLocale: "ro",
  siteType: "WebSite",
} as const;

/** Maximum lengths for meta fields (Google best practices, 2024) */
export const META_LIMITS = {
  /** Title tag: 50-60 characters; Google displays up to ~600px ≈ 60 chars */
  TITLE_MAX: 60,
  /** Title minimum for SEO */
  TITLE_MIN: 30,
  /** Meta description: 150-160 chars; Google truncates ~920px ≈ 155 chars */
  DESCRIPTION_MAX: 160,
  /** Description minimum */
  DESCRIPTION_MIN: 70,
  /** Keywords: recommended 5-10 */
  KEYWORDS_MAX: 10,
  /** OG title max */
  OG_TITLE_MAX: 95,
  /** OG description max */
  OG_DESCRIPTION_MAX: 200,
  /** OG image: recommended 1200x630, max 5MB */
  OG_IMAGE_WIDTH: 1200,
  OG_IMAGE_HEIGHT: 630,
  OG_IMAGE_MAX_BYTES: 5_242_880,
} as const;

/** Default title separator */
const TITLE_SEPARATOR = " | ";

/** Sitemap change frequencies */
export const CHANGEFREQ = {
  ALWAYS: "always",
  HOURLY: "hourly",
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  YEARLY: "yearly",
  NEVER: "never",
} as const;

/** Robots directives */
export const ROBOTS_DIRECTIVES = {
  INDEX_FOLLOW: "index, follow",
  INDEX_NOFOLLOW: "index, nofollow",
  NOINDEX_FOLLOW: "noindex, follow",
  NOINDEX_NOFOLLOW: "noindex, nofollow",
  NONE: "none",
  NOARCHIVE: "noarchive",
  NOSNIPPET: "nosnippet",
  NOIMAGEINDEX: "noimageindex",
  NOTRANSLATE: "notranslate",
  MAX_SNIPPET: (len: number) => `max-snippet:${len}`,
  MAX_IMAGE_PREVIEW: (size: "none" | "standard" | "large") =>
    `max-image-preview:${size}`,
  MAX_VIDEO_PREVIEW: (seconds: number) => `max-video-preview:${seconds}`,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported locale codes (ISO 639-1) */
export type LocaleCode = "ro" | "en";

/** Supported locale with region (ICU) */
export type LocaleWithRegion = "ro_RO" | "en_US";

/** OG image specification */
export interface OgImage {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
  type?: string; // e.g. "image/png", "image/jpeg"
  secureUrl?: string;
}

/** Twitter card types */
export type TwitterCardType = "summary" | "summary_large_image" | "player" | "app";

/** Twitter card specification */
export interface TwitterCard {
  card: TwitterCardType;
  site?: string; // @username of website
  creator?: string; // @username of content creator
  title?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  player?: string;
  playerWidth?: number;
  playerHeight?: number;
}

/** OpenGraph profile */
export interface OpenGraph {
  type: "website" | "article" | "book" | "profile" | "video.movie" | "video.episode" | "video.tv_show" | "video.other" | "music.song" | "music.album" | "music.playlist" | "music.radio_station" | "product";
  title: string;
  description: string;
  url: string;
  siteName: string;
  locale: LocaleWithRegion;
  localeAlternate?: LocaleWithRegion[];
  images: OgImage[];
  // Article-specific
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    expirationTime?: string;
    author?: string;
    section?: string;
    tags?: string[];
  };
  // Video-specific
  video?: {
    url: string;
    width?: number;
    height?: number;
    type?: string;
    tags?: string[];
  };
  // Product-specific
  product?: {
    price?: { amount: string; currency: string };
    availability?: "in stock" | "out of stock" | "preorder" | "discontinued";
    condition?: "new" | "refurbished" | "used";
  };
}

/** Alternate link (hreflang) */
export interface AlternateLink {
  hrefLang: string; // e.g. "ro", "en", "ro-RO", "x-default"
  href: string;
}

/** Breadcrumb item */
export interface BreadcrumbItem {
  name: string;
  href: string;
  /** Optional image for the breadcrumb (usually the page's primary image) */
  image?: string;
}

/** Core page SEO data */
export interface PageSeoData {
  /** Page title (without brand suffix — appended automatically) */
  title: string;
  /** Meta description */
  description: string;
  /** Canonical path relative to domain root (e.g. "/servicii/dezvoltare-web") */
  path: string;
  /** Page locale */
  locale?: LocaleCode;
  /** Meta keywords (optional; Google ignores but Bing/Yandex still use) */
  keywords?: string[];
  /** Robots directives */
  robots?: string;
  /** Canonical URL override (when path derivation isn't enough) */
  canonical?: string;
  /** OpenGraph image */
  ogImage?: OgImage;
  /** Additional OG images */
  ogImages?: OgImage[];
  /** OpenGraph type override */
  ogType?: OpenGraph["type"];
  /** Twitter card override */
  twitter?: Partial<TwitterCard>;
  /** Do not append brand name to title */
  noBrandSuffix?: boolean;
  /** Use a custom title separator */
  titleSeparator?: string;
  /** hreflang alternates */
  alternates?: AlternateLink[];
  /** Published date (ISO 8601) */
  publishedTime?: string;
  /** Modified date (ISO 8601) */
  modifiedTime?: string;
  /** Article author name */
  author?: string;
  /** Article section / category */
  section?: string;
  /** Article tags */
  tags?: string[];
}

/** Complete SEO payload returned by buildPageSeo */
export interface PageSeo {
  title: string;
  description: string;
  canonical: string;
  language: LocaleCode;
  robots: string;
  keywords: string;
  openGraph: OpenGraph;
  twitter: TwitterCard;
  alternates: AlternateLink[];
  jsonLd: Record<string, unknown>[];
  /** Directly spreadable into NextSeo */
  nextSeoProps: Record<string, unknown>;
}

/** Options for building JSON-LD BreadcrumbList */
export interface BreadcrumbOptions {
  items: BreadcrumbItem[];
  /** Optional image for each breadcrumb (typically inherited from page) */
  image?: string;
}

/** Options for building JSON-LD Organization */
export interface OrganizationOptions {
  name?: string;
  legalName?: string;
  url?: string;
  logo?: string;
  description?: string;
  email?: string;
  phone?: string;
  sameAs?: string[];
  address?: {
    street: string;
    locality: string;
    region: string;
    country: string;
    postalCode: string;
  };
  /** If provided, creates LocalBusiness instead of Organization */
  localBusiness?: boolean;
  /** Opening hours specification */
  openingHours?: string[];
  /** Price range */
  priceRange?: string;
}

/** Options for building JSON-LD Article */
export interface ArticleOptions {
  headline: string;
  description: string;
  url: string;
  image: string | string[];
  datePublished: string;
  dateModified?: string;
  author: {
    name: string;
    url?: string;
    image?: string;
  };
  publisher?: {
    name: string;
    logo?: string;
  };
  keywords?: string[];
  articleSection?: string;
  wordCount?: number;
  /** If true, generates NewsArticle instead of Article */
  isNews?: boolean;
}

/** Options for building JSON-LD Product */
export interface ProductOptions {
  name: string;
  description: string;
  url: string;
  image: string | string[];
  sku?: string;
  mpn?: string;
  gtin?: string;
  gtin8?: string;
  gtin13?: string;
  gtin14?: string;
  brand?: { name: string; url?: string };
  offers: ProductOfferOptions;
  review?: ProductReviewOptions;
  aggregateRating?: AggregateRatingOptions;
  color?: string;
  size?: string;
  material?: string;
  category?: string;
  /** Product dimensions */
  dimensions?: { width: string; height: string; depth: string };
  weight?: string;
}

export interface ProductOfferOptions {
  price: number;
  priceCurrency: string;
  availability: "InStock" | "OutOfStock" | "PreOrder" | "Discontinued" | "BackOrder" | "OnlineOnly" | "InStoreOnly" | "LimitedAvailability" | "SoldOut";
  url: string;
  priceValidUntil?: string;
  itemCondition?: "NewCondition" | "RefurbishedCondition" | "DamagedCondition" | "UsedCondition";
  shippingDetails?: {
    shippingRate: { value: number; currency: string };
    deliveryTime?: { min: number; max: number; unit: "DAY" | "HOUR" };
  };
}

export interface ProductReviewOptions {
  author: string;
  reviewBody: string;
  reviewRating: { bestRating: number; ratingValue: number; worstRating: number };
  datePublished: string;
}

export interface AggregateRatingOptions {
  ratingValue: number;
  bestRating: number;
  worstRating: number;
  ratingCount: number;
  reviewCount?: number;
}

/** Options for building JSON-LD FAQ */
export interface FaqOptions {
  questions: Array<{ question: string; answer: string }>;
}

/** Options for building JSON-LD HowTo */
export interface HowToOptions {
  name: string;
  description: string;
  image?: string;
  totalTime?: string; // ISO 8601 duration e.g. "PT30M"
  steps: Array<{
    name: string;
    text: string;
    image?: string;
    url?: string;
  }>;
  tools?: string[];
  supplies?: string[];
  yield?: string;
  prepTime?: string;
}

/** Options for building JSON-LD Event */
export interface EventOptions {
  name: string;
  description: string;
  startDate: string; // ISO 8601
  endDate?: string;
  location: {
    name: string;
    address: {
      street: string;
      locality: string;
      region: string;
      country: string;
      postalCode: string;
    };
  };
  image?: string;
  offers?: {
    price: number;
    priceCurrency: string;
    availability: "InStock" | "SoldOut" | "PreOrder";
    url: string;
    validFrom?: string;
  };
  organizer?: {
    name: string;
    url?: string;
  };
  performer?: {
    name: string;
    url?: string;
  };
  eventStatus?: "EventScheduled" | "EventPostponed" | "EventCancelled" | "EventRescheduled" | "EventMovedOnline";
  eventAttendanceMode?: "OfflineEventAttendanceMode" | "OnlineEventAttendanceMode" | "MixedEventAttendanceMode";
}

/** Options for building JSON-LD Person */
export interface PersonOptions {
  name: string;
  givenName?: string;
  familyName?: string;
  url?: string;
  image?: string;
  jobTitle?: string;
  worksFor?: {
    name: string;
    url?: string;
  };
  sameAs?: string[];
  email?: string;
  description?: string;
}

/** Options for building JSON-LD VideoObject */
export interface VideoOptions {
  name: string;
  description: string;
  thumbnailUrl: string | string[];
  contentUrl: string;
  embedUrl?: string;
  uploadDate: string;
  duration?: string; // ISO 8601 duration e.g. "PT2M30S"
  publisher?: {
    name: string;
    logo?: string;
  };
  width?: number;
  height?: number;
}

/** Options for building JSON-LD Review */
export interface ReviewOptions {
  itemReviewed: {
    name: string;
    type?: string;
    url?: string;
  };
  author: {
    name: string;
    url?: string;
  };
  reviewBody: string;
  reviewRating: {
    bestRating: number;
    ratingValue: number;
    worstRating: number;
  };
  datePublished: string;
}

/** Options for building JSON-LD AggregateRating */
export interface AggregateRatingSchemaOptions {
  itemReviewed: {
    name: string;
    type?: string;
    url?: string;
  };
  ratingValue: number;
  bestRating: number;
  worstRating: number;
  ratingCount: number;
  reviewCount?: number;
}

/** Sitemap URL entry */
export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
  alternates?: AlternateLink[];
  images?: Array<{ loc: string; caption?: string; title?: string }>;
  videos?: Array<{
    thumbnailLoc: string;
    title: string;
    description: string;
    contentLoc?: string;
    playerLoc?: string;
    duration?: number;
    publicationDate?: string;
  }>;
}

/** SEO audit result for a single page */
export interface SeoAuditEntry {
  path: string;
  title?: string;
  titleLength?: number;
  titleOk?: boolean;
  description?: string;
  descriptionLength?: number;
  descriptionOk?: boolean;
  hasCanonical?: boolean;
  hasOgTitle?: boolean;
  hasOgDescription?: boolean;
  hasOgImage?: boolean;
  hasTwitterCard?: boolean;
  hasHreflang?: boolean;
  hasJsonLd?: boolean;
  hasSchemaOrg?: boolean;
  score: number; // 0-100
  issues: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

function envStr(key: string, fallback: string): string {
  if (typeof process === "undefined") return fallback;
  return process.env[key] || fallback;
}

const APP_URL = envStr("NEXT_PUBLIC_APP_URL", BRAND.url);
const APP_NAME = envStr("NEXT_PUBLIC_APP_NAME", BRAND.name);

// ---------------------------------------------------------------------------
// Locale utilities
// ---------------------------------------------------------------------------

/**
 * Map a simple locale code to the full ICU locale with region.
 */
export function toLocaleWithRegion(locale: LocaleCode): LocaleWithRegion {
  const map: Record<LocaleCode, LocaleWithRegion> = {
    ro: "ro_RO",
    en: "en_US",
  };
  return map[locale];
}

/**
 * Map full ICU locale to simple code.
 */
export function toLocaleCode(locale: LocaleWithRegion): LocaleCode {
  if (locale.startsWith("ro")) return "ro";
  return "en";
}

// ---------------------------------------------------------------------------
// Canonical URL Builder
// ---------------------------------------------------------------------------

/**
 * Build the canonical URL for a page.
 *
 * Handles:
 *  - i18n domain mapping (en.nexusdevstudio.ro for English)
 *  - Trailing slash removal (Next.js pattern)
 *  - Query-string stripping (by default; pass `keepQuery: true` to preserve)
 *  - Leading slash normalization
 *
 * @example
 *   buildCanonicalUrl("/servicii", "ro")   // "https://nexusdevstudio.ro/servicii"
 *   buildCanonicalUrl("/services", "en")   // "https://en.nexusdevstudio.ro/services"
 *   buildCanonicalUrl("/blog/articol?utm=fb", "ro")
 *     // "https://nexusdevstudio.ro/blog/articol"  (query stripped by default)
 */
export function buildCanonicalUrl(
  path: string,
  locale: LocaleCode = "ro",
  opts?: { keepQuery?: boolean; absoluteOverride?: string },
): string {
  if (opts?.absoluteOverride) {
    return opts.absoluteOverride;
  }

  // Normalize path
  let normalized = path.trim();
  if (!normalized.startsWith("/")) {
    normalized = "/" + normalized;
  }
  // Remove trailing slash (except root)
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  // Separate query string
  let query = "";
  const qIndex = normalized.indexOf("?");
  if (qIndex !== -1) {
    query = normalized.slice(qIndex);
    normalized = normalized.slice(0, qIndex);
  }

  // Domain selection
  let domain = APP_URL;
  if (locale === "en") {
    // English subdomain
    const urlObj = new URL(APP_URL);
    domain = `${urlObj.protocol}//en.${urlObj.host}`;
  }

  const finalQuery = opts?.keepQuery && query ? query : "";

  return `${domain}${normalized}${finalQuery}`;
}

// ---------------------------------------------------------------------------
// Title Builder
// ---------------------------------------------------------------------------

/**
 * Build an SEO title with automatic brand suffix.
 *
 * @param title - Page-specific title
 * @param opts.noSuffix - Don't append brand name
 * @param opts.separator - Custom separator (default " | ")
 * @param opts.maxLength - Max length before truncation (default 60)
 *
 * @example
 *   buildTitle("Dezvoltare Web")  // "Dezvoltare Web | NexusDevStudio"
 *   buildTitle("Acasă", { noSuffix: true })  // "Acasă"
 */
export function buildTitle(
  title: string,
  opts?: {
    noSuffix?: boolean;
    separator?: string;
    maxLength?: number;
  },
): string {
  const separator = opts?.separator ?? TITLE_SEPARATOR;
  const maxLength = opts?.maxLength ?? META_LIMITS.TITLE_MAX;

  let fullTitle: string;

  if (opts?.noSuffix) {
    fullTitle = title.trim();
  } else {
    fullTitle = `${title.trim()}${separator}${APP_NAME}`;
  }

  // Truncate if too long, preferring to cut the title, not the brand
  if (fullTitle.length > maxLength && !opts?.noSuffix) {
    const brandPart = `${separator}${APP_NAME}`;
    const available = maxLength - brandPart.length;
    if (available > 10) {
      fullTitle = `${title.trim().slice(0, available)}${brandPart}`;
    } else {
      fullTitle = fullTitle.slice(0, maxLength);
    }
  } else if (fullTitle.length > maxLength) {
    fullTitle = fullTitle.slice(0, maxLength - 1) + "…";
  }

  return fullTitle;
}

// ---------------------------------------------------------------------------
// Description Truncation
// ---------------------------------------------------------------------------

/**
 * Safely truncate a meta description to Google's display limit.
 *
 * Truncates at word boundaries when possible.
 *
 * @param description - Raw description text
 * @param maxLength - Max characters (default 160)
 */
export function truncateDescription(
  description: string,
  maxLength: number = META_LIMITS.DESCRIPTION_MAX,
): string {
  const trimmed = description.trim();
  if (trimmed.length <= maxLength) return trimmed;

  // Try to break at last space within limit
  const slice = trimmed.slice(0, maxLength);
  const lastSpace = slice.lastIndexOf(" ");
  const cutPoint = lastSpace > maxLength * 0.7 ? lastSpace : maxLength - 1;

  return `${trimmed.slice(0, cutPoint)}…`;
}

// ---------------------------------------------------------------------------
// Keywords Builder
// ---------------------------------------------------------------------------

/**
 * Normalize and deduplicate a keyword list.
 *
 * @param keywords - Raw keyword array
 * @param maxKeywords - Max keywords to emit (default 10)
 */
export function buildKeywords(
  keywords: string[],
  maxKeywords: number = META_LIMITS.KEYWORDS_MAX,
): string {
  const normalized = keywords
    .map((kw) => kw.trim().toLowerCase())
    .filter((kw, i, arr) => kw.length > 0 && arr.indexOf(kw) === i)
    .slice(0, maxKeywords);

  return normalized.join(", ");
}

// ---------------------------------------------------------------------------
// OpenGraph Builder
// ---------------------------------------------------------------------------

/**
 * Build a complete OpenGraph profile for a page.
 */
export function buildOpenGraph(
  seo: PageSeoData,
): OpenGraph {
  const localeWithRegion = toLocaleWithRegion(seo.locale ?? "ro");
  const canonical = seo.canonical ?? buildCanonicalUrl(seo.path, seo.locale);

  const images: OgImage[] = [];

  if (seo.ogImage) {
    images.push({
      url: seo.ogImage.url,
      width: seo.ogImage.width ?? META_LIMITS.OG_IMAGE_WIDTH,
      height: seo.ogImage.height ?? META_LIMITS.OG_IMAGE_HEIGHT,
      alt: seo.ogImage.alt ?? seo.title,
      type: seo.ogImage.type ?? "image/png",
      secureUrl: seo.ogImage.secureUrl,
    });
  }

  if (seo.ogImages) {
    for (const img of seo.ogImages) {
      images.push({
        url: img.url,
        width: img.width ?? META_LIMITS.OG_IMAGE_WIDTH,
        height: img.height ?? META_LIMITS.OG_IMAGE_HEIGHT,
        alt: img.alt ?? seo.title,
        type: img.type ?? "image/png",
        secureUrl: img.secureUrl,
      });
    }
  }

  // Fallback to default OG image
  if (images.length === 0) {
    images.push({
      url: BRAND.logoWide,
      width: META_LIMITS.OG_IMAGE_WIDTH,
      height: META_LIMITS.OG_IMAGE_HEIGHT,
      alt: APP_NAME,
      type: "image/png",
    });
  }

  const allLocales = (seo.locale ?? "ro") === "ro" ? ["ro_RO", "en_US"] : ["en_US", "ro_RO"];

  const og: OpenGraph = {
    type: seo.ogType ?? "website",
    title: truncateDescription(seo.title, META_LIMITS.OG_TITLE_MAX),
    description: truncateDescription(seo.description, META_LIMITS.OG_DESCRIPTION_MAX),
    url: canonical,
    siteName: APP_NAME,
    locale: localeWithRegion,
    localeAlternate: allLocales as LocaleWithRegion[],
    images,
  };

  // Article-specific
  if (seo.ogType === "article" || seo.publishedTime) {
    og.article = {
      publishedTime: seo.publishedTime,
      modifiedTime: seo.modifiedTime,
      author: seo.author,
      section: seo.section,
      tags: seo.tags,
    };
  }

  return og;
}

// ---------------------------------------------------------------------------
// Twitter Card Builder
// ---------------------------------------------------------------------------

/**
 * Build a Twitter Card profile.
 */
export function buildTwitterCard(
  seo: PageSeoData,
): TwitterCard {
  const defaultImage = seo.ogImage?.url ?? BRAND.logoWide;
  const defaultCard: TwitterCardType = seo.ogImage
    ? "summary_large_image"
    : "summary";

  return {
    card: seo.twitter?.card ?? defaultCard,
    site: seo.twitter?.site ?? "@nexusdevstudio",
    creator: seo.twitter?.creator,
    title: seo.twitter?.title ?? seo.title,
    description: seo.twitter?.description ?? truncateDescription(seo.description),
    image: seo.twitter?.image ?? defaultImage,
    imageAlt: seo.twitter?.imageAlt ?? seo.title,
    player: seo.twitter?.player,
    playerWidth: seo.twitter?.playerWidth,
    playerHeight: seo.twitter?.playerHeight,
  };
}

// ---------------------------------------------------------------------------
// Hreflang Alternates Builder
// ---------------------------------------------------------------------------

/**
 * Build hreflang alternate links for a page.
 *
 * @param path - The page path (same across locales, content differs)
 * @param locales - Which locales have this page (default: all)
 *
 * @example
 *   buildAlternates("/servicii", ["ro", "en"])
 *   // [
 *   //   { hrefLang: "ro", href: "https://nexusdevstudio.ro/servicii" },
 *   //   { hrefLang: "en", href: "https://en.nexusdevstudio.ro/servicii" },
 *   //   { hrefLang: "x-default", href: "https://nexusdevstudio.ro/servicii" },
 *   // ]
 */
export function buildAlternates(
  path: string,
  locales: LocaleCode[] = ["ro", "en"],
): AlternateLink[] {
  const alternates: AlternateLink[] = [];

  for (const locale of locales) {
    alternates.push({
      hrefLang: locale,
      href: buildCanonicalUrl(path, locale),
    });
  }

  // x-default: usually the default locale
  alternates.push({
    hrefLang: "x-default",
    href: buildCanonicalUrl(path, "ro"),
  });

  return alternates;
}

// ---------------------------------------------------------------------------
// Schema.org JSON-LD Builders
// ---------------------------------------------------------------------------

/**
 * Build JSON-LD Organization or LocalBusiness schema.
 *
 * @example
 *   const orgLd = buildOrganizationJsonLd();  // NexusDevStudio defaults
 *   const orgLd = buildOrganizationJsonLd({ localBusiness: true });
 */
export function buildOrganizationJsonLd(
  opts?: OrganizationOptions,
): WithContext<Organization | LocalBusiness> {
  const base = {
    "@type": (opts?.localBusiness ? "LocalBusiness" : "Organization") as "Organization" | "LocalBusiness",
    name: opts?.name ?? BRAND.name,
    legalName: opts?.legalName ?? BRAND.legalName,
    url: opts?.url ?? BRAND.url,
    logo: opts?.logo ?? BRAND.logo,
    description: opts?.description ?? BRAND.description,
    email: opts?.email ?? BRAND.email,
    telephone: opts?.phone ?? BRAND.phone,
    sameAs: opts?.sameAs ?? (BRAND.sameAs as unknown as string[]),
    address: opts?.address
      ? {
          "@type": "PostalAddress",
          streetAddress: opts.address.street,
          addressLocality: opts.address.locality,
          addressRegion: opts.address.region,
          addressCountry: opts.address.country,
          postalCode: opts.address.postalCode,
        }
      : {
          "@type": "PostalAddress",
          streetAddress: BRAND.address.street,
          addressLocality: BRAND.address.locality,
          addressRegion: BRAND.address.region,
          addressCountry: BRAND.address.country,
          postalCode: BRAND.address.postalCode,
        },
    foundingDate: String(BRAND.foundedYear),
  };

  const extra: Record<string, unknown> = {};

  if (opts?.openingHours && opts?.localBusiness) {
    extra.openingHoursSpecification = opts.openingHours.map((hours) => ({
      "@type": "OpeningHoursSpecification",
      ...parseOpeningHours(hours),
    }));
  }

  if (opts?.priceRange && opts?.localBusiness) {
    extra.priceRange = opts.priceRange;
  }

  return {
    "@context": "https://schema.org",
    ...base,
    ...extra,
  } as WithContext<Organization | LocalBusiness>;
}

/**
 * Parse a simple opening hours string into structured data.
 * Format: "Mo-Fr 09:00-18:00", "Sa 10:00-14:00"
 */
function parseOpeningHours(spec: string): Record<string, unknown> {
  const match = spec.match(/^(\w{2}(?:-\w{2})?)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
  if (!match) return { description: spec };

  const [, days, opens, closes] = match as [string, string, string, string];

  const dayMap: Record<string, string> = {
    Mo: "Monday",
    Tu: "Tuesday",
    We: "Wednesday",
    Th: "Thursday",
    Fr: "Friday",
    Sa: "Saturday",
    Su: "Sunday",
  };

  const [startDay, endDay] = days.split("-");
  const dayOfWeek: string[] = [];

  if (endDay) {
    const dayKeys = Object.keys(dayMap);
    const startIdx = dayKeys.indexOf(startDay!);
    const endIdx = dayKeys.indexOf(endDay);
    if (startIdx !== -1 && endIdx !== -1) {
      for (let i = startIdx; i <= endIdx; i++) {
        const url = `https://schema.org/${dayMap[dayKeys[i]!]}`;
        dayOfWeek.push(url);
      }
    }
  } else {
    const url = `https://schema.org/${dayMap[startDay!]}`;
    dayOfWeek.push(url);
  }

  return {
    dayOfWeek,
    opens,
    closes,
  };
}

/**
 * Build JSON-LD WebSite schema with Sitelinks Searchbox.
 */
export function buildWebSiteJsonLd(
  opts?: { url?: string; name?: string; searchUrl?: string },
): WithContext<WebSite> {
  const url = opts?.url ?? BRAND.url;
  const name = opts?.name ?? BRAND.name;
  const searchUrl = opts?.searchUrl ?? `${url}/search?q={search_term_string}`;

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name,
    url,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: searchUrl,
      },
      "query-input": "required name=search_term_string",
    },
  } as WithContext<WebSite>;
}

/**
 * Build JSON-LD BreadcrumbList schema.
 *
 * @example
 *   buildBreadcrumbListJsonLd({
 *     items: [
 *       { name: "Acasă", href: "/" },
 *       { name: "Servicii", href: "/servicii" },
 *       { name: "Dezvoltare Web", href: "/servicii/dezvoltare-web" },
 *     ],
 *   });
 */
export function buildBreadcrumbListJsonLd(
  opts: BreadcrumbOptions,
): WithContext<BreadcrumbList> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: opts.items.map((item, index) => {
      const position = index + 1;
      const canonicalHref = item.href.startsWith("http")
        ? item.href
        : buildCanonicalUrl(item.href);

      const element: Record<string, unknown> = {
        "@type": "ListItem",
        position,
        name: item.name,
        item: canonicalHref,
      };

      if (item.image) {
        element.image = item.image;
      }

      return element;
    }),
  } as WithContext<BreadcrumbList>;
}

/**
 * Build JSON-LD Article or BlogPosting schema.
 */
export function buildArticleJsonLd(
  opts: ArticleOptions,
): WithContext<Article | NewsArticle> {
  const images = Array.isArray(opts.image) ? opts.image : [opts.image];

  const article: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": opts.isNews ? "NewsArticle" : "Article",
    headline: opts.headline,
    description: opts.description,
    url: opts.url,
    image: images,
    datePublished: opts.datePublished,
    dateModified: opts.dateModified ?? opts.datePublished,
    author: {
      "@type": "Person",
      name: opts.author.name,
      ...(opts.author.url ? { url: opts.author.url } : {}),
      ...(opts.author.image ? { image: opts.author.image } : {}),
    },
    publisher: opts.publisher
      ? {
          "@type": "Organization",
          name: opts.publisher.name,
          ...(opts.publisher.logo
            ? {
                logo: {
                  "@type": "ImageObject",
                  url: opts.publisher.logo,
                },
              }
            : {}),
        }
      : {
          "@type": "Organization",
          name: BRAND.name,
          logo: {
            "@type": "ImageObject",
            url: BRAND.logo,
          },
        },
  };

  if (opts.keywords && opts.keywords.length > 0) {
    article.keywords = opts.keywords.join(", ");
  }

  if (opts.articleSection) {
    article.articleSection = opts.articleSection;
  }

  if (opts.wordCount) {
    article.wordCount = opts.wordCount;
  }

  return article as WithContext<Article | NewsArticle>;
}

/**
 * Build JSON-LD Product schema with Offer.
 */
export function buildProductJsonLd(
  opts: ProductOptions,
): WithContext<Product> {
  const images = Array.isArray(opts.image) ? opts.image : [opts.image];

  const product: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: opts.name,
    description: opts.description,
    url: opts.url,
    image: images,
    brand: opts.brand
      ? {
          "@type": "Brand",
          name: opts.brand.name,
          ...(opts.brand.url ? { url: opts.brand.url } : {}),
        }
      : undefined,
    offers: {
      "@type": "Offer",
      price: opts.offers.price,
      priceCurrency: opts.offers.priceCurrency,
      availability: `https://schema.org/${opts.offers.availability}`,
      url: opts.offers.url,
      priceValidUntil: opts.offers.priceValidUntil,
      itemCondition: opts.offers.itemCondition
        ? `https://schema.org/${opts.offers.itemCondition}`
        : "https://schema.org/NewCondition",
      ...(opts.offers.shippingDetails
        ? {
            shippingDetails: {
              "@type": "OfferShippingDetails",
              shippingRate: {
                "@type": "MonetaryAmount",
                value: opts.offers.shippingDetails.shippingRate.value,
                currency: opts.offers.shippingDetails.shippingRate.currency,
              },
              ...(opts.offers.shippingDetails.deliveryTime
                ? {
                    deliveryTime: {
                      "@type": "ShippingDeliveryTime",
                      handlingTime: {
                        "@type": "QuantitativeValue",
                        minValue: opts.offers.shippingDetails.deliveryTime.min,
                        maxValue: opts.offers.shippingDetails.deliveryTime.max,
                        unitCode: opts.offers.shippingDetails.deliveryTime.unit,
                      },
                    },
                  }
                : {}),
            },
          }
        : {}),
    },
  };

  // Identifiers
  if (opts.sku) product.sku = opts.sku;
  if (opts.mpn) product.mpn = opts.mpn;
  if (opts.gtin) product.gtin = opts.gtin;
  if (opts.gtin8) product.gtin8 = opts.gtin8;
  if (opts.gtin13) product.gtin13 = opts.gtin13;
  if (opts.gtin14) product.gtin14 = opts.gtin14;

  // Additional attributes
  if (opts.color) product.color = opts.color;
  if (opts.size) product.size = opts.size;
  if (opts.material) product.material = opts.material;
  if (opts.category) product.category = opts.category;

  // Dimensions
  if (opts.dimensions) {
    product.depth = {
      "@type": "QuantitativeValue",
      width: { "@type": "QuantitativeValue", value: opts.dimensions.width },
      height: { "@type": "QuantitativeValue", value: opts.dimensions.height },
      depth: { "@type": "QuantitativeValue", value: opts.dimensions.depth },
    };
  }

  if (opts.weight) {
    product.weight = { "@type": "QuantitativeValue", value: opts.weight };
  }

  // Review
  if (opts.review) {
    product.review = {
      "@type": "Review",
      author: { "@type": "Person", name: opts.review.author },
      reviewBody: opts.review.reviewBody,
      reviewRating: {
        "@type": "Rating",
        bestRating: opts.review.reviewRating.bestRating,
        ratingValue: opts.review.reviewRating.ratingValue,
        worstRating: opts.review.reviewRating.worstRating,
      },
      datePublished: opts.review.datePublished,
    };
  }

  // AggregateRating
  if (opts.aggregateRating) {
    product.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: opts.aggregateRating.ratingValue,
      bestRating: opts.aggregateRating.bestRating,
      worstRating: opts.aggregateRating.worstRating,
      ratingCount: opts.aggregateRating.ratingCount,
      ...(opts.aggregateRating.reviewCount
        ? { reviewCount: opts.aggregateRating.reviewCount }
        : {}),
    };
  }

  return product as WithContext<Product>;
}

/**
 * Build JSON-LD FAQ schema.
 */
export function buildFaqJsonLd(
  opts: FaqOptions,
): WithContext<FAQPage> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: opts.questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: q.answer,
      },
    })),
  } as WithContext<FAQPage>;
}

/**
 * Build JSON-LD HowTo schema.
 */
export function buildHowToJsonLd(
  opts: HowToOptions,
): WithContext<HowTo> {
  const howTo: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: opts.name,
    description: opts.description,
    step: opts.steps.map((step, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: step.name,
      text: step.text,
      ...(step.image ? { image: step.image } : {}),
      ...(step.url ? { url: step.url } : {}),
    })),
  };

  if (opts.image) howTo.image = opts.image;
  if (opts.totalTime) howTo.totalTime = `P${opts.totalTime}`;
  if (opts.prepTime) howTo.prepTime = `P${opts.prepTime}`;

  if (opts.tools && opts.tools.length > 0) {
    howTo.tool = opts.tools.map((t) => ({ "@type": "HowToTool", name: t }));
  }

  if (opts.supplies && opts.supplies.length > 0) {
    howTo.supply = opts.supplies.map((s) => ({
      "@type": "HowToSupply",
      name: s,
    }));
  }

  if (opts.yield) {
    howTo.yield = { "@type": "QuantitativeValue", value: opts.yield };
  }

  return howTo as WithContext<HowTo>;
}

/**
 * Build JSON-LD Event schema.
 */
export function buildEventJsonLd(
  opts: EventOptions,
): WithContext<Event> {
  const event: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: opts.name,
    description: opts.description,
    startDate: opts.startDate,
    endDate: opts.endDate ?? opts.startDate,
    location: {
      "@type": "Place",
      name: opts.location.name,
      address: {
        "@type": "PostalAddress",
        streetAddress: opts.location.address.street,
        addressLocality: opts.location.address.locality,
        addressRegion: opts.location.address.region,
        addressCountry: opts.location.address.country,
        postalCode: opts.location.address.postalCode,
      },
    },
    eventStatus: opts.eventStatus
      ? `https://schema.org/${opts.eventStatus}`
      : "https://schema.org/EventScheduled",
    eventAttendanceMode: opts.eventAttendanceMode
      ? `https://schema.org/${opts.eventAttendanceMode}`
      : "https://schema.org/OfflineEventAttendanceMode",
  };

  if (opts.image) event.image = opts.image;

  if (opts.offers) {
    event.offers = {
      "@type": "Offer",
      price: opts.offers.price,
      priceCurrency: opts.offers.priceCurrency,
      availability: `https://schema.org/${opts.offers.availability}`,
      url: opts.offers.url,
      ...(opts.offers.validFrom ? { validFrom: opts.offers.validFrom } : {}),
    };
  }

  if (opts.organizer) {
    event.organizer = {
      "@type": "Organization",
      name: opts.organizer.name,
      ...(opts.organizer.url ? { url: opts.organizer.url } : {}),
    };
  }

  if (opts.performer) {
    event.performer = {
      "@type": "Person",
      name: opts.performer.name,
      ...(opts.performer.url ? { url: opts.performer.url } : {}),
    };
  }

  return event as WithContext<Event>;
}

/**
 * Build JSON-LD Person schema.
 */
export function buildPersonJsonLd(
  opts: PersonOptions,
): WithContext<Person> {
  const person: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: opts.name,
  };

  if (opts.givenName) person.givenName = opts.givenName;
  if (opts.familyName) person.familyName = opts.familyName;
  if (opts.url) person.url = opts.url;
  if (opts.image) person.image = opts.image;
  if (opts.jobTitle) person.jobTitle = opts.jobTitle;
  if (opts.description) person.description = opts.description;
  if (opts.email) person.email = opts.email;
  if (opts.sameAs) person.sameAs = opts.sameAs;

  if (opts.worksFor) {
    person.worksFor = {
      "@type": "Organization",
      name: opts.worksFor.name,
      ...(opts.worksFor.url ? { url: opts.worksFor.url } : {}),
    };
  }

  return person as WithContext<Person>;
}

/**
 * Build JSON-LD VideoObject schema.
 */
export function buildVideoJsonLd(
  opts: VideoOptions,
): WithContext<VideoObject> {
  const thumbnails = Array.isArray(opts.thumbnailUrl)
    ? opts.thumbnailUrl
    : [opts.thumbnailUrl];

  const video: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: opts.name,
    description: opts.description,
    thumbnailUrl: thumbnails,
    contentUrl: opts.contentUrl,
    uploadDate: opts.uploadDate,
  };

  if (opts.embedUrl) video.embedUrl = opts.embedUrl;
  if (opts.duration) video.duration = opts.duration;
  if (opts.width) video.width = opts.width;
  if (opts.height) video.height = opts.height;

  if (opts.publisher) {
    video.publisher = {
      "@type": "Organization",
      name: opts.publisher.name,
      ...(opts.publisher.logo
        ? {
            logo: {
              "@type": "ImageObject",
              url: opts.publisher.logo,
            },
          }
        : {}),
    };
  }

  return video as WithContext<VideoObject>;
}

/**
 * Build JSON-LD Review schema.
 */
export function buildReviewJsonLd(
  opts: ReviewOptions,
): WithContext<Review> {
  return {
    "@context": "https://schema.org",
    "@type": "Review",
    itemReviewed: {
      "@type": opts.itemReviewed.type ?? "Thing",
      name: opts.itemReviewed.name,
      ...(opts.itemReviewed.url ? { url: opts.itemReviewed.url } : {}),
    },
    author: {
      "@type": "Person",
      name: opts.author.name,
      ...(opts.author.url ? { url: opts.author.url } : {}),
    },
    reviewBody: opts.reviewBody,
    reviewRating: {
      "@type": "Rating",
      bestRating: opts.reviewRating.bestRating,
      ratingValue: opts.reviewRating.ratingValue,
      worstRating: opts.reviewRating.worstRating,
    },
    datePublished: opts.datePublished,
  } as WithContext<Review>;
}

/**
 * Build JSON-LD AggregateRating schema.
 */
export function buildAggregateRatingJsonLd(
  opts: AggregateRatingSchemaOptions,
): WithContext<AggregateRating> {
  return {
    "@context": "https://schema.org",
    "@type": "AggregateRating",
    itemReviewed: {
      "@type": opts.itemReviewed.type ?? "Thing",
      name: opts.itemReviewed.name,
      ...(opts.itemReviewed.url ? { url: opts.itemReviewed.url } : {}),
    },
    ratingValue: opts.ratingValue,
    bestRating: opts.bestRating,
    worstRating: opts.worstRating,
    ratingCount: opts.ratingCount,
    ...(opts.reviewCount ? { reviewCount: opts.reviewCount } : {}),
  } as WithContext<AggregateRating>;
}

// ---------------------------------------------------------------------------
// JSON-LD Sanitizer
// ---------------------------------------------------------------------------

/**
 * Strip undefined/null values from a JSON-LD object for clean serialization.
 */
export function sanitizeJsonLd<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * Serialize one or more JSON-LD objects into a safe script-ready string.
 */
export function stringifyJsonLd(
  ...schemas: Record<string, unknown>[]
): string {
  const cleaned = schemas.map((s) => sanitizeJsonLd(s));
  if (cleaned.length === 1) {
    return JSON.stringify(cleaned[0]);
  }
  return JSON.stringify(cleaned);
}

// ---------------------------------------------------------------------------
// Complete Page SEO Builder
// ---------------------------------------------------------------------------

/**
 * Build a complete PageSeo payload from page data.
 *
 * This is the primary entry point for most pages.
 *
 * @example
 *   const seo = buildPageSeo({
 *     title: "Dezvoltare Web Profesională",
 *     description: "Servicii complete de dezvoltare...",
 *     path: "/servicii/dezvoltare-web",
 *     locale: "ro",
 *     ogImage: { url: "https://...", width: 1200, height: 630 },
 *   });
 *
 *   // Use with next-seo:
 *   <NextSeo {...seo.nextSeoProps} />
 *   <Script id="json-ld" type="application/ld+json">
 *     {stringifyJsonLd(...seo.jsonLd)}
 *   </Script>
 */
export function buildPageSeo(data: PageSeoData): PageSeo {
  const locale = data.locale ?? "ro";
  const canonical = data.canonical ?? buildCanonicalUrl(data.path, locale);
  const title = buildTitle(data.title, {
    noSuffix: data.noBrandSuffix,
    separator: data.titleSeparator,
  });
  const description = truncateDescription(data.description);
  const keywords = data.keywords ? buildKeywords(data.keywords) : "";
  const robots = data.robots ?? ROBOTS_DIRECTIVES.INDEX_FOLLOW;

  const openGraph = buildOpenGraph(data);
  const twitter = buildTwitterCard(data);
  const alternates = data.alternates ?? buildAlternates(data.path, [locale]);

  // Build JSON-LD array
  const jsonLd: Record<string, unknown>[] = [];

  // --- NextSeo-compatible props ---
  const nextSeoProps: Record<string, unknown> = {
    title,
    description,
    canonical,
    language: locale,
    openGraph: {
      type: openGraph.type,
      title: openGraph.title,
      description: openGraph.description,
      url: openGraph.url,
      siteName: openGraph.siteName,
      locale: openGraph.locale,
      images: openGraph.images.map((img) => ({
        url: img.url,
        width: img.width,
        height: img.height,
        alt: img.alt,
        type: img.type,
        secureUrl: img.secureUrl,
      })),
      ...(openGraph.article
        ? {
            article: {
              publishedTime: openGraph.article.publishedTime,
              modifiedTime: openGraph.article.modifiedTime,
              authors: openGraph.article.author
                ? [openGraph.article.author]
                : undefined,
              section: openGraph.article.section,
              tags: openGraph.article.tags,
            },
          }
        : {}),
      ...(openGraph.video
        ? {
            videos: [
              {
                url: openGraph.video.url,
                width: openGraph.video.width,
                height: openGraph.video.height,
                type: openGraph.video.type,
              },
            ],
          }
        : {}),
    },
    twitter: {
      handle: twitter.site,
      site: twitter.site,
      cardType: twitter.card,
    },
  };

  return {
    title,
    description,
    canonical,
    language: locale,
    robots,
    keywords,
    openGraph,
    twitter,
    alternates,
    jsonLd,
    nextSeoProps,
  };
}

// ---------------------------------------------------------------------------
// Robots.txt Builder
// ---------------------------------------------------------------------------

/**
 * Build a robots.txt file content.
 *
 * @example
 *   buildRobotsTxt({
 *     disallow: ["/admin/", "/api/", "/dashboard/"],
 *     sitemaps: ["https://nexusdevstudio.ro/sitemap.xml"],
 *   });
 */
export function buildRobotsTxt(opts?: {
  userAgent?: string;
  disallow?: string[];
  allow?: string[];
  sitemaps?: string[];
  crawlDelay?: number;
}): string {
  const lines: string[] = [];

  lines.push(`User-agent: ${opts?.userAgent ?? "*"}`);

  if (opts?.crawlDelay) {
    lines.push(`Crawl-delay: ${opts.crawlDelay}`);
  }

  if (opts?.disallow) {
    for (const path of opts.disallow) {
      lines.push(`Disallow: ${path}`);
    }
  } else {
    lines.push("Disallow:");
  }

  if (opts?.allow) {
    for (const path of opts.allow) {
      lines.push(`Allow: ${path}`);
    }
  }

  lines.push("");

  if (opts?.sitemaps) {
    for (const sitemap of opts.sitemaps) {
      lines.push(`Sitemap: ${sitemap}`);
    }
  }

  return lines.join("\n").trimEnd() + "\n";
}

// ---------------------------------------------------------------------------
// Sitemap Helpers
// ---------------------------------------------------------------------------

/**
 * Build a sitemap XML URL entry.
 */
export function buildSitemapUrl(entry: SitemapUrl): string {
  const parts: string[] = ["  <url>"];
  parts.push(`    <loc>${escapeXml(entry.loc)}</loc>`);

  if (entry.lastmod) {
    parts.push(`    <lastmod>${entry.lastmod}</lastmod>`);
  }

  if (entry.changefreq) {
    parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
  }

  if (entry.priority !== undefined) {
    parts.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
  }

  // Alternate links (hreflang)
  if (entry.alternates) {
    for (const alt of entry.alternates) {
      parts.push(
        `    <xhtml:link rel="alternate" hreflang="${alt.hrefLang}" href="${escapeXml(alt.href)}" />`,
      );
    }
  }

  // Images
  if (entry.images) {
    for (const img of entry.images) {
      parts.push("    <image:image>");
      parts.push(`      <image:loc>${escapeXml(img.loc)}</image:loc>`);
      if (img.caption) {
        parts.push(
          `      <image:caption>${escapeXml(img.caption)}</image:caption>`,
        );
      }
      if (img.title) {
        parts.push(
          `      <image:title>${escapeXml(img.title)}</image:title>`,
        );
      }
      parts.push("    </image:image>");
    }
  }

  // Videos
  if (entry.videos) {
    for (const vid of entry.videos) {
      parts.push("    <video:video>");
      parts.push(
        `      <video:thumbnail_loc>${escapeXml(vid.thumbnailLoc)}</video:thumbnail_loc>`,
      );
      parts.push(
        `      <video:title>${escapeXml(vid.title)}</video:title>`,
      );
      parts.push(
        `      <video:description>${escapeXml(vid.description)}</video:description>`,
      );
      if (vid.contentLoc) {
        parts.push(
          `      <video:content_loc>${escapeXml(vid.contentLoc)}</video:content_loc>`,
        );
      }
      if (vid.playerLoc) {
        parts.push(
          `      <video:player_loc>${escapeXml(vid.playerLoc)}</video:player_loc>`,
        );
      }
      if (vid.duration) {
        parts.push(`      <video:duration>${vid.duration}</video:duration>`);
      }
      if (vid.publicationDate) {
        parts.push(
          `      <video:publication_date>${vid.publicationDate}</video:publication_date>`,
        );
      }
      parts.push("    </video:video>");
    }
  }

  parts.push("  </url>");
  return parts.join("\n");
}

/**
 * Build a complete sitemap XML document.
 */
export function buildSitemapXml(
  entries: SitemapUrl[],
): string {
  const header = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml"',
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"',
    '        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">',
  ].join("\n");

  const body = entries.map((e) => buildSitemapUrl(e)).join("\n");
  const footer = "</urlset>";

  return `${header}\n${body}\n${footer}\n`;
}

/**
 * Build a sitemap index XML document (for large sites with multiple sitemaps).
 */
export function buildSitemapIndexXml(
  sitemaps: Array<{ loc: string; lastmod?: string }>,
): string {
  const header = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ].join("\n");

  const body = sitemaps
    .map((s) => {
      const parts: string[] = ["  <sitemap>"];
      parts.push(`    <loc>${escapeXml(s.loc)}</loc>`);
      if (s.lastmod) {
        parts.push(`    <lastmod>${s.lastmod}</lastmod>`);
      }
      parts.push("  </sitemap>");
      return parts.join("\n");
    })
    .join("\n");

  const footer = "</sitemapindex>";

  return `${header}\n${body}\n${footer}\n`;
}

// ---------------------------------------------------------------------------
// XML Escaping
// ---------------------------------------------------------------------------

const XML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/**
 * Escape a string for safe insertion into XML/Sitemap.
 */
export function escapeXml(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => XML_ESCAPE_MAP[ch] ?? ch);
}

// ---------------------------------------------------------------------------
// SEO Audit
// ---------------------------------------------------------------------------

/**
 * Run a basic SEO audit on a page.
 *
 * Checks for common issues: missing tags, length violations, schema presence.
 *
 * @returns A score 0–100 and a list of issues.
 */
export function auditPageSeo(params: {
  path: string;
  title?: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterCard?: string;
  hreflangCount?: number;
  jsonLdCount?: number;
  hasSchemaOrg?: boolean;
  wordCount?: number;
}): SeoAuditEntry {
  const issues: string[] = [];
  const warnings: string[] = [];
  let score = 100;

  // Title
  const titleLength = params.title?.length ?? 0;
  const titleOk =
    titleLength >= META_LIMITS.TITLE_MIN &&
    titleLength <= META_LIMITS.TITLE_MAX;

  if (!params.title) {
    issues.push("Missing <title> tag");
    score -= 25;
  } else if (titleLength < META_LIMITS.TITLE_MIN) {
    warnings.push(`Title too short (${titleLength} chars; min ${META_LIMITS.TITLE_MIN})`);
    score -= 10;
  } else if (titleLength > META_LIMITS.TITLE_MAX) {
    warnings.push(`Title too long (${titleLength} chars; max ${META_LIMITS.TITLE_MAX})`);
    score -= 5;
  }

  // Description
  const descriptionLength = params.description?.length ?? 0;
  const descriptionOk =
    descriptionLength >= META_LIMITS.DESCRIPTION_MIN &&
    descriptionLength <= META_LIMITS.DESCRIPTION_MAX;

  if (!params.description) {
    issues.push("Missing meta description");
    score -= 25;
  } else if (descriptionLength < META_LIMITS.DESCRIPTION_MIN) {
    warnings.push(
      `Description too short (${descriptionLength} chars; min ${META_LIMITS.DESCRIPTION_MIN})`,
    );
    score -= 10;
  } else if (descriptionLength > META_LIMITS.DESCRIPTION_MAX) {
    warnings.push(
      `Description too long (${descriptionLength} chars; max ${META_LIMITS.DESCRIPTION_MAX})`,
    );
    score -= 5;
  }

  // Canonical
  if (!params.canonical) {
    warnings.push("Missing canonical URL");
    score -= 10;
  }

  // OpenGraph
  if (!params.ogTitle) {
    warnings.push("Missing og:title");
    score -= 5;
  }
  if (!params.ogDescription) {
    warnings.push("Missing og:description");
    score -= 5;
  }
  if (!params.ogImage) {
    warnings.push("Missing og:image");
    score -= 5;
  }

  // Twitter
  if (!params.twitterCard) {
    warnings.push("Missing twitter:card");
    score -= 5;
  }

  // Hreflang
  if (!params.hreflangCount || params.hreflangCount < 2) {
    warnings.push("Missing or incomplete hreflang tags");
    score -= 5;
  }

  // Structured data
  if (!params.jsonLdCount || params.jsonLdCount === 0) {
    issues.push("No JSON-LD structured data");
    score -= 15;
  }

  if (!params.hasSchemaOrg) {
    warnings.push("No Schema.org markup detected");
    score -= 5;
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  return {
    path: params.path,
    title: params.title,
    titleLength,
    titleOk,
    description: params.description,
    descriptionLength,
    descriptionOk,
    hasCanonical: !!params.canonical,
    hasOgTitle: !!params.ogTitle,
    hasOgDescription: !!params.ogDescription,
    hasOgImage: !!params.ogImage,
    hasTwitterCard: !!params.twitterCard,
    hasHreflang: (params.hreflangCount ?? 0) > 0,
    hasJsonLd: (params.jsonLdCount ?? 0) > 0,
    hasSchemaOrg: params.hasSchemaOrg ?? false,
    score,
    issues,
    warnings,
  };
}

/**
 * Run SEO audit on multiple pages and return a summary.
 */
export function auditSiteSeo(
  pages: Parameters<typeof auditPageSeo>[0][],
): {
  averageScore: number;
  pages: SeoAuditEntry[];
  criticalIssues: string[];
  commonWarnings: { warning: string; count: number }[];
} {
  const results = pages.map((p) => auditPageSeo(p));
  const averageScore =
    results.reduce((acc, r) => acc + r.score, 0) / (results.length || 1);

  const allIssues = results.flatMap((r) => r.issues);
  const allWarnings = results.flatMap((r) => r.warnings);

  // Deduplicate common warnings
  const warningCounts = new Map<string, number>();
  for (const w of allWarnings) {
    warningCounts.set(w, (warningCounts.get(w) ?? 0) + 1);
  }

  const commonWarnings = Array.from(warningCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([warning, count]) => ({ warning, count }));

  // Critical issues (score < 50)
  const criticalIssues = results
    .filter((r) => r.score < 50)
    .map((r) => `${r.path}: score ${r.score} — ${r.issues.join("; ")}`);

  return {
    averageScore: Math.round(averageScore * 100) / 100,
    pages: results,
    criticalIssues,
    commonWarnings,
  };
}

// ---------------------------------------------------------------------------
// Quick Default SEO (for _app.tsx / layout)
// ---------------------------------------------------------------------------

/**
 * Default SEO configuration for the entire site.
 * Use in `_app.tsx` with `<DefaultSeo />` from next-seo.
 */
export function getDefaultSeoConfig(locale: LocaleCode = "ro") {
  const description =
    locale === "ro" ? BRAND.description : BRAND.descriptionEn;
  const localeWithRegion = toLocaleWithRegion(locale);

  return {
    title: BRAND.name,
    titleTemplate: `%s${TITLE_SEPARATOR}${BRAND.name}`,
    defaultTitle: BRAND.name,
    description,
    canonical: APP_URL,
    language: locale,
    openGraph: {
      type: "website" as const,
      title: BRAND.name,
      description,
      url: APP_URL,
      siteName: BRAND.name,
      locale: localeWithRegion,
      images: [
        {
          url: BRAND.logoWide,
          width: META_LIMITS.OG_IMAGE_WIDTH,
          height: META_LIMITS.OG_IMAGE_HEIGHT,
          alt: BRAND.name,
          type: "image/png",
        },
      ],
    },
    twitter: {
      handle: "@nexusdevstudio",
      site: "@nexusdevstudio",
      cardType: "summary_large_image" as const,
    },
    additionalMetaTags: [
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#0f172a" },
      { name: "msapplication-TileColor", content: "#0f172a" },
      { name: "format-detection", content: "telephone=no" },
    ],
    additionalLinkTags: [
      { rel: "icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/manifest.json" },
    ],
  };
}

// ---------------------------------------------------------------------------
// Structured Data Testing Helpers
// ---------------------------------------------------------------------------

/**
 * Validate that a JSON-LD object has the minimal required fields for Google.
 *
 * Returns a list of missing required fields (empty = valid).
 */
export function validateJsonLdRequired(
  schema: Record<string, unknown>,
  requiredFields: string[],
): string[] {
  return requiredFields.filter((field) => {
    const value = schema[field];
    return value === undefined || value === null || value === "";
  });
}

/**
 * Generate a Google Rich Results Test URL for a given page.
 */
export function getRichResultsTestUrl(pageUrl: string): string {
  return `https://search.google.com/test/rich-results?url=${encodeURIComponent(pageUrl)}`;
}

/**
 * Generate a Schema.org Validator URL for a given page.
 */
export function getSchemaValidatorUrl(pageUrl: string): string {
  return `https://validator.schema.org/#url=${encodeURIComponent(pageUrl)}`;
}

// ---------------------------------------------------------------------------
// Utility: Date Helpers for Schema.org
// ---------------------------------------------------------------------------

/**
 * Format a Date as ISO 8601 for schema.org (e.g. "2024-03-15T10:30:00+02:00").
 */
export function toIso8601(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString();
}

/**
 * Format a date-only string for schema.org (e.g. "2024-03-15").
 */
export function toDateOnly(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Default Export
// ---------------------------------------------------------------------------

const seo = {
  // Constants
  BRAND,
  META_LIMITS,
  CHANGEFREQ,
  ROBOTS_DIRECTIVES,

  // Core builders
  buildPageSeo,
  buildCanonicalUrl,
  buildTitle,
  buildKeywords,
  buildOpenGraph,
  buildTwitterCard,
  buildAlternates,
  truncateDescription,

  // JSON-LD builders
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  buildBreadcrumbListJsonLd,
  buildArticleJsonLd,
  buildProductJsonLd,
  buildFaqJsonLd,
  buildHowToJsonLd,
  buildEventJsonLd,
  buildPersonJsonLd,
  buildVideoJsonLd,
  buildReviewJsonLd,
  buildAggregateRatingJsonLd,

  // JSON-LD utilities
  sanitizeJsonLd,
  stringifyJsonLd,
  validateJsonLdRequired,

  // Sitemap
  buildSitemapUrl,
  buildSitemapXml,
  buildSitemapIndexXml,

  // Robots.txt
  buildRobotsTxt,

  // Audit
  auditPageSeo,
  auditSiteSeo,

  // Defaults
  getDefaultSeoConfig,

  // Validators
  getRichResultsTestUrl,
  getSchemaValidatorUrl,

  // Date helpers
  toIso8601,
  toDateOnly,

  // XML escape
  escapeXml,

  // Locale
  toLocaleWithRegion,
  toLocaleCode,
} as const;

export default seo;
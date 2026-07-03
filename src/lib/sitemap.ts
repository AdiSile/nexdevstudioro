/**
 * Dynamic Sitemap.xml Generator per Tenant
 *
 * Generează sitemap-uri XML dinamice, per tenant, cu suport pentru
 * prioritizare (priority) și frecvență de reîmprospătare (changefreq).
 *
 * Specificație: https://www.sitemaps.org/protocol.html
 */

// ---------------------------------------------------------------------------
// Tipuri și interfețe
// ---------------------------------------------------------------------------

/** Frecvența estimată de modificare a unei pagini (conform standardului sitemaps.org). */
export type ChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

/** O singură intrare din sitemap. */
export interface SitemapEntry {
  /** URL-ul absolut (ex: https://tenant.example.com/pagina). */
  loc: string;

  /** Data ultimei modificări în format ISO-8601 (YYYY-MM-DD). */
  lastmod?: string;

  /** Frecvența de modificare. */
  changefreq?: ChangeFrequency;

  /** Prioritatea relativă în cadrul sitului: 0.0 (cea mai mică) – 1.0 (cea mai mare). */
  priority?: number;
}

/** Configurația statică + dinamică per tenant. */
export interface TenantSitemapConfig {
  /** Identificatorul unic al tenant-ului (ex: slug, subdomeniu). */
  tenantId: string;

  /** Domeniul de bază al tenant-ului (ex: https://magazinul-meu.ro). */
  baseUrl: string;

  /** Lista de intrări statice (pagini standard). */
  staticEntries: SitemapEntry[];

  /**
   * Funcție asincronă care returnează intrări dinamice (ex: produse, articole).
   * Permite query-uri la baza de date sau API-uri externe.
   */
  dynamicResolver?: () => Promise<SitemapEntry[]> | SitemapEntry[];
}

// ---------------------------------------------------------------------------
// Generator XML
// ---------------------------------------------------------------------------

/** Escape characters speciale XML. */
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Construiește un singur nod <url> XML. */
function buildUrlNode(entry: SitemapEntry): string {
  const lines: string[] = ["  <url>"];
  lines.push(`    <loc>${xmlEscape(entry.loc)}</loc>`);

  if (entry.lastmod) {
    lines.push(`    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>`);
  }

  if (entry.changefreq) {
    lines.push(`    <changefreq>${xmlEscape(entry.changefreq)}</changefreq>`);
  }

  if (entry.priority !== undefined && entry.priority !== null) {
    // Asigură-te că prioritatea e între 0.0 și 1.0, cu o singură zecimală
    const clamped = Math.min(1.0, Math.max(0.0, entry.priority));
    const priority = clamped % 1 === 0 ? clamped.toFixed(1) : clamped.toString();
    lines.push(`    <priority>${priority}</priority>`);
  }

  lines.push("  </url>");
  return lines.join("\n");
}

/**
 * Generează întregul document XML sitemap pentru un tenant.
 *
 * @param config  Configurația tenant-ului (intrări statice + resolver dinamic).
 * @param options Opțiuni suplimentare (ex: includeEmptyLine).
 * @returns       String-ul XML complet.
 */
export async function generateSitemap(
  config: TenantSitemapConfig,
  options?: { sortByPriority?: boolean }
): Promise<string> {
  // Colectează intrările statice
  let entries: SitemapEntry[] = [...config.staticEntries];

  // Rezolvă intrările dinamice, dacă există
  if (config.dynamicResolver) {
    const dynamic = await Promise.resolve(config.dynamicResolver());
    entries = entries.concat(dynamic);
  }

  // Sortare după prioritate descrescătoare (opțional)
  if (options?.sortByPriority) {
    entries = entries.sort(
      (a, b) => (b.priority ?? 0.5) - (a.priority ?? 0.5)
    );
  }

  const urlNodes = entries.map(buildUrlNode).join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    urlNodes,
    "</urlset>",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Validare
// ---------------------------------------------------------------------------

/** Validează o intrare și returnează o listă de erori (goală = valid). */
export function validateEntry(entry: SitemapEntry): string[] {
  const errors: string[] = [];

  if (!entry.loc || typeof entry.loc !== "string") {
    errors.push("Câmpul 'loc' este obligatoriu.");
  } else {
    try {
      new URL(entry.loc);
    } catch {
      errors.push(`'loc' nu este un URL valid: ${entry.loc}`);
    }
  }

  if (entry.priority !== undefined && entry.priority !== null) {
    if (entry.priority < 0.0 || entry.priority > 1.0) {
      errors.push(`Prioritatea trebuie să fie între 0.0 și 1.0, primit: ${entry.priority}`);
    }
  }

  if (entry.lastmod) {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}([+-]\d{2}:\d{2}|Z)?)?$/;
    if (!isoDateRegex.test(entry.lastmod)) {
      errors.push(`'lastmod' trebuie să fie în format ISO-8601 (ex: 2025-01-15), primit: ${entry.lastmod}`);
    }
  }

  const allowedFreqs: ChangeFrequency[] = [
    "always", "hourly", "daily", "weekly", "monthly", "yearly", "never",
  ];
  if (entry.changefreq && !allowedFreqs.includes(entry.changefreq)) {
    errors.push(
      `'changefreq' invalid: "${entry.changefreq}". Valori permise: ${allowedFreqs.join(", ")}.`
    );
  }

  return errors;
}

/** Validează toate intrările unui config și returnează erorile. */
export function validateTenantConfig(config: TenantSitemapConfig): string[] {
  const errors: string[] = [];

  if (!config.tenantId) {
    errors.push("'tenantId' este obligatoriu.");
  }

  if (!config.baseUrl) {
    errors.push("'baseUrl' este obligatoriu.");
  } else {
    try {
      new URL(config.baseUrl);
    } catch {
      errors.push(`'baseUrl' nu este un URL valid: ${config.baseUrl}`);
    }
  }

  for (let i = 0; i < config.staticEntries.length; i++) {
    const entryErrors = validateEntry(config.staticEntries[i]);
    for (const e of entryErrors) {
      errors.push(`staticEntries[${i}]: ${e}`);
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Utilitare ajutătoare
// ---------------------------------------------------------------------------

/**
 * Creează o intrare rapidă (cu valori implicite pentru changefreq și priority).
 */
export function createEntry(
  loc: string,
  opts?: {
    lastmod?: string;
    changefreq?: ChangeFrequency;
    priority?: number;
  }
): SitemapEntry {
  return {
    loc,
    lastmod: opts?.lastmod,
    changefreq: opts?.changefreq ?? "weekly",
    priority: opts?.priority ?? 0.5,
  };
}

/**
 * Pagini standard recomandate pentru orice tenant.
 * Poți pasa `baseUrl`-ul tenant-ului.
 */
export function standardPages(baseUrl: string): SitemapEntry[] {
  const stripTrailingSlash = (url: string) => url.replace(/\/$/, "");

  const base = stripTrailingSlash(baseUrl);

  return [
    { loc: `${base}/`, changefreq: "daily", priority: 1.0 },
    { loc: `${base}/contact`, changefreq: "monthly", priority: 0.6 },
    { loc: `${base}/despre`, changefreq: "monthly", priority: 0.5 },
    { loc: `${base}/termeni-si-conditii`, changefreq: "yearly", priority: 0.3 },
    { loc: `${base}/politica-de-confidentialitate`, changefreq: "yearly", priority: 0.3 },
  ];
}

/**
 * Aplică o prioritate minimă / maximă pe toate intrările, utilă pentru
 * normalizare înainte de generare.
 */
export function clampPriorities(entries: SitemapEntry[]): SitemapEntry[] {
  return entries.map((e) => ({
    ...e,
    priority:
      e.priority !== undefined
        ? Math.min(1.0, Math.max(0.0, e.priority))
        : undefined,
  }));
}
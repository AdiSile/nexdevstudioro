import type { Robots } from "next";

/**
 * Generare dinamică a fișierului robots.txt conform Next.js App Router.
 *
 * Indică motoarelor de căutare ce pagini pot fi indexate și localizarea
 * sitemap-ului.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/robots
 */
export default function robots(): Robots {
  // ------------------------------------------------------------------
  // URL-ul de bază – preferabil din variabila de mediu NEXT_PUBLIC_SITE_URL
  // ------------------------------------------------------------------
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Pagini care NU ar trebui indexate:
        disallow: ["/api/", "/admin/", "/auth/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
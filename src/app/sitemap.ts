import { MetadataRoute } from "next";
import { standardPages } from "@/lib/sitemap";

/**
 * Sitemap dinamic conform Next.js App Router.
 *
 * Returnează o listă de URL-uri care vor fi incluse în sitemap.xml generat automat.
 * Pentru pagini dinamice (ex. blog, produse) se poate folosi fetch la baza de date
 * sau API-uri interne.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // ------------------------------------------------------------------
  // URL-ul de bază – preferabil din variabila de mediu NEXT_PUBLIC_SITE_URL
  // ------------------------------------------------------------------
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  // ------------------------------------------------------------------
  // 1. Pagini statice (reutilizate din biblioteca partajată)
  // ------------------------------------------------------------------
  const staticEntries = standardPages(baseUrl).map((entry) => ({
    url: entry.loc,
    lastModified: entry.lastmod ? new Date(entry.lastmod) : new Date(),
    changeFrequency: entry.changefreq,
    priority: entry.priority,
  })) satisfies MetadataRoute.Sitemap;

  // ------------------------------------------------------------------
  // 2. Pagini dinamice (exemplu: articole blog)
  //
  //    const posts = await fetchBlogPosts();
  //    const dynamic = posts.map(post => ({ ... }));
  // ------------------------------------------------------------------

  // Placeholder – înlocuiește cu logica reală de interogare
  const dynamicEntries: MetadataRoute.Sitemap = [
    // {
    //   url: `${baseUrl}/blog/post-slug`,
    //   lastModified: new Date(),
    //   changeFrequency: "weekly" as const,
    //   priority: 0.8,
    // },
  ];

  // ------------------------------------------------------------------
  // 3. Lista finală
  // ------------------------------------------------------------------
  return [...staticEntries, ...dynamicEntries];
}
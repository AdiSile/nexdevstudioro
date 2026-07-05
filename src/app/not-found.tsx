/**
 * NexusDevStudio — Pagina 404
 * Pagină personalizată pentru rute inexistente. Glassmorphism purple/gold.
 * Include căutare, sugestii de navigare și animații subtile.
 */
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 — Pagina nu a fost găsită | NexusDevStudio",
  description:
    "Ne pare rău, dar pagina pe care o cauți nu există sau a fost mutată.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFound() {
  return (
    <>
      {/* Inline CSS for entrance animations */}
      <style jsx>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes pulseGlow {
          0%,
          100% {
            filter: drop-shadow(0 0 8px rgba(168, 85, 247, 0.3));
          }
          50% {
            filter: drop-shadow(0 0 20px rgba(251, 191, 36, 0.5));
          }
        }
        @keyframes subtleFloat {
          0%,
          100% {
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            transform: translate(-50%, -52%) scale(1.03);
          }
        }
        .animate-404-glow {
          animation: pulseGlow 3s ease-in-out infinite;
        }
        .animate-card-entrance {
          animation: fadeInUp 0.7s cubic-bezier(0.22, 0.61, 0.36, 1) both;
        }
        .animate-float-center {
          animation: subtleFloat 8s ease-in-out infinite;
        }
      `}</style>

      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 text-center">
        {/* Background decorative elements */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        >
          <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-brand-500/5 blur-[120px] dark:bg-brand-400/8" />
          <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-amber-400/5 blur-[100px] dark:bg-amber-300/6" />
          <div className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-400/3 blur-[150px] dark:bg-accent-300/4 animate-float-center" />
        </div>

        {/* Glass card */}
        <div
          className={cn(
            "relative max-w-lg rounded-2xl border border-white/20 bg-white/40 p-8 shadow-2xl backdrop-blur-xl",
            "dark:border-neutral-700/30 dark:bg-neutral-900/50",
            "transition-all duration-300",
            "animate-card-entrance",
          )}
        >
          {/* 404 Number with subtle glow animation */}
          <h1
            className="bg-gradient-to-r from-brand-600 to-amber-500 bg-clip-text text-9xl font-extrabold text-transparent dark:from-brand-400 dark:to-amber-400 animate-404-glow"
            aria-hidden="true"
          >
            404
          </h1>

          {/* Message */}
          <h2 className="mt-4 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Pagina nu a fost găsită
          </h2>
          <p className="mt-3 text-neutral-600 dark:text-neutral-400">
            Ne pare rău, dar pagina pe care o cauți nu există sau a fost mutată.
          </p>

          {/* Search bar */}
          <form
            action="/search"
            method="get"
            className="mt-6 flex items-center gap-2"
          >
            <label htmlFor="search-404" className="sr-only">
              Caută pe site
            </label>
            <input
              id="search-404"
              name="q"
              type="search"
              placeholder="Caută pe site..."
              className={cn(
                "flex-1 rounded-full border border-white/30 bg-white/50 px-4 py-2 text-sm text-neutral-900 placeholder-neutral-400 backdrop-blur-sm transition-all duration-200 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-400/30",
                "dark:border-neutral-700/50 dark:bg-neutral-800/50 dark:text-neutral-100 dark:placeholder-neutral-500 dark:focus:border-brand-500 dark:focus:ring-brand-500/30",
              )}
            />
            <button
              type="submit"
              className={cn(
                "rounded-full bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:from-brand-700 hover:to-brand-600 hover:shadow-lg",
                "dark:from-brand-500 dark:to-brand-400 dark:text-neutral-900 dark:hover:from-brand-400 dark:hover:to-brand-300",
              )}
            >
              Caută
            </button>
          </form>

          {/* Suggested links */}
          <div className="mt-6 border-t border-white/20 pt-5 dark:border-neutral-700/30">
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-500 dark:text-neutral-500">
              Poți încerca și:
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-4 text-sm">
              <Link
                href="/"
                className="text-neutral-600 underline decoration-transparent underline-offset-4 transition-all hover:text-brand-600 hover:decoration-brand-400 dark:text-neutral-400 dark:hover:text-brand-400"
              >
                Acasă
              </Link>
              <Link
                href="/projects"
                className="text-neutral-600 underline decoration-transparent underline-offset-4 transition-all hover:text-brand-600 hover:decoration-brand-400 dark:text-neutral-400 dark:hover:text-brand-400"
              >
                Proiecte
              </Link>
              <Link
                href="/about"
                className="text-neutral-600 underline decoration-transparent underline-offset-4 transition-all hover:text-brand-600 hover:decoration-brand-400 dark:text-neutral-400 dark:hover:text-brand-400"
              >
                Despre
              </Link>
              <Link
                href="/contact"
                className="text-neutral-600 underline decoration-transparent underline-offset-4 transition-all hover:text-brand-600 hover:decoration-brand-400 dark:text-neutral-400 dark:hover:text-brand-400"
              >
                Contact
              </Link>
            </div>
          </div>

          {/* Back to home button */}
          <Link
            href="/"
            className={cn(
              "mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-3 font-semibold text-white shadow-lg transition-all duration-300 hover:from-brand-700 hover:to-brand-600 hover:shadow-xl hover:scale-105",
              "dark:from-brand-500 dark:to-brand-400 dark:text-neutral-900 dark:hover:from-brand-400 dark:hover:to-brand-300",
            )}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-3 0v-6m0 0V6.5M9 21v-6m0 0a1.5 1.5 0 113 0v6H9z"
              />
            </svg>
            Înapoi la pagina principală
          </Link>
        </div>
      </div>
    </>
  );
}
/**
 * NexusDevStudio — Pagina 404
 * Pagină personalizată pentru rute inexistente. Glassmorphism purple/gold.
 */
import Link from "next/link";
import { cn } from "@/lib/cn";

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 text-center">
      {/* Background decorative elements */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-40 -right-40 h-[600px] w-[600px] rounded-full bg-brand-500/5 blur-[120px] dark:bg-brand-400/8" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-amber-400/5 blur-[100px] dark:bg-amber-300/6" />
        <div className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-400/3 blur-[150px] dark:bg-accent-300/4" />
      </div>

      {/* Glass card */}
      <div
        className={cn(
          "relative max-w-lg rounded-2xl border border-white/20 bg-white/40 p-8 shadow-2xl backdrop-blur-xl",
          "dark:border-neutral-700/30 dark:bg-neutral-900/50",
          "transition-all duration-300",
        )}
      >
        {/* 404 Number */}
        <h1
          className="bg-gradient-to-r from-brand-600 to-amber-500 bg-clip-text text-9xl font-extrabold text-transparent dark:from-brand-400 dark:to-amber-400"
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
  );
}
/**
 * NexusDevStudio — Root Layout
 * Glassmorphism purple/gold design, providers, global styles.
 */
import type { Metadata, Viewport } from "next";
import { cn } from "@/lib/cn";
import "./globals.css";

// ═══════════════════════════════════════════════════════════════════════
// Metadata & Viewport
// ═══════════════════════════════════════════════════════════════════════

export const metadata: Metadata = {
  title: {
    default: "NexusDevStudio — Agenție Digitală Enterprise",
    template: "%s | NexusDevStudio",
  },
  description:
    "NexusDevStudio — Soluții digitale complete: aplicații web, mobile, AI, eCommerce, automatizări. Design imersiv, tehnologie de vârf, rezultate măsurabile.",
  keywords: [
    "dezvoltare web",
    "aplicații mobile",
    "AI",
    "eCommerce",
    "automatizări",
    "design UX/UI",
    "Next.js",
    "React",
    "NexusDevStudio",
  ],
  authors: [{ name: "NexusDevStudio", url: "https://nexusdevstudio.ro" }],
  creator: "NexusDevStudio",
  publisher: "NexusDevStudio",
  metadataBase: new URL("https://nexusdevstudio.ro"),
  openGraph: {
    type: "website",
    locale: "ro_RO",
    url: "https://nexusdevstudio.ro",
    siteName: "NexusDevStudio",
    title: "NexusDevStudio — Agenție Digitală Enterprise",
    description:
      "Soluții digitale complete: aplicații web, mobile, AI, eCommerce, automatizări.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "NexusDevStudio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NexusDevStudio — Agenție Digitală Enterprise",
    description:
      "Soluții digitale complete: aplicații web, mobile, AI, eCommerce, automatizări.",
    images: ["/og-image.jpg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0b10" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

// ═══════════════════════════════════════════════════════════════════════
// Root Layout
// ═══════════════════════════════════════════════════════════════════════

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ro"
      suppressHydrationWarning
      className="scroll-smooth antialiased"
    >
      <head>
        {/* Preconnect to critical origins */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Inter + JetBrains Mono fonts */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
        {/* Inline theme script to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('nexus-theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (theme === 'dark' || (!theme && prefersDark)) {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={cn(
          "min-h-screen font-sans text-text-primary",
          // Glassmorphism background: subtle gradient with purple/gold tones
          "bg-gradient-to-br from-neutral-50 via-white to-brand-50/30",
          "dark:bg-gradient-to-br dark:from-neutral-950 dark:via-neutral-900 dark:to-brand-950/30",
          "transition-colors duration-300",
        )}
      >
        {/* Global background decorative elements */}
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none overflow-hidden -z-10"
        >
          {/* Top-right purple glow */}
          <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-brand-500/5 blur-[120px] dark:bg-brand-400/8" />
          {/* Bottom-left gold/amber glow */}
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-amber-400/5 blur-[100px] dark:bg-amber-300/6" />
          {/* Center accent glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-accent-400/3 blur-[150px] dark:bg-accent-300/4" />
        </div>

        {/* Main content */}
        {children}

        {/* Optional: global toast container (Sonner) would go here */}
      </body>
    </html>
  );
}
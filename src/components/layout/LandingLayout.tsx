import React, { type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Menu, X, ChevronDown, Sun, Moon, Globe, ArrowRight, Github, Twitter, Linkedin } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | false | null)[]) {
  return twMerge(clsx(inputs));
}

/* ----------------------------------------------------------------
 * Tipuri
 * ---------------------------------------------------------------- */

export interface LandingLayoutProps {
  children: ReactNode;
  /** Titlul paginii (pentru aria-label sau SEO) */
  pageTitle?: string;
  /** Descrierea paginii */
  pageDescription?: string;
}

export interface NavLink {
  label: string;
  href: string;
  children?: NavLink[];
  external?: boolean;
  highlight?: boolean;
}

/* ----------------------------------------------------------------
 * Configurație navigare (exemplu – poate fi suprascrisă prin props)
 * ---------------------------------------------------------------- */

const defaultNavLinks: NavLink[] = [
  { label: 'Acasă', href: '/' },
  {
    label: 'Servicii',
    href: '#',
    children: [
      { label: 'Dezvoltare Web', href: '/servicii/dezvoltare-web' },
      { label: 'Aplicații Mobile', href: '/servicii/aplicatii-mobile' },
      { label: 'Automatizări AI', href: '/servicii/ai-automatizari' },
      { label: 'Consultantață', href: '/servicii/consultanta' },
    ],
  },
  { label: 'Portofoliu', href: '/portofoliu' },
  { label: 'Despre Noi', href: '/despre' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contact', href: '/contact', highlight: true },
];

/* ----------------------------------------------------------------
 * Componente secundare
 * ---------------------------------------------------------------- */

const Logo = () => (
  <Link
    href="/"
    className="flex items-center gap-2 text-xl font-bold text-white transition-colors hover:text-primary-300"
    aria-label="NexusDevStudio – Acasă"
  >
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 shadow-lg shadow-primary-500/20">
      <span className="text-lg font-black">N</span>
    </div>
    <span className="hidden sm:inline-block">NexusDevStudio</span>
  </Link>
);

const DesktopNav = ({ links, className }: { links: NavLink[]; className?: string }) => {
  const router = useRouter();
  const [openDropdown, setOpenDropdown] = React.useState<string | null>(null);

  return (
    <nav className={cn('flex items-center gap-1', className)} aria-label="Navigare principală">
      {links.map((link) => {
        const isActive = router.pathname === link.href;
        const hasChildren = link.children && link.children.length > 0;

        if (link.external) {
          return (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                'text-slate-300 hover:text-white hover:bg-white/10',
                link.highlight && 'bg-primary-600 text-white hover:bg-primary-500',
              )}
            >
              {link.label}
            </a>
          );
        }

        if (hasChildren) {
          return (
            <div
              key={link.label}
              className="relative"
              onMouseEnter={() => setOpenDropdown(link.label)}
              onMouseLeave={() => setOpenDropdown(null)}
            >
              <button
                className={cn(
                  'flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  'text-slate-300 hover:text-white hover:bg-white/10',
                  openDropdown === link.label && 'text-white bg-white/10',
                )}
                aria-expanded={openDropdown === link.label}
                aria-haspopup="true"
              >
                {link.label}
                <ChevronDown className={cn('h-4 w-4 transition-transform', openDropdown === link.label && 'rotate-180')} />
              </button>
              {openDropdown === link.label && (
                <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-xl border border-white/10 bg-slate-800 p-2 shadow-2xl backdrop-blur-xl">
                  {link.children!.map((child) => (
                    <Link
                      key={child.label}
                      href={child.href}
                      className={cn(
                        'block rounded-lg px-4 py-2 text-sm text-slate-300 transition-colors hover:text-white hover:bg-white/10',
                      )}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        }

        return (
          <Link
            key={link.label}
            href={link.href}
            className={cn(
              'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'text-white bg-white/10' : 'text-slate-300 hover:text-white hover:bg-white/10',
              link.highlight && 'bg-primary-600 text-white hover:bg-primary-500',
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
};

const MobileNav = ({ links }: { links: NavLink[] }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());
  const router = useRouter();

  const toggleGroup = (label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <div className="md:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="rounded-lg p-2 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
        aria-label={isOpen ? 'Închide meniul' : 'Deschide meniul'}
        aria-expanded={isOpen}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      {isOpen && (
        <div className="fixed inset-x-0 top-[72px] z-40 max-h-[calc(100vh-72px)] overflow-y-auto border-b border-white/10 bg-slate-900/95 backdrop-blur-xl animate-in slide-in-from-top-2 duration-300">
          <nav className="flex flex-col gap-1 p-4">
            {links.map((link) => {
              const isActive = router.pathname === link.href;
              const hasChildren = link.children && link.children.length > 0;

              if (hasChildren) {
                const isExpanded = expandedGroups.has(link.label);
                return (
                  <div key={link.label}>
                    <button
                      onClick={() => toggleGroup(link.label)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                        'text-slate-300 hover:bg-white/10 hover:text-white',
                      )}
                      aria-expanded={isExpanded}
                    >
                      {link.label}
                      <ChevronDown className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')} />
                    </button>
                    {isExpanded && (
                      <div className="ml-4 border-l border-white/10 pl-4">
                        {link.children!.map((child) => (
                          <Link
                            key={child.label}
                            href={child.href}
                            className={cn(
                              'block rounded-lg px-4 py-2 text-sm text-slate-400 transition-colors hover:text-white hover:bg-white/10',
                              router.pathname === child.href && 'text-white bg-white/10',
                            )}
                            onClick={() => setIsOpen(false)}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    'rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                    'text-slate-300 hover:bg-white/10 hover:text-white',
                    link.highlight && 'bg-primary-600 text-white hover:bg-primary-500',
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className={cn(
                    'rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                    isActive ? 'text-white bg-white/10' : 'text-slate-300 hover:bg-white/10 hover:text-white',
                    link.highlight && 'bg-primary-600 text-white hover:bg-primary-500',
                  )}
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
};

const LandingFooter = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 bg-slate-900/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Coloană 1 - Despre */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">NexusDevStudio</h3>
            <p className="text-sm text-slate-400">
              Agenție full‑stack specializată în soluții digitale enterprise, AI și automatizări.
            </p>
            <div className="mt-4 flex gap-3">
              <a href="https://github.com/nexusdevstudio" target="_blank" rel="noopener noreferrer" className="text-slate-400 transition-colors hover:text-white" aria-label="GitHub">
                <Github className="h-5 w-5" />
              </a>
              <a href="https://twitter.com/nexusdevstudio" target="_blank" rel="noopener noreferrer" className="text-slate-400 transition-colors hover:text-white" aria-label="Twitter">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="https://linkedin.com/company/nexusdevstudio" target="_blank" rel="noopener noreferrer" className="text-slate-400 transition-colors hover:text-white" aria-label="LinkedIn">
                <Linkedin className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Coloană 2 - Servicii */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">Servicii</h3>
            <ul className="space-y-2">
              <li><Link href="/servicii/dezvoltare-web" className="text-sm text-slate-400 transition-colors hover:text-white">Dezvoltare Web</Link></li>
              <li><Link href="/servicii/aplicatii-mobile" className="text-sm text-slate-400 transition-colors hover:text-white">Aplicații Mobile</Link></li>
              <li><Link href="/servicii/ai-automatizari" className="text-sm text-slate-400 transition-colors hover:text-white">AI & Automatizări</Link></li>
              <li><Link href="/servicii/consultanta" className="text-sm text-slate-400 transition-colors hover:text-white">Consultanță</Link></li>
            </ul>
          </div>

          {/* Coloană 3 - Link‑uri rapide */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">Companie</h3>
            <ul className="space-y-2">
              <li><Link href="/despre" className="text-sm text-slate-400 transition-colors hover:text-white">Despre noi</Link></li>
              <li><Link href="/portofoliu" className="text-sm text-slate-400 transition-colors hover:text-white">Portofoliu</Link></li>
              <li><Link href="/blog" className="text-sm text-slate-400 transition-colors hover:text-white">Blog</Link></li>
              <li><Link href="/cariere" className="text-sm text-slate-400 transition-colors hover:text-white">Cariere</Link></li>
            </ul>
          </div>

          {/* Coloană 4 - Legal */}
          <div>
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-white">Legal</h3>
            <ul className="space-y-2">
              <li><Link href="/termeni-si-conditii" className="text-sm text-slate-400 transition-colors hover:text-white">Termeni și Condiții</Link></li>
              <li><Link href="/politica-de-confidentialitate" className="text-sm text-slate-400 transition-colors hover:text-white">Politica de Confidențialitate</Link></li>
              <li><Link href="/politica-cookies" className="text-sm text-slate-400 transition-colors hover:text-white">Politica Cookies</Link></li>
              <li><Link href="/gdpr" className="text-sm text-slate-400 transition-colors hover:text-white">GDPR</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-8 text-center text-sm text-slate-500">
          &copy; {currentYear} NexusDevStudio. Toate drepturile rezervate.
        </div>
      </div>
    </footer>
  );
};

/* ----------------------------------------------------------------
 * Layout principal
 * ---------------------------------------------------------------- */

export default function LandingLayout({
  children,
  pageTitle = 'NexusDevStudio – Soluții Digitale Enterprise',
  pageDescription = 'Agenție full‑stack specializată în dezvoltare web, aplicații mobile, AI și automatizări.',
}: LandingLayoutProps) {
  return (
    <>
      <head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>

      <div className="flex min-h-screen flex-col bg-slate-950 text-white">
        {/* Background decorativ (opțional) */}
        <div className="fixed inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary-600/10 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-accent-600/10 blur-[120px]" />
        </div>

        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/60 backdrop-blur-lg">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
            <Logo />
            <div className="flex items-center gap-4">
              <DesktopNav links={defaultNavLinks} className="hidden md:flex" />
              <MobileNav links={defaultNavLinks} />
            </div>
          </div>
        </header>

        {/* Conținut principal */}
        <main className="flex-1">
          {children}
        </main>

        {/* Footer */}
        <LandingFooter />
      </div>
    </>
  );
}
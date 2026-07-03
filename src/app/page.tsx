"use client";

/**
 * NexusDevStudio — Pagina Principală
 * Landing page imersivă cu secțiuni dinamice încărcate din API /api/settings.
 * Fallback la date hardcodate dacă API-ul nu răspunde.
 */

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Globe,
  ShoppingCart,
  Smartphone,
  Palette,
  Search,
  Bot,
  Brain,
  Cloud,
  Shield,
  BarChart3,
  FileText,
  Users,
  Layers,
  Zap,
  Database,
  Mail,
  MessageCircle,
  Video,
  GraduationCap,
  Calendar,
  Package,
  ChevronRight,
  ChevronDown,
  Star,
  Check,
  Clock,
  ArrowRight,
  Send,
  MapPin,
  Phone,
  MailIcon,
  Menu,
  X,
  Sun,
  Moon,
  MessageSquare,
  Compass,
  Code2,
  CheckCircle2,
  Rocket,
  Facebook,
  Instagram,
  Linkedin,
  Github,
  Youtube,
  ExternalLink,
  Sparkles,
  TrendingUp,
  Award,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/cn";

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

interface Service {
  id: string;
  icon: string;
  title: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  features: string[];
  popular?: boolean;
  timeline: string;
}

interface PortfolioItem {
  id: string;
  title: string;
  category: string;
  image: string;
  description: string;
  tags: string[];
}

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

interface TimelineItem {
  id: string;
  step: number;
  title: string;
  description: string;
  icon: string;
}

interface ContactInfo {
  email: string;
  phone: string;
  address: string;
  social: Record<string, string>;
}

interface SiteSettings {
  hero: {
    title: string;
    subtitle: string;
    ctaPrimary: string;
    ctaSecondary: string;
  };
  services: Service[];
  howWeWork: TimelineItem[];
  portfolio: PortfolioItem[];
  faq: FAQItem[];
  contact: ContactInfo;
  footer: {
    about: string;
    copyright: string;
    columns: { title: string; links: { label: string; href: string }[] }[];
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Hardcoded fallback (same as API default)
// ═══════════════════════════════════════════════════════════════════════

const FALLBACK_HERO = {
  title: "Transformăm Idei în Realitate Digitală",
  subtitle:
    "NexusDevStudio este partenerul tău de încredere pentru dezvoltare web, aplicații mobile, AI, eCommerce și automatizări. Livrăm soluții enterprise cu design imersiv și tehnologie de vârf.",
  ctaPrimary: "Începe Proiectul",
  ctaSecondary: "Vezi Serviciile",
};

const FALLBACK_FOOTER = {
  about:
    "NexusDevStudio este o agenție digitală enterprise care transformă idei în produse digitale de impact.",
  copyright: `© ${new Date().getFullYear()} NexusDevStudio. Toate drepturile rezervate.`,
  columns: [
    {
      title: "Servicii",
      links: [
        { label: "Website de Prezentare", href: "#servicii" },
        { label: "Magazin Online", href: "#servicii" },
        { label: "Aplicație Mobilă", href: "#servicii" },
        { label: "Design UX/UI", href: "#servicii" },
        { label: "AI & Automatizări", href: "#servicii" },
      ],
    },
    {
      title: "Companie",
      links: [
        { label: "Despre Noi", href: "#" },
        { label: "Portofoliu", href: "#portofoliu" },
        { label: "Blog", href: "#" },
        { label: "Cariere", href: "#" },
        { label: "Contact", href: "#contact" },
      ],
    },
    {
      title: "Legal",
      links: [
        { label: "Termeni și Condiții", href: "#" },
        { label: "Confidențialitate", href: "#" },
        { label: "Cookies", href: "#" },
        { label: "GDPR", href: "#" },
      ],
    },
  ],
};

const FALLBACK_CONTACT: ContactInfo = {
  email: "contact@nexusdevstudio.ro",
  phone: "+40 700 000 000",
  address: "București, România — Disponibil Remote",
  social: {
    facebook: "#",
    instagram: "#",
    linkedin: "#",
    github: "#",
  },
};

// ═══════════════════════════════════════════════════════════════════════
// Icon Map
// ═══════════════════════════════════════════════════════════════════════

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  Globe,
  ShoppingCart,
  Smartphone,
  Palette,
  Search,
  Bot,
  Brain,
  Cloud,
  Shield,
  BarChart3,
  FileText,
  Users,
  Layers,
  Zap,
  Database,
  Mail,
  MessageCircle,
  Video,
  GraduationCap,
  Calendar,
  Package,
  MessageSquare,
  Compass,
  Code2,
  CheckCircle2,
  Rocket,
};

function DynamicIcon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = ICON_MAP[name];
  return Icon ? <Icon className={className} /> : <Zap className={className} />;
}

// ═══════════════════════════════════════════════════════════════════════
// Sub-Components
// ═══════════════════════════════════════════════════════════════════════

/** Animated counter */
function AnimatedCounter({
  target,
  label,
  suffix = "+",
}: {
  target: number;
  label: string;
  suffix?: string;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (count >= target) return;
    const duration = 2000;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      setCount((prev) => {
        const next = prev + step;
        return next >= target ? target : next;
      });
    }, 16);
    return () => clearInterval(timer);
  }, [target, count]);

  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-bold text-brand-600 dark:text-brand-400">
        {count}
        {suffix}
      </div>
      <div className="text-sm text-text-tertiary mt-1">{label}</div>
    </div>
  );
}

/** FAQ Accordion Item */
function FAQCard({ item }: { item: FAQItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border-subtle rounded-xl overflow-hidden bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm transition-all hover:border-brand-200 dark:hover:border-brand-800">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="font-medium text-text-primary pr-4">
          {item.question}
        </span>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-text-tertiary shrink-0 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="px-5 pb-4 text-text-secondary text-sm leading-relaxed animate-slide-in-from-top">
          {item.answer}
        </div>
      )}
    </div>
  );
}

/** Service Card */
function ServiceCard({ service }: { service: Service }) {
  return (
    <div
      className={cn(
        "group relative rounded-2xl p-6 transition-all duration-300",
        "bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm",
        "border border-border-subtle hover:border-brand-300 dark:hover:border-brand-700",
        "hover:shadow-elevation-3 hover:-translate-y-1",
        service.popular &&
          "ring-2 ring-brand-500/50 dark:ring-brand-400/40",
      )}
    >
      {service.popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-500 text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Popular
        </div>
      )}

      <div className="flex items-start gap-4 mb-4">
        <div
          className={cn(
            "flex items-center justify-center w-12 h-12 rounded-xl shrink-0",
            "bg-brand-50 dark:bg-brand-900/30",
            "text-brand-600 dark:text-brand-400",
            "group-hover:bg-brand-100 dark:group-hover:bg-brand-900/50 transition-colors",
          )}
        >
          <DynamicIcon name={service.icon} className="h-6 w-6" />
        </div>
        <div>
          <h3 className="font-semibold text-text-primary text-lg leading-tight">
            {service.title}
          </h3>
          <p className="text-text-tertiary text-xs mt-0.5">
            {service.category}
          </p>
        </div>
      </div>

      <p className="text-text-secondary text-sm mb-4 leading-relaxed">
        {service.description}
      </p>

      <ul className="space-y-2 mb-5">
        {service.features.slice(0, 4).map((f, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-sm text-text-secondary"
          >
            <Check className="h-4 w-4 text-accent-500 shrink-0 mt-0.5" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-end justify-between pt-4 border-t border-border-subtle">
        <div>
          <span className="text-2xl font-bold text-text-primary">
            {service.price} €
          </span>
          {service.currency !== "EUR" && (
            <span className="text-sm text-text-tertiary ml-1">
              /{service.currency.replace("EUR/", "")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-text-tertiary">
          <Clock className="h-3 w-3" />
          {service.timeline}
        </div>
      </div>
    </div>
  );
}

/** Portfolio Card */
function PortfolioCard({ item }: { item: PortfolioItem }) {
  return (
    <div className="group relative rounded-2xl overflow-hidden bg-white/80 dark:bg-neutral-800/80 border border-border-subtle hover:shadow-elevation-3 transition-all duration-300 hover:-translate-y-1">
      {/* Placeholder image */}
      <div className="aspect-video bg-gradient-to-br from-brand-100 to-accent-100 dark:from-brand-900 dark:to-accent-900 flex items-center justify-center">
        <span className="text-4xl font-black text-brand-300/60 dark:text-brand-600/40">
          {item.title.charAt(0)}
        </span>
      </div>
      <div className="p-5">
        <div className="text-xs font-medium text-brand-600 dark:text-brand-400 mb-1">
          {item.category}
        </div>
        <h3 className="font-semibold text-text-primary mb-2">{item.title}</h3>
        <p className="text-sm text-text-secondary mb-3 line-clamp-2">
          {item.description}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Timeline Step */
function TimelineStep({
  item,
  index,
}: {
  item: TimelineItem;
  index: number;
}) {
  return (
    <div className="flex gap-4 md:gap-6">
      {/* Number */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={cn(
            "flex items-center justify-center w-12 h-12 rounded-xl font-bold text-lg",
            "bg-brand-500 text-white shadow-glow-primary",
          )}
        >
          {item.step}
        </div>
        {index < 5 && (
          <div className="w-0.5 flex-1 bg-gradient-to-b from-brand-500 to-transparent mt-2" />
        )}
      </div>
      {/* Content */}
      <div className="pb-10">
        <div className="flex items-center gap-2 mb-1">
          <DynamicIcon name={item.icon} className="h-4 w-4 text-brand-500" />
          <h3 className="font-semibold text-text-primary">{item.title}</h3>
        </div>
        <p className="text-text-secondary text-sm leading-relaxed">
          {item.description}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════════════════════════════════════

export default function HomePage() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("Toate");
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    message: "",
  });
  const [formSent, setFormSent] = useState(false);

  // Load settings from API
  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            setSettings(json.data);
            setLoading(false);
            return;
          }
        }
        throw new Error("API unavailable");
      } catch {
        // Fallback: use embedded data
        setSettings({
          hero: FALLBACK_HERO,
          services: [],
          howWeWork: [],
          portfolio: [],
          faq: [],
          contact: FALLBACK_CONTACT,
          footer: FALLBACK_FOOTER,
        });
        setLoading(false);
      }
    }
    loadSettings();
  }, []);

  // Theme detection
  useEffect(() => {
    const stored = localStorage.getItem("nexus-theme");
    if (stored === "dark") setDark(true);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    if (!stored && mq.matches) setDark(true);
  }, []);

  const toggleDark = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      localStorage.setItem("nexus-theme", next ? "dark" : "light");
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  }, []);

  // Extract data with fallback
  const hero = settings?.hero || FALLBACK_HERO;
  const services: Service[] = settings?.services || [];
  const howWeWork: TimelineItem[] = settings?.howWeWork || [];
  const portfolio: PortfolioItem[] = settings?.portfolio || [];
  const faq: FAQItem[] = settings?.faq || [];
  const contact: ContactInfo = settings?.contact || FALLBACK_CONTACT;
  const footer = settings?.footer || FALLBACK_FOOTER;

  // Categories
  const categories = useMemo(() => {
    const cats = new Set(services.map((s) => s.category));
    return ["Toate", ...Array.from(cats)];
  }, [services]);

  const filteredServices = useMemo(
    () =>
      activeCategory === "Toate"
        ? services
        : services.filter((s) => s.category === activeCategory),
    [services, activeCategory],
  );

  // Contact form
  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormSent(true);
    setTimeout(() => setFormSent(false), 4000);
  };

  // ═══════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════

  return (
    <div className="min-h-screen">
      {/* ── Navigation ──────────────────────────────────────── */}
      <header className="sticky top-0 z-sticky bg-white/80 dark:bg-neutral-900/80 backdrop-blur-lg border-b border-border-subtle">
        <div className="container flex items-center justify-between h-header">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2 font-bold text-xl">
            <span className="text-brand-600 dark:text-brand-400">Nexus</span>
            <span className="text-text-primary">DevStudio</span>
          </a>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {[
              "Acasă",
              "Servicii",
              "Portofoliu",
              "FAQ",
              "Contact",
            ].map((label) => (
              <a
                key={label}
                href={`#${label.toLowerCase()}`}
                className="px-3 py-2 rounded-md text-sm text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
              >
                {label}
              </a>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleDark}
              className="p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
              aria-label="Toggle theme"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <a
              href="#contact"
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
            >
              Contact
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-md"
              aria-label="Menu"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border-subtle bg-white dark:bg-neutral-900 animate-slide-in-from-top">
            <nav className="container py-3 flex flex-col gap-1">
              {["Acasă", "Servicii", "Portofoliu", "FAQ", "Contact"].map(
                (label) => (
                  <a
                    key={label}
                    href={`#${label.toLowerCase()}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-3 py-2 rounded-md text-text-secondary hover:bg-surface-secondary transition-colors"
                  >
                    {label}
                  </a>
                ),
              )}
            </nav>
          </div>
        )}
      </header>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-20 md:py-32">
        {/* Background decorations */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-brand-500/10 blur-3xl dark:bg-brand-400/8" />
          <div className="absolute bottom-20 right-10 w-96 h-96 rounded-full bg-accent-400/10 blur-3xl dark:bg-accent-300/6" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-brand-400/5 to-accent-400/5 blur-3xl" />
        </div>

        <div className="container relative">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 text-sm font-medium mb-6 animate-fade-in">
              <Sparkles className="h-4 w-4" />
              Agenție Digitală Enterprise
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-text-primary mb-6 animate-slide-in-from-bottom">
              {hero.title}
            </h1>

            <p className="text-lg md:text-xl text-text-secondary mb-10 max-w-2xl mx-auto leading-relaxed animate-slide-in-from-bottom">
              {hero.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-in-from-bottom">
              <a
                href="#contact"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 shadow-glow-primary transition-all hover:scale-105"
              >
                {hero.ctaPrimary}
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#servicii"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl border border-border-default text-text-primary font-semibold hover:bg-surface-secondary transition-all"
              >
                {hero.ctaSecondary}
                <ChevronDown className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto mt-16 pt-12 border-t border-border-subtle">
            <AnimatedCounter target={21} label="Servicii" />
            <AnimatedCounter target={150} label="Proiecte Finalizate" />
            <AnimatedCounter target={98} label="Clienți Fericiți" suffix="%" />
            <AnimatedCounter target={5} label="Ani Experiență" suffix="+" />
          </div>
        </div>
      </section>

      {/* ── SERVICII ────────────────────────────────────────── */}
      <section id="servicii" className="py-20 bg-surface-secondary/50 dark:bg-neutral-900/50">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
              Serviciile Noastre
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              Oferim o gamă completă de servicii digitale, de la website-uri și
              aplicații mobile până la AI și automatizări enterprise.
            </p>

            {/* Reducere banner */}
            <div className="inline-flex items-center gap-2 mt-4 px-5 py-2 rounded-full bg-accent-50 dark:bg-accent-900/20 text-accent-600 dark:text-accent-400 text-sm font-semibold">
              <Award className="h-4 w-4" />
              20% reducere la 2 servicii • 40% reducere la 3+ servicii
            </div>
          </div>

          {/* Category filter */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all",
                  activeCategory === cat
                    ? "bg-brand-500 text-white shadow-glow-primary"
                    : "bg-white dark:bg-neutral-800 text-text-secondary hover:bg-brand-50 dark:hover:bg-brand-900/20 border border-border-subtle",
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Services Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl p-6 border border-border-subtle animate-skeleton bg-neutral-100 dark:bg-neutral-800 h-80"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredServices.map((service) => (
                <ServiceCard key={service.id} service={service} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── CUM LUCRĂM ──────────────────────────────────────── */}
      <section id="cum-lucram" className="py-20">
        <div className="container">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
                Cum Lucrăm
              </h2>
              <p className="text-text-secondary mb-8">
                Procesul nostru este transparent, structurat și orientat spre
                rezultate. Fiecare proiect trece prin 6 etape bine definite.
              </p>
              <div className="space-y-0">
                {howWeWork.map((item, i) => (
                  <TimelineStep key={item.id} item={item} index={i} />
                ))}
              </div>
            </div>
            <div className="hidden lg:block sticky top-24">
              <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-brand-500 to-accent-500 p-8 text-white shadow-elevation-4">
                <h3 className="text-2xl font-bold mb-4">De ce NexusDevStudio?</h3>
                <ul className="space-y-4">
                  {[
                    { icon: TrendingUp, text: "Creștere medie de 340% a traficului" },
                    { icon: ShieldCheck, text: "Securitate enterprise-grade" },
                    { icon: Zap, text: "Performance 95+ Lighthouse" },
                    { icon: Award, text: "Garanție 30-90 zile post-lansare" },
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <item.icon className="h-5 w-5 shrink-0 mt-0.5" />
                      <span className="text-white/90">{item.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PORTOFOLIU ──────────────────────────────────────── */}
      <section id="portofoliu" className="py-20 bg-surface-secondary/50 dark:bg-neutral-900/50">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
              Portofoliu
            </h2>
            <p className="text-text-secondary max-w-xl mx-auto">
              Proiecte recente care demonstrează expertiza noastră în diverse industrii și tehnologii.
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-border-subtle animate-skeleton bg-neutral-100 dark:bg-neutral-800 h-72"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {portfolio.map((item) => (
                <PortfolioCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section id="faq" className="py-20">
        <div className="container max-w-3xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
              Întrebări Frecvente
            </h2>
            <p className="text-text-secondary">
              Răspunsuri la cele mai comune întrebări despre serviciile noastre.
            </p>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 rounded-xl animate-skeleton bg-neutral-100 dark:bg-neutral-800"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {faq.map((item) => (
                <FAQCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── CONTACT ─────────────────────────────────────────── */}
      <section id="contact" className="py-20 bg-surface-secondary/50 dark:bg-neutral-900/50">
        <div className="container max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-text-primary mb-4">
              Hai să Discutăm
            </h2>
            <p className="text-text-secondary">
              Spune-ne despre proiectul tău și îți răspundem în maxim 24 de ore.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Contact info */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-start gap-3">
                <MailIcon className="h-5 w-5 text-brand-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-text-primary">Email</p>
                  <a
                    href={`mailto:${contact.email}`}
                    className="text-sm text-brand-600 hover:text-brand-700"
                  >
                    {contact.email}
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-brand-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-text-primary">Telefon</p>
                  <a
                    href={`tel:${contact.phone}`}
                    className="text-sm text-brand-600 hover:text-brand-700"
                  >
                    {contact.phone}
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-brand-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-text-primary">Locație</p>
                  <p className="text-sm text-text-secondary">
                    {contact.address}
                  </p>
                </div>
              </div>

              {/* Social */}
              <div className="flex gap-3 pt-4">
                {contact.social.facebook && (
                  <a
                    href={contact.social.facebook}
                    className="p-2 rounded-lg bg-white dark:bg-neutral-800 text-text-secondary hover:text-brand-600 transition-colors"
                    aria-label="Facebook"
                  >
                    <Facebook className="h-4 w-4" />
                  </a>
                )}
                {contact.social.instagram && (
                  <a
                    href={contact.social.instagram}
                    className="p-2 rounded-lg bg-white dark:bg-neutral-800 text-text-secondary hover:text-brand-600 transition-colors"
                    aria-label="Instagram"
                  >
                    <Instagram className="h-4 w-4" />
                  </a>
                )}
                {contact.social.linkedin && (
                  <a
                    href={contact.social.linkedin}
                    className="p-2 rounded-lg bg-white dark:bg-neutral-800 text-text-secondary hover:text-brand-600 transition-colors"
                    aria-label="LinkedIn"
                  >
                    <Linkedin className="h-4 w-4" />
                  </a>
                )}
                {contact.social.github && (
                  <a
                    href={contact.social.github}
                    className="p-2 rounded-lg bg-white dark:bg-neutral-800 text-text-secondary hover:text-brand-600 transition-colors"
                    aria-label="GitHub"
                  >
                    <Github className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Form */}
            <form
              onSubmit={handleContactSubmit}
              className="lg:col-span-3 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-2xl p-6 border border-border-subtle space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">
                    Nume
                  </label>
                  <input
                    type="text"
                    required
                    value={contactForm.name}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, name: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-lg border border-border-default bg-white dark:bg-neutral-700 text-text-primary focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 outline-none transition-all text-sm"
                    placeholder="Numele tău"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    required
                    value={contactForm.email}
                    onChange={(e) =>
                      setContactForm({ ...contactForm, email: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-lg border border-border-default bg-white dark:bg-neutral-700 text-text-primary focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 outline-none transition-all text-sm"
                    placeholder="email@exemplu.ro"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  Mesaj
                </label>
                <textarea
                  required
                  rows={5}
                  value={contactForm.message}
                  onChange={(e) =>
                    setContactForm({ ...contactForm, message: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-lg border border-border-default bg-white dark:bg-neutral-700 text-text-primary focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 outline-none transition-all text-sm resize-none"
                  placeholder="Descrie proiectul tău..."
                />
              </div>
              <button
                type="submit"
                disabled={formSent}
                className={cn(
                  "w-full py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2",
                  formSent
                    ? "bg-accent-500 text-white"
                    : "bg-brand-500 text-white hover:bg-brand-600 shadow-glow-primary",
                )}
              >
                {formSent ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Mesaj trimis! Te contactăm în curând.
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Trimite Mesajul
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="bg-neutral-900 dark:bg-neutral-950 text-neutral-300 py-16">
        <div className="container">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
            {/* About */}
            <div className="lg:col-span-2">
              <a href="#" className="flex items-center gap-2 font-bold text-xl text-white mb-4">
                <span className="text-brand-400">Nexus</span>
                <span>DevStudio</span>
              </a>
              <p className="text-sm text-neutral-400 leading-relaxed">
                {footer.about}
              </p>
            </div>

            {/* Links */}
            {footer.columns.map((col) => (
              <div key={col.title}>
                <h4 className="font-semibold text-white mb-4">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-sm text-neutral-400 hover:text-white transition-colors"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-neutral-700 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-neutral-500">{footer.copyright}</p>
            <p className="text-sm text-neutral-500">
              Creat cu ❤️ de NexusDevStudio
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
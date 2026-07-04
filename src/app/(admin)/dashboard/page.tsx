"use client";

/**
 * NexusDevStudio — Panou de Administrare
 *
 * Dashboard complet cu sidebar și 8+1 secțiuni administrabile:
 *   Hero, Servicii, Cum Lucrăm, FAQ, Portofoliu, Contact, SEO, Mesaje, Footer
 *
 * Toate secțiunile suportă operații CRUD complete:
 *   - Create (Adăugare elemente noi)
 *   - Read   (Încărcare din API-ul /api/settings)
 *   - Update (Editare inline a câmpurilor)
 *   - Delete (Ștergere cu confirmare)
 *
 * Funcționalități suplimentare:
 *   - Toggle dark/light mode cu persistență în localStorage
 *   - Sidebar responsive cu overlay pe mobile
 *   - Salvare globală (PUT /api/settings)
 *   - Mesaje cu marcare citit/necitit, ștergere și căutare
 *   - Reordonare elemente (servicii, FAQ, portofoliu, pași)
 *   - Expandare carduri pentru editare detaliată
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Image,
  Briefcase,
  ListOrdered,
  HelpCircle,
  FolderOpen,
  Phone,
  Search,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  Save,
  Plus,
  Trash2,
  Edit3,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Eye,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Sun,
  Moon,
  Globe,
  Mail,
  MailOpen,
  Star,
  Clock,
  Hash,
  Link2,
  MapPin,
  AtSign,
  PhoneCall,
  Layers,
  GripVertical,
  Copy,
  RefreshCw,
  Filter,
  CheckCircle2,
  Circle,
  Info,
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
  url?: string;
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

interface HeroData {
  title: string;
  subtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
  backgroundType: "gradient" | "video" | "image";
  backgroundValue: string;
}

interface SEOData {
  siteName: string;
  title: string;
  description: string;
  keywords: string;
  ogImage: string;
  googleAnalyticsId: string;
}

interface FooterData {
  about: string;
  copyright: string;
  columns: { title: string; links: { label: string; href: string }[] }[];
}

interface SiteSettings {
  hero: HeroData;
  services: Service[];
  howWeWork: TimelineItem[];
  portfolio: PortfolioItem[];
  faq: FAQItem[];
  contact: ContactInfo;
  seo: SEOData;
  footer: FooterData;
}

interface Message {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  date: string;
  read: boolean;
  starred: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════

const SECTIONS = [
  { id: "hero", label: "Hero", icon: Image, description: "Titlu, subtitlu, CTA" },
  { id: "services", label: "Servicii", icon: Briefcase, description: "Lista de servicii & prețuri" },
  { id: "howWeWork", label: "Cum Lucrăm", icon: ListOrdered, description: "Etapele procesului" },
  { id: "faq", label: "FAQ", icon: HelpCircle, description: "Întrebări frecvente" },
  { id: "portfolio", label: "Portofoliu", icon: FolderOpen, description: "Proiecte & realizări" },
  { id: "contact", label: "Contact", icon: Phone, description: "Date contact & social" },
  { id: "seo", label: "SEO", icon: Search, description: "Optimizare & metadata" },
  { id: "messages", label: "Mesaje", icon: MessageSquare, description: "Mesaje de la vizitatori" },
  { id: "footer", label: "Footer", icon: Layers, description: "Despre, copyright, linkuri" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

const DEFAULT_EMPTY_SERVICE: Service = {
  id: "",
  icon: "Globe",
  title: "",
  description: "",
  price: 0,
  currency: "EUR",
  category: "Web Development",
  features: [""],
  popular: false,
  timeline: "",
};

const DEFAULT_EMPTY_FAQ: FAQItem = {
  id: "",
  question: "",
  answer: "",
};

const DEFAULT_EMPTY_PORTFOLIO: PortfolioItem = {
  id: "",
  title: "",
  category: "",
  image: "",
  description: "",
  tags: [],
};

const DEFAULT_EMPTY_TIMELINE: TimelineItem = {
  id: "",
  step: 1,
  title: "",
  description: "",
  icon: "CheckCircle2",
};

const DUMMY_MESSAGES: Message[] = [
  {
    id: "m1",
    name: "Maria Popescu",
    email: "maria@exemplu.ro",
    subject: "Ofertă website de prezentare",
    message:
      "Bună ziua! Aș dori o ofertă pentru un website de prezentare. Am o firmă de arhitectură și vreau un site modern, cu portofoliu și formular de contact. Aștept propunerea dvs. Mulțumesc!",
    date: "2025-01-15T10:30:00",
    read: false,
    starred: true,
  },
  {
    id: "m2",
    name: "Andrei Ionescu",
    email: "andrei@companie.ro",
    subject: "Magazin online produse handmade",
    message:
      "Salut! Sunt interesat de un magazin online pentru produse handmade. Cam cât ar costa și în cât timp se poate livra? Am nevoie de integrare cu curierul și plăți cu cardul.",
    date: "2025-01-14T14:20:00",
    read: false,
    starred: false,
  },
  {
    id: "m3",
    name: "Elena Stan",
    email: "elena@startup.ro",
    subject: "Aplicație mobilă pentru startup",
    message:
      "Bună! Avem nevoie de o aplicație mobilă pentru startup-ul nostru din domeniul foodtech. Vrem să discutăm opțiunile și să primim un estimat de preț și timeline.",
    date: "2025-01-13T09:15:00",
    read: true,
    starred: false,
  },
  {
    id: "m4",
    name: "Cristian Marin",
    email: "cristian@firma.ro",
    subject: "Optimizare SEO & Chatbot AI",
    message:
      "Aș vrea să discut despre optimizarea SEO a site-ului existent și implementarea unui chatbot AI pentru suportul clienților. Site-ul este în WordPress, deci am nevoie și de migrare.",
    date: "2025-01-12T16:45:00",
    read: true,
    starred: true,
  },
  {
    id: "m5",
    name: "Ioana Dumitrescu",
    email: "ioana@brandstudio.ro",
    subject: "Rebranding complet + website",
    message:
      "Bună seara! Agenția noastră de branding are nevoie de un partener tehnic pentru proiecte de web development. Căutăm o colaborare pe termen lung. Putem programa o discuție?",
    date: "2025-01-11T11:00:00",
    read: true,
    starred: false,
  },
  {
    id: "m6",
    name: "Mihai Georgescu",
    email: "mihai@techstart.ro",
    subject: "Integrare API & microservicii",
    message:
      "Salutare! Avem un proiect complex care necesită o arhitectură pe microservicii cu API Gateway. Căutăm o echipă cu experiență în Node.js și Kubernetes. Ne puteți ajuta?",
    date: "2025-01-10T08:45:00",
    read: false,
    starred: false,
  },
];

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ro-RO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ═══════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════

function FieldRow({
  label,
  children,
  required,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label className="block text-sm font-medium text-text-primary">
          {label}
        </label>
        {required && <span className="text-danger-500 text-xs">*</span>}
        {hint && <span className="text-xs text-text-tertiary">({hint})</span>}
      </div>
      {children}
    </div>
  );
}

function SectionHeader({
  title,
  count,
  onAdd,
  addLabel,
}: {
  title: string;
  count: number;
  onAdd?: () => void;
  addLabel?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
      <div>
        <h3 className="font-semibold text-text-primary text-lg">{title}</h3>
        <p className="text-sm text-text-tertiary">{count} elemente</p>
      </div>
      {onAdd && addLabel && (
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 active:bg-brand-700 transition-colors shadow-elevation-1"
        >
          <Plus className="h-4 w-4" />
          {addLabel}
        </button>
      )}
    </div>
  );
}

function ReorderButtons({
  onUp,
  onDown,
  canUp,
  canDown,
}: {
  onUp: () => void;
  onDown: () => void;
  canUp: boolean;
  canDown: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={onUp}
        disabled={!canUp}
        className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Mută mai sus"
      >
        <ArrowUp className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onDown}
        disabled={!canDown}
        className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-secondary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="Mută mai jos"
      >
        <ArrowDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-surface-secondary dark:bg-neutral-800 flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-text-tertiary" />
      </div>
      <h4 className="text-lg font-medium text-text-primary mb-1">{title}</h4>
      <p className="text-sm text-text-secondary max-w-sm">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {action.label}
        </button>
      )}
    </div>
  );
}

function UnreadBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-brand-500 text-white text-[10px] font-semibold leading-none">
      {count}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Main Dashboard Component
// ═══════════════════════════════════════════════════════════════════════

export default function AdminDashboardPage() {
  const [activeSection, setActiveSection] = useState<SectionId>("hero");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [messageFilter, setMessageFilter] = useState<
    "all" | "unread" | "read" | "starred"
  >("all");
  const [messageSearch, setMessageSearch] = useState("");

  const [hero, setHero] = useState<HeroData>({
    title: "",
    subtitle: "",
    ctaPrimary: "",
    ctaSecondary: "",
    backgroundType: "gradient",
    backgroundValue: "",
  });
  const [services, setServices] = useState<Service[]>([]);
  const [howWeWork, setHowWeWork] = useState<TimelineItem[]>([]);
  const [faq, setFaq] = useState<FAQItem[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [contact, setContact] = useState<ContactInfo>({
    email: "",
    phone: "",
    address: "",
    social: {},
  });
  const [seo, setSeo] = useState<SEOData>({
    siteName: "",
    title: "",
    description: "",
    keywords: "",
    ogImage: "",
    googleAnalyticsId: "",
  });
  const [footer, setFooter] = useState<FooterData>({
    about: "",
    copyright: "",
    columns: [],
  });
  const [messages, setMessages] = useState<Message[]>(DUMMY_MESSAGES);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/settings");
        if (!cancelled && res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            const d: SiteSettings = json.data;
            setHero(d.hero ?? hero);
            setServices(d.services ?? []);
            setHowWeWork(d.howWeWork ?? []);
            setFaq(d.faq ?? []);
            setPortfolio(d.portfolio ?? []);
            setContact(d.contact ?? contact);
            setSeo(d.seo ?? seo);
            setFooter(d.footer ?? footer);
          }
        }
      } catch {
        // Păstrăm valorile implicite
      }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("nexus-theme");
    if (stored === "dark") {
      setDark(true);
      document.documentElement.classList.add("dark");
    } else if (!stored) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      if (mq.matches) {
        setDark(true);
        document.documentElement.classList.add("dark");
      }
    }
  }, []);

  const toggleDark = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      localStorage.setItem("nexus-theme", next ? "dark" : "light");
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveMsg(null);

    const payload: SiteSettings = {
      hero,
      services,
      howWeWork,
      portfolio,
      faq,
      contact,
      seo,
      footer,
    };

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSaveMsg({
          type: "success",
          text: "✅ Setările au fost salvate cu succes!",
        });
      } else {
        setSaveMsg({ type: "error", text: "❌ A apărut o eroare la salvare." });
      }
    } catch {
      setSaveMsg({
        type: "error",
        text: "❌ Eroare de conexiune. Verifică API-ul.",
      });
    }

    setSaving(false);
    setTimeout(() => setSaveMsg(null), 4000);
  }, [hero, services, howWeWork, portfolio, faq, contact, seo, footer]);

  const moveItem = useCallback(
    <T,>(list: T[], setList: (items: T[]) => void, idx: number, dir: "up" | "down") => {
      const target = dir === "up" ? idx - 1 : idx + 1;
      if (target < 0 || target >= list.length) return;
      const next = [...list];
      [next[idx], next[target]] = [next[target], next[idx]];
      setList(next);
    },
    [],
  );

  // ═════════════════════════════════════ Service Handlers
  const addService = () =>
    setServices((prev) => [...prev, { ...DEFAULT_EMPTY_SERVICE, id: generateId() }]);

  const updateService = (id: string, field: keyof Service, value: unknown) =>
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );

  const removeService = (id: string) =>
    setServices((prev) => prev.filter((s) => s.id !== id));

  const duplicateService = (id: string) => {
    setServices((prev) => {
      const source = prev.find((s) => s.id === id);
      if (!source) return prev;
      return [...prev, { ...source, id: generateId(), title: `${source.title} (copie)` }];
    });
  };

  const addFeature = (serviceId: string) =>
    setServices((prev) =>
      prev.map((s) =>
        s.id === serviceId ? { ...s, features: [...s.features, ""] } : s,
      ),
    );

  const updateFeature = (serviceId: string, idx: number, value: string) =>
    setServices((prev) =>
      prev.map((s) => {
        if (s.id !== serviceId) return s;
        const features = [...s.features];
        features[idx] = value;
        return { ...s, features };
      }),
    );

  const removeFeature = (serviceId: string, idx: number) =>
    setServices((prev) =>
      prev.map((s) => {
        if (s.id !== serviceId) return s;
        return { ...s, features: s.features.filter((_, i) => i !== idx) };
      }),
    );

  // ═════════════════════════════════════ How We Work Handlers
  const addTimelineStep = () => {
    const nextStep =
      howWeWork.length > 0
        ? Math.max(...howWeWork.map((s) => s.step)) + 1
        : 1;
    setHowWeWork((prev) => [
      ...prev,
      { ...DEFAULT_EMPTY_TIMELINE, id: generateId(), step: nextStep },
    ]);
  };

  const updateTimelineStep = (
    id: string,
    field: keyof TimelineItem,
    value: unknown,
  ) =>
    setHowWeWork((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );

  const removeTimelineStep = (id: string) =>
    setHowWeWork((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      return filtered.map((s, i) => ({ ...s, step: i + 1 }));
    });

  // ═════════════════════════════════════ FAQ Handlers
  const addFAQ = () =>
    setFaq((prev) => [...prev, { ...DEFAULT_EMPTY_FAQ, id: generateId() }]);

  const updateFAQ = (id: string, field: keyof FAQItem, value: string) =>
    setFaq((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [field]: value } : f)),
    );

  const removeFAQ = (id: string) =>
    setFaq((prev) => prev.filter((f) => f.id !== id));

  // ═════════════════════════════════════ Portfolio Handlers
  const addPortfolio = () =>
    setPortfolio((prev) => [
      ...prev,
      { ...DEFAULT_EMPTY_PORTFOLIO, id: generateId() },
    ]);

  const updatePortfolio = (
    id: string,
    field: keyof PortfolioItem,
    value: unknown,
  ) =>
    setPortfolio((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
    );

  const removePortfolio = (id: string) =>
    setPortfolio((prev) => prev.filter((p) => p.id !== id));

  const addTag = (portfolioId: string) =>
    setPortfolio((prev) =>
      prev.map((p) =>
        p.id === portfolioId ? { ...p, tags: [...p.tags, ""] } : p,
      ),
    );

  const updateTag = (portfolioId: string, idx: number, value: string) =>
    setPortfolio((prev) =>
      prev.map((p) => {
        if (p.id !== portfolioId) return p;
        const tags = [...p.tags];
        tags[idx] = value;
        return { ...p, tags };
      }),
    );

  const removeTag = (portfolioId: string, idx: number) =>
    setPortfolio((prev) =>
      prev.map((p) => {
        if (p.id !== portfolioId) return p;
        return { ...p, tags: p.tags.filter((_, i) => i !== idx) };
      }),
    );

  // ═════════════════════════════════════ Footer Handlers
  const addFooterColumn = () =>
    setFooter((prev) => ({
      ...prev,
      columns: [...prev.columns, { title: "", links: [] }],
    }));

  const updateFooterColumn = (colIdx: number, title: string) =>
    setFooter((prev) => {
      const cols = [...prev.columns];
      cols[colIdx] = { ...cols[colIdx], title };
      return { ...prev, columns: cols };
    });

  const removeFooterColumn = (colIdx: number) =>
    setFooter((prev) => ({
      ...prev,
      columns: prev.columns.filter((_, i) => i !== colIdx),
    }));

  const addFooterLink = (colIdx: number) =>
    setFooter((prev) => {
      const cols = [...prev.columns];
      cols[colIdx] = {
        ...cols[colIdx],
        links: [...cols[colIdx].links, { label: "", href: "" }],
      };
      return { ...prev, columns: cols };
    });

  const updateFooterLink = (
    colIdx: number,
    linkIdx: number,
    field: "label" | "href",
    value: string,
  ) =>
    setFooter((prev) => {
      const cols = [...prev.columns];
      const links = [...cols[colIdx].links];
      links[linkIdx] = { ...links[linkIdx], [field]: value };
      cols[colIdx] = { ...cols[colIdx], links };
      return { ...prev, columns: cols };
    });

  const removeFooterLink = (colIdx: number, linkIdx: number) =>
    setFooter((prev) => {
      const cols = [...prev.columns];
      cols[colIdx] = {
        ...cols[colIdx],
        links: cols[colIdx].links.filter((_, i) => i !== linkIdx),
      };
      return { ...prev, columns: cols };
    });

  // ═════════════════════════════════════ Message Handlers
  const toggleMessageRead = (id: string) =>
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, read: !m.read } : m)),
    );

  const toggleMessageStarred = (id: string) =>
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, starred: !m.starred } : m)),
    );

  const deleteMessage = (id: string) =>
    setMessages((prev) => prev.filter((m) => m.id !== id));

  const markAllRead = () =>
    setMessages((prev) => prev.map((m) => ({ ...m, read: true })));

  const filteredMessages = useMemo(() => {
    let result = messages;

    if (messageFilter === "unread") result = result.filter((m) => !m.read);
    else if (messageFilter === "read") result = result.filter((m) => m.read);
    else if (messageFilter === "starred") result = result.filter((m) => m.starred);

    if (messageSearch.trim()) {
      const q = messageSearch.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.subject.toLowerCase().includes(q) ||
          m.message.toLowerCase().includes(q),
      );
    }

    return result;
  }, [messages, messageFilter, messageSearch]);

  const unreadCount = useMemo(
    () => messages.filter((m) => !m.read).length,
    [messages],
  );

  // ═════════════════════════════════════ Loading State
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-full border-2 border-brand-500/30 border-t-brand-500 animate-spin" />
            <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-brand-500" />
          </div>
          <p className="text-text-secondary text-sm font-medium">
            Se încarcă panoul de administrare...
          </p>
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════ Render
  return (
    <div
      className={cn(
        "min-h-screen flex",
        "bg-neutral-50 dark:bg-neutral-950",
        "text-text-primary",
      )}
    >
      {/* SIDEBAR */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-drawer w-64",
          "bg-white dark:bg-neutral-900",
          "border-r border-border-subtle",
          "flex flex-col",
          "transition-transform duration-300",
          "lg:translate-x-0 lg:static lg:z-auto",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 h-header border-b border-border-subtle shrink-0">
          <a
            href="/"
            className="flex items-center gap-2 font-bold text-lg no-underline"
          >
            <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="text-brand-600 dark:text-brand-400">Nexus</span>
            <span className="text-text-primary">Admin</span>
          </a>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition-colors"
            aria-label="Închide meniul"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => {
                  setActiveSection(section.id as SectionId);
                  setSidebarOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left group",
                  isActive
                    ? "bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 shadow-elevation-1"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-secondary dark:hover:bg-neutral-800",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive
                      ? "text-brand-500"
                      : "text-text-tertiary group-hover:text-text-secondary",
                  )}
                />
                <span className="flex-1">{section.label}</span>
                {section.id === "messages" && unreadCount > 0 && (
                  <UnreadBadge count={unreadCount} />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border-subtle space-y-1 shrink-0">
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-secondary dark:hover:bg-neutral-800 transition-colors no-underline"
          >
            <Eye className="h-4 w-4" />
            Vizualizează site-ul
            <ExternalLink className="h-3 w-3 ml-auto opacity-60" />
          </a>
          <button
            onClick={() => {
              if (confirm("Ești sigur că vrei să te deconectezi?")) {
                window.location.href = "/login";
              }
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Deconectare
          </button>
        </div>
      </aside>

      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-overlay bg-black/30 backdrop-blur-sm animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-sticky h-header bg-white/80 dark:bg-neutral-900/80 backdrop-blur-lg border-b border-border-subtle flex items-center justify-between px-4 md:px-6 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-secondary transition-colors"
              aria-label="Deschide meniul"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h2 className="font-semibold text-text-primary text-lg truncate">
                {SECTIONS.find((s) => s.id === activeSection)?.label ||
                  "Dashboard"}
              </h2>
              <p className="text-xs text-text-tertiary hidden sm:block truncate">
                {SECTIONS.find((s) => s.id === activeSection)?.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className={cn(
                "hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700",
                "shadow-elevation-1 hover:shadow-glow-primary",
                "disabled:opacity-60 disabled:cursor-not-allowed",
              )}
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="hidden md:inline">Se salvează...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span className="hidden md:inline">Salvează</span>
                </>
              )}
            </button>

            <button
              onClick={toggleDark}
              className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-secondary dark:hover:bg-neutral-800 transition-colors"
              aria-label={dark ? "Treci la tema light" : "Treci la tema dark"}
            >
              {dark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>
        </header>

        {saveMsg && (
          <div
            className={cn(
              "mx-4 md:mx-6 mt-4 p-3 rounded-lg text-sm font-medium animate-slide-in-from-top flex items-center gap-2",
              saveMsg.type === "success"
                ? "bg-accent-50 dark:bg-accent-900/20 text-accent-600 dark:text-accent-400 border border-accent-200 dark:border-accent-800"
                : "bg-danger-50 dark:bg-danger-900/20 text-danger-600 dark:text-danger-400 border border-danger-200 dark:border-danger-800",
            )}
            role="alert"
          >
            {saveMsg.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            {saveMsg.text}
          </div>
        )}

        {/* CONTENT AREA */}
        <div className="flex-1 p-4 md:p-6 overflow-y-auto">
          {/* ─── HERO Section ─────────────────────────────── */}
          {activeSection === "hero" && (
            <div className="max-w-4xl space-y-6 animate-fade-in">
              <SectionHeader title="Secțiunea Hero" count={1} />

              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-border-subtle p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FieldRow label="Titlu principal" required>
                    <input
                      type="text"
                      value={hero.title}
                      onChange={(e) =>
                        setHero({ ...hero, title: e.target.value })
                      }
                      placeholder="ex: Transformăm Idei în Realitate Digitală"
                      className="w-full px-4 py-2.5 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none text-sm transition-all placeholder:text-text-disabled"
                    />
                  </FieldRow>

                  <FieldRow label="Text Buton Principal (CTA)">
                    <input
                      type="text"
                      value={hero.ctaPrimary}
                      onChange={(e) =>
                        setHero({ ...hero, ctaPrimary: e.target.value })
                      }
                      placeholder="ex: Începe Proiectul"
                      className="w-full px-4 py-2.5 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none text-sm transition-all placeholder:text-text-disabled"
                    />
                  </FieldRow>
                </div>

                <FieldRow label="Subtitlu" required>
                  <textarea
                    value={hero.subtitle}
                    onChange={(e) =>
                      setHero({ ...hero, subtitle: e.target.value })
                    }
                    rows={3}
                    placeholder="Descrierea principală a site-ului..."
                    className="w-full px-4 py-2.5 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none text-sm transition-all placeholder:text-text-disabled resize-none"
                  />
                </FieldRow>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FieldRow label="Text Buton Secundar (CTA)">
                    <input
                      type="text"
                      value={hero.ctaSecondary}
                      onChange={(e) =>
                        setHero({ ...hero, ctaSecondary: e.target.value })
                      }
                      placeholder="ex: Vezi Serviciile"
                      className="w-full px-4 py-2.5 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none text-sm transition-all placeholder:text-text-disabled"
                    />
                  </FieldRow>

                  <FieldRow label="Tip Background" hint="gradient | video | image">
                    <select
                      value={hero.backgroundType}
                      onChange={(e) =>
                        setHero({
                          ...hero,
                          backgroundType: e.target.value as "gradient" | "video" | "image",
                        })
                      }
                      className="w-full px-4 py-2.5 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none text-sm transition-all"
                    >
                      <option value="gradient">Gradient</option>
                      <option value="video">Video</option>
                      <option value="image">Imagine</option>
                    </select>
                  </FieldRow>
                </div>

                <FieldRow
                  label="Valoare Background"
                  hint={
                    hero.backgroundType === "gradient"
                      ? "CSS gradient"
                      : hero.backgroundType === "video"
                        ? "URL video"
                        : "URL imagine"
                  }
                >
                  <input
                    type="text"
                    value={hero.backgroundValue}
                    onChange={(e) =>
                      setHero({ ...hero, backgroundValue: e.target.value })
                    }
                    placeholder={
                      hero.backgroundType === "gradient"
                        ? "linear-gradient(135deg, ...)"
                        : "https://..."
                    }
                    className="w-full px-4 py-2.5 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none text-sm transition-all placeholder:text-text-disabled font-mono"
                  />
                </FieldRow>
              </div>
            </div>
          )}

          {/* ─── SERVICES Section ────────────────────────── */}
          {activeSection === "services" && (
            <div className="max-w-5xl space-y-4 animate-fade-in">
              <SectionHeader
                title="Servicii"
                count={services.length}
                onAdd={addService}
                addLabel="Adaugă Serviciu"
              />

              {services.length === 0 ? (
                <EmptyState
                  icon={Briefcase}
                  title="Niciun serviciu adăugat"
                  description="Adaugă primul serviciu pentru a apărea pe site."
                  action={{ label: "Adaugă Serviciu", onClick: addService }}
                />
              ) : (
                <div className="space-y-3">
                  {services.map((service, idx) => (
                    <div
                      key={service.id}
                      className="bg-white dark:bg-neutral-900 rounded-xl border border-border-subtle overflow-hidden transition-all hover:border-border-default"
                    >
                      <button
                        onClick={() =>
                          setExpandedCard(
                            expandedCard === service.id ? null : service.id,
                          )
                        }
                        className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-secondary dark:hover:bg-neutral-800 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs font-medium text-text-tertiary w-6 shrink-0">
                            #{idx + 1}
                          </span>
                          <div className="min-w-0">
                            <span className="font-medium text-text-primary truncate block">
                              {service.title || "Serviciu nou"}
                            </span>
                            <span className="text-xs text-text-tertiary">
                              {service.price} {service.currency}
                              {service.timeline && ` · ${service.timeline}`}
                            </span>
                          </div>
                          {service.popular && (
                            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 shrink-0">
                              <Star className="h-2.5 w-2.5 fill-current" />
                              Popular
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0 ml-3">
                          <ReorderButtons
                            onUp={() =>
                              moveItem(services, setServices, idx, "up")
                            }
                            onDown={() =>
                              moveItem(services, setServices, idx, "down")
                            }
                            canUp={idx > 0}
                            canDown={idx < services.length - 1}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateService(service.id);
                            }}
                            className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-surface-secondary transition-colors"
                            title="Duplică"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (confirm("Ștergi acest serviciu?"))
                                removeService(service.id);
                            }}
                            className="p-1 rounded text-danger-500 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                            title="Șterge"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          {expandedCard === service.id ? (
                            <ChevronUp className="h-4 w-4 text-text-tertiary" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-text-tertiary" />
                          )}
                        </div>
                      </button>

                      {expandedCard === service.id && (
                        <div className="px-5 pb-5 border-t border-border-subtle pt-4 space-y-4 animate-slide-in-from-top">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FieldRow label="Titlu" required>
                              <input
                                type="text"
                                value={service.title}
                                onChange={(e) =>
                                  updateService(service.id, "title", e.target.value)
                                }
                                className="w-full px-3 py-2 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                              />
                            </FieldRow>

                            <FieldRow label="Icon (lucide-react)">
                              <input
                                type="text"
                                value={service.icon}
                                onChange={(e) =>
                                  updateService(service.id, "icon", e.target.value)
                                }
                                className="w-full px-3 py-2 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-mono"
                                placeholder="ex: Globe, ShoppingCart"
                              />
                            </FieldRow>

                            <FieldRow label="Categorie">
                              <input
                                type="text"
                                value={service.category}
                                onChange={(e) =>
                                  updateService(service.id, "category", e.target.value)
                                }
                                className="w-full px-3 py-2 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                              />
                            </FieldRow>

                            <FieldRow label="Preț">
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  value={service.price}
                                  onChange={(e) =>
                                    updateService(service.id, "price", Number(e.target.value))
                                  }
                                  className="flex-1 px-3 py-2 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                                />
                                <input
                                  type="text"
                                  value={service.currency}
                                  onChange={(e) =>
                                    updateService(service.id, "currency", e.target.value)
                                  }
                                  className="w-20 px-3 py-2 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                                  placeholder="EUR"
                                />
                              </div>
                            </FieldRow>

                            <FieldRow label="Timeline">
                              <input
                                type="text"
                                value={service.timeline}
                                onChange={(e) =>
                                  updateService(service.id, "timeline", e.target.value)
                                }
                                className="w-full px-3 py-2 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                                placeholder="ex: 5-7 zile"
                              />
                            </FieldRow>

                            <FieldRow label="Popular">
                              <label className="flex items-center gap-2 cursor-pointer mt-1">
                                <input
                                  type="checkbox"
                                  checked={service.popular || false}
                                  onChange={(e) =>
                                    updateService(service.id, "popular", e.target.checked)
                                  }
                                  className="rounded border-border-default h-4 w-4 text-brand-500 focus:ring-brand-500/30"
                                />
                                <span className="text-sm text-text-secondary">
                                  Marchează ca serviciu popular
                                </span>
                              </label>
                            </FieldRow>
                          </div>

                          <FieldRow label="Descriere">
                            <textarea
                              value={service.description}
                              onChange={(e) =>
                                updateService(service.id, "description", e.target.value)
                              }
                              rows={2}
                              className="w-full px-3 py-2 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none resize-none"
                            />
                          </FieldRow>

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-medium text-text-primary">
                                Caracteristici
                              </label>
                              <button
                                onClick={() => addFeature(service.id)}
                                className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                              >
                                <Plus className="h-3 w-3" /> Adaugă
                              </button>
                            </div>
                            <div className="space-y-2">
                              {service.features.length === 0 && (
                                <p className="text-xs text-text-tertiary italic">
                                  Nicio caracteristică adăugată.
                                </p>
                              )}
                              {service.features.map((feature, fi) => (
                                <div key={fi} className="flex items-center gap-2">
                                  <span className="text-xs text-text-tertiary w-5 shrink-0">
                                    {fi + 1}.
                                  </span>
                                  <input
                                    type="text"
                                    value={feature}
                                    onChange={(e) =>
                                      updateFeature(service.id, fi, e.target.value)
                                    }
                                    className="flex-1 px-3 py-2 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                                    placeholder={`Caracteristica ${fi + 1}`}
                                  />
                                  <button
                                    onClick={() => removeFeature(service.id, fi)}
                                    className="p-1.5 text-danger-500 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded transition-colors"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── HOW WE WORK Section ──────────────────────── */}
          {activeSection === "howWeWork" && (
            <div className="max-w-3xl space-y-4 animate-fade-in">
              <SectionHeader
                title="Cum Lucrăm"
                count={howWeWork.length}
                onAdd={addTimelineStep}
                addLabel="Adaugă Pas"
              />

              {howWeWork.length === 0 ? (
                <EmptyState
                  icon={ListOrdered}
                  title="Niciun pas adăugat"
                  description="Adaugă primul pas al procesului de lucru."
                  action={{ label: "Adaugă Pas", onClick: addTimelineStep }}
                />
              ) : (
                <div className="space-y-3">
                  {howWeWork.map((step, idx) => (
                    <div
                      key={step.id}
                      className="bg-white dark:bg-neutral-900 rounded-xl border border-border-subtle p-5 hover:border-border-default transition-all"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-brand-500 text-white font-bold text-sm shadow-glow-primary">
                            {step.step}
                          </span>
                          <input
                            type="text"
                            value={step.title}
                            onChange={(e) =>
                              updateTimelineStep(step.id, "title", e.target.value)
                            }
                            className="flex-1 px-3 py-1.5 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                            placeholder="Titlu pas..."
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <ReorderButtons
                            onUp={() => moveItem(howWeWork, setHowWeWork, idx, "up")}
                            onDown={() => moveItem(howWeWork, setHowWeWork, idx, "down")}
                            canUp={idx > 0}
                            canDown={idx < howWeWork.length - 1}
                          />
                          <button
                            onClick={() => {
                              if (confirm("Ștergi acest pas?"))
                                removeTimelineStep(step.id);
                            }}
                            className="p-1 rounded text-danger-500 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="ml-12 space-y-3">
                        <textarea
                          value={step.description}
                          onChange={(e) =>
                            updateTimelineStep(step.id, "description", e.target.value)
                          }
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none resize-none"
                          placeholder="Descriere pas..."
                        />

                        <FieldRow label="Icon (lucide-react)">
                          <input
                            type="text"
                            value={step.icon}
                            onChange={(e) =>
                              updateTimelineStep(step.id, "icon", e.target.value)
                            }
                            className="w-full px-3 py-2 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-mono"
                            placeholder="ex: CheckCircle2, Rocket"
                          />
                        </FieldRow>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── FAQ Section ─────────────────────────────── */}
          {activeSection === "faq" && (
            <div className="max-w-3xl space-y-4 animate-fade-in">
              <SectionHeader
                title="Întrebări Frecvente"
                count={faq.length}
                onAdd={addFAQ}
                addLabel="Adaugă Întrebare"
              />

              {faq.length === 0 ? (
                <EmptyState
                  icon={HelpCircle}
                  title="Nicio întrebare"
                  description="Adaugă întrebări și răspunsuri pentru secțiunea FAQ."
                  action={{ label: "Adaugă Întrebare", onClick: addFAQ }}
                />
              ) : (
                <div className="space-y-3">
                  {faq.map((item, idx) => (
                    <div
                      key={item.id}
                      className="bg-white dark:bg-neutral-900 rounded-xl border border-border-subtle p-5 space-y-3 hover:border-border-default transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-text-tertiary">
                          #{idx + 1}
                        </span>
                        <div className="flex items-center gap-1">
                          <ReorderButtons
                            onUp={() => moveItem(faq, setFaq, idx, "up")}
                            onDown={() => moveItem(faq, setFaq, idx, "down")}
                            canUp={idx > 0}
                            canDown={idx < faq.length - 1}
                          />
                          <button
                            onClick={() => {
                              if (confirm("Ștergi această întrebare?"))
                                removeFAQ(item.id);
                            }}
                            className="p-1 rounded text-danger-500 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <FieldRow label="Întrebare" required>
                        <input
                          type="text"
                          value={item.question}
                          onChange={(e) =>
                            updateFAQ(item.id, "question", e.target.value)
                          }
                          className="w-full px-3 py-2 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                          placeholder="Întrebare..."
                        />
                      </FieldRow>
                      <FieldRow label="Răspuns" required>
                        <textarea
                          value={item.answer}
                          onChange={(e) =>
                            updateFAQ(item.id, "answer", e.target.value)
                          }
                          rows={3}
                          className="w-full px-3 py-2 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none resize-none"
                          placeholder="Răspuns detaliat..."
                        />
                      </FieldRow>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── PORTFOLIO Section ──────────────────────── */}
          {activeSection === "portfolio" && (
            <div className="max-w-4xl space-y-4 animate-fade-in">
              <SectionHeader
                title="Portofoliu"
                count={portfolio.length}
                onAdd={addPortfolio}
                addLabel="Adaugă Proiect"
              />

              {portfolio.length === 0 ? (
                <EmptyState
                  icon={FolderOpen}
                  title="Niciun proiect"
                  description="Adaugă proiecte pentru secțiunea de portofoliu."
                  action={{ label: "Adaugă Proiect", onClick: addPortfolio }}
                />
              ) : (
                <div className="space-y-3">
                  {portfolio.map((item, idx) => (
                    <div
                      key={item.id}
                      className="bg-white dark:bg-neutral-900 rounded-xl border border-border-subtle p-5 space-y-3 hover:border-border-default transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-medium text-text-tertiary">
                            #{idx + 1}
                          </span>
                          <span className="text-sm font-medium text-text-primary">
                            {item.title || "Proiect nou"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <ReorderButtons
                            onUp={() =>
                              moveItem(portfolio, setPortfolio, idx, "up")
                            }
                            onDown={() =>
                              moveItem(portfolio, setPortfolio, idx, "down")
                            }
                            canUp={idx > 0}
                            canDown={idx < portfolio.length - 1}
                          />
                          <button
                            onClick={() => {
                              if (confirm("Ștergi acest proiect?"))
                                removePortfolio(item.id);
                            }}
                            className="p-1 rounded text-danger-500 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <FieldRow label="Titlu proiect" required>
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) =>
                              updatePortfolio(item.id, "title", e.target.value)
                            }
                            className="w-full px-3 py-2 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                            placeholder="Titlu proiect"
                          />
                        </FieldRow>

                        <FieldRow label="Categorie">
                          <input
                            type="text"
                            value={item.category}
                            onChange={(e) =>
                              updatePortfolio(item.id, "category", e.target.value)
                            }
                            className="w-full px-3 py-2 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                            placeholder="ex: eCommerce, Mobile"
                          />
                        </FieldRow>
                      </div>

                      <FieldRow label="URL imagine">
                        <input
                          type="text"
                          value={item.image}
                          onChange={(e) =>
                            updatePortfolio(item.id, "image", e.target.value)
                          }
                          className="w-full px-3 py-2 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-mono"
                          placeholder="/portfolio/proiect.jpg"
                        />
                      </FieldRow>

                      <FieldRow label="URL proiect (opțional)">
                        <input
                          type="text"
                          value={item.url || ""}
                          onChange={(e) =>
                            updatePortfolio(item.id, "url", e.target.value)
                          }
                          className="w-full px-3 py-2 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-mono"
                          placeholder="https://..."
                        />
                      </FieldRow>

                      <FieldRow label="Descriere">
                        <textarea
                          value={item.description}
                          onChange={(e) =>
                            updatePortfolio(item.id, "description", e.target.value)
                          }
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none resize-none"
                          placeholder="Descriere proiect..."
                        />
                      </FieldRow>

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium text-text-primary">
                            Tag-uri
                          </label>
                          <button
                            onClick={() => addTag(item.id)}
                            className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                          >
                            <Plus className="h-3 w-3" /> Adaugă
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {item.tags.length === 0 && (
                            <p className="text-xs text-text-tertiary italic">
                              Niciun tag adăugat.
                            </p>
                          )}
                          {item.tags.map((tag, ti) => (
                            <div key={ti} className="flex items-center gap-1">
                              <input
                                type="text"
                                value={tag}
                                onChange={(e) =>
                                  updateTag(item.id, ti, e.target.value)
                                }
                                className="w-32 px-2 py-1.5 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                                placeholder="Tag..."
                              />
                              <button
                                onClick={() => removeTag(item.id, ti)}
                                className="text-danger-500 hover:text-danger-600 p-0.5"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── CONTACT Section ────────────────────────── */}
          {activeSection === "contact" && (
            <div className="max-w-2xl space-y-6 animate-fade-in">
              <SectionHeader title="Informații de Contact" count={1} />

              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-border-subtle p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FieldRow label="Email" required>
                    <div className="relative">
                      <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                      <input
                        type="email"
                        value={contact.email}
                        onChange={(e) =>
                          setContact({ ...contact, email: e.target.value })
                        }
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                        placeholder="contact@exemplu.ro"
                      />
                    </div>
                  </FieldRow>

                  <FieldRow label="Telefon">
                    <div className="relative">
                      <PhoneCall className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                      <input
                        type="text"
                        value={contact.phone}
                        onChange={(e) =>
                          setContact({ ...contact, phone: e.target.value })
                        }
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                        placeholder="+40 700 000 000"
                      />
                    </div>
                  </FieldRow>
                </div>

                <FieldRow label="Adresă">
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-text-tertiary" />
                    <textarea
                      value={contact.address}
                      onChange={(e) =>
                        setContact({ ...contact, address: e.target.value })
                      }
                      rows={2}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none resize-none"
                      placeholder="Adresa completă..."
                    />
                  </div>
                </FieldRow>
              </div>

              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-border-subtle p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-text-primary">
                    Social Media
                  </h3>
                  <button
                    onClick={() => {
                      const platform = prompt(
                        "Nume platformă (ex: tiktok, discord):",
                      );
                      if (platform) {
                        setContact({
                          ...contact,
                          social: { ...contact.social, [platform]: "" },
                        });
                      }
                    }}
                    className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3" /> Adaugă platformă
                  </button>
                </div>

                <div className="space-y-3">
                  {Object.keys(contact.social).length === 0 && (
                    <p className="text-sm text-text-tertiary italic">
                      Nicio platformă socială adăugată.
                    </p>
                  )}
                  {Object.entries(contact.social).map(
                    ([platform, url], sIdx) => (
                      <div key={sIdx} className="flex items-center gap-3">
                        <span className="w-24 text-sm font-medium text-text-secondary capitalize shrink-0">
                          {platform}
                        </span>
                        <div className="relative flex-1">
                          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                          <input
                            type="url"
                            value={url || ""}
                            onChange={(e) =>
                              setContact({
                                ...contact,
                                social: {
                                  ...contact.social,
                                  [platform]: e.target.value,
                                },
                              })
                            }
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                            placeholder={`https://${platform}.com/...`}
                          />
                        </div>
                        <button
                          onClick={() => {
                            const { [platform]: _, ...rest } = contact.social;
                            setContact({ ...contact, social: rest });
                          }}
                          className="p-1.5 text-danger-500 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─── SEO Section ────────────────────────────── */}
          {activeSection === "seo" && (
            <div className="max-w-2xl space-y-6 animate-fade-in">
              <SectionHeader title="Setări SEO" count={1} />

              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-border-subtle p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FieldRow label="Nume Site" required>
                    <input
                      type="text"
                      value={seo.siteName}
                      onChange={(e) =>
                        setSeo({ ...seo, siteName: e.target.value })
                      }
                      className="w-full px-4 py-2.5 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                      placeholder="NexusDevStudio"
                    />
                  </FieldRow>

                  <FieldRow label="Google Analytics ID">
                    <input
                      type="text"
                      value={seo.googleAnalyticsId}
                      onChange={(e) =>
                        setSeo({
                          ...seo,
                          googleAnalyticsId: e.target.value,
                        })
                      }
                      className="w-full px-4 py-2.5 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-mono"
                      placeholder="G-XXXXXXXXXX"
                    />
                  </FieldRow>
                </div>

                <FieldRow label="Titlu SEO" required>
                  <input
                    type="text"
                    value={seo.title}
                    onChange={(e) => setSeo({ ...seo, title: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                    placeholder="Titlul paginii în Google..."
                  />
                  <p className="text-xs text-text-tertiary mt-1">
                    {seo.title.length}/60 caractere (recomandat: 50-60)
                  </p>
                </FieldRow>

                <FieldRow label="Descriere SEO" required>
                  <textarea
                    value={seo.description}
                    onChange={(e) =>
                      setSeo({ ...seo, description: e.target.value })
                    }
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none resize-none"
                    placeholder="Meta description..."
                  />
                  <p className="text-xs text-text-tertiary mt-1">
                    {seo.description.length}/160 caractere (recomandat:
                    140-160)
                  </p>
                </FieldRow>

                <FieldRow label="Cuvinte Cheie">
                  <input
                    type="text"
                    value={seo.keywords}
                    onChange={(e) =>
                      setSeo({ ...seo, keywords: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                    placeholder="cuvânt1, cuvânt2, cuvânt3..."
                  />
                </FieldRow>

                <FieldRow label="OpenGraph Image URL">
                  <input
                    type="text"
                    value={seo.ogImage}
                    onChange={(e) =>
                      setSeo({ ...seo, ogImage: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-mono"
                    placeholder="/og-image.jpg"
                  />
                </FieldRow>
              </div>
            </div>
          )}

          {/* ─── MESSAGES Section ───────────────────────── */}
          {activeSection === "messages" && (
            <div className="max-w-4xl space-y-4 animate-fade-in">
              <SectionHeader title="Mesaje" count={messages.length} />

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-1.5 bg-white dark:bg-neutral-900 rounded-lg border border-border-subtle p-1">
                  {(
                    [
                      { value: "all", label: "Toate" },
                      { value: "unread", label: "Necitite" },
                      { value: "read", label: "Citite" },
                      { value: "starred", label: "Favorite" },
                    ] as const
                  ).map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() =>
                        setMessageFilter(
                          filter.value as typeof messageFilter,
                        )
                      }
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                        messageFilter === filter.value
                          ? "bg-brand-500 text-white"
                          : "text-text-secondary hover:text-text-primary hover:bg-surface-secondary",
                      )}
                    >
                      {filter.label}
                      {filter.value === "unread" && unreadCount > 0 && (
                        <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-white/20 text-[10px]">
                          {unreadCount}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
                  <input
                    type="text"
                    value={messageSearch}
                    onChange={(e) => setMessageSearch(e.target.value)}
                    placeholder="Caută mesaje..."
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                  />
                </div>

                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-secondary border border-border-subtle transition-colors shrink-0"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Marchează toate citite
                  </button>
                )}
              </div>

              {filteredMessages.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="Niciun mesaj"
                  description={
                    messageSearch
                      ? "Niciun mesaj nu corespunde căutării."
                      : "Nu există mesaje în această categorie."
                  }
                />
              ) : (
                <div className="space-y-3">
                  {filteredMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "bg-white dark:bg-neutral-900 rounded-xl border p-5 transition-all group",
                        !msg.read
                          ? "border-brand-300 dark:border-brand-700 bg-brand-50/30 dark:bg-brand-900/10"
                          : "border-border-subtle hover:border-border-default",
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <button
                            onClick={() => toggleMessageRead(msg.id)}
                            className="mt-0.5 shrink-0"
                            title={
                              msg.read
                                ? "Marchează necitit"
                                : "Marchează citit"
                            }
                          >
                            {msg.read ? (
                              <MailOpen className="h-4 w-4 text-text-tertiary" />
                            ) : (
                              <Mail className="h-4 w-4 text-brand-500" />
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={cn(
                                  "font-medium text-sm",
                                  !msg.read
                                    ? "text-text-primary"
                                    : "text-text-secondary",
                                )}
                              >
                                {msg.name}
                              </span>
                              {msg.starred && (
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                              )}
                              <span className="text-xs text-text-tertiary hidden sm:inline">
                                {msg.email}
                              </span>
                            </div>
                            <h4
                              className={cn(
                                "text-sm mt-0.5",
                                !msg.read
                                  ? "font-medium text-text-primary"
                                  : "text-text-secondary",
                              )}
                            >
                              {msg.subject}
                            </h4>
                            <p className="text-sm text-text-secondary mt-1 line-clamp-2">
                              {msg.message}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs text-text-tertiary whitespace-nowrap">
                            {formatDate(msg.date)}
                          </span>
                          <button
                            onClick={() => toggleMessageStarred(msg.id)}
                            className="p-1 rounded text-text-tertiary hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                            title={
                              msg.starred
                                ? "Șterge de la favorite"
                                : "Adaugă la favorite"
                            }
                          >
                            <Star
                              className={cn(
                                "h-3.5 w-3.5",
                                msg.starred && "fill-amber-400 text-amber-400",
                              )}
                            />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm("Ștergi acest mesaj?"))
                                deleteMessage(msg.id);
                            }}
                            className="p-1 rounded text-text-tertiary hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors"
                            title="Șterge mesaj"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─── FOOTER Section ─────────────────────────── */}
          {activeSection === "footer" && (
            <div className="max-w-3xl space-y-6 animate-fade-in">
              <SectionHeader
                title="Footer"
                count={1 + footer.columns.length}
              />

              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-border-subtle p-6 space-y-5">
                <FieldRow label="Despre (text footer)" required>
                  <textarea
                    value={footer.about}
                    onChange={(e) =>
                      setFooter({ ...footer, about: e.target.value })
                    }
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none resize-none"
                    placeholder="Textul descriptiv din footer..."
                  />
                </FieldRow>

                <FieldRow label="Copyright">
                  <input
                    type="text"
                    value={footer.copyright}
                    onChange={(e) =>
                      setFooter({ ...footer, copyright: e.target.value })
                    }
                    className="w-full px-4 py-2.5 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                    placeholder="© 2025 NexusDevStudio..."
                  />
                </FieldRow>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-text-primary">
                    Coloane Footer ({footer.columns.length})
                  </h3>
                  <button
                    onClick={addFooterColumn}
                    className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700 font-medium"
                  >
                    <Plus className="h-4 w-4" />
                    Adaugă Coloană
                  </button>
                </div>

                {footer.columns.length === 0 ? (
                  <EmptyState
                    icon={Layers}
                    title="Nicio coloană"
                    description="Adaugă coloane cu linkuri pentru footer."
                    action={{
                      label: "Adaugă Coloană",
                      onClick: addFooterColumn,
                    }}
                  />
                ) : (
                  <div className="space-y-4">
                    {footer.columns.map((col, colIdx) => (
                      <div
                        key={colIdx}
                        className="bg-white dark:bg-neutral-900 rounded-xl border border-border-subtle p-5 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <FieldRow label="Titlu coloană" required>
                            <input
                              type="text"
                              value={col.title}
                              onChange={(e) =>
                                updateFooterColumn(colIdx, e.target.value)
                              }
                              className="w-full px-3 py-2 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                              placeholder="ex: Servicii, Companie"
                            />
                          </FieldRow>
                          <button
                            onClick={() => {
                              if (
                                confirm("Ștergi această coloană și linkurile ei?")
                              )
                                removeFooterColumn(colIdx);
                            }}
                            className="p-1.5 text-danger-500 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded transition-colors ml-3 mt-5"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        <div className="space-y-2 pl-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-text-tertiary">
                              Linkuri ({col.links.length})
                            </span>
                            <button
                              onClick={() => addFooterLink(colIdx)}
                              className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
                            >
                              <Plus className="h-3 w-3" /> Adaugă Link
                            </button>
                          </div>

                          {col.links.length === 0 && (
                            <p className="text-xs text-text-tertiary italic">
                              Niciun link adăugat.
                            </p>
                          )}

                          {col.links.map((link, linkIdx) => (
                            <div
                              key={linkIdx}
                              className="flex items-center gap-2"
                            >
                              <span className="text-xs text-text-tertiary w-4 shrink-0">
                                {linkIdx + 1}.
                              </span>
                              <input
                                type="text"
                                value={link.label}
                                onChange={(e) =>
                                  updateFooterLink(
                                    colIdx,
                                    linkIdx,
                                    "label",
                                    e.target.value,
                                  )
                                }
                                className="flex-1 px-3 py-1.5 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                                placeholder="Label"
                              />
                              <input
                                type="text"
                                value={link.href}
                                onChange={(e) =>
                                  updateFooterLink(
                                    colIdx,
                                    linkIdx,
                                    "href",
                                    e.target.value,
                                  )
                                }
                                className="flex-1 px-3 py-1.5 rounded-lg border border-border-default bg-white dark:bg-neutral-800 text-text-primary text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none font-mono"
                                placeholder="/pagina"
                              />
                              <button
                                onClick={() =>
                                  removeFooterLink(colIdx, linkIdx)
                                }
                                className="p-1 text-danger-500 hover:text-danger-600 rounded transition-colors"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mobile Save FAB */}
        <div className="sm:hidden fixed bottom-6 right-6 z-sticky">
          <button
            onClick={handleSave}
            disabled={saving}
            className={cn(
              "flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-medium transition-all shadow-elevation-4",
              "bg-brand-500 text-white hover:bg-brand-600 active:bg-brand-700",
              "disabled:opacity-60 disabled:cursor-not-allowed",
            )}
          >
            {saving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Se salvează..." : "Salvează"}
          </button>
        </div>
      </div>
    </div>
  );
}
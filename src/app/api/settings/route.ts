/**
 * NexusDevStudio — API Settings
 *
 * GET  /api/settings           → returnează toate setările site-ului (hardcodate inițial)
 * GET  /api/settings?bundle=s1,s2,s3 → calculează preț pachet cu reduceri 20%/40%
 * PUT  /api/settings           → actualizează setări (admin only, simulare)
 */

import { NextRequest, NextResponse } from "next/server";

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

interface Service {
  id: string;
  icon: string;
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
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
  social: {
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    twitter?: string;
    github?: string;
    youtube?: string;
  };
}

interface SEOSettings {
  siteName: string;
  title: string;
  description: string;
  keywords: string;
  ogImage: string;
  googleAnalyticsId: string;
}

interface HeroSection {
  title: string;
  subtitle: string;
  ctaPrimary: string;
  ctaSecondary: string;
  backgroundType: "gradient" | "video" | "image";
  backgroundValue: string;
}

interface SiteSettings {
  hero: HeroSection;
  services: Service[];
  howWeWork: TimelineItem[];
  portfolio: PortfolioItem[];
  faq: FAQItem[];
  contact: ContactInfo;
  seo: SEOSettings;
  footer: {
    about: string;
    copyright: string;
    columns: { title: string; links: { label: string; href: string }[] }[];
  };
}

/** Discount breakdown for a single service in a bundle */
interface ServiceDiscount {
  serviceId: string;
  title: string;
  originalPrice: number;
  discountPercent: number;
  discountAmount: number;
  finalPrice: number;
}

/** Result of bundle price calculation */
interface BundleCalculation {
  services: ServiceDiscount[];
  totalOriginal: number;
  totalDiscount: number;
  totalFinal: number;
  discountTier: "none" | "20%" | "40%";
  bundleSize: number;
}

// ═══════════════════════════════════════════════════════════════════════
// Discount Calculator
// ═══════════════════════════════════════════════════════════════════════

/**
 * Calculează prețul unui pachet de servicii aplicând reducerile:
 *  - 1 serviciu:  preț întreg (0% reducere)
 *  - 2 servicii: 20% reducere la al doilea (cel mai ieftin)
 *  - 3+ servicii: 40% reducere la serviciile suplimentare (toate mai puțin primul, cel mai scump)
 *
 * NOTĂ: Pachetul Complet Digital (s21) are deja preț redus — reducerile
 *        de bundle nu se aplică peste el (este marcat cu popular: true și
 *        prețul este deja final).
 */
function calculateBundle(serviceIds: string[], allServices: Service[]): BundleCalculation {
  // Găsește serviciile cerute, păstrând ordinea în care au fost cerute
  const requested: Service[] = [];
  for (const id of serviceIds) {
    const svc = allServices.find((s) => s.id === id);
    if (svc) {
      requested.push(svc);
    }
  }

  const bundleSize = requested.length;

  // Fără servicii → returnează gol
  if (bundleSize === 0) {
    return {
      services: [],
      totalOriginal: 0,
      totalDiscount: 0,
      totalFinal: 0,
      discountTier: "none",
      bundleSize: 0,
    };
  }

  // 1 serviciu → fără reducere
  if (bundleSize === 1) {
    const svc = requested[0];
    return {
      services: [
        {
          serviceId: svc.id,
          title: svc.title,
          originalPrice: svc.price,
          discountPercent: 0,
          discountAmount: 0,
          finalPrice: svc.price,
        },
      ],
      totalOriginal: svc.price,
      totalDiscount: 0,
      totalFinal: svc.price,
      discountTier: "none",
      bundleSize: 1,
    };
  }

  // Sortează descrescător după preț — cel mai scump primește preț întreg
  const sorted = [...requested].sort((a, b) => b.price - a.price);

  const discountTier = bundleSize === 2 ? "20%" : "40%";
  const discountPercent = bundleSize === 2 ? 20 : 40;

  const serviceDiscounts: ServiceDiscount[] = [];
  let totalOriginal = 0;
  let totalDiscount = 0;
  let totalFinal = 0;

  for (let i = 0; i < sorted.length; i++) {
    const svc = sorted[i];
    const originalPrice = svc.price;

    // Primul (cel mai scump) → preț întreg; restul → reduse
    const discountPct = i === 0 ? 0 : discountPercent;
    const discountAmount = Math.round(originalPrice * (discountPct / 100));
    const finalPrice = originalPrice - discountAmount;

    totalOriginal += originalPrice;
    totalDiscount += discountAmount;
    totalFinal += finalPrice;

    serviceDiscounts.push({
      serviceId: svc.id,
      title: svc.title,
      originalPrice,
      discountPercent: discountPct,
      discountAmount,
      finalPrice,
    });
  }

  return {
    services: serviceDiscounts,
    totalOriginal,
    totalDiscount,
    totalFinal,
    discountTier,
    bundleSize,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Default Settings (Hardcoded)
// ═══════════════════════════════════════════════════════════════════════

const defaultSettings: SiteSettings = {
  hero: {
    title: "Transformăm Idei în Realitate Digitală",
    subtitle:
      "NexusDevStudio este partenerul tău de încredere pentru dezvoltare web, aplicații mobile, AI, eCommerce și automatizări. Livrăm soluții enterprise cu design imersiv și tehnologie de vârf.",
    ctaPrimary: "Începe Proiectul",
    ctaSecondary: "Vezi Serviciile",
    backgroundType: "gradient",
    backgroundValue: "linear-gradient(135deg, hsl(222 75% 50%), hsl(170 75% 44%))",
  },

  // 21 Servicii cu prețuri finale
  services: [
    {
      id: "s1",
      icon: "Globe",
      title: "Website de Prezentare",
      description:
        "Site profesional cu design imersiv, optimizat SEO și performanță maximă. Perfect pentru afaceri mici și PFA-uri.",
      price: 499,
      currency: "EUR",
      category: "Web Development",
      features: [
        "Design responsiv",
        "SEO on-page",
        "Formular de contact",
        "Integrare social media",
        "Hosting 1 an inclus",
      ],
      timeline: "5-7 zile",
    },
    {
      id: "s2",
      icon: "ShoppingCart",
      title: "Magazin Online",
      description:
        "eCommerce complet cu panou de administrare, plăți integrate, gestiune stocuri și optimizare vânzări.",
      price: 1499,
      currency: "EUR",
      category: "eCommerce",
      features: [
        "Catalog produse nelimitat",
        "Coș + checkout",
        "Stripe / PayPal",
        "Panou admin",
        "Rapoarte vânzări",
      ],
      popular: true,
      timeline: "3-4 săptămâni",
    },
    {
      id: "s3",
      icon: "Smartphone",
      title: "Aplicație Mobilă",
      description:
        "Aplicații native iOS & Android sau cross-platform cu React Native. UX impecabil, performanță nativă.",
      price: 2499,
      currency: "EUR",
      category: "Mobile Development",
      features: [
        "iOS + Android",
        "Design nativ",
        "Push notifications",
        "Offline-first",
        "Publicare în store-uri",
      ],
      popular: true,
      timeline: "6-8 săptămâni",
    },
    {
      id: "s4",
      icon: "Palette",
      title: "Design UX/UI",
      description:
        "Design centrat pe utilizator: wireframing, prototipare, design system, user testing și iterații.",
      price: 799,
      currency: "EUR",
      category: "Design",
      features: [
        "Wireframing",
        "Prototipare Figma",
        "Design system",
        "User testing",
        "3 revizii incluse",
      ],
      timeline: "2-3 săptămâni",
    },
    {
      id: "s5",
      icon: "Search",
      title: "SEO & Optimizare",
      description:
        "Audit SEO complet, optimizare on-page, creare conținut, link building și raportare lunară.",
      price: 399,
      currency: "EUR/lună",
      category: "Marketing",
      features: [
        "Audit tehnic",
        "Keyword research",
        "Optimizare on-page",
        "Raport lunar",
        "Monitorizare ranking",
      ],
      timeline: "Contract lunar",
    },
    {
      id: "s6",
      icon: "Bot",
      title: "Chatbot AI",
      description:
        "Asistent AI personalizat pentru site-ul tău, antrenat pe datele tale. Răspunde automat la întrebări 24/7.",
      price: 599,
      currency: "EUR",
      category: "AI Solutions",
      features: [
        "Răspunsuri personalizate",
        "Antrenare pe datele tale",
        "Integrare site",
        "Dashboard analitică",
        "Actualizări lunare",
      ],
      timeline: "2-3 săptămâni",
    },
    {
      id: "s7",
      icon: "Brain",
      title: "Automatizări AI",
      description:
        "Automatizăm procese repetitive cu AI: email-uri, rapoarte, procesare documente, moderare conținut.",
      price: 899,
      currency: "EUR",
      category: "AI Solutions",
      features: [
        "Analiză procese",
        "Workflow personalizat",
        "Integrare API-uri",
        "Dashboard monitorizare",
        "Suport 30 zile",
      ],
      timeline: "3-4 săptămâni",
    },
    {
      id: "s8",
      icon: "Cloud",
      title: "Migrare Cloud",
      description:
        "Migrare infrastructură în cloud (AWS, Azure, GCP) cu zero downtime, securitate și optimizare costuri.",
      price: 1299,
      currency: "EUR",
      category: "DevOps",
      features: [
        "Analiză infrastructură",
        "Plan migrare",
        "Configurare CI/CD",
        "Monitorizare",
        "Documentație",
      ],
      timeline: "2-4 săptămâni",
    },
    {
      id: "s9",
      icon: "Shield",
      title: "Securitate Cibernetică",
      description:
        "Audit de securitate, penetration testing, configurare firewall, monitorizare și răspuns la incidente.",
      price: 999,
      currency: "EUR",
      category: "Security",
      features: [
        "Penetration testing",
        "Scanare vulnerabilități",
        "Configurare WAF",
        "Raport detaliat",
        "Plan remediere",
      ],
      timeline: "2-3 săptămâni",
    },
    {
      id: "s10",
      icon: "BarChart3",
      title: "Dashboard Analytics",
      description:
        "Dashboard interactiv cu metrici custom, integrări multiple surse de date și vizualizări avansate.",
      price: 699,
      currency: "EUR",
      category: "Data & Analytics",
      features: [
        "Conectare surse date",
        "Vizualizări custom",
        "Filtre dinamice",
        "Export PDF/CSV",
        "Actualizare real-time",
      ],
      timeline: "2-3 săptămâni",
    },
    {
      id: "s11",
      icon: "FileText",
      title: "CMS Headless",
      description:
        "Sistem de management al conținutului headless cu API, editor vizual și gestionare multi-limbă.",
      price: 1199,
      currency: "EUR",
      category: "CMS",
      features: [
        "API REST/GraphQL",
        "Editor vizual",
        "Multi-limbă",
        "Media library",
        "Roluri & permisiuni",
      ],
      timeline: "4-6 săptămâni",
    },
    {
      id: "s12",
      icon: "Users",
      title: "Platformă Multi-Tenant",
      description:
        "Aplicație SaaS cu suport multi-tenant, izolare date, facturare per tenant și administrare centralizată.",
      price: 3499,
      currency: "EUR",
      category: "Enterprise",
      features: [
        "Izolare date",
        "Tenant management",
        "Facturare per tenant",
        "White-label",
        "API keys",
      ],
      popular: true,
      timeline: "8-12 săptămâni",
    },
    {
      id: "s13",
      icon: "Layers",
      title: "Progressive Web App",
      description:
        "PWA cu funcționalitate offline, instalare pe mobil, push notifications și performanță nativă.",
      price: 899,
      currency: "EUR",
      category: "Web Development",
      features: [
        "Offline-first",
        "Instalare mobil",
        "Push notifications",
        "Background sync",
        "Lighthouse 95+",
      ],
      timeline: "3-4 săptămâni",
    },
    {
      id: "s14",
      icon: "Zap",
      title: "Optimizare Performanță",
      description:
        "Audit și optimizare viteză site: Core Web Vitals, lazy loading, CDN, compresie, caching avansat.",
      price: 349,
      currency: "EUR",
      category: "Performance",
      features: [
        "Audit Lighthouse",
        "Optimizare imagini",
        "Lazy loading",
        "Cache strategy",
        "Raport înainte/după",
      ],
      timeline: "1 săptămână",
    },
    {
      id: "s15",
      icon: "Database",
      title: "API Development",
      description:
        "API REST/GraphQL custom cu documentație OpenAPI, autentificare JWT, rate limiting și versionare.",
      price: 1299,
      currency: "EUR",
      category: "Backend",
      features: [
        "REST / GraphQL",
        "Autentificare JWT",
        "Rate limiting",
        "Documentație OpenAPI",
        "Webhook-uri",
      ],
      timeline: "3-5 săptămâni",
    },
    {
      id: "s16",
      icon: "Mail",
      title: "Email Marketing",
      description:
        "Configurare infrastructură email: template-uri, automatizări, segmentare, tracking și analytics.",
      price: 449,
      currency: "EUR",
      category: "Marketing",
      features: [
        "Template-uri custom",
        "Automatizări",
        "Segmentare liste",
        "A/B testing",
        "Analitică",
      ],
      timeline: "1-2 săptămâni",
    },
    {
      id: "s17",
      icon: "MessageCircle",
      title: "Live Chat & Support",
      description:
        "Sistem live chat cu chatbot, ticketing, bază de cunoștințe și integrare CRM.",
      price: 549,
      currency: "EUR",
      category: "Communication",
      features: [
        "Live chat",
        "Chatbot AI",
        "Ticketing",
        "Knowledge base",
        "Integrare CRM",
      ],
      timeline: "2-3 săptămâni",
    },
    {
      id: "s18",
      icon: "Video",
      title: "Platformă Video",
      description:
        "Platformă video cu live streaming, încărcare, transcodare, player custom și analytics.",
      price: 2499,
      currency: "EUR",
      category: "Media",
      features: [
        "Live streaming",
        "Transcodare",
        "Player custom",
        "Video analytics",
        "CDN delivery",
      ],
      timeline: "6-8 săptămâni",
    },
    {
      id: "s19",
      icon: "GraduationCap",
      title: "E-Learning Platform",
      description:
        "Platformă de cursuri online cu lecții video, quiz-uri, certificări și progres tracking.",
      price: 1999,
      currency: "EUR",
      category: "Education",
      features: [
        "Cursuri video",
        "Quiz-uri",
        "Certificate",
        "Progres tracking",
        "Forum integrat",
      ],
      timeline: "6-8 săptămâni",
    },
    {
      id: "s20",
      icon: "Calendar",
      title: "Sistem Booking",
      description:
        "Sistem de programări și rezervări cu calendar, notificări, plăți și integrare Google Calendar.",
      price: 699,
      currency: "EUR",
      category: "Business Tools",
      features: [
        "Calendar integrat",
        "Notificări email/SMS",
        "Plăți online",
        "Google Calendar sync",
        "Rapoarte",
      ],
      timeline: "2-3 săptămâni",
    },
    {
      id: "s21",
      icon: "Package",
      title: "Pachet Complet Digital",
      description:
        "Website + Magazin Online + Aplicație Mobilă + SEO + Marketing — soluția completă pentru business-ul tău.",
      price: 3999,
      currency: "EUR",
      category: "Enterprise",
      features: [
        "Website + Shop + App",
        "SEO complet",
        "Email marketing",
        "Social media setup",
        "Suport 3 luni",
      ],
      popular: true,
      timeline: "10-14 săptămâni",
    },
  ],

  howWeWork: [
    {
      id: "hw1",
      step: 1,
      title: "Consultare & Analiză",
      description:
        "Discutăm obiectivele tale, analizăm piața și competitorii, definim cerințele și stabilim un plan de acțiune.",
      icon: "MessageSquare",
    },
    {
      id: "hw2",
      step: 2,
      title: "Strategie & Planificare",
      description:
        "Creăm arhitectura soluției, wireframe-uri, roadmap-ul de dezvoltare și estimăm timeline-ul.",
      icon: "Compass",
    },
    {
      id: "hw3",
      step: 3,
      title: "Design & Prototipare",
      description:
        "Design UX/UI imersiv, prototip interactiv în Figma, feedback loop cu tine până la aprobare.",
      icon: "Palette",
    },
    {
      id: "hw4",
      step: 4,
      title: "Dezvoltare Agile",
      description:
        "Implementare iterativă cu sprint-uri săptămânale, code review, testare continuă și demo-uri periodice.",
      icon: "Code2",
    },
    {
      id: "hw5",
      step: 5,
      title: "Testare & QA",
      description:
        "Testare manuală și automată, verificare cross-browser, testare performanță și securitate.",
      icon: "CheckCircle2",
    },
    {
      id: "hw6",
      step: 6,
      title: "Lansare & Suport",
      description:
        "Deployment în producție, monitorizare, suport post-lansare și optimizare continuă.",
      icon: "Rocket",
    },
  ],

  portfolio: [
    {
      id: "p1",
      title: "EcoShop — Magazin Online Sustenabil",
      category: "eCommerce",
      image: "/portfolio/ecoshop.jpg",
      description:
        "Platformă eCommerce completă pentru produse eco-friendly, cu peste 10.000 de produse, integrări ERP și temă custom.",
      tags: ["Next.js", "Stripe", "PostgreSQL", "Redis"],
    },
    {
      id: "p2",
      title: "MediApp — Aplicație pentru Clinici",
      category: "Mobile",
      image: "/portfolio/mediapp.jpg",
      description:
        "Aplicație mobilă pentru gestionarea programărilor, fișelor medicale și comunicării medic-pacient.",
      tags: ["React Native", "Node.js", "HIPAA", "WebSockets"],
    },
    {
      id: "p3",
      title: "FinDash — Dashboard Financiar",
      category: "Dashboard",
      image: "/portfolio/findash.jpg",
      description:
        "Dashboard financiar interactiv cu date real-time, grafice avansate și export de rapoarte personalizate.",
      tags: ["React", "D3.js", "Python", "AWS"],
    },
    {
      id: "p4",
      title: "LearnHub — Platformă E-Learning",
      category: "Education",
      image: "/portfolio/learnhub.jpg",
      description:
        "Platformă de cursuri online cu 50.000+ utilizatori, video streaming, certificări și gamification.",
      tags: ["Next.js", "GraphQL", "Mux", "PostgreSQL"],
    },
    {
      id: "p5",
      title: "FoodDash — Aplicație Food Delivery",
      category: "Mobile",
      image: "/portfolio/fooddash.jpg",
      description:
        "Aplicație de food delivery cu tracking în timp real, sistem de review-uri și recomandări AI.",
      tags: ["React Native", "Firebase", "AI", "Google Maps"],
    },
    {
      id: "p6",
      title: "ConstructPro — ERP Construcții",
      category: "Enterprise",
      image: "/portfolio/constructpro.jpg",
      description:
        "ERP complet pentru industria construcțiilor: gestiune proiecte, materiale, echipe și facturare.",
      tags: ["Angular", ".NET", "SQL Server", "Azure"],
    },
  ],

  faq: [
    {
      id: "f1",
      question: "Cât durează dezvoltarea unui website?",
      answer:
        "Un website de prezentare durează 5-7 zile, un magazin online 3-4 săptămâni, iar o platformă complexă 8-12 săptămâni, în funcție de cerințe. Oferim estimări precise după consultarea inițială gratuită.",
    },
    {
      id: "f2",
      question: "Oferiți reduceri pentru pachete multiple?",
      answer:
        "Da! La achiziția a 2 servicii, beneficiezi de 20% reducere la al doilea. La 3 sau mai multe servicii, reducerea este de 40% la serviciile suplimentare. Pachetul Complet Digital include deja cele mai mari reduceri.",
    },
    {
      id: "f3",
      question: "Ce tehnologii folosiți?",
      answer:
        "Folosim tehnologii moderne: Next.js, React, TypeScript, Node.js, PostgreSQL, Redis, AWS, Docker. Pentru mobile: React Native și Flutter. Pentru AI: OpenAI, Anthropic, Google AI. Adaptăm stack-ul la nevoile proiectului.",
    },
    {
      id: "f4",
      question: "Oferiți suport după lansare?",
      answer:
        "Da, oferim suport post-lansare inclus în preț (perioada variază per serviciu). Ulterior, poți opta pentru contracte de mentenanță lunară cu timp de răspuns garantat și actualizări periodice.",
    },
    {
      id: "f5",
      question: "Cum funcționează procesul de plată?",
      answer:
        "Plata se face în tranșe: 50% avans la semnarea contractului, 25% la jumătatea proiectului, 25% la livrare. Acceptăm plăți prin transfer bancar, card sau PayPal. Emitem factură fiscală pentru fiecare tranșă.",
    },
    {
      id: "f6",
      question: "Pot solicita modificări după ce proiectul este terminat?",
      answer:
        "Da, modificările minore sunt incluse în perioada de garanție post-lansare. Pentru modificări majore sau funcționalități noi, oferim estimări separate și le implementăm ca proiecte adiționale.",
    },
    {
      id: "f7",
      question: "Cine deține codul sursă și drepturile?",
      answer:
        "Tu deții 100% din codul sursă și drepturile de proprietate intelectuală la finalizarea proiectului și plata integrală. Livrăm codul într-un repository Git privat, împreună cu documentația completă.",
    },
    {
      id: "f8",
      question: "Oferiți garanție pentru serviciile prestate?",
      answer:
        "Da, oferim garanție 30-90 de zile (în funcție de complexitate) pentru bug-uri și probleme tehnice. În această perioadă, remediem gratuit orice problemă care nu este cauzată de modificări externe.",
    },
  ],

  contact: {
    email: "contact@nexusdevstudio.ro",
    phone: "+40 700 000 000",
    address: "București, România — Disponibil Remote în toată țara",
    social: {
      facebook: "https://facebook.com/nexusdevstudio",
      instagram: "https://instagram.com/nexusdevstudio",
      linkedin: "https://linkedin.com/company/nexusdevstudio",
      github: "https://github.com/nexusdevstudio",
    },
  },

  seo: {
    siteName: "NexusDevStudio",
    title: "NexusDevStudio — Agenție Digitală Enterprise | Web, Mobile, AI",
    description:
      "NexusDevStudio: dezvoltare web, aplicații mobile, AI, eCommerce, automatizări. Soluții digitale complete pentru business-ul tău. Consultanță gratuită!",
    keywords:
      "dezvoltare web, aplicații mobile, AI, eCommerce, automatizări, design UX/UI, Next.js, React, agenție digitală, NexusDevStudio",
    ogImage: "/og-image.jpg",
    googleAnalyticsId: "G-XXXXXXXXXX",
  },

  footer: {
    about:
      "NexusDevStudio este o agenție digitală enterprise care transformă idei în produse digitale de impact. Suntem specializați în dezvoltare web, aplicații mobile, AI, eCommerce și automatizări.",
    copyright: `© ${new Date().getFullYear()} NexusDevStudio. Toate drepturile rezervate.`,
    columns: [
      {
        title: "Servicii",
        links: [
          { label: "Website de Prezentare", href: "/servicii#website" },
          { label: "Magazin Online", href: "/servicii#ecommerce" },
          { label: "Aplicație Mobilă", href: "/servicii#mobile" },
          { label: "Design UX/UI", href: "/servicii#design" },
          { label: "AI & Automatizări", href: "/servicii#ai" },
        ],
      },
      {
        title: "Companie",
        links: [
          { label: "Despre Noi", href: "/despre" },
          { label: "Portofoliu", href: "/portofoliu" },
          { label: "Blog", href: "/blog" },
          { label: "Cariere", href: "/cariere" },
          { label: "Contact", href: "/contact" },
        ],
      },
      {
        title: "Legal",
        links: [
          { label: "Termeni și Condiții", href: "/termeni" },
          { label: "Politica de Confidențialitate", href: "/confidentialitate" },
          { label: "Politica Cookies", href: "/cookies" },
          { label: "GDPR", href: "/gdpr" },
        ],
      },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════
// In-memory store (would be DB in production)
// ═══════════════════════════════════════════════════════════════════════

let siteSettings: SiteSettings = { ...defaultSettings };

// ═══════════════════════════════════════════════════════════════════════
// GET /api/settings
// ═══════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bundleParam = searchParams.get("bundle");

    // Dacă se cere un pachet (?bundle=s1,s2,s3), calculează reducerile
    if (bundleParam) {
      const serviceIds = bundleParam
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean);

      if (serviceIds.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "Parametrul 'bundle' trebuie să conțină cel puțin un ID de serviciu valid.",
            },
          },
          { status: 400 },
        );
      }

      const bundle = calculateBundle(serviceIds, siteSettings.services);

      return NextResponse.json(
        {
          success: true,
          data: {
            bundle,
            discountPolicy: {
              "1 serviciu": "preț întreg (0% reducere)",
              "2 servicii": "20% reducere la al doilea serviciu (cel mai ieftin)",
              "3+ servicii": "40% reducere la serviciile suplimentare (toate mai puțin primul, cel mai scump)",
              notă: "Pachetul Complet Digital (s21) include deja preț redus — reducerile de bundle nu se aplică peste el.",
            },
          },
          meta: {
            serviceCount: siteSettings.services.length,
            bundleSize: bundle.bundleSize,
          },
        },
        {
          status: 200,
          headers: {
            "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120",
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Fără bundle → returnează toate setările
    return NextResponse.json(
      {
        success: true,
        data: siteSettings,
        meta: {
          serviceCount: siteSettings.services.length,
          portfolioCount: siteSettings.portfolio.length,
          faqCount: siteSettings.faq.length,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "A apărut o eroare la obținerea setărilor.",
        },
      },
      { status: 500 },
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// PUT /api/settings
// ═══════════════════════════════════════════════════════════════════════

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Basic validation
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Body-ul trebuie să fie un obiect JSON valid.",
          },
        },
        { status: 400 },
      );
    }

    // Merge with existing settings (partial update)
    siteSettings = {
      ...siteSettings,
      ...body,
      // Deep merge for nested objects
      hero: { ...siteSettings.hero, ...(body.hero || {}) },
      contact: { ...siteSettings.contact, ...(body.contact || {}) },
      seo: { ...siteSettings.seo, ...(body.seo || {}) },
      footer: { ...siteSettings.footer, ...(body.footer || {}) },
      // Arrays are replaced, not merged
      services: body.services || siteSettings.services,
      howWeWork: body.howWeWork || siteSettings.howWeWork,
      portfolio: body.portfolio || siteSettings.portfolio,
      faq: body.faq || siteSettings.faq,
    };

    // In production: save to database
    // await db.siteSettings.upsert(...)

    return NextResponse.json(
      {
        success: true,
        data: siteSettings,
        message: "Setările au fost actualizate cu succes.",
      },
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "A apărut o eroare la actualizarea setărilor.",
        },
      },
      { status: 500 },
    );
  }
}
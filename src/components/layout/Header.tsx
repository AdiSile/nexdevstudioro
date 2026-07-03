"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  createContext,
  useContext,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import {
  Search,
  Bell,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  User,
  Settings,
  LogOut,
  HelpCircle,
  Moon,
  Sun,
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Users,
  BarChart3,
  Package,
  Shield,
  LifeBuoy,
  BookOpen,
  Zap,
} from "lucide-react";
import { SearchInput, type SearchSuggestion } from "@/components/ui/SearchInput";
import { Dropdown } from "@/components/ui/Dropdown";

// ═══════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════

const MOBILE_BREAKPOINT = 1024;
const DRAWER_TRANSITION_MS = 300;
const SCROLL_THRESHOLD = 10;
const NOTIFICATIONS_POLL_INTERVAL = 30_000;

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export type HeaderVariant = "default" | "transparent" | "colored";

export interface NavItem {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** URL or path */
  href?: string;
  /** Icon component (optional) */
  icon?: React.ReactNode;
  /** Mark as active */
  active?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Badge text (e.g., "New", count) */
  badge?: string;
  /** Children for mega menu / submenu */
  children?: NavItem[];
  /** Description shown in mega menu */
  description?: string;
  /** External link indicator */
  external?: boolean;
  /** Click handler */
  onClick?: () => void;
}

export interface MegaMenuGroup {
  /** Group label */
  label: string;
  /** Group items */
  items: NavItem[];
  /** Optional icon for the group */
  icon?: React.ReactNode;
}

export interface MegaMenuConfig {
  /** Which nav item triggers this mega menu (by id) */
  triggerId: string;
  /** Groups of links in the mega menu */
  groups: MegaMenuGroup[];
  /** Optional featured card inside mega menu */
  featured?: {
    title: string;
    description: string;
    image?: string;
    cta?: { label: string; href: string };
  };
}

export interface NotificationItem {
  id: string;
  title: string;
  description?: string;
  timestamp: Date | string;
  read: boolean;
  type?: "info" | "warning" | "success" | "error";
  href?: string;
  onClick?: () => void;
}

export interface UserMenuConfig {
  /** User display name */
  displayName: string;
  /** User email */
  email?: string;
  /** Avatar URL */
  avatarUrl?: string;
  /** Avatar initials fallback */
  initials?: string;
  /** Custom menu items above defaults */
  items?: NavItem[];
  /** Custom footer items below separator */
  footerItems?: NavItem[];
}

export interface HeaderProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  // ── Core ──────────────────────────────────────────────────────
  /** Visual variant */
  variant?: HeaderVariant;
  /** Logo element or URL */
  logo?: React.ReactNode;
  /** Logo href */
  logoHref?: string;

  // ── Navigation ────────────────────────────────────────────────
  /** Top-level navigation items */
  navItems?: NavItem[];
  /** Mega menu configurations */
  megaMenus?: MegaMenuConfig[];
  /** Active nav item id */
  activeNavId?: string;
  /** Called when a nav item is clicked */
  onNavItemClick?: (item: NavItem, event: React.MouseEvent) => void;

  // ── Search ────────────────────────────────────────────────────
  /** Show search bar */
  showSearch?: boolean;
  /** Search suggestions */
  searchSuggestions?: SearchSuggestion[];
  /** Called when user searches */
  onSearch?: (query: string) => void;
  /** Called when a suggestion is selected */
  onSearchSuggestionSelect?: (suggestion: SearchSuggestion) => void;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Enable recent searches in search bar */
  enableRecentSearch?: boolean;

  // ── Notifications ─────────────────────────────────────────────
  /** Show notifications bell */
  showNotifications?: boolean;
  /** Notification items */
  notifications?: NotificationItem[];
  /** Unread notification count */
  unreadCount?: number;
  /** Called when a notification is clicked */
  onNotificationClick?: (notification: NotificationItem) => void;
  /** Called when "Mark all as read" is clicked */
  onNotificationsMarkAllRead?: () => void;
  /** Called when notification bell is clicked */
  onNotificationBellClick?: () => void;

  // ── User Menu ─────────────────────────────────────────────────
  /** Show user menu */
  showUserMenu?: boolean;
  /** User menu configuration */
  userMenuConfig?: UserMenuConfig;
  /** Called when user menu items are clicked */
  onUserMenuItemClick?: (item: NavItem, event: React.MouseEvent) => void;
  /** Called on logout */
  onLogout?: () => void;

  // ── Theme ─────────────────────────────────────────────────────
  /** Show theme toggle */
  showThemeToggle?: boolean;
  /** Current theme (light / dark) */
  theme?: "light" | "dark";
  /** Called when theme is toggled */
  onThemeToggle?: () => void;

  // ── Mobile ────────────────────────────────────────────────────
  /** Custom mobile menu content (overrides auto-generation from navItems) */
  mobileMenuContent?: React.ReactNode;
  /** Breakpoint for mobile drawer (px). Default: 1024 */
  mobileBreakpoint?: number;

  // ── Behaviour ─────────────────────────────────────────────────
  /** Fix header to top on scroll */
  sticky?: boolean;
  /** Add border at bottom */
  bordered?: boolean;
  /** Maximum width for header content */
  maxWidth?: "full" | "container";
  /** Custom class for header wrapper */
  className?: string;
  /** Custom class for header inner content */
  innerClassName?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// Variant Styles
// ═══════════════════════════════════════════════════════════════════════

const headerVariants = cva(
  [
    "relative z-sticky w-full",
    "transition-all duration-300",
    "bg-surface",
  ],
  {
    variants: {
      variant: {
        default: [
          "bg-surface",
          "border-b border-border-subtle",
        ],
        transparent: [
          "bg-transparent",
          "border-b border-transparent",
          "absolute top-0 left-0",
        ],
        colored: [
          "bg-gradient-brand",
          "border-b border-brand-600/20",
          "text-text-inverse",
        ],
      },
      sticky: {
        true: "sticky top-0",
        false: "",
      },
      bordered: {
        true: "border-b border-border-subtle",
        false: "",
      },
      scrolled: {
        true: "shadow-elevation-2",
        false: "",
      },
    },
    compoundVariants: [
      {
        variant: "transparent",
        scrolled: true,
        class: "bg-surface/95 backdrop-blur-md border-b border-border-subtle",
      },
    ],
    defaultVariants: {
      variant: "default",
      sticky: true,
      bordered: true,
    },
  },
);

const navLinkVariants = cva(
  [
    "relative inline-flex items-center gap-1.5",
    "px-3 py-2 rounded-md",
    "text-sm font-medium",
    "transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-border-focus focus-visible:ring-offset-2",
  ],
  {
    variants: {
      variant: {
        default: [
          "text-text-secondary",
          "hover:text-text-primary hover:bg-surface-secondary",
        ],
        transparent: [
          "text-text-secondary",
          "hover:text-text-primary hover:bg-surface-secondary/80",
        ],
        colored: [
          "text-brand-100/90",
          "hover:text-white hover:bg-brand-600/40",
        ],
      },
      active: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        variant: "default",
        active: true,
        class: "text-brand-600 bg-brand-50 font-semibold",
      },
      {
        variant: "transparent",
        active: true,
        class: "text-brand-600 bg-brand-50/80 font-semibold",
      },
      {
        variant: "colored",
        active: true,
        class: "text-white bg-brand-600/50 font-semibold",
      },
    ],
    defaultVariants: {
      variant: "default",
      active: false,
    },
  },
);

const iconButtonVariants = cva(
  [
    "relative inline-flex items-center justify-center",
    "rounded-md",
    "transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-border-focus focus-visible:ring-offset-2",
  ],
  {
    variants: {
      variant: {
        default: [
          "text-text-secondary",
          "hover:text-text-primary hover:bg-surface-secondary",
        ],
        transparent: [
          "text-text-secondary",
          "hover:text-text-primary hover:bg-surface-secondary/80",
        ],
        colored: [
          "text-brand-100/90",
          "hover:text-white hover:bg-brand-600/40",
        ],
      },
      size: {
        sm: "h-8 w-8",
        md: "h-9 w-9",
        lg: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

// ═══════════════════════════════════════════════════════════════════════
// Context
// ═══════════════════════════════════════════════════════════════════════

type HeaderContextValue = {
  variant: HeaderVariant;
  activeNavId: string | undefined;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  megaMenuOpen: string | null;
  setMegaMenuOpen: (id: string | null) => void;
};

const HeaderContext = createContext<HeaderContextValue | null>(null);

function useHeaderContext() {
  const ctx = useContext(HeaderContext);
  if (!ctx) {
    throw new Error("Header compound components must be used within <Header>.");
  }
  return ctx;
}

function useOptionalHeaderContext() {
  return useContext(HeaderContext);
}

// ═══════════════════════════════════════════════════════════════════════
// useScrollPosition
// ═══════════════════════════════════════════════════════════════════════

function useScrollPosition() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => {
      setScrolled(window.scrollY > SCROLL_THRESHOLD);
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return scrolled;
}

// ═══════════════════════════════════════════════════════════════════════
// useMediaQuery
// ═══════════════════════════════════════════════════════════════════════

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    setMatches(mql.matches);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

// ═══════════════════════════════════════════════════════════════════════
// useLockScroll
// ═══════════════════════════════════════════════════════════════════════

function useLockScroll(locked: boolean) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (locked) {
      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      const orig = document.body.style.overflow;
      const origPad = document.body.style.paddingRight;
      document.body.style.overflow = "hidden";
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }
      return () => {
        document.body.style.overflow = orig;
        document.body.style.paddingRight = origPad;
      };
    }
  }, [locked]);
}

// ═══════════════════════════════════════════════════════════════════════
// formatTimestamp
// ═══════════════════════════════════════════════════════════════════════

function formatTimestamp(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHrs = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "Acum";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHrs < 24) return `${diffHrs}h`;
  if (diffDays < 7) return `${diffDays}z`;
  return d.toLocaleDateString("ro-RO", { day: "numeric", month: "short" });
}

// ═══════════════════════════════════════════════════════════════════════
// mergeRefs
// ═══════════════════════════════════════════════════════════════════════

function mergeRefs<T>(
  ...refs: Array<
    React.Ref<T> | React.MutableRefObject<T | null> | null | undefined
  >
): React.RefCallback<T> {
  return (value: T) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref != null && "current" in ref) {
        (ref as React.MutableRefObject<T | null>).current = value;
      }
    });
  };
}

// =====================================================================
// HEADER
// =====================================================================

const Header = forwardRef<HTMLElement, HeaderProps>((props, ref) => {
  const {
    variant = "default",
    logo,
    logoHref = "/",
    navItems = [],
    megaMenus = [],
    activeNavId,
    onNavItemClick,
    showSearch = true,
    searchSuggestions = [],
    onSearch,
    onSearchSuggestionSelect,
    searchPlaceholder = "Căutare...",
    enableRecentSearch = true,
    showNotifications = true,
    notifications = [],
    unreadCount: unreadCountProp,
    onNotificationClick,
    onNotificationsMarkAllRead,
    onNotificationBellClick,
    showUserMenu = true,
    userMenuConfig,
    onUserMenuItemClick,
    onLogout,
    showThemeToggle = true,
    theme: themeProp,
    onThemeToggle,
    mobileMenuContent,
    mobileBreakpoint = MOBILE_BREAKPOINT,
    sticky = true,
    bordered = true,
    maxWidth = "container",
    className,
    innerClassName,
    ...rest
  } = props;

  // ── Refs ──────────────────────────────────────────────────────
  const headerRef = useRef<HTMLElement>(null);
  const megaMenuContainerRef = useRef<HTMLDivElement>(null);

  // ── State ─────────────────────────────────────────────────────
  const scrolled = useScrollPosition();
  const isMobile = useMediaQuery(`(max-width: ${mobileBreakpoint - 1}px)`);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaMenuOpen, setMegaMenuOpen] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);

  // Derived unread count
  const unreadCount =
    unreadCountProp ?? notifications.filter((n) => !n.read).length;

  // Lock scroll when mobile menu open
  useLockScroll(mobileOpen && isMobile);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  // Close mega menu on click outside
  useEffect(() => {
    if (!megaMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        megaMenuContainerRef.current &&
        !megaMenuContainerRef.current.contains(e.target as Node)
      ) {
        setMegaMenuOpen(null);
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handler);
    };
  }, [megaMenuOpen]);

  // Close mega menu on Escape
  useEffect(() => {
    if (!megaMenuOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMegaMenuOpen(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [megaMenuOpen]);

  // ── Handlers ──────────────────────────────────────────────────

  const handleNavItemClick = useCallback(
    (item: NavItem, e: React.MouseEvent) => {
      onNavItemClick?.(item, e);

      if (item.children && item.children.length > 0) {
        // Toggle mega menu
        setMegaMenuOpen((prev) => (prev === item.id ? null : item.id));
      } else {
        setMegaMenuOpen(null);
      }

      if (isMobile) {
        setMobileOpen(false);
      }
    },
    [onNavItemClick, isMobile],
  );

  const handleMobileToggle = useCallback(() => {
    setMobileOpen((prev) => !prev);
    setMegaMenuOpen(null);
  }, []);

  const handleMobileClose = useCallback(() => {
    setMobileOpen(false);
  }, []);

  const megaMenuForItem = useCallback(
    (itemId: string): MegaMenuConfig | undefined => {
      return megaMenus.find((m) => m.triggerId === itemId);
    },
    [megaMenus],
  );

  // ── Context ───────────────────────────────────────────────────
  const ctx: HeaderContextValue = {
    variant,
    activeNavId,
    mobileOpen,
    setMobileOpen,
    megaMenuOpen,
    setMegaMenuOpen,
  };

  // ── Derived classes ───────────────────────────────────────────
  const headerClassName = cn(
    headerVariants({
      variant: variant === "transparent" ? "transparent" : variant === "colored" ? "colored" : "default",
      sticky,
      bordered: variant === "default" ? bordered : undefined,
      scrolled: variant === "transparent" ? scrolled : undefined,
    }),
    className,
  );

  const innerClass = cn(
    "flex items-center gap-4",
    "h-header",
    maxWidth === "container" && "container",
    maxWidth === "full" && "px-gutter lg:px-gutter-lg",
    innerClassName,
  );

  const iconBtnVariant = variant === "colored" ? "colored" : variant === "transparent" ? "transparent" : "default";

  // ── Render ────────────────────────────────────────────────────

  return (
    <HeaderContext.Provider value={ctx}>
      <header
        ref={mergeRefs(ref, headerRef)}
        data-header=""
        data-variant={variant}
        data-scrolled={scrolled ? "" : undefined}
        data-mobile-open={mobileOpen ? "" : undefined}
        className={headerClassName}
        {...rest}
      >
        <div className={innerClass}>
          {/* ── Logo ──────────────────────────────────────── */}
          <a
            href={logoHref}
            className="flex shrink-0 items-center gap-2 py-2 mr-2"
            aria-label="Acasă"
          >
            {logo ?? (
              <span
                className={cn(
                  "text-xl font-bold tracking-tight",
                  variant === "colored"
                    ? "text-white"
                    : "text-text-primary",
                )}
              >
                Nexus
              </span>
            )}
          </a>

          {/* ── Desktop Navigation ───────────────────────── */}
          {!isMobile && navItems.length > 0 && (
            <nav
              className="hidden lg:flex items-center gap-0.5 ml-2"
              aria-label="Navigare principală"
            >
              {navItems.map((item) => {
                const hasMega = !!megaMenuForItem(item.id);
                const hasChildren = !!(item.children && item.children.length > 0);
                const isActive = activeNavId
                  ? item.id === activeNavId
                  : item.active;
                const isMegaOpen = megaMenuOpen === item.id;

                return (
                  <div key={item.id} className="relative">
                    <button
                      type="button"
                      disabled={item.disabled}
                      onClick={(e) => handleNavItemClick(item, e)}
                      className={cn(
                        navLinkVariants({ variant, active: isActive }),
                        isMegaOpen && "bg-surface-secondary",
                        item.disabled && "opacity-50 cursor-not-allowed",
                      )}
                      aria-current={isActive ? "page" : undefined}
                      aria-expanded={
                        hasMega || hasChildren ? isMegaOpen : undefined
                      }
                      aria-haspopup={
                        hasMega || hasChildren ? "menu" : undefined
                      }
                    >
                      {item.icon && (
                        <span className="shrink-0" aria-hidden="true">
                          {item.icon}
                        </span>
                      )}
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500 text-white leading-none">
                          {item.badge}
                        </span>
                      )}
                      {(hasMega || hasChildren) && (
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 transition-transform duration-200",
                            isMegaOpen && "rotate-180",
                          )}
                          aria-hidden="true"
                        />
                      )}
                    </button>
                  </div>
                );
              })}
            </nav>
          )}

          {/* ── Spacer ───────────────────────────────────── */}
          <div className="flex-1" />

          {/* ── Search ────────────────────────────────────── */}
          {showSearch && !isMobile && (
            <div className="hidden md:block w-full max-w-[280px] lg:max-w-[320px] xl:max-w-[360px]">
              <SearchInput
                placeholder={searchPlaceholder}
                suggestions={searchSuggestions}
                onSearch={onSearch}
                onSuggestionSelect={onSearchSuggestionSelect}
                enableRecent={enableRecentSearch}
                inputSize="sm"
                variant={variant === "colored" ? "filled" : "default"}
                showClearButton
              />
            </div>
          )}

          {/* ── Theme Toggle ─────────────────────────────── */}
          {showThemeToggle && (
            <button
              type="button"
              onClick={onThemeToggle}
              className={cn(
                iconButtonVariants({ variant: iconBtnVariant, size: "md" }),
                "shrink-0",
              )}
              aria-label={
                themeProp === "dark"
                  ? "Comută la tema luminoasă"
                  : "Comută la tema întunecată"
              }
            >
              {themeProp === "dark" ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          )}

          {/* ── Notifications ────────────────────────────── */}
          {showNotifications && (
            <Dropdown
              open={notifOpen}
              onOpenChange={(open) => {
                setNotifOpen(open);
                if (open) onNotificationBellClick?.();
              }}
              closeOnSelect={false}
              align="end"
            >
              <Dropdown.Trigger showChevron={false}>
                <span
                  className={cn(
                    iconButtonVariants({ variant: iconBtnVariant, size: "md" }),
                    "relative shrink-0",
                  )}
                  aria-label="Notificări"
                >
                  <Bell className="h-4 w-4" aria-hidden="true" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-danger-500 text-[10px] font-bold text-white leading-none ring-2 ring-surface">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </span>
              </Dropdown.Trigger>

              <Dropdown.Menu
                aria-label="Notificări"
                align="end"
                className="w-[360px] max-h-[480px]"
              >
                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
                  <h3 className="text-sm font-semibold text-text-primary">
                    Notificări
                  </h3>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={onNotificationsMarkAllRead}
                      className="text-xs text-brand-600 hover:text-brand-700 font-medium transition-colors"
                    >
                      Marchează tot ca citit
                    </button>
                  )}
                </div>

                {/* List */}
                <div className="overflow-y-auto max-h-[380px]">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                      <Bell className="h-10 w-10 text-text-tertiary mb-3" />
                      <p className="text-sm text-text-secondary">
                        Nicio notificare
                      </p>
                      <p className="text-xs text-text-tertiary mt-1">
                        Notificările noi vor apărea aici.
                      </p>
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <button
                        key={notif.id}
                        type="button"
                        onClick={() => {
                          onNotificationClick?.(notif);
                          notif.onClick?.();
                        }}
                        className={cn(
                          "w-full text-left px-3 py-3",
                          "flex items-start gap-3",
                          "transition-colors duration-100",
                          "hover:bg-surface-secondary",
                          "focus-visible:outline-none focus-visible:bg-surface-secondary",
                          !notif.read && "bg-brand-50/50",
                        )}
                      >
                        {/* Dot */}
                        <span className="shrink-0 mt-1.5">
                          <span
                            className={cn(
                              "block h-2 w-2 rounded-full",
                              !notif.read
                                ? "bg-brand-500"
                                : "bg-transparent",
                            )}
                            aria-hidden="true"
                          />
                        </span>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              "text-sm",
                              !notif.read
                                ? "font-medium text-text-primary"
                                : "text-text-secondary",
                            )}
                          >
                            {notif.title}
                          </p>
                          {notif.description && (
                            <p className="text-xs text-text-tertiary mt-0.5 line-clamp-2">
                              {notif.description}
                            </p>
                          )}
                          <p className="text-[10px] text-text-tertiary mt-1">
                            {formatTimestamp(notif.timestamp)}
                          </p>
                        </div>

                        {/* Type indicator */}
                        {notif.type && (
                          <span
                            className={cn(
                              "shrink-0 mt-1 h-1.5 w-1.5 rounded-full",
                              notif.type === "success" && "bg-success-500",
                              notif.type === "warning" && "bg-warning-500",
                              notif.type === "error" && "bg-danger-500",
                              notif.type === "info" && "bg-info-500",
                            )}
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    ))
                  )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                  <div className="border-t border-border-subtle px-3 py-2">
                    <a
                      href="/notifications"
                      className="block text-center text-xs text-brand-600 hover:text-brand-700 font-medium transition-colors"
                    >
                      Vezi toate notificările
                    </a>
                  </div>
                )}
              </Dropdown.Menu>
            </Dropdown>
          )}

          {/* ── User Menu ────────────────────────────────── */}
          {showUserMenu && userMenuConfig && (
            <Dropdown align="end">
              <Dropdown.Trigger showChevron={false}>
                <span className="flex items-center gap-2 shrink-0">
                  {/* Avatar */}
                  <span className="relative flex shrink-0">
                    {userMenuConfig.avatarUrl ? (
                      <img
                        src={userMenuConfig.avatarUrl}
                        alt={userMenuConfig.displayName}
                        className="h-8 w-8 rounded-full object-cover ring-2 ring-border-subtle"
                      />
                    ) : (
                      <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-brand-500 text-white text-sm font-semibold ring-2 ring-border-subtle">
                        {userMenuConfig.initials ??
                          userMenuConfig.displayName
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .slice(0, 2)
                            .toUpperCase()}
                      </span>
                    )}
                  </span>

                  {/* Name (hidden on small) */}
                  <span className="hidden lg:flex flex-col items-start text-sm">
                    <span className="font-medium text-text-primary leading-tight">
                      {userMenuConfig.displayName}
                    </span>
                    {userMenuConfig.email && (
                      <span className="text-xs text-text-tertiary leading-tight">
                        {userMenuConfig.email}
                      </span>
                    )}
                  </span>

                  <ChevronDown
                    className="hidden lg:block h-3.5 w-3.5 text-text-tertiary"
                    aria-hidden="true"
                  />
                </span>
              </Dropdown.Trigger>

              <Dropdown.Menu aria-label="Meniu utilizator" align="end" className="w-56">
                {/* User info header */}
                <div className="px-3 py-2 border-b border-border-subtle">
                  <p className="text-sm font-medium text-text-primary truncate">
                    {userMenuConfig.displayName}
                  </p>
                  {userMenuConfig.email && (
                    <p className="text-xs text-text-tertiary truncate">
                      {userMenuConfig.email}
                    </p>
                  )}
                </div>

                {/* Custom items */}
                {userMenuConfig.items?.map((item) => (
                  <Dropdown.Item
                    key={item.id}
                    disabled={item.disabled}
                    iconLeft={item.icon}
                    onClick={(e) => {
                      onUserMenuItemClick?.(item, e as unknown as React.MouseEvent);
                      item.onClick?.();
                    }}
                  >
                    {item.label}
                  </Dropdown.Item>
                ))}

                {/* Default items if no custom provided */}
                {(!userMenuConfig.items || userMenuConfig.items.length === 0) && (
                  <>
                    <Dropdown.Item iconLeft={<User className="h-4 w-4" />}>
                      Profil
                    </Dropdown.Item>
                    <Dropdown.Item
                      iconLeft={<LayoutDashboard className="h-4 w-4" />}
                    >
                      Dashboard
                    </Dropdown.Item>
                    <Dropdown.Item
                      iconLeft={<Settings className="h-4 w-4" />}
                    >
                      Setări
                    </Dropdown.Item>
                    <Dropdown.Item
                      iconLeft={<HelpCircle className="h-4 w-4" />}
                    >
                      Ajutor
                    </Dropdown.Item>
                  </>
                )}

                <Dropdown.Separator />

                {/* Custom footer items */}
                {userMenuConfig.footerItems?.map((item) => (
                  <Dropdown.Item
                    key={item.id}
                    disabled={item.disabled}
                    iconLeft={item.icon}
                    onClick={(e) => {
                      onUserMenuItemClick?.(item, e as unknown as React.MouseEvent);
                      item.onClick?.();
                    }}
                  >
                    {item.label}
                  </Dropdown.Item>
                ))}

                {/* Logout */}
                <Dropdown.Item
                  iconLeft={<LogOut className="h-4 w-4" />}
                  onClick={onLogout}
                  className="text-danger-600 hover:text-danger-700"
                >
                  Deconectare
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          )}

          {/* ── Mobile Toggle ────────────────────────────── */}
          <button
            type="button"
            onClick={handleMobileToggle}
            className={cn(
              "lg:hidden shrink-0",
              iconButtonVariants({ variant: iconBtnVariant, size: "md" }),
            )}
            aria-label={mobileOpen ? "Închide meniul" : "Deschide meniul"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* ── Mega Menu Overlay ──────────────────────────────── */}
        {megaMenuOpen &&
          megaMenus.map((mega) => {
            if (mega.triggerId !== megaMenuOpen) return null;
            return (
              <div
                key={mega.triggerId}
                ref={megaMenuContainerRef}
                className={cn(
                  "hidden lg:block",
                  "absolute left-0 right-0 top-full",
                  "bg-surface border-b border-border-subtle",
                  "shadow-elevation-3",
                  "animate-slide-in-from-top",
                )}
                role="menu"
                aria-label={`${mega.triggerId} mega menu`}
              >
                <div
                  className={cn(
                    "container py-8",
                    "grid grid-cols-12 gap-8",
                  )}
                >
                  {/* Groups */}
                  <div className="col-span-9 grid grid-cols-3 gap-8">
                    {mega.groups.map((group) => (
                      <div key={group.label}>
                        <h4 className="flex items-center gap-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                          {group.icon && (
                            <span aria-hidden="true">{group.icon}</span>
                          )}
                          {group.label}
                        </h4>
                        <ul className="space-y-1">
                          {group.items.map((item) => (
                            <li key={item.id}>
                              <a
                                href={item.href ?? "#"}
                                onClick={(e) => {
                                  if (item.disabled) {
                                    e.preventDefault();
                                    return;
                                  }
                                  handleNavItemClick(item, e as unknown as React.MouseEvent);
                                }}
                                className={cn(
                                  "flex items-start gap-3 rounded-md px-3 py-2",
                                  "transition-colors duration-100",
                                  "hover:bg-surface-secondary",
                                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
                                  item.disabled && "opacity-50 pointer-events-none",
                                )}
                              >
                                {item.icon && (
                                  <span
                                    className="shrink-0 mt-0.5 text-text-tertiary"
                                    aria-hidden="true"
                                  >
                                    {item.icon}
                                  </span>
                                )}
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-text-primary">
                                    {item.label}
                                    {item.badge && (
                                      <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500 text-white leading-none">
                                        {item.badge}
                                      </span>
                                    )}
                                  </p>
                                  {item.description && (
                                    <p className="text-xs text-text-tertiary mt-0.5 line-clamp-2">
                                      {item.description}
                                    </p>
                                  )}
                                </div>
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  {/* Featured Card */}
                  {mega.featured && (
                    <div className="col-span-3">
                      <div className="rounded-xl bg-surface-secondary border border-border-subtle p-5 h-full">
                        {mega.featured.image && (
                          <img
                            src={mega.featured.image}
                            alt=""
                            className="rounded-lg mb-4 w-full h-32 object-cover"
                          />
                        )}
                        <h4 className="text-sm font-semibold text-text-primary">
                          {mega.featured.title}
                        </h4>
                        <p className="text-xs text-text-secondary mt-1">
                          {mega.featured.description}
                        </p>
                        {mega.featured.cta && (
                          <a
                            href={mega.featured.cta.href}
                            className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
                          >
                            {mega.featured.cta.label}
                            <ChevronRight
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

        {/* ── Mobile Drawer ────────────────────────────────────── */}
        {isMobile && (
          <>
            {/* Backdrop */}
            {mobileOpen && (
              <div
                className="fixed inset-0 z-drawer bg-surface-overlay backdrop-blur-sm lg:hidden"
                onClick={handleMobileClose}
                aria-hidden="true"
              />
            )}

            {/* Drawer */}
            <div
              className={cn(
                "fixed inset-y-0 right-0 z-drawer",
                "w-full max-w-sm",
                "bg-surface shadow-elevation-5",
                "transform transition-transform duration-300 ease-emphasized",
                "lg:hidden",
                mobileOpen ? "translate-x-0" : "translate-x-full",
              )}
              role="dialog"
              aria-modal="true"
              aria-label="Meniu mobil"
            >
              {/* Drawer header */}
              <div className="flex items-center justify-between px-4 h-header border-b border-border-subtle">
                <span className="text-lg font-semibold text-text-primary">
                  Meniu
                </span>
                <button
                  type="button"
                  onClick={handleMobileClose}
                  className={cn(
                    iconButtonVariants({ variant: "default", size: "md" }),
                  )}
                  aria-label="Închide meniul"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              {/* Drawer content */}
              <div className="overflow-y-auto h-[calc(100vh-4rem)]">
                {mobileMenuContent ?? (
                  <>
                    {/* Mobile Search */}
                    {showSearch && (
                      <div className="px-4 py-3">
                        <SearchInput
                          placeholder={searchPlaceholder}
                          suggestions={searchSuggestions}
                          onSearch={onSearch}
                          onSuggestionSelect={onSearchSuggestionSelect}
                          enableRecent={enableRecentSearch}
                          inputSize="sm"
                          fullWidth
                        />
                      </div>
                    )}

                    {/* Mobile Navigation */}
                    <nav
                      className="px-2 py-1"
                      aria-label="Navigare mobilă"
                    >
                      {navItems.map((item) => (
                        <MobileNavItem
                          key={item.id}
                          item={item}
                          depth={0}
                          megaMenu={megaMenuForItem(item.id)}
                          onClose={handleMobileClose}
                          onNavItemClick={onNavItemClick}
                        />
                      ))}
                    </nav>

                    {/* Mobile User Section */}
                    {showUserMenu && userMenuConfig && (
                      <div className="border-t border-border-subtle mt-2 px-4 py-4">
                        <div className="flex items-center gap-3 mb-3">
                          {userMenuConfig.avatarUrl ? (
                            <img
                              src={userMenuConfig.avatarUrl}
                              alt=""
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-brand-500 text-white font-semibold">
                              {userMenuConfig.initials ??
                                userMenuConfig.displayName
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .slice(0, 2)
                                  .toUpperCase()}
                            </span>
                          )}
                          <div>
                            <p className="text-sm font-medium text-text-primary">
                              {userMenuConfig.displayName}
                            </p>
                            {userMenuConfig.email && (
                              <p className="text-xs text-text-tertiary">
                                {userMenuConfig.email}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          {(userMenuConfig.items && userMenuConfig.items.length > 0
                            ? userMenuConfig.items
                            : [
                                { id: "profile", label: "Profil", icon: <User className="h-4 w-4" /> },
                                { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
                                { id: "settings", label: "Setări", icon: <Settings className="h-4 w-4" /> },
                                { id: "help", label: "Ajutor", icon: <HelpCircle className="h-4 w-4" /> },
                              ]
                          ).map((item) => (
                            <a
                              key={item.id}
                              href={item.href ?? "#"}
                              onClick={(e) => {
                                if (item.disabled) {
                                  e.preventDefault();
                                  return;
                                }
                                onUserMenuItemClick?.(item, e as unknown as React.MouseEvent);
                                item.onClick?.();
                                handleMobileClose();
                              }}
                              className={cn(
                                "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-text-secondary",
                                "hover:bg-surface-secondary hover:text-text-primary",
                                "transition-colors",
                                item.disabled && "opacity-50 pointer-events-none",
                              )}
                            >
                              {item.icon && (
                                <span className="text-text-tertiary" aria-hidden="true">
                                  {item.icon}
                                </span>
                              )}
                              {item.label}
                            </a>
                          ))}

                          <button
                            type="button"
                            onClick={() => {
                              onLogout?.();
                              handleMobileClose();
                            }}
                            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-danger-600 hover:bg-danger-50 transition-colors"
                          >
                            <LogOut className="h-4 w-4" />
                            Deconectare
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </header>
    </HeaderContext.Provider>
  );
});

Header.displayName = "Header";

// =====================================================================
// MOBILE NAV ITEM (Recursive)
// =====================================================================

type MobileNavItemProps = {
  item: NavItem;
  depth: number;
  megaMenu?: MegaMenuConfig;
  onClose: () => void;
  onNavItemClick?: (item: NavItem, event: React.MouseEvent) => void;
};

function MobileNavItem({
  item,
  depth,
  megaMenu,
  onClose,
  onNavItemClick,
}: MobileNavItemProps) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = !!(item.children && item.children.length > 0);
  const hasMega = !!megaMenu;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (hasChildren || hasMega) {
        e.preventDefault();
        setExpanded((prev) => !prev);
        return;
      }
      onNavItemClick?.(item, e);
      if (!item.href || item.href === "#") {
        e.preventDefault();
      }
      onClose();
    },
    [item, hasChildren, hasMega, onNavItemClick, onClose],
  );

  return (
    <div>
      <a
        href={item.href ?? "#"}
        onClick={handleClick}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2.5",
          "transition-colors duration-100",
          "hover:bg-surface-secondary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
          item.disabled && "opacity-50 pointer-events-none",
          depth > 0 && "ml-4",
        )}
        style={{ paddingLeft: `${12 + depth * 12}px` }}
        aria-expanded={hasChildren || hasMega ? expanded : undefined}
      >
        {item.icon && (
          <span className="shrink-0 text-text-tertiary" aria-hidden="true">
            {item.icon}
          </span>
        )}
        <span
          className={cn(
            "flex-1 text-sm",
            item.active
              ? "font-semibold text-brand-600"
              : "text-text-secondary",
          )}
        >
          {item.label}
        </span>
        {item.badge && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500 text-white leading-none">
            {item.badge}
          </span>
        )}
        {(hasChildren || hasMega) && (
          <ChevronDown
            className={cn(
              "h-4 w-4 text-text-tertiary shrink-0 transition-transform duration-200",
              expanded && "rotate-180",
            )}
            aria-hidden="true"
          />
        )}
      </a>

      {/* Expanded children */}
      {expanded && hasChildren && item.children && (
        <div className="mt-0.5 mb-1">
          {item.children.map((child) => (
            <MobileNavItem
              key={child.id}
              item={child}
              depth={depth + 1}
              onClose={onClose}
              onNavItemClick={onNavItemClick}
            />
          ))}
        </div>
      )}

      {/* Expanded mega menu (rendered as simple sublist on mobile) */}
      {expanded && hasMega && megaMenu && (
        <div className="mt-0.5 mb-1 ml-4">
          {megaMenu.groups.map((group) => (
            <div key={group.label} className="mb-2">
              <p className="px-3 py-1 text-xs font-semibold text-text-tertiary uppercase tracking-wider">
                {group.label}
              </p>
              {group.items.map((child) => (
                <MobileNavItem
                  key={child.id}
                  item={{ ...child, icon: undefined }}
                  depth={depth + 1}
                  onClose={onClose}
                  onNavItemClick={onNavItemClick}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// EXPORTS
// =====================================================================

export {
  Header,
  headerVariants,
  navLinkVariants,
  iconButtonVariants,
  HeaderContext,
  useHeaderContext,
  useOptionalHeaderContext,
};

export type {
  HeaderVariant,
  NavItem,
  MegaMenuGroup,
  MegaMenuConfig,
  NotificationItem,
  UserMenuConfig,
};

export default Header;

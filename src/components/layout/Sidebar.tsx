"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  createContext,
  useContext,
} from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Dot,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";

// =============================================================================
// Constants
// =============================================================================

const SIDEBAR_WIDTH = "18rem";
const SIDEBAR_COLLAPSED_WIDTH = "4.5rem";
const MOBILE_BREAKPOINT = 1024;
const SIDEBAR_STORAGE_KEY = "nexus-sidebar-collapsed";

// =============================================================================
// Types
// =============================================================================

export type SidebarItemBadge = {
  /** Text or number to display */
  label: string | number;
  /** Badge color */
  color?: "brand" | "accent" | "success" | "danger" | "warning" | "info" | "neutral";
  /** Badge variant */
  variant?: "solid" | "soft" | "outline";
};

export type SidebarNavItem = {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Icon component (Lucide icon) */
  icon?: React.ReactNode;
  /**
   * Navigation route. If provided, item becomes a link (Next.js <Link>).
   * If omitted together with `onClick`, the item acts as a section header.
   */
  href?: string;
  /** Open external links in new tab with rel="noopener noreferrer" */
  external?: boolean;
  /** Click handler for action items (e.g. logout, modals) */
  onClick?: () => void;
  /** Badge (notification count, status, etc.) */
  badge?: SidebarItemBadge;
  /** Disable interaction */
  disabled?: boolean;
  /** Nested sub-navigation items */
  children?: SidebarNavItem[];
  /** Section divider before this item */
  dividerBefore?: boolean;
  /** Accessible label (if different from display label) */
  ariaLabel?: string;
};

export type SidebarVariant = "default" | "compact";

export type SidebarProps = {
  /** Navigation items tree */
  items: SidebarNavItem[];
  /**
   * Controlled collapsed state.
   * When provided, the sidebar becomes controlled.
   */
  collapsed?: boolean;
  /** Callback when collapsed state changes */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Default collapsed state (uncontrolled) */
  defaultCollapsed?: boolean;
  /** Whether to persist collapsed state to localStorage */
  persistCollapsed?: boolean;
  /**
   * Mobile overlay open state (controlled).
   * When in mobile view, the sidebar renders as a drawer.
   */
  mobileOpen?: boolean;
  /** Callback to close mobile drawer */
  onMobileClose?: () => void;
  /** Visual variant */
  variant?: SidebarVariant;
  /**
   * Content rendered at the top of the sidebar (logo, branding).
   * Receives `collapsed` state to adapt rendering.
   */
  header?: React.ReactNode | ((collapsed: boolean) => React.ReactNode);
  /**
   * Content rendered at the bottom of the sidebar (user menu, settings).
   * Receives `collapsed` state to adapt rendering.
   */
  footer?: React.ReactNode | ((collapsed: boolean) => React.ReactNode);
  /** Additional class for the sidebar container */
  className?: string;
  /** Accessible label for the navigation landmark */
  ariaLabel?: string;
};

// =============================================================================
// Sidebar Context
// =============================================================================

type SidebarContextValue = {
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  pathname: string;
  variant: SidebarVariant;
  isMobile: boolean;
  baseId: string;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error(
      "Sidebar compound components must be used within <Sidebar>.",
    );
  }
  return ctx;
}

// =============================================================================
// Helpers
// =============================================================================

function isActive(pathname: string, item: SidebarNavItem): boolean {
  if (!item.href) return false;

  // Exact match
  if (pathname === item.href) return true;

  // Child match: check if any child is active
  if (item.children?.length) {
    return item.children.some((child) => isActive(pathname, child));
  }

  // Prefix match for nested routes (e.g. /dashboard/projects matches /dashboard/projects/123)
  if (item.href !== "/" && pathname.startsWith(item.href + "/")) {
    return true;
  }

  return false;
}

function hasActiveChild(pathname: string, item: SidebarNavItem): boolean {
  if (!item.children?.length) return false;
  return item.children.some((child) => isActive(pathname, child));
}

function resolveHeader(
  header: SidebarProps["header"],
  collapsed: boolean,
): React.ReactNode {
  if (typeof header === "function") return header(collapsed);
  return header;
}

function resolveFooter(
  footer: SidebarProps["footer"],
  collapsed: boolean,
): React.ReactNode {
  if (typeof footer === "function") return footer(collapsed);
  return footer;
}

// =============================================================================
// Merge Refs Utility
// =============================================================================

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

// =============================================================================
// ANIMATION VARIANTS
// =============================================================================

const sidebarTransition = {
  duration: 0.25,
  ease: [0.2, 0, 0, 1],
};

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const mobileDrawerVariants = {
  hidden: { x: "-100%" },
  visible: { x: 0, transition: sidebarTransition },
  exit: { x: "-100%", transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } },
};

const submenuVariants = {
  hidden: { height: 0, opacity: 0, overflow: "hidden" },
  visible: {
    height: "auto",
    opacity: 1,
    overflow: "hidden",
    transition: { height: { duration: 0.25, ease: [0.2, 0, 0, 1] }, opacity: { duration: 0.2 } },
  },
  exit: {
    height: 0,
    opacity: 0,
    overflow: "hidden",
    transition: { height: { duration: 0.2, ease: [0.4, 0, 1, 1] }, opacity: { duration: 0.1 } },
  },
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

// ── Sidebar Item ────────────────────────────────────────────────────────

type SidebarItemProps = {
  item: SidebarNavItem;
  /** Depth level for indentation */
  depth?: number;
  /** Whether this item is a submenu child */
  isChild?: boolean;
};

const SidebarItem = forwardRef<HTMLLIElement, SidebarItemProps>(
  ({ item, depth = 0, isChild = false }, ref) => {
    const { collapsed, setCollapsed, pathname, variant, baseId } = useSidebar();
    const router = useRouter();
    const itemId = `${baseId}-item-${item.id}`;
    const submenuId = `${baseId}-submenu-${item.id}`;

    // ── Submenu expand state ────────────────────────────────────
    const [submenuOpen, setSubmenuOpen] = useState(
      () => hasActiveChild(pathname, item) || isActive(pathname, item),
    );

    const hasChildren = Boolean(item.children?.length);
    const active = isActive(pathname, item);
    const childActive = hasActiveChild(pathname, item);

    // Expand submenu when a child becomes active
    useEffect(() => {
      if (childActive) {
        setSubmenuOpen(true);
      }
    }, [childActive]);

    // ── Click handler ───────────────────────────────────────────
    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        if (item.disabled) return;

        if (hasChildren && !collapsed) {
          // Toggle submenu
          e.preventDefault();
          setSubmenuOpen((prev) => !prev);
          return;
        }

        if (item.onClick) {
          e.preventDefault();
          item.onClick();
          return;
        }

        if (item.href && !item.external) {
          e.preventDefault();
          // Temporarily uncollapse when navigating from collapsed state
          // so the user can see where they landed, then re-collapse
          if (collapsed) {
            setCollapsed(false);
          }
          router.push(item.href);
        }
      },
      [item, collapsed, hasChildren, setCollapsed, router],
    );

    // ── Keyboard handler ────────────────────────────────────────
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (item.disabled) return;

        const current = e.currentTarget as HTMLElement;
        const parentList = current.closest('[role="list"]');
        const items = parentList
          ? Array.from(parentList.querySelectorAll('[role="listitem"] > [role="button"], [role="listitem"] > a'))
          : [];

        const currentIndex = items.indexOf(current);

        switch (e.key) {
          case "ArrowDown": {
            e.preventDefault();
            const next = items[(currentIndex + 1) % items.length] as HTMLElement;
            next?.focus();
            break;
          }
          case "ArrowUp": {
            e.preventDefault();
            const prev = items[(currentIndex - 1 + items.length) % items.length] as HTMLElement;
            prev?.focus();
            break;
          }
          case "ArrowRight": {
            if (hasChildren && !submenuOpen) {
              e.preventDefault();
              setSubmenuOpen(true);
            } else if (collapsed && item.href) {
              e.preventDefault();
              router.push(item.href);
            }
            break;
          }
          case "ArrowLeft": {
            if (hasChildren && submenuOpen && !collapsed) {
              e.preventDefault();
              setSubmenuOpen(false);
            }
            break;
          }
          case "Enter":
          case " ": {
            e.preventDefault();
            handleClick(e as unknown as React.MouseEvent);
            break;
          }
          case "Home": {
            e.preventDefault();
            const firstItem = items[0] as HTMLElement;
            firstItem?.focus();
            break;
          }
          case "End": {
            e.preventDefault();
            const lastItem = items[items.length - 1] as HTMLElement;
            lastItem?.focus();
            break;
          }
        }
      },
      [item, collapsed, hasChildren, submenuOpen, handleClick, router],
    );

    // ── Render tag ──────────────────────────────────────────────
    const Tag: React.ElementType = item.href && !item.onClick ? "a" : "button";
    const isButton = Tag === "button";

    // ── Common item classes ─────────────────────────────────────
    const itemClasses = cn(
      // Base
      "group relative flex w-full items-center rounded-md",
      "text-sm font-medium",
      "transition-all duration-200",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1",
      // Spacing
      collapsed ? "justify-center px-0 py-2.5" : "justify-start px-3 py-2",
      isChild && !collapsed ? "pl-10 pr-3" : "",
      depth > 0 && !collapsed ? `pl-${8 + depth * 4}` : "",
      // Colors
      active || childActive
        ? [
            "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300",
            "before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2",
            "before:h-6 before:w-0.5 before:rounded-r-full before:bg-brand-500",
            collapsed ? "before:hidden" : "before:block",
          ]
        : [
            "text-text-secondary hover:text-text-primary",
            "hover:bg-surface-secondary dark:hover:bg-neutral-800/50",
          ],
      item.disabled
        ? "pointer-events-none opacity-40 cursor-not-allowed"
        : "cursor-pointer",
      variant === "compact" && !collapsed ? "py-1.5" : "",
    );

    // ── Icon wrapper ────────────────────────────────────────────
    const iconSize = variant === "compact" ? "h-4 w-4" : "h-5 w-5";
    const iconWrapper = item.icon ? (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center",
          iconSize,
          collapsed ? "" : "mr-3",
          active || childActive
            ? "text-brand-600 dark:text-brand-400"
            : "text-text-tertiary group-hover:text-text-secondary",
        )}
        aria-hidden="true"
      >
        {item.icon}
      </span>
    ) : isChild ? (
      <span className={cn("inline-flex shrink-0", collapsed ? "" : "mr-3")}>
        <Dot
          className={cn(
            "h-4 w-4",
            active
              ? "text-brand-600 dark:text-brand-400"
              : "text-text-tertiary",
          )}
          aria-hidden="true"
        />
      </span>
    ) : null;

    // ── Expand chevron ──────────────────────────────────────────
    const expandIcon = hasChildren && !collapsed ? (
      <ChevronDown
        className={cn(
          "ml-auto h-4 w-4 shrink-0 transition-transform duration-200",
          "text-text-tertiary group-hover:text-text-secondary",
          submenuOpen ? "rotate-0" : "-rotate-90",
        )}
        aria-hidden="true"
      />
    ) : null;

    // ── Badge ───────────────────────────────────────────────────
    const badge = item.badge ? (
      <Badge
        variant={item.badge.variant ?? "soft"}
        color={item.badge.color ?? "brand"}
        size="sm"
        rounded="full"
        className={cn(
          "ml-auto",
          collapsed ? "absolute -top-0.5 right-0.5" : expandIcon ? "mr-2" : "",
        )}
      >
        {item.badge.label}
      </Badge>
    ) : null;

    // ── Active indicator for collapsed state ────────────────────
    const collapsedActiveDot =
      collapsed && (active || childActive) ? (
        <span className="absolute right-1.5 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-brand-500" />
      ) : null;

    // ── Main render ─────────────────────────────────────────────
    const itemContent = (
      <>
        {iconWrapper}
        {!collapsed && (
          <span className="truncate text-left">{item.label}</span>
        )}
        {!collapsed && expandIcon}
        {!collapsed && badge}
        {collapsed && badge}
        {collapsedActiveDot}
      </>
    );

    const commonProps = {
      id: `${itemId}-trigger`,
      className: itemClasses,
      onClick: handleClick,
      onKeyDown: handleKeyDown,
      role: isButton ? "button" : undefined,
      type: isButton ? ("button" as const) : undefined,
      tabIndex: item.disabled ? -1 : 0,
      "aria-disabled": item.disabled ? true : undefined,
      "aria-label": collapsed ? item.label : item.ariaLabel ?? undefined,
      "aria-expanded": hasChildren ? submenuOpen : undefined,
      "aria-controls": hasChildren ? submenuId : undefined,
      "aria-current":
        active && !hasChildren ? ("page" as const) : undefined,
      title: collapsed ? item.label : undefined,
    };

    const element = Tag === "a" ? (
      <a
        href={item.href}
        target={item.external ? "_blank" : undefined}
        rel={item.external ? "noopener noreferrer" : undefined}
        {...commonProps}
        ref={ref as React.Ref<HTMLAnchorElement>}
      >
        {itemContent}
      </a>
    ) : (
      <button
        {...commonProps}
        ref={ref as React.Ref<HTMLButtonElement>}
      >
        {itemContent}
      </button>
    );

    // ── Submenu ─────────────────────────────────────────────────
    const submenu = hasChildren && item.children ? (
      <AnimatePresence initial={false}>
        {submenuOpen && (
          <motion.ul
            id={submenuId}
            role="group"
            aria-label={`${item.label} submenu`}
            variants={submenuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={cn(
              "overflow-hidden",
              collapsed ? "hidden" : "ml-4 border-l border-border-subtle pl-2",
            )}
          >
            {item.children.map((child) => (
              <SidebarItem
                key={child.id}
                item={child}
                depth={depth + 1}
                isChild
              />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    ) : null;

    return (
      <li
        ref={ref}
        id={itemId}
        role="listitem"
        className={cn(
          item.dividerBefore
            ? "mt-2 border-t border-border-subtle pt-2"
            : "",
        )}
      >
        {element}
        {submenu}
      </li>
    );
  },
);

SidebarItem.displayName = "SidebarItem";

// =============================================================================
// MAIN SIDEBAR COMPONENT
// =============================================================================

const Sidebar = forwardRef<HTMLElement, SidebarProps>((props, ref) => {
  const {
    items,
    collapsed: collapsedProp,
    onCollapsedChange,
    defaultCollapsed = false,
    persistCollapsed = true,
    mobileOpen: mobileOpenProp,
    onMobileClose,
    variant = "default",
    header,
    footer,
    className,
    ariaLabel = "Main navigation",
  } = props;

  // ── Auto-generated ids ────────────────────────────────────────
  const autoId = useId();
  const baseId = `sidebar-${autoId}`;

  // ── Pathname for active detection ─────────────────────────────
  const pathname = usePathname();

  // ── Collapse state ────────────────────────────────────────────
  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    if (collapsedProp !== undefined) return collapsedProp;
    if (persistCollapsed && typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
        if (stored !== null) return stored === "true";
      } catch {
        // localStorage unavailable, use default
      }
    }
    return defaultCollapsed;
  });

  const isControlled = collapsedProp !== undefined;
  const collapsed = isControlled ? collapsedProp : internalCollapsed;

  const setCollapsed = useCallback(
    (next: boolean) => {
      if (!isControlled) {
        setInternalCollapsed(next);
        if (persistCollapsed && typeof window !== "undefined") {
          try {
            localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
          } catch {
            // Ignore storage errors
          }
        }
      }
      onCollapsedChange?.(next);
    },
    [isControlled, onCollapsedChange, persistCollapsed],
  );

  // ── Mobile detection ──────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, []);

  // Mobile open state
  const [internalMobileOpen, setInternalMobileOpen] = useState(false);
  const mobileOpen = mobileOpenProp ?? internalMobileOpen;
  const setMobileOpen = onMobileClose ?? setInternalMobileOpen;

  // ── Esc key to close mobile drawer ────────────────────────────
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mobileOpen, setMobileOpen]);

  // ── Lock body scroll when mobile overlay is open ──────────────
  useEffect(() => {
    if (!isMobile || !mobileOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isMobile, mobileOpen]);

  // ── Context value ─────────────────────────────────────────────
  const ctxValue = useMemo<SidebarContextValue>(
    () => ({
      collapsed: isMobile ? false : collapsed, // Never show collapsed on mobile
      setCollapsed,
      pathname,
      variant,
      isMobile,
      baseId,
    }),
    [collapsed, setCollapsed, pathname, variant, isMobile, baseId],
  );

  // ── Collapse toggle ───────────────────────────────────────────
  const toggleCollapsed = useCallback(() => {
    setCollapsed(!collapsed);
  }, [collapsed, setCollapsed]);

  // ── Desktop Sidebar Content ───────────────────────────────────
  const sidebarContent = (
    <SidebarContext.Provider value={ctxValue}>
      <aside
        ref={ref}
        id={baseId}
        aria-label={ariaLabel}
        className={cn(
          // Layout
          "flex flex-col h-full",
          // Visual
          "bg-surface dark:bg-neutral-950",
          "border-r border-border-subtle dark:border-neutral-800",
          // Sizing & animation
          "overflow-hidden",
          // Shadow on right edge (subtle)
          "shadow-elevation-1",
        )}
        style={{
          width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
          transition: `width ${sidebarTransition.duration}s ${sidebarTransition.ease}`,
        }}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        {header != null && (
          <div
            className={cn(
              "flex shrink-0 items-center border-b border-border-subtle dark:border-neutral-800",
              collapsed ? "h-14 justify-center px-2" : "h-16 px-4",
            )}
          >
            {resolveHeader(header, collapsed)}
          </div>
        )}

        {/* ── Collapse Trigger Button ─────────────────────────── */}
        <button
          type="button"
          onClick={toggleCollapsed}
          className={cn(
            "absolute right-0 top-20 z-raised",
            "flex h-6 w-6 -translate-y-1/2 translate-x-1/2 items-center justify-center",
            "rounded-full border border-border-subtle dark:border-neutral-700",
            "bg-surface dark:bg-neutral-800",
            "text-text-tertiary hover:text-text-secondary",
            "shadow-elevation-1 hover:shadow-elevation-2",
            "transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
            // Hide when no header (adjust top position)
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </button>

        {/* ── Navigation ──────────────────────────────────────── */}
        <nav
          className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden",
            "py-2",
            collapsed ? "px-1.5" : "px-2",
          )}
          aria-label={ariaLabel}
        >
          <ul role="list" className="space-y-0.5">
            {items.map((item) => (
              <SidebarItem key={item.id} item={item} />
            ))}
          </ul>
        </nav>

        {/* ── Footer ──────────────────────────────────────────── */}
        {footer != null && (
          <div
            className={cn(
              "flex shrink-0 items-center border-t border-border-subtle dark:border-neutral-800",
              collapsed ? "justify-center px-2 py-3" : "px-4 py-3",
            )}
          >
            {resolveFooter(footer, collapsed)}
          </div>
        )}
      </aside>
    </SidebarContext.Provider>
  );

  // ── Desktop: render directly ──────────────────────────────────
  if (!isMobile) {
    return sidebarContent;
  }

  // ── Mobile: render drawer with overlay ────────────────────────
  const portalTarget =
    typeof document !== "undefined" ? document.body : null;

  if (!portalTarget) {
    // SSR fallback — render nothing until hydration
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {mobileOpen && (
        <>
          {/* Overlay */}
          <motion.div
            variants={overlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-0 z-overlay bg-bg-overlay"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.div
            variants={mobileDrawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="fixed inset-y-0 left-0 z-drawer"
            style={{ width: SIDEBAR_WIDTH }}
          >
            {/* Close button for mobile */}
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className={cn(
                "absolute right-3 top-3 z-raised",
                "flex h-8 w-8 items-center justify-center",
                "rounded-full bg-neutral-100 dark:bg-neutral-800",
                "text-text-secondary hover:text-text-primary",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
                "transition-colors duration-200",
              )}
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            {sidebarContent}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    portalTarget,
  );
});

Sidebar.displayName = "Sidebar";

// =============================================================================
// HOOK: useSidebarCollapse
// Convenience hook for controlling sidebar collapse from parent layout
// =============================================================================

export function useSidebarCollapse(initialCollapsed = false) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  const expand = useCallback(() => setCollapsed(false), []);
  const collapse = useCallback(() => setCollapsed(true), []);

  return { collapsed, setCollapsed, toggle, expand, collapse };
}

// =============================================================================
// HOOK: useMobileSidebar
// Convenience hook for mobile drawer state
// =============================================================================

export function useMobileSidebar() {
  const [open, setOpen] = useState(false);

  const openMobile = useCallback(() => setOpen(true), []);
  const closeMobile = useCallback(() => setOpen(false), []);
  const toggleMobile = useCallback(() => setOpen((prev) => !prev), []);

  return { mobileOpen: open, openMobile, closeMobile, toggleMobile };
}

// =============================================================================
// Exports
// =============================================================================

export { Sidebar, SidebarItem, SidebarContext, useSidebar };

export type { SidebarContextValue, SidebarItemProps, SidebarItemBadge };

export default Sidebar;
"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useState,
  createContext,
  useContext,
} from "react";
import { cn } from "@/lib/cn";
import { Menu, X } from "lucide-react";

import { Header, type HeaderProps } from "@/components/layout/Header";
import {
  Sidebar,
  useSidebarCollapse,
  useMobileSidebar,
  type SidebarProps,
  type SidebarNavItem,
} from "@/components/layout/Sidebar";
import { Footer, type FooterProps } from "@/components/layout/Footer";

// ═══════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════

const SIDEBAR_COLLAPSED_WIDTH = "4.5rem";
const SIDEBAR_EXPANDED_WIDTH = "18rem";
const MOBILE_BREAKPOINT = 1024;

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export interface DashboardLayoutProps {
  /** Page content rendered in the main area */
  children: React.ReactNode;

  // ── Sidebar ──────────────────────────────────────────────────
  /** Sidebar navigation items (required when showSidebar is true) */
  sidebarItems?: SidebarNavItem[];
  /** Props forwarded to the Sidebar component */
  sidebarProps?: Partial<
    Omit<SidebarProps, "items" | "collapsed" | "onCollapsedChange" | "mobileOpen" | "onMobileClose">
  >;

  // ── Header ───────────────────────────────────────────────────
  /** Props forwarded to the Header component */
  headerProps?: Partial<HeaderProps>;

  // ── Footer ───────────────────────────────────────────────────
  /** Props forwarded to the Footer component */
  footerProps?: Partial<FooterProps>;

  // ── Visibility ───────────────────────────────────────────────
  /** Show the sidebar. Default: true */
  showSidebar?: boolean;
  /** Show the header. Default: true */
  showHeader?: boolean;
  /** Show the footer. Default: true */
  showFooter?: boolean;

  // ── Sidebar collapse ─────────────────────────────────────────
  /** Controlled sidebar collapsed state */
  sidebarCollapsed?: boolean;
  /** Called when sidebar collapsed state changes */
  onSidebarCollapsedChange?: (collapsed: boolean) => void;
  /** Default sidebar collapsed state (uncontrolled). Default: false */
  defaultSidebarCollapsed?: boolean;

  // ── Mobile ───────────────────────────────────────────────────
  /** Controlled mobile sidebar open state */
  mobileSidebarOpen?: boolean;
  /** Called when mobile sidebar open state changes */
  onMobileSidebarOpenChange?: (open: boolean) => void;
  /** Breakpoint for mobile detection (px). Default: 1024 */
  mobileBreakpoint?: number;

  // ── Styling ──────────────────────────────────────────────────
  /** Additional class for the layout wrapper */
  className?: string;
  /** Additional class for the main content area */
  contentClassName?: string;
  /** Whether the main content area should have default padding. Default: true */
  contentPadding?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// Layout Context
// ═══════════════════════════════════════════════════════════════════════

export interface DashboardLayoutContextValue {
  /** Whether the sidebar is currently collapsed */
  sidebarCollapsed: boolean;
  /** Toggle sidebar collapsed state */
  toggleSidebar: () => void;
  /** Whether currently on mobile */
  isMobile: boolean;
  /** Mobile sidebar open state */
  mobileSidebarOpen: boolean;
  /** Open mobile sidebar */
  openMobileSidebar: () => void;
  /** Close mobile sidebar */
  closeMobileSidebar: () => void;
}

const DashboardLayoutContext =
  createContext<DashboardLayoutContextValue | null>(null);

/**
 * Hook to access dashboard layout state from any child component.
 * Returns sidebar collapse state, mobile state, and toggle functions.
 */
export function useDashboardLayout(): DashboardLayoutContextValue {
  const ctx = useContext(DashboardLayoutContext);
  if (!ctx) {
    throw new Error(
      "useDashboardLayout must be used within a <DashboardLayout>.",
    );
  }
  return ctx;
}

/**
 * Optional variant — returns null when outside DashboardLayout.
 */
export function useOptionalDashboardLayout(): DashboardLayoutContextValue | null {
  return useContext(DashboardLayoutContext);
}

// ═══════════════════════════════════════════════════════════════════════
// Helpers
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
// DashboardLayout Component
// ═══════════════════════════════════════════════════════════════════════

const DashboardLayout = forwardRef<HTMLDivElement, DashboardLayoutProps>(
  (props, ref) => {
    const {
      children,
      sidebarItems = [],
      sidebarProps = {},
      headerProps = {},
      footerProps = {},
      showSidebar = true,
      showHeader = true,
      showFooter = true,
      sidebarCollapsed: sidebarCollapsedProp,
      onSidebarCollapsedChange,
      defaultSidebarCollapsed = false,
      mobileSidebarOpen: mobileSidebarOpenProp,
      onMobileSidebarOpenChange,
      mobileBreakpoint = MOBILE_BREAKPOINT,
      className,
      contentClassName,
      contentPadding = true,
    } = props;

    // ── Mobile detection ────────────────────────────────────────
    const isMobile = useMediaQuery(
      `(max-width: ${mobileBreakpoint - 1}px)`,
    );

    // ── Sidebar collapse ────────────────────────────────────────
    const {
      collapsed: internalCollapsed,
      setCollapsed: setInternalCollapsed,
      toggle: toggleInternalCollapsed,
    } = useSidebarCollapse(defaultSidebarCollapsed);

    const isCollapseControlled = sidebarCollapsedProp !== undefined;
    const sidebarCollapsed = isCollapseControlled
      ? sidebarCollapsedProp
      : internalCollapsed;

    const setSidebarCollapsed = useCallback(
      (next: boolean) => {
        if (!isCollapseControlled) {
          setInternalCollapsed(next);
        }
        onSidebarCollapsedChange?.(next);
      },
      [isCollapseControlled, setInternalCollapsed, onSidebarCollapsedChange],
    );

    const toggleSidebar = useCallback(() => {
      setSidebarCollapsed(!sidebarCollapsed);
    }, [sidebarCollapsed, setSidebarCollapsed]);

    // ── Mobile sidebar ──────────────────────────────────────────
    const {
      mobileOpen: internalMobileOpen,
      openMobile: openInternalMobile,
      closeMobile: closeInternalMobile,
    } = useMobileSidebar();

    const isMobileControlled = mobileSidebarOpenProp !== undefined;
    const mobileSidebarOpen = isMobileControlled
      ? mobileSidebarOpenProp
      : internalMobileOpen;

    const setMobileSidebarOpen = useCallback(
      (open: boolean) => {
        if (!isMobileControlled) {
          if (open) {
            openInternalMobile();
          } else {
            closeInternalMobile();
          }
        }
        onMobileSidebarOpenChange?.(open);
      },
      [
        isMobileControlled,
        openInternalMobile,
        closeInternalMobile,
        onMobileSidebarOpenChange,
      ],
    );

    const openMobileSidebar = useCallback(
      () => setMobileSidebarOpen(true),
      [setMobileSidebarOpen],
    );
    const closeMobileSidebar = useCallback(
      () => setMobileSidebarOpen(false),
      [setMobileSidebarOpen],
    );

    // ── Context value ───────────────────────────────────────────
    const layoutContextValue = useMemo<DashboardLayoutContextValue>(
      () => ({
        sidebarCollapsed,
        toggleSidebar,
        isMobile,
        mobileSidebarOpen,
        openMobileSidebar,
        closeMobileSidebar,
      }),
      [
        sidebarCollapsed,
        toggleSidebar,
        isMobile,
        mobileSidebarOpen,
        openMobileSidebar,
        closeMobileSidebar,
      ],
    );

    // ── Derived sidebar width for content margin ────────────────
    const sidebarWidth = sidebarCollapsed
      ? SIDEBAR_COLLAPSED_WIDTH
      : SIDEBAR_EXPANDED_WIDTH;

    // ── Render ──────────────────────────────────────────────────

    return (
      <DashboardLayoutContext.Provider value={layoutContextValue}>
        <div
          ref={ref}
          data-dashboard-layout=""
          className={cn(
            "flex min-h-screen flex-col bg-surface-secondary/30",
            className,
          )}
        >
          {/* ── Header ────────────────────────────────────── */}
          {showHeader && (
            <Header
              sticky
              bordered
              showSearch
              showNotifications
              showUserMenu
              showThemeToggle
              {...headerProps}
              navItems={headerProps.navItems ?? []}
            />
          )}

          {/* ── Body: Sidebar + Main ─────────────────────── */}
          <div className="flex flex-1">
            {/* ── Sidebar ──────────────────────────────── */}
            {showSidebar && sidebarItems.length > 0 && (
              <Sidebar
                items={sidebarItems}
                collapsed={sidebarCollapsed}
                onCollapsedChange={setSidebarCollapsed}
                mobileOpen={mobileSidebarOpen}
                onMobileClose={closeMobileSidebar}
                ariaLabel={sidebarProps.ariaLabel ?? "Navigare principală"}
                {...sidebarProps}
              />
            )}

            {/* ── Main Content ──────────────────────────── */}
            <main
              data-dashboard-content=""
              className={cn(
                "flex min-w-0 flex-1 flex-col",
                contentPadding && "p-4 md:p-6 lg:p-8",
                contentClassName,
              )}
              style={
                !isMobile && showSidebar && sidebarItems.length > 0
                  ? { marginLeft: 0 }
                  : undefined
              }
            >
              {/* Mobile sidebar toggle — shown inside content area on mobile */}
              {isMobile && showSidebar && sidebarItems.length > 0 && (
                <button
                  type="button"
                  onClick={openMobileSidebar}
                  className={cn(
                    "mb-4 inline-flex items-center gap-2 self-start",
                    "rounded-md px-3 py-2 text-sm font-medium",
                    "bg-surface border border-border-subtle",
                    "text-text-secondary hover:text-text-primary",
                    "transition-colors duration-150",
                    "focus-visible:outline-none focus-visible:ring-2",
                    "focus-visible:ring-border-focus",
                    "lg:hidden",
                  )}
                  aria-label="Deschide navigarea"
                >
                  <Menu className="h-4 w-4" aria-hidden="true" />
                  <span>Meniu</span>
                </button>
              )}

              {/* Page content */}
              <div className="flex-1">{children}</div>

              {/* ── Footer ─────────────────────────────── */}
              {showFooter && (
                <Footer
                  variant="default"
                  showBackToTop
                  {...footerProps}
                />
              )}
            </main>
          </div>
        </div>
      </DashboardLayoutContext.Provider>
    );
  },
);

DashboardLayout.displayName = "DashboardLayout";

// ═══════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════

export {
  DashboardLayout,
  DashboardLayoutContext,
};

export type {
  DashboardLayoutContextValue,
};

export default DashboardLayout;
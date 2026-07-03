/**
 * Theme Manager — Dark / Light / Custom with CSS Variables,
 * Preference Persistence, and System Detection
 *
 * Full-featured theme engine for Next.js applications. Provides:
 *   - Prebuilt light & dark theme palettes mapped to CSS custom properties
 *   - Custom theme support with partial or full token overrides
 *   - System preference detection via `prefers-color-scheme` media query
 *   - Preference persistence: localStorage (client) + cookie fallback (SSR)
 *   - Automatic `<html>` class toggling for Tailwind `darkMode: "class"`
 *   - Smooth transition orchestration (disable transitions on page load)
 *   - Theme change event bus for reactive UI updates
 *   - Color-scheme `<meta>` tag management
 *   - SSR-safe: all browser APIs are lazily accessed
 *
 * Theme Modes:
 *   "light"  — forced light palette
 *   "dark"   — forced dark palette
 *   "system" — follows OS preference, falls back to light
 *
 * Architecture:
 *   1. Theme tokens defined as CSS variable maps (key → value)
 *   2. Singleton controller manages current mode, active palette, listeners
 *   3. `applyTheme()` writes CSS variables to `:root` / `.dark` / custom class
 *   4. `setMode()` persists preference, updates DOM, emits events
 *   5. System listener (`matchMedia`) reacts to OS changes in "system" mode
 *   6. Cookie set on mode change for SSR flash prevention
 *
 * Usage — Simple:
 *   import { themeManager } from "@/lib/theme";
 *
 *   // Read
 *   const mode = themeManager.getMode();         // "light" | "dark" | "system"
 *   const palette = themeManager.getPalette();   // "light" | "dark"
 *
 *   // Write
 *   themeManager.setMode("dark");
 *   themeManager.setMode("system");
 *   themeManager.toggle();
 *
 *   // Custom theme
 *   themeManager.setCustomTheme("brand", {
 *     "--color-primary": "#ff6b00",
 *     "--color-bg": "#0a0a0a",
 *   });
 *   themeManager.setMode("brand");
 *
 *   // Listen
 *   const unsub = themeManager.onChange(({ mode, palette }) => { ... });
 *
 * Usage — React Hook (implement in hooks/useTheme.ts):
 *   import { themeManager } from "@/lib/theme";
 *   import { useState, useEffect, useSyncExternalStore } from "react";
 *
 *   export function useTheme() { ... }
 *
 * Environment Variables:
 *   THEME_DEFAULT_MODE             — default mode (default: "system")
 *   THEME_STORAGE_KEY              — localStorage key (default: "nexus-theme")
 *   THEME_COOKIE_NAME              — cookie name for SSR (default: "nexus-theme")
 *   THEME_COOKIE_MAX_AGE_DAYS      — cookie max-age in days (default: 365)
 *   THEME_DISABLE_TRANSITIONS_MS   — ms to disable transitions after mode change (default: 300)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported theme modes */
export type ThemeMode = "light" | "dark" | "system" | (string & {});

/** Resolved palette — always light or dark (never "system") */
export type ThemePalette = "light" | "dark";

/** A map of CSS custom property names to their values */
export type CSSVariableMap = Record<string, string>;

/** A complete theme definition */
export interface ThemeDefinition {
  /** Human-readable name */
  name: string;
  /** Whether this is a dark palette (affects native UI, scrollbars, etc.) */
  palette: ThemePalette;
  /** CSS custom properties map */
  variables: CSSVariableMap;
}

/** Theme change event payload */
export interface ThemeChangeEvent {
  /** The new mode (e.g., "dark", "light", "system", or a custom key) */
  mode: ThemeMode;
  /** The resolved palette */
  palette: ThemePalette;
  /** The full theme definition currently active */
  theme: ThemeDefinition;
  /** Whether this change was triggered by the system (OS preference) */
  systemTriggered: boolean;
}

/** Listener callback for theme changes */
export type ThemeChangeListener = (event: ThemeChangeEvent) => void;

/** Configuration for the theme manager */
export interface ThemeConfig {
  defaultMode: ThemeMode;
  storageKey: string;
  cookieName: string;
  cookieMaxAgeDays: number;
  disableTransitionsMs: number;
}

/** Serialized form stored in localStorage / cookie */
interface StoredPreference {
  mode: ThemeMode;
  customThemeKey?: string;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Built-in Theme Definitions
// ---------------------------------------------------------------------------

/**
 * Light theme — clean, professional, high-contrast.
 * All tokens are defined as CSS custom properties applied to `:root`.
 */
const LIGHT_THEME: ThemeDefinition = {
  name: "Light",
  palette: "light",
  variables: {
    // ── Backgrounds ────────────────────────────────────────────────
    "--color-bg": "hsl(0 0% 100%)",
    "--color-bg-secondary": "hsl(220 20% 98%)",
    "--color-bg-tertiary": "hsl(220 16% 94%)",
    "--color-bg-elevated": "hsl(0 0% 100%)",
    "--color-bg-overlay": "hsl(220 16% 10% / 0.5)",
    "--color-bg-backdrop": "hsl(220 16% 10% / 0.3)",
    "--color-bg-tooltip": "hsl(220 18% 10%)",
    "--color-bg-inverse": "hsl(220 18% 10%)",

    // ── Text ───────────────────────────────────────────────────────
    "--color-text-primary": "hsl(220 18% 10%)",
    "--color-text-secondary": "hsl(220 12% 36%)",
    "--color-text-tertiary": "hsl(220 8% 55%)",
    "--color-text-disabled": "hsl(220 8% 70%)",
    "--color-text-inverse": "hsl(0 0% 100%)",
    "--color-text-link": "hsl(222 75% 50%)",
    "--color-text-link-hover": "hsl(222 80% 42%)",

    // ── Borders ────────────────────────────────────────────────────
    "--color-border-default": "hsl(220 14% 88%)",
    "--color-border-strong": "hsl(220 12% 76%)",
    "--color-border-subtle": "hsl(220 16% 94%)",
    "--color-border-focus": "hsl(222 85% 72%)",
    "--color-border-hover": "hsl(220 12% 80%)",

    // ── Brand / Primary ────────────────────────────────────────────
    "--color-brand-50": "hsl(222 100% 97%)",
    "--color-brand-100": "hsl(222 95% 92%)",
    "--color-brand-200": "hsl(222 90% 84%)",
    "--color-brand-300": "hsl(222 85% 72%)",
    "--color-brand-400": "hsl(222 80% 60%)",
    "--color-brand-500": "hsl(222 75% 50%)",
    "--color-brand-600": "hsl(222 80% 42%)",
    "--color-brand-700": "hsl(222 85% 34%)",
    "--color-brand-800": "hsl(222 90% 24%)",
    "--color-brand-900": "hsl(222 95% 14%)",
    "--color-brand": "hsl(222 75% 50%)",
    "--color-brand-hover": "hsl(222 80% 42%)",
    "--color-brand-active": "hsl(222 85% 34%)",
    "--color-brand-fg": "hsl(0 0% 100%)",

    // ── Accent / Secondary ─────────────────────────────────────────
    "--color-accent-50": "hsl(170 100% 96%)",
    "--color-accent-100": "hsl(170 95% 90%)",
    "--color-accent-200": "hsl(170 90% 80%)",
    "--color-accent-300": "hsl(170 85% 68%)",
    "--color-accent-400": "hsl(170 80% 55%)",
    "--color-accent-500": "hsl(170 75% 44%)",
    "--color-accent-600": "hsl(170 80% 36%)",
    "--color-accent-700": "hsl(170 85% 28%)",
    "--color-accent-800": "hsl(170 90% 20%)",
    "--color-accent-900": "hsl(170 95% 12%)",
    "--color-accent": "hsl(170 75% 44%)",
    "--color-accent-hover": "hsl(170 80% 36%)",
    "--color-accent-active": "hsl(170 85% 28%)",
    "--color-accent-fg": "hsl(0 0% 100%)",

    // ── Semantic Colors ────────────────────────────────────────────
    "--color-success-50": "hsl(142 76% 95%)",
    "--color-success-100": "hsl(142 76% 88%)",
    "--color-success-200": "hsl(142 74% 78%)",
    "--color-success-300": "hsl(142 72% 62%)",
    "--color-success-400": "hsl(142 70% 50%)",
    "--color-success-500": "hsl(142 72% 40%)",
    "--color-success-600": "hsl(142 74% 32%)",
    "--color-success-700": "hsl(142 76% 24%)",
    "--color-success": "hsl(142 72% 40%)",
    "--color-success-fg": "hsl(0 0% 100%)",

    "--color-warning-50": "hsl(38 100% 95%)",
    "--color-warning-100": "hsl(38 100% 88%)",
    "--color-warning-200": "hsl(38 98% 78%)",
    "--color-warning-300": "hsl(38 96% 62%)",
    "--color-warning-400": "hsl(38 94% 50%)",
    "--color-warning-500": "hsl(38 96% 42%)",
    "--color-warning-600": "hsl(38 98% 34%)",
    "--color-warning-700": "hsl(38 100% 26%)",
    "--color-warning": "hsl(38 96% 42%)",
    "--color-warning-fg": "hsl(0 0% 100%)",

    "--color-danger-50": "hsl(0 86% 96%)",
    "--color-danger-100": "hsl(0 86% 90%)",
    "--color-danger-200": "hsl(0 84% 82%)",
    "--color-danger-300": "hsl(0 82% 68%)",
    "--color-danger-400": "hsl(0 80% 56%)",
    "--color-danger-500": "hsl(0 82% 46%)",
    "--color-danger-600": "hsl(0 84% 38%)",
    "--color-danger-700": "hsl(0 86% 28%)",
    "--color-danger": "hsl(0 82% 46%)",
    "--color-danger-fg": "hsl(0 0% 100%)",

    "--color-info-50": "hsl(200 100% 96%)",
    "--color-info-100": "hsl(200 95% 90%)",
    "--color-info-200": "hsl(200 90% 82%)",
    "--color-info-300": "hsl(200 85% 68%)",
    "--color-info-400": "hsl(200 80% 55%)",
    "--color-info-500": "hsl(200 78% 46%)",
    "--color-info-600": "hsl(200 82% 38%)",
    "--color-info": "hsl(200 78% 46%)",
    "--color-info-fg": "hsl(0 0% 100%)",

    // ── Neutral Grays ──────────────────────────────────────────────
    "--color-neutral-0": "hsl(0 0% 100%)",
    "--color-neutral-50": "hsl(220 20% 98%)",
    "--color-neutral-100": "hsl(220 16% 94%)",
    "--color-neutral-200": "hsl(220 14% 88%)",
    "--color-neutral-300": "hsl(220 12% 76%)",
    "--color-neutral-400": "hsl(220 10% 60%)",
    "--color-neutral-500": "hsl(220 8% 48%)",
    "--color-neutral-600": "hsl(220 10% 36%)",
    "--color-neutral-700": "hsl(220 12% 26%)",
    "--color-neutral-800": "hsl(220 14% 18%)",
    "--color-neutral-900": "hsl(220 16% 10%)",
    "--color-neutral-950": "hsl(220 18% 6%)",

    // ── Shadows ────────────────────────────────────────────────────
    "--shadow-elevation-1": "0 1px 2px 0 hsl(220 20% 10% / 0.04), 0 1px 3px 0 hsl(220 20% 10% / 0.02)",
    "--shadow-elevation-2": "0 2px 4px -1px hsl(220 20% 10% / 0.06), 0 4px 6px -2px hsl(220 20% 10% / 0.04)",
    "--shadow-elevation-3": "0 4px 8px -2px hsl(220 20% 10% / 0.08), 0 8px 12px -3px hsl(220 20% 10% / 0.04)",
    "--shadow-elevation-4": "0 8px 16px -4px hsl(220 20% 10% / 0.10), 0 16px 24px -6px hsl(220 20% 10% / 0.06)",
    "--shadow-elevation-5": "0 16px 32px -8px hsl(220 20% 10% / 0.12), 0 24px 48px -12px hsl(220 20% 10% / 0.06)",
    "--shadow-card": "0 1px 3px 0 hsl(220 20% 10% / 0.04), 0 1px 2px 0 hsl(220 20% 10% / 0.02)",
    "--shadow-card-hover": "0 4px 12px -2px hsl(220 20% 10% / 0.08), 0 2px 4px -1px hsl(220 20% 10% / 0.04)",
    "--shadow-dropdown": "0 4px 16px -4px hsl(220 20% 10% / 0.10), 0 8px 12px -4px hsl(220 20% 10% / 0.04)",
    "--shadow-modal": "0 16px 48px -12px hsl(220 20% 10% / 0.15), 0 8px 24px -8px hsl(220 20% 10% / 0.08)",
    "--shadow-toast": "0 4px 16px -4px hsl(220 20% 10% / 0.12), 0 2px 8px -2px hsl(220 20% 10% / 0.06)",
    "--shadow-focus": "0 0 0 3px hsl(222 85% 72% / 0.4)",

    // ── Radii ──────────────────────────────────────────────────────
    "--radius-none": "0px",
    "--radius-xs": "0.125rem",
    "--radius-sm": "0.25rem",
    "--radius-md": "0.375rem",
    "--radius-lg": "0.5rem",
    "--radius-xl": "0.75rem",
    "--radius-2xl": "1rem",
    "--radius-3xl": "1.5rem",
    "--radius-full": "9999px",

    // ── Spacing Scale ──────────────────────────────────────────────
    "--space-0": "0px",
    "--space-px": "1px",
    "--space-0-5": "0.125rem",
    "--space-1": "0.25rem",
    "--space-1-5": "0.375rem",
    "--space-2": "0.5rem",
    "--space-2-5": "0.625rem",
    "--space-3": "0.75rem",
    "--space-3-5": "0.875rem",
    "--space-4": "1rem",
    "--space-5": "1.25rem",
    "--space-6": "1.5rem",
    "--space-7": "1.75rem",
    "--space-8": "2rem",
    "--space-9": "2.25rem",
    "--space-10": "2.5rem",
    "--space-11": "2.75rem",
    "--space-12": "3rem",
    "--space-14": "3.5rem",
    "--space-16": "4rem",
    "--space-20": "5rem",
    "--space-24": "6rem",
    "--space-28": "7rem",
    "--space-32": "8rem",
    "--space-36": "9rem",
    "--space-40": "10rem",
    "--space-44": "11rem",
    "--space-48": "12rem",
    "--space-52": "13rem",
    "--space-56": "14rem",
    "--space-60": "15rem",
    "--space-64": "16rem",
    "--space-72": "18rem",
    "--space-80": "20rem",
    "--space-96": "24rem",

    // ── Font Families ──────────────────────────────────────────────
    "--font-sans": "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    "--font-heading": "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "--font-mono": "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', Menlo, Monaco, Consolas, monospace",

    // ── Font Sizes ─────────────────────────────────────────────────
    "--text-xs": "0.75rem",
    "--text-sm": "0.875rem",
    "--text-base": "1rem",
    "--text-lg": "1.125rem",
    "--text-xl": "1.25rem",
    "--text-2xl": "1.5rem",
    "--text-3xl": "1.875rem",
    "--text-4xl": "2.25rem",
    "--text-5xl": "3rem",
    "--text-6xl": "3.75rem",

    // ── Font Weights ───────────────────────────────────────────────
    "--font-weight-light": "300",
    "--font-weight-normal": "400",
    "--font-weight-medium": "500",
    "--font-weight-semibold": "600",
    "--font-weight-bold": "700",
    "--font-weight-extrabold": "800",

    // ── Line Heights ───────────────────────────────────────────────
    "--leading-none": "1",
    "--leading-tight": "1.25",
    "--leading-snug": "1.375",
    "--leading-normal": "1.5",
    "--leading-relaxed": "1.625",
    "--leading-loose": "2",

    // ── Transitions ────────────────────────────────────────────────
    "--transition-fast": "150ms",
    "--transition-base": "200ms",
    "--transition-slow": "300ms",
    "--transition-ease": "cubic-bezier(0.4, 0, 0.2, 1)",
    "--transition-ease-in": "cubic-bezier(0.4, 0, 1, 1)",
    "--transition-ease-out": "cubic-bezier(0, 0, 0.2, 1)",
    "--transition-ease-in-out": "cubic-bezier(0.4, 0, 0.2, 1)",

    // ── Z-Index Scale ──────────────────────────────────────────────
    "--z-hide": "-1",
    "--z-base": "0",
    "--z-raised": "1",
    "--z-dropdown": "50",
    "--z-sticky": "100",
    "--z-overlay": "200",
    "--z-drawer": "300",
    "--z-modal": "400",
    "--z-popover": "500",
    "--z-tooltip": "600",
    "--z-toast": "700",
    "--z-loader": "800",

    // ── Misc ───────────────────────────────────────────────────────
    "--color-scheme": "light",
    "--scrollbar-track": "hsl(220 16% 94%)",
    "--scrollbar-thumb": "hsl(220 10% 70%)",
    "--scrollbar-thumb-hover": "hsl(220 10% 55%)",
    "--selection-bg": "hsl(222 85% 72% / 0.35)",
    "--selection-fg": "hsl(220 18% 10%)",
    "--focus-ring": "0 0 0 3px hsl(222 85% 72% / 0.4)",
  },
};

/**
 * Dark theme — reduced eye strain, high contrast, deep backgrounds.
 * Applied via `html.dark` selector for Tailwind compatibility.
 */
const DARK_THEME: ThemeDefinition = {
  name: "Dark",
  palette: "dark",
  variables: {
    // ── Backgrounds ────────────────────────────────────────────────
    "--color-bg": "hsl(220 18% 6%)",
    "--color-bg-secondary": "hsl(220 16% 10%)",
    "--color-bg-tertiary": "hsl(220 14% 13%)",
    "--color-bg-elevated": "hsl(220 14% 12%)",
    "--color-bg-overlay": "hsl(220 20% 3% / 0.7)",
    "--color-bg-backdrop": "hsl(220 20% 3% / 0.5)",
    "--color-bg-tooltip": "hsl(220 16% 94%)",
    "--color-bg-inverse": "hsl(0 0% 100%)",

    // ── Text ───────────────────────────────────────────────────────
    "--color-text-primary": "hsl(220 20% 94%)",
    "--color-text-secondary": "hsl(220 14% 70%)",
    "--color-text-tertiary": "hsl(220 10% 55%)",
    "--color-text-disabled": "hsl(220 10% 45%)",
    "--color-text-inverse": "hsl(220 18% 10%)",
    "--color-text-link": "hsl(222 80% 65%)",
    "--color-text-link-hover": "hsl(222 85% 75%)",

    // ── Borders ────────────────────────────────────────────────────
    "--color-border-default": "hsl(220 14% 20%)",
    "--color-border-strong": "hsl(220 14% 28%)",
    "--color-border-subtle": "hsl(220 14% 15%)",
    "--color-border-focus": "hsl(222 75% 55%)",
    "--color-border-hover": "hsl(220 14% 32%)",

    // ── Brand / Primary ────────────────────────────────────────────
    "--color-brand-50": "hsl(222 60% 12%)",
    "--color-brand-100": "hsl(222 65% 16%)",
    "--color-brand-200": "hsl(222 70% 22%)",
    "--color-brand-300": "hsl(222 75% 32%)",
    "--color-brand-400": "hsl(222 80% 48%)",
    "--color-brand-500": "hsl(222 82% 58%)",
    "--color-brand-600": "hsl(222 76% 50%)",
    "--color-brand-700": "hsl(222 70% 42%)",
    "--color-brand-800": "hsl(222 60% 30%)",
    "--color-brand-900": "hsl(222 50% 18%)",
    "--color-brand": "hsl(222 82% 58%)",
    "--color-brand-hover": "hsl(222 76% 50%)",
    "--color-brand-active": "hsl(222 70% 42%)",
    "--color-brand-fg": "hsl(0 0% 100%)",

    // ── Accent / Secondary ─────────────────────────────────────────
    "--color-accent-50": "hsl(170 50% 10%)",
    "--color-accent-100": "hsl(170 55% 14%)",
    "--color-accent-200": "hsl(170 60% 20%)",
    "--color-accent-300": "hsl(170 65% 28%)",
    "--color-accent-400": "hsl(170 70% 40%)",
    "--color-accent-500": "hsl(170 72% 50%)",
    "--color-accent-600": "hsl(170 68% 42%)",
    "--color-accent-700": "hsl(170 62% 34%)",
    "--color-accent-800": "hsl(170 55% 24%)",
    "--color-accent-900": "hsl(170 45% 14%)",
    "--color-accent": "hsl(170 72% 50%)",
    "--color-accent-hover": "hsl(170 68% 42%)",
    "--color-accent-active": "hsl(170 62% 34%)",
    "--color-accent-fg": "hsl(0 0% 100%)",

    // ── Semantic Colors ────────────────────────────────────────────
    "--color-success-50": "hsl(142 40% 10%)",
    "--color-success-100": "hsl(142 45% 14%)",
    "--color-success-200": "hsl(142 50% 20%)",
    "--color-success-300": "hsl(142 55% 28%)",
    "--color-success-400": "hsl(142 60% 40%)",
    "--color-success-500": "hsl(142 62% 48%)",
    "--color-success-600": "hsl(142 58% 40%)",
    "--color-success-700": "hsl(142 52% 32%)",
    "--color-success": "hsl(142 62% 48%)",
    "--color-success-fg": "hsl(0 0% 100%)",

    "--color-warning-50": "hsl(38 50% 10%)",
    "--color-warning-100": "hsl(38 55% 14%)",
    "--color-warning-200": "hsl(38 60% 20%)",
    "--color-warning-300": "hsl(38 65% 28%)",
    "--color-warning-400": "hsl(38 70% 40%)",
    "--color-warning-500": "hsl(38 72% 48%)",
    "--color-warning-600": "hsl(38 68% 40%)",
    "--color-warning-700": "hsl(38 60% 32%)",
    "--color-warning": "hsl(38 72% 48%)",
    "--color-warning-fg": "hsl(0 0% 100%)",

    "--color-danger-50": "hsl(0 40% 10%)",
    "--color-danger-100": "hsl(0 45% 14%)",
    "--color-danger-200": "hsl(0 50% 20%)",
    "--color-danger-300": "hsl(0 55% 28%)",
    "--color-danger-400": "hsl(0 60% 40%)",
    "--color-danger-500": "hsl(0 62% 50%)",
    "--color-danger-600": "hsl(0 58% 42%)",
    "--color-danger-700": "hsl(0 52% 34%)",
    "--color-danger": "hsl(0 62% 50%)",
    "--color-danger-fg": "hsl(0 0% 100%)",

    "--color-info-50": "hsl(200 50% 10%)",
    "--color-info-100": "hsl(200 55% 14%)",
    "--color-info-200": "hsl(200 60% 20%)",
    "--color-info-300": "hsl(200 65% 28%)",
    "--color-info-400": "hsl(200 70% 40%)",
    "--color-info-500": "hsl(200 72% 50%)",
    "--color-info-600": "hsl(200 68% 42%)",
    "--color-info": "hsl(200 72% 50%)",
    "--color-info-fg": "hsl(0 0% 100%)",

    // ── Neutral Grays ──────────────────────────────────────────────
    "--color-neutral-0": "hsl(220 18% 6%)",
    "--color-neutral-50": "hsl(220 16% 10%)",
    "--color-neutral-100": "hsl(220 14% 14%)",
    "--color-neutral-200": "hsl(220 14% 20%)",
    "--color-neutral-300": "hsl(220 14% 26%)",
    "--color-neutral-400": "hsl(220 12% 42%)",
    "--color-neutral-500": "hsl(220 10% 55%)",
    "--color-neutral-600": "hsl(220 12% 65%)",
    "--color-neutral-700": "hsl(220 14% 76%)",
    "--color-neutral-800": "hsl(220 16% 88%)",
    "--color-neutral-900": "hsl(220 18% 94%)",
    "--color-neutral-950": "hsl(220 20% 98%)",

    // ── Shadows ────────────────────────────────────────────────────
    "--shadow-elevation-1": "0 1px 2px 0 hsl(220 20% 0% / 0.25), 0 1px 3px 0 hsl(220 20% 0% / 0.12)",
    "--shadow-elevation-2": "0 2px 4px -1px hsl(220 20% 0% / 0.30), 0 4px 6px -2px hsl(220 20% 0% / 0.15)",
    "--shadow-elevation-3": "0 4px 8px -2px hsl(220 20% 0% / 0.35), 0 8px 12px -3px hsl(220 20% 0% / 0.18)",
    "--shadow-elevation-4": "0 8px 16px -4px hsl(220 20% 0% / 0.40), 0 16px 24px -6px hsl(220 20% 0% / 0.22)",
    "--shadow-elevation-5": "0 16px 32px -8px hsl(220 20% 0% / 0.45), 0 24px 48px -12px hsl(220 20% 0% / 0.25)",
    "--shadow-card": "0 1px 3px 0 hsl(220 20% 0% / 0.25), 0 1px 2px 0 hsl(220 20% 0% / 0.12)",
    "--shadow-card-hover": "0 4px 12px -2px hsl(220 20% 0% / 0.35), 0 2px 4px -1px hsl(220 20% 0% / 0.18)",
    "--shadow-dropdown": "0 4px 16px -4px hsl(220 20% 0% / 0.40), 0 8px 12px -4px hsl(220 20% 0% / 0.20)",
    "--shadow-modal": "0 16px 48px -12px hsl(220 20% 0% / 0.50), 0 8px 24px -8px hsl(220 20% 0% / 0.25)",
    "--shadow-toast": "0 4px 16px -4px hsl(220 20% 0% / 0.45), 0 2px 8px -2px hsl(220 20% 0% / 0.22)",
    "--shadow-focus": "0 0 0 3px hsl(222 75% 55% / 0.4)",

    // ── Radii ──────────────────────────────────────────────────────
    "--radius-none": "0px",
    "--radius-xs": "0.125rem",
    "--radius-sm": "0.25rem",
    "--radius-md": "0.375rem",
    "--radius-lg": "0.5rem",
    "--radius-xl": "0.75rem",
    "--radius-2xl": "1rem",
    "--radius-3xl": "1.5rem",
    "--radius-full": "9999px",

    // ── Spacing Scale ──────────────────────────────────────────────
    "--space-0": "0px",
    "--space-px": "1px",
    "--space-0-5": "0.125rem",
    "--space-1": "0.25rem",
    "--space-1-5": "0.375rem",
    "--space-2": "0.5rem",
    "--space-2-5": "0.625rem",
    "--space-3": "0.75rem",
    "--space-3-5": "0.875rem",
    "--space-4": "1rem",
    "--space-5": "1.25rem",
    "--space-6": "1.5rem",
    "--space-7": "1.75rem",
    "--space-8": "2rem",
    "--space-9": "2.25rem",
    "--space-10": "2.5rem",
    "--space-11": "2.75rem",
    "--space-12": "3rem",
    "--space-14": "3.5rem",
    "--space-16": "4rem",
    "--space-20": "5rem",
    "--space-24": "6rem",
    "--space-28": "7rem",
    "--space-32": "8rem",
    "--space-36": "9rem",
    "--space-40": "10rem",
    "--space-44": "11rem",
    "--space-48": "12rem",
    "--space-52": "13rem",
    "--space-56": "14rem",
    "--space-60": "15rem",
    "--space-64": "16rem",
    "--space-72": "18rem",
    "--space-80": "20rem",
    "--space-96": "24rem",

    // ── Font Families ──────────────────────────────────────────────
    "--font-sans": "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    "--font-heading": "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    "--font-mono": "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'SF Mono', Menlo, Monaco, Consolas, monospace",

    // ── Font Sizes ─────────────────────────────────────────────────
    "--text-xs": "0.75rem",
    "--text-sm": "0.875rem",
    "--text-base": "1rem",
    "--text-lg": "1.125rem",
    "--text-xl": "1.25rem",
    "--text-2xl": "1.5rem",
    "--text-3xl": "1.875rem",
    "--text-4xl": "2.25rem",
    "--text-5xl": "3rem",
    "--text-6xl": "3.75rem",

    // ── Font Weights ───────────────────────────────────────────────
    "--font-weight-light": "300",
    "--font-weight-normal": "400",
    "--font-weight-medium": "500",
    "--font-weight-semibold": "600",
    "--font-weight-bold": "700",
    "--font-weight-extrabold": "800",

    // ── Line Heights ───────────────────────────────────────────────
    "--leading-none": "1",
    "--leading-tight": "1.25",
    "--leading-snug": "1.375",
    "--leading-normal": "1.5",
    "--leading-relaxed": "1.625",
    "--leading-loose": "2",

    // ── Transitions ────────────────────────────────────────────────
    "--transition-fast": "150ms",
    "--transition-base": "200ms",
    "--transition-slow": "300ms",
    "--transition-ease": "cubic-bezier(0.4, 0, 0.2, 1)",
    "--transition-ease-in": "cubic-bezier(0.4, 0, 1, 1)",
    "--transition-ease-out": "cubic-bezier(0, 0, 0.2, 1)",
    "--transition-ease-in-out": "cubic-bezier(0.4, 0, 0.2, 1)",

    // ── Z-Index Scale ──────────────────────────────────────────────
    "--z-hide": "-1",
    "--z-base": "0",
    "--z-raised": "1",
    "--z-dropdown": "50",
    "--z-sticky": "100",
    "--z-overlay": "200",
    "--z-drawer": "300",
    "--z-modal": "400",
    "--z-popover": "500",
    "--z-tooltip": "600",
    "--z-toast": "700",
    "--z-loader": "800",

    // ── Misc ───────────────────────────────────────────────────────
    "--color-scheme": "dark",
    "--scrollbar-track": "hsl(220 14% 14%)",
    "--scrollbar-thumb": "hsl(220 12% 35%)",
    "--scrollbar-thumb-hover": "hsl(220 12% 48%)",
    "--selection-bg": "hsl(222 75% 55% / 0.35)",
    "--selection-fg": "hsl(220 20% 94%)",
    "--focus-ring": "0 0 0 3px hsl(222 75% 55% / 0.4)",
  },
};

// ---------------------------------------------------------------------------
// Global State
// ---------------------------------------------------------------------------

interface ThemeManagerState {
  config: ThemeConfig;
  mode: ThemeMode;
  resolvedPalette: ThemePalette;
  activeTheme: ThemeDefinition;
  customThemes: Map<string, ThemeDefinition>;
  listeners: Set<ThemeChangeListener>;
  systemMediaQuery: MediaQueryList | null;
  systemListener: ((e: MediaQueryListEvent) => void) | null;
  initialized: boolean;
  transitionTimeout: ReturnType<typeof setTimeout> | null;
}

const globalForTheme = globalThis as unknown as {
  __themeState: ThemeManagerState | undefined;
};

function getState(): ThemeManagerState {
  if (!globalForTheme.__themeState) {
    globalForTheme.__themeState = createInitialState();
  }
  return globalForTheme.__themeState;
}

function createInitialState(): ThemeManagerState {
  const config = buildThemeConfig();
  return {
    config,
    mode: config.defaultMode,
    resolvedPalette: "light",
    activeTheme: LIGHT_THEME,
    customThemes: new Map(),
    listeners: new Set(),
    systemMediaQuery: null,
    systemListener: null,
    initialized: false,
    transitionTimeout: null,
  };
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function buildThemeConfig(): ThemeConfig {
  return {
    defaultMode: (process.env.THEME_DEFAULT_MODE as ThemeMode) || "system",
    storageKey: process.env.THEME_STORAGE_KEY || "nexus-theme",
    cookieName: process.env.THEME_COOKIE_NAME || "nexus-theme",
    cookieMaxAgeDays: Number(process.env.THEME_COOKIE_MAX_AGE_DAYS || 365),
    disableTransitionsMs: Number(process.env.THEME_DISABLE_TRANSITIONS_MS || 300),
  };
}

// ---------------------------------------------------------------------------
// Browser Detection
// ---------------------------------------------------------------------------

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

// ---------------------------------------------------------------------------
// System Preference Detection
// ---------------------------------------------------------------------------

export function getSystemPreference(): ThemePalette {
  if (!isBrowser()) return "light";
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return "light";
  }
}

// ---------------------------------------------------------------------------
// Cookie Helpers
// ---------------------------------------------------------------------------

function setCookie(name: string, value: string, maxAgeDays: number): void {
  if (!isBrowser()) return;
  try {
    const maxAge = maxAgeDays * 24 * 60 * 60;
    document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)};path=/;max-age=${maxAge};SameSite=Lax`;
  } catch {
    // Silently fail — cookie is a progressive enhancement
  }
}

function getCookie(name: string): string | null {
  if (!isBrowser()) return null;
  try {
    const match = document.cookie.match(
      new RegExp(`(?:^|; )${name.replace(/([.$?*|{}()\[\]\\/+^])/g, "\\$1")}=([^;]*)`),
    );
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// localStorage Helpers
// ---------------------------------------------------------------------------

function loadStoredPreference(): StoredPreference | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(getState().config.storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredPreference;
    if (!parsed || typeof parsed.mode !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveStoredPreference(pref: StoredPreference): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(getState().config.storageKey, JSON.stringify(pref));
  } catch {
    // Storage full or unavailable — non-critical
  }
}

function clearStoredPreference(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(getState().config.storageKey);
  } catch {
    // Ignore
  }
}

// ---------------------------------------------------------------------------
// DOM Manipulation
// ---------------------------------------------------------------------------

function applyCSSVariables(variables: CSSVariableMap, palette: ThemePalette): void {
  if (!isBrowser()) return;

  const root = document.documentElement;

  if (palette === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  for (const [key, value] of Object.entries(variables)) {
    root.style.setProperty(key, value);
  }
}

function updateColorSchemeMeta(palette: ThemePalette): void {
  if (!isBrowser()) return;

  let meta = document.querySelector<HTMLMetaElement>('meta[name="color-scheme"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "color-scheme";
    document.head.appendChild(meta);
  }
  meta.content = palette === "dark" ? "dark" : "light";
}

function disableTransitionsTemporarily(durationMs: number): void {
  if (!isBrowser()) return;

  const state = getState();
  const root = document.documentElement;

  root.classList.add("theme-transitioning");

  if (state.transitionTimeout) {
    clearTimeout(state.transitionTimeout);
  }

  state.transitionTimeout = setTimeout(() => {
    root.classList.remove("theme-transitioning");
    state.transitionTimeout = null;
  }, durationMs);
}

// ---------------------------------------------------------------------------
// Theme Resolution
// ---------------------------------------------------------------------------

function resolvePalette(mode: ThemeMode): ThemePalette {
  if (mode === "system") {
    return getSystemPreference();
  }

  const state = getState();

  if (mode === "light") return "light";
  if (mode === "dark") return "dark";

  const custom = state.customThemes.get(mode);
  if (custom) return custom.palette;

  return "light";
}

function getThemeForMode(mode: ThemeMode): ThemeDefinition {
  if (mode === "system") {
    const sysPalette = getSystemPreference();
    return sysPalette === "dark" ? DARK_THEME : LIGHT_THEME;
  }

  if (mode === "light") return LIGHT_THEME;
  if (mode === "dark") return DARK_THEME;

  const state = getState();
  const custom = state.customThemes.get(mode);
  if (custom) return custom;

  return LIGHT_THEME;
}

// ---------------------------------------------------------------------------
// System Preference Listener
// ---------------------------------------------------------------------------

function setupSystemListener(): void {
  if (!isBrowser()) return;

  const state = getState();
  teardownSystemListener();

  try {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    state.systemMediaQuery = mq;

    const handler = (e: MediaQueryListEvent) => {
      if (state.mode !== "system") return;

      const newPalette: ThemePalette = e.matches ? "dark" : "light";
      const newTheme = e.matches ? DARK_THEME : LIGHT_THEME;

      state.resolvedPalette = newPalette;
      state.activeTheme = newTheme;

      applyCSSVariables(newTheme.variables, newPalette);
      updateColorSchemeMeta(newPalette);
      disableTransitionsTemporarily(state.config.disableTransitionsMs);

      const event: ThemeChangeEvent = {
        mode: "system",
        palette: newPalette,
        theme: newTheme,
        systemTriggered: true,
      };

      for (const listener of state.listeners) {
        try {
          listener(event);
        } catch {
          // Don't let one broken listener break the rest
        }
      }
    };

    mq.addEventListener("change", handler);
    state.systemListener = handler;
  } catch {
    // matchMedia not available — silently skip
  }
}

function teardownSystemListener(): void {
  const state = getState();
  if (state.systemMediaQuery && state.systemListener) {
    try {
      state.systemMediaQuery.removeEventListener("change", state.systemListener);
    } catch {
      // Best effort
    }
    state.systemMediaQuery = null;
    state.systemListener = null;
  }
}

// ---------------------------------------------------------------------------
// Core: Initialize
// ---------------------------------------------------------------------------

export function initializeTheme(): ThemeChangeEvent {
  const state = getState();

  if (state.initialized) {
    return {
      mode: state.mode,
      palette: state.resolvedPalette,
      theme: state.activeTheme,
      systemTriggered: false,
    };
  }

  const stored = loadStoredPreference();
  let mode = stored?.mode ?? null;

  if (!mode) {
    const cookieValue = getCookie(state.config.cookieName);
    if (cookieValue === "light" || cookieValue === "dark" || cookieValue === "system") {
      mode = cookieValue;
    } else if (cookieValue && state.customThemes.has(cookieValue)) {
      mode = cookieValue;
    }
  }

  if (!mode) {
    mode = state.config.defaultMode;
  }

  const palette = resolvePalette(mode);
  const theme = getThemeForMode(mode);

  state.mode = mode;
  state.resolvedPalette = palette;
  state.activeTheme = theme;

  applyCSSVariables(theme.variables, palette);
  updateColorSchemeMeta(palette);
  disableTransitionsTemporarily(state.config.disableTransitionsMs);
  setupSystemListener();

  state.initialized = true;

  return {
    mode,
    palette,
    theme,
    systemTriggered: false,
  };
}

// ---------------------------------------------------------------------------
// Core: Set Mode
// ---------------------------------------------------------------------------

export function setMode(
  mode: ThemeMode,
  options?: { persist?: boolean; skipTransitionDisable?: boolean },
): ThemeChangeEvent {
  const state = getState();
  const persist = options?.persist ?? true;

  if (mode !== "light" && mode !== "dark" && mode !== "system") {
    if (!state.customThemes.has(mode)) {
      console.warn(
        `[theme] Unknown theme mode "${mode}". Falling back to "system". ` +
        `Use registerCustomTheme() to register custom themes.`,
      );
      mode = "system";
    }
  }

  const palette = resolvePalette(mode);
  const theme = getThemeForMode(mode);

  state.mode = mode;
  state.resolvedPalette = palette;
  state.activeTheme = theme;

  applyCSSVariables(theme.variables, palette);
  updateColorSchemeMeta(palette);

  if (!options?.skipTransitionDisable) {
    disableTransitionsTemporarily(state.config.disableTransitionsMs);
  }

  if (persist) {
    const pref: StoredPreference = {
      mode,
      customThemeKey: mode !== "light" && mode !== "dark" && mode !== "system" ? mode : undefined,
      timestamp: Date.now(),
    };
    saveStoredPreference(pref);
    setCookie(state.config.cookieName, mode, state.config.cookieMaxAgeDays);
  }

  const event: ThemeChangeEvent = {
    mode,
    palette,
    theme,
    systemTriggered: false,
  };

  for (const listener of state.listeners) {
    try {
      listener(event);
    } catch {
      // Don't let one broken listener break the rest
    }
  }

  return event;
}

// ---------------------------------------------------------------------------
// Toggle
// ---------------------------------------------------------------------------

export function toggleMode(persist = true): ThemeChangeEvent {
  const state = getState();
  const current = state.mode;

  if (current === "light") return setMode("dark", { persist });
  if (current === "dark") return setMode("light", { persist });
  if (current === "system") {
    const opposite: ThemeMode = state.resolvedPalette === "dark" ? "light" : "dark";
    return setMode(opposite, { persist });
  }

  return setMode("light", { persist });
}

// ---------------------------------------------------------------------------
// Getters
// ---------------------------------------------------------------------------

export function getMode(): ThemeMode {
  return getState().mode;
}

export function getPalette(): ThemePalette {
  return getState().resolvedPalette;
}

export function getActiveTheme(): ThemeDefinition {
  return getState().activeTheme;
}

export function isDark(): boolean {
  return getState().resolvedPalette === "dark";
}

export function getCSSVariable(name: string): string | null {
  const state = getState();
  return state.activeTheme.variables[name] ?? null;
}

// ---------------------------------------------------------------------------
// Custom Themes
// ---------------------------------------------------------------------------

export function registerCustomTheme(
  key: string,
  definition: ThemeDefinition,
): void {
  if (key === "light" || key === "dark" || key === "system") {
    console.warn(`[theme] Cannot override built-in theme "${key}".`);
    return;
  }

  const state = getState();

  const base = definition.palette === "dark" ? DARK_THEME : LIGHT_THEME;
  const mergedVariables: CSSVariableMap = { ...base.variables, ...definition.variables };

  const merged: ThemeDefinition = {
    name: definition.name,
    palette: definition.palette,
    variables: mergedVariables,
  };

  state.customThemes.set(key, merged);
}

export function unregisterCustomTheme(key: string): void {
  const state = getState();
  state.customThemes.delete(key);

  if (state.mode === key) {
    setMode("system");
  }
}

export function listCustomThemes(): string[] {
  return Array.from(getState().customThemes.keys());
}

export function getCustomTheme(key: string): ThemeDefinition | undefined {
  return getState().customThemes.get(key);
}

// ---------------------------------------------------------------------------
// Override Specific Variables at Runtime
// ---------------------------------------------------------------------------

export function overrideVariable(variable: string, value: string): void {
  if (!isBrowser()) return;
  document.documentElement.style.setProperty(variable, value);
}

export function overrideVariables(overrides: CSSVariableMap): void {
  if (!isBrowser()) return;
  const root = document.documentElement;
  for (const [key, value] of Object.entries(overrides)) {
    root.style.setProperty(key, value);
  }
}

// ---------------------------------------------------------------------------
// Theme Change Events
// ---------------------------------------------------------------------------

export function onChange(listener: ThemeChangeListener): () => void {
  const state = getState();
  state.listeners.add(listener);

  return () => {
    state.listeners.delete(listener);
  };
}

export function clearListeners(): void {
  getState().listeners.clear();
}

// ---------------------------------------------------------------------------
// SSR Helpers
// ---------------------------------------------------------------------------

export function getThemeInitScript(): string {
  const cookieName = process.env.THEME_COOKIE_NAME || "nexus-theme";
  const storageKey = process.env.THEME_STORAGE_KEY || "nexus-theme";

  return `
(function() {
  try {
    var mode = null;

    // 1. Try localStorage
    var stored = localStorage.getItem('${storageKey}');
    if (stored) {
      try { var parsed = JSON.parse(stored); mode = parsed.mode; } catch(e) {}
    }

    // 2. Try cookie
    if (!mode) {
      var match = document.cookie.match('(?:^|; )${cookieName}=([^;]*)');
      if (match) mode = decodeURIComponent(match[1]);
    }

    // 3. Fallback: check system preference
    if (!mode || mode === 'system') {
      mode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    // Apply class for Tailwind darkMode: 'class'
    var root = document.documentElement;
    if (mode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Set basic CSS vars to prevent white flash
    if (root.classList.contains('dark')) {
      root.style.setProperty('--color-bg', 'hsl(220 18% 6%)');
      root.style.setProperty('--color-text-primary', 'hsl(220 20% 94%)');
      root.style.setProperty('color-scheme', 'dark');
    } else {
      root.style.setProperty('--color-bg', 'hsl(0 0% 100%)');
      root.style.setProperty('--color-text-primary', 'hsl(220 18% 10%)');
      root.style.setProperty('color-scheme', 'light');
    }

    // Prevent flash of wrong color-scheme
    var meta = document.querySelector('meta[name="color-scheme"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'color-scheme';
      document.head.appendChild(meta);
    }
    meta.content = mode === 'dark' ? 'dark' : 'light';
  } catch(e) {
    // Silently fail — theme is non-critical
  }
})();`;
}

export function getServerTheme(cookieHeader: string | null): ThemeMode | null {
  if (!cookieHeader) return null;

  const cookieName = process.env.THEME_COOKIE_NAME || "nexus-theme";
  const match = cookieHeader.match(
    new RegExp(`(?:^|; )${cookieName.replace(/([.$?*|{}()\[\]\\/+^])/g, "\\$1")}=([^;]*)`),
  );

  if (!match) return null;

  const value = decodeURIComponent(match[1]);

  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }

  return value.length > 0 && value.length <= 64 ? value : null;
}

// ---------------------------------------------------------------------------
// Persistence Management
// ---------------------------------------------------------------------------

export function clearPreference(): ThemeChangeEvent {
  clearStoredPreference();
  setCookie(getState().config.cookieName, "", -1);
  return setMode(getState().config.defaultMode, { persist: false });
}

export function getPreferenceTimestamp(): number | null {
  const stored = loadStoredPreference();
  return stored?.timestamp ?? null;
}

// ---------------------------------------------------------------------------
// Health Check
// ---------------------------------------------------------------------------

export function pingTheme(): {
  healthy: boolean;
  mode: ThemeMode;
  palette: ThemePalette;
  isDark: boolean;
  initialized: boolean;
  customThemeCount: number;
  listenerCount: number;
  hasSystemListener: boolean;
  browser: boolean;
  error?: string;
} {
  try {
    const state = getState();

    return {
      healthy: true,
      mode: state.mode,
      palette: state.resolvedPalette,
      isDark: state.resolvedPalette === "dark",
      initialized: state.initialized,
      customThemeCount: state.customThemes.size,
      listenerCount: state.listeners.size,
      hasSystemListener: state.systemListener !== null,
      browser: isBrowser(),
    };
  } catch (err) {
    return {
      healthy: false,
      mode: "system",
      palette: "light",
      isDark: false,
      initialized: false,
      customThemeCount: 0,
      listenerCount: 0,
      hasSystemListener: false,
      browser: isBrowser(),
      error: err instanceof Error ? err.message : "Unknown theme health check error.",
    };
  }
}

// ---------------------------------------------------------------------------
// Theme Manager Singleton (Convenience Object)
// ---------------------------------------------------------------------------

export const themeManager = {
  init: initializeTheme,
  getInitScript: getThemeInitScript,
  setMode,
  toggle: toggleMode,
  getMode,
  getPalette,
  isDark,
  getActiveTheme,
  getCSSVariable,
  getBuiltInLight: () => LIGHT_THEME,
  getBuiltInDark: () => DARK_THEME,
  registerCustomTheme,
  unregisterCustomTheme,
  listCustomThemes,
  getCustomTheme,
  overrideVariable,
  overrideVariables,
  onChange,
  clearListeners,
  getSystemPreference,
  getServerTheme,
  clearPreference,
  getPreferenceTimestamp,
  ping: pingTheme,
} as const;

// ---------------------------------------------------------------------------
// Default Export
// ---------------------------------------------------------------------------

const theme = {
  manager: themeManager,
  initialize: initializeTheme,
  setMode,
  toggleMode,
  getMode,
  getPalette,
  isDark,
  getActiveTheme,
  getCSSVariable,
  lightTheme: LIGHT_THEME,
  darkTheme: DARK_THEME,
  registerCustomTheme,
  unregisterCustomTheme,
  listCustomThemes,
  getCustomTheme,
  overrideVariable,
  overrideVariables,
  onChange,
  clearListeners,
  getSystemPreference,
  getThemeInitScript,
  getServerTheme,
  clearPreference,
  getPreferenceTimestamp,
  ping: pingTheme,
} as const;

export default theme;
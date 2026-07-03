"use client";

import React, {
  forwardRef,
  useCallback,
  useState,
  createContext,
  useContext,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import {
  ArrowUp,
  Mail,
  MapPin,
  Phone,
  Github,
  Twitter,
  Linkedin,
  Youtube,
  Instagram,
  Facebook,
  ExternalLink,
  Heart,
  Shield,
  BookOpen,
  FileText,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export type FooterVariant = "default" | "compact" | "dark";

export interface FooterLink {
  /** Display label */
  label: string;
  /** URL or path */
  href: string;
  /** Mark as external link */
  external?: boolean;
  /** Disabled state */
  disabled?: boolean;
  /** Icon (optional) */
  icon?: React.ReactNode;
  /** Click handler */
  onClick?: () => void;
}

export interface FooterColumn {
  /** Column title */
  title: string;
  /** Links in this column */
  links: FooterLink[];
}

export interface FooterSocialLink {
  /** Platform name */
  platform: string;
  /** Profile URL */
  href: string;
  /** Icon component */
  icon: React.ReactNode;
  /** Aria label */
  ariaLabel?: string;
}

export interface FooterContactInfo {
  /** Physical address */
  address?: string;
  /** Phone number */
  phone?: string;
  /** Email address */
  email?: string;
}

export interface FooterProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  // ── Core ──────────────────────────────────────────────────────
  /** Visual variant */
  variant?: FooterVariant;
  /** Brand / logo element */
  logo?: React.ReactNode;
  /** Brand description shown under logo */
  brandDescription?: string;
  /** Logo href */
  logoHref?: string;

  // ── Columns ───────────────────────────────────────────────────
  /** Footer link columns */
  columns?: FooterColumn[];

  // ── Contact ───────────────────────────────────────────────────
  /** Contact information section */
  contactInfo?: FooterContactInfo;

  // ── Social ────────────────────────────────────────────────────
  /** Social media links */
  socialLinks?: FooterSocialLink[];

  // ── Bottom ────────────────────────────────────────────────────
  /** Copyright text. Defaults to auto-generated with current year */
  copyrightText?: string;
  /** Bottom links (e.g., Terms, Privacy) */
  bottomLinks?: FooterLink[];

  // ── Optional ──────────────────────────────────────────────────
  /** Show back to top button */
  showBackToTop?: boolean;
  /** Newsletter subscription slot (render prop or element) */
  newsletterSlot?: React.ReactNode;
  /** Maximum width for footer content */
  maxWidth?: "full" | "container";

  // ── Styling ───────────────────────────────────────────────────
  /** Custom class for footer wrapper */
  className?: string;
  /** Custom class for footer inner content */
  innerClassName?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// Default Social Icons Map
// ═══════════════════════════════════════════════════════════════════════

const DEFAULT_SOCIAL_ICONS: Record<string, React.ReactNode> = {
  github: <Github className="h-4 w-4" aria-hidden="true" />,
  twitter: <Twitter className="h-4 w-4" aria-hidden="true" />,
  linkedin: <Linkedin className="h-4 w-4" aria-hidden="true" />,
  youtube: <Youtube className="h-4 w-4" aria-hidden="true" />,
  instagram: <Instagram className="h-4 w-4" aria-hidden="true" />,
  facebook: <Facebook className="h-4 w-4" aria-hidden="true" />,
};

// ═══════════════════════════════════════════════════════════════════════
// Variant Styles
// ═══════════════════════════════════════════════════════════════════════

const footerVariants = cva(
  [
    "relative w-full",
    "border-t border-border-subtle",
    "mt-auto",
  ],
  {
    variants: {
      variant: {
        default: [
          "bg-surface-secondary/50",
          "text-text-secondary",
        ],
        compact: [
          "bg-surface",
          "text-text-secondary",
          "border-t border-border-subtle",
        ],
        dark: [
          "bg-surface-inverse",
          "text-text-inverse/80",
          "border-t border-border-subtle/10",
        ],
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const footerHeadingVariants = cva(
  "text-sm font-semibold tracking-wide mb-4",
  {
    variants: {
      variant: {
        default: "text-text-primary",
        compact: "text-text-primary",
        dark: "text-text-inverse",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const footerLinkVariants = cva(
  [
    "inline-flex items-center gap-1.5",
    "text-sm leading-relaxed",
    "transition-colors duration-150",
    "rounded-sm",
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-border-focus focus-visible:ring-offset-1",
  ],
  {
    variants: {
      variant: {
        default: [
          "text-text-secondary/80",
          "hover:text-text-primary hover:underline",
        ],
        compact: [
          "text-text-secondary/80",
          "hover:text-text-primary hover:underline",
        ],
        dark: [
          "text-text-inverse/60",
          "hover:text-text-inverse hover:underline",
        ],
      },
      disabled: {
        true: "opacity-50 cursor-not-allowed pointer-events-none",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      disabled: false,
    },
  },
);

const socialIconVariants = cva(
  [
    "inline-flex items-center justify-center",
    "h-9 w-9 rounded-md",
    "transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-border-focus focus-visible:ring-offset-1",
  ],
  {
    variants: {
      variant: {
        default: [
          "bg-surface-secondary text-text-secondary",
          "hover:bg-surface-tertiary hover:text-text-primary",
        ],
        compact: [
          "bg-surface-secondary text-text-secondary",
          "hover:bg-surface-tertiary hover:text-text-primary",
        ],
        dark: [
          "bg-surface-inverse-hover text-text-inverse/60",
          "hover:bg-surface-inverse-hover/80 hover:text-text-inverse",
        ],
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

// ═══════════════════════════════════════════════════════════════════════
// Context
// ═══════════════════════════════════════════════════════════════════════

type FooterContextValue = {
  variant: FooterVariant;
};

const FooterContext = createContext<FooterContextValue | null>(null);

function useFooterContext() {
  const ctx = useContext(FooterContext);
  if (!ctx) {
    throw new Error("Footer compound components must be used within <Footer>.");
  }
  return ctx;
}

function useOptionalFooterContext() {
  return useContext(FooterContext);
}

// ═══════════════════════════════════════════════════════════════════════
// Helpers
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

/** Scroll smoothly to top of page */
function scrollToTop() {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// =====================================================================
// FOOTER
// =====================================================================

const Footer = forwardRef<HTMLElement, FooterProps>((props, ref) => {
  const {
    variant = "default",
    logo,
    brandDescription,
    logoHref = "/",
    columns = [],
    contactInfo,
    socialLinks,
    copyrightText,
    bottomLinks = [],
    showBackToTop = true,
    newsletterSlot,
    maxWidth = "container",
    className,
    innerClassName,
    ...rest
  } = props;

  // ── State ─────────────────────────────────────────────────────
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Track scroll position for back-to-top visibility
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  // ── Derived ───────────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const displayCopyright =
    copyrightText ?? `© ${currentYear} NexusDev. Toate drepturile rezervate.`;

  const displaySocialLinks = socialLinks ?? [
    { platform: "github", href: "#", icon: DEFAULT_SOCIAL_ICONS.github, ariaLabel: "GitHub" },
    { platform: "twitter", href: "#", icon: DEFAULT_SOCIAL_ICONS.twitter, ariaLabel: "Twitter" },
    { platform: "linkedin", href: "#", icon: DEFAULT_SOCIAL_ICONS.linkedin, ariaLabel: "LinkedIn" },
  ];

  // ── Context ───────────────────────────────────────────────────
  const ctx: FooterContextValue = { variant };

  // ── Derived classes ───────────────────────────────────────────
  const footerClassName = cn(footerVariants({ variant }), className);

  const innerClass = cn(
    "py-12 md:py-16",
    maxWidth === "container" && "container",
    maxWidth === "full" && "px-gutter lg:px-gutter-lg",
    innerClassName,
  );

  const headingClass = cn(footerHeadingVariants({ variant }));

  // ── Render ────────────────────────────────────────────────────

  return (
    <FooterContext.Provider value={ctx}>
      <footer
        ref={mergeRefs(ref)}
        data-footer=""
        data-variant={variant}
        className={footerClassName}
        role="contentinfo"
        {...rest}
      >
        <div className={innerClass}>
          {/* ── Main Grid ─────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-12">
            {/* ── Brand Column ───────────────────────── */}
            <div className="lg:col-span-4">
              {/* Logo */}
              <a
                href={logoHref}
                className="inline-flex items-center gap-2 mb-3"
                aria-label="Acasă"
              >
                {logo ?? (
                  <span
                    className={cn(
                      "text-xl font-bold tracking-tight",
                      variant === "dark"
                        ? "text-text-inverse"
                        : "text-text-primary",
                    )}
                  >
                    Nexus
                  </span>
                )}
              </a>

              {/* Brand description */}
              {brandDescription && (
                <p
                  className={cn(
                    "text-sm leading-relaxed max-w-xs mb-5",
                    variant === "dark"
                      ? "text-text-inverse/60"
                      : "text-text-secondary/70",
                  )}
                >
                  {brandDescription}
                </p>
              )}

              {/* Contact info */}
              {contactInfo && (
                <div className="space-y-2 mb-5">
                  {contactInfo.address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin
                        className="h-4 w-4 mt-0.5 shrink-0 text-text-tertiary"
                        aria-hidden="true"
                      />
                      <span
                        className={cn(
                          variant === "dark"
                            ? "text-text-inverse/60"
                            : "text-text-secondary/70",
                        )}
                      >
                        {contactInfo.address}
                      </span>
                    </div>
                  )}
                  {contactInfo.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone
                        className="h-4 w-4 shrink-0 text-text-tertiary"
                        aria-hidden="true"
                      />
                      <a
                        href={`tel:${contactInfo.phone.replace(/\s/g, "")}`}
                        className={cn(
                          "transition-colors duration-150 hover:underline",
                          variant === "dark"
                            ? "text-text-inverse/60 hover:text-text-inverse"
                            : "text-text-secondary/70 hover:text-text-primary",
                        )}
                      >
                        {contactInfo.phone}
                      </a>
                    </div>
                  )}
                  {contactInfo.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail
                        className="h-4 w-4 shrink-0 text-text-tertiary"
                        aria-hidden="true"
                      />
                      <a
                        href={`mailto:${contactInfo.email}`}
                        className={cn(
                          "transition-colors duration-150 hover:underline",
                          variant === "dark"
                            ? "text-text-inverse/60 hover:text-text-inverse"
                            : "text-text-secondary/70 hover:text-text-primary",
                        )}
                      >
                        {contactInfo.email}
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Social links in brand column (desktop) */}
              {displaySocialLinks.length > 0 && (
                <div className="hidden lg:flex items-center gap-1.5 mt-4">
                  {displaySocialLinks.map((link) => (
                    <a
                      key={link.platform}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={link.ariaLabel ?? link.platform}
                      className={cn(socialIconVariants({ variant }))}
                    >
                      {link.icon}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* ── Link Columns ────────────────────────── */}
            {columns.length > 0 && (
              <div className="lg:col-span-8">
                <div
                  className="grid gap-8"
                  style={{
                    gridTemplateColumns: `repeat(${Math.min(columns.length, 4)}, minmax(0, 1fr))`,
                  }}
                >
                  {columns.map((column) => (
                    <div key={column.title}>
                      <h3 className={headingClass}>{column.title}</h3>
                      <ul className="space-y-2.5" role="list">
                        {column.links.map((link) => (
                          <li key={link.label}>
                            <a
                              href={link.disabled ? undefined : link.href}
                              target={
                                link.external ? "_blank" : undefined
                              }
                              rel={
                                link.external
                                  ? "noopener noreferrer"
                                  : undefined
                              }
                              onClick={(e) => {
                                if (link.disabled) {
                                  e.preventDefault();
                                  return;
                                }
                                link.onClick?.();
                              }}
                              className={cn(
                                footerLinkVariants({
                                  variant,
                                  disabled: link.disabled,
                                }),
                              )}
                              aria-disabled={link.disabled}
                            >
                              {link.icon && (
                                <span
                                  className="shrink-0"
                                  aria-hidden="true"
                                >
                                  {link.icon}
                                </span>
                              )}
                              <span>{link.label}</span>
                              {link.external && (
                                <ExternalLink
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                              )}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Newsletter Slot ───────────────────────────── */}
          {newsletterSlot && (
            <div className="mt-10 pt-8 border-t border-border-subtle/50">
              {newsletterSlot}
            </div>
          )}

          {/* ── Social Links (mobile/tablet, below columns) ── */}
          {displaySocialLinks.length > 0 && (
            <div className="flex lg:hidden items-center gap-1.5 mt-8 pt-6 border-t border-border-subtle/50">
              {displaySocialLinks.map((link) => (
                <a
                  key={link.platform}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={link.ariaLabel ?? link.platform}
                  className={cn(socialIconVariants({ variant }))}
                >
                  {link.icon}
                </a>
              ))}
            </div>
          )}

          {/* ── Bottom Bar ────────────────────────────────── */}
          <div
            className={cn(
              "flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
              "mt-10 pt-6",
              "border-t border-border-subtle/50",
            )}
          >
            {/* Copyright */}
            <p
              className={cn(
                "text-xs",
                variant === "dark"
                  ? "text-text-inverse/40"
                  : "text-text-tertiary",
              )}
            >
              {displayCopyright}
            </p>

            {/* Bottom links */}
            {bottomLinks.length > 0 && (
              <nav
                aria-label="Linkuri legale"
                className="flex flex-wrap items-center gap-x-4 gap-y-1"
              >
                {bottomLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.disabled ? undefined : link.href}
                    target={link.external ? "_blank" : undefined}
                    rel={link.external ? "noopener noreferrer" : undefined}
                    onClick={(e) => {
                      if (link.disabled) {
                        e.preventDefault();
                        return;
                      }
                      link.onClick?.();
                    }}
                    className={cn(
                      "text-xs transition-colors duration-150",
                      variant === "dark"
                        ? "text-text-inverse/40 hover:text-text-inverse/70"
                        : "text-text-tertiary hover:text-text-secondary",
                      link.disabled &&
                        "opacity-50 cursor-not-allowed pointer-events-none",
                    )}
                    aria-disabled={link.disabled}
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
            )}
          </div>
        </div>

        {/* ── Back to Top ─────────────────────────────────── */}
        {showBackToTop && (
          <button
            type="button"
            onClick={scrollToTop}
            className={cn(
              "fixed bottom-6 right-6 z-fab",
              "inline-flex items-center justify-center",
              "h-10 w-10 rounded-full",
              "shadow-elevation-2",
              "transition-all duration-300",
              "focus-visible:outline-none focus-visible:ring-2",
              "focus-visible:ring-border-focus focus-visible:ring-offset-2",
              variant === "dark"
                ? "bg-surface-inverse-hover text-text-inverse hover:bg-surface-inverse-hover/90"
                : "bg-surface text-text-secondary hover:bg-surface-secondary hover:text-text-primary",
              showScrollTop
                ? "opacity-100 translate-y-0 pointer-events-auto"
                : "opacity-0 translate-y-4 pointer-events-none",
            )}
            aria-label="Înapoi sus"
          >
            <ArrowUp className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </footer>
    </FooterContext.Provider>
  );
});

Footer.displayName = "Footer";

// =====================================================================
// SUB-COMPONENT: Footer.Brand
// =====================================================================

export interface FooterBrandProps {
  logo?: React.ReactNode;
  logoHref?: string;
  description?: string;
}

const FooterBrand: React.FC<FooterBrandProps> = ({
  logo,
  logoHref = "/",
  description,
}) => {
  const { variant } = useFooterContext();

  return (
    <div>
      <a
        href={logoHref}
        className="inline-flex items-center gap-2 mb-3"
        aria-label="Acasă"
      >
        {logo ?? (
          <span
            className={cn(
              "text-xl font-bold tracking-tight",
              variant === "dark" ? "text-text-inverse" : "text-text-primary",
            )}
          >
            Nexus
          </span>
        )}
      </a>
      {description && (
        <p
          className={cn(
            "text-sm leading-relaxed max-w-xs mb-5",
            variant === "dark"
              ? "text-text-inverse/60"
              : "text-text-secondary/70",
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
};

FooterBrand.displayName = "Footer.Brand";

// =====================================================================
// SUB-COMPONENT: Footer.Columns
// =====================================================================

export interface FooterColumnsProps {
  columns: FooterColumn[];
}

const FooterColumns: React.FC<FooterColumnsProps> = ({ columns }) => {
  const { variant } = useFooterContext();
  const headingClass = cn(footerHeadingVariants({ variant }));

  if (columns.length === 0) return null;

  return (
    <div
      className="grid gap-8"
      style={{
        gridTemplateColumns: `repeat(${Math.min(columns.length, 4)}, minmax(0, 1fr))`,
      }}
    >
      {columns.map((column) => (
        <div key={column.title}>
          <h3 className={headingClass}>{column.title}</h3>
          <ul className="space-y-2.5" role="list">
            {column.links.map((link) => (
              <li key={link.label}>
                <a
                  href={link.disabled ? undefined : link.href}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  onClick={(e) => {
                    if (link.disabled) {
                      e.preventDefault();
                      return;
                    }
                    link.onClick?.();
                  }}
                  className={cn(
                    footerLinkVariants({ variant, disabled: link.disabled }),
                  )}
                  aria-disabled={link.disabled}
                >
                  {link.icon && (
                    <span className="shrink-0" aria-hidden="true">
                      {link.icon}
                    </span>
                  )}
                  <span>{link.label}</span>
                  {link.external && (
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  )}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

FooterColumns.displayName = "Footer.Columns";

// =====================================================================
// SUB-COMPONENT: Footer.Social
// =====================================================================

export interface FooterSocialProps {
  links: FooterSocialLink[];
}

const FooterSocial: React.FC<FooterSocialProps> = ({ links }) => {
  const { variant } = useFooterContext();

  if (links.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      {links.map((link) => (
        <a
          key={link.platform}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={link.ariaLabel ?? link.platform}
          className={cn(socialIconVariants({ variant }))}
        >
          {link.icon}
        </a>
      ))}
    </div>
  );
};

FooterSocial.displayName = "Footer.Social";

// =====================================================================
// SUB-COMPONENT: Footer.Copyright
// =====================================================================

export interface FooterCopyrightProps {
  text?: string;
  bottomLinks?: FooterLink[];
}

const FooterCopyright: React.FC<FooterCopyrightProps> = ({
  text,
  bottomLinks = [],
}) => {
  const { variant } = useFooterContext();
  const currentYear = new Date().getFullYear();
  const displayCopyright =
    text ?? `© ${currentYear} NexusDev. Toate drepturile rezervate.`;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-10 pt-6 border-t border-border-subtle/50">
      <p
        className={cn(
          "text-xs",
          variant === "dark" ? "text-text-inverse/40" : "text-text-tertiary",
        )}
      >
        {displayCopyright}
      </p>
      {bottomLinks.length > 0 && (
        <nav
          aria-label="Linkuri legale"
          className="flex flex-wrap items-center gap-x-4 gap-y-1"
        >
          {bottomLinks.map((link) => (
            <a
              key={link.label}
              href={link.disabled ? undefined : link.href}
              target={link.external ? "_blank" : undefined}
              rel={link.external ? "noopener noreferrer" : undefined}
              onClick={(e) => {
                if (link.disabled) {
                  e.preventDefault();
                  return;
                }
                link.onClick?.();
              }}
              className={cn(
                "text-xs transition-colors duration-150",
                variant === "dark"
                  ? "text-text-inverse/40 hover:text-text-inverse/70"
                  : "text-text-tertiary hover:text-text-secondary",
                link.disabled && "opacity-50 cursor-not-allowed pointer-events-none",
              )}
              aria-disabled={link.disabled}
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </div>
  );
};

FooterCopyright.displayName = "Footer.Copyright";

// =====================================================================
// SUB-COMPONENT: Footer.BackToTop
// =====================================================================

export interface FooterBackToTopProps {
  /** Threshold in px after which button appears. Default: 400 */
  threshold?: number;
}

const FooterBackToTop: React.FC<FooterBackToTopProps> = ({
  threshold = 400,
}) => {
  const { variant } = useFooterContext();
  const [visible, setVisible] = useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      setVisible(window.scrollY > threshold);
    };
    handler();
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [threshold]);

  const handleClick = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "fixed bottom-6 right-6 z-fab",
        "inline-flex items-center justify-center",
        "h-10 w-10 rounded-full",
        "shadow-elevation-2",
        "transition-all duration-300",
        "focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-border-focus focus-visible:ring-offset-2",
        variant === "dark"
          ? "bg-surface-inverse-hover text-text-inverse hover:bg-surface-inverse-hover/90"
          : "bg-surface text-text-secondary hover:bg-surface-secondary hover:text-text-primary",
        visible
          ? "opacity-100 translate-y-0 pointer-events-auto"
          : "opacity-0 translate-y-4 pointer-events-none",
      )}
      aria-label="Înapoi sus"
    >
      <ArrowUp className="h-4 w-4" aria-hidden="true" />
    </button>
  );
};

FooterBackToTop.displayName = "Footer.BackToTop";

// =====================================================================
// COMPOUND FOOTER ASSIGNMENT
// =====================================================================

const CompoundFooter = Object.assign(Footer, {
  Brand: FooterBrand,
  Columns: FooterColumns,
  Social: FooterSocial,
  Copyright: FooterCopyright,
  BackToTop: FooterBackToTop,
});

// =====================================================================
// EXPORTS
// =====================================================================

export {
  CompoundFooter as Footer,
  Footer as FooterBase,
  footerVariants,
  footerHeadingVariants,
  footerLinkVariants,
  socialIconVariants,
  FooterContext,
  useFooterContext,
  useOptionalFooterContext,
};

export type {
  FooterVariant,
  FooterLink,
  FooterColumn,
  FooterSocialLink,
  FooterContactInfo,
  FooterProps,
};

export default CompoundFooter;
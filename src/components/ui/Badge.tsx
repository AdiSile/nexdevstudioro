"use client";

import React, { forwardRef, useCallback } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

// ─── Variant Definitions ────────────────────────────────────────────

const badgeVariants = cva(
  [
    "inline-flex items-center gap-1.5",
    "font-medium whitespace-nowrap",
    "select-none",
    "transition-all duration-150",
  ],
  {
    variants: {
      /** Visual style variant */
      variant: {
        solid: "",
        soft: "",
        outline: "",
      },
      /** Color scheme */
      color: {
        brand: "",
        accent: "",
        success: "",
        danger: "",
        warning: "",
        info: "",
        neutral: "",
      },
      /** Size preset */
      size: {
        sm: ["h-5 px-1.5 text-xs"],
        md: ["h-6 px-2 text-xs"],
        lg: ["h-7 px-2.5 text-sm"],
      },
      /** Shape */
      rounded: {
        default: "rounded-md",
        full: "rounded-full",
      },
      /** Dot indicator */
      hasDot: {
        true: "",
        false: "",
      },
      /** Whether badge is interactive (e.g. for dismiss) */
      interactive: {
        true: "cursor-pointer",
        false: "",
      },
    },
    compoundVariants: [
      // ── solid + color ──────────────────────────────────────────
      {
        variant: "solid",
        color: "brand",
        className: "bg-brand-500 text-text-inverse",
      },
      {
        variant: "solid",
        color: "accent",
        className: "bg-accent-500 text-text-inverse",
      },
      {
        variant: "solid",
        color: "success",
        className: "bg-success-500 text-text-inverse",
      },
      {
        variant: "solid",
        color: "danger",
        className: "bg-danger-500 text-text-inverse",
      },
      {
        variant: "solid",
        color: "warning",
        className: "bg-warning-500 text-text-inverse",
      },
      {
        variant: "solid",
        color: "info",
        className: "bg-info-500 text-text-inverse",
      },
      {
        variant: "solid",
        color: "neutral",
        className: "bg-neutral-600 text-text-inverse",
      },

      // ── soft + color ───────────────────────────────────────────
      {
        variant: "soft",
        color: "brand",
        className: "bg-brand-50 text-brand-700",
      },
      {
        variant: "soft",
        color: "accent",
        className: "bg-accent-50 text-accent-700",
      },
      {
        variant: "soft",
        color: "success",
        className: "bg-success-50 text-success-700",
      },
      {
        variant: "soft",
        color: "danger",
        className: "bg-danger-50 text-danger-700",
      },
      {
        variant: "soft",
        color: "warning",
        className: "bg-warning-50 text-warning-700",
      },
      {
        variant: "soft",
        color: "info",
        className: "bg-info-50 text-info-700",
      },
      {
        variant: "soft",
        color: "neutral",
        className: "bg-neutral-100 text-neutral-700",
      },

      // ── outline + color ────────────────────────────────────────
      {
        variant: "outline",
        color: "brand",
        className: "border border-brand-300 text-brand-700 bg-transparent",
      },
      {
        variant: "outline",
        color: "accent",
        className: "border border-accent-300 text-accent-700 bg-transparent",
      },
      {
        variant: "outline",
        color: "success",
        className:
          "border border-success-300 text-success-700 bg-transparent",
      },
      {
        variant: "outline",
        color: "danger",
        className: "border border-danger-300 text-danger-700 bg-transparent",
      },
      {
        variant: "outline",
        color: "warning",
        className:
          "border border-warning-300 text-warning-700 bg-transparent",
      },
      {
        variant: "outline",
        color: "info",
        className: "border border-info-300 text-info-700 bg-transparent",
      },
      {
        variant: "outline",
        color: "neutral",
        className:
          "border border-neutral-300 text-neutral-700 bg-transparent",
      },

      // ── size-specific padding adjustments ──────────────────────
      {
        size: "sm",
        hasDot: false,
        className: "px-1.5",
      },
      {
        size: "md",
        hasDot: false,
        className: "px-2.5",
      },
      {
        size: "lg",
        hasDot: false,
        className: "px-3",
      },

      // ── interactive: solid hover ───────────────────────────────
      {
        variant: "solid",
        interactive: true,
        color: "brand",
        className: "hover:bg-brand-600 active:bg-brand-700",
      },
      {
        variant: "solid",
        interactive: true,
        color: "accent",
        className: "hover:bg-accent-600 active:bg-accent-700",
      },
      {
        variant: "solid",
        interactive: true,
        color: "success",
        className: "hover:bg-success-600 active:bg-success-700",
      },
      {
        variant: "solid",
        interactive: true,
        color: "danger",
        className: "hover:bg-danger-600 active:bg-danger-700",
      },
      {
        variant: "solid",
        interactive: true,
        color: "warning",
        className: "hover:bg-warning-600 active:bg-warning-700",
      },
      {
        variant: "solid",
        interactive: true,
        color: "info",
        className: "hover:bg-info-600 active:bg-info-700",
      },
      {
        variant: "solid",
        interactive: true,
        color: "neutral",
        className: "hover:bg-neutral-700 active:bg-neutral-800",
      },

      // ── interactive: soft hover ────────────────────────────────
      {
        variant: "soft",
        interactive: true,
        color: "brand",
        className: "hover:bg-brand-100 active:bg-brand-200",
      },
      {
        variant: "soft",
        interactive: true,
        color: "accent",
        className: "hover:bg-accent-100 active:bg-accent-200",
      },
      {
        variant: "soft",
        interactive: true,
        color: "success",
        className: "hover:bg-success-100 active:bg-success-200",
      },
      {
        variant: "soft",
        interactive: true,
        color: "danger",
        className: "hover:bg-danger-100 active:bg-danger-200",
      },
      {
        variant: "soft",
        interactive: true,
        color: "warning",
        className: "hover:bg-warning-100 active:bg-warning-200",
      },
      {
        variant: "soft",
        interactive: true,
        color: "info",
        className: "hover:bg-info-100 active:bg-info-200",
      },
      {
        variant: "soft",
        interactive: true,
        color: "neutral",
        className: "hover:bg-neutral-200 active:bg-neutral-300",
      },

      // ── interactive: outline hover ─────────────────────────────
      {
        variant: "outline",
        interactive: true,
        color: "brand",
        className:
          "hover:bg-brand-50 hover:border-brand-400 active:bg-brand-100",
      },
      {
        variant: "outline",
        interactive: true,
        color: "accent",
        className:
          "hover:bg-accent-50 hover:border-accent-400 active:bg-accent-100",
      },
      {
        variant: "outline",
        interactive: true,
        color: "success",
        className:
          "hover:bg-success-50 hover:border-success-400 active:bg-success-100",
      },
      {
        variant: "outline",
        interactive: true,
        color: "danger",
        className:
          "hover:bg-danger-50 hover:border-danger-400 active:bg-danger-100",
      },
      {
        variant: "outline",
        interactive: true,
        color: "warning",
        className:
          "hover:bg-warning-50 hover:border-warning-400 active:bg-warning-100",
      },
      {
        variant: "outline",
        interactive: true,
        color: "info",
        className:
          "hover:bg-info-50 hover:border-info-400 active:bg-info-100",
      },
      {
        variant: "outline",
        interactive: true,
        color: "neutral",
        className:
          "hover:bg-neutral-50 hover:border-neutral-400 active:bg-neutral-100",
      },
    ],
    defaultVariants: {
      variant: "soft",
      color: "brand",
      size: "md",
      rounded: "default",
      hasDot: false,
      interactive: false,
    },
  },
);

// ─── Dot indicator variant ──────────────────────────────────────────

const dotVariants = cva(["shrink-0 rounded-full"], {
  variants: {
    size: {
      sm: "h-1.5 w-1.5",
      md: "h-2 w-2",
      lg: "h-2.5 w-2.5",
    },
    /** Matches the badge color for dot fill */
    color: {
      brand: "bg-brand-500",
      accent: "bg-accent-500",
      success: "bg-success-500",
      danger: "bg-danger-500",
      warning: "bg-warning-500",
      info: "bg-info-500",
      neutral: "bg-neutral-500",
    },
    /** When variant is solid, dot should be contrasting */
    variant: {
      solid: "",
      soft: "",
      outline: "",
    },
  },
  compoundVariants: [
    { variant: "solid", color: "brand", className: "bg-brand-200" },
    { variant: "solid", color: "accent", className: "bg-accent-200" },
    { variant: "solid", color: "success", className: "bg-success-200" },
    { variant: "solid", color: "danger", className: "bg-danger-200" },
    { variant: "solid", color: "warning", className: "bg-warning-200" },
    { variant: "solid", color: "info", className: "bg-info-200" },
    { variant: "solid", color: "neutral", className: "bg-neutral-300" },
  ],
  defaultVariants: {
    size: "md",
    color: "brand",
    variant: "soft",
  },
});

// ─── Dismiss button size classes ────────────────────────────────────

const dismissIconSizes: Record<NonNullable<BadgeSize>, string> = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
  lg: "h-4 w-4",
};

// ─── Types ──────────────────────────────────────────────────────────

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];
type BadgeColor = VariantProps<typeof badgeVariants>["color"];
type BadgeSize = VariantProps<typeof badgeVariants>["size"];

type BadgeBaseProps = {
  /** Visual style variant: solid, soft, outline */
  variant?: BadgeVariant;
  /** Color scheme */
  color?: BadgeColor;
  /** Size preset */
  size?: BadgeSize;
  /** Shape */
  rounded?: "default" | "full";
  /** Show a dot indicator before content */
  dot?: boolean;
  /** Make badge dismissible with an X button */
  dismissible?: boolean;
  /** Callback when dismiss button is clicked */
  onDismiss?: () => void;
  /** Accessible label for the dismiss button */
  dismissLabel?: string;
  /** Icon displayed before children */
  iconLeft?: React.ReactNode;
  /** Icon displayed after children */
  iconRight?: React.ReactNode;
};

export type BadgeProps = BadgeBaseProps &
  Omit<React.HTMLAttributes<HTMLSpanElement>, "color">;

// ─── Component ──────────────────────────────────────────────────────

const Badge = forwardRef<HTMLSpanElement, BadgeProps>((props, ref) => {
  const {
    variant = "soft",
    color = "brand",
    size = "md",
    rounded = "default",
    dot = false,
    dismissible = false,
    onDismiss,
    dismissLabel,
    iconLeft,
    iconRight,
    className,
    children,
    onClick,
    onKeyDown,
    ...rest
  } = props;

  const isInteractive = Boolean(dismissible || onClick);

  // ── Dismiss handler ────────────────────────────────────────────
  const handleDismiss = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onDismiss?.();
    },
    [onDismiss],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLSpanElement>) => {
      if (dismissible && onDismiss && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        onDismiss();
      }
      onKeyDown?.(e);
    },
    [dismissible, onDismiss, onKeyDown],
  );

  // ── ARIA attributes ────────────────────────────────────────────
  const ariaProps: Record<string, unknown> = {};

  if (dismissible) {
    ariaProps["aria-live"] = "polite";
  }

  if (onClick || isInteractive) {
    ariaProps.role = "button";
    ariaProps.tabIndex = rest.tabIndex ?? 0;
  }

  // ── Icon sizing ────────────────────────────────────────────────
  const iconSizeClass = cn(
    "shrink-0",
    size === "sm" ? "h-3 w-3" : size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5",
  );

  const cloneIcon = (icon: React.ReactNode) => {
    if (React.isValidElement(icon)) {
      return React.cloneElement(icon as React.ReactElement, {
        className: cn(
          iconSizeClass,
          (icon as React.ReactElement).props?.className,
        ),
      });
    }
    return icon;
  };

  // ── Render ─────────────────────────────────────────────────────
  return (
    <span
      ref={ref}
      data-slot="badge"
      className={cn(
        badgeVariants({
          variant,
          color,
          size,
          rounded,
          hasDot: dot,
          interactive: isInteractive,
        }),
        className,
      )}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      {...ariaProps}
      {...rest}
    >
      {/* Dot indicator */}
      {dot && (
        <span
          className={cn(dotVariants({ size, color, variant }))}
          aria-hidden="true"
          data-slot="badge-dot"
        />
      )}

      {/* Left icon */}
      {iconLeft && (
        <span className="inline-flex shrink-0" aria-hidden="true">
          {cloneIcon(iconLeft)}
        </span>
      )}

      {/* Content */}
      {children != null && (
        <span className="truncate">{children}</span>
      )}

      {/* Right icon */}
      {iconRight && !dismissible && (
        <span className="inline-flex shrink-0" aria-hidden="true">
          {cloneIcon(iconRight)}
        </span>
      )}

      {/* Dismiss button */}
      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          className={cn(
            "shrink-0 inline-flex items-center justify-center",
            "rounded-sm",
            "transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-border-focus focus-visible:ring-offset-1",
            // Inherit text color from parent badge for a cohesive look
            "text-current/60 hover:text-current",
          )}
          aria-label={dismissLabel ?? "Remove"}
          data-slot="badge-dismiss"
        >
          <X className={dismissIconSizes[size ?? "md"]} aria-hidden="true" />
        </button>
      )}
    </span>
  );
});

Badge.displayName = "Badge";

// ─── Exports ────────────────────────────────────────────────────────

export { Badge, badgeVariants, dotVariants };
export default Badge;
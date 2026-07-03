"use client";

import React, { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Slot } from "@radix-ui/react-slot";

// ─── Variant Definitions ────────────────────────────────────────────
const buttonVariants = cva(
  // Base styles
  [
    "inline-flex items-center justify-center gap-2",
    "font-medium whitespace-nowrap",
    "rounded-md",
    "transition-all duration-200",
    "ring-offset-surface focus-visible:outline-none",
    "focus-visible:ring-2 focus-visible:ring-border-focus",
    "focus-visible:ring-offset-2",
    "select-none",
    "disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-brand-500 text-text-inverse",
          "shadow-elevation-1",
          "hover:bg-brand-600 hover:shadow-elevation-2",
          "active:bg-brand-700 active:scale-[0.98]",
        ],
        secondary: [
          "bg-surface-secondary text-text-primary",
          "border border-border",
          "hover:bg-surface-tertiary hover:border-border-strong",
          "active:bg-neutral-200 active:scale-[0.98]",
        ],
        ghost: [
          "bg-transparent text-text-primary",
          "hover:bg-surface-secondary",
          "active:bg-neutral-200",
        ],
        danger: [
          "bg-danger-500 text-text-inverse",
          "shadow-elevation-1",
          "hover:bg-danger-600 hover:shadow-elevation-2",
          "active:bg-danger-700 active:scale-[0.98]",
        ],
      },
      size: {
        sm: ["h-8 px-3 text-xs", "rounded-sm"],
        md: ["h-10 px-5 text-sm"],
        lg: ["h-12 px-7 text-base", "rounded-lg"],
        "icon-sm": ["h-8 w-8 p-0", "rounded-sm"],
        "icon-md": ["h-10 w-10 p-0"],
        "icon-lg": ["h-12 w-12 p-0", "rounded-lg"],
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

// ─── Types ──────────────────────────────────────────────────────────
type ButtonBaseProps = {
  /** Visual style variant */
  variant?: VariantProps<typeof buttonVariants>["variant"];
  /** Size preset */
  size?: VariantProps<typeof buttonVariants>["size"];
  /** Expand button to full container width */
  fullWidth?: boolean;
  /** Show loading spinner and disable interaction */
  loading?: boolean;
  /** Screen-reader text when loading (defaults to "Loading...") */
  loadingText?: string;
  /** Icon displayed before children */
  iconLeft?: React.ReactNode;
  /** Icon displayed after children */
  iconRight?: React.ReactNode;
  /** Render as child (Radix Slot pattern) */
  asChild?: boolean;
};

type ButtonAsButton = ButtonBaseProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonBaseProps> & {
    href?: undefined;
  };

type ButtonAsLink = ButtonBaseProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, keyof ButtonBaseProps> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

// ─── Component ──────────────────────────────────────────────────────
const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  (props, ref) => {
    const {
      variant = "primary",
      size = "md",
      fullWidth,
      loading = false,
      loadingText,
      iconLeft,
      iconRight,
      asChild = false,
      className,
      children,
      disabled,
      type = "button",
      href,
      ...rest
    } = props as ButtonAsButton & { href?: string };

    const isDisabled = disabled || loading;

    // Composed classes
    const composedClassName = cn(
      buttonVariants({ variant, size, fullWidth }),
      className,
    );

    // ── Loading spinner ──────────────────────────────────────────
    const spinner = (
      <Loader2
        className={cn(
          "animate-spin shrink-0",
          size === "sm" || size === "icon-sm" ? "h-3.5 w-3.5" : "h-4 w-4",
          size === "lg" || size === "icon-lg" ? "h-5 w-5" : "",
        )}
        aria-hidden="true"
      />
    );

    const loadingContent = (
      <>
        {spinner}
        <span className="sr-only">{loadingText ?? "Loading..."}</span>
        {/* Children hidden visually but kept in DOM for layout stability */}
        {children != null && (
          <span className="invisible absolute">{children}</span>
        )}
      </>
    );

    const content = loading ? (
      loadingContent
    ) : (
      <>
        {iconLeft && (
          <span className="mr-2 shrink-0 inline-flex">{iconLeft}</span>
        )}
        {children}
        {iconRight && (
          <span className="ml-2 shrink-0 inline-flex">{iconRight}</span>
        )}
      </>
    );

    // ── ARIA attributes ──────────────────────────────────────────
    const ariaProps: Record<string, unknown> = {
      "aria-busy": loading ? true : undefined,
      "aria-disabled": isDisabled ? true : undefined,
    };

    // ── Render as link ───────────────────────────────────────────
    if (href && !isDisabled) {
      const {
        iconLeft: _iconLeft,
        iconRight: _iconRight,
        loading: _l,
        loadingText: _lt,
        fullWidth: _fw,
        asChild: _ac,
        variant: _v,
        size: _s,
        ...anchorProps
      } = props as ButtonAsLink;
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          className={composedClassName}
          {...anchorProps}
          {...ariaProps}
        >
          {content}
        </a>
      );
    }

    // Disabled link: render as anchor with aria-disabled
    if (href && isDisabled) {
      const {
        iconLeft: _il,
        iconRight: _ir,
        loading: _l,
        loadingText: _lt,
        fullWidth: _fw,
        asChild: _ac,
        variant: _v,
        size: _s,
        ...anchorProps
      } = props as ButtonAsLink;
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          className={composedClassName}
          {...anchorProps}
          {...ariaProps}
          onClick={(e) => {
            e.preventDefault();
            (
              anchorProps as React.AnchorHTMLAttributes<HTMLAnchorElement>
            ).onClick?.(e);
          }}
          tabIndex={isDisabled ? -1 : undefined}
        >
          {content}
        </a>
      );
    }

    // ── Slot rendering ───────────────────────────────────────────
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref as React.Ref<HTMLButtonElement>}
        type={asChild ? undefined : (type as ButtonAsButton["type"])}
        className={composedClassName}
        disabled={asChild ? undefined : isDisabled}
        {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        {...ariaProps}
      >
        {content}
      </Comp>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
export default Button;
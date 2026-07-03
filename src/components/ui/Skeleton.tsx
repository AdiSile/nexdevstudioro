"use client";

import React, { forwardRef, useId } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { Slot } from "@radix-ui/react-slot";

// ─── Variant Definitions ────────────────────────────────────────────

const skeletonVariants = cva(
  [
    "relative isolate",
    "overflow-hidden",
    "bg-surface-secondary",
    "select-none pointer-events-none",
    "before:absolute before:inset-0",
    "[&>*]:invisible",
  ],
  {
    variants: {
      variant: {
        text: ["h-4 rounded-sm"],
        heading: ["h-6 rounded-sm"],
        "heading-lg": ["h-8 rounded-sm"],
        "heading-xl": ["h-10 rounded-sm"],
        paragraph: ["flex flex-col gap-2"],
        avatar: ["rounded-full shrink-0"],
        image: ["rounded-lg"],
        card: [
          "rounded-xl border border-border-subtle",
          "shadow-elevation-1",
        ],
        button: ["rounded-md"],
        input: ["rounded-md"],
        table: ["rounded-xl border border-border-subtle"],
        "table-row": ["h-10 rounded-none"],
        list: ["rounded-lg"],
        "list-item": ["h-12 rounded-md"],
        circle: ["rounded-full"],
        rect: ["rounded-md"],
        chip: ["rounded-full"],
        badge: ["rounded-full"],
        icon: ["rounded-sm"],
      },
      size: {
        xs: [],
        sm: [],
        md: [],
        lg: [],
        xl: [],
        "2xl": [],
      },
      animation: {
        shimmer: [
          "before:animate-shimmer",
          "before:bg-gradient-shimmer",
          "before:bg-[length:400%_100%]",
        ],
        pulse: ["animate-pulse"],
        none: [],
      },
      fullWidth: {
        true: "w-full",
      },
    },
    compoundVariants: [
      // ── Text size overrides ──────────────────────────────────
      { variant: "text", size: "xs", className: "h-3 w-16" },
      { variant: "text", size: "sm", className: "h-3.5 w-32" },
      { variant: "text", size: "md", className: "h-4 w-48" },
      { variant: "text", size: "lg", className: "h-5 w-64" },
      { variant: "text", size: "xl", className: "h-6 w-80" },
      { variant: "text", size: "2xl", className: "h-7 w-96" },

      // ── Heading size overrides ───────────────────────────────
      { variant: "heading", size: "sm", className: "h-5 w-36" },
      { variant: "heading", size: "md", className: "h-6 w-48" },
      { variant: "heading", size: "lg", className: "h-7 w-64" },
      { variant: "heading", size: "xl", className: "h-8 w-80" },
      { variant: "heading", size: "2xl", className: "h-10 w-96" },

      // ── Heading-lg size overrides ────────────────────────────
      { variant: "heading-lg", size: "sm", className: "h-6 w-40" },
      { variant: "heading-lg", size: "md", className: "h-8 w-56" },
      { variant: "heading-lg", size: "lg", className: "h-9 w-72" },
      { variant: "heading-lg", size: "xl", className: "h-10 w-80" },

      // ── Heading-xl size overrides ────────────────────────────
      { variant: "heading-xl", size: "sm", className: "h-8 w-48" },
      { variant: "heading-xl", size: "md", className: "h-10 w-64" },
      { variant: "heading-xl", size: "lg", className: "h-12 w-80" },
      { variant: "heading-xl", size: "xl", className: "h-14 w-96" },

      // ── Avatar size overrides ────────────────────────────────
      { variant: "avatar", size: "xs", className: "h-6 w-6" },
      { variant: "avatar", size: "sm", className: "h-8 w-8" },
      { variant: "avatar", size: "md", className: "h-10 w-10" },
      { variant: "avatar", size: "lg", className: "h-12 w-12" },
      { variant: "avatar", size: "xl", className: "h-16 w-16" },
      { variant: "avatar", size: "2xl", className: "h-20 w-20" },

      // ── Image size overrides ─────────────────────────────────
      { variant: "image", size: "xs", className: "h-12 w-20" },
      { variant: "image", size: "sm", className: "h-24 w-40" },
      { variant: "image", size: "md", className: "h-40 w-64" },
      { variant: "image", size: "lg", className: "h-56 w-80" },
      { variant: "image", size: "xl", className: "h-72 w-96" },
      { variant: "image", size: "2xl", className: "h-96 w-full" },

      // ── Button size overrides ────────────────────────────────
      { variant: "button", size: "sm", className: "h-8 w-20" },
      { variant: "button", size: "md", className: "h-10 w-28" },
      { variant: "button", size: "lg", className: "h-12 w-36" },

      // ── Input size overrides ─────────────────────────────────
      { variant: "input", size: "sm", className: "h-8 w-48" },
      { variant: "input", size: "md", className: "h-10 w-64" },
      { variant: "input", size: "lg", className: "h-12 w-80" },

      // ── Card size overrides ──────────────────────────────────
      { variant: "card", size: "sm", className: "h-32 w-48" },
      { variant: "card", size: "md", className: "h-48 w-64" },
      { variant: "card", size: "lg", className: "h-64 w-80" },
      { variant: "card", size: "xl", className: "h-80 w-96" },

      // ── Icon size overrides ──────────────────────────────────
      { variant: "icon", size: "xs", className: "h-4 w-4" },
      { variant: "icon", size: "sm", className: "h-5 w-5" },
      { variant: "icon", size: "md", className: "h-6 w-6" },
      { variant: "icon", size: "lg", className: "h-8 w-8" },
      { variant: "icon", size: "xl", className: "h-10 w-10" },
      { variant: "icon", size: "2xl", className: "h-12 w-12" },

      // ── Chip / Badge size overrides ──────────────────────────
      { variant: "chip", size: "sm", className: "h-6 w-16" },
      { variant: "chip", size: "md", className: "h-7 w-20" },
      { variant: "chip", size: "lg", className: "h-8 w-24" },
      { variant: "badge", size: "sm", className: "h-5 w-12" },
      { variant: "badge", size: "md", className: "h-6 w-16" },
      { variant: "badge", size: "lg", className: "h-7 w-20" },

      // ── Circle size overrides ────────────────────────────────
      { variant: "circle", size: "xs", className: "h-6 w-6" },
      { variant: "circle", size: "sm", className: "h-8 w-8" },
      { variant: "circle", size: "md", className: "h-12 w-12" },
      { variant: "circle", size: "lg", className: "h-16 w-16" },
      { variant: "circle", size: "xl", className: "h-20 w-20" },
      { variant: "circle", size: "2xl", className: "h-24 w-24" },

      // ── Rect size overrides ──────────────────────────────────
      { variant: "rect", size: "xs", className: "h-4 w-8" },
      { variant: "rect", size: "sm", className: "h-8 w-16" },
      { variant: "rect", size: "md", className: "h-16 w-32" },
      { variant: "rect", size: "lg", className: "h-32 w-64" },
      { variant: "rect", size: "xl", className: "h-48 w-80" },
      { variant: "rect", size: "2xl", className: "h-64 w-96" },

      // ── Paragraph variant: apply gap based on size ───────────
      { variant: "paragraph", size: "sm", className: "gap-1.5" },
      { variant: "paragraph", size: "md", className: "gap-2" },
      { variant: "paragraph", size: "lg", className: "gap-2.5" },
    ],
    defaultVariants: {
      animation: "shimmer",
      size: "md",
    },
  },
);

// ─── Paragraph Line Variants ────────────────────────────────────────

const paragraphLineVariants = cva(
  ["h-3.5 rounded-sm bg-surface-tertiary"],
  {
    variants: {
      lineSize: {
        sm: "h-3",
        md: "h-3.5",
        lg: "h-4",
      },
    },
    defaultVariants: {
      lineSize: "md",
    },
  },
);

// ─── Types ──────────────────────────────────────────────────────────

/** Available skeleton shape variants */
export type SkeletonVariant = NonNullable<
  VariantProps<typeof skeletonVariants>["variant"]
>;

/** Available skeleton size presets */
export type SkeletonSize = NonNullable<
  VariantProps<typeof skeletonVariants>["size"]
>;

/** Available animation styles */
export type SkeletonAnimation = NonNullable<
  VariantProps<typeof skeletonVariants>["animation"]
>;

type SkeletonBaseProps = {
  /** Visual shape variant */
  variant?: SkeletonVariant;
  /** Size preset */
  size?: SkeletonSize;
  /** Animation style */
  animation?: SkeletonAnimation;
  /** Expand to full container width */
  fullWidth?: boolean;
  /** Render as child (Radix Slot pattern) */
  asChild?: boolean;
  /** Custom class name */
  className?: string;
  /** Custom inline width (overrides variant default) */
  width?: string | number;
  /** Custom inline height (overrides variant default) */
  height?: string | number;
  /** Number of lines (only for "paragraph" and "list" variants) */
  lines?: number;
  /** Children (hidden visually — for layout stability / SSR) */
  children?: React.ReactNode;
};

export type SkeletonProps = SkeletonBaseProps &
  Omit<React.HTMLAttributes<HTMLDivElement>, keyof SkeletonBaseProps>;

// ─── Constants ──────────────────────────────────────────────────────

/** Default number of paragraph lines */
const DEFAULT_PARAGRAPH_LINES = 4;
/** Default number of list item lines */
const DEFAULT_LIST_LINES = 3;

// ─── Paragraph Skeleton ─────────────────────────────────────────────

type ParagraphSkeletonProps = {
  /** Number of lines to render */
  lines: number;
  /** Size for individual line height */
  lineSize?: "sm" | "md" | "lg";
  /** Custom class name for the wrapper */
  className?: string;
  /** ID prefix for ARIA attributes */
  idPrefix?: string;
};

const ParagraphSkeleton = forwardRef<HTMLDivElement, ParagraphSkeletonProps>(
  ({ lines, lineSize = "md", className, idPrefix }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex flex-col", className)}
        role="status"
        aria-label="Loading content"
      >
        {Array.from({ length: lines }, (_, i) => {
          // Last line is shorter (80%) for natural look
          const isLast = i === lines - 1 && lines > 1;
          return (
            <div
              key={`${idPrefix ?? "skeleton"}-line-${i}`}
              className={cn(
                paragraphLineVariants({ lineSize }),
                isLast ? "w-4/5" : "w-full",
              )}
            />
          );
        })}
        <span className="sr-only">Loading...</span>
      </div>
    );
  },
);
ParagraphSkeleton.displayName = "ParagraphSkeleton";

// ─── List Skeleton ──────────────────────────────────────────────────

type ListSkeletonProps = {
  /** Number of list items */
  lines: number;
  /** Size for individual list items */
  itemSize?: "sm" | "md" | "lg";
  /** Show leading avatar/icon placeholder on each item */
  showLeading?: boolean;
  /** Show trailing icon placeholder on each item */
  showTrailing?: boolean;
  /** Custom class name for the wrapper */
  className?: string;
  /** ID prefix for ARIA attributes */
  idPrefix?: string;
};

const ListSkeleton = forwardRef<HTMLDivElement, ListSkeletonProps>(
  (
    { lines, itemSize = "md", showLeading = false, showTrailing = false, className, idPrefix },
    ref,
  ) => {
    const itemHeight =
      itemSize === "sm" ? "h-8" : itemSize === "lg" ? "h-14" : "h-12";

    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-1", className)}
        role="status"
        aria-label="Loading list"
      >
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={`${idPrefix ?? "skeleton"}-list-item-${i}`}
            className={cn(
              "flex items-center gap-3 rounded-md bg-surface-secondary",
              "before:animate-shimmer before:absolute before:inset-0",
              "before:bg-gradient-shimmer before:bg-[length:400%_100%]",
              "relative overflow-hidden",
              itemHeight,
              "px-3",
            )}
          >
            {showLeading && (
              <div className="h-8 w-8 rounded-full bg-surface-tertiary shrink-0" />
            )}
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="h-3.5 w-3/5 rounded-sm bg-surface-tertiary" />
              <div className="h-3 w-2/5 rounded-sm bg-surface-tertiary" />
            </div>
            {showTrailing && (
              <div className="h-5 w-5 rounded-sm bg-surface-tertiary shrink-0" />
            )}
          </div>
        ))}
        <span className="sr-only">Loading...</span>
      </div>
    );
  },
);
ListSkeleton.displayName = "ListSkeleton";

// ─── Table Skeleton ─────────────────────────────────────────────────

type TableSkeletonProps = {
  /** Number of rows (excluding header) */
  rows?: number;
  /** Number of columns */
  columns?: number;
  /** Custom class name for the wrapper */
  className?: string;
  /** ID prefix for ARIA attributes */
  idPrefix?: string;
};

const TableSkeleton = forwardRef<HTMLDivElement, TableSkeletonProps>(
  ({ rows = 5, columns = 4, className, idPrefix }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-xl border border-border-subtle overflow-hidden bg-surface",
          className,
        )}
        role="status"
        aria-label="Loading table"
      >
        {/* Header row */}
        <div className="flex items-center gap-4 px-4 py-3 bg-surface-secondary border-b border-border-subtle">
          {Array.from({ length: columns }, (_, i) => (
            <div
              key={`${idPrefix ?? "skeleton"}-header-${i}`}
              className="h-4 rounded-sm bg-surface-tertiary flex-1 min-w-0"
            />
          ))}
        </div>

        {/* Body rows */}
        {Array.from({ length: rows }, (_, rowIdx) => (
          <div
            key={`${idPrefix ?? "skeleton"}-row-${rowIdx}`}
            className={cn(
              "flex items-center gap-4 px-4 py-3",
              "relative overflow-hidden",
              "before:animate-shimmer before:absolute before:inset-0",
              "before:bg-gradient-shimmer before:bg-[length:400%_100%]",
              rowIdx % 2 === 0 ? "bg-surface" : "bg-surface-secondary/50",
            )}
          >
            {Array.from({ length: columns }, (_, colIdx) => (
              <div
                key={`${idPrefix ?? "skeleton"}-cell-${rowIdx}-${colIdx}`}
                className="h-3.5 rounded-sm bg-surface-tertiary flex-1 min-w-0"
                style={{
                  maxWidth:
                    colIdx === 0
                      ? "40%"
                      : colIdx === columns - 1
                        ? "25%"
                        : undefined,
                }}
              />
            ))}
          </div>
        ))}

        <span className="sr-only">Loading...</span>
      </div>
    );
  },
);
TableSkeleton.displayName = "TableSkeleton";

// ─── Skeleton Container (for nesting multiple skeletons) ────────────

type SkeletonGroupProps = {
  /** Layout direction */
  direction?: "row" | "col";
  /** Gap between items */
  gap?: "sm" | "md" | "lg";
  /** Alignment */
  align?: "start" | "center" | "end" | "stretch";
  /** Custom class name */
  className?: string;
  children?: React.ReactNode;
};

const SkeletonGroup = forwardRef<HTMLDivElement, SkeletonGroupProps>(
  ({ direction = "col", gap = "md", align = "start", className, children }, ref) => {
    const gapClass =
      gap === "sm" ? "gap-2" : gap === "lg" ? "gap-4" : "gap-3";
    const alignClass =
      align === "center"
        ? "items-center"
        : align === "end"
          ? "items-end"
          : align === "stretch"
            ? "items-stretch"
            : "items-start";

    return (
      <div
        ref={ref}
        className={cn(
          "flex",
          direction === "row" ? "flex-row flex-wrap" : "flex-col",
          gapClass,
          alignClass,
          className,
        )}
        role="status"
        aria-label="Loading"
      >
        {children}
        <span className="sr-only">Loading...</span>
      </div>
    );
  },
);
SkeletonGroup.displayName = "SkeletonGroup";

// ─── Main Skeleton Component ────────────────────────────────────────

const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  (
    {
      variant,
      size = "md",
      animation = "shimmer",
      fullWidth,
      asChild = false,
      className,
      width,
      height,
      lines,
      children,
      ...rest
    },
    ref,
  ) => {
    const generatedId = useId();
    const idPrefix = generatedId;

    // ── Paragraph variant ───────────────────────────────────────
    if (variant === "paragraph") {
      const paragraphLines = lines ?? DEFAULT_PARAGRAPH_LINES;
      return (
        <ParagraphSkeleton
          ref={ref}
          lines={paragraphLines}
          lineSize={size as "sm" | "md" | "lg"}
          className={cn(
            fullWidth && "w-full",
            className,
          )}
          idPrefix={idPrefix}
        />
      );
    }

    // ── List variant ────────────────────────────────────────────
    if (variant === "list") {
      const listLines = lines ?? DEFAULT_LIST_LINES;
      return (
        <ListSkeleton
          ref={ref}
          lines={listLines}
          itemSize={size as "sm" | "md" | "lg"}
          className={cn(fullWidth && "w-full", className)}
          idPrefix={idPrefix}
        />
      );
    }

    // ── List-item variant ───────────────────────────────────────
    if (variant === "list-item") {
      return (
        <ListSkeleton
          ref={ref}
          lines={lines ?? 1}
          itemSize={size as "sm" | "md" | "lg"}
          showLeading
          showTrailing
          className={cn(fullWidth && "w-full", className)}
          idPrefix={idPrefix}
        />
      );
    }

    // ── Table variant ───────────────────────────────────────────
    if (variant === "table") {
      return (
        <TableSkeleton
          ref={ref}
          rows={lines ?? 5}
          className={cn(fullWidth && "w-full", className)}
          idPrefix={idPrefix}
        />
      );
    }

    // ── Table-row variant ───────────────────────────────────────
    // Single row with shimmer
    if (variant === "table-row") {
      return (
        <div
          ref={ref}
          className={cn(
            skeletonVariants({ variant, size, animation, fullWidth }),
            className,
          )}
          style={{
            width: typeof width === "number" ? `${width}px` : width,
            height: typeof height === "number" ? `${height}px` : height,
          }}
          role="status"
          aria-label="Loading"
          {...rest}
        >
          {children}
          <span className="sr-only">Loading...</span>
        </div>
      );
    }

    // ── Standard skeleton ───────────────────────────────────────
    const Comp = asChild ? Slot : "div";

    return (
      <Comp
        ref={ref}
        className={cn(
          skeletonVariants({ variant, size, animation, fullWidth }),
          className,
        )}
        style={{
          width: typeof width === "number" ? `${width}px` : width,
          height: typeof height === "number" ? `${height}px` : height,
        }}
        role="status"
        aria-label="Loading"
        {...rest}
      >
        {children}
        <span className="sr-only">Loading...</span>
      </Comp>
    );
  },
);
Skeleton.displayName = "Skeleton";

// ─── Shorthand sub-components ───────────────────────────────────────

type ShorthandSkeletonProps = Omit<SkeletonProps, "variant">;

/** Text line skeleton — convenience wrapper */
const SkeletonText = forwardRef<HTMLDivElement, ShorthandSkeletonProps>(
  (props, ref) => <Skeleton ref={ref} variant="text" {...props} />,
);
SkeletonText.displayName = "SkeletonText";

/** Heading skeleton — convenience wrapper */
const SkeletonHeading = forwardRef<HTMLDivElement, ShorthandSkeletonProps>(
  (props, ref) => <Skeleton ref={ref} variant="heading" {...props} />,
);
SkeletonHeading.displayName = "SkeletonHeading";

/** Avatar skeleton — convenience wrapper */
const SkeletonAvatar = forwardRef<HTMLDivElement, ShorthandSkeletonProps>(
  (props, ref) => <Skeleton ref={ref} variant="avatar" {...props} />,
);
SkeletonAvatar.displayName = "SkeletonAvatar";

/** Image skeleton — convenience wrapper */
const SkeletonImage = forwardRef<HTMLDivElement, ShorthandSkeletonProps>(
  (props, ref) => <Skeleton ref={ref} variant="image" {...props} />,
);
SkeletonImage.displayName = "SkeletonImage";

/** Button skeleton — convenience wrapper */
const SkeletonButton = forwardRef<HTMLDivElement, ShorthandSkeletonProps>(
  (props, ref) => <Skeleton ref={ref} variant="button" {...props} />,
);
SkeletonButton.displayName = "SkeletonButton";

/** Input skeleton — convenience wrapper */
const SkeletonInput = forwardRef<HTMLDivElement, ShorthandSkeletonProps>(
  (props, ref) => <Skeleton ref={ref} variant="input" {...props} />,
);
SkeletonInput.displayName = "SkeletonInput";

/** Card skeleton — convenience wrapper */
const SkeletonCard = forwardRef<HTMLDivElement, ShorthandSkeletonProps>(
  (props, ref) => <Skeleton ref={ref} variant="card" {...props} />,
);
SkeletonCard.displayName = "SkeletonCard";

/** Circle skeleton — convenience wrapper */
const SkeletonCircle = forwardRef<HTMLDivElement, ShorthandSkeletonProps>(
  (props, ref) => <Skeleton ref={ref} variant="circle" {...props} />,
);
SkeletonCircle.displayName = "SkeletonCircle";

/** Icon skeleton — convenience wrapper */
const SkeletonIcon = forwardRef<HTMLDivElement, ShorthandSkeletonProps>(
  (props, ref) => <Skeleton ref={ref} variant="icon" {...props} />,
);
SkeletonIcon.displayName = "SkeletonIcon";

/** Chip skeleton — convenience wrapper */
const SkeletonChip = forwardRef<HTMLDivElement, ShorthandSkeletonProps>(
  (props, ref) => <Skeleton ref={ref} variant="chip" {...props} />,
);
SkeletonChip.displayName = "SkeletonChip";

/** Badge skeleton — convenience wrapper */
const SkeletonBadge = forwardRef<HTMLDivElement, ShorthandSkeletonProps>(
  (props, ref) => <Skeleton ref={ref} variant="badge" {...props} />,
);
SkeletonBadge.displayName = "SkeletonBadge";

// ─── Compound Component Assignment ──────────────────────────────────

const SkeletonCompound = Object.assign(Skeleton, {
  Text: SkeletonText,
  Heading: SkeletonHeading,
  Avatar: SkeletonAvatar,
  Image: SkeletonImage,
  Button: SkeletonButton,
  Input: SkeletonInput,
  Card: SkeletonCard,
  Circle: SkeletonCircle,
  Icon: SkeletonIcon,
  Chip: SkeletonChip,
  Badge: SkeletonBadge,
  Group: SkeletonGroup,
  Paragraph: ParagraphSkeleton,
  List: ListSkeleton,
  Table: TableSkeleton,
});

// ─── Exports ─────────────────────────────────────────────────────────

export {
  SkeletonCompound as Skeleton,
  Skeleton as SkeletonRoot,
  SkeletonText,
  SkeletonHeading,
  SkeletonAvatar,
  SkeletonImage,
  SkeletonButton,
  SkeletonInput,
  SkeletonCard,
  SkeletonCircle,
  SkeletonIcon,
  SkeletonChip,
  SkeletonBadge,
  SkeletonGroup,
  ParagraphSkeleton,
  ListSkeleton,
  TableSkeleton,
  skeletonVariants,
  paragraphLineVariants,
};

export type {
  SkeletonBaseProps,
  SkeletonVariant,
  SkeletonSize,
  SkeletonAnimation,
  ParagraphSkeletonProps,
  ListSkeletonProps,
  TableSkeletonProps,
  SkeletonGroupProps,
};

export default SkeletonCompound;
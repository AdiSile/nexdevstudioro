"use client";

import React, { forwardRef, useCallback, useMemo } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/cn";

// ─── Helper: extract initials ───────────────────────────────────────

const INITIALS_REGEX = /[\p{L}\p{N}]+/gu;

function getInitials(name?: string, maxInitials = 2): string {
  if (!name) return "";

  const words = name.trim().match(INITIALS_REGEX);
  if (!words || words.length === 0) return "";

  return words
    .slice(0, maxInitials)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

// ─── Variant Definitions ────────────────────────────────────────────

const avatarVariants = cva(
  [
    "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden",
    "rounded-full",
    "bg-neutral-200",
  ],
  {
    variants: {
      size: {
        xs: ["h-6 w-6"],
        sm: ["h-8 w-8"],
        md: ["h-10 w-10"],
        lg: ["h-12 w-12"],
        xl: ["h-14 w-14"],
      },
      bordered: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      { bordered: true, size: "xs", className: "ring-2 ring-surface" },
      { bordered: true, size: "sm", className: "ring-2 ring-surface" },
      { bordered: true, size: "md", className: "ring-[3px] ring-surface" },
      { bordered: true, size: "lg", className: "ring-[3px] ring-surface" },
      { bordered: true, size: "xl", className: "ring-[4px] ring-surface" },
    ],
    defaultVariants: {
      size: "md",
      bordered: true,
    },
  },
);

// ─── Fallback text size mapping ─────────────────────────────────────

const fallbackTextSizes: Record<NonNullable<AvatarSize>, string> = {
  xs: "text-[10px]",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
  xl: "text-lg",
};

// ─── Indicator Variants ─────────────────────────────────────────────

const indicatorVariants = cva(
  [
    "absolute bottom-0 right-0 block rounded-full",
    "ring-2 ring-surface",
    "z-10",
  ],
  {
    variants: {
      size: {
        xs: "h-1.5 w-1.5",
        sm: "h-2 w-2",
        md: "h-2.5 w-2.5",
        lg: "h-3 w-3",
        xl: "h-3.5 w-3.5",
      },
      status: {
        online: "bg-success-500",
        offline: "bg-neutral-400",
        busy: "bg-danger-500",
        away: "bg-warning-500",
      },
    },
    defaultVariants: {
      size: "md",
      status: "online",
    },
  },
);

// ─── Group stacked overlap ──────────────────────────────────────────

const groupOverlap: Record<NonNullable<AvatarSize>, string> = {
  xs: "-ml-1",
  sm: "-ml-1.5",
  md: "-ml-2",
  lg: "-ml-3",
  xl: "-ml-3",
};

// ─── Types ──────────────────────────────────────────────────────────

type AvatarSize = VariantProps<typeof avatarVariants>["size"];

export type AvatarStatus = "online" | "offline" | "busy" | "away" | "none";

export interface AvatarProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color"> {
  /** Image source URL */
  src?: string;
  /** Alt text for the image */
  alt?: string;
  /** User name used to generate fallback initials */
  name?: string;
  /** Size preset */
  size?: AvatarSize;
  /** Show a ring border around the avatar */
  bordered?: boolean;
  /** Status indicator */
  status?: AvatarStatus;
  /** Custom fallback content (overrides initials) */
  fallback?: React.ReactNode;
  /** Custom status indicator (overrides default dot) */
  statusIndicator?: React.ReactNode;
  /** Callback when image fails to load */
  onLoadingError?: (error: Error) => void;
}

export interface AvatarGroupProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Avatar components to stack */
  children: React.ReactNode;
  /** Maximum number of avatars to show before +N overflow */
  max?: number;
  /** Size applied to all child avatars (overrides individual sizes) */
  size?: AvatarSize;
  /** Override the negative margin overlap between avatars */
  overlap?: string;
}

// ─── Avatar Component ───────────────────────────────────────────────

const Avatar = forwardRef<HTMLSpanElement, AvatarProps>((props, ref) => {
  const {
    src,
    alt,
    name,
    size = "md",
    bordered = true,
    status = "none",
    fallback,
    statusIndicator,
    className,
    onLoadingError,
    ...rest
  } = props;

  const initials = useMemo(() => getInitials(name), [name]);

  const handleLoadingError = useCallback(
    (_error: Error) => {
      // Radix fires an error event internally; we expose our own callback
      onLoadingError?.(_error);
    },
    [onLoadingError],
  );

  const fallbackContent = fallback ?? (
    <span
      className={cn(
        "font-medium text-neutral-600",
        fallbackTextSizes[size ?? "md"],
      )}
      aria-hidden="true"
    >
      {initials || "?"}
    </span>
  );

  const fallbackComp = (
    <AvatarPrimitive.Fallback
      className="flex h-full w-full items-center justify-center bg-neutral-200 text-neutral-600"
      delayMs={600}
    >
      {fallbackContent}
    </AvatarPrimitive.Fallback>
  );

  return (
    <span
      ref={ref}
      data-slot="avatar"
      className={cn(avatarVariants({ size, bordered }), className)}
      {...rest}
    >
      <AvatarPrimitive.Root
        className="h-full w-full"
        onLoadingStatusChange={(status) => {
          if (status === "error" && onLoadingError) {
            handleLoadingError(new Error("Avatar image failed to load"));
          }
        }}
      >
        {src && (
          <AvatarPrimitive.Image
            className="h-full w-full rounded-full object-cover"
            src={src}
            alt={alt ?? name ?? ""}
          />
        )}
        {fallbackComp}
      </AvatarPrimitive.Root>

      {/* Status indicator */}
      {status !== "none" && !statusIndicator && (
        <span
          data-slot="avatar-status"
          className={cn(indicatorVariants({ size, status }))}
          aria-label={status}
          role="status"
        />
      )}

      {/* Custom status indicator */}
      {statusIndicator && (
        <span
          data-slot="avatar-status-custom"
          className="absolute bottom-0 right-0 z-10"
        >
          {statusIndicator}
        </span>
      )}
    </span>
  );
});

Avatar.displayName = "Avatar";

// ─── AvatarGroup Component ──────────────────────────────────────────

const AvatarGroup = forwardRef<HTMLDivElement, AvatarGroupProps>(
  (props, ref) => {
    const {
      children,
      max,
      size,
      overlap,
      className,
      ...rest
    } = props;

    const childArray = React.Children.toArray(children) as React.ReactElement[];

    const visibleChildren = max != null && max >= 0
      ? childArray.slice(0, max)
      : childArray;

    const overflowCount = max != null && max >= 0
      ? Math.max(0, childArray.length - max)
      : 0;

    const resolvedSize = size ?? "md";
    const resolvedOverlap = overlap ?? groupOverlap[resolvedSize];

    return (
      <div
        ref={ref}
        data-slot="avatar-group"
        className={cn("flex items-center", className)}
        role="group"
        aria-label="Avatar group"
        {...rest}
      >
        {visibleChildren.map((child, index) => {
          const cloned = React.cloneElement(child, {
            key: child.key ?? index,
            className: cn(
              index !== 0 && resolvedOverlap,
              child.props?.className,
            ),
            size: size ?? child.props?.size,
          });
          return cloned;
        })}

        {overflowCount > 0 && (
          <span
            data-slot="avatar-group-overflow"
            className={cn(
              avatarVariants({ size: resolvedSize, bordered: true }),
              resolvedOverlap,
              "bg-neutral-300 text-neutral-700",
              fallbackTextSizes[resolvedSize],
              "flex items-center justify-center font-medium",
            )}
            aria-label={`${overflowCount} more`}
          >
            +{overflowCount}
          </span>
        )}
      </div>
    );
  },
);

AvatarGroup.displayName = "AvatarGroup";

// ─── Exports ────────────────────────────────────────────────────────

export { Avatar, AvatarGroup, avatarVariants, indicatorVariants, getInitials };
export default Avatar;

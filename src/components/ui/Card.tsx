"use client";

import React, { forwardRef, useId } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { Slot } from "@radix-ui/react-slot";

// ─── Variant Definitions ────────────────────────────────────────────

const cardVariants = cva(
  [
    "flex flex-col",
    "bg-surface text-text-primary",
    "rounded-xl border border-border-subtle",
    "overflow-hidden",
    "transition-all duration-300 ease-out",
    "ring-offset-surface",
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-border-focus focus-visible:ring-offset-2",
  ],
  {
    variants: {
      variant: {
        default: ["bg-surface", "shadow-elevation-1"],
        outlined: [
          "bg-transparent",
          "border-border",
          "shadow-none",
        ],
        elevated: [
          "bg-surface",
          "border-transparent",
          "shadow-elevation-2",
        ],
        ghost: [
          "bg-transparent",
          "border-transparent",
          "shadow-none",
        ],
        interactive: [
          "bg-surface",
          "border-border-subtle",
          "shadow-elevation-1",
          "cursor-pointer",
          "hover:border-brand-300",
          "active:scale-[0.985]",
        ],
      },
      hover: {
        none: [],
        lift: [
          "hover:shadow-elevation-2",
          "hover:-translate-y-1",
        ],
        glow: [
          "hover:shadow-elevation-2",
          "hover:border-brand-400/40",
          "hover:shadow-brand-500/10",
        ],
        scale: [
          "hover:shadow-elevation-2",
          "hover:scale-[1.02]",
        ],
        border: [
          "hover:border-brand-400",
          "hover:shadow-elevation-1",
        ],
      },
      size: {
        sm: ["max-w-sm"],
        md: ["max-w-md"],
        lg: ["max-w-lg"],
        xl: ["max-w-xl"],
        full: ["w-full"],
        auto: [],
      },
      padding: {
        none: [],
        sm: ["p-3"],
        md: ["p-5"],
        lg: ["p-7"],
      },
      rounded: {
        none: ["rounded-none"],
        sm: ["rounded-md"],
        md: ["rounded-xl"],
        lg: ["rounded-2xl"],
        full: ["rounded-3xl"],
      },
    },
    compoundVariants: [
      {
        variant: "interactive",
        hover: "lift",
        className: "hover:shadow-elevation-3 hover:-translate-y-1.5",
      },
      {
        variant: "elevated",
        hover: "glow",
        className: "hover:shadow-elevation-3",
      },
      {
        variant: "ghost",
        hover: "scale",
        className: "hover:bg-surface-secondary/50",
      },
    ],
    defaultVariants: {
      variant: "default",
      hover: "none",
      size: "auto",
      padding: "md",
      rounded: "md",
    },
  },
);

// ─── Card Header Variants ───────────────────────────────────────────

const cardHeaderVariants = cva(
  [
    "flex items-start gap-3",
    "border-b border-border-subtle",
  ],
  {
    variants: {
      headerPadding: {
        none: [],
        sm: ["px-3 py-2"],
        md: ["px-5 py-4"],
        lg: ["px-7 py-5"],
      },
      divider: {
        true: ["border-b border-border-subtle"],
        false: ["border-b-0"],
      },
    },
    defaultVariants: {
      headerPadding: "md",
      divider: true,
    },
  },
);

// ─── Card Image Variants ────────────────────────────────────────────

const cardImageVariants = cva(
  ["relative w-full overflow-hidden bg-surface-secondary"],
  {
    variants: {
      imagePosition: {
        top: ["order-first"],
        bottom: ["order-last"],
        background: [
          "absolute inset-0 z-0",
          "[&_img]:object-cover [&_img]:w-full [&_img]:h-full",
        ],
      },
      aspectRatio: {
        auto: [],
        "1/1": ["aspect-square"],
        "4/3": ["aspect-[4/3]"],
        "16/9": ["aspect-video"],
        "21/9": ["aspect-[21/9]"],
        "3/4": ["aspect-[3/4]"],
        "9/16": ["aspect-[9/16]"],
        "2/1": ["aspect-[2/1]"],
      },
      imageFit: {
        cover: ["[&_img]:object-cover"],
        contain: ["[&_img]:object-contain"],
        fill: ["[&_img]:object-fill"],
        none: ["[&_img]:object-none"],
      },
    },
    defaultVariants: {
      imagePosition: "top",
      aspectRatio: "16/9",
      imageFit: "cover",
    },
  },
);

// ─── Card Content Variants ──────────────────────────────────────────

const cardContentVariants = cva(
  ["flex-1"],
  {
    variants: {
      contentPadding: {
        none: [],
        sm: ["px-3 py-2"],
        md: ["px-5 py-4"],
        lg: ["px-7 py-5"],
      },
    },
    defaultVariants: {
      contentPadding: "md",
    },
  },
);

// ─── Card Actions Variants ──────────────────────────────────────────

const cardActionsVariants = cva(
  [
    "flex items-center gap-2",
    "border-t border-border-subtle",
  ],
  {
    variants: {
      actionsAlign: {
        start: ["justify-start"],
        center: ["justify-center"],
        end: ["justify-end"],
        between: ["justify-between"],
        stretch: ["[&>*]:flex-1"],
      },
      actionsPadding: {
        none: [],
        sm: ["px-3 py-2"],
        md: ["px-5 py-3"],
        lg: ["px-7 py-4"],
      },
      actionsDivider: {
        true: ["border-t border-border-subtle"],
        false: ["border-t-0"],
      },
    },
    defaultVariants: {
      actionsAlign: "end",
      actionsPadding: "md",
      actionsDivider: true,
    },
  },
);

// ─── Card Footer Variants ───────────────────────────────────────────

const cardFooterVariants = cva(
  [
    "flex items-center",
    "border-t border-border-subtle",
    "bg-surface-secondary/40",
    "text-sm text-text-secondary",
  ],
  {
    variants: {
      footerPadding: {
        none: [],
        sm: ["px-3 py-2"],
        md: ["px-5 py-3"],
        lg: ["px-7 py-4"],
      },
      footerDivider: {
        true: ["border-t border-border-subtle"],
        false: ["border-t-0"],
      },
    },
    defaultVariants: {
      footerPadding: "md",
      footerDivider: true,
    },
  },
);

// ─── Types ──────────────────────────────────────────────────────────

export type CardVariant = VariantProps<typeof cardVariants>["variant"];
export type CardHover = VariantProps<typeof cardVariants>["hover"];
export type CardSize = VariantProps<typeof cardVariants>["size"];
export type CardPadding = VariantProps<typeof cardVariants>["padding"];
export type CardRounded = VariantProps<typeof cardVariants>["rounded"];
export type CardImagePosition = VariantProps<typeof cardImageVariants>["imagePosition"];
export type CardAspectRatio = VariantProps<typeof cardImageVariants>["aspectRatio"];
export type CardImageFit = VariantProps<typeof cardImageVariants>["imageFit"];
export type CardActionsAlign = VariantProps<typeof cardActionsVariants>["actionsAlign"];

// ─── Card Props ─────────────────────────────────────────────────────

type CardBaseProps = {
  /** Visual style variant */
  variant?: CardVariant;
  /** Hover effect */
  hover?: CardHover;
  /** Max-width size preset */
  size?: CardSize;
  /** Inner padding for the entire card */
  padding?: CardPadding;
  /** Border radius */
  rounded?: CardRounded;
  /** Render as child (Radix Slot pattern) */
  asChild?: boolean;
  /** Disable the card (dimmed, no interactions) */
  disabled?: boolean;
  /** Optional click handler */
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  /** Custom class name */
  className?: string;
  children?: React.ReactNode;
};

export type CardProps = CardBaseProps &
  Omit<React.HTMLAttributes<HTMLDivElement>, keyof CardBaseProps>;

// ─── CardHeader Props ───────────────────────────────────────────────

type CardHeaderBaseProps = {
  /** Padding preset */
  headerPadding?: VariantProps<typeof cardHeaderVariants>["headerPadding"];
  /** Show bottom divider */
  divider?: boolean;
  /** Custom class name */
  className?: string;
  children?: React.ReactNode;
};

export type CardHeaderProps = CardHeaderBaseProps &
  Omit<React.HTMLAttributes<HTMLDivElement>, keyof CardHeaderBaseProps>;

// ─── CardTitle Props ────────────────────────────────────────────────

type CardTitleBaseProps = {
  /** HTML heading level (default "h3") */
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  /** Custom class name */
  className?: string;
  children?: React.ReactNode;
};

export type CardTitleProps = CardTitleBaseProps &
  Omit<React.HTMLAttributes<HTMLHeadingElement>, keyof CardTitleBaseProps>;

// ─── CardDescription Props ──────────────────────────────────────────

type CardDescriptionBaseProps = {
  /** Custom class name */
  className?: string;
  children?: React.ReactNode;
};

export type CardDescriptionProps = CardDescriptionBaseProps &
  Omit<React.HTMLAttributes<HTMLParagraphElement>, keyof CardDescriptionBaseProps>;

// ─── CardHeaderAction Props ─────────────────────────────────────────

type CardHeaderActionBaseProps = {
  /** Custom class name */
  className?: string;
  children?: React.ReactNode;
};

export type CardHeaderActionProps = CardHeaderActionBaseProps &
  Omit<React.HTMLAttributes<HTMLDivElement>, keyof CardHeaderActionBaseProps>;

// ─── CardImage Props ────────────────────────────────────────────────

type CardImageBaseProps = {
  /** Image source URL */
  src: string;
  /** Alt text (required for accessibility) */
  alt: string;
  /** Image position within the card */
  imagePosition?: CardImagePosition;
  /** Aspect ratio */
  aspectRatio?: CardAspectRatio;
  /** Object-fit behavior */
  imageFit?: CardImageFit;
  /** Image loading strategy */
  loading?: "lazy" | "eager";
  /** Blur placeholder (data URL) */
  blurDataURL?: string;
  /** Overlay gradient (e.g., "from-black/60 to-transparent") */
  overlay?: string;
  /** Overlay content rendered on top of the image */
  overlayContent?: React.ReactNode;
  /** Custom class name */
  className?: string;
  /** Image class name */
  imageClassName?: string;
};

export type CardImageProps = CardImageBaseProps &
  Omit<React.HTMLAttributes<HTMLDivElement>, keyof CardImageBaseProps>;

// ─── CardContent Props ──────────────────────────────────────────────

type CardContentBaseProps = {
  /** Padding preset */
  contentPadding?: VariantProps<typeof cardContentVariants>["contentPadding"];
  /** Custom class name */
  className?: string;
  children?: React.ReactNode;
};

export type CardContentProps = CardContentBaseProps &
  Omit<React.HTMLAttributes<HTMLDivElement>, keyof CardContentBaseProps>;

// ─── CardActions Props ──────────────────────────────────────────────

type CardActionsBaseProps = {
  /** Alignment of action items */
  actionsAlign?: CardActionsAlign;
  /** Padding preset */
  actionsPadding?: VariantProps<typeof cardActionsVariants>["actionsPadding"];
  /** Show top divider */
  actionsDivider?: boolean;
  /** Custom class name */
  className?: string;
  children?: React.ReactNode;
};

export type CardActionsProps = CardActionsBaseProps &
  Omit<React.HTMLAttributes<HTMLDivElement>, keyof CardActionsBaseProps>;

// ─── CardFooter Props ───────────────────────────────────────────────

type CardFooterBaseProps = {
  /** Padding preset */
  footerPadding?: VariantProps<typeof cardFooterVariants>["footerPadding"];
  /** Show top divider */
  footerDivider?: boolean;
  /** Custom class name */
  className?: string;
  children?: React.ReactNode;
};

export type CardFooterProps = CardFooterBaseProps &
  Omit<React.HTMLAttributes<HTMLDivElement>, keyof CardFooterBaseProps>;

// ─── Sub-components ─────────────────────────────────────────────────

// ── CardTitle ───────────────────────────────────────────────────────

const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ as: Comp = "h3", className, children, ...rest }, ref) => {
    return (
      <Comp
        ref={ref}
        className={cn(
          "font-semibold text-text-primary leading-tight",
          Comp === "h1" && "text-2xl",
          Comp === "h2" && "text-xl",
          Comp === "h3" && "text-lg",
          Comp === "h4" && "text-base",
          Comp === "h5" && "text-sm",
          Comp === "h6" && "text-xs",
          className,
        )}
        {...rest}
      >
        {children}
      </Comp>
    );
  },
);
CardTitle.displayName = "CardTitle";

// ── CardDescription ─────────────────────────────────────────────────

const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(
  ({ className, children, ...rest }, ref) => {
    return (
      <p
        ref={ref}
        className={cn(
          "text-sm text-text-secondary leading-relaxed",
          className,
        )}
        {...rest}
      >
        {children}
      </p>
    );
  },
);
CardDescription.displayName = "CardDescription";

// ── CardHeaderAction ────────────────────────────────────────────────

const CardHeaderAction = forwardRef<HTMLDivElement, CardHeaderActionProps>(
  ({ className, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "ml-auto flex items-center gap-1.5 shrink-0",
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    );
  },
);
CardHeaderAction.displayName = "CardHeaderAction";

// ── CardHeader ──────────────────────────────────────────────────────

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  (
    { headerPadding = "md", divider = true, className, children, ...rest },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          cardHeaderVariants({ headerPadding, divider }),
          className,
        )}
        {...rest}
      >
        <div className="flex-1 min-w-0 flex flex-col gap-1">{children}</div>
      </div>
    );
  },
);
CardHeader.displayName = "CardHeader";

// ── CardImage ───────────────────────────────────────────────────────

const CardImage = forwardRef<HTMLDivElement, CardImageProps>(
  (
    {
      src,
      alt,
      imagePosition = "top",
      aspectRatio = "16/9",
      imageFit = "cover",
      loading = "lazy",
      blurDataURL,
      overlay,
      overlayContent,
      className,
      imageClassName,
      ...rest
    },
    ref,
  ) => {
    const imageElement = (
      <img
        src={src}
        alt={alt}
        loading={loading}
        className={cn(
          "w-full h-full",
          imageFit === "cover" && "object-cover",
          imageFit === "contain" && "object-contain",
          imageFit === "fill" && "object-fill",
          imageFit === "none" && "object-none",
          "transition-transform duration-500",
          "group-hover/card-image:scale-105",
          imageClassName,
        )}
        {...(blurDataURL
          ? {
              style: {
                backgroundImage: `url(${blurDataURL})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              },
            }
          : {})}
      />
    );

    const overlayElement = overlay ? (
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-b",
          overlay,
        )}
        aria-hidden="true"
      />
    ) : null;

    const overlayContentElement = overlayContent ? (
      <div className="absolute inset-0 flex flex-col justify-end p-4 z-10">
        {overlayContent}
      </div>
    ) : null;

    return (
      <div
        ref={ref}
        className={cn(
          cardImageVariants({ imagePosition, aspectRatio, imageFit }),
          "group/card-image",
          className,
        )}
        {...rest}
        role="img"
        aria-label={alt}
      >
        {imageElement}
        {overlayElement}
        {overlayContentElement}
      </div>
    );
  },
);
CardImage.displayName = "CardImage";

// ── CardContent ─────────────────────────────────────────────────────

const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ contentPadding = "md", className, children, ...rest }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(cardContentVariants({ contentPadding }), className)}
        {...rest}
      >
        {children}
      </div>
    );
  },
);
CardContent.displayName = "CardContent";

// ── CardActions ─────────────────────────────────────────────────────

const CardActions = forwardRef<HTMLDivElement, CardActionsProps>(
  (
    {
      actionsAlign = "end",
      actionsPadding = "md",
      actionsDivider = true,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          cardActionsVariants({ actionsAlign, actionsPadding, actionsDivider }),
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    );
  },
);
CardActions.displayName = "CardActions";

// ── CardFooter ──────────────────────────────────────────────────────

const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  (
    {
      footerPadding = "md",
      footerDivider = true,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          cardFooterVariants({ footerPadding, footerDivider }),
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    );
  },
);
CardFooter.displayName = "CardFooter";

// ─── Main Card Component ────────────────────────────────────────────

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = "default",
      hover = "none",
      size = "auto",
      padding = "md",
      rounded = "md",
      asChild = false,
      disabled = false,
      onClick,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "div";

    // ARIA attributes for interactive cards
    const interactiveProps =
      variant === "interactive" || onClick
        ? {
            role: "button" as const,
            tabIndex: disabled ? -1 : 0,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (
                (e.key === "Enter" || e.key === " ") &&
                onClick &&
                !disabled
              ) {
                e.preventDefault();
                onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
              }
            },
          }
        : {};

    const composedClassName = cn(
      cardVariants({ variant, hover, size, padding, rounded }),
      disabled && "opacity-50 pointer-events-none select-none",
      (variant === "interactive" || onClick) && "cursor-pointer",
      className,
    );

    return (
      <Comp
        ref={ref}
        className={composedClassName}
        onClick={disabled ? undefined : onClick}
        aria-disabled={disabled ? true : undefined}
        {...interactiveProps}
        {...rest}
      >
        {children}
      </Comp>
    );
  },
);
Card.displayName = "Card";

// ─── Compound Component Assignment ──────────────────────────────────

const CardCompound = Object.assign(Card, {
  Header: CardHeader,
  Title: CardTitle,
  Description: CardDescription,
  HeaderAction: CardHeaderAction,
  Image: CardImage,
  Content: CardContent,
  Actions: CardActions,
  Footer: CardFooter,
});

// ─── Exports ─────────────────────────────────────────────────────────

export {
  CardCompound as Card,
  Card as CardRoot,
  CardHeader,
  CardTitle,
  CardDescription,
  CardHeaderAction,
  CardImage,
  CardContent,
  CardActions,
  CardFooter,
  cardVariants,
  cardHeaderVariants,
  cardImageVariants,
  cardContentVariants,
  cardActionsVariants,
  cardFooterVariants,
};

export default CardCompound;
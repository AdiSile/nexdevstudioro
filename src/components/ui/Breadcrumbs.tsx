"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  Fragment,
  forwardRef,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronRight, Slash, Dot, Home } from "lucide-react";
import { cn } from "@/lib/cn";
import { Slot } from "@radix-ui/react-slot";
import type { BreadcrumbList, WithContext } from "schema-dts";

// ═══════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════

const SEPARATOR_PRESETS = {
  chevron: ChevronRight,
  slash: Slash,
  dot: Dot,
} as const;

type SeparatorPreset = keyof typeof SEPARATOR_PRESETS;

// ═══════════════════════════════════════════════════════════════════════
// Variant Definitions
// ═══════════════════════════════════════════════════════════════════════

const breadcrumbsVariants = cva(
  ["flex items-center flex-wrap", "list-none m-0 p-0"],
  {
    variants: {
      size: {
        sm: "text-xs gap-0.5",
        md: "text-sm gap-1",
        lg: "text-base gap-1.5",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const breadcrumbLinkVariants = cva(
  [
    "inline-flex items-center gap-1.5",
    "transition-colors duration-200",
    "rounded-sm",
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-border-focus focus-visible:ring-offset-2",
    "no-underline",
  ],
  {
    variants: {
      variant: {
        default: "text-text-tertiary hover:text-text-primary",
        primary: "text-brand-500 hover:text-brand-700",
        muted: "text-text-quaternary hover:text-text-secondary",
      },
      size: {
        sm: "px-1 py-0.5",
        md: "px-1.5 py-0.5",
        lg: "px-2 py-1",
      },
      isCurrent: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      {
        isCurrent: true,
        variant: "default",
        className:
          "text-text-primary font-semibold pointer-events-none cursor-default hover:text-text-primary",
      },
      {
        isCurrent: true,
        variant: "primary",
        className:
          "text-brand-700 font-semibold pointer-events-none cursor-default hover:text-brand-700",
      },
      {
        isCurrent: true,
        variant: "muted",
        className:
          "text-text-secondary font-semibold pointer-events-none cursor-default hover:text-text-secondary",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

const breadcrumbSeparatorVariants = cva(
  [
    "shrink-0 text-text-quaternary select-none",
    "flex items-center justify-center",
  ],
  {
    variants: {
      size: {
        sm: "h-3.5 w-3.5",
        md: "h-4 w-4",
        lg: "h-4.5 w-4.5",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const breadcrumbCollapsedVariants = cva(
  [
    "inline-flex items-center justify-center",
    "rounded-sm",
    "text-text-tertiary hover:text-text-primary",
    "bg-transparent hover:bg-surface-secondary",
    "transition-all duration-200",
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-border-focus focus-visible:ring-offset-2",
    "cursor-pointer",
  ],
  {
    variants: {
      size: {
        sm: "h-5 min-w-[1.25rem] px-0.5 text-xs",
        md: "h-6 min-w-[1.5rem] px-1 text-sm",
        lg: "h-7 min-w-[1.75rem] px-1.5 text-base",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

interface BreadcrumbItemData {
  /** Display label for the crumb */
  label: string;
  /** URL for the crumb. If omitted, the item is treated as the current page. */
  href?: string;
  /** Icon shown before the label */
  icon?: React.ReactNode;
  /** Machine-readable identifier (for JSON-LD `@id`) */
  itemId?: string;
  /** Optional image URL (for JSON-LD `image`) */
  image?: string;
}

type BreadcrumbSize = VariantProps<typeof breadcrumbsVariants>["size"];
type BreadcrumbVariant = VariantProps<
  typeof breadcrumbLinkVariants
>["variant"];

// ═══════════════════════════════════════════════════════════════════════
// Context
// ═══════════════════════════════════════════════════════════════════════

type BreadcrumbsContextValue = {
  size: NonNullable<BreadcrumbSize>;
  variant: NonNullable<BreadcrumbVariant>;
  separator: React.ReactNode;
  showHomeIcon: boolean;
  items: BreadcrumbItemData[];
  collapsedItems: Set<number>;
  toggleCollapsed: (index: number) => void;
  navId: string;
  listId: string;
  includeCurrentAsLink: boolean;
};

const BreadcrumbsContext = createContext<BreadcrumbsContextValue | null>(
  null,
);

function useBreadcrumbsContext() {
  const ctx = useContext(BreadcrumbsContext);
  if (!ctx) {
    throw new Error(
      "Breadcrumbs compound components must be used within a <Breadcrumbs> root.",
    );
  }
  return ctx;
}

// ═══════════════════════════════════════════════════════════════════════
// JSON-LD Generator
// ═══════════════════════════════════════════════════════════════════════

function generateJsonLd(
  items: BreadcrumbItemData[],
): WithContext<BreadcrumbList> {
  const itemListElement = items.map((item, index) => ({
    "@type": "ListItem" as const,
    position: index + 1,
    item: {
      "@type": "WebPage" as const,
      "@id": item.itemId ?? item.href ?? `#breadcrumb-${index}`,
      name: item.label,
      ...(item.image ? { image: item.image } : {}),
    },
  }));

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Hook: Collapse Manager
// ═══════════════════════════════════════════════════════════════════════

function useCollapseManager(
  items: BreadcrumbItemData[],
  maxItems?: number,
  itemsBeforeCollapse?: number,
  itemsAfterCollapse?: number,
) {
  const before = itemsBeforeCollapse ?? 1;
  const after = itemsAfterCollapse ?? 1;
  const max = maxItems ?? 0;

  const shouldCollapse = max > 0 && items.length > max;

  const [expandedGroups, setExpandedGroups] = React.useState<Set<number>>(
    new Set(),
  );

  const toggleCollapsed = useCallback((index: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const getVisibleItems = useCallback((): {
    visible: BreadcrumbItemData[];
    collapsedGroups: Array<{ startIndex: number; count: number }>;
  } => {
    if (!shouldCollapse) {
      return { visible: items, collapsedGroups: [] };
    }

    const firstSlice = items.slice(0, before);
    const lastSlice = items.slice(-after);

    const middleStart = before;
    const middleEnd = items.length - after;
    const middleCount = middleEnd - middleStart;

    if (expandedGroups.has(middleStart)) {
      return { visible: items, collapsedGroups: [] };
    }

    const visible: BreadcrumbItemData[] = [
      ...firstSlice,
      { label: "__COLLAPSED__" },
      ...lastSlice,
    ];

    return {
      visible,
      collapsedGroups: [{ startIndex: middleStart, count: middleCount }],
    };
  }, [items, shouldCollapse, before, after, expandedGroups]);

  return {
    shouldCollapse,
    expandedGroups,
    toggleCollapsed,
    getVisibleItems,
    collapsedStartIndex: shouldCollapse ? before : -1,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Breadcrumbs (Root)
// ═══════════════════════════════════════════════════════════════════════

export interface BreadcrumbsProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  /** Array of breadcrumb items: label, optional href, icon, etc. */
  items: BreadcrumbItemData[];
  /** Separator between items. Can be a string (e.g. "/"), a ReactNode, or a preset name. */
  separator?: SeparatorPreset | React.ReactNode;
  /** Visual size preset */
  size?: BreadcrumbSize;
  /** Link color variant */
  variant?: BreadcrumbVariant;
  /** Show a home icon on the first item */
  showHomeIcon?: boolean;
  /** Include JSON-LD structured data (default: true) */
  jsonLd?: boolean;
  /** Maximum number of items to show before collapsing middle items */
  maxItems?: number;
  /** Number of items to keep before the collapsed region (default: 1) */
  itemsBeforeCollapse?: number;
  /** Number of items to keep after the collapsed region (default: 1) */
  itemsAfterCollapse?: number;
  /** Label for the collapsed items button (screen-reader) */
  collapsedLabel?: string;
  /** Keep the last item as a link instead of plain text (default: false) */
  includeCurrentAsLink?: boolean;
  /** Accessible label for the nav element */
  "aria-label"?: string;
}

const Breadcrumbs = forwardRef<HTMLElement, BreadcrumbsProps>(
  (
    {
      items,
      separator = "chevron",
      size = "md",
      variant = "default",
      showHomeIcon = true,
      jsonLd = true,
      maxItems,
      itemsBeforeCollapse,
      itemsAfterCollapse,
      collapsedLabel = "Show more breadcrumbs",
      includeCurrentAsLink = false,
      "aria-label": ariaLabel = "Breadcrumb",
      className,
      ...rest
    },
    ref,
  ) => {
    const autoId = useId();
    const navId = `${autoId}-breadcrumb-nav`;
    const listId = `${autoId}-breadcrumb-list`;

    const resolvedSeparator = useMemo(() => {
      if (typeof separator === "string" && separator in SEPARATOR_PRESETS) {
        const IconComponent =
          SEPARATOR_PRESETS[separator as SeparatorPreset];
        return <IconComponent aria-hidden="true" />;
      }
      if (React.isValidElement(separator)) {
        return separator;
      }
      return (
        <span aria-hidden="true" className="select-none">
          {separator}
        </span>
      );
    }, [separator]);

    const collapse = useCollapseManager(
      items,
      maxItems,
      itemsBeforeCollapse,
      itemsAfterCollapse,
    );

    const [collapsedItems, setCollapsedItems] = React.useState<Set<number>>(
      new Set(),
    );

    React.useEffect(() => {
      setCollapsedItems(collapse.expandedGroups);
    }, [collapse.expandedGroups]);

    const toggleCollapsed = useCallback(
      (index: number) => {
        collapse.toggleCollapsed(index);
      },
      [collapse],
    );

    const contextValue = useMemo<BreadcrumbsContextValue>(
      () => ({
        size: size!,
        variant: variant!,
        separator: resolvedSeparator,
        showHomeIcon,
        items,
        collapsedItems,
        toggleCollapsed,
        navId,
        listId,
        includeCurrentAsLink,
      }),
      [
        size,
        variant,
        resolvedSeparator,
        showHomeIcon,
        items,
        collapsedItems,
        toggleCollapsed,
        navId,
        listId,
        includeCurrentAsLink,
      ],
    );

    const { visible, collapsedGroups } = collapse.getVisibleItems();

    const jsonLdData = useMemo(
      () => (jsonLd ? generateJsonLd(items) : null),
      [jsonLd, items],
    );

    return (
      <BreadcrumbsContext.Provider value={contextValue}>
        {jsonLdData && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(jsonLdData),
            }}
            data-testid="breadcrumbs-jsonld"
          />
        )}

        <nav
          ref={ref}
          id={navId}
          aria-label={ariaLabel}
          className={cn(className)}
          {...rest}
        >
          <ol
            id={listId}
            className={cn(breadcrumbsVariants({ size }))}
            itemScope
            itemType="https://schema.org/BreadcrumbList"
          >
            {visible.map((item) => {
              if (item.label === "__COLLAPSED__") {
                const group = collapsedGroups[0];
                const startIdx = group?.startIndex ?? 0;
                const count = group?.count ?? 0;

                return (
                  <Fragment key={`collapsed-${startIdx}`}>
                    <BreadcrumbCollapsed
                      index={startIdx}
                      count={count}
                      label={collapsedLabel}
                      size={size!}
                    />
                    <BreadcrumbSeparator />
                  </Fragment>
                );
              }

              const originalIndex = items.indexOf(item);
              const isLast = originalIndex === items.length - 1;
              const showLink = includeCurrentAsLink || !isLast;

              return (
                <Fragment key={`${item.label}-${originalIndex}`}>
                  <BreadcrumbItem
                    item={item}
                    index={originalIndex}
                    isCurrent={isLast}
                    showLink={showLink}
                    isFirst={originalIndex === 0}
                  />
                  {!isLast && <BreadcrumbSeparator />}
                </Fragment>
              );
            })}
          </ol>
        </nav>
      </BreadcrumbsContext.Provider>
    );
  },
);

Breadcrumbs.displayName = "Breadcrumbs";

// ═══════════════════════════════════════════════════════════════════════
// BreadcrumbItem
// ═══════════════════════════════════════════════════════════════════════

interface BreadcrumbItemProps {
  item: BreadcrumbItemData;
  index: number;
  isCurrent: boolean;
  showLink: boolean;
  isFirst: boolean;
}

function BreadcrumbItem({
  item,
  index,
  isCurrent,
  showLink,
  isFirst,
}: BreadcrumbItemProps) {
  const ctx = useBreadcrumbsContext();
  const { size, variant, showHomeIcon } = ctx;

  const resolvedIcon = useMemo(() => {
    if (item.icon) return item.icon;
    if (isFirst && showHomeIcon) {
      return <Home aria-hidden="true" />;
    }
    return null;
  }, [item.icon, isFirst, showHomeIcon]);

  const content = (
    <>
      {resolvedIcon && (
        <span className="shrink-0 inline-flex">{resolvedIcon}</span>
      )}
      <span className="truncate max-w-[200px] sm:max-w-[300px]">
        {item.label}
      </span>
    </>
  );

  if (!showLink) {
    return (
      <li
        itemProp="itemListElement"
        itemScope
        itemType="https://schema.org/ListItem"
        className="inline-flex items-center"
      >
        <span
          className={cn(
            breadcrumbLinkVariants({ variant, size, isCurrent: true }),
          )}
          aria-current="page"
        >
          {content}
        </span>
        <meta itemProp="position" content={String(index + 1)} />
        <meta
          itemProp="item"
          content={item.itemId ?? item.href ?? `#breadcrumb-${index}`}
        />
      </li>
    );
  }

  return (
    <li
      itemProp="itemListElement"
      itemScope
      itemType="https://schema.org/ListItem"
      className="inline-flex items-center"
    >
      <a
        href={item.href ?? "#"}
        className={cn(
          breadcrumbLinkVariants({ variant, size, isCurrent: false }),
        )}
        itemProp="item"
        {...(!isCurrent ? {} : { "aria-current": "page" as const })}
      >
        {content}
      </a>
      <meta itemProp="position" content={String(index + 1)} />
    </li>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// BreadcrumbSeparator
// ═══════════════════════════════════════════════════════════════════════

function BreadcrumbSeparator() {
  const ctx = useBreadcrumbsContext();
  const { separator, size } = ctx;

  return (
    <li
      aria-hidden="true"
      className={cn("inline-flex items-center shrink-0", "mx-0.5")}
    >
      <span className={cn(breadcrumbSeparatorVariants({ size }))}>
        {separator}
      </span>
    </li>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// BreadcrumbCollapsed
// ═══════════════════════════════════════════════════════════════════════

interface BreadcrumbCollapsedProps {
  index: number;
  count: number;
  label: string;
  size: NonNullable<BreadcrumbSize>;
}

function BreadcrumbCollapsed({
  index,
  count,
  label,
  size,
}: BreadcrumbCollapsedProps) {
  const ctx = useBreadcrumbsContext();
  const { toggleCollapsed } = ctx;

  const handleClick = useCallback(() => {
    toggleCollapsed(index);
  }, [toggleCollapsed, index]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLSpanElement>) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleCollapsed(index);
      }
    },
    [toggleCollapsed, index],
  );

  return (
    <li className="inline-flex items-center">
      <span
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-expanded={false}
        title={`${count} hidden items — click to reveal`}
        className={cn(breadcrumbCollapsedVariants({ size }))}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        &hellip;
      </span>
    </li>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Declarative sub-components (compound API)
// ═══════════════════════════════════════════════════════════════════════

interface BreadcrumbLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  asChild?: boolean;
}

const BreadcrumbLink = forwardRef<HTMLAnchorElement, BreadcrumbLinkProps>(
  ({ asChild = false, className, children, ...rest }, ref) => {
    const Comp = asChild ? Slot : "a";
    return (
      <Comp
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5",
          "transition-colors duration-200",
          "rounded-sm no-underline",
          "focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-border-focus focus-visible:ring-offset-2",
          "text-text-tertiary hover:text-text-primary",
          className,
        )}
        {...rest}
      >
        {children}
      </Comp>
    );
  },
);

BreadcrumbLink.displayName = "BreadcrumbLink";

interface BreadcrumbCurrentProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  asChild?: boolean;
}

const BreadcrumbCurrent = forwardRef<
  HTMLSpanElement,
  BreadcrumbCurrentProps
>(({ asChild = false, className, children, ...rest }, ref) => {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp
      ref={ref}
      aria-current="page"
      className={cn(
        "inline-flex items-center gap-1.5",
        "font-semibold text-text-primary",
        "truncate max-w-[200px] sm:max-w-[300px]",
        className,
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
});

BreadcrumbCurrent.displayName = "BreadcrumbCurrent";

interface BreadcrumbSeparatorManualProps
  extends React.HTMLAttributes<HTMLLIElement> {
  asChild?: boolean;
}

const BreadcrumbSeparatorManual = forwardRef<
  HTMLLIElement,
  BreadcrumbSeparatorManualProps
>(({ asChild = false, className, children, ...rest }, ref) => {
  const Comp = asChild ? Slot : "li";
  return (
    <Comp
      ref={ref}
      aria-hidden="true"
      className={cn(
        "shrink-0 text-text-quaternary select-none",
        "flex items-center justify-center",
        "mx-0.5",
        className,
      )}
      {...rest}
    >
      {children ?? <ChevronRight className="h-4 w-4" />}
    </Comp>
  );
});

BreadcrumbSeparatorManual.displayName = "BreadcrumbSeparatorManual";

// ═══════════════════════════════════════════════════════════════════════
// Declarative Breadcrumbs (children-based API)
// ═══════════════════════════════════════════════════════════════════════

interface BreadcrumbsDeclarativeProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  children: React.ReactNode;
  "aria-label"?: string;
  jsonLd?: boolean;
  jsonLdItems?: BreadcrumbItemData[];
}

const BreadcrumbsDeclarative = forwardRef<
  HTMLElement,
  BreadcrumbsDeclarativeProps
>(
  (
    {
      children,
      "aria-label": ariaLabel = "Breadcrumb",
      jsonLd = true,
      jsonLdItems,
      className,
      ...rest
    },
    ref,
  ) => {
    const jsonLdData = useMemo(
      () =>
        jsonLd && jsonLdItems ? generateJsonLd(jsonLdItems) : null,
      [jsonLd, jsonLdItems],
    );

    return (
      <>
        {jsonLdData && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(jsonLdData),
            }}
            data-testid="breadcrumbs-jsonld"
          />
        )}
        <nav
          ref={ref}
          aria-label={ariaLabel}
          className={cn(className)}
          {...rest}
        >
          <ol
            className={cn(
              "flex items-center flex-wrap list-none m-0 p-0",
              "text-sm gap-1",
            )}
          >
            {children}
          </ol>
        </nav>
      </>
    );
  },
);

BreadcrumbsDeclarative.displayName = "BreadcrumbsDeclarative";

// ═══════════════════════════════════════════════════════════════════════
// Compound assignment
// ═══════════════════════════════════════════════════════════════════════

const BreadcrumbsCompound = Object.assign(Breadcrumbs, {
  Link: BreadcrumbLink,
  Current: BreadcrumbCurrent,
  Separator: BreadcrumbSeparatorManual,
  Declarative: BreadcrumbsDeclarative,
});

// ═══════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════

export {
  BreadcrumbsCompound as Breadcrumbs,
  BreadcrumbsDeclarative,
  BreadcrumbLink,
  BreadcrumbCurrent,
  BreadcrumbSeparatorManual,
  breadcrumbsVariants,
  breadcrumbLinkVariants,
  breadcrumbSeparatorVariants,
  breadcrumbCollapsedVariants,
  SEPARATOR_PRESETS,
};

export type {
  BreadcrumbItemData,
  BreadcrumbsProps,
  BreadcrumbsDeclarativeProps,
  BreadcrumbLinkProps,
  BreadcrumbCurrentProps,
  BreadcrumbSeparatorManualProps,
  BreadcrumbSize,
  BreadcrumbVariant,
  SeparatorPreset,
};

export default BreadcrumbsCompound;
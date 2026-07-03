"use client";

import React, { useCallback, useMemo } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/cn";

// ─── Variant Definitions ────────────────────────────────────────────

const paginationVariants = cva(
  ["flex items-center gap-1", "select-none"],
  {
    variants: {
      size: {
        sm: "gap-0.5",
        md: "gap-1",
        lg: "gap-1.5",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const pageButtonVariants = cva(
  [
    "inline-flex items-center justify-center",
    "font-medium whitespace-nowrap",
    "rounded-sm",
    "transition-all duration-200",
    "ring-offset-surface",
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-border-focus focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed",
  ],
  {
    variants: {
      variant: {
        default: [
          "text-text-secondary",
          "hover:bg-surface-secondary hover:text-text-primary",
          "active:bg-surface-tertiary active:scale-95",
        ],
        active: [
          "bg-brand-500 text-text-inverse",
          "hover:bg-brand-600",
          "shadow-elevation-1",
        ],
        icon: [
          "text-text-tertiary",
          "hover:bg-surface-secondary hover:text-text-primary",
          "active:bg-surface-tertiary active:scale-95",
        ],
      },
      size: {
        sm: "h-7 min-w-[1.75rem] px-1.5 text-xs",
        md: "h-8 min-w-[2rem] px-2 text-sm",
        lg: "h-10 min-w-[2.5rem] px-3 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

const ellipsisVariants = cva(
  [
    "inline-flex items-center justify-center",
    "text-text-tertiary select-none pointer-events-none",
  ],
  {
    variants: {
      size: {
        sm: "h-7 w-7 text-xs",
        md: "h-8 w-8 text-sm",
        lg: "h-10 w-10 text-base",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const iconSizeMap: Record<
  NonNullable<VariantProps<typeof pageButtonVariants>["size"]>,
  string
> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
};

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Generates the array of page numbers and ellipsis markers
 * for rendering the pagination controls.
 *
 * Logic:
 * - If total <= 7, show all pages.
 * - Otherwise, always show the first and last page.
 * - Show siblings around the current page.
 * - Insert "ellipsis" markers for gaps > 1.
 */
function generatePageNumbers(
  currentPage: number,
  totalPages: number,
  siblingCount: number,
): (number | "ellipsis-start" | "ellipsis-end")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i);
  }

  const leftSibling = Math.max(1, currentPage - siblingCount);
  const rightSibling = Math.min(totalPages - 2, currentPage + siblingCount);

  const pages: (number | "ellipsis-start" | "ellipsis-end")[] = [];

  // Always first page
  pages.push(0);

  // Ellipsis after first page?
  if (leftSibling > 1) {
    pages.push("ellipsis-start");
  }

  // Middle pages
  for (let i = leftSibling; i <= rightSibling; i++) {
    pages.push(i);
  }

  // Ellipsis before last page?
  if (rightSibling < totalPages - 2) {
    pages.push("ellipsis-end");
  }

  // Always last page
  pages.push(totalPages - 1);

  return pages;
}

// ─── Types ──────────────────────────────────────────────────────────

export interface PaginationProps {
  /**
   * Current page index (0-based).
   * Must be between 0 and `total - 1`.
   */
  page: number;
  /**
   * Total number of pages.
   * Must be >= 0. When 0 or 1, pagination hides itself.
   */
  total: number;
  /**
   * Called when the user requests a page change.
   * Receives the new 0-based page index.
   */
  onPageChange: (page: number) => void;
  /**
   * Number of sibling pages to show on each side of the current page.
   * @default 1
   */
  siblingCount?: number;
  /**
   * Whether to show the "first page" and "last page" edge buttons.
   * @default true
   */
  showEdges?: boolean;
  /**
   * Size preset for buttons and spacing.
   * @default "md"
   */
  size?: VariantProps<typeof pageButtonVariants>["size"];
  /**
   * Disable all pagination interactions.
   * @default false
   */
  disabled?: boolean;
  /**
   * Additional className for the root nav element.
   */
  className?: string;
  /**
   * Accessible label for the navigation element.
   * @default "Paginare"
   */
  "aria-label"?: string;
  /**
   * Custom function to generate aria-label for page buttons.
   * Receives the 0-based page index and whether it's the active page.
   */
  getPageAriaLabel?: (page: number, isActive: boolean) => string;
}

// ─── Component ──────────────────────────────────────────────────────

const Pagination = React.forwardRef<HTMLElement, PaginationProps>(
  (
    {
      page,
      total,
      onPageChange,
      siblingCount = 1,
      showEdges = true,
      size = "md",
      disabled = false,
      className,
      "aria-label": ariaLabel = "Paginare",
      getPageAriaLabel,
    },
    ref,
  ) => {
    // ── Guard: hide if nothing to paginate ──────────────────────
    if (total <= 1) return null;

    const currentPage = Math.max(0, Math.min(page, total - 1));
    const canPrev = currentPage > 0;
    const canNext = currentPage < total - 1;

    // ── Page numbers ────────────────────────────────────────────
    const pageNumbers = useMemo(
      () => generatePageNumbers(currentPage, total, siblingCount),
      [currentPage, total, siblingCount],
    );

    // ── Handlers ────────────────────────────────────────────────
    const handlePageChange = useCallback(
      (newPage: number, e: React.MouseEvent<HTMLButtonElement>) => {
        e.currentTarget.blur(); // Remove focus ring after click
        if (newPage === currentPage || disabled) return;
        onPageChange(newPage);
      },
      [currentPage, disabled, onPageChange],
    );

    const defaultGetPageAriaLabel = useCallback(
      (pageIndex: number, isActive: boolean) =>
        isActive
          ? `Pagina ${pageIndex + 1}, pagină curentă`
          : `Pagina ${pageIndex + 1}`,
      [],
    );

    const resolvePageAriaLabel = getPageAriaLabel ?? defaultGetPageAriaLabel;

    const iconClass = iconSizeMap[size ?? "md"];

    // ── Render ──────────────────────────────────────────────────
    return (
      <nav
        ref={ref}
        role="navigation"
        aria-label={ariaLabel}
        className={cn(paginationVariants({ size }), className)}
      >
        {/* First page */}
        {showEdges && (
          <button
            type="button"
            onClick={(e) => handlePageChange(0, e)}
            disabled={disabled || !canPrev}
            className={pageButtonVariants({ variant: "icon", size })}
            aria-label="Prima pagină"
          >
            <ChevronsLeft className={iconClass} aria-hidden="true" />
          </button>
        )}

        {/* Previous page */}
        <button
          type="button"
          onClick={(e) => handlePageChange(currentPage - 1, e)}
          disabled={disabled || !canPrev}
          className={pageButtonVariants({ variant: "icon", size })}
          aria-label="Pagina anterioară"
        >
          <ChevronLeft className={iconClass} aria-hidden="true" />
        </button>

        {/* Page numbers */}
        {pageNumbers.map((pageNum, idx) => {
          if (typeof pageNum === "string") {
            // Ellipsis
            return (
              <span
                key={`${pageNum}-${idx}`}
                className={ellipsisVariants({ size })}
                aria-hidden="true"
              >
                …
              </span>
            );
          }

          const isActive = pageNum === currentPage;
          return (
            <button
              key={pageNum}
              type="button"
              onClick={(e) => handlePageChange(pageNum, e)}
              disabled={disabled}
              className={pageButtonVariants({
                variant: isActive ? "active" : "default",
                size,
              })}
              aria-label={resolvePageAriaLabel(pageNum, isActive)}
              aria-current={isActive ? "page" : undefined}
            >
              {pageNum + 1}
            </button>
          );
        })}

        {/* Next page */}
        <button
          type="button"
          onClick={(e) => handlePageChange(currentPage + 1, e)}
          disabled={disabled || !canNext}
          className={pageButtonVariants({ variant: "icon", size })}
          aria-label="Pagina următoare"
        >
          <ChevronRight className={iconClass} aria-hidden="true" />
        </button>

        {/* Last page */}
        {showEdges && (
          <button
            type="button"
            onClick={(e) => handlePageChange(total - 1, e)}
            disabled={disabled || !canNext}
            className={pageButtonVariants({ variant: "icon", size })}
            aria-label="Ultima pagină"
          >
            <ChevronsRight className={iconClass} aria-hidden="true" />
          </button>
        )}
      </nav>
    );
  },
);

Pagination.displayName = "Pagination";

// ─── Exports ────────────────────────────────────────────────────────

export {
  Pagination,
  paginationVariants,
  pageButtonVariants,
  ellipsisVariants,
  generatePageNumbers,
};

export default Pagination;
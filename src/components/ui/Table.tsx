"use client";

import React, {
  useCallback,
  useId,
  useMemo,
  useState,
} from "react";
import { cva } from "class-variance-authority";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type PaginationState,
  type ExpandedState,
  type RowSelectionState,
  type ColumnFiltersState,
  type VisibilityState,
  type Table as TanStackTable,
  type Row,
} from "@tanstack/react-table";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronRight as ExpandIcon,
  Check,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/cn";

// ─── Variant Definitions ────────────────────────────────────────────

const tableWrapperVariants = cva(
  [
    "w-full overflow-hidden",
    "border border-border rounded-md",
    "bg-surface",
    "shadow-elevation-1",
  ],
  {
    variants: {
      size: {
        sm: "text-xs",
        md: "text-sm",
        lg: "text-base",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const tableContainerVariants = cva(
  ["w-full overflow-x-auto", "scrollbar-thin"],
  {
    variants: {
      stickyHeader: {
        true: "max-h-[calc(100vh-12rem)] overflow-y-auto",
        false: "",
      },
    },
    defaultVariants: {
      stickyHeader: true,
    },
  },
);

const tableVariants = cva(["w-full border-collapse"], {
  variants: {
    size: {
      sm: "",
      md: "",
      lg: "",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

// ─── Sub-component: TableHeader ─────────────────────────────────────

const theadVariants = cva(
  [
    "sticky top-0 z-sticky",
    "bg-surface-secondary",
    "border-b border-border",
  ],
  {
    variants: {
      stickyHeader: {
        true: "shadow-elevation-1",
        false: "",
      },
    },
    defaultVariants: {
      stickyHeader: true,
    },
  },
);

const thVariants = cva(
  [
    "px-4 py-3 text-left font-semibold",
    "text-text-secondary whitespace-nowrap",
    "select-none",
    "transition-colors duration-150",
    "group",
  ],
  {
    variants: {
      sortable: {
        true: "cursor-pointer hover:bg-surface-tertiary hover:text-text-primary",
        false: "",
      },
      size: {
        sm: "px-2 py-1.5 text-xs",
        md: "px-4 py-3 text-sm",
        lg: "px-5 py-3.5 text-base",
      },
      align: {
        left: "text-left",
        center: "text-center",
        right: "text-right",
      },
    },
    defaultVariants: {
      sortable: false,
      size: "md",
      align: "left",
    },
  },
);

// ─── Sub-component: TableBody ───────────────────────────────────────

const tdVariants = cva(
  [
    "px-4 py-3",
    "text-text-primary",
    "border-b border-border-subtle",
    "whitespace-nowrap",
    "transition-colors duration-100",
  ],
  {
    variants: {
      size: {
        sm: "px-2 py-1.5 text-xs",
        md: "px-4 py-3 text-sm",
        lg: "px-5 py-4 text-base",
      },
      align: {
        left: "text-left",
        center: "text-center",
        right: "text-right",
      },
      isSelected: {
        true: "bg-brand-50",
        false: "",
      },
      isClickable: {
        true: "cursor-pointer",
        false: "",
      },
    },
    defaultVariants: {
      size: "md",
      align: "left",
      isSelected: false,
    },
  },
);

const trVariants = cva(
  [
    "transition-colors duration-100",
    "border-b border-border-subtle",
  ],
  {
    variants: {
      isClickable: {
        true: "cursor-pointer",
        false: "",
      },
      hoverable: {
        true: "hover:bg-surface-secondary",
        false: "",
      },
      isSelected: {
        true: "bg-brand-50 hover:bg-brand-100",
        false: "",
      },
      isExpanded: {
        true: "bg-surface-secondary",
        false: "",
      },
    },
    defaultVariants: {
      hoverable: true,
    },
  },
);

// ─── Sub-component: Empty State ─────────────────────────────────────

const emptyStateVariants = cva(
  [
    "flex flex-col items-center justify-center",
    "py-16 px-4",
    "text-text-tertiary",
    "text-center",
  ],
  {
    variants: {
      size: {
        sm: "py-8 px-2 text-xs",
        md: "py-16 px-4 text-sm",
        lg: "py-20 px-6 text-base",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

// ─── Sub-component: Pagination ──────────────────────────────────────

const paginationButtonVariants = cva(
  [
    "inline-flex items-center justify-center",
    "rounded-sm",
    "transition-all duration-150",
    "font-medium",
    "disabled:pointer-events-none disabled:opacity-40",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1",
  ],
  {
    variants: {
      variant: {
        default: [
          "text-text-secondary",
          "hover:bg-surface-secondary hover:text-text-primary",
          "active:bg-surface-tertiary",
        ],
        active: [
          "bg-brand-500 text-text-inverse",
          "hover:bg-brand-600",
          "shadow-elevation-1",
        ],
        icon: [
          "text-text-tertiary",
          "hover:bg-surface-secondary hover:text-text-primary",
          "active:bg-surface-tertiary",
        ],
      },
      size: {
        sm: "h-7 w-7 text-xs",
        md: "h-8 w-8 text-sm",
        lg: "h-9 w-9 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

// ─── Types ──────────────────────────────────────────────────────────

export type TableSize = "sm" | "md" | "lg";

export interface TablePaginationConfig {
  /** Current page index (0-based) */
  pageIndex: number;
  /** Number of rows per page */
  pageSize: number;
  /** Total number of rows (for server-side pagination) */
  totalRows?: number;
}

export interface TableSortingConfig {
  /** Column ID to sort by */
  id: string;
  /** Sort direction */
  desc: boolean;
}

export interface TableMeta<TData> {
  /** Called when a row is clicked */
  onRowClick?: (row: Row<TData>) => void;
  /** Called when selection changes */
  onSelectionChange?: (selectedRows: Row<TData>[]) => void;
  /** Called when expansion changes */
  onExpansionChange?: (row: Row<TData>, isExpanded: boolean) => void;
  /** Called when sorting changes */
  onSortingChange?: (sorting: SortingState) => void;
  /** Called when pagination changes */
  onPaginationChange?: (pagination: PaginationState) => void;
}

export interface TableProps<TData, TValue = unknown> {
  // ── Data ──────────────────────────────────────────────────────
  /** Column definitions */
  columns: ColumnDef<TData, TValue>[];
  /** Row data array */
  data: TData[];
  /** Unique row identifier accessor */
  rowId?: string;

  // ── Configuration ─────────────────────────────────────────────
  /** Table size preset */
  size?: TableSize;
  /** Enable row selection with checkboxes */
  enableSelection?: boolean;
  /** Enable expandable rows */
  enableExpand?: boolean;
  /** Render function for expanded row content */
  expandedContent?: (row: Row<TData>) => React.ReactNode;
  /** Enable sortable columns */
  enableSorting?: boolean;
  /** Enable pagination */
  enablePagination?: boolean;
  /** Enable row hover effect */
  enableHover?: boolean;
  /** Enable sticky header */
  stickyHeader?: boolean;
  /** Make table full width of container */
  fullWidth?: boolean;

  // ── Controlled State (optional) ───────────────────────────────
  /** Controlled sorting state */
  sorting?: SortingState;
  /** Controlled pagination state */
  pagination?: PaginationState;
  /** Controlled row selection state */
  rowSelection?: RowSelectionState;
  /** Controlled expanded state */
  expanded?: ExpandedState;
  /** Controlled column filters */
  columnFilters?: ColumnFiltersState;
  /** Controlled column visibility */
  columnVisibility?: VisibilityState;

  // ── Callbacks ─────────────────────────────────────────────────
  /** Called when sorting changes */
  onSortingChange?: (sorting: SortingState) => void;
  /** Called when pagination changes */
  onPaginationChange?: (pagination: PaginationState) => void;
  /** Called when row selection changes */
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  /** Called when expanded state changes */
  onExpandedChange?: (expanded: ExpandedState) => void;
  /** Called when a row is clicked */
  onRowClick?: (row: Row<TData>) => void;

  // ── Pagination config ─────────────────────────────────────────
  /** Page size options */
  pageSizeOptions?: number[];
  /** Total controlled row count (server-side) */
  manualPagination?: boolean;
  /** Server-side row count */
  rowCount?: number;
  /** Show pagination info text */
  showPaginationInfo?: boolean;
  /** Show page size selector */
  showPageSizeSelector?: boolean;

  // ── Customization ─────────────────────────────────────────────
  /** Custom empty state message */
  emptyMessage?: string;
  /** Custom loading state */
  loading?: boolean;
  /** Loading skeleton row count */
  loadingRowCount?: number;
  /** Additional className for wrapper */
  className?: string;
  /** Additional className for table */
  tableClassName?: string;
  /** Meta object for additional callbacks */
  meta?: TableMeta<TData>;
}

// ─── Hook: useTable ─────────────────────────────────────────────────

export function useTable<TData, TValue = unknown>(
  options: Omit<
    Parameters<typeof useReactTable<TData>>[0],
    "getCoreRowModel" | "columns" | "data"
  > & {
    columns: ColumnDef<TData, TValue>[];
    data: TData[];
  },
) {
  return useReactTable<TData>({
    ...options,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });
}

// ─── Components ─────────────────────────────────────────────────────

/**
 * Sort indicator icon for column headers.
 */
function SortIndicator({
  isSorted,
  canSort,
}: {
  isSorted: false | "asc" | "desc";
  canSort: boolean;
}) {
  if (!canSort) return null;

  if (isSorted === "asc") {
    return (
      <ChevronUp
        className="ml-1.5 inline-block h-3.5 w-3.5 text-brand-500 shrink-0"
        aria-hidden="true"
      />
    );
  }
  if (isSorted === "desc") {
    return (
      <ChevronDown
        className="ml-1.5 inline-block h-3.5 w-3.5 text-brand-500 shrink-0"
        aria-hidden="true"
      />
    );
  }
  return (
    <ChevronsUpDown
      className="ml-1.5 inline-block h-3.5 w-3.5 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      aria-hidden="true"
    />
  );
}

/**
 * Checkbox component for row selection.
 */
function SelectionCheckbox({
  checked,
  indeterminate,
  onChange,
  ariaLabel,
  disabled,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <span className="inline-flex items-center justify-center">
      <button
        type="button"
        role="checkbox"
        aria-checked={indeterminate ? "mixed" : checked}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onChange(!checked);
        }}
        className={cn(
          "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-all duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1",
          checked || indeterminate
            ? "border-brand-500 bg-brand-500 text-text-inverse"
            : "border-border bg-surface hover:border-border-strong",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        {indeterminate ? (
          <Minus className="h-3 w-3" aria-hidden="true" />
        ) : checked ? (
          <Check className="h-3 w-3" aria-hidden="true" />
        ) : null}
      </button>
    </span>
  );
}

/**
 * Expand button for expandable rows.
 */
function ExpandButton({
  isExpanded,
  onClick,
  ariaLabel,
}: {
  isExpanded: boolean;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "inline-flex items-center justify-center h-6 w-6 rounded-sm",
        "text-text-tertiary hover:text-text-primary",
        "hover:bg-surface-secondary active:bg-surface-tertiary",
        "transition-all duration-150",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
      )}
      aria-label={ariaLabel}
      aria-expanded={isExpanded}
    >
      <ExpandIcon
        className={cn(
          "h-4 w-4 transition-transform duration-200",
          isExpanded && "rotate-90",
        )}
        aria-hidden="true"
      />
    </button>
  );
}

// ─── Skeleton Loading ───────────────────────────────────────────────

function SkeletonRow({
  colCount,
  hasSelection,
  hasExpand,
  size = "md",
}: {
  colCount: number;
  hasSelection: boolean;
  hasExpand: boolean;
  size?: TableSize;
}) {
  const extraCols = (hasSelection ? 1 : 0) + (hasExpand ? 1 : 0);
  const totalCols = colCount + extraCols;

  return (
    <tr className="animate-pulse border-b border-border-subtle">
      {Array.from({ length: totalCols }).map((_, i) => (
        <td
          key={i}
          className={tdVariants({ size })}
        >
          <span className="block h-4 w-3/4 rounded-sm bg-neutral-200 dark:bg-neutral-700" />
        </td>
      ))}
    </tr>
  );
}

// ─── Empty State ────────────────────────────────────────────────────

function EmptyState({
  colSpan,
  message,
  size = "md",
}: {
  colSpan: number;
  message: string;
  size?: TableSize;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <div className={emptyStateVariants({ size })} role="status">
          <svg
            className="mb-3 h-10 w-10 text-text-tertiary/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <p className="font-medium text-text-tertiary">{message}</p>
        </div>
      </td>
    </tr>
  );
}

// ─── Pagination ─────────────────────────────────────────────────────

interface PaginationProps {
  table: TanStackTable<unknown>;
  size?: TableSize;
  showInfo?: boolean;
  showPageSizeSelector?: boolean;
  pageSizeOptions?: number[];
  manualPagination?: boolean;
  rowCount?: number;
}

function TablePagination({
  table,
  size = "md",
  showInfo = true,
  showPageSizeSelector = true,
  pageSizeOptions = [10, 20, 30, 50, 100],
  manualPagination = false,
  rowCount,
}: PaginationProps) {
  const pageSizeId = useId();
  const totalRows = manualPagination
    ? (rowCount ?? table.getFilteredRowModel().rows.length)
    : table.getFilteredRowModel().rows.length;
  const currentPage = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const pageCount = table.getPageCount();
  const from = currentPage * pageSize + 1;
  const to = Math.min((currentPage + 1) * pageSize, totalRows);

  const canPrev = table.getCanPreviousPage();
  const canNext = table.getCanNextPage();

  // Generate page numbers to display
  const pageNumbers = useMemo(() => {
    const pages: (number | "ellipsis")[] = [];
    const totalPages = pageCount;

    if (totalPages <= 7) {
      for (let i = 0; i < totalPages; i++) pages.push(i);
    } else {
      pages.push(0);
      if (currentPage > 3) pages.push("ellipsis");

      const start = Math.max(1, currentPage - 1);
      const end = Math.min(totalPages - 2, currentPage + 1);

      for (let i = start; i <= end; i++) pages.push(i);

      if (currentPage < totalPages - 4) pages.push("ellipsis");
      pages.push(totalPages - 1);
    }
    return pages;
  }, [pageCount, currentPage]);

  if (pageCount <= 1 && !showPageSizeSelector) return null;

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-4",
        "border-t border-border px-4 py-3",
        "bg-surface-secondary/50",
      )}
    >
      {/* Info text */}
      {showInfo && (
        <div className="text-xs text-text-tertiary whitespace-nowrap">
          {totalRows > 0
            ? `${from}–${to} din ${totalRows}`
            : "Niciun rezultat"}
        </div>
      )}

      {/* Page controls */}
      <div className="flex items-center gap-1">
        {/* First page */}
        <button
          type="button"
          onClick={() => table.setPageIndex(0)}
          disabled={!canPrev}
          className={paginationButtonVariants({ variant: "icon", size })}
          aria-label="Prima pagină"
        >
          <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Previous page */}
        <button
          type="button"
          onClick={() => table.previousPage()}
          disabled={!canPrev}
          className={paginationButtonVariants({ variant: "icon", size })}
          aria-label="Pagina anterioară"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Page numbers */}
        <div className="flex items-center gap-0.5 mx-1">
          {pageNumbers.map((page, idx) => {
            if (page === "ellipsis") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className={cn(
                    "inline-flex items-center justify-center",
                    size === "sm" ? "h-7 w-7 text-xs" : size === "lg" ? "h-9 w-9 text-base" : "h-8 w-8 text-sm",
                    "text-text-tertiary select-none",
                  )}
                  aria-hidden="true"
                >
                  …
                </span>
              );
            }
            const isActive = page === currentPage;
            return (
              <button
                key={page}
                type="button"
                onClick={() => table.setPageIndex(page)}
                className={paginationButtonVariants({
                  variant: isActive ? "active" : "default",
                  size,
                })}
                aria-label={`Pagina ${page + 1}`}
                aria-current={isActive ? "page" : undefined}
              >
                {page + 1}
              </button>
            );
          })}
        </div>

        {/* Next page */}
        <button
          type="button"
          onClick={() => table.nextPage()}
          disabled={!canNext}
          className={paginationButtonVariants({ variant: "icon", size })}
          aria-label="Pagina următoare"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Last page */}
        <button
          type="button"
          onClick={() => table.setPageIndex(pageCount - 1)}
          disabled={!canNext}
          className={paginationButtonVariants({ variant: "icon", size })}
          aria-label="Ultima pagină"
        >
          <ChevronsRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Page size selector */}
      {showPageSizeSelector && (
        <div className="flex items-center gap-2">
          <label
            htmlFor={pageSizeId}
            className="text-xs text-text-tertiary whitespace-nowrap"
          >
            Rânduri:
          </label>
          <select
            id={pageSizeId}
            value={pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className={cn(
              "rounded-sm border border-border bg-surface",
              "text-xs text-text-primary",
              "px-2 py-1",
              "focus:outline-none focus:ring-2 focus:ring-border-focus focus:border-brand-500",
              "cursor-pointer",
            )}
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

// ─── Main Table Component ───────────────────────────────────────────

const TableComponent = <TData, TValue = unknown>(
  props: TableProps<TData, TValue>,
) => {
  const {
    columns,
    data,
    rowId,
    size = "md",
    enableSelection = false,
    enableExpand = false,
    expandedContent,
    enableSorting = true,
    enablePagination = true,
    enableHover = true,
    stickyHeader = true,
    fullWidth = true,
    sorting: controlledSorting,
    pagination: controlledPagination,
    rowSelection: controlledRowSelection,
    expanded: controlledExpanded,
    columnFilters: controlledColumnFilters,
    columnVisibility: controlledColumnVisibility,
    onSortingChange,
    onPaginationChange,
    onRowSelectionChange,
    onExpandedChange,
    onRowClick,
    pageSizeOptions,
    manualPagination = false,
    rowCount,
    showPaginationInfo = true,
    showPageSizeSelector = true,
    emptyMessage = "Nicio înregistrare găsită.",
    loading = false,
    loadingRowCount = 5,
    className,
    tableClassName,
  } = props;

  // ── Internal state ────────────────────────────────────────────
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [internalPagination, setInternalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: pageSizeOptions?.[0] ?? 10,
  });
  const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({});
  const [internalExpanded, setInternalExpanded] = useState<ExpandedState>({});
  const [internalColumnFilters, setInternalColumnFilters] = useState<ColumnFiltersState>([]);
  const [internalColumnVisibility, setInternalColumnVisibility] = useState<VisibilityState>({});

  // ── Controlled vs uncontrolled ────────────────────────────────
  const sorting = controlledSorting ?? internalSorting;
  const pagination = controlledPagination ?? internalPagination;
  const rowSelection = controlledRowSelection ?? internalRowSelection;
  const expanded = controlledExpanded ?? internalExpanded;
  const columnFilters = controlledColumnFilters ?? internalColumnFilters;
  const columnVisibility = controlledColumnVisibility ?? internalColumnVisibility;

  const handleSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const newVal = typeof updater === "function" ? updater(sorting) : updater;
      if (!controlledSorting) setInternalSorting(newVal);
      onSortingChange?.(newVal);
    },
    [controlledSorting, sorting, onSortingChange],
  );

  const handlePaginationChange = useCallback(
    (updater: PaginationState | ((old: PaginationState) => PaginationState)) => {
      const newVal = typeof updater === "function" ? updater(pagination) : updater;
      if (!controlledPagination) setInternalPagination(newVal);
      onPaginationChange?.(newVal);
    },
    [controlledPagination, pagination, onPaginationChange],
  );

  const handleRowSelectionChange = useCallback(
    (updater: RowSelectionState | ((old: RowSelectionState) => RowSelectionState)) => {
      const newVal = typeof updater === "function" ? updater(rowSelection) : updater;
      if (!controlledRowSelection) setInternalRowSelection(newVal);
      onRowSelectionChange?.(newVal);
    },
    [controlledRowSelection, rowSelection, onRowSelectionChange],
  );

  const handleExpandedChange = useCallback(
    (updater: ExpandedState | ((old: ExpandedState) => ExpandedState)) => {
      const newVal = typeof updater === "function" ? updater(expanded) : updater;
      if (!controlledExpanded) setInternalExpanded(newVal);
      onExpandedChange?.(newVal);
    },
    [controlledExpanded, expanded, onExpandedChange],
  );

  // ── Build table ───────────────────────────────────────────────
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      pagination,
      rowSelection,
      expanded,
      columnFilters,
      columnVisibility,
    },
    onSortingChange: handleSortingChange,
    onPaginationChange: handlePaginationChange,
    onRowSelectionChange: handleRowSelectionChange,
    onExpandedChange: handleExpandedChange,
    onColumnFiltersChange: controlledColumnFilters
      ? undefined
      : setInternalColumnFilters,
    onColumnVisibilityChange: controlledColumnVisibility
      ? undefined
      : setInternalColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    getExpandedRowModel: enableExpand ? getExpandedRowModel() : undefined,
    getFilteredRowModel: getFilteredRowModel(),
    manualPagination,
    manualSorting: manualPagination,
    enableSorting,
    enableRowSelection: enableSelection,
    enableExpanding: enableExpand,
    getRowId: rowId
      ? (originalRow: TData, index: number) => {
          const id = (originalRow as Record<string, unknown>)[rowId];
          return id !== undefined ? String(id) : String(index);
        }
      : undefined,
    pageCount: manualPagination && rowCount
      ? Math.ceil(rowCount / pagination.pageSize)
      : undefined,
  });

  // ── Column count for spans ────────────────────────────────────
  const visibleCols = table.getAllColumns().length;
  const extraCols = (enableSelection ? 1 : 0) + (enableExpand ? 1 : 0);
  const totalColSpan = visibleCols + extraCols;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div
      className={cn(
        tableWrapperVariants({ size, fullWidth }),
        className,
      )}
      role="region"
      aria-label="Tabel de date"
    >
      {/* Scrollable container for sticky header + responsive */}
      <div className={tableContainerVariants({ stickyHeader })}>
        <table
          className={cn(tableVariants({ size }), tableClassName)}
          role="table"
        >
          {/* ── Header ──────────────────────────────────────────── */}
          <thead className={theadVariants({ stickyHeader })}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} role="row">
                {/* Selection column header */}
                {enableSelection && (
                  <th
                    className={cn(thVariants({ size, align: "center" }), "w-10")}
                    role="columnheader"
                    aria-label="Selectează toate"
                  >
                    <SelectionCheckbox
                      checked={table.getIsAllRowsSelected()}
                      indeterminate={table.getIsSomeRowsSelected()}
                      onChange={(checked) => {
                        if (checked) {
                          table.toggleAllRowsSelected(true);
                        } else {
                          table.toggleAllRowsSelected(false);
                        }
                      }}
                      ariaLabel={
                        table.getIsAllRowsSelected()
                          ? "Deselectează toate"
                          : "Selectează toate"
                      }
                    />
                  </th>
                )}

                {/* Expand column header */}
                {enableExpand && (
                  <th
                    className={cn(thVariants({ size, align: "center" }), "w-10")}
                    role="columnheader"
                    aria-label="Expandare"
                  >
                    <span className="sr-only">Expandare</span>
                  </th>
                )}

                {/* Data column headers */}
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const isSorted = header.column.getIsSorted();
                  const columnMeta = header.column.columnDef.meta as
                    | { align?: "left" | "center" | "right" }
                    | undefined;
                  const align = columnMeta?.align ?? "left";

                  return (
                    <th
                      key={header.id}
                      className={cn(
                        thVariants({ size, sortable: canSort, align }),
                      )}
                      style={{
                        width: header.getSize() !== 150 ? header.getSize() : undefined,
                      }}
                      role="columnheader"
                      aria-sort={
                        isSorted === "asc"
                          ? "ascending"
                          : isSorted === "desc"
                            ? "descending"
                            : undefined
                      }
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      onKeyDown={
                        canSort
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                header.column.getToggleSortingHandler()?.(e as unknown as React.MouseEvent);
                              }
                            }
                          : undefined
                      }
                      tabIndex={canSort ? 0 : undefined}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        <SortIndicator
                          isSorted={isSorted}
                          canSort={canSort}
                        />
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          {/* ── Body ────────────────────────────────────────────── */}
          <tbody>
            {loading ? (
              // Loading skeleton
              Array.from({ length: loadingRowCount }).map((_, i) => (
                <SkeletonRow
                  key={`skeleton-${i}`}
                  colCount={visibleCols}
                  hasSelection={enableSelection}
                  hasExpand={enableExpand}
                  size={size}
                />
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              // Empty state
              <EmptyState
                colSpan={totalColSpan}
                message={emptyMessage}
                size={size}
              />
            ) : (
              // Data rows
              table.getRowModel().rows.map((row) => {
                const isSelected = row.getIsSelected();
                const isExpanded = row.getIsExpanded();

                return (
                  <React.Fragment key={row.id}>
                    {/* Main data row */}
                    <tr
                      className={cn(
                        trVariants({
                          isClickable: !!onRowClick,
                          hoverable: enableHover,
                          isSelected,
                          isExpanded,
                        }),
                      )}
                      role="row"
                      aria-selected={enableSelection ? isSelected : undefined}
                      aria-expanded={enableExpand ? isExpanded : undefined}
                      onClick={
                        onRowClick
                          ? () => onRowClick(row)
                          : undefined
                      }
                      data-state={isSelected ? "selected" : undefined}
                    >
                      {/* Selection checkbox */}
                      {enableSelection && (
                        <td
                          className={cn(
                            tdVariants({ size, align: "center", isSelected }),
                            "w-10",
                          )}
                          role="cell"
                        >
                          <SelectionCheckbox
                            checked={isSelected}
                            onChange={(checked) => {
                              row.toggleSelected(checked);
                            }}
                            ariaLabel={`Selectează rândul ${row.id}`}
                          />
                        </td>
                      )}

                      {/* Expand button */}
                      {enableExpand && (
                        <td
                          className={cn(
                            tdVariants({ size, align: "center", isSelected }),
                            "w-10",
                          )}
                          role="cell"
                        >
                          {row.getCanExpand() && (
                            <ExpandButton
                              isExpanded={isExpanded}
                              onClick={() => row.toggleExpanded()}
                              ariaLabel={
                                isExpanded
                                  ? "Restrânge rândul"
                                  : "Extinde rândul"
                              }
                            />
                          )}
                        </td>
                      )}

                      {/* Data cells */}
                      {row.getVisibleCells().map((cell) => {
                        const columnMeta = cell.column.columnDef.meta as
                          | { align?: "left" | "center" | "right" }
                          | undefined;
                        const align = columnMeta?.align ?? "left";

                        return (
                          <td
                            key={cell.id}
                            className={cn(
                              tdVariants({ size, align, isSelected }),
                            )}
                            role="cell"
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </td>
                        );
                      })}
                    </tr>

                    {/* Expanded content row */}
                    {enableExpand && isExpanded && expandedContent && (
                      <tr
                        className="bg-surface-secondary/50"
                        role="row"
                        aria-label="Conținut extins"
                      >
                        <td
                          colSpan={totalColSpan}
                          className={cn(
                            "px-4 py-4",
                            "border-b border-border-subtle",
                            "animate-slide-in-from-top",
                          )}
                        >
                          {expandedContent(row)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────────────────────── */}
      {enablePagination && !loading && table.getPageCount() > 0 && (
        <TablePagination
          table={table as unknown as TanStackTable<unknown>}
          size={size}
          showInfo={showPaginationInfo}
          showPageSizeSelector={showPageSizeSelector}
          pageSizeOptions={pageSizeOptions}
          manualPagination={manualPagination}
          rowCount={rowCount}
        />
      )}
    </div>
  );
};

// ─── Exports ────────────────────────────────────────────────────────

// We need to cast because of the generic nature
const Table = TableComponent as <TData, TValue = unknown>(
  props: TableProps<TData, TValue>,
) => React.ReactElement;

export {
  Table,
  TableComponent,
  TablePagination,
  SelectionCheckbox,
  ExpandButton,
  SortIndicator,
  tableWrapperVariants,
  tableContainerVariants,
  tableVariants,
  theadVariants,
  thVariants,
  tdVariants,
  trVariants,
  emptyStateVariants,
  paginationButtonVariants,
};

export default Table;

"use client";

import React, {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cva } from "class-variance-authority";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getExpandedRowModel,
  flexRender,
  type ColumnDef,
  type ColumnOrderState,
  type SortingState,
  type PaginationState,
  type ExpandedState,
  type RowSelectionState,
  type ColumnFiltersState,
  type VisibilityState,
  type ColumnFilter,
  type Row,
  type ColumnResizeMode,
} from "@tanstack/react-table";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
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
  Search,
  X,
  Filter,
  Download,
  Columns,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/cn";

// ─── Utility: CSV Export ────────────────────────────────────────────

function csvEscape(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (
    str.includes(",") ||
    str.includes('"') ||
    str.includes("\n") ||
    str.includes("\r")
  ) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCSV<TData>(
  data: TData[],
  columns: ColumnDef<TData>[],
  filename: string = "export.csv",
): void {
  const exportableColumns = columns.filter((col) => {
    const meta = col.meta as Record<string, unknown> | undefined;
    return meta?.exportable !== false;
  });

  const headers = exportableColumns.map((col) => {
    const header = col.header;
    if (typeof header === "string") return header;
    if (typeof header === "function") {
      return (col as { id?: string }).id ?? (col as { accessorKey?: string }).accessorKey ?? "";
    }
    return (col as { id?: string }).id ?? (col as { accessorKey?: string }).accessorKey ?? "";
  });

  const rows = data.map((row) =>
    exportableColumns.map((col) => {
      const accessorKey = (col as { accessorKey?: string }).accessorKey;
      if (accessorKey && row && typeof row === "object") {
        const val = (row as Record<string, unknown>)[accessorKey];
        return csvEscape(val);
      }
      return "";
    }),
  );

  const csvContent = [
    headers.map(csvEscape).join(","),
    ...rows.map((r) => r.join(",")),
  ].join("\n");

  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 100);
}

// ─── Variants ───────────────────────────────────────────────────────

const gridWrapperVariants = cva(
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

const gridContainerVariants = cva(
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
    "relative px-4 py-3 text-left font-semibold",
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
      isDragging: {
        true: "opacity-50 bg-brand-50 z-raised",
        false: "",
      },
    },
    defaultVariants: {
      sortable: false,
      size: "md",
      align: "left",
      isDragging: false,
    },
  },
);

const tdVariants = cva(
  [
    "px-4 py-3",
    "text-text-primary",
    "border-b border-border-subtle",
    "whitespace-nowrap",
    "transition-colors duration-100",
    "overflow-hidden text-ellipsis",
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

const filterInputVariants = cva(
  [
    "w-full rounded-sm border",
    "bg-surface text-text-primary",
    "transition-all duration-150",
    "focus:outline-none focus:ring-2 focus:ring-border-focus focus:border-brand-500",
    "placeholder:text-text-disabled",
  ],
  {
    variants: {
      size: {
        sm: "px-1.5 py-0.5 text-xs",
        md: "px-2 py-1 text-sm",
        lg: "px-2.5 py-1.5 text-base",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const toolbarButtonVariants = cva(
  [
    "inline-flex items-center gap-1.5",
    "rounded-sm px-2.5 py-1.5",
    "text-xs font-medium",
    "transition-all duration-150",
    "border border-border",
    "bg-surface hover:bg-surface-secondary",
    "text-text-secondary hover:text-text-primary",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-1",
  ],
  {
    variants: {
      active: {
        true: "bg-brand-50 border-brand-300 text-brand-700",
        false: "",
      },
    },
    defaultVariants: {
      active: false,
    },
  },
);

// ─── Types ──────────────────────────────────────────────────────────

export type DataGridSize = "sm" | "md" | "lg";

export interface DataGridColumnMeta {
  align?: "left" | "center" | "right";
  resizable?: boolean;
  reorderable?: boolean;
  filterable?: boolean;
  filterPlaceholder?: string;
  exportable?: boolean;
  minWidth?: number;
  maxWidth?: number;
}

export interface DataGridProps<TData, TValue = unknown> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  rowId?: string;
  size?: DataGridSize;
  enableSelection?: boolean;
  enableExpand?: boolean;
  expandedContent?: (row: Row<TData>) => React.ReactNode;
  enableSorting?: boolean;
  enablePagination?: boolean;
  enableHover?: boolean;
  stickyHeader?: boolean;
  fullWidth?: boolean;
  enableColumnResize?: boolean;
  enableColumnReorder?: boolean;
  enableColumnFilters?: boolean;
  enableExport?: boolean;
  sorting?: SortingState;
  pagination?: PaginationState;
  rowSelection?: RowSelectionState;
  expanded?: ExpandedState;
  columnFilters?: ColumnFiltersState;
  columnVisibility?: VisibilityState;
  columnOrder?: ColumnOrderState;
  onSortingChange?: (sorting: SortingState) => void;
  onPaginationChange?: (pagination: PaginationState) => void;
  onRowSelectionChange?: (selection: RowSelectionState) => void;
  onExpandedChange?: (expanded: ExpandedState) => void;
  onColumnFiltersChange?: (filters: ColumnFiltersState) => void;
  onColumnOrderChange?: (order: ColumnOrderState) => void;
  onRowClick?: (row: Row<TData>) => void;
  pageSizeOptions?: number[];
  manualPagination?: boolean;
  rowCount?: number;
  showPaginationInfo?: boolean;
  showPageSizeSelector?: boolean;
  exportFilename?: string;
  onBeforeExport?: (data: TData[]) => TData[];
  emptyMessage?: string;
  loading?: boolean;
  loadingRowCount?: number;
  toolbarClassName?: string;
  className?: string;
  tableClassName?: string;
}

// ─── Sub-components ─────────────────────────────────────────────────

function SortIndicator({
  isSorted,
  canSort,
}: {
  isSorted: false | "asc" | "desc";
  canSort: boolean;
}) {
  if (!canSort) return null;
  if (isSorted === "asc") {
    return <ChevronUp className="ml-1.5 inline-block h-3.5 w-3.5 text-brand-500 shrink-0" aria-hidden="true" />;
  }
  if (isSorted === "desc") {
    return <ChevronDown className="ml-1.5 inline-block h-3.5 w-3.5 text-brand-500 shrink-0" aria-hidden="true" />;
  }
  return (
    <ChevronsUpDown
      className="ml-1.5 inline-block h-3.5 w-3.5 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      aria-hidden="true"
    />
  );
}

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

function ResizeHandle({
  isResizing,
  onMouseDown,
  onTouchStart,
}: {
  isResizing: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "absolute right-0 top-0 h-full w-1 cursor-col-resize select-none",
        "opacity-0 group-hover:opacity-100 transition-opacity",
        "hover:bg-brand-300 active:bg-brand-400",
        isResizing && "opacity-100 bg-brand-400",
      )}
      style={{ touchAction: "none" }}
    >
      <div
        className={cn(
          "absolute right-0 top-0 h-full",
          isResizing ? "w-8 -right-4" : "w-0.5",
        )}
      />
    </div>
  );
}

interface DraggableHeaderProps {
  headerId: string;
  columnId: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

function DraggableHeader({
  headerId,
  columnId,
  children,
  className,
  style,
}: DraggableHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: columnId,
    data: { type: "column", columnId },
  });

  const dragStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
    ...style,
  };

  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      className={cn(className, isDragging && "z-raised")}
    >
      <button
        type="button"
        className={cn(
          "absolute left-1 top-1/2 -translate-y-1/2",
          "opacity-0 group-hover:opacity-100 transition-opacity",
          "cursor-grab active:cursor-grabbing",
          "text-text-tertiary hover:text-text-primary",
          "p-0.5",
        )}
        {...attributes}
        {...listeners}
        aria-label={`Trage coloana ${columnId}`}
        tabIndex={-1}
      >
        <GripVertical className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {children}
    </div>
  );
}

interface ColumnFilterInputProps {
  columnId: string;
  value: string;
  placeholder?: string;
  size?: DataGridSize;
  onChange: (value: string) => void;
}

function ColumnFilterInput({
  columnId,
  value,
  placeholder,
  size = "md",
  onChange,
}: ColumnFilterInputProps) {
  const inputId = useId();

  const handleClear = useCallback(() => {
    onChange("");
  }, [onChange]);

  return (
    <div className="relative mt-1.5">
      <Search
        className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-text-tertiary pointer-events-none"
        aria-hidden="true"
      />
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Filtrează..."}
        className={cn(filterInputVariants({ size }), "pl-7 pr-6")}
        aria-label={`Filtrează coloana ${columnId}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      />
      {value && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleClear();
          }}
          className={cn(
            "absolute right-1 top-1/2 -translate-y-1/2",
            "text-text-tertiary hover:text-text-primary",
            "p-0.5 rounded-sm",
          )}
          aria-label="Șterge filtrul"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

interface ColumnVisibilityToggleProps {
  columns: { id: string; header: string; visible: boolean }[];
  onToggle: (columnId: string) => void;
  size?: DataGridSize;
}

function ColumnVisibilityToggle({
  columns,
  onToggle,
  size = "md",
}: ColumnVisibilityToggleProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={toolbarButtonVariants({ active: open })}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Vizibilitate coloane"
      >
        <Columns className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="hidden sm:inline">Coloane</span>
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 top-full mt-1 z-dropdown",
            "w-56 max-h-64 overflow-y-auto",
            "rounded-md border border-border",
            "bg-surface shadow-elevation-3",
            "p-1",
            "animate-scale-in",
          )}
          role="listbox"
          aria-label="Selectează coloane vizibile"
        >
          {columns.map((col) => (
            <label
              key={col.id}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer",
                "hover:bg-surface-secondary",
                "text-text-primary",
                size === "sm" ? "text-xs" : "text-sm",
              )}
            >
              <input
                type="checkbox"
                checked={col.visible}
                onChange={() => onToggle(col.id)}
                className="rounded-sm border-border text-brand-500 focus:ring-border-focus"
              />
              <span className="truncate">{col.header}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonRow({
  colCount,
  hasSelection,
  hasExpand,
  size = "md",
}: {
  colCount: number;
  hasSelection: boolean;
  hasExpand: boolean;
  size?: DataGridSize;
}) {
  const extraCols = (hasSelection ? 1 : 0) + (hasExpand ? 1 : 0);
  const totalCols = colCount + extraCols;

  return (
    <tr className="animate-pulse border-b border-border-subtle">
      {Array.from({ length: totalCols }).map((_, i) => (
        <td key={i} className={tdVariants({ size })}>
          <span className="block h-4 w-3/4 rounded-sm bg-neutral-200 dark:bg-neutral-700" />
        </td>
      ))}
    </tr>
  );
}

function EmptyState({
  colSpan,
  message,
  size = "md",
}: {
  colSpan: number;
  message: string;
  size?: DataGridSize;
}) {
  const sizeClasses = {
    sm: "py-8 px-2 text-xs",
    md: "py-16 px-4 text-sm",
    lg: "py-20 px-6 text-base",
  };

  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <div
          className={cn(
            "flex flex-col items-center justify-center",
            "text-text-tertiary text-center",
            sizeClasses[size],
          )}
          role="status"
        >
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

interface ToolbarProps<TData> {
  enableColumnFilters: boolean;
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  enableColumnReorder: boolean;
  enableExport: boolean;
  onExport: () => void;
  columns: { id: string; header: string; visible: boolean }[];
  onColumnVisibilityToggle: (columnId: string) => void;
  size: DataGridSize;
  selectedRowsCount: number;
  totalRowsCount: number;
  className?: string;
}

function Toolbar<TData>({
  enableColumnFilters,
  globalFilter,
  onGlobalFilterChange,
  enableColumnReorder,
  enableExport,
  onExport,
  columns,
  onColumnVisibilityToggle,
  size,
  selectedRowsCount,
  totalRowsCount,
  className,
}: ToolbarProps<TData>) {
  const searchId = useId();
  const showToolbar = enableColumnFilters || enableExport || columns.length > 1;

  if (!showToolbar) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2",
        "px-4 py-2.5",
        "border-b border-border",
        "bg-surface-secondary/30",
        className,
      )}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {enableColumnFilters && (
          <div className="relative w-full max-w-xs">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary pointer-events-none"
              aria-hidden="true"
            />
            <input
              id={searchId}
              type="text"
              value={globalFilter}
              onChange={(e) => onGlobalFilterChange(e.target.value)}
              placeholder="Caută în toate coloanele..."
              className={cn(filterInputVariants({ size }), "pl-8 pr-8")}
              aria-label="Căutare globală"
            />
            {globalFilter && (
              <button
                type="button"
                onClick={() => onGlobalFilterChange("")}
                className={cn(
                  "absolute right-1.5 top-1/2 -translate-y-1/2",
                  "text-text-tertiary hover:text-text-primary",
                  "p-0.5 rounded-sm",
                )}
                aria-label="Șterge căutarea"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {selectedRowsCount > 0 && (
          <span className="text-xs text-text-secondary whitespace-nowrap">
            {selectedRowsCount} din {totalRowsCount} selectate
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {enableColumnReorder && (
          <span className="text-xs text-text-tertiary hidden md:inline">
            Trage coloanele pentru reordonare
          </span>
        )}

        <ColumnVisibilityToggle
          columns={columns}
          onToggle={onColumnVisibilityToggle}
          size={size}
        />

        {enableExport && (
          <button
            type="button"
            onClick={onExport}
            className={toolbarButtonVariants()}
            aria-label="Exportă CSV"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Export</span>
          </button>
        )}
      </div>
    </div>
  );
}

interface PaginationProps {
  table: ReturnType<typeof useReactTable>;
  size?: DataGridSize;
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
      {showInfo && (
        <div className="text-xs text-text-tertiary whitespace-nowrap">
          {totalRows > 0
            ? `${from}–${to} din ${totalRows}`
            : "Niciun rezultat"}
        </div>
      )}

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => table.setPageIndex(0)}
          disabled={!canPrev}
          className={paginationButtonVariants({ variant: "icon", size })}
          aria-label="Prima pagină"
        >
          <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => table.previousPage()}
          disabled={!canPrev}
          className={paginationButtonVariants({ variant: "icon", size })}
          aria-label="Pagina anterioară"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>

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

        <button
          type="button"
          onClick={() => table.nextPage()}
          disabled={!canNext}
          className={paginationButtonVariants({ variant: "icon", size })}
          aria-label="Pagina următoare"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
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

// ─── Main DataGrid Component ────────────────────────────────────────

const DataGridComponent = <TData, TValue = unknown>(
  props: DataGridProps<TData, TValue>,
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
    enableColumnResize = true,
    enableColumnReorder = true,
    enableColumnFilters = true,
    enableExport = true,
    sorting: controlledSorting,
    pagination: controlledPagination,
    rowSelection: controlledRowSelection,
    expanded: controlledExpanded,
    columnFilters: controlledColumnFilters,
    columnVisibility: controlledColumnVisibility,
    columnOrder: controlledColumnOrder,
    onSortingChange,
    onPaginationChange,
    onRowSelectionChange,
    onExpandedChange,
    onColumnFiltersChange,
    onColumnOrderChange,
    onRowClick,
    pageSizeOptions,
    manualPagination = false,
    rowCount,
    showPaginationInfo = true,
    showPageSizeSelector = true,
    exportFilename = "export.csv",
    onBeforeExport,
    emptyMessage = "Nicio înregistrare găsită.",
    loading = false,
    loadingRowCount = 5,
    toolbarClassName,
    className,
    tableClassName,
  } = props;

  const [internalSorting, setInternalSorting] = useState<SortingState>([]);
  const [internalPagination, setInternalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: pageSizeOptions?.[0] ?? 10,
  });
  const [internalRowSelection, setInternalRowSelection] = useState<RowSelectionState>({});
  const [internalExpanded, setInternalExpanded] = useState<ExpandedState>({});
  const [internalColumnFilters, setInternalColumnFilters] = useState<ColumnFiltersState>([]);
  const [internalColumnVisibility, setInternalColumnVisibility] = useState<VisibilityState>({});
  const [internalColumnOrder, setInternalColumnOrder] = useState<ColumnOrderState>(
    columns.map((c) => {
      const id = (c as { id?: string }).id ?? (c as { accessorKey?: string }).accessorKey ?? "";
      return String(id);
    }),
  );
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnResizeMode] = useState<ColumnResizeMode>("onChange");

  const sorting = controlledSorting ?? internalSorting;
  const pagination = controlledPagination ?? internalPagination;
  const rowSelection = controlledRowSelection ?? internalRowSelection;
  const expanded = controlledExpanded ?? internalExpanded;
  const columnFilters = controlledColumnFilters ?? internalColumnFilters;
  const columnVisibility = controlledColumnVisibility ?? internalColumnVisibility;
  const columnOrder = controlledColumnOrder ?? internalColumnOrder;

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

  const handleColumnFiltersChange = useCallback(
    (updater: ColumnFiltersState | ((old: ColumnFiltersState) => ColumnFiltersState)) => {
      const newVal = typeof updater === "function" ? updater(columnFilters) : updater;
      if (!controlledColumnFilters) setInternalColumnFilters(newVal);
      onColumnFiltersChange?.(newVal);
    },
    [controlledColumnFilters, columnFilters, onColumnFiltersChange],
  );

  const handleColumnOrderChange = useCallback(
    (newOrder: ColumnOrderState) => {
      if (!controlledColumnOrder) setInternalColumnOrder(newOrder);
      onColumnOrderChange?.(newOrder);
    },
    [controlledColumnOrder, onColumnOrderChange],
  );

  const handleGlobalFilterChange = useCallback(
    (value: string) => {
      setGlobalFilter(value);
      const newFilters: ColumnFilter[] = columns
        .filter((col) => {
          const meta = col.meta as DataGridColumnMeta | undefined;
          return meta?.filterable !== false;
        })
        .map((col) => {
          const id = (col as { id?: string }).id ?? (col as { accessorKey?: string }).accessorKey ?? "";
          return { id: String(id), value } as ColumnFilter;
        });
      handleColumnFiltersChange(newFilters);
    },
    [columns, handleColumnFiltersChange],
  );

  const handleColumnFilterChange = useCallback(
    (columnId: string, value: string) => {
      const newFilters = columnFilters
        .filter((f) => f.id !== columnId)
        .concat(value ? [{ id: columnId, value }] : []);
      handleColumnFiltersChange(newFilters);
    },
    [columnFilters, handleColumnFiltersChange],
  );

  const handleColumnVisibilityToggle = useCallback(
    (columnId: string) => {
      const newVis = {
        ...columnVisibility,
        [columnId]: !(columnVisibility[columnId] ?? true),
      };
      if (!controlledColumnVisibility) setInternalColumnVisibility(newVis);
    },
    [columnVisibility, controlledColumnVisibility],
  );

  const columnsWithMeta = useMemo(
    () =>
      columns.map((col, idx) => {
        const meta = (col.meta as DataGridColumnMeta) ?? {};
        const colId = (col as { id?: string }).id ?? (col as { accessorKey?: string }).accessorKey ?? String(idx);
        return {
          ...col,
          id: col.id ?? String(colId),
          meta: {
            align: "left" as const,
            resizable: true,
            reorderable: true,
            filterable: true,
            exportable: true,
            minWidth: 60,
            maxWidth: 600,
            ...meta,
          },
          enableResizing: meta.resizable !== false && enableColumnResize,
          size: (col as { size?: number }).size ?? 150,
          minSize: meta.minWidth ?? 60,
          maxSize: meta.maxWidth ?? 600,
        };
      }),
    [columns, enableColumnResize],
  );

  const table = useReactTable({
    data,
    columns: columnsWithMeta,
    state: {
      sorting,
      pagination,
      rowSelection,
      expanded,
      columnFilters,
      columnVisibility,
      columnOrder,
    },
    onSortingChange: handleSortingChange,
    onPaginationChange: handlePaginationChange,
    onRowSelectionChange: handleRowSelectionChange,
    onExpandedChange: handleExpandedChange,
    onColumnFiltersChange: handleColumnFiltersChange,
    onColumnOrderChange: handleColumnOrderChange,
    onColumnVisibilityChange: controlledColumnVisibility
      ? undefined
      : setInternalColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    getExpandedRowModel: enableExpand ? getExpandedRowModel() : undefined,
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode,
    manualPagination,
    manualSorting: manualPagination,
    enableSorting,
    enableRowSelection: enableSelection,
    enableExpanding: enableExpand,
    enableColumnResizing: enableColumnResize,
    getRowId: rowId
      ? (originalRow: TData, index: number) => {
          const id = (originalRow as Record<string, unknown>)[rowId];
          return id !== undefined ? String(id) : String(index);
        }
      : undefined,
    pageCount:
      manualPagination && rowCount
        ? Math.ceil(rowCount / pagination.pageSize)
        : undefined,
  });

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const currentOrder = columnOrder;
      const oldIndex = currentOrder.indexOf(String(active.id));
      const newIndex = currentOrder.indexOf(String(over.id));

      if (oldIndex === -1 || newIndex === -1) return;

      const newOrder = [...currentOrder];
      newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, String(active.id));
      handleColumnOrderChange(newOrder);
    },
    [columnOrder, handleColumnOrderChange],
  );

  const handleExport = useCallback(() => {
    let exportData = table.getFilteredRowModel().rows.map((r) => r.original);
    if (onBeforeExport) {
      exportData = onBeforeExport(exportData);
    }
    exportToCSV(exportData, columnsWithMeta, exportFilename);
  }, [table, columnsWithMeta, exportFilename, onBeforeExport]);

  const columnVisibilityInfo = useMemo(
    () =>
      columnsWithMeta.map((col) => ({
        id: col.id ?? "",
        header:
          typeof col.header === "string"
            ? col.header
            : (col as { id?: string }).id ?? "",
        visible: columnVisibility[col.id ?? ""] !== false,
      })),
    [columnsWithMeta, columnVisibility],
  );

  const visibleCols = table.getAllColumns().length;
  const extraCols = (enableSelection ? 1 : 0) + (enableExpand ? 1 : 0);
  const totalColSpan = visibleCols + extraCols;
  const selectedRowsCount = Object.keys(rowSelection).length;
  const totalRowsCount = table.getFilteredRowModel().rows.length;

  return (
    <div
      className={cn(gridWrapperVariants({ size, fullWidth }), className)}
      role="region"
      aria-label="Grid de date avansat"
    >
      <Toolbar<TData>
        enableColumnFilters={enableColumnFilters}
        globalFilter={globalFilter}
        onGlobalFilterChange={handleGlobalFilterChange}
        enableColumnReorder={enableColumnReorder}
        enableExport={enableExport}
        onExport={handleExport}
        columns={columnVisibilityInfo}
        onColumnVisibilityToggle={handleColumnVisibilityToggle}
        size={size}
        selectedRowsCount={selectedRowsCount}
        totalRowsCount={totalRowsCount}
        className={toolbarClassName}
      />

      <div className={gridContainerVariants({ stickyHeader })}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <table
            className={cn("w-full border-collapse", tableClassName)}
            role="table"
            style={{ width: table.getCenterTotalSize() }}
          >
            <thead className={theadVariants({ stickyHeader })}>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} role="row">
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

                  {enableExpand && (
                    <th
                      className={cn(thVariants({ size, align: "center" }), "w-10")}
                      role="columnheader"
                      aria-label="Expandare"
                    >
                      <span className="sr-only">Expandare</span>
                    </th>
                  )}

                  <SortableContext
                    items={columnOrder}
                    strategy={horizontalListSortingStrategy}
                  >
                    {headerGroup.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const isSorted = header.column.getIsSorted();
                      const columnMeta = header.column.columnDef.meta as DataGridColumnMeta | undefined;
                      const align = columnMeta?.align ?? "left";
                      const isResizing = header.column.getIsResizing();
                      const canReorder = enableColumnReorder && columnMeta?.reorderable !== false;
                      const colId = header.column.id;

                      const headerContent = (
                        <div className="relative">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1",
                              canReorder && "ml-5",
                            )}
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
                            role={canSort ? "button" : undefined}
                          >
                            {header.isPlaceholder
                              ? null
                              : flexRender(header.column.columnDef.header, header.getContext())}
                            <SortIndicator isSorted={isSorted} canSort={canSort} />
                          </span>

                          {header.column.getCanResize() && (
                            <ResizeHandle
                              isResizing={isResizing}
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                            />
                          )}
                        </div>
                      );

                      const headerElement = canReorder ? (
                        <DraggableHeader headerId={header.id} columnId={colId}>
                          {headerContent}
                        </DraggableHeader>
                      ) : (
                        headerContent
                      );

                      return (
                        <th
                          key={header.id}
                          className={cn(
                            thVariants({
                              size,
                              sortable: canSort,
                              align,
                              isDragging: false,
                            }),
                          )}
                          style={{
                            width: header.getSize(),
                            position: "relative",
                          }}
                          role="columnheader"
                          aria-sort={
                            isSorted === "asc"
                              ? "ascending"
                              : isSorted === "desc"
                                ? "descending"
                                : undefined
                          }
                          colSpan={header.colSpan}
                        >
                          {enableColumnFilters && columnMeta?.filterable !== false && (
                            <ColumnFilterInput
                              columnId={colId}
                              value={(columnFilters.find((f) => f.id === colId)?.value as string) ?? ""}
                              placeholder={columnMeta?.filterPlaceholder}
                              size={size}
                              onChange={(val) => handleColumnFilterChange(colId, val)}
                            />
                          )}

                          <div className="flex items-center">{headerElement}</div>
                        </th>
                      );
                    })}
                  </SortableContext>
                </tr>
              ))}
            </thead>

            <tbody>
              {loading ? (
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
                <EmptyState colSpan={totalColSpan} message={emptyMessage} size={size} />
              ) : (
                table.getRowModel().rows.map((row) => {
                  const isSelected = row.getIsSelected();
                  const isExpanded = row.getIsExpanded();

                  return (
                    <React.Fragment key={row.id}>
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
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                        data-state={isSelected ? "selected" : undefined}
                      >
                        {enableSelection && (
                          <td
                            className={cn(tdVariants({ size, align: "center", isSelected }), "w-10")}
                            role="cell"
                          >
                            <SelectionCheckbox
                              checked={isSelected}
                              onChange={(checked) => row.toggleSelected(checked)}
                              ariaLabel={`Selectează rândul ${row.id}`}
                            />
                          </td>
                        )}

                        {enableExpand && (
                          <td
                            className={cn(tdVariants({ size, align: "center", isSelected }), "w-10")}
                            role="cell"
                          >
                            {row.getCanExpand() && (
                              <ExpandButton
                                isExpanded={isExpanded}
                                onClick={() => row.toggleExpanded()}
                                ariaLabel={isExpanded ? "Restrânge rândul" : "Extinde rândul"}
                              />
                            )}
                          </td>
                        )}

                        {row.getVisibleCells().map((cell) => {
                          const cellMeta = cell.column.columnDef.meta as DataGridColumnMeta | undefined;
                          const align = cellMeta?.align ?? "left";

                          return (
                            <td
                              key={cell.id}
                              className={cn(tdVariants({ size, align, isSelected }))}
                              style={{ width: cell.column.getSize() }}
                              role="cell"
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          );
                        })}
                      </tr>

                      {enableExpand && isExpanded && expandedContent && (
                        <tr className="bg-surface-secondary/50" role="row" aria-label="Conținut extins">
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
        </DndContext>
      </div>

      {enablePagination && !loading && table.getPageCount() > 0 && (
        <TablePagination
          table={table}
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

const DataGrid = DataGridComponent as <TData, TValue = unknown>(
  props: DataGridProps<TData, TValue>,
) => React.ReactElement;

export {
  DataGrid,
  DataGridComponent,
  exportToCSV,
  gridWrapperVariants,
  gridContainerVariants,
  thVariants,
  tdVariants,
  trVariants,
  paginationButtonVariants,
  filterInputVariants,
  toolbarButtonVariants,
};

export default DataGrid;
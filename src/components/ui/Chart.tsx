"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { themeManager } from "@/lib/theme";
import {
  Download,
  Loader2,
  BarChart3,
  TrendingUp,
  PieChart,
  Activity,
  AlertCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  CartesianGrid,
  XAxis,
  YAxis,
  LineChart,
  BarChart,
  AreaChart,
  PieChart as RechartsPieChart,
  Line,
  Bar,
  Area,
  Pie,
  Cell,
  type TooltipProps as RechartsTooltipProps,
  type LegendProps as RechartsLegendProps,
  type CategoricalChartState,
} from "recharts";

// ─── Chart Color Palettes ──────────────────────────────────────────

/** Light-mode chart color palette */
const LIGHT_COLORS = [
  "hsl(222 75% 50%)",
  "hsl(170 75% 44%)",
  "hsl(38 96% 42%)",
  "hsl(142 72% 40%)",
  "hsl(0 82% 46%)",
  "hsl(200 78% 46%)",
  "hsl(262 75% 50%)",
  "hsl(330 75% 50%)",
  "hsl(20 80% 50%)",
  "hsl(100 60% 40%)",
];

/** Dark-mode chart color palette */
const DARK_COLORS = [
  "hsl(222 82% 58%)",
  "hsl(170 72% 50%)",
  "hsl(38 72% 48%)",
  "hsl(142 62% 48%)",
  "hsl(0 62% 50%)",
  "hsl(200 72% 50%)",
  "hsl(262 78% 60%)",
  "hsl(330 78% 60%)",
  "hsl(20 82% 58%)",
  "hsl(100 64% 48%)",
];

// ─── Variant Definitions ────────────────────────────────────────────

const chartWrapperVariants = cva(
  [
    "relative w-full",
    "bg-surface border border-border-subtle",
    "rounded-xl overflow-hidden",
    "shadow-elevation-1",
    "transition-all duration-200",
  ],
  {
    variants: {
      size: {
        sm: "h-48",
        md: "h-72",
        lg: "h-96",
        xl: "h-[28rem]",
        full: "h-full",
        auto: "h-auto min-h-[12rem]",
      },
      variant: {
        default: "bg-surface",
        ghost: "bg-transparent border-transparent shadow-none",
        elevated: "bg-surface shadow-elevation-2 border-transparent",
        outline: "bg-transparent border-border",
      },
    },
    defaultVariants: {
      size: "md",
      variant: "default",
    },
  },
);

const chartHeaderVariants = cva(
  [
    "flex items-center justify-between gap-4",
    "px-5 py-4",
    "border-b border-border-subtle",
  ],
  {
    variants: {
      headerDivider: {
        true: "border-b border-border-subtle",
        false: "border-b-0",
      },
    },
    defaultVariants: {
      headerDivider: true,
    },
  },
);

const chartEmptyVariants = cva(
  [
    "flex flex-col items-center justify-center gap-3",
    "text-text-tertiary text-sm",
    "absolute inset-0",
  ],
);

const chartLoadingVariants = cva(
  [
    "flex items-center justify-center",
    "absolute inset-0 z-10",
    "bg-surface/70 backdrop-blur-[1px]",
  ],
);

// ─── Types ──────────────────────────────────────────────────────────

export type ChartSize = VariantProps<typeof chartWrapperVariants>["size"];
export type ChartVariant = VariantProps<typeof chartWrapperVariants>["variant"];

export type ChartType = "line" | "bar" | "area" | "pie";

export interface ChartSeriesConfig {
  dataKey: string;
  name?: string;
  color?: string;
  type?: "line" | "bar" | "area";
  stackId?: string;
  hidden?: boolean;
}

export type ChartPosition =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface ChartTooltipConfig {
  enabled?: boolean;
  valueFormatter?: (value: number, name: string, dataKey: string) => string;
  labelFormatter?: (label: string) => string;
  position?: { x?: number; y?: number };
  cursor?: boolean;
  customContent?: React.ReactNode;
}

export interface ChartLegendConfig {
  enabled?: boolean;
  position?: ChartPosition;
  toggleable?: boolean;
  formatter?: (value: string) => string;
  iconType?: "circle" | "rect" | "line" | "diamond";
}

export interface ChartExportConfig {
  enabled?: boolean;
  fileName?: string;
  formats?: ("png" | "svg" | "csv")[];
}

export interface ChartGridConfig {
  horizontal?: boolean;
  vertical?: boolean;
  strokeDasharray?: string;
}

export interface ChartAxisConfig {
  xKey?: string;
  showXAxis?: boolean;
  showYAxis?: boolean;
  xLabel?: string;
  yLabel?: string;
  hideXTick?: boolean;
  hideYTick?: boolean;
  xTickAngle?: number;
  yTickFormatter?: (value: number) => string;
}

export interface ChartProps {
  data: Record<string, unknown>[];
  series: ChartSeriesConfig[];
  type?: ChartType;
  xKey?: string;
  size?: ChartSize;
  variant?: ChartVariant;
  className?: string;
  tooltip?: ChartTooltipConfig | boolean;
  legend?: ChartLegendConfig | boolean;
  exportConfig?: ChartExportConfig | boolean;
  grid?: ChartGridConfig | boolean;
  axis?: ChartAxisConfig;
  title?: string;
  description?: string;
  showHeader?: boolean;
  headerActions?: React.ReactNode;
  loading?: boolean;
  loadingMessage?: string;
  emptyMessage?: string;
  error?: string | null;
  onRetry?: () => void;
  aspect?: number;
  minHeight?: number;
  onElementClick?: (data: Record<string, unknown>, index: number) => void;
  onLegendToggle?: (dataKey: string, visible: boolean) => void;
  colors?: string[];
  forceDark?: boolean;
  forceLight?: boolean;
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
  syncId?: string;
  animate?: boolean;
}

// ─── Hook: useChartTheme ────────────────────────────────────────────

export function useChartTheme(forceDark?: boolean, forceLight?: boolean): {
  colors: string[];
  isDark: boolean;
  gridColor: string;
  textColor: string;
  textColorSecondary: string;
  axisColor: string;
} {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (forceDark) return true;
    if (forceLight) return false;
    if (typeof window !== "undefined") {
      return themeManager.isDark();
    }
    return false;
  });

  useEffect(() => {
    if (forceDark || forceLight) return;
    const unsub = themeManager.onChange(({ palette }) => {
      setIsDark(palette === "dark");
    });
    return unsub;
  }, [forceDark, forceLight]);

  const palette = useMemo(() => {
    const resolved = forceDark ? true : forceLight ? false : isDark;

    return {
      colors: resolved ? DARK_COLORS : LIGHT_COLORS,
      isDark: resolved,
      gridColor: resolved
        ? "hsl(220 14% 22%)"
        : "hsl(220 14% 88%)",
      textColor: resolved
        ? "hsl(220 14% 70%)"
        : "hsl(220 12% 36%)",
      textColorSecondary: resolved
        ? "hsl(220 10% 50%)"
        : "hsl(220 8% 55%)",
      axisColor: resolved
        ? "hsl(220 14% 26%)"
        : "hsl(220 12% 76%)",
    };
  }, [isDark, forceDark, forceLight]);

  return palette;
}

// ─── Hook: useChartExport ───────────────────────────────────────────

export interface ChartExportOptions {
  fileName?: string;
  formats?: ("png" | "svg" | "csv")[];
}

export interface ChartExportResult {
  exportPNG: () => Promise<void>;
  exportSVG: () => void;
  exportCSV: () => void;
  isExporting: boolean;
}

export function useChartExport(
  containerRef: React.RefObject<HTMLDivElement | null>,
  data: Record<string, unknown>[],
  options?: ChartExportOptions,
): ChartExportResult {
  const [isExporting, setIsExporting] = useState(false);
  const fileName = options?.fileName ?? "chart";
  const formats = options?.formats ?? ["png", "svg", "csv"];

  const exportPNG = useCallback(async () => {
    if (!containerRef.current || !formats.includes("png")) return;
    setIsExporting(true);
    try {
      const svgElement = containerRef.current.querySelector("svg");
      if (!svgElement) {
        console.warn("[Chart] No SVG element found for PNG export.");
        return;
      }

      const svgClone = svgElement.cloneNode(true) as SVGElement;
      const svgData = new XMLSerializer().serializeToString(svgClone);
      const canvas = document.createElement("canvas");
      const rect = svgElement.getBoundingClientRect();
      const scale = 2;
      canvas.width = rect.width * scale;
      canvas.height = rect.height * scale;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const img = new Image();
      const svgBlob = new Blob([svgData], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(svgBlob);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve();
        };
        img.onerror = reject;
        img.src = url;
      });

      canvas.toBlob((blob) => {
        if (!blob) return;
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = downloadUrl;
        a.download = `${fileName}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
      }, "image/png");
    } catch (err) {
      console.error("[Chart] PNG export failed:", err);
    } finally {
      setIsExporting(false);
    }
  }, [containerRef, fileName, formats]);

  const exportSVG = useCallback(() => {
    if (!containerRef.current || !formats.includes("svg")) return;
    const svgElement = containerRef.current.querySelector("svg");
    if (!svgElement) {
      console.warn("[Chart] No SVG element found for SVG export.");
      return;
    }
    const svgClone = svgElement.cloneNode(true) as SVGElement;
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [containerRef, fileName, formats]);

  const exportCSV = useCallback(() => {
    if (!formats.includes("csv")) return;
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]!);
    const csvRows: string[] = [];

    csvRows.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","));

    for (const row of data) {
      csvRows.push(
        headers
          .map((h) => {
            const val = row[h];
            if (val == null) return "";
            const str = String(val);
            return `"${str.replace(/"/g, '""')}"`;
          })
          .join(","),
      );
    }

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [data, fileName, formats]);

  return { exportPNG, exportSVG, exportCSV, isExporting };
}

// ─── Sub-component: ChartTooltip ────────────────────────────────────

interface CustomTooltipProps extends RechartsTooltipProps<number, string> {
  valueFormatter?: (value: number, name: string, dataKey: string) => string;
  labelFormatter?: (label: string) => string;
  isDark?: boolean;
}

function ChartTooltipContent({
  active,
  payload,
  label,
  valueFormatter,
  labelFormatter,
  isDark,
}: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const formattedLabel = labelFormatter ? labelFormatter(String(label)) : label;

  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2 text-xs shadow-elevation-2",
        "border max-w-[260px]",
        isDark
          ? "bg-neutral-800 border-neutral-700 text-neutral-100"
          : "bg-white border-neutral-200 text-neutral-900",
      )}
      role="tooltip"
      aria-label={`Tooltip pentru ${formattedLabel}`}
    >
      <p
        className={cn(
          "mb-1.5 font-semibold",
          isDark ? "text-neutral-200" : "text-neutral-700",
        )}
      >
        {formattedLabel}
      </p>
      {payload.map((entry, index) => {
        const name = String(entry.name ?? entry.dataKey ?? "");
        const value =
          typeof entry.value === "number" ? entry.value : 0;
        const formattedValue = valueFormatter
          ? valueFormatter(value, name, String(entry.dataKey ?? ""))
          : value.toLocaleString("ro-RO");
        const color = entry.color ?? entry.payload?.fill ?? "currentColor";

        return (
          <div
            key={`tooltip-${index}`}
            className="flex items-center justify-between gap-3 py-0.5"
          >
            <span className="inline-flex items-center gap-1.5 truncate">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <span
                className={cn(
                  "truncate",
                  isDark ? "text-neutral-300" : "text-neutral-600",
                )}
              >
                {name}
              </span>
            </span>
            <span
              className={cn(
                "font-mono font-medium tabular-nums",
                isDark ? "text-neutral-100" : "text-neutral-900",
              )}
            >
              {formattedValue}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sub-component: ChartLegend ─────────────────────────────────────

interface CustomLegendProps extends RechartsLegendProps {
  toggleable?: boolean;
  hiddenSeries?: Set<string>;
  onToggle?: (dataKey: string) => void;
  customFormatter?: (value: string) => string;
  iconType?: "circle" | "rect" | "line" | "diamond";
  isDark?: boolean;
  position?: ChartPosition;
}

function ChartLegendContent({
  payload,
  toggleable,
  hiddenSeries,
  onToggle,
  customFormatter,
  iconType = "circle",
  isDark,
  position = "bottom",
}: CustomLegendProps) {
  if (!payload || payload.length === 0) return null;

  const isVertical =
    position === "left" || position === "right";

  const containerClass = cn(
    "flex flex-wrap gap-x-4 gap-y-1.5",
    isVertical ? "flex-col" : "flex-row justify-center",
    "px-2 py-1",
  );

  const iconShape = (color: string) => {
    const baseClass = "inline-block shrink-0";
    switch (iconType) {
      case "rect":
        return (
          <span
            className={cn(baseClass, "h-2.5 w-2.5 rounded-sm")}
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
        );
      case "line":
        return (
          <span
            className={cn(baseClass, "h-[2px] w-3")}
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
        );
      case "diamond":
        return (
          <span
            className={cn(baseClass, "h-2 w-2 rotate-45 rounded-[1px]")}
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
        );
      case "circle":
      default:
        return (
          <span
            className={cn(baseClass, "h-2.5 w-2.5 rounded-full")}
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
        );
    }
  };

  return (
    <div className={containerClass} role="list" aria-label="Legendă grafic">
      {payload.map((entry, index) => {
        const dataKey = String(entry.dataKey ?? "");
        const isHidden = hiddenSeries?.has(dataKey);
        const displayName = customFormatter
          ? customFormatter(String(entry.value ?? dataKey))
          : (entry.value ?? dataKey);

        return (
          <button
            key={`legend-${index}`}
            type="button"
            role="listitem"
            disabled={!toggleable}
            onClick={() => {
              if (toggleable && onToggle) {
                onToggle(dataKey);
              }
            }}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs",
              "transition-opacity duration-150",
              toggleable && "cursor-pointer hover:opacity-80",
              !toggleable && "cursor-default",
              isHidden && "opacity-40",
              isDark ? "text-neutral-300" : "text-neutral-600",
            )}
            aria-pressed={toggleable ? !isHidden : undefined}
            aria-label={
              toggleable
                ? `${isHidden ? "Afișează" : "Ascunde"} ${displayName}`
                : displayName
            }
          >
            {iconShape(String(entry.color ?? "currentColor"))}
            <span
              className={cn(isHidden ? "line-through" : "")}
            >
              {displayName}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Sub-component: ExportButton ────────────────────────────────────

interface ExportButtonProps {
  onExportPNG?: () => void;
  onExportSVG?: () => void;
  onExportCSV?: () => void;
  isExporting?: boolean;
  formats?: ("png" | "svg" | "csv")[];
  fileName?: string;
  disabled?: boolean;
  className?: string;
}

const ExportButton = forwardRef<HTMLDivElement, ExportButtonProps>(
  (props, ref) => {
    const {
      onExportPNG,
      onExportSVG,
      onExportCSV,
      isExporting = false,
      formats = ["png", "svg", "csv"],
      fileName = "chart",
      disabled = false,
      className,
    } = props;

    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonId = useId();

    useEffect(() => {
      if (!isOpen) return;
      const handler = (e: MouseEvent) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [isOpen]);

    useEffect(() => {
      if (!isOpen) return;
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") setIsOpen(false);
      };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }, [isOpen]);

    const handleExport = useCallback(
      (format: "png" | "svg" | "csv") => {
        setIsOpen(false);
        switch (format) {
          case "png":
            onExportPNG?.();
            break;
          case "svg":
            onExportSVG?.();
            break;
          case "csv":
            onExportCSV?.();
            break;
        }
      },
      [onExportPNG, onExportSVG, onExportCSV],
    );

    const formatLabels: Record<string, string> = {
      png: "PNG (imagine)",
      svg: "SVG (vectorial)",
      csv: "CSV (date)",
    };

    const availableFormats = formats.filter((f) => {
      if (f === "png") return !!onExportPNG;
      if (f === "svg") return !!onExportSVG;
      if (f === "csv") return !!onExportCSV;
      return false;
    });

    if (availableFormats.length === 0) return null;

    return (
      <div ref={ref} className={cn("relative", className)}>
        <button
          type="button"
          id={buttonId}
          disabled={disabled || isExporting}
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-haspopup="true"
          aria-label="Exportă graficul"
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium",
            "border border-border bg-surface-secondary",
            "text-text-secondary hover:text-text-primary",
            "hover:bg-surface-tertiary hover:border-border-strong",
            "transition-all duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {isExporting ? (
            <>
              <Loader2
                className="h-3.5 w-3.5 animate-spin"
                aria-hidden="true"
              />
              <span>Export...</span>
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export</span>
            </>
          )}
        </button>

        {isOpen && (
          <div
            ref={dropdownRef}
            role="menu"
            aria-labelledby={buttonId}
            className={cn(
              "absolute right-0 top-full mt-1 z-dropdown",
              "min-w-[160px] rounded-lg",
              "border border-border bg-surface",
              "shadow-elevation-2",
              "animate-fade-in",
            )}
          >
            {availableFormats.map((format) => (
              <button
                key={format}
                type="button"
                role="menuitem"
                onClick={() => handleExport(format)}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs",
                  "text-text-secondary hover:text-text-primary",
                  "hover:bg-surface-secondary",
                  "first:rounded-t-lg last:rounded-b-lg",
                  "transition-colors duration-100",
                  "flex items-center justify-between",
                )}
              >
                <span>{formatLabels[format] ?? format.toUpperCase()}</span>
                <span className="text-[10px] uppercase text-text-tertiary font-mono">
                  .{format}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  },
);
ExportButton.displayName = "Chart.ExportButton";

// ─── Sub-component: Empty State ──────────────────────────────────────

interface EmptyStateProps {
  message?: string;
  icon?: React.ReactNode;
}

function ChartEmptyState({
  message = "Nicio dată disponibilă pentru acest grafic.",
  icon,
}: EmptyStateProps) {
  return (
    <div className={chartEmptyVariants()} role="status">
      {icon || (
        <BarChart3
          className="h-10 w-10 text-text-tertiary/40"
          aria-hidden="true"
        />
      )}
      <p className="text-sm text-text-tertiary max-w-[220px] text-center">
        {message}
      </p>
    </div>
  );
}

// ─── Sub-component: Error State ──────────────────────────────────────

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

function ChartErrorState({
  message = "Eroare la încărcarea datelor.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        "absolute inset-0",
        "text-text-tertiary",
      )}
      role="alert"
    >
      <AlertCircle className="h-10 w-10 text-danger-400" aria-hidden="true" />
      <p className="text-sm text-center max-w-[220px]">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "px-3 py-1.5 rounded-md text-xs font-medium",
            "bg-brand-500 text-text-inverse",
            "hover:bg-brand-600",
            "transition-colors duration-150",
          )}
        >
          Reîncearcă
        </button>
      )}
    </div>
  );
}

// ─── Sub-component: Loading State ────────────────────────────────────

interface LoadingStateProps {
  message?: string;
}

function ChartLoadingState({
  message = "Se încarcă...",
}: LoadingStateProps) {
  return (
    <div className={chartLoadingVariants()} role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-2">
        <Loader2
          className="h-6 w-6 animate-spin text-brand-500"
          aria-hidden="true"
        />
        <span className="text-xs text-text-tertiary">{message}</span>
      </div>
    </div>
  );
}

// ─── Main Chart Component ────────────────────────────────────────────

const ChartComponent = forwardRef<HTMLDivElement, ChartProps>(
  (props, ref) => {
    const {
      data,
      series,
      type = "line",
      xKey = "name",
      size = "md",
      variant = "default",
      className,
      tooltip: tooltipConfig,
      legend: legendConfig,
      exportConfig,
      grid: gridConfig,
      axis: axisConfig,
      title,
      description,
      showHeader = true,
      headerActions,
      loading = false,
      loadingMessage,
      emptyMessage,
      error,
      onRetry,
      aspect,
      minHeight,
      onElementClick,
      onLegendToggle,
      colors: customColors,
      forceDark,
      forceLight,
      margin,
      syncId,
      animate = true,
    } = props;

    const chartTheme = useChartTheme(forceDark, forceLight);
    const resolvedColors = customColors ?? chartTheme.colors;

    const resolvedTooltip: ChartTooltipConfig | false = useMemo(() => {
      if (tooltipConfig === false) return false;
      if (tooltipConfig === true || tooltipConfig === undefined) {
        return { enabled: true };
      }
      return { enabled: true, ...tooltipConfig };
    }, [tooltipConfig]);

    const resolvedLegend: ChartLegendConfig | false = useMemo(() => {
      if (legendConfig === false) return false;
      if (legendConfig === true || legendConfig === undefined) {
        return { enabled: true, position: "bottom", toggleable: true };
      }
      return { enabled: true, ...legendConfig };
    }, [legendConfig]);

    const resolvedGrid: ChartGridConfig = useMemo(() => {
      if (gridConfig === false) return { horizontal: false, vertical: false };
      if (gridConfig === true || gridConfig === undefined) {
        return { horizontal: true, vertical: false };
      }
      return gridConfig as ChartGridConfig;
    }, [gridConfig]);

    const resolvedAxis: ChartAxisConfig = useMemo(() => {
      return {
        xKey,
        showXAxis: true,
        showYAxis: true,
        ...axisConfig,
      };
    }, [axisConfig, xKey]);

    const resolvedExport: ChartExportConfig = useMemo(() => {
      if (exportConfig === false) return { enabled: false, formats: [] };
      if (exportConfig === true || exportConfig === undefined) {
        return {
          enabled: true,
          fileName: title ? title.toLowerCase().replace(/\s+/g, "-") : "chart",
          formats: ["png", "svg", "csv"],
        };
      }
      return {
        enabled: true,
        fileName: title ? title.toLowerCase().replace(/\s+/g, "-") : "chart",
        formats: ["png", "svg", "csv"],
        ...exportConfig,
      };
    }, [exportConfig, title]);

    const containerRef = useRef<HTMLDivElement>(null);
    const mergedRef = useCallback(
      (node: HTMLDivElement | null) => {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current =
          node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }
      },
      [ref],
    );

    const { exportPNG, exportSVG, exportCSV, isExporting } = useChartExport(
      containerRef,
      data,
      {
        fileName: resolvedExport.fileName ?? "chart",
        formats: resolvedExport.formats,
      },
    );

    const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

    const handleLegendToggle = useCallback(
      (dataKey: string) => {
        setHiddenSeries((prev) => {
          const next = new Set(prev);
          if (next.has(dataKey)) {
            next.delete(dataKey);
          } else {
            next.add(dataKey);
          }
          return next;
        });
        onLegendToggle?.(dataKey, !hiddenSeries.has(dataKey));
      },
      [hiddenSeries, onLegendToggle],
    );

    const visibleSeries = useMemo(() => {
      return series.filter((s) => !s.hidden && !hiddenSeries.has(s.dataKey));
    }, [series, hiddenSeries]);

    const derivedMargin = useMemo(() => {
      return {
        top: margin?.top ?? 5,
        right: margin?.right ?? 20,
        bottom: margin?.bottom ?? 5,
        left: margin?.left ?? 0,
      };
    }, [margin]);

    const hasData = data && data.length > 0;
    const showExport =
      resolvedExport.enabled && resolvedExport.formats.length > 0;
    const showTitleBar = showHeader && (title || showExport || headerActions);

    const renderChart = () => {
      if (!hasData && !loading) {
        return <ChartEmptyState message={emptyMessage} />;
      }

      const dominantType = type;

      const gridElement =
        resolvedGrid.horizontal || resolvedGrid.vertical ? (
          <CartesianGrid
            strokeDasharray={resolvedGrid.strokeDasharray ?? "3 3"}
            stroke={chartTheme.gridColor}
            horizontal={resolvedGrid.horizontal}
            vertical={resolvedGrid.vertical}
          />
        ) : null;

      const xAxisElement = resolvedAxis.showXAxis ? (
        <XAxis
          dataKey={resolvedAxis.xKey ?? xKey}
          tick={{
            fontSize: 11,
            fill: chartTheme.textColorSecondary,
            angle: resolvedAxis.xTickAngle ?? 0,
          }}
          tickLine={{ stroke: chartTheme.axisColor }}
          axisLine={{ stroke: chartTheme.axisColor }}
          hide={resolvedAxis.hideXTick}
          label={
            resolvedAxis.xLabel
              ? {
                  value: resolvedAxis.xLabel,
                  position: "insideBottom",
                  offset: -5,
                  style: {
                    fontSize: 12,
                    fill: chartTheme.textColor,
                  },
                }
              : undefined
          }
          interval="preserveStartEnd"
        />
      ) : null;

      const yAxisElement = resolvedAxis.showYAxis ? (
        <YAxis
          tick={{
            fontSize: 11,
            fill: chartTheme.textColorSecondary,
          }}
          tickLine={{ stroke: chartTheme.axisColor }}
          axisLine={{ stroke: chartTheme.axisColor }}
          hide={resolvedAxis.hideYTick}
          tickFormatter={resolvedAxis.yTickFormatter}
          label={
            resolvedAxis.yLabel
              ? {
                  value: resolvedAxis.yLabel,
                  angle: -90,
                  position: "insideLeft",
                  style: {
                    fontSize: 12,
                    fill: chartTheme.textColor,
                  },
                }
              : undefined
          }
          width={60}
        />
      ) : null;

      const tooltipElement =
        resolvedTooltip && resolvedTooltip.enabled ? (
          <RechartsTooltip
            content={
              <ChartTooltipContent
                valueFormatter={resolvedTooltip.valueFormatter}
                labelFormatter={resolvedTooltip.labelFormatter}
                isDark={chartTheme.isDark}
              />
            }
            cursor={
              resolvedTooltip.cursor !== undefined
                ? resolvedTooltip.cursor
                : { stroke: chartTheme.gridColor, strokeDasharray: "3 3" }
            }
            position={resolvedTooltip.position}
          />
        ) : null;

      const legendElement =
        resolvedLegend && resolvedLegend.enabled ? (
          <RechartsLegend
            content={
              <ChartLegendContent
                toggleable={resolvedLegend.toggleable}
                hiddenSeries={hiddenSeries}
                onToggle={handleLegendToggle}
                customFormatter={resolvedLegend.formatter}
                iconType={resolvedLegend.iconType}
                isDark={chartTheme.isDark}
                position={resolvedLegend.position}
              />
            }
            verticalAlign={
              resolvedLegend.position === "top" ||
              resolvedLegend.position === "top-left" ||
              resolvedLegend.position === "top-right"
                ? "top"
                : resolvedLegend.position === "left" ||
                    resolvedLegend.position === "right"
                  ? "middle"
                  : "bottom"
            }
            align={
              resolvedLegend.position?.includes("left")
                ? "left"
                : resolvedLegend.position?.includes("right")
                  ? "right"
                  : "center"
            }
            wrapperStyle={{ paddingTop: 8, paddingBottom: 4 }}
          />
        ) : null;

      const handleClick = (state: CategoricalChartState | undefined) => {
        if (
          onElementClick &&
          state &&
          state.activeTooltipIndex !== undefined &&
          hasData
        ) {
          const idx = state.activeTooltipIndex;
          if (idx >= 0 && idx < data.length) {
            onElementClick(data[idx]!, idx);
          }
        }
      };

      const seriesElements = visibleSeries.map((s, index) => {
        const color =
          s.color ?? resolvedColors[index % resolvedColors.length]!;
        const seriesType = s.type ?? (type === "pie" ? undefined : type);

        if (dominantType === "pie") {
          return (
            <Cell
              key={`cell-${s.dataKey}`}
              fill={color}
              name={s.name ?? s.dataKey}
            />
          );
        }

        const commonProps = {
          key: s.dataKey,
          dataKey: s.dataKey,
          name: s.name ?? s.dataKey,
          stroke: color,
          fill: color,
          strokeWidth: 2,
          dot: type === "line" ? { r: 3, fill: color, strokeWidth: 2 } : false,
          activeDot:
            type === "line" ? { r: 5, fill: color, strokeWidth: 2 } : undefined,
          isAnimationActive: animate,
          animationDuration: 800,
          animationEasing: "ease-out",
        };

        switch (seriesType) {
          case "bar":
            return (
              <Bar
                {...commonProps}
                stackId={s.stackId}
                radius={[4, 4, 0, 0]}
                maxBarSize={48}
              />
            );
          case "area":
            return (
              <Area
                {...commonProps}
                stackId={s.stackId}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            );
          case "line":
          default:
            return (
              <Line
                {...commonProps}
                type="monotone"
              />
            );
        }
      });

      if (dominantType === "pie") {
        const pieData = data.map((d) => ({
          name: String(d[resolvedAxis.xKey ?? xKey] ?? d.name ?? ""),
          value: Number(d[visibleSeries[0]?.dataKey ?? "value"] ?? 0),
          ...d,
        }));

        return (
          <RechartsPieChart
            onClick={(state) => handleClick(state as unknown as CategoricalChartState)}
            margin={derivedMargin}
          >
            {legendElement}
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={0}
              outerRadius="80%"
              paddingAngle={2}
              isAnimationActive={animate}
              animationDuration={800}
              animationEasing="ease-out"
              label={({ name, percent }) =>
                `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`
              }
              labelLine={{ stroke: chartTheme.axisColor }}
              onClick={
                onElementClick
                  ? (entry, index) => onElementClick(entry, index)
                  : undefined
              }
            >
              {seriesElements}
            </Pie>
            {tooltipElement}
          </RechartsPieChart>
        );
      }

      const ChartElement =
        dominantType === "bar"
          ? BarChart
          : dominantType === "area"
            ? AreaChart
            : LineChart;

      return (
        <ChartElement
          data={data}
          margin={derivedMargin}
          syncId={syncId}
          onClick={handleClick}
        >
          {gridElement}
          {xAxisElement}
          {yAxisElement}
          {tooltipElement}
          {legendElement}
          {seriesElements}
        </ChartElement>
      );
    };

    const style: React.CSSProperties = {};
    if (minHeight) {
      style.minHeight = `${minHeight}px`;
    }

    return (
      <div
        ref={mergedRef}
        className={cn(chartWrapperVariants({ size, variant }), className)}
        style={style}
        role="region"
        aria-label={title ?? "Grafic"}
      >
        {showTitleBar && (
          <div className={chartHeaderVariants({ headerDivider: true })}>
            <div className="flex-1 min-w-0">
              {title && (
                <h3 className="text-sm font-semibold text-text-primary truncate">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-xs text-text-tertiary mt-0.5 truncate">
                  {description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {headerActions}
              {showExport && (
                <ExportButton
                  onExportPNG={
                    resolvedExport.formats.includes("png")
                      ? exportPNG
                      : undefined
                  }
                  onExportSVG={
                    resolvedExport.formats.includes("svg")
                      ? exportSVG
                      : undefined
                  }
                  onExportCSV={
                    resolvedExport.formats.includes("csv")
                      ? exportCSV
                      : undefined
                  }
                  isExporting={isExporting}
                  formats={resolvedExport.formats}
                  fileName={resolvedExport.fileName}
                />
              )}
            </div>
          </div>
        )}

        <div
          className={cn(
            "relative flex-1",
            !showTitleBar && "pt-4",
            "px-1",
          )}
        >
          {error ? (
            <ChartErrorState message={error} onRetry={onRetry} />
          ) : loading ? (
            <>
              <ChartLoadingState message={loadingMessage} />
              <div className="opacity-20 pointer-events-none" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%" aspect={aspect}>
                  {renderChart()}
                </ResponsiveContainer>
              </div>
            </>
          ) : (
            <ResponsiveContainer width="100%" height="100%" aspect={aspect}>
              {renderChart()}
            </ResponsiveContainer>
          )}
        </div>
      </div>
    );
  },
);

ChartComponent.displayName = "Chart";

// ─── Compound Export ─────────────────────────────────────────────────

type ChartCompound = typeof ChartComponent & {
  ExportButton: typeof ExportButton;
  EmptyState: typeof ChartEmptyState;
  ErrorState: typeof ChartErrorState;
  LoadingState: typeof ChartLoadingState;
};

const Chart = ChartComponent as ChartCompound;
Chart.ExportButton = ExportButton;
Chart.EmptyState = ChartEmptyState;
Chart.ErrorState = ChartErrorState;
Chart.LoadingState = ChartLoadingState;

export {
  Chart,
  ChartComponent,
  ExportButton as ChartExportButton,
  ChartEmptyState,
  ChartErrorState,
  ChartLoadingState,
  ChartTooltipContent,
  ChartLegendContent,
  chartWrapperVariants,
  chartHeaderVariants,
  chartEmptyVariants,
  chartLoadingVariants,
  LIGHT_COLORS,
  DARK_COLORS,
};

export type {
  ChartSeriesConfig,
  ChartTooltipConfig,
  ChartLegendConfig,
  ChartExportConfig,
  ChartGridConfig,
  ChartAxisConfig,
  ChartPosition,
  ExportButtonProps,
};

export default Chart;
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cva } from "class-variance-authority";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";

// ─── Constants ──────────────────────────────────────────────────────

const DEFAULT_DURATION = 5000;
const DEFAULT_MAX_VISIBLE = 5;

// ─── Types ──────────────────────────────────────────────────────────

export type ToastVariant = "success" | "error" | "warning" | "info";

export type ToastPosition =
  | "top-right"
  | "top-left"
  | "bottom-right"
  | "bottom-left"
  | "top-center"
  | "bottom-center";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** Unique ID. Auto-generated if omitted. */
  id?: string;
  /** Optional title displayed above the message */
  title?: string;
  /** Duration in ms before auto-dismiss. 0 = persistent. Default 5000 */
  duration?: number;
  /** Visual variant */
  variant?: ToastVariant;
  /** Screen position. Default: "bottom-right" */
  position?: ToastPosition;
  /** Show close button. Default: true */
  dismissible?: boolean;
  /** Custom icon override */
  icon?: React.ReactNode;
  /** Action button rendered inside the toast */
  action?: ToastAction;
}

export interface Toast extends Omit<ToastOptions, "id"> {
  id: string;
  message: string;
  createdAt: number;
}

export interface ToastProviderProps {
  /** Children to render */
  children: React.ReactNode;
  /** Max visible toasts at once. Default: 5 */
  maxVisible?: number;
  /** Default duration for toasts without explicit duration. Default: 5000 */
  defaultDuration?: number;
  /** Called when a toast is added */
  onToastAdd?: (toast: Toast) => void;
  /** Called when a toast is removed */
  onToastRemove?: (toast: Toast) => void;
}

interface ToastContextValue {
  toasts: Toast[];
  toast: (message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

// ─── Variant Styles ─────────────────────────────────────────────────

const toastItemVariants = cva(
  [
    "relative flex items-start gap-3",
    "w-full max-w-sm",
    "rounded-lg border px-4 py-3",
    "bg-surface text-text-primary",
    "shadow-toast",
    "pointer-events-auto",
    "overflow-hidden",
  ],
  {
    variants: {
      variant: {
        success: "border-success-500",
        error: "border-danger-500",
        warning: "border-warning-500",
        info: "border-info-500",
      },
    },
    defaultVariants: {
      variant: "info",
    },
  },
);

// ─── Icon by Variant ────────────────────────────────────────────────

const variantIconMap: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-success-500 shrink-0" />,
  error: <XCircle className="h-5 w-5 text-danger-500 shrink-0" />,
  warning: <AlertTriangle className="h-5 w-5 text-warning-500 shrink-0" />,
  info: <Info className="h-5 w-5 text-info-500 shrink-0" />,
};

// ─── Position classes ───────────────────────────────────────────────

const positionClasses: Record<ToastPosition, string> = {
  "top-right": "top-0 right-0",
  "top-left": "top-0 left-0",
  "bottom-right": "bottom-0 right-0",
  "bottom-left": "bottom-0 left-0",
  "top-center": "top-0 left-1/2 -translate-x-1/2",
  "bottom-center": "bottom-0 left-1/2 -translate-x-1/2",
};

// ─── Context ────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Provider ───────────────────────────────────────────────────────

export function ToastProvider({
  children,
  maxVisible = DEFAULT_MAX_VISIBLE,
  defaultDuration = DEFAULT_DURATION,
  onToastAdd,
  onToastRemove,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const autoIdRef = useRef(0);

  const dismiss = useCallback(
    (id: string) => {
      setToasts((prev) => {
        const toast = prev.find((t) => t.id === id);
        return prev.filter((t) => t.id !== id);
      });
    },
    [],
  );

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const toast = useCallback(
    (message: string, options: ToastOptions = {}): string => {
      const id =
        options.id ?? `toast-${++autoIdRef.current}-${Date.now()}`;
      const newToast: Toast = {
        id,
        message,
        title: options.title,
        variant: options.variant ?? "info",
        duration: options.duration ?? defaultDuration,
        position: options.position ?? "bottom-right",
        dismissible: options.dismissible ?? true,
        icon: options.icon,
        action: options.action,
        createdAt: Date.now(),
      };

      setToasts((prev) => {
        // Upsert: replace existing toast with same ID
        const existingIndex = prev.findIndex((t) => t.id === id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = newToast;
          return updated;
        }

        // Enforce maxVisible: remove oldest if exceeding limit
        const next = [...prev, newToast];
        if (next.length > maxVisible) {
          return next.slice(next.length - maxVisible);
        }
        return next;
      });

      onToastAdd?.(newToast);

      return id;
    },
    [defaultDuration, maxVisible, onToastAdd],
  );

  const contextValue = useMemo<ToastContextValue>(
    () => ({ toasts, toast, dismiss, dismissAll }),
    [toasts, toast, dismiss, dismissAll],
  );

  // ── Group toasts by position ──────────────────────────────────
  const toastsByPosition = useMemo(() => {
    const grouped: Partial<Record<ToastPosition, Toast[]>> = {};
    for (const t of toasts) {
      const pos = t.position ?? "bottom-right";
      if (!grouped[pos]) grouped[pos] = [];
      grouped[pos]!.push(t);
    }
    return grouped;
  }, [toasts]);

  // ── Remove callback on unmount ────────────────────────────────
  useEffect(() => {
    if (!onToastRemove) return;
    // We track which toasts are removed by diffing
    // Instead, we handle this in the dismiss callback
  }, [onToastRemove]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Render toast viewports for each position */}
      {Object.entries(toastsByPosition).map(([position, positionToasts]) => (
        <ToastViewport
          key={position}
          position={position as ToastPosition}
          toasts={positionToasts}
          dismiss={dismiss}
          onToastRemove={onToastRemove}
        />
      ))}
    </ToastContext.Provider>
  );
}

// ─── ToastViewport ──────────────────────────────────────────────────

interface ToastViewportProps {
  position: ToastPosition;
  toasts: Toast[];
  dismiss: (id: string) => void;
  onToastRemove?: (toast: Toast) => void;
}

function ToastViewport({
  position,
  toasts,
  dismiss,
  onToastRemove,
}: ToastViewportProps) {
  return (
    <div
      data-slot="toast-viewport"
      aria-label="Notifications"
      className={cn(
        "fixed z-toast",
        "flex flex-col gap-2",
        "p-4 max-w-sm w-full",
        "pointer-events-none",
        positionClasses[position],
        position.startsWith("top") ? "items-end" : "items-end",
      )}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            toast={t}
            dismiss={dismiss}
            onToastRemove={onToastRemove}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ─── ToastItem ──────────────────────────────────────────────────────

interface ToastItemProps {
  toast: Toast;
  dismiss: (id: string) => void;
  onToastRemove?: (toast: Toast) => void;
}

function ToastItem({ toast, dismiss, onToastRemove }: ToastItemProps) {
  const [progress, setProgress] = useState(100);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const remainingRef = useRef<number>(toast.duration ?? 0);
  const isHoveredRef = useRef(false);
  const totalDurationRef = useRef(toast.duration ?? 0);

  const handleDismiss = useCallback(() => {
    dismiss(toast.id);
    onToastRemove?.(toast);
  }, [dismiss, toast.id, onToastRemove]);

  // ── Auto-dismiss timer ────────────────────────────────────────
  useEffect(() => {
    const duration = toast.duration;
    if (!duration || duration <= 0) return;

    totalDurationRef.current = duration;
    remainingRef.current = duration;
    startTimeRef.current = Date.now();
    setProgress(100);

    const tickInterval = 50;

    intervalRef.current = setInterval(() => {
      if (isHoveredRef.current) return;

      const elapsed = Date.now() - startTimeRef.current;
      const remaining = Math.max(0, duration - elapsed);
      remainingRef.current = remaining;
      const pct = (remaining / duration) * 100;
      setProgress(pct);

      if (remaining <= 0) {
        handleDismiss();
      }
    }, tickInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // Only re-run when duration changes (or on mount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.duration, handleDismiss]);

  // ── Mouse handlers for pause on hover ─────────────────────────
  const handleMouseEnter = useCallback(() => {
    isHoveredRef.current = true;
  }, []);

  const handleMouseLeave = useCallback(() => {
    isHoveredRef.current = false;
    if (toast.duration && toast.duration > 0) {
      // Adjust start time so that only remaining time counts
      startTimeRef.current =
        Date.now() - (totalDurationRef.current - remainingRef.current);
    }
  }, [toast.duration]);

  // ── Icon ──────────────────────────────────────────────────────
  const icon = toast.icon ?? (toast.variant ? variantIconMap[toast.variant] : variantIconMap.info);

  // ── ARIA role ─────────────────────────────────────────────────
  const role = toast.variant === "error" ? "alert" : "status";
  const ariaLive = toast.variant === "error" ? "assertive" : "polite";

  const hasProgress = toast.duration && toast.duration > 0;

  return (
    <motion.div
      role={role}
      aria-live={ariaLive}
      aria-atomic="true"
      className={cn(toastItemVariants({ variant: toast.variant }))}
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 32,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      layout
    >
      {/* Icon */}
      <div className="shrink-0 mt-0.5">{icon}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="text-sm font-semibold text-text-primary">
            {toast.title}
          </p>
        )}
        <p
          className={cn(
            "text-sm",
            toast.title ? "text-text-secondary" : "text-text-primary",
          )}
        >
          {toast.message}
        </p>

        {/* Action button */}
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onClick();
              handleDismiss();
            }}
            className={cn(
              "mt-1.5 text-xs font-medium",
              "text-brand-500 hover:text-brand-600",
              "focus-visible:outline-none focus-visible:underline",
              "transition-colors",
            )}
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Close button */}
      {toast.dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          className={cn(
            "shrink-0 -mr-1 -mt-0.5",
            "inline-flex items-center justify-center",
            "h-6 w-6 rounded",
            "text-text-tertiary hover:text-text-primary",
            "hover:bg-surface-secondary",
            "transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-border-focus focus-visible:ring-offset-1",
          )}
          aria-label="Dismiss toast"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}

      {/* Progress bar */}
      {hasProgress && (
        <div
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Toast auto-dismiss progress"
          className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden rounded-b-lg"
        >
          <div
            className={cn(
              "h-full transition-[width] duration-50 ease-linear",
              toast.variant === "success" && "bg-success-500/50",
              toast.variant === "error" && "bg-danger-500/50",
              toast.variant === "warning" && "bg-warning-500/50",
              toast.variant === "info" && "bg-info-500/50",
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </motion.div>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// ─── Exports ────────────────────────────────────────────────────────

export { toastItemVariants };
export default ToastProvider;
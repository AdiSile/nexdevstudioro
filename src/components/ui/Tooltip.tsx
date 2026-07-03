"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  createContext,
  useContext,
  useMemo,
} from "react";
import { createPortal } from "react-dom";
import { cva, type VariantProps } from "class-variance-authority";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SHOW_DELAY = 500; // ms
const DEFAULT_HIDE_DELAY = 200; // ms
const DEFAULT_SIDE_OFFSET = 6; // px from trigger
const ARROW_SIZE = 6; // px

// ---------------------------------------------------------------------------
// Variant Definitions
// ---------------------------------------------------------------------------

const tooltipContentVariants = cva(
  [
    "z-tooltip",
    "max-w-[280px]",
    "rounded-md px-3 py-1.5",
    "text-xs leading-5",
    "shadow-elevation-2",
    "pointer-events-none",
    "select-none",
    "break-words",
    "origin-[var(--radix-tooltip-content-transform-origin)]",
  ],
  {
    variants: {
      variant: {
        default: "bg-neutral-900 text-neutral-50",
        inverse: "bg-surface text-text-primary border border-border",
        info: "bg-info-500 text-white",
        warning: "bg-warning-500 text-white",
        danger: "bg-danger-500 text-white",
        success: "bg-success-500 text-white",
      },
      size: {
        sm: "max-w-[200px] px-2 py-1 text-[11px] leading-4",
        md: "max-w-[280px] px-3 py-1.5 text-xs leading-5",
        lg: "max-w-[360px] px-4 py-2 text-sm leading-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  },
);

// ---------------------------------------------------------------------------
// Animation Variants
// ---------------------------------------------------------------------------

const fadeSlideAnimations = {
  top: {
    hidden: { opacity: 0, y: 4, scale: 0.97 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.15, ease: [0.2, 0, 0, 1] },
    },
    exit: {
      opacity: 0,
      y: 4,
      scale: 0.97,
      transition: { duration: 0.1, ease: [0.4, 0, 1, 1] },
    },
  },
  bottom: {
    hidden: { opacity: 0, y: -4, scale: 0.97 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.15, ease: [0.2, 0, 0, 1] },
    },
    exit: {
      opacity: 0,
      y: -4,
      scale: 0.97,
      transition: { duration: 0.1, ease: [0.4, 0, 1, 1] },
    },
  },
  left: {
    hidden: { opacity: 0, x: 4, scale: 0.97 },
    visible: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: { duration: 0.15, ease: [0.2, 0, 0, 1] },
    },
    exit: {
      opacity: 0,
      x: 4,
      scale: 0.97,
      transition: { duration: 0.1, ease: [0.4, 0, 1, 1] },
    },
  },
  right: {
    hidden: { opacity: 0, x: -4, scale: 0.97 },
    visible: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: { duration: 0.15, ease: [0.2, 0, 0, 1] },
    },
    exit: {
      opacity: 0,
      x: -4,
      scale: 0.97,
      transition: { duration: 0.1, ease: [0.4, 0, 1, 1] },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TooltipSide = "top" | "bottom" | "left" | "right";
export type TooltipAlign = "start" | "center" | "end";
export type TooltipVariant = VariantProps<typeof tooltipContentVariants>["variant"];
export type TooltipSize = VariantProps<typeof tooltipContentVariants>["size"];

// ---------------------------------------------------------------------------
// Merge Refs Utility
// ---------------------------------------------------------------------------

function mergeRefs<T>(
  ...refs: Array<
    React.Ref<T> | React.MutableRefObject<T | null> | null | undefined
  >
): React.RefCallback<T> {
  return (value: T) => {
    refs.forEach((ref) => {
      if (typeof ref === "function") {
        ref(value);
      } else if (ref != null && "current" in ref) {
        (ref as React.MutableRefObject<T | null>).current = value;
      }
    });
  };
}

// ---------------------------------------------------------------------------
// Floating UI calculation (lightweight, no external dependency)
// ---------------------------------------------------------------------------

interface Position {
  x: number;
  y: number;
}

interface FloatingResult {
  tooltipPos: Position;
  arrowPos: { x: number; y: number };
  resolvedSide: TooltipSide;
  resolvedAlign: TooltipAlign;
}

function computeFloatingPosition(
  triggerRect: DOMRect,
  tooltipRect: { width: number; height: number },
  side: TooltipSide,
  align: TooltipAlign,
  sideOffset: number,
  arrowSize: number,
  viewport: { width: number; height: number },
  scrollX: number,
  scrollY: number,
): FloatingResult {
  let x = 0;
  let y = 0;
  let arrowX = 0;
  let arrowY = 0;

  const tw = tooltipRect.width;
  const th = tooltipRect.height;

  const triggerCenterX = triggerRect.left + triggerRect.width / 2;
  const triggerCenterY = triggerRect.top + triggerRect.height / 2;

  // Alignment offset
  const alignOffset = (() => {
    switch (align) {
      case "start":
        return side === "top" || side === "bottom"
          ? { x: -(triggerRect.width / 2) + (tw / 2), y: 0 }
          : { x: 0, y: -(triggerRect.height / 2) + (th / 2) };
      case "center":
        return { x: 0, y: 0 };
      case "end":
        return side === "top" || side === "bottom"
          ? { x: triggerRect.width / 2 - tw / 2, y: 0 }
          : { x: 0, y: triggerRect.height / 2 - th / 2 };
    }
  })();

  switch (side) {
    case "top": {
      x = triggerCenterX - tw / 2 + alignOffset.x;
      y = triggerRect.top - th - sideOffset;
      arrowX = triggerCenterX - x;
      arrowY = th;
      break;
    }
    case "bottom": {
      x = triggerCenterX - tw / 2 + alignOffset.x;
      y = triggerRect.bottom + sideOffset;
      arrowX = triggerCenterX - x;
      arrowY = -arrowSize;
      break;
    }
    case "left": {
      x = triggerRect.left - tw - sideOffset;
      y = triggerCenterY - th / 2 + alignOffset.y;
      arrowX = tw;
      arrowY = triggerCenterY - y;
      break;
    }
    case "right": {
      x = triggerRect.right + sideOffset;
      y = triggerCenterY - th / 2 + alignOffset.y;
      arrowX = -arrowSize;
      arrowY = triggerCenterY - y;
      break;
    }
  }

  // Constrain within viewport
  const padding = 8;

  // Try flipping if out of bounds
  let resolvedSide: TooltipSide = side;
  let resolvedAlign: TooltipAlign = align;

  // Flip vertically
  if (side === "top" && y < padding) {
    resolvedSide = "bottom";
    return computeFloatingPosition(
      triggerRect, tooltipRect, resolvedSide, align,
      sideOffset, arrowSize, viewport, scrollX, scrollY,
    );
  }
  if (side === "bottom" && y + th > viewport.height - padding) {
    resolvedSide = "top";
    return computeFloatingPosition(
      triggerRect, tooltipRect, resolvedSide, align,
      sideOffset, arrowSize, viewport, scrollX, scrollY,
    );
  }

  // Flip horizontally
  if (side === "left" && x < padding) {
    resolvedSide = "right";
    return computeFloatingPosition(
      triggerRect, tooltipRect, resolvedSide, align,
      sideOffset, arrowSize, viewport, scrollX, scrollY,
    );
  }
  if (side === "right" && x + tw > viewport.width - padding) {
    resolvedSide = "left";
    return computeFloatingPosition(
      triggerRect, tooltipRect, resolvedSide, align,
      sideOffset, arrowSize, viewport, scrollX, scrollY,
    );
  }

  // Clamp horizontally
  if (x < padding) {
    const diff = padding - x;
    x = padding;
    if (resolvedSide === "top" || resolvedSide === "bottom") {
      arrowX += diff;
    }
  }
  if (x + tw > viewport.width - padding) {
    const diff = x + tw - (viewport.width - padding);
    x = viewport.width - padding - tw;
    if (resolvedSide === "top" || resolvedSide === "bottom") {
      arrowX -= diff;
    }
  }

  // Clamp vertically
  if (y < padding) {
    const diff = padding - y;
    y = padding;
    if (resolvedSide === "left" || resolvedSide === "right") {
      arrowY += diff;
    }
  }
  if (y + th > viewport.height - padding) {
    const diff = y + th - (viewport.height - padding);
    y = viewport.height - padding - th;
    if (resolvedSide === "left" || resolvedSide === "right") {
      arrowY -= diff;
    }
  }

  // Clamp arrow within tooltip bounds
  if (resolvedSide === "top" || resolvedSide === "bottom") {
    arrowX = Math.max(arrowSize * 2, Math.min(arrowX, tw - arrowSize * 2));
  } else {
    arrowY = Math.max(arrowSize * 2, Math.min(arrowY, th - arrowSize * 2));
  }

  return {
    tooltipPos: { x: x + scrollX, y: y + scrollY },
    arrowPos: { x: arrowX, y: arrowY },
    resolvedSide,
    resolvedAlign,
  };
}

// ---------------------------------------------------------------------------
// Context: Tooltip Root
// ---------------------------------------------------------------------------

type TooltipRootContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  tooltipId: string;
  triggerId: string;
  side: TooltipSide;
  align: TooltipAlign;
  sideOffset: number;
  showDelay: number;
  hideDelay: number;
  showArrow: boolean;
  variant: TooltipVariant;
  size: TooltipSize;
  content: React.ReactNode;
  disableHoverableContent: boolean;
};

const TooltipRootContext = createContext<TooltipRootContextValue | null>(null);

function useTooltipRoot() {
  const ctx = useContext(TooltipRootContext);
  if (!ctx) {
    throw new Error(
      "Tooltip compound components must be used within <Tooltip.Root>.",
    );
  }
  return ctx;
}

// =============================================================================
// TOOLTIP.ROOT
// =============================================================================

type TooltipRootProps = {
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Default uncontrolled open state */
  defaultOpen?: boolean;
  /** Preferred side to render the tooltip */
  side?: TooltipSide;
  /** Preferred alignment relative to trigger */
  align?: TooltipAlign;
  /** Offset in px from the trigger element */
  sideOffset?: number;
  /** Delay before showing the tooltip (ms) */
  showDelay?: number;
  /** Delay before hiding the tooltip (ms) */
  hideDelay?: number;
  /** Whether to show the arrow */
  showArrow?: boolean;
  /** Visual variant */
  variant?: TooltipVariant;
  /** Size preset */
  size?: TooltipSize;
  /**
   * The content to display inside the tooltip.
   * Can be a string or ReactNode.
   */
  content?: React.ReactNode;
  /**
   * When true, hovering over the tooltip content itself does not dismiss it.
   * @default false (tooltip disappears when leaving trigger)
   */
  disableHoverableContent?: boolean;
  children: React.ReactNode;
};

const TooltipRoot = forwardRef<HTMLDivElement, TooltipRootProps>(
  (props, ref) => {
    const {
      open: openProp,
      onOpenChange,
      defaultOpen = false,
      side = "top",
      align = "center",
      sideOffset = DEFAULT_SIDE_OFFSET,
      showDelay = DEFAULT_SHOW_DELAY,
      hideDelay = DEFAULT_HIDE_DELAY,
      showArrow = true,
      variant = "default",
      size = "md",
      content,
      disableHoverableContent = false,
      children,
    } = props;

    const isControlled = openProp !== undefined;
    const [internalOpen, setInternalOpen] = useState(defaultOpen);
    const open = isControlled ? openProp : internalOpen;

    const setOpen = useCallback(
      (next: boolean) => {
        if (!isControlled) setInternalOpen(next);
        onOpenChange?.(next);
      },
      [isControlled, onOpenChange],
    );

    const triggerRef = useRef<HTMLElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const autoId = useId();
    const tooltipId = `${autoId}-tooltip`;
    const triggerId = `${autoId}-trigger`;

    const ctxValue = useMemo<TooltipRootContextValue>(
      () => ({
        open,
        setOpen,
        triggerRef,
        tooltipId,
        triggerId,
        side,
        align,
        sideOffset,
        showDelay,
        hideDelay,
        showArrow,
        variant,
        size,
        content,
        disableHoverableContent,
      }),
      [
        open,
        setOpen,
        tooltipId,
        triggerId,
        side,
        align,
        sideOffset,
        showDelay,
        hideDelay,
        showArrow,
        variant,
        size,
        content,
        disableHoverableContent,
      ],
    );

    return (
      <TooltipRootContext.Provider value={ctxValue}>
        <div ref={mergeRefs(ref, rootRef)} className="relative inline-flex">
          {children}
        </div>
      </TooltipRootContext.Provider>
    );
  },
);

TooltipRoot.displayName = "Tooltip.Root";

// =============================================================================
// TOOLTIP.TRIGGER
// =============================================================================

type TooltipTriggerProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-describedby" | "type"
> & {
  /** Render as child (wraps a single element and forwards props) */
  asChild?: boolean;
};

const TooltipTrigger = forwardRef<HTMLButtonElement, TooltipTriggerProps>(
  (props, ref) => {
    const {
      asChild = false,
      className,
      children,
      onMouseEnter,
      onMouseLeave,
      onFocus,
      onBlur,
      onKeyDown,
      ...rest
    } = props;

    const {
      open,
      setOpen,
      triggerRef,
      triggerId,
      tooltipId,
      showDelay,
      hideDelay,
    } = useTooltipRoot();

    const showTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Clear all timers
    const clearTimers = useCallback(() => {
      if (showTimer.current) {
        clearTimeout(showTimer.current);
        showTimer.current = null;
      }
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
    }, []);

    // Cleanup on unmount
    useEffect(() => clearTimers, [clearTimers]);

    // Handle Escape key to dismiss
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          clearTimers();
          setOpen(false);
        }
        onKeyDown?.(e);
      },
      [open, clearTimers, setOpen, onKeyDown],
    );

    // ── Hover handlers ───────────────────────────────────────
    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        clearTimers();
        showTimer.current = setTimeout(() => setOpen(true), showDelay);
        onMouseEnter?.(e);
      },
      [clearTimers, showDelay, setOpen, onMouseEnter],
    );

    const handleMouseLeave = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        clearTimers();
        hideTimer.current = setTimeout(() => setOpen(false), hideDelay);
        onMouseLeave?.(e);
      },
      [clearTimers, hideDelay, setOpen, onMouseLeave],
    );

    // ── Focus / Blur handlers ────────────────────────────────
    const handleFocus = useCallback(
      (e: React.FocusEvent<HTMLButtonElement>) => {
        clearTimers();
        // Show immediately on focus (no delay for keyboard users)
        setOpen(true);
        onFocus?.(e);
      },
      [clearTimers, setOpen, onFocus],
    );

    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLButtonElement>) => {
        clearTimers();
        setOpen(false);
        onBlur?.(e);
      },
      [clearTimers, setOpen, onBlur],
    );

    if (asChild) {
      // When asChild, clone the single child and inject props
      const child = React.Children.only(children) as React.ReactElement;
      return React.cloneElement(child, {
        ref: mergeRefs(
          ref,
          triggerRef as React.Ref<HTMLElement>,
          (child as any).ref,
        ),
        id: triggerId,
        "aria-describedby": open ? tooltipId : undefined,
        onMouseEnter: (e: React.MouseEvent) => {
          handleMouseEnter(e as any);
          (child.props as any).onMouseEnter?.(e);
        },
        onMouseLeave: (e: React.MouseEvent) => {
          handleMouseLeave(e as any);
          (child.props as any).onMouseLeave?.(e);
        },
        onFocus: (e: React.FocusEvent) => {
          handleFocus(e as any);
          (child.props as any).onFocus?.(e);
        },
        onBlur: (e: React.FocusEvent) => {
          handleBlur(e as any);
          (child.props as any).onBlur?.(e);
        },
        onKeyDown: (e: React.KeyboardEvent) => {
          handleKeyDown(e as any);
          (child.props as any).onKeyDown?.(e);
        },
        tabIndex: (child.props as any).tabIndex ?? 0,
      });
    }

    return (
      <button
        ref={mergeRefs(ref, triggerRef as React.Ref<HTMLButtonElement>)}
        type="button"
        id={triggerId}
        aria-describedby={open ? tooltipId : undefined}
        className={cn(
          "inline-flex cursor-default",
          "focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-border-focus focus-visible:ring-offset-2",
          "rounded-sm",
          className,
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        {children}
      </button>
    );
  },
);

TooltipTrigger.displayName = "Tooltip.Trigger";

// =============================================================================
// TOOLTIP.CONTENT
// =============================================================================

type TooltipContentProps = {
  /** Override the content passed at root level */
  children?: React.ReactNode;
  className?: string;
  /** Explicitly set the side (overrides root) */
  side?: TooltipSide;
  /** Explicitly set the align (overrides root) */
  align?: TooltipAlign;
};

const TooltipContent = forwardRef<HTMLDivElement, TooltipContentProps>(
  (props, ref) => {
    const { children, className, side: sideProp, align: alignProp } = props;

    const {
      open,
      setOpen,
      triggerRef,
      tooltipId,
      side: rootSide,
      align: rootAlign,
      sideOffset,
      showDelay,
      hideDelay,
      showArrow,
      variant,
      size,
      content: rootContent,
      disableHoverableContent,
    } = useTooltipRoot();

    const contentRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState<{
      tooltipPos: Position;
      arrowPos: Position;
      resolvedSide: TooltipSide;
      resolvedAlign: TooltipAlign;
    } | null>(null);

    const [isMounted, setIsMounted] = useState(false);
    const side = sideProp ?? rootSide;
    const align = alignProp ?? rootAlign;

    // Portal target
    const portalContainer =
      typeof document !== "undefined" ? document.body : null;

    useEffect(() => {
      setIsMounted(true);
    }, []);

    // Position recalculation
    const recalcPosition = useCallback(() => {
      if (!open || !contentRef.current || !triggerRef.current) return;

      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipEl = contentRef.current;

      // Temporarily make visible to measure
      const prevDisplay = tooltipEl.style.display;
      const prevVis = tooltipEl.style.visibility;
      tooltipEl.style.display = "block";
      tooltipEl.style.visibility = "hidden";
      const tooltipRect = tooltipEl.getBoundingClientRect();
      tooltipEl.style.display = prevDisplay;
      tooltipEl.style.visibility = prevVis;

      const result = computeFloatingPosition(
        triggerRect,
        { width: tooltipRect.width, height: tooltipRect.height },
        side,
        align,
        sideOffset,
        ARROW_SIZE,
        { width: window.innerWidth, height: window.innerHeight },
        window.scrollX,
        window.scrollY,
      );

      setPosition(result);
    }, [open, triggerRef, side, align, sideOffset]);

    useEffect(() => {
      if (!open) return;

      // Recalculate on open and on resize/scroll
      const raf = requestAnimationFrame(recalcPosition);

      const onResize = () => recalcPosition();
      window.addEventListener("resize", onResize, { passive: true });
      window.addEventListener("scroll", onResize, { passive: true, capture: true });

      return () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
        window.removeEventListener("scroll", onResize, { capture: true });
      };
    }, [open, recalcPosition]);

    // Dismiss on Escape
    useEffect(() => {
      if (!open) return;

      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setOpen(false);
          triggerRef.current?.focus();
        }
      };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }, [open, setOpen, triggerRef]);

    const displayContent = children ?? rootContent;

    if (!isMounted || !portalContainer || !open || !displayContent) {
      return null;
    }

    // Determine arrow visibility
    const arrowSide = position?.resolvedSide ?? side;
    const arrowVisible = showArrow;

    // Arrow positioning styles
    const arrowStyle: React.CSSProperties = position
      ? {
          left: arrowSide === "top" || arrowSide === "bottom"
            ? `${position.arrowPos.x}px`
            : arrowSide === "left"
              ? `calc(100% + ${ARROW_SIZE}px)`
              : `-${ARROW_SIZE}px`,
          top: arrowSide === "left" || arrowSide === "right"
            ? `${position.arrowPos.y}px`
            : arrowSide === "top"
              ? `calc(100% + ${ARROW_SIZE}px)`
              : `-${ARROW_SIZE}px`,
        }
      : {};

    // Arrow border triangle direction
    const arrowDirectionClass = (() => {
      switch (arrowSide) {
        case "top":
          return "border-t-neutral-900 border-l-transparent border-r-transparent border-b-transparent";
        case "bottom":
          return "border-b-neutral-900 border-l-transparent border-r-transparent border-t-transparent";
        case "left":
          return "border-l-neutral-900 border-t-transparent border-b-transparent border-r-transparent";
        case "right":
          return "border-r-neutral-900 border-t-transparent border-b-transparent border-l-transparent";
      }
    })();

    // Variant-specific arrow color
    const arrowVariantColor = (() => {
      if (variant === "default") return "";
      switch (variant) {
        case "inverse":
          switch (arrowSide) {
            case "top": return "border-t-surface";
            case "bottom": return "border-b-surface";
            case "left": return "border-l-surface";
            case "right": return "border-r-surface";
          }
          break;
        case "info":
          switch (arrowSide) {
            case "top": return "border-t-info-500";
            case "bottom": return "border-b-info-500";
            case "left": return "border-l-info-500";
            case "right": return "border-r-info-500";
          }
          break;
        case "warning":
          switch (arrowSide) {
            case "top": return "border-t-warning-500";
            case "bottom": return "border-b-warning-500";
            case "left": return "border-l-warning-500";
            case "right": return "border-r-warning-500";
          }
          break;
        case "danger":
          switch (arrowSide) {
            case "top": return "border-t-danger-500";
            case "bottom": return "border-b-danger-500";
            case "left": return "border-l-danger-500";
            case "right": return "border-r-danger-500";
          }
          break;
        case "success":
          switch (arrowSide) {
            case "top": return "border-t-success-500";
            case "bottom": return "border-b-success-500";
            case "left": return "border-l-success-500";
            case "right": return "border-r-success-500";
          }
          break;
      }
      return "";
    })();

    const animation = fadeSlideAnimations[arrowSide];

    // Hover over content keeps it open (when disableHoverableContent is false)
    const handleContentMouseEnter = useCallback(() => {
      // Cancel any pending hide timer
      // This is handled by clearTimers pattern, but since tooltip is a portal,
      // we rely on the context setOpen directly
    }, []);

    const handleContentMouseLeave = useCallback(() => {
      if (!disableHoverableContent) {
        setTimeout(() => setOpen(false), hideDelay);
      }
    }, [disableHoverableContent, hideDelay, setOpen]);

    return createPortal(
      <AnimatePresence>
        {open && (
          <motion.div
            ref={mergeRefs(ref, contentRef)}
            id={tooltipId}
            role="tooltip"
            aria-hidden={!open}
            className={cn(
              tooltipContentVariants({ variant, size }),
              "fixed", // Use fixed positioning since we compute absolute coords
              className,
            )}
            style={
              position
                ? {
                    left: `${position.tooltipPos.x}px`,
                    top: `${position.tooltipPos.y}px`,
                  }
                : { visibility: "hidden" }
            }
            variants={animation}
            initial="hidden"
            animate="visible"
            exit="exit"
            // Allow hovering over the tooltip to keep it visible
            onMouseEnter={handleContentMouseEnter}
            onMouseLeave={handleContentMouseLeave}
          >
            {displayContent}

            {/* Arrow */}
            {arrowVisible && (
              <div
                className={cn(
                  "absolute w-0 h-0",
                  "border-[5px]",
                  arrowDirectionClass,
                  arrowVariantColor,
                )}
                style={arrowStyle}
                aria-hidden="true"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>,
      portalContainer,
    );
  },
);

TooltipContent.displayName = "Tooltip.Content";

// =============================================================================
// TOOLTIP (convenience wrapper — single-element, simple API)
// =============================================================================

type TooltipProps = {
  /** The element that triggers the tooltip on hover/focus */
  children: React.ReactNode;
  /** Content to show inside the tooltip (string or ReactNode) */
  content: React.ReactNode;
  /** Preferred side */
  side?: TooltipSide;
  /** Preferred alignment */
  align?: TooltipAlign;
  /** Offset from trigger in px. @default 6 */
  sideOffset?: number;
  /** Show delay in ms. @default 500 */
  showDelay?: number;
  /** Hide delay in ms. @default 200 */
  hideDelay?: number;
  /** Whether to show the arrow. @default true */
  showArrow?: boolean;
  /** Visual variant */
  variant?: TooltipVariant;
  /** Size preset */
  size?: TooltipSize;
  /** Whether to allow hovering over the tooltip content. @default false */
  disableHoverableContent?: boolean;
  /**
   * Whether to render the trigger as a child (passes props to the single child
   * element instead of wrapping in a button). @default true
   */
  asChild?: boolean;
  /** Controlled open state */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Default open state */
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
};

const TooltipComponent = forwardRef<HTMLDivElement, TooltipProps>(
  (props, ref) => {
    const {
      children,
      content,
      side = "top",
      align = "center",
      sideOffset,
      showDelay,
      hideDelay,
      showArrow,
      variant,
      size,
      disableHoverableContent,
      asChild = true,
      open,
      onOpenChange,
      defaultOpen,
      className,
      contentClassName,
    } = props;

    return (
      <TooltipRoot
        ref={ref}
        side={side}
        align={align}
        sideOffset={sideOffset}
        showDelay={showDelay}
        hideDelay={hideDelay}
        showArrow={showArrow}
        variant={variant}
        size={size}
        content={content}
        disableHoverableContent={disableHoverableContent}
        open={open}
        onOpenChange={onOpenChange}
        defaultOpen={defaultOpen}
      >
        <TooltipTrigger asChild={asChild} className={className}>
          {children}
        </TooltipTrigger>
        <TooltipContent className={contentClassName} />
      </TooltipRoot>
    );
  },
);

TooltipComponent.displayName = "Tooltip";

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

type TooltipCompound = typeof TooltipComponent & {
  Root: typeof TooltipRoot;
  Trigger: typeof TooltipTrigger;
  Content: typeof TooltipContent;
};

const Tooltip = TooltipComponent as TooltipCompound;
Tooltip.Root = TooltipRoot;
Tooltip.Trigger = TooltipTrigger;
Tooltip.Content = TooltipContent;

export {
  Tooltip,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
  tooltipContentVariants,
};

export type {
  TooltipProps,
  TooltipRootProps,
  TooltipTriggerProps,
  TooltipContentProps,
  TooltipSide,
  TooltipAlign,
  TooltipVariant,
  TooltipSize,
};

export default Tooltip;
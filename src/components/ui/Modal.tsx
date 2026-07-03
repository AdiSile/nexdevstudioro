"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cva } from "class-variance-authority";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

// ─── Focus Trap — Tab-able selectors ─────────────────────────────────
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
  "details summary",
  "[contenteditable]:not([contenteditable='false'])",
].join(", ");

// ─── Variant Definitions ────────────────────────────────────────────

const modalOverlayVariants = cva(
  [
    "fixed inset-0 z-modal",
    "flex items-center justify-center",
    "p-gutter sm:p-gutter-md",
  ],
  {
    variants: {
      overlay: {
        default: "bg-surface-overlay backdrop-blur-sm",
        transparent: "bg-transparent",
        dark: "bg-neutral-950/70 backdrop-blur-sm",
        none: "",
      },
    },
    defaultVariants: {
      overlay: "default",
    },
  },
);

const modalContentVariants = cva(
  [
    "relative flex flex-col",
    "bg-surface text-text-primary",
    "shadow-modal",
    "border border-border-subtle",
    "focus:outline-none",
    "overflow-hidden",
  ],
  {
    variants: {
      size: {
        xs: "w-full max-w-xs rounded-lg",
        sm: "w-full max-w-modal-sm rounded-lg",
        md: "w-full max-w-modal-md rounded-xl",
        lg: "w-full max-w-modal-lg rounded-xl",
        xl: "w-full max-w-4xl rounded-xl",
        fullscreen: [
          "w-full h-full max-w-none rounded-none",
          "m-0",
        ],
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

// ─── Animation Variants ─────────────────────────────────────────────

const overlayAnimations = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15, ease: [0.4, 0, 1, 1] },
  },
};

const contentAnimations = {
  scale: {
    hidden: { opacity: 0, scale: 0.95 },
    visible: {
      opacity: 1,
      scale: 1,
      transition: { duration: 0.2, ease: [0.2, 0, 0, 1] },
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: { duration: 0.15, ease: [0.4, 0, 1, 1] },
    },
  },
  slideUp: {
    hidden: { opacity: 0, y: 24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.25, ease: [0.2, 0, 0, 1] },
    },
    exit: {
      opacity: 0,
      y: 24,
      transition: { duration: 0.15, ease: [0.4, 0, 1, 1] },
    },
  },
  slideDown: {
    hidden: { opacity: 0, y: -24 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.25, ease: [0.2, 0, 0, 1] },
    },
    exit: {
      opacity: 0,
      y: -24,
      transition: { duration: 0.15, ease: [0.4, 0, 1, 1] },
    },
  },
  slideLeft: {
    hidden: { opacity: 0, x: 24 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.25, ease: [0.2, 0, 0, 1] },
    },
    exit: {
      opacity: 0,
      x: 24,
      transition: { duration: 0.15, ease: [0.4, 0, 1, 1] },
    },
  },
  slideRight: {
    hidden: { opacity: 0, x: -24 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.25, ease: [0.2, 0, 0, 1] },
    },
    exit: {
      opacity: 0,
      x: -24,
      transition: { duration: 0.15, ease: [0.4, 0, 1, 1] },
    },
  },
  fade: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
    },
    exit: {
      opacity: 0,
      transition: { duration: 0.15, ease: [0.4, 0, 1, 1] },
    },
  },
  none: {
    hidden: {},
    visible: {},
    exit: {},
  },
} as const;

export type ModalAnimation = keyof typeof contentAnimations;
export type ModalOverlay = "default" | "transparent" | "dark" | "none";
export type ModalSize = "xs" | "sm" | "md" | "lg" | "xl" | "fullscreen";

// ─── Types ──────────────────────────────────────────────────────────

export interface ModalHandles {
  /** Focus the first focusable element inside the modal */
  focusFirst: () => void;
  /** Focus a specific element by selector inside the modal */
  focusSelector: (selector: string) => void;
}

type ModalBaseProps = {
  /** Controlled open state */
  open: boolean;
  /** Called when the modal requests to close */
  onClose: () => void;
  /**
   * Animation preset.
   * - `scale` – centered scale + fade (default)
   * - `slideUp` / `slideDown` / `slideLeft` / `slideRight` – directional
   * - `fade` – opacity only
   * - `none` – no animation
   */
  animation?: ModalAnimation;
  /** Size preset */
  size?: ModalSize;
  /** Overlay variant (transparent, dark, none) */
  overlay?: ModalOverlay;
  /** Show close button in top-right corner. Default: true */
  showCloseButton?: boolean;
  /**
   * Close on Escape key.
   * @default true
   */
  closeOnEscape?: boolean;
  /**
   * Close when clicking overlay background.
   * @default true
   */
  closeOnOverlayClick?: boolean;
  /** Lock body scroll when open. @default true */
  lockScroll?: boolean;
  /**
   * Element to receive focus when modal closes.
   * Defaults to the element that was focused before the modal opened.
   */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
  /**
   * ARIA label for the dialog. Required if no `aria-labelledby`.
   * Provide either `title` (renders visually) or `aria-label`.
   */
  "aria-label"?: string;
  /**
   * ID of the element that labels the dialog.
   * Provide either this, or `aria-label`.
   */
  "aria-labelledby"?: string;
  /**
   * ID of the element that describes the dialog.
   */
  "aria-describedby"?: string;
  /** Custom class for the overlay element */
  className?: string;
  /** Custom class for the content panel */
  contentClassName?: string;
  /**
   * Render into a specific container.
   * If omitted, renders into `document.body` via portal.
   */
  container?: HTMLElement | null;
  /** Close button aria-label (localized). Default: "Close modal" */
  closeLabel?: string;
  /** Modal title rendered in the header (also used as fallback aria-labelledby) */
  title?: string;
  /** Optional description rendered below title */
  description?: string;
  /** Header content (replaces default header with title/description) */
  header?: React.ReactNode;
  /** Footer content (pinned to bottom, separated by border) */
  footer?: React.ReactNode;
  /** Body content */
  children?: React.ReactNode;
};

export type ModalProps = ModalBaseProps &
  Omit<React.HTMLAttributes<HTMLDivElement>, keyof ModalBaseProps>;

// ─── Component ──────────────────────────────────────────────────────

const Modal = forwardRef<ModalHandles, ModalProps>((props, ref) => {
  const {
    open,
    onClose,
    animation = "scale",
    size = "md",
    overlay: overlayVariant = "default",
    showCloseButton = true,
    closeOnEscape = true,
    closeOnOverlayClick = true,
    lockScroll = true,
    returnFocusRef,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
    "aria-describedby": ariaDescribedby,
    className,
    contentClassName,
    container,
    closeLabel,
    title,
    description,
    header,
    footer,
    children,
    ...rest
  } = props;

  // ── IDs ────────────────────────────────────────────────────────
  const autoId = useId();
  const titleId = ariaLabelledby ?? (title ? `${autoId}-title` : undefined);
  const descriptionId = ariaDescribedby ?? (description ? `${autoId}-desc` : undefined);

  // ── Refs ───────────────────────────────────────────────────────
  const contentRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const portalContainer =
    container ?? (typeof document !== "undefined" ? document.body : null);

  // ── Imperative handle ──────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    focusFirst: () => {
      if (!contentRef.current) return;
      const first = contentRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      first?.focus();
    },
    focusSelector: (selector: string) => {
      if (!contentRef.current) return;
      const el = contentRef.current.querySelector<HTMLElement>(selector);
      el?.focus();
    },
  }));

  // ── Scroll lock ────────────────────────────────────────────────
  useEffect(() => {
    if (!lockScroll || typeof document === "undefined") return;

    if (open) {
      const scrollbarWidth =
        window.innerWidth - document.documentElement.clientWidth;
      const originalOverflow = document.body.style.overflow;
      const originalPaddingRight = document.body.style.paddingRight;

      document.body.style.overflow = "hidden";
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }

      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.paddingRight = originalPaddingRight;
      };
    }
  }, [open, lockScroll]);

  // ── Focus management ───────────────────────────────────────────
  useEffect(() => {
    if (open) {
      // Save the currently focused element
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Focus the first focusable element inside the modal (or the content itself)
      requestAnimationFrame(() => {
        if (!contentRef.current) return;
        const first = contentRef.current.querySelector<HTMLElement>(
          FOCUSABLE_SELECTOR,
        );
        if (first) {
          first.focus();
        } else {
          contentRef.current.focus();
        }
      });
    } else {
      // Return focus to the previously focused element
      const target =
        returnFocusRef?.current ?? previousActiveElement.current;
      if (target && typeof target.focus === "function") {
        requestAnimationFrame(() => target.focus());
      }
    }
  }, [open, returnFocusRef]);

  // ── Focus trap ─────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Escape to close
      if (closeOnEscape && e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }

      // Focus trap: Tab / Shift+Tab
      if (e.key !== "Tab" || !contentRef.current) return;

      const focusable = Array.from(
        contentRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );

      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (e.shiftKey) {
        // Shift+Tab
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [closeOnEscape, onClose],
  );

  // ── Overlay click ──────────────────────────────────────────────
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (!closeOnOverlayClick) return;
      // Only close if the click was on the overlay itself, not content
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [closeOnOverlayClick, onClose],
  );

  // ── Prevent SSR portal rendering ───────────────────────────────
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted || !portalContainer) {
    // SSR fallback: render nothing
    return null;
  }

  // ── Animation config ───────────────────────────────────────────
  const contentAnim = contentAnimations[animation];

  // ── Overlay classes ────────────────────────────────────────────
  const overlayClassName = cn(modalOverlayVariants({ overlay: overlayVariant }), className);

  // ── Content classes ────────────────────────────────────────────
  const panelClassName = cn(modalContentVariants({ size }), contentClassName);

  // ── Render ─────────────────────────────────────────────────────
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={overlayClassName}
          variants={overlayAnimations}
          initial="hidden"
          animate="visible"
          exit="exit"
          aria-hidden="true"
          onClick={handleOverlayClick}
        >
          <motion.div
            ref={contentRef}
            role="dialog"
            aria-modal="true"
            aria-label={!titleId ? ariaLabel : undefined}
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            tabIndex={-1}
            className={panelClassName}
            variants={contentAnim}
            initial="hidden"
            animate="visible"
            exit="exit"
            onKeyDown={handleKeyDown}
            {...rest}
          >
            {/* ── Close button ──────────────────────────────── */}
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className={cn(
                  "absolute top-3 right-3 z-10",
                  "inline-flex items-center justify-center",
                  "h-8 w-8 rounded-md",
                  "text-text-tertiary hover:text-text-primary",
                  "hover:bg-surface-secondary",
                  "transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2",
                  "focus-visible:ring-border-focus focus-visible:ring-offset-2",
                )}
                aria-label={closeLabel ?? "Close modal"}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}

            {/* ── Header ────────────────────────────────────── */}
            {header !== undefined ? (
              header
            ) : title || description ? (
              <div className="px-6 pt-6 pb-0">
                {title && (
                  <h2
                    id={titleId}
                    className="text-lg font-semibold text-text-primary"
                  >
                    {title}
                  </h2>
                )}
                {description && (
                  <p
                    id={descriptionId}
                    className="mt-1 text-sm text-text-secondary"
                  >
                    {description}
                  </p>
                )}
              </div>
            ) : null}

            {/* ── Body ──────────────────────────────────────── */}
            <div
              className={cn(
                "flex-1 overflow-y-auto",
                "px-6 py-5",
                // Pad top less if header exists
                (title || description || header !== undefined) && "pt-4",
              )}
            >
              {children}
            </div>

            {/* ── Footer ─────────────────────────────────────── */}
            {footer && (
              <div
                className={cn(
                  "flex items-center justify-end gap-3",
                  "px-6 py-4",
                  "border-t border-border-subtle",
                  "bg-surface-secondary/50",
                )}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalContainer,
  );
});

Modal.displayName = "Modal";

export { Modal, modalOverlayVariants, modalContentVariants };
export default Modal;
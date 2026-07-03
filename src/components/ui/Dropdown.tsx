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
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import { Check, ChevronRight, ChevronDown } from "lucide-react";

// ─── Constants ──────────────────────────────────────────────────────
const TYPEAHEAD_TIMEOUT = 500;

// ─── Variant Definitions ────────────────────────────────────────────

const dropdownMenuVariants = cva(
  [
    "absolute z-dropdown",
    "min-w-[180px]",
    "bg-surface text-text-primary",
    "rounded-md border border-border-subtle",
    "shadow-elevation-3",
    "overflow-hidden",
    "py-1",
    "origin-top-right",
  ],
  {
    variants: {
      size: {
        sm: "min-w-[140px] text-xs",
        md: "min-w-[180px] text-sm",
        lg: "min-w-[220px] text-base",
      },
      align: {
        start: "left-0",
        center: "left-1/2 -translate-x-1/2",
        end: "right-0",
      },
    },
    defaultVariants: {
      size: "md",
      align: "end",
    },
  },
);

const dropdownItemVariants = cva(
  [
    "relative flex w-full cursor-pointer select-none items-center",
    "rounded-sm",
    "text-text-primary",
    "outline-none",
    "transition-colors duration-100",
    "data-disabled:pointer-events-none data-disabled:opacity-50",
    "data-highlighted:bg-surface-secondary data-highlighted:text-text-primary",
  ],
  {
    variants: {
      size: {
        sm: "h-7 px-2 text-xs gap-1.5",
        md: "h-9 px-2 text-sm gap-2",
        lg: "h-11 px-3 text-base gap-2.5",
      },
      inset: {
        true: "pl-8",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const dropdownSeparatorVariants = cva("mx-1 my-1 h-px bg-border-subtle", {
  variants: {
    size: {
      sm: "mx-1",
      md: "mx-1",
      lg: "mx-2",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

const dropdownLabelVariants = cva(
  [
    "px-2 py-1.5",
    "text-text-tertiary font-medium",
    "select-none pointer-events-none",
  ],
  {
    variants: {
      size: {
        sm: "px-2 py-1 text-[10px]",
        md: "px-2 py-1.5 text-xs",
        lg: "px-3 py-2 text-sm",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

// ─── Types ──────────────────────────────────────────────────────────

type DropdownSize = "sm" | "md" | "lg";
type DropdownAlign = "start" | "center" | "end";

// ─── Ref Merger Utility ─────────────────────────────────────────────

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

// ─── Item Counter (global, per render) ──────────────────────────────
let globalItemCounter = 0;
function useItemIndex() {
  const indexRef = useRef(-1);
  if (indexRef.current === -1) {
    indexRef.current = globalItemCounter++;
  }
  return indexRef;
}

// =====================================================================
// ROOT DROPDOWN CONTEXT
// =====================================================================

type RootDropdownContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  size: DropdownSize;
  align: DropdownAlign;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  menuId: string;
  triggerId: string;
  closeOnSelect: boolean;
  modal: boolean;
};

const RootDropdownContext = createContext<RootDropdownContextValue | null>(
  null,
);

function useRootDropdown() {
  const ctx = useContext(RootDropdownContext);
  if (!ctx) {
    throw new Error(
      "Dropdown compound components must be used within <Dropdown>.",
    );
  }
  return ctx;
}

// =====================================================================
// MENU NAVIGATION CONTEXT (per-menu: root menu or submenu)
// =====================================================================

type MenuNavContextValue = {
  activeIndex: number;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
  registerItem: (index: number, el: HTMLElement, label: string) => void;
  unregisterItem: (index: number) => void;
  activateItem: (index: number) => void;
  focusedMenuRef: React.RefObject<HTMLDivElement | null>;
  isActive: boolean;
  setIsActive: (v: boolean) => void;
};

const MenuNavContext = createContext<MenuNavContextValue | null>(null);

function useMenuNav() {
  const ctx = useContext(MenuNavContext);
  if (!ctx) {
    throw new Error("Dropdown.Menu or SubmenuContent required.");
  }
  return ctx;
}

function useOptionalMenuNav() {
  return useContext(MenuNavContext);
}

// =====================================================================
// FOCUSED MENU TRACKER (which menu receives keyboard events)
// =====================================================================

type FocusedMenuContextValue = {
  activeMenuId: string | null;
  requestFocus: (id: string) => void;
  releaseFocus: (id: string) => void;
};

const FocusedMenuContext = createContext<FocusedMenuContextValue>({
  activeMenuId: null,
  requestFocus: () => {},
  releaseFocus: () => {},
});

// =====================================================================
// DROPDOWN
// =====================================================================

type DropdownProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  size?: DropdownSize;
  align?: DropdownAlign;
  sideOffset?: number;
  closeOnSelect?: boolean;
  modal?: boolean;
  children: React.ReactNode;
};

const DropdownComponent = forwardRef<HTMLDivElement, DropdownProps>(
  (props, ref) => {
    const {
      open: openProp,
      onOpenChange,
      defaultOpen = false,
      size = "md",
      align = "end",
      closeOnSelect = true,
      modal = true,
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

    const triggerRef = useRef<HTMLButtonElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const autoId = useId();
    const menuId = `${autoId}-menu`;
    const triggerId = `${autoId}-trigger`;

    // Which submenu (or root) currently has keyboard focus
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

    const requestFocus = useCallback((id: string) => {
      setActiveMenuId(id);
    }, []);

    const releaseFocus = useCallback(
      (id: string) => {
        setActiveMenuId((prev) => (prev === id ? null : prev));
      },
      [],
    );

    // ── Close on Escape ──────────────────────────────────────────
    useEffect(() => {
      if (!open) return;
      const handler = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          e.preventDefault();
          setOpen(false);
          triggerRef.current?.focus();
        }
      };
      document.addEventListener("keydown", handler);
      return () => document.removeEventListener("keydown", handler);
    }, [open, setOpen]);

    // ── Close on outside click ───────────────────────────────────
    useEffect(() => {
      if (!open) return;
      const handler = (e: MouseEvent) => {
        if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };
      const timer = setTimeout(() => {
        document.addEventListener("mousedown", handler);
      }, 0);
      return () => {
        clearTimeout(timer);
        document.removeEventListener("mousedown", handler);
      };
    }, [open, setOpen]);

    const rootCtx: RootDropdownContextValue = {
      open,
      setOpen,
      size,
      align,
      triggerRef,
      menuId,
      triggerId,
      closeOnSelect,
      modal,
    };

    const focusCtx: FocusedMenuContextValue = {
      activeMenuId,
      requestFocus,
      releaseFocus,
    };

    return (
      <RootDropdownContext.Provider value={rootCtx}>
        <FocusedMenuContext.Provider value={focusCtx}>
          <div
            ref={mergeRefs(ref, rootRef)}
            className="relative inline-block"
            data-dropdown-root=""
          >
            {children}
          </div>
        </FocusedMenuContext.Provider>
      </RootDropdownContext.Provider>
    );
  },
);

DropdownComponent.displayName = "Dropdown";

// =====================================================================
// DROPDOWN.TRIGGER
// =====================================================================

type DropdownTriggerProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "aria-expanded" | "aria-haspopup" | "aria-controls" | "type" | "id"
> & {
  showChevron?: boolean;
};

const DropdownTrigger = forwardRef<HTMLButtonElement, DropdownTriggerProps>(
  (props, ref) => {
    const {
      showChevron = true,
      className,
      children,
      onClick,
      onKeyDown,
      ...rest
    } = props;
    const { open, setOpen, triggerRef, triggerId, menuId } = useRootDropdown();

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        setOpen(!open);
        onClick?.(e);
      },
      [open, setOpen, onClick],
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          if (!open) setOpen(true);
          return;
        }
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen(!open);
          return;
        }
        onKeyDown?.(e);
      },
      [open, setOpen, onKeyDown],
    );

    return (
      <button
        ref={mergeRefs(ref, triggerRef)}
        type="button"
        id={triggerId}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        className={cn(
          "inline-flex items-center justify-between gap-1.5",
          "rounded-md px-3 py-1.5",
          "text-sm font-medium text-text-primary",
          "bg-surface border border-border",
          "hover:bg-surface-secondary",
          "focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-border-focus focus-visible:ring-offset-2",
          "transition-colors duration-150",
          className,
        )}
        {...rest}
      >
        {children ?? "Options"}
        {showChevron && (
          <ChevronDown
            className={cn(
              "h-4 w-4 text-text-tertiary transition-transform duration-200",
              open && "rotate-180",
            )}
            aria-hidden="true"
          />
        )}
      </button>
    );
  },
);

DropdownTrigger.displayName = "Dropdown.Trigger";

// =====================================================================
// DROPDOWN.MENU
// =====================================================================

type DropdownMenuProps = {
  className?: string;
  align?: DropdownAlign;
  sideOffset?: number;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children: React.ReactNode;
};

const DropdownMenu = forwardRef<HTMLDivElement, DropdownMenuProps>(
  (props, ref) => {
    const {
      className,
      align: alignProp,
      sideOffset = 4,
      "aria-label": ariaLabel,
      "aria-labelledby": ariaLabelledby,
      children,
    } = props;

    const root = useRootDropdown();
    const menuRef = useRef<HTMLDivElement>(null);
    const menuNavId = useId();

    // ── Navigation state ────────────────────────────────────────
    const [activeIndex, setActiveIndex] = useState(-1);
    const itemsMap = useRef<Map<number, { el: HTMLElement; label: string }>>(
      new Map(),
    );
    const typeaheadBuffer = useRef<{
      chars: string;
      timer: ReturnType<typeof setTimeout> | null;
    }>({ chars: "", timer: null });

    // Focused menu tracking
    const { activeMenuId, requestFocus, releaseFocus } =
      useContext(FocusedMenuContext);
    const isActive = activeMenuId === menuNavId || activeMenuId === null;

    // When this menu mounts, request focus
    useEffect(() => {
      if (root.open) {
        requestFocus(menuNavId);
        setActiveIndex(-1);
        return () => releaseFocus(menuNavId);
      }
    }, [root.open, menuNavId, requestFocus, releaseFocus]);

    const registerItem = useCallback(
      (index: number, el: HTMLElement, label: string) => {
        itemsMap.current.set(index, { el, label });
      },
      [],
    );

    const unregisterItem = useCallback((index: number) => {
      itemsMap.current.delete(index);
    }, []);

    const activateItem = useCallback(
      (index: number) => {
        const entry = itemsMap.current.get(index);
        if (entry && entry.el.getAttribute("data-disabled") !== "true") {
          entry.el.click();
        }
      },
      [],
    );

    // ── Keyboard handler (only when this menu is active) ────────
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (!isActive) return;

        const total = itemsMap.current.size;
        if (total === 0) return;

        const indices = Array.from(itemsMap.current.keys()).sort(
          (a, b) => a - b,
        );
        const currentPos = indices.indexOf(activeIndex);

        const findNext = (
          current: number,
          direction: 1 | -1,
        ): number | null => {
          let pos = current;
          for (let i = 0; i < total; i++) {
            pos += direction;
            if (pos < 0) pos = total - 1;
            if (pos >= total) pos = 0;
            const idx = indices[pos];
            const entry = itemsMap.current.get(idx);
            if (
              entry &&
              entry.el.getAttribute("data-disabled") !== "true"
            ) {
              return idx;
            }
          }
          return null;
        };

        switch (e.key) {
          case "ArrowDown": {
            e.preventDefault();
            e.stopPropagation();
            const next = currentPos === -1 ? indices[0] : findNext(currentPos, 1);
            if (next !== null) setActiveIndex(next);
            break;
          }
          case "ArrowUp": {
            e.preventDefault();
            e.stopPropagation();
            const next =
              currentPos === -1
                ? indices[total - 1]
                : findNext(currentPos, -1);
            if (next !== null) setActiveIndex(next);
            break;
          }
          case "Home": {
            e.preventDefault();
            e.stopPropagation();
            for (const idx of indices) {
              const entry = itemsMap.current.get(idx);
              if (entry && entry.el.getAttribute("data-disabled") !== "true") {
                setActiveIndex(idx);
                break;
              }
            }
            break;
          }
          case "End": {
            e.preventDefault();
            e.stopPropagation();
            for (let i = indices.length - 1; i >= 0; i--) {
              const idx = indices[i];
              const entry = itemsMap.current.get(idx);
              if (entry && entry.el.getAttribute("data-disabled") !== "true") {
                setActiveIndex(idx);
                break;
              }
            }
            break;
          }
          case "Enter":
          case " ": {
            e.preventDefault();
            e.stopPropagation();
            if (activeIndex >= 0) activateItem(activeIndex);
            break;
          }
          default: {
            // Type-ahead
            if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
              const char = e.key.toLowerCase();
              if (typeaheadBuffer.current.timer)
                clearTimeout(typeaheadBuffer.current.timer);
              typeaheadBuffer.current.chars += char;
              typeaheadBuffer.current.timer = setTimeout(() => {
                typeaheadBuffer.current.chars = "";
              }, TYPEAHEAD_TIMEOUT);

              const search = typeaheadBuffer.current.chars.toLowerCase();
              const startPos = currentPos === -1 ? 0 : currentPos + 1;

              for (let i = 0; i < total; i++) {
                const pos = (startPos + i) % total;
                const idx = indices[pos];
                const entry = itemsMap.current.get(idx);
                if (
                  entry &&
                  entry.el.getAttribute("data-disabled") !== "true" &&
                  entry.label.toLowerCase().startsWith(search)
                ) {
                  setActiveIndex(idx);
                  break;
                }
              }
            }
            break;
          }
        }
      },
      [isActive, activeIndex, activateItem],
    );

    // ── Focus active item ───────────────────────────────────────
    useEffect(() => {
      if (!isActive || activeIndex < 0) return;
      const entry = itemsMap.current.get(activeIndex);
      if (entry) {
        entry.el.focus();
        entry.el.scrollIntoView({ block: "nearest" });
      }
    }, [activeIndex, isActive]);

    if (!root.open) return null;

    const align = alignProp ?? root.align;

    const menuNavCtx: MenuNavContextValue = {
      activeIndex,
      setActiveIndex,
      registerItem,
      unregisterItem,
      activateItem,
      focusedMenuRef: menuRef,
      isActive,
      setIsActive: () => {},
    };

    return (
      <MenuNavContext.Provider value={menuNavCtx}>
        <div
          ref={mergeRefs(ref, menuRef)}
          id={root.menuId}
          role="menu"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabelledby ?? root.triggerId}
          aria-orientation="vertical"
          className={cn(dropdownMenuVariants({ size: root.size, align }), className)}
          style={{
            top: `calc(100% + ${sideOffset}px)`,
          }}
          onKeyDown={handleKeyDown}
          onMouseLeave={() => setActiveIndex(-1)}
        >
          {children}
        </div>
      </MenuNavContext.Provider>
    );
  },
);

DropdownMenu.displayName = "Dropdown.Menu";

// =====================================================================
// DROPDOWN.ITEM
// =====================================================================

type DropdownItemProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "role" | "tabIndex" | "aria-disabled" | "data-disabled"
> & {
  disabled?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  shortcut?: string;
  closeOnSelect?: boolean;
  typeahead?: string;
  className?: string;
  inset?: boolean;
  children: React.ReactNode;
};

const DropdownItem = forwardRef<HTMLButtonElement, DropdownItemProps>(
  (props, ref) => {
    const {
      disabled = false,
      iconLeft,
      iconRight,
      shortcut,
      closeOnSelect: closeOnSelectProp,
      typeahead,
      className,
      inset,
      children,
      onClick,
      onMouseEnter,
      ...rest
    } = props;

    const root = useRootDropdown();
    const nav = useMenuNav();
    const itemIndex = useItemIndex();
    const localRef = useRef<HTMLButtonElement>(null);

    const label =
      typeahead ?? (typeof children === "string" ? children : "");

    // Register
    useEffect(() => {
      if (localRef.current) {
        nav.registerItem(itemIndex.current, localRef.current, label);
        return () => nav.unregisterItem(itemIndex.current);
      }
    }, [nav, itemIndex, label]);

    const isHighlighted = nav.activeIndex === itemIndex.current;

    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled) return;
        onClick?.(e);
        if (closeOnSelectProp ?? root.closeOnSelect) {
          root.setOpen(false);
          root.triggerRef.current?.focus();
        }
      },
      [disabled, onClick, closeOnSelectProp, root],
    );

    const handleMouseEnter = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        if (disabled) return;
        nav.setActiveIndex(itemIndex.current);
        onMouseEnter?.(e);
      },
      [disabled, nav, itemIndex, onMouseEnter],
    );

    return (
      <button
        ref={mergeRefs(ref, localRef)}
        type="button"
        role="menuitem"
        tabIndex={isHighlighted ? 0 : -1}
        aria-disabled={disabled || undefined}
        data-disabled={disabled ? "true" : undefined}
        data-dropdown-item=""
        data-highlighted={isHighlighted ? "" : undefined}
        data-typeahead={typeahead}
        disabled={disabled}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        className={cn(dropdownItemVariants({ size: root.size, inset }), className)}
        {...rest}
      >
        {iconLeft && (
          <span className="flex shrink-0 items-center text-text-tertiary">
            {iconLeft}
          </span>
        )}
        <span className="flex-1 text-left truncate">{children}</span>
        {shortcut && (
          <span className="ml-auto text-text-tertiary text-xs tracking-wider">
            {shortcut}
          </span>
        )}
        {iconRight && (
          <span className="flex shrink-0 items-center text-text-tertiary ml-1">
            {iconRight}
          </span>
        )}
      </button>
    );
  },
);

DropdownItem.displayName = "Dropdown.Item";

// =====================================================================
// DROPDOWN.CHECKBOX ITEM
// =====================================================================

type DropdownCheckboxItemProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "role" | "tabIndex" | "aria-disabled" | "aria-checked" | "data-disabled"
> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  closeOnSelect?: boolean;
  typeahead?: string;
  className?: string;
  inset?: boolean;
  children: React.ReactNode;
};

const DropdownCheckboxItem = forwardRef<
  HTMLButtonElement,
  DropdownCheckboxItemProps
>((props, ref) => {
  const {
    checked,
    onCheckedChange,
    disabled = false,
    closeOnSelect: closeOnSelectProp = false,
    typeahead,
    className,
    inset,
    children,
    onClick,
    onMouseEnter,
    ...rest
  } = props;

  const root = useRootDropdown();
  const nav = useMenuNav();
  const itemIndex = useItemIndex();
  const localRef = useRef<HTMLButtonElement>(null);

  const label =
    typeahead ?? (typeof children === "string" ? children : "");

  useEffect(() => {
    if (localRef.current) {
      nav.registerItem(itemIndex.current, localRef.current, label);
      return () => nav.unregisterItem(itemIndex.current);
    }
  }, [nav, itemIndex, label]);

  const isHighlighted = nav.activeIndex === itemIndex.current;

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      onCheckedChange(!checked);
      onClick?.(e);
      if (closeOnSelectProp) {
        root.setOpen(false);
        root.triggerRef.current?.focus();
      }
    },
    [disabled, checked, onCheckedChange, onClick, closeOnSelectProp, root],
  );

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      nav.setActiveIndex(itemIndex.current);
      onMouseEnter?.(e);
    },
    [disabled, nav, itemIndex, onMouseEnter],
  );

  return (
    <button
      ref={mergeRefs(ref, localRef)}
      type="button"
      role="menuitemcheckbox"
      tabIndex={isHighlighted ? 0 : -1}
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      data-disabled={disabled ? "true" : undefined}
      data-dropdown-checkbox=""
      data-highlighted={isHighlighted ? "" : undefined}
      data-typeahead={typeahead}
      disabled={disabled}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      className={cn(dropdownItemVariants({ size: root.size, inset }), className)}
      {...rest}
    >
      <span
        className={cn(
          "flex shrink-0 items-center justify-center",
          root.size === "sm" ? "w-4 h-4" : root.size === "lg" ? "w-5 h-5" : "w-4 h-4",
          checked
            ? "text-brand-500"
            : "text-transparent group-hover:text-text-tertiary",
        )}
      >
        {checked &&
          (root.size === "sm" ? (
            <Check className="h-3 w-3" />
          ) : (
            <Check className="h-4 w-4" />
          ))}
      </span>
      <span className="flex-1 text-left truncate">{children}</span>
    </button>
  );
});

DropdownCheckboxItem.displayName = "Dropdown.CheckboxItem";

// =====================================================================
// DROPDOWN.LABEL
// =====================================================================

type DropdownLabelProps = {
  className?: string;
  children: React.ReactNode;
};

const DropdownLabel = forwardRef<HTMLDivElement, DropdownLabelProps>(
  (props, ref) => {
    const { className, children } = props;
    const root = useRootDropdown();

    return (
      <div
        ref={ref}
        role="presentation"
        className={cn(dropdownLabelVariants({ size: root.size }), className)}
      >
        {children}
      </div>
    );
  },
);

DropdownLabel.displayName = "Dropdown.Label";

// =====================================================================
// DROPDOWN.SEPARATOR
// =====================================================================

type DropdownSeparatorProps = {
  className?: string;
};

const DropdownSeparator = forwardRef<HTMLDivElement, DropdownSeparatorProps>(
  (props, ref) => {
    const { className } = props;
    const root = useRootDropdown();

    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation="horizontal"
        className={cn(
          dropdownSeparatorVariants({ size: root.size }),
          className,
        )}
      />
    );
  },
);

DropdownSeparator.displayName = "Dropdown.Separator";

// =====================================================================
// DROPDOWN.SUBMENU
// =====================================================================

type SubmenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  submenuId: string;
};

const SubmenuContext = createContext<SubmenuContextValue | null>(null);

function useSubmenu() {
  const ctx = useContext(SubmenuContext);
  if (!ctx)
    throw new Error("Submenu components must be within <Dropdown.Submenu>.");
  return ctx;
}

type DropdownSubmenuProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  children: React.ReactNode;
};

const DropdownSubmenu = forwardRef<HTMLDivElement, DropdownSubmenuProps>(
  (props, ref) => {
    const { open: openProp, onOpenChange, defaultOpen = false, children } =
      props;

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

    const submenuId = useId();

    return (
      <SubmenuContext.Provider value={{ open, setOpen, submenuId }}>
        <div ref={ref} className="relative" data-submenu-root="">
          {children}
        </div>
      </SubmenuContext.Provider>
    );
  },
);

DropdownSubmenu.displayName = "Dropdown.Submenu";

// =====================================================================
// DROPDOWN.SUBMENU TRIGGER
// =====================================================================

type DropdownSubmenuTriggerProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "type" | "role" | "tabIndex" | "aria-haspopup" | "aria-expanded" | "aria-controls" | "data-disabled"
> & {
  disabled?: boolean;
  iconLeft?: React.ReactNode;
  inset?: boolean;
  className?: string;
  children: React.ReactNode;
};

const DropdownSubmenuTrigger = forwardRef<
  HTMLButtonElement,
  DropdownSubmenuTriggerProps
>((props, ref) => {
  const {
    disabled = false,
    iconLeft,
    inset,
    className,
    children,
    onClick,
    onMouseEnter,
    onMouseLeave,
    onKeyDown,
    ...rest
  } = props;

  const root = useRootDropdown();
  const nav = useMenuNav();
  const sub = useSubmenu();
  const itemIndex = useItemIndex();
  const localRef = useRef<HTMLButtonElement>(null);

  const label = typeof children === "string" ? children : "";

  // Timers for hover open/close
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Register as a navigable item
  useEffect(() => {
    if (localRef.current) {
      nav.registerItem(itemIndex.current, localRef.current, label);
      return () => nav.unregisterItem(itemIndex.current);
    }
  }, [nav, itemIndex, label]);

  const isHighlighted = nav.activeIndex === itemIndex.current;

  // ── ArrowRight → open submenu ─────────────────────────────────
  useEffect(() => {
    if (!root.open || !isHighlighted || !nav.isActive) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        e.stopPropagation();
        sub.setOpen(true);
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [root.open, isHighlighted, nav.isActive, sub]);

  // ── ArrowLeft → close submenu (when submenu is open) ──────────
  useEffect(() => {
    if (!sub.open) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        e.stopPropagation();
        sub.setOpen(false);
        localRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [sub.open, sub.setOpen]);

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled) return;
      nav.setActiveIndex(itemIndex.current);

      if (closeTimer.current) {
        clearTimeout(closeTimer.current);
        closeTimer.current = null;
      }

      openTimer.current = setTimeout(() => sub.setOpen(true), 150);
      onMouseEnter?.(e);
    },
    [disabled, nav, itemIndex, sub, onMouseEnter],
  );

  const handleMouseLeave = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (openTimer.current) {
        clearTimeout(openTimer.current);
        openTimer.current = null;
      }

      closeTimer.current = setTimeout(() => sub.setOpen(false), 200);
      onMouseLeave?.(e);
    },
    [sub, onMouseLeave],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        sub.setOpen(true);
        return;
      }
      onKeyDown?.(e);
    },
    [sub, onKeyDown],
  );

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (openTimer.current) clearTimeout(openTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  return (
    <button
      ref={mergeRefs(ref, localRef)}
      type="button"
      role="menuitem"
      tabIndex={isHighlighted ? 0 : -1}
      aria-haspopup="menu"
      aria-expanded={sub.open}
      aria-controls={sub.submenuId}
      aria-disabled={disabled || undefined}
      data-disabled={disabled ? "true" : undefined}
      data-dropdown-subtrigger=""
      data-highlighted={isHighlighted ? "" : undefined}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      className={cn(
        dropdownItemVariants({ size: root.size, inset }),
        className,
      )}
      {...rest}
    >
      {iconLeft && (
        <span className="flex shrink-0 items-center text-text-tertiary">
          {iconLeft}
        </span>
      )}
      <span className="flex-1 text-left truncate">{children}</span>
      <ChevronRight
        className={cn(
          "ml-auto h-4 w-4 text-text-tertiary shrink-0",
          root.size === "sm" && "h-3 w-3",
          root.size === "lg" && "h-5 w-5",
        )}
        aria-hidden="true"
      />
    </button>
  );
});

DropdownSubmenuTrigger.displayName = "Dropdown.SubmenuTrigger";

// =====================================================================
// DROPDOWN.SUBMENU CONTENT
// =====================================================================

type DropdownSubmenuContentProps = {
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
};

const DropdownSubmenuContent = forwardRef<
  HTMLDivElement,
  DropdownSubmenuContentProps
>((props, ref) => {
  const { className, children, "aria-label": ariaLabel } = props;

  const root = useRootDropdown();
  const sub = useSubmenu();
  const contentRef = useRef<HTMLDivElement>(null);
  const subNavId = useId();

  // ── Navigation state (independent from parent menu) ──────────
  const [activeIndex, setActiveIndex] = useState(-1);
  const itemsMap = useRef<Map<number, { el: HTMLElement; label: string }>>(
    new Map(),
  );
  const typeaheadBuffer = useRef<{
    chars: string;
    timer: ReturnType<typeof setTimeout> | null;
  }>({ chars: "", timer: null });

  const { activeMenuId, requestFocus, releaseFocus } =
    useContext(FocusedMenuContext);
  const navIdRef = useRef(subNavId);
  // If no parent nav (standalone submenu), always active
  const isActive = activeMenuId
    ? activeMenuId === navIdRef.current
    : true;

  // When this submenu opens, take keyboard focus
  useEffect(() => {
    if (sub.open) {
      requestFocus(navIdRef.current);
      setActiveIndex(-1);
      return () => releaseFocus(navIdRef.current);
    }
  }, [sub.open, navIdRef, requestFocus, releaseFocus]);

  const registerItem = useCallback(
    (index: number, el: HTMLElement, label: string) => {
      itemsMap.current.set(index, { el, label });
    },
    [],
  );

  const unregisterItem = useCallback((index: number) => {
    itemsMap.current.delete(index);
  }, []);

  const activateItem = useCallback(
    (index: number) => {
      const entry = itemsMap.current.get(index);
      if (entry && entry.el.getAttribute("data-disabled") !== "true") {
        entry.el.click();
      }
    },
    [],
  );

  // ── Keyboard handler ─────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isActive) return;

      const total = itemsMap.current.size;
      if (total === 0) return;

      const indices = Array.from(itemsMap.current.keys()).sort(
        (a, b) => a - b,
      );
      const currentPos = indices.indexOf(activeIndex);

      const findNext = (current: number, direction: 1 | -1): number | null => {
        let pos = current;
        for (let i = 0; i < total; i++) {
          pos += direction;
          if (pos < 0) pos = total - 1;
          if (pos >= total) pos = 0;
          const idx = indices[pos];
          const entry = itemsMap.current.get(idx);
          if (entry && entry.el.getAttribute("data-disabled") !== "true") {
            return idx;
          }
        }
        return null;
      };

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          e.stopPropagation();
          const next =
            currentPos === -1 ? indices[0] : findNext(currentPos, 1);
          if (next !== null) setActiveIndex(next);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          e.stopPropagation();
          const next =
            currentPos === -1
              ? indices[total - 1]
              : findNext(currentPos, -1);
          if (next !== null) setActiveIndex(next);
          break;
        }
        case "Home": {
          e.preventDefault();
          e.stopPropagation();
          for (const idx of indices) {
            const entry = itemsMap.current.get(idx);
            if (entry && entry.el.getAttribute("data-disabled") !== "true") {
              setActiveIndex(idx);
              break;
            }
          }
          break;
        }
        case "End": {
          e.preventDefault();
          e.stopPropagation();
          for (let i = indices.length - 1; i >= 0; i--) {
            const idx = indices[i];
            const entry = itemsMap.current.get(idx);
            if (entry && entry.el.getAttribute("data-disabled") !== "true") {
              setActiveIndex(idx);
              break;
            }
          }
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          e.stopPropagation();
          if (activeIndex >= 0) activateItem(activeIndex);
          break;
        }
        default: {
          if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            const char = e.key.toLowerCase();
            if (typeaheadBuffer.current.timer)
              clearTimeout(typeaheadBuffer.current.timer);
            typeaheadBuffer.current.chars += char;
            typeaheadBuffer.current.timer = setTimeout(() => {
              typeaheadBuffer.current.chars = "";
            }, TYPEAHEAD_TIMEOUT);

            const search = typeaheadBuffer.current.chars.toLowerCase();
            const startPos = currentPos === -1 ? 0 : currentPos + 1;

            for (let i = 0; i < total; i++) {
              const pos = (startPos + i) % total;
              const idx = indices[pos];
              const entry = itemsMap.current.get(idx);
              if (
                entry &&
                entry.el.getAttribute("data-disabled") !== "true" &&
                entry.label.toLowerCase().startsWith(search)
              ) {
                setActiveIndex(idx);
                break;
              }
            }
          }
          break;
        }
      }
    },
    [isActive, activeIndex, activateItem],
  );

  // ── Focus active item ────────────────────────────────────────
  useEffect(() => {
    if (!isActive || activeIndex < 0) return;
    const entry = itemsMap.current.get(activeIndex);
    if (entry) {
      entry.el.focus();
      entry.el.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, isActive]);

  if (!sub.open) return null;

  const menuNavCtx: MenuNavContextValue = {
    activeIndex,
    setActiveIndex,
    registerItem,
    unregisterItem,
    activateItem,
    focusedMenuRef: contentRef,
    isActive,
    setIsActive: () => {},
  };

  return (
    <MenuNavContext.Provider value={menuNavCtx}>
      <div
        ref={mergeRefs(ref, contentRef)}
        id={sub.submenuId}
        role="menu"
        aria-label={ariaLabel}
        className={cn(
          "absolute left-full top-0 z-dropdown",
          "min-w-[160px]",
          "bg-surface text-text-primary",
          "rounded-md border border-border-subtle",
          "shadow-elevation-3",
          "overflow-hidden",
          "py-1",
          "ml-1",
          className,
        )}
        onKeyDown={handleKeyDown}
        onMouseLeave={() => setActiveIndex(-1)}
      >
        {children}
      </div>
    </MenuNavContext.Provider>
  );
});

DropdownSubmenuContent.displayName = "Dropdown.SubmenuContent";

// =====================================================================
// COMPOUND EXPORT
// =====================================================================

type DropdownCompound = typeof DropdownComponent & {
  Trigger: typeof DropdownTrigger;
  Menu: typeof DropdownMenu;
  Item: typeof DropdownItem;
  CheckboxItem: typeof DropdownCheckboxItem;
  Label: typeof DropdownLabel;
  Separator: typeof DropdownSeparator;
  Submenu: typeof DropdownSubmenu;
  SubmenuTrigger: typeof DropdownSubmenuTrigger;
  SubmenuContent: typeof DropdownSubmenuContent;
};

const Dropdown = DropdownComponent as DropdownCompound;
Dropdown.Trigger = DropdownTrigger;
Dropdown.Menu = DropdownMenu;
Dropdown.Item = DropdownItem;
Dropdown.CheckboxItem = DropdownCheckboxItem;
Dropdown.Label = DropdownLabel;
Dropdown.Separator = DropdownSeparator;
Dropdown.Submenu = DropdownSubmenu;
Dropdown.SubmenuTrigger = DropdownSubmenuTrigger;
Dropdown.SubmenuContent = DropdownSubmenuContent;

export {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  DropdownCheckboxItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownSubmenu,
  DropdownSubmenuTrigger,
  DropdownSubmenuContent,
  dropdownMenuVariants,
  dropdownItemVariants,
  dropdownSeparatorVariants,
  dropdownLabelVariants,
};

export type {
  DropdownProps,
  DropdownTriggerProps,
  DropdownMenuProps,
  DropdownItemProps,
  DropdownCheckboxItemProps,
  DropdownLabelProps,
  DropdownSeparatorProps,
  DropdownSubmenuProps,
  DropdownSubmenuTriggerProps,
  DropdownSubmenuContentProps,
  DropdownSize,
  DropdownAlign,
};

export default Dropdown;
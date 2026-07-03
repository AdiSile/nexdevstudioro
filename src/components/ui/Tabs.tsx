"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

// ═══════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════

const TABS_KEYS = {
  LEFT: "ArrowLeft",
  RIGHT: "ArrowRight",
  UP: "ArrowUp",
  DOWN: "ArrowDown",
  HOME: "Home",
  END: "End",
  ENTER: "Enter",
  SPACE: " ",
} as const;

const COLLAPSE_BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

// ─── Variant Definitions ────────────────────────────────────────────

const tabListVariants = cva(
  ["relative flex", "select-none"],
  {
    variants: {
      variant: {
        default: [
          "gap-0 rounded-lg bg-surface-secondary p-1",
          "border border-border-subtle",
        ],
        pills: ["gap-1 rounded-none bg-transparent"],
        underlined: [
          "gap-0 rounded-none bg-transparent",
          "border-b border-border",
          "pb-0",
        ],
      },
      orientation: {
        horizontal: "flex-row items-center",
        vertical: "flex-col items-stretch",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    compoundVariants: [
      {
        variant: "pills",
        orientation: "horizontal",
        className: "flex-row",
      },
      {
        variant: "pills",
        orientation: "vertical",
        className: "flex-col",
      },
    ],
    defaultVariants: {
      variant: "default",
      orientation: "horizontal",
    },
  },
);

const tabVariants = cva(
  [
    "relative inline-flex items-center justify-center gap-2",
    "font-medium whitespace-nowrap",
    "transition-all duration-200",
    "ring-offset-surface",
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-border-focus focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-40",
  ],
  {
    variants: {
      variant: {
        default: [
          "rounded-md z-10",
          "text-text-secondary",
          "hover:text-text-primary hover:bg-white/50",
          "data-[state=active]:text-text-primary",
          "data-[state=active]:shadow-elevation-1",
        ],
        pills: [
          "rounded-full z-10",
          "text-text-secondary",
          "hover:text-text-primary hover:bg-surface-secondary",
          "data-[state=active]:bg-brand-500 data-[state=active]:text-white",
          "data-[state=active]:shadow-elevation-1",
        ],
        underlined: [
          "rounded-none bg-transparent z-10",
          "text-text-tertiary",
          "hover:text-text-secondary",
          "data-[state=active]:text-brand-500",
          "data-[state=active]:border-b-2 data-[state=active]:border-brand-500",
          "border-b-2 border-transparent",
          "-mb-[2px]",
        ],
      },
      size: {
        sm: ["h-7 px-2.5 text-xs"],
        md: ["h-9 px-3.5 text-sm"],
        lg: ["h-11 px-5 text-base"],
      },
      orientation: {
        horizontal: "",
        vertical: "justify-start w-full",
      },
      fullWidth: {
        true: "flex-1",
        false: "",
      },
    },
    compoundVariants: [
      {
        variant: "underlined",
        orientation: "horizontal",
        className: "border-b-2 border-transparent -mb-[2px]",
      },
      {
        variant: "underlined",
        orientation: "vertical",
        className: "border-b-0 border-l-2 border-transparent -ml-[2px]",
      },
      {
        variant: "underlined",
        orientation: "vertical",
        className:
          "data-[state=active]:border-l-2 data-[state=active]:border-brand-500 data-[state=active]:border-b-0",
      },
    ],
    defaultVariants: {
      variant: "default",
      size: "md",
      orientation: "horizontal",
    },
  },
);

const tabIndicatorVariants = cva(
  ["absolute rounded-md bg-white shadow-elevation-1", "transition-all duration-300 ease-out"],
  {
    variants: {
      variant: {
        default: "",
        pills: "rounded-full bg-brand-500 shadow-elevation-1",
        underlined: "rounded-none bg-brand-500 h-[2px] bottom-0 shadow-none",
      },
      orientation: {
        horizontal: "",
        vertical: "",
      },
    },
    compoundVariants: [
      {
        variant: "underlined",
        orientation: "vertical",
        className: "h-full w-[2px] left-0 top-0 bottom-auto",
      },
    ],
    defaultVariants: {
      variant: "default",
      orientation: "horizontal",
    },
  },
);

const tabPanelVariants = cva(["outline-none"], {
  variants: {
    animate: {
      true: "",
      false: "",
    },
  },
  defaultVariants: {
    animate: true,
  },
});

const collapseSelectVariants = cva(
  [
    "w-full appearance-none",
    "rounded-md border border-border",
    "bg-surface text-text-primary",
    "transition-all duration-200",
    "focus:outline-none focus:ring-2 focus:ring-border-focus focus:border-brand-500",
    "cursor-pointer",
    "pr-8",
  ],
  {
    variants: {
      size: {
        sm: "h-7 px-2 text-xs",
        md: "h-9 px-3 text-sm",
        lg: "h-11 px-4 text-base",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

// ═══════════════════════════════════════════════════════════════════════
// Context
// ═══════════════════════════════════════════════════════════════════════

type TabsContextValue = {
  activeValue: string;
  setActiveValue: (value: string) => void;
  orientation: "horizontal" | "vertical";
  activationMode: "manual" | "automatic";
  variant: VariantProps<typeof tabVariants>["variant"];
  size: VariantProps<typeof tabVariants>["size"];
  fullWidth: boolean;
  collapseBreakpoint: keyof typeof COLLAPSE_BREAKPOINTS | "none";
  isCollapsed: boolean;
  tabValues: string[];
  registerTab: (value: string) => void;
  unregisterTab: (value: string) => void;
  listId: string;
  activePanelId: string;
  mountedPanels: Set<string>;
  markPanelMounted: (value: string) => void;
  tabLabels: Map<string, string>;
  registerLabel: (value: string, label: string) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error("Tabs compound components must be used within a <Tabs> root.");
  }
  return ctx;
}

// ═══════════════════════════════════════════════════════════════════════
// Hook: useResponsiveCollapse
// ═══════════════════════════════════════════════════════════════════════

function useResponsiveCollapse(
  breakpoint: keyof typeof COLLAPSE_BREAKPOINTS | "none",
): boolean {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    if (breakpoint === "none") {
      setIsCollapsed(false);
      return;
    }

    const bp = COLLAPSE_BREAKPOINTS[breakpoint];

    const check = () => {
      setIsCollapsed(window.innerWidth < bp);
    };

    check();

    let timeoutId: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(check, 100);
    };

    window.addEventListener("resize", handleResize, { passive: true });
    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timeoutId);
    };
  }, [breakpoint]);

  return isCollapsed;
}

// ═══════════════════════════════════════════════════════════════════════
// Tabs (Root)
// ═══════════════════════════════════════════════════════════════════════

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Controlled active tab value */
  value?: string;
  /** Uncontrolled default active tab value */
  defaultValue?: string;
  /** Called when active tab changes */
  onValueChange?: (value: string) => void;
  /** Tab list orientation */
  orientation?: "horizontal" | "vertical";
  /** Activation mode: "manual" (click/enter) or "automatic" (focus) */
  activationMode?: "manual" | "automatic";
  /** Visual variant */
  variant?: VariantProps<typeof tabVariants>["variant"];
  /** Size preset */
  size?: VariantProps<typeof tabVariants>["size"];
  /** Make tabs full width of container */
  fullWidth?: boolean;
  /** Breakpoint below which tabs collapse into a dropdown. "none" disables. */
  collapseBreakpoint?: keyof typeof COLLAPSE_BREAKPOINTS | "none";
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  (
    {
      value: controlledValue,
      defaultValue,
      onValueChange,
      orientation = "horizontal",
      activationMode = "manual",
      variant = "default",
      size = "md",
      fullWidth = false,
      collapseBreakpoint = "none",
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    const isControlled = controlledValue !== undefined;
    const [internalValue, setInternalValue] = useState(defaultValue ?? "");
    const activeValue = isControlled ? controlledValue : internalValue;

    const [tabValues, setTabValues] = useState<string[]>([]);
    const [mountedPanels, setMountedPanels] = useState<Set<string>>(new Set());
    const [tabLabels, setTabLabels] = useState<Map<string, string>>(new Map());
    const autoId = useId();
    const listId = `${autoId}-list`;
    const activePanelId = `${autoId}-panel-${activeValue}`;

    const isCollapsed = useResponsiveCollapse(collapseBreakpoint);

    const setActiveValue = useCallback(
      (val: string) => {
        if (!isControlled) {
          setInternalValue(val);
        }
        onValueChange?.(val);
      },
      [isControlled, onValueChange],
    );

    const registerTab = useCallback((val: string) => {
      setTabValues((prev) => {
        if (prev.includes(val)) return prev;
        return [...prev, val];
      });
    }, []);

    const unregisterTab = useCallback((val: string) => {
      setTabValues((prev) => prev.filter((v) => v !== val));
    }, []);

    const markPanelMounted = useCallback((val: string) => {
      setMountedPanels((prev) => {
        if (prev.has(val)) return prev;
        const next = new Set(prev);
        next.add(val);
        return next;
      });
    }, []);

    const registerLabel = useCallback((value: string, label: string) => {
      setTabLabels((prev) => {
        if (prev.get(value) === label) return prev;
        const next = new Map(prev);
        next.set(value, label);
        return next;
      });
    }, []);

    // Auto-select first tab if no activeValue is set
    useEffect(() => {
      if (!activeValue && tabValues.length > 0) {
        setActiveValue(tabValues[0]);
      }
    }, [activeValue, tabValues, setActiveValue]);

    // Sync mounted panels when activeValue first matches a panel
    useEffect(() => {
      if (activeValue) {
        markPanelMounted(activeValue);
      }
    }, [activeValue, markPanelMounted]);

    const contextValue = useMemo<TabsContextValue>(
      () => ({
        activeValue,
        setActiveValue,
        orientation,
        activationMode,
        variant,
        size,
        fullWidth,
        collapseBreakpoint,
        isCollapsed,
        tabValues,
        registerTab,
        unregisterTab,
        listId,
        activePanelId,
        mountedPanels,
        markPanelMounted,
        tabLabels,
        registerLabel,
      }),
      [
        activeValue,
        setActiveValue,
        orientation,
        activationMode,
        variant,
        size,
        fullWidth,
        collapseBreakpoint,
        isCollapsed,
        tabValues,
        registerTab,
        unregisterTab,
        listId,
        activePanelId,
        mountedPanels,
        markPanelMounted,
        tabLabels,
        registerLabel,
      ],
    );

    return (
      <TabsContext.Provider value={contextValue}>
        <div
          ref={ref}
          className={cn(
            orientation === "horizontal" ? "flex flex-col" : "flex flex-row",
            fullWidth && "w-full",
            className,
          )}
          {...rest}
        >
          {children}
        </div>
      </TabsContext.Provider>
    );
  },
);

Tabs.displayName = "Tabs";

// ═══════════════════════════════════════════════════════════════════════
// TabIndicator – animated highlight
// ═══════════════════════════════════════════════════════════════════════

interface TabIndicatorProps {
  variant: VariantProps<typeof tabVariants>["variant"];
  orientation: "horizontal" | "vertical";
  tabRef: React.RefObject<HTMLButtonElement | null>;
}

function TabIndicator({ variant, orientation, tabRef }: TabIndicatorProps) {
  if (variant === "default" || variant === "pills") {
    return (
      <motion.div
        className={cn(
          "absolute inset-0 -z-0 rounded-md bg-white shadow-elevation-1",
          variant === "pills" && "rounded-full bg-brand-500 shadow-elevation-1",
        )}
        layoutId="tab-indicator"
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
      />
    );
  }

  // Underlined variant
  if (variant === "underlined") {
    return (
      <motion.div
        className={cn(
          "absolute z-0",
          orientation === "horizontal"
            ? "bottom-0 left-0 right-0 h-[2px] bg-brand-500"
            : "left-0 top-0 bottom-0 w-[2px] bg-brand-500",
        )}
        layoutId="tab-indicator"
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
      />
    );
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// TabList
// ═══════════════════════════════════════════════════════════════════════

export interface TabListProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Accessible label for the tab list (required for a11y) */
  "aria-label"?: string;
  /** ID of element that labels the tablist */
  "aria-labelledby"?: string;
}

const TabList = React.forwardRef<HTMLDivElement, TabListProps>(
  ({ className, children, ...rest }, ref) => {
    const ctx = useTabsContext();
    const { orientation, variant, fullWidth, isCollapsed } = ctx;

    // ── Collapsed select ──────────────────────────────────────────
    if (isCollapsed && orientation === "horizontal") {
      return <CollapsedTabSelect />;
    }

    return (
      <div
        ref={ref}
        role="tablist"
        aria-orientation={orientation}
        aria-label={rest["aria-label"]}
        aria-labelledby={rest["aria-labelledby"]}
        className={cn(
          tabListVariants({ variant, orientation, fullWidth }),
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    );
  },
);

TabList.displayName = "TabList";

// ═══════════════════════════════════════════════════════════════════════
// Collapsed Select (responsive)
// ═══════════════════════════════════════════════════════════════════════

function CollapsedTabSelect() {
  const ctx = useTabsContext();
  const { activeValue, setActiveValue, size, fullWidth, tabValues, tabLabels } = ctx;
  const selectId = useId();

  return (
    <div className={cn("relative", fullWidth && "w-full")}>
      <select
        id={selectId}
        value={activeValue}
        onChange={(e) => setActiveValue(e.target.value)}
        className={cn(collapseSelectVariants({ size }), fullWidth && "w-full")}
        aria-label="Selectați tab-ul"
      >
        {tabValues.map((val) => (
          <option key={val} value={val}>
            {tabLabels.get(val) ?? val}
          </option>
        ))}
      </select>
      <ChevronDown
        className={cn(
          "pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary",
          size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4",
        )}
        aria-hidden="true"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Tab
// ═══════════════════════════════════════════════════════════════════════

export interface TabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Unique value identifying this tab */
  value: string;
  /** Disable the tab */
  disabled?: boolean;
}

const Tab = React.forwardRef<HTMLButtonElement, TabProps>(
  ({ value, disabled = false, className, children, ...rest }, ref) => {
    const ctx = useTabsContext();
    const {
      activeValue,
      setActiveValue,
      orientation,
      activationMode,
      variant,
      size,
      fullWidth,
      tabValues,
      registerTab,
      unregisterTab,
      registerLabel,
      listId,
    } = ctx;

    const isActive = activeValue === value;
    const internalRef = useRef<HTMLButtonElement>(null);
    const resolvedRef = ref ?? internalRef;

    // Register / unregister
    useEffect(() => {
      registerTab(value);
      return () => unregisterTab(value);
    }, [value, registerTab, unregisterTab]);

    // Register label (extract text content from children)
    useEffect(() => {
      if (typeof children === "string") {
        registerLabel(value, children);
      } else if (React.isValidElement(children) && typeof children.props?.children === "string") {
        registerLabel(value, children.props.children as string);
      }
    }, [value, children, registerLabel]);

    const tabId = `${listId}-tab-${value}`;
    const panelId = `${listId}-panel-${value}`;

    // Determine the index for keyboard navigation
    const currentIndex = tabValues.indexOf(value);

    // ── Keyboard handler ───────────────────────────────────────────
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLButtonElement>) => {
        const keys = TABS_KEYS;
        const isHorizontal = orientation === "horizontal";
        const prevKey = isHorizontal ? keys.LEFT : keys.UP;
        const nextKey = isHorizontal ? keys.RIGHT : keys.DOWN;

        let handled = true;
        const enabledTabs = tabValues.filter(
          (v, i) => {
            // We need to know which tabs are disabled. This info isn't directly
            // available. For keyboard nav we'll iterate and check the DOM.
            return true; // simplified: we navigate all registered, skip disabled at runtime
          },
        );

        switch (e.key) {
          case prevKey: {
            e.preventDefault();
            // Find previous enabled tab
            let prevIdx = currentIndex - 1;
            while (prevIdx >= 0) {
              const prevTab = document.getElementById(`${listId}-tab-${tabValues[prevIdx]}`);
              if (prevTab && !(prevTab as HTMLButtonElement).disabled) {
                prevTab.focus();
                if (activationMode === "automatic") {
                  setActiveValue(tabValues[prevIdx]);
                }
                break;
              }
              prevIdx--;
            }
            break;
          }
          case nextKey: {
            e.preventDefault();
            let nextIdx = currentIndex + 1;
            while (nextIdx < tabValues.length) {
              const nextTab = document.getElementById(`${listId}-tab-${tabValues[nextIdx]}`);
              if (nextTab && !(nextTab as HTMLButtonElement).disabled) {
                nextTab.focus();
                if (activationMode === "automatic") {
                  setActiveValue(tabValues[nextIdx]);
                }
                break;
              }
              nextIdx++;
            }
            break;
          }
          case keys.HOME: {
            e.preventDefault();
            let firstIdx = 0;
            while (firstIdx < tabValues.length) {
              const firstTab = document.getElementById(`${listId}-tab-${tabValues[firstIdx]}`);
              if (firstTab && !(firstTab as HTMLButtonElement).disabled) {
                firstTab.focus();
                if (activationMode === "automatic") {
                  setActiveValue(tabValues[firstIdx]);
                }
                break;
              }
              firstIdx++;
            }
            break;
          }
          case keys.END: {
            e.preventDefault();
            let lastIdx = tabValues.length - 1;
            while (lastIdx >= 0) {
              const lastTab = document.getElementById(`${listId}-tab-${tabValues[lastIdx]}`);
              if (lastTab && !(lastTab as HTMLButtonElement).disabled) {
                lastTab.focus();
                if (activationMode === "automatic") {
                  setActiveValue(tabValues[lastIdx]);
                }
                break;
              }
              lastIdx--;
            }
            break;
          }
          case keys.ENTER:
          case keys.SPACE: {
            if (activationMode === "manual") {
              e.preventDefault();
              setActiveValue(value);
            }
            break;
          }
          default:
            handled = false;
            break;
        }

        if (handled && rest.onKeyDown) {
          rest.onKeyDown(e);
        }
      },
      [
        orientation,
        activationMode,
        currentIndex,
        tabValues,
        listId,
        setActiveValue,
        value,
        rest,
      ],
    );

    // ── Click handler ─────────────────────────────────────────────
    const handleClick = useCallback(
      (e: React.MouseEvent<HTMLButtonElement>) => {
        setActiveValue(value);
        rest.onClick?.(e);
      },
      [setActiveValue, value, rest],
    );

    return (
      <button
        ref={resolvedRef as React.Ref<HTMLButtonElement>}
        id={tabId}
        role="tab"
        type="button"
        aria-selected={isActive}
        aria-controls={panelId}
        aria-disabled={disabled || undefined}
        tabIndex={isActive ? 0 : -1}
        data-state={isActive ? "active" : "inactive"}
        data-value={value}
        disabled={disabled}
        className={cn(
          tabVariants({ variant, size, orientation, fullWidth }),
          className,
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        {isActive && variant !== "underlined" && (
          <TabIndicator
            variant={variant}
            orientation={orientation}
            tabRef={internalRef}
          />
        )}
        <span className="relative z-10 inline-flex items-center gap-2">
          {children}
        </span>
      </button>
    );
  },
);

Tab.displayName = "Tab";

// ═══════════════════════════════════════════════════════════════════════
// TabPanel
// ═══════════════════════════════════════════════════════════════════════

export interface TabPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Value matching the associated Tab */
  value: string;
  /** Lazy-load: only mount when first activated. Once mounted, stays mounted. */
  lazy?: boolean;
  /** Force unmount when inactive (overrides lazy) */
  unmountOnHide?: boolean;
  /** Enable fade animation */
  animate?: boolean;
}

const panelAnimationVariants = {
  hidden: { opacity: 0, y: 4 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  },
};

const TabPanel = React.forwardRef<HTMLDivElement, TabPanelProps>(
  ({ value, lazy = false, unmountOnHide = false, animate = true, className, children, ...rest }, ref) => {
    const ctx = useTabsContext();
    const { activeValue, activePanelId, mountedPanels, markPanelMounted, listId } = ctx;

    const isActive = activeValue === value;
    const panelId = `${listId}-panel-${value}`;
    const tabId = `${listId}-tab-${value}`;

    // Mark as mounted when first activated
    useEffect(() => {
      if (isActive) {
        markPanelMounted(value);
      }
    }, [isActive, value, markPanelMounted]);

    const hasBeenMounted = mountedPanels.has(value);

    // Determine visibility
    const shouldRender = unmountOnHide
      ? isActive
      : lazy
        ? hasBeenMounted
        : true;

    return (
      <AnimatePresence initial={false}>
        {(shouldRender || isActive) && (
          <motion.div
            ref={ref}
            id={panelId}
            role="tabpanel"
            aria-labelledby={tabId}
            tabIndex={0}
            hidden={!isActive}
            className={cn(
              tabPanelVariants({ animate }),
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 rounded-md",
              !isActive && "hidden",
              className,
            )}
            variants={animate ? panelAnimationVariants : undefined}
            initial={animate ? "hidden" : undefined}
            animate={animate && isActive ? "visible" : undefined}
            exit={animate ? "hidden" : undefined}
            {...rest}
          >
            {shouldRender ? children : null}
          </motion.div>
        )}
      </AnimatePresence>
    );
  },
);

TabPanel.displayName = "TabPanel";

// ═══════════════════════════════════════════════════════════════════════
// Compound component assignment
// ═══════════════════════════════════════════════════════════════════════

const TabsCompound = Object.assign(Tabs, {
  List: TabList,
  Tab,
  Panel: TabPanel,
  /** Context consumer for advanced use cases */
  Context: TabsContext,
});

export {
  TabsCompound as Tabs,
  TabList,
  Tab,
  TabPanel,
  TabsContext,
  tabListVariants,
  tabVariants,
  tabIndicatorVariants,
  tabPanelVariants,
  collapseSelectVariants,
  COLLAPSE_BREAKPOINTS,
};

export default TabsCompound;

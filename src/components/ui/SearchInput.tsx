"use client";

import React, {
  forwardRef,
  useId,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/cn";
import {
  Search,
  X,
  Clock,
  ArrowUpRight,
  Loader2,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════

const DEFAULT_DEBOUNCE_MS = 300;
const DEFAULT_MAX_RECENT = 10;
const RECENT_STORAGE_KEY = "search-input-recent";
const TYPEAHEAD_TIMEOUT_MS = 500;
const SUGGESTION_MAX_HEIGHT = 320;

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export interface SearchSuggestion {
  /** Unique identifier */
  id: string;
  /** Display text */
  label: string;
  /** Optional description / subtitle */
  description?: string;
  /** Optional category / group */
  group?: string;
  /** Optional icon */
  icon?: React.ReactNode;
  /** Arbitrary data payload */
  data?: unknown;
}

export type SearchSize = "sm" | "md" | "lg";
export type SearchVariant = "default" | "filled" | "underlined";

export interface SearchInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "size" | "value" | "defaultValue" | "onChange" | "type"
  > {
  // ── Core ──────────────────────────────────────────────────────
  /** Controlled value */
  value?: string;
  /** Uncontrolled default value */
  defaultValue?: string;
  /** Debounced change callback (fires after debounce delay) */
  onSearch?: (value: string) => void;
  /** Immediate change callback (fires on every keystroke) */
  onValueChange?: (value: string) => void;

  // ── Suggestions ───────────────────────────────────────────────
  /** Array of suggestions to display in the dropdown */
  suggestions?: SearchSuggestion[];
  /** Called when a suggestion is selected (click or Enter) */
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
  /** Custom filter function for client-side filtering */
  filterSuggestions?: (
    query: string,
    suggestions: SearchSuggestion[],
  ) => SearchSuggestion[];
  /** Show suggestions even when query is empty */
  showAllSuggestionsOnEmpty?: boolean;
  /** Show loading indicator in dropdown */
  isLoading?: boolean;
  /** Empty state message when no suggestions match */
  emptyMessage?: string;
  /** Loading message */
  loadingMessage?: string;

  // ── Recent Searches ──────────────────────────────────────────
  /** Enable recent searches persistence (localStorage) */
  enableRecent?: boolean;
  /** Storage key for recent searches. Default: "search-input-recent" */
  recentStorageKey?: string;
  /** Maximum number of recent items. Default: 10 */
  maxRecent?: number;
  /** Called when a recent search is selected */
  onRecentSelect?: (value: string) => void;
  /** Label shown above recent searches section */
  recentLabel?: string;

  // ── Visual ────────────────────────────────────────────────────
  /** Visual variant */
  variant?: SearchVariant;
  /** Size preset */
  inputSize?: SearchSize;
  /** Full width */
  fullWidth?: boolean;
  /** Label text */
  label?: string;
  /** Placeholder text */
  placeholder?: string;

  // ── Behaviour ─────────────────────────────────────────────────
  /** Debounce delay in ms. Default: 300 */
  debounceMs?: number;
  /** Clear button visible when input has value */
  showClearButton?: boolean;
  /** Close dropdown after suggestion selection */
  closeOnSelect?: boolean;
  /** Minimum characters to start searching */
  minQueryLength?: number;
}

// ═══════════════════════════════════════════════════════════════════════
// Variant Styles
// ═══════════════════════════════════════════════════════════════════════

const wrapperVariants = cva(
  [
    "group relative flex items-center",
    "rounded-md",
    "transition-all duration-200",
    "ring-offset-surface",
  ],
  {
    variants: {
      variant: {
        default: [
          "border border-border",
          "bg-surface",
          "hover:border-border-strong",
          "focus-within:border-brand-500",
          "focus-within:ring-2 focus-within:ring-brand-500/20",
          "focus-within:shadow-elevation-1",
        ],
        filled: [
          "border border-transparent",
          "bg-surface-secondary",
          "hover:bg-surface-tertiary",
          "focus-within:bg-surface",
          "focus-within:border-brand-500",
          "focus-within:ring-2 focus-within:ring-brand-500/20",
        ],
        underlined: [
          "border-0 border-b-2 border-border",
          "bg-transparent rounded-none",
          "hover:border-border-strong",
          "focus-within:border-brand-500",
          "focus-within:ring-0",
          "px-0",
        ],
      },
      inputSize: {
        sm: "h-8 text-xs",
        md: "h-10 text-sm",
        lg: "h-12 text-base",
      },
      fullWidth: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "default", inputSize: "md" },
  },
);

const labelVariants = cva(
  ["block font-medium text-text-secondary", "transition-colors duration-150"],
  {
    variants: {
      inputSize: {
        sm: "text-xs mb-1",
        md: "text-sm mb-1.5",
        lg: "text-base mb-2",
      },
    },
    defaultVariants: { inputSize: "md" },
  },
);

const dropdownVariants = cva(
  [
    "absolute z-dropdown",
    "w-full",
    "bg-surface text-text-primary",
    "rounded-md border border-border-subtle",
    "shadow-elevation-3",
    "overflow-hidden",
    "py-1",
  ],
  {
    variants: {
      inputSize: {
        sm: "text-xs",
        md: "text-sm",
        lg: "text-base",
      },
    },
    defaultVariants: { inputSize: "md" },
  },
);

const suggestionItemVariants = cva(
  [
    "relative flex w-full cursor-pointer select-none items-center gap-2",
    "text-text-primary",
    "outline-none",
    "transition-colors duration-100",
    "hover:bg-surface-secondary",
    "data-highlighted:bg-surface-secondary data-highlighted:text-text-primary",
    "aria-disabled:pointer-events-none aria-disabled:opacity-40",
  ],
  {
    variants: {
      inputSize: {
        sm: "h-8 px-2.5 text-xs",
        md: "h-9 px-3 text-sm",
        lg: "h-11 px-4 text-base",
      },
    },
    defaultVariants: { inputSize: "md" },
  },
);

const groupLabelVariants = cva(
  [
    "px-3 py-1.5",
    "text-text-tertiary font-medium",
    "select-none pointer-events-none",
  ],
  {
    variants: {
      inputSize: {
        sm: "text-[10px]",
        md: "text-xs",
        lg: "text-sm",
      },
    },
    defaultVariants: { inputSize: "md" },
  },
);

// ═══════════════════════════════════════════════════════════════════════
// Recent Searches Helpers
// ═══════════════════════════════════════════════════════════════════════

function loadRecentSearches(storageKey: string, maxRecent: number): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(storageKey);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string").slice(0, maxRecent);
  } catch {
    return [];
  }
}

function saveRecentSearch(
  storageKey: string,
  query: string,
  maxRecent: number,
): string[] {
  if (typeof window === "undefined") return [];
  if (!query.trim()) return loadRecentSearches(storageKey, maxRecent);
  try {
    const current = loadRecentSearches(storageKey, maxRecent);
    const trimmed = query.trim();
    const filtered = current.filter((v) => v !== trimmed);
    const updated = [trimmed, ...filtered].slice(0, maxRecent);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

function clearRecentSearches(storageKey: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // noop
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Default Filter
// ═══════════════════════════════════════════════════════════════════════

function defaultFilterSuggestions(
  query: string,
  suggestions: SearchSuggestion[],
): SearchSuggestion[] {
  if (!query.trim()) return suggestions;
  const lower = query.toLowerCase();
  return suggestions.filter(
    (s) =>
      s.label.toLowerCase().includes(lower) ||
      (s.description && s.description.toLowerCase().includes(lower)) ||
      (s.group && s.group.toLowerCase().includes(lower)),
  );
}

// ═══════════════════════════════════════════════════════════════════════
// useDebounce
// ═══════════════════════════════════════════════════════════════════════

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

// ═══════════════════════════════════════════════════════════════════════
// useClickOutside
// ═══════════════════════════════════════════════════════════════════════

function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void,
  enabled: boolean,
) {
  useEffect(() => {
    if (!enabled) return;
    const listener = (e: MouseEvent | TouchEvent) => {
      const el = ref.current;
      if (!el || el.contains(e.target as Node)) return;
      handler();
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", listener);
      document.addEventListener("touchstart", listener);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, handler, enabled]);
}

// ═══════════════════════════════════════════════════════════════════════
// SearchInput
// ═══════════════════════════════════════════════════════════════════════

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  (props, ref) => {
    const {
      // Core
      value: controlledValue,
      defaultValue,
      onSearch,
      onValueChange,

      // Suggestions
      suggestions = [],
      onSuggestionSelect,
      filterSuggestions = defaultFilterSuggestions,
      showAllSuggestionsOnEmpty = false,
      isLoading = false,
      emptyMessage = "No results found.",
      loadingMessage = "Searching...",

      // Recent
      enableRecent = false,
      recentStorageKey = RECENT_STORAGE_KEY,
      maxRecent = DEFAULT_MAX_RECENT,
      onRecentSelect,
      recentLabel = "Recente",

      // Visual
      variant = "default",
      inputSize = "md",
      fullWidth,
      label,
      placeholder = "Căutare...",

      // Behaviour
      debounceMs = DEFAULT_DEBOUNCE_MS,
      showClearButton = true,
      closeOnSelect = true,
      minQueryLength = 0,

      // Rest
      id: idProp,
      className,
      disabled,
      readOnly,
      onFocus,
      onBlur,
      onKeyDown,
      ...rest
    } = props;

    // ── IDs ──────────────────────────────────────────────────────
    const autoId = useId();
    const inputId = idProp ?? autoId;
    const listboxId = `${inputId}-listbox`;
    const optionIdPrefix = `${inputId}-option`;

    // ── Ref ──────────────────────────────────────────────────────
    const innerRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLUListElement>(null);

    // Forward ref
    React.useImperativeHandle(ref, () => innerRef.current!);

    // ── State ────────────────────────────────────────────────────
    const isControlled = controlledValue !== undefined;
    const [internalValue, setInternalValue] = useState<string>(
      () => controlledValue ?? defaultValue ?? "",
    );
    const currentValue = isControlled ? (controlledValue ?? "") : internalValue;

    // Dropdown open state
    const [isOpen, setIsOpen] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    // Keyboard nav: highlighted suggestion index
    const [highlightedIndex, setHighlightedIndex] = useState(-1);

    // Recent searches (only loaded if enableRecent is true)
    const [recentSearches, setRecentSearches] = useState<string[]>(() =>
      enableRecent ? loadRecentSearches(recentStorageKey, maxRecent) : [],
    );

    // Debounced value
    const debouncedValue = useDebounce(currentValue, debounceMs);

    // ── Derived ──────────────────────────────────────────────────
    const showClear = showClearButton && currentValue.length > 0 && !disabled && !readOnly;

    // Filter suggestions based on query
    const filteredSuggestions = useMemo(() => {
      if (!currentValue.trim() && !showAllSuggestionsOnEmpty) return [];
      return filterSuggestions(currentValue, suggestions);
    }, [currentValue, suggestions, filterSuggestions, showAllSuggestionsOnEmpty]);

    // Recent searches filtered by current query
    const filteredRecent = useMemo(() => {
      if (!currentValue.trim()) return recentSearches;
      const lower = currentValue.toLowerCase();
      return recentSearches.filter((r) => r.toLowerCase().includes(lower));
    }, [currentValue, recentSearches]);

    // Total dropdown items count (used for keyboard nav)
    const dropdownItemCount = useMemo(() => {
      let count = 0;
      if (filteredRecent.length > 0) count += filteredRecent.length;
      if (filteredSuggestions.length > 0) count += filteredSuggestions.length;
      return count;
    }, [filteredRecent, filteredSuggestions]);

    // Should the dropdown be visible?
    const shouldShowDropdown =
      isOpen &&
      isFocused &&
      !disabled &&
      !readOnly &&
      currentValue.length >= minQueryLength &&
      (filteredSuggestions.length > 0 ||
        filteredRecent.length > 0 ||
        isLoading ||
        (currentValue.length > 0 &&
          filteredSuggestions.length === 0 &&
          filteredRecent.length === 0));

    // ── Handlers ─────────────────────────────────────────────────

    const setValue = useCallback(
      (next: string) => {
        if (!isControlled) setInternalValue(next);
        onValueChange?.(next);
      },
      [isControlled, onValueChange],
    );

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const next = e.target.value;
        setValue(next);
        setIsOpen(true);
        setHighlightedIndex(-1);
      },
      [setValue],
    );

    const handleFocus = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        setIsFocused(true);
        // Open dropdown if there are suggestions or recent items
        if (
          suggestions.length > 0 ||
          (enableRecent && recentSearches.length > 0)
        ) {
          setIsOpen(true);
        }
        onFocus?.(e);
      },
      [suggestions.length, enableRecent, recentSearches.length, onFocus],
    );

    const handleBlur = useCallback(
      (e: React.FocusEvent<HTMLInputElement>) => {
        // Delay to allow click on suggestions to fire
        setTimeout(() => {
          setIsFocused(false);
          setIsOpen(false);
        }, 150);
        onBlur?.(e);
      },
      [onBlur],
    );

    const handleClear = useCallback(() => {
      setValue("");
      setHighlightedIndex(-1);
      setIsOpen(false);
      innerRef.current?.focus();
    }, [setValue]);

    const selectSuggestion = useCallback(
      (suggestion: SearchSuggestion) => {
        setValue(suggestion.label);
        onSuggestionSelect?.(suggestion);

        // Save to recent searches if enabled
        if (enableRecent) {
          const updated = saveRecentSearch(
            recentStorageKey,
            suggestion.label,
            maxRecent,
          );
          setRecentSearches(updated);
        }

        if (closeOnSelect) {
          setIsOpen(false);
          setIsFocused(false);
          innerRef.current?.blur();
        }
      },
      [
        setValue,
        onSuggestionSelect,
        enableRecent,
        recentStorageKey,
        maxRecent,
        closeOnSelect,
      ],
    );

    const selectRecent = useCallback(
      (query: string) => {
        setValue(query);

        // Re-save to bump to top
        if (enableRecent) {
          const updated = saveRecentSearch(recentStorageKey, query, maxRecent);
          setRecentSearches(updated);
        }

        onRecentSelect?.(query);

        if (closeOnSelect) {
          setIsOpen(false);
          setIsFocused(false);
          innerRef.current?.blur();
        }
      },
      [
        setValue,
        enableRecent,
        recentStorageKey,
        maxRecent,
        onRecentSelect,
        closeOnSelect,
      ],
    );

    const clearRecents = useCallback(() => {
      clearRecentSearches(recentStorageKey);
      setRecentSearches([]);
    }, [recentStorageKey]);

    // ── Debounced Search ─────────────────────────────────────────
    useEffect(() => {
      if (debouncedValue.length >= minQueryLength || debouncedValue === "") {
        onSearch?.(debouncedValue);
      }
    }, [debouncedValue, minQueryLength, onSearch]);

    // ── Keyboard Navigation ──────────────────────────────────────

    const getAbsoluteIndex = useCallback(
      (relativeIndex: number): { type: "recent" | "suggestion"; index: number } | null => {
        if (relativeIndex < 0) return null;

        let offset = 0;
        if (filteredRecent.length > 0) {
          if (relativeIndex < offset + filteredRecent.length) {
            return { type: "recent", index: relativeIndex - offset };
          }
          offset += filteredRecent.length;
        }
        if (filteredSuggestions.length > 0) {
          if (relativeIndex < offset + filteredSuggestions.length) {
            return { type: "suggestion", index: relativeIndex - offset };
          }
        }
        return null;
      },
      [filteredRecent, filteredSuggestions],
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!shouldShowDropdown) {
          // If dropdown not open and ArrowDown pressed, open it
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setIsOpen(true);
            setHighlightedIndex(0);
          }
          onKeyDown?.(e);
          return;
        }

        switch (e.key) {
          case "ArrowDown": {
            e.preventDefault();
            setHighlightedIndex((prev) => {
              const next = prev + 1;
              return next >= dropdownItemCount ? 0 : next;
            });
            break;
          }
          case "ArrowUp": {
            e.preventDefault();
            setHighlightedIndex((prev) => {
              const next = prev - 1;
              return next < 0 ? dropdownItemCount - 1 : next;
            });
            break;
          }
          case "Home": {
            e.preventDefault();
            setHighlightedIndex(0);
            break;
          }
          case "End": {
            e.preventDefault();
            setHighlightedIndex(dropdownItemCount - 1);
            break;
          }
          case "Enter": {
            if (highlightedIndex >= 0) {
              e.preventDefault();
              const resolved = getAbsoluteIndex(highlightedIndex);
              if (resolved) {
                if (resolved.type === "recent") {
                  selectRecent(filteredRecent[resolved.index]);
                } else {
                  selectSuggestion(filteredSuggestions[resolved.index]);
                }
              }
            } else if (currentValue.trim()) {
              e.preventDefault();
              // Save as recent and emit onSearch
              if (enableRecent) {
                const updated = saveRecentSearch(
                  recentStorageKey,
                  currentValue.trim(),
                  maxRecent,
                );
                setRecentSearches(updated);
              }
              onSearch?.(currentValue.trim());
              if (closeOnSelect) {
                setIsOpen(false);
                setIsFocused(false);
                innerRef.current?.blur();
              }
            }
            break;
          }
          case "Escape": {
            e.preventDefault();
            setIsOpen(false);
            setHighlightedIndex(-1);
            innerRef.current?.focus();
            break;
          }
          default: {
            // Typeahead — handled by onChange
            break;
          }
        }

        onKeyDown?.(e);
      },
      [
        shouldShowDropdown,
        dropdownItemCount,
        highlightedIndex,
        getAbsoluteIndex,
        filteredRecent,
        filteredSuggestions,
        selectRecent,
        selectSuggestion,
        currentValue,
        enableRecent,
        recentStorageKey,
        maxRecent,
        onSearch,
        closeOnSelect,
        onKeyDown,
      ],
    );

    // ── Click Outside ────────────────────────────────────────────
    useClickOutside(containerRef, () => {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }, shouldShowDropdown);

    // ── Scroll highlighted item into view ────────────────────────
    useEffect(() => {
      if (highlightedIndex < 0 || !dropdownRef.current) return;
      const items = dropdownRef.current.querySelectorAll(
        '[role="option"]',
      );
      const item = items[highlightedIndex] as HTMLElement | undefined;
      if (item) {
        item.scrollIntoView({ block: "nearest" });
      }
    }, [highlightedIndex]);

    // ── Icon sizing ──────────────────────────────────────────────
    const iconSizeClass =
      inputSize === "sm"
        ? "h-3.5 w-3.5"
        : inputSize === "lg"
          ? "h-5 w-5"
          : "h-4 w-4";

    const iconPadding =
      inputSize === "sm" ? "left-2" : inputSize === "lg" ? "left-4" : "left-3";

    // ── Render ───────────────────────────────────────────────────

    return (
      <div
        ref={containerRef}
        className={cn(fullWidth && "w-full", "relative")}
        data-search-input=""
      >
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className={cn(labelVariants({ inputSize }))}
          >
            {label}
          </label>
        )}

        {/* Input wrapper */}
        <div
          className={cn(
            wrapperVariants({ variant, inputSize, fullWidth }),
            disabled && "opacity-50 cursor-not-allowed",
            className,
          )}
        >
          {/* Left icon - Search */}
          <span
            className={cn(
              "absolute pointer-events-none text-text-tertiary",
              "group-focus-within:text-text-secondary transition-colors",
              iconPadding,
            )}
            aria-hidden="true"
          >
            <Search className={iconSizeClass} />
          </span>

          {/* Input field */}
          <input
            ref={innerRef}
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={shouldShowDropdown}
            aria-haspopup="listbox"
            aria-controls={shouldShowDropdown ? listboxId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={
              highlightedIndex >= 0
                ? `${optionIdPrefix}-${highlightedIndex}`
                : undefined
            }
            value={isControlled ? currentValue : undefined}
            defaultValue={
              !isControlled ? (defaultValue ?? "") : undefined
            }
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            readOnly={readOnly}
            placeholder={placeholder}
            autoComplete="off"
            className={cn(
              "flex-1 bg-transparent",
              "text-text-primary placeholder:text-text-tertiary",
              "outline-none border-none",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "read-only:cursor-default",
              variant === "underlined" && "px-0",
              inputSize === "sm" && "h-8 text-xs pl-8 pr-8",
              inputSize === "md" && "h-10 text-sm pl-10 pr-10",
              inputSize === "lg" && "h-12 text-base pl-12 pr-12",
            )}
            {...rest}
          />

          {/* Right side icons */}
          <div className="absolute right-0 top-0 bottom-0 flex items-center gap-1">
            {/* Loading spinner */}
            {isLoading && (
              <Loader2
                className={cn(
                  iconSizeClass,
                  "text-text-tertiary animate-spin",
                  inputSize === "sm"
                    ? "mr-1"
                    : inputSize === "lg"
                      ? "mr-3"
                      : "mr-2",
                )}
                aria-hidden="true"
              />
            )}

            {/* Clear button */}
            {showClear && (
              <button
                type="button"
                onClick={handleClear}
                className={cn(
                  "text-text-tertiary hover:text-text-secondary",
                  "transition-colors focus:outline-none focus:text-text-primary",
                  inputSize === "sm"
                    ? "p-1 mr-0.5"
                    : inputSize === "lg"
                      ? "p-1.5 mr-1"
                      : "p-1 mr-1",
                )}
                aria-label="Șterge căutarea"
                tabIndex={-1}
              >
                <X className={iconSizeClass} />
              </button>
            )}
          </div>
        </div>

        {/* Dropdown */}
        {shouldShowDropdown && (
          <ul
            ref={dropdownRef}
            id={listboxId}
            role="listbox"
            aria-label="Sugestii căutare"
            className={cn(
              dropdownVariants({ inputSize }),
              "absolute left-0 top-full mt-1",
            )}
            style={{ maxHeight: SUGGESTION_MAX_HEIGHT, overflowY: "auto" }}
          >
            {/* Loading state */}
            {isLoading && (
              <li
                className={cn(
                  suggestionItemVariants({ inputSize }),
                  "cursor-default text-text-tertiary",
                )}
                role="option"
                aria-selected={false}
              >
                <Loader2
                  className={cn(iconSizeClass, "animate-spin shrink-0")}
                  aria-hidden="true"
                />
                <span>{loadingMessage}</span>
              </li>
            )}

            {/* Empty state */}
            {!isLoading &&
              currentValue.length > 0 &&
              filteredSuggestions.length === 0 &&
              filteredRecent.length === 0 && (
                <li
                  className={cn(
                    suggestionItemVariants({ inputSize }),
                    "cursor-default text-text-tertiary",
                  )}
                  role="option"
                  aria-selected={false}
                >
                  <span className="flex-1 text-center">{emptyMessage}</span>
                </li>
              )}

            {/* Recent searches */}
            {!isLoading && filteredRecent.length > 0 && (
              <>
                <li
                  className={cn(groupLabelVariants({ inputSize }))}
                  role="presentation"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Clock
                        className={cn(
                          inputSize === "sm"
                            ? "h-3 w-3"
                            : inputSize === "lg"
                              ? "h-4 w-4"
                              : "h-3.5 w-3.5",
                        )}
                        aria-hidden="true"
                      />
                      {recentLabel}
                    </span>
                    <button
                      type="button"
                      onClick={clearRecents}
                      className={cn(
                        "text-text-tertiary hover:text-text-secondary",
                        "transition-colors focus:outline-none",
                        "text-[10px] font-normal",
                      )}
                      tabIndex={-1}
                      aria-label="Șterge căutările recente"
                    >
                      Șterge
                    </button>
                  </div>
                </li>
                {filteredRecent.map((item, idx) => {
                  const absoluteIdx = idx;
                  const isHighlighted = highlightedIndex === absoluteIdx;
                  return (
                    <li
                      key={`recent-${item}`}
                      id={`${optionIdPrefix}-${absoluteIdx}`}
                      role="option"
                      aria-selected={isHighlighted}
                      data-highlighted={isHighlighted ? "" : undefined}
                      className={cn(suggestionItemVariants({ inputSize }))}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectRecent(item);
                      }}
                      onMouseEnter={() => setHighlightedIndex(absoluteIdx)}
                    >
                      <Clock
                        className={cn(iconSizeClass, "text-text-tertiary shrink-0")}
                        aria-hidden="true"
                      />
                      <span className="flex-1 text-left truncate">{item}</span>
                      <ArrowUpRight
                        className={cn(
                          iconSizeClass,
                          "text-text-tertiary shrink-0 opacity-60",
                        )}
                        aria-hidden="true"
                      />
                    </li>
                  );
                })}
              </>
            )}

            {/* Suggestions */}
            {!isLoading &&
              filteredSuggestions.length > 0 &&
              suggestionsGroups(filteredSuggestions).map(
                ({ group, items, startIndex }) => {
                  // startIndex is relative to suggestions only; add filteredRecent.length
                  const recentOffset = filteredRecent.length;
                  return (
                    <React.Fragment key={group ?? "__ungrouped"}>
                      {group && (
                        <li
                          className={cn(groupLabelVariants({ inputSize }))}
                          role="presentation"
                        >
                          {group}
                        </li>
                      )}
                      {items.map((suggestion, idx) => {
                        const absoluteIdx = recentOffset + startIndex + idx;
                        const isHighlighted =
                          highlightedIndex === absoluteIdx;
                        return (
                          <li
                            key={suggestion.id}
                            id={`${optionIdPrefix}-${absoluteIdx}`}
                            role="option"
                            aria-selected={isHighlighted}
                            data-highlighted={isHighlighted ? "" : undefined}
                            className={cn(
                              suggestionItemVariants({ inputSize }),
                            )}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              selectSuggestion(suggestion);
                            }}
                            onMouseEnter={() =>
                              setHighlightedIndex(absoluteIdx)
                            }
                          >
                            {suggestion.icon && (
                              <span
                                className="text-text-tertiary shrink-0"
                                aria-hidden="true"
                              >
                                {suggestion.icon}
                              </span>
                            )}
                            <div className="flex-1 min-w-0 text-left">
                              <div className="truncate">{suggestion.label}</div>
                              {suggestion.description && (
                                <div
                                  className={cn(
                                    "text-text-tertiary truncate",
                                    inputSize === "sm"
                                      ? "text-[10px]"
                                      : "text-xs",
                                  )}
                                >
                                  {suggestion.description}
                                </div>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </React.Fragment>
                  );
                },
              )}
          </ul>
        )}
      </div>
    );
  },
);

SearchInput.displayName = "SearchInput";

// ═══════════════════════════════════════════════════════════════════════
// Helper: Group suggestions by their `group` field
// ═══════════════════════════════════════════════════════════════════════

interface GroupedSuggestions {
  group: string | null;
  items: SearchSuggestion[];
  /** Starting index within the suggestions array */
  startIndex: number;
}

function suggestionsGroups(
  suggestions: SearchSuggestion[],
): GroupedSuggestions[] {
  const map = new Map<string | null, SearchSuggestion[]>();
  const order: (string | null)[] = [];

  let globalIndex = 0;
  const indexMap = new Map<string | null, number>();

  for (const s of suggestions) {
    const key = s.group ?? null;
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
      indexMap.set(key, globalIndex);
    }
    map.get(key)!.push(s);
    globalIndex++;
  }

  return order.map((key) => ({
    group: key,
    items: map.get(key)!,
    startIndex: indexMap.get(key)!,
  }));
}

// ═══════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════

export {
  SearchInput,
  wrapperVariants as searchInputWrapperVariants,
  labelVariants as searchInputLabelVariants,
  dropdownVariants as searchInputDropdownVariants,
  suggestionItemVariants as searchInputSuggestionItemVariants,
  loadRecentSearches,
  saveRecentSearch,
  clearRecentSearches,
  defaultFilterSuggestions,
};

export default SearchInput;
"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
  forwardRef,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  isAfter,
  addMonths,
  subMonths,
  addYears,
  subYears,
  setMonth,
  setYear,
  getYear,
  getMonth,
  startOfYear,
  differenceInCalendarDays,
} from "date-fns";

// ═══════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════

const CALENDAR_KEYS = {
  LEFT: "ArrowLeft",
  RIGHT: "ArrowRight",
  UP: "ArrowUp",
  DOWN: "ArrowDown",
  HOME: "Home",
  END: "End",
  PAGE_UP: "PageUp",
  PAGE_DOWN: "PageDown",
  ENTER: "Enter",
  SPACE: " ",
  ESCAPE: "Escape",
} as const;

const DEFAULT_LOCALE: CalendarLocale = {
  code: "ro",
  monthNames: [
    "Ianuarie",
    "Februarie",
    "Martie",
    "Aprilie",
    "Mai",
    "Iunie",
    "Iulie",
    "August",
    "Septembrie",
    "Octombrie",
    "Noiembrie",
    "Decembrie",
  ],
  monthNamesShort: [
    "Ian",
    "Feb",
    "Mar",
    "Apr",
    "Mai",
    "Iun",
    "Iul",
    "Aug",
    "Sep",
    "Oct",
    "Noi",
    "Dec",
  ],
  dayNames: [
    "Duminică",
    "Luni",
    "Marți",
    "Miercuri",
    "Joi",
    "Vineri",
    "Sâmbătă",
  ],
  dayNamesShort: ["Du", "Lu", "Ma", "Mi", "Jo", "Vi", "Sâ"],
  dayNamesMin: ["D", "L", "M", "M", "J", "V", "S"],
  weekStartsOn: 1,
  todayLabel: "Astăzi",
  clearLabel: "Șterge",
  selectRangeLabel: "Selectează interval",
  selectMultipleLabel: "Selectează date multiple",
  noEventsLabel: "Niciun eveniment",
  previousMonthLabel: "Luna anterioară",
  nextMonthLabel: "Luna următoare",
  previousYearLabel: "Anul anterior",
  nextYearLabel: "Anul următor",
  monthSelectorLabel: "Selectează luna",
  yearSelectorLabel: "Selectează anul",
};

const EN_LOCALE: CalendarLocale = {
  code: "en",
  monthNames: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
  monthNamesShort: [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ],
  dayNames: [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ],
  dayNamesShort: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
  dayNamesMin: ["S", "M", "T", "W", "T", "F", "S"],
  weekStartsOn: 0,
  todayLabel: "Today",
  clearLabel: "Clear",
  selectRangeLabel: "Select range",
  selectMultipleLabel: "Select multiple dates",
  noEventsLabel: "No events",
  previousMonthLabel: "Previous month",
  nextMonthLabel: "Next month",
  previousYearLabel: "Previous year",
  nextYearLabel: "Next year",
  monthSelectorLabel: "Select month",
  yearSelectorLabel: "Select year",
};

const LOCALE_MAP: Record<string, CalendarLocale> = {
  ro: DEFAULT_LOCALE,
  en: EN_LOCALE,
};

// ═══════════════════════════════════════════════════════════════════════
// Variant Definitions
// ═══════════════════════════════════════════════════════════════════════

const calendarVariants = cva(
  [
    "inline-flex flex-col",
    "bg-surface border border-border-subtle",
    "rounded-lg shadow-elevation-1",
    "select-none",
  ],
  {
    variants: {
      size: {
        sm: "w-[240px] p-2 text-xs",
        md: "w-[280px] p-3 text-sm",
        lg: "w-[320px] p-4 text-base",
      },
      fullWidth: {
        true: "w-full",
        false: "",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const calendarDayVariants = cva(
  [
    "relative inline-flex items-center justify-center",
    "rounded-md font-medium",
    "transition-all duration-150",
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-border-focus focus-visible:ring-offset-1",
    "disabled:pointer-events-none disabled:opacity-30",
  ],
  {
    variants: {
      size: {
        sm: "h-7 w-7 text-xs",
        md: "h-9 w-9 text-sm",
        lg: "h-10 w-10 text-base",
      },
      state: {
        default:
          "text-text-primary hover:bg-surface-secondary cursor-pointer",
        selected:
          "bg-brand-500 text-white hover:bg-brand-600 cursor-pointer",
        today:
          "text-brand-600 font-semibold border border-brand-300 cursor-pointer",
        todaySelected:
          "bg-brand-500 text-white font-semibold hover:bg-brand-600 cursor-pointer",
        rangeStart:
          "bg-brand-500 text-white rounded-r-none hover:bg-brand-600 cursor-pointer",
        rangeEnd:
          "bg-brand-500 text-white rounded-l-none hover:bg-brand-600 cursor-pointer",
        rangeMiddle:
          "bg-brand-50 text-brand-700 rounded-none hover:bg-brand-100 cursor-pointer",
        otherMonth:
          "text-text-quaternary hover:text-text-tertiary hover:bg-surface-secondary/50 cursor-pointer",
        disabled:
          "text-text-quaternary/50 cursor-not-allowed",
        hovered:
          "bg-brand-50 text-brand-700 cursor-pointer",
      },
    },
    defaultVariants: {
      size: "md",
      state: "default",
    },
  },
);

const calendarHeaderVariants = cva(
  ["flex items-center justify-between", "mb-1"],
  {
    variants: {
      size: {
        sm: "gap-0.5",
        md: "gap-1",
        lg: "gap-2",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const calendarNavButtonVariants = cva(
  [
    "inline-flex items-center justify-center rounded-md",
    "text-text-tertiary hover:text-text-primary",
    "hover:bg-surface-secondary",
    "transition-colors duration-150",
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-border-focus",
  ],
  {
    variants: {
      size: {
        sm: "h-6 w-6",
        md: "h-7 w-7",
        lg: "h-8 w-8",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const calendarWeekdayVariants = cva(
  ["text-center font-medium text-text-tertiary"],
  {
    variants: {
      size: {
        sm: "h-6 w-7 text-[10px]",
        md: "h-7 w-9 text-xs",
        lg: "h-8 w-10 text-sm",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const calendarEventDotVariants = cva(
  ["absolute rounded-full"],
  {
    variants: {
      size: {
        sm: "bottom-0.5 h-1 w-1",
        md: "bottom-1 h-1.5 w-1.5",
        lg: "bottom-1 h-2 w-2",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

const calendarEventsListVariants = cva(
  [
    "border-t border-border-subtle",
    "overflow-y-auto",
  ],
  {
    variants: {
      size: {
        sm: "mt-1 pt-1 max-h-16 text-[10px]",
        md: "mt-2 pt-2 max-h-24 text-xs",
        lg: "mt-2 pt-2 max-h-32 text-sm",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

export interface CalendarLocale {
  code: string;
  monthNames: string[];
  monthNamesShort: string[];
  dayNames: string[];
  dayNamesShort: string[];
  dayNamesMin: string[];
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  todayLabel: string;
  clearLabel: string;
  selectRangeLabel: string;
  selectMultipleLabel: string;
  noEventsLabel: string;
  previousMonthLabel: string;
  nextMonthLabel: string;
  previousYearLabel: string;
  nextYearLabel: string;
  monthSelectorLabel: string;
  yearSelectorLabel: string;
}

export interface CalendarEvent {
  /** Unique identifier */
  id: string;
  /** Date of the event (YYYY-MM-DD) */
  date: string;
  /** Display label */
  title: string;
  /** Optional color (CSS class or hex) */
  color?: string;
  /** Optional icon */
  icon?: React.ReactNode;
  /** Optional additional data */
  meta?: Record<string, unknown>;
}

export type SelectionMode = "single" | "range" | "multiple";

type CalendarSize = VariantProps<typeof calendarVariants>["size"];

// ═══════════════════════════════════════════════════════════════════════
// Context
// ═══════════════════════════════════════════════════════════════════════

type CalendarContextValue = {
  size: NonNullable<CalendarSize>;
  locale: CalendarLocale;
  month: Date;
  year: Date;
  setMonth: (date: Date) => void;
  setYear: (date: Date) => void;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  goToPreviousYear: () => void;
  goToNextYear: () => void;
  selectionMode: SelectionMode;
  selectedDates: Date[];
  rangeStart: Date | null;
  rangeEnd: Date | null;
  hoveredDate: Date | null;
  focusedDate: Date;
  selectDate: (date: Date) => void;
  setHoveredDate: (date: Date | null) => void;
  setFocusedDate: (date: Date) => void;
  isDateSelected: (date: Date) => boolean;
  isDateInRange: (date: Date) => boolean;
  isRangeStart: (date: Date) => boolean;
  isRangeEnd: (date: Date) => boolean;
  minDate: Date | null;
  maxDate: Date | null;
  disabledDates: Date[];
  disabledDaysOfWeek: number[];
  isDateDisabled: (date: Date) => boolean;
  events: Map<string, CalendarEvent[]>;
  showEvents: boolean;
  eventsForDate: (date: Date) => CalendarEvent[];
  onDateClick?: (date: Date) => void;
  onRangeChange?: (start: Date | null, end: Date | null) => void;
  onMultiChange?: (dates: Date[]) => void;
  showWeekNumbers: boolean;
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  gridId: string;
  todayId: string;
  canNavigateMonths: boolean;
  canNavigateYears: boolean;
  showMonthYearSelectors: boolean;
};

const CalendarContext = createContext<CalendarContextValue | null>(null);

function useCalendarContext() {
  const ctx = useContext(CalendarContext);
  if (!ctx) {
    throw new Error(
      "Calendar compound components must be used within a <Calendar> root.",
    );
  }
  return ctx;
}

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

function normalizeDate(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

// ═══════════════════════════════════════════════════════════════════════
// Calendar (Root)
// ═══════════════════════════════════════════════════════════════════════

export interface CalendarProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Controlled selected date (single mode) */
  value?: Date | null;
  /** Controlled selected dates (multiple mode) */
  values?: Date[];
  /** Controlled range start */
  rangeStart?: Date | null;
  /** Controlled range end */
  rangeEnd?: Date | null;
  /** Default selected date */
  defaultValue?: Date | null;
  /** Default range start */
  defaultRangeStart?: Date | null;
  /** Default range end */
  defaultRangeEnd?: Date | null;
  /** Selection mode */
  selectionMode?: SelectionMode;
  /** Current displayed month */
  month?: Date;
  /** Default displayed month */
  defaultMonth?: Date;
  /** Called when month changes */
  onMonthChange?: (month: Date) => void;
  /** Called on date selection (single mode) */
  onChange?: (date: Date | null) => void;
  /** Called on range change */
  onRangeChange?: (start: Date | null, end: Date | null) => void;
  /** Called on multi-select change */
  onMultiChange?: (dates: Date[]) => void;
  /** Called when a date is clicked (any mode) */
  onDateClick?: (date: Date) => void;
  /** Minimum selectable date */
  minDate?: Date | null;
  /** Maximum selectable date */
  maxDate?: Date | null;
  /** Disabled dates */
  disabledDates?: Date[];
  /** Days of week to disable (0=Sunday, 6=Saturday) */
  disabledDaysOfWeek?: number[];
  /** Events to display */
  events?: CalendarEvent[];
  /** Show events panel below calendar */
  showEvents?: boolean;
  /** Show week numbers column */
  showWeekNumbers?: boolean;
  /** Locale override (code string or full locale object) */
  locale?: string | Partial<CalendarLocale>;
  /** Size preset */
  size?: CalendarSize;
  /** Full-width mode */
  fullWidth?: boolean;
  /** Show today button */
  showTodayButton?: boolean;
  /** Show clear button */
  showClearButton?: boolean;
  /** Show month/year selectors */
  showMonthYearSelectors?: boolean;
  /** Allow navigating months */
  canNavigateMonths?: boolean;
  /** Allow navigating years */
  canNavigateYears?: boolean;
  /** Accessible label */
  "aria-label"?: string;
}

const Calendar = forwardRef<HTMLDivElement, CalendarProps>(
  (
    {
      value: controlledValue,
      values: controlledValues,
      rangeStart: controlledRangeStart,
      rangeEnd: controlledRangeEnd,
      defaultValue,
      defaultRangeStart,
      defaultRangeEnd,
      selectionMode = "single",
      month: controlledMonth,
      defaultMonth,
      onMonthChange,
      onChange,
      onRangeChange: onRangeChangeProp,
      onMultiChange: onMultiChangeProp,
      onDateClick: onDateClickProp,
      minDate: minDateProp,
      maxDate: maxDateProp,
      disabledDates: disabledDatesProp = [],
      disabledDaysOfWeek: disabledDaysOfWeekProp = [],
      events: eventsProp = [],
      showEvents = false,
      showWeekNumbers = false,
      locale: localeProp,
      size = "md",
      fullWidth = false,
      showTodayButton = true,
      showClearButton = true,
      showMonthYearSelectors = true,
      canNavigateMonths = true,
      canNavigateYears = true,
      "aria-label": ariaLabel = "Calendar",
      className,
      ...rest
    },
    ref,
  ) => {
    const autoId = useId();
    const gridId = `${autoId}-grid`;
    const todayId = `${autoId}-today`;

    // ── Resolve locale ──────────────────────────────────────────
    const locale = useMemo<CalendarLocale>(() => {
      if (!localeProp) return DEFAULT_LOCALE;
      if (typeof localeProp === "string") {
        const base = LOCALE_MAP[localeProp] ?? DEFAULT_LOCALE;
        return base;
      }
      return { ...DEFAULT_LOCALE, ...localeProp };
    }, [localeProp]);

    const weekStartsOn = locale.weekStartsOn;

    // ── Controlled / uncontrolled month ─────────────────────────
    const isMonthControlled = controlledMonth !== undefined;
    const [internalMonth, setInternalMonth] = useState<Date>(
      () => normalizeDate(defaultMonth ?? controlledMonth ?? new Date()),
    );
    const displayMonth = isMonthControlled
      ? normalizeDate(controlledMonth!)
      : internalMonth;

    const setMonthValue = useCallback(
      (d: Date) => {
        const nd = normalizeDate(d);
        if (!isMonthControlled) setInternalMonth(nd);
        onMonthChange?.(nd);
      },
      [isMonthControlled, onMonthChange],
    );

    // ── Year tracking ───────────────────────────────────────────
    const displayYear = useMemo(
      () => startOfYear(displayMonth),
      [displayMonth],
    );

    // ── Controlled / uncontrolled selection ─────────────────────
    const isSingleControlled = controlledValue !== undefined;
    const isRangeControlled =
      controlledRangeStart !== undefined || controlledRangeEnd !== undefined;
    const isMultiControlled = controlledValues !== undefined;

    const [internalValue, setInternalValue] = useState<Date | null>(
      () => defaultValue ?? null,
    );
    const [internalRangeStart, setInternalRangeStart] = useState<Date | null>(
      () => defaultRangeStart ?? null,
    );
    const [internalRangeEnd, setInternalRangeEnd] = useState<Date | null>(
      () => defaultRangeEnd ?? null,
    );
    const [internalMultiValues, setInternalMultiValues] = useState<Date[]>([]);

    const selectedDate = isSingleControlled ? controlledValue ?? null : internalValue;
    const rangeStart = isRangeControlled ? controlledRangeStart ?? null : internalRangeStart;
    const rangeEnd = isRangeControlled ? controlledRangeEnd ?? null : internalRangeEnd;
    const multiValues = isMultiControlled ? controlledValues ?? [] : internalMultiValues;

    // ── Hovered / focused ───────────────────────────────────────
    const [hoveredDate, setHoveredDate] = useState<Date | null>(null);
    const [focusedDate, setFocusedDate] = useState<Date>(
      () => normalizeDate(controlledMonth ?? defaultMonth ?? new Date()),
    );

    // ── Process dates ───────────────────────────────────────────
    const minDate = useMemo(
      () => (minDateProp ? normalizeDate(minDateProp) : null),
      [minDateProp],
    );
    const maxDate = useMemo(
      () => (maxDateProp ? normalizeDate(maxDateProp) : null),
      [maxDateProp],
    );
    const disabledDates = useMemo(
      () => disabledDatesProp.map(normalizeDate),
      [disabledDatesProp],
    );
    const disabledDaysOfWeek = useMemo(
      () => disabledDaysOfWeekProp,
      [disabledDaysOfWeekProp],
    );

    const isDateDisabled = useCallback(
      (date: Date) => {
        const d = normalizeDate(date);
        if (minDate && isBefore(d, minDate)) return true;
        if (maxDate && isAfter(d, maxDate)) return true;
        if (disabledDates.some((dd) => isSameDay(dd, d))) return true;
        if (disabledDaysOfWeek.includes(d.getDay())) return true;
        return false;
      },
      [minDate, maxDate, disabledDates, disabledDaysOfWeek],
    );

    // ── Selection helpers ───────────────────────────────────────
    const isDateSelected = useCallback(
      (date: Date) => {
        const d = normalizeDate(date);
        if (selectionMode === "single") {
          return selectedDate ? isSameDay(selectedDate, d) : false;
        }
        if (selectionMode === "multiple") {
          return multiValues.some((mv) => isSameDay(mv, d));
        }
        return false;
      },
      [selectionMode, selectedDate, multiValues],
    );

    const isRangeStart = useCallback(
      (date: Date) => {
        if (selectionMode !== "range") return false;
        return rangeStart ? isSameDay(rangeStart, date) : false;
      },
      [selectionMode, rangeStart],
    );

    const isRangeEnd = useCallback(
      (date: Date) => {
        if (selectionMode !== "range") return false;
        return rangeEnd ? isSameDay(rangeEnd, date) : false;
      },
      [selectionMode, rangeEnd],
    );

    const isDateInRange = useCallback(
      (date: Date) => {
        if (selectionMode !== "range") return false;
        const d = normalizeDate(date);

        // Definite range
        if (rangeStart && rangeEnd) {
          const start = normalizeDate(rangeStart);
          const end = normalizeDate(rangeEnd);
          if (isBefore(end, start)) {
            return isAfter(d, end) && isBefore(d, start);
          }
          return isAfter(d, start) && isBefore(d, end);
        }

        // Preview range (hover)
        if (rangeStart && hoveredDate && !rangeEnd) {
          const start = normalizeDate(rangeStart);
          const end = normalizeDate(hoveredDate);
          if (isBefore(end, start)) {
            return isAfter(d, end) && isBefore(d, start);
          }
          return isAfter(d, start) && isBefore(d, end);
        }

        return false;
      },
      [selectionMode, rangeStart, rangeEnd, hoveredDate],
    );

    // ── Select date ─────────────────────────────────────────────
    const selectDate = useCallback(
      (date: Date) => {
        const d = normalizeDate(date);
        if (isDateDisabled(d)) return;

        if (selectionMode === "single") {
          if (!isSingleControlled) setInternalValue(d);
          onChange?.(d);
        } else if (selectionMode === "range") {
          if (!rangeStart || (rangeStart && rangeEnd)) {
            // Start new range
            if (!isRangeControlled) {
              setInternalRangeStart(d);
              setInternalRangeEnd(null);
            }
            onRangeChangeProp?.(d, null);
          } else {
            // Complete range
            const start = normalizeDate(rangeStart);
            if (isBefore(d, start)) {
              // Reversed: d is start, previous start is end
              if (!isRangeControlled) {
                setInternalRangeStart(d);
                setInternalRangeEnd(start);
              }
              onRangeChangeProp?.(d, start);
            } else {
              if (!isRangeControlled) {
                setInternalRangeEnd(d);
              }
              onRangeChangeProp?.(start, d);
            }
          }
        } else if (selectionMode === "multiple") {
          const exists = multiValues.some((mv) => isSameDay(mv, d));
          const newValues = exists
            ? multiValues.filter((mv) => !isSameDay(mv, d))
            : [...multiValues, d].sort((a, b) => a.getTime() - b.getTime());
          if (!isMultiControlled) setInternalMultiValues(newValues);
          onMultiChangeProp?.(newValues);
        }

        onDateClickProp?.(d);
      },
      [
        selectionMode,
        isDateDisabled,
        isSingleControlled,
        isRangeControlled,
        isMultiControlled,
        rangeStart,
        rangeEnd,
        multiValues,
        onChange,
        onRangeChangeProp,
        onMultiChangeProp,
        onDateClickProp,
      ],
    );

    // ── Navigation ──────────────────────────────────────────────
    const goToPreviousMonth = useCallback(() => {
      if (!canNavigateMonths) return;
      setMonthValue(subMonths(displayMonth, 1));
    }, [canNavigateMonths, displayMonth, setMonthValue]);

    const goToNextMonth = useCallback(() => {
      if (!canNavigateMonths) return;
      setMonthValue(addMonths(displayMonth, 1));
    }, [canNavigateMonths, displayMonth, setMonthValue]);

    const goToPreviousYear = useCallback(() => {
      if (!canNavigateYears) return;
      setMonthValue(subYears(displayMonth, 1));
    }, [canNavigateYears, displayMonth, setMonthValue]);

    const goToNextYear = useCallback(() => {
      if (!canNavigateYears) return;
      setMonthValue(addYears(displayMonth, 1));
    }, [canNavigateYears, displayMonth, setMonthValue]);

    const setMonthDirect = useCallback(
      (date: Date) => {
        const current = displayMonth;
        const newDate = setMonth(current, getMonth(date));
        setMonthValue(newDate);
      },
      [displayMonth, setMonthValue],
    );

    const setYearDirect = useCallback(
      (date: Date) => {
        const current = displayMonth;
        const newDate = setYear(current, getYear(date));
        setMonthValue(newDate);
      },
      [displayMonth, setMonthValue],
    );

    // ── Selected dates list ─────────────────────────────────────
    const selectedDates = useMemo<Date[]>(() => {
      if (selectionMode === "single") return selectedDate ? [selectedDate] : [];
      if (selectionMode === "range") {
        const dates: Date[] = [];
        if (rangeStart && rangeEnd) {
          const start = normalizeDate(rangeStart);
          const end = normalizeDate(rangeEnd);
          const [s, e] = isBefore(start, end) ? [start, end] : [end, start];
          const days = differenceInCalendarDays(e, s);
          for (let i = 0; i <= days; i++) {
            const d = new Date(s);
            d.setDate(d.getDate() + i);
            dates.push(normalizeDate(d));
          }
        } else if (rangeStart) {
          dates.push(normalizeDate(rangeStart));
        }
        return dates;
      }
      return multiValues;
    }, [selectionMode, selectedDate, rangeStart, rangeEnd, multiValues]);

    // ── Events map ──────────────────────────────────────────────
    const eventsMap = useMemo(() => {
      const map = new Map<string, CalendarEvent[]>();
      for (const ev of eventsProp) {
        const key = ev.date;
        const existing = map.get(key) ?? [];
        existing.push(ev);
        map.set(key, existing);
      }
      return map;
    }, [eventsProp]);

    const eventsForDate = useCallback(
      (date: Date): CalendarEvent[] => {
        return eventsMap.get(dateKey(date)) ?? [];
      },
      [eventsMap],
    );

    // ── Context value ───────────────────────────────────────────
    const contextValue = useMemo<CalendarContextValue>(
      () => ({
        size: size!,
        locale,
        month: displayMonth,
        year: displayYear,
        setMonth: setMonthDirect,
        setYear: setYearDirect,
        goToPreviousMonth,
        goToNextMonth,
        goToPreviousYear,
        goToNextYear,
        selectionMode,
        selectedDates,
        rangeStart,
        rangeEnd,
        hoveredDate,
        focusedDate,
        selectDate,
        setHoveredDate,
        setFocusedDate,
        isDateSelected,
        isDateInRange,
        isRangeStart,
        isRangeEnd,
        minDate,
        maxDate,
        disabledDates,
        disabledDaysOfWeek,
        isDateDisabled,
        events: eventsMap,
        showEvents,
        eventsForDate,
        onDateClick: onDateClickProp,
        onRangeChange: onRangeChangeProp,
        onMultiChange: onMultiChangeProp,
        showWeekNumbers,
        weekStartsOn,
        gridId,
        todayId,
        canNavigateMonths,
        canNavigateYears,
        showMonthYearSelectors,
      }),
      [
        size,
        locale,
        displayMonth,
        displayYear,
        setMonthDirect,
        setYearDirect,
        goToPreviousMonth,
        goToNextMonth,
        goToPreviousYear,
        goToNextYear,
        selectionMode,
        selectedDates,
        rangeStart,
        rangeEnd,
        hoveredDate,
        focusedDate,
        selectDate,
        isDateSelected,
        isDateInRange,
        isRangeStart,
        isRangeEnd,
        minDate,
        maxDate,
        disabledDates,
        disabledDaysOfWeek,
        isDateDisabled,
        eventsMap,
        showEvents,
        eventsForDate,
        onDateClickProp,
        onRangeChangeProp,
        onMultiChangeProp,
        showWeekNumbers,
        weekStartsOn,
        gridId,
        todayId,
        canNavigateMonths,
        canNavigateYears,
        showMonthYearSelectors,
      ],
    );

    return (
      <CalendarContext.Provider value={contextValue}>
        <div
          ref={ref}
          role="group"
          aria-label={ariaLabel}
          className={cn(
            calendarVariants({ size, fullWidth }),
            className,
          )}
          {...rest}
        >
          <CalendarHeader />
          <CalendarGrid />
          {(showTodayButton || showClearButton) && <CalendarFooter />}
          {showEvents && <CalendarEventsPanel />}
        </div>
      </CalendarContext.Provider>
    );
  },
);

Calendar.displayName = "Calendar";

// ═══════════════════════════════════════════════════════════════════════
// CalendarHeader
// ═══════════════════════════════════════════════════════════════════════

interface CalendarHeaderProps {
  className?: string;
}

const CalendarHeader = forwardRef<HTMLDivElement, CalendarHeaderProps>(
  ({ className }, ref) => {
    const ctx = useCalendarContext();
    const { size, locale, month } = ctx;

    const monthLabel = locale.monthNames[getMonth(month)]!;
    const yearLabel = String(getYear(month));

    return (
      <div
        ref={ref}
        className={cn(calendarHeaderVariants({ size }), className)}
      >
        <div className="flex items-center gap-0.5">
          {ctx.canNavigateYears && (
            <button
              type="button"
              aria-label={locale.previousYearLabel}
              onClick={ctx.goToPreviousYear}
              className={cn(calendarNavButtonVariants({ size }))}
              disabled={
                ctx.minDate && isBefore(subYears(month, 1), ctx.minDate)
                  ? true
                  : undefined
              }
            >
              <ChevronsLeft
                className={size === "sm" ? "h-3 w-3" : size === "lg" ? "h-4.5 w-4.5" : "h-4 w-4"}
                aria-hidden="true"
              />
            </button>
          )}
          {ctx.canNavigateMonths && (
            <button
              type="button"
              aria-label={locale.previousMonthLabel}
              onClick={ctx.goToPreviousMonth}
              className={cn(calendarNavButtonVariants({ size }))}
              disabled={
                ctx.minDate && isBefore(subMonths(month, 1), ctx.minDate)
                  ? true
                  : undefined
              }
            >
              <ChevronLeft
                className={size === "sm" ? "h-3 w-3" : size === "lg" ? "h-4.5 w-4.5" : "h-4 w-4"}
                aria-hidden="true"
              />
            </button>
          )}

          <div className="flex items-center gap-1 font-semibold text-text-primary min-w-0">
            {ctx.showMonthYearSelectors ? (
              <>
                <MonthSelector />
                <YearSelector />
              </>
            ) : (
              <span className="px-1 whitespace-nowrap">
                {monthLabel} {yearLabel}
              </span>
            )}
          </div>

          {ctx.canNavigateMonths && (
            <button
              type="button"
              aria-label={locale.nextMonthLabel}
              onClick={ctx.goToNextMonth}
              className={cn(calendarNavButtonVariants({ size }))}
              disabled={
                ctx.maxDate && isAfter(addMonths(month, 1), ctx.maxDate)
                  ? true
                  : undefined
              }
            >
              <ChevronRight
                className={size === "sm" ? "h-3 w-3" : size === "lg" ? "h-4.5 w-4.5" : "h-4 w-4"}
                aria-hidden="true"
              />
            </button>
          )}
          {ctx.canNavigateYears && (
            <button
              type="button"
              aria-label={locale.nextYearLabel}
              onClick={ctx.goToNextYear}
              className={cn(calendarNavButtonVariants({ size }))}
              disabled={
                ctx.maxDate && isAfter(addYears(month, 1), ctx.maxDate)
                  ? true
                  : undefined
              }
            >
              <ChevronsRight
                className={size === "sm" ? "h-3 w-3" : size === "lg" ? "h-4.5 w-4.5" : "h-4 w-4"}
                aria-hidden="true"
              />
            </button>
          )}
        </div>
      </div>
    );
  },
);

CalendarHeader.displayName = "CalendarHeader";

// ═══════════════════════════════════════════════════════════════════════
// MonthSelector
// ═══════════════════════════════════════════════════════════════════════

function MonthSelector() {
  const ctx = useCalendarContext();
  const { size, locale, month, setMonth } = ctx;
  const selectId = useId();

  const currentMonth = getMonth(month);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const idx = parseInt(e.target.value, 10);
      const newDate = new Date(month);
      newDate.setMonth(idx);
      setMonth(newDate);
    },
    [month, setMonth],
  );

  return (
    <div className="relative">
      <select
        id={selectId}
        value={currentMonth}
        onChange={handleChange}
        aria-label={locale.monthSelectorLabel}
        className={cn(
          "appearance-none bg-transparent font-semibold text-text-primary",
          "cursor-pointer rounded px-1 py-0.5",
          "hover:bg-surface-secondary",
          "focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-border-focus",
          size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm",
        )}
      >
        {locale.monthNamesShort.map((name, i) => (
          <option key={i} value={i}>
            {name}
          </option>
        ))}
      </select>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// YearSelector
// ═══════════════════════════════════════════════════════════════════════

function YearSelector() {
  const ctx = useCalendarContext();
  const { size, locale, month, setYear, minDate, maxDate } = ctx;
  const selectId = useId();

  const currentYear = getYear(month);
  const minYear = minDate ? getYear(minDate) : currentYear - 100;
  const maxYear = maxDate ? getYear(maxDate) : currentYear + 100;

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = minYear; y <= maxYear; y++) {
      years.push(y);
    }
    return years;
  }, [minYear, maxYear]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const yr = parseInt(e.target.value, 10);
      const newDate = new Date(month);
      newDate.setFullYear(yr);
      setYear(newDate);
    },
    [month, setYear],
  );

  return (
    <div className="relative">
      <select
        id={selectId}
        value={currentYear}
        onChange={handleChange}
        aria-label={locale.yearSelectorLabel}
        className={cn(
          "appearance-none bg-transparent font-semibold text-text-primary",
          "cursor-pointer rounded px-1 py-0.5",
          "hover:bg-surface-secondary",
          "focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-border-focus",
          size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm",
        )}
      >
        {yearOptions.map((yr) => (
          <option key={yr} value={yr}>
            {yr}
          </option>
        ))}
      </select>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CalendarGrid
// ═══════════════════════════════════════════════════════════════════════

interface CalendarGridProps {
  className?: string;
}

const CalendarGrid = forwardRef<HTMLTableElement, CalendarGridProps>(
  ({ className }, ref) => {
    const ctx = useCalendarContext();
    const { size, locale, month, weekStartsOn, showWeekNumbers, gridId } = ctx;

    // ── Compute visible days ────────────────────────────────────
    const days = useMemo(() => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      const calStart = startOfWeek(monthStart, { weekStartsOn });
      const calEnd = endOfWeek(monthEnd, { weekStartsOn });
      return eachDayOfInterval({ start: calStart, end: calEnd });
    }, [month, weekStartsOn]);

    // ── Group into weeks ────────────────────────────────────────
    const weeks = useMemo(() => {
      const result: Date[][] = [];
      let currentWeek: Date[] = [];
      for (const day of days) {
        currentWeek.push(day);
        if (currentWeek.length === 7) {
          result.push(currentWeek);
          currentWeek = [];
        }
      }
      if (currentWeek.length > 0) {
        result.push(currentWeek);
      }
      return result;
    }, [days]);

    // ── Weekday headers ─────────────────────────────────────────
    const weekDays = useMemo(() => {
      const allDays = locale.dayNamesMin;
      const shifted: string[] = [];
      for (let i = 0; i < 7; i++) {
        shifted.push(allDays[(i + weekStartsOn) % 7]!);
      }
      return shifted;
    }, [locale, weekStartsOn]);

    // ── Keyboard handler ────────────────────────────────────────
    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLTableElement>) => {
        const { focusedDate, setFocusedDate, selectDate, selectionMode } = ctx;
        let newDate = new Date(focusedDate);

        switch (e.key) {
          case CALENDAR_KEYS.LEFT:
            e.preventDefault();
            newDate.setDate(newDate.getDate() - 1);
            break;
          case CALENDAR_KEYS.RIGHT:
            e.preventDefault();
            newDate.setDate(newDate.getDate() + 1);
            break;
          case CALENDAR_KEYS.UP:
            e.preventDefault();
            newDate.setDate(newDate.getDate() - 7);
            break;
          case CALENDAR_KEYS.DOWN:
            e.preventDefault();
            newDate.setDate(newDate.getDate() + 7);
            break;
          case CALENDAR_KEYS.HOME:
            e.preventDefault();
            newDate = startOfMonth(focusedDate);
            break;
          case CALENDAR_KEYS.END:
            e.preventDefault();
            newDate = endOfMonth(focusedDate);
            break;
          case CALENDAR_KEYS.PAGE_UP:
            e.preventDefault();
            newDate = subMonths(focusedDate, 1);
            break;
          case CALENDAR_KEYS.PAGE_DOWN:
            e.preventDefault();
            newDate = addMonths(focusedDate, 1);
            break;
          case CALENDAR_KEYS.ENTER:
          case CALENDAR_KEYS.SPACE:
            e.preventDefault();
            selectDate(focusedDate);
            return;
          default:
            return;
        }

        setFocusedDate(normalizeDate(newDate));

        // If navigating to a different month, update the display
        if (!isSameMonth(newDate, ctx.month)) {
          ctx.setMonth(newDate);
        }

        // In range mode, update hovered date
        if (selectionMode === "range" && ctx.rangeStart && !ctx.rangeEnd) {
          ctx.setHoveredDate(normalizeDate(newDate));
        }
      },
      [ctx],
    );

    return (
      <table
        ref={ref}
        id={gridId}
        role="grid"
        aria-label={locale.monthNames[getMonth(month)]}
        className={cn("w-full border-collapse", className)}
        onKeyDown={handleKeyDown}
      >
        <thead>
          <tr role="row">
            {showWeekNumbers && (
              <th
                className={cn(calendarWeekdayVariants({ size }), "w-6")}
                aria-label="Săptămână"
                scope="col"
              >
                #
              </th>
            )}
            {weekDays.map((day, i) => (
              <th
                key={i}
                scope="col"
                className={cn(calendarWeekdayVariants({ size }))}
                aria-label={locale.dayNames[(i + weekStartsOn) % 7]}
                abbr={locale.dayNamesShort[(i + weekStartsOn) % 7]}
              >
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi} role="row">
              {showWeekNumbers && (
                <WeekNumberCell date={week[0]!} />
              )}
              {week.map((day) => (
                <CalendarDayCell key={dateKey(day)} date={day} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  },
);

CalendarGrid.displayName = "CalendarGrid";

// ═══════════════════════════════════════════════════════════════════════
// WeekNumberCell
// ═══════════════════════════════════════════════════════════════════════

function WeekNumberCell({ date }: { date: Date }) {
  const ctx = useCalendarContext();
  const { size } = ctx;

  const weekNumber = useMemo(() => {
    const start = startOfYear(date);
    const diff = differenceInCalendarDays(date, start);
    return Math.ceil((diff + start.getDay() + 1) / 7);
  }, [date]);

  return (
    <td
      className={cn(
        "text-center text-text-quaternary select-none",
        size === "sm" ? "text-[10px] px-0" : size === "lg" ? "text-xs px-0.5" : "text-[11px] px-0.5",
      )}
      aria-label={`Săptămâna ${weekNumber}`}
    >
      {weekNumber}
    </td>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CalendarDayCell
// ═══════════════════════════════════════════════════════════════════════

function CalendarDayCell({ date }: { date: Date }) {
  const ctx = useCalendarContext();
  const {
    size,
    month,
    focusedDate,
    isDateSelected,
    isDateInRange,
    isRangeStart,
    isRangeEnd,
    isDateDisabled,
    selectDate,
    setHoveredDate,
    setFocusedDate,
    eventsForDate,
    todayId,
  } = ctx;

  const isCurrentMonth = isSameMonth(date, month);
  const isTodayDate = isToday(date);
  const isSelected = isDateSelected(date);
  const isInRange = isDateInRange(date);
  const isRStart = isRangeStart(date);
  const isREnd = isRangeEnd(date);
  const isDisabled = isDateDisabled(date);
  const isFocused = isSameDay(date, focusedDate);
  const dayEvents = eventsForDate(date);
  const hasEvents = dayEvents.length > 0;

  const dayState = useMemo(() => {
    if (!isCurrentMonth) return "otherMonth";
    if (isDisabled) return "disabled";
    if (isRStart) return "rangeStart";
    if (isREnd) return "rangeEnd";
    if (isInRange) return "rangeMiddle";
    if (isSelected && isTodayDate) return "todaySelected";
    if (isSelected) return "selected";
    if (isTodayDate) return "today";
    return "default";
  }, [
    isCurrentMonth,
    isDisabled,
    isRStart,
    isREnd,
    isInRange,
    isSelected,
    isTodayDate,
  ]);

  const handleClick = useCallback(() => {
    if (!isDisabled && isCurrentMonth) {
      selectDate(date);
    }
  }, [isDisabled, isCurrentMonth, selectDate, date]);

  const handleMouseEnter = useCallback(() => {
    if (!isDisabled && isCurrentMonth) {
      setHoveredDate(date);
      if (ctx.selectionMode === "range" && ctx.rangeStart && !ctx.rangeEnd) {
        // Trigger preview range
      }
    }
  }, [isDisabled, isCurrentMonth, date, setHoveredDate, ctx]);

  const handleMouseLeave = useCallback(() => {
    setHoveredDate(null);
  }, [setHoveredDate]);

  const handleFocus = useCallback(() => {
    setFocusedDate(date);
  }, [setFocusedDate, date]);

  return (
    <td
      role="gridcell"
      aria-selected={isSelected || isInRange || isRStart || isREnd}
      aria-disabled={isDisabled || !isCurrentMonth}
      aria-current={isTodayDate ? "date" : undefined}
      className={cn("p-0")}
    >
      <button
        type="button"
        tabIndex={isFocused ? 0 : -1}
        disabled={isDisabled}
        aria-label={
          isCurrentMonth
            ? format(date, "EEEE, d MMMM yyyy")
            : format(date, "EEEE, d MMMM yyyy") + " (altă lună)"
        }
        id={isTodayDate ? todayId : undefined}
        className={cn(
          calendarDayVariants({ size, state: dayState }),
          isFocused && !isDisabled && "ring-2 ring-border-focus ring-offset-1",
        )}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
      >
        {date.getDate()}
        {hasEvents && (
          <span
            className={cn(
              calendarEventDotVariants({ size }),
              "left-1/2 -translate-x-1/2",
            )}
            style={
              dayEvents[0]?.color
                ? { backgroundColor: dayEvents[0].color }
                : undefined
            }
            aria-hidden="true"
          />
        )}
      </button>
    </td>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// CalendarFooter (Today / Clear)
// ═══════════════════════════════════════════════════════════════════════

interface CalendarFooterProps {
  className?: string;
}

const CalendarFooter = forwardRef<HTMLDivElement, CalendarFooterProps>(
  ({ className }, ref) => {
    const ctx = useCalendarContext();
    const {
      size,
      locale,
      selectionMode,
      selectDate,
      onChange,
      onRangeChange,
      onMultiChange,
      rangeStart,
      rangeEnd,
      selectedDates,
    } = ctx;

    const hasSelection =
      selectionMode === "single"
        ? selectedDates.length > 0
        : selectionMode === "range"
          ? rangeStart !== null
          : selectedDates.length > 0;

    const handleToday = useCallback(() => {
      selectDate(new Date());
    }, [selectDate]);

    const handleClear = useCallback(() => {
      if (selectionMode === "single") {
        onChange?.(null);
      } else if (selectionMode === "range") {
        onRangeChange?.(null, null);
      } else {
        onMultiChange?.([]);
      }
    }, [selectionMode, onChange, onRangeChange, onMultiChange]);

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-between",
          "border-t border-border-subtle",
          size === "sm" ? "mt-1 pt-1" : size === "lg" ? "mt-3 pt-2" : "mt-2 pt-2",
          className,
        )}
      >
        <button
          type="button"
          onClick={handleToday}
          className={cn(
            "rounded-md font-medium transition-colors duration-150",
            "text-brand-600 hover:text-brand-700",
            "hover:bg-brand-50",
            "focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-border-focus",
            size === "sm"
              ? "px-1.5 py-0.5 text-[10px]"
              : size === "lg"
                ? "px-3 py-1 text-sm"
                : "px-2 py-1 text-xs",
          )}
        >
          {locale.todayLabel}
        </button>

        {hasSelection && (
          <button
            type="button"
            onClick={handleClear}
            aria-label={locale.clearLabel}
            className={cn(
              "inline-flex items-center gap-1 rounded-md font-medium",
              "transition-colors duration-150",
              "text-text-tertiary hover:text-text-primary",
              "hover:bg-surface-secondary",
              "focus-visible:outline-none focus-visible:ring-2",
              "focus-visible:ring-border-focus",
              size === "sm"
                ? "px-1.5 py-0.5 text-[10px]"
                : size === "lg"
                  ? "px-3 py-1 text-sm"
                  : "px-2 py-1 text-xs",
            )}
          >
            <X
              className={
                size === "sm" ? "h-2.5 w-2.5" : size === "lg" ? "h-4 w-4" : "h-3 w-3"
              }
              aria-hidden="true"
            />
            {locale.clearLabel}
          </button>
        )}
      </div>
    );
  },
);

CalendarFooter.displayName = "CalendarFooter";

// ═══════════════════════════════════════════════════════════════════════
// CalendarEventsPanel
// ═══════════════════════════════════════════════════════════════════════

interface CalendarEventsPanelProps {
  className?: string;
}

const CalendarEventsPanel = forwardRef<HTMLDivElement, CalendarEventsPanelProps>(
  ({ className }, ref) => {
    const ctx = useCalendarContext();
    const { size, locale, selectedDates, eventsForDate, events } = ctx;

    // Show events for the most relevant selected date
    const activeDate = useMemo(() => {
      if (selectedDates.length === 0) return new Date();
      return selectedDates[selectedDates.length - 1]!;
    }, [selectedDates]);

    const activeEvents = useMemo(() => eventsForDate(activeDate), [eventsForDate, activeDate]);

    // Collect all events for visible dates when no date is selected
    const allEventsForView = useMemo(() => {
      if (selectedDates.length > 0) return [];
      const result: CalendarEvent[] = [];
      for (const [, evts] of events) {
        result.push(...evts);
      }
      return result.slice(0, 10);
    }, [events, selectedDates]);

    const displayEvents =
      selectedDates.length > 0 ? activeEvents : allEventsForView;

    return (
      <div
        ref={ref}
        className={cn(calendarEventsListVariants({ size }), className)}
      >
        {displayEvents.length > 0 ? (
          <>
            {selectedDates.length > 0 && (
              <p className="mb-1 font-medium text-text-secondary">
                {format(activeDate, "d MMMM yyyy")}
              </p>
            )}
            <ul className="space-y-0.5" role="list">
              {displayEvents.map((ev) => (
                <li
                  key={ev.id}
                  className={cn(
                    "flex items-center gap-1.5 rounded px-1.5 py-0.5",
                    "text-text-primary",
                    "bg-surface-secondary/50",
                  )}
                >
                  {ev.icon && (
                    <span className="shrink-0" aria-hidden="true">
                      {ev.icon}
                    </span>
                  )}
                  {ev.color && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full",
                        size === "sm"
                          ? "h-1.5 w-1.5"
                          : size === "lg"
                            ? "h-2.5 w-2.5"
                            : "h-2 w-2",
                      )}
                      style={{ backgroundColor: ev.color }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="truncate">{ev.title}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-center text-text-quaternary italic">
            {locale.noEventsLabel}
          </p>
        )}
      </div>
    );
  },
);

CalendarEventsPanel.displayName = "CalendarEventsPanel";

// ═══════════════════════════════════════════════════════════════════════
// Compound sub-components
// ═══════════════════════════════════════════════════════════════════════

/** A standalone day button that can be used outside the calendar grid */
interface CalendarDayButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  date: Date;
  selected?: boolean;
  today?: boolean;
  disabled?: boolean;
  otherMonth?: boolean;
  size?: CalendarSize;
  eventCount?: number;
}

const CalendarDayButton = forwardRef<HTMLButtonElement, CalendarDayButtonProps>(
  (
    {
      date,
      selected = false,
      today = false,
      disabled = false,
      otherMonth = false,
      size = "md",
      eventCount = 0,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    const state = selected && today
      ? "todaySelected"
      : selected
        ? "selected"
        : today
          ? "today"
          : otherMonth
            ? "otherMonth"
            : disabled
              ? "disabled"
              : "default";

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        className={cn(calendarDayVariants({ size, state }), className)}
        {...rest}
      >
        {children ?? date.getDate()}
        {eventCount > 0 && (
          <span
            className={cn(
              calendarEventDotVariants({ size }),
              "left-1/2 -translate-x-1/2",
            )}
            aria-hidden="true"
          />
        )}
      </button>
    );
  },
);

CalendarDayButton.displayName = "CalendarDayButton";

/** A small inline component that shows a formatted date based on locale */
interface CalendarDateLabelProps {
  date: Date;
  format?: "short" | "long" | "full";
  locale?: string | Partial<CalendarLocale>;
  className?: string;
}

const CalendarDateLabel = forwardRef<
  HTMLSpanElement,
  CalendarDateLabelProps
>(({ date, format: fmt = "short", locale: localeProp, className }, ref) => {
  const resolvedLocale = useMemo(() => {
    if (!localeProp) return DEFAULT_LOCALE;
    if (typeof localeProp === "string") {
      return LOCALE_MAP[localeProp] ?? DEFAULT_LOCALE;
    }
    return { ...DEFAULT_LOCALE, ...localeProp };
  }, [localeProp]);

  const formatted = useMemo(() => {
    if (fmt === "short") {
      return `${date.getDate()} ${resolvedLocale.monthNamesShort[date.getMonth()]} ${date.getFullYear()}`;
    }
    if (fmt === "long") {
      return `${date.getDate()} ${resolvedLocale.monthNames[date.getMonth()]} ${date.getFullYear()}`;
    }
    return `${resolvedLocale.dayNames[date.getDay()]}, ${date.getDate()} ${resolvedLocale.monthNames[date.getMonth()]} ${date.getFullYear()}`;
  }, [date, fmt, resolvedLocale]);

  return (
    <span ref={ref} className={cn("text-text-primary", className)}>
      {formatted}
    </span>
  );
});

CalendarDateLabel.displayName = "CalendarDateLabel";

// ═══════════════════════════════════════════════════════════════════════
// Compound assignment
// ═══════════════════════════════════════════════════════════════════════

const CalendarCompound = Object.assign(Calendar, {
  Header: CalendarHeader,
  Grid: CalendarGrid,
  Footer: CalendarFooter,
  EventsPanel: CalendarEventsPanel,
  DayButton: CalendarDayButton,
  DateLabel: CalendarDateLabel,
  /** Context consumer for advanced use cases */
  Context: CalendarContext,
});

// ═══════════════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════════════

export {
  CalendarCompound as Calendar,
  CalendarHeader,
  CalendarGrid,
  CalendarFooter,
  CalendarEventsPanel,
  CalendarDayButton,
  CalendarDateLabel,
  CalendarContext,
  calendarVariants,
  calendarDayVariants,
  calendarHeaderVariants,
  calendarNavButtonVariants,
  calendarWeekdayVariants,
  calendarEventDotVariants,
  calendarEventsListVariants,
  DEFAULT_LOCALE,
  EN_LOCALE,
  LOCALE_MAP,
};

export type {
  CalendarProps,
  CalendarLocale,
  CalendarEvent,
  SelectionMode,
  CalendarHeaderProps,
  CalendarGridProps,
  CalendarFooterProps,
  CalendarEventsPanelProps,
  CalendarDayButtonProps,
  CalendarDateLabelProps,
};

export default CalendarCompound;
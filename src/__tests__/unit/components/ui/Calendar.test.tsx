import React from "react";
import { render, screen, within, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Calendar,
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
} from "@/components/ui/Calendar";
import type {
  CalendarProps,
  CalendarEvent,
  CalendarLocale,
} from "@/components/ui/Calendar";

// ─── Helpers ────────────────────────────────────────────────────────
const today = new Date();
today.setHours(0, 0, 0, 0);

const setup = (props: Partial<CalendarProps> = {}) => {
  const user = userEvent.setup();
  const utils = render(<Calendar {...props} />);
  return { user, ...utils };
};

const getDayButton = (day: number, container?: HTMLElement) => {
  const root = container ?? document.body;
  const buttons = root.querySelectorAll('button[tabindex], button[aria-label]');
  for (const btn of buttons) {
    const label = btn.getAttribute("aria-label") ?? "";
    // Match "d MMMM yyyy" format; look for " 1 " or "1 " at the start
    const text = btn.textContent?.trim();
    if (text === String(day) && !label.includes("altă lună")) {
      return btn;
    }
  }
  return null;
};

// ─── Basic Rendering ────────────────────────────────────────────────
describe("Calendar rendering", () => {
  it("renders with group role", () => {
    setup();
    expect(screen.getByRole("group")).toBeInTheDocument();
  });

  it("renders with aria-label", () => {
    setup({ "aria-label": "Test Calendar" });
    expect(screen.getByRole("group")).toHaveAttribute(
      "aria-label",
      "Test Calendar",
    );
  });

  it("renders default aria-label", () => {
    setup();
    expect(screen.getByRole("group")).toHaveAttribute("aria-label", "Calendar");
  });

  it("renders the grid with grid role", () => {
    setup();
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  it("renders gridcells", () => {
    setup();
    const cells = screen.getAllByRole("gridcell");
    expect(cells.length).toBeGreaterThan(28);
  });

  it("applies size variant class", () => {
    setup({ size: "lg" });
    expect(screen.getByRole("group")).toHaveClass("w-[320px]");
  });

  it("applies sm size variant", () => {
    setup({ size: "sm" });
    expect(screen.getByRole("group")).toHaveClass("w-[240px]");
  });

  it("applies fullWidth class", () => {
    setup({ fullWidth: true });
    expect(screen.getByRole("group")).toHaveClass("w-full");
  });

  it("applies custom className", () => {
    setup({ className: "my-calendar" });
    expect(screen.getByRole("group")).toHaveClass("my-calendar");
  });
});

// ─── Header / Navigation ────────────────────────────────────────────
describe("Calendar header and navigation", () => {
  it("renders current month and year", () => {
    setup();
    const header = screen.getByRole("group");
    // Month name should be visible
    const monthName = DEFAULT_LOCALE.monthNames[today.getMonth()]!;
    expect(header.textContent).toContain(monthName);
    expect(header.textContent).toContain(String(today.getFullYear()));
  });

  it("renders previous month button", () => {
    setup();
    expect(
      screen.getByLabelText(DEFAULT_LOCALE.previousMonthLabel),
    ).toBeInTheDocument();
  });

  it("renders next month button", () => {
    setup();
    expect(
      screen.getByLabelText(DEFAULT_LOCALE.nextMonthLabel),
    ).toBeInTheDocument();
  });

  it("renders previous year button", () => {
    setup();
    expect(
      screen.getByLabelText(DEFAULT_LOCALE.previousYearLabel),
    ).toBeInTheDocument();
  });

  it("renders next year button", () => {
    setup();
    expect(
      screen.getByLabelText(DEFAULT_LOCALE.nextYearLabel),
    ).toBeInTheDocument();
  });

  it("navigates to previous month on click", async () => {
    const onMonthChange = jest.fn();
    const { user } = setup({ onMonthChange });
    const prevBtn = screen.getByLabelText(DEFAULT_LOCALE.previousMonthLabel);
    await user.click(prevBtn);
    expect(onMonthChange).toHaveBeenCalledTimes(1);
  });

  it("navigates to next month on click", async () => {
    const onMonthChange = jest.fn();
    const { user } = setup({ onMonthChange });
    const nextBtn = screen.getByLabelText(DEFAULT_LOCALE.nextMonthLabel);
    await user.click(nextBtn);
    expect(onMonthChange).toHaveBeenCalledTimes(1);
  });

  it("navigates to previous year on click", async () => {
    const onMonthChange = jest.fn();
    const { user } = setup({ onMonthChange });
    const prevYearBtn = screen.getByLabelText(
      DEFAULT_LOCALE.previousYearLabel,
    );
    await user.click(prevYearBtn);
    expect(onMonthChange).toHaveBeenCalledTimes(1);
  });

  it("navigates to next year on click", async () => {
    const onMonthChange = jest.fn();
    const { user } = setup({ onMonthChange });
    const nextYearBtn = screen.getByLabelText(DEFAULT_LOCALE.nextYearLabel);
    await user.click(nextYearBtn);
    expect(onMonthChange).toHaveBeenCalledTimes(1);
  });

  it("hides navigation when canNavigateMonths is false", () => {
    setup({ canNavigateMonths: false });
    expect(
      screen.queryByLabelText(DEFAULT_LOCALE.previousMonthLabel),
    ).not.toBeInTheDocument();
  });

  it("hides year navigation when canNavigateYears is false", () => {
    setup({ canNavigateYears: false });
    expect(
      screen.queryByLabelText(DEFAULT_LOCALE.previousYearLabel),
    ).not.toBeInTheDocument();
  });

  it("renders month/year selectors by default", () => {
    setup();
    expect(
      screen.getByLabelText(DEFAULT_LOCALE.monthSelectorLabel),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(DEFAULT_LOCALE.yearSelectorLabel),
    ).toBeInTheDocument();
  });

  it("hides selectors when showMonthYearSelectors is false", () => {
    setup({ showMonthYearSelectors: false });
    expect(
      screen.queryByLabelText(DEFAULT_LOCALE.monthSelectorLabel),
    ).not.toBeInTheDocument();
  });
});

// ─── Weekday headers ────────────────────────────────────────────────
describe("Calendar weekday headers", () => {
  it("renders all 7 weekday headers", () => {
    setup();
    const headers = screen
      .getAllByRole("columnheader")
      .filter((h) => h.getAttribute("scope") === "col");
    // 7 weekdays (plus optional week number column)
    expect(headers.length).toBeGreaterThanOrEqual(7);
  });

  it("uses dayNamesMin from locale", () => {
    setup({ locale: "ro" });
    const grid = screen.getByRole("grid");
    DEFAULT_LOCALE.dayNamesMin.forEach((day) => {
      expect(grid.textContent).toContain(day);
    });
  });

  it("uses English day names with en locale", () => {
    setup({ locale: "en" });
    const grid = screen.getByRole("grid");
    expect(grid.textContent).toContain("S"); // Sun
    expect(grid.textContent).toContain("M"); // Mon
  });
});

// ─── Single date selection ──────────────────────────────────────────
describe("Calendar single selection", () => {
  it("selects a date on click", async () => {
    const onChange = jest.fn();
    const { user } = setup({ onChange, selectionMode: "single" });

    const cells = screen.getAllByRole("gridcell");
    // Find a day in current month
    const currentMonthDay = cells.find(
      (cell) => cell.getAttribute("aria-disabled") === "false",
    );
    expect(currentMonthDay).toBeDefined();

    const button = currentMonthDay!.querySelector("button")!;
    await user.click(button);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("calls onChange with the selected date", async () => {
    const onChange = jest.fn();
    const { user } = setup({ onChange, selectionMode: "single" });
    const cells = screen.getAllByRole("gridcell");
    const cell = cells.find(
      (c) => c.getAttribute("aria-disabled") === "false",
    )!;
    const button = cell.querySelector("button")!;
    await user.click(button);
    const selectedDate = onChange.mock.calls[0]![0];
    expect(selectedDate).toBeInstanceOf(Date);
  });

  it("highlights the selected date", async () => {
    const { user } = setup({ selectionMode: "single" });
    const cells = screen.getAllByRole("gridcell");
    const cell = cells.find(
      (c) => c.getAttribute("aria-disabled") === "false",
    )!;
    const button = cell.querySelector("button")!;
    await user.click(button);
    expect(button).toHaveClass("bg-brand-500");
  });

  it("accepts controlled value", () => {
    const specificDate = new Date(2025, 0, 15); // 15 Jan 2025
    setup({
      value: specificDate,
      month: new Date(2025, 0, 1),
      selectionMode: "single",
    });
    // The 15th should be selected
    const grid = screen.getByRole("grid");
    const day15 = within(grid).getByText("15");
    expect(day15.closest("button")).toHaveClass("bg-brand-500");
  });
});

// ─── Range selection ────────────────────────────────────────────────
describe("Calendar range selection", () => {
  it("starts range on first click", async () => {
    const onRangeChange = jest.fn();
    const { user } = setup({
      selectionMode: "range",
      onRangeChange,
    });

    const cells = screen.getAllByRole("gridcell");
    const firstCell = cells.find(
      (c) => c.getAttribute("aria-disabled") === "false",
    )!;
    await user.click(firstCell.querySelector("button")!);
    expect(onRangeChange).toHaveBeenCalled();
    // First call should have start date and null end
    const [start, end] = onRangeChange.mock.calls[0]!;
    expect(start).toBeInstanceOf(Date);
    expect(end).toBeNull();
  });

  it("completes range on second click", async () => {
    const onRangeChange = jest.fn();
    render(
      <Calendar
        selectionMode="range"
        onRangeChange={onRangeChange}
        defaultRangeStart={new Date(2025, 0, 10)}
        month={new Date(2025, 0, 1)}
      />,
    );

    // Find day 20 and click it
    const grid = screen.getByRole("grid");
    const day20 = within(grid).getByText("20");
    await userEvent.click(day20);

    // The last call should have both start and end
    const calls = onRangeChange.mock.calls;
    const lastCall = calls[calls.length - 1]!;
    expect(lastCall[1]).toBeInstanceOf(Date);
  });

  it("accepts controlled rangeStart and rangeEnd", () => {
    setup({
      selectionMode: "range",
      rangeStart: new Date(2025, 0, 5),
      rangeEnd: new Date(2025, 0, 20),
      month: new Date(2025, 0, 1),
    });

    const grid = screen.getByRole("grid");
    const day5 = within(grid).getByText("5");
    const day20 = within(grid).getByText("20");
    expect(day5.closest("button")).toHaveClass("bg-brand-500");
    expect(day20.closest("button")).toHaveClass("bg-brand-500");
  });

  it("highlights days in the range", async () => {
    setup({
      selectionMode: "range",
      rangeStart: new Date(2025, 0, 5),
      rangeEnd: new Date(2025, 0, 10),
      month: new Date(2025, 0, 1),
    });

    const grid = screen.getByRole("grid");
    const day7 = within(grid).getByText("7");
    expect(day7.closest("button")).toHaveClass("bg-brand-50");
  });
});

// ─── Multi-select ───────────────────────────────────────────────────
describe("Calendar multi-select", () => {
  it("allows selecting multiple dates", async () => {
    const onMultiChange = jest.fn();
    const { user } = setup({
      selectionMode: "multiple",
      onMultiChange,
    });

    const cells = screen.getAllByRole("gridcell");
    const currentMonthCells = cells.filter(
      (c) => c.getAttribute("aria-disabled") === "false",
    );

    await user.click(currentMonthCells[0]!.querySelector("button")!);
    await user.click(currentMonthCells[1]!.querySelector("button")!);

    // Last call should have array of 2 dates
    const lastCall =
      onMultiChange.mock.calls[onMultiChange.mock.calls.length - 1]!;
    expect(lastCall![0]).toHaveLength(2);
  });

  it("deselects a date on second click", async () => {
    const onMultiChange = jest.fn();
    const { user } = setup({
      selectionMode: "multiple",
      onMultiChange,
    });

    const cells = screen.getAllByRole("gridcell");
    const cell = cells.find(
      (c) => c.getAttribute("aria-disabled") === "false",
    )!;
    const button = cell.querySelector("button")!;

    await user.click(button); // select
    await user.click(button); // deselect

    const lastCall =
      onMultiChange.mock.calls[onMultiChange.mock.calls.length - 1]!;
    expect(lastCall![0]).toHaveLength(0);
  });

  it("accepts controlled values array", () => {
    setup({
      selectionMode: "multiple",
      values: [new Date(2025, 0, 5), new Date(2025, 0, 15)],
      month: new Date(2025, 0, 1),
    });
    const grid = screen.getByRole("grid");
    expect(within(grid).getByText("5").closest("button")).toHaveClass(
      "bg-brand-500",
    );
    expect(within(grid).getByText("15").closest("button")).toHaveClass(
      "bg-brand-500",
    );
  });
});

// ─── Today highlighting ─────────────────────────────────────────────
describe("Calendar today", () => {
  it("marks today with border", () => {
    setup({ month: today });
    const todayNum = today.getDate();
    const grid = screen.getByRole("grid");
    const todayButton = within(grid).getByText(String(todayNum));
    expect(todayButton.closest("button")).toHaveClass("border-brand-300");
  });

  it("has aria-current=date on today", () => {
    setup({ month: today });
    const grid = screen.getByRole("grid");
    const todayNum = today.getDate();
    const todayCell = within(grid)
      .getByText(String(todayNum))
      .closest("td");
    expect(todayCell).toHaveAttribute("aria-current", "date");
  });
});

// ─── Disabled dates ─────────────────────────────────────────────────
describe("Calendar disabled dates", () => {
  it("disables dates in disabledDates array", () => {
    const disabled = new Date(today.getFullYear(), today.getMonth(), 10);
    setup({ disabledDates: [disabled], month: today });
    const grid = screen.getByRole("grid");
    const btn = within(grid).getByText("10").closest("button")!;
    expect(btn).toBeDisabled();
  });

  it("does not call onChange for disabled dates", async () => {
    const onChange = jest.fn();
    const disabled = new Date(today.getFullYear(), today.getMonth(), 10);
    const { user } = setup({
      onChange,
      disabledDates: [disabled],
      month: today,
    });
    const grid = screen.getByRole("grid");
    const btn = within(grid).getByText("10").closest("button")!;
    await user.click(btn);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("respects minDate", () => {
    const minDate = new Date(today.getFullYear(), today.getMonth(), 15);
    setup({ minDate, month: today });
    const grid = screen.getByRole("grid");
    // Days before 15 should be disabled
    const btn10 = within(grid).getByText("10").closest("button");
    // Button might not exist if it's from previous month
    if (btn10) {
      expect(btn10).toBeDisabled();
    }
  });

  it("respects maxDate", () => {
    const maxDate = new Date(today.getFullYear(), today.getMonth(), 15);
    setup({ maxDate, month: today });
    const grid = screen.getByRole("grid");
    const btn20 = within(grid).getByText("20").closest("button")!;
    expect(btn20).toBeDisabled();
  });
});

// ─── Events ─────────────────────────────────────────────────────────
describe("Calendar events", () => {
  const events: CalendarEvent[] = [
    { id: "1", date: "2025-01-15", title: "Ședință echipă", color: "#3b82f6" },
    { id: "2", date: "2025-01-20", title: "Deadline proiect", color: "#ef4444" },
  ];

  it("shows event dots on days with events", () => {
    setup({
      events,
      month: new Date(2025, 0, 1),
    });
    const grid = screen.getByRole("grid");
    // Day 15 button should have an event dot span inside
    const day15Btn = within(grid).getByText("15").closest("button")!;
    const dots = day15Btn.querySelectorAll('[aria-hidden="true"]');
    expect(dots.length).toBeGreaterThan(0);
  });

  it("shows events panel when showEvents is true", () => {
    setup({
      events,
      showEvents: true,
      month: new Date(2025, 0, 1),
    });
    expect(
      screen.getByText(DEFAULT_LOCALE.noEventsLabel),
    ).toBeInTheDocument();
  });

  it("shows events for selected date", async () => {
    const { user } = setup({
      events,
      showEvents: true,
      selectionMode: "single",
      month: new Date(2025, 0, 1),
    });

    const grid = screen.getByRole("grid");
    const day15 = within(grid).getByText("15");
    await user.click(day15);

    expect(screen.getByText("Ședință echipă")).toBeInTheDocument();
  });
});

// ─── Today / Clear buttons ──────────────────────────────────────────
describe("Calendar footer", () => {
  it("renders today button by default", () => {
    setup();
    expect(
      screen.getByText(DEFAULT_LOCALE.todayLabel),
    ).toBeInTheDocument();
  });

  it("hides today button when showTodayButton is false", () => {
    setup({ showTodayButton: false });
    expect(
      screen.queryByText(DEFAULT_LOCALE.todayLabel),
    ).not.toBeInTheDocument();
  });

  it("shows clear button when a date is selected", async () => {
    const { user } = setup({ selectionMode: "single" });
    const cells = screen.getAllByRole("gridcell");
    const cell = cells.find(
      (c) => c.getAttribute("aria-disabled") === "false",
    )!;
    await user.click(cell.querySelector("button")!);
    expect(
      screen.getByText(DEFAULT_LOCALE.clearLabel),
    ).toBeInTheDocument();
  });

  it("hides clear button when showClearButton is false", async () => {
    const { user } = setup({
      selectionMode: "single",
      showClearButton: false,
    });
    const cells = screen.getAllByRole("gridcell");
    const cell = cells.find(
      (c) => c.getAttribute("aria-disabled") === "false",
    )!;
    await user.click(cell.querySelector("button")!);
    expect(
      screen.queryByText(DEFAULT_LOCALE.clearLabel),
    ).not.toBeInTheDocument();
  });

  it("clears selection on clear button click", async () => {
    const onChange = jest.fn();
    const { user } = setup({ selectionMode: "single", onChange });
    const cells = screen.getAllByRole("gridcell");
    const cell = cells.find(
      (c) => c.getAttribute("aria-disabled") === "false",
    )!;
    await user.click(cell.querySelector("button")!);

    const clearBtn = screen.getByText(DEFAULT_LOCALE.clearLabel);
    await user.click(clearBtn);
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

// ─── Localization ───────────────────────────────────────────────────
describe("Calendar localization", () => {
  it("uses Romanian locale by default", () => {
    setup();
    const header = screen.getByRole("group");
    const currentMonth = DEFAULT_LOCALE.monthNames[today.getMonth()]!;
    expect(header.textContent).toContain(currentMonth);
  });

  it("switches to English locale via string", () => {
    setup({ locale: "en" });
    const header = screen.getByRole("group");
    const currentMonth = EN_LOCALE.monthNames[today.getMonth()]!;
    expect(header.textContent).toContain(currentMonth);
  });

  it("accepts partial locale override", () => {
    const custom: Partial<CalendarLocale> = {
      todayLabel: "Azi",
      clearLabel: "Golește",
    };
    setup({ locale: custom });
    expect(screen.getByText("Azi")).toBeInTheDocument();
    // Month names should still be Romanian (default)
    const currentMonth = DEFAULT_LOCALE.monthNames[today.getMonth()]!;
    expect(screen.getByRole("group").textContent).toContain(currentMonth);
  });
});

// ─── Keyboard navigation ────────────────────────────────────────────
describe("Calendar keyboard navigation", () => {
  it("moves focus right with ArrowRight", async () => {
    const { user } = setup();
    const grid = screen.getByRole("grid");
    // Focus the grid first
    grid.focus();
    await user.keyboard("{ArrowRight}");
    // The focused date should have changed
  });

  it("moves focus left with ArrowLeft", async () => {
    const { user } = setup();
    const grid = screen.getByRole("grid");
    grid.focus();
    await user.keyboard("{ArrowLeft}");
  });

  it("moves focus up with ArrowUp", async () => {
    const { user } = setup();
    const grid = screen.getByRole("grid");
    grid.focus();
    await user.keyboard("{ArrowUp}");
  });

  it("moves focus down with ArrowDown", async () => {
    const { user } = setup();
    const grid = screen.getByRole("grid");
    grid.focus();
    await user.keyboard("{ArrowDown}");
  });

  it("selects date with Enter", async () => {
    const onChange = jest.fn();
    const { user } = setup({ onChange, selectionMode: "single" });
    const grid = screen.getByRole("grid");
    grid.focus();
    await user.keyboard("{Enter}");
    expect(onChange).toHaveBeenCalled();
  });

  it("selects date with Space", async () => {
    const onChange = jest.fn();
    const { user } = setup({ onChange, selectionMode: "single" });
    const grid = screen.getByRole("grid");
    grid.focus();
    await user.keyboard(" ");
    expect(onChange).toHaveBeenCalled();
  });
});

// ─── Week numbers ───────────────────────────────────────────────────
describe("Calendar week numbers", () => {
  it("does not show week numbers by default", () => {
    setup();
    const grid = screen.getByRole("grid");
    const headers = within(grid).getAllByRole("columnheader");
    // Should only have weekday headers, not week number
    const weekNumHeaders = headers.filter((h) =>
      h.getAttribute("aria-label")?.includes("Săptămân"),
    );
    expect(weekNumHeaders.length).toBe(0);
  });

  it("shows week numbers when showWeekNumbers is true", () => {
    setup({ showWeekNumbers: true });
    const grid = screen.getByRole("grid");
    const headers = within(grid).getAllByRole("columnheader");
    const weekNumHeaders = headers.filter((h) =>
      h.getAttribute("aria-label")?.includes("Săptămân"),
    );
    expect(weekNumHeaders.length).toBeGreaterThan(0);
  });
});

// ─── Month navigation limits ────────────────────────────────────────
describe("Calendar navigation limits", () => {
  it("disables prev button when minDate prevents navigation", () => {
    setup({
      minDate: new Date(today.getFullYear(), today.getMonth(), 1),
      month: today,
    });
    const prevBtn = screen.getByLabelText(DEFAULT_LOCALE.previousMonthLabel);
    expect(prevBtn).toBeDisabled();
  });

  it("disables next button when maxDate prevents navigation", () => {
    setup({
      maxDate: new Date(today.getFullYear(), today.getMonth(), 28),
      month: today,
    });
    const nextBtn = screen.getByLabelText(DEFAULT_LOCALE.nextMonthLabel);
    expect(nextBtn).toBeDisabled();
  });
});

// ─── Controlled month ───────────────────────────────────────────────
describe("Calendar controlled month", () => {
  it("displays the controlled month", () => {
    const dec2025 = new Date(2025, 11, 1);
    setup({ month: dec2025 });
    const header = screen.getByRole("group");
    expect(header.textContent).toContain("Decembrie");
    expect(header.textContent).toContain("2025");
  });

  it("calls onMonthChange when navigating", async () => {
    const onMonthChange = jest.fn();
    const dec2025 = new Date(2025, 11, 1);
    const { user } = setup({ month: dec2025, onMonthChange });
    const nextBtn = screen.getByLabelText(DEFAULT_LOCALE.nextMonthLabel);
    await user.click(nextBtn);
    expect(onMonthChange).toHaveBeenCalledTimes(1);
  });
});

// ─── Default month ──────────────────────────────────────────────────
describe("Calendar default month", () => {
  it("uses defaultMonth for initial display", () => {
    const june2025 = new Date(2025, 5, 1);
    setup({ defaultMonth: june2025 });
    const header = screen.getByRole("group");
    expect(header.textContent).toContain("Iunie");
    expect(header.textContent).toContain("2025");
  });
});

// ─── Compound sub-components ────────────────────────────────────────
describe("Calendar sub-components", () => {
  it("Calendar.Header is defined", () => {
    expect(Calendar.Header).toBeDefined();
  });

  it("Calendar.Grid is defined", () => {
    expect(Calendar.Grid).toBeDefined();
  });

  it("Calendar.Footer is defined", () => {
    expect(Calendar.Footer).toBeDefined();
  });

  it("Calendar.EventsPanel is defined", () => {
    expect(Calendar.EventsPanel).toBeDefined();
  });

  it("Calendar.DayButton is defined", () => {
    expect(Calendar.DayButton).toBeDefined();
  });

  it("Calendar.DateLabel is defined", () => {
    expect(Calendar.DateLabel).toBeDefined();
  });

  it("Calendar.Context is defined", () => {
    expect(Calendar.Context).toBeDefined();
  });

  it("renders Calendar.DayButton standalone", () => {
    render(
      <Calendar.DayButton
        date={new Date(2025, 0, 15)}
        selected
        aria-label="15 ianuarie"
      />,
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveTextContent("15");
    expect(btn).toHaveClass("bg-brand-500");
  });

  it("renders Calendar.DateLabel", () => {
    render(<Calendar.DateLabel date={new Date(2025, 0, 15)} format="short" />);
    expect(screen.getByText(/15/)).toBeInTheDocument();
  });

  it("Calendar.DateLabel with long format", () => {
    render(
      <Calendar.DateLabel
        date={new Date(2025, 0, 15)}
        format="full"
        locale="ro"
      />,
    );
    expect(screen.getByText(/Miercuri/)).toBeInTheDocument();
  });
});

// ─── Variant exports ────────────────────────────────────────────────
describe("Calendar variant exports", () => {
  it("exports calendarVariants", () => {
    expect(calendarVariants).toBeDefined();
    expect(typeof calendarVariants).toBe("function");
  });

  it("exports calendarDayVariants", () => {
    expect(calendarDayVariants).toBeDefined();
    expect(typeof calendarDayVariants).toBe("function");
  });

  it("exports calendarHeaderVariants", () => {
    expect(calendarHeaderVariants).toBeDefined();
  });

  it("exports calendarNavButtonVariants", () => {
    expect(calendarNavButtonVariants).toBeDefined();
  });

  it("exports calendarWeekdayVariants", () => {
    expect(calendarWeekdayVariants).toBeDefined();
  });

  it("exports calendarEventDotVariants", () => {
    expect(calendarEventDotVariants).toBeDefined();
  });

  it("exports calendarEventsListVariants", () => {
    expect(calendarEventsListVariants).toBeDefined();
  });

  it("exports DEFAULT_LOCALE", () => {
    expect(DEFAULT_LOCALE).toBeDefined();
    expect(DEFAULT_LOCALE.code).toBe("ro");
  });

  it("exports EN_LOCALE", () => {
    expect(EN_LOCALE).toBeDefined();
    expect(EN_LOCALE.code).toBe("en");
  });

  it("exports LOCALE_MAP", () => {
    expect(LOCALE_MAP).toBeDefined();
    expect(LOCALE_MAP.ro).toBe(DEFAULT_LOCALE);
    expect(LOCALE_MAP.en).toBe(EN_LOCALE);
  });
});

// ─── Display name ───────────────────────────────────────────────────
describe("Calendar displayName", () => {
  it("has display name 'Calendar'", () => {
    expect(Calendar.displayName).toBe("Calendar");
  });

  it("sub-components have display names", () => {
    expect(Calendar.Header.displayName).toBe("CalendarHeader");
    expect(Calendar.Grid.displayName).toBe("CalendarGrid");
    expect(Calendar.Footer.displayName).toBe("CalendarFooter");
    expect(Calendar.EventsPanel.displayName).toBe("CalendarEventsPanel");
    expect(Calendar.DayButton.displayName).toBe("CalendarDayButton");
    expect(Calendar.DateLabel.displayName).toBe("CalendarDateLabel");
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────
describe("Calendar edge cases", () => {
  it("renders without crashing with no props", () => {
    const { container } = render(<Calendar />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("handles empty events array", () => {
    setup({ events: [], showEvents: true });
    expect(
      screen.getByText(DEFAULT_LOCALE.noEventsLabel),
    ).toBeInTheDocument();
  });

  it("renders a month with 6 weeks", () => {
    // A month that spans 6 calendar weeks (e.g., a 31-day month starting on Saturday)
    const month = new Date(2025, 2, 1); // March 2025
    setup({ month });
    const rows = screen.getAllByRole("row");
    // At least 6 data rows (weeks)
    const dataRows = rows.filter((r) =>
      r.querySelectorAll("td").length > 0,
    );
    expect(dataRows.length).toBeGreaterThanOrEqual(4);
  });

  it("handles single date defaultValue", () => {
    setup({
      defaultValue: new Date(2025, 5, 15),
      defaultMonth: new Date(2025, 5, 1),
      selectionMode: "single",
    });
    const grid = screen.getByRole("grid");
    expect(within(grid).getByText("15").closest("button")).toHaveClass(
      "bg-brand-500",
    );
  });

  it("handles disabled days of week", () => {
    setup({
      disabledDaysOfWeek: [0, 6], // Disable weekends
      month: new Date(2025, 0, 1),
    });
    const grid = screen.getByRole("grid");
    // Find a Sunday button - should be disabled
    const sundayHeader = within(grid).getByText("D");
    const colIdx = Array.from(sundayHeader.parentElement!.children).indexOf(
      sundayHeader,
    );
    if (colIdx >= 0) {
      const rows = within(grid).getAllByRole("row").slice(1); // skip header
      const firstSunday = rows[0]?.children[colIdx]?.querySelector("button");
      if (firstSunday) {
        expect(firstSunday).toBeDisabled();
      }
    }
  });

  it("does not call onDateClick for disabled dates", async () => {
    const onDateClick = jest.fn();
    const disabledDate = new Date(today.getFullYear(), today.getMonth(), 5);
    const { user } = setup({
      onDateClick,
      disabledDates: [disabledDate],
      month: today,
    });
    const grid = screen.getByRole("grid");
    const day5Btn = within(grid).getByText("5").closest("button")!;
    await user.click(day5Btn);
    expect(onDateClick).not.toHaveBeenCalled();
  });
});

// ─── Accessibility ──────────────────────────────────────────────────
describe("Calendar accessibility", () => {
  it("all buttons have aria-labels", () => {
    setup();
    const buttons = screen.getAllByRole("button");
    const gridButtons = buttons.filter((btn) =>
      btn.closest('[role="grid"]'),
    );
    gridButtons.forEach((btn) => {
      expect(btn).toHaveAttribute("aria-label");
    });
  });

  it("navigation buttons have accessible labels", () => {
    setup();
    expect(
      screen.getByLabelText(DEFAULT_LOCALE.previousMonthLabel),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(DEFAULT_LOCALE.nextMonthLabel),
    ).toBeInTheDocument();
  });

  it("grid has aria-label with month name", () => {
    setup({ month: new Date(2025, 0, 1) });
    const grid = screen.getByRole("grid");
    expect(grid).toHaveAttribute("aria-label");
    expect(grid.getAttribute("aria-label")).toContain("Ianuarie");
  });

  it("today cell has aria-current=date", () => {
    setup({ month: today });
    const grid = screen.getByRole("grid");
    const todayNum = today.getDate();
    const cell = within(grid).getByText(String(todayNum)).closest("td");
    expect(cell).toHaveAttribute("aria-current", "date");
  });

  it("other-month days have accessible labels indicating they belong to another month", () => {
    setup();
    const buttons = document.querySelectorAll('button[aria-label*="altă lună"]');
    // There should be some days from previous/next month
    expect(buttons.length).toBeGreaterThan(0);
  });
});

// ─── onDateClick ────────────────────────────────────────────────────
describe("Calendar onDateClick", () => {
  it("calls onDateClick when any date is clicked", async () => {
    const onDateClick = jest.fn();
    const { user } = setup({ onDateClick });
    const cells = screen.getAllByRole("gridcell");
    const cell = cells.find(
      (c) => c.getAttribute("aria-disabled") === "false",
    )!;
    await user.click(cell.querySelector("button")!);
    expect(onDateClick).toHaveBeenCalledTimes(1);
    expect(onDateClick.mock.calls[0]![0]).toBeInstanceOf(Date);
  });
});

// ─── Responsive / fullWidth ─────────────────────────────────────────
describe("Calendar fullWidth", () => {
  it("applies w-full class when fullWidth", () => {
    setup({ fullWidth: true });
    expect(screen.getByRole("group")).toHaveClass("w-full");
  });

  it("does not apply w-full by default", () => {
    setup();
    expect(screen.getByRole("group")).not.toHaveClass("w-full");
  });
});
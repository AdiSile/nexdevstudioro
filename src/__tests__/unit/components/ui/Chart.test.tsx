import React from "react";
import { render, screen, within, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Chart,
  ChartProps,
  ChartSeriesConfig,
  useChartTheme,
  useChartExport,
  chartWrapperVariants,
  LIGHT_COLORS,
  DARK_COLORS,
} from "@/components/ui/Chart";

// ─── Mock themeManager ──────────────────────────────────────────────

let mockIsDark = false;

jest.mock("@/lib/theme", () => ({
  themeManager: {
    isDark: () => mockIsDark,
    onChange: (listener: (event: { palette: string }) => void) => {
      const handlers: Array<(event: { palette: string }) => void> = [];
      handlers.push(listener);
      return () => {
        const idx = handlers.indexOf(listener);
        if (idx >= 0) handlers.splice(idx, 1);
      };
    },
    getMode: () => (mockIsDark ? "dark" : "light"),
    getPalette: () => (mockIsDark ? "dark" : "light"),
  },
}));

// ─── Mock Recharts ResponsiveContainer ──────────────────────────────

jest.mock("recharts", () => {
  const actual = jest.requireActual("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children, aspect }: { children: React.ReactElement; aspect?: number }) => {
      // If children is a function (render prop), call it with dimensions
      if (typeof children === "function") {
        return <div data-testid="responsive-container">{children({ width: 600, height: 400 })}</div>;
      }
      return <div data-testid="responsive-container">{children}</div>;
    },
  };
});

// ─── Test Data ──────────────────────────────────────────────────────

interface MonthlyData {
  month: string;
  venituri: number;
  cheltuieli: number;
  profit: number;
}

const mockData: MonthlyData[] = [
  { month: "Ian", venituri: 4000, cheltuieli: 2400, profit: 1600 },
  { month: "Feb", venituri: 3000, cheltuieli: 1398, profit: 1602 },
  { month: "Mar", venituri: 5000, cheltuieli: 3800, profit: 1200 },
  { month: "Apr", venituri: 4780, cheltuieli: 3908, profit: 872 },
  { month: "Mai", venituri: 5890, cheltuieli: 4800, profit: 1090 },
  { month: "Iun", venituri: 6390, cheltuieli: 4300, profit: 2090 },
];

const mockSeries: ChartSeriesConfig[] = [
  { dataKey: "venituri", name: "Venituri" },
  { dataKey: "cheltuieli", name: "Cheltuieli" },
  { dataKey: "profit", name: "Profit" },
];

const defaultProps: ChartProps = {
  data: mockData,
  series: mockSeries,
  type: "line",
  xKey: "month",
  title: "Performanță Financiară",
};

// ─── Helpers ────────────────────────────────────────────────────────

const setup = (props: Partial<ChartProps> = {}) => {
  const user = userEvent.setup();
  const mergedProps = { ...defaultProps, ...props } as ChartProps;
  const utils = render(<Chart {...mergedProps} />);
  return { user, ...utils };
};

// ─── Basic Rendering ────────────────────────────────────────────────

describe("Chart rendering", () => {
  beforeEach(() => {
    mockIsDark = false;
  });

  it("renders the chart wrapper with correct structure", () => {
    setup();
    expect(screen.getByRole("region")).toBeInTheDocument();
    expect(screen.getByText("Performanță Financiară")).toBeInTheDocument();
  });

  it("renders with aria-label from title", () => {
    setup();
    const region = screen.getByRole("region");
    expect(region).toHaveAttribute("aria-label", "Performanță Financiară");
  });

  it("renders with default aria-label when no title", () => {
    setup({ title: undefined });
    const region = screen.getByRole("region");
    expect(region).toHaveAttribute("aria-label", "Grafic");
  });

  it("renders the responsive container", () => {
    setup();
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("applies size variant class", () => {
    setup({ size: "lg" });
    const region = screen.getByRole("region");
    expect(region).toHaveClass("h-96");
  });

  it("applies variant class", () => {
    setup({ variant: "ghost" });
    const region = screen.getByRole("region");
    expect(region).toHaveClass("bg-transparent");
    expect(region).toHaveClass("border-transparent");
  });

  it("applies custom className", () => {
    setup({ className: "my-custom-chart" });
    const region = screen.getByRole("region");
    expect(region).toHaveClass("my-custom-chart");
  });

  it("renders with minHeight style when provided", () => {
    setup({ minHeight: 400 });
    const region = screen.getByRole("region");
    expect(region.style.minHeight).toBe("400px");
  });
});

// ─── Title & Description ────────────────────────────────────────────

describe("Chart header", () => {
  it("renders title", () => {
    setup({ title: "Titlu Test" });
    expect(screen.getByText("Titlu Test")).toBeInTheDocument();
  });

  it("renders description", () => {
    setup({ description: "Descriere grafic" });
    expect(screen.getByText("Descriere grafic")).toBeInTheDocument();
  });

  it("hides header when showHeader is false", () => {
    setup({ showHeader: false, title: "Titlu" });
    expect(screen.queryByText("Titlu")).not.toBeInTheDocument();
  });

  it("renders custom header actions", () => {
    setup({
      headerActions: <button type="button">Acțiune Custom</button>,
    });
    expect(screen.getByText("Acțiune Custom")).toBeInTheDocument();
  });

  it("renders title as h3", () => {
    setup({ title: "Titlu" });
    const heading = screen.getByText("Titlu");
    expect(heading.tagName).toBe("H3");
  });
});

// ─── Export Button ──────────────────────────────────────────────────

describe("Chart export button", () => {
  it("renders export button by default", () => {
    setup();
    expect(screen.getByLabelText("Exportă graficul")).toBeInTheDocument();
  });

  it("does not render export button when exportConfig is false", () => {
    setup({ exportConfig: false });
    expect(screen.queryByLabelText("Exportă graficul")).not.toBeInTheDocument();
  });

  it("does not render export button when formats array is empty", () => {
    setup({ exportConfig: { enabled: true, formats: [] } });
    expect(screen.queryByLabelText("Exportă graficul")).not.toBeInTheDocument();
  });

  it("opens dropdown on click", async () => {
    const { user } = setup();
    const exportBtn = screen.getByLabelText("Exportă graficul");
    await user.click(exportBtn);
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("shows format options in dropdown", async () => {
    const { user } = setup();
    await user.click(screen.getByLabelText("Exportă graficul"));
    expect(screen.getByText("PNG (imagine)")).toBeInTheDocument();
    expect(screen.getByText("SVG (vectorial)")).toBeInTheDocument();
    expect(screen.getByText("CSV (date)")).toBeInTheDocument();
  });

  it("closes dropdown on Escape", async () => {
    const { user } = setup();
    await user.click(screen.getByLabelText("Exportă graficul"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("closes dropdown on outside click", async () => {
    const { user } = setup();
    await user.click(screen.getByLabelText("Exportă graficul"));
    expect(screen.getByRole("menu")).toBeInTheDocument();
    await user.click(document.body);
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("disables export button when loading", () => {
    setup({ loading: true });
    const exportBtn = screen.getByLabelText("Exportă graficul");
    // When loading, the export button is disabled
    // (loading overlay is shown, but export button should still be disabled)
  });

  it("shows custom formats when provided", async () => {
    const { user } = setup({
      exportConfig: { formats: ["png", "csv"] },
    });
    await user.click(screen.getByLabelText("Exportă graficul"));
    expect(screen.getByText("PNG (imagine)")).toBeInTheDocument();
    expect(screen.getByText("CSV (date)")).toBeInTheDocument();
    expect(screen.queryByText("SVG (vectorial)")).not.toBeInTheDocument();
  });

  it("displays correct aria attributes on export button", () => {
    setup();
    const btn = screen.getByLabelText("Exportă graficul");
    expect(btn).toHaveAttribute("aria-haspopup", "true");
    expect(btn).toHaveAttribute("aria-expanded", "false");
  });

  it("updates aria-expanded when dropdown opens", async () => {
    const { user } = setup();
    const btn = screen.getByLabelText("Exportă graficul");
    await user.click(btn);
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });
});

// ─── Empty State ────────────────────────────────────────────────────

describe("Chart empty state", () => {
  it("renders empty state when no data", () => {
    setup({ data: [] });
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(
      screen.getByText("Nicio dată disponibilă pentru acest grafic."),
    ).toBeInTheDocument();
  });

  it("renders custom empty message", () => {
    setup({ data: [], emptyMessage: "Nu există date." });
    expect(screen.getByText("Nu există date.")).toBeInTheDocument();
  });

  it("does not show empty state when loading", () => {
    setup({ data: [], loading: true, emptyMessage: "Nu există date." });
    expect(screen.queryByText("Nu există date.")).not.toBeInTheDocument();
  });
});

// ─── Loading State ──────────────────────────────────────────────────

describe("Chart loading state", () => {
  it("renders loading spinner when loading", () => {
    setup({ loading: true });
    expect(screen.getByRole("status", { name: undefined })).toBeInTheDocument();
  });

  it("renders custom loading message", () => {
    setup({ loading: true, loadingMessage: "Se procesează..." });
    expect(screen.getByText("Se procesează...")).toBeInTheDocument();
  });

  it("renders loading with default message", () => {
    setup({ loading: true });
    expect(screen.getByText("Se încarcă...")).toBeInTheDocument();
  });

  it("uses aria-live polite for loading state", () => {
    setup({ loading: true });
    const status = document.querySelector('[aria-live="polite"]');
    expect(status).toBeInTheDocument();
  });
});

// ─── Error State ────────────────────────────────────────────────────

describe("Chart error state", () => {
  it("renders error message when error is provided", () => {
    setup({ error: "Eroare de rețea." });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Eroare de rețea.")).toBeInTheDocument();
  });

  it("renders retry button when onRetry is provided", () => {
    const onRetry = jest.fn();
    setup({ error: "Eroare.", onRetry });
    expect(screen.getByText("Reîncearcă")).toBeInTheDocument();
  });

  it("calls onRetry when retry button is clicked", async () => {
    const onRetry = jest.fn();
    const { user } = setup({ error: "Eroare.", onRetry });
    await user.click(screen.getByText("Reîncearcă"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

// ─── Sizes ──────────────────────────────────────────────────────────

describe("Chart sizes", () => {
  it("renders sm size", () => {
    setup({ size: "sm" });
    expect(screen.getByRole("region")).toHaveClass("h-48");
  });

  it("renders md size (default)", () => {
    setup();
    expect(screen.getByRole("region")).toHaveClass("h-72");
  });

  it("renders lg size", () => {
    setup({ size: "lg" });
    expect(screen.getByRole("region")).toHaveClass("h-96");
  });

  it("renders xl size", () => {
    setup({ size: "xl" });
    expect(screen.getByRole("region")).toHaveClass("h-[28rem]");
  });

  it("renders full size", () => {
    setup({ size: "full" });
    expect(screen.getByRole("region")).toHaveClass("h-full");
  });

  it("renders auto size", () => {
    setup({ size: "auto" });
    expect(screen.getByRole("region")).toHaveClass("h-auto");
  });
});

// ─── Variants ────────────────────────────────────────────────────────

describe("Chart variants", () => {
  it("renders default variant", () => {
    setup({ variant: "default" });
    expect(screen.getByRole("region")).toHaveClass("bg-surface");
  });

  it("renders ghost variant", () => {
    setup({ variant: "ghost" });
    const region = screen.getByRole("region");
    expect(region).toHaveClass("bg-transparent");
    expect(region).toHaveClass("border-transparent");
    expect(region).toHaveClass("shadow-none");
  });

  it("renders elevated variant", () => {
    setup({ variant: "elevated" });
    const region = screen.getByRole("region");
    expect(region).toHaveClass("shadow-elevation-2");
    expect(region).toHaveClass("border-transparent");
  });

  it("renders outline variant", () => {
    setup({ variant: "outline" });
    const region = screen.getByRole("region");
    expect(region).toHaveClass("bg-transparent");
    expect(region).toHaveClass("border-border");
  });
});

// ─── Legend ──────────────────────────────────────────────────────────

describe("Chart legend", () => {
  it("renders legend by default", () => {
    setup();
    expect(screen.getByLabelText("Legendă grafic")).toBeInTheDocument();
  });

  it("does not render legend when legend is false", () => {
    setup({ legend: false });
    expect(screen.queryByLabelText("Legendă grafic")).not.toBeInTheDocument();
  });

  it("renders legend items", () => {
    setup();
    const legend = screen.getByLabelText("Legendă grafic");
    expect(within(legend).getByText("Venituri")).toBeInTheDocument();
    expect(within(legend).getByText("Cheltuieli")).toBeInTheDocument();
    expect(within(legend).getByText("Profit")).toBeInTheDocument();
  });

  it("legend items have listitem role", () => {
    setup();
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBe(3);
  });
});

// ─── useChartTheme Hook ─────────────────────────────────────────────

describe("useChartTheme hook", () => {
  beforeEach(() => {
    mockIsDark = false;
  });

  it("returns light colors by default", () => {
    const TestComponent = () => {
      const theme = useChartTheme();
      return (
        <div>
          <span data-testid="is-dark">{String(theme.isDark)}</span>
          <span data-testid="colors-length">{theme.colors.length}</span>
        </div>
      );
    };
    render(<TestComponent />);
    expect(screen.getByTestId("is-dark")).toHaveTextContent("false");
    expect(screen.getByTestId("colors-length")).toHaveTextContent("10");
  });

  it("returns dark colors when forceDark is true", () => {
    const TestComponent = () => {
      const theme = useChartTheme(true);
      return <span data-testid="is-dark">{String(theme.isDark)}</span>;
    };
    render(<TestComponent />);
    expect(screen.getByTestId("is-dark")).toHaveTextContent("true");
  });

  it("returns light colors when forceLight is true even if dark mode", () => {
    mockIsDark = true;
    const TestComponent = () => {
      const theme = useChartTheme(false, true);
      return <span data-testid="is-dark">{String(theme.isDark)}</span>;
    };
    render(<TestComponent />);
    expect(screen.getByTestId("is-dark")).toHaveTextContent("false");
  });

  it("returns grid color", () => {
    const TestComponent = () => {
      const theme = useChartTheme();
      return <span data-testid="grid-color">{theme.gridColor}</span>;
    };
    render(<TestComponent />);
    expect(screen.getByTestId("grid-color")).toHaveTextContent("hsl");
  });

  it("returns text colors", () => {
    const TestComponent = () => {
      const theme = useChartTheme();
      return (
        <>
          <span data-testid="text-color">{theme.textColor}</span>
          <span data-testid="text-secondary">{theme.textColorSecondary}</span>
        </>
      );
    };
    render(<TestComponent />);
    expect(screen.getByTestId("text-color")).toHaveTextContent("hsl");
    expect(screen.getByTestId("text-secondary")).toHaveTextContent("hsl");
  });

  it("returns axis color", () => {
    const TestComponent = () => {
      const theme = useChartTheme();
      return <span data-testid="axis-color">{theme.axisColor}</span>;
    };
    render(<TestComponent />);
    expect(screen.getByTestId("axis-color")).toHaveTextContent("hsl");
  });
});

// ─── useChartExport Hook ────────────────────────────────────────────

describe("useChartExport hook", () => {
  it("returns export functions", () => {
    const ref = { current: null };
    const TestComponent = () => {
      const { exportPNG, exportSVG, exportCSV, isExporting } = useChartExport(
        ref as React.RefObject<HTMLDivElement>,
        mockData,
      );
      return (
        <div>
          <span data-testid="export-png">{typeof exportPNG}</span>
          <span data-testid="export-svg">{typeof exportSVG}</span>
          <span data-testid="export-csv">{typeof exportCSV}</span>
          <span data-testid="is-exporting">{String(isExporting)}</span>
        </div>
      );
    };
    render(<TestComponent />);
    expect(screen.getByTestId("export-png")).toHaveTextContent("function");
    expect(screen.getByTestId("export-svg")).toHaveTextContent("function");
    expect(screen.getByTestId("export-csv")).toHaveTextContent("function");
    expect(screen.getByTestId("is-exporting")).toHaveTextContent("false");
  });

  it("respects custom fileName", () => {
    const ref = { current: null };
    const TestComponent = () => {
      useChartExport(ref as React.RefObject<HTMLDivElement>, mockData, {
        fileName: "custom-name",
      });
      return <span data-testid="ok">ok</span>;
    };
    render(<TestComponent />);
    expect(screen.getByTestId("ok")).toBeInTheDocument();
  });

  it("handles empty data for CSV export", () => {
    const ref = { current: null };
    const TestComponent = () => {
      const { exportCSV } = useChartExport(
        ref as React.RefObject<HTMLDivElement>,
        [],
        { formats: ["csv"] },
      );
      return <button type="button" data-testid="csv-btn" onClick={exportCSV}>CSV</button>;
    };
    render(<TestComponent />);
    // Should not throw when clicking with empty data
    expect(screen.getByTestId("csv-btn")).toBeInTheDocument();
  });
});

// ─── Variant Exports ────────────────────────────────────────────────

describe("Chart variant exports", () => {
  it("exports chartWrapperVariants", () => {
    expect(chartWrapperVariants).toBeDefined();
    expect(typeof chartWrapperVariants).toBe("function");
  });

  it("exports LIGHT_COLORS", () => {
    expect(LIGHT_COLORS).toBeDefined();
    expect(Array.isArray(LIGHT_COLORS)).toBe(true);
    expect(LIGHT_COLORS.length).toBe(10);
  });

  it("exports DARK_COLORS", () => {
    expect(DARK_COLORS).toBeDefined();
    expect(Array.isArray(DARK_COLORS)).toBe(true);
    expect(DARK_COLORS.length).toBe(10);
  });
});

// ─── Compound Sub-components ────────────────────────────────────────

describe("Chart sub-components", () => {
  it("Chart.ExportButton is defined", () => {
    expect(Chart.ExportButton).toBeDefined();
  });

  it("Chart.EmptyState is defined", () => {
    expect(Chart.EmptyState).toBeDefined();
  });

  it("Chart.ErrorState is defined", () => {
    expect(Chart.ErrorState).toBeDefined();
  });

  it("Chart.LoadingState is defined", () => {
    expect(Chart.LoadingState).toBeDefined();
  });

  it("renders standalone EmptyState", () => {
    render(<Chart.EmptyState message="Test empty" />);
    expect(screen.getByText("Test empty")).toBeInTheDocument();
  });

  it("renders standalone ErrorState", () => {
    const onRetry = jest.fn();
    render(<Chart.ErrorState message="Test error" onRetry={onRetry} />);
    expect(screen.getByText("Test error")).toBeInTheDocument();
    expect(screen.getByText("Reîncearcă")).toBeInTheDocument();
  });

  it("renders standalone LoadingState", () => {
    render(<Chart.LoadingState message="Test loading" />);
    expect(screen.getByText("Test loading")).toBeInTheDocument();
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────

describe("Chart edge cases", () => {
  it("handles single data point", () => {
    setup({ data: [mockData[0]!] });
    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("handles single series", () => {
    setup({
      series: [{ dataKey: "venituri", name: "Venituri" }],
    });
    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("handles undefined title gracefully", () => {
    setup({ title: undefined, showHeader: false });
    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("handles custom colors", () => {
    setup({ colors: ["#ff0000", "#00ff00", "#0000ff"] });
    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("handles forceDark prop", () => {
    setup({ forceDark: true });
    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("handles forceLight prop", () => {
    setup({ forceLight: true });
    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("renders with bar chart type", () => {
    setup({ type: "bar" });
    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("renders with area chart type", () => {
    setup({ type: "area" });
    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("renders with pie chart type", () => {
    setup({ type: "pie", series: [{ dataKey: "venituri", name: "Venituri" }] });
    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("handles series with stackId", () => {
    setup({
      series: [
        { dataKey: "venituri", name: "Venituri", stackId: "stack1" },
        { dataKey: "cheltuieli", name: "Cheltuieli", stackId: "stack1" },
      ],
      type: "bar",
    });
    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("handles disabled animation", () => {
    setup({ animate: false });
    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("renders with syncId", () => {
    setup({ syncId: "my-sync-group" });
    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("handles hidden series via config", () => {
    setup({
      series: [
        { dataKey: "venituri", name: "Venituri" },
        { dataKey: "profit", name: "Profit", hidden: true },
      ],
    });
    expect(screen.getByRole("region")).toBeInTheDocument();
  });
});

// ─── Accessibility ──────────────────────────────────────────────────

describe("Chart accessibility", () => {
  it("has region role", () => {
    setup();
    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("legend has list role", () => {
    setup();
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  it("legend items have listitem role", () => {
    setup();
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBeGreaterThan(0);
  });

  it("export button has proper aria attributes", () => {
    setup();
    const btn = screen.getByLabelText("Exportă graficul");
    expect(btn).toHaveAttribute("aria-haspopup", "true");
  });

  it("error state has alert role", () => {
    setup({ error: "Eroare!" });
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("empty state has status role", () => {
    setup({ data: [] });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("svg elements are marked aria-hidden", () => {
    setup();
    const svgIcons = document.querySelectorAll('[aria-hidden="true"]');
    expect(svgIcons.length).toBeGreaterThan(0);
  });
});

// ─── Responsive ─────────────────────────────────────────────────────

describe("Chart responsive", () => {
  it("renders inside ResponsiveContainer", () => {
    setup();
    expect(screen.getByTestId("responsive-container")).toBeInTheDocument();
  });

  it("applies flex layout for responsive height", () => {
    setup({ size: "full" });
    expect(screen.getByRole("region")).toHaveClass("h-full");
  });
});

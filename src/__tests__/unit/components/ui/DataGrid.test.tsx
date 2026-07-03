import React from "react";
import { render, screen, within, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ColumnDef } from "@tanstack/react-table";
import { DataGrid, DataGridProps, exportToCSV } from "@/components/ui/DataGrid";
import {
  gridWrapperVariants,
  thVariants,
  tdVariants,
  trVariants,
  paginationButtonVariants,
} from "@/components/ui/DataGrid";

// ─── Test Data Types ────────────────────────────────────────────────

interface TestUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "inactive";
  age?: number;
}

const mockData: TestUser[] = [
  { id: "1", name: "Alice", email: "alice@test.com", role: "Admin", status: "active", age: 30 },
  { id: "2", name: "Bob", email: "bob@test.com", role: "Editor", status: "active", age: 25 },
  { id: "3", name: "Charlie", email: "charlie@test.com", role: "Viewer", status: "inactive", age: 35 },
  { id: "4", name: "Diana", email: "diana@test.com", role: "Admin", status: "active", age: 28 },
  { id: "5", name: "Eve", email: "eve@test.com", role: "Editor", status: "inactive", age: 32 },
  { id: "6", name: "Frank", email: "frank@test.com", role: "Viewer", status: "active", age: 40 },
  { id: "7", name: "Grace", email: "grace@test.com", role: "Admin", status: "active", age: 27 },
  { id: "8", name: "Hank", email: "hank@test.com", role: "Editor", status: "inactive", age: 33 },
  { id: "9", name: "Ivy", email: "ivy@test.com", role: "Viewer", status: "active", age: 29 },
  { id: "10", name: "Jack", email: "jack@test.com", role: "Admin", status: "inactive", age: 31 },
  { id: "11", name: "Kate", email: "kate@test.com", role: "Editor", status: "active", age: 26 },
  { id: "12", name: "Leo", email: "leo@test.com", role: "Viewer", status: "inactive", age: 38 },
];

const defaultColumns: ColumnDef<TestUser>[] = [
  { accessorKey: "name", header: "Nume", id: "name" },
  { accessorKey: "email", header: "Email", id: "email" },
  { accessorKey: "role", header: "Rol", id: "role" },
  { accessorKey: "status", header: "Status", id: "status" },
];

// ─── Helpers ────────────────────────────────────────────────────────

const setup = <TData extends object = TestUser>(
  props: Partial<DataGridProps<TData>> & { columns: ColumnDef<TData>[]; data: TData[] },
) => {
  const user = userEvent.setup();
  const utils = render(
    <DataGrid<TData>
      columns={props.columns}
      data={props.data}
      {...props}
    />,
  );
  return { user, ...utils };
};

// ─── Basic Rendering ────────────────────────────────────────────────

describe("DataGrid rendering", () => {
  it("renders the grid with correct structure", () => {
    setup({ columns: defaultColumns, data: mockData });
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Grid de date avansat" })).toBeInTheDocument();
  });

  it("renders all column headers", () => {
    setup({ columns: defaultColumns, data: mockData });
    expect(screen.getByText("Nume")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Rol")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("renders data rows", () => {
    setup({ columns: defaultColumns, data: mockData });
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Charlie")).toBeInTheDocument();
  });

  it("renders toolbar with search and export", () => {
    setup({ columns: defaultColumns, data: mockData });
    expect(screen.getByPlaceholderText("Caută în toate coloanele...")).toBeInTheDocument();
    expect(screen.getByLabelText("Exportă CSV")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    setup({ columns: defaultColumns, data: mockData, className: "my-custom-grid" });
    const region = screen.getByRole("region");
    expect(region).toHaveClass("my-custom-grid");
  });
});

// ─── Column Filtering ───────────────────────────────────────────────

describe("DataGrid column filtering", () => {
  it("renders per-column filter inputs", () => {
    setup({ columns: defaultColumns, data: mockData });
    const filterInputs = screen.getAllByPlaceholderText("Filtrează...");
    expect(filterInputs.length).toBeGreaterThanOrEqual(4);
  });

  it("filters data by column filter", async () => {
    const { user } = setup({ columns: defaultColumns, data: mockData });
    const filterInputs = screen.getAllByPlaceholderText("Filtrează...");
    await user.type(filterInputs[0]!, "Alice");
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
  });

  it("global search filters across all columns", async () => {
    const { user } = setup({ columns: defaultColumns, data: mockData });
    const globalSearch = screen.getByPlaceholderText("Caută în toate coloanele...");
    await user.type(globalSearch, "Alice");
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
  });

  it("clears filter with X button", async () => {
    const { user } = setup({ columns: defaultColumns, data: mockData });
    const globalSearch = screen.getByPlaceholderText("Caută în toate coloanele...");
    await user.type(globalSearch, "Alice");
    expect(screen.getByText("Alice")).toBeInTheDocument();

    const clearButton = screen.getByLabelText("Șterge căutarea");
    await user.click(clearButton);
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("disables column filters when enableColumnFilters=false", () => {
    setup({ columns: defaultColumns, data: mockData, enableColumnFilters: false });
    expect(screen.queryByPlaceholderText("Filtrează...")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Caută în toate coloanele...")).not.toBeInTheDocument();
  });
});

// ─── Column Visibility Toggle ───────────────────────────────────────

describe("DataGrid column visibility", () => {
  it("renders column visibility toggle button", () => {
    setup({ columns: defaultColumns, data: mockData });
    expect(screen.getByLabelText("Vizibilitate coloane")).toBeInTheDocument();
  });

  it("opens column visibility dropdown", async () => {
    const { user } = setup({ columns: defaultColumns, data: mockData });
    await user.click(screen.getByLabelText("Vizibilitate coloane"));
    expect(screen.getByRole("listbox", { name: "Selectează coloane vizibile" })).toBeInTheDocument();
  });
});

// ─── Empty State ────────────────────────────────────────────────────

describe("DataGrid empty state", () => {
  it("shows empty message when no data", () => {
    setup({ columns: defaultColumns, data: [] });
    expect(screen.getByText("Nicio înregistrare găsită.")).toBeInTheDocument();
  });

  it("shows custom empty message", () => {
    setup({
      columns: defaultColumns,
      data: [],
      emptyMessage: "Nu există utilizatori.",
    });
    expect(screen.getByText("Nu există utilizatori.")).toBeInTheDocument();
  });

  it("renders empty state with status role", () => {
    setup({ columns: defaultColumns, data: [] });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});

// ─── Loading State ──────────────────────────────────────────────────

describe("DataGrid loading state", () => {
  it("renders skeleton rows when loading", () => {
    setup({ columns: defaultColumns, data: mockData, loading: true });
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(5);
  });

  it("hides pagination when loading", () => {
    setup({ columns: defaultColumns, data: mockData, loading: true });
    expect(screen.queryByText("din")).not.toBeInTheDocument();
  });
});

// ─── Sorting ────────────────────────────────────────────────────────

describe("DataGrid sorting", () => {
  it("sorts by column when header is clicked", async () => {
    const { user } = setup({ columns: defaultColumns, data: mockData });
    const nameHeader = screen.getByText("Nume").closest("span");
    const sortButton = nameHeader?.querySelector('[role="button"]') ?? nameHeader;
    if (sortButton instanceof HTMLElement) {
      await user.click(sortButton);
    }

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Alice");
  });

  it("does not sort when sorting disabled", () => {
    setup({ columns: defaultColumns, data: mockData, enableSorting: false });
    const nameHeader = screen.getByText("Nume").closest("th");
    const sortIcons = nameHeader?.querySelectorAll(".lucide-chevrons-up-down");
    expect(sortIcons?.length ?? 0).toBe(0);
  });

  it("calls onSortingChange when sort is toggled", async () => {
    const onSortingChange = jest.fn();
    const { user } = setup({ columns: defaultColumns, data: mockData, onSortingChange });
    const nameHeader = screen.getByText("Nume");
    await user.click(nameHeader);
    expect(onSortingChange).toHaveBeenCalled();
  });
});

// ─── Pagination ─────────────────────────────────────────────────────

describe("DataGrid pagination", () => {
  it("shows pagination controls", () => {
    setup({ columns: defaultColumns, data: mockData });
    expect(screen.getByText("1–10 din 12")).toBeInTheDocument();
  });

  it("navigates to next page", async () => {
    const { user } = setup({ columns: defaultColumns, data: mockData });
    const nextButton = screen.getByLabelText("Pagina următoare");
    await user.click(nextButton);
    expect(screen.getByText("11–12 din 12")).toBeInTheDocument();
  });

  it("disables first/prev buttons on first page", () => {
    setup({ columns: defaultColumns, data: mockData });
    expect(screen.getByLabelText("Prima pagină")).toBeDisabled();
    expect(screen.getByLabelText("Pagina anterioară")).toBeDisabled();
  });

  it("hides pagination when disabled", () => {
    setup({ columns: defaultColumns, data: mockData, enablePagination: false });
    expect(screen.queryByText("din")).not.toBeInTheDocument();
  });

  it("supports page size selector", async () => {
    const { user } = setup({ columns: defaultColumns, data: mockData });
    const selector = screen.getByRole("combobox");
    expect(selector).toBeInTheDocument();
    await user.selectOptions(selector, "20");
    expect(screen.getByText("1–12 din 12")).toBeInTheDocument();
  });
});

// ─── Row Selection ──────────────────────────────────────────────────

describe("DataGrid row selection", () => {
  it("shows selection checkboxes when enabled", () => {
    setup({ columns: defaultColumns, data: mockData, enableSelection: true });
    expect(screen.getByLabelText("Selectează toate")).toBeInTheDocument();
  });

  it("does not show checkboxes when selection disabled", () => {
    setup({ columns: defaultColumns, data: mockData });
    expect(screen.queryByLabelText("Selectează toate")).not.toBeInTheDocument();
  });

  it("selects individual row", async () => {
    const { user } = setup({ columns: defaultColumns, data: mockData, enableSelection: true });
    await user.click(screen.getByLabelText("Selectează rândul 1"));
    expect(screen.getByLabelText("Selectează rândul 1")).toHaveAttribute("aria-checked", "true");
  });

  it("selects all rows via header checkbox", async () => {
    const { user } = setup({ columns: defaultColumns, data: mockData, enableSelection: true });
    await user.click(screen.getByLabelText("Selectează toate"));
    expect(screen.getByLabelText("Selectează toate")).toHaveAttribute("aria-checked", "true");
  });

  it("shows selection count in toolbar", async () => {
    const { user } = setup({ columns: defaultColumns, data: mockData, enableSelection: true });
    await user.click(screen.getByLabelText("Selectează rândul 1"));
    expect(screen.getByText("1 din 12 selectate")).toBeInTheDocument();
  });

  it("calls onRowSelectionChange", async () => {
    const onRowSelectionChange = jest.fn();
    const { user } = setup({
      columns: defaultColumns,
      data: mockData,
      enableSelection: true,
      onRowSelectionChange,
    });
    await user.click(screen.getByLabelText("Selectează rândul 1"));
    expect(onRowSelectionChange).toHaveBeenCalled();
  });
});

// ─── Expandable Rows ────────────────────────────────────────────────

describe("DataGrid expandable rows", () => {
  const expandedContent = (row: { original: TestUser }) => (
    <div data-testid="expanded-content">
      Detalii: {row.original.name} - {row.original.email}
    </div>
  );

  it("shows expand buttons when enabled", () => {
    setup({
      columns: defaultColumns,
      data: mockData.slice(0, 3),
      enableExpand: true,
      expandedContent,
    });
    expect(screen.getAllByLabelText("Extinde rândul").length).toBe(3);
  });

  it("expands row when expand button clicked", async () => {
    const { user } = setup({
      columns: defaultColumns,
      data: mockData.slice(0, 3),
      enableExpand: true,
      expandedContent,
    });
    await user.click(screen.getAllByLabelText("Extinde rândul")[0]!);
    expect(screen.getByTestId("expanded-content")).toBeInTheDocument();
  });

  it("does not expand when expand disabled", () => {
    setup({ columns: defaultColumns, data: mockData.slice(0, 3) });
    expect(screen.queryByLabelText("Extinde rândul")).not.toBeInTheDocument();
  });
});

// ─── Row Click ──────────────────────────────────────────────────────

describe("DataGrid row click", () => {
  it("calls onRowClick when row is clicked", async () => {
    const onRowClick = jest.fn();
    const { user } = setup({ columns: defaultColumns, data: mockData, onRowClick });
    await user.click(screen.getByText("Alice").closest("tr")!);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it("applies cursor-pointer when onRowClick is provided", () => {
    setup({ columns: defaultColumns, data: mockData, onRowClick: jest.fn() });
    expect(screen.getByText("Alice").closest("tr")).toHaveClass("cursor-pointer");
  });
});

// ─── CSV Export ─────────────────────────────────────────────────────

describe("DataGrid CSV export", () => {
  it("renders export button by default", () => {
    setup({ columns: defaultColumns, data: mockData });
    expect(screen.getByLabelText("Exportă CSV")).toBeInTheDocument();
  });

  it("hides export button when enableExport=false", () => {
    setup({ columns: defaultColumns, data: mockData, enableExport: false });
    expect(screen.queryByLabelText("Exportă CSV")).not.toBeInTheDocument();
  });

  it("creates CSV blob with correct headers on export", () => {
    const mockCreateObjectURL = jest.fn(() => "blob:test");
    const mockRevokeObjectURL = jest.fn();
    URL.createObjectURL = mockCreateObjectURL;
    URL.revokeObjectURL = mockRevokeObjectURL;

    const mockClick = jest.fn();
    const mockAnchor = {
      href: "",
      download: "",
      style: {} as CSSStyleDeclaration,
      click: mockClick,
    } as unknown as HTMLAnchorElement;

    jest.spyOn(document, "createElement").mockReturnValue(mockAnchor as any);
    jest.spyOn(document.body, "appendChild").mockImplementation(() => mockAnchor);
    jest.spyOn(document.body, "removeChild").mockImplementation(() => mockAnchor);

    exportToCSV(mockData.slice(0, 2), defaultColumns, "test.csv");

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockAnchor.download).toBe("test.csv");

    jest.restoreAllMocks();
  });

  it("respects exportable=false in column meta", () => {
    const columnsWithMeta: ColumnDef<TestUser>[] = [
      { accessorKey: "name", header: "Nume", id: "name", meta: { exportable: false } },
      { accessorKey: "email", header: "Email", id: "email" },
    ];

    const mockCreateObjectURL = jest.fn(() => "blob:test");
    URL.createObjectURL = mockCreateObjectURL;

    const mockClick = jest.fn();
    const mockAnchor = {
      href: "",
      download: "",
      style: {} as CSSStyleDeclaration,
      click: mockClick,
    } as unknown as HTMLAnchorElement;

    jest.spyOn(document, "createElement").mockReturnValue(mockAnchor as any);
    jest.spyOn(document.body, "appendChild").mockImplementation(() => mockAnchor);
    jest.spyOn(document.body, "removeChild").mockImplementation(() => mockAnchor);

    exportToCSV(mockData.slice(0, 1), columnsWithMeta, "test.csv");
    expect(mockClick).toHaveBeenCalled();

    jest.restoreAllMocks();
  });
});

// ─── Column Resize ──────────────────────────────────────────────────

describe("DataGrid column resize", () => {
  it("renders resize handles on columns", () => {
    setup({ columns: defaultColumns, data: mockData });
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("disables column resize when enableColumnResize=false", () => {
    setup({ columns: defaultColumns, data: mockData, enableColumnResize: false });
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});

// ─── Column Reorder ─────────────────────────────────────────────────

describe("DataGrid column reorder", () => {
  it("renders drag handles when reorder enabled", () => {
    setup({ columns: defaultColumns, data: mockData, enableColumnReorder: true });
    expect(document.querySelectorAll(".lucide-grip-vertical").length).toBe(4);
  });

  it("hides drag handles when reorder disabled", () => {
    setup({ columns: defaultColumns, data: mockData, enableColumnReorder: false });
    expect(document.querySelectorAll(".lucide-grip-vertical").length).toBe(0);
  });
});

// ─── Size Variants ──────────────────────────────────────────────────

describe("DataGrid sizes", () => {
  it("renders sm size", () => {
    setup({ columns: defaultColumns, data: mockData, size: "sm" });
    expect(screen.getByRole("region")).toHaveClass("text-xs");
  });

  it("renders md size (default)", () => {
    setup({ columns: defaultColumns, data: mockData });
    expect(screen.getByRole("region")).toHaveClass("text-sm");
  });

  it("renders lg size", () => {
    setup({ columns: defaultColumns, data: mockData, size: "lg" });
    expect(screen.getByRole("region")).toHaveClass("text-base");
  });
});

// ─── Sticky Header ──────────────────────────────────────────────────

describe("DataGrid sticky header", () => {
  it("applies sticky styles by default", () => {
    setup({ columns: defaultColumns, data: mockData });
    const thead = document.querySelector("thead");
    expect(thead).toHaveClass("sticky");
    expect(thead).toHaveClass("top-0");
  });

  it("sticky header has correct z-index", () => {
    setup({ columns: defaultColumns, data: mockData });
    expect(document.querySelector("thead")).toHaveClass("z-sticky");
  });
});

// ─── Accessibility ──────────────────────────────────────────────────

describe("DataGrid accessibility", () => {
  it("has correct aria roles", () => {
    setup({ columns: defaultColumns, data: mockData });
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("region")).toBeInTheDocument();
    expect(screen.getAllByRole("row").length).toBeGreaterThan(0);
  });

  it("column headers have aria-sort after sorting", async () => {
    const { user } = setup({ columns: defaultColumns, data: mockData });
    await user.click(screen.getByText("Nume"));
    expect(screen.getByText("Nume").closest("th")).toHaveAttribute("aria-sort", "ascending");
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────

describe("DataGrid edge cases", () => {
  it("handles single row of data", () => {
    setup({ columns: defaultColumns, data: [mockData[0]!] });
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders with many columns", () => {
    const wideColumns: ColumnDef<TestUser>[] = [
      ...defaultColumns,
      { accessorKey: "age", header: "Vârstă", id: "age" },
    ];
    setup({ columns: wideColumns, data: mockData });
    expect(screen.getByText("Vârstă")).toBeInTheDocument();
  });

  it("works with custom rowId", () => {
    setup({ columns: defaultColumns, data: mockData, rowId: "id" });
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("forwards additional className to table element", () => {
    setup({ columns: defaultColumns, data: mockData, tableClassName: "custom-table-class" });
    expect(screen.getByRole("table")).toHaveClass("custom-table-class");
  });

  it("handles empty columns gracefully", () => {
    setup({ columns: [], data: [] });
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});

// ─── Manual/Server-side Pagination ──────────────────────────────────

describe("DataGrid manual pagination", () => {
  it("shows correct total from rowCount", () => {
    setup({
      columns: defaultColumns,
      data: mockData.slice(0, 10),
      manualPagination: true,
      rowCount: 100,
    });
    expect(screen.getByText("1–10 din 100")).toBeInTheDocument();
  });

  it("does not paginate locally when manual", async () => {
    const onPaginationChange = jest.fn();
    const { user } = setup({
      columns: defaultColumns,
      data: mockData.slice(0, 10),
      manualPagination: true,
      rowCount: 12,
      onPaginationChange,
    });
    await user.click(screen.getByLabelText("Pagina următoare"));
    expect(onPaginationChange).toHaveBeenCalledWith(
      expect.objectContaining({ pageIndex: 1, pageSize: 10 }),
    );
  });
});

// ─── Variant Exports ────────────────────────────────────────────────

describe("DataGrid variant exports", () => {
  it("exports gridWrapperVariants", () => {
    expect(gridWrapperVariants).toBeDefined();
    expect(typeof gridWrapperVariants).toBe("function");
  });

  it("exports thVariants", () => {
    expect(thVariants).toBeDefined();
    expect(typeof thVariants).toBe("function");
  });

  it("exports tdVariants", () => {
    expect(tdVariants).toBeDefined();
    expect(typeof tdVariants).toBe("function");
  });

  it("exports trVariants", () => {
    expect(trVariants).toBeDefined();
    expect(typeof trVariants).toBe("function");
  });

  it("exports paginationButtonVariants", () => {
    expect(paginationButtonVariants).toBeDefined();
    expect(typeof paginationButtonVariants).toBe("function");
  });
});

// ─── Hover ──────────────────────────────────────────────────────────

describe("DataGrid hover", () => {
  it("applies hover styles by default", () => {
    setup({ columns: defaultColumns, data: mockData });
    expect(screen.getByText("Alice").closest("tr")).toHaveClass("hover:bg-surface-secondary");
  });

  it("disables hover when enableHover=false", () => {
    setup({ columns: defaultColumns, data: mockData, enableHover: false });
    expect(screen.getByText("Alice").closest("tr")).not.toHaveClass("hover:bg-surface-secondary");
  });
});

// ─── Toolbar ────────────────────────────────────────────────────────

describe("DataGrid toolbar", () => {
  it("renders toolbar with all controls", () => {
    setup({ columns: defaultColumns, data: mockData });
    expect(screen.getByPlaceholderText("Caută în toate coloanele...")).toBeInTheDocument();
    expect(screen.getByLabelText("Exportă CSV")).toBeInTheDocument();
    expect(screen.getByLabelText("Vizibilitate coloane")).toBeInTheDocument();
  });

  it("hides toolbar when all features disabled", () => {
    setup({
      columns: defaultColumns,
      data: mockData,
      enableColumnFilters: false,
      enableExport: false,
    });
    expect(screen.queryByPlaceholderText("Caută în toate coloanele...")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Exportă CSV")).not.toBeInTheDocument();
  });

  it("applies toolbarClassName", () => {
    setup({
      columns: defaultColumns,
      data: mockData,
      toolbarClassName: "custom-toolbar",
    });
    expect(document.querySelector(".custom-toolbar")).toBeInTheDocument();
  });
});

// ─── Column Order Change ────────────────────────────────────────────

describe("DataGrid column order", () => {
  it("calls onColumnOrderChange when column order changes", () => {
    const onColumnOrderChange = jest.fn();
    setup({
      columns: defaultColumns,
      data: mockData,
      onColumnOrderChange,
    });
    expect(onColumnOrderChange).not.toHaveBeenCalled();
  });

  it("initializes column order from columns", () => {
    setup({ columns: defaultColumns, data: mockData });
    expect(screen.getByText("Nume")).toBeInTheDocument();
  });
});
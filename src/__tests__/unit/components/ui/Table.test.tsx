import React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ColumnDef } from "@tanstack/react-table";
import { Table, TableProps } from "@/components/ui/Table";
import {
  tableWrapperVariants,
  thVariants,
  tdVariants,
  trVariants,
  paginationButtonVariants,
} from "@/components/ui/Table";

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
  props: Partial<TableProps<TData>> & { columns: ColumnDef<TData>[]; data: TData[] },
) => {
  const user = userEvent.setup();
  const utils = render(
    <Table<TData>
      columns={props.columns}
      data={props.data}
      {...props}
    />,
  );
  return { user, ...utils };
};

// ─── Basic Rendering ────────────────────────────────────────────────

describe("Table rendering", () => {
  it("renders the table with correct structure", () => {
    setup({ columns: defaultColumns, data: mockData });
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Tabel de date" })).toBeInTheDocument();
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

  it("renders with correct row count by default (paginated to 10)", () => {
    setup({ columns: defaultColumns, data: mockData });
    const rows = screen.getAllByRole("row");
    // header + 10 data rows
    expect(rows.length).toBe(11);
  });

  it("applies default size classes", () => {
    setup({ columns: defaultColumns, data: mockData });
    const table = screen.getByRole("table");
    expect(table).toHaveClass("text-sm");
  });

  it("applies custom className", () => {
    setup({ columns: defaultColumns, data: mockData, className: "my-custom-table" });
    const region = screen.getByRole("region");
    expect(region).toHaveClass("my-custom-table");
  });
});

// ─── Empty State ────────────────────────────────────────────────────

describe("Table empty state", () => {
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

describe("Table loading state", () => {
  it("renders skeleton rows when loading", () => {
    setup({ columns: defaultColumns, data: mockData, loading: true });
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(5);
  });

  it("renders custom loading row count", () => {
    setup({
      columns: defaultColumns,
      data: mockData,
      loading: true,
      loadingRowCount: 3,
    });
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBe(3);
  });

  it("does not show empty state when loading", () => {
    setup({
      columns: defaultColumns,
      data: [],
      loading: true,
      emptyMessage: "Nu există utilizatori.",
    });
    expect(screen.queryByText("Nu există utilizatori.")).not.toBeInTheDocument();
  });

  it("hides pagination when loading", () => {
    setup({ columns: defaultColumns, data: mockData, loading: true });
    expect(screen.queryByText("din")).not.toBeInTheDocument();
  });
});

// ─── Size Variants ──────────────────────────────────────────────────

describe("Table sizes", () => {
  it("renders sm size", () => {
    setup({ columns: defaultColumns, data: mockData, size: "sm" });
    const table = screen.getByRole("table");
    expect(table).toHaveClass("text-xs");
  });

  it("renders md size (default)", () => {
    setup({ columns: defaultColumns, data: mockData });
    const table = screen.getByRole("table");
    expect(table).toHaveClass("text-sm");
  });

  it("renders lg size", () => {
    setup({ columns: defaultColumns, data: mockData, size: "lg" });
    const table = screen.getByRole("table");
    expect(table).toHaveClass("text-base");
  });
});

// ─── Sorting ────────────────────────────────────────────────────────

describe("Table sorting", () => {
  it("renders sortable column headers with chevron indicator", () => {
    setup({ columns: defaultColumns, data: mockData });
    // Default indicator should be present (ChevronsUpDown)
    const nameHeader = screen.getByText("Nume").closest("th");
    expect(nameHeader).toHaveClass("cursor-pointer");
  });

  it("sorts by column when header is clicked", async () => {
    const { user } = setup({ columns: defaultColumns, data: mockData });
    const nameHeader = screen.getByText("Nume");

    await user.click(nameHeader);

    // After first click, should be sorted ascending (A-Z)
    const rows = screen.getAllByRole("row").slice(1); // skip header
    expect(rows[0]).toHaveTextContent("Alice");
  });

  it("toggles sort direction on repeated clicks", async () => {
    const { user } = setup({ columns: defaultColumns, data: mockData });
    const nameHeader = screen.getByText("Nume");

    // First click: ascending
    await user.click(nameHeader);
    let rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Alice");

    // Second click: descending
    await user.click(nameHeader);
    rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Leo");
  });

  it("does not sort when sorting disabled", () => {
    setup({
      columns: defaultColumns,
      data: mockData,
      enableSorting: false,
    });
    const nameHeader = screen.getByText("Nume").closest("th");
    expect(nameHeader).not.toHaveClass("cursor-pointer");
  });

  it("handles controlled sorting state", () => {
    const onSortingChange = jest.fn();
    setup({
      columns: defaultColumns,
      data: mockData,
      sorting: [{ id: "name", desc: true }],
      onSortingChange,
    });
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Leo");
  });

  it("calls onSortingChange when sort is toggled", async () => {
    const onSortingChange = jest.fn();
    const { user } = setup({
      columns: defaultColumns,
      data: mockData,
      onSortingChange,
    });
    const nameHeader = screen.getByText("Nume");
    await user.click(nameHeader);
    expect(onSortingChange).toHaveBeenCalled();
  });

  it("supports keyboard interaction for sorting", async () => {
    const { user } = setup({ columns: defaultColumns, data: mockData });
    const nameHeader = screen.getByText("Nume").closest("th")!;
    nameHeader.focus();
    await user.keyboard(" ");
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Alice");
  });
});

// ─── Pagination ─────────────────────────────────────────────────────

describe("Table pagination", () => {
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

  it("navigates to previous page", async () => {
    const { user } = setup({ columns: defaultColumns, data: mockData });
    // Go to page 2 first
    const nextButton = screen.getByLabelText("Pagina următoare");
    await user.click(nextButton);
    // Now go back
    const prevButton = screen.getByLabelText("Pagina anterioară");
    await user.click(prevButton);
    expect(screen.getByText("1–10 din 12")).toBeInTheDocument();
  });

  it("goes to last page", async () => {
    const { user } = setup({ columns: defaultColumns, data: mockData });
    const lastButton = screen.getByLabelText("Ultima pagină");
    await user.click(lastButton);
    expect(screen.getByText("11–12 din 12")).toBeInTheDocument();
  });

  it("goes to first page", async () => {
    const { user } = setup({ columns: defaultColumns, data: mockData });
    // Go to last first
    await user.click(screen.getByLabelText("Ultima pagină"));
    // Go back to first
    await user.click(screen.getByLabelText("Prima pagină"));
    expect(screen.getByText("1–10 din 12")).toBeInTheDocument();
  });

  it("disables first/prev buttons on first page", () => {
    setup({ columns: defaultColumns, data: mockData });
    expect(screen.getByLabelText("Prima pagină")).toBeDisabled();
    expect(screen.getByLabelText("Pagina anterioară")).toBeDisabled();
  });

  it("highlights active page number", () => {
    setup({ columns: defaultColumns, data: mockData });
    const pageOne = screen.getByLabelText("Pagina 1");
    expect(pageOne).toHaveAttribute("aria-current", "page");
  });

  it("hides pagination when disabled", () => {
    setup({
      columns: defaultColumns,
      data: mockData,
      enablePagination: false,
    });
    expect(screen.queryByText("din")).not.toBeInTheDocument();
  });

  it("supports page size selector", async () => {
    const { user } = setup({ columns: defaultColumns, data: mockData });
    const selector = screen.getByRole("combobox");
    expect(selector).toBeInTheDocument();
    await user.selectOptions(selector, "20");
    expect(screen.getByText("1–12 din 12")).toBeInTheDocument();
  });

  it("handles controlled pagination state", () => {
    setup({
      columns: defaultColumns,
      data: mockData,
      pagination: { pageIndex: 1, pageSize: 10 },
    });
    expect(screen.getByText("11–12 din 12")).toBeInTheDocument();
  });

  it("calls onPaginationChange when page changes", async () => {
    const onPaginationChange = jest.fn();
    const { user } = setup({
      columns: defaultColumns,
      data: mockData,
      onPaginationChange,
    });
    await user.click(screen.getByLabelText("Pagina următoare"));
    expect(onPaginationChange).toHaveBeenCalled();
  });

  it("shows correct count for single page", () => {
    setup({
      columns: defaultColumns,
      data: mockData.slice(0, 5),
      pageSizeOptions: [10],
    });
    expect(screen.getByText("1–5 din 5")).toBeInTheDocument();
  });

  it("shows zero state info when no results", () => {
    setup({ columns: defaultColumns, data: [] });
    const paginationArea = document.querySelector(".border-t");
    if (paginationArea) {
      expect(paginationArea).toHaveTextContent("Niciun rezultat");
    }
  });
});

// ─── Row Selection ──────────────────────────────────────────────────

describe("Table row selection", () => {
  it("shows selection checkboxes when enabled", () => {
    setup({ columns: defaultColumns, data: mockData, enableSelection: true });
    const selectAll = screen.getByLabelText("Selectează toate");
    expect(selectAll).toBeInTheDocument();
  });

  it("does not show checkboxes when selection disabled", () => {
    setup({ columns: defaultColumns, data: mockData });
    expect(screen.queryByLabelText("Selectează toate")).not.toBeInTheDocument();
  });

  it("selects individual row", async () => {
    const { user } = setup({
      columns: defaultColumns,
      data: mockData,
      enableSelection: true,
    });
    const rowCheckbox = screen.getByLabelText("Selectează rândul 1");
    await user.click(rowCheckbox);
    expect(rowCheckbox).toHaveAttribute("aria-checked", "true");
  });

  it("selects all rows via header checkbox", async () => {
    const { user } = setup({
      columns: defaultColumns,
      data: mockData,
      enableSelection: true,
    });
    const selectAll = screen.getByLabelText("Selectează toate");
    await user.click(selectAll);
    expect(selectAll).toHaveAttribute("aria-checked", "true");
  });

  it("shows indeterminate state when some rows selected", async () => {
    const { user } = setup({
      columns: defaultColumns,
      data: mockData,
      enableSelection: true,
    });
    // Select one row
    await user.click(screen.getByLabelText("Selectează rândul 1"));
    const selectAll = screen.getByLabelText("Selectează toate");
    expect(selectAll).toHaveAttribute("aria-checked", "mixed");
  });

  it("deselects all via header checkbox", async () => {
    const { user } = setup({
      columns: defaultColumns,
      data: mockData,
      enableSelection: true,
    });
    const selectAll = screen.getByLabelText("Selectează toate");
    // Select all
    await user.click(selectAll);
    // Deselect all
    await user.click(selectAll);
    expect(selectAll).toHaveAttribute("aria-checked", "false");
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

  it("applies selected styling to row", async () => {
    const { user } = setup({
      columns: defaultColumns,
      data: mockData,
      enableSelection: true,
    });
    await user.click(screen.getByLabelText("Selectează rândul 1"));
    const row = screen.getByLabelText("Selectează rândul 1").closest("tr");
    expect(row).toHaveAttribute("data-state", "selected");
    expect(row).toHaveAttribute("aria-selected", "true");
  });

  it("handles controlled row selection", () => {
    setup({
      columns: defaultColumns,
      data: mockData,
      enableSelection: true,
      rowSelection: { "1": true, "3": true },
    });
    expect(screen.getByLabelText("Selectează toate")).toHaveAttribute(
      "aria-checked",
      "mixed",
    );
  });

  it("does not trigger row click when clicking checkbox", async () => {
    const onRowClick = jest.fn();
    const { user } = setup({
      columns: defaultColumns,
      data: mockData,
      enableSelection: true,
      onRowClick,
    });
    await user.click(screen.getByLabelText("Selectează rândul 1"));
    expect(onRowClick).not.toHaveBeenCalled();
  });
});

// ─── Expandable Rows ────────────────────────────────────────────────

describe("Table expandable rows", () => {
  const expandColumns: ColumnDef<TestUser>[] = [
    ...defaultColumns,
  ];

  const expandedContent = (row: { original: TestUser }) => (
    <div data-testid="expanded-content">
      Detalii: {row.original.name} - {row.original.email}
    </div>
  );

  it("shows expand buttons when enabled", () => {
    setup({
      columns: expandColumns,
      data: mockData.slice(0, 3),
      enableExpand: true,
      expandedContent,
    });
    const expandButtons = screen.getAllByLabelText("Extinde rândul");
    expect(expandButtons.length).toBe(3);
  });

  it("expands row when expand button clicked", async () => {
    const { user } = setup({
      columns: expandColumns,
      data: mockData.slice(0, 3),
      enableExpand: true,
      expandedContent,
    });
    const expandBtn = screen.getAllByLabelText("Extinde rândul")[0]!;
    await user.click(expandBtn);
    expect(screen.getByTestId("expanded-content")).toBeInTheDocument();
    expect(screen.getByText(/Detalii: Alice/)).toBeInTheDocument();
  });

  it("toggles expand button label", async () => {
    const { user } = setup({
      columns: expandColumns,
      data: mockData.slice(0, 3),
      enableExpand: true,
      expandedContent,
    });
    const expandBtn = screen.getAllByLabelText("Extinde rândul")[0]!;
    await user.click(expandBtn);
    expect(screen.getByLabelText("Restrânge rândul")).toBeInTheDocument();
  });

  it("expands multiple rows independently", async () => {
    const { user } = setup({
      columns: expandColumns,
      data: mockData.slice(0, 3),
      enableExpand: true,
      expandedContent,
    });
    const buttons = screen.getAllByLabelText("Extinde rândul");
    await user.click(buttons[0]!);
    await user.click(buttons[1]!);
    const contents = screen.getAllByTestId("expanded-content");
    expect(contents.length).toBe(2);
  });

  it("does not expand when expand disabled", () => {
    setup({
      columns: expandColumns,
      data: mockData.slice(0, 3),
    });
    expect(screen.queryByLabelText("Extinde rândul")).not.toBeInTheDocument();
  });

  it("shows expanded row background", async () => {
    const { user } = setup({
      columns: expandColumns,
      data: mockData.slice(0, 3),
      enableExpand: true,
      expandedContent,
    });
    await user.click(screen.getAllByLabelText("Extinde rândul")[0]!);
    const expandedRow = screen.getByLabelText("Restrânge rândul").closest("tr");
    expect(expandedRow).toHaveAttribute("aria-expanded", "true");
  });

  it("calls onExpandedChange", async () => {
    const onExpandedChange = jest.fn();
    const { user } = setup({
      columns: expandColumns,
      data: mockData.slice(0, 3),
      enableExpand: true,
      expandedContent,
      onExpandedChange,
    });
    await user.click(screen.getAllByLabelText("Extinde rândul")[0]!);
    expect(onExpandedChange).toHaveBeenCalled();
  });

  it("handles controlled expanded state", () => {
    setup({
      columns: expandColumns,
      data: mockData.slice(0, 3),
      enableExpand: true,
      expandedContent,
      expanded: { "0": true },
    });
    expect(screen.getByTestId("expanded-content")).toBeInTheDocument();
  });

  it("does not trigger row click when clicking expand button", async () => {
    const onRowClick = jest.fn();
    const { user } = setup({
      columns: expandColumns,
      data: mockData.slice(0, 3),
      enableExpand: true,
      expandedContent,
      onRowClick,
    });
    await user.click(screen.getAllByLabelText("Extinde rândul")[0]!);
    expect(onRowClick).not.toHaveBeenCalled();
  });
});

// ─── Row Click ──────────────────────────────────────────────────────

describe("Table row click", () => {
  it("calls onRowClick when row is clicked", async () => {
    const onRowClick = jest.fn();
    const { user } = setup({
      columns: defaultColumns,
      data: mockData,
      onRowClick,
    });
    const row = screen.getByText("Alice").closest("tr")!;
    await user.click(row);
    expect(onRowClick).toHaveBeenCalledTimes(1);
  });

  it("passes row data to onRowClick", async () => {
    let clickedRow: unknown = null;
    const onRowClick = jest.fn((row) => {
      clickedRow = row;
    });
    const { user } = setup({
      columns: defaultColumns,
      data: mockData,
      onRowClick,
    });
    await user.click(screen.getByText("Alice").closest("tr")!);
    expect(onRowClick).toHaveBeenCalled();
    expect((clickedRow as { original: TestUser })?.original?.name).toBe("Alice");
  });

  it("applies cursor-pointer when onRowClick is provided", () => {
    setup({ columns: defaultColumns, data: mockData, onRowClick: jest.fn() });
    const row = screen.getByText("Alice").closest("tr")!;
    expect(row).toHaveClass("cursor-pointer");
  });
});

// ─── Sticky Header ──────────────────────────────────────────────────

describe("Table sticky header", () => {
  it("applies sticky styles by default", () => {
    setup({ columns: defaultColumns, data: mockData });
    const thead = document.querySelector("thead");
    expect(thead).toHaveClass("sticky");
    expect(thead).toHaveClass("top-0");
  });

  it("disables sticky header when stickyHeader=false", () => {
    setup({ columns: defaultColumns, data: mockData, stickyHeader: false });
    const thead = document.querySelector("thead");
    // When stickyHeader is false, it shouldn't have the shadow class
    expect(thead).not.toHaveClass("shadow-elevation-1");
  });
});

// ─── Responsive ─────────────────────────────────────────────────────

describe("Table responsive", () => {
  it("renders overflow-x-auto container for horizontal scroll", () => {
    setup({ columns: defaultColumns, data: mockData });
    const container = document.querySelector(".overflow-x-auto");
    expect(container).toBeInTheDocument();
  });

  it("maintains table structure in container", () => {
    setup({ columns: defaultColumns, data: mockData });
    const table = screen.getByRole("table");
    expect(table.closest(".overflow-x-auto")).toBeInTheDocument();
  });
});

// ─── Full Width ─────────────────────────────────────────────────────

describe("Table fullWidth", () => {
  it("applies full width by default", () => {
    setup({ columns: defaultColumns, data: mockData });
    const region = screen.getByRole("region");
    expect(region).toHaveClass("w-full");
  });

  it("does not force full width when fullWidth=false", () => {
    setup({ columns: defaultColumns, data: mockData, fullWidth: false });
    const region = screen.getByRole("region");
    expect(region).not.toHaveClass("w-full");
  });
});

// ─── Accessibility ──────────────────────────────────────────────────

describe("Table accessibility", () => {
  it("has correct aria roles", () => {
    setup({ columns: defaultColumns, data: mockData });
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("region")).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBeGreaterThan(0);
  });

  it("column headers have appropriate aria-sort", async () => {
    const { user } = setup({ columns: defaultColumns, data: mockData });
    const nameHeader = screen.getByText("Nume").closest("th")!;
    await user.click(nameHeader);
    expect(nameHeader).toHaveAttribute("aria-sort", "ascending");
  });

  it("sticky header has correct z-index", () => {
    setup({ columns: defaultColumns, data: mockData });
    const thead = document.querySelector("thead");
    expect(thead).toHaveClass("z-sticky");
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────

describe("Table edge cases", () => {
  it("handles single row of data", () => {
    setup({
      columns: defaultColumns,
      data: [mockData[0]!],
    });
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("handles data without optional fields", () => {
    const sparseData: TestUser[] = [
      { id: "1", name: "Test", email: "test@test.com", role: "User", status: "active" },
    ];
    setup({ columns: defaultColumns, data: sparseData });
    expect(screen.getByText("Test")).toBeInTheDocument();
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
    setup({
      columns: defaultColumns,
      data: mockData,
      tableClassName: "custom-table-class",
    });
    const table = screen.getByRole("table");
    expect(table).toHaveClass("custom-table-class");
  });

  it("handles empty columns gracefully", () => {
    setup({ columns: [], data: [] });
    expect(screen.getByRole("table")).toBeInTheDocument();
  });
});

// ─── Manual/Server-side Pagination ──────────────────────────────────

describe("Table manual pagination", () => {
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

describe("Table variant exports", () => {
  it("exports tableWrapperVariants", () => {
    expect(tableWrapperVariants).toBeDefined();
    expect(typeof tableWrapperVariants).toBe("function");
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

describe("Table hover", () => {
  it("applies hover styles by default", () => {
    setup({ columns: defaultColumns, data: mockData });
    const row = screen.getByText("Alice").closest("tr")!;
    expect(row).toHaveClass("hover:bg-surface-secondary");
  });

  it("disables hover when enableHover=false", () => {
    setup({ columns: defaultColumns, data: mockData, enableHover: false });
    const row = screen.getByText("Alice").closest("tr")!;
    expect(row).not.toHaveClass("hover:bg-surface-secondary");
  });
});

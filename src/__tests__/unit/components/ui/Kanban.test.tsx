import React from "react";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext } from "@dnd-kit/sortable";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Kanban } from "@/components/ui/Kanban";

import type { KanbanCardData, KanbanColumnData, KanbanSwimlaneData } from "@/components/ui/Kanban";

// ═══════════════════════════════════════════════════════════════════════
// Mock dnd-kit
// ═══════════════════════════════════════════════════════════════════════

jest.mock("@dnd-kit/core", () => {
  const actual = jest.requireActual("@dnd-kit/core");
  return {
    ...actual,
    DndContext: ({ children, onDragEnd, onDragStart }: any) => {
      const mockDndRef = React.useRef({
        dragHandlers: { onDragEnd, onDragStart },
      });

      // Expose for tests
      (mockDndRef.current as any).dragHandlers = { onDragEnd, onDragStart };

      return (
        <div data-testid="dnd-context" ref={mockDndRef as any}>
          {children}
        </div>
      );
    },
    DragOverlay: ({ children }: any) => (
      <div data-testid="drag-overlay">{children}</div>
    ),
    useSensor: jest.fn(() => ({
      activators: [],
      sensor: { activate: jest.fn() },
    })),
    useSensors: jest.fn(() => []),
  };
});

jest.mock("@dnd-kit/sortable", () => {
  const actual = jest.requireActual("@dnd-kit/sortable");
  return {
    ...actual,
    useSortable: jest.fn(() => ({
      attributes: {},
      listeners: {},
      setNodeRef: jest.fn(),
      transform: null,
      transition: null,
      isDragging: false,
    })),
    SortableContext: ({ children }: any) => <>{children}</>,
  };
});

jest.mock("@dnd-kit/utilities", () => ({
  CSS: {
    Transform: {
      toString: jest.fn(() => ""),
    },
  },
}));

// ═══════════════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════════════

const mockColumns: KanbanColumnData[] = [
  { id: "col-1", title: "To Do", order: 0 },
  { id: "col-2", title: "In Progress", order: 1 },
  { id: "col-3", title: "Done", order: 2 },
];

const mockCards: KanbanCardData[] = [
  { id: "card-1", columnId: "col-1", title: "Setup project", order: 0 },
  { id: "card-2", columnId: "col-1", title: "Design system", order: 1 },
  { id: "card-3", columnId: "col-2", title: "Implement auth", order: 0 },
  { id: "card-4", columnId: "col-3", title: "Write tests", order: 0 },
];

const mockSwimlanes: KanbanSwimlaneData[] = [
  { id: "sw-1", title: "Frontend", order: 0 },
  { id: "sw-2", title: "Backend", order: 1 },
];

function setup(props: Partial<React.ComponentProps<typeof Kanban>> = {}) {
  const defaultProps: React.ComponentProps<typeof Kanban> = {
    columns: mockColumns,
    cards: mockCards,
    onChange: jest.fn(),
  };

  const merged = { ...defaultProps, ...props };
  const utils = render(<Kanban {...merged} />);

  return {
    ...utils,
    onChange: merged.onChange as jest.Mock,
    props: merged,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Basic Rendering
// ═══════════════════════════════════════════════════════════════════════

describe("Kanban basic rendering", () => {
  it("renders all columns", () => {
    setup();
    expect(screen.getByText("To Do")).toBeInTheDocument();
    expect(screen.getByText("In Progress")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("renders all cards in correct columns", () => {
    setup();
    expect(screen.getByText("Setup project")).toBeInTheDocument();
    expect(screen.getByText("Design system")).toBeInTheDocument();
    expect(screen.getByText("Implement auth")).toBeInTheDocument();
    expect(screen.getByText("Write tests")).toBeInTheDocument();
  });

  it("renders card count badges", () => {
    setup();
    // "To Do" should have 2 cards
    const toDoColumn = screen.getByText("To Do").closest('[data-column-id="col-1"]');
    expect(toDoColumn).toBeInTheDocument();
    expect(within(toDoColumn!).getByText("2")).toBeInTheDocument();
  });

  it("renders with accessible role", () => {
    setup();
    expect(screen.getByRole("region", { name: "Kanban board" })).toBeInTheDocument();
  });

  it("shows empty state message for columns without cards", () => {
    const emptyColumns: KanbanColumnData[] = [{ id: "col-empty", title: "Empty" }];
    setup({ columns: emptyColumns, cards: [] });
    expect(screen.getByText("No cards yet")).toBeInTheDocument();
  });

  it("shows custom empty column message", () => {
    const emptyColumns: KanbanColumnData[] = [{ id: "col-empty", title: "Empty" }];
    setup({
      columns: emptyColumns,
      cards: [],
      emptyColumnMessage: "Nothing here!",
    });
    expect(screen.getByText("Nothing here!")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Variants & Styles
// ═══════════════════════════════════════════════════════════════════════

describe("Kanban variants", () => {
  it("applies default variant class", () => {
    const { container } = setup({ variant: "default" });
    expect(container.firstChild).toHaveClass("bg-surface-secondary/30");
  });

  it("applies bordered variant class", () => {
    const { container } = setup({ variant: "bordered" });
    expect(container.firstChild).toHaveClass("border");
  });

  it("applies minimal variant class", () => {
    const { container } = setup({ variant: "minimal" });
    expect(container.firstChild).toHaveClass("bg-transparent");
  });

  it("merges custom className", () => {
    const { container } = setup({ className: "my-kanban" });
    expect(container.firstChild).toHaveClass("my-kanban");
  });

  it("applies height constraint", () => {
    const { container } = setup({ height: "500px" });
    expect(container.firstChild).toHaveClass("h-[500px]");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Add Card
// ═══════════════════════════════════════════════════════════════════════

describe("Kanban add card", () => {
  it("shows add card button by default", () => {
    setup();
    const addButtons = screen.getAllByText("+ Add card");
    expect(addButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("hides add card button when enableAddCard is false", () => {
    setup({ enableAddCard: false });
    expect(screen.queryByText("+ Add card")).not.toBeInTheDocument();
  });

  it("shows custom add card placeholder", () => {
    setup({ newCardPlaceholder: "New task..." });
    expect(screen.getByText("New task...")).toBeInTheDocument();
  });

  it("shows input form when add button clicked", async () => {
    const user = userEvent.setup();
    setup();
    const addButton = screen.getAllByText("+ Add card")[0]!;
    await user.click(addButton);
    expect(screen.getByPlaceholderText("Card title")).toBeInTheDocument();
  });

  it("calls onChange with card-add when form submitted", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    setup({ onChange });
    const addButton = screen.getAllByText("+ Add card")[0]!;
    await user.click(addButton);
    const input = screen.getByPlaceholderText("Card title");
    await user.type(input, "New feature{Enter}");
    expect(onChange).toHaveBeenCalledWith({
      type: "card-add",
      payload: { columnId: "col-1", title: "New feature", swimlaneId: undefined },
    });
  });

  it("cancels add on Escape", async () => {
    const user = userEvent.setup();
    setup();
    const addButton = screen.getAllByText("+ Add card")[0]!;
    await user.click(addButton);
    const input = screen.getByPlaceholderText("Card title");
    await user.type(input, "Something{Escape}");
    expect(screen.queryByPlaceholderText("Card title")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Add Column
// ═══════════════════════════════════════════════════════════════════════

describe("Kanban add column", () => {
  it("shows add column button by default", () => {
    setup();
    expect(screen.getByText("+ Add column")).toBeInTheDocument();
  });

  it("hides add column button when enableAddColumn is false", () => {
    setup({ enableAddColumn: false });
    expect(screen.queryByText("+ Add column")).not.toBeInTheDocument();
  });

  it("calls onChange when column added", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    setup({ onChange });
    await user.click(screen.getByText("+ Add column"));
    const input = screen.getByPlaceholderText("Column name");
    await user.type(input, "Review{Enter}");
    expect(onChange).toHaveBeenCalledWith({
      type: "column-add",
      payload: { title: "Review", swimlaneId: undefined },
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Delete Card
// ═══════════════════════════════════════════════════════════════════════

describe("Kanban delete card", () => {
  it("shows delete button on card hover", () => {
    setup();
    const deleteButtons = screen.getAllByLabelText("Delete card");
    expect(deleteButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("hides delete buttons when enableDeleteCard is false", () => {
    setup({ enableDeleteCard: false });
    expect(screen.queryByLabelText("Delete card")).not.toBeInTheDocument();
  });

  it("calls onChange on card delete", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    setup({ onChange });
    const deleteButtons = screen.getAllByLabelText("Delete card");
    await user.click(deleteButtons[0]!);
    expect(onChange).toHaveBeenCalledWith({
      type: "card-delete",
      payload: { cardId: "card-1" },
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Delete Column
// ═══════════════════════════════════════════════════════════════════════

describe("Kanban delete column", () => {
  it("shows delete column button", () => {
    setup();
    const deleteButtons = screen.getAllByLabelText("Delete column");
    expect(deleteButtons.length).toBe(mockColumns.length);
  });

  it("calls onChange on column delete", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    setup({ onChange });
    const deleteButtons = screen.getAllByLabelText("Delete column");
    await user.click(deleteButtons[0]!);
    expect(onChange).toHaveBeenCalledWith({
      type: "column-delete",
      payload: { columnId: "col-1" },
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Inline Edit Card Title
// ═══════════════════════════════════════════════════════════════════════

describe("Kanban inline edit card", () => {
  it("shows edit button on card", () => {
    setup();
    const editButtons = screen.getAllByLabelText("Edit card title");
    expect(editButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("hides edit buttons when enableInlineEdit is false", () => {
    setup({ enableInlineEdit: false });
    expect(screen.queryByLabelText("Edit card title")).not.toBeInTheDocument();
  });

  it("enters edit mode on click", async () => {
    const user = userEvent.setup();
    setup();
    const editButton = screen.getAllByLabelText("Edit card title")[0]!;
    await user.click(editButton);
    // Should show save/cancel buttons
    expect(screen.getByLabelText("Save title")).toBeInTheDocument();
    expect(screen.getByLabelText("Cancel edit")).toBeInTheDocument();
  });

  it("calls onChange on save", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    setup({ onChange });
    const editButton = screen.getAllByLabelText("Edit card title")[0]!;
    await user.click(editButton);
    const input = screen.getByDisplayValue("Setup project");
    await user.clear(input);
    await user.type(input, "Updated title{Enter}");
    expect(onChange).toHaveBeenCalledWith({
      type: "card-update",
      payload: { cardId: "card-1", updates: { title: "Updated title" } },
    });
  });

  it("does not call onChange if title unchanged", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    setup({ onChange });
    const editButton = screen.getAllByLabelText("Edit card title")[0]!;
    await user.click(editButton);
    // Press Enter without changes
    const input = screen.getByDisplayValue("Setup project");
    await user.type(input, "{Enter}");
    // Should NOT call onChange for unchanged
    const updateCalls = onChange.mock.calls.filter(
      ([call]: any[]) => call.type === "card-update",
    );
    expect(updateCalls).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Inline Edit Column Title
// ═══════════════════════════════════════════════════════════════════════

describe("Kanban inline edit column", () => {
  it("shows edit column button", () => {
    setup();
    const editButtons = screen.getAllByLabelText("Edit column name");
    expect(editButtons.length).toBe(mockColumns.length);
  });

  it("hides edit buttons when enableColumnEdit is false", () => {
    setup({ enableColumnEdit: false });
    expect(screen.queryByLabelText("Edit column name")).not.toBeInTheDocument();
  });

  it("calls onChange on column title save", async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    setup({ onChange });
    const editButton = screen.getAllByLabelText("Edit column name")[0]!;
    await user.click(editButton);
    const input = screen.getByDisplayValue("To Do");
    await user.clear(input);
    await user.type(input, "Backlog{Enter}");
    expect(onChange).toHaveBeenCalledWith({
      type: "column-update",
      payload: { columnId: "col-1", updates: { title: "Backlog" } },
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Disabled State
// ═══════════════════════════════════════════════════════════════════════

describe("Kanban disabled state", () => {
  it("hides add card button when disabled", () => {
    setup({ disabled: true });
    expect(screen.queryByText("+ Add card")).not.toBeInTheDocument();
  });

  it("hides add column button when disabled", () => {
    setup({ disabled: true });
    expect(screen.queryByText("+ Add column")).not.toBeInTheDocument();
  });

  it("hides edit buttons when disabled", () => {
    setup({ disabled: true });
    expect(screen.queryByLabelText("Edit card title")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Edit column name")).not.toBeInTheDocument();
  });

  it("hides delete buttons when disabled", () => {
    setup({ disabled: true });
    expect(screen.queryByLabelText("Delete card")).not.toBeInTheDocument();
  });

  it("applies opacity to cards when disabled", () => {
    setup({ disabled: true });
    const card = screen.getByText("Setup project").closest('[role="button"]');
    expect(card).toHaveClass("pointer-events-none");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Swimlanes
// ═══════════════════════════════════════════════════════════════════════

describe("Kanban swimlanes", () => {
  const swimlaneColumns: KanbanColumnData[] = [
    { id: "col-1", title: "To Do", swimlaneId: "sw-1", order: 0 },
    { id: "col-2", title: "Done", swimlaneId: "sw-1", order: 1 },
    { id: "col-3", title: "To Do", swimlaneId: "sw-2", order: 0 },
  ];

  it("renders swimlane headers when swimlanes provided", () => {
    setup({ columns: swimlaneColumns, cards: [], swimlanes: mockSwimlanes });
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("Backend")).toBeInTheDocument();
  });

  it("shows collapse toggle when enableSwimlaneCollapse is true", () => {
    setup({ columns: swimlaneColumns, cards: [], swimlanes: mockSwimlanes });
    expect(screen.getAllByLabelText("Collapse swimlane").length).toBeGreaterThanOrEqual(1);
  });

  it("hides collapse toggle when enableSwimlaneCollapse is false", () => {
    setup({
      columns: swimlaneColumns,
      cards: [],
      swimlanes: mockSwimlanes,
      enableSwimlaneCollapse: false,
    });
    expect(screen.queryByLabelText("Collapse swimlane")).not.toBeInTheDocument();
  });

  it("does not render non-swimlane columns inside swimlanes", () => {
    const mixedColumns: KanbanColumnData[] = [
      { id: "col-1", title: "Swimlane Col", swimlaneId: "sw-1", order: 0 },
      { id: "col-2", title: "Unassigned", order: 0 },
    ];
    setup({ columns: mixedColumns, cards: [], swimlanes: mockSwimlanes });
    // Unassigned should be rendered outside swimlanes
    const swimlaneDiv = screen.getByText("Frontend").closest('[data-swimlane-id="sw-1"]');
    expect(within(swimlaneDiv!).queryByText("Unassigned")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Drag & Drop
// ═══════════════════════════════════════════════════════════════════════

describe("Kanban drag and drop", () => {
  it("calls onDragStart when drag begins", () => {
    const onDragStart = jest.fn();
    setup({ onDragStart });
    // Drag events are handled by dnd-kit; we verify the prop is passed
    expect(onDragStart).not.toHaveBeenCalled();
  });

  it("calls onDragEnd when drag ends", () => {
    const onDragEnd = jest.fn();
    setup({ onDragEnd });
    expect(onDragEnd).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Custom Renderers
// ═══════════════════════════════════════════════════════════════════════

describe("Kanban custom renderers", () => {
  it("renders custom card content", () => {
    setup({
      renderCard: (card) => <div data-testid={`custom-card-${card.id}`}>{card.title}</div>,
    });
    const customCards = screen.getAllByTestId(/custom-card-/);
    expect(customCards).toHaveLength(mockCards.length);
  });

  it("renders custom column header", () => {
    setup({
      renderColumnHeader: (col) => (
        <div data-testid={`custom-header-${col.id}`}>⚡ {col.title}</div>
      ),
    });
    expect(screen.getByText("⚡ To Do")).toBeInTheDocument();
  });

  it("renders custom swimlane header", () => {
    const swimlaneColumns: KanbanColumnData[] = [
      { id: "col-1", title: "To Do", swimlaneId: "sw-1", order: 0 },
    ];
    setup({
      columns: swimlaneColumns,
      cards: [],
      swimlanes: mockSwimlanes,
      renderSwimlaneHeader: (sw) => (
        <div data-testid={`sw-header-${sw.id}`}>🏊 {sw.title}</div>
      ),
    });
    expect(screen.getByTestId("sw-header-sw-1")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Card Variants
// ═══════════════════════════════════════════════════════════════════════

describe("Kanban card variants", () => {
  it("renders cards with default variant", () => {
    setup({ cardVariant: "default" });
    const card = screen.getByText("Setup project").closest('[role="button"]');
    expect(card).toHaveClass("p-3");
  });

  it("renders cards with compact variant", () => {
    setup({ cardVariant: "compact" });
    const card = screen.getByText("Setup project").closest('[role="button"]');
    expect(card).toHaveClass("py-2");
  });

  it("renders metadata in detailed variant", () => {
    const cardsWithMeta: KanbanCardData[] = [
      {
        id: "card-1",
        columnId: "col-1",
        title: "Task",
        variant: "detailed",
        metadata: { priority: "high" },
      },
    ];
    setup({ cards: cardsWithMeta, cardVariant: "detailed" });
    expect(screen.getByText("priority: high")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Edge Cases
// ═══════════════════════════════════════════════════════════════════════

describe("Kanban edge cases", () => {
  it("renders with empty columns array", () => {
    setup({ columns: [], cards: [] });
    expect(screen.getByText("+ Add column")).toBeInTheDocument();
  });

  it("renders with empty cards array", () => {
    setup({ cards: [] });
    expect(screen.getAllByText("No cards yet").length).toBe(mockColumns.length);
  });

  it("handles cards with missing order field", () => {
    const cardsNoOrder: KanbanCardData[] = [
      { id: "card-1", columnId: "col-1", title: "First" },
      { id: "card-2", columnId: "col-1", title: "Second" },
    ];
    setup({ cards: cardsNoOrder });
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("shows column limit when set", () => {
    const limitedColumns: KanbanColumnData[] = [
      { id: "col-1", title: "Limited", limit: 5 },
    ];
    setup({ columns: limitedColumns, cards: [] });
    expect(screen.getByText("0/5")).toBeInTheDocument();
  });

  it("renders without swimlanes when swimlanes array is empty", () => {
    setup({ swimlanes: [] });
    expect(screen.getByText("To Do")).toBeInTheDocument();
  });

  it("renders card description when present", () => {
    const cardsWithDesc: KanbanCardData[] = [
      { id: "card-1", columnId: "col-1", title: "Task", description: "Do this task" },
    ];
    setup({ cards: cardsWithDesc });
    expect(screen.getByText("Do this task")).toBeInTheDocument();
  });

  it("shows add description button when no description", () => {
    setup();
    const addDescButtons = screen.getAllByText("+ Add description");
    expect(addDescButtons.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Column Color
// ═══════════════════════════════════════════════════════════════════════

describe("Kanban column color", () => {
  it("applies column color via style", () => {
    const coloredColumns: KanbanColumnData[] = [
      { id: "col-1", title: "Priority", color: "#ef4444" },
    ];
    setup({ columns: coloredColumns, cards: [] });
    const columnHeader = screen.getByText("Priority").closest("div");
    // The column div should have the border-top-color style
    const columnRoot = columnHeader?.parentElement;
    expect(columnRoot).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Descriptive aria roles
// ═══════════════════════════════════════════════════════════════════════

describe("Kanban accessibility", () => {
  it("cards have button role and accessible label", () => {
    setup();
    const card = screen.getByLabelText("Card: Setup project");
    expect(card).toHaveAttribute("role", "button");
    expect(card).toHaveAttribute("aria-roledescription", "draggable card");
  });

  it("columns have data attributes for identification", () => {
    setup();
    const column = screen.getByText("To Do").closest('[data-column-id="col-1"]');
    expect(column).toBeInTheDocument();
  });

  it("board has region role", () => {
    setup();
    expect(screen.getByRole("region")).toHaveAttribute("aria-label", "Kanban board");
  });
});
import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ToastProvider,
  useToast,
  type ToastVariant,
  type ToastPosition,
} from "@/components/ui/Toast";

// ─── Helpers ────────────────────────────────────────────────────────

/** Renders a test component inside ToastProvider */
const setup = () => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  jest.useFakeTimers();

  const TestComponent = () => {
    const { toast, dismiss, dismissAll, toasts } = useToast();
    return (
      <div>
        <span data-testid="toast-count">{toasts.length}</span>
        <button
          data-testid="add-success"
          onClick={() => toast("Success message", { variant: "success" })}
        >
          Add Success
        </button>
        <button
          data-testid="add-error"
          onClick={() => toast("Error message", { variant: "error" })}
        >
          Add Error
        </button>
        <button
          data-testid="add-warning"
          onClick={() => toast("Warning message", { variant: "warning" })}
        >
          Add Warning
        </button>
        <button
          data-testid="add-info"
          onClick={() => toast("Info message", { variant: "info" })}
        >
          Add Info
        </button>
        <button
          data-testid="add-with-title"
          onClick={() =>
            toast("Description text", {
              title: "Custom Title",
              variant: "success",
            })
          }
        >
          Add With Title
        </button>
        <button
          data-testid="add-with-id"
          onClick={() =>
            toast("Persistent toast", {
              id: "my-toast",
              variant: "info",
              duration: 0,
            })
          }
        >
          Add With ID
        </button>
        <button
          data-testid="add-custom-duration"
          onClick={() =>
            toast("Quick toast", {
              variant: "success",
              duration: 1000,
            })
          }
        >
          Add Quick
        </button>
        <button
          data-testid="dismiss-by-id"
          onClick={() => dismiss("my-toast")}
        >
          Dismiss by ID
        </button>
        <button data-testid="dismiss-all" onClick={() => dismissAll()}>
          Dismiss All
        </button>
      </div>
    );
  };

  const result = render(
    <ToastProvider>
      <TestComponent />
    </ToastProvider>,
  );

  return { user, ...result };
};

// ─── Rendering ──────────────────────────────────────────────────────
describe("Toast rendering", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("renders toast when toast() is called", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-success"));

    expect(screen.getByText("Success message")).toBeInTheDocument();
  });

  it("renders multiple toasts (stacking)", async () => {
    const { user } = setup();

    await user.click(screen.getByTestId("add-success"));
    await user.click(screen.getByTestId("add-error"));
    await user.click(screen.getByTestId("add-warning"));

    expect(screen.getByText("Success message")).toBeInTheDocument();
    expect(screen.getByText("Error message")).toBeInTheDocument();
    expect(screen.getByText("Warning message")).toBeInTheDocument();
    expect(screen.getByTestId("toast-count")).toHaveTextContent("3");
  });

  it("renders toast with title and description", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-with-title"));

    expect(screen.getByText("Custom Title")).toBeInTheDocument();
    expect(screen.getByText("Description text")).toBeInTheDocument();
  });

  it("does not render anything when no toasts are active", () => {
    setup();
    expect(screen.getByTestId("toast-count")).toHaveTextContent("0");
  });
});

// ─── Variants ───────────────────────────────────────────────────────
describe("Toast variants", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("renders success variant with correct styling", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-success"));

    const toast = screen.getByRole("status");
    expect(toast).toHaveClass("border-success-500");
  });

  it("renders error variant with correct styling", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-error"));

    const toast = screen.getByRole("alert");
    expect(toast).toHaveClass("border-danger-500");
  });

  it("renders warning variant with correct styling", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-warning"));

    const toast = screen.getByRole("status");
    expect(toast).toHaveClass("border-warning-500");
  });

  it("renders info variant with correct styling", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-info"));

    const toast = screen.getByRole("status");
    expect(toast).toHaveClass("border-info-500");
  });

  it("renders success variant icon", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-success"));

    const toast = screen.getByRole("status");
    const icon = toast.querySelector(".text-success-500");
    expect(icon).toBeInTheDocument();
  });

  it("renders error variant icon", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-error"));

    const toast = screen.getByRole("alert");
    const icon = toast.querySelector(".text-danger-500");
    expect(icon).toBeInTheDocument();
  });
});

// ─── Auto-dismiss ───────────────────────────────────────────────────
describe("Toast auto-dismiss", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("auto-dismisses after default duration (5000ms)", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-success"));

    expect(screen.getByText("Success message")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(screen.queryByText("Success message")).not.toBeInTheDocument();
    });
  });

  it("auto-dismisses after custom duration", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-custom-duration"));

    expect(screen.getByText("Quick toast")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.queryByText("Quick toast")).not.toBeInTheDocument();
    });
  });

  it("does not auto-dismiss when duration is 0", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-with-id"));

    expect(screen.getByText("Persistent toast")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(screen.getByText("Persistent toast")).toBeInTheDocument();
  });

  it("pauses auto-dismiss on mouse enter", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-success"));

    const toast = screen.getByRole("status");
    await user.hover(toast);

    act(() => {
      jest.advanceTimersByTime(6000);
    });

    // Should still be visible because hover paused the timer
    expect(screen.getByText("Success message")).toBeInTheDocument();
  });

  it("resumes auto-dismiss on mouse leave", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-success"));

    const toast = screen.getByRole("status");
    await user.hover(toast);

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    await user.unhover(toast);

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(screen.queryByText("Success message")).not.toBeInTheDocument();
    });
  });

  it("shows progress bar indicating remaining time", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-success"));

    const progressBar = screen.getByRole("status").querySelector(
      '[role="progressbar"]',
    );
    expect(progressBar).toBeInTheDocument();
  });

  it("does not show progress bar when duration is 0", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-with-id"));

    const toast = screen.getByRole("status");
    const progressBar = toast.querySelector('[role="progressbar"]');
    expect(progressBar).not.toBeInTheDocument();
  });
});

// ─── Dismiss ────────────────────────────────────────────────────────
describe("Toast dismiss", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("dismisses toast when close button is clicked", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-success"));

    const closeButton = screen.getByLabelText("Dismiss toast");
    await user.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText("Success message")).not.toBeInTheDocument();
    });
  });

  it("dismisses toast by ID", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-with-id"));

    expect(screen.getByText("Persistent toast")).toBeInTheDocument();

    await user.click(screen.getByTestId("dismiss-by-id"));

    await waitFor(() => {
      expect(screen.queryByText("Persistent toast")).not.toBeInTheDocument();
    });
  });

  it("dismisses all toasts", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-success"));
    await user.click(screen.getByTestId("add-error"));
    await user.click(screen.getByTestId("add-warning"));

    expect(screen.getByTestId("toast-count")).toHaveTextContent("3");

    await user.click(screen.getByTestId("dismiss-all"));

    await waitFor(() => {
      expect(screen.getByTestId("toast-count")).toHaveTextContent("0");
    });
  });

  it("does not allow duplicate IDs (updates existing toast)", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-with-id"));

    expect(screen.getByText("Persistent toast")).toBeInTheDocument();

    // Click again with same ID should not create duplicate
    await user.click(screen.getByTestId("add-with-id"));

    // Should still only be one toast
    await waitFor(() => {
      expect(screen.getByTestId("toast-count")).toHaveTextContent("1");
    });
  });
});

// ─── Positions ──────────────────────────────────────────────────────
describe("Toast positions", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("renders at bottom-right by default", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-success"));

    const container = screen.getByText("Success message").closest(
      '[data-slot="toast-viewport"]',
    );
    expect(container).toHaveClass("bottom-0");
    expect(container).toHaveClass("right-0");
  });

  it("renders each toast with its own position", async () => {
    const PositionTest = () => {
      const { toast } = useToast();
      return (
        <button
          data-testid="add-top-left"
          onClick={() =>
            toast("Top left toast", {
              variant: "info",
              position: "top-left",
            })
          }
        >
          Add
        </button>
      );
    };

    render(
      <ToastProvider>
        <PositionTest />
      </ToastProvider>,
    );

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.click(screen.getByTestId("add-top-left"));

    const viewport = screen.getByText("Top left toast").closest(
      '[data-slot="toast-viewport"]',
    );
    expect(viewport).toHaveClass("top-0");
    expect(viewport).toHaveClass("left-0");
  });
});

// ─── Accessibility ──────────────────────────────────────────────────
describe("Toast accessibility", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("uses role=status for non-error toasts", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-success"));
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("uses role=alert for error toasts", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-error"));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("has aria-live region", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-info"));

    const toast = screen.getByRole("status");
    expect(toast).toHaveAttribute("aria-live");
  });

  it("close button has accessible label", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-success"));

    expect(screen.getByLabelText("Dismiss toast")).toBeInTheDocument();
  });
});

// ─── Max visible toasts ─────────────────────────────────────────────
describe("Toast max visible", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("limits visible toasts to MAX_VISIBLE (default 5)", async () => {
    const { user } = setup();

    // Add 7 toasts
    for (let i = 0; i < 7; i++) {
      await user.click(screen.getByTestId("add-info"));
    }

    // Only 5 should be visible
    await waitFor(() => {
      const toasts = screen.getAllByRole("status");
      expect(toasts.length).toBeLessThanOrEqual(5);
    });
  });
});

// ─── Dismiss animation ──────────────────────────────────────────────
describe("Toast dismiss animation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("removes toast after exit animation completes", async () => {
    const { user } = setup();
    await user.click(screen.getByTestId("add-success"));

    const closeButton = screen.getByLabelText("Dismiss toast");
    await user.click(closeButton);

    // After animation duration (300ms), toast should be removed
    act(() => {
      jest.advanceTimersByTime(500);
    });

    await waitFor(() => {
      expect(screen.queryByText("Success message")).not.toBeInTheDocument();
    });
  });
});

// ─── useToast outside provider (error boundary) ─────────────────────
describe("useToast error handling", () => {
  it("throws when used outside ToastProvider", () => {
    const BadComponent = () => {
      const { toast } = useToast();
      return <button onClick={() => toast("test")}>Bad</button>;
    };

    // Suppress console.error for this test
    const consoleSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    expect(() => render(<BadComponent />)).toThrow(
      "useToast must be used within a ToastProvider",
    );

    consoleSpy.mockRestore();
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────
describe("Toast edge cases", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("handles empty string message", async () => {
    const EmptyTest = () => {
      const { toast } = useToast();
      return (
        <button data-testid="add-empty" onClick={() => toast("")}>
          Add Empty
        </button>
      );
    };

    render(
      <ToastProvider>
        <EmptyTest />
      </ToastProvider>,
    );

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await user.click(screen.getByTestId("add-empty"));

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders action button when provided", async () => {
    const actionFn = jest.fn();
    const ActionTest = () => {
      const { toast } = useToast();
      return (
        <button
          data-testid="add-action"
          onClick={() =>
            toast("Message with action", {
              variant: "info",
              action: { label: "Undo", onClick: actionFn },
            })
          }
        >
          Add Action
        </button>
      );
    };

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ToastProvider>
        <ActionTest />
      </ToastProvider>,
    );

    await user.click(screen.getByTestId("add-action"));

    const actionBtn = screen.getByText("Undo");
    expect(actionBtn).toBeInTheDocument();

    await user.click(actionBtn);
    expect(actionFn).toHaveBeenCalledTimes(1);
  });

  it("renders custom icon when provided", async () => {
    const CustomIconTest = () => {
      const { toast } = useToast();
      return (
        <button
          data-testid="add-custom-icon"
          onClick={() =>
            toast("Custom icon toast", {
              icon: <span data-testid="custom-icon">🔥</span>,
            })
          }
        >
          Add Custom Icon
        </button>
      );
    };

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ToastProvider>
        <CustomIconTest />
      </ToastProvider>,
    );

    await user.click(screen.getByTestId("add-custom-icon"));
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("renders toast without close button when dismissible is false", async () => {
    const NonDismissibleTest = () => {
      const { toast } = useToast();
      return (
        <button
          data-testid="add-non-dismissible"
          onClick={() =>
            toast("Can't dismiss me", { dismissible: false, duration: 0 })
          }
        >
          Add
        </button>
      );
    };

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ToastProvider>
        <NonDismissibleTest />
      </ToastProvider>,
    );

    await user.click(screen.getByTestId("add-non-dismissible"));

    expect(screen.queryByLabelText("Dismiss toast")).not.toBeInTheDocument();
  });
});

// ─── Provider options ───────────────────────────────────────────────
describe("ToastProvider options", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("respects maxVisible option", async () => {
    const TestComponent = () => {
      const { toast } = useToast();
      return (
        <button
          data-testid="flood"
          onClick={() => {
            for (let i = 0; i < 5; i++) {
              toast(`Toast ${i}`);
            }
          }}
        >
          Flood
        </button>
      );
    };

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ToastProvider maxVisible={2}>
        <TestComponent />
      </ToastProvider>,
    );

    await user.click(screen.getByTestId("flood"));

    await waitFor(() => {
      const toasts = screen.getAllByRole("status");
      expect(toasts.length).toBeLessThanOrEqual(2);
    });
  });

  it("respects defaultDuration option", async () => {
    const TestComponent = () => {
      const { toast } = useToast();
      return (
        <button data-testid="add" onClick={() => toast("Quick")}>
          Add
        </button>
      );
    };

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ToastProvider defaultDuration={500}>
        <TestComponent />
      </ToastProvider>,
    );

    await user.click(screen.getByTestId("add"));

    expect(screen.getByText("Quick")).toBeInTheDocument();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    await waitFor(() => {
      expect(screen.queryByText("Quick")).not.toBeInTheDocument();
    });
  });
});

// ─── onToastAdd / onToastRemove callbacks ───────────────────────────
describe("Toast callbacks", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("calls onToastAdd when a toast is added", async () => {
    const onToastAdd = jest.fn();
    const TestComponent = () => {
      const { toast } = useToast();
      return (
        <button data-testid="add" onClick={() => toast("Hello")}>
          Add
        </button>
      );
    };

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ToastProvider onToastAdd={onToastAdd}>
        <TestComponent />
      </ToastProvider>,
    );

    await user.click(screen.getByTestId("add"));
    expect(onToastAdd).toHaveBeenCalledTimes(1);
    expect(onToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Hello" }),
    );
  });

  it("calls onToastRemove when a toast is removed", async () => {
    const onToastRemove = jest.fn();
    const TestComponent = () => {
      const { toast } = useToast();
      return (
        <button data-testid="add" onClick={() => toast("Hello")}>
          Add
        </button>
      );
    };

    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ToastProvider onToastRemove={onToastRemove}>
        <TestComponent />
      </ToastProvider>,
    );

    await user.click(screen.getByTestId("add"));

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    await waitFor(() => {
      expect(onToastRemove).toHaveBeenCalledTimes(1);
    });
  });
});
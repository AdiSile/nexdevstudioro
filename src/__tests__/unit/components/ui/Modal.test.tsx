import React from "react";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Modal, type ModalHandles } from "@/components/ui/Modal";

// ─── Helpers ────────────────────────────────────────────────────────

/** Helper to render a controlled Modal with a trigger button */
const setup = (
  props: Partial<React.ComponentProps<typeof Modal>> = {},
) => {
  const user = userEvent.setup();
  const onClose = jest.fn();

  const result = render(
    <TestHarness onClose={onClose} modalProps={props} />,
  );

  return { user, onClose, ...result };
};

/** A wrapper component that manages open/close state */
function TestHarness({
  onClose,
  modalProps,
}: {
  onClose: jest.Mock;
  modalProps: Partial<React.ComponentProps<typeof Modal>>;
}) {
  const [open, setOpen] = React.useState(true);
  const handleClose = () => {
    setOpen(false);
    onClose();
  };

  return (
    <>
      <button type="button" data-testid="trigger">
        Trigger
      </button>
      <Modal open={open} onClose={handleClose} {...modalProps}>
        <p>Modal content</p>
        <button type="button" data-testid="inside-button">
          Inside
        </button>
      </Modal>
    </>
  );
}

// ─── Rendering ──────────────────────────────────────────────────────
describe("Modal rendering", () => {
  it("renders when open is true", () => {
    setup();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not render when open is false", () => {
    render(
      <Modal open={false} onClose={jest.fn()}>
        <p>Hidden</p>
      </Modal>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders children inside the dialog", () => {
    setup();
    expect(screen.getByText("Modal content")).toBeInTheDocument();
  });

  it("renders with aria-modal=true", () => {
    setup();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
  });

  it("applies role=dialog", () => {
    setup();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

// ─── Sizes ──────────────────────────────────────────────────────────
describe("Modal sizes", () => {
  it("renders default md size", () => {
    setup();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("max-w-modal-md");
  });

  it("renders sm size", () => {
    setup({ size: "sm" });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("max-w-modal-sm");
  });

  it("renders lg size", () => {
    setup({ size: "lg" });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("max-w-modal-lg");
  });

  it("renders xl size", () => {
    setup({ size: "xl" });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("max-w-4xl");
  });

  it("renders xs size", () => {
    setup({ size: "xs" });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("max-w-xs");
  });

  it("renders fullscreen size", () => {
    setup({ size: "fullscreen" });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("max-w-none");
    expect(dialog).toHaveClass("w-full");
    expect(dialog).toHaveClass("h-full");
  });
});

// ─── Close button ───────────────────────────────────────────────────
describe("Modal close button", () => {
  it("shows close button by default", () => {
    setup();
    const closeBtn = screen.getByLabelText("Close modal");
    expect(closeBtn).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const { user, onClose } = setup();
    const closeBtn = screen.getByLabelText("Close modal");
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("hides close button when showCloseButton is false", () => {
    setup({ showCloseButton: false });
    expect(screen.queryByLabelText("Close modal")).not.toBeInTheDocument();
  });

  it("uses custom closeLabel for aria-label", () => {
    setup({ closeLabel: "Fermare" });
    expect(screen.getByLabelText("Fermare")).toBeInTheDocument();
  });
});

// ─── Escape key ─────────────────────────────────────────────────────
describe("Modal Escape key", () => {
  it("closes on Escape by default", async () => {
    const { user, onClose } = setup();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close on Escape when closeOnEscape is false", async () => {
    const { user, onClose } = setup({ closeOnEscape: false });
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ─── Overlay click ──────────────────────────────────────────────────
describe("Modal overlay click", () => {
  it("closes on overlay click by default", async () => {
    const { user, onClose } = setup();
    // The overlay is the parent of the dialog. Click outside the dialog.
    const dialog = screen.getByRole("dialog");
    const overlay = dialog.parentElement!;
    await user.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when clicking inside the dialog", async () => {
    const { user, onClose } = setup();
    const insideBtn = screen.getByTestId("inside-button");
    await user.click(insideBtn);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close on overlay click when closeOnOverlayClick is false", async () => {
    const { user, onClose } = setup({ closeOnOverlayClick: false });
    const dialog = screen.getByRole("dialog");
    const overlay = dialog.parentElement!;
    await user.click(overlay);
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ─── Focus trap ─────────────────────────────────────────────────────
describe("Modal focus trap", () => {
  it("focuses the first focusable element when opened", async () => {
    setup();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByLabelText("Close modal"),
      );
    });
  });

  it("keeps focus inside modal on Tab", async () => {
    const { user } = setup();
    const closeBtn = screen.getByLabelText("Close modal");
    closeBtn.focus();

    // Tab forward through all focusable elements
    await user.tab();
    expect(document.activeElement).toBe(screen.getByTestId("inside-button"));

    // Tab again should cycle back to first (close button)
    await user.tab();
    expect(document.activeElement).toBe(screen.getByLabelText("Close modal"));
  });

  it("keeps focus inside modal on Shift+Tab", async () => {
    const { user } = setup();
    const closeBtn = screen.getByLabelText("Close modal");
    closeBtn.focus();

    // Shift+Tab should go to last focusable
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByTestId("inside-button"));
  });

  it("handles modal with only one focusable element", async () => {
    render(
      <Modal open={true} onClose={jest.fn()}>
        <p>No buttons here</p>
      </Modal>,
    );
    // Should focus the dialog itself when no focusable children
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("dialog"));
    });
  });
});

// ─── Title and Description ──────────────────────────────────────────
describe("Modal title and description", () => {
  it("renders title when provided", () => {
    setup({ title: "Test Title" });
    expect(screen.getByText("Test Title")).toBeInTheDocument();
  });

  it("sets aria-labelledby from title", () => {
    setup({ title: "Test Title" });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-labelledby");
    const labelId = dialog.getAttribute("aria-labelledby");
    expect(screen.getByText("Test Title")).toHaveAttribute("id", labelId);
  });

  it("renders description when provided", () => {
    setup({ description: "Test description" });
    expect(screen.getByText("Test description")).toBeInTheDocument();
  });

  it("sets aria-describedby from description", () => {
    setup({ description: "Test description" });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-describedby");
  });

  it("uses explicit aria-labelledby over title", () => {
    setup({ title: "Title", "aria-labelledby": "custom-label" });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-labelledby", "custom-label");
  });

  it("uses aria-label when no title", () => {
    setup({ "aria-label": "Custom label" });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-label", "Custom label");
  });

  it("renders custom header when provided", () => {
    setup({ header: <div data-testid="custom-header">Custom</div> });
    expect(screen.getByTestId("custom-header")).toBeInTheDocument();
  });
});

// ─── Footer ─────────────────────────────────────────────────────────
describe("Modal footer", () => {
  it("renders footer when provided", () => {
    setup({ footer: <button data-testid="footer-btn">Save</button> });
    expect(screen.getByTestId("footer-btn")).toBeInTheDocument();
  });

  it("does not render footer when not provided", () => {
    setup();
    const dialog = screen.getByRole("dialog");
    const footerEls = dialog.querySelectorAll(
      ".border-t.border-border-subtle",
    );
    expect(footerEls.length).toBe(0);
  });
});

// ─── Overlay variants ───────────────────────────────────────────────
describe("Modal overlay variants", () => {
  it("renders default overlay", () => {
    setup({ overlay: "default" });
    const dialog = screen.getByRole("dialog");
    const overlay = dialog.parentElement!;
    expect(overlay).toHaveClass("bg-surface-overlay");
    expect(overlay).toHaveClass("backdrop-blur-sm");
  });

  it("renders transparent overlay", () => {
    setup({ overlay: "transparent" });
    const dialog = screen.getByRole("dialog");
    const overlay = dialog.parentElement!;
    expect(overlay).toHaveClass("bg-transparent");
  });

  it("renders dark overlay", () => {
    setup({ overlay: "dark" });
    const dialog = screen.getByRole("dialog");
    const overlay = dialog.parentElement!;
    expect(overlay).toHaveClass("bg-neutral-950/70");
  });

  it("renders no overlay styles", () => {
    setup({ overlay: "none" });
    const dialog = screen.getByRole("dialog");
    const overlay = dialog.parentElement!;
    expect(overlay).not.toHaveClass("bg-surface-overlay");
  });
});

// ─── Custom classes ─────────────────────────────────────────────────
describe("Modal custom classes", () => {
  it("applies custom className to overlay", () => {
    setup({ className: "custom-overlay" });
    const dialog = screen.getByRole("dialog");
    const overlay = dialog.parentElement!;
    expect(overlay).toHaveClass("custom-overlay");
  });

  it("applies custom contentClassName to dialog", () => {
    setup({ contentClassName: "custom-content" });
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("custom-content");
  });
});

// ─── Imperative handle ──────────────────────────────────────────────
describe("Modal imperative handle", () => {
  it("exposes focusFirst via ref", () => {
    const ref = React.createRef<ModalHandles>();
    render(
      <Modal ref={ref} open={true} onClose={jest.fn()}>
        <button type="button" data-testid="target">
          Target
        </button>
      </Modal>,
    );
    act(() => {
      ref.current?.focusFirst();
    });
    expect(document.activeElement).toBe(screen.getByTestId("target"));
  });

  it("exposes focusSelector via ref", () => {
    const ref = React.createRef<ModalHandles>();
    render(
      <Modal ref={ref} open={true} onClose={jest.fn()}>
        <button type="button">First</button>
        <button type="button" data-testid="target" className="special">
          Second
        </button>
      </Modal>,
    );
    act(() => {
      ref.current?.focusSelector(".special");
    });
    expect(document.activeElement).toBe(screen.getByTestId("target"));
  });
});

// ─── ForwardRef ─────────────────────────────────────────────────────
describe("Modal forwardRef", () => {
  it("forwards ref and exposes ModalHandles", () => {
    const ref = React.createRef<ModalHandles>();
    render(
      <Modal ref={ref} open={true} onClose={jest.fn()}>
        <p>Content</p>
      </Modal>,
    );
    expect(ref.current).toBeDefined();
    expect(typeof ref.current?.focusFirst).toBe("function");
    expect(typeof ref.current?.focusSelector).toBe("function");
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────
describe("Modal edge cases", () => {
  it("renders empty modal", () => {
    render(<Modal open={true} onClose={jest.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("allows custom data attributes", () => {
    setup({ "data-test": "custom" } as never);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("data-test", "custom");
  });
});
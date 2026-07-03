import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/Button";
import { Loader2, Mail, ArrowRight } from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────
const setup = (props: React.ComponentProps<typeof Button> = {}) => {
  const user = userEvent.setup();
  const { children, ...rest } = props as {
    children?: React.ReactNode;
  } & typeof props;
  const utils = render(<Button {...rest}>{children ?? "Click me"}</Button>);
  const button = screen.getByRole("button");
  return { user, button, ...utils };
};

// ─── Variants ───────────────────────────────────────────────────────
describe("Button variants", () => {
  it("renders with default primary variant", () => {
    setup();
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("bg-brand-500");
    expect(btn).toHaveClass("text-text-inverse");
  });

  it("renders secondary variant", () => {
    setup({ variant: "secondary" });
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("bg-surface-secondary");
    expect(btn).toHaveClass("text-text-primary");
    expect(btn).toHaveClass("border");
  });

  it("renders ghost variant", () => {
    setup({ variant: "ghost" });
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("bg-transparent");
    expect(btn).not.toHaveClass("shadow");
  });

  it("renders danger variant", () => {
    setup({ variant: "danger" });
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("bg-danger-500");
    expect(btn).toHaveClass("text-text-inverse");
  });
});

// ─── Sizes ──────────────────────────────────────────────────────────
describe("Button sizes", () => {
  it("renders default md size", () => {
    setup();
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("h-10");
    expect(btn).toHaveClass("px-5");
    expect(btn).toHaveClass("text-sm");
  });

  it("renders sm size", () => {
    setup({ size: "sm" });
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("h-8");
    expect(btn).toHaveClass("px-3");
    expect(btn).toHaveClass("text-xs");
  });

  it("renders lg size", () => {
    setup({ size: "lg" });
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("h-12");
    expect(btn).toHaveClass("px-7");
    expect(btn).toHaveClass("text-base");
  });

  it("renders icon-only size (square aspect)", () => {
    setup({ size: "icon-sm" });
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("h-8");
    expect(btn).toHaveClass("w-8");
    expect(btn).toHaveClass("p-0");
  });
});

// ─── Disabled ───────────────────────────────────────────────────────
describe("Button disabled state", () => {
  it("applies disabled attribute", () => {
    setup({ disabled: true });
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
  });

  it("applies disabled aria attribute", () => {
    setup({ disabled: true });
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-disabled", "true");
  });

  it("applies disabled visual styles", () => {
    setup({ disabled: true });
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("opacity-50");
    expect(btn).toHaveClass("cursor-not-allowed");
    expect(btn).toHaveClass("pointer-events-none");
  });

  it("does not call onClick when disabled", async () => {
    const onClick = jest.fn();
    const { user, button } = setup({ disabled: true, onClick });
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

// ─── Loading ────────────────────────────────────────────────────────
describe("Button loading state", () => {
  it("shows spinner icon when loading", () => {
    setup({ loading: true });
    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
  });

  it("applies aria-busy when loading", () => {
    setup({ loading: true });
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("disables button when loading", () => {
    setup({ loading: true });
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
  });

  it("does not call onClick when loading", async () => {
    const onClick = jest.fn();
    const { user, button } = setup({ loading: true, onClick });
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("hides children visually but keeps them accessible", () => {
    setup({ loading: true, children: "Save" });
    const label = screen.getByText("Save");
    expect(label).toHaveClass("invisible");
  });

  it("renders custom loading text for screen readers", () => {
    setup({ loading: true, loadingText: "Saving..." });
    expect(screen.getByText("Saving...")).toBeInTheDocument();
  });
});

// ─── Icons ──────────────────────────────────────────────────────────
describe("Button icons", () => {
  it("renders left icon", () => {
    setup({ iconLeft: <Mail data-testid="mail-icon" /> });
    const icon = screen.getByTestId("mail-icon");
    expect(icon).toBeInTheDocument();
  });

  it("renders right icon", () => {
    setup({ iconRight: <ArrowRight data-testid="arrow-icon" /> });
    const icon = screen.getByTestId("arrow-icon");
    expect(icon).toBeInTheDocument();
  });

  it("renders both left and right icons", () => {
    setup({
      iconLeft: <Mail data-testid="mail-icon" />,
      iconRight: <ArrowRight data-testid="arrow-icon" />,
    });
    expect(screen.getByTestId("mail-icon")).toBeInTheDocument();
    expect(screen.getByTestId("arrow-icon")).toBeInTheDocument();
  });

  it("applies icon spacing classes for left icon", () => {
    setup({ iconLeft: <Mail data-testid="icon" /> });
    const btn = screen.getByRole("button");
    const iconWrapper = btn.querySelector("span:first-child");
    expect(iconWrapper).toHaveClass("mr-2");
  });

  it("applies icon spacing classes for right icon", () => {
    setup({ iconRight: <ArrowRight data-testid="icon" /> });
    const btn = screen.getByRole("button");
    const spans = btn.querySelectorAll("span");
    const lastSpan = spans[spans.length - 1];
    expect(lastSpan).toHaveClass("ml-2");
  });

  it("does not show left icon when loading", () => {
    setup({ loading: true, iconLeft: <Mail data-testid="mail-icon" /> });
    expect(screen.queryByTestId("mail-icon")).not.toBeInTheDocument();
  });

  it("does not show right icon when loading", () => {
    setup({
      loading: true,
      iconRight: <ArrowRight data-testid="arrow-icon" />,
    });
    expect(screen.queryByTestId("arrow-icon")).not.toBeInTheDocument();
  });
});

// ─── ARIA / Accessibility ───────────────────────────────────────────
describe("Button accessibility", () => {
  it("has button role by default", () => {
    setup();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("accepts aria-label", () => {
    setup({ "aria-label": "Close dialog" });
    expect(screen.getByLabelText("Close dialog")).toBeInTheDocument();
  });

  it("accepts aria-describedby", () => {
    setup({ "aria-describedby": "hint-text" });
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-describedby", "hint-text");
  });

  it("accepts aria-expanded", () => {
    setup({ "aria-expanded": true });
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-expanded", "true");
  });

  it("accepts aria-controls", () => {
    setup({ "aria-controls": "menu-panel" });
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-controls", "menu-panel");
  });

  it("accepts aria-haspopup", () => {
    setup({ "aria-haspopup": "menu" });
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-haspopup", "menu");
  });

  it("accepts aria-pressed for toggle buttons", () => {
    setup({ "aria-pressed": true });
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("aria-pressed", "true");
  });

  it("is focusable via keyboard", () => {
    setup();
    const btn = screen.getByRole("button");
    btn.focus();
    expect(btn).toHaveFocus();
  });
});

// ─── Keyboard Interaction ───────────────────────────────────────────
describe("Button keyboard interaction", () => {
  it("calls onClick on Enter key", async () => {
    const onClick = jest.fn();
    const { user } = setup({ onClick });
    const btn = screen.getByRole("button");
    btn.focus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("calls onClick on Space key", async () => {
    const onClick = jest.fn();
    const { user } = setup({ onClick });
    const btn = screen.getByRole("button");
    btn.focus();
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not respond to Enter when disabled", async () => {
    const onClick = jest.fn();
    setup({ disabled: true, onClick });
    const btn = screen.getByRole("button");
    btn.focus();
    await userEvent.keyboard("{Enter}");
    expect(onClick).not.toHaveBeenCalled();
  });
});

// ─── Click handler ──────────────────────────────────────────────────
describe("Button onClick", () => {
  it("calls onClick when clicked", async () => {
    const onClick = jest.fn();
    const { user, button } = setup({ onClick });
    await user.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("passes event to onClick", async () => {
    let event: React.MouseEvent | null = null;
    const onClick = jest.fn((e) => {
      event = e;
    });
    const { user, button } = setup({ onClick });
    await user.click(button);
    expect(onClick).toHaveBeenCalled();
    expect(event).not.toBeNull();
    expect(event?.type).toBe("click");
  });
});

// ─── Type attribute ─────────────────────────────────────────────────
describe("Button type attribute", () => {
  it("defaults to type=button (not submit)", () => {
    setup();
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("type", "button");
  });

  it("accepts type=submit", () => {
    setup({ type: "submit" });
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("type", "submit");
  });

  it("accepts type=reset", () => {
    setup({ type: "reset" });
    const btn = screen.getByRole("button");
    expect(btn).toHaveAttribute("type", "reset");
  });
});

// ─── ForwardRef ─────────────────────────────────────────────────────
describe("Button ref forwarding", () => {
  it("forwards ref to button element", () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref test</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.textContent).toBe("Ref test");
  });
});

// ─── Custom className ───────────────────────────────────────────────
describe("Button custom className", () => {
  it("merges custom className", () => {
    setup({ className: "custom-class" });
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("custom-class");
  });

  it("preserves variant styles with custom className", () => {
    setup({ className: "custom-class", variant: "danger" });
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("custom-class");
    expect(btn).toHaveClass("bg-danger-500");
  });
});

// ─── Full-width ─────────────────────────────────────────────────────
describe("Button full-width", () => {
  it("applies full-width class when fullWidth is true", () => {
    setup({ fullWidth: true });
    const btn = screen.getByRole("button");
    expect(btn).toHaveClass("w-full");
  });

  it("does not apply full-width by default", () => {
    setup();
    const btn = screen.getByRole("button");
    expect(btn).not.toHaveClass("w-full");
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────
describe("Button edge cases", () => {
  it("renders without children (icon-only)", () => {
    render(<Button aria-label="Settings" iconLeft={<Mail />} />);
    expect(screen.getByLabelText("Settings")).toBeInTheDocument();
  });

  it("handles empty string children", () => {
    render(<Button>{""}</Button>);
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("renders as a link when href is provided", () => {
    render(<Button href="/test">Link button</Button>);
    const link = screen.getByRole("link");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/test");
  });

  it("does not apply button-specific aria when rendered as link", () => {
    render(
      <Button href="/test" disabled>
        Link button
      </Button>,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("aria-disabled", "true");
  });
});
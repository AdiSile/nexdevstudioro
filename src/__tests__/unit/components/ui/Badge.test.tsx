import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Badge, { badgeVariants, dotVariants, type BadgeProps } from "@/components/ui/Badge";

// ─── Helpers ────────────────────────────────────────────────────────

const setup = (props: BadgeProps = {}) => {
  const user = userEvent.setup();
  const utils = render(<Badge {...props} />);
  return { user, ...utils };
};

// ─── Rendering ──────────────────────────────────────────────────────
describe("Badge rendering", () => {
  it("renders with default props", () => {
    setup({ children: "Default" });
    const badge = screen.getByText("Default");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-slot", "badge");
  });

  it("renders without children (empty badge)", () => {
    setup();
    const badge = document.querySelector('[data-slot="badge"]');
    expect(badge).toBeInTheDocument();
  });

  it("renders with long text content", () => {
    setup({ children: "This is a very long badge text that should truncate" });
    const badge = screen.getByText(/very long badge text/);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass("truncate");
  });

  it("forwards ref correctly", () => {
    const ref = React.createRef<HTMLSpanElement>();
    render(<Badge ref={ref}>Ref Badge</Badge>);
    expect(ref.current).toBeInstanceOf(HTMLSpanElement);
    expect(ref.current?.textContent).toContain("Ref Badge");
  });

  it("applies additional className", () => {
    setup({ children: "Custom", className: "my-custom-class" });
    const badge = screen.getByText("Custom");
    expect(badge).toHaveClass("my-custom-class");
  });

  it("passes additional HTML attributes", () => {
    setup({ children: "Attr", "data-testid": "my-badge", id: "badge-1" });
    const badge = screen.getByTestId("my-badge");
    expect(badge).toHaveAttribute("id", "badge-1");
  });
});

// ─── Variants ───────────────────────────────────────────────────────
describe("Badge variants", () => {
  it("renders solid variant with correct classes", () => {
    setup({ children: "Solid", variant: "solid", color: "success" });
    const badge = screen.getByText("Solid");
    expect(badge).toHaveClass("bg-success-500");
    expect(badge).toHaveClass("text-text-inverse");
  });

  it("renders soft variant with correct classes", () => {
    setup({ children: "Soft", variant: "soft", color: "brand" });
    const badge = screen.getByText("Soft");
    expect(badge).toHaveClass("bg-brand-50");
    expect(badge).toHaveClass("text-brand-700");
  });

  it("renders outline variant with correct classes", () => {
    setup({ children: "Outline", variant: "outline", color: "danger" });
    const badge = screen.getByText("Outline");
    expect(badge).toHaveClass("border-danger-300");
    expect(badge).toHaveClass("text-danger-700");
    expect(badge).toHaveClass("bg-transparent");
  });

  it("renders neutral color with solid variant", () => {
    setup({ children: "Neutral", variant: "solid", color: "neutral" });
    const badge = screen.getByText("Neutral");
    expect(badge).toHaveClass("bg-neutral-600");
  });

  it("renders accent color with soft variant", () => {
    setup({ children: "Accent", variant: "soft", color: "accent" });
    const badge = screen.getByText("Accent");
    expect(badge).toHaveClass("bg-accent-50");
    expect(badge).toHaveClass("text-accent-700");
  });

  it("renders warning color with outline variant", () => {
    setup({ children: "Warn", variant: "outline", color: "warning" });
    const badge = screen.getByText("Warn");
    expect(badge).toHaveClass("border-warning-300");
  });

  it("renders info color with soft variant", () => {
    setup({ children: "Info", variant: "soft", color: "info" });
    const badge = screen.getByText("Info");
    expect(badge).toHaveClass("bg-info-50");
    expect(badge).toHaveClass("text-info-700");
  });

  it("defaults to soft brand when no variant/color specified", () => {
    setup({ children: "Default" });
    const badge = screen.getByText("Default");
    expect(badge).toHaveClass("bg-brand-50");
    expect(badge).toHaveClass("text-brand-700");
  });
});

// ─── Sizes ──────────────────────────────────────────────────────────
describe("Badge sizes", () => {
  it("renders sm size", () => {
    setup({ children: "Small", size: "sm" });
    const badge = screen.getByText("Small");
    expect(badge).toHaveClass("h-5");
    expect(badge).toHaveClass("text-xs");
  });

  it("renders md size (default)", () => {
    setup({ children: "Medium" });
    const badge = screen.getByText("Medium");
    expect(badge).toHaveClass("h-6");
    expect(badge).toHaveClass("text-xs");
  });

  it("renders lg size", () => {
    setup({ children: "Large", size: "lg" });
    const badge = screen.getByText("Large");
    expect(badge).toHaveClass("h-7");
    expect(badge).toHaveClass("text-sm");
  });
});

// ─── Rounded shapes ─────────────────────────────────────────────────
describe("Badge rounded shapes", () => {
  it("renders default rounded (rounded-md)", () => {
    setup({ children: "Rounded" });
    const badge = screen.getByText("Rounded");
    expect(badge).toHaveClass("rounded-md");
  });

  it("renders full rounded (pill shape)", () => {
    setup({ children: "Pill", rounded: "full" });
    const badge = screen.getByText("Pill");
    expect(badge).toHaveClass("rounded-full");
  });
});

// ─── Dot indicator ──────────────────────────────────────────────────
describe("Badge dot indicator", () => {
  it("renders a dot when dot prop is true", () => {
    setup({ children: "With Dot", dot: true, color: "success" });
    const dot = document.querySelector('[data-slot="badge-dot"]');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass("bg-success-500");
  });

  it("does not render dot when dot prop is false (default)", () => {
    setup({ children: "No Dot" });
    const dot = document.querySelector('[data-slot="badge-dot"]');
    expect(dot).not.toBeInTheDocument();
  });

  it("renders dot with contrasting color on solid variant", () => {
    setup({
      children: "Solid Dot",
      dot: true,
      variant: "solid",
      color: "brand",
    });
    const dot = document.querySelector('[data-slot="badge-dot"]');
    expect(dot).toHaveClass("bg-brand-200");
  });

  it("renders dot with correct size based on badge size", () => {
    setup({ children: "Sm Dot", dot: true, size: "sm" });
    const dot = document.querySelector('[data-slot="badge-dot"]');
    expect(dot).toHaveClass("h-1.5");
    expect(dot).toHaveClass("w-1.5");
  });

  it("renders dot with lg size", () => {
    setup({ children: "Lg Dot", dot: true, size: "lg" });
    const dot = document.querySelector('[data-slot="badge-dot"]');
    expect(dot).toHaveClass("h-2.5");
    expect(dot).toHaveClass("w-2.5");
  });

  it("dot is aria-hidden", () => {
    setup({ children: "Aria Dot", dot: true });
    const dot = document.querySelector('[data-slot="badge-dot"]');
    expect(dot).toHaveAttribute("aria-hidden", "true");
  });
});

// ─── Icons ──────────────────────────────────────────────────────────
describe("Badge icons", () => {
  it("renders left icon", () => {
    setup({
      children: "With Left",
      iconLeft: <span data-testid="left-icon">L</span>,
    });
    expect(screen.getByTestId("left-icon")).toBeInTheDocument();
  });

  it("renders right icon", () => {
    setup({
      children: "With Right",
      iconRight: <span data-testid="right-icon">R</span>,
    });
    expect(screen.getByTestId("right-icon")).toBeInTheDocument();
  });

  it("renders both left and right icons", () => {
    setup({
      children: "Both",
      iconLeft: <span data-testid="left-icon">L</span>,
      iconRight: <span data-testid="right-icon">R</span>,
    });
    expect(screen.getByTestId("left-icon")).toBeInTheDocument();
    expect(screen.getByTestId("right-icon")).toBeInTheDocument();
  });

  it("does not render right icon when dismissible is true (dismiss takes priority)", () => {
    setup({
      children: "Dismiss",
      dismissible: true,
      iconRight: <span data-testid="right-icon">R</span>,
    });
    expect(screen.queryByTestId("right-icon")).not.toBeInTheDocument();
  });
});

// ─── Dismissible ────────────────────────────────────────────────────
describe("Badge dismissible", () => {
  it("renders dismiss button when dismissible is true", () => {
    setup({ children: "Dismissible", dismissible: true });
    const dismissBtn = document.querySelector('[data-slot="badge-dismiss"]');
    expect(dismissBtn).toBeInTheDocument();
  });

  it("does not render dismiss button when dismissible is false (default)", () => {
    setup({ children: "Not Dismissible" });
    const dismissBtn = document.querySelector('[data-slot="badge-dismiss"]');
    expect(dismissBtn).not.toBeInTheDocument();
  });

  it("calls onDismiss when dismiss button is clicked", async () => {
    const onDismiss = jest.fn();
    const { user } = setup({
      children: "Click Dismiss",
      dismissible: true,
      onDismiss,
    });

    const dismissBtn = document.querySelector('[data-slot="badge-dismiss"]')!;
    await user.click(dismissBtn);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("dismiss button click does not propagate to badge onClick", async () => {
    const onDismiss = jest.fn();
    const onClick = jest.fn();
    const { user } = setup({
      children: "Stop Prop",
      dismissible: true,
      onDismiss,
      onClick,
    });

    const dismissBtn = document.querySelector('[data-slot="badge-dismiss"]')!;
    await user.click(dismissBtn);

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("dismiss button has accessible label", () => {
    setup({ children: "Aria", dismissible: true });
    const dismissBtn = screen.getByLabelText("Remove");
    expect(dismissBtn).toBeInTheDocument();
  });

  it("uses custom dismiss label", () => {
    setup({
      children: "Custom Label",
      dismissible: true,
      dismissLabel: "Delete tag",
    });
    const dismissBtn = screen.getByLabelText("Delete tag");
    expect(dismissBtn).toBeInTheDocument();
  });

  it("supports keyboard Delete to dismiss", async () => {
    const onDismiss = jest.fn();
    const { user } = setup({
      children: "Key Dismiss",
      dismissible: true,
      onDismiss,
    });

    const badge = screen.getByText("Key Dismiss");
    await user.type(badge, "{Delete}");

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("supports keyboard Backspace to dismiss", async () => {
    const onDismiss = jest.fn();
    const { user } = setup({
      children: "Backspace Dismiss",
      dismissible: true,
      onDismiss,
    });

    const badge = screen.getByText("Backspace Dismiss");
    await user.type(badge, "{Backspace}");

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("sets aria-live polite when dismissible", () => {
    setup({ children: "Live", dismissible: true });
    const badge = screen.getByText("Live");
    expect(badge).toHaveAttribute("aria-live", "polite");
  });
});

// ─── Interactive (onClick) ──────────────────────────────────────────
describe("Badge interactive", () => {
  it("calls onClick when badge is clicked", async () => {
    const onClick = jest.fn();
    const { user } = setup({ children: "Clickable", onClick });

    const badge = screen.getByText("Clickable");
    await user.click(badge);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("sets role=button when onClick is provided", () => {
    setup({ children: "Button Role", onClick: jest.fn() });
    const badge = screen.getByRole("button");
    expect(badge).toBeInTheDocument();
  });

  it("sets role=button when dismissible", () => {
    setup({ children: "Dismiss Role", dismissible: true });
    const badge = screen.getByRole("button");
    expect(badge).toBeInTheDocument();
  });

  it("sets tabIndex=0 when interactive", () => {
    setup({ children: "TabIndex", onClick: jest.fn() });
    const badge = screen.getByText("TabIndex");
    expect(badge).toHaveAttribute("tabindex", "0");
  });

  it("respects custom tabIndex", () => {
    setup({ children: "Custom Tab", tabIndex: -1 });
    const badge = screen.getByText("Custom Tab");
    expect(badge).toHaveAttribute("tabindex", "-1");
  });

  it("has hover styles when interactive (solid)", () => {
    setup({
      children: "Hover Solid",
      variant: "solid",
      color: "brand",
      onClick: jest.fn(),
    });
    const badge = screen.getByText("Hover Solid");
    expect(badge).toHaveClass("hover:bg-brand-600");
    expect(badge).toHaveClass("active:bg-brand-700");
  });

  it("has hover styles when interactive (soft)", () => {
    setup({
      children: "Hover Soft",
      variant: "soft",
      color: "danger",
      onClick: jest.fn(),
    });
    const badge = screen.getByText("Hover Soft");
    expect(badge).toHaveClass("hover:bg-danger-100");
  });

  it("has hover styles when interactive (outline)", () => {
    setup({
      children: "Hover Outline",
      variant: "outline",
      color: "info",
      dismissible: true,
    });
    const badge = screen.getByText("Hover Outline");
    expect(badge).toHaveClass("hover:bg-info-50");
    expect(badge).toHaveClass("hover:border-info-400");
  });
});

// ─── Compound scenarios ─────────────────────────────────────────────
describe("Badge compound scenarios", () => {
  it("renders solid danger pill with dot and dismiss", () => {
    const onDismiss = jest.fn();
    setup({
      children: "Urgent",
      variant: "solid",
      color: "danger",
      rounded: "full",
      size: "lg",
      dot: true,
      dismissible: true,
      onDismiss,
    });

    const badge = screen.getByText("Urgent");
    expect(badge).toHaveClass("bg-danger-500");
    expect(badge).toHaveClass("rounded-full");
    expect(badge).toHaveClass("h-7");
    expect(badge).toHaveClass("text-sm");

    const dot = document.querySelector('[data-slot="badge-dot"]');
    expect(dot).toHaveClass("bg-danger-200");
    expect(dot).toHaveClass("h-2.5");

    const dismissBtn = document.querySelector('[data-slot="badge-dismiss"]');
    expect(dismissBtn).toBeInTheDocument();
  });

  it("renders outline brand sm with left icon", () => {
    setup({
      children: "Brand",
      variant: "outline",
      color: "brand",
      size: "sm",
      iconLeft: <span data-testid="icon">★</span>,
    });

    const badge = screen.getByText("Brand");
    expect(badge).toHaveClass("border-brand-300");
    expect(badge).toHaveClass("text-brand-700");
    expect(badge).toHaveClass("h-5");
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("renders soft success rounded-full with dot only (no children)", () => {
    setup({
      variant: "soft",
      color: "success",
      rounded: "full",
      dot: true,
    });

    const dot = document.querySelector('[data-slot="badge-dot"]');
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass("bg-success-500");

    const badge = document.querySelector('[data-slot="badge"]');
    expect(badge).toHaveClass("rounded-full");
    expect(badge).toHaveClass("bg-success-50");
    expect(badge).toHaveClass("text-success-700");
  });
});

// ─── dotVariants export ─────────────────────────────────────────────
describe("dotVariants", () => {
  it("returns correct classes for solid brand sm dot", () => {
    const result = dotVariants({ variant: "solid", color: "brand", size: "sm" });
    expect(result).toContain("bg-brand-200");
    expect(result).toContain("h-1.5");
    expect(result).toContain("w-1.5");
  });

  it("returns correct classes for soft danger md dot", () => {
    const result = dotVariants({ variant: "soft", color: "danger", size: "md" });
    expect(result).toContain("bg-danger-500");
    expect(result).toContain("h-2");
    expect(result).toContain("w-2");
  });

  it("returns correct classes for outline info lg dot", () => {
    const result = dotVariants({ variant: "outline", color: "info", size: "lg" });
    expect(result).toContain("bg-info-500");
    expect(result).toContain("h-2.5");
    expect(result).toContain("w-2.5");
  });
});

// ─── badgeVariants export ───────────────────────────────────────────
describe("badgeVariants", () => {
  it("returns default variant classes", () => {
    const result = badgeVariants({});
    expect(result).toContain("inline-flex");
    expect(result).toContain("bg-brand-50");
    expect(result).toContain("text-brand-700");
  });

  it("returns solid danger classes", () => {
    const result = badgeVariants({
      variant: "solid",
      color: "danger",
      size: "md",
      rounded: "default",
    });
    expect(result).toContain("bg-danger-500");
    expect(result).toContain("text-text-inverse");
  });

  it("returns soft accent with full rounded", () => {
    const result = badgeVariants({
      variant: "soft",
      color: "accent",
      rounded: "full",
    });
    expect(result).toContain("bg-accent-50");
    expect(result).toContain("text-accent-700");
    expect(result).toContain("rounded-full");
  });

  it("returns outline warning with interactive hover", () => {
    const result = badgeVariants({
      variant: "outline",
      color: "warning",
      interactive: true,
    });
    expect(result).toContain("border-warning-300");
    expect(result).toContain("hover:bg-warning-50");
    expect(result).toContain("hover:border-warning-400");
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────
describe("Badge edge cases", () => {
  it("renders with numeric children", () => {
    setup({ children: 42 as unknown as React.ReactNode });
    const badge = screen.getByText("42");
    expect(badge).toBeInTheDocument();
  });

  it("renders with zero as child", () => {
    setup({ children: 0 as unknown as React.ReactNode });
    const badge = screen.getByText("0");
    expect(badge).toBeInTheDocument();
  });

  it("handles null children gracefully", () => {
    setup({ children: null as unknown as React.ReactNode });
    const badge = document.querySelector('[data-slot="badge"]');
    expect(badge).toBeInTheDocument();
  });

  it("handles undefined onDismiss gracefully", () => {
    setup({ children: "No Callback", dismissible: true });
    const dismissBtn = document.querySelector('[data-slot="badge-dismiss"]')!;
    // Should not throw
    expect(dismissBtn).toBeInTheDocument();
  });

  it("renders with all seven colors in solid variant", () => {
    const colors = ["brand", "accent", "success", "danger", "warning", "info", "neutral"] as const;
    render(
      <>
        {colors.map((c) => (
          <Badge key={c} variant="solid" color={c}>
            {c}
          </Badge>
        ))}
      </>,
    );
    colors.forEach((c) => {
      expect(screen.getByText(c)).toBeInTheDocument();
    });
  });

  it("renders with all seven colors in soft variant", () => {
    const colors = ["brand", "accent", "success", "danger", "warning", "info", "neutral"] as const;
    render(
      <>
        {colors.map((c) => (
          <Badge key={c} variant="soft" color={c}>
            {c}
          </Badge>
        ))}
      </>,
    );
    colors.forEach((c) => {
      expect(screen.getByText(c)).toBeInTheDocument();
    });
  });

  it("renders with all seven colors in outline variant", () => {
    const colors = ["brand", "accent", "success", "danger", "warning", "info", "neutral"] as const;
    render(
      <>
        {colors.map((c) => (
          <Badge key={c} variant="outline" color={c}>
            {c}
          </Badge>
        ))}
      </>,
    );
    colors.forEach((c) => {
      expect(screen.getByText(c)).toBeInTheDocument();
    });
  });
});

// ─── Accessibility ──────────────────────────────────────────────────
describe("Badge accessibility", () => {
  it("non-interactive badge does not have button role", () => {
    setup({ children: "Static" });
    const badge = screen.getByText("Static");
    expect(badge).not.toHaveAttribute("role", "button");
  });

  it("dismiss button has aria-label", () => {
    setup({ children: "Label", dismissible: true });
    const dismissBtn = screen.getByLabelText("Remove");
    expect(dismissBtn).toHaveAttribute("aria-label");
  });

  it("dismiss icon is aria-hidden", () => {
    setup({ children: "Hidden Icon", dismissible: true });
    const dismissBtn = document.querySelector('[data-slot="badge-dismiss"]')!;
    const icon = dismissBtn.querySelector("svg");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("dot indicator is aria-hidden", () => {
    setup({ children: "Dot Hidden", dot: true });
    const dot = document.querySelector('[data-slot="badge-dot"]');
    expect(dot).toHaveAttribute("aria-hidden", "true");
  });
});
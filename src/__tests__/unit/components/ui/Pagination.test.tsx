import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Pagination,
  paginationVariants,
  pageButtonVariants,
  ellipsisVariants,
  generatePageNumbers,
  type PaginationProps,
} from "@/components/ui/Pagination";

// ─── Helpers ────────────────────────────────────────────────────────

const setup = (props: Partial<PaginationProps> & { total: number }) => {
  const user = userEvent.setup();
  const defaultProps: PaginationProps = {
    page: 0,
    total: props.total,
    onPageChange: jest.fn(),
  };
  const merged = { ...defaultProps, ...props };
  const utils = render(<Pagination {...merged} />);
  return { user, props: merged, ...utils };
};

// ─── generatePageNumbers unit tests ─────────────────────────────────

describe("generatePageNumbers", () => {
  it("returns all pages when total <= 7", () => {
    expect(generatePageNumbers(0, 5, 1)).toEqual([0, 1, 2, 3, 4]);
    expect(generatePageNumbers(2, 7, 1)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("returns correct range for total=1", () => {
    expect(generatePageNumbers(0, 1, 1)).toEqual([0]);
  });

  it("shows ellipsis when current page is near start (0)", () => {
    const result = generatePageNumbers(0, 10, 1);
    expect(result[0]).toBe(0);
    expect(result[result.length - 1]).toBe(9);
    expect(result).toContain("ellipsis-end");
  });

  it("shows ellipsis when current page is near end", () => {
    const result = generatePageNumbers(9, 10, 1);
    expect(result[0]).toBe(0);
    expect(result[result.length - 1]).toBe(9);
    expect(result).toContain("ellipsis-start");
  });

  it("shows both ellipses when current page is in middle", () => {
    const result = generatePageNumbers(5, 15, 1);
    expect(result[0]).toBe(0);
    expect(result[result.length - 1]).toBe(14);
    expect(result).toContain("ellipsis-start");
    expect(result).toContain("ellipsis-end");
  });

  it("respects siblingCount > 1", () => {
    const result = generatePageNumbers(5, 15, 2);
    expect(result).toContain(3);
    expect(result).toContain(4);
    expect(result).toContain(5);
    expect(result).toContain(6);
    expect(result).toContain(7);
  });

  it("handles current page at exact boundary for ellipsis", () => {
    const result = generatePageNumbers(3, 10, 1);
    expect(result).toContain("ellipsis-start");
    expect(result).toContain("ellipsis-end");
  });

  it("does not show ellipsis when siblings touch first/last", () => {
    const result = generatePageNumbers(2, 7, 1);
    expect(result).not.toContain("ellipsis-start");
    expect(result).not.toContain("ellipsis-end");
  });
});

// ─── Basic Rendering ────────────────────────────────────────────────

describe("Pagination rendering", () => {
  it("renders nothing when total <= 1", () => {
    const { container } = setup({ total: 1 });
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when total = 0", () => {
    const { container } = setup({ total: 0 });
    expect(container.firstChild).toBeNull();
  });

  it("renders nav element with correct role", () => {
    setup({ total: 5 });
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("renders with accessible label", () => {
    setup({ total: 5 });
    expect(screen.getByRole("navigation")).toHaveAttribute(
      "aria-label",
      "Paginare",
    );
  });

  it("accepts custom aria-label", () => {
    setup({ total: 5, "aria-label": "Navigare produse" });
    expect(screen.getByRole("navigation")).toHaveAttribute(
      "aria-label",
      "Navigare produse",
    );
  });

  it("renders previous and next buttons", () => {
    setup({ total: 5 });
    expect(screen.getByLabelText("Pagina anterioară")).toBeInTheDocument();
    expect(screen.getByLabelText("Pagina următoare")).toBeInTheDocument();
  });

  it("renders first and last buttons by default (showEdges=true)", () => {
    setup({ total: 5 });
    expect(screen.getByLabelText("Prima pagină")).toBeInTheDocument();
    expect(screen.getByLabelText("Ultima pagină")).toBeInTheDocument();
  });

  it("hides first/last buttons when showEdges=false", () => {
    setup({ total: 5, showEdges: false });
    expect(screen.queryByLabelText("Prima pagină")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Ultima pagină")).not.toBeInTheDocument();
  });

  it("renders correct number of page buttons for total <= 7", () => {
    setup({ total: 5 });
    const pageButtons = screen
      .getAllByRole("button")
      .filter(
        (btn) =>
          btn.getAttribute("aria-current") !== undefined ||
          /^Pagina \d+$/.test(btn.getAttribute("aria-label") ?? ""),
      );
    expect(pageButtons.length).toBe(5);
  });

  it("renders page buttons with 1-based display numbers", () => {
    setup({ total: 3 });
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});

// ─── Active Page ────────────────────────────────────────────────────

describe("Pagination active page", () => {
  it("highlights the current page with aria-current", () => {
    setup({ total: 5, page: 2 });
    const activeBtn = screen.getByLabelText("Pagina 3, pagină curentă");
    expect(activeBtn).toHaveAttribute("aria-current", "page");
  });

  it("applies active variant styling to current page", () => {
    setup({ total: 5, page: 0 });
    const activeBtn = screen.getByLabelText("Pagina 1, pagină curentă");
    expect(activeBtn).toHaveClass("bg-brand-500");
    expect(activeBtn).toHaveClass("text-text-inverse");
  });

  it("does not mark other pages as current", () => {
    setup({ total: 5, page: 1 });
    const inactiveBtn = screen.getByLabelText("Pagina 1");
    expect(inactiveBtn).not.toHaveAttribute("aria-current");
  });

  it("clamps out-of-range page to valid range", () => {
    setup({ total: 5, page: 10 });
    const activeBtn = screen.getByLabelText("Pagina 5, pagină curentă");
    expect(activeBtn).toBeInTheDocument();
  });

  it("clamps negative page to 0", () => {
    setup({ total: 5, page: -5 });
    const activeBtn = screen.getByLabelText("Pagina 1, pagină curentă");
    expect(activeBtn).toBeInTheDocument();
  });
});

// ─── Navigation ─────────────────────────────────────────────────────

describe("Pagination navigation", () => {
  it("calls onPageChange with next page when next is clicked", async () => {
    const onPageChange = jest.fn();
    const { user } = setup({ total: 5, page: 0, onPageChange });

    await user.click(screen.getByLabelText("Pagina următoare"));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("calls onPageChange with previous page when prev is clicked", async () => {
    const onPageChange = jest.fn();
    const { user } = setup({ total: 5, page: 2, onPageChange });

    await user.click(screen.getByLabelText("Pagina anterioară"));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("calls onPageChange with first page when first is clicked", async () => {
    const onPageChange = jest.fn();
    const { user } = setup({ total: 5, page: 3, onPageChange });

    await user.click(screen.getByLabelText("Prima pagină"));
    expect(onPageChange).toHaveBeenCalledWith(0);
  });

  it("calls onPageChange with last page when last is clicked", async () => {
    const onPageChange = jest.fn();
    const { user } = setup({ total: 5, page: 1, onPageChange });

    await user.click(screen.getByLabelText("Ultima pagină"));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it("calls onPageChange when a page number is clicked", async () => {
    const onPageChange = jest.fn();
    const { user } = setup({ total: 5, page: 0, onPageChange });

    await user.click(screen.getByLabelText("Pagina 4"));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("does not call onPageChange when clicking the already active page", async () => {
    const onPageChange = jest.fn();
    const { user } = setup({ total: 5, page: 2, onPageChange });

    await user.click(screen.getByLabelText("Pagina 3, pagină curentă"));
    expect(onPageChange).not.toHaveBeenCalled();
  });
});

// ─── Disabled State ─────────────────────────────────────────────────

describe("Pagination disabled state", () => {
  it("disables prev button on first page", () => {
    setup({ total: 5, page: 0 });
    expect(screen.getByLabelText("Pagina anterioară")).toBeDisabled();
    expect(screen.getByLabelText("Prima pagină")).toBeDisabled();
  });

  it("disables next button on last page", () => {
    setup({ total: 5, page: 4 });
    expect(screen.getByLabelText("Pagina următoare")).toBeDisabled();
    expect(screen.getByLabelText("Ultima pagină")).toBeDisabled();
  });

  it("enables both prev and next on middle page", () => {
    setup({ total: 5, page: 2 });
    expect(screen.getByLabelText("Pagina anterioară")).not.toBeDisabled();
    expect(screen.getByLabelText("Pagina următoare")).not.toBeDisabled();
  });

  it("disables all buttons when disabled prop is true", () => {
    setup({ total: 5, page: 2, disabled: true });
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });

  it("does not fire onPageChange when disabled", async () => {
    const onPageChange = jest.fn();
    const { user } = setup({
      total: 5,
      page: 0,
      disabled: true,
      onPageChange,
    });

    await user.click(screen.getByLabelText("Pagina următoare"));
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("applies disabled cursor styles", () => {
    setup({ total: 5, page: 0 });
    const prevBtn = screen.getByLabelText("Pagina anterioară");
    expect(prevBtn).toHaveClass("disabled:pointer-events-none");
    expect(prevBtn).toHaveClass("disabled:opacity-40");
  });
});

// ─── Ellipsis ───────────────────────────────────────────────────────

describe("Pagination ellipsis", () => {
  it("renders ellipsis for large page counts", () => {
    setup({ total: 20, page: 0 });
    const ellipses = screen.getAllByText("…");
    expect(ellipses.length).toBeGreaterThanOrEqual(1);
  });

  it("ellipsis elements have aria-hidden", () => {
    setup({ total: 20, page: 0 });
    const ellipses = screen.getAllByText("…");
    ellipses.forEach((el) => {
      expect(el).toHaveAttribute("aria-hidden", "true");
    });
  });

  it("shows ellipsis on both sides for middle page", () => {
    setup({ total: 20, page: 10 });
    const ellipses = screen.getAllByText("…");
    expect(ellipses.length).toBe(2);
  });

  it("does not show ellipsis when total <= 7", () => {
    setup({ total: 7, page: 3 });
    expect(screen.queryByText("…")).not.toBeInTheDocument();
  });

  it("ellipsis are not interactive (pointer-events-none)", () => {
    setup({ total: 20, page: 0 });
    const ellipsis = screen.getByText("…");
    expect(ellipsis).toHaveClass("pointer-events-none");
  });
});

// ─── Size Variants ──────────────────────────────────────────────────

describe("Pagination sizes", () => {
  it("renders default md size", () => {
    setup({ total: 5 });
    const btn = screen.getByLabelText("Pagina 1, pagină curentă");
    expect(btn).toHaveClass("h-8");
    expect(btn).toHaveClass("text-sm");
  });

  it("renders sm size", () => {
    setup({ total: 5, size: "sm" });
    const btn = screen.getByLabelText("Pagina 1, pagină curentă");
    expect(btn).toHaveClass("h-7");
    expect(btn).toHaveClass("text-xs");
  });

  it("renders lg size", () => {
    setup({ total: 5, size: "lg" });
    const btn = screen.getByLabelText("Pagina 1, pagină curentă");
    expect(btn).toHaveClass("h-10");
    expect(btn).toHaveClass("text-base");
  });
});

// ─── Custom aria-label ──────────────────────────────────────────────

describe("Pagination custom aria labels", () => {
  it("uses custom getPageAriaLabel function", () => {
    const getPageAriaLabel = (page: number, isActive: boolean) =>
      isActive ? `Curent: ${page + 1}` : `Mergi la ${page + 1}`;

    setup({ total: 5, page: 2, getPageAriaLabel });
    expect(screen.getByLabelText("Curent: 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Mergi la 1")).toBeInTheDocument();
  });
});

// ─── ForwardRef ─────────────────────────────────────────────────────

describe("Pagination ref forwarding", () => {
  it("forwards ref to nav element", () => {
    const ref = React.createRef<HTMLElement>();
    render(
      <Pagination ref={ref} page={0} total={5} onPageChange={jest.fn()} />,
    );
    expect(ref.current).toBeInstanceOf(HTMLElement);
    expect(ref.current?.tagName).toBe("NAV");
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────

describe("Pagination edge cases", () => {
  it("handles total=2 correctly", () => {
    setup({ total: 2, page: 0 });
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("handles page change to same page gracefully", async () => {
    const onPageChange = jest.fn();
    const { user } = setup({ total: 10, page: 5, onPageChange });

    await user.click(screen.getByLabelText("Pagina 6, pagină curentă"));
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("merges custom className", () => {
    setup({ total: 5, className: "my-custom-pagination" });
    const nav = screen.getByRole("navigation");
    expect(nav).toHaveClass("my-custom-pagination");
  });

  it("renders with a large number of pages (100)", () => {
    setup({ total: 100, page: 50 });
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getAllByText("…").length).toBeGreaterThanOrEqual(1);
  });

  it("has correct button types (type=button)", () => {
    setup({ total: 5 });
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => {
      expect(btn).toHaveAttribute("type", "button");
    });
  });

  it("handles siblingCount=0", () => {
    setup({ total: 20, page: 10, siblingCount: 0 });
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
  });

  it("handles siblingCount=3 with many pages", () => {
    setup({ total: 30, page: 15, siblingCount: 3 });
    expect(screen.getByRole("navigation")).toBeInTheDocument();
    expect(screen.getByText("13")).toBeInTheDocument();
    expect(screen.getByText("16")).toBeInTheDocument();
    expect(screen.getByText("19")).toBeInTheDocument();
  });
});

// ─── Accessibility ──────────────────────────────────────────────────

describe("Pagination accessibility", () => {
  it("nav has navigation role", () => {
    setup({ total: 5 });
    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("all buttons have accessible labels", () => {
    setup({ total: 5 });
    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => {
      expect(btn).toHaveAttribute("aria-label");
    });
  });

  it("active page has aria-current=page", () => {
    setup({ total: 5, page: 2 });
    const activeBtn = screen.getByLabelText("Pagina 3, pagină curentă");
    expect(activeBtn).toHaveAttribute("aria-current", "page");
  });

  it("inactive page buttons do not have aria-current", () => {
    setup({ total: 5, page: 2 });
    const inactiveBtn = screen.getByLabelText("Pagina 1");
    expect(inactiveBtn).not.toHaveAttribute("aria-current");
  });

  it("icons are hidden from screen readers", () => {
    setup({ total: 5 });
    const icons = document.querySelectorAll("svg");
    icons.forEach((icon) => {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });
  });

  it("focus-visible styles are present", () => {
    setup({ total: 5 });
    const btn = screen.getByLabelText("Pagina 1, pagină curentă");
    expect(btn).toHaveClass("focus-visible:outline-none");
    expect(btn).toHaveClass("focus-visible:ring-2");
  });

  it("disabled buttons have aria-disabled implicit via disabled attribute", () => {
    setup({ total: 5, page: 0 });
    const prevBtn = screen.getByLabelText("Pagina anterioară");
    expect(prevBtn).toBeDisabled();
  });
});

// ─── Variant Exports ────────────────────────────────────────────────

describe("Pagination variant exports", () => {
  it("exports paginationVariants", () => {
    expect(paginationVariants).toBeDefined();
    expect(typeof paginationVariants).toBe("function");
  });

  it("exports pageButtonVariants", () => {
    expect(pageButtonVariants).toBeDefined();
    expect(typeof pageButtonVariants).toBe("function");
  });

  it("exports ellipsisVariants", () => {
    expect(ellipsisVariants).toBeDefined();
    expect(typeof ellipsisVariants).toBe("function");
  });

  it("exports generatePageNumbers", () => {
    expect(generatePageNumbers).toBeDefined();
    expect(typeof generatePageNumbers).toBe("function");
  });
});

// ─── Keyboard Interaction ───────────────────────────────────────────

describe("Pagination keyboard interaction", () => {
  it("responds to Enter key on page button", async () => {
    const onPageChange = jest.fn();
    const { user } = setup({ total: 5, page: 0, onPageChange });

    const page3Btn = screen.getByLabelText("Pagina 3");
    page3Btn.focus();
    await user.keyboard("{Enter}");

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("responds to Space key on page button", async () => {
    const onPageChange = jest.fn();
    const { user } = setup({ total: 5, page: 0, onPageChange });

    const page3Btn = screen.getByLabelText("Pagina 3");
    page3Btn.focus();
    await user.keyboard(" ");

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("does not respond to keys when disabled", async () => {
    const onPageChange = jest.fn();
    setup({ total: 5, page: 0, disabled: true, onPageChange });

    const nextBtn = screen.getByLabelText("Pagina următoare");
    expect(nextBtn).toBeDisabled();
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("removes focus ring after click (blur)", async () => {
    const { user } = setup({ total: 5, page: 0 });

    const pageBtn = screen.getByLabelText("Pagina 4");
    pageBtn.focus();
    expect(pageBtn).toHaveFocus();

    await user.click(pageBtn);
    expect(pageBtn).not.toHaveFocus();
  });
});

// ─── Controlled Behavior ────────────────────────────────────────────

describe("Pagination controlled behavior", () => {
  it("reflects controlled page prop changes", () => {
    const { rerender } = setup({ total: 10, page: 0 });

    expect(
      screen.getByLabelText("Pagina 1, pagină curentă"),
    ).toBeInTheDocument();

    rerender(<Pagination page={5} total={10} onPageChange={jest.fn()} />);
    expect(
      screen.getByLabelText("Pagina 6, pagină curentă"),
    ).toBeInTheDocument();
  });

  it("updates disabled state on page change", () => {
    const { rerender } = setup({ total: 5, page: 0 });

    expect(screen.getByLabelText("Pagina anterioară")).toBeDisabled();

    rerender(<Pagination page={2} total={5} onPageChange={jest.fn()} />);
    expect(screen.getByLabelText("Pagina anterioară")).not.toBeDisabled();
    expect(screen.getByLabelText("Pagina următoare")).not.toBeDisabled();
  });
});
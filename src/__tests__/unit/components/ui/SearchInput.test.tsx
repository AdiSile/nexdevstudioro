import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SearchInput,
  loadRecentSearches,
  saveRecentSearch,
  clearRecentSearches,
  defaultFilterSuggestions,
} from "@/components/ui/SearchInput";
import { Search, Tag } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════
// Mock localStorage
// ═══════════════════════════════════════════════════════════════════════

const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] ?? null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: jest.fn((index: number) => Object.keys(store)[index] ?? null),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

beforeEach(() => {
  localStorageMock.clear();
  jest.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

const mockSuggestions = [
  { id: "1", label: "Apple", description: "Fruct" },
  { id: "2", label: "Banana", description: "Fruct tropical" },
  { id: "3", label: "Avocado", description: "Legumă-fruct" },
  { id: "4", label: "Ananas", description: "Fruct exotic" },
  { id: "5", label: "Strugure", description: "Bobițe dulci" },
];

const setup = (props: React.ComponentProps<typeof SearchInput> = {}) => {
  const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
  const utils = render(<SearchInput {...props} />);
  const input = utils.container.querySelector("input")!;
  return { user, input, ...utils };
};

// ═══════════════════════════════════════════════════════════════════════
// Rendering
// ═══════════════════════════════════════════════════════════════════════

describe("SearchInput rendering", () => {
  it("renders an input element", () => {
    const { input } = setup();
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });

  it("renders with default type=text", () => {
    const { input } = setup();
    expect(input).toHaveAttribute("type", "text");
  });

  it("renders with a placeholder", () => {
    const { input } = setup({ placeholder: "Caută produse..." });
    expect(input).toHaveAttribute("placeholder", "Caută produse...");
  });

  it("has default placeholder 'Căutare...'", () => {
    const { input } = setup();
    expect(input).toHaveAttribute("placeholder", "Căutare...");
  });

  it("renders with a default value (uncontrolled)", () => {
    const { input } = setup({ defaultValue: "Hello" });
    expect(input).toHaveValue("Hello");
  });

  it("renders with a controlled value", () => {
    const { input } = setup({ value: "Controlled" });
    expect(input).toHaveValue("Controlled");
  });

  it("renders with name attribute", () => {
    const { input } = setup({ name: "search" });
    expect(input).toHaveAttribute("name", "search");
  });

  it("renders a search icon", () => {
    const { container } = setup();
    const icon = container.querySelector(".lucide-search");
    expect(icon).toBeInTheDocument();
  });

  it("has autocomplete off", () => {
    const { input } = setup();
    expect(input).toHaveAttribute("autocomplete", "off");
  });

  it("applies custom className to wrapper", () => {
    setup({ className: "custom-class" });
    const wrapper = screen.getByRole("combobox").closest("div.group");
    expect(wrapper).toHaveClass("custom-class");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Variants
// ═══════════════════════════════════════════════════════════════════════

describe("SearchInput variants", () => {
  it("renders default variant", () => {
    setup({ variant: "default" });
    const wrapper = screen.getByRole("combobox").closest("div.group");
    expect(wrapper).toHaveClass("border");
    expect(wrapper).toHaveClass("bg-surface");
  });

  it("renders filled variant", () => {
    setup({ variant: "filled" });
    const wrapper = screen.getByRole("combobox").closest("div.group");
    expect(wrapper).toHaveClass("bg-surface-secondary");
    expect(wrapper).toHaveClass("border-transparent");
  });

  it("renders underlined variant", () => {
    setup({ variant: "underlined" });
    const wrapper = screen.getByRole("combobox").closest("div.group");
    expect(wrapper).toHaveClass("border-0");
    expect(wrapper).toHaveClass("border-b-2");
    expect(wrapper).toHaveClass("rounded-none");
    expect(wrapper).toHaveClass("bg-transparent");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Sizes
// ═══════════════════════════════════════════════════════════════════════

describe("SearchInput sizes", () => {
  it("renders default md size", () => {
    const { input } = setup();
    expect(input).toHaveClass("h-10");
    expect(input).toHaveClass("text-sm");
  });

  it("renders sm size", () => {
    const { input } = setup({ inputSize: "sm" });
    expect(input).toHaveClass("h-8");
    expect(input).toHaveClass("text-xs");
  });

  it("renders lg size", () => {
    const { input } = setup({ inputSize: "lg" });
    expect(input).toHaveClass("h-12");
    expect(input).toHaveClass("text-base");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Label
// ═══════════════════════════════════════════════════════════════════════

describe("SearchInput label", () => {
  it("renders a label when label prop is provided", () => {
    setup({ label: "Căutare produse" });
    expect(screen.getByText("Căutare produse")).toBeInTheDocument();
  });

  it("associates label with input via htmlFor", () => {
    setup({ label: "Căutare", id: "search-id" });
    const label = screen.getByText("Căutare");
    expect(label).toHaveAttribute("for", "search-id");
  });

  it("does not render a label when label prop is omitted", () => {
    setup();
    expect(screen.queryByRole("label")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Clear button
// ═══════════════════════════════════════════════════════════════════════

describe("SearchInput clear button", () => {
  it("does not show clear button when input is empty", () => {
    setup({ showClearButton: true });
    expect(screen.queryByLabelText("Șterge căutarea")).not.toBeInTheDocument();
  });

  it("shows clear button when input has value", () => {
    setup({ showClearButton: true, defaultValue: "text" });
    expect(screen.getByLabelText("Șterge căutarea")).toBeInTheDocument();
  });

  it("clears the input value on click", async () => {
    const { user } = setup({
      showClearButton: true,
      defaultValue: "text",
    });
    const clearBtn = screen.getByLabelText("Șterge căutarea");
    await user.click(clearBtn);

    const input = screen.getByRole("combobox");
    expect(input).toHaveValue("");
  });

  it("does not show clear button when disabled", () => {
    setup({
      showClearButton: true,
      defaultValue: "text",
      disabled: true,
    });
    expect(screen.queryByLabelText("Șterge căutarea")).not.toBeInTheDocument();
  });

  it("does not show clear button when readOnly", () => {
    setup({
      showClearButton: true,
      defaultValue: "text",
      readOnly: true,
    });
    expect(screen.queryByLabelText("Șterge căutarea")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Disabled & Read-only
// ═══════════════════════════════════════════════════════════════════════

describe("SearchInput disabled state", () => {
  it("applies disabled attribute", () => {
    const { input } = setup({ disabled: true });
    expect(input).toBeDisabled();
  });

  it("applies disabled visual styles", () => {
    const { input } = setup({ disabled: true });
    expect(input).toHaveClass("cursor-not-allowed");
    expect(input).toHaveClass("opacity-50");
  });

  it("does not open dropdown when disabled", async () => {
    const { user, input } = setup({
      disabled: true,
      suggestions: mockSuggestions,
    });
    await user.click(input);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("SearchInput read-only state", () => {
  it("applies readOnly attribute", () => {
    const { input } = setup({ readOnly: true });
    expect(input).toHaveAttribute("readonly");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Full-width
// ═══════════════════════════════════════════════════════════════════════

describe("SearchInput full-width", () => {
  it("applies full-width class when fullWidth is true", () => {
    const { container } = setup({ fullWidth: true });
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass("w-full");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Suggestions Dropdown
// ═══════════════════════════════════════════════════════════════════════

describe("SearchInput suggestions dropdown", () => {
  it("shows dropdown on focus when suggestions exist", async () => {
    const { user, input } = setup({ suggestions: mockSuggestions });
    await user.click(input);
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
  });

  it("filters suggestions based on input", async () => {
    const { user, input } = setup({ suggestions: mockSuggestions });
    await user.click(input);
    await user.type(input, "ap");

    await waitFor(() => {
      expect(screen.getByText("Apple")).toBeInTheDocument();
    });
    expect(screen.queryByText("Banana")).not.toBeInTheDocument();
  });

  it("shows empty message when no suggestions match", async () => {
    const { user, input } = setup({
      suggestions: mockSuggestions,
      emptyMessage: "Niciun rezultat",
    });
    await user.click(input);
    await user.type(input, "zzz");

    await waitFor(() => {
      expect(screen.getByText("Niciun rezultat")).toBeInTheDocument();
    });
  });

  it("calls onSuggestionSelect when a suggestion is clicked", async () => {
    const onSuggestionSelect = jest.fn();
    const { user, input } = setup({
      suggestions: mockSuggestions,
      onSuggestionSelect,
    });
    await user.click(input);
    await user.type(input, "app");

    await waitFor(() => {
      expect(screen.getByText("Apple")).toBeInTheDocument();
    });

    const option = screen.getByText("Apple").closest('[role="option"]')!;
    await user.click(option);

    expect(onSuggestionSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "1", label: "Apple" }),
    );
  });

  it("closes dropdown on suggestion select when closeOnSelect is true", async () => {
    const { user, input } = setup({
      suggestions: mockSuggestions,
      closeOnSelect: true,
    });
    await user.click(input);
    await user.type(input, "app");

    await waitFor(() => {
      expect(screen.getByText("Apple")).toBeInTheDocument();
    });

    const option = screen.getByText("Apple").closest('[role="option"]')!;
    await user.click(option);

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  it("keeps dropdown open on suggestion select when closeOnSelect is false", async () => {
    const { user, input } = setup({
      suggestions: mockSuggestions,
      closeOnSelect: false,
    });
    await user.click(input);
    await user.type(input, "app");

    await waitFor(() => {
      expect(screen.getByText("Apple")).toBeInTheDocument();
    });

    const option = screen.getByText("Apple").closest('[role="option"]')!;
    await user.click(option);

    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("shows description text in suggestion items", async () => {
    const { user, input } = setup({ suggestions: mockSuggestions });
    await user.click(input);
    await user.type(input, "banana");

    await waitFor(() => {
      expect(screen.getByText("Fruct tropical")).toBeInTheDocument();
    });
  });

  it("renders suggestion icon when provided", async () => {
    const suggestionsWithIcon = [
      { id: "1", label: "Tagged", icon: <Tag data-testid="tag-icon" /> },
    ];
    const { user, input } = setup({ suggestions: suggestionsWithIcon });
    await user.click(input);

    await waitFor(() => {
      expect(screen.getByTestId("tag-icon")).toBeInTheDocument();
    });
  });

  it("shows all suggestions on empty query when showAllSuggestionsOnEmpty is true", async () => {
    const { user, input } = setup({
      suggestions: mockSuggestions,
      showAllSuggestionsOnEmpty: true,
    });
    await user.click(input);

    await waitFor(() => {
      expect(screen.getByText("Apple")).toBeInTheDocument();
      expect(screen.getByText("Banana")).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Loading State
// ═══════════════════════════════════════════════════════════════════════

describe("SearchInput loading state", () => {
  it("shows loading message when isLoading is true", async () => {
    const { user, input } = setup({
      suggestions: mockSuggestions,
      isLoading: true,
      minQueryLength: 0,
    });
    await user.click(input);

    await waitFor(() => {
      expect(screen.getByText("Searching...")).toBeInTheDocument();
    });
  });

  it("shows custom loading message", async () => {
    const { user, input } = setup({
      suggestions: mockSuggestions,
      isLoading: true,
      loadingMessage: "Se încarcă...",
      minQueryLength: 0,
    });
    await user.click(input);

    await waitFor(() => {
      expect(screen.getByText("Se încarcă...")).toBeInTheDocument();
    });
  });

  it("shows loading spinner icon in input when isLoading", () => {
    const { container } = setup({ isLoading: true });
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Recent Searches
// ═══════════════════════════════════════════════════════════════════════

describe("SearchInput recent searches", () => {
  it("shows recent searches on focus when enableRecent is true", async () => {
    localStorageMock.setItem("search-input-recent", JSON.stringify(["mere", "pere"]));

    const { user, input } = setup({
      enableRecent: true,
      suggestions: mockSuggestions,
    });

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByText("mere")).toBeInTheDocument();
      expect(screen.getByText("pere")).toBeInTheDocument();
    });
  });

  it("does not show recent searches when enableRecent is false", async () => {
    localStorageMock.setItem("search-input-recent", JSON.stringify(["mere"]));

    const { user, input } = setup({
      enableRecent: false,
      suggestions: mockSuggestions,
    });

    await user.click(input);

    await waitFor(() => {
      expect(screen.queryByText("mere")).not.toBeInTheDocument();
    });
  });

  it("saves search to recent when suggestion is selected", async () => {
    const { user, input } = setup({
      enableRecent: true,
      suggestions: mockSuggestions,
    });

    await user.click(input);
    await user.type(input, "app");

    await waitFor(() => {
      expect(screen.getByText("Apple")).toBeInTheDocument();
    });

    const option = screen.getByText("Apple").closest('[role="option"]')!;
    await user.click(option);

    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it("calls onRecentSelect when a recent search is clicked", async () => {
    localStorageMock.setItem("search-input-recent", JSON.stringify(["mere"]));

    const onRecentSelect = jest.fn();
    const { user, input } = setup({
      enableRecent: true,
      suggestions: mockSuggestions,
      onRecentSelect,
    });

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByText("mere")).toBeInTheDocument();
    });

    const option = screen.getByText("mere").closest('[role="option"]')!;
    await user.click(option);

    expect(onRecentSelect).toHaveBeenCalledWith("mere");
  });

  it("clears recent searches when clear button is clicked", async () => {
    localStorageMock.setItem("search-input-recent", JSON.stringify(["mere", "pere"]));

    const { user, input } = setup({
      enableRecent: true,
      suggestions: mockSuggestions,
    });

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByLabelText("Șterge căutările recente")).toBeInTheDocument();
    });

    const clearBtn = screen.getByLabelText("Șterge căutările recente");
    await user.click(clearBtn);

    expect(localStorageMock.removeItem).toHaveBeenCalledWith("search-input-recent");
  });

  it("shows custom recent label", async () => {
    localStorageMock.setItem("search-input-recent", JSON.stringify(["mere"]));

    const { user, input } = setup({
      enableRecent: true,
      suggestions: mockSuggestions,
      recentLabel: "Istoric căutări",
    });

    await user.click(input);

    await waitFor(() => {
      expect(screen.getByText("Istoric căutări")).toBeInTheDocument();
    });
  });

  it("filters recent searches based on query", async () => {
    localStorageMock.setItem("search-input-recent", JSON.stringify(["mere", "pere", "banane"]));

    const { user, input } = setup({
      enableRecent: true,
      suggestions: [],
    });

    await user.click(input);
    await user.type(input, "me");

    await waitFor(() => {
      expect(screen.getByText("mere")).toBeInTheDocument();
      expect(screen.queryByText("pere")).not.toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Debounce
// ═══════════════════════════════════════════════════════════════════════

describe("SearchInput debounce", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calls onSearch after debounce delay", () => {
    const onSearch = jest.fn();
    const { input } = setup({ onSearch, debounceMs: 300 });

    fireEvent.change(input, { target: { value: "test" } });

    expect(onSearch).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(onSearch).toHaveBeenCalledWith("test");
  });

  it("calls onValueChange immediately on change", () => {
    const onValueChange = jest.fn();
    const { input } = setup({ onValueChange });

    fireEvent.change(input, { target: { value: "a" } });

    expect(onValueChange).toHaveBeenCalledWith("a");
  });

  it("debounces multiple rapid keystrokes", () => {
    const onSearch = jest.fn();
    const { input } = setup({ onSearch, debounceMs: 300 });

    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.change(input, { target: { value: "ab" } });
    fireEvent.change(input, { target: { value: "abc" } });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(onSearch).toHaveBeenCalledTimes(1);
    expect(onSearch).toHaveBeenCalledWith("abc");
  });

  it("does not call onSearch below minQueryLength", () => {
    const onSearch = jest.fn();
    const { input } = setup({ onSearch, debounceMs: 300, minQueryLength: 3 });

    fireEvent.change(input, { target: { value: "ab" } });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(onSearch).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: "abc" } });

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(onSearch).toHaveBeenCalledWith("abc");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Keyboard Navigation
// ═══════════════════════════════════════════════════════════════════════

describe("SearchInput keyboard navigation", () => {
  it("opens dropdown on ArrowDown key", async () => {
    const { user, input } = setup({ suggestions: mockSuggestions });
    await user.click(input);
    await user.keyboard("{ArrowDown}");

    await waitFor(() => {
      const listbox = screen.getByRole("listbox");
      expect(listbox).toBeInTheDocument();
    });
  });

  it("highlights first item on ArrowDown", async () => {
    const { user, input } = setup({
      suggestions: mockSuggestions,
      showAllSuggestionsOnEmpty: true,
    });
    await user.click(input);
    await user.keyboard("{ArrowDown}");

    await waitFor(() => {
      const options = screen.getAllByRole("option");
      const firstHighlighted = options.find((o) =>
        o.hasAttribute("data-highlighted"),
      );
      expect(firstHighlighted).toBeInTheDocument();
    });
  });

  it("cycles through suggestions with ArrowDown and ArrowUp", async () => {
    const { user, input } = setup({
      suggestions: mockSuggestions,
      showAllSuggestionsOnEmpty: true,
    });
    await user.click(input);

    // ArrowDown to first
    await user.keyboard("{ArrowDown}");
    let options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("data-highlighted");

    // ArrowDown to second
    await user.keyboard("{ArrowDown}");
    options = screen.getAllByRole("option");
    expect(options[1]).toHaveAttribute("data-highlighted");

    // ArrowUp back to first
    await user.keyboard("{ArrowUp}");
    options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("data-highlighted");
  });

  it("selects suggestion with Enter key", async () => {
    const onSuggestionSelect = jest.fn();
    const { user, input } = setup({
      suggestions: mockSuggestions,
      onSuggestionSelect,
      showAllSuggestionsOnEmpty: true,
    });
    await user.click(input);
    await user.keyboard("{ArrowDown}"); // highlight first
    await user.keyboard("{Enter}");

    expect(onSuggestionSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "1", label: "Apple" }),
    );
  });

  it("closes dropdown on Escape", async () => {
    const { user, input } = setup({
      suggestions: mockSuggestions,
      showAllSuggestionsOnEmpty: true,
    });
    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  it("highlights last item on End key", async () => {
    const { user, input } = setup({
      suggestions: mockSuggestions,
      showAllSuggestionsOnEmpty: true,
    });
    await user.click(input);
    await user.keyboard("{End}");

    const options = screen.getAllByRole("option");
    const lastHighlighted = options[options.length - 1];
    expect(lastHighlighted).toHaveAttribute("data-highlighted");
  });

  it("highlights first item on Home key", async () => {
    const { user, input } = setup({
      suggestions: mockSuggestions,
      showAllSuggestionsOnEmpty: true,
    });
    await user.click(input);
    await user.keyboard("{End}"); // go to last
    await user.keyboard("{Home}"); // go back to first

    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("data-highlighted");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Controlled input
// ═══════════════════════════════════════════════════════════════════════

describe("SearchInput controlled", () => {
  it("reflects controlled value", () => {
    const { input, rerender } = render(
      <SearchInput value="initial" onValueChange={jest.fn()} />,
    );
    expect(input).toHaveValue("initial");

    rerender(<SearchInput value="updated" onValueChange={jest.fn()} />);
    expect(input).toHaveValue("updated");
  });

  it("calls onValueChange with the new value", async () => {
    const onValueChange = jest.fn();
    const { user, input } = setup({ value: "", onValueChange });
    await user.type(input, "a");
    expect(onValueChange).toHaveBeenCalled();
    expect(onValueChange).toHaveBeenCalledWith("a");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Ref forwarding
// ═══════════════════════════════════════════════════════════════════════

describe("SearchInput ref forwarding", () => {
  it("forwards ref to the input element", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<SearchInput ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("exposes focus method via ref", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<SearchInput ref={ref} />);
    ref.current?.focus();
    expect(ref.current).toHaveFocus();
  });

  it("exposes value via ref", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<SearchInput ref={ref} defaultValue="test value" />);
    expect(ref.current?.value).toBe("test value");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// ARIA attributes
// ═══════════════════════════════════════════════════════════════════════

describe("SearchInput accessibility", () => {
  it("has combobox role", () => {
    const { input } = setup();
    expect(input).toHaveAttribute("role", "combobox");
  });

  it("has aria-expanded false when dropdown is closed", () => {
    const { input } = setup({ suggestions: mockSuggestions });
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("has aria-expanded true when dropdown is open", async () => {
    const { user, input } = setup({
      suggestions: mockSuggestions,
      showAllSuggestionsOnEmpty: true,
    });
    await user.click(input);

    await waitFor(() => {
      expect(input).toHaveAttribute("aria-expanded", "true");
    });
  });

  it("has aria-haspopup=listbox", () => {
    const { input } = setup();
    expect(input).toHaveAttribute("aria-haspopup", "listbox");
  });

  it("has aria-autocomplete=list", () => {
    const { input } = setup();
    expect(input).toHaveAttribute("aria-autocomplete", "list");
  });

  it("sets aria-activedescendant when item is highlighted", async () => {
    const { user, input } = setup({
      suggestions: mockSuggestions,
      showAllSuggestionsOnEmpty: true,
    });
    await user.click(input);
    await user.keyboard("{ArrowDown}");

    await waitFor(() => {
      expect(input).toHaveAttribute("aria-activedescendant");
    });
  });

  it("dropdown has listbox role", async () => {
    const { user, input } = setup({
      suggestions: mockSuggestions,
      showAllSuggestionsOnEmpty: true,
    });
    await user.click(input);

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
  });

  it("suggestion items have option role", async () => {
    const { user, input } = setup({
      suggestions: mockSuggestions,
      showAllSuggestionsOnEmpty: true,
    });
    await user.click(input);

    await waitFor(() => {
      const options = screen.getAllByRole("option");
      expect(options.length).toBeGreaterThan(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Custom filter
// ═══════════════════════════════════════════════════════════════════════

describe("SearchInput custom filterSuggestions", () => {
  it("uses custom filter function", async () => {
    const customFilter = jest.fn((query, suggestions) => {
      return suggestions.filter((s) => s.label.startsWith(query));
    });

    const { user, input } = setup({
      suggestions: mockSuggestions,
      filterSuggestions: customFilter,
    });

    await user.click(input);
    await user.type(input, "A");

    await waitFor(() => {
      expect(customFilter).toHaveBeenCalled();
      // "Apple", "Avocado", "Ananas" start with "A" (Banana nu, Strugure nu)
      expect(screen.getByText("Apple")).toBeInTheDocument();
      expect(screen.getByText("Avocado")).toBeInTheDocument();
      expect(screen.getByText("Ananas")).toBeInTheDocument();
      expect(screen.queryByText("Banana")).not.toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Suggestions grouping
// ═══════════════════════════════════════════════════════════════════════

describe("SearchInput grouped suggestions", () => {
  it("renders group labels", async () => {
    const grouped = [
      { id: "1", label: "Măr", group: "Fructe" },
      { id: "2", label: "Păr", group: "Fructe" },
      { id: "3", label: "Roșie", group: "Legume" },
    ];

    const { user, input } = setup({
      suggestions: grouped,
      showAllSuggestionsOnEmpty: true,
    });
    await user.click(input);

    await waitFor(() => {
      expect(screen.getByText("Fructe")).toBeInTheDocument();
      expect(screen.getByText("Legume")).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Display name
// ═══════════════════════════════════════════════════════════════════════

describe("SearchInput displayName", () => {
  it("has display name 'SearchInput'", () => {
    expect(SearchInput.displayName).toBe("SearchInput");
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Recent searches helpers
// ═══════════════════════════════════════════════════════════════════════

describe("Recent searches helpers", () => {
  describe("loadRecentSearches", () => {
    it("returns empty array when no data in storage", () => {
      expect(loadRecentSearches("test-key", 10)).toEqual([]);
    });

    it("returns parsed array from storage", () => {
      localStorageMock.setItem("test-key", JSON.stringify(["a", "b", "c"]));
      expect(loadRecentSearches("test-key", 10)).toEqual(["a", "b", "c"]);
    });

    it("respects maxRecent limit", () => {
      localStorageMock.setItem(
        "test-key",
        JSON.stringify(["a", "b", "c", "d", "e"]),
      );
      expect(loadRecentSearches("test-key", 3)).toEqual(["a", "b", "c"]);
    });

    it("filters out non-string values", () => {
      localStorageMock.setItem("test-key", JSON.stringify(["a", 123, "b", null]));
      expect(loadRecentSearches("test-key", 10)).toEqual(["a", "b"]);
    });

    it("returns empty array for invalid JSON", () => {
      localStorageMock.setItem("test-key", "not-json");
      expect(loadRecentSearches("test-key", 10)).toEqual([]);
    });
  });

  describe("saveRecentSearch", () => {
    it("saves a new query", () => {
      const result = saveRecentSearch("test-key", "mere", 10);
      expect(result).toEqual(["mere"]);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    it("moves existing query to the top", () => {
      localStorageMock.setItem("test-key", JSON.stringify(["pere", "mere"]));
      const result = saveRecentSearch("test-key", "mere", 10);
      expect(result).toEqual(["mere", "pere"]);
    });

    it("respects maxRecent limit", () => {
      localStorageMock.setItem(
        "test-key",
        JSON.stringify(["a", "b", "c", "d"]),
      );
      const result = saveRecentSearch("test-key", "e", 4);
      expect(result).toEqual(["e", "a", "b", "c"]);
    });

    it("does not save empty query", () => {
      const result = saveRecentSearch("test-key", "   ", 10);
      expect(result).toEqual([]);
    });

    it("trims white-space", () => {
      const result = saveRecentSearch("test-key", "  mere  ", 10);
      expect(result).toEqual(["mere"]);
    });
  });

  describe("clearRecentSearches", () => {
    it("removes the storage key", () => {
      localStorageMock.setItem("test-key", JSON.stringify(["a", "b"]));
      clearRecentSearches("test-key");
      expect(localStorageMock.removeItem).toHaveBeenCalledWith("test-key");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// defaultFilterSuggestions
// ═══════════════════════════════════════════════════════════════════════

describe("defaultFilterSuggestions", () => {
  it("returns all suggestions when query is empty", () => {
    const result = defaultFilterSuggestions("", mockSuggestions);
    expect(result).toEqual(mockSuggestions);
  });

  it("filters by label (case-insensitive)", () => {
    const result = defaultFilterSuggestions("apple", mockSuggestions);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("Apple");
  });

  it("filters by description", () => {
    const result = defaultFilterSuggestions("legumă", mockSuggestions);
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("Avocado");
  });

  it("returns empty array when no match", () => {
    const result = defaultFilterSuggestions("zzz", mockSuggestions);
    expect(result).toHaveLength(0);
  });
});
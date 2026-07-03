import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input, applyMask, stripMask, MASK_PATTERNS } from "@/components/ui/Input";
import { Mail, Search, Lock } from "lucide-react";

// ─── Helpers ────────────────────────────────────────────────────────
const setup = (props: React.ComponentProps<typeof Input> = {}) => {
  const user = userEvent.setup();
  const utils = render(<Input {...props} />);
  const input = utils.container.querySelector("input")!;
  return { user, input, ...utils };
};

// ─── Rendering ──────────────────────────────────────────────────────
describe("Input rendering", () => {
  it("renders an input element", () => {
    const { input } = setup();
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe("INPUT");
  });

  it("renders with default type=text", () => {
    const { input } = setup();
    expect(input).toHaveAttribute("type", "text");
  });

  it("renders with a custom type", () => {
    const { input } = setup({ type: "email" });
    expect(input).toHaveAttribute("type", "email");
  });

  it("renders with a placeholder", () => {
    const { input } = setup({ placeholder: "Enter your name" });
    expect(input).toHaveAttribute("placeholder", "Enter your name");
  });

  it("renders with a default value (uncontrolled)", () => {
    const { input } = setup({ defaultValue: "Hello" });
    expect(input).toHaveValue("Hello");
  });

  it("renders with a controlled value", () => {
    const { input } = setup({ value: "Controlled" });
    expect(input).toHaveValue("Controlled");
  });

  it("applies name attribute", () => {
    const { input } = setup({ name: "email" });
    expect(input).toHaveAttribute("name", "email");
  });

  it("renders autoComplete attribute", () => {
    const { input } = setup({ autoComplete: "off" });
    expect(input).toHaveAttribute("autocomplete", "off");
  });
});

// ─── Variants ───────────────────────────────────────────────────────
describe("Input variants", () => {
  it("renders default variant", () => {
    setup({ variant: "default" });
    const wrapper = screen.getByRole("textbox").closest("div.group");
    expect(wrapper).toHaveClass("border");
    expect(wrapper).toHaveClass("bg-surface");
  });

  it("renders filled variant", () => {
    setup({ variant: "filled" });
    const wrapper = screen.getByRole("textbox").closest("div.group");
    expect(wrapper).toHaveClass("bg-surface-secondary");
    expect(wrapper).toHaveClass("border-transparent");
  });

  it("renders underlined variant", () => {
    setup({ variant: "underlined" });
    const wrapper = screen.getByRole("textbox").closest("div.group");
    expect(wrapper).toHaveClass("border-0");
    expect(wrapper).toHaveClass("border-b-2");
    expect(wrapper).toHaveClass("rounded-none");
    expect(wrapper).toHaveClass("bg-transparent");
  });
});

// ─── Sizes ──────────────────────────────────────────────────────────
describe("Input sizes", () => {
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

// ─── Label ──────────────────────────────────────────────────────────
describe("Input label", () => {
  it("renders a label when label prop is provided", () => {
    setup({ label: "Email address" });
    expect(screen.getByText("Email address")).toBeInTheDocument();
  });

  it("associates label with input via htmlFor", () => {
    setup({ label: "Username", id: "username" });
    const label = screen.getByText("Username");
    expect(label).toHaveAttribute("for", "username");
  });

  it("does not render a label when label prop is omitted", () => {
    setup();
    expect(screen.queryByRole("label")).not.toBeInTheDocument();
  });

  it("applies disabled styling to label when input is disabled", () => {
    setup({ label: "Disabled field", disabled: true });
    const label = screen.getByText("Disabled field");
    expect(label).toHaveClass("opacity-50");
    expect(label).toHaveClass("cursor-not-allowed");
  });
});

// ─── Required ───────────────────────────────────────────────────────
describe("Input required", () => {
  it("shows asterisk indicator when required", () => {
    setup({ label: "Name", required: true });
    const asterisk = screen.getByText("*");
    expect(asterisk).toBeInTheDocument();
    expect(asterisk).toHaveAttribute("aria-hidden", "true");
  });

  it("has screen-reader text for required", () => {
    setup({ label: "Name", required: true });
    expect(screen.getByText("(required)")).toHaveClass("sr-only");
  });

  it("sets aria-required on input", () => {
    const { input } = setup({ required: true });
    expect(input).toHaveAttribute("aria-required", "true");
  });

  it("sets native required attribute", () => {
    const { input } = setup({ required: true });
    expect(input).toBeRequired();
  });

  it("does not show asterisk when not required", () => {
    setup({ label: "Optional" });
    expect(screen.queryByText("*")).not.toBeInTheDocument();
  });
});

// ─── Error state ────────────────────────────────────────────────────
describe("Input error state", () => {
  it("renders error message", () => {
    setup({ error: "This field is required" });
    expect(screen.getByText("This field is required")).toBeInTheDocument();
  });

  it("renders error with alert role for screen readers", () => {
    setup({ error: "Invalid email" });
    const errorEl = screen.getByRole("alert");
    expect(errorEl).toHaveTextContent("Invalid email");
  });

  it("sets aria-invalid when error is present", () => {
    const { input } = setup({ error: "Bad input" });
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("sets aria-errormessage pointing to error element", () => {
    const { input } = setup({ error: "Bad input", id: "test-input" });
    expect(input).toHaveAttribute("aria-errormessage", "test-input-error");
  });

  it("error message has danger color", () => {
    setup({ error: "Oops" });
    const errorEl = screen.getByRole("alert");
    expect(errorEl).toHaveClass("text-danger-600");
  });

  it("does not show hint when error is present", () => {
    setup({ error: "Error", hint: "Helper text" });
    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.queryByText("Helper text")).not.toBeInTheDocument();
  });
});

// ─── Hint ───────────────────────────────────────────────────────────
describe("Input hint", () => {
  it("renders hint text", () => {
    setup({ hint: "Must be at least 8 characters" });
    expect(screen.getByText("Must be at least 8 characters")).toBeInTheDocument();
  });

  it("associates hint with input via aria-describedby", () => {
    const { input } = setup({ hint: "Helper", id: "field1" });
    expect(input).toHaveAttribute("aria-describedby", "field1-hint");
  });

  it("hint has tertiary text color by default", () => {
    setup({ hint: "Helper text" });
    const hintEl = screen.getByText("Helper text");
    expect(hintEl.parentElement).toHaveClass("text-text-tertiary");
  });
});

// ─── Validation states ──────────────────────────────────────────────
describe("Input validation states", () => {
  it("applies valid state styles", () => {
    setup({ validation: "valid" });
    const wrapper = screen.getByRole("textbox").closest("div.group");
    expect(wrapper).toHaveClass("border-success-500");
  });

  it("shows valid icon when validation=valid", () => {
    const { container } = setup({ validation: "valid" });
    const icon = container.querySelector(".text-success-500");
    expect(icon).toBeInTheDocument();
  });

  it("applies invalid state styles", () => {
    setup({ validation: "invalid" });
    const wrapper = screen.getByRole("textbox").closest("div.group");
    expect(wrapper).toHaveClass("border-danger-500");
  });

  it("sets aria-invalid when validation=invalid", () => {
    const { input } = setup({ validation: "invalid" });
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("does not set aria-invalid for valid state", () => {
    const { input } = setup({ validation: "valid" });
    expect(input).not.toHaveAttribute("aria-invalid");
  });

  it("applies warning state styles", () => {
    setup({ validation: "warning" });
    const wrapper = screen.getByRole("textbox").closest("div.group");
    expect(wrapper).toHaveClass("border-warning-500");
  });

  it("shows warning icon when validation=warning", () => {
    const { container } = setup({ validation: "warning" });
    const icon = container.querySelector(".text-warning-500");
    expect(icon).toBeInTheDocument();
  });

  it("hint text reflects validation color for valid state", () => {
    setup({ validation: "valid", hint: "Looks good!" });
    const hintEl = screen.getByText("Looks good!").parentElement;
    expect(hintEl).toHaveClass("text-success-600");
  });

  it("hint text reflects validation color for warning state", () => {
    setup({ validation: "warning", hint: "Be careful" });
    const hintEl = screen.getByText("Be careful").parentElement;
    expect(hintEl).toHaveClass("text-warning-600");
  });
});

// ─── Icons ──────────────────────────────────────────────────────────
describe("Input icons", () => {
  it("renders left icon", () => {
    setup({ iconLeft: <Mail data-testid="mail-icon" /> });
    expect(screen.getByTestId("mail-icon")).toBeInTheDocument();
  });

  it("left icon is aria-hidden", () => {
    setup({ iconLeft: <Mail data-testid="mail-icon" /> });
    const wrapper = screen.getByTestId("mail-icon").parentElement;
    expect(wrapper).toHaveAttribute("aria-hidden", "true");
  });

  it("renders right icon", () => {
    setup({ iconRight: <Search data-testid="search-icon" /> });
    expect(screen.getByTestId("search-icon")).toBeInTheDocument();
  });

  it("renders both left and right icons", () => {
    setup({
      iconLeft: <Mail data-testid="mail-icon" />,
      iconRight: <Search data-testid="search-icon" />,
    });
    expect(screen.getByTestId("mail-icon")).toBeInTheDocument();
    expect(screen.getByTestId("search-icon")).toBeInTheDocument();
  });
});

// ─── Password toggle ────────────────────────────────────────────────
describe("Password toggle", () => {
  it("shows toggle button when showPasswordToggle is true and type=password", () => {
    setup({ type: "password", showPasswordToggle: true });
    expect(screen.getByLabelText("Show password")).toBeInTheDocument();
  });

  it("does not show toggle for non-password types", () => {
    setup({ type: "text", showPasswordToggle: true });
    expect(screen.queryByLabelText("Show password")).not.toBeInTheDocument();
  });

  it("toggles visibility on click", async () => {
    const { user, input } = setup({
      type: "password",
      showPasswordToggle: true,
    });
    expect(input).toHaveAttribute("type", "password");

    const toggle = screen.getByLabelText("Show password");
    await user.click(toggle);

    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByLabelText("Hide password")).toBeInTheDocument();
  });

  it("toggles aria-pressed", async () => {
    const { user } = setup({ type: "password", showPasswordToggle: true });
    const toggle = screen.getByLabelText("Show password");
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("does not show toggle when disabled", () => {
    setup({ type: "password", showPasswordToggle: true, disabled: true });
    expect(screen.queryByLabelText("Show password")).not.toBeInTheDocument();
  });
});

// ─── Clear button ───────────────────────────────────────────────────
describe("Clear button", () => {
  it("does not show clear button when input is empty", () => {
    setup({ showClearButton: true });
    expect(screen.queryByLabelText("Clear input")).not.toBeInTheDocument();
  });

  it("shows clear button when input has value", async () => {
    const { user } = setup({ showClearButton: true, defaultValue: "text" });
    expect(screen.getByLabelText("Clear input")).toBeInTheDocument();
  });

  it("clears the input value on click", async () => {
    const onChange = jest.fn();
    const { user } = setup({
      showClearButton: true,
      defaultValue: "text",
      onChange,
    });
    const clearBtn = screen.getByLabelText("Clear input");
    await user.click(clearBtn);

    const input = screen.getByRole("textbox");
    expect(input).toHaveValue("");
  });

  it("does not show clear button when disabled", () => {
    setup({ showClearButton: true, defaultValue: "text", disabled: true });
    expect(screen.queryByLabelText("Clear input")).not.toBeInTheDocument();
  });

  it("does not show clear button when readOnly", () => {
    setup({ showClearButton: true, defaultValue: "text", readOnly: true });
    expect(screen.queryByLabelText("Clear input")).not.toBeInTheDocument();
  });
});

// ─── Disabled state ─────────────────────────────────────────────────
describe("Input disabled state", () => {
  it("applies disabled attribute", () => {
    const { input } = setup({ disabled: true });
    expect(input).toBeDisabled();
  });

  it("applies disabled visual styles", () => {
    const { input } = setup({ disabled: true });
    expect(input).toHaveClass("cursor-not-allowed");
    expect(input).toHaveClass("opacity-50");
  });

  it("does not call onChange when disabled", async () => {
    const onChange = jest.fn();
    const { user, input } = setup({ disabled: true, onChange });
    await user.type(input, "hello");
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ─── Read-only state ────────────────────────────────────────────────
describe("Input read-only state", () => {
  it("applies readOnly attribute", () => {
    const { input } = setup({ readOnly: true });
    expect(input).toHaveAttribute("readonly");
  });

  it("applies read-only visual styles", () => {
    const { input } = setup({ readOnly: true });
    expect(input).toHaveClass("cursor-default");
  });

  it("does not disable the input visually like disabled", () => {
    const { input } = setup({ readOnly: true });
    expect(input).not.toHaveClass("opacity-50");
  });
});

// ─── Full-width ─────────────────────────────────────────────────────
describe("Input full-width", () => {
  it("applies full-width class when fullWidth is true", () => {
    setup({ fullWidth: true });
    const wrapper = screen.getByRole("textbox").closest("div.group");
    expect(wrapper).toHaveClass("w-full");
  });

  it("does not apply full-width by default", () => {
    setup();
    const wrapper = screen.getByRole("textbox").closest("div.group");
    expect(wrapper).not.toHaveClass("w-full");
  });

  it("outer container is full-width", () => {
    const { container } = setup({ fullWidth: true });
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv).toHaveClass("w-full");
  });
});

// ─── Controlled input ───────────────────────────────────────────────
describe("Controlled input", () => {
  it("reflects controlled value", () => {
    const { input, rerender } = render(
      <Input value="initial" onChange={jest.fn()} />,
    );
    expect(input).toHaveValue("initial");

    rerender(<Input value="updated" onChange={jest.fn()} />);
    expect(input).toHaveValue("updated");
  });

  it("calls onChange with the new value", async () => {
    const onChange = jest.fn();
    const { user, input } = setup({ value: "", onChange });
    await user.type(input, "a");
    expect(onChange).toHaveBeenCalled();
    const callArg = onChange.mock.calls[0][0];
    expect(callArg.target.value).toBe("a");
  });
});

// ─── Uncontrolled input ─────────────────────────────────────────────
describe("Uncontrolled input", () => {
  it("allows typing without onChange", async () => {
    const { user, input } = setup();
    await user.type(input, "hello world");
    expect(input).toHaveValue("hello world");
  });

  it("uses defaultValue", () => {
    const { input } = setup({ defaultValue: "prefilled" });
    expect(input).toHaveValue("prefilled");
  });
});

// ─── onFocus / onBlur ───────────────────────────────────────────────
describe("Input focus/blur", () => {
  it("calls onFocus when input receives focus", async () => {
    const onFocus = jest.fn();
    const { user, input } = setup({ onFocus });
    await user.click(input);
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it("calls onBlur when input loses focus", async () => {
    const onBlur = jest.fn();
    const { user, input } = setup({ onBlur });
    await user.click(input);
    await user.tab();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("can be focused via keyboard Tab", () => {
    const { input } = setup();
    input.focus();
    expect(input).toHaveFocus();
  });
});

// ─── Ref forwarding ─────────────────────────────────────────────────
describe("Input ref forwarding", () => {
  it("forwards ref to the input element", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("exposes focus method via ref", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} />);
    ref.current?.focus();
    expect(ref.current).toHaveFocus();
  });

  it("exposes value via ref", () => {
    const ref = React.createRef<HTMLInputElement>();
    render(<Input ref={ref} defaultValue="test value" />);
    expect(ref.current?.value).toBe("test value");
  });
});

// ─── Custom className ───────────────────────────────────────────────
describe("Input custom className", () => {
  it("merges custom className on wrapper", () => {
    setup({ className: "custom-wrapper" });
    const wrapper = screen.getByRole("textbox").closest("div.group");
    expect(wrapper).toHaveClass("custom-wrapper");
  });

  it("preserves variant styles with custom className", () => {
    setup({ className: "custom", variant: "filled" });
    const wrapper = screen.getByRole("textbox").closest("div.group");
    expect(wrapper).toHaveClass("custom");
    expect(wrapper).toHaveClass("bg-surface-secondary");
  });
});

// ─── Accessibility ──────────────────────────────────────────────────
describe("Input accessibility", () => {
  it("renders as a textbox role", () => {
    setup();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("accepts aria-label", () => {
    setup({ "aria-label": "Search field" });
    expect(screen.getByLabelText("Search field")).toBeInTheDocument();
  });

  it("accepts aria-describedby combined with hint", () => {
    const { input } = setup({
      hint: "Helper",
      "aria-describedby": "external-hint",
      id: "myinput",
    });
    const describedby = input.getAttribute("aria-describedby");
    expect(describedby).toContain("myinput-hint");
    expect(describedby).toContain("external-hint");
  });

  it("accepts aria-labelledby", () => {
    const { input } = setup({ "aria-labelledby": "external-label" });
    expect(input).toHaveAttribute("aria-labelledby", "external-label");
  });

  it("is keyboard accessible", () => {
    const { input } = setup();
    input.focus();
    expect(input).toHaveFocus();
  });

  it("accepts text input via keyboard", async () => {
    const { user, input } = setup();
    await user.type(input, "abc");
    expect(input).toHaveValue("abc");
  });

  it("autogenerates unique id", () => {
    const { input: input1 } = setup();
    const { input: input2 } = setup();
    expect(input1.id).not.toBe(input2.id);
    expect(input1.id).toBeTruthy();
    expect(input2.id).toBeTruthy();
  });

  it("uses provided id over autogenerated one", () => {
    const { input } = setup({ id: "custom-id" });
    expect(input.id).toBe("custom-id");
  });
});

// ─── Mask Utilities ─────────────────────────────────────────────────
describe("Mask utilities", () => {
  describe("applyMask", () => {
    it("returns raw value when no pattern is provided", () => {
      expect(applyMask("hello", "")).toBe("hello");
    });

    it("applies phone mask", () => {
      expect(applyMask("5551234567", MASK_PATTERNS.phone)).toBe("(555) 123-4567");
    });

    it("applies phone mask partially", () => {
      expect(applyMask("555", MASK_PATTERNS.phone)).toBe("(555) ");
    });

    it("applies credit card mask", () => {
      expect(applyMask("1234567890123456", MASK_PATTERNS.creditCard)).toBe(
        "1234 5678 9012 3456",
      );
    });

    it("applies date mask", () => {
      expect(applyMask("12252023", MASK_PATTERNS.date)).toBe("12/25/2023");
    });

    it("applies ISO date mask", () => {
      expect(applyMask("20231225", MASK_PATTERNS.dateIso)).toBe("2023-12-25");
    });

    it("applies SSN mask", () => {
      expect(applyMask("123456789", MASK_PATTERNS.ssn)).toBe("123-45-6789");
    });

    it("applies ZIP+4 mask", () => {
      expect(applyMask("123456789", MASK_PATTERNS.zipPlus4)).toBe("12345-6789");
    });

    it("handles custom mask pattern", () => {
      expect(applyMask("ABC123", "AAA-999")).toBe("ABC-123");
    });

    it("skips non-matching characters", () => {
      expect(applyMask("abc123", "999-999")).toBe("123");
    });

    it("returns empty string for empty input", () => {
      expect(applyMask("", MASK_PATTERNS.phone)).toBe("");
    });

    it("handles input shorter than pattern", () => {
      expect(applyMask("123", "999-999-999")).toBe("123");
    });
  });

  describe("stripMask", () => {
    it("removes all non-word characters", () => {
      expect(stripMask("(555) 123-4567")).toBe("5551234567");
    });

    it("returns same string if no mask chars", () => {
      expect(stripMask("hello")).toBe("hello");
    });

    it("handles empty string", () => {
      expect(stripMask("")).toBe("");
    });
  });
});

// ─── Mask integration ───────────────────────────────────────────────
describe("Input mask integration", () => {
  it("applies mask while typing", async () => {
    const { user, input } = setup({ mask: MASK_PATTERNS.phone });
    await user.type(input, "5551234567");
    expect(input).toHaveValue("(555) 123-4567");
  });

  it("calls onMaskedValue with raw value", async () => {
    const onMaskedValue = jest.fn();
    const { user, input } = setup({
      mask: MASK_PATTERNS.phone,
      onMaskedValue,
    });
    await user.type(input, "5551234567");
    expect(onMaskedValue).toHaveBeenLastCalledWith("5551234567");
  });

  it("preserves cursor position while typing with mask", async () => {
    const { user, input } = setup({ mask: MASK_PATTERNS.date });
    await user.type(input, "12252023");
    expect(input).toHaveValue("12/25/2023");
  });

  it("calls onChange with masked value", async () => {
    const onChange = jest.fn();
    const { user, input } = setup({
      mask: MASK_PATTERNS.ssn,
      onChange,
    });
    await user.type(input, "123456789");
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.target.value).toBe("123-45-6789");
  });

  it("clear button also clears onMaskedValue", async () => {
    const onMaskedValue = jest.fn();
    const { user } = setup({
      mask: MASK_PATTERNS.phone,
      showClearButton: true,
      defaultValue: "5551234567",
      onMaskedValue,
    });
    const clearBtn = screen.getByLabelText("Clear input");
    await user.click(clearBtn);
    expect(onMaskedValue).toHaveBeenCalledWith("");
  });
});

// ─── Edge cases ─────────────────────────────────────────────────────
describe("Input edge cases", () => {
  it("renders without any props", () => {
    const { input } = setup();
    expect(input).toBeInTheDocument();
  });

  it("handles empty string value", () => {
    const { input } = setup({ value: "" });
    expect(input).toHaveValue("");
  });

  it("handles numeric value as string", () => {
    const { input } = setup({ value: "123" });
    expect(input).toHaveValue("123");
  });

  it("handles number type", () => {
    const { input } = setup({ type: "number" });
    expect(input).toHaveAttribute("type", "number");
  });

  it("supports maxLength attribute", () => {
    const { input } = setup({ maxLength: 10 });
    expect(input).toHaveAttribute("maxlength", "10");
  });

  it("supports inputMode attribute", () => {
    const { input } = setup({ inputMode: "numeric" });
    expect(input).toHaveAttribute("inputmode", "numeric");
  });

  it("supports pattern attribute", () => {
    const { input } = setup({ pattern: "[A-Za-z]+" });
    expect(input).toHaveAttribute("pattern", "[A-Za-z]+");
  });

  it("supports spellCheck attribute", () => {
    const { input } = setup({ spellCheck: false });
    expect(input).toHaveAttribute("spellcheck", "false");
  });

  it("label associates correctly when using autogenerated id", () => {
    setup({ label: "Auto ID" });
    const label = screen.getByText("Auto ID");
    const input = screen.getByRole("textbox");
    expect(label).toHaveAttribute("for", input.id);
  });

  it("renders both hint and validation icon together", () => {
    const { container } = setup({
      validation: "valid",
      hint: "All good",
    });
    expect(screen.getByText("All good")).toBeInTheDocument();
    expect(container.querySelector(".text-success-500")).toBeInTheDocument();
  });

  it("error takes precedence over validation prop", () => {
    setup({ validation: "valid", error: "Something went wrong" });
    expect(screen.getByRole("alert")).toHaveTextContent("Something went wrong");
    const input = screen.getByRole("textbox");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });
});

// ─── Display name ───────────────────────────────────────────────────
describe("Input displayName", () => {
  it("has display name 'Input'", () => {
    expect(Input.displayName).toBe("Input");
  });
});

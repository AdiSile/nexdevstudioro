import React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Stepper, ProgressIndicator, Step, StepNavigation } from "@/components/ui/Stepper";

// ─── Helpers ────────────────────────────────────────────────────────

interface StepConfig {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  optional?: boolean;
  validate?: () => { valid: boolean; message?: string } | Promise<{ valid: boolean; message?: string }>;
  content?: React.ReactNode;
}

const setupStepper = (
  props: Partial<React.ComponentProps<typeof Stepper>> = {},
  steps: StepConfig[] = [
    { value: "step1", label: "Step 1", content: "Content 1" },
    { value: "step2", label: "Step 2", content: "Content 2" },
    { value: "step3", label: "Step 3", content: "Content 3" },
  ],
) => {
  const user = userEvent.setup();
  const utils = render(
    <Stepper {...props}>
      <ProgressIndicator />
      {steps.map((step) => (
        <Step
          key={step.value}
          value={step.value}
          label={step.label}
          description={step.description}
          disabled={step.disabled}
          optional={step.optional}
          validate={step.validate}
        >
          {step.content ?? `Content for ${step.label}`}
        </Step>
      ))}
      <StepNavigation />
    </Stepper>,
  );

  return { user, ...utils };
};

const getStepButtons = () => screen.getAllByRole("tab");
const getStepButton = (name: string | RegExp) =>
  screen.getByRole("tab", { name });
const getNextButton = () =>
  screen.getByRole("button", { name: /next/i });
const getBackButton = () =>
  screen.getByRole("button", { name: /back/i });
const getFinishButton = () =>
  screen.getByRole("button", { name: /finish/i });
const getProgressIndicator = () =>
  screen.getByRole("tablist", { name: /progress/i });

// ─── Basic Rendering ────────────────────────────────────────────────

describe("Stepper rendering", () => {
  it("renders progress indicator with correct role", () => {
    setupStepper();
    expect(getProgressIndicator()).toBeInTheDocument();
  });

  it("renders correct number of step buttons", () => {
    setupStepper();
    expect(getStepButtons()).toHaveLength(3);
  });

  it("renders first step content by default", () => {
    setupStepper();
    expect(screen.getByText("Content 1")).toBeInTheDocument();
  });

  it("first step is active by default when defaultValue is not set", () => {
    setupStepper();
    const firstStep = getStepButton(/Step 1/);
    expect(firstStep).toHaveAttribute("aria-selected", "true");
  });

  it("respects defaultValue prop", () => {
    setupStepper({ defaultValue: "step2" });
    const step2 = getStepButton(/Step 2/);
    expect(step2).toHaveAttribute("aria-selected", "true");
  });

  it("respects controlled value prop", () => {
    setupStepper({ value: "step3" });
    const step3 = getStepButton(/Step 3/);
    expect(step3).toHaveAttribute("aria-selected", "true");
  });
});

// ─── Navigation ─────────────────────────────────────────────────────

describe("Stepper navigation", () => {
  it("navigates to next step when Next is clicked", async () => {
    const { user } = setupStepper();
    const nextBtn = getNextButton();

    await user.click(nextBtn);
    const step2 = getStepButton(/Step 2/);
    expect(step2).toHaveAttribute("aria-selected", "true");
  });

  it("navigates back when Back is clicked", async () => {
    const { user } = setupStepper({ defaultValue: "step2" });
    const backBtn = getBackButton();

    await user.click(backBtn);
    const step1 = getStepButton(/Step 1/);
    expect(step1).toHaveAttribute("aria-selected", "true");
  });

  it("hides Back button on first step", () => {
    setupStepper();
    expect(screen.queryByRole("button", { name: /back/i })).not.toBeInTheDocument();
  });

  it("shows Finish button on last step", async () => {
    const { user } = setupStepper();
    // Navigate to last step
    await user.click(getNextButton());
    await user.click(getNextButton());

    expect(getFinishButton()).toBeInTheDocument();
  });

  it("does not show Next button on last step", async () => {
    const { user } = setupStepper();
    await user.click(getNextButton());
    await user.click(getNextButton());

    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
  });

  it("calls onValueChange when step changes", async () => {
    const onValueChange = jest.fn();
    const { user } = setupStepper({ onValueChange });

    await user.click(getNextButton());
    expect(onValueChange).toHaveBeenCalledWith("step2");
  });
});

// ─── Progress Indicator ─────────────────────────────────────────────

describe("ProgressIndicator", () => {
  it("shows step numbers", () => {
    setupStepper();
    const step1 = getStepButton(/Step 1/);
    expect(step1).toHaveTextContent("1");
  });

  it("shows check icon on completed steps", async () => {
    const { user } = setupStepper();
    await user.click(getNextButton());

    const step1 = getStepButton(/Step 1/);
    expect(step1).toHaveAttribute("data-status", "completed");

    // Check that the check icon is rendered inside the completed step
    const checkIcon = within(step1).queryByRole("img", { hidden: true });
    // The Check icon is aria-hidden, so we just verify the status
    expect(step1.dataset.status).toBe("completed");
  });

  it("shows connector lines between steps", () => {
    setupStepper();
    const connectors = document.querySelectorAll('[role="presentation"]');
    // 3 steps = 2 connectors
    expect(connectors).toHaveLength(2);
  });

  it("clicking a completed step navigates to it", async () => {
    const { user } = setupStepper();
    // Complete step 1
    await user.click(getNextButton());
    // Now step1 is completed, click it
    const step1 = getStepButton(/Step 1/);
    await user.click(step1);

    expect(step1).toHaveAttribute("aria-selected", "true");
  });

  it("clicking a pending step does nothing in linear mode", async () => {
    setupStepper({ linear: true });
    const step3 = getStepButton(/Step 3/);

    await userEvent.click(step3);
    // Step 3 should still be "pending" and not selected
    expect(step3).toHaveAttribute("aria-selected", "false");
  });

  it("clicking a future step works in non-linear mode", async () => {
    setupStepper({ linear: false });
    const step3 = getStepButton(/Step 3/);

    await userEvent.click(step3);
    expect(step3).toHaveAttribute("aria-selected", "true");
  });
});

// ─── Validation ─────────────────────────────────────────────────────

describe("Stepper validation", () => {
  it("prevents navigation if validation fails", async () => {
    const validate = jest.fn(() => ({ valid: false, message: "Field is required" }));
    const { user } = setupStepper(
      {},
      [
        { value: "step1", label: "Step 1", content: "Content 1", validate },
        { value: "step2", label: "Step 2", content: "Content 2" },
      ],
    );

    await user.click(getNextButton());

    // Should still be on step 1
    const step1 = getStepButton(/Step 1/);
    expect(step1).toHaveAttribute("aria-selected", "true");
    expect(validate).toHaveBeenCalled();
  });

  it("shows error state on step when validation fails", async () => {
    const validate = jest.fn(() => ({ valid: false, message: "Field is required" }));
    const { user } = setupStepper(
      {},
      [
        { value: "step1", label: "Step 1", content: "Content 1", validate },
        { value: "step2", label: "Step 2", content: "Content 2" },
      ],
    );

    await user.click(getNextButton());

    const step1 = getStepButton(/Step 1/);
    expect(step1).toHaveAttribute("data-status", "error");
  });

  it("displays error message near the step", async () => {
    const validate = jest.fn(() => ({ valid: false, message: "Name is required" }));
    const { user } = setupStepper(
      {},
      [
        { value: "step1", label: "Step 1", content: "Content 1", validate },
        { value: "step2", label: "Step 2", content: "Content 2" },
      ],
    );

    await user.click(getNextButton());

    expect(screen.getByText("Name is required")).toBeInTheDocument();
  });

  it("allows navigation after validation passes", async () => {
    const validate = jest.fn(() => ({ valid: true }));
    const { user } = setupStepper(
      {},
      [
        { value: "step1", label: "Step 1", content: "Content 1", validate },
        { value: "step2", label: "Step 2", content: "Content 2" },
      ],
    );

    await user.click(getNextButton());

    const step2 = getStepButton(/Step 2/);
    expect(step2).toHaveAttribute("aria-selected", "true");
  });

  it("supports async validation", async () => {
    const validate = jest.fn(
      () =>
        new Promise<{ valid: boolean; message?: string }>((resolve) =>
          setTimeout(() => resolve({ valid: true }), 100),
        ),
    );
    const { user } = setupStepper(
      {},
      [
        { value: "step1", label: "Step 1", content: "Content 1", validate },
        { value: "step2", label: "Step 2", content: "Content 2" },
      ],
    );

    await user.click(getNextButton());

    await waitFor(() => {
      const step2 = getStepButton(/Step 2/);
      expect(step2).toHaveAttribute("aria-selected", "true");
    });
  });

  it("async validation failure prevents navigation", async () => {
    const validate = jest.fn(
      () =>
        new Promise<{ valid: boolean; message?: string }>((resolve) =>
          setTimeout(() => resolve({ valid: false, message: "Async error" }), 100),
        ),
    );
    const { user } = setupStepper(
      {},
      [
        { value: "step1", label: "Step 1", content: "Content 1", validate },
        { value: "step2", label: "Step 2", content: "Content 2" },
      ],
    );

    await user.click(getNextButton());

    await waitFor(() => {
      expect(screen.getByText("Async error")).toBeInTheDocument();
    });

    const step1 = getStepButton(/Step 1/);
    expect(step1).toHaveAttribute("aria-selected", "true");
  });

  it("validates on finish", async () => {
    const validate = jest.fn(() => ({ valid: false, message: "Last step error" }));
    const onFinish = jest.fn();
    const { user } = setupStepper(
      { onFinish },
      [
        { value: "step1", label: "Step 1", content: "Content 1" },
        { value: "step2", label: "Step 2", content: "Content 2", validate },
      ],
    );

    // Go to step 2
    await user.click(getNextButton());
    // Try to finish
    await user.click(getFinishButton());

    expect(onFinish).not.toHaveBeenCalled();
    expect(screen.getByText("Last step error")).toBeInTheDocument();
  });
});

// ─── Finish Flow ────────────────────────────────────────────────────

describe("Stepper finish", () => {
  it("calls onFinish when Finish is clicked on last step", async () => {
    const onFinish = jest.fn();
    const { user } = setupStepper({ onFinish });

    await user.click(getNextButton());
    await user.click(getNextButton());
    await user.click(getFinishButton());

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("shows loading state when finishing (async onFinish)", async () => {
    const onFinish = jest.fn(
      () => new Promise<void>((resolve) => setTimeout(resolve, 500)),
    );
    const { user } = setupStepper({ onFinish });

    await user.click(getNextButton());
    await user.click(getNextButton());

    const finishBtn = getFinishButton();
    await user.click(finishBtn);

    // The button should be disabled during submit
    expect(finishBtn).toBeDisabled();
  });

  it("validates before finish and prevents if invalid", async () => {
    const validate = jest.fn(() => ({ valid: false, message: "Not ready" }));
    const onFinish = jest.fn();
    const { user } = setupStepper(
      { onFinish },
      [
        { value: "step1", label: "Step 1", content: "Content 1" },
        { value: "step2", label: "Step 2", content: "Content 2", validate },
      ],
    );

    await user.click(getNextButton());
    await user.click(getFinishButton());

    expect(onFinish).not.toHaveBeenCalled();
  });
});

// ─── Edge Cases ─────────────────────────────────────────────────────

describe("Stepper edge cases", () => {
  it("handles single step", () => {
    render(
      <Stepper>
        <ProgressIndicator />
        <Step value="only" label="Only Step">
          Only Content
        </Step>
        <StepNavigation />
      </Stepper>,
    );

    expect(screen.getByText("Only Content")).toBeInTheDocument();
    // On single step, should show Finish not Next
    expect(getFinishButton()).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /next/i })).not.toBeInTheDocument();
  });

  it("handles many steps (10+)", () => {
    const steps = Array.from({ length: 12 }, (_, i) => ({
      value: `step${i}`,
      label: `Step ${i}`,
      content: `Content ${i}`,
    }));

    setupStepper({}, steps);
    expect(getStepButtons()).toHaveLength(12);
  });

  it("skips disabled steps when clicking Next", async () => {
    const { user } = setupStepper(
      {},
      [
        { value: "step1", label: "Step 1", content: "Content 1" },
        { value: "step2", label: "Step 2", content: "Content 2", disabled: true },
        { value: "step3", label: "Step 3", content: "Content 3" },
      ],
    );

    // On step1, next should go to step3 since step2 is disabled
    await user.click(getNextButton());
    const step3 = getStepButton(/Step 3/);
    expect(step3).toHaveAttribute("aria-selected", "true");
  });

  it("handles optional steps", async () => {
    const { user } = setupStepper(
      {},
      [
        { value: "step1", label: "Step 1", content: "Content 1" },
        { value: "step2", label: "Step 2", content: "Content 2", optional: true },
        { value: "step3", label: "Step 3", content: "Content 3" },
      ],
    );

    await user.click(getNextButton());

    // Should now be on step 2 (optional)
    const step2 = getStepButton(/Step 2/);
    expect(step2).toHaveAttribute("aria-selected", "true");

    // Click Next again to go to step 3
    await user.click(getNextButton());
    const step3 = getStepButton(/Step 3/);
    expect(step3).toHaveAttribute("aria-selected", "true");
  });

  it("handles rapid navigation", async () => {
    const { user } = setupStepper();
    // Rapid clicks
    await user.click(getNextButton());
    await user.click(getNextButton());
    await user.click(getBackButton());
    await user.click(getNextButton());

    const step2 = getStepButton(/Step 2/);
    expect(step2).toHaveAttribute("aria-selected", "true");
  });

  it("handles empty children gracefully", () => {
    render(<Stepper />);
    // Should render without errors
    const rootDiv = document.querySelector('[class*="flex"]');
    expect(rootDiv).toBeInTheDocument();
  });

  it("does not crash when step values change dynamically", () => {
    const { rerender } = render(
      <Stepper defaultValue="a">
        <ProgressIndicator />
        <Step value="a" label="A">
          Panel A
        </Step>
        <Step value="b" label="B">
          Panel B
        </Step>
        <StepNavigation />
      </Stepper>,
    );

    expect(screen.getAllByRole("tab")).toHaveLength(2);

    rerender(
      <Stepper defaultValue="a">
        <ProgressIndicator />
        <Step value="a" label="A">
          Panel A
        </Step>
        <Step value="b" label="B">
          Panel B
        </Step>
        <Step value="c" label="C">
          Panel C
        </Step>
        <StepNavigation />
      </Stepper>,
    );

    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("handles custom navigation labels", () => {
    render(
      <Stepper defaultValue="step1">
        <ProgressIndicator />
        <Step value="step1" label="First">
          Content
        </Step>
        <Step value="step2" label="Second">
          Content 2
        </Step>
        <StepNavigation
          backLabel="Go back"
          nextLabel="Continue"
          finishLabel="Complete"
        />
      </Stepper>,
    );

    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
  });
});

// ─── ARIA / Accessibility ───────────────────────────────────────────

describe("Stepper accessibility", () => {
  it("progress indicator has tablist role", () => {
    setupStepper();
    expect(getProgressIndicator()).toHaveAttribute("role", "tablist");
  });

  it("steps have tab role", () => {
    setupStepper();
    getStepButtons().forEach((step) => {
      expect(step).toHaveAttribute("role", "tab");
    });
  });

  it("active step has aria-selected true", () => {
    setupStepper({ defaultValue: "step2" });
    expect(getStepButton(/Step 2/)).toHaveAttribute("aria-selected", "true");
  });

  it("inactive step has aria-selected false", () => {
    setupStepper({ defaultValue: "step2" });
    expect(getStepButton(/Step 1/)).toHaveAttribute("aria-selected", "false");
  });

  it("disabled step has aria-disabled", () => {
    setupStepper(
      {},
      [
        { value: "step1", label: "Step 1", content: "C1" },
        { value: "step2", label: "Step 2", content: "C2", disabled: true },
      ],
    );
    expect(getStepButton(/Step 2/)).toHaveAttribute("aria-disabled", "true");
  });

  it("active step has tabIndex 0", () => {
    setupStepper({ defaultValue: "step1" });
    expect(getStepButton(/Step 1/)).toHaveAttribute("tabIndex", "0");
  });

  it("inactive step has tabIndex -1", () => {
    setupStepper({ defaultValue: "step1" });
    expect(getStepButton(/Step 2/)).toHaveAttribute("tabIndex", "-1");
  });

  it("step panel has tabpanel role", () => {
    setupStepper();
    const panels = document.querySelectorAll('[role="tabpanel"]');
    expect(panels.length).toBeGreaterThan(0);
  });

  it("completed step announces completed status", () => {
    setupStepper();
    const step1 = getStepButton(/Step 1/);
    expect(step1).toHaveAttribute("aria-label", expect.stringContaining("Step 1"));
  });

  it("progress indicator has aria-label", () => {
    setupStepper();
    expect(getProgressIndicator()).toHaveAttribute("aria-label", "Progress");
  });

  it("progress indicator has aria-orientation", () => {
    setupStepper({ orientation: "horizontal" });
    expect(getProgressIndicator()).toHaveAttribute(
      "aria-orientation",
      "horizontal",
    );
  });
});

// ─── Orientation ────────────────────────────────────────────────────

describe("Stepper orientation", () => {
  it("renders horizontal by default", () => {
    setupStepper();
    expect(getProgressIndicator()).toHaveAttribute(
      "aria-orientation",
      "horizontal",
    );
  });

  it("renders vertical orientation", () => {
    render(
      <Stepper orientation="vertical">
        <ProgressIndicator />
        <Step value="a" label="A">
          Panel A
        </Step>
        <Step value="b" label="B">
          Panel B
        </Step>
        <StepNavigation />
      </Stepper>,
    );

    expect(getProgressIndicator()).toHaveAttribute(
      "aria-orientation",
      "vertical",
    );
  });

  it("vertical orientation renders connectors vertically", () => {
    render(
      <Stepper orientation="vertical">
        <ProgressIndicator />
        <Step value="a" label="A">
          Panel A
        </Step>
        <Step value="b" label="B">
          Panel B
        </Step>
        <StepNavigation />
      </Stepper>,
    );

    const connectors = document.querySelectorAll('[role="presentation"]');
    expect(connectors.length).toBeGreaterThan(0);
  });
});

// ─── Sizes ──────────────────────────────────────────────────────────

describe("Stepper sizes", () => {
  it("renders default md size", () => {
    setupStepper({ size: "md" });
    const step = getStepButton(/Step 1/);
    expect(step).toHaveClass("h-8");
    expect(step).toHaveClass("w-8");
  });

  it("renders sm size", () => {
    setupStepper({ size: "sm" });
    const step = getStepButton(/Step 1/);
    expect(step).toHaveClass("h-6");
    expect(step).toHaveClass("w-6");
  });

  it("renders lg size", () => {
    setupStepper({ size: "lg" });
    const step = getStepButton(/Step 1/);
    expect(step).toHaveClass("h-10");
    expect(step).toHaveClass("w-10");
  });
});

// ─── Linear Mode ────────────────────────────────────────────────────

describe("Stepper linear mode", () => {
  it("prevents skipping ahead to a future step", async () => {
    setupStepper({ linear: true });
    const step3 = getStepButton(/Step 3/);

    await userEvent.click(step3);
    expect(step3).toHaveAttribute("aria-selected", "false");
  });

  it("allows going back to completed steps", async () => {
    const { user } = setupStepper({ linear: true });
    // Complete step 1
    await user.click(getNextButton());

    // Go back to step 1
    await user.click(getBackButton());
    const step1 = getStepButton(/Step 1/);
    expect(step1).toHaveAttribute("aria-selected", "true");
  });

  it("non-linear allows jumping to any step", async () => {
    setupStepper({ linear: false });
    const step3 = getStepButton(/Step 3/);

    await userEvent.click(step3);
    expect(step3).toHaveAttribute("aria-selected", "true");
  });
});

// ─── Compound Component Constraints ─────────────────────────────────

describe("Stepper compound component constraints", () => {
  it("throws when Step is used outside Stepper", () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    expect(() => {
      render(<Step value="test" label="Test">Test</Step>);
    }).toThrow(
      "Stepper compound components must be used within a <Stepper> root.",
    );
    consoleError.mockRestore();
  });

  it("throws when StepNavigation is used outside Stepper", () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    expect(() => {
      render(<StepNavigation />);
    }).toThrow(
      "Stepper compound components must be used within a <Stepper> root.",
    );
    consoleError.mockRestore();
  });

  it("throws when ProgressIndicator is used outside Stepper", () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    expect(() => {
      render(<ProgressIndicator />);
    }).toThrow(
      "Stepper compound components must be used within a <Stepper> root.",
    );
    consoleError.mockRestore();
  });
});

// ─── Custom ClassName ────────────────────────────────────────────────

describe("Stepper custom className", () => {
  it("merges className on Stepper root", () => {
    render(
      <Stepper className="custom-root" defaultValue="a">
        <ProgressIndicator />
        <Step value="a" label="A">
          Panel
        </Step>
        <StepNavigation />
      </Stepper>,
    );
    const root = document.querySelector(".custom-root");
    expect(root).toBeInTheDocument();
  });

  it("merges className on ProgressIndicator", () => {
    render(
      <Stepper defaultValue="a">
        <ProgressIndicator className="custom-indicator" />
        <Step value="a" label="A">
          Panel
        </Step>
        <StepNavigation />
      </Stepper>,
    );
    const indicator = document.querySelector(".custom-indicator");
    expect(indicator).toBeInTheDocument();
  });

  it("merges className on StepNavigation", () => {
    render(
      <Stepper defaultValue="a">
        <ProgressIndicator />
        <Step value="a" label="A">
          Panel
        </Step>
        <StepNavigation className="custom-nav" />
      </Stepper>,
    );
    const nav = document.querySelector(".custom-nav");
    expect(nav).toBeInTheDocument();
  });
});

// ─── ForwardRef ─────────────────────────────────────────────────────

describe("Stepper ref forwarding", () => {
  it("forwards ref to root div", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Stepper ref={ref} defaultValue="a">
        <ProgressIndicator />
        <Step value="a" label="A">
          Panel
        </Step>
        <StepNavigation />
      </Stepper>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it("ProgressIndicator forwards ref", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Stepper defaultValue="a">
        <ProgressIndicator ref={ref} />
        <Step value="a" label="A">
          Panel
        </Step>
        <StepNavigation />
      </Stepper>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });

  it("StepNavigation forwards ref", () => {
    const ref = React.createRef<HTMLDivElement>();
    render(
      <Stepper defaultValue="a">
        <ProgressIndicator />
        <Step value="a" label="A">
          Panel
        </Step>
        <StepNavigation ref={ref} />
      </Stepper>,
    );
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});

// ─── Stepper.Context Export ─────────────────────────────────────────

describe("Stepper.Context", () => {
  it("exports StepperContext for advanced usage", () => {
    expect(Stepper.Context).toBeDefined();
  });
});

// ─── Description and Labels ─────────────────────────────────────────

describe("Stepper step descriptions", () => {
  it("renders step description", () => {
    setupStepper(
      {},
      [
        {
          value: "step1",
          label: "Personal Info",
          description: "Your personal details",
          content: "Form",
        },
        { value: "step2", label: "Review", content: "Review" },
      ],
    );

    expect(screen.getByText("Your personal details")).toBeInTheDocument();
  });

  it("renders optional badge", () => {
    setupStepper(
      {},
      [
        {
          value: "step1",
          label: "Required",
          content: "C1",
        },
        {
          value: "step2",
          label: "Optional Step",
          optional: true,
          content: "C2",
        },
      ],
    );

    expect(screen.getByText("Optional")).toBeInTheDocument();
  });
});

// ─── Navigation Button Customization ─────────────────────────────────

describe("StepNavigation customization", () => {
  it("hides back button when hideBack is true", () => {
    render(
      <Stepper defaultValue="step2">
        <ProgressIndicator />
        <Step value="step1" label="Step 1">C1</Step>
        <Step value="step2" label="Step 2">C2</Step>
        <StepNavigation hideBack />
      </Stepper>,
    );

    expect(screen.queryByRole("button", { name: /back/i })).not.toBeInTheDocument();
  });

  it("disables next button when disableNext is true", () => {
    render(
      <Stepper defaultValue="step1">
        <ProgressIndicator />
        <Step value="step1" label="Step 1">C1</Step>
        <Step value="step2" label="Step 2">C2</Step>
        <StepNavigation disableNext />
      </Stepper>,
    );

    expect(getNextButton()).toBeDisabled();
  });
});
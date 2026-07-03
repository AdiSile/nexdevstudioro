"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/cn";

// ═══════════════════════════════════════════════════════════════════════
// Variants
// ═══════════════════════════════════════════════════════════════════════

const stepperVariants = cva(
  ["flex w-full"],
  {
    variants: {
      orientation: {
        horizontal: "flex-col",
        vertical: "flex-row gap-6",
      },
    },
    defaultVariants: {
      orientation: "horizontal",
    },
  },
);

const progressIndicatorVariants = cva(
  ["flex", "select-none"],
  {
    variants: {
      orientation: {
        horizontal: "flex-row items-start justify-center gap-0 w-full",
        vertical: "flex-col items-start gap-0",
      },
      size: {
        sm: "",
        md: "",
        lg: "",
      },
    },
    compoundVariants: [
      {
        orientation: "horizontal",
        size: "sm",
        className: "gap-1",
      },
      {
        orientation: "horizontal",
        size: "md",
        className: "gap-2",
      },
      {
        orientation: "horizontal",
        size: "lg",
        className: "gap-3",
      },
      {
        orientation: "vertical",
        size: "sm",
        className: "gap-0.5",
      },
      {
        orientation: "vertical",
        size: "md",
        className: "gap-1",
      },
      {
        orientation: "vertical",
        size: "lg",
        className: "gap-2",
      },
    ],
    defaultVariants: {
      orientation: "horizontal",
      size: "md",
    },
  },
);

const stepConnectorVariants = cva(
  ["flex-shrink-0 transition-colors duration-300"],
  {
    variants: {
      orientation: {
        horizontal: "h-[2px] flex-1 self-center",
        vertical: "w-[2px] self-stretch",
      },
      status: {
        completed: "bg-brand-500",
        active: "bg-border-strong",
        pending: "bg-border-subtle",
        error: "bg-danger-300",
      },
    },
    defaultVariants: {
      orientation: "horizontal",
      status: "pending",
    },
  },
);

const stepButtonVariants = cva(
  [
    "relative inline-flex items-center justify-center",
    "rounded-full font-semibold",
    "transition-all duration-300",
    "ring-offset-surface",
    "focus-visible:outline-none focus-visible:ring-2",
    "focus-visible:ring-border-focus focus-visible:ring-offset-2",
    "disabled:pointer-events-none disabled:opacity-40",
    "shrink-0",
  ],
  {
    variants: {
      status: {
        completed: [
          "bg-brand-500 text-white",
          "hover:bg-brand-600",
          "shadow-elevation-1",
        ],
        active: [
          "bg-brand-500 text-white",
          "shadow-elevation-1",
          "ring-4 ring-brand-200 dark:ring-brand-900",
        ],
        pending: [
          "bg-surface-secondary text-text-tertiary",
          "border-2 border-border",
          "hover:border-border-strong hover:text-text-secondary",
        ],
        error: [
          "bg-danger-500 text-white",
          "ring-4 ring-danger-200 dark:ring-danger-900",
          "shadow-elevation-1",
        ],
      },
      size: {
        sm: "h-6 w-6 text-[10px]",
        md: "h-8 w-8 text-xs",
        lg: "h-10 w-10 text-sm",
      },
      clickable: {
        true: "cursor-pointer",
        false: "cursor-default",
      },
    },
    defaultVariants: {
      status: "pending",
      size: "md",
      clickable: false,
    },
  },
);

const stepLabelVariants = cva(
  ["font-medium transition-colors duration-200", "select-none"],
  {
    variants: {
      status: {
        completed: "text-text-primary",
        active: "text-brand-600 dark:text-brand-400",
        pending: "text-text-tertiary",
        error: "text-danger-600 dark:text-danger-400",
      },
      size: {
        sm: "text-[10px]",
        md: "text-xs",
        lg: "text-sm",
      },
      orientation: {
        horizontal: "text-center",
        vertical: "text-left",
      },
    },
    defaultVariants: {
      status: "pending",
      size: "md",
      orientation: "horizontal",
    },
  },
);

const stepDescriptionVariants = cva(
  ["text-text-tertiary transition-colors duration-200"],
  {
    variants: {
      status: {
        completed: "text-text-tertiary",
        active: "text-text-secondary",
        pending: "text-text-muted",
        error: "text-danger-500",
      },
      size: {
        sm: "text-[9px]",
        md: "text-[10px]",
        lg: "text-xs",
      },
      orientation: {
        horizontal: "text-center",
        vertical: "text-left",
      },
    },
    defaultVariants: {
      status: "pending",
      size: "md",
      orientation: "horizontal",
    },
  },
);

const stepContentVariants = cva(
  ["outline-none"],
  {
    variants: {
      animate: {
        true: "",
        false: "",
      },
    },
    defaultVariants: {
      animate: true,
    },
  },
);

const navigationButtonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2",
    "font-medium whitespace-nowrap rounded-md",
    "transition-all duration-200",
    "ring-offset-surface focus-visible:outline-none",
    "focus-visible:ring-2 focus-visible:ring-border-focus",
    "focus-visible:ring-offset-2",
    "select-none",
    "disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-brand-500 text-text-inverse",
          "shadow-elevation-1",
          "hover:bg-brand-600 hover:shadow-elevation-2",
          "active:bg-brand-700 active:scale-[0.98]",
        ],
        secondary: [
          "bg-surface-secondary text-text-primary",
          "border border-border",
          "hover:bg-surface-tertiary hover:border-border-strong",
          "active:bg-neutral-200 active:scale-[0.98]",
        ],
        ghost: [
          "bg-transparent text-text-primary",
          "hover:bg-surface-secondary",
          "active:bg-neutral-200",
        ],
      },
      size: {
        sm: "h-8 px-3 text-xs rounded-sm",
        md: "h-10 px-5 text-sm",
        lg: "h-12 px-7 text-base rounded-lg",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  },
);

// ═══════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════

type StepStatus = "completed" | "active" | "pending" | "error";

interface StepValidationResult {
  valid: boolean;
  message?: string;
}

type StepValidateFn = () => StepValidationResult | Promise<StepValidationResult>;

interface StepDefinition {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
  optional?: boolean;
  validate?: StepValidateFn;
}

// ═══════════════════════════════════════════════════════════════════════
// Context
// ═══════════════════════════════════════════════════════════════════════

interface StepperContextValue {
  activeStep: string;
  setActiveStep: (value: string) => void;
  goToNext: () => Promise<void>;
  goToPrev: () => void;
  goToStep: (value: string) => Promise<void>;
  orientation: "horizontal" | "vertical";
  size: VariantProps<typeof stepButtonVariants>["size"];
  linear: boolean;
  stepValues: string[];
  stepDefinitions: Map<string, StepDefinition>;
  stepErrors: Map<string, string | null>;
  completedSteps: Set<string>;
  registerStep: (def: StepDefinition) => void;
  unregisterStep: (value: string) => void;
  setStepError: (value: string, message: string | null) => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  canGoNext: boolean;
  canGoPrev: boolean;
  canFinish: boolean;
  isSubmitting: boolean;
  setIsSubmitting: (val: boolean) => void;
  onFinish?: () => void | Promise<void>;
  stepperId: string;
  totalSteps: number;
  currentStepIndex: number;
}

const StepperContext = createContext<StepperContextValue | null>(null);

function useStepperContext() {
  const ctx = useContext(StepperContext);
  if (!ctx) {
    throw new Error(
      "Stepper compound components must be used within a <Stepper> root.",
    );
  }
  return ctx;
}

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

function getStepStatus(
  stepValue: string,
  activeStep: string,
  completedSteps: Set<string>,
  stepErrors: Map<string, string | null>,
): StepStatus {
  if (stepErrors.has(stepValue) && stepErrors.get(stepValue) !== null) {
    if (completedSteps.has(stepValue)) return "error";
    if (stepValue === activeStep) return "error";
  }
  if (completedSteps.has(stepValue) && stepValue !== activeStep) {
    return stepErrors.get(stepValue) ? "error" : "completed";
  }
  if (stepValue === activeStep) return "active";
  return "pending";
}

// ═══════════════════════════════════════════════════════════════════════
// Animations
// ═══════════════════════════════════════════════════════════════════════

const contentAnimationVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 24 : -24,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 24 : -24,
    opacity: 0,
    transition: { duration: 0.15, ease: [0.4, 0, 0.2, 1] },
  }),
};

// ═══════════════════════════════════════════════════════════════════════
// Stepper (Root)
// ═══════════════════════════════════════════════════════════════════════

export interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Controlled active step value */
  value?: string;
  /** Uncontrolled default active step value */
  defaultValue?: string;
  /** Called when active step changes */
  onValueChange?: (value: string) => void;
  /** Orientation of the progress indicator */
  orientation?: "horizontal" | "vertical";
  /** Size preset */
  size?: VariantProps<typeof stepButtonVariants>["size"];
  /** Linear mode: steps must be completed in order */
  linear?: boolean;
  /** Called when all steps are completed and user clicks Finish */
  onFinish?: () => void | Promise<void>;
}

const Stepper = React.forwardRef<HTMLDivElement, StepperProps>(
  (
    {
      value: controlledValue,
      defaultValue,
      onValueChange,
      orientation = "horizontal",
      size = "md",
      linear = true,
      onFinish,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    const isControlled = controlledValue !== undefined;
    const [internalValue, setInternalValue] = useState(defaultValue ?? "");
    const activeStep = isControlled ? controlledValue : internalValue;

    const [stepDefinitions, setStepDefinitions] = useState<
      Map<string, StepDefinition>
    >(new Map());
    const [stepErrors, setStepErrors] = useState<Map<string, string | null>>(
      new Map(),
    );
    const [completedSteps, setCompletedSteps] = useState<Set<string>>(
      new Set(),
    );
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [direction, setDirection] = useState(0);

    const autoId = useId();
    const stepperId = `stepper-${autoId}`;

    const stepValues = useMemo(
      () => Array.from(stepDefinitions.keys()),
      [stepDefinitions],
    );

    const currentStepIndex = useMemo(
      () => stepValues.indexOf(activeStep),
      [stepValues, activeStep],
    );

    const totalSteps = stepValues.length;

    const isFirstStep = currentStepIndex === 0;
    const isLastStep = currentStepIndex === totalSteps - 1;

    const canGoPrev = !isFirstStep;
    const canGoNext = useMemo(() => {
      if (isLastStep) return false;
      // Find next enabled step
      let nextIndex = currentStepIndex + 1;
      while (nextIndex < stepValues.length) {
        const nextDef = stepDefinitions.get(stepValues[nextIndex]);
        if (nextDef && !nextDef.disabled) return true;
        nextIndex++;
      }
      return false;
    }, [isLastStep, currentStepIndex, stepValues, stepDefinitions]);
    const canFinish = isLastStep;

    const setActiveStep = useCallback(
      (val: string) => {
        if (!isControlled) {
          setInternalValue(val);
        }
        onValueChange?.(val);
      },
      [isControlled, onValueChange],
    );

    const registerStep = useCallback((def: StepDefinition) => {
      setStepDefinitions((prev) => {
        const next = new Map(prev);
        next.set(def.value, def);
        return next;
      });
    }, []);

    const unregisterStep = useCallback((value: string) => {
      setStepDefinitions((prev) => {
        const next = new Map(prev);
        next.delete(value);
        return next;
      });
      setStepErrors((prev) => {
        const next = new Map(prev);
        next.delete(value);
        return next;
      });
      setCompletedSteps((prev) => {
        const next = new Set(prev);
        next.delete(value);
        return next;
      });
    }, []);

    const setStepError = useCallback(
      (value: string, message: string | null) => {
        setStepErrors((prev) => {
          const next = new Map(prev);
          if (message === null) {
            next.delete(value);
          } else {
            next.set(value, message);
          }
          return next;
        });
      },
      [],
    );

    const goToStep = useCallback(
      async (value: string) => {
        const def = stepDefinitions.get(value);
        if (!def || def.disabled) return;

        // In linear mode, you can only go to steps that are before the current
        // or the immediate next step
        const targetIndex = stepValues.indexOf(value);
        const currentIndex = stepValues.indexOf(activeStep);

        if (linear && targetIndex > currentIndex + 1) {
          // Cannot skip ahead in linear mode
          return;
        }

        // If going forward, validate current step first
        if (targetIndex > currentIndex) {
          const currentDef = stepDefinitions.get(activeStep);
          if (currentDef?.validate) {
            try {
              const result = await currentDef.validate();
              if (!result.valid) {
                setStepError(activeStep, result.message ?? "Validation failed");
                return;
              }
            } catch {
              setStepError(activeStep, "Validation failed");
              return;
            }
          }

          // Mark current as completed
          setStepError(activeStep, null);
          setCompletedSteps((prev) => {
            const next = new Set(prev);
            next.add(activeStep);
            return next;
          });
        }

        setDirection(targetIndex > currentIndex ? 1 : -1);
        setActiveStep(value);
      },
      [
        stepDefinitions,
        stepValues,
        activeStep,
        linear,
        setStepError,
        setActiveStep,
      ],
    );

    const goToNext = useCallback(async () => {
      if (isLastStep) return;

      // Validate current step
      const currentDef = stepDefinitions.get(activeStep);
      if (currentDef?.validate) {
        try {
          const result = await currentDef.validate();
          if (!result.valid) {
            setStepError(activeStep, result.message ?? "Validation failed");
            return;
          }
        } catch {
          setStepError(activeStep, "Validation failed");
          return;
        }
      }

      // Mark current step as completed
      setStepError(activeStep, null);
      setCompletedSteps((prev) => {
        const next = new Set(prev);
        next.add(activeStep);
        return next;
      });

      // Find next enabled step (skip disabled)
      let nextIndex = currentStepIndex + 1;
      while (nextIndex < stepValues.length) {
        const nextDef = stepDefinitions.get(stepValues[nextIndex]);
        if (nextDef && !nextDef.disabled) {
          break;
        }
        nextIndex++;
      }

      if (nextIndex < stepValues.length) {
        setDirection(1);
        setActiveStep(stepValues[nextIndex]);
      }
    }, [
      isLastStep,
      stepDefinitions,
      activeStep,
      setStepError,
      currentStepIndex,
      stepValues,
      setActiveStep,
    ]);

    const goToPrev = useCallback(() => {
      if (isFirstStep) return;
      const prevIndex = currentStepIndex - 1;
      if (prevIndex >= 0) {
        setDirection(-1);
        setActiveStep(stepValues[prevIndex]);
      }
    }, [isFirstStep, currentStepIndex, stepValues, setActiveStep]);

    // Handle finish
    const handleFinish = useCallback(async () => {
      if (!canFinish) return;

      // Validate last step
      const currentDef = stepDefinitions.get(activeStep);
      if (currentDef?.validate) {
        try {
          const result = await currentDef.validate();
          if (!result.valid) {
            setStepError(activeStep, result.message ?? "Validation failed");
            return;
          }
        } catch {
          setStepError(activeStep, "Validation failed");
          return;
        }
      }

      setStepError(activeStep, null);

      if (onFinish) {
        setIsSubmitting(true);
        try {
          await onFinish();
        } finally {
          setIsSubmitting(false);
        }
      }
    }, [canFinish, stepDefinitions, activeStep, setStepError, onFinish]);

    // Auto-select first step if no activeStep is set
    useEffect(() => {
      if (!activeStep && stepValues.length > 0) {
        setActiveStep(stepValues[0]);
      }
    }, [activeStep, stepValues, setActiveStep]);

    const contextValue = useMemo<StepperContextValue>(
      () => ({
        activeStep,
        setActiveStep,
        goToNext,
        goToPrev,
        goToStep,
        orientation,
        size,
        linear,
        stepValues,
        stepDefinitions,
        stepErrors,
        completedSteps,
        registerStep,
        unregisterStep,
        setStepError,
        isFirstStep,
        isLastStep,
        canGoNext,
        canGoPrev,
        canFinish,
        isSubmitting,
        setIsSubmitting,
        onFinish: handleFinish,
        stepperId,
        totalSteps,
        currentStepIndex,
      }),
      [
        activeStep,
        setActiveStep,
        goToNext,
        goToPrev,
        goToStep,
        orientation,
        size,
        linear,
        stepValues,
        stepDefinitions,
        stepErrors,
        completedSteps,
        registerStep,
        unregisterStep,
        setStepError,
        isFirstStep,
        isLastStep,
        canGoNext,
        canGoPrev,
        canFinish,
        isSubmitting,
        handleFinish,
        stepperId,
        totalSteps,
        currentStepIndex,
      ],
    );

    return (
      <StepperContext.Provider value={contextValue}>
        <div
          ref={ref}
          className={cn(stepperVariants({ orientation }), className)}
          {...rest}
        >
          {children}
        </div>
      </StepperContext.Provider>
    );
  },
);

Stepper.displayName = "Stepper";

// ═══════════════════════════════════════════════════════════════════════
// ProgressIndicator
// ═══════════════════════════════════════════════════════════════════════

export interface ProgressIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Position of progress indicator: "top" (default) or "left" */
  position?: "top" | "left";
}

const ProgressIndicator = React.forwardRef<HTMLDivElement, ProgressIndicatorProps>(
  ({ className, position = "top", ...rest }, ref) => {
    const ctx = useStepperContext();
    const {
      stepValues,
      activeStep,
      completedSteps,
      stepErrors,
      orientation,
      size,
      goToStep,
      stepDefinitions,
      stepperId,
    } = ctx;

    const resolvedOrientation =
      position === "left" ? "vertical" : orientation;

    return (
      <div
        ref={ref}
        role="tablist"
        aria-orientation={resolvedOrientation}
        aria-label="Progress"
        className={cn(
          progressIndicatorVariants({
            orientation: resolvedOrientation,
            size,
          }),
          position === "left" && "pr-6",
          className,
        )}
        {...rest}
      >
        {stepValues.map((stepValue, index) => {
          const def = stepDefinitions.get(stepValue);
          if (!def) return null;

          const status = getStepStatus(
            stepValue,
            activeStep,
            completedSteps,
            stepErrors,
          );
          const isLast = index === stepValues.length - 1;
          const errorMsg = stepErrors.get(stepValue);
          const isClickable =
            status === "completed" && !def.disabled;

          const stepButtonId = `${stepperId}-step-${stepValue}`;

          return (
            <React.Fragment key={stepValue}>
              {/* Step wrapper */}
              <div
                className={cn(
                  "flex items-center",
                  resolvedOrientation === "horizontal"
                    ? "flex-col flex-1"
                    : "flex-row gap-3",
                )}
              >
                {/* Step button (circle) */}
                <button
                  id={stepButtonId}
                  role="tab"
                  type="button"
                  aria-selected={status === "active"}
                  aria-disabled={
                    def.disabled || (!isClickable && status !== "active")
                      ? true
                      : undefined
                  }
                  aria-label={`Step ${index + 1}: ${def.label}${
                    status === "completed" ? " (completed)" : ""
                  }${status === "error" ? ` (error: ${errorMsg})` : ""}${
                    def.optional ? " (optional)" : ""
                  }`}
                  tabIndex={status === "active" ? 0 : -1}
                  data-status={status}
                  className={cn(
                    stepButtonVariants({
                      status,
                      size,
                      clickable:
                        isClickable && status !== "active",
                    }),
                  )}
                  onClick={() => {
                    if (isClickable && status !== "active") {
                      goToStep(stepValue);
                    }
                  }}
                  disabled={
                    (!isClickable && status !== "active") ||
                    def.disabled
                  }
                >
                  {status === "completed" && !errorMsg ? (
                    <Check
                      className={cn(
                        size === "sm"
                          ? "h-3 w-3"
                          : size === "lg"
                            ? "h-5 w-5"
                            : "h-4 w-4",
                      )}
                      aria-hidden="true"
                    />
                  ) : status === "error" ? (
                    <AlertCircle
                      className={cn(
                        size === "sm"
                          ? "h-3 w-3"
                          : size === "lg"
                            ? "h-5 w-5"
                            : "h-4 w-4",
                      )}
                      aria-hidden="true"
                    />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </button>

                {/* Label and description */}
                <div
                  className={cn(
                    resolvedOrientation === "horizontal"
                      ? "flex flex-col items-center mt-1.5"
                      : "flex flex-col items-start",
                  )}
                >
                  <span
                    className={cn(
                      stepLabelVariants({
                        status,
                        size,
                        orientation: resolvedOrientation,
                      }),
                    )}
                  >
                    {def.label}
                  </span>
                  {def.description && (
                    <span
                      className={cn(
                        stepDescriptionVariants({
                          status,
                          size,
                          orientation: resolvedOrientation,
                        }),
                      )}
                    >
                      {def.description}
                    </span>
                  )}
                  {def.optional && (
                    <span
                      className={cn(
                        stepDescriptionVariants({
                          status: "pending",
                          size,
                          orientation: resolvedOrientation,
                        }),
                        "italic",
                      )}
                    >
                      Optional
                    </span>
                  )}
                  {errorMsg && status === "error" && (
                    <span
                      className={cn(
                        stepDescriptionVariants({
                          status: "error",
                          size,
                          orientation: resolvedOrientation,
                        }),
                        "mt-0.5 max-w-[120px] truncate",
                      )}
                      title={errorMsg}
                    >
                      {errorMsg}
                    </span>
                  )}
                </div>
              </div>

              {/* Connector line between steps */}
              {!isLast && (
                <div
                  role="presentation"
                  className={cn(
                    stepConnectorVariants({
                      orientation: resolvedOrientation,
                      status:
                        completedSteps.has(stepValue) && !stepErrors.has(stepValue)
                          ? "completed"
                          : stepErrors.has(stepValue)
                            ? "error"
                            : activeStep === stepValue
                              ? "active"
                              : "pending",
                    }),
                    resolvedOrientation === "horizontal" && "mt-4",
                    resolvedOrientation === "vertical" &&
                      "ml-[15px] my-0.5",
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  },
);

ProgressIndicator.displayName = "ProgressIndicator";

// ═══════════════════════════════════════════════════════════════════════
// Step
// ═══════════════════════════════════════════════════════════════════════

export interface StepProps {
  /** Unique value identifying this step */
  value: string;
  /** Label displayed in the progress indicator */
  label: string;
  /** Optional description displayed below the label */
  description?: string;
  /** Disable this step */
  disabled?: boolean;
  /** Mark step as optional (can be skipped) */
  optional?: boolean;
  /** Validation function called before leaving the step */
  validate?: StepValidateFn;
  /** Children (step content) */
  children?: React.ReactNode;
}

const Step: React.FC<StepProps> = ({
  value,
  label,
  description,
  disabled = false,
  optional = false,
  validate,
  children,
}) => {
  const ctx = useStepperContext();
  const { registerStep, unregisterStep, activeStep } = ctx;

  const def = useMemo<StepDefinition>(
    () => ({ value, label, description, disabled, optional, validate }),
    [value, label, description, disabled, optional, validate],
  );

  useEffect(() => {
    registerStep(def);
    return () => unregisterStep(value);
  }, [def, registerStep, unregisterStep, value]);

  const isActive = activeStep === value;

  return (
    <StepContent value={value} active={isActive}>
      {children}
    </StepContent>
  );
};

Step.displayName = "Step";

// ═══════════════════════════════════════════════════════════════════════
// StepContent
// ═══════════════════════════════════════════════════════════════════════

interface StepContentProps {
  value: string;
  active: boolean;
  children?: React.ReactNode;
  /** Force unmount when inactive */
  unmountOnHide?: boolean;
}

function StepContent({
  value,
  active,
  children,
  unmountOnHide = false,
}: StepContentProps) {
  const ctx = useStepperContext();
  const { stepperId, direction } = ctx;

  const panelId = `${stepperId}-panel-${value}`;
  const stepButtonId = `${stepperId}-step-${value}`;

  const shouldRender = unmountOnHide ? active : true;

  if (!shouldRender) return null;

  return (
    <div
      id={panelId}
      role="tabpanel"
      aria-labelledby={stepButtonId}
      tabIndex={0}
      hidden={!active}
      className={cn(
        stepContentVariants({ animate: true }),
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 rounded-md",
        !active && "hidden",
        "mt-6",
      )}
    >
      <AnimatePresence mode="wait" custom={direction}>
        {active && (
          <motion.div
            key={value}
            custom={direction}
            variants={contentAnimationVariants}
            initial="enter"
            animate="center"
            exit="exit"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// StepNavigation
// ═══════════════════════════════════════════════════════════════════════

export interface StepNavigationProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Custom label for the Back button */
  backLabel?: string;
  /** Custom label for the Next button */
  nextLabel?: string;
  /** Custom label for the Finish button */
  finishLabel?: string;
  /** Hide Back button */
  hideBack?: boolean;
  /** Disable Next button (external control) */
  disableNext?: boolean;
  /** Disable Finish button (external control) */
  disableFinish?: boolean;
  /** Show a Skip button for optional steps */
  showSkip?: boolean;
  /** Custom label for Skip button */
  skipLabel?: string;
  /** Called when Skip is clicked */
  onSkip?: () => void;
}

const StepNavigation = React.forwardRef<HTMLDivElement, StepNavigationProps>(
  (
    {
      backLabel = "Back",
      nextLabel = "Next",
      finishLabel = "Finish",
      hideBack = false,
      disableNext = false,
      disableFinish = false,
      showSkip = false,
      skipLabel = "Skip",
      onSkip,
      className,
      ...rest
    },
    ref,
  ) => {
    const ctx = useStepperContext();
    const {
      goToNext,
      goToPrev,
      canGoNext,
      canGoPrev,
      canFinish,
      isFirstStep,
      isLastStep,
      isSubmitting,
      onFinish,
      stepDefinitions,
      activeStep,
    } = ctx;

    const currentDef = stepDefinitions.get(activeStep);
    const isOptional = currentDef?.optional ?? false;

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center justify-between mt-8 pt-4 border-t border-border",
          isFirstStep && !hideBack && "justify-end",
          className,
        )}
        {...rest}
      >
        {/* Left side: Back */}
        <div className="flex items-center gap-2">
          {!isFirstStep && !hideBack && (
            <button
              type="button"
              onClick={goToPrev}
              disabled={!canGoPrev}
              className={cn(
                navigationButtonVariants({ variant: "ghost", size: "md" }),
              )}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              {backLabel}
            </button>
          )}
        </div>

        {/* Right side: Skip / Next / Finish */}
        <div className="flex items-center gap-3">
          {/* Skip button for optional steps */}
          {showSkip && isOptional && !isLastStep && (
            <button
              type="button"
              onClick={() => {
                onSkip?.();
                goToNext();
              }}
              className={cn(
                navigationButtonVariants({ variant: "ghost", size: "md" }),
                "text-text-tertiary",
              )}
            >
              {skipLabel}
            </button>
          )}

          {/* Next button */}
          {!isLastStep && (
            <button
              type="button"
              onClick={goToNext}
              disabled={!canGoNext || disableNext}
              className={cn(
                navigationButtonVariants({ variant: "primary", size: "md" }),
              )}
            >
              {nextLabel}
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}

          {/* Finish button */}
          {isLastStep && (
            <button
              type="button"
              onClick={onFinish}
              disabled={!canFinish || disableFinish || isSubmitting}
              className={cn(
                navigationButtonVariants({ variant: "primary", size: "md" }),
              )}
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  {finishLabel}
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {finishLabel}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    );
  },
);

StepNavigation.displayName = "StepNavigation";

// ═══════════════════════════════════════════════════════════════════════
// Compound component assignment
// ═══════════════════════════════════════════════════════════════════════

const StepperCompound = Object.assign(Stepper, {
  ProgressIndicator,
  Step,
  Navigation: StepNavigation,
  /** Context consumer for advanced use cases */
  Context: StepperContext,
});

export {
  StepperCompound as Stepper,
  ProgressIndicator,
  Step,
  StepNavigation,
  StepperContext,
  stepperVariants,
  progressIndicatorVariants,
  stepButtonVariants,
  stepLabelVariants,
  stepDescriptionVariants,
  stepContentVariants,
  stepConnectorVariants,
  navigationButtonVariants,
};

export type {
  StepStatus,
  StepDefinition,
  StepValidateFn,
  StepValidationResult,
};

export default StepperCompound;
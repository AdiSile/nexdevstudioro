"use client";

import React, {
  forwardRef,
  useId,
  useState,
  useCallback,
  useImperativeHandle,
  useRef,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  X,
} from "lucide-react";

// ─── Mask Utilities ─────────────────────────────────────────────────

/** Predefined mask patterns */
export const MASK_PATTERNS = {
  /** US/CA phone: (555) 123-4567 */
  phone: "(999) 999-9999",
  /** Credit card: 1234 5678 9012 3456 */
  creditCard: "9999 9999 9999 9999",
  /** Date MM/DD/YYYY */
  date: "99/99/9999",
  /** ISO date YYYY-MM-DD */
  dateIso: "9999-99-99",
  /** Social Security: 123-45-6789 */
  ssn: "999-99-9999",
  /** ZIP+4: 12345-6789 */
  zipPlus4: "99999-9999",
} as const;

export type MaskPattern = (typeof MASK_PATTERNS)[keyof typeof MASK_PATTERNS];

/** Mask token definitions */
const MASK_DIGIT = "9";
const MASK_LETTER = "A";
const MASK_ALPHANUM = "W";
const MASK_ANY = "*";

/**
 * Apply a mask pattern to a raw value.
 * Supports tokens:
 * - `9` → digit 0-9
 * - `A` → letter a-z, A-Z
 * - `W` → alphanumeric
 * - `*` → any character
 * - Any other char → literal separator
 */
export function applyMask(
  rawValue: string,
  pattern: string | MaskPattern,
): string {
  if (!pattern) return rawValue;

  const cleaned = rawValue.replace(/[^\w]/g, "");
  let result = "";
  let valueIndex = 0;

  for (let i = 0; i < pattern.length && valueIndex < cleaned.length; i++) {
    const token = pattern[i];
    const char = cleaned[valueIndex];

    if (token === MASK_DIGIT) {
      if (/\d/.test(char)) {
        result += char;
        valueIndex++;
      } else {
        // skip non-digit characters in the raw value
        valueIndex++;
        i--; // retry this token
      }
    } else if (token === MASK_LETTER) {
      if (/[a-zA-Z]/.test(char)) {
        result += char;
        valueIndex++;
      } else {
        valueIndex++;
        i--;
      }
    } else if (token === MASK_ALPHANUM) {
      if (/\w/.test(char)) {
        result += char;
        valueIndex++;
      } else {
        valueIndex++;
        i--;
      }
    } else if (token === MASK_ANY) {
      result += char;
      valueIndex++;
    } else {
      // literal separator
      result += token;
    }
  }

  return result;
}

/**
 * Strip mask characters from a masked value, returning only raw characters.
 */
export function stripMask(value: string): string {
  return value.replace(/[^\w]/g, "");
}

// ─── Variant Definitions ────────────────────────────────────────────

const inputWrapperVariants = cva(
  [
    "group relative flex items-center",
    "rounded-md",
    "transition-all duration-200",
    "ring-offset-surface",
  ],
  {
    variants: {
      variant: {
        default: [
          "border border-border",
          "bg-surface",
          "hover:border-border-strong",
          "focus-within:border-brand-500",
          "focus-within:ring-2 focus-within:ring-brand-500/20",
          "focus-within:shadow-elevation-1",
        ],
        filled: [
          "border border-transparent",
          "bg-surface-secondary",
          "hover:bg-surface-tertiary",
          "focus-within:bg-surface",
          "focus-within:border-brand-500",
          "focus-within:ring-2 focus-within:ring-brand-500/20",
        ],
        underlined: [
          "border-0 border-b-2 border-border",
          "bg-transparent rounded-none",
          "hover:border-border-strong",
          "focus-within:border-brand-500",
          "focus-within:ring-0",
          "px-0",
        ],
      },
      inputSize: {
        sm: ["h-8 text-xs"],
        md: ["h-10 text-sm"],
        lg: ["h-12 text-base"],
      },
      validation: {
        none: [],
        valid: [
          "border-success-500",
          "focus-within:border-success-500",
          "focus-within:ring-success-500/20",
        ],
        invalid: [
          "border-danger-500",
          "focus-within:border-danger-500",
          "focus-within:ring-danger-500/20",
        ],
        warning: [
          "border-warning-500",
          "focus-within:border-warning-500",
          "focus-within:ring-warning-500/20",
        ],
      },
      fullWidth: {
        true: "w-full",
      },
    },
    compoundVariants: [
      // Underlined variant should not have ring for valid/invalid/warning
      {
        variant: "underlined",
        validation: "invalid",
        className:
          "focus-within:ring-0 border-danger-500 focus-within:border-danger-500",
      },
      {
        variant: "underlined",
        validation: "valid",
        className:
          "focus-within:ring-0 border-success-500 focus-within:border-success-500",
      },
      {
        variant: "underlined",
        validation: "warning",
        className:
          "focus-within:ring-0 border-warning-500 focus-within:border-warning-500",
      },
    ],
    defaultVariants: {
      variant: "default",
      inputSize: "md",
      validation: "none",
    },
  },
);

const inputFieldVariants = cva(
  [
    "flex-1 bg-transparent",
    "text-text-primary placeholder:text-text-tertiary",
    "outline-none border-none",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "read-only:cursor-default",
  ],
  {
    variants: {
      inputSize: {
        sm: ["h-8 text-xs", "px-2"],
        md: ["h-10 text-sm", "px-3"],
        lg: ["h-12 text-base", "px-4"],
      },
      hasLeftIcon: {
        true: "",
      },
      hasRightIcon: {
        true: "",
      },
    },
    compoundVariants: [
      { inputSize: "sm", hasLeftIcon: true, className: "pl-8" },
      { inputSize: "sm", hasRightIcon: true, className: "pr-8" },
      { inputSize: "md", hasLeftIcon: true, className: "pl-10" },
      { inputSize: "md", hasRightIcon: true, className: "pr-10" },
      { inputSize: "lg", hasLeftIcon: true, className: "pl-12" },
      { inputSize: "lg", hasRightIcon: true, className: "pr-12" },
    ],
    defaultVariants: {
      inputSize: "md",
    },
  },
);

const labelVariants = cva(
  ["block font-medium text-text-secondary", "transition-colors duration-150"],
  {
    variants: {
      labelSize: {
        sm: "text-xs mb-1",
        md: "text-sm mb-1.5",
        lg: "text-base mb-2",
      },
      disabled: {
        true: "opacity-50 cursor-not-allowed",
      },
    },
    defaultVariants: {
      labelSize: "md",
    },
  },
);

const helperTextVariants = cva(["mt-1.5 flex items-center gap-1.5 text-xs"], {
  variants: {
    validation: {
      none: "text-text-tertiary",
      valid: "text-success-600",
      invalid: "text-danger-600",
      warning: "text-warning-600",
    },
  },
  defaultVariants: {
    validation: "none",
  },
});

// ─── Types ──────────────────────────────────────────────────────────

/** Validation state for the input */
export type InputValidation = "none" | "valid" | "invalid" | "warning";

type InputVariant = "default" | "filled" | "underlined";
type InputSize = "sm" | "md" | "lg";

type InputBaseProps = {
  /** Visual variant */
  variant?: InputVariant;
  /** Size preset */
  inputSize?: InputSize;
  /** Expand to full container width */
  fullWidth?: boolean;
  /** Validation state */
  validation?: InputValidation;
  /** Label text (renders <label> above input) */
  label?: string;
  /** Mark as required (adds asterisk indicator and aria-required) */
  required?: boolean;
  /** Error message (shown below input, triggers invalid validation) */
  error?: string;
  /** Hint / helper text (shown below input when no error) */
  hint?: string;
  /** Icon displayed on the left side of the input */
  iconLeft?: React.ReactNode;
  /** Icon displayed on the right side of the input */
  iconRight?: React.ReactNode;
  /** Show password visibility toggle (only for type="password") */
  showPasswordToggle?: boolean;
  /** Show clear button (X icon) when input has a value */
  showClearButton?: boolean;
  /** Input mask pattern (see MASK_PATTERNS or custom) */
  mask?: string | MaskPattern;
  /** Callback with the raw (unmasked) value */
  onMaskedValue?: (rawValue: string) => void;
  /** Render wrapper as child (for integrating with form libraries) */
  asChild?: boolean;
  /** ID for the input; auto-generated if not provided */
  id?: string;
};

export type InputProps = InputBaseProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "id">;

// ─── Component ──────────────────────────────────────────────────────

const Input = forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  const {
    variant = "default",
    inputSize = "md",
    fullWidth,
    validation: validationProp,
    label,
    required = false,
    error,
    hint,
    iconLeft,
    iconRight,
    showPasswordToggle = false,
    showClearButton = false,
    mask,
    onMaskedValue,
    asChild = false,
    id: idProp,
    className,
    disabled,
    readOnly,
    type: typeProp = "text",
    value: valueProp,
    defaultValue,
    onChange,
    onFocus,
    onBlur,
    ...rest
  } = props;

  // ── ID generation ──────────────────────────────────────────────
  const autoId = useId();
  const inputId = idProp ?? autoId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  // ── Refs ───────────────────────────────────────────────────────
  const innerRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => innerRef.current!);

  // ── State ──────────────────────────────────────────────────────
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [internalValue, setInternalValue] = useState<string>(() => {
    if (valueProp !== undefined) return String(valueProp ?? "");
    if (defaultValue !== undefined) return String(defaultValue ?? "");
    return "";
  });

  const isControlled = valueProp !== undefined;
  const currentValue = isControlled ? String(valueProp ?? "") : internalValue;

  // ── Derived state ──────────────────────────────────────────────
  const resolvedType =
    typeProp === "password" && showPassword ? "text" : typeProp;
  const hasLeftIcon = Boolean(iconLeft);
  const hasRightIcon =
    Boolean(iconRight) ||
    (showPasswordToggle && typeProp === "password") ||
    (showClearButton && currentValue.length > 0);

  // Use error presence to override validation
  const validation: InputValidation = error
    ? "invalid"
    : validationProp ?? "none";

  const isDisabled = disabled;
  const isReadOnly = readOnly;

  // ── Handlers ───────────────────────────────────────────────────
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      let newValue = e.target.value;

      // Apply mask if configured
      if (mask) {
        const masked = applyMask(newValue, mask);
        newValue = masked;
      }

      if (!isControlled) {
        setInternalValue(newValue);
      }

      // Fire original onChange with masked value
      if (onChange) {
        // Create a synthetic-like event
        const syntheticEvent = {
          ...e,
          target: { ...e.target, value: newValue },
        } as React.ChangeEvent<HTMLInputElement>;
        onChange(syntheticEvent);
      }

      // Fire onMaskedValue with raw value if mask is active
      if (mask && onMaskedValue) {
        onMaskedValue(stripMask(newValue));
      }
    },
    [mask, isControlled, onChange, onMaskedValue],
  );

  const handleClear = useCallback(() => {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )?.set;

    if (nativeInputValueSetter && innerRef.current) {
      nativeInputValueSetter.call(innerRef.current, "");
      const event = new Event("input", { bubbles: true });
      innerRef.current.dispatchEvent(event);
    }

    if (!isControlled) {
      setInternalValue("");
    }

    if (mask && onMaskedValue) {
      onMaskedValue("");
    }

    innerRef.current?.focus();
  }, [isControlled, mask, onMaskedValue]);

  const handleFocus = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(e);
    },
    [onFocus],
  );

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(e);
    },
    [onBlur],
  );

  // ── Icon sizing ────────────────────────────────────────────────
  const iconSizeClass =
    inputSize === "sm" ? "h-3.5 w-3.5" : inputSize === "lg" ? "h-5 w-5" : "h-4 w-4";

  const leftIconPadding =
    inputSize === "sm" ? "left-2" : inputSize === "lg" ? "left-4" : "left-3";
  const rightIconPadding =
    inputSize === "sm" ? "right-2" : inputSize === "lg" ? "right-4" : "right-3";

  // ── Render icon ────────────────────────────────────────────────
  const renderLeftIcon = () => {
    if (!iconLeft) return null;
    return (
      <span
        className={cn(
          "absolute pointer-events-none text-text-tertiary",
          "group-focus-within:text-text-secondary transition-colors",
          leftIconPadding,
        )}
        aria-hidden="true"
      >
        {React.cloneElement(iconLeft as React.ReactElement, {
          className: cn(
            iconSizeClass,
            (iconLeft as React.ReactElement)?.props?.className,
          ),
        })}
      </span>
    );
  };

  const renderRightIcons = () => {
    const icons: React.ReactNode[] = [];

    // Clear button
    if (showClearButton && currentValue.length > 0 && !isDisabled && !isReadOnly) {
      icons.push(
        <button
          key="clear"
          type="button"
          onClick={handleClear}
          className={cn(
            "absolute text-text-tertiary hover:text-text-secondary",
            "transition-colors focus:outline-none focus:text-text-primary",
            rightIconPadding,
          )}
          aria-label="Clear input"
          tabIndex={-1}
        >
          <X className={iconSizeClass} />
        </button>,
      );
    }

    // Password toggle
    if (showPasswordToggle && typeProp === "password" && !isDisabled) {
      icons.push(
        <button
          key="password-toggle"
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          className={cn(
            "absolute text-text-tertiary hover:text-text-secondary",
            "transition-colors focus:outline-none focus:text-text-primary",
            rightIconPadding,
          )}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeOff className={iconSizeClass} />
          ) : (
            <Eye className={iconSizeClass} />
          )}
        </button>,
      );
    }

    // Custom right icon (placed further right if clear/password toggle also present)
    if (iconRight) {
      const offset = icons.length > 0 ? "right-8" : rightIconPadding;
      icons.push(
        <span
          key="custom-right"
          className={cn(
            "absolute pointer-events-none text-text-tertiary",
            "group-focus-within:text-text-secondary transition-colors",
            offset,
          )}
          aria-hidden="true"
        >
          {React.cloneElement(iconRight as React.ReactElement, {
            className: cn(
              iconSizeClass,
              (iconRight as React.ReactElement)?.props?.className,
            ),
          })}
        </span>,
      );
    }

    return <>{icons}</>;
  };

  // ── Validation icon ────────────────────────────────────────────
  const renderValidationIcon = () => {
    if (validation === "valid" && !error) {
      return (
        <CheckCircle2
          className={cn(iconSizeClass, "text-success-500 shrink-0")}
          aria-hidden="true"
        />
      );
    }
    if (validation === "invalid" || error) {
      return (
        <AlertCircle
          className={cn(iconSizeClass, "text-danger-500 shrink-0")}
          aria-hidden="true"
        />
      );
    }
    if (validation === "warning") {
      return (
        <AlertTriangle
          className={cn(iconSizeClass, "text-warning-500 shrink-0")}
          aria-hidden="true"
        />
      );
    }
    return null;
  };

  // ── Helper / Error text ────────────────────────────────────────
  const renderHelperText = () => {
    if (error) {
      return (
        <p
          id={errorId}
          role="alert"
          className={cn(helperTextVariants({ validation: "invalid" }))}
        >
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      );
    }

    if (hint) {
      return (
        <p id={hintId} className={cn(helperTextVariants({ validation }))}>
          {validation === "valid" && (
            <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
          )}
          {validation === "warning" && (
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
          )}
          <span>{hint}</span>
        </p>
      );
    }

    return null;
  };

  // ── ARIA attributes ────────────────────────────────────────────
  const ariaDescribedBy = [
    error ? errorId : null,
    hint && !error ? hintId : null,
    rest["aria-describedby"],
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  // ── Wrapper classes ────────────────────────────────────────────
  const wrapperClassName = cn(
    inputWrapperVariants({
      variant,
      inputSize,
      validation,
      fullWidth,
    }),
    isDisabled && "opacity-50 cursor-not-allowed",
    className,
  );

  // ── Input field classes ────────────────────────────────────────
  const inputClassName = cn(
    inputFieldVariants({
      inputSize,
      hasLeftIcon,
      hasRightIcon,
    }),
    // Underlined variant has no horizontal padding on wrapper
    variant === "underlined" && "px-0",
  );

  // ── Render ─────────────────────────────────────────────────────
  const inputElement = (
    <input
      ref={innerRef}
      id={inputId}
      type={resolvedType}
      value={isControlled ? currentValue : undefined}
      defaultValue={!isControlled ? defaultValue : undefined}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={isDisabled}
      readOnly={isReadOnly}
      required={required}
      aria-required={required ? true : undefined}
      aria-invalid={validation === "invalid" ? true : undefined}
      aria-describedby={ariaDescribedBy}
      aria-errormessage={error ? errorId : undefined}
      className={inputClassName}
      {...rest}
    />
  );

  // ── Full layout ────────────────────────────────────────────────
  return (
    <div className={cn(fullWidth && "w-full")}>
      {/* Label */}
      {label && (
        <label
          htmlFor={inputId}
          className={cn(
            labelVariants({ labelSize: inputSize, disabled: isDisabled }),
          )}
        >
          {label}
          {required && (
            <span
              className="text-danger-500 ml-0.5 select-none"
              aria-hidden="true"
            >
              *
            </span>
          )}
          {required && <span className="sr-only">(required)</span>}
        </label>
      )}

      {/* Input wrapper */}
      <div className={wrapperClassName}>
        {renderLeftIcon()}
        {inputElement}
        {renderRightIcons()}
        {validation !== "none" && !showClearButton && (
          <span
            className={cn(
              "shrink-0",
              inputSize === "sm" ? "pr-2" : inputSize === "lg" ? "pr-4" : "pr-3",
            )}
          >
            {renderValidationIcon()}
          </span>
        )}
        {validation !== "none" && showClearButton && (
          <span
            className={cn(
              "shrink-0",
              inputSize === "sm" ? "pr-2" : inputSize === "lg" ? "pr-4" : "pr-3",
            )}
          >
            {renderValidationIcon()}
          </span>
        )}
      </div>

      {/* Helper / Error text */}
      {renderHelperText()}
    </div>
  );
});

Input.displayName = "Input";

export { Input, inputWrapperVariants, inputFieldVariants, labelVariants, helperTextVariants };
export default Input;

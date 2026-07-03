"use client";

import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
} from "react";
import type {
  ControllerProps,
  FieldPath,
  FieldValues,
  FormProviderProps,
  SubmitHandler,
  UseFormReturn,
} from "react-hook-form";
import { Controller, FormProvider, useFormContext } from "react-hook-form";
import type { ZodSchema, TypeOf, ZodIssue } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormProps } from "react-hook-form";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { Slot } from "@radix-ui/react-slot";
import { Label } from "@radix-ui/react-label";

// ─── Types ──────────────────────────────────────────────────────────

/** Severity level for error summary items (derived from Zod issues) */
type ErrorSeverity = "error" | "warning";

/** A single error entry displayed in the summary */
interface FormErrorEntry {
  /** Field path (e.g. "email" or "address.street") */
  path: string;
  /** Human-readable error message */
  message: string;
  /** Severity derived from the issue or explicitly set */
  severity: ErrorSeverity;
}

// ─── Context: Dirty Tracking ────────────────────────────────────────

interface FormDirtyContextValue {
  /** Whether any field in the form has been modified */
  isDirty: boolean;
  /** Number of fields that have been modified */
  dirtyFieldsCount: number;
  /** Names of fields that have been modified */
  dirtyFieldNames: string[];
  /** Reset dirty tracking (aligns with form reset) */
  resetDirty: () => void;
}

const FormDirtyContext = createContext<FormDirtyContextValue>({
  isDirty: false,
  dirtyFieldsCount: 0,
  dirtyFieldNames: [],
  resetDirty: () => {},
});

/**
 * Hook to access dirty tracking state from any descendant of <Form>.
 */
export function useFormDirty(): FormDirtyContextValue {
  return useContext(FormDirtyContext);
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Convert a dot-path string ("address.street") into a human-readable label
 * ("Address Street"). Handles camelCase splitting too.
 */
function pathToLabel(path: string): string {
  return path
    .split(".")
    .map((segment) =>
      segment
        .replace(/([A-Z])/g, " $1")
        .replace(/[-_]/g, " ")
        .trim()
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    )
    .join(" → ");
}

/**
 * Extract flattened error entries from react-hook-form errors object.
 */
function extractErrors<T extends FieldValues>(
  errors: UseFormReturn<T>["formState"]["errors"],
  parentPath = "",
): FormErrorEntry[] {
  const entries: FormErrorEntry[] = [];

  for (const [key, error] of Object.entries(errors ?? {})) {
    const path = parentPath ? `${parentPath}.${key}` : key;

    if (error && typeof error === "object") {
      // Nested field errors (e.g. address: { street: { message: "..." } })
      if ("message" in error && typeof error.message === "string") {
        entries.push({
          path,
          message: error.message as string,
          severity: "error",
        });
      }

      // Recurse into nested objects (but not arrays of errors)
      const nested = error as Record<string, unknown>;
      if (!nested.message && !nested.type) {
        entries.push(
          ...extractErrors(nested as Record<string, unknown>, path),
        );
      }
    }
  }

  return entries;
}

/**
 * Map Zod issue severity to our ErrorSeverity.
 * Zod's built-in issues don't have severity, but we allow
 * custom issues with a `severity` property via `.refine()` or `.superRefine()`.
 */
function getZodIssueSeverity(issue: ZodIssue): ErrorSeverity {
  // Check for custom params added via refine/superRefine
  const params = issue as ZodIssue & { params?: Record<string, unknown> };
  if (params?.params?.severity === "warning") return "warning";
  return "error";
}

/**
 * Build error entries directly from ZodError (for server-side validation display).
 */
export function zodIssuesToEntries(issues: ZodIssue[]): FormErrorEntry[] {
  return issues.map((issue) => ({
    path: issue.path.join(".") || "_root",
    message: issue.message,
    severity: getZodIssueSeverity(issue),
  }));
}

// ─── Variant Definitions ────────────────────────────────────────────

const errorSummaryVariants = cva(
  [
    "rounded-md border p-4",
    "flex flex-col gap-2",
    "text-sm",
  ],
  {
    variants: {
      variant: {
        destructive: [
          "border-danger-200 bg-danger-50 text-danger-800",
          "dark:border-danger-800 dark:bg-danger-950 dark:text-danger-300",
        ],
        warning: [
          "border-warning-200 bg-warning-50 text-warning-800",
          "dark:border-warning-800 dark:bg-warning-950 dark:text-warning-300",
        ],
      },
      size: {
        sm: "text-xs gap-1.5 p-3",
        md: "text-sm gap-2 p-4",
      },
    },
    defaultVariants: {
      variant: "destructive",
      size: "md",
    },
  },
);

const formMessageVariants = cva(
  ["text-xs font-medium mt-1 flex items-center gap-1"],
  {
    variants: {
      variant: {
        error: "text-danger-600 dark:text-danger-400",
        warning: "text-warning-600 dark:text-warning-400",
        success: "text-success-600 dark:text-success-400",
      },
    },
    defaultVariants: {
      variant: "error",
    },
  },
);

const formLabelVariants = cva(
  [
    "text-sm font-medium leading-none",
    "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
    "text-text-primary",
  ],
);

const formDescriptionVariants = cva(
  ["text-xs text-text-tertiary mt-1"],
);

// ─── FormErrorSummary Component ─────────────────────────────────────

interface FormErrorSummaryProps
  extends VariantProps<typeof errorSummaryVariants> {
  /** Pre-built error entries (from Zod or custom) */
  errors?: FormErrorEntry[];
  /** Show errors from context (react-hook-form formState.errors) automatically */
  showContextErrors?: boolean;
  /** Title displayed above the error list */
  title?: string;
  /** Maximum number of errors to show. Default: 10 */
  maxErrors?: number;
  /** Called when an error item is clicked (e.g. to focus the field) */
  onErrorClick?: (path: string) => void;
  /** Additional CSS classes */
  className?: string;
}

const FormErrorSummary = forwardRef<HTMLDivElement, FormErrorSummaryProps>(
  (props, ref) => {
    const {
      errors: errorsProp,
      showContextErrors = true,
      title = "Please correct the following errors:",
      maxErrors = 10,
      onErrorClick,
      variant,
      size,
      className,
    } = props;

    const formContext = useFormContext();

    // Gather errors from context if available
    const contextEntries = useMemo(() => {
      if (!showContextErrors || !formContext) return [];
      return extractErrors(formContext.formState.errors);
    }, [showContextErrors, formContext, formContext?.formState.errors]);

    // Merge provided errors with context errors
    const allEntries = useMemo(() => {
      const merged = [...(errorsProp ?? []), ...contextEntries];
      // Deduplicate by path (keep first occurrence)
      const seen = new Set<string>();
      return merged.filter((entry) => {
        const key = entry.path;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }, [errorsProp, contextEntries]);

    const displayedEntries = allEntries.slice(0, maxErrors);
    const hasWarnings = displayedEntries.some((e) => e.severity === "warning");
    const hasErrors = displayedEntries.some((e) => e.severity === "error");
    const resolvedVariant =
      variant ?? (hasWarnings && !hasErrors ? "warning" : "destructive");

    if (displayedEntries.length === 0) return null;

    return (
      <div
        ref={ref}
        role="alert"
        aria-live="polite"
        className={cn(errorSummaryVariants({ variant: resolvedVariant, size }), className)}
      >
        {/* Title */}
        <div className="flex items-center gap-2 font-semibold">
          {resolvedVariant === "warning" ? (
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          <span>{title}</span>
        </div>

        {/* Error list */}
        <ul className="list-none space-y-1 m-0 p-0">
          {displayedEntries.map((entry) => (
            <li key={entry.path}>
              <button
                type="button"
                onClick={() => onErrorClick?.(entry.path)}
                className={cn(
                  "flex items-start gap-1.5 text-left w-full",
                  "hover:underline underline-offset-2",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border-focus rounded-sm",
                  entry.severity === "warning"
                    ? "text-warning-700 dark:text-warning-300"
                    : "text-danger-700 dark:text-danger-300",
                )}
              >
                {entry.severity === "warning" ? (
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <span>
                  <span className="font-medium">{pathToLabel(entry.path)}</span>
                  {" — "}
                  <span>{entry.message}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        {/* Truncation notice */}
        {allEntries.length > maxErrors && (
          <p className="text-xs opacity-75 mt-1">
            And {allEntries.length - maxErrors} more error
            {allEntries.length - maxErrors !== 1 ? "s" : ""}...
          </p>
        )}
      </div>
    );
  },
);

FormErrorSummary.displayName = "FormErrorSummary";

// ─── FormMessage Component ──────────────────────────────────────────

interface FormMessageProps
  extends React.HTMLAttributes<HTMLParagraphElement> {
  /** Override variant (auto-detected from error context if omitted) */
  variant?: VariantProps<typeof formMessageVariants>["variant"];
  /** Explicit message (auto-detected from field context if omitted) */
  message?: string;
}

const FormMessage = forwardRef<HTMLParagraphElement, FormMessageProps>(
  (props, ref) => {
    const { variant: variantProp, message: messageProp, className, children, id, ...rest } = props;
    const { getFieldState, formState } = useFormContext();
    const fieldContext = useContext(FormFieldContext);

    const fieldState = fieldContext ? getFieldState(fieldContext.name, formState) : null;
    const errorMessage = fieldState?.error?.message;

    const resolvedMessage = messageProp ?? (typeof errorMessage === "string" ? errorMessage : undefined);
    const resolvedVariant = variantProp ?? (fieldState?.error ? "error" : undefined);

    if (!resolvedMessage && !children) return null;

    const body = children ?? resolvedMessage;

    return (
      <p
        ref={ref}
        id={id}
        role={resolvedVariant === "error" ? "alert" : undefined}
        aria-live={resolvedVariant === "error" ? "polite" : undefined}
        className={cn(
          formMessageVariants({ variant: resolvedVariant }),
          className,
        )}
        {...rest}
      >
        {resolvedVariant === "error" && (
          <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
        )}
        {resolvedVariant === "warning" && (
          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
        )}
        {resolvedVariant === "success" && (
          <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
        )}
        <span>{body}</span>
      </p>
    );
  },
);

FormMessage.displayName = "FormMessage";

// ─── FormLabel Component ────────────────────────────────────────────

interface FormLabelProps
  extends React.ComponentPropsWithoutRef<typeof Label> {
  /** Mark as required (adds asterisk and screen-reader text) */
  required?: boolean;
}

const FormLabel = forwardRef<React.ElementRef<typeof Label>, FormLabelProps>(
  (props, ref) => {
    const { className, children, required, ...rest } = props;
    const fieldContext = useContext(FormFieldContext);
    const formContext = useFormContext();

    // Determine if required from field context or prop
    const isRequired = required ?? false;

    // Build error ID for aria-describedby
    const fieldId = fieldContext?.name ? `${fieldContext.name}-message` : undefined;

    return (
      <Label
        ref={ref}
        className={cn(formLabelVariants(), className)}
        htmlFor={rest.htmlFor}
        {...rest}
      >
        {children}
        {isRequired && (
          <>
            <span className="text-danger-500 ml-0.5 select-none" aria-hidden="true">
              *
            </span>
            <span className="sr-only">(required)</span>
          </>
        )}
      </Label>
    );
  },
);

FormLabel.displayName = "FormLabel";

// ─── FormDescription Component ──────────────────────────────────────

const FormDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>((props, ref) => {
  const { className, ...rest } = props;
  return (
    <p
      ref={ref}
      className={cn(formDescriptionVariants(), className)}
      {...rest}
    />
  );
});

FormDescription.displayName = "FormDescription";

// ─── FormControl Component ──────────────────────────────────────────

const FormControl = forwardRef<
  React.ElementRef<typeof Slot>,
  React.ComponentPropsWithoutRef<typeof Slot>
>((props, ref) => {
  const fieldContext = useContext(FormFieldContext);
  const { error, isDirty, isTouched } = useContext(FormItemContext);
  const fieldId = fieldContext?.name;

  return (
    <Slot
      ref={ref}
      id={props.id ?? fieldId}
      aria-describedby={
        error
          ? `${fieldId}-message`
          : undefined
      }
      aria-invalid={error ? "true" : undefined}
      data-dirty={isDirty ? "true" : undefined}
      data-touched={isTouched ? "true" : undefined}
      {...props}
    />
  );
});

FormControl.displayName = "FormControl";

// ─── FormItem Context ───────────────────────────────────────────────

interface FormItemContextValue {
  id: string;
  name: string;
  error?: { message?: string; type?: string };
  isDirty: boolean;
  isTouched: boolean;
}

const FormItemContext = createContext<FormItemContextValue>({
  id: "",
  name: "",
  error: undefined,
  isDirty: false,
  isTouched: false,
});

// ─── FormItem Component ─────────────────────────────────────────────

const FormItem = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>((props, ref) => {
  const { className, ...rest } = props;
  const fieldContext = useContext(FormFieldContext);

  const { getFieldState, formState } = useFormContext();
  const fieldState = fieldContext
    ? getFieldState(fieldContext.name, formState)
    : null;

  const contextValue = useMemo<FormItemContextValue>(
    () => ({
      id: fieldContext?.name ?? "",
      name: fieldContext?.name ?? "",
      error: fieldState?.error,
      isDirty: fieldState?.isDirty ?? false,
      isTouched: fieldState?.isTouched ?? false,
    }),
    [fieldContext?.name, fieldState],
  );

  return (
    <FormItemContext.Provider value={contextValue}>
      <div
        ref={ref}
        className={cn("flex flex-col", className)}
        {...rest}
      />
    </FormItemContext.Provider>
  );
});

FormItem.displayName = "FormItem";

// ─── FormField Context ──────────────────────────────────────────────

interface FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> {
  name: TName;
}

const FormFieldContext = createContext<FormFieldContextValue>(
  {} as FormFieldContextValue,
);

// ─── FormField Component ────────────────────────────────────────────

const FormField = <
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  ...props
}: ControllerProps<TFieldValues, TName>) => {
  const contextValue = useMemo<FormFieldContextValue<TFieldValues, TName>>(
    () => ({ name: props.name }),
    [props.name],
  );

  return (
    <FormFieldContext.Provider
      value={contextValue as FormFieldContextValue}
    >
      <Controller {...props} />
    </FormFieldContext.Provider>
  );
};

// ─── Form Root Component ────────────────────────────────────────────

type FormProps<
  TFieldValues extends FieldValues = FieldValues,
  TContext = unknown,
> = {
  /** React Hook Form instance (from useForm) */
  form: UseFormReturn<TFieldValues, TContext>;
  /** Submit handler — receives validated form values */
  onSubmit: SubmitHandler<TFieldValues>;
  /** Function called when form submission fails with validation errors */
  onInvalid?: (errors: UseFormReturn<TFieldValues>["formState"]["errors"]) => void;
  /** Show error summary at the top of the form automatically */
  showErrorSummary?: boolean;
  /** Props forwarded to the inner <form> element */
  formProps?: Omit<
    React.FormHTMLAttributes<HTMLFormElement>,
    "onSubmit" | "onInvalid"
  >;
  /** Children (form fields, buttons, etc.) */
  children: React.ReactNode;
  /** Custom CSS class for the form element */
  className?: string;
  /** ID for the form element (auto-generated if omitted) */
  id?: string;
};

function FormInner<
  TFieldValues extends FieldValues = FieldValues,
  TContext = unknown,
>({
  form,
  onSubmit,
  onInvalid,
  showErrorSummary = true,
  formProps,
  children,
  className,
  id: idProp,
}: FormProps<TFieldValues, TContext>) {
  const autoId = useId();
  const formId = idProp ?? autoId;

  // Dirty tracking state
  const [dirtyFieldNames, setDirtyFieldNames] = useState<Set<string>>(
    new Set(),
  );

  const isDirty = form.formState.isDirty;
  const dirtyFieldsCount = dirtyFieldNames.size;

  // Track dirty fields
  const trackedDirty = useMemo(() => {
    const dirty = form.formState.dirtyFields;
    const names: string[] = [];
    const collectDirty = (obj: Record<string, unknown>, prefix = "") => {
      for (const [key, value] of Object.entries(obj)) {
        const path = prefix ? `${prefix}.${key}` : key;
        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
          collectDirty(value as Record<string, unknown>, path);
        } else if (value === true) {
          names.push(path);
        }
      }
    };
    collectDirty(dirty as Record<string, unknown>);
    return names;
  }, [form.formState.dirtyFields]);

  // Sync tracked dirty field names
  const dirtyNamesArray = useMemo(() => {
    return Array.from(
      new Set([...Array.from(dirtyFieldNames), ...trackedDirty]),
    );
  }, [dirtyFieldNames, trackedDirty]);

  const resetDirty = useCallback(() => {
    setDirtyFieldNames(new Set());
  }, []);

  const dirtyContextValue = useMemo<FormDirtyContextValue>(
    () => ({
      isDirty,
      dirtyFieldsCount: dirtyNamesArray.length,
      dirtyFieldNames: dirtyNamesArray,
      resetDirty,
    }),
    [isDirty, dirtyNamesArray, resetDirty],
  );

  // Handle submission
  const handleSubmit = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      form.handleSubmit(
        (values) => {
          onSubmit(values);
          // Reset dirty tracking on successful submit (optional)
          resetDirty();
        },
        (errors) => {
          onInvalid?.(errors);
        },
      )(e);
    },
    [form, onSubmit, onInvalid, resetDirty],
  );

  // Scroll to error summary on validation failure
  const errorSummaryRef = React.useRef<HTMLDivElement>(null);
  const prevErrorCount = React.useRef(0);

  const currentErrorCount = Object.keys(form.formState.errors).length;

  React.useEffect(() => {
    if (
      currentErrorCount > 0 &&
      currentErrorCount !== prevErrorCount.current &&
      errorSummaryRef.current &&
      showErrorSummary
    ) {
      errorSummaryRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      // Focus the error summary for accessibility
      errorSummaryRef.current.focus();
    }
    prevErrorCount.current = currentErrorCount;
  }, [currentErrorCount, showErrorSummary]);

  const isSubmitting = form.formState.isSubmitting;
  const isSubmitSuccessful = form.formState.isSubmitSuccessful;

  return (
    <FormDirtyContext.Provider value={dirtyContextValue}>
      <FormProvider {...(form as FormProviderProps<TFieldValues, TContext>)}>
        <form
          id={formId}
          noValidate
          onSubmit={handleSubmit}
          className={cn(
            "flex flex-col gap-6",
            isSubmitting && "pointer-events-none opacity-60",
            className,
          )}
          {...formProps}
        >
          {/* Error Summary */}
          {showErrorSummary && (
            <div ref={errorSummaryRef} tabIndex={-1} className="outline-none">
              <FormErrorSummary
                title={
                  Object.keys(form.formState.errors).length === 1
                    ? "Please correct the following error:"
                    : "Please correct the following errors:"
                }
                showContextErrors
                onErrorClick={(path) => {
                  // Focus the field by its ID
                  const el = document.getElementById(path);
                  el?.focus();
                  el?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
              />
            </div>
          )}

          {/* Children */}
          {children}
        </form>
      </FormProvider>
    </FormDirtyContext.Provider>
  );
}

// ─── Form Wrapper (exported as Form) ─────────────────────────────────

/**
 * Root form component that wraps react-hook-form's FormProvider.
 *
 * @example
 * ```tsx
 * const form = useForm({
 *   resolver: zodResolver(schema),
 *   defaultValues: { email: "" },
 * });
 *
 * return (
 *   <Form form={form} onSubmit={(values) => console.log(values)}>
 *     <FormField
 *       control={form.control}
 *       name="email"
 *       render={({ field }) => (
 *         <FormItem>
 *           <FormLabel>Email</FormLabel>
 *           <FormControl>
 *             <Input placeholder="you@example.com" {...field} />
 *           </FormControl>
 *           <FormMessage />
 *         </FormItem>
 *       )}
 *     />
 *     <Button type="submit" loading={form.formState.isSubmitting}>
 *       Submit
 *     </Button>
 *   </Form>
 * );
 *
 */
const Form = FormInner as <
  TFieldValues extends FieldValues = FieldValues,
  TContext = unknown,
>(
  props: FormProps<TFieldValues, TContext>,
) => React.ReactElement;

// ─── useZodForm Hook ────────────────────────────────────────────────

/**
 * Convenience hook that creates a react-hook-form instance pre-configured
 * with a Zod schema resolver.
 *
 * @example
 * ```tsx
 * const schema = z.object({
 *   email: z.string().email(),
 *   password: z.string().min(8),
 * });
 *
 * const form = useZodForm(schema, {
 *   defaultValues: { email: "", password: "" },
 * });
 *
 */
export function useZodForm<TSchema extends ZodSchema>(
  schema: TSchema,
  options?: Omit<UseFormProps<TypeOf<TSchema>>, "resolver">,
): UseFormReturn<TypeOf<TSchema>> {
  return useForm<TypeOf<TSchema>>({
    resolver: zodResolver(schema),
    mode: options?.mode ?? "onTouched",
    ...options,
  });
}

// ─── Exports ────────────────────────────────────────────────────────

export { Form };
export { FormErrorSummary };
export { FormMessage };
export { FormLabel };
export { FormDescription };
export { FormControl };
export { FormItem };
export { FormField };
export { useFormDirty };

export type {
  FormProps,
  FormErrorEntry,
  ErrorSeverity,
  FormDirtyContextValue,
};

export { formMessageVariants, formLabelVariants, formDescriptionVariants, errorSummaryVariants };
export default Form;
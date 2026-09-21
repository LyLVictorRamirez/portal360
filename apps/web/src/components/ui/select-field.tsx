import { useId, type ReactNode, type SelectHTMLAttributes } from "react";

import { cn } from "../../lib/utils";
import { Field, FieldDescription, FieldError, FieldLabel } from "./field";

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
  error?: ReactNode;
  helpText?: ReactNode;
  id?: string;
  label: ReactNode;
};

export function SelectField({
  "aria-describedby": ariaDescribedBy,
  "aria-errormessage": ariaErrorMessage,
  "aria-invalid": ariaInvalid,
  className,
  error,
  helpText,
  id,
  label,
  required,
  ...props
}: SelectFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? `field-${generatedId}`;
  const helpTextId = `${fieldId}-help`;
  const errorId = `${fieldId}-error`;
  const hasError = error !== undefined && error !== null;
  const hasHelpText = helpText !== undefined && helpText !== null;
  const describedBy = [
    ariaDescribedBy,
    hasHelpText ? helpTextId : undefined,
    hasError ? errorId : undefined,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Field data-invalid={hasError || ariaInvalid === true}>
      <FieldLabel htmlFor={fieldId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </FieldLabel>
      <select
        aria-describedby={describedBy || undefined}
        aria-errormessage={hasError ? errorId : ariaErrorMessage}
        aria-invalid={hasError ? true : ariaInvalid}
        className={cn(
          "border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          hasError && "border-destructive",
          className,
        )}
        id={fieldId}
        required={required}
        {...props}
      />
      {hasHelpText ? <FieldDescription id={helpTextId}>{helpText}</FieldDescription> : null}
      {hasError ? <FieldError id={errorId}>{error}</FieldError> : null}
    </Field>
  );
}

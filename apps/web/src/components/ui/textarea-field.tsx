import { useId, type ReactNode, type TextareaHTMLAttributes } from "react";

import { cn } from "../../lib/utils";
import { Field, FieldDescription, FieldError, FieldLabel } from "./field";
import { Textarea } from "./textarea";

type TextareaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  error?: ReactNode;
  helpText?: ReactNode;
  id?: string;
  label: ReactNode;
};

export function TextareaField({
  "aria-describedby": ariaDescribedBy,
  "aria-errormessage": ariaErrorMessage,
  "aria-invalid": ariaInvalid,
  className,
  error,
  helpText,
  id,
  label,
  required,
  rows = 4,
  ...props
}: TextareaFieldProps) {
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
      <Textarea
        aria-describedby={describedBy || undefined}
        aria-errormessage={hasError ? errorId : ariaErrorMessage}
        aria-invalid={hasError ? true : ariaInvalid}
        className={cn("min-h-28", hasError && "border-destructive", className)}
        id={fieldId}
        required={required}
        rows={rows}
        {...props}
      />
      {hasHelpText ? <FieldDescription id={helpTextId}>{helpText}</FieldDescription> : null}
      {hasError ? <FieldError id={errorId}>{error}</FieldError> : null}
    </Field>
  );
}

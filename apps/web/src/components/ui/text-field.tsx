import { useId, type InputHTMLAttributes, type ReactNode } from "react";

import { cn } from "../../lib/utils";
import { Field, FieldDescription, FieldError, FieldLabel } from "./field";
import { Input } from "./input";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  error?: ReactNode;
  helpText?: ReactNode;
  helpTextDisplay?: "always" | "focus";
  id?: string;
  label: ReactNode;
};

export function TextField({
  "aria-describedby": ariaDescribedBy,
  "aria-errormessage": ariaErrorMessage,
  "aria-invalid": ariaInvalid,
  className,
  error,
  helpText,
  helpTextDisplay = "always",
  id,
  label,
  required,
  ...props
}: TextFieldProps) {
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
    <Field
      className={cn(helpTextDisplay === "focus" && "group")}
      data-invalid={hasError || ariaInvalid === true}
    >
      <FieldLabel htmlFor={fieldId}>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </FieldLabel>
      <Input
        aria-describedby={describedBy || undefined}
        aria-errormessage={hasError ? errorId : ariaErrorMessage}
        aria-invalid={hasError ? true : ariaInvalid}
        className={cn(hasError && "border-destructive", className)}
        id={fieldId}
        required={required}
        {...props}
      />
      {hasHelpText ? (
        <FieldDescription
          className={cn(
            helpTextDisplay === "focus" &&
              "hidden text-xs leading-4 group-focus-within:block group-data-[invalid=true]/field:hidden",
          )}
          id={helpTextId}
        >
          {helpText}
        </FieldDescription>
      ) : null}
      {hasError ? <FieldError id={errorId}>{error}</FieldError> : null}
    </Field>
  );
}

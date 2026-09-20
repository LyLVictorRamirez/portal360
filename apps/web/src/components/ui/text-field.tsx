import { useId, type InputHTMLAttributes, type ReactNode } from "react";

import { FieldLabel } from "./field-label";
import { Input } from "./input";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id"> & {
  error?: ReactNode;
  helpText?: ReactNode;
  id?: string;
  label: ReactNode;
};

const inputClassName =
  "h-10 w-full rounded-md border bg-surface px-3 text-sm text-foreground transition-colors duration-150 placeholder:text-muted hover:border-border-strong focus:border-primary disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted disabled:opacity-100";

export function TextField({
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
    <div className="space-y-1.5">
      <FieldLabel htmlFor={fieldId} required={required}>
        {label}
      </FieldLabel>
      <Input
        aria-describedby={describedBy || undefined}
        aria-errormessage={hasError ? errorId : ariaErrorMessage}
        aria-invalid={hasError ? true : ariaInvalid}
        className={[
          inputClassName,
          hasError ? "border-danger focus:border-danger" : "border-border",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        id={fieldId}
        required={required}
        {...props}
      />
      {hasHelpText ? (
        <p id={helpTextId} className="text-sm leading-5 text-muted">
          {helpText}
        </p>
      ) : null}
      {hasError ? (
        <p id={errorId} role="alert" className="text-sm leading-5 text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

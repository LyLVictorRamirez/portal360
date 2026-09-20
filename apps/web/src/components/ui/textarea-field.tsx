import { useId, type ReactNode, type TextareaHTMLAttributes } from "react";

import { FieldLabel } from "./field-label";
import { Textarea } from "./textarea";

type TextareaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> & {
  error?: ReactNode;
  helpText?: ReactNode;
  id?: string;
  label: ReactNode;
};

const textareaClassName =
  "min-h-28 w-full resize-y rounded-md border bg-surface px-3 py-2.5 text-sm leading-6 text-foreground transition-colors duration-150 placeholder:text-muted hover:border-border-strong focus:border-primary disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted disabled:opacity-100";

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
    <div className="space-y-1.5">
      <FieldLabel htmlFor={fieldId} required={required}>
        {label}
      </FieldLabel>
      <Textarea
        aria-describedby={describedBy || undefined}
        aria-errormessage={hasError ? errorId : ariaErrorMessage}
        aria-invalid={hasError ? true : ariaInvalid}
        className={[
          textareaClassName,
          hasError ? "border-danger focus:border-danger" : "border-border",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        id={fieldId}
        required={required}
        rows={rows}
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

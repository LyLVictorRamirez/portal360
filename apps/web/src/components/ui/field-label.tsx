import type { LabelHTMLAttributes, ReactNode } from "react";

type FieldLabelProps = Omit<LabelHTMLAttributes<HTMLLabelElement>, "children" | "htmlFor"> & {
  children: ReactNode;
  htmlFor: string;
  required?: boolean;
};

export function FieldLabel({
  children,
  className,
  htmlFor,
  required = false,
  ...props
}: FieldLabelProps) {
  return (
    <label
      className={["block text-sm font-semibold leading-5 text-foreground", className]
        .filter(Boolean)
        .join(" ")}
      htmlFor={htmlFor}
      {...props}
    >
      {children}
      {required ? (
        <>
          <span aria-hidden="true" className="ml-1 text-danger">
            *
          </span>
          <span className="sr-only"> obligatorio</span>
        </>
      ) : null}
    </label>
  );
}

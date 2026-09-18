import type { FieldError as RhfFieldError } from "react-hook-form";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

type FormItemProps = {
  label: React.ReactNode;
  htmlFor: string;
  error?: RhfFieldError;
  description?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

/** Label + control + description + error, wired to react-hook-form's error shape. */
export function FormItem({ label, htmlFor, error, description, className, children }: FormItemProps) {
  return (
    <Field data-invalid={Boolean(error)} className={className}>
      <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel>
      {children}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError errors={[error]} />
    </Field>
  );
}

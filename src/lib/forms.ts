import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { toast } from "sonner";

import type { ActionResult } from "@/types";

/**
 * Pushes server-side validation errors into the form and shows a toast for
 * the general error. Returns true when the result was a failure.
 */
export function handleActionFailure<T extends FieldValues, R>(
  form: { setError: UseFormSetError<T> },
  result: ActionResult<R>,
): result is Extract<ActionResult<R>, { success: false }> {
  if (result.success) return false;

  const entries = Object.entries(result.fieldErrors ?? {});
  for (const [name, messages] of entries) {
    const message = messages?.[0];
    if (message) form.setError(name as Path<T>, { type: "server", message });
  }
  if (entries.length === 0 || !result.fieldErrors) {
    toast.error(result.error);
  }
  return true;
}

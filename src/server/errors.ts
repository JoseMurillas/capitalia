/**
 * Raised by services when a business rule is violated. Actions translate it
 * into an `ActionResult` failure with a user-facing message; anything else is
 * treated as an unexpected error.
 */
export class ServiceError extends Error {
  readonly fieldErrors?: Record<string, string[]>;

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(message);
    this.name = "ServiceError";
    this.fieldErrors = fieldErrors;
  }
}

export class NotFoundError extends ServiceError {
  constructor(entity: string) {
    super(`${entity} no existe`);
    this.name = "NotFoundError";
  }
}

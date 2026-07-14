export interface ApiErrorDetail {
  property: string;
  constraints?: Record<string, string>;
}

/**
 * The backend answers with one envelope shape (ResponseInterceptor /
 * CustomExceptionFilter), and a 422 from the global ValidationPipe carries
 * per-field `details`. This is that shape, typed — so a form can bind straight
 * to the fields the API rejected.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: ApiErrorDetail[],
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** `{ email: 'email must be an email' }` — ready for setError() in react-hook-form. */
  fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const detail of this.details ?? []) {
      const first = Object.values(detail.constraints ?? {})[0];
      if (first) out[detail.property] = first;
    }
    return out;
  }
}

export function toApiError(status: number, body: unknown): ApiError {
  if (body && typeof body === "object") {
    const b = body as { message?: unknown; details?: ApiErrorDetail[] };
    if (typeof b.message === "string") {
      return new ApiError(status, b.message, b.details);
    }
  }
  return new ApiError(status, `Request failed with status ${status}`);
}

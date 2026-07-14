function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

/**
 * Server-only env, accessed lazily via getters.
 *
 * `next build` imports the API route modules (`/api/public`, `/api/bff`) to
 * collect page data, so any validation that runs at *import* time would fire
 * during the build — where `API_URL` is intentionally absent (secrets/config are
 * runtime-only, and `.env*.local` is kept out of the Docker image). Resolving
 * inside getters defers validation to first access at request time, which is the
 * only moment these values are actually needed.
 */
export const env = {
  get API_URL(): string {
    return required("API_URL", process.env.API_URL);
  },
  get AUTH_SECRET(): string {
    return process.env.AUTH_SECRET ?? "";
  },
  get AUTH_GOOGLE_ID(): string {
    return process.env.AUTH_GOOGLE_ID ?? "";
  },
  get AUTH_GOOGLE_SECRET(): string {
    return process.env.AUTH_GOOGLE_SECRET ?? "";
  },
  get AUTH_EXCHANGE_SECRET(): string {
    return process.env.AUTH_EXCHANGE_SECRET ?? "local-auth-exchange-secret-please-change";
  },
};

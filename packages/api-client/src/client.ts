import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./schema";
import { toApiError } from "./errors";

export interface ApiClientOptions {
  /** e.g. http://localhost:9000 — no trailing slash, no /v1 (that is in the paths). */
  baseUrl: string;
  /**
   * Returns the current access token, or null when signed out. Called per request,
   * so the token can be refreshed underneath without rebuilding the client.
   */
  getToken?: () => string | null | undefined | Promise<string | null | undefined>;
}

/**
 * A typed fetch client generated from the backend's OpenAPI contract.
 *
 * Types come from schema.d.ts, which is regenerated from apps/backend/openapi.json
 * by `bun run generate`. Turbo orders that after backend#openapi, so the types
 * cannot drift from the API.
 */
export function createApiClient({ baseUrl, getToken }: ApiClientOptions) {
  const client = createClient<paths>({ baseUrl });

  const auth: Middleware = {
    async onRequest({ request }) {
      const token = await getToken?.();
      if (token) request.headers.set("Authorization", `Bearer ${token}`);
      return request;
    },
    async onResponse({ response }) {
      if (response.ok) return response;

      // Normalize every failure into an ApiError carrying the backend's message
      // and, for a 422, the per-field details.
      let body: unknown = null;
      try {
        body = await response.clone().json();
      } catch {
        // Not JSON (a proxy error page, say) — the status still tells the story.
      }
      throw toApiError(response.status, body);
    },
  };

  client.use(auth);
  return client;
}

export type ApiClient = ReturnType<typeof createApiClient>;

import type { ApiError } from "./types";

export function apiError(message: string, status: number) {
  return Response.json({ error: message } satisfies ApiError, { status });
}

export function missingKey(name: string) {
  return apiError(`API-nyckeln saknas. Lägg till ${name} i .env.local och starta om servern.`, 503);
}

// Logs an upstream failure and answers with a message the user can act on.
// The free Trafiklab keys allow 25 calls a minute, so 429 gets its own text.
export function upstreamError(error: unknown, message: string) {
  console.error(error);
  if (String(error).includes("429")) return apiError("För många anrop just nu. Vänta en minut och försök igen.", 429);
  return apiError(message, 502);
}

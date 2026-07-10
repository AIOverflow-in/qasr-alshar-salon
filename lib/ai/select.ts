// Pure, dependency-free selection/config helpers for the AI provider seam —
// unit-tested in select.test.ts. No SDKs / env side-effects here so the routing
// logic can be tested in isolation; the factory (index.ts) applies it.

export const SUPPORTED_TEXT_PROVIDERS = ["openai"] as const;
export const SUPPORTED_IMAGE_PROVIDERS = ["openai"] as const;
export const DEFAULT_PROVIDER = "openai";

/**
 * Normalise an env value (e.g. TEXT_PROVIDER) to a supported provider id.
 * Unknown / empty values fall back to `fallback` so a typo can never leave the
 * blog with no provider — it degrades to the default rather than crashing.
 */
export function pickProvider(
  value: string | undefined,
  supported: readonly string[],
  fallback: string = DEFAULT_PROVIDER,
): string {
  const v = (value ?? "").trim().toLowerCase();
  return supported.includes(v) ? v : fallback;
}

/** Resolve a model id: explicit generic var → legacy provider var → hard default. */
export function resolveModel(
  primary: string | undefined,
  legacy: string | undefined,
  fallback: string,
): string {
  return (primary?.trim() || legacy?.trim() || fallback);
}

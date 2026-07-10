// Provider-agnostic AI interfaces for the blog engine. The blog code talks only
// to these; each concrete provider (OpenAI today; Claude, GLM later) is a small
// adapter selected by env. Text, image and research are INDEPENDENT slots — e.g.
// Claude can write text but cannot generate images, so you can run Claude for
// text and OpenAI/GLM for images without touching the blog logic.

export type ChatMessage = { role: "system" | "user"; content: string };

/** Generates a JSON blog document from a system+user prompt. Returns the raw JSON string. */
export interface TextProvider {
  readonly name: string;
  generateJSON(messages: ChatMessage[], opts?: { temperature?: number }): Promise<string>;
}

/** Generates a hero image. Returns raw PNG bytes, or null on any failure (caller falls back). */
export interface ImageProvider {
  readonly name: string;
  generateImage(
    prompt: string,
    opts?: { size?: string; quality?: string; timeoutMs?: number },
  ): Promise<Buffer | null>;
}

/**
 * Live web-search keyword research (used by the Stage-2 daily harvest cron).
 * Runs the provider's web-search tool and returns its findings as text for the
 * caller to distil into keywords. Implemented per-provider alongside the cron.
 */
export interface ResearchProvider {
  readonly name: string;
  webResearch(prompt: string, opts?: { timeoutMs?: number }): Promise<string>;
}

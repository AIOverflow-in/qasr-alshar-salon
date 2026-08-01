import "server-only";
import OpenAI from "openai";
import type { TextProvider, ImageProvider, ResearchProvider, ChatMessage } from "./types";
import { resolveModel } from "./select";

// OpenAI adapters for the blog seam. Behaviour is identical to the pre-seam
// direct calls in lib/openai.ts — this just moves them behind the interfaces.

function client(maxRetries?: number): OpenAI | null {
  return process.env.OPENAI_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY, ...(maxRetries !== undefined ? { maxRetries } : {}) })
    : null;
}

/** OpenAI text provider (chat.completions, JSON mode). Returns null if no API key. */
export function openaiTextProvider(model?: string): TextProvider | null {
  // The assistant passes its own (cheap) model so it never inherits the blog's expensive one.
  // One retry, not the SDK default of two — a stuck 429 shouldn't mean three billed attempts.
  const c = client(model ? 1 : undefined);
  if (!c) return null;
  const m = model ?? resolveModel(process.env.BLOG_TEXT_MODEL, process.env.OPENAI_BLOG_MODEL, "gpt-4.1");
  return {
    name: `openai:${m}`,
    async generateJSON(messages: ChatMessage[], opts) {
      const completion = await c.chat.completions.create(
        {
          model: m,
          temperature: opts?.temperature ?? 0.8,
          response_format: { type: "json_object" },
          ...(opts?.maxTokens ? { max_completion_tokens: opts.maxTokens } : {}),
          messages,
        },
        opts?.timeoutMs ? { timeout: opts.timeoutMs } : undefined,
      );
      return completion.choices[0]?.message?.content ?? "{}";
    },
  };
}

/** OpenAI image provider (images.generate). Returns PNG bytes, or null on any failure. */
export function openaiImageProvider(): ImageProvider | null {
  const c = client();
  if (!c) return null;
  const model = resolveModel(process.env.BLOG_IMAGE_MODEL, process.env.OPENAI_IMAGE_MODEL, "gpt-image-1");
  return {
    name: `openai:${model}`,
    async generateImage(prompt, opts) {
      try {
        const result = await c.images.generate(
          { model, prompt, size: (opts?.size as "1536x1024") ?? "1536x1024", quality: (opts?.quality as "medium") ?? "medium", n: 1 },
          { timeout: opts?.timeoutMs ?? 35_000 },
        );
        const b64 = result.data?.[0]?.b64_json;
        return b64 ? Buffer.from(b64, "base64") : null;
      } catch (e) {
        console.error("[ai/openai] image generation failed:", e);
        return null;
      }
    },
  };
}

/**
 * OpenAI research provider — runs the built-in web_search tool via the Responses
 * API and returns its text findings. Best-effort: any failure returns "" so the
 * harvest degrades to model-knowledge keywords rather than breaking.
 */
export function openaiResearchProvider(): ResearchProvider | null {
  const c = client();
  if (!c) return null;
  const model = resolveModel(process.env.BLOG_TEXT_MODEL, process.env.OPENAI_BLOG_MODEL, "gpt-4.1");
  return {
    name: `openai:${model}:web_search`,
    async webResearch(prompt, opts) {
      try {
        const res = await c.responses.create(
          { model, tools: [{ type: "web_search" }], input: prompt },
          { timeout: opts?.timeoutMs ?? 40_000 },
        );
        return res.output_text ?? "";
      } catch (e) {
        console.error("[ai/openai] web research failed (degrading to model-only):", e);
        return "";
      }
    },
  };
}

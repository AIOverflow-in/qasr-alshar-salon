import "server-only";
import OpenAI from "openai";
import type { TextProvider, ImageProvider, ChatMessage } from "./types";
import { resolveModel } from "./select";

// OpenAI adapters for the blog seam. Behaviour is identical to the pre-seam
// direct calls in lib/openai.ts — this just moves them behind the interfaces.

function client(): OpenAI | null {
  return process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
}

/** OpenAI text provider (chat.completions, JSON mode). Returns null if no API key. */
export function openaiTextProvider(): TextProvider | null {
  const c = client();
  if (!c) return null;
  const model = resolveModel(process.env.BLOG_TEXT_MODEL, process.env.OPENAI_BLOG_MODEL, "gpt-4.1");
  return {
    name: `openai:${model}`,
    async generateJSON(messages: ChatMessage[], opts) {
      const completion = await c.chat.completions.create({
        model,
        temperature: opts?.temperature ?? 0.8,
        response_format: { type: "json_object" },
        messages,
      });
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

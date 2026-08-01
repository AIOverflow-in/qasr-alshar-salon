import "server-only";
import type { TextProvider, ImageProvider, ResearchProvider } from "./types";
import { pickProvider, SUPPORTED_TEXT_PROVIDERS, SUPPORTED_IMAGE_PROVIDERS } from "./select";
import { openaiTextProvider, openaiImageProvider, openaiResearchProvider } from "./openai";

// Factory for the blog AI seam. Reads TEXT_PROVIDER / IMAGE_PROVIDER (default
// "openai") and returns the matching adapter, or null when the provider's key
// is absent so the caller can fall back gracefully. Add a provider by wiring a
// new case here + its adapter file — no change to the blog logic.

export function getTextProvider(): TextProvider | null {
  const which = pickProvider(process.env.TEXT_PROVIDER, SUPPORTED_TEXT_PROVIDERS);
  switch (which) {
    case "openai":
    default:
      return openaiTextProvider();
  }
}

/**
 * Text provider for the ERP assistant. Deliberately does NOT read the blog's model vars —
 * tuning the blog for quality must never silently multiply the assistant's bill. Defaults to a
 * cheap small model; text-to-SQL over ~17 tables does not need the flagship.
 */
export function getAssistantProvider(): TextProvider | null {
  const which = pickProvider(process.env.TEXT_PROVIDER, SUPPORTED_TEXT_PROVIDERS);
  const model = process.env.ASSISTANT_TEXT_MODEL?.trim() || "gpt-4.1-mini";
  switch (which) {
    case "openai":
    default:
      return openaiTextProvider(model);
  }
}

export function getImageProvider(): ImageProvider | null {
  const which = pickProvider(process.env.IMAGE_PROVIDER, SUPPORTED_IMAGE_PROVIDERS);
  switch (which) {
    case "openai":
    default:
      return openaiImageProvider();
  }
}

export function getResearchProvider(): ResearchProvider | null {
  // Research rides on the text provider's search tool; default openai.
  const which = pickProvider(process.env.TEXT_PROVIDER, SUPPORTED_TEXT_PROVIDERS);
  switch (which) {
    case "openai":
    default:
      return openaiResearchProvider();
  }
}

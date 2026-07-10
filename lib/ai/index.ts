import "server-only";
import type { TextProvider, ImageProvider } from "./types";
import { pickProvider, SUPPORTED_TEXT_PROVIDERS, SUPPORTED_IMAGE_PROVIDERS } from "./select";
import { openaiTextProvider, openaiImageProvider } from "./openai";

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

export function getImageProvider(): ImageProvider | null {
  const which = pickProvider(process.env.IMAGE_PROVIDER, SUPPORTED_IMAGE_PROVIDERS);
  switch (which) {
    case "openai":
    default:
      return openaiImageProvider();
  }
}

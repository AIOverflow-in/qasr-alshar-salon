// Pure text hygiene for AI-generated blog content — unit-tested in
// blog-content-core.test.ts. Its one job today: remove em-dashes, which Jacqueline
// flagged as the clearest "this was written by AI" tell. The prompt already forbids
// them; this is the guarantee they never reach a published post.

/**
 * Replace em-dashes / horizontal bars (— ―) with a comma, then tidy the spacing
 * that leaves behind. Numeric hyphen ranges ("6-8 weeks") and Markdown list
 * markers ("- item") are untouched — we only target the em-dash characters.
 */
export function stripEmDashes(s: string): string {
  return String(s ?? "")
    .replace(/\s*[—―]\s*/g, ", ") // em-dash / horizontal bar between words → comma
    .replace(/\s+,/g, ",")        // " ," → ","
    .replace(/,\s*,/g, ",")       // ",," → ","
    .replace(/,\s*\./g, ".");     // ", ." → "."
}

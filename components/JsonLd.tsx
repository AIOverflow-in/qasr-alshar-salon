/** Inline JSON-LD structured-data script. */
export function JsonLd({ data }: { data: object }) {
  // Escape HTML-significant characters so a value (e.g. a post title) can never
  // break out of the <script> tag. Search engines parse the \uXXXX escapes
  // identically, so this is purely defensive with no SEO cost.
  const json = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}

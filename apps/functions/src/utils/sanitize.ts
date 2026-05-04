import sanitizeHtml from "sanitize-html";

/** Remove ALL HTML tags — only plain text allowed */
export function sanitizeText(input: string): string {
  if (!input || typeof input !== "string") return input;
  return sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
  }).trim();
}

/** Allow basic formatting tags for long-form fields (notes, descriptions) */
export function sanitizeRichText(input: string): string {
  if (!input || typeof input !== "string") return input;
  return sanitizeHtml(input, {
    allowedTags: ["b", "i", "em", "strong", "br", "p"],
    allowedAttributes: {},
  }).trim();
}

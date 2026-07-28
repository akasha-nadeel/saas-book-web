/**
 * Where to send a writer after they sign in or confirm an email.
 *
 * The destination arrives in a query string — `/signin?next=/book/abc` — which
 * means anyone can put anything in it. An unchecked value here is a classic
 * open redirect: a link that looks like it goes to OpenChapter, authenticates
 * for real, and lands the writer on someone else's page still trusting it.
 *
 * So: same-site absolute paths only, and nothing else is negotiable.
 */
export function safeNext(raw: unknown): string {
  if (typeof raw !== "string" || raw.length === 0) return "/";

  // Must be rooted. "//evil.example" and "https://evil.example" are both
  // off-site; the first is protocol-relative and reads as a path if you only
  // check the leading slash.
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";

  // "/\evil.example" is treated as protocol-relative by some browsers, and a
  // backslash has no business in one of our paths regardless.
  if (raw.includes("\\")) return "/";

  return raw;
}

/**
 * What a writer typed into the link box, turned into a URL.
 *
 * **A domain is what people type**, and `example.com` in an `href` is a
 * *relative* path — a link to a file of that name next to the chapter, which
 * in an EPUB resolves to nothing at all. So the scheme is added rather than
 * demanded, and the box asks for a link instead of insisting on a protocol
 * nobody thinks about.
 *
 * **Only three schemes survive.** A manuscript here becomes an EPUB, and an
 * EPUB is markup a reading app runs: `javascript:` in an `href` is the one
 * thing a writer can type into this box that is genuinely dangerous, and it
 * would travel into every file they ship. So the list is what a book actually
 * needs — the web and an email address — and everything else is refused rather
 * than escaped, which is the same call `stripInvalidXml` makes one layer down.
 *
 * Null means *this is not a link*, so the caller can decline instead of
 * storing `https://` over the writer's words.
 */

/** What may already be in front of a URL. Anything else is refused outright. */
const KEPT = ["http://", "https://", "mailto:"];

export function normalizeHref(input: string): string | null {
  const typed = input.trim();
  if (!typed) return null;

  const lower = typed.toLowerCase();

  /* Already schemed. Kept as typed — the case of a path can matter, and only
     the scheme was ever being tested. */
  if (KEPT.some((scheme) => lower.startsWith(scheme))) {
    /* A scheme and nothing after it is somebody who started typing and
       stopped, not a link. */
    const rest = typed.slice(typed.indexOf(":") + 1).replace(/^\/+/, "");
    return rest ? typed : null;
  }

  /* Any *other* scheme is refused rather than repaired. Guessing that
     `javascript:alert(1)` meant `https://javascript:alert(1)` would be worse
     than saying no. The test is a colon before the first slash, which is what
     a scheme is. */
  const colon = typed.indexOf(":");
  const slash = typed.indexOf("/");
  if (colon > 0 && (slash === -1 || colon < slash)) return null;

  /* An address rather than a site. Checked before the dot below, because an
     address has one too. */
  if (typed.includes("@")) {
    const [name, host] = typed.split("@");
    return name && host && host.includes(".") ? `mailto:${typed}` : null;
  }

  /* A host has a dot in it. Without one this is a word, and a word with
     `https://` in front of it is a link to nowhere that looks like a link to
     somewhere — which is worse than refusing it. */
  if (!typed.includes(".")) return null;

  /* A leading `//` is protocol-relative, which has no meaning in a file that
     is opened from disk. */
  return `https://${typed.replace(/^\/+/, "")}`;
}

/**
 * The English word list the near-miss check reads.
 *
 * **Fetched, not imported.** `public/typo-words.txt` is 360,336 words and 3.64
 * megabytes; as a module that would be three and a half megabytes of source for
 * the JavaScript parser to chew through on every load of whichever chunk held
 * it. As a text file the server gzips it to about a megabyte in transit, the
 * browser caches it, and turning it into a `Set` is two string operations.
 *
 * Measured on a fast machine: **split 168ms, build the Set 189ms — 357ms to
 * become usable, holding about 30MB** — and then 200,000 lookups in 5ms. On a
 * phone, call it a second and a half. Once.
 *
 * **Nothing fetches it until a writer ticks that one check**, which is the
 * whole reason the picker defaults to nothing selected. Most writers will never
 * download it at all.
 *
 * ## Why the check needs it
 *
 * Measured against two novels from Project Gutenberg, the same rule run with
 * and without a word list:
 *
 * | | Pride and Prejudice | Moby Dick |
 * |---|---|---|
 * | no list | 162 findings | 757 |
 * | top 10,000 words | 101 | 609 |
 * | this list | **1** | **30** |
 *
 * A small frequency list does not do it, because the question is whether a rare
 * word is *real* rather than whether it is *common* — `applies`, `assures` and
 * `healthy` are all absent from a top-10,000 list, and every one of them would
 * be reported as a typo.
 */

/**
 * The list, once. `null` means it could not be fetched.
 *
 * Module-level and not stored: it is a static asset behind the browser's own
 * HTTP cache, so a second fetch costs nothing and there is nothing here worth
 * putting in `localStorage`.
 */
let held: Set<string> | null = null;
let asked: Promise<Set<string> | null> | null = null;

/**
 * Under this, whatever came back is not the word list.
 *
 * The file is three and a half megabytes. A sign-in page is a few thousand
 * bytes, and an error page fewer — so this separates them with a wide margin
 * and needs no maintenance when the list grows.
 */
const MIN_LIST_BYTES = 1_000_000;

/**
 * How long to wait before giving up on the word list.
 *
 * **A hung fetch is worse than a failed one**, and this had none. `run()` awaits
 * this inside its animation frame, so a request that never settles leaves the
 * button reading *Reading 4 chapters…* for ever, with no findings, no reason
 * and no way out — which is precisely the silence the rest of this check is
 * built to avoid. It showed up against a dev server mid-restart; on a phone it
 * is a dropped connection.
 *
 * Forty-five seconds is long enough for a megabyte on a bad connection and
 * short enough that nobody is left staring. Giving up answers `null`, which the
 * report already knows how to say out loud.
 */
const GIVE_UP_AFTER = 45_000;

/**
 * The word list, or `null` if it could not be had.
 *
 * **`null` is not an empty list, and the difference is the whole of why this
 * returns one.** The editor is expected to work with the network off, so a
 * failed fetch is an ordinary event rather than a bug — and a check that
 * quietly ran against no dictionary would report every unusual word in the book
 * as a typo. So the caller leaves the check out of `ran` instead, and the
 * screen says the list could not be loaded. An empty result rendered as a good
 * one is the failure this module's house rules are strictest about; this is the
 * same rule one step further out.
 */
export function loadTypoWords(): Promise<Set<string> | null> {
  if (held) return Promise.resolve(held);
  asked ??= fetch("/typo-words.txt", { signal: AbortSignal.timeout(GIVE_UP_AFTER) })
    .then((res) => (res.ok ? res.text() : null))
    .then((text) => {
      /*
       * **A 200 is not proof this is the word list.**
       *
       * `src/proxy.ts` gates everything that is not an image or a font, and
       * `.txt` was not on that list — so this fetch answered a 307 to
       * `/signin`, `fetch` followed it, and `res.ok` was true for a page of
       * HTML. Splitting that on newlines builds a "dictionary" of markup, and
       * every real word in the book then reads as a typo. The proxy is fixed;
       * this is the second lock, because the failure it produces is silent and
       * looks like a working check.
       */
      if (text === null || text.length < MIN_LIST_BYTES || text.startsWith("<")) {
        return null;
      }
      held = new Set(text.split("\n"));
      return held;
    })
    .catch(() => null)
    .finally(() => {
      // A failure is not cached: the writer may simply have been offline, and
      // the next press should try again rather than answer from a stale no.
      if (!held) asked = null;
    });
  return asked;
}

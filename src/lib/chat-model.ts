/**
 * The two models the assistant offers, named once.
 *
 * **Its own module for the same reason `panel-tabs.ts` is.** `library-store.ts`
 * stores which one the writer picked, so it needs the type — and `ai.ts`, where
 * the models actually live, imports the Anthropic SDK at the top of the file.
 * A store importing that would drag the whole SDK into the browser bundle for
 * the sake of a two-member union.
 *
 * So the vocabulary lives here, importing nothing, and `ai.ts` re-exports it
 * alongside the model ids and the request tuning that only a server may know.
 *
 * **The words are about the wait, not about the intelligence.** On an Anthropic
 * deployment Quick is Haiku and Careful is Sonnet; on a Google one they are the
 * same model. Anything the panel or the cards say about one being cleverer is a
 * claim that is false on half the installations — what is true everywhere is
 * that one answers straight away and the other thinks first, and that they are
 * metered separately.
 */

export type ChatModel = "quick" | "careful";

/**
 * Narrows what a request body, a stored preference or a URL claims to want.
 *
 * Callers default rather than throwing, and every one of them defaults to
 * `quick` — the cheap model on the daily meter. A malformed value must not
 * spend a reply out of the scarcer monthly allowance.
 */
export function asChatModel(value: unknown): ChatModel | null {
  return value === "quick" || value === "careful" ? value : null;
}

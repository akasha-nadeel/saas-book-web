/**
 * The three models the assistant offers, named once.
 *
 * **Its own module for the same reason `panel-tabs.ts` is.** `library-store.ts`
 * stores which one the writer picked, so it needs the type — and `ai.ts`, where
 * the models actually live, imports the Anthropic SDK at the top of the file.
 * A store importing that would drag the whole SDK into the browser bundle for
 * the sake of a three-member union.
 *
 * So the vocabulary lives here, importing nothing, and `ai.ts` re-exports it
 * alongside the model ids and the request tuning that only a server may know.
 *
 * **The words are about the wait, not about the intelligence.** On an Anthropic
 * deployment Quick is Haiku, Careful is Sonnet and Deep is Opus; on a Google
 * one all three are the same model. Anything the panel or the cards say about
 * one being cleverer is a claim that is false on half the installations — what
 * is true everywhere is how long the writer waits and what the reply costs.
 *
 * **`quick` and `careful` are the original two and have never left the disk.**
 * They were briefly renamed to `light` and `close` on 2026-09-04 and renamed
 * back the same day; the map below is what carries a preference written in that
 * window, and it is the only reason those two words appear in this file.
 */

export type ChatModel = "quick" | "careful" | "deep";

/** The order they are offered in, cheapest first. */
export const CHAT_MODELS: readonly ChatModel[] = ["quick", "careful", "deep"];

/**
 * What each one is called on screen.
 *
 * **Here rather than in the panel**, because the picker, the pricing cards, the
 * comparison table, `/billing` and the Help dialog all print these words — and
 * a card naming a model the panel calls something else is the kind of drift
 * nothing fails on. The panel had the only copy while it was the only caller.
 */
export const MODEL_NAMES: Record<ChatModel, string> = {
  quick: "Quick",
  careful: "Careful",
  deep: "Deep",
};

/**
 * Vocabulary that has been used for these models and is no longer canonical.
 *
 * **This is not tidy-up-able while anything might still hold one.** The
 * writer's choice lives in `prefs` through `library-store.ts`, so whatever was
 * canonical when they last touched the picker is what is on their disk.
 * Dropping a line here silently resets those writers to the default, and one
 * who had chosen the thinking model would be answered by the cheap one with
 * nothing on screen to say why.
 *
 * `close` becomes `careful` rather than `deep`: it was Sonnet under both names,
 * so the writer keeps the model they picked instead of being promoted into one
 * that costs ten times as much.
 */
const RENAMED: Record<string, ChatModel> = {
  light: "quick",
  close: "careful",
};

/**
 * Narrows what a request body, a stored preference or a URL claims to want.
 *
 * Callers default rather than throwing, and every one of them defaults to
 * `quick` — the cheapest model. A malformed value must not spend a hundred
 * credits out of somebody's month.
 */
export function asChatModel(value: unknown): ChatModel | null {
  if (typeof value !== "string") return null;
  if ((CHAT_MODELS as readonly string[]).includes(value)) {
    return value as ChatModel;
  }
  return RENAMED[value] ?? null;
}

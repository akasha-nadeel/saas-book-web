/**
 * What a search tool was showing, kept for the life of the tab.
 *
 * **The fault this exists for.** The dashboard mounts one area at a time —
 * `{area === "title-check" && <TitleCheckArea />}` — so pressing anything in
 * the side panel unmounts the tool and throws away every piece of its state.
 * A writer who checked a title, glanced at their shelf and came back found an
 * empty box, and the title check then re-ran a five-page catalogue sweep for
 * the browsing wall it had already fetched.
 *
 * **This is memory, not storage, and that is a decision rather than a
 * shortcut.** `library-store.ts` remains the only module that touches
 * `localStorage`; nothing here reaches past it, because there is nothing here
 * to persist. A search result is a hundred catalogue records and the name of a
 * book somebody has not published yet, and writing that to a disk that may be
 * shared — to save a re-fetch after the tab is closed — is a poor trade. It
 * dies with the page, which is exactly as long as the convenience is worth.
 *
 * **It cannot grow.** One entry per tool, replaced on each search, so the map
 * holds as many values as there are callers — two.
 *
 * **Written where the facts are made, never mirrored by an effect.** A caller
 * `remember`s at the end of a successful search and reads with `recall` in a
 * lazy `useState` initialiser. An effect syncing state into here would be a
 * second copy kept in step by hand, which is the shape that drifts.
 */

const kept = new Map<string, unknown>();

/** Keep this tool's snapshot, replacing whatever it had. */
export function remember<T>(key: string, value: T): void {
  kept.set(key, value);
}

/**
 * What this tool was showing, or `null` if it has not searched in this tab.
 *
 * Unchecked on the way out, like any cache read: the value comes from the same
 * module that wrote it one mount earlier, not from a network or a disk, so
 * there is no ragged input here to narrow. It is `null` rather than
 * `undefined` so a caller can write `recall(…) ?? initial` without thinking
 * about which absence it is.
 */
export function recall<T>(key: string): T | null {
  return (kept.get(key) as T | undefined) ?? null;
}

/** Drop a tool's snapshot. Nothing calls this yet; it is here for a caller
    that needs to clear itself, and costs nothing until then. */
export function forget(key: string): void {
  kept.delete(key);
}

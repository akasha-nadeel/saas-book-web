/**
 * Chapter history — a safety net, deliberately not an archive.
 *
 * From the research: *"Keeping backups up to date"* named as a pain of its own,
 * and behind it the fear every writer has of a bad afternoon being permanent.
 * The answer is not a version-control system; it is being able to say "give me
 * this chapter as it was before lunch".
 *
 * **A ceiling shaped everything here, and the bounds outlived it.**
 * `localStorage` is about 5MB an origin and this app lived close to it, so
 * history is bounded twice: by how many snapshots a chapter keeps, and by how
 * many bytes they may occupy together. Oldest goes first.
 *
 * The manuscript moved to IndexedDB on 2026-08-17 and the room is now measured
 * in gigabytes — and the numbers stayed, because they were only ever half about
 * the browser. What history promises is *"this chapter as it was before
 * lunch"*, and eight versions of every chapter of every book a writer will ever
 * own is the archive the first paragraph refuses to be.
 *
 * **And history must never cost the manuscript.** If a snapshot cannot be
 * written there is nothing to tell the writer and nothing to do: the chapter
 * itself has already been saved by then, which is the write that matters. See
 * `saveSnapshot` in library-store.ts — it swallows a failed write on purpose.
 */

export interface Snapshot {
  /** Epoch ms of the moment it was taken. */
  at: number;
  /** The stored Tiptap document, exactly as the body key holds it. */
  body: string;
  /** Word count then, so the panel can show the change without parsing. */
  words: number;
}

/** How many versions of one chapter are worth keeping. */
export const MAX_SNAPSHOTS = 8;

/**
 * How much room one chapter's history may take.
 *
 * 400KB is roughly eight copies of a long chapter, and about a twelfth of the
 * origin's whole budget. A book with forty chapters cannot possibly keep that
 * much each, which is the point of the *global* sweep in library-store.ts:
 * this cap keeps one chapter honest, and the sweep keeps the library honest.
 */
export const MAX_HISTORY_BYTES = 400_000;

/**
 * How much room *all* of it may take, across every chapter of every book.
 *
 * **The sweep the comment above promised did not exist**, and that is what
 * filled a real writer's storage: the per-chapter cap is not a bound on
 * anything, because nothing bounds the number of chapters. Forty-five chapters
 * at 400KB each is 18MB against an origin of five, so the first thing to fail
 * was an autosave — on a chapter that had nothing to do with the history that
 * had eaten the room.
 *
 * 1.5MB was chosen as under a third of that origin, and it stayed when the
 * library moved onto IndexedDB — where there is no shortage to ration. What it
 * buys at that size is every recent version of the chapters actually being
 * worked on, which is the whole promise: "this chapter as it was before lunch",
 * not "last March". Raising it would not deliver more of what history is for,
 * only more of what it declines to be.
 */
export const MAX_LIBRARY_HISTORY_BYTES = 1_500_000;

/**
 * How long between snapshots of the same chapter.
 *
 * A snapshot per save would be a snapshot every few seconds, which fills the
 * budget with versions nobody wants — a writer looking for "before lunch" is
 * not looking for "before that comma". Ten minutes gives roughly an afternoon's
 * worth inside the eight kept.
 */
export const SNAPSHOT_EVERY_MS = 10 * 60 * 1000;

/**
 * Whether this save is worth remembering.
 *
 * Two gates. Enough time has to have passed, *and* the text has to have
 * genuinely changed — otherwise a chapter left open with an autosave ticking
 * over would push out the eight versions that mattered with eight identical
 * ones.
 */
export function shouldSnapshot(
  history: readonly Snapshot[],
  body: string,
  now: number,
): boolean {
  const last = history[0];
  if (!last) return true;
  if (last.body === body) return false;
  return now - last.at >= SNAPSHOT_EVERY_MS;
}

/**
 * One more version, newest first, inside both budgets.
 *
 * Count first, then bytes: a chapter of nine short versions is trimmed to
 * eight, and a chapter of three enormous ones may be trimmed to one. The newest
 * is always kept even if it alone is over the byte budget — a snapshot that
 * evicted itself would be a feature that silently does nothing.
 */
export function addSnapshot(
  history: readonly Snapshot[],
  snapshot: Snapshot,
): Snapshot[] {
  const out = [snapshot, ...history].slice(0, MAX_SNAPSHOTS);

  let bytes = 0;
  const kept: Snapshot[] = [];
  for (const item of out) {
    bytes += item.body.length;
    if (kept.length > 0 && bytes > MAX_HISTORY_BYTES) break;
    kept.push(item);
  }
  return kept;
}

/**
 * Snapshots out of stored JSON, newest first.
 *
 * Every field checked rather than trusted — this is `localStorage`, which no
 * compiler has ever looked at, and one malformed row should cost that row
 * rather than a writer's whole history.
 */
export function parseHistory(raw: string | null): Snapshot[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const out: Snapshot[] = [];
  for (const row of parsed) {
    const record = row as Record<string, unknown>;
    if (typeof record?.body !== "string" || !record.body) continue;
    out.push({
      at: typeof record.at === "number" ? record.at : 0,
      body: record.body,
      words: typeof record.words === "number" ? record.words : 0,
    });
  }
  return out.sort((a, b) => b.at - a.at);
}

/**
 * How many times a chapter has been through a pass.
 *
 * The other half of what writers ask for — *"my first chapter has had about
 * twenty rounds of editing"* — and the reason this is on the same panel as the
 * versions: they are one question asked twice. It counts *sessions* rather than
 * saves, since a save is a keystroke settling and a session is a sitting.
 *
 * A gap longer than the snapshot interval is a new sitting. Rough, and honest
 * about being rough: the number is there to make circling visible, not to be
 * audited.
 */
export function passesOf(history: readonly Snapshot[]): number {
  if (history.length === 0) return 0;
  // Oldest first, so the gaps read forwards.
  const times = [...history].map((s) => s.at).sort((a, b) => a - b);
  let passes = 1;
  for (let i = 1; i < times.length; i++) {
    if (times[i] - times[i - 1] > SNAPSHOT_EVERY_MS * 3) passes++;
  }
  return passes;
}

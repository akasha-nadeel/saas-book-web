"use client";

import { MAX_SNAPSHOTS, passesOf } from "@/lib/history";
import { saveBody } from "@/lib/library-store";
import { plural } from "@/lib/plural";
import { relativeTime } from "@/lib/relative-time";
import { useHistory } from "@/lib/use-library";

/**
 * A chapter's saved versions, and how many sittings it has had.
 *
 * **Two features on one panel because they are one question asked twice.**
 * Writers ask for backups — *"keeping backups up to date"* named as a pain of
 * its own — and separately describe circling: *"my first chapter has had about
 * twenty rounds of editing"*, *"I feel like I haven't even seen that version of
 * the book in over a year"*. The versions are the answer to the first. Counting
 * them is the answer to the second, because nobody can see themselves circling
 * from the inside, and a number they did not have to keep is the cheapest way
 * to show it.
 *
 * **It is a safety net, not an archive**, and the panel says so. Eight versions
 * at most, a byte budget behind that, and a budget across the whole library
 * behind *that*. Those bounds were drawn against a five-megabyte origin and
 * outlived it: the manuscript is on IndexedDB now, and eight versions of every
 * chapter of every book a writer will ever own is still the archive this
 * refuses to be. What this can promise is "this chapter as it was before
 * lunch". What it cannot promise is last March.
 */
export function HistoryPanel({
  bookId,
  chapterId,
}: {
  bookId: string;
  chapterId: string;
}) {
  const history = useHistory(chapterId);
  const passes = passesOf(history);

  function restore(body: string, words: number) {
    if (
      !window.confirm(
        "Put this version back? What is in the chapter now becomes the newest saved version, so this can be undone.",
      )
    ) {
      return;
    }
    // Through `saveBody`, which is what makes the promise in that sentence
    // true: the current text was snapshotted on its own last autosave and is
    // still in the list, so restoring is reversible by restoring again.
    try {
      // It answers a promise since the manuscript moved onto IndexedDB, and a
      // rejection here is the disk refusing — which raises the out-of-room
      // dialog for itself. The catch is for the parse, as it always was; this
      // one is so a refusal is not an unhandled rejection in the console.
      void saveBody(bookId, chapterId, JSON.parse(body), words).catch(() => {});
    } catch {
      // A version that will not parse is a version that cannot be restored.
      // Nothing sensible to do, and nothing has been damaged.
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line p-3">
        <p className="font-sans text-sm font-semibold text-fg">
          {passes === 0
            ? "No versions saved yet"
            : `${passes} ${passes === 1 ? "sitting" : "sittings"} on this chapter`}
        </p>
        <p className="mt-1 font-sans text-[11px] leading-relaxed text-muted">
          A version is kept about every ten minutes you are editing, and the
          last {MAX_SNAPSHOTS} are kept. This is a safety net for a bad
          afternoon, not an archive.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {history.length === 0 ? (
          <p className="font-sans text-sm text-muted">
            Nothing yet. Versions start appearing once you have been writing for
            a while.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((version, i) => (
              <li
                key={version.at}
                className="rounded-lg border border-line bg-panel p-3"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-sans text-sm text-fg">
                    {relativeTime(version.at)}
                  </span>
                  <span className="font-sans text-[11px] text-muted">
                    {plural(version.words, "word")}
                    {/* The change against the version before it, which is the
                        only number that tells a writer which of eight
                        near-identical timestamps is the one they want. */}
                    {i < history.length - 1 &&
                      changeLabel(version.words, history[i + 1].words)}
                  </span>
                </div>
                {i === 0 ? (
                  <p className="mt-1.5 font-sans text-[11px] text-muted">
                    The most recent save.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => restore(version.body, version.words)}
                    className="mt-2 font-sans text-[11px] font-semibold text-accent"
                  >
                    Put this version back
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** " · +240" or " · −80", or nothing when the count did not move. */
function changeLabel(words: number, previous: number): string {
  const delta = words - previous;
  if (delta === 0) return "";
  return ` · ${delta > 0 ? "+" : "−"}${Math.abs(delta).toLocaleString()}`;
}

"use client";

import { useState } from "react";
import { MAX_SNAPSHOTS, passesOf } from "@/lib/history";
import { saveBody } from "@/lib/library-store";
import { plural } from "@/lib/plural";
import { relativeTime } from "@/lib/relative-time";
import { useHistory } from "@/lib/use-library";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ListFooter,
  ListGroup,
  ListRow,
  RowAction,
  SectionHeader,
} from "@/components/ui/list";

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

  /* Was `window.confirm`, which the browser can be told to stop showing — see
     `ui/dialog.tsx`. The version to put back is held until the question is
     answered rather than being read out of a blocking call. */
  const [asking, setAsking] = useState<{
    body: string;
    words: number;
  } | null>(null);

  function restore(body: string, words: number) {
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
      {/* **The count is the header; the explanation moved under the list.**
          This opened on two paragraphs — what a version is, how often one is
          kept, how many are held — before a writer reached a single version.
          A paragraph above a list is read once and then read past forever; the
          same words below are found by whoever went looking for them. */}
      <div className="border-b border-line px-3 py-2.5">
        <p className="font-sans text-[13px] font-semibold text-fg">
          {passes === 0
            ? "No versions saved yet"
            : `${passes} ${passes === 1 ? "sitting" : "sittings"} on this chapter`}
        </p>
      </div>

      <div className="scroll-slim flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
        {history.length === 0 ? (
          <EmptyState
            glyph={
              <>
                <path d="M12 8v4l3 2" />
                <path d="M3.05 11a9 9 0 1 1 .5 4" />
                <path d="M3 4v5h5" />
              </>
            }
            title="No versions yet"
          >
            Versions start appearing once you have been writing for a while.
          </EmptyState>
        ) : (
          <>
            <SectionHeader trailing={history.length}>Versions</SectionHeader>

            {/* **One group of eight rows, where this was eight cards.** Each
                version had its own border, its own ground and its own gap —
                which on a 240px rail is a pile rather than a list, and made
                eight near-identical timestamps harder to compare, not easier. */}
            <ListGroup>
              {history.map((version, i) => (
                <ListRow
                  key={version.at}
                  title={relativeTime(version.at)}
                  detail={
                    <>
                      {plural(version.words, "word")}
                      {/* The change against the version before it, which is
                          the only number that tells a writer which of eight
                          near-identical timestamps is the one they want. */}
                      {i < history.length - 1 &&
                        changeLabel(version.words, history[i + 1].words)}
                    </>
                  }
                  trailing={
                    i === 0 ? (
                      <span className="text-[11px] text-muted">Current</span>
                    ) : (
                      <RowAction
                        label={`Put back the version from ${relativeTime(version.at)}`}
                        onClick={() =>
                          setAsking({ body: version.body, words: version.words })
                        }
                      >
                        Restore
                      </RowAction>
                    )
                  }
                />
              ))}
            </ListGroup>

            <ListFooter>
              A version is kept about every ten minutes you are editing, and the
              last {MAX_SNAPSHOTS} are kept. This is a safety net for a bad
              afternoon, not an archive.
            </ListFooter>
          </>
        )}
      </div>

      {asking && (
        <ConfirmDialog
          title="Put this version back?"
          body="What is in the chapter now becomes the newest saved version, so this can be undone."
          confirmLabel="Restore"
          danger={false}
          onConfirm={() => restore(asking.body, asking.words)}
          onClose={() => setAsking(null)}
        />
      )}
    </div>
  );
}

/** " · +240" or " · −80", or nothing when the count did not move. */
function changeLabel(words: number, previous: number): string {
  const delta = words - previous;
  if (delta === 0) return "";
  return ` · ${delta > 0 ? "+" : "−"}${Math.abs(delta).toLocaleString()}`;
}

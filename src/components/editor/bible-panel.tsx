"use client";

import { useMemo, useState } from "react";
import {
  KINDS,
  mentionedIn,
  type BibleEntry,
  type EntryKind,
} from "@/lib/bible";
import { saveBibleRaw } from "@/lib/library-store";
import { chapterText } from "@/lib/search";
import { useBible, useChapterBody } from "@/lib/use-library";

/**
 * The story bible, in the rail beside the manuscript.
 *
 * From the research: *"keeping track of details across multiple books must be
 * tricky"*, and *"I do get stuck sometimes… I usually forget some of my ideas.
 * I started writing notes on my phone."* A discovery writer invents a
 * character's sister in chapter four and needs her name in chapter nineteen,
 * by which point the only copy is somewhere in sixty thousand words.
 *
 * **In this chapter comes first, and that is the argument for the feature.**
 * Anyone can keep a file of names; nobody keeps it current. What a file cannot
 * do is tell you who is in the chapter you have open — and that is a search
 * over what is already written, so it is right whether or not the writer has
 * maintained anything.
 *
 * Aliases matter more than they look. A character who is Elizabeth to the
 * narrator and Lizzie to her brother is one person, and a lookup that missed
 * the second would be worse than no lookup at all.
 */
export function BiblePanel({
  bookId,
  chapterId,
}: {
  bookId: string;
  chapterId: string;
}) {
  const entries = useBible(bookId);
  const body = useChapterBody(chapterId);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [aka, setAka] = useState("");
  const [detail, setDetail] = useState("");
  const [kind, setKind] = useState<EntryKind>("character");
  const [open, setOpen] = useState<string | null>(null);

  const here = useMemo(
    () => mentionedIn(chapterText("", body), entries),
    [body, entries],
  );

  function commit(next: BibleEntry[]) {
    saveBibleRaw(bookId, JSON.stringify(next));
  }

  function add() {
    if (!name.trim()) return;
    commit([
      ...entries,
      {
        id: crypto.randomUUID(),
        kind,
        name: name.trim(),
        aka: aka
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        detail: detail.trim(),
        at: Date.now(),
      },
    ]);
    setName("");
    setAka("");
    setDetail("");
    setAdding(false);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-line p-3">
        <span className="font-sans text-xs tracking-wide text-muted uppercase">
          Story bible
        </span>
        <button
          type="button"
          onClick={() => setAdding((a) => !a)}
          className="rounded-md bg-accent px-2.5 py-1 font-sans text-xs font-semibold text-accent-ink"
        >
          {adding ? "Cancel" : "Add"}
        </button>
      </div>

      {adding && (
        <form
          className="flex flex-col gap-2 border-b border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as EntryKind)}
            className="rounded-md border border-line bg-surface px-2 py-1.5 font-sans text-sm text-fg"
          >
            {KINDS.map((k) => (
              <option key={k.id} value={k.id}>
                {k.label}
              </option>
            ))}
          </select>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            aria-label="Name"
            className="rounded-md border border-line bg-surface px-2 py-1.5 font-sans text-sm
                       text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          />
          <input
            value={aka}
            onChange={(e) => setAka(e.target.value)}
            placeholder="Also called (comma separated)"
            aria-label="Also called"
            className="rounded-md border border-line bg-surface px-2 py-1.5 font-sans text-sm
                       text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          />
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={3}
            placeholder="Anything you will forget by chapter nineteen"
            aria-label="Detail"
            className="resize-none rounded-md border border-line bg-surface px-2 py-1.5
                       font-sans text-sm text-fg outline-none
                       focus-visible:ring-2 focus-visible:ring-accent/50"
          />
          <button
            type="submit"
            disabled={!name.trim()}
            className="rounded-md bg-accent px-3 py-1.5 font-sans text-xs font-semibold
                       text-accent-ink disabled:opacity-40"
          >
            Add to the bible
          </button>
        </form>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {entries.length === 0 ? (
          <p className="font-sans text-sm text-muted">
            Nothing here yet. Add the people, places and things you will have
            forgotten the details of by the time they come back.
          </p>
        ) : (
          <>
            {/* First, and deliberately. This is the half a plain file cannot
                do, and it is right even when the bible is out of date. */}
            <p className="mb-2 font-sans text-xs tracking-wide text-muted uppercase">
              In this chapter
            </p>
            {here.length === 0 ? (
              <p className="mb-4 font-sans text-sm text-muted">
                None of them, by name at least.
              </p>
            ) : (
              <ul className="mb-5 flex flex-wrap gap-1.5">
                {here.map(({ entry, count }) => (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setOpen(open === entry.id ? null : entry.id)
                      }
                      className="rounded-full bg-accent/10 px-2.5 py-1 font-sans text-xs
                                 font-medium text-accent"
                    >
                      {entry.name}
                      <span className="ml-1 opacity-70">{count}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {KINDS.map((k) => {
              const inKind = entries.filter((e) => e.kind === k.id);
              if (inKind.length === 0) return null;
              return (
                <div key={k.id} className="mb-4">
                  <p className="mb-1.5 font-sans text-xs tracking-wide text-muted uppercase">
                    {k.label}
                  </p>
                  <ul className="flex flex-col gap-1">
                    {inKind.map((entry) => (
                      <li key={entry.id}>
                        <button
                          type="button"
                          onClick={() =>
                            setOpen(open === entry.id ? null : entry.id)
                          }
                          className="w-full rounded-md px-2 py-1.5 text-left font-sans
                                     text-sm text-fg hover:bg-raised"
                        >
                          {entry.name}
                          {entry.aka.length > 0 && (
                            <span className="text-muted">
                              {" "}
                              · {entry.aka.join(", ")}
                            </span>
                          )}
                        </button>
                        {open === entry.id && (
                          <div className="mt-1 rounded-md bg-raised p-2.5">
                            {entry.detail ? (
                              <p className="font-sans text-xs leading-relaxed whitespace-pre-wrap text-fg">
                                {entry.detail}
                              </p>
                            ) : (
                              <p className="font-sans text-xs text-muted">
                                No detail written.
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                commit(
                                  entries.filter((e) => e.id !== entry.id),
                                );
                                setOpen(null);
                              }}
                              className="mt-2 font-sans text-[11px] text-muted"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}


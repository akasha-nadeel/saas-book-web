"use client";

import { useEffect, useRef, useState } from "react";
import {
  connectionsOf,
  KINDS,
  kindOf,
  removeLink,
  updateEntry,
  type BibleEntry,
  type BibleLink,
  type Connection,
  type EntryKind,
} from "@/lib/bible";
import { plural } from "@/lib/plural";
import type { SeriesBook } from "@/lib/series";
import { Field } from "@/components/ui/field";
import {
  ListFooter,
  ListGroup,
  ListRow,
  SectionHeader,
} from "@/components/ui/list";
import { Segmented } from "@/components/ui/segmented";
import { KindDot, KindMark } from "./kind-marks";
import { BackButton, BarButton, PageBar, PageColumn } from "./page-bar";

/** One book's copy of an entry. `book` is null in the one-book scope. */
export interface Copy {
  book: SeriesBook | null;
  entry: BibleEntry;
}

export type BibleEdit = (entries: readonly BibleEntry[]) => readonly BibleEntry[];

/** What the form holds while it is open. Aliases stay one string until saved. */
export interface Draft {
  kind: EntryKind;
  name: string;
  aka: string;
  detail: string;
}

/** A link struck out during an edit, applied only when the edit is kept. */
interface Struck {
  holder: string;
  link: BibleLink;
}

/**
 * One entry, on a page of its own — the way a contact opens on iOS rather than
 * growing in place inside the list.
 *
 * **Reading and editing are one page in two states**, which is Contacts' own
 * shape: Edit turns the same page into fields, Done keeps the lot and Cancel
 * throws the lot away. Struck-out connections are part of that — they are
 * held in the draft and written with it, so Cancel really does leave the entry
 * as it was.
 *
 * **In the series view the page shows one book's copy at a time**, with a
 * switcher when several books wrote the entry. Everything the page does is
 * written to the book on screen, which is the rule removing has always
 * followed: nothing is changed in a manuscript the writer is not looking at
 * without the page saying which one.
 */
export function EntryPage({
  copies,
  initialBookId,
  openBookId,
  entriesIn,
  mentions,
  backLabel,
  focusId,
  onBack,
  onOpenEntry,
  onConnect,
  onChange,
  onDelete,
}: {
  copies: readonly Copy[];
  /** Which copy to show first. Null is the open book's. */
  initialBookId: string | null;
  openBookId: string;
  /** A book's own entries, which is all a link can point at. */
  entriesIn: (book: SeriesBook | null) => readonly BibleEntry[];
  /** How often the open chapter names this entry. */
  mentions: number;
  backLabel: string;
  /**
   * The element to focus on arrival, when the writer is coming *back* to this
   * page — the connection they followed out of it. Absent on the way in, when
   * the title takes focus instead.
   */
  focusId?: string;
  onBack: () => void;
  onOpenEntry: (entryId: string, book: SeriesBook | null, fromId: string) => void;
  onConnect: (copy: Copy) => void;
  onChange: (book: SeriesBook | null, edit: BibleEdit) => void;
  onDelete: (copy: Copy) => void;
}) {
  const keyOf = (c: Copy) => c.book?.id ?? openBookId;
  const [shown, setShown] = useState(() => {
    const wanted = initialBookId ?? openBookId;
    return keyOf(copies.find((c) => keyOf(c) === wanted) ?? copies[0]);
  });
  const copy = copies.find((c) => keyOf(c) === shown) ?? copies[0];
  const { entry, book } = copy;
  const entries = entriesIn(book);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [struck, setStruck] = useState<Struck[]>([]);
  const [confirming, setConfirming] = useState(false);

  const title = useRef<HTMLHeadingElement>(null);
  /* Focus follows the move. Pushed here, it lands on the title, so a screen
     reader hears where it has arrived and a keyboard carries on from the top
     of the new page; come back here, it lands on the connection that was
     followed out, which is where the writer's place in this page was.

     **One effect decides both**, and that is the fix rather than a style: the
     way back used to be a `requestAnimationFrame` in the panel focusing the
     row, racing this effect focusing the title on the remounted page — and
     the title won. A DOM side effect, not state, which is what an effect is
     for. */
  useEffect(() => {
    const back = focusId ? document.getElementById(focusId) : null;
    if (back) back.focus();
    else title.current?.focus({ preventScroll: true });
  }, [focusId]);

  const kind = kindOf(entry.kind);
  const otherBook = book && book.id !== openBookId ? book : null;
  const all = connectionsOf(entry, entries);
  const connections = all.filter(
    (c) => !struck.some((s) => sameStrike(s, strikeOf(entry, c))),
  );
  const canConnect = entries.length > 1;

  function startEdit() {
    setDraft({
      kind: entry.kind,
      name: entry.name,
      aka: entry.aka.join(", "),
      detail: entry.detail,
    });
    setStruck([]);
    setConfirming(false);
  }

  function cancel() {
    setDraft(null);
    setStruck([]);
    setConfirming(false);
  }

  function done() {
    if (!draft || !draft.name.trim()) return;
    const kept = draft;
    const strikes = struck;
    onChange(book, (list) => {
      let next = list;
      for (const s of strikes) next = removeLink(next, s.holder, s.link);
      return updateEntry(next, entry.id, {
        kind: kept.kind,
        name: kept.name,
        aka: kept.aka.split(","),
        detail: kept.detail.trim(),
      });
    });
    cancel();
  }

  const subtitle = [
    kind.one,
    entry.aka.length > 0 ? `also ${entry.aka.join(", ")}` : null,
    copies.length === 1 && otherBook ? `written in ${otherBook.title}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageBar
        left={
          draft ? (
            <BarButton onClick={cancel}>Cancel</BarButton>
          ) : (
            <BackButton label={backLabel} onClick={onBack} />
          )
        }
        right={
          draft ? (
            <BarButton strong onClick={done} disabled={!draft.name.trim()}>
              Done
            </BarButton>
          ) : (
            <BarButton onClick={startEdit}>Edit</BarButton>
          )
        }
      />

      <PageColumn>
        <div className="flex items-start gap-3.5 px-1 pt-2 pb-5">
          <KindMark kind={draft?.kind ?? entry.kind} size="md" />
          <div className="min-w-0 flex-1">
            <h2
              ref={title}
              tabIndex={-1}
              className="font-sans text-[26px] leading-tight font-bold tracking-tight break-words text-fg outline-none"
            >
              {entry.name}
            </h2>
            <p className="mt-1 font-sans text-[13px] text-muted">{subtitle}</p>
            {mentions > 0 && (
              <p className="mt-0.5 font-sans text-[12px] text-muted tabular-nums">
                Named {plural(mentions, "time")} in this chapter
              </p>
            )}
          </div>
        </div>

        {copies.length > 1 && !draft && (
          <div className="mb-4">
            <Segmented
              label="Which book's entry"
              value={shown}
              onChange={setShown}
              options={copies.map((c) => ({
                value: keyOf(c),
                label: c.book
                  ? c.book.index === undefined
                    ? c.book.title
                    : `${c.book.index}. ${c.book.title}`
                  : "This book",
              }))}
            />
          </div>
        )}

        {draft ? (
          <EntryForm draft={draft} onDraft={setDraft} />
        ) : (
          <>
            <SectionHeader>About</SectionHeader>
            <ListGroup className="mb-5">
              {entry.detail ? (
                <p className="px-3.5 py-3 font-sans text-[13px] leading-relaxed whitespace-pre-wrap text-fg">
                  {entry.detail}
                </p>
              ) : (
                <ListRow onClick={startEdit} leading={<PlusDisc />}>
                  <span className="font-sans text-[13px] text-accent">
                    Add a description
                  </span>
                </ListRow>
              )}
            </ListGroup>
          </>
        )}

        <SectionHeader
          className={draft ? "mt-5" : ""}
          trailing={connections.length > 0 ? connections.length : undefined}
        >
          Connections
        </SectionHeader>
        {connections.length > 0 || (!draft && canConnect) ? (
          <ListGroup as="ul">
            {connections.map((c) => {
              const rowId = `bible-conn-${c.outgoing ? "out" : "in"}-${c.kind}-${c.entry.id}`;
              return (
                <li key={rowId}>
                  {draft ? (
                    <ListRow
                      leading={
                        <button
                          type="button"
                          onClick={() =>
                            setStruck((s) => [...s, strikeOf(entry, c)])
                          }
                          aria-label={`Remove the connection: ${c.label} ${c.entry.name}`}
                          className="flex h-5 w-5 items-center justify-center rounded-full text-danger
                                     outline-none focus-visible:ring-2 focus-visible:ring-danger/50"
                        >
                          <MinusDisc />
                        </button>
                      }
                      title={c.entry.name}
                      detail={c.label}
                    />
                  ) : (
                    <ListRow
                      id={rowId}
                      onClick={() => onOpenEntry(c.entry.id, book, rowId)}
                      leading={<KindMark kind={c.entry.kind} size="xs" />}
                      title={c.entry.name}
                      detail={c.label}
                      trailing={<Chevron />}
                    />
                  )}
                </li>
              );
            })}
            {!draft && canConnect && (
              <li>
                <ListRow
                  id="bible-add-connection"
                  onClick={() => onConnect(copy)}
                  leading={<PlusDisc />}
                >
                  <span className="font-sans text-[13px] text-accent">
                    Add a connection
                  </span>
                </ListRow>
              </li>
            )}
          </ListGroup>
        ) : null}
        {!canConnect && !draft && (
          <ListFooter>
            Add another entry to the bible, and it can be connected to this one.
          </ListFooter>
        )}
        {draft && connections.length === 0 && (
          <ListFooter>
            {all.length > 0
              ? "Every connection is struck out. Done removes them; Cancel keeps them."
              : "No connections yet. Add them once this is saved."}
          </ListFooter>
        )}

        {draft && (
          <ListGroup className="mt-8">
            <ListRow
              onClick={() => (confirming ? onDelete(copy) : setConfirming(true))}
            >
              <span className="block text-center font-sans text-[13px] font-semibold text-danger">
                {confirming
                  ? "Press again to delete"
                  : otherBook
                    ? `Delete from ${otherBook.title}`
                    : `Delete ${entry.name}`}
              </span>
            </ListRow>
          </ListGroup>
        )}
      </PageColumn>
    </>
  );
}

/**
 * A new entry: the same page, empty and already in its edit state — Contacts'
 * "+" opens exactly this. It is written to the book being written, whichever
 * scope was on screen, because that is where the writer just invented it.
 */
export function NewEntryPage({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (draft: Draft) => void;
}) {
  const [draft, setDraft] = useState<Draft>({
    kind: "character",
    name: "",
    aka: "",
    detail: "",
  });
  const ready = draft.name.trim() !== "";

  return (
    <>
      <PageBar
        left={<BarButton onClick={onCancel}>Cancel</BarButton>}
        right={
          <BarButton strong onClick={() => ready && onCreate(draft)} disabled={!ready}>
            Add
          </BarButton>
        }
      />
      <PageColumn>
        <div className="flex items-center gap-3.5 px-1 pt-2 pb-5">
          <KindMark kind={draft.kind} size="md" />
          <h2 className="font-sans text-[26px] leading-tight font-bold tracking-tight text-fg">
            New entry
          </h2>
        </div>
        <EntryForm
          draft={draft}
          onDraft={setDraft}
          autoFocus
          onSubmit={() => ready && onCreate(draft)}
        />
      </PageColumn>
    </>
  );
}

/**
 * The fields, shared by editing and adding so the two cannot drift.
 *
 * **Kind is seven chips, not a menu**: every choice is in view, each wearing
 * its kind's colour, and the chosen one is a raised neutral pill — the
 * segmented rule in `docs/styling.md` — rather than a saturated fill.
 */
function EntryForm({
  draft,
  onDraft,
  autoFocus = false,
  onSubmit,
}: {
  draft: Draft;
  onDraft: (draft: Draft) => void;
  autoFocus?: boolean;
  onSubmit?: () => void;
}) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      <div>
        <SectionHeader>Name</SectionHeader>
        <Field
          value={draft.name}
          onChange={(e) => onDraft({ ...draft, name: e.target.value })}
          placeholder="Anna, Rivertown, the Red Guild…"
          aria-label="Name"
          autoFocus={autoFocus}
          className="font-sans"
        />
      </div>

      <div>
        <SectionHeader>Kind</SectionHeader>
        <div role="group" aria-label="Kind" className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => {
            const on = draft.kind === k.id;
            return (
              <button
                key={k.id}
                type="button"
                aria-pressed={on}
                onClick={() => onDraft({ ...draft, kind: k.id })}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-sans
                            text-[12px] outline-none transition-colors
                            focus-visible:ring-2 focus-visible:ring-accent/60 ${
                              on
                                ? "border-transparent bg-raised font-semibold text-fg"
                                : "border-line text-muted hover:text-fg"
                            }`}
              >
                <KindDot kind={k.id} />
                {k.one}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <SectionHeader>Also called</SectionHeader>
        <Field
          value={draft.aka}
          onChange={(e) => onDraft({ ...draft, aka: e.target.value })}
          placeholder="Lizzie, Beth"
          aria-label="Also called"
          className="font-sans"
        />
        <ListFooter>
          Separate names with commas. Every one is looked for in the chapter.
        </ListFooter>
      </div>

      <div>
        <SectionHeader>About</SectionHeader>
        <textarea
          value={draft.detail}
          onChange={(e) => onDraft({ ...draft, detail: e.target.value })}
          rows={5}
          placeholder="Anything you will have forgotten by chapter nineteen"
          aria-label="About"
          className="scroll-slim w-full resize-none rounded-[10px] bg-raised px-3 py-2 font-sans
                     text-[13px] leading-relaxed text-fg outline-none placeholder:text-muted
                     focus:ring-2 focus:ring-accent/50"
        />
      </div>

      {/* Lets Enter in a field submit, without a second visible button. */}
      <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
    </form>
  );
}

/** Which link a connection is, from the entry that holds it. */
function strikeOf(entry: BibleEntry, c: Connection): Struck {
  return c.outgoing
    ? { holder: entry.id, link: { to: c.entry.id, kind: c.kind } }
    : { holder: c.entry.id, link: { to: entry.id, kind: c.kind } };
}

function sameStrike(a: Struck, b: Struck): boolean {
  return a.holder === b.holder && a.link.to === b.link.to && a.link.kind === b.link.kind;
}

function Chevron() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 text-muted"
    >
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}

/** Contacts' green "add" disc, in the accent: the way forward. */
function PlusDisc() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5 text-accent">
      <circle cx="10" cy="10" r="10" fill="currentColor" />
      <path
        d="M10 5.5v9M5.5 10h9"
        stroke="var(--color-panel)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** The red "remove" disc an edit shows beside each connection. */
function MinusDisc() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-5 w-5">
      <circle cx="10" cy="10" r="10" fill="currentColor" />
      <path d="M5.5 10h9" stroke="var(--color-panel)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

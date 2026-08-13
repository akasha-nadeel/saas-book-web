"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import {
  LeftPill,
  LimitBanner,
  LimitDialog,
  LimitNote,
  useLimitGate,
} from "@/components/upgrade/free-limit";
import type { Allowance } from "@/lib/free-limits";
import {
  fromDay,
  LEAD_DAYS,
  sendBy,
  sortReaders,
  STATUSES,
  summarise,
  type ArcReader,
  type ArcStatus,
} from "@/lib/arc";
import { ToolSaveBar } from "@/components/ui/tool-save";
import { findBook, saveArcRaw } from "@/lib/library-store";
import { useArc, useHydrated, useShelf } from "@/lib/use-library";
import { useToolSave } from "@/lib/use-tool-save";

/**
 * Who has an advance copy, and who read it.
 *
 * The research described this pain twice over. One writer ran a launch across
 * NetGalley, Booksprout, BookSirens, Reddit, Facebook, Threads and Instagram —
 * *"six sites and a spreadsheet"*. Another *"had to decline 12 because they
 * didn't seem to read my genre"*. And underneath both, the expensive one:
 * *"now I'm trying to get reviews for a book that has been published for a few
 * months"*, which is what happens when nobody was counting the weeks.
 *
 * **This finds nobody for you.** A reader marketplace is two-sided, needs a
 * crowd before it is worth joining, and is on the ruled-out list for exactly
 * that reason — offering one here would be the dead UI the house rules forbid.
 * But the complaint in the research was never "there are no readers", it was
 * six open tabs and no idea who had what. That is a list's job.
 *
 * **The deadline is the feature.** Everything else here is a name in a box; the
 * date is the part that turns thirty contacts into the two people to email this
 * morning, which is why the list is ordered by it and why the page will work
 * out a send-by date from the publication date the book already carries.
 *
 * **Chasing is not built, as of 2026-08-13, and its absence is deliberate.**
 * Nothing here counts what has passed, marks a row as overdue or says the word
 * "late" — that half came out to be rebuilt, and it took the dashboard's late
 * panel and per-book flag with it. `isOverdue` is still in `arc.ts`, whole and
 * tested and called by nothing, which is where the rebuild starts. Do not wire
 * a new one up beside it; see TODO.md under "Taken out on purpose".
 *
 * **The list is the page, and adding somebody is a panel over it.** The form
 * used to sit in the middle of the screen, between the counts and the people —
 * four fields on a row that the writer needs for a few seconds when they add
 * somebody and never again, standing permanently above the thing they came to
 * read. Worse, it pushed the list below the fold, so a launch with a dozen
 * readers opened on an empty form. Now `Add a reader` is a control in the
 * list's own header and the fields arrive in a sheet beside it: the list stays
 * where it is, and the panel stays open after each Add so twelve people found
 * on NetGalley in one sitting are twelve presses rather than twelve journeys.
 *
 * **The counts stand whether or not anybody is on the list.** They were hidden
 * until the first reader, which meant the shape of the screen changed under the
 * writer at the moment they did their first bit of work — and a zero here is a
 * fact rather than an absence: nought out and nought reviewed is exactly the
 * true state of a launch nobody has sent a copy for. The one figure that cannot
 * be known honestly from an empty list, the reply rate, is `—` rather than 0%,
 * as it always was.
 */
export function ArcPage({ bookId }: { bookId: string }) {
  // Read here with the other hooks rather than beside the early return
  // below: hooks cannot sit after a conditional, and this screen has
  // several of its own already.
  const hydrated = useHydrated();
  const shelf = useShelf();
  const readers = useArc(bookId);
  /*
   * Occupancy, not a spend — the same shape as seats. It is handed the list's
   * current length, so taking a reader off gives the place back, and the count
   * is read in the same render as the `add()` that follows it.
   */
  const gate = useLimitGate({ action: "arcReaders", items: readers.length });
  const book = findBook(shelf, bookId);

  /*
   * The half-typed reader, as one object rather than four `useState`s.
   *
   * It has to travel into the panel and back out again — the draft belongs to
   * the *screen*, not to the sheet, because the save bar at the foot of the
   * window reports on it and closing the panel must not throw it away. Four
   * values and four setters through a prop list is eight props for one thing.
   */
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const edit = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const [error, setError] = useState<string | null>(null);

  /* Whether the sheet is up, and who went on the list last. */
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  /**
   * The clock, read once when the screen opens.
   *
   * Not `Date.now()` in the render body: that is a different answer every pass,
   * so a comparison against it would turn over on whichever unrelated state
   * change last re-rendered the page. Once per visit is also the right
   * *cadence* — a day turns at midnight, and nobody has this open across one.
   *
   * The list and the counts no longer need it at all; what is left reading it
   * is the seed below, which asks only whether publication is still ahead.
   */
  const [now] = useState(() => Date.now());
  const sorted = useMemo(() => sortReaders(readers), [readers]);
  const stats = useMemo(() => summarise(readers), [readers]);

  // The publication date the book already carries, if the writer has set one on
  // the export screen. Reused rather than asked for twice — two fields for one
  // date is two dates to keep in step.
  const publishAt = book?.publishing?.published
    ? fromDay(book.publishing.published)
    : null;

  /**
   * What "Review by" starts at, when the writer has not set one.
   *
   * **Publication day, read off the book.** This module's own reason for
   * existing is that the reviews want to be up on the day the book goes on
   * sale, so that day is the answer to "review by" until somebody says
   * otherwise — and it is a field the book already carries rather than a
   * figure worked out to look like an answer. The box was empty before, which
   * made the deadline — the one part of this tool that turns thirty contacts
   * into the two people to email — the easiest thing on the form to skip.
   *
   * **Only when it is still ahead of us.** A book whose publication day has
   * already gone would seed every new reader with a deadline in the past,
   * which is a worse answer than the empty box this replaced.
   */
  const defaultDue =
    publishAt !== null && publishAt > now
      ? (book?.publishing?.published ?? "")
      : "";

  function commit(next: ArcReader[]) {
    try {
      saveArcRaw(bookId, JSON.stringify(next));
      setError(null);
    } catch {
      // Not swallowed. These are names and dates the writer typed, and this is
      // the only record of who has the book.
      setError("Could not save that — your browser storage may be full.");
    }
  }

  function add() {
    const trimmed = draft.name.trim();
    if (!trimmed) return;
    /*
     * Refused *before* the commit, and the typed fields are deliberately left
     * standing: somebody who has just written a reader's name and where they
     * found them should not lose it to a limit. The list itself is untouched —
     * a lapsed plan with thirty readers still shows all thirty, exactly as a
     * full book still shows its collaborators. Only Add is refused.
     */
    if (!gate.spend()) return;

    const dueAt = draft.due ? fromDay(draft.due) : null;
    commit([
      ...readers,
      {
        id: crypto.randomUUID(),
        name: trimmed,
        from: draft.from.trim(),
        reads: draft.reads.trim(),
        status: "sent",
        sentAt: Date.now(),
        notes: "",
        ...(dueAt !== null ? { dueAt } : {}),
      },
    ]);
    /*
     * Cleared except the date, which carries over — a launch works to one
     * deadline, and re-picking it for every reader is the friction that makes
     * a writer stop filling it in.
     *
     * The panel stays up and the cursor goes back to the first field. Adding
     * advance readers is a batch job: they arrive as a list of twelve names
     * from a sign-up form, and a sheet that closed on each Add would charge
     * twelve round trips for one sitting.
     */
    setDraft((d) => ({ ...EMPTY_DRAFT, due: d.due }));
    setAdded(trimmed);
    nameRef.current?.focus();
  }

  function update(id: string, patch: Partial<ArcReader>) {
    commit(readers.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  /*
   * The list itself commits as it is edited — a row is a person who has the
   * book, and holding that behind a press would be a way to lose one.
   *
   * What is a draft is the row being *typed*: a name in the box and nothing
   * pressed is the one thing on this screen a writer can walk away from and
   * lose. So Save adds it, and the same press ticks the step this whole road
   * was arranged around — "Line up ARC readers — now, not later", which has no
   * detector because a row in a list is not the same claim as the readers
   * being lined up.
   */
  const save = useToolSave({
    book,
    tool: "arc",
    dirty: draft.name.trim() !== "",
    commit: add,
    discard: () => setDraft(EMPTY_DRAFT),
  });

  /*
   * Shutting the sheet is not leaving the draft, so it asks nothing.
   *
   * Everything typed stays in `draft`, the save bar at the foot of the window
   * goes on saying there is an unsaved reader, and re-opening the panel finds
   * the fields exactly as they were. `confirmLeave` — which the roadmap's own
   * panel calls on Close — would be a lie here: it says "leave now and it is
   * gone", and nothing is going anywhere.
   */
  function closePanel() {
    setAdding(false);
    setAdded(null);
  }

  /*
   * The first field takes the caret when the sheet arrives.
   *
   * A panel opened by a press has been *asked for*, so landing the writer in
   * the box they came to fill is the whole of what they wanted; making them
   * reach for the mouse a second time is the cost of a layer over a page.
   */
  useEffect(() => {
    if (adding) nameRef.current?.focus();
  }, [adding]);

  /*
   * Escape closes it, like every other layer in this app.
   *
   * **Except while the limit dialog is up.** That one is a native `<dialog>`
   * shown with `showModal`, and the browser's own Escape handling does not
   * stop the keydown reaching this listener — so without the guard, one press
   * would dismiss the paywall *and* the sheet under it, taking the writer's
   * typed reader off screen at the one moment they need to see it is still
   * there. Closing here throws nothing away either way, but the panel
   * vanishing under a dialog nobody asked to close is a jump, not an exit.
   *
   * The two setters are written out rather than calling `closePanel` above,
   * so this listener depends on nothing that is rebuilt per render and is
   * registered once for as long as the sheet is up.
   */
  useEffect(() => {
    if (!adding) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || gate.dialogOpen) return;
      setAdding(false);
      setAdded(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [adding, gate.dialogOpen]);

  if (!hydrated) return <LoadingScreen />;

  if (!book) {
    return (
      <div className="grid h-dvh place-items-center bg-surface p-8 text-center">
        <div>
          <p className="text-lg font-bold text-fg">That book is not here.</p>
          <Link href="/" className="mt-3 inline-block text-accent">
            Back to your books
          </Link>
        </div>
      </div>
    );
  }


  return (
    <div className="h-dvh overflow-y-auto bg-surface">
      {/* Up only while a reader is half-typed in the panel — and it stays up
          when that panel is shut, which is the point: the draft belongs to the
          screen, so closing the sheet loses nothing and this goes on saying
          so. The list itself commits as it is edited — a row is a person who
          has the book. */}
      <ToolSaveBar state={save} />
      <ToolHeader book={book} tool="Advance copies">
        Who has the book, who read it, and when their review is wanted. One
        list instead of six sites and a spreadsheet.
      </ToolHeader>

      <div className="mx-auto max-w-7xl px-6 pt-6 pb-16">
        {error && (
          <p className="mt-6 rounded-lg border border-line bg-panel p-4 text-sm text-fg">
            {error}
          </p>
        )}

        {/* ---- Where it stands -----------------------------------------

            Standing, whether or not anybody is on the list. They were hidden
            until the first reader, so the page grew a row of boxes under the
            writer at the moment they did their first bit of work — and nought
            out, nought reviewed is not an absence, it is the true state of a
            launch nobody has sent a copy for.

            Three, not four: a "late" count sat here and came out with the rest
            of the chasing. */}
        <section className="mt-8 grid gap-3 sm:grid-cols-3">
          <Stat value={String(stats.out)} label="still out" />
          <Stat value={String(stats.reviewed)} label="reviewed" />
          {/* Null until somebody answers either way. A rate of 0% on a
              campaign nobody has replied to yet reads as a verdict. */}
          <Stat
            value={stats.reviewRate === null ? "—" : `${stats.reviewRate}%`}
            label="of replies reviewed"
          />
        </section>

        {/* ---- The clock, as a banner under the counts -------------------

            It sat *above* them, which put a sentence between the heading and
            the figures and made the deadline read as the subject of the page.
            It is not: the counts are where the campaign stands, and the date
            is the standing note underneath them — the same relationship a
            banner has to the thing it annotates everywhere else here.

            Blue, and the `badge-blue` set rather than a blue of its own, for
            the reason the Sent and Reading badges take it: this is a *state*,
            not a warning. Red or amber would say something is wrong, and
            nothing is — the date is a fact about the book whether the writer
            is ahead of it or behind. The tokens carry their own ground and ink
            in both themes, so it is a pale tint by day and a deep one at
            night, never a bright slab on black.

            The variant with no publication date says so rather than inventing
            one, which is the same refusal it always made. */}
        <section
          className="mt-4 rounded-xl border border-badge-blue-line
                     bg-badge-blue-bg px-5 py-4 text-badge-blue-ink"
        >
          {publishAt === null ? (
            <p className="max-w-prose text-sm">
              Set a publication date on the{" "}
              <Link
                href={`/book/${bookId}/export`}
                className="font-semibold underline underline-offset-2"
              >
                export screen
              </Link>{" "}
              and this will work out when copies need to go out. {LEAD_DAYS}{" "}
              days ahead is the figure used here — the services that distribute
              advance copies ask for at least forty, and a reader needs time to
              finish a novel <em>and</em> to get round to posting about it.
              Earlier is better; later is how a book arrives with no reviews on
              it.
            </p>
          ) : (
            <SendBy publishAt={publishAt} now={now} sent={readers.length} />
          )}
        </section>

        {/* ---- The list, and the one control that adds to it -------------

            The heading, the count and Add on one row: the button belongs to
            the list it fills, so it is where the list is rather than in a form
            standing above it. It is in the same place at nought readers and at
            thirty — a control that moves once the screen has contents is one
            the writer has to find twice. */}
        <div className="mt-10 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold text-fg">
              {sorted.length === 0
                ? "Readers"
                : `${sorted.length} ${sorted.length === 1 ? "reader" : "readers"}`}
            </h2>
            {sorted.length > 0 && (
              <p className="max-w-prose mt-1 text-sm text-muted">
                Whoever is due soonest, first.
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <LeftPill allowance={gate.allowance} />
            <button
              type="button"
              onClick={() => {
                setAdding(true);
                /* Seeded here rather than in an effect: the button cannot be
                   pressed before the store is read, so the book's own date is
                   known by now — and a `setState` inside an effect is the
                   cascading render this codebase lints against. The guard is
                   what lets the carry-over win once there is one. */
                if (!draft.due && defaultDue) edit({ due: defaultDue });
              }}
              className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5
                         text-sm font-semibold text-accent-ink outline-none
                         transition-transform hover:-translate-y-px
                         focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="h-4 w-4"
              >
                <path d="M10 4.5v11M4.5 10h11" />
              </svg>
              Add a reader
            </button>
          </div>
        </div>

        {/* The standing state of the limit, on the page rather than only in
            the sheet: a writer who comes back tomorrow should be told where
            they are before they open a form they cannot submit. */}
        <LimitBanner allowance={gate.allowance} className="mt-4" />

        {sorted.length > 0 ? (
          <ul className="mt-4 flex flex-col gap-2">
            {sorted.map((reader) => (
              <Row
                key={reader.id}
                reader={reader}
                onChange={(patch) => update(reader.id, patch)}
                onRemove={() =>
                  commit(readers.filter((r) => r.id !== reader.id))
                }
              />
            ))}
          </ul>
        ) : (
          <p className="mt-4 max-w-prose rounded-xl border border-line bg-panel px-5 py-4 text-muted">
            Nobody yet. Start with the first person you send a copy to —
            including the friend who offered, who is the one everybody forgets
            to write down.
          </p>
        )}

        <div className="mt-10 border-t border-line pt-6">
          {/* The rule spans the page and the sentence does not.
              They were one element while a tool page was 3xl wide,
              where the two widths happened to agree; at 5xl a line of
              text run to the full container is about 160 characters,
              which is twice a readable measure. */}
          <p className="max-w-3xl text-xs leading-relaxed text-muted">
            This does not find readers for you and does not send anything. It is a
            list of the people you found, kept in one place with the dates
            attached. Like the rest of your library it lives in this browser.
          </p>
        </div>
      </div>
      {adding && (
        <AddReaderPanel
          draft={draft}
          onChange={edit}
          onAdd={add}
          onClose={closePanel}
          allowance={gate.allowance}
          added={added}
          error={error}
          nameRef={nameRef}
        />
      )}

      {gate.dialogOpen && (
        <LimitDialog action="arcReaders" onClose={gate.closeDialog} />
      )}
    </div>
  );
}

/** The four fields, held by the screen so the sheet can be shut without loss. */
interface Draft {
  name: string;
  from: string;
  reads: string;
  /** `YYYY-MM-DD`, straight out of the date input. */
  due: string;
}

const EMPTY_DRAFT: Draft = { name: "", from: "", reads: "", due: "" };

/**
 * Adding somebody, in a sheet beside the list rather than a form above it.
 *
 * **Why a layer at all.** These four fields are wanted for about fifteen
 * seconds and then not again, and they were standing permanently between the
 * counts and the people — pushing the list, which is the thing the writer came
 * for, below the fold of an ordinary laptop. A panel puts the form where a
 * form of this kind belongs: over the page, on request, gone on Escape.
 *
 * **Why it does not close on Add.** Advance readers arrive in batches — a
 * sign-up form with twelve names on it, or an afternoon spent on NetGalley —
 * so the sheet stays, the fields clear except the date, and the caret goes
 * back to the top. The list behind it is only inset rather than covered, which
 * is what makes each Add visibly land somewhere.
 *
 * The shape is the roadmap's sheet, deliberately: `fixed` so it does not
 * scroll away with the page under it, right-anchored and inset so the list
 * stays in view, a real `<button>` for the backdrop rather than a div with an
 * onClick, and `z-40` — under the app's dialogs at 50, because the limit
 * dialog has to open *over* this and not under it.
 */
function AddReaderPanel({
  draft,
  onChange,
  onAdd,
  onClose,
  allowance,
  added,
  error,
  nameRef,
}: {
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  onAdd: () => void;
  onClose: () => void;
  allowance: Allowance;
  /** Who went on the list last, so the press has an answer inside the panel. */
  added: string | null;
  error: string | null;
  nameRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Close without adding a reader"
        onClick={onClose}
        className="oc-scrim-in absolute inset-0 cursor-default bg-black/40
                   backdrop-blur-[1px]"
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="arc-add-title"
        className="oc-panel-in absolute inset-y-0 right-0 flex w-full max-w-md
                   flex-col overflow-hidden border-l border-line bg-surface
                   shadow-2xl sm:inset-y-3 sm:right-3 sm:rounded-2xl sm:border"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-panel px-5 py-3">
          <h2 id="arc-add-title" className="text-base font-bold text-fg">
            Add a reader
          </h2>
          {/* Quiet outline, not `danger`: closing this throws nothing away —
              whatever is typed is still in the draft and the save bar still
              knows about it. Red in this app means a shop would refuse the
              book. */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted
                       outline-none transition-colors hover:bg-raised
                       hover:text-fg focus-visible:ring-2
                       focus-visible:ring-accent/50"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              className="h-4 w-4"
            >
              <path d="m5.5 5.5 9 9M14.5 5.5l-9 9" />
            </svg>
          </button>
        </header>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            onAdd();
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {/* The stacked fill rather than the wide banner: this column is
                narrower than the one `LimitBanner` is drawn for, and the words
                are the same either way. */}
            <LimitNote allowance={allowance} className="mb-5" />

            <div className="flex flex-col gap-4">
              <Field
                label="Who"
                value={draft.name}
                onChange={(name) => onChange({ name })}
                placeholder="Their name, or the handle you know them by"
                inputRef={nameRef}
              />
              <Field
                label="Found where"
                value={draft.from}
                onChange={(from) => onChange({ from })}
                placeholder="NetGalley"
                hint="NetGalley, a Facebook group, the friend who offered."
              />
              {/* The specific complaint in the research was accepting readers
                  who do not read the genre, which produces the review everyone
                  remembers. The moment of adding them is the only time
                  recording it costs nothing. */}
              <Field
                label="Reads"
                value={draft.reads}
                onChange={(reads) => onChange({ reads })}
                placeholder="cosy mystery"
                hint="What they actually read. This is the field that saves you the one-star from somebody who never liked the genre."
              />
              {/* The date this reader's review is wanted by — not when the
                  copy goes out, which is what the banner on the page works
                  out. It starts at the book's own publication day, because
                  that is what advance copies are for. */}
              <Field
                label="Review by"
                type="date"
                value={draft.due}
                onChange={(due) => onChange({ due })}
                hint="Carries over to the next reader you add, since a launch tends to work to one deadline."
              />
            </div>
          </div>

          <div className="shrink-0 border-t border-line bg-panel px-5 py-4">
            {error && (
              <p className="mb-3 rounded-lg border border-line bg-surface p-3 text-sm text-fg">
                {error}
              </p>
            )}

            {/* Live whatever the plan says: a press with nothing left is how
                the refusal gets a chance to speak. Dark only when there is no
                name, which is a field the writer can see is empty. */}
            <button
              type="submit"
              disabled={draft.name.trim() === ""}
              className="w-full rounded-lg bg-accent px-5 py-2.5 font-semibold
                         text-accent-ink outline-none transition-opacity
                         hover:opacity-90 focus-visible:ring-2
                         focus-visible:ring-accent/50 disabled:opacity-40"
            >
              Add reader
            </button>

            <p
              role="status"
              aria-live="polite"
              className="mt-2 min-h-[1rem] text-center text-xs text-muted"
            >
              {added
                ? `${added} is on the list. Add another, or close this.`
                : ""}
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}

/**
 * How long until copies have to be out, counted from the book's own date.
 *
 * It states the day and the gap and stops there. A launch six weeks out with
 * nobody on the list is a real problem, but "you are behind" from a tool that
 * cannot know what the writer has arranged off-screen is a scold, and the
 * research was clear about how writers feel regarding apps that scold.
 */
function SendBy({
  publishAt,
  now,
  sent,
}: {
  publishAt: number;
  now: number;
  sent: number;
}) {
  const deadline = sendBy(publishAt);
  const days = Math.ceil((deadline - now) / 86_400_000);
  const day = new Date(deadline).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
  });

  return (
    /* No colour of its own: it inherits the banner's ink, so the sentence and
       the ground it sits on are one decision rather than two that have to be
       kept in step. */
    <p className="text-sm">
      Copies want to be out by <strong>{day}</strong> —{" "}
      {days > 0 ? (
        <>
          {days} {days === 1 ? "day" : "days"} from now
        </>
      ) : days === 0 ? (
        <>today</>
      ) : (
        <>
          {Math.abs(days)} {Math.abs(days) === 1 ? "day" : "days"} ago
        </>
      )}
      , which is {LEAD_DAYS} days before publication.{" "}
      {sent === 0 && (
        /* Dimmed rather than greyed: `muted` is a neutral and would be the one
           grey thing on a blue ground. */
        <span className="opacity-75">
          Nothing recorded here yet, though you may well have sent some.
        </span>
      )}
    </p>
  );
}

/**
 * Where this copy has got to, as a badge that can be read down a column.
 *
 * **The colour reports what the copy has produced, not what the person did.**
 * That is the sentence the whole map hangs on, and it is what splits the five
 * in two.
 *
 * **Sent and Reading are blue, because they are a *state* rather than a
 * verdict.** Nothing has been produced yet and nothing has gone wrong, so
 * neither belongs in the red/amber/green family, where every member is a
 * judgement — and the palette already has exactly one word for "this is a
 * state": `badge-blue`, which the shared-book badge wears for the same reason.
 * It is reused rather than matched, because inventing a second blue three
 * shades off this one is how a palette starts lying. The two are told apart by
 * weight rather than hue: **Sent is an outline** — the copy is out and sitting
 * with somebody — and **Reading is filled**, because they have said they are
 * on it and that is further along.
 *
 * The three that carry a verdict are the three the status family already has
 * words for, and they are the app's own `ok`/`note`/`stop` tokens rather than
 * literal shades, so each is a pale ground with dark ink by day and a
 * near-black ground with light ink at night:
 *
 * - **Reviewed → `ok`.** Green means earned everywhere in this app, and this
 *   is the one outcome the whole tool exists to produce.
 * - **No answer → `note`.** Amber means *worth doing*: chased and heard
 *   nothing is the last state where something you do might still change the
 *   result.
 * - **Declined → `stop`.** Red is the end of the road, which is exactly what
 *   this is: no review is coming from this copy, and unlike silence there is
 *   nothing to chase. It is not a judgement of the reader, and it stays rare —
 *   `STATUSES` notes that most of the people who never review go quiet rather
 *   than say no, so a real list does not come out red.
 *
 * Squared rather than a capsule, and the same three parts as the shelf's
 * readiness flags, because it is the same claim in a different place: a
 * property of the row, not a tag stuck on it. Colour is never the only
 * carrier — the word is in the badge, and the picker beside it says it too.
 */
const TONE: Record<ArcStatus, string> = {
  /* No fill of its own, so it takes the card's ground. The ink clears its
     ground by a wide margin in both themes — a pale blue slab would not, which
     is why the outline is the *lighter* of the two rather than a weaker tint. */
  sent: "border-badge-blue-line text-badge-blue-ink",
  reading: "border-badge-blue-line bg-badge-blue-bg text-badge-blue-ink",
  reviewed: "border-ok-line bg-ok-bg text-ok-fg",
  declined: "border-stop-line bg-stop-bg text-stop-fg",
  silent: "border-note-line bg-note-bg text-note-fg",
};

function StatusBadge({ status }: { status: ArcStatus }) {
  /* The label comes from `STATUSES` rather than a second list of words, so the
     badge and the picker cannot end up disagreeing about what a status is
     called. */
  const label = STATUSES.find((s) => s.id === status)?.label ?? status;

  return (
    <span
      className={`shrink-0 rounded-md border px-2.5 py-1 text-xs font-bold
                  whitespace-nowrap ${TONE[status]}`}
    >
      {label}
    </span>
  );
}

function Row({
  reader,
  onChange,
  onRemove,
}: {
  reader: ArcReader;
  onChange: (patch: Partial<ArcReader>) => void;
  onRemove: () => void;
}) {
  return (
    <li
      /*
       * The edge comes up to full ink under the pointer — `fg`, which is
       * near-black by day and near-white at night, because a literal black
       * border is invisible on a black card. Same lever the book panel's cards
       * use for "you are in this one": one edge, two values.
       *
       * Every row takes it now. An overdue one used to hold an accent edge
       * instead and refuse the hover, which was the one thing on the card
       * saying it was late; that went with the rest of the chasing.
       */
      className="rounded-lg border border-line bg-panel px-4 py-3
                 transition-colors hover:border-fg"
    >
      <div className="flex flex-wrap items-center gap-3">
        {/* The name and where they have got to, together and first. A writer
            opening this reads *down* the left edge — who is here, and what
            happened — and reaches to the right only for the one row they mean
            to change. */}
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="min-w-0 truncate font-semibold text-fg">
            {reader.name}
          </span>
          <StatusBadge status={reader.status} />
        </span>

        {reader.reads && (
          <span className="rounded-full bg-raised px-2.5 py-1 text-xs text-muted">
            {reader.reads}
          </span>
        )}
        {reader.from && (
          <span className="text-xs text-muted">{reader.from}</span>
        )}

        {/* The picker keeps the chrome's own neutrals. The colour is the
            badge's job, up at the left edge where a list is read; this end of
            the row is where a list is *changed*, and a second tinted control
            beside Remove would make the two compete. */}
        <select
          value={reader.status}
          onChange={(e) => onChange({ status: e.target.value as ArcStatus })}
          aria-label={`Where ${reader.name} has got to`}
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-fg"
        >
          {STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>

        <button type="button" onClick={onRemove} className="text-xs text-muted">
          Remove
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        {/* Editable in place: a deadline that moves is the normal case — a
            reader asks for another week and the list has to be able to say so
            without deleting them and starting again. */}
        <label className="flex items-center gap-2 text-xs text-muted">
          Review by
          <input
            type="date"
            value={reader.dueAt ? isoOf(reader.dueAt) : ""}
            onChange={(e) => {
              const at = e.target.value ? fromDay(e.target.value) : null;
              onChange(at === null ? { dueAt: undefined } : { dueAt: at });
            }}
            className="rounded border border-line bg-surface px-2 py-1 text-fg"
          />
        </label>

        {/* Only once there is a review to point at. An empty link box beside
            everybody would be four fields where the writer needs one. */}
        {reader.status === "reviewed" && (
          <input
            value={reader.link ?? ""}
            onChange={(e) => onChange({ link: e.target.value })}
            placeholder="Link to the review"
            className="min-w-0 flex-1 rounded border border-line bg-surface px-2 py-1 text-xs text-fg
                       outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          />
        )}
      </div>
    </li>
  );
}

/** Back to the `YYYY-MM-DD` a date input wants, in the writer's own timezone. */
function isoOf(at: number): string {
  const date = new Date(at);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * One field, stacked, with room for the line that says what it is for.
 *
 * It was a row of four on the page and had nowhere to explain itself — "Reads"
 * on its own is a verb, and the field it labels is the one that saves a writer
 * the review from somebody who never liked the genre. A column has the space
 * for a hint, which is one of the things a panel buys that a strip of inputs
 * across a page does not.
 */
function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  type = "text",
  inputRef,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  type?: "text" | "date";
  inputRef?: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-bold text-fg">{label}</span>
      <input
        ref={inputRef}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-fg
                   outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      />
      {hint && (
        <span className="text-xs leading-relaxed text-muted">{hint}</span>
      )}
    </label>
  );
}

function Stat({
  value,
  label,
  loud,
}: {
  value: string;
  label: string;
  loud?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3">
      <p
        className={`text-2xl font-extrabold ${loud ? "text-accent" : "text-fg"}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

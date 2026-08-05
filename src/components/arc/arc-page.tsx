"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { GatedTool, useEntitled } from "@/components/upgrade/pro-gate";
import {
  fromDay,
  isOverdue,
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
 * Who has an advance copy, who read it, and who is late.
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
 * morning, which is why late readers sort to the top and why the page will work
 * out a send-by date from the publication date the book already carries.
 */
export function ArcPage({ bookId }: { bookId: string }) {
  // Read here with the other hooks rather than beside the early return
  // below: hooks cannot sit after a conditional, and this screen has
  // several of its own already.
  const entitled = useEntitled();
  const hydrated = useHydrated();
  const shelf = useShelf();
  const readers = useArc(bookId);
  const book = findBook(shelf, bookId);

  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [reads, setReads] = useState("");
  const [due, setDue] = useState("");
  const [error, setError] = useState<string | null>(null);

  /**
   * The clock, read once when the screen opens.
   *
   * Not `Date.now()` in the render body: that is a different answer every pass,
   * so whether a reader is late would depend on which unrelated state change
   * last re-rendered the page. Once per visit is also the right *cadence* —
   * lateness turns over at midnight, and nobody has this open across one.
   */
  const [now] = useState(() => Date.now());
  const sorted = useMemo(() => sortReaders(readers, now), [readers, now]);
  const stats = useMemo(() => summarise(readers, now), [readers, now]);

  // The publication date the book already carries, if the writer has set one on
  // the export screen. Reused rather than asked for twice — two fields for one
  // date is two dates to keep in step.
  const publishAt = book?.publishing?.published
    ? fromDay(book.publishing.published)
    : null;

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
    const trimmed = name.trim();
    if (!trimmed) return;
    const dueAt = due ? fromDay(due) : null;
    commit([
      ...readers,
      {
        id: crypto.randomUUID(),
        name: trimmed,
        from: from.trim(),
        reads: reads.trim(),
        status: "sent",
        sentAt: Date.now(),
        notes: "",
        ...(dueAt !== null ? { dueAt } : {}),
      },
    ]);
    setName("");
    setFrom("");
    setReads("");
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
    dirty: name.trim() !== "",
    commit: add,
    discard: () => {
      setName("");
      setFrom("");
      setReads("");
      setDue("");
    },
  });

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

  // The gate stands *after* the not-found guard above: a writer who
  // followed a stale link to a deleted book should be told the book is
  // gone, not asked to pay for one that does not exist.
  if (!entitled) {
    return (
      <GatedTool
        book={book}
        tool="Advance copies"
        what="Who holds an advance copy, who read it and who is late — one list instead of six sites and a spreadsheet. Late readers sort to the top, and if the book has a publication date it works back to when copies need to go out."
        deck={
          <>
            Who has the book, who read it, and who is late. One list instead of six
        sites and a spreadsheet.
          </>
        }
      />
    );
  }

  return (
    <div className="h-dvh overflow-y-auto bg-surface">
      {/* Up only while a reader is half-typed into the form. The list itself
          commits as it is edited — a row is a person who has the book. */}
      <ToolSaveBar state={save} />
      <ToolHeader book={book} tool="Advance copies">
        Who has the book, who read it, and who is late. One list instead of six
        sites and a spreadsheet.
      </ToolHeader>

      <div className="mx-auto max-w-5xl px-6 pt-6 pb-16">
        {error && (
          <p className="mt-6 rounded-lg border border-line bg-panel p-4 text-sm text-fg">
            {error}
          </p>
        )}

        {/* ---- The clock ------------------------------------------------
            Only shown when the book has a publication date, because without
            one there is no deadline to be behind — and a made-up launch date
            would be the invented number this app keeps refusing to print. */}
        <section className="mt-8 rounded-xl border border-line bg-panel px-5 py-4">
          {publishAt === null ? (
            <p className="max-w-prose text-sm text-muted">
              Set a publication date on the{" "}
              <Link href={`/book/${bookId}/export`} className="text-accent">
                export screen
              </Link>{" "}
              and this will work out when copies need to go out. The convention
              is {LEAD_DAYS} days ahead — long enough for someone to read a
              novel and write about it before the book is on sale.
            </p>
          ) : (
            <SendBy publishAt={publishAt} now={now} sent={readers.length} />
          )}
        </section>

        {/* ---- Where it stands ----------------------------------------- */}
        {readers.length > 0 && (
          <section className="mt-4 grid gap-3 sm:grid-cols-4">
            <Stat value={String(stats.out)} label="still out" />
            <Stat value={String(stats.reviewed)} label="reviewed" />
            <Stat
              value={String(stats.overdue)}
              label="late"
              loud={stats.overdue > 0}
            />
            {/* Null until somebody answers either way. A rate of 0% on a
                campaign nobody has replied to yet reads as a verdict. */}
            <Stat
              value={stats.reviewRate === null ? "—" : `${stats.reviewRate}%`}
              label="of replies reviewed"
            />
          </section>
        )}

        {/* ---- Add a reader --------------------------------------------- */}
        <h2 className="mt-10 text-xl font-extrabold text-fg">Add a reader</h2>
        <form
          className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-panel p-5"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Field label="Who" value={name} onChange={setName} grow />
          <Field
            label="Found where"
            value={from}
            onChange={setFrom}
            placeholder="NetGalley"
          />
          {/* The specific complaint was accepting readers who do not read the
              genre, which produces the review everyone remembers. Recording it
              at the point of adding them is the only moment it costs nothing. */}
          <Field
            label="Reads"
            value={reads}
            onChange={setReads}
            placeholder="cosy mystery"
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-fg">Review by</span>
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-fg
                         outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink"
          >
            Add
          </button>
        </form>
        <p className="mt-2 text-xs text-muted">
          The date carries over to the next reader you add, since a launch tends
          to work to one deadline.
        </p>

        {/* ---- The list -------------------------------------------------- */}
        {sorted.length > 0 ? (
          <>
            <h2 className="mt-10 text-xl font-extrabold text-fg">
              {sorted.length} {sorted.length === 1 ? "reader" : "readers"}
            </h2>
            <p className="max-w-prose mt-1 text-sm text-muted">
              Late first, then whoever is due soonest.
            </p>
            <ul className="mt-4 flex flex-col gap-2">
              {sorted.map((reader) => (
                <Row
                  key={reader.id}
                  reader={reader}
                  now={now}
                  onChange={(patch) => update(reader.id, patch)}
                  onRemove={() =>
                    commit(readers.filter((r) => r.id !== reader.id))
                  }
                />
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-10 rounded-xl border border-line bg-panel px-5 py-4 text-muted">
            Nobody yet. Add the first person you send a copy to — including the
            friend who offered, who is the one everybody forgets to write down.
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
    </div>
  );
}

/**
 * How long until copies have to be out, counted from the book's own date.
 *
 * It states the day and the gap and stops there. A launch four weeks out with
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
    <p className="text-sm text-fg">
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
        <span className="text-muted">
          Nothing recorded here yet, though you may well have sent some.
        </span>
      )}
    </p>
  );
}

function Row({
  reader,
  now,
  onChange,
  onRemove,
}: {
  reader: ArcReader;
  now: number;
  onChange: (patch: Partial<ArcReader>) => void;
  onRemove: () => void;
}) {
  const late = isOverdue(reader, now);

  return (
    <li
      className={`rounded-lg border bg-panel px-4 py-3 ${
        late ? "border-accent" : "border-line"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1 truncate font-semibold text-fg">
          {reader.name}
        </span>

        {reader.reads && (
          <span className="rounded-full bg-raised px-2.5 py-1 text-xs text-muted">
            {reader.reads}
          </span>
        )}
        {reader.from && (
          <span className="text-xs text-muted">{reader.from}</span>
        )}

        <select
          value={reader.status}
          onChange={(e) => onChange({ status: e.target.value as ArcStatus })}
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

        {late && (
          <span className="text-xs font-bold text-accent">
            {Math.floor((now - (reader.dueAt as number)) / 86_400_000)} days
            late
          </span>
        )}

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

function Field({
  label,
  value,
  onChange,
  placeholder,
  grow,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  grow?: boolean;
}) {
  return (
    <label
      className={`flex flex-col gap-1.5 ${grow ? "min-w-[10rem] flex-1" : ""}`}
    >
      <span className="text-sm font-bold text-fg">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-line bg-surface px-3 py-2 text-fg
                   outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      />
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

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { GENRES } from "@/lib/book-kinds";
import { buildQuery, type CompTitle } from "@/lib/comps/comps";
import {
  matchHeadings,
  mergeHeadings,
  rankHeadings,
  rankSubjects,
  worthSuggesting,
  type SubjectCount,
  type SubjectHeading,
} from "@/lib/comps/subjects";
import { COMMON_SUBJECTS } from "@/lib/comps/common-subjects";
import { seedSubjects, type Shelf } from "@/lib/comps/shelves";
import { keywordReport, SLOTS, SLOT_MAX, type Issue } from "@/lib/keywords";
import { ProGate } from "@/components/upgrade/pro-gate";
import { findBook, setPublishing } from "@/lib/library-store";
import { useHydrated, useShelf } from "@/lib/use-library";
import { toolShell, type ToolPageProps } from "@/lib/tool-page";

/**
 * Categories, worked out from where comparable books are actually filed.
 *
 * A shop's category box is asking for BISAC, and BISAC is owned by BISG and
 * licensed — shipping the code list is neither free nor ours to do. The way
 * round it turns out to be the better answer anyway: read what books like this
 * one are filed under and rank that. It comes off the shelf rather than out of
 * a taxonomy, which is how a writer would answer it themselves given a bookshop
 * and an afternoon.
 *
 * **Suggestions, and the writer picks.** Nothing is selected automatically, and
 * every row carries how many of the comparable books are filed under it —
 * because "9 of 20" and "2 of 20" are different kinds of advice and the number
 * is the only honest way to say which.
 *
 * **The search is a help, not the way in.** A writer can type their own
 * categories straight into the list and never search at all — which matters
 * because plenty of them arrive already knowing, having copied the paths out
 * of a shop's own selector, and a screen that only accepts what it suggested
 * would be holding their own answer hostage to our search. The two routes
 * write to the same list, so a typed category and a tapped one are the same
 * thing afterwards.
 *
 * **That number is drawn as well as written.** It was plain text at the end of
 * a row, which made the most important thing on the line the last thing read
 * and impossible to compare down a column. A bar is scanned in one pass; the
 * figure stays beside it, because a bar alone says *more* without saying how
 * many.
 *
 * The cleaning is in `subjects.ts` and it is most of the feature — raw, these
 * two catalogues answer with "Fiction", which is true of every novel ever
 * written, and with "Protected DAISY", which is a note about a copy.
 *
 * **Two further sections answer the shop's form rather than the librarian's**,
 * and both are Pro. A shop asks for *three categories out of its own tree*,
 * which is not the vocabulary above, plus *seven keyword fields*, which nobody
 * explains. The subjects stay free because they are what a book needs to be
 * filed at all; matching them to a shop and spending the seven well is
 * optimising a listing, which is work for a book that is going out.
 *
 * **Neither has read Amazon, and the screen says so.** There is no scrape and
 * no shop API — the Product Advertising API shut down in May 2026 and its
 * replacement wants ten affiliate sales a month — so nothing here quotes a
 * search volume, a competition score or a rank. The tools that do quote those
 * buy scraped data. What this offers instead is where comparable books sit and
 * what the seven boxes are wasting, both of which are checkable.
 */
export function CategoriesPage({ bookId, embedded, heading }: ToolPageProps) {
  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = findBook(shelf, bookId);

  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<CompTitle[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);

  /** What the writer is typing into the list themselves. */
  const [own, setOwn] = useState("");

  // The shop's own categories, once asked for.
  const [shelves, setShelves] = useState<Shelf[] | null>(null);
  const [shelfNote, setShelfNote] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  const chosen = useMemo(
    () => book?.publishing?.subjects ?? [],
    [book?.publishing?.subjects],
  );

  const seeded = useRef(false);
  useEffect(() => {
    if (!book || seeded.current) return;
    seeded.current = true;
    setQuery(
      buildQuery({ genre: book.genre, blurb: book.publishing?.description }),
    );
  }, [book]);

  const suggestions = useMemo(
    () => worthSuggesting(rankSubjects(books), books.length),
    [books],
  );

  async function search(q: string) {
    if (q.trim().length < 2) return;
    setState("loading");
    setError(null);
    try {
      const response = await fetch(`/api/comps?q=${encodeURIComponent(q)}`);
      const data = await response.json();
      if (!response.ok) {
        setError(data?.error ?? "That search did not work.");
        setState("error");
        return;
      }
      setBooks(data.books ?? []);
      setState("done");
    } catch {
      setError("Could not reach the search. Check your connection.");
      setState("error");
    }
  }

  /**
   * Ask which of the shop's own categories these subjects point at.
   *
   * Only the subject names and their counts go — no manuscript and no blurb.
   * The answer is parsed on the server, where the rule that counts come from
   * our data rather than the model cannot be edited by a reader.
   */
  async function matchToShop(seeds: SubjectCount[]) {
    setMatching(true);
    setMatchError(null);
    try {
      const response = await fetch("/api/comps/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subjects: seeds, genre: book?.genre ?? "" }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMatchError(data?.error ?? "That did not work.");
        return;
      }
      setShelves(data.shelves ?? []);
      setShelfNote(typeof data.note === "string" ? data.note : null);
    } catch {
      setMatchError("Could not reach it. Check your connection.");
    } finally {
      setMatching(false);
    }
  }

  /** One of the seven, written back in place so slot four stays slot four. */
  function setKeyword(index: number, text: string) {
    if (!book) return;
    const next = Array.from(
      { length: SLOTS },
      (_, i) => (i === index ? text : (book.publishing?.keywords?.[i] ?? "")),
    );
    setPublishing(book.id, { keywords: next });
  }

  /**
   * Already on the book, however it was capitalised.
   *
   * Case-insensitive so a category typed as "mystery" ticks the "Mystery"
   * suggestion rather than sitting beside it as a near-duplicate — the shop
   * would treat those as one, and the writer would have to spot it.
   */
  function has(name: string): boolean {
    const key = name.trim().toLowerCase();
    return chosen.some((s) => s.toLowerCase() === key);
  }

  function toggle(name: string) {
    if (!book) return;
    const key = name.trim().toLowerCase();
    const next = has(name)
      ? chosen.filter((s) => s.toLowerCase() !== key)
      : [...chosen, name];
    setPublishing(book.id, { subjects: next });
  }

  /**
   * Add whatever the writer typed.
   *
   * Split on commas, because a writer who already knows their categories
   * pastes them in one line — and semicolons, because a shop's own selector
   * copies out that way. Anything already on the book is skipped rather than
   * added twice, and nothing is validated: a category we have never heard of
   * is the normal case, since we cannot see the shop's tree.
   */
  function addNames(names: readonly string[]) {
    if (!book) return;
    const added: string[] = [];
    for (const raw of names) {
      const name = raw.replace(/\s+/g, " ").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (has(name) || added.some((a) => a.toLowerCase() === key)) continue;
      added.push(name);
    }
    if (added.length > 0) {
      setPublishing(book.id, { subjects: [...chosen, ...added] });
    }
    setOwn("");
  }

  function addOwn() {
    addNames(own.split(/[,;]/));
  }

  // The app's splash is for the app. In the roadmap's panel it would take
  // over half the window with a logo, so an embedded tool waits silently —
  // see `Pending` in `roadmap/step-panel.tsx`.
  if (!hydrated)
    return embedded ? <div className={toolShell(embedded)} /> : <LoadingScreen />;

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
    <div className={toolShell(embedded)}>
      {!embedded && (
        <ToolHeader book={book} tool="Categories">
          Which shelf your book lands on — worked out from where books like yours
          are actually filed, rather than from a list we made up.
        </ToolHeader>
      )}

      <div className="mx-auto max-w-5xl px-6 pt-6 pb-16">
        {heading}
        {/* ---- What is chosen --------------------------------------------
            A strip rather than the card this was. Before the first search a
            writer cannot have chosen anything, so a panel headed "On this
            book" containing one sentence of apology was the largest thing on
            the screen and the least useful thing on it. */}
        <div className="rounded-2xl bg-accent p-1.5 pt-0 shadow-md">
          {/* The count belongs on the strip rather than inside the card: it is
              the first thing a writer wants off this block, and a strip is
              read before what it sits above. Same shell as the pricing page
              and the note below the search. */}
          <p className="py-2.5 text-center font-sans text-xs font-medium text-accent-ink">
            On this book · {chosen.length}
          </p>

          <section className="rounded-xl bg-panel p-4">
            {chosen.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {chosen.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => toggle(name)}
                      aria-label={`Remove ${name}`}
                      className="flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5
                                 text-sm font-medium text-accent-ink"
                    >
                      {name}
                      <span aria-hidden="true" className="text-accent-ink/70">
                        ✕
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="max-w-prose text-sm text-muted">
                <strong className="text-fg">Nothing chosen yet.</strong> An empty
                list is one of the things the pre-upload check raises, because a
                book with no categories has no shelf to turn up on.
              </p>
            )}
            {/* Typing your own, which is the other way in and for some writers
                the only one they need — they arrive having copied the paths out
                of a shop's own selector. It sits with the list rather than with
                the search below, because this is the list it writes to. */}
            <div className="mt-3.5 border-t border-line pt-3.5">
              <SubjectCombobox
                value={own}
                onChange={setOwn}
                onAdd={addOwn}
                onPick={(name) => addNames([name])}
              />
              <p className="mt-2 max-w-prose text-xs text-muted">
                Saved as you go, and several at once if you separate them with
                commas. Suggestions come from Open Library&rsquo;s subject index;
                nothing is checked against a shop&rsquo;s own list, so paste
                whatever its selector gave you.
              </p>
            </div>
          </section>
        </div>

        {/* ---- Find some -------------------------------------------------- */}
        <form
          className="mt-6 flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void search(query);
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Words that describe your book"
            aria-label="Search for comparable books"
            className="min-w-[14rem] flex-1 rounded-lg border border-line bg-panel px-4 py-2.5
                       text-fg outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          />
          <button
            type="submit"
            disabled={state === "loading" || query.trim().length < 2}
            className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink disabled:opacity-50"
          >
            {state === "loading" ? "Looking…" : "Suggest categories"}
          </button>
        </form>

        {/* With no genre and no blurb the seed is empty, which left the box
            blank and the button dead. Same fix as the comps screen: the app's
            own genres as starting points, which search rather than save. */}
        {!book.genre && (
          <div className="mt-3">
            <p className="text-xs text-muted">
              This book has no genre set, so there was nothing to seed the box
              with. Start from one of these, or describe the story above.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {GENRES.filter((g) => g !== "Other").map((genre) => (
                <button
                  key={genre}
                  type="button"
                  onClick={() => {
                    const seed = `subject:"${genre}"`;
                    setQuery(seed);
                    void search(seed);
                  }}
                  className="rounded-full border border-line bg-panel px-3 py-1 text-xs
                             font-medium text-fg hover:border-accent/40"
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="mt-6 rounded-lg border border-note-line bg-note-bg p-4 text-sm text-fg">
            {error}
          </p>
        )}

        {/* ---- What these are ---------------------------------------------
            The pricing page's shell: an accent block with a line written along
            the top and the card set into the rest. It is used here for the
            same reason it is used there — the strip is read *before* the card,
            so it can carry the one thing that has to land first, where a
            heading inside the card is read after it.

            Two paragraphs became two sentences. Everything cut was true and
            none of it was load-bearing on a screen a writer has not searched
            on yet: what a shop does with the words is answered by the "What a
            shop would file it under" section further down, and the one-in-
            twenty rule explains itself the moment a count appears beside a row.
        ------------------------------------------------------------------ */}
        {state === "idle" && (
          <div className="mt-8 rounded-2xl bg-accent p-1.5 pt-0 shadow-md">
            <p className="py-2.5 text-center font-sans text-xs font-medium text-accent-ink">
              What these are, exactly
            </p>
            <section className="rounded-xl bg-panel p-5">
              <p className="max-w-prose text-sm text-muted">
                Not a shop&rsquo;s own list. These are the subjects two public
                catalogues file comparable books under — the answer to
                &ldquo;what is this book, to a librarian&rdquo;.
              </p>
              <p className="max-w-prose mt-2.5 text-sm text-muted">
                Search, and each suggestion says how many comparable books
                carry it.
              </p>
            </section>
          </div>
        )}

        {state === "done" && suggestions.length === 0 && (
          <p className="mt-8 text-muted">
            Nothing came back often enough to be worth suggesting. One book out
            of twenty filed under something is that book, not a pattern — try a
            broader search.
          </p>
        )}

        {suggestions.length > 0 && (
          <>
            <div className="mt-8 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-bold text-fg">
                {suggestions.length} worth considering
              </h2>
              <p className="max-w-prose text-sm text-muted">
                From {books.length} comparable books · tap to add
              </p>
            </div>
            <ul className="mt-3 flex flex-col gap-1.5">
              {suggestions.map((subject) => (
                <SuggestionRow
                  key={subject.name}
                  name={subject.name}
                  count={subject.count}
                  total={books.length}
                  on={has(subject.name)}
                  onToggle={() => toggle(subject.name)}
                />
              ))}
            </ul>
          </>
        )}

        {/* ---- The shop's own categories ---------------------------------
            After the subjects, because it is a reading *of* them: a writer who
            wants the mapping has already seen what it was mapped from.
        ------------------------------------------------------------------ */}
        {suggestions.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-bold text-fg">
              What a shop would file it under
            </h2>
            <p className="mt-1 max-w-prose text-sm text-muted">
              The list above is what a <em>librarian</em> files these books
              under. A shop asks you to pick three out of its own tree, which is
              a different vocabulary. This is the translation.
            </p>

            <ProGate
              title="Matching to a shop's categories"
              what="Turns the librarian subjects above into the category paths a shop's own selector uses, each saying which subjects it came from and how many comparable books carried them."
            >
              <div className="mt-4">
                {shelves === null ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void matchToShop(seedSubjects(suggestions))}
                      disabled={matching}
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold
                                 text-accent-ink disabled:opacity-50"
                    >
                      {matching ? "Matching\u2026" : "Match these to a shop"}
                    </button>
                    <p className="mt-2 max-w-prose text-xs text-muted">
                      Only the subject names above and their counts are sent \u2014
                      not your book. Nothing from Amazon is read, so no search
                      volume or ranking comes back: these are paths to look up
                      in the shop\u2019s own selector.
                    </p>
                  </>
                ) : shelves.length === 0 ? (
                  <p className="text-sm text-muted">
                    Nothing came back that was worth showing.
                  </p>
                ) : (
                  <>
                    {shelfNote && (
                      <p className="mb-3 max-w-prose text-sm text-fg">{shelfNote}</p>
                    )}
                    <ol className="flex flex-col gap-2.5">
                      {shelves.map((shelf) => (
                        <li
                          key={shelf.path}
                          className="rounded-xl border border-line bg-panel p-4"
                        >
                          <p className="font-mono text-sm font-bold text-fg">
                            {shelf.path}
                          </p>
                          <p className="mt-1.5 max-w-prose text-sm text-muted">
                            {shelf.reason}
                          </p>
                          {shelf.from.length > 0 && (
                            <p className="mt-2 text-xs text-muted">
                              from{" "}
                              {shelf.from
                                .map((c) => `${c.name} (${c.count})`)
                                .join(", ")}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                    <p className="mt-3 max-w-prose text-xs text-muted">
                      Candidates, not confirmed paths. Only the shop knows its
                      own tree and it changes \u2014 type these into its selector
                      to see which exist. You get three.
                    </p>
                  </>
                )}
                {matchError && (
                  <p className="mt-3 max-w-prose text-sm text-fg">{matchError}</p>
                )}
              </div>
            </ProGate>
          </section>
        )}

        {/* ---- The seven boxes -------------------------------------------- */}
        <section className="mt-12">
          <h2 className="text-lg font-bold text-fg">Your seven keywords</h2>
          <p className="mt-1 max-w-prose text-sm text-muted">
            A shop\u2019s listing form gives you seven boxes of {SLOT_MAX}{" "}
            characters. They are not tags \u2014 they are extra words the shop
            indexes the book under, so the whole game is spending them on words
            your listing does not already carry.
          </p>

          <ProGate
            title="The seven keyword boxes"
            what="The seven backend keyword fields a shop's listing form asks for, counted: which are over the limit, which repeat words your title already owns, which spend the same word twice, and which use phrases shops reject."
          >
            <KeywordBoxes
              keywords={book.publishing?.keywords ?? []}
              title={book.title}
              subtitle={book.subtitle}
              author={book.author}
              series={book.publishing?.series}
              onChange={setKeyword}
            />
          </ProGate>
        </section>

        <div className="mt-10 border-t border-line pt-6">
          {/* The rule spans the page and the sentence does not.
              They were one element while a tool page was 3xl wide,
              where the two widths happened to agree; at 5xl a line of
              text run to the full container is about 160 characters,
              which is twice a readable measure. */}
          <p className="max-w-3xl text-xs text-muted">
            These are the subjects two public catalogues file comparable books
            under, not official shop categories — shops use their own scheme, and
            the box on their form may not accept these words as typed. Treat them
            as the answer to &ldquo;what is this book, to a librarian&rdquo;, and
            match them to the shop&rsquo;s own list yourself.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * One suggestion, with its share of the comparable books drawn.
 *
 * The bar gives a column of "9 of 20", "7 of 20", "4 of 20" the sorting sense
 * it does not otherwise have: those must be read and compared one at a time,
 * where the shape is taken in at a glance. The figure stays beside it, because
 * a bar alone says *more* without saying how many — and the whole reason this
 * screen prints the count is that a subject carried by two books and one
 * carried by nine are different advice.
 */
function SuggestionRow({
  name,
  count,
  total,
  on,
  onToggle,
}: {
  name: string;
  count: number;
  total: number;
  on: boolean;
  onToggle: () => void;
}) {
  const share = total > 0 ? (count / total) * 100 : 0;

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={on}
        className={`flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left
                    transition-colors ${
                      on
                        ? "border-accent bg-accent/8"
                        : "border-line bg-panel hover:border-accent/40"
                    }`}
      >
        <span
          aria-hidden="true"
          className={`grid h-5 w-5 shrink-0 place-items-center rounded text-[11px]
                      font-bold ${
                        on
                          ? "bg-accent text-accent-ink"
                          : "border-2 border-line text-transparent"
                      }`}
        >
          ✓
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg">
            {name}
          </span>
          <span className="mt-1 block h-1 overflow-hidden rounded-full bg-raised">
            <span
              className={`block h-full rounded-full ${on ? "bg-accent" : "bg-fg/25"}`}
              style={{ width: `${share}%` }}
            />
          </span>
        </span>

        <span className="shrink-0 text-xs whitespace-nowrap text-muted tabular-nums">
          {count} of {total}
        </span>
      </button>
    </li>
  );
}

/**
 * The seven boxes, with what is wrong with them underneath.
 *
 * **Everything here is counted and nothing is scored.** No "keyword strength",
 * no traffic light, no percentage. The figure a writer actually wants is
 * search volume, and it cannot be had honestly — a shop publishes none, and
 * the tools that quote one buy scraped data. Printed beside real categories on
 * a screen about selling, an invented volume would be the most believable
 * invented number in the app.
 *
 * The character count is the one live figure, and it turns red only when the
 * field is genuinely past the limit — a box the shop will refuse. Amber for
 * "getting long" would be a judgement about a field the writer is mid-way
 * through typing.
 */
function KeywordBoxes({
  keywords,
  title,
  subtitle,
  author,
  series,
  onChange,
}: {
  keywords: readonly string[];
  title: string;
  subtitle?: string;
  author?: string;
  series?: string;
  onChange: (index: number, text: string) => void;
}) {
  const report = useMemo(
    () => keywordReport(keywords, { title, subtitle, author, series }),
    [keywords, title, subtitle, author, series],
  );

  return (
    <div className="mt-4">
      <ol className="flex flex-col gap-2">
        {report.slots.map((slot) => (
          <li key={slot.index} className="flex items-center gap-3">
            <span className="w-4 shrink-0 text-xs text-muted tabular-nums">
              {slot.index + 1}
            </span>
            <input
              value={slot.text}
              onChange={(e) => onChange(slot.index, e.target.value)}
              aria-label={`Keyword ${slot.index + 1}`}
              placeholder="Words your title does not already use"
              className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-3 py-2
                         text-sm text-fg outline-none
                         focus-visible:ring-2 focus-visible:ring-accent/50"
            />
            <span
              className={`w-14 shrink-0 text-right text-xs tabular-nums ${
                slot.over ? "font-bold text-stop-fg" : "text-muted"
              }`}
            >
              {slot.chars}/{SLOT_MAX}
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-3 text-xs text-muted">
        {report.filled} of {SLOTS} used. Saved as you type.
      </p>

      {report.issues.length > 0 && (
        <ul className="mt-4 flex flex-col gap-2">
          {report.issues.map((issue) => (
            <li
              key={issueKey(issue)}
              className="rounded-lg border border-note-line bg-note-bg px-3.5 py-2.5
                         text-sm text-note-fg"
            >
              {issueText(issue)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Stable across renders, and unique per finding. */
function issueKey(issue: Issue): string {
  return issue.kind === "repeated"
    ? `repeated:${issue.word}`
    : issue.kind === "refused"
      ? `refused:${issue.slot}:${issue.term}`
      : `${issue.kind}:${issue.slot}`;
}

/**
 * One finding, as a sentence.
 *
 * Every one names the box it is about — a writer looking at seven near-
 * identical fields cannot act on "one of these repeats your title". Facts,
 * never instructions: it says what a word costs, and leaves the decision.
 */
function issueText(issue: Issue): string {
  const box = (n: number) => `Box ${n + 1}`;

  switch (issue.kind) {
    case "over":
      return `${box(issue.slot)} is ${issue.chars} characters. A shop takes ${SLOT_MAX} and refuses the rest of the field.`;
    case "refused":
      return `${box(issue.slot)} uses “${issue.term}”, which shops ask you not to — ${issue.why}.`;
    case "wasted":
      return `${box(issue.slot)} repeats ${issue.words.map((w) => `“${w}”`).join(", ")} from ${issue.where}. A shop already indexes that, so the box buys nothing.`;
    case "repeated":
      return `“${issue.word}” is in boxes ${issue.slots.map((s) => s + 1).join(" and ")}. One of them is spent twice.`;
  }
}

/**
 * The box a writer types their own category into, with the catalogue
 * suggesting as they go.
 *
 * **The suggestions are a real index, not a list we wrote.** Open Library's
 * subject search, through `/api/comps/subjects` — free, keyless, cached for a
 * week. That matters more here than it looks: BISAC is licensed and shipping
 * our own idea of "all book categories" would be the invented-taxonomy problem
 * this whole screen exists to avoid. Nobody here knows what the categories
 * are; the catalogue does.
 *
 * **The shelf size is the useful half.** "Fiction, mystery & detective,
 * general — 61,392 works" tells a writer they are looking at the main road,
 * where "Cozy Mystery — 157" is a lane. It is Open Library's figure, labelled
 * as works catalogued, and it is never presented as an Amazon rank or a search
 * volume — those cannot be had honestly and nothing on this screen claims one.
 *
 * **It stays a text box.** Typing something the index has never heard of and
 * pressing Add still works, because a shop's own category names are not in
 * this index and a writer pasting one out of KDP must not be blocked by a
 * dropdown that has no opinion about it. The suggestions help; they do not
 * gate.
 */
function SubjectCombobox({
  value,
  onChange,
  onAdd,
  onPick,
}: {
  value: string;
  onChange: (next: string) => void;
  onAdd: () => void;
  onPick: (name: string) => void;
}) {
  const [found, setFound] = useState<SubjectHeading[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  /*
   * Debounced, and the last reply wins.
   *
   * A request per keystroke would be rude to a free catalogue and pointless —
   * nobody reads a dropdown mid-word. 200ms is about the gap between letters
   * for a fast typist. The counter guards against the older of two in-flight
   * replies landing last and overwriting the newer, which is the bug every
   * autocomplete has once.
   */
  // Only the part being typed: with commas, the earlier ones are finished.
  const fragment = (value.split(/[,;]/).pop() ?? "").trim();

  const asked = useRef(0);
  useEffect(() => {
    // One letter is answered locally — see `local` below — and the index
    // cannot answer it anyway. Nothing is cleared here: whether the list is
    // *shown* is derived, so a stale reply cannot flash and this effect never
    // sets state synchronously.
    if (fragment.length < 2) return;

    const mine = ++asked.current;
    const timer = setTimeout(() => {
      void fetch(`/api/comps/subjects?q=${encodeURIComponent(fragment)}`)
        .then((r) => (r.ok ? r.json() : { subjects: [] }))
        .then((data) => {
          if (mine !== asked.current) return;
          setFound(Array.isArray(data.subjects) ? data.subjects : []);
          setActive(-1);
        })
        .catch(() => {
          // A dropdown that cannot suggest is a text box, which still works.
        });
    }, 200);

    return () => clearTimeout(timer);
  }, [fragment]);

  /** Replace only the part being typed, so earlier commas survive. */
  function pick(name: string) {
    const parts = value.split(/[,;]/);
    if (parts.length > 1) {
      parts.pop();
      const kept = parts.map((p) => p.trim()).filter(Boolean);
      onChange("");
      for (const one of kept) onPick(one);
    } else {
      onChange("");
    }
    onPick(name);
    setFound([]);
    setOpen(false);
  }

  /**
   * The shipped index, answering before the network can.
   *
   * **Local first is what makes an autocomplete feel like one.** Every
   * suggestion worth using appears on the first character, and this one has
   * to: the live index 500s on `m*` and matches middle initials on plain `m`,
   * so a letter was previously answered with nothing. 900 real headings sit in
   * `common-subjects.ts`, matched and ranked with the same two functions the
   * server uses, so the local and remote halves cannot disagree about order.
   */
  const local = useMemo(
    () => rankHeadings(matchHeadings(COMMON_SUBJECTS, fragment), fragment),
    [fragment],
  );

  /**
   * Both halves as one list, local first.
   *
   * The remote is not a replacement — it is the long tail. Merged rather than
   * swapped in, so the rows a reader was already looking at do not reshuffle
   * under them when the request lands, which is the thing that makes a
   * dropdown feel like it is fighting you.
   */
  const rows = useMemo(
    () => rankHeadings(mergeHeadings(local, found), fragment).slice(0, 8),
    [local, found, fragment],
  );

  const showing = open && rows.length > 0;

  return (
    <div className="relative">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (showing && active >= 0) pick(rows[active].name);
          else onAdd();
        }}
      >
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          // A click on a suggestion blurs the input first, so closing is
          // deferred past the click that would otherwise never land.
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (!showing) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => (i + 1) % rows.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => (i <= 0 ? rows.length - 1 : i - 1));
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          role="combobox"
          aria-expanded={showing}
          aria-controls="subject-suggestions"
          aria-autocomplete="list"
          placeholder="Type a category of your own"
          aria-label="Add a category of your own"
          className="min-w-[12rem] flex-1 rounded-lg border border-line bg-surface px-3 py-2
                     text-sm text-fg outline-none
                     focus-visible:ring-2 focus-visible:ring-accent/50"
        />
        <button
          type="submit"
          disabled={value.trim() === ""}
          className="rounded-lg border border-line px-4 py-2 text-sm font-semibold
                     text-fg disabled:opacity-40"
        >
          Add
        </button>
      </form>

      {showing && (
        <ul
          id="subject-suggestions"
          role="listbox"
          className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border
                     border-line bg-panel shadow-lg"
        >
          {rows.map((subject, i) => (
            <li key={subject.name} role="option" aria-selected={i === active}>
              <button
                type="button"
                // onMouseDown, not onClick: the input's blur fires first and
                // would close the list before a click could land on it.
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(subject.name);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2
                            text-left text-sm ${
                              i === active ? "bg-raised text-fg" : "text-fg"
                            }`}
              >
                <span className="min-w-0 truncate">{subject.name}</span>
                <span className="shrink-0 text-xs text-muted tabular-nums">
                  {subject.works.toLocaleString()} works
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

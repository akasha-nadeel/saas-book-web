"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import {
  matchHeadings,
  mergeHeadings,
  rankHeadings,
  type SubjectHeading,
} from "@/lib/comps/subjects";
import { COMMON_SUBJECTS } from "@/lib/comps/common-subjects";
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

  /** What the writer is typing into the list themselves. */
  const [own, setOwn] = useState("");

  const chosen = useMemo(
    () => book?.publishing?.subjects ?? [],
    [book?.publishing?.subjects],
  );

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
      {/* The trail keeps the trade word, the heading asks the writer's own
          question — the split comps, the title check and the blurb screen all
          make. "Categories" is the word on the shop's own form and in the
          launcher, so it stays where a writer goes looking for it; as the `h1`
          it names the field rather than saying what the screen is for. */}
      {!embedded && (
        <ToolHeader
          book={book}
          tool="Categories"
          title="Which shelf does your book go on?"
          /* Matched to the page's own container below. The default 5xl left a
             band of empty desk down both sides of a screen whose widest block
             is a row of seven full-width keyword fields, and `ToolHeader`'s
             own note is explicit that the two must agree or the left edges
             disagree. The deck stays capped at 2xl inside it, so widening the
             page never widens a line of prose. */
          width="6xl"
        >
          {/* **The problem before the method.** The old deck opened on "which
              shelf your book lands on", which describes the output; a writer
              arrives here because a shop's form is asking them for three
              categories out of a vocabulary nobody has memorised, and that is
              the pressure the deck should meet.

              The last clause is the one that cannot be dropped. A made-up
              category list is the obvious way to build this screen and the one
              thing it refuses — BISAC is licensed, and a list of our own would
              be exactly the invented vocabulary the tool exists to avoid. */}
          Every shop makes you choose categories before it will list your book,
          and they decide which shelf a reader finds you on. Nobody knows that
          vocabulary by heart, so this reads it off where books like yours are
          actually filed — never off a list we made up.
        </ToolHeader>
      )}

      <div className="mx-auto max-w-6xl px-6 pt-6 pb-16">
        {heading}
        {/* ---- What is chosen --------------------------------------------
            A strip rather than the card this was. Before the first search a
            writer cannot have chosen anything, so a panel headed "On this
            book" containing one sentence of apology was the largest thing on
            the screen and the least useful thing on it. */}
        {/* **The indigo shells are gone, and that is a rule rather than a
            preference.** Two blocks on this screen were wrapped in a
            `bg-accent` frame with a centred white label — the chosen list and
            an explainer. In daylight `--color-accent` is the brand indigo this
            app reserves for *"this is the way forward"*, and `globals.css`
            says in as many words that nothing else in the chrome may spend a
            hue. Spending it on two containers cost twice: the real buttons
            (Add, Suggest categories) had to compete with the colour of their
            own box, and the loudest thing on the screen became a paragraph
            explaining what subjects are.

            What replaces it is the pattern the lower half of this page was
            already using and the one every settings screen worth copying uses
            — heading, one line of deck, then the control on a plain panel. The
            page now has one section rhythm instead of three, and the only
            indigo left is on things you can press. */}
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-xl font-bold tracking-tight text-fg">
              On this book
            </h2>
            {/* The count reads as a figure about the heading, not as part of
                it — same treatment as the shelves on the title check. */}
            <span className="text-sm text-muted tabular-nums">
              {chosen.length} chosen
            </span>
          </div>

          <div className="mt-3 rounded-xl border border-line bg-panel p-4">
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
          </div>
        </section>

        {/* ---- The seven boxes --------------------------------------------
            Boxed like the two panels above it. Seven full-width fields sitting
            loose on the desk were the one block on the page with no edge, so
            the longest section read as the least finished — and on a `6xl`
            page a bare row of inputs has nothing holding it to the column the
            rest of the screen is aligned to.

            The deck moved inside the panel and the count moved up beside the
            heading, which is the shape "On this book" and "Find some" both
            use: heading and its figure, then a panel whose first line explains
            it, a divider, and the control. Three sections, one pattern. */}
        <section className="mt-12">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-xl font-bold tracking-tight text-fg">
              Your seven keywords
            </h2>
            <span className="text-sm text-muted tabular-nums">
              {(book.publishing?.keywords ?? []).filter((k) => k.trim()).length}{" "}
              of {SLOTS} used
            </span>
          </div>

          <div className="mt-3 rounded-xl border border-line bg-panel p-4">
            <p className="max-w-prose text-sm text-muted">
              A shop&rsquo;s listing form gives you seven boxes of {SLOT_MAX}{" "}
              characters. They are not tags &mdash; they are extra words the
              shop indexes the book under, so the whole game is spending them on
              words your listing does not already carry.
            </p>

            <div className="mt-3.5 border-t border-line pt-3.5">
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
            </div>
          </div>
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
      {/* **The count moved inside the field.** It used to sit in a fixed
          14-unit column at the far right, so on a wide page the number was a
          hand's width from the text it counted and the eye had to travel the
          whole row to check it — seven rows of that is seven journeys. Inside
          the box it is read in the same glance as the words, which is the
          pattern every listing form and every character-limited field settled
          on.

          Each row is a `relative` box with a padded input rather than a flex of
          three children, because the count has to sit *over* the field to be
          inside its border. `pr-16` reserves the space so a long keyword runs
          under the number rather than behind it, and the border takes the stop
          colour at the limit so the row says so twice. */}
      <ol className="flex flex-col gap-2">
        {report.slots.map((slot) => (
          <li key={slot.index} className="flex items-center gap-3">
            <span className="w-4 shrink-0 text-xs text-muted tabular-nums">
              {slot.index + 1}
            </span>
            <div className="relative min-w-0 flex-1">
              <input
                value={slot.text}
                onChange={(e) => onChange(slot.index, e.target.value)}
                aria-label={`Keyword ${slot.index + 1}`}
                placeholder="Words your title does not already use"
                /* `bg-surface`, not `bg-panel`: these now sit *inside* a panel,
                   and a field the same colour as the card under it is a field
                   with only a hairline to prove it exists. The desk colour
                   reads as a well — the same treatment the "type your own" box
                   in the panel opposite already used. */
                className={`w-full rounded-lg border bg-surface py-2 pr-16 pl-3 text-sm
                            text-fg outline-none focus-visible:ring-2
                            focus-visible:ring-accent/50 ${
                              slot.over ? "border-stop-line" : "border-line"
                            }`}
              />
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-y-0 right-3 flex
                            items-center text-xs tabular-nums ${
                              slot.over
                                ? "font-bold text-stop-fg"
                                : "text-muted/70"
                            }`}
              >
                {slot.chars}/{SLOT_MAX}
              </span>
            </div>
          </li>
        ))}
      </ol>

      {/* The count moved up beside the heading, where every other section on
          this page carries its figure. Saying it twice, four hundred pixels
          apart, made the reader check whether they were two different counts. */}
      <p className="mt-3 text-xs text-muted">Saved as you type.</p>

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

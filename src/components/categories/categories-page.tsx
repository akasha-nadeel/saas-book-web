"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
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
/* The one place the mark and its licence note live together — see the comment
   on the export. */
import { AMAZON_MARK } from "@/components/landing/works-with";
import { keywordReport, SLOTS, SLOT_MAX, type Issue } from "@/lib/keywords";
import { KeywordWorkshop } from "@/components/categories/keyword-workshop";
/* Several pages of prose that most visits never open, so it is a chunk of its
   own — the same reasoning the roadmap loads its tool panels under. */
const KeywordGuide = dynamic(
  () => import("@/components/categories/keyword-guide").then((m) => m.KeywordGuide),
  { ssr: false },
);
import { ToolSaveBar } from "@/components/ui/tool-save";
import { CopyButton } from "@/components/ui/copy-button";
import { findBook, setPublishing } from "@/lib/library-store";
import { useHydrated, useShelf } from "@/lib/use-library";
import { useToolSave } from "@/lib/use-tool-save";
import { toolShell, type ToolPageProps } from "@/lib/tool-page";

/**
 * The height of the keyword row's two cards.
 *
 * **The blurb screen's own numbers, taken deliberately.** That screen is the
 * same idea — a thing you write in beside a thing you talk to — and it settled
 * these two figures already: a page gets `36rem`, and the roadmap's panel gets
 * `22rem` because the sheet there is short and a card taller than its window
 * cannot be scrolled to the bottom of. Stated once here so both children of
 * the grid take it and end on the same line; if the blurb screen ever moves,
 * move this with it, because two tool screens differing by four rem look like
 * two products.
 */
const COMPOSER_HEIGHT_PAGE = "h-[36rem]";
const COMPOSER_HEIGHT_PANEL = "h-[22rem]";

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
  const COMPOSER_HEIGHT = embedded ? COMPOSER_HEIGHT_PANEL : COMPOSER_HEIGHT_PAGE;

  const hydrated = useHydrated();
  const shelf = useShelf();
  const book = findBook(shelf, bookId);

  /** What the writer is typing into the list themselves. */
  const [own, setOwn] = useState("");

  /*
   * The categories and the seven boxes are held on screen until Save.
   *
   * They used to write straight through on every toggle and every keystroke,
   * which made a shelf write per character in a keyword field and — worse —
   * gave a writer no way to try three arrangements and keep the one they
   * liked. Both halves are one form on one screen, so they are one draft and
   * one press.
   */
  const storedSubjects = useMemo(
    () => book?.publishing?.subjects ?? [],
    [book?.publishing?.subjects],
  );
  const storedKeywords = useMemo(
    () =>
      Array.from({ length: SLOTS }, (_, i) =>
        (book?.publishing?.keywords?.[i] ?? "").toString(),
      ),
    [book?.publishing?.keywords],
  );

  /*
   * One state, `null` until the store has been read.
   *
   * Two pieces of form in one object rather than two `useState`s beside a
   * `seeded` flag: the flag was a ref, and working out whether the form
   * differed from the book meant reading it *during render*, which is the
   * thing refs are not for. Null is the flag now, and it is the value.
   */
  const [form, setForm] = useState<{
    chosen: string[];
    keywords: string[];
  } | null>(null);

  /* Untouched, so the form falls back to the book. No effect copies it in:
     an effect that seeds state is a second render for something the first one
     already knew, and it forced a `seeded` flag to be read during render. */
  const chosen = form?.chosen ?? storedSubjects;
  const keywords = form?.keywords ?? storedKeywords;

  const same = (a: readonly string[], b: readonly string[]) =>
    a.length === b.length && a.every((v, i) => v === b[i]);

  const save = useToolSave({
    book,
    tool: "categories",
    dirty:
      form !== null &&
      (!same(form.chosen, storedSubjects) ||
        !same(form.keywords, storedKeywords)),
    commit: () =>
      book &&
      setPublishing(book.id, {
        subjects: chosen,
        /* Seven empty strings is not an answer, and `setPublishing` only
           drops an array that is *empty* — so saving a book with no keywords
           stored `["","","","","","",""]` on it, and pushed that to Postgres.
           An empty array here is how the field is cleared. */
        keywords: keywords.some((k) => k.trim()) ? keywords : [],
      }),
    discard: () => setForm(null),
  });

  /** Edit one half of the form, whichever half. */
  function edit(patch: {
    chosen?: (current: string[]) => string[];
    keywords?: (current: string[]) => string[];
  }) {
    setForm((current) => {
      const base = current ?? {
        chosen: [...storedSubjects],
        keywords: [...storedKeywords],
      };
      return {
        chosen: patch.chosen ? patch.chosen(base.chosen) : base.chosen,
        keywords: patch.keywords ? patch.keywords(base.keywords) : base.keywords,
      };
    });
  }

  /** One of the seven, written back in place so slot four stays slot four. */
  function setKeyword(index: number, text: string) {
    edit({
      keywords: (current) =>
        Array.from({ length: SLOTS }, (_, i) =>
          i === index ? text : (current[i] ?? ""),
        ),
    });
  }

  /* ---- Candidates from the workshop -----------------------------------
   *
   * **The model writes candidates; the writer keeps or discards them.** Both
   * doors in `KeywordWorkshop` — the one press and the conversation — come
   * back here, so there is one place that touches the boxes and three rules
   * hold all of it.
   *
   * *Empty slots only.* Words a writer typed are never overwritten. A model
   * quietly replacing somebody's work and presenting the result as theirs is
   * the invisible hand this app refuses everywhere — the comps query goes back
   * into the search box editable for the same reason.
   *
   * *It lands in the draft, not in the store.* Candidates go through `edit()`
   * like any typed character, so the save bar appears and nothing reaches the
   * book until the writer presses it. Undo is then honest rather than
   * cosmetic: it puts back exactly what was there.
   *
   * *The allowances are spent where the replies land*, which is inside the
   * workshop — a gateway error must not cost an allowance a writer never got
   * the benefit of, and this function is only ever reached once something
   * arrived.
   */
  /** The seven as they were before the last fill, or null when there is none. */
  const [beforeSuggest, setBeforeSuggest] = useState<string[] | null>(null);

  /* The guide sheet. Loaded on demand below rather than imported at the top:
     it is several pages of prose that most visits never open. */
  const [guideOpen, setGuideOpen] = useState(false);

  /* `description` is the blurb — `publishing.ts` names the field for the shops'
     own form rather than for what writers call it. */
  const blurb = book?.publishing?.description ?? "";

  function applyCandidates(found: string[]) {
    if (found.length === 0) return;

    setBeforeSuggest([...keywords]);
    edit({
      keywords: (current) => {
        const next = [...current];
        let take = 0;
        for (let i = 0; i < SLOTS && take < found.length; i += 1) {
          if (!(next[i] ?? "").trim()) {
            next[i] = found[take];
            take += 1;
          }
        }
        return next;
      },
    });
  }

  function undoSuggest() {
    if (!beforeSuggest) return;
    const previous = beforeSuggest;
    edit({ keywords: () => [...previous] });
    setBeforeSuggest(null);
  }

  /**
   * Already on the list, however it was capitalised.
   *
   * Case-insensitive so a category typed as "mystery" ticks the "Mystery"
   * suggestion rather than sitting beside it as a near-duplicate — the shop
   * would treat those as one, and the writer would have to spot it.
   *
   * Takes the list rather than reading `chosen`, because both callers below
   * work inside a state updater and have to test what is *current* there, not
   * what was current when this render started.
   */
  function holds(list: readonly string[], name: string): boolean {
    const key = name.trim().toLowerCase();
    return list.some((s) => s.toLowerCase() === key);
  }

  function toggle(name: string) {
    const key = name.trim().toLowerCase();
    edit({
      chosen: (current) =>
        holds(current, name)
          ? current.filter((s) => s.toLowerCase() !== key)
          : [...current, name],
    });
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
    edit({
      chosen: (current) => {
        const added: string[] = [];
        for (const raw of names) {
          const name = raw.replace(/\s+/g, " ").trim();
          if (!name) continue;
          if (holds(current, name) || holds(added, name)) continue;
          added.push(name);
        }
        return added.length > 0 ? [...current, ...added] : current;
      },
    });
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
      {/* At the foot of the window, and only once there is something to lose.
          Outside the scrolling column: the keyword boxes are below the fold on
          an ordinary laptop, and a Save that scrolls with them is not on
          screen at the moment it becomes relevant. */}
      <ToolSaveBar state={save} />
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

      {/* `@container`, so the keyword row below can size itself off the column
          it is in rather than off the window — the same reasoning the blurb
          screen documents, and the reason the two now agree: in the roadmap's
          panel this page is a ~700px column inside a full-width viewport, so a
          `lg:` breakpoint reading the window would put a 24rem sidebar beside
          a 200px one. */}
      <div className="@container mx-auto max-w-7xl px-6 pt-6 pb-16">
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
              /* **The chip is two controls now, and the split is forced.** It
                 was one button whose whole surface removed the category; a
                 copy control cannot go inside a button, so the name and the ✕
                 became siblings. Copying is what the name does, because a
                 shop's category selector is a search box somebody has to type
                 this path into — and removing keeps the ✕ it always drew,
                 which was the visible affordance for it either way. Both carry
                 an aria-label saying which is which, since "Fiction ✕" read
                 aloud says nothing about what pressing it will do. */
              <ul className="flex flex-wrap gap-2">
                {chosen.map((name) => (
                  <li
                    key={name}
                    className="flex items-center rounded-full bg-accent pr-1.5 pl-1
                               text-sm font-medium text-accent-ink"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(name)}
                      aria-label={`Remove ${name}`}
                      className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5
                                 outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                    >
                      {name}
                      <span aria-hidden="true" className="text-accent-ink/70">
                        ✕
                      </span>
                    </button>
                    {/* Inherits the chip's own ink; a muted grey here would be
                        a smudge on the fill. */}
                    <CopyButton value={name} label={`Copy ${name}`} />
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
              {/* No longer "saved as you go" — this list is held until the bar
                  at the foot of the window is pressed, and a hint promising
                  otherwise is the kind of claim the house rules exist to
                  catch. The comma trick is the part worth keeping. */}
              <p className="mt-2 max-w-prose text-xs text-muted">
                Several at once if you separate them with commas. Suggestions
                come from Open Library&rsquo;s subject index; nothing is checked
                against a shop&rsquo;s own list, so paste whatever its selector
                gave you.
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
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2 className="text-xl font-bold tracking-tight text-fg">
                Your seven keywords
              </h2>

              {/* **A scope label, next to the heading it qualifies.**
                  Everything under it is Amazon's shape — seven fields, fifty
                  characters, its own refusals — where the categories above are
                  a librarian's subjects that any shop's form can be matched
                  to. A reader who publishes wide should be able to see which
                  of the two they are looking at without reading a paragraph,
                  and that is what a chip beside a heading is for.

                  **Nominative use, kept at label size.** The mark comes from
                  `works-with.tsx`, which carries the licence note the artwork
                  needs, and it is drawn *beside the word Amazon* rather than
                  standing in for it. That is the line: naming the shop whose
                  form this is, is fair; wearing their mark as decoration on
                  our own work implies they endorse it, which they do not.

                  It keeps its own orange in both themes, like every other
                  brand mark here — a trademark is a trademark, and a
                  greyscale Amazon smile is a different mark from the one
                  people recognise. The chip around it is ours, so it takes
                  the chrome. */}
              {/* Full ink rather than `muted`. It was the grey a caption takes,
                  which is right for something you may ignore and wrong for
                  this: the chip says *which shop this whole section is about*,
                  and a reader who publishes wide has to be able to see it
                  without looking for it. The mark itself was always at full
                  strength — it is the brand's own #FF9900 with no opacity on
                  it — and it only read as faded because the words beside it
                  were. */}
              <span className="inline-flex items-center gap-2 rounded-full border border-line
                               bg-raised py-1 pr-3.5 pl-2.5 text-sm font-semibold text-fg">
                {/* The mark leads at 20px — the chip is a scope label, so the
                    logo is the thing scanned and the words are the caption
                    that proves what it means. Smaller than this and Amazon's
                    smile is an orange smudge; larger and a label starts
                    competing with the heading beside it. */}
                <svg
                  aria-hidden="true"
                  viewBox={AMAZON_MARK.viewBox}
                  className="h-5 w-5 shrink-0"
                >
                  {AMAZON_MARK.paths.map((p) => (
                    <path key={p.d} d={p.d} fill={p.fill} />
                  ))}
                </svg>
                Amazon KDP
              </span>
            </div>

            <span className="text-sm text-muted tabular-nums">
              {keywords.filter((k) => k.trim()).length} of {SLOTS} used
            </span>
          </div>

          {/* **The boxes and the offer are two boxes, side by side.** The
              suggestion control sat inside this panel, above the fields, on
              the reasoning that it is what somebody looking at seven empty
              inputs needs. It is — but stacked it pushed the seven down the
              page and read as a step to take before typing, when the whole
              design is that a writer fills these in themselves and the model
              only fills what is left empty. Beside them it is an offer
              standing next to the work rather than in front of it, and the
              fields start at the top of the section where they belong.

              **The same measurements as the blurb screen, and that is the
              point.** Both screens are a thing you write beside a thing you
              talk to, so they take one grid — `@3xl` off the *container* and a
              24rem rail, not `lg:` off the window, because in the roadmap's
              panel the window is wide while this column is not — and one
              height, stated on both children so the two cards end on the same
              line. Two tool screens that differ by four rem in the sidebar and
              a hand's width in the card look like two products. */}
          <div className="mt-3 grid gap-6 @3xl:grid-cols-[minmax(0,1fr)_24rem]">
            <div
              className={`flex ${COMPOSER_HEIGHT} flex-col overflow-hidden rounded-xl
                          border border-line bg-panel p-4`}
            >
              {/* **The paragraph and the way into the guide, as one block.**
                  Contextual help belongs beside the thing it explains — the
                  paragraph says what the boxes are in three sentences, and the
                  button is where somebody goes when three sentences are not
                  enough. In the section header it was a control floating above
                  a card; here it is the end of the explanation.

                  It opens a *sheet* rather than a dialog, because this is read
                  while carrying on working, with the form still visible
                  behind it. And it is not the Help dialog, which is the app's
                  index of what exists: this is one subject in depth, and most
                  of what is in it is Amazon's rules rather than ours.

                  Stacked below `sm`, where a button beside a paragraph would
                  leave the text a four-word column. */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
                {/* **"Amazon", not "a shop", and the difference is a claim we
                    can back.** Seven boxes of fifty characters is Amazon's
                    shape and nobody else's: Kobo has one keywords field, Apple
                    Books none, IngramSpark works from BISAC codes. This screen
                    is built to the strictest of them, which is the useful
                    choice — a set of phrases that fits here fits anywhere —
                    but saying "a shop's form" made a claim about shops in
                    general that is simply untrue. The guide answers it
                    properly. */}
                {/* Two sentences. It ran to four, and the two that went are
                    both answered at length behind the button beside it: that
                    these are not tags, and that other shops ask differently.
                    What has to survive is the shape, the attribution — seven
                    of fifty is Amazon's and not a standard — and the one rule
                    that decides every keyword. */}
                <p className="max-w-prose text-sm text-muted">
                  Seven boxes of {SLOT_MAX} characters, on Amazon&rsquo;s
                  listing form. They are extra words the shop indexes your book
                  under, so spend them on what your listing does not already
                  carry.
                </p>

                {/* **A green fill, from `--color-guide`, and the token is
                    where the reasoning lives.** Two things about the shape.
                    The label carries a chevron rather than a question mark,
                    because the press *goes* somewhere — a sheet in from the
                    right — and the glyph should say which way rather than
                    repeat the word "help". And the ink is literal white rather
                    than `accent-ink`, which is black at night: ink that
                    inverts on a ground that does not is the one way to get a
                    filled button wrong. */}
                <button
                  type="button"
                  onClick={() => setGuideOpen(true)}
                  className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg
                             bg-guide px-3.5 py-2 text-sm font-semibold text-white
                             outline-none transition-colors hover:bg-guide-hover
                             focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  How these work
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-3.5 w-3.5"
                  >
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
              </div>

              {/* The fields scroll inside the card rather than stretching it.
                  Seven rows fit at this height; the findings underneath do not
                  always, and a card that grew with them would put the two
                  columns out of step again the first time somebody typed their
                  own title into box one. `min-h-0`, or a flex child with
                  overflow grows its parent instead of scrolling in it. */}
              <div className="scroll-slim mt-3.5 min-h-0 flex-1 overflow-y-auto border-t border-line pt-3.5">
                <KeywordBoxes
                  keywords={keywords}
                  title={book.title}
                  subtitle={book.subtitle}
                  author={book.author}
                  series={book.publishing?.series}
                  categories={chosen}
                  onChange={setKeyword}
                />
              </div>
            </div>

            {/* ---- The workshop --------------------------------------------

                One card, two doors: the press for somebody who wants seven
                candidates and nothing else, and the conversation for the two
                questions a button cannot answer — *what are these boxes* and
                *which seven should this book spend them on*.

                **A stated height, not `flex-1`, and the same one the card
                beside it takes.** A grid row is `auto` and grows to its
                tallest item, so a chat left to size itself would stretch the
                row with every turn and never scroll — and the two cards would
                end on different lines, which is the thing that made this
                screen and the blurb screen look like two products.
                `COMPOSER_HEIGHT` is the one place that number lives. */}
            <div className={`flex ${COMPOSER_HEIGHT} flex-col`}>
              <KeywordWorkshop
                blurb={blurb}
                genre={book.genre}
                categories={chosen}
                keywords={keywords}
                title={book.title}
                subtitle={book.subtitle}
                author={book.author}
                series={book.publishing?.series}
                onCandidates={applyCandidates}
                onUndo={undoSuggest}
                canUndo={beforeSuggest !== null}
                onOpenGuide={() => setGuideOpen(true)}
              />
            </div>
          </div>
        </section>

        <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6">
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

          {/* **A shelf a category cannot reach.** Some of Amazon's
              subcategories are gated on the keywords rather than on the
              category selector: the book appears there only if one of these
              seven boxes carries a particular word. Its own LGBT page is the
              plain example — Bisexual Romance requires the word "bisexual" —
              and there are sibling pages per genre.

              **The list is deliberately not shipped.** It changes, it is
              published per genre, and a stale copy of somebody else's rules
              read as ours is exactly the invented-data failure this screen
              exists to avoid. So the mechanism is named, and the link goes to
              Amazon. */}
          <p className="max-w-3xl text-xs text-muted">
            One thing the three categories cannot do: a few of Amazon&rsquo;s
            subcategories are reached <em>only</em> through these boxes — a book
            appears in them if a keyword carries the word they are gated on, and
            not otherwise. Amazon publishes which, genre by genre, and changes
            them, so it is worth a look at{" "}
            <a
              href="https://kdp.amazon.com/en_US/help/topic/G201298500"
              target="_blank"
              rel="noreferrer"
              className="underline decoration-line underline-offset-2 hover:text-fg"
            >
              their own keyword page
            </a>{" "}
            before you settle the seven.
          </p>
        </div>
      </div>

      {/* Both limit dialogs live inside the workshop now, with the presses
          that are refused — opened by a press and never by an effect, since an
          effect watching `blocked` would fire on arrival for somebody who ran
          out last week, which is a paywall shown to a writer who pressed
          nothing. */}

      {guideOpen && <KeywordGuide onClose={() => setGuideOpen(false)} />}
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
  categories,
  onChange,
}: {
  keywords: readonly string[];
  title: string;
  subtitle?: string;
  author?: string;
  series?: string;
  /** The shelves chosen above, which a shop indexes the book under already. */
  categories: readonly string[];
  onChange: (index: number, text: string) => void;
}) {
  const report = useMemo(
    () =>
      keywordReport(keywords, {
        title,
        subtitle,
        author,
        series,
        categories,
      }),
    [keywords, title, subtitle, author, series, categories],
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

            {/* **A copy control per box, because the shop has seven boxes.**
                These are never uploaded from here — a writer retypes them into
                Amazon's own form, and retyping a fifty-character phrase into a
                fifty-character field is where a typo becomes a keyword nobody
                searches for. One press per box rather than one press for all
                seven: a joined string would have to be taken apart at the
                other end, which is the work this removes rather than moves.

                The slot keeps its width whether or not the button is in it, so
                the field does not narrow the moment the first character is
                typed. */}
            <span className="flex w-7 shrink-0 justify-center">
              <CopyButton
                value={slot.text}
                label={`Copy keyword ${slot.index + 1}`}
                className="text-muted hover:border-line hover:text-fg"
              />
            </span>
          </li>
        ))}
      </ol>

      {/* "Saved as you type" stood here and had been false since both halves
          of this screen became one draft behind the save bar at the foot of
          the window. The count it used to sit beside moved up to the heading,
          where every other section on this page carries its figure. */}

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
    case "quoted":
      return `${box(issue.slot)} has quotation marks in it. Shops ask for the words on their own — the marks are read as part of the phrase.`;
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

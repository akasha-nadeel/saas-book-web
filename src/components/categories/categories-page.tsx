"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
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
  /* **Read-only while "On this book" is out.** Nothing on the screen edits the
     categories at the moment, so this is the book's own list — which the
     keyword checker and the workshop both still need, since a shop indexes a
     book under its categories already and a keyword repeating one is a box
     spent on nothing. The draft keeps the field rather than dropping it: the
     section is being rebuilt, and the save bar this screen already owns is
     what it will commit through. */
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

  // The app's splash is for the app. In the roadmap's panel it would take
  // over half the window with a logo, so an embedded tool waits silently —
  // see `Pending` in `roadmap/step-panel.tsx`.
  if (!hydrated)
    return embedded ? <div className={toolShell(embedded)} /> : <LoadingScreen />;

  if (!book) {
    return (
      <div className="grid h-[var(--oc-layout-height)] place-items-center bg-surface p-8 text-center">
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
             disagree.

             The deck was cut from three sentences to two to suit a header
             whose deck runs that full width — the clause that cannot be
             dropped is still on the end. */
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
          vocabulary, so this reads it off where books like yours are actually
          filed — never off a list we made up.
        </ToolHeader>
      )}

      {/* `@container`, so the keyword row below can size itself off the column
          it is in rather than off the window — the same reasoning the blurb
          screen documents, and the reason the two now agree: in the roadmap's
          panel this page is a ~700px column inside a full-width viewport, so a
          `lg:` breakpoint reading the window would put a 24rem sidebar beside
          a 200px one. */}
      <div className="@container mx-auto max-w-7xl px-(--oc-page-gutter) pt-4 pb-[calc(4rem+var(--oc-safe-bottom))] sm:pt-6">
        {heading}

        {/* ---- The seven boxes --------------------------------------------
            Boxed. Seven full-width fields sitting loose on the desk were the
            one block on the page with no edge, so the longest section read as
            the least finished — and on a `6xl` page a bare row of inputs has
            nothing holding it to the column the rest of the screen is aligned
            to.

            The shape is heading and its figure, then a panel whose first line
            explains it, a divider, and the control.

            **The section above it has been taken out**, and this is the only
            one left: "On this book" — the chosen-categories field, the shelf
            suggestions and the three-shop chip — is being rebuilt, so it is
            gone rather than half-present. Its picker is kept whole in
            `subject-combobox.tsx` for the version that replaces it; see
            TODO.md. No top margin now that this is the first thing under the
            heading. */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h2 className="text-xl font-bold tracking-tight text-fg">
              Your seven keywords
            </h2>

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
              {/* **The scope label lives in here now, beside the words it
                  qualifies.** Next to the heading it labelled the section from
                  outside it, which is the weaker place: the paragraph below is
                  the thing that says "seven boxes, fifty characters, Amazon's
                  shape", and a chip naming the shop reads as the first clause
                  of that sentence rather than as chrome hanging off a title.
                  It also leaves the heading row carrying only the heading and
                  its count, which is the shape every section on this page
                  takes. */}
                {/* **Nominative use, and the licence note travels with it.**
                    The mark comes from `works-with.tsx`, which carries the
                    attribution the artwork requires, and it is drawn *beside the
                    word Amazon* rather than standing in for it. Naming the shop
                    whose form this is, is fair; wearing their mark as decoration
                    on our own work implies an endorsement they have not given.
                    It keeps its own orange in both themes — a greyscale Amazon
                    smile is a different mark from the one people recognise.

                    **A title, not a pill.** As a chip it read as a tag stuck
                    on the panel — one more small grey thing among the small
                    grey things. It is not a tag: it names *whose form this
                    whole section is*, which is the first thing to know here and
                    the difference between these seven boxes and the categories
                    above. So it takes the shape of what it is — a heading, with
                    the mark at heading size beside it — and the paragraph under
                    it becomes its deck.

                    The mark grows with the words, to 24px. At 20px beside
                    16px type it was the smaller of the two, which reads as
                    decoration attached to a label rather than as the subject
                    being named. */}
                <h3 className="mb-3 flex items-center gap-2.5 text-base font-bold text-fg">
                  <svg
                    aria-hidden="true"
                    viewBox={AMAZON_MARK.viewBox}
                    className="h-6 w-6 shrink-0"
                  >
                    {AMAZON_MARK.paths.map((p) => (
                      <path key={p.d} d={p.d} fill={p.fill} />
                    ))}
                  </svg>
                  Amazon KDP
                </h3>

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
                  Seven boxes of {SLOT_MAX}{" "}
                  characters, on Amazon&rsquo;s listing form. They are extra words the shop indexes your book
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
                bookId={book.id}
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

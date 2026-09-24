import {
  AppWindow,
  type AppWindowChrome,
} from "@/components/landing/app-window";
import { MAX_SNAPSHOTS } from "@/lib/history";
import { IMPORT_FORMATS } from "@/lib/import";
import { LAUNCH_LIMITS } from "@/lib/launch";
import { plural } from "@/lib/plural";
import { RECORD_FORMAT } from "@/lib/provenance";

/**
 * The launch MVP's drawn screens — the shelf, the editor, the versions a
 * chapter keeps, and the import.
 *
 * **Drawn in markup rather than photographed**, which is this site's standing
 * rule and the reason it can claim to be checkable: a screenshot is an asset
 * that goes stale silently while the app moves, and the bitmaps already on the
 * page are the documented exception rather than the pattern. Nothing here can
 * rot into a wrong colour or a stale font; what it *can* do is quote a string
 * the app has since reworded, so every quotation below says where it came from.
 *
 * **Nothing scales in pixels.** Each screen is a fixed design in `W × H` with
 * every size written in `cqw` against the container query on `AppWindow`'s
 * glass, so one set of proportions holds at any column width and the sections
 * built on them ship no JavaScript. That is `export-screen.tsx`'s mechanism and
 * these are deliberately the same component at the same volumes, or five
 * figures on one page read as five products photographed on five machines.
 *
 * **They are pictures, so every one passes a `label`** — `AppWindow` turns that
 * into `role="img"` and hides the drawing behind the one description. The rule
 * is in that file: the label is what separates a picture of a control from a
 * control.
 *
 * **What is read, and what is quoted.** `IMPORT_FORMATS` is imported, because
 * it is a plain table in `lib/import` and the import screen's whole claim is
 * which files it takes. Everything else is quoted by hand from a `"use client"`
 * module — `import-book.tsx`, `chapter-editor.tsx`, `left-panel.tsx`,
 * `chat-panel.tsx`, `bookshelf.tsx` — because a Server Component importing a
 * value from a client module gets a client *reference* rather than the value,
 * which is a 500 rather than a wrong word. Each quotation is marked below with
 * the file it came from; those are the lines to walk when a screen moves.
 *
 * **Only the launch MVP is drawn.** No tool rail, no roadmap, no Prepare and no
 * Track — the proxy redirects every one of those home, and a figure showing a
 * screen a visitor cannot open is the same broken promise as a nav entry
 * pointing at a section that is not there.
 */

/*
 * The design every `cqw` figure below is a proportion of.
 *
 * `W` is only ever used for the **aspect ratio**, which is scale-invariant.
 * What actually sets the type size is that the whole design is mapped onto
 * 100cqw, so a drawn screen is its design width scaled to whatever column it
 * lands in. **The design is about 770px wide**, deliberately narrower than the
 * 1000px `export-screen.tsx` works at, and that is the measurement here worth
 * not undoing: a 1000px design in this page's figure column — about 660px
 * inside the tinted card at desktop — puts its body text at eight and a half
 * pixels, which is the size at which a browser's subpixel antialiasing starts
 * putting colour on the letters. At 770 the same rows land near twelve, and
 * the hero, capped at `max-w-4xl` for exactly this reason, near fifteen.
 *
 * So if a screen ever moves into a wider or narrower slot, the thing to change
 * is the slot's measure, not one font size in here.
 */
const W = 1000;

/**
 * What every drawn screen takes, and the only prop any of them has.
 *
 * The screens are pictures: they draw themselves and answer to nothing. The
 * one exception is the *frame* — the hero shows them inside a browser window
 * with the demo's own tabs in its bar, and the frame belongs to `AppWindow`
 * rather than to the picture. So each screen forwards this and touches
 * nothing else; passing it is what turns a figure into the hero's demo, and
 * leaving it off gives the plain pane every other section wants.
 */
type ScreenProps = { chrome?: AppWindowChrome };

/** The sample book, shared by all five so they read as one library. */
const BOOK = {
  title: "Breathe Again",
  chapter: "The Weather House",
} as const;

/** One line of drawn prose. A bar, because invented prose is still invented. */
function Line({ w }: { w: number }) {
  return (
    <span
      aria-hidden="true"
      className="block h-[0.55cqw] rounded-full bg-lp-ink/15"
      style={{ width: `${w}%` }}
    />
  );
}

/* --------------------------------------------------------------------------
   The shelf
   -------------------------------------------------------------------------- */

/**
 * Three cards on the Write area's grid.
 *
 * **Each card carries one action, and that is a truthful subset rather than a
 * tidy-up.** The real card offers Write and Read; `/book/[bookId]/read` is in
 * `HIDDEN_BOOK_TOOL_PATHS`, so under the launch MVP that second button goes
 * home. Drawing the one that works is the honest half.
 *
 * The counts are the shape `bookshelf.tsx` prints — chapters and words summed
 * from the manuscript on every read rather than stored — and the dates are
 * `relative-time.ts`'s phrasing.
 */
const SHELF = [
  {
    title: BOOK.title,
    chapters: 12,
    words: 41208,
    at: "Opened 2 hours ago",
    tint: "from-[#3f4a63] to-[#2f3648]",
  },
  {
    title: "The Long Winter Post",
    chapters: 8,
    words: 22740,
    at: "Opened yesterday",
    tint: "from-[#5b4a3f] to-[#43362d]",
  },
  {
    title: "Notes on a Quiet Year",
    chapters: 3,
    words: 6180,
    at: "Opened last week",
    tint: "from-[#3f5b4f] to-[#2d4238]",
  },
] as const;

export function ShelfScreen({ chrome }: ScreenProps = {}) {
  return (
    <AppWindow
      chrome={chrome}
      label="The shelf: three books on a grid, each with its cover, its chapter and word counts, when it was last opened and a Write button — above them the Import a manuscript and New book buttons, and tabs counting the books, the archived ones and the trash."
      /* Taller than the other three: a row of 2:3 covers is the one thing here
         with a fixed proportion of its own, so the frame has to be cut to the
         content rather than the content squeezed into a frame. */
      screenStyle={{ aspectRatio: `${W} / 640` }}
      screenClassName="@container flex overflow-hidden bg-lp-raised leading-[1.35]"
    >
      {/* The sidebar. Only the wordmark and the areas the MVP reaches are
          drawn — see the note at the top about what is deliberately absent. */}
      <aside className="flex w-[24.7cqw] shrink-0 flex-col border-r border-lp-edge bg-lp-ground px-[2.6cqw] py-[2.86cqw]">
        <p className="text-[1.95cqw] font-bold tracking-tight text-lp-ink">
          Open<span className="text-lp-wordmark">Chapter</span>
        </p>
        <ul className="mt-[3.38cqw] space-y-[0.91cqw]">
          {[
            { name: "Overview", current: false },
            { name: "Write", current: true },
          ].map((item) => (
            <li
              key={item.name}
              className={`rounded-[0.91cqw] px-[1.43cqw] py-[1.1cqw] text-[1.62cqw] ${
                item.current
                  ? "bg-lp-accent/10 font-semibold text-lp-accent-text"
                  : "text-lp-body"
              }`}
            >
              {item.name}
            </li>
          ))}
        </ul>

        <div className="mt-auto rounded-[1.17cqw] border border-lp-edge px-[1.43cqw] py-[1.3cqw]">
          <p className="text-[1.37cqw] font-semibold text-lp-ink">Free plan</p>
          <p className="mt-[0.33cqw] text-[1.3cqw] text-lp-faint">
            {plural(LAUNCH_LIMITS.freeBooks, "book")}
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col px-[3.9cqw] py-[3.12cqw]">
        <div className="flex items-center gap-[1.56cqw]">
          <h1 className="font-serif text-[2.99cqw] text-lp-ink">Write</h1>
          {/* `bookshelf.tsx` — the two ways a book starts, in its order. */}
          <span className="ml-auto flex items-center gap-[1.17cqw]">
            <span className="rounded-[1.04cqw] border border-lp-edge px-[1.82cqw] py-[1.04cqw] text-[1.49cqw] font-medium text-lp-ink">
              Import a manuscript
            </span>
            <span className="rounded-[1.04cqw] bg-lp-accent px-[2.08cqw] py-[1.04cqw] text-[1.49cqw] font-semibold text-lp-accent-ink">
              New book
            </span>
          </span>
        </div>

        <div className="mt-[2.6cqw] flex items-center gap-[2.6cqw] border-b border-lp-edge pb-[1.3cqw]">
          {[
            { name: "Books", count: String(SHELF.length), current: true },
            { name: "Archived", count: "1", current: false },
            { name: "Trash", count: "0", current: false },
          ].map((tab) => (
            <span
              key={tab.name}
              className={`relative flex items-baseline gap-[0.78cqw] text-[1.62cqw] ${
                tab.current ? "font-semibold text-lp-ink" : "text-lp-body"
              }`}
            >
              {tab.name}
              <span className="text-[1.37cqw] text-lp-faint tabular-nums">
                {tab.count}
              </span>
              {tab.current && (
                <span className="absolute -bottom-[1.37cqw] left-0 h-[0.26cqw] w-full rounded-full bg-lp-accent" />
              )}
            </span>
          ))}
        </div>

        <div className="mt-[3.12cqw] grid grid-cols-3 gap-[2.34cqw]">
          {SHELF.map((book) => (
            <div
              key={book.title}
              className="flex flex-col rounded-[1.43cqw] border border-lp-edge bg-lp-ground p-[1.82cqw]"
            >
              {/* The shape `BookCover` draws for a book with no artwork: a
                  cloth ground with the title as two bands, which is all a
                  cover this size can honestly show. That component is
                  `"use client"` and would put JavaScript on a page that
                  ships none. */}
              <span
                style={{ aspectRatio: "2 / 3" }}
                className={`mb-[1.56cqw] block w-full overflow-hidden rounded-[0.78cqw] bg-linear-to-b ${book.tint} shadow-sm`}
              >
                <span className="mx-auto mt-[34%] block h-[0.36cqw] w-[58%] rounded-full bg-white/70" />
                <span className="mx-auto mt-[0.65cqw] block h-[0.36cqw] w-[38%] rounded-full bg-white/45" />
              </span>
              <span className="truncate text-[1.69cqw] font-semibold text-lp-ink">
                {book.title}
              </span>
              <span className="mt-[0.52cqw] text-[1.37cqw] text-lp-faint tabular-nums">
                {book.chapters} chapters · {book.words.toLocaleString()} words
              </span>
              <span className="mt-[0.26cqw] text-[1.37cqw] text-lp-faint">
                {book.at}
              </span>
              {/* `mt-auto`, because a shorter title or a count that fits on
                  one line otherwise lifts one card's button above its
                  neighbours' — three buttons on three lines is the thing that
                  makes a drawn grid look like a drawing. */}
              <span className="mt-auto pt-[1.56cqw]">
                <span className="block rounded-[0.91cqw] border border-lp-edge px-[1.56cqw] py-[0.91cqw] text-center text-[1.43cqw] font-semibold text-lp-ink">
                  Write
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </AppWindow>
  );
}

/* --------------------------------------------------------------------------
   The editor
   -------------------------------------------------------------------------- */

/**
 * The panels the rail opens, in the rail's own order.
 *
 * **Five of the eight, and the three left out are left out on purpose.** Ideas,
 * Story bible and Bookmarks are named in `LAUNCH_POST_BACKLOG` as things the
 * launch MVP is meant to bring back later, so this page does not sell them.
 * The names are `PANEL_TITLES` in `left-panel.tsx`, quoted rather than
 * imported — that module is `"use client"`.
 */
const PANELS = [
  "Manuscript",
  "Search this book",
  "Notes",
  "Versions",
  "Deleted chapters",
] as const;

/** What each chapter in the drawn list has been written to, in words. */
const CHAPTER_WORDS = [2140, 1204, 1880, 990, 1512] as const;

/**
 * The rail down the left of the editor, with one panel standing open.
 *
 * **Drawn as the panels' initials rather than as invented glyphs.** A made-up
 * icon is a claim about what a control looks like, and all this column has to
 * say is that the panels are a column of them — inventing six pictograms would
 * be six small lies in a figure whose whole argument is that it is not a
 * screenshot.
 */
function IconRail({ open }: { open: (typeof PANELS)[number] }) {
  return (
    <nav className="flex w-[5.72cqw] shrink-0 flex-col items-center gap-[1.17cqw] border-r border-lp-edge bg-lp-ground py-[2.6cqw]">
      {PANELS.map((name) => (
        <span
          key={name}
          className={`flex h-[3.38cqw] w-[3.38cqw] items-center justify-center rounded-[0.78cqw] text-[1.43cqw] font-semibold ${
            name === open
              ? "bg-lp-accent/12 text-lp-accent-text"
              : "text-lp-faint"
          }`}
        >
          {name.charAt(0)}
        </span>
      ))}
    </nav>
  );
}

/**
 * The versions a chapter has kept, as `history-panel.tsx` lists them.
 *
 * **The panel's own framing is drawn with it**, and it is the unusual half: the
 * header says outright that this is a safety net for a bad afternoon rather
 * than an archive, and the count of kept versions is `MAX_SNAPSHOTS` itself. A
 * figure that showed the list and dropped the sentence would be selling
 * version control, which this deliberately is not.
 *
 * The delta beside each count is `changeLabel`'s own — the only number that
 * tells a writer which of eight near-identical timestamps is the one they are
 * looking for.
 */
const VERSIONS = [
  { when: "2 minutes ago", words: 1204, delta: "+24", newest: true },
  { when: "18 minutes ago", words: 1180, delta: "+310", newest: false },
  { when: "43 minutes ago", words: 870, delta: "−96", newest: false },
  { when: "Yesterday", words: 966, delta: "", newest: false },
] as const;

export function VersionsScreen({ chrome }: ScreenProps = {}) {
  return (
    <AppWindow
      chrome={chrome}
      label={`The Versions panel: four sittings on one chapter, each with when it was saved, its word count and the change against the one before it, over a note saying a version is kept about every ten minutes and the last ${MAX_SNAPSHOTS} are kept.`}
      screenStyle={{ aspectRatio: `${W} / 600` }}
      screenClassName="@container flex overflow-hidden bg-lp-raised leading-[1.35]"
    >
      <IconRail open="Versions" />

      <aside className="flex w-[36.4cqw] shrink-0 flex-col border-r border-lp-edge bg-lp-well">
        <div className="shrink-0 border-b border-lp-edge px-[2.34cqw] py-[2.08cqw]">
          <p className="text-[1.62cqw] font-semibold text-lp-ink">
            {VERSIONS.length} sittings on this chapter
          </p>
          <p className="mt-[0.65cqw] text-[1.3cqw] leading-[1.5] text-lp-faint">
            A version is kept about every ten minutes you are editing, and the
            last {MAX_SNAPSHOTS} are kept. This is a safety net for a bad
            afternoon, not an archive.
          </p>
        </div>

        <ul className="flex min-h-0 flex-1 flex-col gap-[1.04cqw] px-[2.34cqw] py-[1.82cqw]">
          {VERSIONS.map((version) => (
            <li
              key={version.when}
              className="rounded-[1.04cqw] border border-lp-edge bg-lp-ground px-[1.56cqw] py-[1.3cqw]"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-[1.04cqw]">
                <span className="text-[1.49cqw] text-lp-ink">
                  {version.when}
                </span>
                <span className="text-[1.3cqw] text-lp-faint tabular-nums">
                  {version.words.toLocaleString()} words
                  {version.delta && ` · ${version.delta}`}
                </span>
              </div>
              <p
                className={`mt-[0.78cqw] text-[1.3cqw] ${
                  version.newest
                    ? "text-lp-faint"
                    : "font-semibold text-lp-accent-text"
                }`}
              >
                {version.newest
                  ? "The most recent save."
                  : "Put this version back"}
              </p>
            </li>
          ))}
        </ul>
      </aside>

      {/* The chapter it is offering to put back, still on its page. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden px-[5.2cqw] pt-[3.9cqw]">
        <div className="min-h-0 flex-1 rounded-t-[0.52cqw] bg-lp-paper px-[5.2cqw] pt-[3.9cqw] shadow-[0_1px_4px_rgba(15,15,16,0.08)]">
          <div className="flex items-baseline justify-between text-[1.17cqw] tracking-[0.16em] text-lp-faint uppercase">
            <span>{BOOK.title}</span>
            <span>24</span>
          </div>
          <p className="mt-[3.12cqw] text-center font-serif text-[2.34cqw] text-lp-ink">
            {BOOK.chapter}
          </p>
          <div className="mt-[3.12cqw] space-y-[1.37cqw]">
            {[96, 100, 91, 98, 64].map((w, i) => (
              <Line key={i} w={w} />
            ))}
            <span className="block h-[1.17cqw]" />
            {[99, 88, 100, 93, 72, 97, 90, 100, 85, 94].map((w, i) => (
              <Line key={`b${i}`} w={w} />
            ))}
          </div>
        </div>
      </div>
    </AppWindow>
  );
}

export function ManuscriptScreen({ chrome }: ScreenProps = {}) {
  return (
    <AppWindow
      chrome={chrome}
      bezel
      label="The editor: the Manuscript panel listing a book's front matter and its chapters, beside the chapter itself set on a page with a running head, and a bar at the foot counting 1,204 of 80,000 words with the time of the last save beside it."
      screenStyle={{ aspectRatio: `${W} / 620` }}
      screenClassName="@container flex overflow-hidden bg-lp-raised leading-[1.35]"
    >
      <IconRail open="Manuscript" />

      {/* The Manuscript panel. Front matter over body is the shape
          `book-panel.tsx` draws and `matter.ts` decides. */}
      <aside className="flex w-[26cqw] shrink-0 flex-col border-r border-lp-edge bg-lp-well px-[2.08cqw] py-[2.34cqw]">
        <p className="text-[1.62cqw] font-semibold text-lp-ink">Manuscript</p>
        <p className="mt-[0.39cqw] truncate text-[1.3cqw] text-lp-faint">
          {BOOK.title}
        </p>

        <p className="mt-[2.34cqw] text-[1.23cqw] font-semibold tracking-[0.14em] text-lp-faint uppercase">
          Front matter
        </p>
        <ul className="mt-[0.91cqw] space-y-[0.59cqw]">
          {["Title page", "Copyright"].map((page) => (
            <li
              key={page}
              className="truncate rounded-[0.65cqw] px-[1.04cqw] py-[0.72cqw] text-[1.43cqw] text-lp-body"
            >
              {page}
            </li>
          ))}
        </ul>

        <p className="mt-[2.08cqw] text-[1.23cqw] font-semibold tracking-[0.14em] text-lp-faint uppercase">
          Chapters
        </p>
        <ul className="mt-[0.91cqw] space-y-[0.59cqw]">
          {["One", "Two", "Three", "Four", "Five"].map((n, i) => (
            <li
              key={n}
              className={`flex items-baseline gap-[0.91cqw] rounded-[0.65cqw] px-[1.04cqw] py-[0.72cqw] text-[1.43cqw] ${
                i === 1
                  ? "bg-lp-accent/10 font-semibold text-lp-accent-text"
                  : "text-lp-body"
              }`}
            >
              <span className="min-w-0 truncate">Chapter {n}</span>
              <span className="ml-auto shrink-0 text-[1.23cqw] text-lp-faint tabular-nums">
                {CHAPTER_WORDS[i]!.toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </aside>

      {/* The manuscript, on a sheet. The editor sets prose on real page sheets
          at the book's own trim rather than in a text box — see
          `pagination.ts`, which measures in lines and inserts the breaks as
          decorations so the document itself is never touched. */}
      <div className="flex min-w-0 flex-1 flex-col bg-lp-raised">
        {/* **The sheet runs off the foot of the window rather than stopping
            short of it**, and is rounded at the top only. That is what the
            editor's own page area looks like — a page continuing past the
            bottom of the view — and it is what stopped this figure being a
            small page floating in a large grey box. `overflow-hidden` is what
            lets the prose simply be cut by the edge. */}
        <div className="min-h-0 flex-1 overflow-hidden px-[7.8cqw] pt-[3.38cqw]">
          <div className="h-full rounded-t-[0.52cqw] bg-lp-paper px-[6.5cqw] pt-[3.9cqw] shadow-[0_1px_4px_rgba(15,15,16,0.08)]">
            <div className="flex items-baseline justify-between text-[1.17cqw] tracking-[0.16em] text-lp-faint uppercase">
              <span>{BOOK.title}</span>
              <span>24</span>
            </div>

            <p className="mt-[3.38cqw] text-center font-serif text-[1.49cqw] tracking-[0.24em] text-lp-faint uppercase">
              Chapter Two
            </p>
            <p className="mt-[1.17cqw] text-center font-serif text-[2.73cqw] text-lp-ink">
              {BOOK.chapter}
            </p>

            <div className="mt-[3.38cqw] space-y-[1.37cqw]">
              {[97, 100, 93, 99, 62].map((w, i) => (
                <Line key={i} w={w} />
              ))}
              <span className="block h-[1.17cqw]" />
              {[100, 95, 98, 96, 71].map((w, i) => (
                <Line key={`b${i}`} w={w} />
              ))}
              <span className="block h-[1.17cqw]" />
              {[99, 91, 100, 87, 94, 58].map((w, i) => (
                <Line key={`c${i}`} w={w} />
              ))}
              <span className="block h-[1.17cqw]" />
              {[96, 100, 92, 99, 84, 90].map((w, i) => (
                <Line key={`d${i}`} w={w} />
              ))}
            </div>
          </div>
        </div>

        {/* The foot of the editor: the count, then the save. `written of
            target words`, and "Saved" with the time of the last one beside it
            — both `chapter-editor.tsx`. It says "Saved" only once the write
            has landed, which is that line's whole point and not a thing to
            soften in a drawing of it. */}
        <div className="flex shrink-0 items-baseline gap-[1.82cqw] border-t border-lp-edge bg-lp-ground px-[3.9cqw] py-[1.69cqw]">
          <span className="text-[1.49cqw] text-lp-body tabular-nums">
            <span className="font-semibold text-lp-ink">
              {CHAPTER_WORDS[1]!.toLocaleString()}
            </span>{" "}
            of 80,000 words
          </span>
          <span className="ml-auto text-[1.43cqw] text-lp-faint tabular-nums">
            Saved · 10:24
          </span>
        </div>
      </div>
    </AppWindow>
  );
}

/* --------------------------------------------------------------------------
   The import
   -------------------------------------------------------------------------- */

/**
 * `/book/import`, drawn.
 *
 * **The two paragraphs under the drop zone are `import-book.tsx`'s own**, and
 * they are why this screen is on the page at all: the sentence naming what
 * does *not* come through is the honest half of an import promise, and a
 * marketing page that drew the drop zone and dropped that sentence would be
 * making a claim the code does not. The format list is `IMPORT_FORMATS`
 * itself, so a sixth format cannot ship without appearing here.
 */
export function ImportScreen({ chrome }: ScreenProps = {}) {
  const extensions = IMPORT_FORMATS.map((f) => f.extension).join(", ");

  return (
    <AppWindow
      chrome={chrome}
      label={`The import screen: a dashed drop zone reading “Drop your manuscript here” with a Choose a file button, above a line saying it reads ${extensions} and that styling, images, footnotes and comments do not come through.`}
      screenStyle={{ aspectRatio: `${W} / 600` }}
      screenClassName="@container overflow-hidden bg-lp-raised leading-[1.35]"
    >
      <div className="mx-auto w-[80.6cqw] px-[3.9cqw] py-[5.2cqw]">
        <h1 className="text-center font-serif text-[3.12cqw] text-lp-ink">
          Import a manuscript
        </h1>
        <p className="mt-[1.17cqw] text-center text-[1.62cqw] text-lp-body">
          Bring in a book you have already started. Nothing is added to your
          library until you have seen what came through.
        </p>

        <div className="mt-[3.9cqw] rounded-[1.3cqw] border-[0.26cqw] border-dashed border-lp-edge-strong bg-lp-ground px-[3.9cqw] py-[5.2cqw] text-center">
          <p className="text-[1.76cqw] text-lp-ink">Drop your manuscript here</p>
          <p className="mt-[0.65cqw] text-[1.43cqw] text-lp-faint">or</p>
          <span className="mt-[1.82cqw] inline-block rounded-[0.91cqw] bg-lp-accent px-[2.6cqw] py-[1.3cqw] text-[1.56cqw] font-semibold text-lp-accent-ink">
            Choose a file
          </span>
        </div>

        <div className="mt-[2.6cqw] text-[1.43cqw] leading-[1.5] text-lp-body">
          <p>
            Reads {extensions}. Text, headings, bold and italic come through;
            styling, images, footnotes and comments do not.
          </p>
          <p className="mt-[1.04cqw] text-lp-faint">
            PDF and old .doc files cannot be read here — export or save your
            manuscript as .docx first.
          </p>
        </div>
      </div>
    </AppWindow>
  );
}

/**
 * The New book menu, open — the three ways a book starts.
 *
 * **Drawn, not the screenshot it was taken from.** The source is a 388px crop
 * of the menu; at row width a bitmap that small would blur, and a figure on
 * this page is markup anyway (see the note on `W`). The words are the menu's
 * own (`shelf/bookshelf.tsx`, under "Start a book"), and all three rows are
 * live entries — Blank book, Local file and Paste text each open `/book/new`.
 *
 * The dashboard behind it is dimmed on purpose: it is there to say *where*
 * the menu is, and the menu is the subject.
 */
export function NewBookMenuScreen({ chrome }: ScreenProps = {}) {
  const rows = [
    { label: "Blank book", icon: "M12 5v14M5 12h14" },
    { label: "Local file", icon: "M12 15V4M7.5 8.5 12 4l4.5 4.5M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" },
    {
      label: "Paste text",
      icon: "M9 4h6v3H9zM9 5.5H7a2 2 0 00-2 2V19a2 2 0 002 2h10a2 2 0 002-2V7.5a2 2 0 00-2-2h-2M9 12h6M9 16h4",
    },
  ] as const;

  return (
    <AppWindow
      chrome={chrome}
      label="The New book button with its menu open under the heading Start a book, offering three ways in: Blank book, Local file and Paste text."
      screenStyle={{ aspectRatio: `${W} / 600` }}
      screenClassName="@container relative overflow-hidden bg-lp-ground leading-[1.35]"
    >
      {/* The dashboard, held back. */}
      <div aria-hidden="true" className="px-[5cqw] pt-[5cqw] opacity-45">
        <p className="text-[3.4cqw] font-extrabold tracking-tight text-lp-ink">Hello there !</p>
        <p className="mt-[0.6cqw] text-[1.8cqw] text-lp-body">
          Welcome back — 3 books, 23 chapters on the shelf.
        </p>
        <div className="mt-[3cqw] border-t border-lp-line" />
        <div className="mt-[3cqw] grid grid-cols-[2fr_1fr] gap-[2cqw]">
          <div className="h-[28cqw] rounded-[1.2cqw] bg-lp-raised" />
          <div className="h-[28cqw] rounded-[1.2cqw] bg-lp-raised" />
        </div>
      </div>

      {/* The button and its menu, at the header's right edge. */}
      <div className="absolute top-[4.6cqw] right-[5cqw] flex flex-col items-end">
        <span className="flex items-center gap-[1cqw] rounded-[1.1cqw] bg-lp-accent px-[2.4cqw] py-[1.3cqw] text-[2.2cqw] font-semibold text-lp-accent-ink shadow-sm">
          <Icon d="M12 5v14M5 12h14" />
          New book
          <Icon d="M6 9l6 6 6-6" />
        </span>
        <div className="mt-[1.2cqw] w-[36cqw] rounded-[1.6cqw] border border-lp-line bg-lp-ground px-[1.2cqw] py-[1.6cqw] shadow-[0_1.2cqw_3.6cqw_rgba(0,0,0,0.14)]">
          <p className="px-[1.6cqw] text-[1.55cqw] font-bold tracking-[0.06em] text-lp-faint uppercase">
            Start a book
          </p>
          <ul className="mt-[0.8cqw]">
            {rows.map((row, i) => (
              <li
                key={row.label}
                className={`flex items-center gap-[1.8cqw] rounded-[0.9cqw] px-[1.6cqw] py-[1.3cqw] text-[2.2cqw] text-lp-ink ${
                  i === 0 ? "bg-lp-raised" : ""
                }`}
              >
                <Icon d={row.icon} />
                {row.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppWindow>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-[2.4cqw] w-[2.4cqw] shrink-0"
    >
      <path d={d} />
    </svg>
  );
}

/**
 * The writing record — its card, and the document it opens.
 *
 * Built from the two pieces of the real screen: `WritingRecordCard` in
 * `export/export-page.tsx` (the painting, its sentence and its button) and the
 * provenance page's "The document" panel. **The record's wording is the
 * generator's own** (`writingRecord` in `lib/provenance.ts`), line for line,
 * with `RECORD_FORMAT` imported so the format number cannot drift. Only the
 * figures are demo data — the same Breathe Again the other screens draw, and
 * a placeholder author rather than anybody's name.
 */
const RECORD_LINES = [
  "WRITING RECORD — Breathe Again",
  "Author: A. Writer",
  "Generated 2026-09-24T09:34:44.010Z by OpenChapter",
  `Record format ${RECORD_FORMAT}. Author's clock: UTC+00:00.`,
  "",
  "WHAT THIS IS",
  "A record of this manuscript being written: which days work happened on,",
  "how the word count moved on each of them, and the intermediate drafts the",
  "app saved along the way. It is the same kind of evidence as a word",
  "processor's edit history.",
  "",
  "THIS BOOK",
  "Chapters:            12",
  "Words:               41,208",
  "Saved drafts:        at least 86, on at least 31 separate days",
  "Oldest kept draft:   2026-06-02T07:41:18.221Z",
  "Newest kept draft:   2026-09-24T08:12:05.904Z",
] as const;

export function WritingRecordScreen({ chrome }: ScreenProps = {}) {
  return (
    <AppWindow
      chrome={chrome}
      label="The writing record: a card with a painting of a woman reading at a desk, saying it is a dated history of how the book was written, for if anyone asks whether you used AI — evidence, not proof — beside the record itself, a plain-text document with Download and Copy buttons listing the book's chapters, words and saved drafts."
      screenStyle={{ aspectRatio: `${W} / 640` }}
      screenClassName="@container flex gap-[2.6cqw] overflow-hidden bg-lp-raised px-[3cqw] py-[3.4cqw] leading-[1.35]"
    >
      {/* The card, as the export wizard shows it. */}
      <div className="flex w-[33cqw] shrink-0 flex-col self-start overflow-hidden rounded-[1.4cqw] border border-lp-edge bg-lp-ground">
        <div
          aria-hidden="true"
          className="aspect-[16/9] w-full bg-cover bg-center"
          style={{ backgroundImage: "url('/writing-record-card.webp')" }}
        />
        <div className="px-[2.2cqw] py-[2cqw]">
          <p className="text-[1.9cqw] font-bold text-lp-ink">Writing record</p>
          <p className="mt-[0.6cqw] text-[1.7cqw] leading-[1.55] text-lp-body">
            A dated history of how this book was written, for if anyone asks
            whether you used AI. Evidence, not proof.
          </p>
          <span className="mt-[1.6cqw] block rounded-[0.9cqw] border border-lp-edge-strong py-[1cqw] text-center text-[1.7cqw] font-semibold text-lp-ink">
            Open writing record
          </span>
        </div>
      </div>

      {/* The document it opens. */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[1.4cqw] border border-lp-edge bg-lp-ground">
        <div className="flex items-center gap-[1cqw] border-b border-lp-edge px-[2.2cqw] py-[1.6cqw]">
          <p className="flex-1 text-[1.9cqw] font-bold text-lp-ink">The document</p>
          <span className="rounded-[0.9cqw] bg-lp-accent px-[1.8cqw] py-[0.9cqw] text-[1.6cqw] font-semibold text-lp-accent-ink">
            Download
          </span>
          <span className="rounded-[0.9cqw] border border-lp-edge-strong px-[1.8cqw] py-[0.9cqw] text-[1.6cqw] font-semibold text-lp-ink">
            Copy
          </span>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden px-[2.2cqw] py-[1.8cqw]">
          <pre className="font-code text-[1.32cqw] leading-[1.75] whitespace-pre text-lp-ink">
            {RECORD_LINES.join("\n")}
          </pre>
          {/* Cut by the window rather than finished: the record goes on. */}
          <span
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-[9cqw] bg-linear-to-t from-lp-ground to-transparent"
          />
        </div>
      </div>
    </AppWindow>
  );
}

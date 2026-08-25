import {
  AppWindow,
  type AppWindowChrome,
} from "@/components/landing/app-window";
import { MAX_SNAPSHOTS } from "@/lib/history";
import { IMPORT_FORMATS } from "@/lib/import";
import { LAUNCH_LIMITS } from "@/lib/launch";
import { plural } from "@/lib/plural";

/**
 * The launch MVP's five drawn screens — the shelf, the editor, the versions a
 * chapter keeps, the import and the assistant.
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
 * **Six of the nine, and the three left out are left out on purpose.** Ideas,
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
  "Assistant",
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

/* --------------------------------------------------------------------------
   The assistant
   -------------------------------------------------------------------------- */

/**
 * The three openers the panel offers, quoted from `chat-panel.tsx`'s own
 * `SUGGESTIONS` — it is `"use client"` and does not export them.
 */
const SUGGESTIONS = [
  "What isn't working in this chapter?",
  "Tighten the opening paragraph.",
  "What should happen next?",
] as const;

/**
 * The assistant panel, mid-answer.
 *
 * **Both of the panel's own disclosures are drawn**, and that is the point of
 * putting this screen on a marketing page: the chapter text is sent with the
 * question, and the conversation is kept in this browser rather than on the
 * account. `chat-panel.tsx` prints both above the first message, and a picture
 * that showed the reply without them would be selling the feature without its
 * terms.
 */
export function AssistantScreen({ chrome }: ScreenProps = {}) {
  return (
    <AppWindow
      chrome={chrome}
      label="The assistant panel beside the chapter: a note saying the chapter text is sent with your question and that the conversation stays in this browser, three suggested openers, and a reply underneath them."
      screenStyle={{ aspectRatio: `${W} / 600` }}
      screenClassName="@container flex overflow-hidden bg-lp-raised leading-[1.35]"
    >
      {/* The chapter it is answering about, still there. The panel floats over
          the manuscript rather than replacing it — `LeftPanel`'s own rule —
          which is what keeps the prose readable beside the answer. Hidden on a
          narrow card, where a two-column window would be two slivers. */}
      <div className="hidden min-w-0 flex-1 flex-col overflow-hidden px-[5.2cqw] pt-[3.9cqw] @[30rem]:flex">
        <div className="flex-1 rounded-t-[0.52cqw] bg-lp-paper px-[5.2cqw] pt-[3.9cqw] opacity-70 shadow-[0_1px_4px_rgba(15,15,16,0.06)]">
          <p className="text-center font-serif text-[2.08cqw] text-lp-ink">
            {BOOK.chapter}
          </p>
          <div className="mt-[2.6cqw] space-y-[1.37cqw]">
            {[98, 92, 100, 66].map((w, i) => (
              <Line key={i} w={w} />
            ))}
            <span className="block h-[1.17cqw]" />
            {[95, 88, 100, 91, 99, 73, 96, 100, 84].map((w, i) => (
              <Line key={`b${i}`} w={w} />
            ))}
          </div>
        </div>
      </div>

      <aside className="flex w-full shrink-0 flex-col border-l border-lp-edge bg-lp-ground @[30rem]:w-[54.6cqw]">
        <div className="flex shrink-0 items-center border-b border-lp-edge px-[2.6cqw] py-[1.82cqw]">
          <p className="text-[1.62cqw] font-semibold text-lp-ink">Assistant</p>
          <span className="ml-auto text-[1.37cqw] text-lp-faint">Close</span>
        </div>

        <div className="min-h-0 flex-1 px-[2.6cqw] py-[2.34cqw]">
          <p className="text-[1.43cqw] text-lp-body">
            Ask about “Chapter Two”. The chapter text is sent with your
            question.
          </p>
          <p className="mt-[0.78cqw] text-[1.3cqw] text-lp-faint">
            The conversation stays in this browser. It is not saved to your
            account.
          </p>

          <div className="mt-[2.08cqw] flex flex-col gap-[0.91cqw]">
            {SUGGESTIONS.map((s, i) => (
              <span
                key={s}
                className={`rounded-[0.78cqw] border px-[1.56cqw] py-[1.1cqw] text-[1.43cqw] ${
                  i === 0
                    ? "border-lp-accent/50 text-lp-accent-text"
                    : "border-lp-edge text-lp-body"
                }`}
              >
                {s}
              </span>
            ))}
          </div>

          {/* One answer, drawn as bars for the reason `Line` gives: a made-up
              reply printed as words would be this page inventing the very
              thing it is selling. */}
          <div className="mt-[2.34cqw] rounded-[1.04cqw] bg-lp-well px-[1.82cqw] py-[1.56cqw]">
            <p className="text-[1.3cqw] font-semibold tracking-[0.14em] text-lp-faint uppercase">
              Reply
            </p>
            <div className="mt-[1.3cqw] space-y-[1.23cqw]">
              {[96, 100, 82, 94, 58].map((w, i) => (
                <Line key={i} w={w} />
              ))}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-[1.3cqw] border-t border-lp-edge px-[2.6cqw] py-[1.82cqw]">
          <span className="flex-1 rounded-[0.91cqw] border border-lp-edge px-[1.56cqw] py-[1.17cqw] text-[1.43cqw] text-lp-faint">
            Ask about this chapter…
          </span>
          <span className="rounded-[0.91cqw] bg-lp-accent px-[1.82cqw] py-[1.17cqw] text-[1.43cqw] font-semibold text-lp-accent-ink">
            Ask
          </span>
        </div>
      </aside>
    </AppWindow>
  );
}

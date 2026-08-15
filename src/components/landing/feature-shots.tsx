import Image from "next/image";
import type { ReactNode } from "react";
import { AppWindow } from "@/components/landing/app-window";
import {
  FeatureRow,
  ROW_GROUNDS,
  type RowPoint,
} from "@/components/landing/feature-row";
import {
  SECTION_LEAD,
  SECTION_TITLE,
  LEAD_EM,
} from "@/components/landing/type";
import { ALL_TOOLS, TOOL_GROUPS } from "@/lib/book-tools";
import { ROLE_LABELS } from "@/lib/collab";
import { SEATS_PER_BOOK } from "@/lib/free-limits";

/**
 * Three screens of the app, photographed, each beside what it is for.
 *
 * **The shape is the one every serious SaaS feature section uses, and each
 * part of it is doing a job**:
 *
 * - **The heading is the outcome, not the feature's name.** "Every book you
 *   have, on one shelf" rather than "Library". A reader deciding whether to
 *   pay is asking what changes for them, and a feature name answers a question
 *   they have not asked yet. The screen underneath supplies the noun.
 * - **One row, one job.** Three rows, three things: keeping the books
 *   straight, the work after the last chapter, and getting a second person in.
 *   A row that argued two things would be skimmed as neither.
 * - **The sides alternate.** The eye zigzags down the page instead of running
 *   along one gutter, which is what keeps three structurally identical rows
 *   from reading as one long block.
 * - **Short lead, then disclosure.** Two lines a skimmer will actually read,
 *   with the detail folded underneath for the reader who has decided to care.
 *   This is where a page usually cheats by burying the qualifications; here
 *   the fold is the *specifics*, and the summary line is true on its own.
 * - **Real screens, not drawings.** Everywhere else this page draws its
 *   figures in markup so they cannot go stale. These are captures, which is
 *   the trade the owner has already taken elsewhere on the page — see the note
 *   below.
 *
 * **Everything countable in here is imported and counted.** The tool total and
 * the four group names and notes come from `book-tools.ts`, the two role
 * descriptions from `collab.ts`, the seat numbers from `free-limits.ts`. That
 * is the page's standing rule and it matters most in a section like this one,
 * whose whole claim is "this is what you get": a hand-typed "16 tools" would
 * go wrong the first time a tool is added, on the one screen a buyer is
 * reading to decide.
 *
 * **The pictures are whole windows, sidebar and all.** That is what makes three
 * shots read as one application rather than three loose panels, and it is why
 * the screen's column is the wider half of every row — see `FeatureRow`.
 *
 * **They can go stale, and nothing will warn.** They are `public/feature-*.webp`,
 * prepared by `scripts/feature-shots.cjs` — re-shoot and re-run it when the
 * Write, Tools or Collaborators screens change. When one of those screens
 * moves, nothing here fails and nothing warns; the picture simply starts
 * showing something that is not true any more. That is the standing cost of a
 * bitmap on this page.
 *
 * **The row itself lives in `feature-row.tsx`**, shared with the tool guide at
 * `/tools`, which uses it sixteen more times. That is also where the grounds
 * and the disclosure are documented — including why this section ships no
 * JavaScript at all.
 */

interface Row {
  /** The outcome, in the writer's terms. */
  title: string;
  lead: ReactNode;
  shot: { src: string; width: number; height: number; alt: string };
  /** The tinted ground the window floats on. Whole class names — see below. */
  ground: string;
  points: RowPoint[];
}

const ROWS: Row[] = [
  {
    title: "Every book you have, on one shelf",
    lead: (
      <>
        <strong className={LEAD_EM}>
          The covers, the counts, and where you left off
        </strong>{" "}
        — the whole library on the screen you land on, not a folder you have to
        remember the name of.
      </>
    ),
    ground: ROW_GROUNDS[0],
    shot: {
      src: "/feature-shelf.webp",
      width: 1893,
      height: 948,
      alt: "The Write area of OpenChapter: the app's sidebar down the left — Overview, Write, Prepare, Track, Tools, Collaborators — beside a grid of book cards, each with its cover, chapter and word count, when it was last opened, and Write and Read buttons. Tabs above the grid count the books, the archived ones and the trash.",
    },
    points: [
      {
        term: "Write or read, in one press",
        detail:
          "Each card opens straight into the editor, or into the reading view that sets the whole book on real pages at its trim size.",
      },
      {
        term: "Counted, never estimated",
        detail:
          "Chapters and words are summed from the manuscript every time the shelf is read rather than stored anywhere, so the number on a card cannot drift away from the book it is about.",
      },
      {
        term: "Archiving and deleting are both reversible",
        detail:
          "A deleted chapter keeps its text and its notes until you empty the trash, so putting it back loses nothing. An archived book leaves the shelf without leaving the library.",
      },
    ],
  },
  {
    /* Counted, not typed. Adding a tool changes this heading by itself. */
    title: `${ALL_TOOLS.length} tools for the part after the last chapter`,
    lead: (
      <>
        Writing it was the half you knew about.{" "}
        <strong className={LEAD_EM}>
          These are the jobs nobody tells you the order of
        </strong>{" "}
        — grouped by what they are for, and all working on a real book rather
        than a sample.
      </>
    ),
    ground: ROW_GROUNDS[1],
    shot: {
      src: "/feature-tools.webp",
      width: 1896,
      height: 946,
      alt: "The Tools area of OpenChapter: tools grouped under Get it out, Find your shelf and The writing, each a coloured mark with its name under it, beside the app's sidebar.",
    },
    /* The groups describe themselves. `book-tools.ts` is the one place a tool's
       name and group live, so this list cannot fall out of step with the app —
       and a group added there appears here without an edit. */
    points: TOOL_GROUPS.map((group) => ({
      term: group.title,
      detail: (
        <>
          {group.note}{" "}
          <span className="text-lp-faint">
            {group.tools.map((t) => t.name).join(" · ")}
          </span>
        </>
      ),
    })),
  },
  {
    title: "Put an editor on the book, not in your inbox",
    lead: (
      <>
        <strong className={LEAD_EM}>Invite by email or by link.</strong> They
        land in the manuscript itself, with exactly the access you gave them —
        no attachments going back and forth, no version with a date in its
        filename.
      </>
    ),
    ground: ROW_GROUNDS[2],
    shot: {
      src: "/feature-collab.webp",
      width: 1894,
      height: 945,
      alt: "The Collaborators area of OpenChapter: a list of books, each showing who is on it — one reading “2 people · 1 invited”, the rest “Only you” — with a Share button on every row, beside the app's sidebar.",
    },
    points: [
      {
        term: ROLE_LABELS.editor.label,
        detail: ROLE_LABELS.editor.what,
      },
      {
        term: ROLE_LABELS.viewer.label,
        detail: ROLE_LABELS.viewer.what,
      },
      {
        term: "Seats you can take back",
        detail: `${SEATS_PER_BOOK.free} people on a free book and ${SEATS_PER_BOOK.pro} on Pro, counting you. A seat is who is on the book now, so removing somebody gives it back.`,
      },
    ],
  },
];

export function FeatureShots() {
  return (
    /* `id="inside"` is the bar's "Inside the app". `scroll-mt-20` clears the
       sticky header, which would otherwise land on the section's own eyebrow —
       the same margin every other anchored section on this page carries. */
    <section
      id="inside"
      className="scroll-mt-20 border-b border-lp-line px-6 py-14 sm:py-20"
    >
      <div className="mx-auto max-w-[88rem]">
        <div className="mx-auto max-w-3xl text-center">
          <p className="flex items-center justify-center gap-2.5 font-code text-[0.6875rem] tracking-[0.18em] text-lp-faint uppercase">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-lp-faint"
            />
            Inside the app
          </p>
          <h2
            className={`oc-display mt-5 font-serif text-lp-ink ${SECTION_TITLE}`}
          >
            Everything the writing needs around it
          </h2>
          <p className={`oc-lead mx-auto mt-6 max-w-2xl ${SECTION_LEAD}`}>
            The shelf you land on, the tools around the manuscript, and the way
            a second writer gets in.
          </p>
        </div>

        <div className="mt-14 flex flex-col gap-14 sm:mt-20 sm:gap-20">
          {ROWS.map((row, i) => (
            <FeatureRow
              key={row.title}
              title={row.title}
              lead={row.lead}
              ground={row.ground}
              points={row.points}
              flip={i % 2 === 1}
              figure={
                <AppWindow label={row.shot.alt}>
                  {/* `quality={95}`, the same as the page's other captures.
                      These are screens whose entire content is small type, and
                      the one picture on this page that was squeezed hard has
                      visible ringing on its letters. `sizes` stops a phone
                      downloading the desktop-width copy of all three. */}
                  <Image
                    src={row.shot.src}
                    alt=""
                    width={row.shot.width}
                    height={row.shot.height}
                    sizes="(min-width: 1024px) 46rem, 100vw"
                    quality={95}
                    className="block h-auto w-full"
                  />
                </AppWindow>
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}

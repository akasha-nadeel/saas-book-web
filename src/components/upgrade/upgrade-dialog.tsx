"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { displayPrice, priceOf } from "@/lib/billing/plans";
import { plural } from "@/lib/plural";
import { NOT_INCLUDED, ROWS } from "@/lib/billing/plan-rows";
import {
  TIER_LIMITS,
  TIER_NAMES,
  type PaidTier,
  type PlanTier,
} from "@/lib/billing/tiers";
import { DialogClose } from "@/components/ui/dialog";

/**
 * What the free plan runs out of, said as two columns rather than one red line.
 *
 * **The refusal used to be a sentence in the footer of the new-book form**, in
 * `text-danger`, beside a button that still looked pressable — which reads as
 * an error the writer caused rather than the edge of a plan, and answers none
 * of the question it raises: *what would I get instead?* A writer who has just
 * filled in a whole form is at the one moment they are actually weighing the
 * paid plan, and the screen was spending it on a warning.
 *
 * So: what you have on the left, what Pro adds on the right, and the way
 * forward under both. The shape is the one desktop software has settled on for
 * this — two tinted columns over a gradient button — and it is the right one
 * here for a reason beyond familiarity: a comparison cannot be read as a
 * scolding.
 *
 * **Every line is read from the thing that enforces it.** `LAUNCH_LIMITS`,
 * `plans.ts` and `IMPORT_FORMATS` are the sources, so no row here can promise a
 * limit the server does not keep. Nothing in either column is a feature the
 * launch flag hides — check `HIDDEN_BOOK_TOOL_PATHS` before adding one.
 *
 * **Opened by a press that was refused, never by an effect**, which is the rule
 * `LimitDialog` follows in the older policy beside this one: a plan comparison
 * that appears on arrival is an advertisement; one that appears on the press
 * that needed it is an answer.
 */

/**
 * Why the writer is looking at this. Each reason owns its own headline.
 *
 * There was an `export` reason here, written when EPUB and PDF were Pro. It was
 * never wired to anything — nothing ever passed it — and every format is free
 * on both plans now, so the refusal it headlined cannot happen. Gone rather
 * than left as a dialog for a state the app has no way to reach.
 */
export type UpgradeReason =
  | "books"
  | "restore"
  | "assistant"
  | "assistant-write";

/**
 * Which plan each refusal is answered by.
 *
 * **The whole point of the map.** Every one of these used to sell the single
 * paid plan, because there was one. Selling the $14.98 plan to somebody who
 * wanted a sixth book reads as a paywall rather than an answer — the sixth book
 * is $5.98, and saying so is both cheaper for them and more likely to convert.
 *
 * So a shelf problem sells Draft and an assistant problem sells Writer, and the
 * dialog's right-hand column is that plan's own rows out of `ROWS`.
 */
const SELLS: Record<UpgradeReason, PaidTier> = {
  books: "draft",
  restore: "draft",
  assistant: "writer",
  "assistant-write": "writer",
};

/* **Each headline names the plan it is selling.** They said "Pro" while there
   was one paid plan; with four, a writer refused the assistant and told about
   book limits has been answered by the wrong door — and a Draft writer told
   "Free carries five books" has been told something that is not about them. */
const HEADLINES: Record<UpgradeReason, { lead: string; title: string }> = {
  books: {
    lead: "Your shelf is full.",
    title: `Free carries ${plural(TIER_LIMITS.free.books ?? 0, "book")}. ${TIER_NAMES.draft} carries as many as you write.`,
  },
  restore: {
    lead: "There is no room to put this one back.",
    title: `Free carries ${plural(TIER_LIMITS.free.books ?? 0, "book")}. ${TIER_NAMES.draft} carries as many as you write.`,
  },
  assistant: {
    lead: `The writing assistant is part of ${TIER_NAMES.writer}.`,
    title:
      "It reads the chapter you are in and answers about it, without the manuscript leaving your machine for anything else.",
  },
  "assistant-write": {
    lead: `The assistant can read your chapter. Writing into it is ${TIER_NAMES.writer}.`,
    title:
      "Offer a passage, see exactly what would change, and put it in with one press.",
  },
};

type Row = { icon: React.ReactNode; name: string; detail: string };

function Svg({ children }: { children: React.ReactNode }) {
  return (
    /* The shelf's alphabet: one 24-grid, one 1.75 stroke. A borrowed icon set
       here would be the seventh in the app and would look like it. */
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-[17px] w-[17px]"
    >
      {children}
    </svg>
  );
}

const icons = {
  books: (
    <Svg>
      <path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H10v18H5.5A1.5 1.5 0 0 1 4 19.5Z" />
      <path d="M10 3h4.5A1.5 1.5 0 0 1 16 4.5v15a1.5 1.5 0 0 1-1.5 1.5H10" />
      <path d="m17.5 5 2.6.7a1.5 1.5 0 0 1 1 1.9L17 20.5" />
    </Svg>
  ),
  infinite: (
    <Svg>
      <path d="M9.6 12c0 1.9-1.4 3.4-3.3 3.4S3 13.9 3 12s1.4-3.4 3.3-3.4S9.6 10.1 9.6 12Z" />
      <path d="M14.4 12c0-1.9 1.4-3.4 3.3-3.4S21 10.1 21 12s-1.4 3.4-3.3 3.4S14.4 13.9 14.4 12Z" />
      <path d="M9.6 12h4.8" />
    </Svg>
  ),
  importing: (
    <Svg>
      <path d="M12 3v11" />
      <path d="m8 10 4 4 4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </Svg>
  ),
  sync: (
    <Svg>
      <path d="M3.5 10a8.5 8.5 0 0 1 14.4-4.4L21 8.5" />
      <path d="M21 4v4.5h-4.5" />
      <path d="M20.5 14a8.5 8.5 0 0 1-14.4 4.4L3 15.5" />
      <path d="M3 20v-4.5h4.5" />
    </Svg>
  ),
  assistant: (
    <Svg>
      <path d="M21 12a8 8 0 0 1-8 8H4l1.7-3.4A8 8 0 1 1 21 12Z" />
      <path d="M9 11h6" />
      <path d="M9 14.5h3.5" />
    </Svg>
  ),
  word: (
    <Svg>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="m9 12 1.3 5L12 13.5 13.7 17 15 12" />
    </Svg>
  ),
  epub: (
    <Svg>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H19v13.5" />
      <path d="M4 5.5V19a1.5 1.5 0 0 0 1.5 1.5H19" />
      <path d="M6 17.5h13" />
      <path d="M8.5 8.5h6" />
    </Svg>
  ),
  pdf: (
    <Svg>
      <path d="M6 3h8l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5" />
      <path d="M8.5 17.5c3-1 5-5.5 4.2-7-.9-1.6-2.4 1.4-.6 4.3 1 1.6 2.5 2.6 3.9 2.4" />
    </Svg>
  ),
  everything: (
    <Svg>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" />
    </Svg>
  ),
};

/**
 * A row's mark, matched on its label.
 *
 * Matched rather than stored on `ROWS`, because that array is read by two
 * Server Components and must stay free of JSX. A label with no entry takes the
 * tick — every row in a column is something the plan includes, so a tick is
 * never wrong, only less specific.
 */
const ROW_ICON: Record<string, React.ReactNode> = {
  Books: icons.books,
  "Chapters and words": icons.infinite,
  "Autosave and sync": icons.sync,
  Export: icons.word,
  "Title check": icons.books,
  "Consistency check": icons.everything,
  "Writing assistant": icons.assistant,
  "Quick replies": icons.assistant,
  "Careful replies": icons.assistant,
  "Writes into your chapter": icons.assistant,
};

/**
 * One plan's column, out of the array the pricing cards read.
 *
 * **This is the whole reason for the change.** The dialog carried two
 * hand-written lists — its own words, its own order, its own claims — beside a
 * `plan-rows.ts` written expressly to stop that happening. They described two
 * plans in a four-plan product, and would have gone on disagreeing with
 * `/upgrade` on the two screens a buyer reads back to back.
 *
 * Rows the plan does not include are dropped rather than crossed: a column
 * headed "what it adds" is a list of what you get, and the cards are where the
 * full comparison lives.
 */
function rowsFor(tier: PlanTier): Row[] {
  return ROWS.filter((row) => row.values[tier] !== NOT_INCLUDED).map((row) => ({
    icon: ROW_ICON[row.label] ?? icons.everything,
    name: row.label,
    /* The value carries the detail — "Unlimited", "25 a day". Where it is
       merely "Included" the mark has already said so, so the line stays empty
       rather than printing a word that repeats a glyph. */
    detail: row.values[tier] === "Included" ? "" : row.values[tier],
  }));
}

function Column({
  label,
  rows,
  tone,
}: {
  label: string;
  rows: Row[];
  /**
   * Which end of the one gradient this column is tinted with.
   *
   * **Blue on the left, purple on the right**, which is the arrangement the
   * reference uses and reads correctly on its own: the cool column is what you
   * already have, the warm one is what is being offered. Both are `upgrade-to`
   * (indigo) and `upgrade-from` (purple) — the app's single sanctioned
   * gradient, stated identically in the light and dark blocks. So this stays
   * blue-and-purple at night, where a tint taken from `--color-accent` would
   * turn grey, and **no sixth colour joins the closed list in `docs/styling.md`
   * to get it**.
   */
  tone: "free" | "pro";
}) {
  const pro = tone === "pro";
  return (
    <div
      /* A tenth, so it reads as a tint over `panel` rather than as a second
         surface competing with the card it sits in. */
      className={`rounded-2xl p-5 ${
        pro ? "bg-upgrade-from/10" : "bg-upgrade-to/10"
      }`}
    >
      <p
        className={`font-sans text-[0.6875rem] font-bold tracking-[0.08em] uppercase ${
          pro ? "text-upgrade-from" : "text-upgrade-to"
        }`}
      >
        {label}
      </p>

      <ul className="mt-4 space-y-3.5">
        {rows.map((row) => (
          <li key={row.name} className="flex gap-2.5">
            <span
              className={`mt-px flex h-8 w-8 shrink-0 items-center justify-center
                          rounded-[0.55rem] text-accent-ink ${
                            pro ? "bg-upgrade-from" : "bg-upgrade-to"
                          }`}
            >
              {row.icon}
            </span>
            <span className="min-w-0">
              <span className="block font-sans text-sm leading-tight font-semibold text-tremor-content-strong">
                {row.name}
              </span>
              {row.detail && (
                <span className="mt-1 block font-sans text-xs leading-relaxed text-tremor-content">
                  {row.detail}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function UpgradeDialog({
  reason,
  tier = "free",
  onClose,
}: {
  reason: UpgradeReason;
  /**
   * What the writer is on now. The left column is their own plan rather than
   * always Free — a Draft writer refused the assistant is not being shown what
   * Free carries.
   *
   * Defaults to `free` so a caller that has not got a plan yet still renders
   * something true rather than nothing.
   */
  tier?: PlanTier;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const { lead, title } = HEADLINES[reason];
  const selling = SELLS[reason];
  const monthly = displayPrice(priceOf(selling, "monthly"));

  return (
    <dialog
      ref={ref}
      /* A bottom sheet under 768px, where the two columns become one and a
         centred modal would be taller than the screen. Every other question in
         the app does the same — see `ui/dialog.tsx`. */
      data-dialog-presentation="sheet"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      /* **Wide on purpose, because width buys height back.** Every row here is
         a short line beside an icon, and at a narrower measure half of them
         wrapped to two — which is what put a scrollbar on a dialog whose whole
         job is to be taken in at a glance. `oc-dialog-scroll` still caps the
         height, but on any ordinary window there is now nothing to scroll. */
      className="oc-dialog oc-dialog-whole m-auto w-[52rem] max-w-[calc(100vw-2rem)]
                 rounded-2xl bg-tremor-background p-0 text-tremor-content-strong backdrop:bg-black/70"
    >
      <div className="oc-dialog-scroll relative p-5 sm:p-7">
        <DialogClose onClose={onClose} />

        {/* **Sans, not the serif every other dialog title wears.** `ui/dialog.tsx`
            sets its questions in `font-serif`, and that is right for a question
            asked inside the book — it matches the manuscript. This one is not
            asked inside the book: it is the product talking about itself, and
            the shape it is borrowed from sets both lines in the interface face.
            A serif headline over two tinted feature columns reads as a chapter
            opener sitting on a pricing table. */}
        <p className="pr-8 text-center font-sans text-[0.9375rem] text-tremor-content">
          {lead}
        </p>
        <h2
          className="mt-1 text-center font-sans text-[1.4rem] leading-snug font-bold
                     tracking-[-0.01em] text-balance text-tremor-content-strong sm:text-[1.65rem]"
        >
          {title}
        </h2>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Column
            label={`${TIER_NAMES[tier]} — what you have`}
            rows={rowsFor(tier)}
            tone="free"
          />
          <Column
            label={`${TIER_NAMES[selling]} — what it adds`}
            rows={rowsFor(selling)}
            tone="pro"
          />
        </div>

        <Link
          href="/upgrade"
          className="oc-dialog-actions mt-6 block rounded-xl bg-linear-to-r
                     from-upgrade-to to-upgrade-from px-6 py-3.5 text-center
                     font-sans text-base font-bold text-accent-ink outline-none
                     transition-opacity hover:opacity-90
                     focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          See what {TIER_NAMES[selling]} costs
        </Link>

        {/* Not "Upgrade now" over a button that opens a price list — the press
            after this one is reading, not buying. */}
        <p className="mt-3 text-center font-sans text-xs text-tremor-content">
          {monthly} a month, or less paid yearly. Cancel any time.
        </p>
      </div>
    </dialog>
  );
}

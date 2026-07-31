"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The pre-upload check, revealed a row at a time.
 *
 * This is the one animated thing on the landing page, and it earns it: the
 * section's whole claim is that a store's rejection is a slow, silent thing and
 * ours is neither, which is hard to say in a static list and obvious the moment
 * the rows land one after another.
 *
 * **Every row is a check `storeReadiness()` actually performs.** The design this
 * was built from carried four that we do not — chapter numbering, front-matter
 * presence, embedded fonts, and the metadata language tag — and they are gone
 * rather than reworded. A fabricated check is worse here than anywhere else on
 * the page: this section exists to be believed by somebody who has been lied to
 * by their last four purchases, and it is one click from a signup that would
 * show them the real panel with those rows missing.
 *
 * The values are one worked example, not live data. There is no book to check
 * until somebody has written one, so the alternative to an illustration is an
 * empty frame.
 */

/** Three states, because the product has three. See the note on ROWS. */
type Level = "problem" | "advisory" | "pass";

/**
 * Worst first, which is the order `ReadinessPanel` sorts into — a writer wants
 * the thing that stops the upload before the thing that costs them a shelf.
 *
 * The blocking/advisory split is the honest half of a Publish button and it is
 * kept here rather than flattened to pass/fail like the source design: "a shop
 * will refuse this" and "this only costs you readers" are different sentences,
 * and a writer at midnight before a launch needs to know which one they are
 * reading. Colour alone would not carry that, so each chip says its word.
 */
const ROWS: {
  field: string;
  level: Level;
  note: string;
}[] = [
  {
    field: "Cover image",
    level: "problem",
    note: "No cover attached. A shop rejects the upload, and a reader scrolling past does not stop.",
  },
  {
    field: "ISBN",
    level: "problem",
    note: "Check digit does not add up on 978-1-7326-1094-3. One of the digits is wrong.",
  },
  {
    field: "Blurb length",
    level: "problem",
    note: "4,212 characters. The limit is 4,000. Cut 212 and it will go through.",
  },
  {
    field: "Categories",
    level: "advisory",
    note: "None chosen. These decide which shelf the book turns up on.",
  },
  {
    field: "Publisher",
    level: "advisory",
    note: "Empty. Your own name is the usual answer when self-publishing.",
  },
  {
    field: "Image descriptions",
    level: "advisory",
    note: "Two pictures have none, so a reader using a screen reader will not know they are there.",
  },
  {
    field: "Author name",
    level: "pass",
    note: "Set, with the sort form a shop files it under.",
  },
  {
    field: "Book title",
    level: "pass",
    note: "Set, and no longer the placeholder it started as.",
  },
];

const CHIP: Record<Level, { label: string; color: string; bg: string }> = {
  problem: { label: "problem", color: "#C22B2B", bg: "#FDECEC" },
  advisory: { label: "advisory", color: "#9A5B00", bg: "#FDF3E2" },
  pass: { label: "pass", color: "#1147C9", bg: "#E7EEFE" },
};

/** Milliseconds between rows. The design's own default. */
const REVEAL_MS = 240;

export function PublishingCheck() {
  const [done, setDone] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);

  // Held until the panel is actually on screen. The section sits well down the
  // page; started on mount, the whole reveal would be over before anybody
  // scrolled to it, which is the entire point of animating it.
  //
  // The observer is disconnected as soon as it fires — this plays once, and a
  // list that re-runs every time it scrolls past reads as a loading spinner
  // that never finishes.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let timer: ReturnType<typeof setInterval> | undefined;
    let jump: ReturnType<typeof setTimeout> | undefined;

    // A reader who has asked for less motion gets the finished list rather than
    // no list: the rows are the information, the reveal is only theatre. The
    // check is made here, at the moment the panel is reached, rather than in the
    // effect body — every path into `done` has to be asynchronous, or React
    // sees a state update during the effect and cascades a second render.
    const start = () => {
      const still = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (still) {
        setDone(ROWS.length);
        return;
      }
      timer = setInterval(() => {
        setDone((n) => {
          if (n + 1 >= ROWS.length && timer) clearInterval(timer);
          return n + 1;
        });
      }, REVEAL_MS);
    };

    // No IntersectionObserver at all: draw the finished list on the next tick.
    if (typeof IntersectionObserver === "undefined") {
      jump = setTimeout(start, 0);
      return () => clearTimeout(jump);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        start();
      },
      { threshold: 0.25 },
    );
    observer.observe(host);

    return () => {
      observer.disconnect();
      if (timer) clearInterval(timer);
      if (jump) clearTimeout(jump);
    };
  }, []);

  const running = done > 0 && done < ROWS.length;
  const problems = ROWS.slice(0, done).filter(
    (r) => r.level === "problem",
  ).length;

  const summary = running
    ? `checking ${done}/${ROWS.length}`
    : done === 0
      ? "not run yet"
      : `${problems} to fix · ${ROWS.length - problems} clear`;

  return (
    <div
      ref={hostRef}
      className="overflow-hidden rounded-[22px] bg-white"
      // An illustration of a panel, not the panel. Nothing in here is a
      // control, and a screen reader that walked the half-revealed rows would
      // read a list that changes under it — so it is described once, here, and
      // its innards are hidden.
      role="img"
      aria-label="The pre-upload check, listing eight things a store looks at: three problems that would stop the upload, three worth fixing, and two already correct."
    >
      <div aria-hidden="true">
        <div className="flex flex-wrap items-center justify-between gap-6 border-b border-[#EDEFF4] px-[30px] py-6">
          <div>
            <p className="font-code text-[15px] font-medium text-[#0E1116]">
              the-lighthouse-keeper.epub
            </p>
            <p className="mt-1.5 font-brand text-[13.5px] text-[#5A6170]">
              Pre-upload check · {ROWS.length} items
            </p>
          </div>
          {/*
            The design put a "Run checks" button here. There is no such button
            in the app — `StoreReadiness` recomputes on the export screen
            whenever the book or its cover changes — so a control shaped like
            one would be a promise the product does not keep, and the writer
            would go looking for it. The reading stays; the button does not.
          */}
          <span className="font-code text-[13px] font-medium text-[#5A6170]">
            {summary}
          </span>
        </div>

        <div className="h-[3px] bg-[#EDEFF4]">
          <div
            className="h-[3px] bg-[#1B63F5] transition-[width] duration-200 ease-linear"
            style={{ width: `${(done / ROWS.length) * 100}%` }}
          />
        </div>

        <div className="px-[30px] pt-2 pb-6">
          {ROWS.map(({ field, level, note }, i) => {
            const shown = i < done;
            const chip = CHIP[level];
            return (
              <div
                key={field}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-1
                           border-b border-[#F4F6FA] py-4 last:border-b-0
                           sm:grid-cols-[190px_104px_minmax(0,1fr)] sm:gap-y-0"
              >
                <span className="font-brand text-[15px] font-semibold text-[#0E1116]">
                  {field}
                </span>
                <span
                  className="justify-self-start rounded-full px-3 py-1.5 font-brand
                             text-[11px] font-semibold tracking-[0.1em] uppercase
                             transition-colors duration-200"
                  style={{
                    color: shown ? chip.color : "#8A919E",
                    background: shown ? chip.bg : "#F3F5F9",
                  }}
                >
                  {shown ? chip.label : "—"}
                </span>
                <span
                  className="col-span-2 font-brand text-[15px] leading-[1.55] text-[#5A6170]
                             transition-opacity duration-200 sm:col-span-1"
                  style={{ opacity: shown ? 1 : 0 }}
                >
                  {note}
                </span>
              </div>
            );
          })}
        </div>

        <div className="border-t border-[#EDEFF4] bg-[#F3F5F9] px-[30px] py-5">
          {/* The design said the check "runs on your book inside your account".
              Ours does not even do that — `checkStoreReadiness` runs in the
              browser, on the copy already in front of you. That is a stronger
              claim and a true one, so it is the one that is made. */}
          <p className="font-brand text-sm leading-[1.6] text-[#5A6170]">
            The check runs in your browser, on the book already on your machine.
            We never ask for a store password, and uploading stays your job.
          </p>
        </div>
      </div>
    </div>
  );
}

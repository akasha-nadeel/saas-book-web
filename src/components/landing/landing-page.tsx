import Link from "next/link";
import type { ReactNode } from "react";
import { signInWithGoogle } from "@/app/auth/actions";
import { GoogleButton } from "@/components/auth/auth-shell";
import { displayPrice, perMonthOf } from "@/lib/billing/plans";
import { SELF_TICKING, YOURS_TO_TICK } from "@/lib/roadmap";

/**
 * The landing page, rebuilt around what the product is becoming rather than
 * around what it currently does.
 *
 * **The styling here is deliberately ordinary** — a centred hero, cards in a
 * grid, alternating section grounds. It is scaffolding, not a design: the thing
 * under review is the structure and the words, and the previous version was a
 * finished visual design of the *old* positioning, which meant judging new copy
 * through old furniture.
 *
 * The frame is the book's life rather than a feature list: **Write → Prepare →
 * Track.** A writer arriving here should find their own problem named before
 * they find a feature.
 *
 * The rule that survives every rewrite: **nothing here claims something the
 * code cannot do, and nothing stays marked unbuilt once it is built.** All
 * three phases ship today; what is genuinely still to come is in one section
 * under a Not-built-yet badge, and it is a short list.
 *
 * That second half of the rule is easy to forget, because it fails in the safe
 * direction. Track carried "none of it exists today, do not sign up for it"
 * for a while after it shipped — an understatement rather than an overclaim,
 * and still a page saying something untrue about the product. This list has to
 * be walked whenever a feature lands.
 *
 * The reader this page is written for has already bought a course that taught
 * nothing and a cover that turned out to be AI; the only asset it has that a
 * funded competitor cannot copy is being checkable.
 */

const FREE_LINE =
  "Writing, your shelf, syncing and all four export formats are free, and stay free.";

const WRITE = [
  [
    "Where you left off",
    "Open the book and the last paragraph you wrote is there, with the note you left yourself. For the seventeen free minutes, not the two clear hours.",
  ],
  [
    "An idea parking lot",
    "Catch the shiny new idea without leaving the chapter you are in. Leaving is the interruption.",
  ],
  [
    "The shape most novels share",
    "Your word count placed on it, in plain words, for when the middle has run out of road. A convention, not a rule.",
  ],
  [
    "Versions, and how many sittings",
    "A version kept every ten minutes or so, and a count of how often you have been round this chapter. A bad afternoon is not permanent.",
  ],
  [
    "A distraction-light editor",
    "Chapters, focus mode, typewriter scrolling, and free dictation for the days when typing is the thing draining you.",
  ],
  [
    "It saves as you type, and works offline",
    "Your manuscript lives in your browser and syncs when you are signed in. It does not need us to be up.",
  ],
  [
    "Proof of the work, if you are ever accused",
    "A day-by-day record of the book accumulating, the drafts saved along the way, and a fingerprint of the text — in a document you can send. Evidence, not proof, and it says which it is in its own words.",
  ],
  [
    "An assistant that cannot touch your book",
    "No write access at all. It reads one chapter, only when you ask. Every word stays yours.",
  ],
] as const;

const PREPARE = [
  [
    "Every step, in the order it happens",
    `So you do not learn that advance copies had to go out weeks ago on the day after you publish. ${SELF_TICKING} of the ${SELF_TICKING + YOURS_TO_TICK} tick themselves from what is in your book; the rest are yours.`,
  ],
  [
    "A pre-upload check",
    "It names what a store would refuse — missing cover, malformed ISBN, blurb over the limit — and says which problems would actually stop the upload as against the ones that only cost you readers. It never blocks your export.",
  ],
  [
    "The books yours sits beside",
    "Real comparable titles, found by reading your blurb rather than matching one word — and from them, what your genre is filed under, how long those books run, and what their covers look like at the size a reader meets them.",
  ],
  [
    "Your blurb, counted against real ones",
    "The shops' limit, five actual blurbs from books like yours, and the length they run to. We do not write it.",
  ],
  [
    "Is the title taken, and will the cover be refused",
    "Whether somebody else's book turns up first when a reader searches for yours; and whether your artwork is the right size, shape and weight to upload.",
  ],
  [
    "Paperback numbers, worked out",
    "Spine width, inside margin and the full cover wrap, from your page count and trim size.",
  ],
  [
    "Four files out",
    "EPUB, DOCX, PDF at your trim size, and Markdown. No watermark, no export cap, and the EPUB is checked against EPUBCheck 5.3 with no errors and no warnings.",
  ],
] as const;

const TRACK = [
  [
    "Cost against earnings, per book",
    "Cover, editing, ads and proof copies on one side. Royalties on the other. Nobody keeps this, which is why the total is always a shock.",
  ],
  [
    "Import your sales report",
    "Amazon has no public API, so nothing is fetched — but it will let you download your sales. Hand the file over and you say which column is which, so it works whatever the shop renames next year.",
  ],
  [
    "How many more copies get you level",
    "Worked from what a copy has actually earned you, never from a royalty rate we invented. If your rows do not say, neither do we.",
  ],
  [
    "Who has an advance copy, and who is late",
    "One list instead of six sites and a spreadsheet, with the dates attached — and a send-by date worked back from your publication date, so you learn advance copies matter before the book is out rather than after.",
  ],
  [
    "What it usually costs, and what to check first",
    "What a book typically earns, what covers and editing and promotion run to, and what to establish before the money moves. Every figure says where it came from.",
  ],
] as const;

const LATER = [
  [
    "A story bible",
    "Characters, places and timeline, across a series rather than one book — filled in by the assistant reading your chapters, which it still cannot write into.",
  ],
  [
    "Comps ranked, not just found",
    "A model reading your opening chapter to say which five of twenty are genuinely like your book, rather than which forty matched a word.",
  ],
  [
    "The book-three curve",
    "Writers report no traction until their third book. Whether you are on that curve should not be a feeling — but it needs more than one book of history to say anything.",
  ],
] as const;

const REFUSALS = [
  [
    "We will not design your cover or edit your prose with AI",
    "AI here reads and reports — summaries, story bibles, consistency flags. It never writes into your book. The cheap way to build covers and editing is generative, and doing it would make liars of us. If those ever exist here, they come from real designers and real editors.",
  ],
  ["We will not sell you a course", "You have met those people already."],
  [
    "We will not promise your book will sell",
    "Anyone who does is selling you something. We can tell you what a shop will refuse. We cannot tell you what a reader will love.",
  ],
  [
    "We will not upload to Amazon for you",
    "There is no public API. Anyone automating that dashboard is risking your publishing account, not theirs.",
  ],
] as const;

const FAQ = [
  [
    "What doesn’t it do?",
    "A fair amount. It does not design covers, edit your prose, write your blurb, market your book, buy ads, upload to any store, or introduce you to other writers. It will tell you what a cover needs to be and show you the shelf yours has to sit on; it will not draw one. It will count what is in your prose; it will not change a word. Everything else on your list is still yours.",
  ],
  [
    "Who owns what I write?",
    "You do. We claim no rights over your manuscript and take no cut of anything you sell.",
  ],
  [
    "Do you train AI on my manuscript?",
    "No. The assistant receives only the single chapter you hand it, at the moment you ask, and it is not used to train a model afterwards.",
  ],
  [
    "Can I get my work out if I stop using it?",
    "Yes, without asking us. EPUB, DOCX, PDF and Markdown, whenever you want. Markdown is plain text — it opens in any editor, including one written thirty years ago.",
  ],
  [
    "I’ve paid for tools that did none of this. Why is this different?",
    "You can test the whole claim in an afternoon without paying: write a page, import a draft, run the check, export all four files, open them in Word and an e-reader. If any of it does not work, you have lost an afternoon rather than a thousand pounds.",
  ],
] as const;

export function LandingPage() {
  const monthly = displayPrice(perMonthOf("monthly"));

  return (
    // `<body>` is overflow-hidden for the editor shell, so this page owns its
    // own scrolling. `min-h-dvh` would put the footer out of reach.
    <div
      className="h-dvh overflow-y-auto bg-white text-slate-600 [scroll-behavior:smooth]"
    >
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
          <Link href="/" className="text-lg font-bold text-slate-900">
            Open<span className="text-blue-600">Chapter</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium">
            <a href="#write" className="hidden sm:inline hover:text-blue-600">
              What it does
            </a>
            <a href="#next" className="hidden sm:inline hover:text-blue-600">
              What&rsquo;s next
            </a>
            <a href="#price" className="hidden sm:inline hover:text-blue-600">
              Price
            </a>
            <Link href="/signin" className="hover:text-blue-600">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
            >
              Start free
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* ---- Hero ---------------------------------------------------- */}
        <section className="bg-slate-50 px-6 py-20 text-center">
          <div className="mx-auto max-w-3xl">
            <span className="inline-block rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-sm font-semibold text-blue-700">
              Write · Prepare · Track
            </span>
            {/* The headline names the pain the product can answer *today*.
                The earlier draft led on "no idea what went wrong", which is
                the Track phase — the one thing here that is not built. A hero
                promising the unbuilt part is the overclaim this page cannot
                afford, and it is also the weaker line: rejection is a sharper
                fear than analytics. */}
            <h1 className="mt-6 text-4xl leading-tight font-extrabold text-slate-900 sm:text-5xl">
              Find out what&rsquo;s wrong with your book{" "}
              <span className="text-blue-600">before a shop does.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed">
              A missing cover. An ISBN with a bad digit. A blurb eleven
              characters over the limit. You find out weeks later, in a rejection
              email that does not say which.
            </p>
            <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed">
              OpenChapter writes the book with you and checks it before you
              upload — in plain words, naming what would actually stop the
              upload. One app instead of seven. Free, and it works offline.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="rounded-lg bg-blue-600 px-7 py-3.5 font-semibold text-white hover:bg-blue-700"
              >
                Start writing free
              </Link>
              {/* `GoogleButton` renders its own form; `next` is where the
                  writer lands once Supabase is done, which for a new signup is
                  the shelf at `/`. */}
              <GoogleButton
                action={signInWithGoogle}
                next="/"
                label="Sign up with Google"
                className="rounded-lg border border-slate-300 bg-white px-7 py-3.5 font-semibold text-slate-900 hover:bg-slate-50"
              />
            </div>
            <p className="mt-5 text-sm text-slate-500">{FREE_LINE}</p>
          </div>
        </section>

        {/* ---- The problem --------------------------------------------- */}
        <Band>
          <Head eyebrow="The problem" title="Where the money and the time go" />
          <div className="grid gap-5 md:grid-cols-3">
            <Stat n="7 tools" s="A word processor, a converter site, an EPUB formatter, a validator, cloud storage, a spreadsheet. Most bill monthly." />
            <Stat n="£1,000+" s="Spent on covers and ads before anyone finds out whether the book had a chance." />
            {/* Attributed rather than asserted. The figure is widely repeated
                and rarely sourced — including by people selling courses — and
                a page whose whole pitch is being checkable cannot state a
                number it cannot check. The in-app version carries the same
                caveat under every figure. */}
            <Stat n="97%" s="The much-repeated share of books said to sell under 5,000 copies. Nobody publishes an audited figure — but no writer we found was told any number at all before they spent." />
          </div>
          <p className="mt-8 text-center text-lg">
            You learn ARC readers matter <em>after</em> you publish. You find out
            the blurb is over the limit when the upload is refused. You discover
            the cover was the problem a year later.
          </p>
        </Band>

        {/* ---- Phases -------------------------------------------------- */}
        <Band id="write" tint>
          <Head
            eyebrow="Phase one"
            badge="Working today"
            title="Write — get the book finished"
            lead="The pain here is not inspiration. It is seventeen free minutes a day, and losing your place between them."
          />
          <Cards items={WRITE} />
        </Band>

        <Band>
          <Head
            eyebrow="Phase two"
            badge="Working today"
            title="Prepare — get it out without paying to find out"
            lead="A shop rejecting your upload is a slow, silent thing. This is the part that tells you first."
          />
          <Cards items={PREPARE} />
          <p className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm">
            <strong className="text-slate-900">About the PDF.</strong> It is a
            clean interior file at your trim size with fonts embedded. It is not
            a pre-press file — no bleed, no crop marks, no CMYK — because it
            comes from your browser&rsquo;s print engine. If your printer asks
            for bleed, that step still needs another tool.
          </p>
        </Band>

        {/* Was the unbuilt phase, with a line telling readers not to sign up
            for it. It is built now, and leaving that warning up would have
            been a different kind of lie from the usual one. */}
        <Band tint>
          <Head
            eyebrow="Phase three"
            badge="Working today"
            title="Track — find out what actually happened"
            lead="The part nobody does for indie authors: what the book cost against what it earned, and how far off level it still is."
          />
          <Cards items={TRACK} />
        </Band>

        <Band id="next">
          <Head
            eyebrow="Still to come"
            badge="Not built yet"
            warn
            title="What comes after that"
            lead="Listed so you know where this is going, and so you can hold us to the difference between a plan and a product. No dates — a date is a promise with a number on it."
          />
          <Cards items={LATER} planned />
        </Band>

        {/* ---- Refusals ------------------------------------------------ */}
        <Band tint>
          <Head
            eyebrow="Straight answer"
            title="What we will not do"
            lead="Every item below is something writers ask for constantly. We are saying no in public so you can plan around it."
          />
          <ul className="mx-auto flex max-w-3xl flex-col gap-4">
            {REFUSALS.map(([name, note]) => (
              <li
                key={name}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <p className="font-bold text-slate-900">
                  <span className="mr-2 text-red-500">✕</span>
                  {name}
                </p>
                <p className="mt-1.5">{note}</p>
              </li>
            ))}
          </ul>
        </Band>

        {/* ---- Price --------------------------------------------------- */}
        <Band id="price">
          <Head eyebrow="Price" title="Free, and what isn’t" />
          <div className="mx-auto grid max-w-3xl gap-5 md:grid-cols-2">
            <div className="rounded-2xl border-2 border-blue-600 bg-white p-7">
              <p className="text-sm font-bold tracking-widest text-blue-600 uppercase">
                Free
              </p>
              <p className="mt-3 text-3xl font-extrabold text-slate-900">£0</p>
              <p className="mt-3">{FREE_LINE}</p>
              <p className="mt-2">
                No watermark, no export cap, nothing to unlock before you can
                publish a finished book.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-7">
              <p className="text-sm font-bold tracking-widest text-slate-500 uppercase">
                Pro
              </p>
              <p className="mt-3 text-3xl font-extrabold text-slate-900">
                {monthly}
                <span className="text-base font-medium text-slate-500">
                  {" "}
                  / month
                </span>
              </p>
              <p className="mt-3">
                The assistant, audiobook narration and the bookmarks panel. You
                never need any of them to write a book and publish it.
              </p>
            </div>
          </div>
          <div className="mt-9 text-center">
            <Link
              href="/signup"
              className="inline-block rounded-lg bg-blue-600 px-7 py-3.5 font-semibold text-white hover:bg-blue-700"
            >
              Start writing free
            </Link>
          </div>
        </Band>

        {/* ---- FAQ ----------------------------------------------------- */}
        <Band tint>
          <Head eyebrow="Questions" title="Reasonable suspicion, answered" />
          <div className="mx-auto flex max-w-3xl flex-col gap-3">
            {FAQ.map(([q, a], i) => (
              <details
                key={q}
                open={i === 0}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <summary className="cursor-pointer font-bold text-slate-900">
                  {q}
                </summary>
                <p className="mt-3">{a}</p>
              </details>
            ))}
          </div>
        </Band>
      </main>

      <footer className="border-t border-slate-200 px-6 py-10 text-center text-sm text-slate-500">
        <p className="font-bold text-slate-900">
          Open<span className="text-blue-600">Chapter</span>
        </p>
        <p className="mt-2">Your manuscript stays on your machine.</p>
      </footer>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Scaffolding. Plain on purpose — see the note at the top of the file.
   -------------------------------------------------------------------------- */

function Band({
  id,
  tint,
  children,
}: {
  id?: string;
  tint?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`px-6 py-20 ${tint ? "bg-slate-50" : "bg-white"}`}
    >
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

function Head({
  eyebrow,
  badge,
  warn,
  title,
  lead,
}: {
  eyebrow: string;
  /** "Working today" or "Not built yet". The whole page turns on the difference. */
  badge?: string;
  warn?: boolean;
  title: string;
  lead?: string;
}) {
  return (
    <div className="mx-auto mb-10 max-w-3xl text-center">
      <div className="flex items-center justify-center gap-3">
        <span className="text-sm font-bold tracking-widest text-blue-600 uppercase">
          {eyebrow}
        </span>
        {badge && (
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${
              warn
                ? "bg-amber-100 text-amber-800"
                : "bg-green-100 text-green-800"
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      <h2 className="mt-4 text-3xl leading-snug font-extrabold text-slate-900">
        {title}
      </h2>
      {lead && <p className="mt-4 text-lg leading-relaxed">{lead}</p>}
    </div>
  );
}

function Cards({
  items,
  planned,
}: {
  items: readonly (readonly [string, string])[];
  planned?: boolean;
}) {
  return (
    <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {items.map(([name, note]) => (
        <li
          key={name}
          className={`rounded-xl border p-6 ${
            planned
              ? "border-dashed border-slate-300 bg-white"
              : "border-slate-200 bg-white shadow-sm"
          }`}
        >
          {planned && (
            <span className="mb-3 inline-block rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
              Planned
            </span>
          )}
          <p className="font-bold text-slate-900">{name}</p>
          <p className="mt-2 text-[15px] leading-relaxed">{note}</p>
        </li>
      ))}
    </ul>
  );
}

function Stat({ n, s }: { n: string; s: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
      <p className="text-3xl font-extrabold text-slate-900">{n}</p>
      <p className="mt-2 text-[15px] leading-relaxed">{s}</p>
    </div>
  );
}

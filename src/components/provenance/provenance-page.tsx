"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { Spinner } from "@/components/ui/spinner";
import { parseHistory } from "@/lib/history";
import {
  findBook,
  getBody,
  getHistoryRaw,
  orderedChapters,
} from "@/lib/library-store";
import { nounFor } from "@/lib/plural";
import { download } from "@/lib/export";
import { toBlocks } from "@/lib/export/blocks";
import {
  bookTimeline,
  canonicalText,
  chapterCanonicalText,
  formatRecord,
  importDays,
  toHex,
  utcOffset,
  writingRecord,
  type RecordChapter,
} from "@/lib/provenance";
import { useActivity, useHydrated, useShelf } from "@/lib/use-library";

/**
 * The writing record — the answer to "prove you wrote this".
 *
 * The newest pain in the research and the one with no good answer anywhere:
 * writers accused of using AI, by readers, by reviewers, by a contest. The
 * accusation cannot be disproved on the text, and the detectors sold as a
 * remedy misfire on plain prose and on writers whose first language is not
 * English — so the people worst hit are the ones who write simply.
 *
 * What people actually reach for is provenance: dated drafts, an edit history,
 * a record of the thing accumulating. The app has been keeping that all along
 * for its own reasons. This page gathers it into a document that can be
 * forwarded, and is careful about what it says that document is worth.
 *
 * **Every limit is on the screen and in the file.** The screen is not what gets
 * forwarded, and somebody reading this in an email has to be told what it does
 * and does not establish — otherwise this page becomes one more thing sold to
 * frightened people that does not do what they were told it does.
 *
 * **The page is three movements and every one of them is boxed**: what the log
 * holds, the document you make from it, and what that document is worth. It
 * was a column of loose text with one unframed button in the middle of it —
 * the heading, the sentence and the primary action of the whole screen all
 * sitting directly on the desk, at the same visual weight as the paragraph
 * above them. On a screen made of cards, the one thing not in a card reads as
 * something that failed to load rather than as emphasis.
 */
export function ProvenancePage({ bookId }: { bookId: string }) {
  // Read here with the other hooks rather than beside the early return
  // below: hooks cannot sit after a conditional, and this screen has
  // several of its own already.
  const hydrated = useHydrated();
  const shelf = useShelf();
  const activity = useActivity();
  const book = findBook(shelf, bookId);

  const [built, setBuilt] = useState<{
    text: string;
    fingerprint: string | null;
  } | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const record = useMemo(() => writingRecord(activity), [activity]);
  const imports = useMemo(() => importDays(record), [record]);

  /**
   * Gather the drafts and fingerprint the text.
   *
   * On demand rather than during render: this reads every chapter body and
   * every chapter's history out of storage, which for a long book is real work
   * to do on a screen most writers open once.
   */
  async function build() {
    if (!book) return;
    setWorking(true);
    setError(null);
    try {
      const metas = orderedChapters(book);

      /*
       * Each chapter is walked into the shared block IR *once* and used
       * twice — for its own hash and as part of the manuscript's. Hashing the
       * chapter texts and then joining them is not the same as hashing the
       * join, so the whole-manuscript number is taken over the joined text
       * rather than over the chapter digests.
       *
       * A body that will not parse is recorded as unreadable and left out
       * rather than silently becoming an empty chapter, which is what the old
       * `?? ""` did: a failed read produced a valid-looking fingerprint for a
       * manuscript with a hole in it.
       */
      const parsed = metas.map((meta) => {
        const raw = getBody(meta.id);
        try {
          if (raw === null) throw new Error("no body");
          return { meta, blocks: toBlocks(JSON.parse(raw)), ok: true as const };
        } catch {
          return { meta, blocks: [], ok: false as const };
        }
      });

      const readable = parsed.filter((p) => p.ok);

      const chapters: RecordChapter[] = await Promise.all(
        parsed.map(async ({ meta, blocks, ok }) => ({
          title: meta.title,
          words: meta.words,
          fingerprint: ok
            ? await sha256(chapterCanonicalText({ title: meta.title, blocks }))
            : null,
          ...(ok ? {} : { unreadable: true as const }),
          versions: parseHistory(getHistoryRaw(meta.id))
            .map((s) => ({ at: s.at, words: s.words }))
            // parseHistory hands back newest first, for the panel that shows
            // "restore the last one". Here the chapter has to read as a thing
            // that grew, so it is turned round.
            .reverse(),
        })),
      );

      const fingerprint = await sha256(
        canonicalText(
          readable.map(({ meta, blocks }) => ({ title: meta.title, blocks })),
        ),
      );

      setBuilt({
        fingerprint,
        text: formatRecord({
          title: book.title,
          ...(book.author ? { author: book.author } : {}),
          record,
          timeline: bookTimeline(chapters),
          chapters,
          fingerprint,
          imports,
          at: Date.now(),
          zone: utcOffset(),
        }),
      });
    } catch {
      setError("Could not read the manuscript to build the record.");
    } finally {
      setWorking(false);
    }
  }

  if (!hydrated) return <LoadingScreen />;

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
    <div className="h-[var(--oc-layout-height)] overflow-y-auto bg-surface">
      {/* Two sentences, which is what a deck running the header's full width
          has to be. Every claim the long version made is still here — that no
          test settles the accusation, that the detectors misfire on exactly
          the writers least able to argue back, and that what is offered
          instead is a trail rather than a proof. */}
      <ToolHeader book={book} tool="Writing record">
        No test settles an accusation of AI writing, and the detectors sold for
        the job misfire on plain prose and on writers whose first language is
        not English. What people reach for instead is the trail the work left
        while it was being done — this is yours, in a document you can send.
      </ToolHeader>

      <div className="mx-auto max-w-7xl px-(--oc-page-gutter) pt-4 pb-[calc(4rem+var(--oc-safe-bottom))] sm:pt-6">
        {/* A failure wears the failure colour. It was a plain panel, which on
            a page of plain panels is indistinguishable from a result. */}
        {error && (
          <p
            role="alert"
            className="mb-6 rounded-xl border border-stop-line bg-stop-bg px-5 py-4 text-sm text-stop-fg"
          >
            {error}
          </p>
        )}

        {/* ---- What the log says -----------------------------------------
            One card rather than three. The three figures are one reading of
            one log — how many days, over what span, to what total — and three
            separate boxes made them three unrelated facts, with the dates
            they cover floating underneath as a fourth. Hairlines group what
            borders had split up, and the date range becomes the caption of
            the numbers it belongs to.

            The saved drafts are deliberately not counted here. Doing so means
            reading every chapter's history out of storage on every render,
            and the count would still be stale — history is not one of the
            stores this screen subscribes to. It is gathered once, below, when
            the document is built. */}
        <section className="overflow-hidden rounded-xl border border-line bg-panel">
          {record.firstDay === null ? (
            <EmptyLog bookId={book.id} />
          ) : (
            <>
              <div className="grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <Stat
                  value={String(record.daysWritten)}
                  label={`${nounFor(record.daysWritten, "day")} written`}
                />
                <Stat
                  value={String(record.spanDays)}
                  label={`${nounFor(record.spanDays, "day")} spanned`}
                />
                <Stat
                  value={record.netWords.toLocaleString()}
                  label={`net ${nounFor(record.netWords, "word")}`}
                />
              </div>
              <p className="border-t border-line px-5 py-3 text-xs text-muted">
                Recorded from {record.firstDay} to {record.lastDay}.
              </p>
            </>
          )}
        </section>

        {/* ---- Days that are imports ------------------------------------
            Shown rather than hidden, and described rather than judged. Being
            surprised by your own record in somebody else's hands is exactly
            the failure this page exists to prevent.

            It takes the `note` tokens rather than the panel's own grey: this
            is the one thing on the page a writer is meant to look at before
            anybody else does, and drawn as another plain card it read as one
            more paragraph in the stack. Amber for "worth knowing", not red —
            nothing here is wrong. */}
        {imports.length > 0 && (
          <section className="mt-6 rounded-xl border border-note-line bg-note-bg px-5 py-4">
            <p className="text-sm font-bold text-note-fg">
              {imports.length} {imports.length === 1 ? "day is" : "days are"}{" "}
              larger than anyone types
            </p>
            <p className="mt-2 max-w-prose text-sm leading-relaxed text-note-fg">
              {imports.map((d) => d.day).join(", ")} — that is a file arriving,
              not a day of drafting. If you imported a manuscript you wrote
              elsewhere, this is what it looks like, and it is evidence of
              nothing either way. Better you see it here than have it pointed
              out to you.
            </p>
          </section>
        )}

        {/* ---- Build it --------------------------------------------------
            The button sits in a box with the three things it produces listed
            beside it. Loose on the desk it was the most important control on
            the screen drawn as the least important thing in the column; and
            a writer pressing it could not tell beforehand what they were
            about to be handed, which on a page about being careful with
            claims is the wrong way round. The list is the deck's own sentence
            broken into its parts — nothing new is promised. */}
        <h2 className="mt-10 text-xl font-extrabold text-fg">
          Make the document
        </h2>
        <p className="mt-2 max-w-prose text-muted">
          Plain text, so it survives being pasted into an email or a form.
        </p>

        <section className="mt-4 rounded-xl border border-line bg-panel p-5">
          <ul className="flex flex-col gap-2.5">
            <Holds>Day by day</Holds>
            <Holds>Every draft the app saved</Holds>
            <Holds>A fingerprint of the text as it stands</Holds>
          </ul>

          <button
            type="button"
            onClick={() => void build()}
            disabled={working}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5
                       font-semibold text-accent-ink hover:opacity-90 disabled:opacity-50"
          >
            {working && <Spinner className="h-4 w-4" />}
            {working
              ? "Reading the manuscript…"
              : built
                ? "Build it again"
                : "Build the record"}
          </button>
        </section>

        {built && (
          <div className="mt-6 flex flex-col gap-6">
            {/* **The fingerprint is a credential, so it is drawn like one** —
                mono type in an inset field with the copy control on its own
                header row, the shape every dashboard uses for a key you are
                meant to take somewhere else. It was a bare line of monospace
                in a paragraph, which is a number to read rather than a thing
                to carry. */}
            {built.fingerprint ? (
              <section className="rounded-xl border border-line bg-panel p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-fg">Fingerprint</h3>
                  <CopyButton text={built.fingerprint} />
                </div>
                <p
                  className="mt-3 rounded-lg border border-line bg-surface px-3.5 py-2.5
                             font-mono text-xs break-all text-fg"
                >
                  {built.fingerprint}
                </p>
                {/* The instruction is the whole value. A hash nobody
                    timestamped establishes nothing, and we must not be the
                    ones holding the timestamp — a notary that is also the
                    accused party is not a notary. */}
                <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
                  Anyone with the same text gets the same number. On its own it
                  dates nothing. Put it somewhere outside your own control now —
                  email it to yourself, post it, commit it — so there is a
                  timestamp neither you nor we can move. We deliberately do not
                  store it for you.
                </p>
              </section>
            ) : (
              <p className="rounded-xl border border-line bg-panel px-5 py-4 text-sm text-muted">
                No fingerprint: this browser will not do cryptography on an
                insecure connection. Open the app over https, or on localhost,
                and build it again. The rest of the record is here regardless.
              </p>
            )}

            {/* The two actions sit on the document's own header rather than
                floating between two cards, which is where they were — a row
                of buttons belonging to neither the thing above nor the thing
                below. */}
            <section className="overflow-hidden rounded-xl border border-line bg-panel">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
                <h3 className="text-sm font-bold text-fg">The document</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      download(
                        new Blob([built.text], {
                          type: "text/plain;charset=utf-8",
                        }),
                        `${book.title || "manuscript"} — writing record.txt`,
                      )
                    }
                    className="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-accent-ink hover:opacity-90"
                  >
                    Download
                  </button>
                  <CopyButton text={built.text} />
                </div>
              </div>
              <pre
                className="scroll-slim max-h-96 overflow-auto px-5 py-4 font-mono text-xs
                           leading-relaxed whitespace-pre-wrap text-fg"
              >
                {built.text}
              </pre>
            </section>
          </div>
        )}

        {/* ---- The limits, on the screen as well as in the file ----------
            One card of four rows, not four cards. Four bordered boxes of
            equal weight is how this app draws a list of *features*, and
            these are the opposite — a single statement of what the document
            does not establish, made in four parts. Hairlines say "still the
            same thought"; separate boxes said "four more things you get". */}
        <h2 className="mt-10 text-xl font-extrabold text-fg">
          What this is not
        </h2>
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
          <Limit title="It is evidence, not proof">
            This is the same kind of thing as a word processor&rsquo;s edit
            history: it shows a book accumulating over time. It does not
            establish authorship, and nothing can.
          </Limit>
          <Limit title="It is not tamper-evident">
            The record is kept in your browser. Anyone at your machine could
            edit it. We are not going to pretend otherwise to make the document
            feel stronger than it is.
          </Limit>
          <Limit title="It starts when you started here">
            Work done before OpenChapter is not in it, and a manuscript imported
            from elsewhere lands as one large day.
          </Limit>
          <Limit title="The days cover all your writing">
            The day-by-day figures are what you wrote in this app on those days,
            across every book — not this one alone. The saved drafts are this
            book&rsquo;s.
          </Limit>
        </ul>

        <div className="mt-10 border-t border-line pt-6">
          {/* The rule spans the page and the sentence does not.
              They were one element while a tool page was 3xl wide,
              where the two widths happened to agree; at 7xl a line of
              text run to the full container is about 160 characters,
              which is twice a readable measure. */}
          <p className="max-w-3xl text-xs leading-relaxed text-muted">
            Nothing on this page is sent anywhere. The fingerprint is computed in
            your browser and we never see it — which is also why we cannot vouch
            for it, and why the document tells whoever reads it to check the
            number themselves.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * SHA-256 of a string, or null where the browser refuses.
 *
 * `crypto.subtle` exists only in a secure context, and plain `http://<lan-ip>`
 * is not one — the same trap `newId()` in the store already works around. The
 * null is handled rather than thrown, because the rest of the record is still
 * worth having on a machine that cannot hash.
 */
async function sha256(input: string): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const bytes = new TextEncoder().encode(input);
  return toHex(await crypto.subtle.digest("SHA-256", bytes));
}

/**
 * The log with nothing in it.
 *
 * It was one grey sentence in a full-width strip — the least emphatic thing
 * on the page carrying the message that matters most to the person most
 * likely to be reading it, since a writer with no record is exactly who came
 * here worried. An empty state is a small screen of its own: what would be
 * here, why it is not, and the one thing to do about it.
 *
 * **The way out is a link into the book, not a button that fills the log.**
 * Nothing here can manufacture a day of writing, and the honest next step is
 * the only one there is — go and write, and the record starts today.
 */
function EmptyLog({ bookId }: { bookId: string }) {
  return (
    <div className="px-6 py-12 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-line bg-raised">
        <PageMark />
      </div>
      <p className="mt-4 text-base font-bold text-fg">Nothing recorded yet</p>
      <p className="mx-auto mt-2 max-w-prose text-sm leading-relaxed text-muted">
        The log starts the first day you write here. It cannot reach back before
        that, which is the honest limit of any record like this one.
      </p>
      <Link
        href={`/book/${bookId}`}
        className="mt-5 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm
                   font-semibold text-accent-ink hover:opacity-90"
      >
        Open the book
      </Link>
    </div>
  );
}

/**
 * A page with ruled lines — drawn in markup like every other figure here, and
 * deliberately a *document* rather than a chart or a calendar. Either of those
 * would depict something this screen does not draw, which is a promise made in
 * a picture.
 */
function PageMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-6 w-6 text-muted"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <path d="M9 12h6M9 15.5h6M9 19h3" />
    </svg>
  );
}

/**
 * Copies, and says so.
 *
 * A copy button with no acknowledgement is the same failure the export dialog
 * exists to fix: the browser gives no sign, so a writer presses it twice and
 * still does not know. The label reverts on a timer because "Copied" is true
 * of a moment, not of the button.
 *
 * It only claims success when the write actually resolved — a page served over
 * plain http has no clipboard at all, which is the same context that costs
 * this screen its fingerprint.
 */
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      // No clipboard, or permission refused. Saying nothing is right: the
      // label would otherwise report a copy that did not happen.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="rounded-lg border border-line px-4 py-2 text-xs font-semibold
                 text-fg hover:bg-raised"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** One of the three things the document holds. */
function Holds({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-fg">
      <span
        aria-hidden="true"
        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted"
      />
      {children}
    </li>
  );
}

function Limit({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="px-5 py-4">
      <p className="font-bold text-fg">{title}</p>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">
        {children}
      </p>
    </li>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-5 py-4">
      <p className="text-2xl font-extrabold tracking-tight text-fg tabular-nums">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

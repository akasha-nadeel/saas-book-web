"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { ToolHeader } from "@/components/tool-header";
import { GatedTool, useEntitled } from "@/components/upgrade/pro-gate";
import { parseHistory } from "@/lib/history";
import {
  findBook,
  getBody,
  getHistoryRaw,
  orderedChapters,
} from "@/lib/library-store";
import { download } from "@/lib/export";
import {
  digestInput,
  formatRecord,
  importDays,
  toHex,
  writingRecord,
  type ChapterVersions,
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
 */
export function ProvenancePage({ bookId }: { bookId: string }) {
  // Read here with the other hooks rather than beside the early return
  // below: hooks cannot sit after a conditional, and this screen has
  // several of its own already.
  const entitled = useEntitled();
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
      const chapters = orderedChapters(book);

      const versions: ChapterVersions[] = chapters.map((chapter) => ({
        title: chapter.title,
        versions: parseHistory(getHistoryRaw(chapter.id))
          .map((s) => ({ at: s.at, words: s.words }))
          // parseHistory hands back newest first, for the panel that shows
          // "restore the last one". Here the chapter has to read as a thing
          // that grew, so it is turned round.
          .reverse(),
      }));

      const fingerprint = await sha256(
        digestInput(
          chapters.map((c) => ({
            title: c.title,
            body: getBody(c.id) ?? "",
          })),
        ),
      );

      setBuilt({
        fingerprint,
        text: formatRecord({
          title: book.title,
          ...(book.author ? { author: book.author } : {}),
          record,
          chapters: versions,
          fingerprint,
          at: Date.now(),
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

  // The gate stands *after* the not-found guard above: a writer who
  // followed a stale link to a deleted book should be told the book is
  // gone, not asked to pay for one that does not exist.
  if (!entitled) {
    return (
      <GatedTool
        book={book}
        tool="Writing record"
        what="The trail your work left while it was being done — which days you wrote on, how the count moved, every draft saved along the way — gathered into a plain-text document you can send if you are ever accused of not having written your own book, with a SHA-256 fingerprint of the manuscript."
        deck={
          <>
            If someone accuses you of not having written your own book, there is no
        test that settles it — and the detectors sold for the job are known to
        misfire on plain prose and on writers whose first language is not
        English. What people actually reach for is the trail the work left while
        it was being done. This is yours, in a document you can send.
          </>
        }
      />
    );
  }

  return (
    <div className="h-dvh overflow-y-auto bg-surface">
      <ToolHeader book={book} tool="Writing record">
        If someone accuses you of not having written your own book, there is no
        test that settles it — and the detectors sold for the job are known to
        misfire on plain prose and on writers whose first language is not
        English. What people actually reach for is the trail the work left while
        it was being done. This is yours, in a document you can send.
      </ToolHeader>

      <div className="mx-auto max-w-5xl px-6 pt-6 pb-16">
        {error && (
          <p className="mt-6 rounded-lg border border-line bg-panel p-4 text-sm text-fg">
            {error}
          </p>
        )}

        {/* ---- What the log says ----------------------------------------- */}
        {record.firstDay === null ? (
          <p className="mt-8 rounded-xl border border-line bg-panel px-5 py-4 text-muted">
            Nothing recorded yet. The log starts the first day you write here —
            it cannot reach back before that, which is the honest limit of any
            record like this one.
          </p>
        ) : (
          <>
            {/* The saved drafts are deliberately not counted here. Doing so
                means reading every chapter's history out of storage on every
                render, and the count would still be stale — history is not one
                of the stores this screen subscribes to. It is gathered once,
                below, when the document is built. */}
            <section className="mt-8 grid gap-3 sm:grid-cols-3">
              <Stat value={String(record.daysWritten)} label="days written" />
              <Stat value={String(record.spanDays)} label="days spanned" />
              <Stat
                value={record.netWords.toLocaleString()}
                label="net words"
              />
            </section>
            <p className="max-w-prose mt-3 text-sm text-muted">
              {record.firstDay} to {record.lastDay}.
            </p>
          </>
        )}

        {/* ---- Days that are imports ------------------------------------
            Shown rather than hidden, and described rather than judged. Being
            surprised by your own record in somebody else's hands is exactly
            the failure this page exists to prevent. */}
        {imports.length > 0 && (
          <section className="mt-6 rounded-xl border border-line bg-panel px-5 py-4">
            <p className="text-sm font-bold text-fg">
              {imports.length} {imports.length === 1 ? "day is" : "days are"}{" "}
              larger than anyone types
            </p>
            <p className="max-w-prose mt-2 text-sm text-muted">
              {imports.map((d) => d.day).join(", ")} — that is a file arriving,
              not a day of drafting. If you imported a manuscript you wrote
              elsewhere, this is what it looks like, and it is evidence of
              nothing either way. Better you see it here than have it pointed
              out to you.
            </p>
          </section>
        )}

        {/* ---- Build it -------------------------------------------------- */}
        <h2 className="mt-10 text-xl font-extrabold text-fg">
          Make the document
        </h2>
        <p className="mt-2 text-muted">
          Day by day, every draft the app saved, and a fingerprint of the text
          as it stands. Plain text, so it survives being pasted into an email or
          a form.
        </p>
        <button
          type="button"
          onClick={() => void build()}
          disabled={working}
          className="mt-4 rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink disabled:opacity-50"
        >
          {working ? "Reading the manuscript…" : "Build the record"}
        </button>

        {built && (
          <>
            {built.fingerprint ? (
              <section className="mt-6 rounded-xl border border-line bg-panel px-5 py-4">
                <p className="text-sm font-bold text-fg">Fingerprint</p>
                <p className="mt-2 font-mono text-xs break-all text-fg">
                  {built.fingerprint}
                </p>
                {/* The instruction is the whole value. A hash nobody
                    timestamped establishes nothing, and we must not be the
                    ones holding the timestamp — a notary that is also the
                    accused party is not a notary. */}
                <p className="max-w-prose mt-3 text-sm text-muted">
                  Anyone with the same text gets the same number. On its own it
                  dates nothing. Put it somewhere outside your own control now —
                  email it to yourself, post it, commit it — so there is a
                  timestamp neither you nor we can move. We deliberately do not
                  store it for you.
                </p>
              </section>
            ) : (
              <p className="mt-6 rounded-xl border border-line bg-panel px-5 py-4 text-sm text-muted">
                No fingerprint: this browser will not do cryptography on an
                insecure connection. Open the app over https, or on localhost,
                and build it again. The rest of the record is here regardless.
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
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
                className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink"
              >
                Download
              </button>
              <button
                type="button"
                onClick={() => void navigator.clipboard?.writeText(built.text)}
                className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold text-fg"
              >
                Copy
              </button>
            </div>

            <pre
              className="mt-4 max-h-96 overflow-auto rounded-xl border border-line bg-panel p-5
                         font-mono text-xs leading-relaxed whitespace-pre-wrap text-fg"
            >
              {built.text}
            </pre>
          </>
        )}

        {/* ---- The limits, on the screen as well as in the file ---------- */}
        <h2 className="mt-10 text-xl font-extrabold text-fg">
          What this is not
        </h2>
        <ul className="mt-4 flex flex-col gap-3">
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
              where the two widths happened to agree; at 5xl a line of
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

function Limit({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="rounded-xl border border-line bg-panel px-5 py-4">
      <p className="font-bold text-fg">{title}</p>
      <p className="mt-1 text-sm text-muted">{children}</p>
    </li>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3">
      <p className="text-2xl font-extrabold text-fg">{value}</p>
      <p className="mt-0.5 text-xs text-muted">{label}</p>
    </div>
  );
}

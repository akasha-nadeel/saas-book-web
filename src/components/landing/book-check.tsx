"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  checkFile,
  fixDestination,
  signupTo,
  type FileFindings,
} from "@/lib/file-check";
import { AppWindow } from "@/components/landing/app-window";
import { LEAD_DAYS } from "@/lib/arc";
import { ALL_TOOLS } from "@/lib/book-tools";
import type { Fix } from "@/lib/checkup";
import type { ImportedBook } from "@/lib/import/split";

/**
 * The check, run on the reader's own book, before they have an account.
 *
 * The hero above this says *find out what is wrong with your book before you
 * upload it*. Everything else on the page argues for that claim; this is the
 * page keeping it. A visitor drops the manuscript they already have and gets
 * the real readiness check — the same findings, in the same order, with the
 * same words — for nothing, with no account and no email address.
 *
 * **Why this replaced a drawing of the dashboard.** The hero used to carry a
 * still of Overview with an invented book on it, which is a screenshot's
 * argument: *here is a product, imagine it working on yours*. This audience
 * has been shown convincing screenshots by people who then took their money.
 * A check they can run on the book sitting on their desk, in the four seconds
 * before they decide whether to read the rest of the page, is the only claim
 * on this page that cannot be faked — and it is aimed at exactly the person
 * the research describes, who has a finished manuscript and no idea what is
 * standing between it and a shop.
 *
 * **Nothing is uploaded, and that is not a privacy footnote — it is the
 * feature.** Every parser this reaches for runs in the browser (see
 * `lib/import`), so the manuscript never leaves the machine. A writer who has
 * been told to hand a stranger's website their unpublished novel has a
 * perfectly good reason to close the tab, and the sentence that keeps them is
 * the true one, said at the drop zone rather than in a footer.
 *
 * **Results are never held back for an email.** The whole list is shown,
 * worst first, whether or not anybody signs up — gating findings behind a form
 * is the pattern this reader has been burned by, and it converts the ones who
 * were going to convert anyway while confirming everybody else's suspicion.
 * What needs an account is *fixing* something, because a fix has to be saved
 * somewhere, and the buttons say so before they are pressed.
 *
 * **The book comes with them.** Pressing any fix writes the parsed book into
 * this browser and sends the writer to sign-up with the destination attached,
 * so they arrive signed in, on the tool that fixes the thing they pressed,
 * with their manuscript already on the shelf. `syncWithServer` was built for
 * exactly this case — a library that existed before the account did is
 * uploaded and claimed on the first sign-in — so nothing extra is needed to
 * make it survive. Nothing is written until they press something: a visitor
 * who only wanted the check leaves no trace in their own browser either.
 */

/*
 * The page's colours, as tokens rather than values, so this card follows
 * `data-theme` with the rest of the landing page. The two severities are
 * picked per finding down in `Result` — a status needs a *fill* token and a
 * *text* token, and they are not the same one.
 */
/**
 * The hero file input's id, and the anchor for the card that holds it.
 *
 * Exported so the header can bind a `<label>` to the one file input on the
 * page rather than growing a second, and so a control that is off screen when
 * pressed can bring the check back into view before the picker returns.
 */
export const HERO_FILE_INPUT = "hero-manuscript";
export const HERO_CHECK_ANCHOR = "check";

const INK = "var(--color-lp-accent)";
const STOP = "var(--color-stop-fg)";
const PASS = "var(--color-ok-fg)";
const INK_TEXT = "var(--color-lp-accent-text)";

type State =
  | { phase: "idle" }
  | { phase: "reading"; name: string }
  | { phase: "error"; message: string }
  | { phase: "done"; result: FileFindings; cover?: string };

export function BookCheck() {
  const router = useRouter();
  const [state, setState] = useState<State>({ phase: "idle" });
  const [dragging, setDragging] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  /*
   * The parsed file, kept out of React state on purpose.
   *
   * It holds an entire manuscript as ProseMirror JSON — a 90,000-word novel is
   * megabytes of it — and nothing rendered here reads a word of the prose.
   * Putting it in state would re-render the page around it for no benefit.
   */
  const parsed = useRef<ImportedBook | null>(null);
  /** The book, once one has been made. Reused, so two presses are one book. */
  const saved = useRef<string | null>(null);

  const read = async (file: File) => {
    setState({ phase: "reading", name: file.name });
    setSaveFailed(false);
    saved.current = null;

    try {
      // Loaded on demand: the parsers pull in JSZip, and a reader who never
      // drops a file should never download it. This is a landing page.
      const { importFile, ImportError } = await import("@/lib/import");
      try {
        const book = await importFile(file);
        parsed.current = book;
        setState({
          phase: "done",
          result: checkFile(book),
          ...(book.cover ? { cover: book.cover } : {}),
        });
      } catch (err) {
        // The import errors are written for writers already — which format to
        // save as, what to do about a PDF. Anything else is a bug of ours, and
        // saying so plainly beats blaming their file.
        setState({
          phase: "error",
          message:
            err instanceof ImportError
              ? err.message
              : "That file could not be read. It may be damaged, or not the format its name suggests.",
        });
      }
    } catch {
      setState({
        phase: "error",
        message:
          "The reader could not be loaded. Check your connection and try again.",
      });
    }
  };

  const onPick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void read(file);
  };

  /**
   * Keep the book, then send them to sign up with somewhere to land.
   *
   * The write happens here rather than at parse time so that a visitor who
   * only wanted the check leaves nothing behind in their own browser.
   *
   * **Every way out of this card comes through here**, including the plain
   * "Start free" at the foot — because that button sits under a sentence
   * promising the book comes with them, and a CTA that signed them up and left
   * the manuscript on the floor would make this page do the one thing it is
   * built to argue nobody else should: say something untrue about a book.
   *
   * A failed write stays put rather than navigating. The failure is a full
   * browser, and the writer needs to be told that here, where the file still
   * is — sending them on would land them signed up, on an empty shelf, with no
   * idea what happened to their novel.
   *
   * **The free plan's import limit is counted here but never enforced here.**
   * `createBookFromImport` stamps the tally like it does anywhere else, so the
   * book a visitor arrives with is one of their ten. Refusing them at this
   * card is a different matter: the whole argument of the page is that you can
   * check a manuscript before paying, and a stranger's browser is the worst
   * place in the app to meet a plan limit — they have no account for it to be
   * about. Anyone standing at the limit sees it on the import screens inside.
   */
  const start = async (target: Fix | null) => {
    const book = parsed.current;
    if (!book) return;

    if (!saved.current) {
      const [{ createBookFromImport }, { setupFromImport }] = await Promise.all([
        import("@/lib/library-store"),
        import("@/lib/import"),
      ]);
      const made = createBookFromImport(
        book.title,
        book.chapters,
        setupFromImport(book),
      );
      if (!made) {
        setSaveFailed(true);
        return;
      }
      saved.current = made.bookId;
    }

    router.push(
      signupTo(target ? fixDestination(target, saved.current) : "/"),
    );
  };

  const done = state.phase === "done";

  return (
    /* No top margin of its own: it used to sit under the hero deck and had to
       hold itself off it, and now it is the only thing in a band of its own,
       where the section's padding is what sets the space. A margin here would
       be added to that. */
    /* `max-w-6xl`, the section's full measure. It was `4xl`, which was right
       while this sat under a hero deck and had to look like a card the page
       had placed there. It owns a band now, and a device narrower than the
       heading above it reads as a widget rather than as the product. */
    <div id={HERO_CHECK_ANCHOR} className="mx-auto max-w-6xl scroll-mt-24">
      {/* The frame is shared with the two figures further down the page — see
          `app-window.tsx`. This is the one that holds a working control
          rather than a drawing, so it passes no `label`: a screen reader has
          to meet the file input, not a sentence describing a picture of one.

          The badge is the answer to the question a reader actually has at this
          moment, put where the eye lands first rather than in a caption under
          the frame, which is where it used to be and where it read as small
          print about the thing rather than as part of it. */}
      <AppWindow
        /* The dark shell, and this is the one window on the page entitled to
           it — see the note on the prop. The other two are figures inside
           sections that argue around them; this one *is* its section, and a
           pale ring at this width vanishes into the band behind it. */
        bezel
        title="Manuscript check"
        badge={
          <span
            className="rounded-full border px-2.5 py-1 text-[0.6875rem] font-semibold"
            style={{
              color: INK_TEXT,
              borderColor: "var(--color-lp-edge)",
              backgroundColor:
                "color-mix(in srgb, var(--color-lp-accent) 8%, transparent)",
            }}
          >
            Free · no sign-up
          </span>
        }
      >
        {/* The instruction sits *in* the window rather than in a line under
            it. Under the frame it arrived after the reader had already
            decided whether to hand over a manuscript, which is the wrong side
            of the decision for the sentence that settles it. */}
        {/* Set at heading size rather than as a caption. It is the instruction
            the whole box turns on — a reader deciding whether to hand over a
            manuscript reads this line and nothing else — and at `text-sm` it
            was the smallest type in the hero, competing with the legal note
            below it rather than with the headline above. Serif and
            `oc-heading`, so it belongs to the page's headings rather than to
            its captions. */}
        {!done && (
          <p className="oc-heading px-5 pt-5 text-center font-serif text-xl leading-snug font-semibold text-lp-ink sm:px-6 sm:text-2xl">
            Test your own manuscript for the problems a shop would find.
          </p>
        )}

        {done ? (
          <Result
            result={state.result}
            cover={state.cover}
            saveFailed={saveFailed}
            onStart={start}
            onReset={() => {
              parsed.current = null;
              saved.current = null;
              setSaveFailed(false);
              setState({ phase: "idle" });
            }}
          />
        ) : (
          <>
            <Dropzone
              state={state}
              dragging={dragging}
              setDragging={setDragging}
              onPick={onPick}
            />
            {/* The caveat, and it belongs only before there is a result —
                once there is one the card's own foot makes the offer with the
                book attached, and two sign-in prompts in one window is one
                too many. */}
            <p className="border-t border-lp-line bg-lp-well px-5 py-3 text-center text-[0.8125rem] leading-relaxed text-lp-body sm:px-6">
              You are only asked to sign in if you want to fix what it finds.
            </p>
          </>
        )}
      </AppWindow>
    </div>
  );
}

function Dropzone({
  state,
  dragging,
  setDragging,
  onPick,
}: {
  state: State;
  dragging: boolean;
  setDragging: (value: boolean) => void;
  onPick: (files: FileList | null) => void;
}) {
  const reading = state.phase === "reading";

  return (
    <div className="px-4 pt-4 pb-5 sm:px-6 sm:pt-4 sm:pb-6">
      {/*
       * A label wrapping a hidden input, not a div with a click handler.
       *
       * The whole area is then the file picker's own control: it takes focus,
       * answers the space bar, and is announced as a file input, none of which
       * a div can be given without rebuilding all three by hand.
       */}
      <label
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          onPick(event.dataTransfer.files);
        }}
        /* A floor rather than padding alone. The zone is the whole point of
           this window, and it now spans the section's full width — at the old
           `py-14` a wide box only an inch or two tall reads as a strip to type
           into rather than as somewhere to drop a file. A minimum height keeps
           it square enough to look like a target at every width, and the
           padding still sets the space around the words inside it. */
        className={`flex min-h-[18rem] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-10 text-center transition-colors sm:min-h-[24rem] sm:px-6 sm:py-14 ${
          dragging
            ? "border-[var(--color-lp-accent)] bg-lp-tint"
            : "border-lp-edge bg-lp-well/60 hover:border-lp-edge-strong"
        }`}
      >
        <input
          /* Named so the header's own upload control can be a plain
             `<label htmlFor>` pointing at it. A label opens the picker it is
             bound to wherever it sits in the document, so the button up there
             needs no state, no ref and no second file input — the file lands
             in this check exactly as if it had been dropped on the box. */
          id={HERO_FILE_INPUT}
          type="file"
          accept=".docx,.epub,.md,.markdown,.txt,.html,.htm"
          className="sr-only"
          disabled={reading}
          onChange={(event) => {
            onPick(event.target.files);
            // Cleared so choosing the same file twice fires a change event —
            // otherwise a second attempt after an error does nothing at all.
            event.target.value = "";
          }}
        />

        {reading ? (
          <>
            <p className="oc-heading font-serif text-2xl text-lp-ink">
              Reading your book…
            </p>
            <p className="mt-2 max-w-md text-sm text-lp-body">
              {state.name}
            </p>
          </>
        ) : (
          <>
            <span style={{ color: INK_TEXT }}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-9 w-9"
              >
                <path d="M12 16V4" />
                <path d="m7.5 8.5 4.5-4.5 4.5 4.5" />
                <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
              </svg>
            </span>
            <p className="oc-heading mt-4 font-serif text-xl text-lp-ink sm:text-3xl">
              Drop your manuscript here
            </p>
            <p className="mt-2 text-[0.9375rem]">
              or{" "}
              <span className="font-semibold underline" style={{ color: INK_TEXT }}>
                choose a file
              </span>{" "}
              — Word, EPUB, Markdown, plain text or HTML
            </p>

            {/* The sentence that decides whether a stranger hands over an
                unpublished novel, so it is stated where the decision is made
                and it is stated exactly. Every parser runs in the browser. */}
            <p className="mt-6 flex items-center gap-2 text-[0.8125rem] font-medium text-lp-soft">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-[18px] w-[18px] shrink-0"
                style={{ color: PASS }}
              >
                <path d="M6 11V8a6 6 0 0 1 12 0v3" />
                <rect x="4.5" y="11" width="15" height="9.5" rx="2" />
              </svg>
              Nothing is uploaded. Your book is read in this browser.
            </p>
          </>
        )}
      </label>

      {state.phase === "error" && (
        <p
          role="alert"
          className="mt-3 rounded-xl border px-4 py-3 text-sm leading-relaxed"
          style={{
            borderColor: "var(--color-stop-line)",
            backgroundColor: "var(--color-stop-bg)",
            color: STOP,
          }}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}

function Result({
  result,
  cover,
  saveFailed,
  onStart,
  onReset,
}: {
  result: FileFindings;
  cover?: string;
  saveFailed: boolean;
  /** Null for "just take me in"; a `Fix` to land on the tool that mends it. */
  onStart: (fix: Fix | null) => void;
  onReset: () => void;
}) {
  const clean = result.findings.length === 0;

  return (
    <div aria-live="polite">
      {/* ---- What was read ------------------------------------------------
          The book named back, with two counts and nothing else. They are
          facts out of the file, which is the only kind of number this app
          prints — no score, no readiness percentage, no grade. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-lp-line bg-lp-well px-4 py-4 sm:flex-nowrap sm:px-5">
        {cover ? (
          // Real artwork out of the reader's own EPUB. It is also the proof
          // that the file was read rather than sampled: nobody's mock has
          // their cover in it.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            className="h-16 w-11 shrink-0 rounded-sm border border-lp-edge object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-16 w-11 shrink-0 items-center justify-center rounded-sm border border-lp-edge bg-lp-ground"
          >
            <span className="h-9 w-px bg-[var(--color-lp-edge)]" />
          </span>
        )}

        <div className="min-w-0 flex-1 basis-40">
          <p className="oc-heading truncate font-serif text-xl text-lp-ink">
            {result.title}
          </p>
          <p className="mt-0.5 truncate text-[0.8125rem] text-lp-body">
            {result.author ? `${result.author} · ` : ""}
            {result.words.toLocaleString()} words ·{" "}
            {result.chapters === 1 ? "1 chapter" : `${result.chapters} chapters`}
          </p>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="shrink-0 rounded-full border border-lp-edge px-4 py-2 text-[0.8125rem] font-semibold text-lp-soft hover:border-lp-edge-strong"
        >
          Check another
        </button>
      </div>

      <div className="px-5 py-5">
        {/* The app's own summary line, word for word. Two counts, worst
            first, and a verdict on neither. */}
        <p className="text-[0.9375rem]">
          {clean ? (
            <span className="font-semibold" style={{ color: PASS }}>
              Your file is ready to upload.
            </span>
          ) : (
            <>
              <span className="font-semibold text-lp-ink">
                {result.fix === 1 ? "1 thing" : `${result.fix} things`}
              </span>{" "}
              would stop a shop taking this
              {result.note > 0 && <> · {result.note} worth doing</>}
            </>
          )}
        </p>

        {clean ? (
          /*
           * **The clean pass is the harder result to answer, and it is where
           * this page loses people.** A reader whose file is refused has an
           * obvious next move. A reader whose file passes has just been told
           * everything is fine — and a reader who has been told everything is
           * fine leaves. The first version of this said only that, in green,
           * and then asked for an account for a problem it had just announced
           * they did not have.
           *
           * **The answer is not to invent a problem**, which is the one thing
           * this whole page exists to refuse. It is to say what a file check
           * structurally *cannot* see. That is not a sales line, it is the
           * literal truth about the check: it reads the file. Whether the
           * blurb makes somebody buy, whether those categories are shelves
           * readers browse, whether one advance reader has the book — none of
           * that is in a file, and between them they decide how the book does.
           *
           * So the shape is: confirm, then name the gap, then say what is
           * here for it. Three rules hold it.
           *
           * - **Every claim is checkable and most are counted.** The six weeks
           *   is `LEAD_DAYS` out of `arc.ts`, the tool count is `ALL_TOOLS`,
           *   the step count is `STEPS` — the same figures the rest of the
           *   page quotes, so this cannot drift into a boast.
           * - **Nothing implies the check found something.** The green line
           *   above still says the file is ready, and the gap named here is a
           *   limit of *file checks*, not a finding about this book.
           * - **The reader keeps what they came for.** The last sentence is
           *   what happens to their manuscript, because the fear at this exact
           *   moment is that signing up is how you get your book back.
           */
          <>
            <p className="oc-heading mt-2 font-serif text-[1.375rem] leading-snug text-lp-ink sm:text-2xl">
              What a file cannot tell you is whether anyone will find it.
            </p>
            {/* A step up from the card's own body size. This is the paragraph
                that has to be *read* rather than skimmed — it is the only
                thing between a reader being told their file is fine and a
                reader leaving — and at footnote size it looked like the small
                print under a result rather than the answer to it. */}
            <p className="mt-3.5 text-[1.0625rem] leading-relaxed">
              A shop refuses files over the things just checked, and yours
              passes all of them. It says nothing about whether the blurb makes
              somebody buy, whether those categories are shelves readers
              actually browse, or whether a single advance reader has your book
              — and advance copies go out{" "}
              <strong className="font-semibold text-lp-ink">
                {Math.round(LEAD_DAYS / 7)} weeks before publication
              </strong>
              , which is the one almost nobody is told in time.{" "}
              {ALL_TOOLS.length} tools here take that on, in the order it
              happens, and{" "}
              <strong className="font-semibold text-lp-ink">
                your book opens as chapters you can keep writing
              </strong>
              .
            </p>
          </>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {result.findings.map((finding) => {
              const stop = finding.level === "fix";
              /*
               * A fill and a text colour, and they are not the same token.
               *
               * `-solid` keeps one value in both themes because it is a block
               * carrying white; `-fg` crosses over, because #b91c1c as *text*
               * on a near-black ground is unreadable and its night value is a
               * light red. Using one for both would give either a pale block
               * with white on it, or text nobody can read — depending on which
               * one you picked.
               */
              const fill = stop
                ? "var(--color-stop-solid)"
                : "var(--color-note-solid)";
              const ink = stop
                ? "var(--color-stop-fg)"
                : "var(--color-note-fg)";
              return (
                <li
                  key={finding.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl border px-3.5 py-3.5 sm:px-4"
                  style={{
                    borderColor: stop ? "var(--color-stop-line)" : "var(--color-note-line)",
                    backgroundColor: stop ? "var(--color-stop-bg)" : "var(--color-note-bg)",
                  }}
                >
                  {/* Severity is carried by the ground and the mark. The
                      button stays indigo — it is the way *out* of the
                      problem, and a red button says the pressing is the
                      dangerous part. Same rule the dashboard runs on. */}
                  <span
                    aria-hidden="true"
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-lp-accent-ink"
                    style={{ backgroundColor: fill }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.8}
                      strokeLinecap="round"
                      aria-hidden="true"
                      className="h-3 w-3"
                    >
                      {stop ? (
                        <>
                          <path d="m6 6 12 12" />
                          <path d="m18 6-12 12" />
                        </>
                      ) : (
                        <>
                          <path d="M12 5v9" />
                          <path d="M12 18.5v.5" />
                        </>
                      )}
                    </svg>
                  </span>

                  <span className="min-w-[10rem] flex-1">
                    <span
                      className="block text-[0.9375rem] font-semibold"
                      style={{ color: ink }}
                    >
                      {finding.title}
                    </span>
                    {finding.why && (
                      <span className="mt-0.5 block text-sm text-lp-body">
                        {finding.why}
                      </span>
                    )}
                  </span>

                  <button
                    type="button"
                    onClick={() => onStart(finding.fix)}
                    style={{ color: "var(--color-lp-accent)", borderColor: "var(--color-lp-edge)" }}
                    className="shrink-0 rounded-lg border bg-lp-ground px-3.5 py-2 text-[0.8125rem] font-semibold hover:bg-lp-raised"
                  >
                    {finding.fix.action} <span aria-hidden="true">→</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ---- The one place an account is asked for ------------------------
          After the value, never before it, and it says what it will do with
          the book rather than only what it wants from the reader. */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-lp-line bg-lp-well px-5 py-4">
        <p className="max-w-md text-[0.8125rem] leading-relaxed text-lp-body">
          {saveFailed ? (
            <span style={{ color: STOP }}>
              This browser has no room to keep the book — it stores them
              locally. Sign up and import it there instead; nothing has been
              lost.
            </span>
          ) : (
            <>Nothing left this browser. Sign up free and the book comes with you.</>
          )}
        </p>
        {saveFailed ? (
          <Link
            href={signupTo("/")}
            style={{ backgroundColor: INK }}
            className="shrink-0 rounded-full px-6 py-3 text-[0.9375rem] font-semibold text-lp-accent-ink hover:opacity-90"
          >
            Sign up free
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => onStart(null)}
            style={{ backgroundColor: INK }}
            className="shrink-0 rounded-full px-6 py-3 text-[0.9375rem] font-semibold text-lp-accent-ink hover:opacity-90"
          >
            {clean ? "Start free" : "Fix these — free"}
          </button>
        )}
      </div>
    </div>
  );
}

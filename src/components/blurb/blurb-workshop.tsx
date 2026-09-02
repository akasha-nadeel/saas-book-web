"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { saveChat } from "@/lib/library-store";
import { useChat } from "@/lib/use-library";

/* One transcript per book, namespaced so it cannot collide with the
   chapter assistant's (which files under a chapter id). */
const chatKeyFor = (bookId: string) => `blurb:${bookId}`;
import { ReaderMark } from "@/components/blurb/reader-mark";
import { AssistantReply } from "@/components/ui/assistant-reply";
import { CopyButton } from "@/components/ui/copy-button";
import { Spinner } from "@/components/ui/spinner";
import { displayName, firstNameOf, initialOf } from "@/lib/account";
import { useAccount } from "@/lib/use-account";
import {
  LeftPill,
  LimitBanner,
  LimitDialog,
  LimitNote,
  useLimitGate,
} from "@/components/upgrade/free-limit";
import {
  shortDraftNote,
  STARTERS,
  type WorkshopMessage,
} from "@/lib/blurb-workshop";
import { spendTotalUse } from "@/lib/library-store";
import { useChatScroll } from "@/lib/use-chat-scroll";
import { usePrefs } from "@/lib/use-library";

/**
 * The blurb conversation — the half of this screen for somebody staring at an
 * empty box.
 *
 * "Ask a reader" beside it reads a blurb and reports; both need a blurb to
 * exist. This is the one that helps write one, and the shape of it is the
 * whole argument: it asks, the writer answers, and the draft is assembled from
 * their own answers. See `blurb-workshop.ts` for why that is the shape rather
 * than a generator.
 *
 * **The conversation is not persisted**, exactly as the assistant's is not: a
 * chat about a draft is scaffolding rather than part of the book. Reloading
 * starts fresh — which is also why a use is spent on the *first message*
 * rather than on mount, so a reload with nothing said costs nothing.
 */

/**
 * What the screen sends and holds. Local, because nothing is stored.
 *
 * `at` is the wall clock when the turn appeared. It exists only to be printed
 * beside the name — nothing is ordered by it, and nothing survives a reload,
 * so `Date.now()` is the whole of what it needs to be.
 */
type Turn = WorkshopMessage & { draft?: string; at: number };

/** The name the reader answers under. Used in the bubble and by the assistant. */
const READER = "A reader";

/**
 * The time beside a name, in the reader's own locale.
 *
 * Hours and minutes and nothing else. A conversation that never outlives the
 * page it is on has no use for a date, and "11 Aug, 10:42" beside a message
 * sent ninety seconds ago reads as an archive rather than as a chat.
 */
function clockOf(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function BlurbWorkshop({
  bookId,
  title,
  genre,
  draft,
  getOpening,
  onUseDraft,
  narrow = false,
}: {
  /** What the conversation is filed under — one transcript per book. */
  bookId: string;
  title?: string;
  genre?: string;
  /** The blurb as it stands, so the model can work on it rather than restart. */
  draft: string;
  /** Read lazily: the manuscript is only touched when something is asked. */
  getOpening: () => string;
  /** Puts a draft in the box. Never called without a press. */
  onUseDraft: (blurb: string) => void;
  /** The roadmap panel's ~300px column, where the wide banner does not fit. */
  narrow?: boolean;
}) {
  /**
   * **The transcript lives in the store, not in this component.**
   *
   * It was `useState([])`, and this screen unmounts whenever the tool is left
   * or the roadmap sheet is closed — so a conversation a writer had paid one of
   * their three for good disappeared the moment they looked at anything else.
   *
   * Written straight through rather than kept alongside a live copy, unlike the
   * chapter assistant: that one streams a reply a token at a time and cannot
   * write every frame, while this route answers once. So there is one source
   * here and nothing to hold in step.
   */
  const turns = useChat<Turn>(chatKeyFor(bookId));
  const setTurns = useCallback(
    (next: Turn[]) => saveChat(chatKeyFor(bookId), next),
    [bookId],
  );
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const listRef = useChatScroll();

  const account = useAccount();
  /* "You" rather than a name nobody has set. `displayName` falls back to the
     email's local part, which on a shared machine is somebody's address
     printed above every message they type. */
  const you = account ? firstNameOf(displayName(account)) : "You";

  const prefs = usePrefs();
  const gate = useLimitGate({
    action: "blurbChat",
    used: prefs.usedTotal.blurbChat ?? 0,
  });

  // Abandon an in-flight reply if the screen goes.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function send(text: string) {
    const said = text.trim();
    if (!said || busy) return;

    /*
     * **A use is one conversation, spent on its first message.**
     *
     * Counting messages instead would stop a writer mid-brainstorm, which is
     * worse than never letting them start — and the interview is four
     * questions before it even offers a draft. Counting on *mount* would
     * charge somebody for opening the panel and reading it.
     *
     * The gate is asked before the request and the count is written after it
     * lands, so a gateway error cannot cost one of three.
     */
    const starting = turns.length === 0;
    if (starting && !gate.spend()) return;

    /*
     * **The clock is read once per send, and the lint rule that objects is
     * wrong about this one.** `react-hooks/purity` flags `Date.now()` anywhere
     * in a component body because it cannot prove the caller is not render;
     * `send` is only ever reached from a submit, a key press or a starter
     * button, so this runs in an event and its result is stored rather than
     * derived. Reading it once here also means the writer's turn and the
     * reply are stamped from the same instant on a fast round trip, instead of
     * a second apart for no reason a reader could see.
     */
    // eslint-disable-next-line react-hooks/purity
    const at = Date.now();

    const history: Turn[] = [...turns, { role: "user", content: said, at }];
    setTurns(history);
    setInput("");
    setBusy(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/blurb/workshop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          messages: history.map(({ role, content }) => ({ role, content })),
          title,
          genre,
          draft,
          opening: getOpening(),
        }),
      });

      const payload: { message?: string; draft?: string | null; error?: string } =
        await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error ?? "That did not work. Your blurb is unaffected.");
        // Drop the turn: nothing was said back, and leaving it would make the
        // next message read as a reply to something that never happened.
        setTurns(turns);
        return;
      }

      setTurns([
        ...history,
        {
          role: "assistant",
          content: payload.message || "…",
          draft: payload.draft ?? undefined,
          // eslint-disable-next-line react-hooks/purity
          at: Date.now(),
        },
      ]);

      if (starting) spendTotalUse("blurbChat");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("Could not reach the reader. Check your connection and try again.");
      setTurns(turns);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-line bg-panel shadow-sm">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-5 py-4">
        {/* The same face that answers below, so the panel's title and the
            speaker inside it are recognisably one thing. */}
        <ReaderMark size={32} />
        <h2 className="text-base font-bold tracking-tight text-fg">
          Work it out loud
        </h2>
        <LeftPill allowance={gate.allowance} className="ml-auto" />
      </div>

      {/* The scroll area. `min-h-0` on both this and the section, or a flex
          child with overflow grows the column instead of scrolling in it. */}
      <div
        ref={listRef}
        className="scroll-slim min-h-0 flex-1 overflow-y-auto px-5 py-4"
      >
        {turns.length === 0 ? (
          <div>
            <p className="max-w-prose text-sm leading-relaxed text-muted">
              It asks about your book, you answer, and it puts a draft together
              from what you said. It will not invent a plot you did not tell it.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => void send(starter)}
                  className="rounded-lg border border-line px-3.5 py-2.5 text-left text-sm
                             text-fg transition-colors hover:border-fg/25 hover:bg-raised"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="flex flex-col gap-5">
            {turns.map((turn, i) => (
              <li key={i}>
                {/* **A byline over the bubble, not beside it.**
                    The rail is 24rem and a chat bubble is most of that, so an
                    avatar in its own column would take a fifth of the width
                    from every line of text. Above it, the row costs one line
                    once and the bubble keeps the measure.

                    The writer's side is mirrored rather than laid out
                    separately — `flex-row-reverse` on one wrapper, so the two
                    sides cannot drift apart when either is edited. */}
                <div
                  className={`flex items-center gap-2 ${
                    turn.role === "user" ? "flex-row-reverse" : ""
                  }`}
                >
                  {turn.role === "user" ? (
                    <Face url={account?.avatarUrl ?? null} name={you} />
                  ) : (
                    <ReaderMark size={24} />
                  )}
                  <span className="text-xs font-semibold text-fg">
                    {turn.role === "user" ? you : READER}
                  </span>
                  {/* `tabular-nums`: the times sit under each other down the
                      column, and proportional digits make a straight edge
                      wander. */}
                  <span className="text-[0.6875rem] text-muted tabular-nums">
                    {clockOf(turn.at)}
                  </span>
                </div>

                {turn.role === "user" ? (
                  <p className="mt-1.5 ml-auto w-fit max-w-[92%] rounded-xl rounded-tr-sm bg-accent px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-accent-ink">
                    {turn.content}
                  </p>
                ) : (
                  /* **Parsed, not printed** — the reply arrives in Markdown,
                     so a bulleted answer showed its asterisks. `copyable` is
                     off because this turn's offered prose *is* the draft
                     below, which has its own controls; a copy button on the
                     conversation as well would be two ways to take the same
                     words, one of which does less. */
                  <div className="mt-1.5 w-fit max-w-[92%] rounded-xl rounded-tl-sm border border-line bg-surface px-3.5 py-2.5">
                    <AssistantReply text={turn.content} copyable={false} />
                  </div>
                )}

                {/* **The draft, with the only control that touches the box.**
                    It is never applied on its own: a model quietly replacing
                    somebody's blurb and presenting the result as theirs is the
                    invisible hand this app refuses everywhere. */}
                {turn.draft && (
                  <div className="mt-3 rounded-xl border border-accent/30 bg-surface p-4">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-fg">
                      {turn.draft}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
                      <button
                        type="button"
                        onClick={() => onUseDraft(turn.draft!)}
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90"
                      >
                        Put this in the box
                      </button>
                      {/* **Beside the primary, not instead of it.** The button
                          above is what a writer wants nine times out of ten;
                          this is for the tenth — comparing two drafts in
                          another window, or keeping one before asking for a
                          rewrite. The draft is plain prose already, so it goes
                          to the clipboard exactly as written. */}
                      <CopyButton
                        value={turn.draft}
                        label="Copy this draft"
                        className="text-muted hover:bg-raised hover:text-fg"
                      />
                      <span className="text-xs text-muted">
                        {turn.draft.length} characters · nothing is saved until
                        you press Save
                      </span>
                    </div>

                    {/* **Why it came out short, when it did.**
                        The commonest disappointment with this feature is not a
                        bug: a writer answers in a dozen words, gets thirty back,
                        and concludes the thing is broken. It is the hard rule
                        working — it may not state a fact they did not give it,
                        so a short answer can only make a short blurb.

                        It sits under the controls rather than over them: the
                        draft and the button are what the writer came for, and
                        an explanation above them would be read as a warning
                        about the draft itself. `note` amber rather than `stop`
                        red — nothing has failed. */}
                    {shortDraftNote(turn.draft) && (
                      <p className="mt-3 rounded-lg border border-note-line bg-note-bg px-3 py-2 text-xs leading-relaxed text-note-fg">
                        {shortDraftNote(turn.draft)}
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}

        {/* The waiting turn wears the same byline the reply will, so the reply
            arrives in the row the eye is already on rather than pushing a new
            one in under it. */}
        {busy && (
          <div className="mt-5">
            <div className="flex items-center gap-2">
              <ReaderMark size={24} />
              <span className="text-xs font-semibold text-fg">{READER}</span>
            </div>
            <p className="mt-1.5 flex w-fit items-center gap-2 rounded-xl rounded-tl-sm border border-line bg-surface px-3.5 py-2.5 text-sm text-muted">
              <Spinner className="h-4 w-4" />
              Reading
            </p>
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-stop-line bg-stop-bg px-3.5 py-2.5 text-sm text-stop-fg"
          >
            {error}
          </p>
        )}
      </div>

      <div className="border-t border-line px-5 py-3">
        {narrow ? (
          <LimitNote allowance={gate.allowance} className="mb-3" />
        ) : (
          <LimitBanner allowance={gate.allowance} refused={gate.refused} className="mb-3" />
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex items-end gap-2"
        >
          <label htmlFor="blurb-workshop-input" className="sr-only">
            Say something about your book
          </label>
          <textarea
            id="blurb-workshop-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter is a newline — what every chat does,
              // and what the assistant panel already does here.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            /* One row, growing to three as it is typed into. Two fixed rows
               spent a line of the panel on white space in the common case —
               most turns here are a sentence — and the chat above it is what
               the height is worth spending on. */
            rows={1}
            placeholder="Tell it about your book…"
            className="scroll-slim max-h-24 min-h-0 flex-1 resize-none rounded-lg border
                       border-line bg-surface px-3.5 py-2 text-sm text-fg
                       placeholder:text-muted focus:border-accent/40 focus:outline-none"
          />
          <button
            type="submit"
            /* Live even with nothing left: a disabled button gives the refusal
               nowhere to be explained. Only an empty box or a request already
               in flight turns it off, and both are states where pressing
               genuinely does nothing. */
            disabled={busy || !input.trim()}
            className="shrink-0 rounded-lg bg-accent px-3.5 py-2.5 text-sm font-semibold
                       text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-45"
          >
            Send
          </button>
        </form>

        {/* **Four words of it are load-bearing and cannot go: "Reads your
            opening chapter."** This route sends prose, and the house rule is
            that a writer is told so where it applies rather than only in a
            policy page — discovering afterwards that the manuscript was sent
            is the one thing this screen must never do. The explanation went;
            the fact stays, and it now shares the line with the fallibility
            note, which is the other thing a reader of a drafted blurb needs.
            `/privacy` carries the long version. Add a field to what is sent
            and name it here. */}
        {/* Short enough to hold one line at the rail's width — "check the
            draft" went, because the sentence has two jobs and that was the
            third. `truncate` rather than a wrap: in the roadmap's narrow panel
            it would otherwise take two lines back, and a footnote that changes
            height moves the input above it. */}
        {/* **"Can make mistakes" gave up its slot.** The line is `truncate` and
            has to stay one line, so there is room for two clauses and no more.
            The keyword workshop already dropped that clause on the reasoning
            that a "can make mistakes" note under a chat box is one every reader
            has learned to skip; where the transcript is now kept, saying so is
            the clause that is actually load-bearing. */}
        <p className="mt-2 truncate text-xs text-muted">
          Reads your opening chapter. Stays in this browser.
        </p>
      </div>

      {gate.dialogOpen && (
        <LimitDialog action="blurbChat" onClose={gate.closeDialog} />
      )}
    </section>
  );
}

/**
 * The writer's own face, or their initial.
 *
 * The same two-state shape `account-menu.tsx` uses, at chat size: a photograph
 * where the identity provider gave one, and the accent disc with an initial
 * where it did not — which is every email signup, and the common case in
 * development where there is no Supabase project at all. Keyed on the url so a
 * changed photo gets a fresh attempt rather than inheriting the last one's
 * failure, and `onError` falls back rather than leaving a broken image in a
 * conversation.
 */
function Face({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);

  if (url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={url}
        src={url}
        alt=""
        aria-hidden="true"
        width={24}
        height={24}
        onError={() => setFailed(true)}
        // A hairline ring: a photograph can be any colour, including the
        // panel's own, and without an edge it floats.
        className="h-6 w-6 shrink-0 rounded-full object-cover ring-1 ring-line"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full
                 bg-accent text-[0.625rem] font-bold text-accent-ink"
    >
      {initialOf(name)}
    </span>
  );
}

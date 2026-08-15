"use client";

import { useEffect, useRef, useState } from "react";
import { AssistantReply } from "@/components/ui/assistant-reply";
import { CopyButton } from "@/components/ui/copy-button";
import { Spinner } from "@/components/ui/spinner";
import {
  LeftPill,
  LimitDialog,
  LimitNote,
  useLimitGate,
} from "@/components/upgrade/free-limit";
import { STARTERS, type KeywordMessage } from "@/lib/keywords/workshop";
import { spendTotalUse } from "@/lib/library-store";
import { useChatScroll } from "@/lib/use-chat-scroll";
import { usePrefs } from "@/lib/use-library";

/**
 * The keyword conversation.
 *
 * **One door, and it used to be two.** A "Suggest seven from my blurb" button
 * sat above the chat on its own allowance, answering the commonest question in
 * a single press. It was removed: both doors already emptied into one handler in
 * `categories-page.tsx`, and the second one cost a route, a limit, a row on the
 * pricing page and a paragraph in Help to say the same thing the chat says when
 * asked. `STARTERS` carries the sentence, so the cheap answer is still one click
 * — it just spends the allowance the conversation already had.
 *
 * The trade is real and worth naming: somebody who only wanted the boxes filled
 * now spends a third of three conversations rather than a fifth of five. That is
 * the cost of one surface instead of two, and it is the direction this app
 * usually chooses.
 *
 * Everything the model offers goes back to the *page* rather than to the book:
 * it lands in the draft, in empty boxes only, and the save bar at the foot of
 * the window is what commits it. See `workshop.ts` for why the candidates are
 * tagged rather than guessed at, and why the checker under the boxes is also the
 * filter above them.
 *
 * **The conversation is not persisted**, exactly as the assistant's and the
 * blurb workshop's are not. Reloading starts fresh — which is why a use is
 * spent on the *first message* rather than on mount, so opening the screen and
 * reading it costs nothing.
 */

/** What the screen holds. Local, because nothing is stored. */
type Turn = KeywordMessage & { keywords?: string[]; at: number };

/** The name the replies answer under. */
const HELPER = "Keywords";

function clockOf(at: number): string {
  return new Date(at).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function KeywordWorkshop({
  blurb,
  genre,
  categories,
  keywords,
  title,
  subtitle,
  author,
  series,
  onCandidates,
  onUndo,
  canUndo,
  onOpenGuide,
}: {
  /** The description. Nearly all of the signal, and what the press needs. */
  blurb: string;
  genre?: string;
  /** The shelves chosen above, so nothing is suggested that repeats one. */
  categories: readonly string[];
  /** The seven as they stand, so "help me fill the empty ones" can be answered. */
  keywords: readonly string[];
  title: string;
  subtitle?: string;
  author?: string;
  series?: string;
  /** Hands phrases to the page, which fills empty boxes only. Never automatic. */
  onCandidates: (phrases: string[]) => void;
  onUndo: () => void;
  canUndo: boolean;
  /** The way out when nothing here answers: the method, written down. */
  onOpenGuide: () => void;
}) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const listRef = useChatScroll();

  const prefs = usePrefs();
  const chat = useLimitGate({
    action: "keywordChat",
    used: prefs.usedTotal.keywordChat ?? 0,
  });

  // Abandon an in-flight reply if the screen goes.
  useEffect(() => () => abortRef.current?.abort(), []);

  /** What both doors send about the book. Never the manuscript. */
  function book() {
    return {
      blurb,
      genre,
      categories,
      listing: { title, subtitle, author, series },
    };
  }


  async function send(text: string) {
    const said = text.trim();
    if (!said || busy) return;

    /*
     * **A use is one conversation, spent on its first message.** Counting
     * messages would stop a writer mid-thought; counting on mount would charge
     * somebody for opening the screen. The gate is asked before the request
     * and the count written after it lands, so a gateway error cannot cost one
     * of three.
     */
    const starting = turns.length === 0;
    if (starting && !chat.spend()) return;

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
      const response = await fetch("/api/comps/keywords/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          ...book(),
          keywords,
          messages: history.map(({ role, content }) => ({ role, content })),
        }),
      });

      const payload: {
        message?: string;
        keywords?: string[] | null;
        error?: string;
      } = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(payload.error ?? "That did not work. Your keywords are unaffected.");
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
          keywords: payload.keywords ?? undefined,
          // eslint-disable-next-line react-hooks/purity
          at: Date.now(),
        },
      ]);

      if (starting) spendTotalUse("keywordChat");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError("Could not reach it. Check your connection and try again.");
      setTurns(turns);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  const open = chat.dialogOpen ? "keywordChat" : null;

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-line bg-panel">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3">
        <h3 className="text-sm font-semibold text-fg">Work out your seven</h3>
        <LeftPill allowance={chat.allowance} className="ml-auto" />
      </div>

      {/* **The one-press suggestion is gone; the conversation does this now.**
          It sat above the chat as the cheap answer to the commonest question,
          and it was a second door onto the same room — its candidates and the
          chat's went through one handler in `categories-page.tsx`, spent from
          two allowances, and had to be explained twice on the pricing page and
          in Help. One door that answers "suggest seven from my blurb" as a
          sentence is the same feature with half the surface.

          **Undo stays**, because it never belonged to the press: it puts back
          whatever the last batch of candidates replaced, and the chat produces
          those too. Rendered only when there is something to undo — a control
          saying Undo with nothing behind it is the dead UI the house rules
          forbid — so the strip is absent rather than empty most of the time. */}
      {canUndo && (
        <div className="border-b border-line px-4 py-3">
          <button
            type="button"
            onClick={onUndo}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium
                       text-muted hover:border-fg/25 hover:text-fg"
          >
            Undo the last suggestions
          </button>
        </div>
      )}

      {/* The scroll area. `min-h-0` on both this and the section, or a flex
          child with overflow grows the column instead of scrolling in it. */}
      <div
        ref={listRef}
        className="scroll-slim min-h-0 flex-1 overflow-y-auto px-4 py-3"
      >
        {turns.length === 0 ? (
          <div>
            <p className="text-sm leading-relaxed text-muted">
              Ask it what the boxes are for, or work out which seven this book
              should spend them on. It reads what you have typed on this screen
              — never the manuscript.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => void send(starter)}
                  className="rounded-lg border border-line px-3 py-2 text-left text-sm
                             text-fg transition-colors hover:border-fg/25 hover:bg-raised"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="flex flex-col gap-4">
            {turns.map((turn, i) => (
              <li key={i}>
                <div
                  className={`flex items-center gap-2 ${
                    turn.role === "user" ? "flex-row-reverse" : ""
                  }`}
                >
                  <span className="text-xs font-semibold text-fg">
                    {turn.role === "user" ? "You" : HELPER}
                  </span>
                  {/* `tabular-nums`: the times sit under each other down the
                      column, and proportional digits make the edge wander. */}
                  <span className="text-[0.6875rem] text-muted tabular-nums">
                    {clockOf(turn.at)}
                  </span>
                </div>

                {turn.role === "user" ? (
                  <p className="mt-1.5 ml-auto w-fit max-w-[92%] rounded-xl rounded-tr-sm bg-accent px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-accent-ink">
                    {turn.content}
                  </p>
                ) : (
                  /* **Parsed, not printed** — the reply arrives in Markdown,
                     so a bulleted answer showed its asterisks. `copyable` is
                     off for the reason the blurb workshop gives: what is worth
                     taking from this turn is the candidate list below, which
                     has its own controls. */
                  <div className="mt-1.5 w-fit max-w-[92%] rounded-xl rounded-tl-sm border border-line bg-surface px-3 py-2">
                    <AssistantReply text={turn.content} copyable={false} />
                  </div>
                )}

                {/* **The candidates, with the only control that touches the
                    boxes.** Never applied on their own: a model quietly
                    filling somebody's form and presenting the result as theirs
                    is the invisible hand this app refuses everywhere. */}
                {turn.keywords && turn.keywords.length > 0 && (
                  <div className="mt-2.5 rounded-xl border border-accent/30 bg-surface p-3">
                    <ol className="flex flex-col gap-1.5">
                      {turn.keywords.map((phrase) => (
                        <li
                          key={phrase}
                          className="flex items-baseline justify-between gap-2 text-sm text-fg"
                        >
                          <span>{phrase}</span>
                          <span className="flex shrink-0 items-center gap-1">
                            <span className="text-xs text-muted tabular-nums">
                              {phrase.length}
                            </span>
                            {/* **One phrase per press**, which is the rule
                                `CopyButton` was written for: a shop gives seven
                                separate boxes, and a writer taking one of these
                                candidates by hand is retyping fifty characters
                                into a fifty-character field. "Use these" fills
                                the empty boxes here; this is for the one being
                                pasted somewhere else. */}
                            <CopyButton
                              value={phrase}
                              label={`Copy “${phrase}”`}
                              className="text-muted hover:bg-raised hover:text-fg"
                            />
                          </span>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-line pt-2.5">
                      <button
                        type="button"
                        onClick={() => onCandidates(turn.keywords!)}
                        className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink hover:opacity-90"
                      >
                        Use these
                      </button>
                      <span className="text-xs text-muted">
                        Empty boxes only · nothing is saved until you press Save
                      </span>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}

        {busy && (
          <div className="mt-4">
            <span className="text-xs font-semibold text-fg">{HELPER}</span>
            <p className="mt-1.5 flex w-fit items-center gap-2 rounded-xl rounded-tl-sm border border-line bg-surface px-3 py-2 text-sm text-muted">
              <Spinner className="h-4 w-4" />
              Thinking
            </p>
          </div>
        )}

        {/* **A refusal here is where the guide earns its place.** No key
            configured, an allowance spent, a gateway having an afternoon —
            whatever the reason, the writer still has seven empty boxes and a
            book to publish, and "that did not work" on its own leaves them
            there. The method needs none of this and is one press away. */}
        {error && (
          <div
            role="alert"
            className="mt-3 rounded-lg border border-note-line bg-note-bg px-3 py-2 text-xs leading-relaxed text-note-fg"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={onOpenGuide}
              className="mt-2 font-semibold underline decoration-note-line underline-offset-2 hover:no-underline"
            >
              Write the seven by hand instead
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-line px-4 py-3">
        {/* **The stacked note, at every width.** The wide banner is the
            default elsewhere and would be wrong here in the common case: this
            card lives in a 20rem column on any desktop, which is the ~300px
            shape `LimitNote` exists for. Below `lg` the column goes full
            width, but a note that fits everywhere beats one that fits the
            rarer half. */}
        <LimitNote allowance={chat.allowance} className="mb-3" />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="flex items-end gap-2"
        >
          <label htmlFor="keyword-workshop-input" className="sr-only">
            Ask about your keywords
          </label>
          <textarea
            id="keyword-workshop-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter is a newline — what every chat in
              // this app already does.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            placeholder="Ask about the seven…"
            className="scroll-slim max-h-24 min-h-0 flex-1 resize-none rounded-lg border
                       border-line bg-surface px-3 py-2 text-sm text-fg
                       placeholder:text-muted focus:border-accent/40 focus:outline-none"
          />
          <button
            type="submit"
            /* Live even with nothing left, for the reason above. */
            disabled={busy || !input.trim()}
            className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-semibold
                       text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-45"
          >
            Send
          </button>
        </form>

        {/* **What leaves, said before the press**, and cut to the one clause
            that is load-bearing. This route sends no prose, and a writer must
            never discover afterwards that the manuscript went — so that clause
            stays. The other two went: "check each suggestion is true of your
            book" is already said where suggestions land, and "can make
            mistakes" under a chat box is a line every reader has learned to
            skip. Three sentences of footnote under an input is a paragraph
            nobody reads, which loses the one sentence that mattered.
            `/privacy` carries the long version. Add a field to what is sent
            and name it here. */}
        <p className="mt-2 text-[11px] text-muted">
          Reads this screen and your blurb — never the manuscript.
        </p>
      </div>

      {open && (
        <LimitDialog
          action={open}
          onClose={chat.closeDialog}
        />
      )}
    </section>
  );
}

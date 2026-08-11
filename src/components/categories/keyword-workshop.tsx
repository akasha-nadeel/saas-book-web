"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import {
  LeftPill,
  LimitDialog,
  LimitNote,
  useLimitGate,
} from "@/components/upgrade/free-limit";
import { STARTERS, type KeywordMessage } from "@/lib/keywords/workshop";
import { spendTotalUse } from "@/lib/library-store";
import { usePrefs } from "@/lib/use-library";

/**
 * The keyword conversation, and the one press that skips it.
 *
 * **Two model features in one card, because they answer different questions.**
 * The press asks *give me seven from the blurb* — one call, five free, and the
 * whole of what somebody wants when they already know their book and just need
 * the boxes filled. The conversation asks *which seven, and why* — a call per
 * turn, three free, and the only way to answer "is 'cozy mystery' worth a box
 * when it is already my category?" or "what are these boxes even for?". Making
 * the chat the only door would charge a writer a third of their conversations
 * for a job that used to cost a fifth of a cheaper allowance.
 *
 * Everything the model offers, from either door, goes back to the *page* rather
 * than to the book: it lands in the draft, in empty boxes only, and the save
 * bar at the foot of the window is what commits it. See `workshop.ts` for why
 * the candidates are tagged rather than guessed at, and why the checker under
 * the boxes is also the filter above them.
 *
 * **The conversation is not persisted**, exactly as the assistant's and the
 * blurb workshop's are not. Reloading starts fresh — which is why a use is
 * spent on the *first message* rather than on mount, so opening the screen and
 * reading it costs nothing.
 */

/** What the screen holds. Local, because nothing is stored. */
type Turn = KeywordMessage & { keywords?: string[]; at: number };

/** Enough description to be worth a model call; the route enforces the same. */
const MIN_BLURB = 40;

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
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const prefs = usePrefs();
  const chat = useLimitGate({
    action: "keywordChat",
    used: prefs.usedTotal.keywordChat ?? 0,
  });
  const press = useLimitGate({
    action: "keywordsAi",
    used: prefs.usedTotal.keywordsAi ?? 0,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [turns, busy]);

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

  /**
   * The one press: seven candidates from the blurb, no conversation.
   *
   * The blurb is checked here as well as on the server so the refusal arrives
   * without a round trip, and it is checked **before** the gate, so a press
   * that could not have worked never opens the upgrade dialog.
   */
  async function suggest() {
    if (suggesting || busy) return;

    if (blurb.trim().length < MIN_BLURB) {
      setError(
        "Write the blurb first. Keyword suggestions are drawn from your description, and there is not enough of it yet.",
      );
      return;
    }
    if (!press.spend()) return;

    setSuggesting(true);
    setError(null);
    try {
      const response = await fetch("/api/comps/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(book()),
      });
      const data: { keywords?: string[]; error?: string } = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        setError(data.error ?? "That did not work. Try again in a moment.");
        return;
      }

      const found = data.keywords ?? [];
      if (found.length === 0) {
        // Not an error: the checker did its job and nothing survived it. It
        // costs no allowance either, because none was recorded.
        setError(
          "Nothing came back that was not already in your title, your categories or against a shop's rules. Try again, or add more to the blurb.",
        );
        return;
      }

      onCandidates(found);
      // The only place this allowance is recorded — a reply that landed and
      // produced something.
      spendTotalUse("keywordsAi");
    } catch {
      setError("That did not work. Check your connection and try again.");
    } finally {
      setSuggesting(false);
    }
  }

  async function send(text: string) {
    const said = text.trim();
    if (!said || busy || suggesting) return;

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

  const open = chat.dialogOpen ? "keywordChat" : press.dialogOpen ? "keywordsAi" : null;

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-line bg-panel">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3">
        <h3 className="text-sm font-semibold text-fg">Work out your seven</h3>
        <LeftPill allowance={chat.allowance} className="ml-auto" />
      </div>

      {/* **The press, above the conversation and set apart from it.** It is the
          cheap answer to the commonest question on this screen, and a writer
          who wants only that should not have to type a sentence to get it. */}
      <div className="border-b border-line px-4 py-3">
        <button
          type="button"
          onClick={() => void suggest()}
          /* Live with nothing left and live with no blurb: a disabled button
             gives a refusal nowhere to be explained. Only work already in
             flight turns it off. */
          disabled={suggesting || busy}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg
                     bg-accent px-3.5 py-2 text-sm font-semibold text-accent-ink
                     transition-opacity hover:opacity-90 disabled:opacity-45"
        >
          {suggesting ? (
            <>
              <Spinner className="h-4 w-4" />
              Reading your blurb
            </>
          ) : (
            "Suggest seven from my blurb"
          )}
        </button>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
          <LeftPill allowance={press.allowance} />
          {/* Offered only while there is something to undo, and gone as soon
              as it is used: a control that says Undo with nothing behind it is
              the dead UI the house rules forbid. */}
          {canUndo && !suggesting && (
            <button
              type="button"
              onClick={onUndo}
              className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium
                         text-muted hover:border-fg/25 hover:text-fg"
            >
              Undo
            </button>
          )}
        </div>
      </div>

      {/* The scroll area. `min-h-0` on both this and the section, or a flex
          child with overflow grows the column instead of scrolling in it. */}
      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto px-4 py-3">
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

                <p
                  className={
                    turn.role === "user"
                      ? "mt-1.5 ml-auto w-fit max-w-[92%] rounded-xl rounded-tr-sm bg-accent px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-accent-ink"
                      : "mt-1.5 w-fit max-w-[92%] rounded-xl rounded-tl-sm border border-line bg-surface px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-fg"
                  }
                >
                  {turn.content}
                </p>

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
                          <span className="shrink-0 text-xs text-muted tabular-nums">
                            {phrase.length}
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

        <div ref={bottomRef} />
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
            disabled={busy || suggesting || !input.trim()}
            className="shrink-0 rounded-lg bg-accent px-3 py-2 text-sm font-semibold
                       text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-45"
          >
            Send
          </button>
        </form>

        {/* **What leaves, said before the press.** This route sends no prose,
            and saying so is the point: a writer must never discover afterwards
            that the manuscript went. `/privacy` carries the long version. Add
            a field to what is sent and name it here. */}
        <p className="mt-2 text-xs text-muted">
          Reads this screen and your blurb, never the manuscript. Check each
          suggestion is true of your book. Can make mistakes.
        </p>
      </div>

      {open && (
        <LimitDialog
          action={open}
          onClose={open === "keywordChat" ? chat.closeDialog : press.closeDialog}
        />
      )}
    </section>
  );
}

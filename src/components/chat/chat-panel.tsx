"use client";

import { useEffect, useRef, useState } from "react";
import {
  AssistantReply,
  replyText,
} from "@/components/ui/assistant-reply";
import { CopyButton } from "@/components/ui/copy-button";
import { useChatScroll } from "@/lib/use-chat-scroll";

/**
 * The assistant panel.
 *
 * Holds its own conversation in memory — nothing here is persisted, because a
 * chat about a draft is scaffolding, not part of the book. Closing the panel
 * or reloading starts fresh.
 */

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "What isn't working in this chapter?",
  "Tighten the opening paragraph.",
  "What should happen next?",
];

export function ChatPanel({
  chapterTitle,
  getChapterText,
}: {
  chapterTitle: string;
  /** Read lazily: the chapter is only sent when something is actually asked. */
  getChapterText: () => string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const listRef = useChatScroll();

  // Abandon an in-flight reply if the panel closes.
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;

    const history: Message[] = [...messages, { role: "user", content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, chapter: getChapterText() }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const detail = await response
          .json()
          .then((d: { error?: string }) => d.error)
          .catch(() => null);
        setError(detail ?? "The assistant is unavailable.");
        // Drop the empty assistant bubble — there is nothing to show in it.
        setMessages(history);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: reply }]);
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("[chat] failed", err);
      setError("Could not reach the assistant.");
      setMessages(history);
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div ref={listRef} className="scroll-slim flex-1 overflow-y-auto px-3 py-4">
        {messages.length === 0 ? (
          <div className="px-1">
            <p className="font-sans text-sm text-muted">
              Ask about “{chapterTitle}”. The chapter text is sent with your
              question.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-md border border-line px-3 py-2 text-left
                             font-sans text-sm text-muted outline-none
                             transition-colors hover:border-accent/50
                             hover:text-fg focus-visible:ring-2
                             focus-visible:ring-accent/60"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="flex flex-col gap-4">
            {messages.map((message, i) =>
              message.role === "user" ? (
                <li
                  key={i}
                  className="rounded-md bg-raised px-3 py-2 font-sans text-sm text-fg"
                >
                  {message.content}
                </li>
              ) : (
                /* **The reply is parsed rather than printed.** It arrives in
                   Markdown — every model answers that way unprompted — so
                   printing it put `* **Tightening:**` on screen with the
                   asterisks in it. `group` is what reveals the copy control
                   below. */
                <li key={i} className="group px-1 font-sans">
                  {message.content ? (
                    <>
                      <AssistantReply text={message.content} />
                      {/* **Copy the whole reply**, beside the per-block
                          buttons `AssistantReply` draws on offered prose. The
                          two answer different questions — take this passage,
                          or take all of it — and this one only appears once
                          the reply has finished, since copying a half-written
                          answer is a paste somebody has to redo.

                          Held open on hover, focus *within* (so it can be
                          reached by keyboard), and while it is saying
                          "Copied" — which is why `focus-within` is on the row
                          rather than `focus` on the button. */}
                      {!(busy && i === messages.length - 1) && (
                        <div className="mt-1 flex justify-end opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                          <CopyButton
                            value={replyText(message.content)}
                            label="Copy the whole reply"
                            className="text-muted hover:bg-raised hover:text-fg"
                          />
                        </div>
                      )}
                    </>
                  ) : busy && i === messages.length - 1 ? (
                    <span className="text-sm text-muted">Thinking…</span>
                  ) : null}
                </li>
              ),
            )}
          </ol>
        )}

        {error && (
          <p className="mt-4 rounded-md border border-accent/40 px-3 py-2 font-sans text-sm text-muted">
            {error}
          </p>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="border-t border-line p-3"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter is a newline, as in every chat box.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder="Ask about this chapter…"
          rows={3}
          className="w-full resize-none rounded-md border border-line bg-surface
                     px-3 py-2 font-sans text-sm text-fg placeholder:text-muted
                     focus-visible:border-accent focus-visible:outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              abortRef.current?.abort();
              setMessages([]);
              setError(null);
            }}
            disabled={messages.length === 0}
            className="rounded-md font-sans text-xs text-muted outline-none
                       disabled:opacity-30 hover:text-fg focus-visible:ring-2
                       focus-visible:ring-accent/60"
          >
            Clear
          </button>
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-md bg-accent px-3 py-1.5 font-sans text-sm
                       font-semibold text-accent-ink outline-none transition-colors
                       disabled:opacity-30 hover:bg-accent-strong
                       focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            {busy ? "…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

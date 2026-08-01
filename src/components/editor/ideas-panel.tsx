"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  addIdea,
  IDEA_MAX,
  removeIdea,
  titleFromIdea,
  type Idea,
} from "@/lib/ideas";
import { createBook, saveIdeasRaw } from "@/lib/library-store";
import { relativeTime } from "@/lib/relative-time";
import { useIdeas } from "@/lib/use-library";

/**
 * The idea parking lot, in the editor's own rail.
 *
 * **Being here is the feature.** Writers describe the shiny new idea arriving
 * mid-draft and stalling book two, and describe writing ideas down on their
 * phone because there is nowhere else. Both are the same problem: the idea
 * nags until it is captured, and if capturing it means leaving the book, then
 * leaving *is* the interruption. One box, one key, still in the chapter.
 *
 * Parked, not started. An idea here is not a book — it has no shelf entry and
 * costs nothing to keep. Turning every stray thought into a book is how a shelf
 * fills with eleven abandoned first chapters, which is its own pain further
 * down the research. The "Start a book" button exists for the one that turns
 * out to be real, and it is the writer who decides which.
 */
export function IdeasPanel({ bookId }: { bookId?: string }) {
  const ideas = useIdeas();
  const [text, setText] = useState("");
  const router = useRouter();

  function commit(next: Idea[]) {
    saveIdeasRaw(JSON.stringify(next));
  }

  function capture() {
    const clean = text.trim();
    if (!clean) return;
    commit(
      addIdea(ideas, clean, {
        id: crypto.randomUUID(),
        at: Date.now(),
        ...(bookId ? { from: bookId } : {}),
      }),
    );
    setText("");
  }

  return (
    <div className="flex h-full flex-col">
      <form
        className="border-b border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          capture();
        }}
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter commits, Shift+Enter makes a new line. Ten seconds means
            // not reaching for the mouse.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              capture();
            }
          }}
          rows={3}
          maxLength={IDEA_MAX}
          placeholder="The idea that is not this book…"
          aria-label="Park an idea"
          className="w-full resize-none rounded-lg border border-line bg-surface p-2.5
                     font-sans text-sm text-fg outline-none
                     focus-visible:ring-2 focus-visible:ring-accent/50"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="font-sans text-[11px] text-muted">
            Enter to park it
          </span>
          <button
            type="submit"
            disabled={!text.trim()}
            className="rounded-md bg-accent px-3 py-1.5 font-sans text-xs font-semibold
                       text-white disabled:opacity-40"
          >
            Park it
          </button>
        </div>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {ideas.length === 0 ? (
          <p className="font-sans text-sm text-muted">
            Nothing parked. When the next book barges in halfway through this
            one, put it here and carry on.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ideas.map((idea) => (
              <li
                key={idea.id}
                className="rounded-lg border border-line bg-panel p-3"
              >
                <p className="font-sans text-sm leading-relaxed text-fg">
                  {idea.text}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <span className="font-sans text-[11px] text-muted">
                    {relativeTime(idea.at)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const { bookId: made } = createBook(titleFromIdea(idea.text));
                      commit(removeIdea(ideas, idea.id));
                      router.push(`/book/${made}`);
                    }}
                    className="font-sans text-[11px] font-semibold text-accent"
                  >
                    Start a book
                  </button>
                  <button
                    type="button"
                    onClick={() => commit(removeIdea(ideas, idea.id))}
                    className="ml-auto font-sans text-[11px] text-muted"
                  >
                    Forget it
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

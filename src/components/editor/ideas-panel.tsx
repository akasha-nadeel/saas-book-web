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
import {
  booksAgainstPlan,
  createBook,
  saveIdeasRaw,
} from "@/lib/library-store";
import { LAUNCH_LIMITS, onFreePlan } from "@/lib/launch";
import { relativeTime } from "@/lib/relative-time";
import { EmptyState } from "@/components/ui/empty-state";
import { ListGroup, RowAction, SectionHeader } from "@/components/ui/list";
import {
  LeftPill,
  LimitDialog,
  LimitNote,
  useLimitGate,
} from "@/components/upgrade/free-limit";
import { UpgradeDialog } from "@/components/upgrade/upgrade-dialog";
import { useIdeas, useShelf } from "@/lib/use-library";
import { usePlan } from "@/lib/use-plan";

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

  /*
   * **Starting a book from an idea is a new book, and the free plan counts
   * books.** This called `createBook` straight away, which walked past the
   * limit `new-book-form.tsx` keeps: the book appeared here and Postgres then
   * refused to take it. Same test as that form, through `onFreePlan`, and the
   * same dialog, opened on the press.
   */
  const shelf = useShelf();
  const plan = usePlan();
  const [full, setFull] = useState(false);
  const shelfFull =
    onFreePlan(plan) && booksAgainstPlan(shelf).length >= LAUNCH_LIMITS.freeBooks;

  /*
   * **Free parks five at a time; Pro has no ceiling** (2026-09-16). Occupancy,
   * like advance readers: handed the list's length, so forgetting an idea or
   * starting a book from one makes room, and nothing already parked is hidden.
   */
  const gate = useLimitGate({ action: "ideas", items: ideas.length });

  function commit(next: Idea[]) {
    saveIdeasRaw(JSON.stringify(next));
  }

  function capture() {
    const clean = text.trim();
    if (!clean) return;
    // Refused before anything is written, and the words stay in the box — a
    // writer told there is no room has not lost the idea they just typed.
    if (!gate.spend()) return;
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
      {full && <UpgradeDialog reason="books" onClose={() => setFull(false)} />}
      {gate.dialogOpen && (
        <LimitDialog action="ideas" onClose={gate.closeDialog} />
      )}
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
          /* Filled rather than outlined, like every other field in the pass:
             an outlined box on a panel is one more box on a screen made of
             them. */
          className="scroll-slim w-full resize-none rounded-[10px] bg-raised p-2.5
                     font-sans text-[13px] text-fg outline-none
                     placeholder:text-muted focus:ring-2 focus:ring-accent/50"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="font-sans text-[11px] text-muted">
            Enter to park it
          </span>
          <span className="flex items-center gap-2">
            <LeftPill allowance={gate.allowance} />
            <button
              type="submit"
              disabled={!text.trim()}
              className="rounded-[10px] bg-accent px-3 py-1.5 font-sans text-[13px]
                         font-semibold text-accent-ink transition-opacity
                         hover:opacity-90 disabled:opacity-40"
            >
              Park it
            </button>
          </span>
        </div>
        {/* The stacked note rather than the wide banner: this panel is also
            the editor rail's, about three hundred pixels across. It stands
            while the lot is full, as every occupancy limit's notice does. */}
        <LimitNote allowance={gate.allowance} className="mt-3" />
      </form>

      <div className="scroll-slim min-h-0 flex-1 overflow-y-auto p-3">
        {ideas.length === 0 ? (
          <EmptyState
            glyph={
              <>
                <path d="M9 18h6M10 21h4" />
                <path d="M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6V16h5.4v-.5c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3Z" />
              </>
            }
            title="Nothing parked"
          >
            When the next book barges in halfway through this one, put it here
            and carry on.
          </EmptyState>
        ) : (
          <>
            <SectionHeader trailing={ideas.length}>Parked</SectionHeader>
            {/* One group, where each idea was its own bordered card. */}
            <ListGroup as="ul">
              {ideas.map((idea) => (
                <li key={idea.id} className="px-3.5 py-3">
                  <p className="font-sans text-[13px] leading-relaxed text-fg">
                    {idea.text}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="font-sans text-[11px] text-muted">
                      {relativeTime(idea.at)}
                    </span>
                    <span className="ml-auto flex items-center gap-1.5">
                      <RowAction
                        onClick={() => {
                          if (shelfFull) {
                            setFull(true);
                            return;
                          }
                          const { bookId: made } = createBook(
                            titleFromIdea(idea.text),
                          );
                          commit(removeIdea(ideas, idea.id));
                          router.push(`/book/${made}`);
                        }}
                      >
                        Start a book
                      </RowAction>
                      <button
                        type="button"
                        onClick={() => commit(removeIdea(ideas, idea.id))}
                        className="rounded-[7px] px-2 py-1 font-sans text-[11px]
                                   font-semibold text-muted outline-none
                                   transition-colors hover:bg-raised hover:text-fg
                                   focus-visible:ring-2 focus-visible:ring-accent/60"
                      >
                        Forget it
                      </button>
                    </span>
                  </div>
                </li>
              ))}
            </ListGroup>
          </>
        )}
      </div>
    </div>
  );
}

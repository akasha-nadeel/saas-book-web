"use client";

import { Button } from "@/components/ui/button";
import { Divider, DialogClose, Shell } from "@/components/ui/dialog";
import { diffCounts, diffWords } from "@/lib/editor/text-diff";
import { plural } from "@/lib/plural";

/**
 * The approval step in front of a replacement.
 *
 * **A replacement destroys words, and this is the only thing standing between
 * the model and somebody's prose.** An insertion adds and can be read after the
 * fact; a replacement is gone the moment it lands, and a card asking "replace
 * this paragraph?" would be asking a writer to approve a change they have not
 * been shown. So the diff *is* the question — the words leaving struck through
 * beside the words arriving — and Apply is the answer.
 *
 * **The passage on the page is highlighted before this opens**, so the two
 * halves of the question are both visible: what is about to change, and where
 * it is. See `ChatPanel`.
 *
 * The whole change is one transaction, so one press of undo puts it back, and
 * the chapter's version is kept first. The card says so rather than leaving a
 * writer to hope — it is the sentence that makes Apply pressable.
 */
export function ApplyReview({
  before,
  after,
  onApply,
  onClose,
}: {
  /** The writer's own words, as they stand. */
  before: string;
  /** What the assistant is offering in their place. */
  after: string;
  onApply: () => void;
  onClose: () => void;
}) {
  const parts = diffWords(before, after);
  const { added, removed } = diffCounts(parts);

  return (
    <Shell onClose={onClose} width="w-[34rem]">
      <DialogClose onClose={onClose} />

      <h2 className="pr-8 font-serif text-xl text-tremor-content-strong">
        Replace the selected passage?
      </h2>

      {/* **A fact, with its unit, and no verdict about it.** How much moves is
          worth knowing before pressing; whether that is a good change is the
          writer's to say and not this card's. */}
      <p className="mt-2 font-sans text-sm text-tremor-content">
        {removed === 0 && added === 0
          ? "The assistant is offering the passage unchanged."
          : `${plural(removed, "word")} out, ${added} in.`}
      </p>

      {/* The diff itself, set in the manuscript's serif because the words are
          the book's rather than the interface's. `whitespace-pre-wrap` so the
          paragraph breaks the passage carries are the ones shown. */}
      <div
        className="oc-dialog-scroll mt-4 max-h-[42dvh] overflow-y-auto
                   rounded-tremor-small border border-tremor-border
                   bg-tremor-background-muted px-4 py-3 font-serif text-sm
                   leading-relaxed whitespace-pre-wrap"
      >
        {parts.map((part, i) =>
          part.kind === "out" ? (
            /* **Colour is the information here**, which is the one case the
               status family is spent on. Struck as well as coloured, so the
               two sides are still told apart without it. */
            <del
              key={i}
              className="bg-stop-bg text-stop-fg decoration-stop-fg/60 no-underline line-through"
            >
              {part.text}
            </del>
          ) : part.kind === "in" ? (
            <ins key={i} className="bg-ok-bg text-ok-fg no-underline">
              {part.text}
            </ins>
          ) : (
            <span key={i} className="text-tremor-content-emphasis">
              {part.text}
            </span>
          ),
        )}
      </div>

      <p className="mt-3 font-sans text-xs text-tremor-content">
        The version before this change is kept in the chapter&rsquo;s history,
        and one undo puts your words back.
      </p>

      <Divider />

      <div className="oc-dialog-actions flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          /* Autofocused so Return applies and Escape refuses — the habit the
             native dialog gave every other confirmation in the app. */
          autoFocus
          onClick={() => {
            onApply();
            onClose();
          }}
        >
          Replace
        </Button>
      </div>
    </Shell>
  );
}

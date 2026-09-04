"use client";

import { Menu, MenuButton } from "@/components/ui/menu";
import { shelfIcons } from "@/components/shelf/shelf-icons";
import { CREDIT_COST } from "@/lib/billing/credits";
import { CHAT_MODELS, MODEL_NAMES, type ChatModel } from "@/lib/chat-model";

/**
 * Which model the next question goes to — "Quick · 10 ⌄", opening a menu.
 *
 * **It was three segments spelled out in full**, a `role="radiogroup"` track
 * reading `Quick 10 | Careful 30 | Deep 100` on a row of its own above the box.
 * That is most of a 240px rail spent on a setting a writer changes rarely, and
 * it could only ever grow worse: a fourth model would not fit at all.
 *
 * **The trigger keeps the cost, and that is a deliberate departure from the
 * design this follows.** Gemini's model chip shows a name alone, because
 * choosing a model there spends nothing. Here it spends a balance, so the price
 * of the next reply is worth the eight characters — right up until the rail is
 * at its narrowest, where the cost stands down and the name stays. See the
 * container query below.
 *
 * **The rows say what a reply costs and how long it takes, never which model is
 * cleverer.** On a Google deployment all three are the same id, so "more
 * capable" would be false on half the installations — the same rule `ai.ts` and
 * `plan-rows.ts` are both written under. The wording is shared with the Help
 * dialog's own description of the three; keep them in step.
 */

/**
 * What each model is like to use, in the one dimension that is true everywhere.
 *
 * Wait, not intelligence — see above. These are the words the retired
 * radiogroup carried in its `title` attributes, moved somewhere a touch user
 * can actually read them.
 */
const WAIT: Record<ChatModel, string> = {
  quick: "Answers straight away",
  careful: "Thinks first, so it takes longer",
  deep: "Takes the longest and looks hardest",
};

export function ModelMenu({
  value,
  balance,
  onChange,
}: {
  value: ChatModel;
  /**
   * What is left to spend, or `null` where nothing is metered.
   *
   * `null` is the self-hosted deployment running on its owner's own key: every
   * model is affordable and none is marked.
   */
  balance: number | null;
  onChange: (next: ChatModel) => void;
}) {
  const affordable = (model: ChatModel) =>
    balance === null || balance >= CREDIT_COST[model];

  return (
    <Menu
      /* **The value goes in the accessible name.** `aria-label` *replaces* the
         trigger's visible text rather than adding to it, so without this a
         screen reader hears "menu, collapsed" and is never told which model is
         selected — which the retired radiogroup announced on every segment. */
      label={`Assistant model: ${MODEL_NAMES[value]}, ${CREDIT_COST[value]} credits a reply`}
      align="end"
      /* 264 rather than the default 224: at 224 every hint below wraps to three
         lines and the menu reads as six rows rather than three. */
      width={264}
      /* Deliberately not `view-menu.tsx`'s trigger classes. That pill is ~130px
         with its border and `text-sm`, and three of those plus the microphone
         and Send overflow the composer's foot at `--sidebar-width: 15rem` on
         the first render. This one is ~111px, which fits by about eleven
         pixels — hence the stand-down below. */
      triggerClassName="flex shrink-0 items-center gap-1 rounded-md px-2 py-1
                        font-sans text-xs text-muted outline-none
                        transition-colors hover:bg-raised hover:text-fg
                        focus-visible:ring-2 focus-visible:ring-accent/60"
      trigger={
        <>
          {MODEL_NAMES[value]}
          {/* **The cost stands down before the name does.** Eleven pixels is
              not a margin, and "· 10 ⌄" without a name says nothing while
              "Quick ⌄" still says which model is answering. The figure survives
              in every row of the menu, which is where the three are actually
              compared. Same stand-down the write switch's label makes, against
              the same container. */}
          <span className="hidden @[15rem]:inline">
            &middot; {CREDIT_COST[value]}
          </span>
          <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">
            {shelfIcons.chevron}
          </span>
        </>
      }
    >
      {(close) => (
        <>
          {CHAT_MODELS.map((model) => {
            const canAfford = affordable(model);
            /* **The model already chosen is never marked unaffordable.** A
               writer whose balance has fallen below their own setting should
               still see it ticked rather than find their choice greyed out
               under them — the same predicate the retired radiogroup used. */
            const off = !canAfford && model !== value;

            return (
              <MenuButton
                key={model}
                checked={model === value}
                disabled={off}
                badge={model === value ? shelfIcons.check : undefined}
                hint={
                  off
                    ? `${CREDIT_COST[model]} credits — more than you have left`
                    : `${CREDIT_COST[model]} credits · ${WAIT[model]}`
                }
                onClick={() => {
                  onChange(model);
                  close();
                }}
              >
                {MODEL_NAMES[model]}
              </MenuButton>
            );
          })}
        </>
      )}
    </Menu>
  );
}

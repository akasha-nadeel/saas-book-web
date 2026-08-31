"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";

/**
 * Asking a question without handing it to the browser.
 *
 * **Nine calls to `window.prompt` and `window.confirm` used to do this**, and
 * the objection is not only that they are unstyled in an app this careful about
 * its surfaces. They fail, and they fail silently: after a few prompts Chrome
 * offers *"Prevent this page from creating additional dialogs"*, and once that
 * is ticked `window.prompt` returns `null` for the rest of the session.
 * Renaming a chapter then does nothing at all, with no error and nothing on
 * screen to explain it — a writer would conclude the app is broken, and be
 * right.
 *
 * They are also blocking. The call sites read as though a value simply arrives,
 * which is what made them so easy to reach for and what makes replacing them a
 * change of shape rather than of markup: a question becomes state.
 *
 * **`ui/` is deliberately narrow and things land here on the third copy.** Nine
 * is well past it.
 *
 * Built on the native `<dialog>` with `showModal()`, following
 * `import-mode-dialog.tsx` — the pattern already in this codebase. That is not
 * laziness: it brings focus trapping, focus restoration, the top layer and
 * Escape-to-close with no code, and those are exactly the parts a hand-rolled
 * modal gets wrong.
 *
 * ---
 *
 * **The slot order every dialog here follows**, so they cannot each invent one:
 *
 *     <DialogClose />        the cross, top right
 *     <h2>                   the question
 *     <p>                    the consequence, in plain words
 *     …fields…
 *     <Divider />
 *     <div class="oc-dialog-actions">   cancel, then the action
 */
export function Shell({
  onClose,
  width = "w-[26rem]",
  align = "center",
  children,
}: {
  onClose: () => void;
  /**
   * Where the dialog sits in the window.
   *
   * Centred for a question, which is the usual case. **`"top"` is for a search
   * panel**, where the results grow downwards as the writer types: centred, the
   * whole panel would jump up the screen on every keystroke as it got taller,
   * and the field they are typing into would move under the caret.
   */
  align?: "center" | "top";
  /**
   * The dialog's own width class.
   *
   * A prop rather than a fixed size because the dialogs genuinely differ — a
   * confirmation is 26rem and the share sheet is far wider — and the thing
   * worth centralising is not the number but everything around it. Several
   * dialogs had hand-rolled their own `<dialog>` purely to change this one
   * class, and lost `oc-dialog-scroll` and `data-dialog-presentation` on the
   * way, which is why they never became bottom sheets on a phone.
   */
  width?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      data-dialog-presentation="sheet"
      onClose={onClose}
      /* The backdrop is the dialog's own box, so a click that lands on the
         element itself rather than on anything inside it is a click outside. */
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      /* `bg-tremor-background` rather than `bg-panel`: this is the dialog
         palette, and the scrim under it is what lets a different ground read
         as a surface of its own. See the note in `globals.css`. */
      className={`oc-dialog ${
        align === "top" ? "mx-auto mt-[10vh] mb-auto" : "m-auto"
      } ${width} max-w-[calc(100vw-2rem)] rounded-lg
                  bg-tremor-background p-0 text-tremor-content-strong
                  backdrop:bg-black/70`}
    >
      {/* `relative` so the close cross has something to sit in the corner of,
         and `oc-dialog-scroll` because `globals.css` uses it to cap the height
         at 78dvh and to turn this into a bottom sheet on a phone. Dropping
         that class breaks every dialog on a narrow screen. */}
      <div className="oc-dialog-scroll relative p-6">{children}</div>
    </dialog>
  );
}

/**
 * The cross, top right.
 *
 * Ten dialogs had drawn their own, each with its own classes and its own
 * guess at whether it needed a label. It is the only control in that corner
 * and it carries no text, so `aria-label` is not decoration — without it a
 * screen reader announces a button called nothing.
 */
export function DialogClose({
  onClose,
  corner = true,
}: {
  onClose: () => void;
  /**
   * Whether to place itself in the top-right corner.
   *
   * True for the dialogs that overlay it on their content, which needs a
   * `relative` ancestor. **False where the dialog has a real header row** —
   * `help-dialog.tsx` sets the cross with `justify-between` beside its title,
   * and an absolutely positioned child there would leave the flex row and
   * anchor to whatever happens to be positioned further up.
   */
  corner?: boolean;
}) {
  const button = (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClose}
      aria-label="Close"
      className="px-2 py-2"
    >
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        className="size-5 shrink-0"
        aria-hidden="true"
      >
        <path d="M5 5l10 10M15 5L5 15" />
      </svg>
    </Button>
  );

  if (!corner) return button;
  return <div className="absolute right-0 top-0 pr-3 pt-3">{button}</div>;
}

/** The rule above an action row. */
export function Divider({ className = "" }: { className?: string }) {
  return (
    <hr
      className={`my-6 h-px border-0 bg-tremor-border ${className}`}
      aria-hidden="true"
    />
  );
}

/**
 * A question with two answers, one of which does something irreversible.
 *
 * The confirming button is red rather than the brand, because blue here means
 * *the way forward* and deleting a chapter is not that. Pass `danger={false}`
 * for a question that is merely irreversible.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel = "Delete",
  danger = true,
  onConfirm,
  onClose,
}: {
  title: string;
  /** The consequence, said plainly. Optional: some questions are their own. */
  body?: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Shell onClose={onClose}>
      <DialogClose onClose={onClose} />

      <h2 className="pr-8 font-serif text-xl text-tremor-content-strong">
        {title}
      </h2>
      {body && (
        <div className="mt-2 font-sans text-sm leading-6 text-tremor-content">
          {body}
        </div>
      )}

      <Divider />

      <div className="oc-dialog-actions flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          /* Autofocused so Return answers the question and Escape refuses it,
             which is what the native dialog did and the one habit worth
             keeping from it. */
          autoFocus
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </Shell>
  );
}

/**
 * A question answered with a line of text.
 *
 * **Empty is a refusal, not an answer**, which is the one rule every caller
 * shared when this was `window.prompt`: a blank title left the chapter alone.
 * Enforced here so no call site has to remember it — the button disables and
 * Return does nothing.
 */
export function PromptDialog({
  title,
  label,
  initial = "",
  confirmLabel = "Save",
  placeholder,
  onRemove,
  removeLabel = "Remove",
  onSubmit,
  onClose,
}: {
  title: string;
  /** The field's own label. Read out, and shown when it says more than the
   *  heading does. */
  label: string;
  initial?: string;
  confirmLabel?: string;
  placeholder?: string;
  /**
   * A third answer: take the existing value away.
   *
   * **The link dialog needs it and a rename does not.** `window.prompt` had
   * only two answers, so removing a link was done by clearing the field and
   * pressing OK — a gesture nothing on screen mentioned, and one this dialog
   * would otherwise read as a refusal. A button says it instead.
   */
  onRemove?: () => void;
  removeLabel?: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  const trimmed = value.trim();

  return (
    <Shell onClose={onClose}>
      <DialogClose onClose={onClose} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!trimmed) return;
          onSubmit(trimmed);
          onClose();
        }}
      >
        <h2 className="pr-8 font-serif text-xl text-tremor-content-strong">
          {title}
        </h2>

        <TextInput
          label={label}
          className="mt-4"
          /* Autofocused and selected: the commonest answer is a small edit to
             what is already there, and the second commonest is replacing it
             outright. Selecting serves both. */
          autoFocus
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
        />

        <Divider />

        <div className="oc-dialog-actions flex items-center justify-end gap-2">
          {onRemove && (
            /* Left of the pair, and set apart: it is a third answer rather than
               a second cancel, and putting it beside Save would make the two
               destructive-looking buttons neighbours. */
            <Button
              variant="secondary"
              className="mr-auto"
              onClick={() => {
                onRemove();
                onClose();
              }}
            >
              {removeLabel}
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!trimmed}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Shell>
  );
}

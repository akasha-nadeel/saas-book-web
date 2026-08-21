"use client";

import { useEffect, useRef, useState } from "react";

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
 */
function Shell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      /* The backdrop is the dialog's own box, so a click that lands on the
         element itself rather than on anything inside it is a click outside. */
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[26rem] max-w-[calc(100vw-2rem)] rounded-lg bg-panel
                 p-0 text-fg backdrop:bg-black/70"
    >
      <div className="p-6">{children}</div>
    </dialog>
  );
}

const CANCEL =
  "rounded-md px-4 py-2 font-sans text-sm font-medium text-muted outline-none " +
  "transition-colors hover:bg-raised hover:text-fg " +
  "focus-visible:ring-2 focus-visible:ring-accent/60";

/**
 * A question with two answers, one of which does something irreversible.
 *
 * The confirming button wears `bg-danger` rather than the accent, because the
 * accent in this app means *the way forward* and deleting a chapter is not
 * that. Pass `danger={false}` for a question that is merely irreversible.
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
      <h2 className="font-serif text-xl">{title}</h2>
      {body && (
        <div className="mt-3 font-sans text-sm leading-relaxed text-muted">
          {body}
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={CANCEL}>
          Cancel
        </button>
        <button
          type="button"
          /* Autofocused so Return answers the question and Escape refuses it,
             which is what the native dialog did and the one habit worth
             keeping from it. */
          autoFocus
          onClick={() => {
            onConfirm();
            onClose();
          }}
          className={`rounded-md px-4 py-2 font-sans text-sm font-semibold outline-none
                      transition-colors focus-visible:ring-2 ${
                        danger
                          /* `text-accent-ink` on a danger fill, which is what `collab-area`
                             already does: the ink token inverts with the theme
                             and a literal white would vanish in daylight. */
                          ? "bg-danger text-accent-ink hover:opacity-90 focus-visible:ring-danger/60"
                          : "bg-accent text-accent-ink hover:bg-accent-strong focus-visible:ring-accent/60"
                      }`}
        >
          {confirmLabel}
        </button>
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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!trimmed) return;
          onSubmit(trimmed);
          onClose();
        }}
      >
        <h2 className="font-serif text-xl">{title}</h2>

        <label className="mt-4 block font-sans text-xs font-medium text-muted">
          {label}
          <input
            /* Autofocused and selected: the commonest answer is a small edit to
               what is already there, and the second commonest is replacing it
               outright. Selecting serves both. */
            autoFocus
            value={value}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2
                       font-sans text-sm text-fg outline-none
                       focus-visible:border-accent focus-visible:ring-2
                       focus-visible:ring-accent/40"
          />
        </label>

        <div className="mt-6 flex items-center justify-end gap-2">
          {onRemove && (
            /* Left of the pair, and set apart: it is a third answer rather than
               a second cancel, and putting it beside Save would make the two
               destructive-looking buttons neighbours. */
            <button
              type="button"
              onClick={() => {
                onRemove();
                onClose();
              }}
              className={`mr-auto ${CANCEL}`}
            >
              {removeLabel}
            </button>
          )}
          <button type="button" onClick={onClose} className={CANCEL}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={!trimmed}
            className="rounded-md bg-accent px-4 py-2 font-sans text-sm font-semibold
                       text-accent-ink outline-none transition-colors
                       hover:bg-accent-strong disabled:opacity-40
                       focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </Shell>
  );
}

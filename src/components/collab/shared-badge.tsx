import { canWriteBook, isSharedBook, type Book } from "@/lib/library-store";
import { ROLE_LABELS } from "@/lib/collab";

/**
 * "This book is not yours, and here is what you may do with it."
 *
 * A writer who accepts an invitation lands inside somebody else's manuscript,
 * and until now nothing on any screen said so. That is the failure every
 * product with sharing in it solves the same way, because the two questions a
 * borrowed document raises are always the same pair: *whose is this* and *what
 * am I allowed to do*. GitHub answers the first by making the owner part of the
 * name — `owner/repo`, never just `repo`. Google Docs answers the second with a
 * mode chip that says Editing or Viewing, and Figma with "can view" beside the
 * file. None of them make it a dialog, and none of them make you go looking.
 *
 * Three things follow from that, and they are the whole of this component.
 *
 * **It is a state, not a warning.** The status tokens carry it — `note` for a
 * viewer, plain chrome for an editor — because a red banner over somebody's
 * co-writing invitation reads as an error, and being on a shared book is the
 * feature working. Nothing here is dismissible for the same reason: it is a
 * fact about the book that stays true, and a fact you can dismiss is one the
 * reader has to remember instead.
 *
 * **A viewer's is louder than an editor's, because a viewer's UI lies.** The
 * editing controls are gated by `canWriteBook`, so a reader who does not know
 * their role meets a manuscript that silently refuses to take a keystroke —
 * which is indistinguishable from a bug. An editor needs to be told once; a
 * viewer needs to be told wherever they might try to type.
 *
 * **Nothing renders for an ordinary book.** `isSharedBook` is false for
 * anything with no role — a book written offline, or before there was an
 * account — so the writer's own shelf gains no chrome at all.
 */
export function SharedBadge({
  book,
  className = "",
}: {
  book: Book;
  className?: string;
}) {
  if (!isSharedBook(book)) return null;

  const readOnly = !canWriteBook(book);
  const role = book.role ? ROLE_LABELS[book.role].label : "Shared";

  /*
   * **A tint, a hairline of the same hue, and ink of that hue** — the shape the
   * pricing table's value badges take, and the reason those tokens are borrowed
   * rather than a fifth hue invented: they are already stated in both theme
   * blocks and already measured (6.4:1 by day, 10:1 at night), and a second
   * blue three shades off the first is how a palette starts lying.
   *
   * Blue for a shared book and `note` amber for a read-only one: one shape,
   * two hues, the distinction the status family already makes. A viewer's
   * editing controls are gone, so their badge is the only thing on screen
   * explaining a manuscript that will not take a keystroke — it should not look
   * identical to the badge that means "carry on writing".
   */
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1
                  font-sans text-xs font-semibold ${
                    readOnly
                      ? "border-note-line bg-note-bg text-note-fg"
                      : "border-badge-blue-line bg-badge-blue-bg text-badge-blue-ink"
                  } ${className}`}
    >
      <ShareMark />
      {/* The word "Shared" first and the role second: whose book it is comes
          before what may be done to it, which is the order a reader arriving
          from an invitation needs them in. */}
      Shared · {readOnly ? "Read only" : role}
    </span>
  );
}

/**
 * Two people, drawn rather than imported.
 *
 * `currentColor` so it takes whichever of the two tints above it is sitting in,
 * the rule `Spinner` follows — a fixed colour would be invisible in exactly one
 * theme.
 */
function ShareMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="6" cy="5.5" r="2.5" />
      <path d="M1.5 13.5c0-2.2 2-4 4.5-4s4.5 1.8 4.5 4" />
      <path d="M11 3.4a2.5 2.5 0 0 1 0 4.2M12.6 9.9c1.2.6 1.9 1.8 1.9 3.1" />
    </svg>
  );
}

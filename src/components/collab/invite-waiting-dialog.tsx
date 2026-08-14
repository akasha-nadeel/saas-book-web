"use client";

import { useEffect, useRef } from "react";
import { ROLE_LABELS, type Member } from "@/lib/collab";
import { timeUntil } from "@/lib/relative-time";

/**
 * "Somebody has put you on a book" — told once, on arrival.
 *
 * Without this, an invitation is only found by a writer who thinks to open
 * Collaborators, which is the one screen somebody who has never collaborated has
 * no reason to visit. An email goes out too, but mail is filtered, delayed and
 * sent to mistyped addresses — and this reader is, by definition, already signed
 * in and looking at the product. That is what earns an interruption: it is news
 * with a deadline that the other channel may never have delivered.
 *
 * **Once per browser session, and that rule is the whole of its manners.** An
 * invitation is not urgent enough to meet on every navigation, and a dialog that
 * returns each time you press Home stops being news and becomes something to
 * dismiss without reading — which is exactly how a real invitation gets missed.
 * Dismissal is remembered in `sessionStorage`, not `localStorage`: forever is too
 * long for a decision somebody has not made yet, and a fresh tab tomorrow should
 * mention it again. (The store's localStorage-only rule is about the *library*;
 * this is a transient fact about one tab, and belongs nowhere near it.)
 *
 * **"Later" is a real answer**, a button rather than only a cross, and Escape and
 * the backdrop mean the same thing. Nothing is lost by it — the invitation keeps
 * its full life and the Collaborators area still holds it, which the dialog says
 * rather than leaving to be guessed.
 */
const SEEN_KEY = "openchapter:invites-seen";

/** Ids already shown in this tab, so a second invitation still interrupts. */
function alreadySeen(ids: string[]): boolean {
  try {
    const seen = new Set(
      JSON.parse(window.sessionStorage.getItem(SEEN_KEY) ?? "[]") as string[],
    );
    return ids.every((id) => seen.has(id));
  } catch {
    return false;
  }
}

function remember(ids: string[]) {
  try {
    const seen = new Set(
      JSON.parse(window.sessionStorage.getItem(SEEN_KEY) ?? "[]") as string[],
    );
    for (const id of ids) seen.add(id);
    window.sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    // A browser refusing sessionStorage costs one extra mention. Not worth a
    // failure path.
  }
}

/** True when these invitations are worth interrupting for. Read before mounting. */
export function shouldAnnounce(invites: readonly Member[]): boolean {
  if (invites.length === 0) return false;
  if (typeof window === "undefined") return false;
  return !alreadySeen(invites.map((m) => m.id));
}

export function InviteWaitingDialog({
  invites,
  onSee,
  onClose,
}: {
  invites: readonly Member[];
  /** Go to the Collaborators area, where they can accept. */
  onSee: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
    // Marked as met on *open*, not on dismissal: closing by Escape or by the
    // backdrop must count too, or those two routes make it reappear forever.
    remember(invites.map((m) => m.id));
  }, [invites]);

  const one = invites.length === 1 ? invites[0] : null;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="invite-waiting-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[28rem] max-w-[calc(100vw-2rem)] rounded-2xl border
                 border-line bg-panel p-0 text-fg backdrop:bg-black/50"
    >
      <div className="px-6 pt-6 pb-5">
        {/* `step` — the palette's indigo, and its documented meaning is "the way
            forward". An invitation is neither a problem nor a result; it is a
            next move, which is the one thing that token exists to say. It is
            also what the card in the Collaborators area wears, so the two read
            as the same thing in two places. */}
        <span
          aria-hidden="true"
          className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-full
                     bg-step-bg text-step-fg"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
            <path d="m3 6 6.3 4.6a1.2 1.2 0 0 0 1.4 0L17 6" />
          </svg>
        </span>

        <h2 id="invite-waiting-title" className="text-lg font-bold text-fg">
          {one
            ? "You've been invited to a book"
            : `You've been invited to ${invites.length} books`}
        </h2>

        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          {one ? (
            <>
              Somebody has put you on their book as{" "}
              <strong className="font-semibold text-fg">
                {ROLE_LABELS[one.role].label.toLowerCase()}
              </strong>
              . It expires {timeUntil(one.expiresAt)}.
            </>
          ) : (
            <>
              Somebody has put you on their books. The first expires{" "}
              {timeUntil(Math.min(...invites.map((m) => m.expiresAt)))}.
            </>
          )}
        </p>

        {/* The book's title is deliberately absent, and this is not a gap: a
            pending invitee has no read access to that book yet — which is the
            whole point of a pending invitation granting nothing. It arrives on
            acceptance. Inventing one, or widening the policy to fetch it, would
            both be worse than saying less. */}
        <p className="mt-3 rounded-lg border border-line bg-raised px-3 py-2 text-xs text-muted">
          Sent to{" "}
          <strong className="font-medium text-fg">
            {one ? one.email : invites[0]?.email}
          </strong>
          . Accepting puts the book on your shelf and keeps it in step with the
          owner&rsquo;s copy.
        </p>
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-line px-4 py-2 text-sm font-medium
                     text-fg transition-colors hover:bg-raised"
        >
          Later
        </button>
        <button
          type="button"
          onClick={onSee}
          className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold
                     text-accent-ink transition-opacity hover:opacity-90"
        >
          {one ? "See the invitation" : "See them"}
        </button>
      </div>
    </dialog>
  );
}

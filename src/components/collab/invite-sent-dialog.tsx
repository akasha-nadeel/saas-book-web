"use client";

import { useEffect, useRef, useState } from "react";
import { INVITE_DAYS, ROLE_LABELS, type CollabRole } from "@/lib/collab";

/**
 * What happens the moment an invitation exists.
 *
 * **It does not say "sent", because nothing was sent.** This app has no
 * transactional email — Supabase Auth mails its own links and nothing else does
 * — so the writer is the delivery mechanism, and a green tick reading "Invitation
 * sent" would be the app taking credit for a job it has just handed back. The
 * headline says *ready*, and the next line says who has to carry it.
 *
 * That is also why this is a dialog rather than a toast. A toast is right when
 * the work is finished and the message is a receipt; here the work is *not*
 * finished until the link is somewhere the other person can reach, and a
 * notification that slides away after four seconds taking the only copy of that
 * link with it is a quietly broken feature. The link is the point, so it gets the
 * interruption.
 *
 * It is still cheap to leave: Escape, the backdrop, the ×, and a Done button. And
 * nothing is lost by leaving — the row in the share dialog keeps its own Copy
 * link, and the invitation shows up in the invitee's own Collaborators area when
 * they next sign in. Both of those are said here, so closing this is an informed
 * choice rather than a gamble.
 */
export function InviteSentDialog({
  email,
  role,
  link,
  onClose,
}: {
  email: string;
  role: CollabRole;
  /** Path only — the origin is added here, where `window` exists. */
  link: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  const url =
    typeof window === "undefined" ? link : `${window.location.origin}${link}`;

  useEffect(() => {
    dialogRef.current?.showModal();
    /*
     * The link is selected on open, so a writer whose clipboard is blocked — a
     * non-secure origin, a locked-down browser — can press Ctrl+C and be done,
     * rather than having to work out that the button failed them.
     */
    fieldRef.current?.select();
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setFailed(false);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setFailed(true);
      fieldRef.current?.select();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="invite-sent-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[30rem] max-w-[calc(100vw-2rem)] rounded-2xl border
                 border-line bg-panel p-0 text-fg backdrop:bg-black/50"
    >
      <div className="px-6 pt-6 pb-5">
        {/* A mark rather than a heading alone: this is a *result*, and a result
            with nothing to distinguish it from the form it came from reads as
            another step. `ok` is the status family's all-clear — the one place
            in this palette a hue means something without being taught. */}
        <span
          aria-hidden="true"
          className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-full
                     bg-ok-bg text-ok-fg"
        >
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="m4.5 10.5 3.5 3.5 7.5-8" />
          </svg>
        </span>

        <h2 id="invite-sent-title" className="text-lg font-bold text-fg">
          Their invitation is ready
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          <strong className="font-semibold text-fg">{email}</strong> will be able
          to {ROLE_LABELS[role].label.replace(/^Can /, "")} this book once they
          accept.
        </p>

        {/* The link, and the sentence that explains why the writer is holding it.
            Stated plainly rather than apologised for: it is a deliberate design,
            and it is also why a forwarded link grants nobody anything. */}
        <p className="mt-4 text-sm font-semibold text-fg">
          We don&rsquo;t send email — pass this on yourself
        </p>
        <div className="mt-1.5 flex gap-2">
          <input
            ref={fieldRef}
            readOnly
            value={url}
            aria-label="Invitation link"
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3
                       py-2 font-mono text-xs text-fg outline-none
                       focus-visible:ring-2 focus-visible:ring-accent/50"
          />
          <button
            type="button"
            onClick={() => void copy()}
            className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold
                       text-accent-ink transition-opacity hover:opacity-90"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        {failed && (
          <p role="alert" className="mt-2 text-xs text-note-fg">
            This browser wouldn&rsquo;t let us reach the clipboard. The link is
            selected — press Ctrl+C.
          </p>
        )}

        <ul className="mt-4 space-y-1.5 text-xs leading-relaxed text-muted">
          <li>
            It works only for <strong className="text-fg">{email}</strong>, so
            forwarding it gives nobody else access.
          </li>
          <li>It lasts {INVITE_DAYS} days.</li>
          {/* The line that makes closing this safe rather than a gamble. */}
          <li>
            If the link goes astray, it also appears under Collaborators when they
            next sign in — and you can copy it again from this book&rsquo;s share
            list.
          </li>
        </ul>
      </div>

      <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold
                     text-accent-ink transition-opacity hover:opacity-90"
        >
          Done
        </button>
      </div>
    </dialog>
  );
}

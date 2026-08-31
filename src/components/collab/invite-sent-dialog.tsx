"use client";

import { useEffect, useRef, useState } from "react";
import { INVITE_DAYS, ROLE_LABELS, type CollabRole } from "@/lib/collab";
import { Button } from "@/components/ui/button";

/**
 * What happens the moment an invitation exists.
 *
 * **It says "sent" only when something was sent**, which is the whole of the
 * discipline here. For most of this feature's life nothing was: the writer was
 * the delivery mechanism, and a green tick reading "Invitation sent" would have
 * been the app taking credit for a job it had just handed back. Mail exists now
 * — see `email/invite.ts` — but it is best-effort by design, so the headline is
 * decided by `emailed`, a fact the server established, rather than by the
 * feature having been switched on somewhere.
 *
 * The failure case is the one that matters, and it is not an error: the
 * invitation is real, the seat is spent, and the co-writer can still get in.
 * Only the notification failed. So a mail that did not go is reported in
 * `note`'s amber — worth doing something about — never in `stop`'s red, and the
 * something is right there: the link, already selected.
 *
 * **The link is offered either way, and that is not belt-and-braces.** Every
 * product this is measured against does both, because the two fail in different
 * places: mail is filtered, delayed and mistyped; a link needs a channel to
 * travel down. What changes with `emailed` is the *emphasis* — a heading and a
 * sentence — never whether the link is there.
 *
 * That is also why this is a dialog rather than a toast. A toast is right when
 * the work is finished and the message is a receipt; when the mail did not go
 * the work is *not* finished until the link is somewhere the other person can
 * reach, and a notification that slides away after four seconds taking the only
 * copy of that link with it is a quietly broken feature.
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
  emailed,
  onClose,
}: {
  email: string;
  role: CollabRole;
  /** Path only — the origin is added here, where `window` exists. */
  link: string;
  /**
   * Whether the invitation email actually left. Established by the server and
   * passed down rather than inferred from configuration: "a provider is set
   * up" and "this message went" are different claims, and only the second one
   * earns the word *sent*.
   */
  emailed: boolean;
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
                 border-tremor-border bg-tremor-background p-0 text-tremor-content-strong backdrop:bg-black/50"
    >
      <div className="px-6 pt-6 pb-5">
        {/* A mark rather than a heading alone: this is a *result*, and a result
            with nothing to distinguish it from the form it came from reads as
            another step. `ok` is the status family's all-clear — the one place
            in this palette a hue means something without being taught. */}
        {/* The status family carries the difference, which is what it is for:
            green where everything happened, amber where something is left for
            the owner to do. Never red — nothing failed that costs anybody
            access. */}
        <span
          aria-hidden="true"
          className={`mb-3.5 flex h-10 w-10 items-center justify-center rounded-full ${
            emailed ? "bg-ok-bg text-ok-fg" : "bg-note-bg text-note-fg"
          }`}
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

        <h2 id="invite-sent-title" className="text-lg font-bold text-tremor-content-strong">
          {emailed ? "Invitation sent" : "Their invitation is ready"}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-tremor-content">
          <strong className="font-semibold text-tremor-content-strong">{email}</strong> will be
          able to {ROLE_LABELS[role].label.replace(/^Can /, "")} this book once
          they accept.
        </p>

        {/* The link, and the sentence that explains why the writer is holding
            it. Two readings of the same control: a spare when the mail went, and
            the way through when it did not. */}
        <p className="mt-4 text-sm font-semibold text-tremor-content-strong">
          {emailed
            ? "Or send them the link yourself"
            : "We couldn’t email them — send this link instead"}
        </p>
        <div className="mt-1.5 flex gap-2">
          <input
            ref={fieldRef}
            readOnly
            value={url}
            aria-label="Invitation link"
            onFocus={(e) => e.currentTarget.select()}
            className="min-w-0 flex-1 rounded-lg border border-tremor-border bg-tremor-background-muted px-3
                       py-2 font-mono text-xs text-tremor-content-strong outline-none
                       focus-visible:ring-2 focus-visible:ring-accent/50"
          />
          <Button onClick={() => void copy()} className="shrink-0">
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        {failed && (
          <p role="alert" className="mt-2 text-xs text-note-fg">
            This browser wouldn&rsquo;t let us reach the clipboard. The link is
            selected — press Ctrl+C.
          </p>
        )}

        <ul className="mt-4 space-y-1.5 text-xs leading-relaxed text-tremor-content">
          <li>
            It works only for <strong className="text-tremor-content-strong">{email}</strong>, so
            forwarding it gives nobody else access.
          </li>
          <li>It lasts {INVITE_DAYS} days.</li>
          {/* The line that makes closing this safe rather than a gamble. */}
          <li>
            {/*
              **One template literal, not an expression followed by prose.**

              This read "italso appears" in production. JSX trims a multi-line
              text node line by line, and the *leading* space of its first line
              goes with the trim — so `{expr} also appears under\nCollaborators`
              compiled to `[expr, "also appears under Collaborators…"]`, two
              adjacent strings with nothing between them. Nothing in the source
              looks wrong; it is only visible in the built bundle, which is
              where it was caught.

              `{" "}` is the usual remedy and Prettier reformatted it straight
              back out again, restoring the bug. Building the whole sentence as
              one string has no JSX whitespace to trim and nothing for a
              formatter to rearrange.
            */}
            {`${
              emailed ? "If the email goes astray, it" : "It"
            } also appears under Collaborators when they next sign in — and you can copy the link again from this book’s share list.`}
          </li>
        </ul>
      </div>

      <div className="flex justify-end gap-2 border-t border-tremor-border px-6 py-4">
        <Button onClick={onClose}>
          Done
        </Button>
      </div>
    </dialog>
  );
}

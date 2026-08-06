"use client";

import { useState } from "react";
import Link from "next/link";
import { acceptInvite, declineInvite, type InviteOffer } from "@/app/collab/actions";
import { INVITE_DAYS, ROLE_LABELS } from "@/lib/collab";
import { Spinner } from "@/components/ui/spinner";

/**
 * "Somebody wants you on their book."
 *
 * A standalone page rather than a dialog, because it is the first thing a stranger
 * to this app may ever see — arriving from a link somebody sent them — and it has
 * to stand on its own with no shelf behind it.
 *
 * Four states, and the third is the one worth building carefully:
 *
 *   - the link resolves to nothing (wrong, or the invitation was cancelled),
 *   - it resolves but is expired or already answered,
 *   - it resolves and is for **somebody else's address**,
 *   - it is theirs, and they can accept.
 *
 * The wrong-address case says *which* address it is for, because the commonest
 * version of it is a writer with two Google accounts who is signed into the other
 * one — and "that invitation is for somebody else" with no further help sends them
 * away for good. It does not offer a sign-out button pointed at the invitation,
 * though: switching accounts mid-flow is the writer's business, and a control that
 * signed them out of a session holding unsaved work would be worse than a sentence.
 *
 * `h-dvh overflow-y-auto` because `<body>` is `overflow-hidden` for the editor
 * shell — `min-h-dvh` would put the buttons out of reach on a short window.
 */
export function AcceptInvite({
  token,
  offer,
}: {
  token: string;
  offer: InviteOffer | null;
}) {
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);

  async function accept() {
    setBusy("accept");
    setProblem(null);
    const result = await acceptInvite(token);
    setBusy(null);
    if ("error" in result) {
      setProblem(result.error);
      return;
    }
    setDone("accepted");
  }

  async function decline() {
    setBusy("decline");
    setProblem(null);
    const result = await declineInvite(token);
    setBusy(null);
    if ("error" in result) {
      setProblem(result.error);
      return;
    }
    setDone("declined");
  }

  return (
    <main className="h-dvh overflow-y-auto bg-surface">
      <div className="mx-auto flex min-h-full max-w-lg items-center px-6 py-12">
        <div className="w-full rounded-2xl border border-line bg-panel p-6 sm:p-8">
          {done === "accepted" ? (
            <>
              <h1 className="text-xl font-bold text-fg">
                You&rsquo;re on {offer?.bookTitle ?? "the book"}.
              </h1>
              <p className="mt-2 text-sm text-muted">
                It&rsquo;s on your shelf now. Anything you write syncs back to
                whoever owns it.
              </p>
              {/* **A full navigation, and the lint rule is overridden knowingly.**
                  The book they have just accepted reaches this browser through
                  `syncWithServer()`, which `LibrarySync` runs once per mount of
                  the root layout. A `<Link>` is a client-side transition: the
                  layout does not remount, the sync never runs, and they land on a
                  shelf that has not been told about the book they were just
                  promised. Every other internal link in this app should stay a
                  `<Link>`. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/"
                className="mt-6 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm
                           font-semibold text-accent-ink"
              >
                Open my shelf
              </a>
            </>
          ) : done === "declined" ? (
            <>
              <h1 className="text-xl font-bold text-fg">That&rsquo;s declined.</h1>
              <p className="mt-2 text-sm text-muted">
                Nobody has been told. If it was a mistake, ask them to invite you
                again.
              </p>
              <Link
                href="/"
                className="mt-6 inline-block rounded-lg border border-line px-5 py-2.5
                           text-sm font-semibold text-fg hover:bg-raised"
              >
                Go to my shelf
              </Link>
            </>
          ) : !offer ? (
            <>
              <h1 className="text-xl font-bold text-fg">
                This invitation isn&rsquo;t there any more.
              </h1>
              <p className="mt-2 text-sm text-muted">
                The link may be mistyped, or the invitation may have been
                cancelled. Ask whoever sent it for a new one — they last{" "}
                {INVITE_DAYS} days.
              </p>
              <Link
                href="/"
                className="mt-6 inline-block rounded-lg border border-line px-5 py-2.5
                           text-sm font-semibold text-fg hover:bg-raised"
              >
                Go to my shelf
              </Link>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                An invitation
              </p>
              <h1 className="mt-2 text-xl font-bold text-fg">
                You&rsquo;ve been asked to join{" "}
                <span className="text-accent">{offer.bookTitle}</span>
              </h1>
              <p className="mt-3 text-sm text-fg">
                As <strong>{ROLE_LABELS[offer.role].label.toLowerCase()}</strong> —{" "}
                {ROLE_LABELS[offer.role].what.toLowerCase()}
              </p>

              <p className="mt-4 rounded-xl border border-line bg-raised px-4 py-3 text-xs text-muted">
                Sent to <strong className="text-fg">{offer.invitedEmail}</strong>.
                {!offer.forMe && !offer.problem && (
                  <>
                    {" "}
                    You&rsquo;re signed in as a different account, so this
                    invitation can&rsquo;t be accepted here. Sign in as that
                    address and open the link again.
                  </>
                )}
              </p>

              {offer.problem && (
                <p role="alert" className="mt-3 text-sm text-note-fg">
                  {offer.problem}
                </p>
              )}

              {offer.forMe && !offer.problem && (
                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void accept()}
                    className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5
                               text-sm font-semibold text-accent-ink disabled:opacity-60"
                  >
                    {busy === "accept" && <Spinner className="h-3.5 w-3.5" />}
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void decline()}
                    className="rounded-lg border border-line px-5 py-2.5 text-sm
                               font-semibold text-fg hover:bg-raised disabled:opacity-60"
                  >
                    Decline
                  </button>
                </div>
              )}

              {problem && (
                <p role="alert" className="mt-3 text-sm text-stop-fg">
                  {problem}
                </p>
              )}

              <p className="mt-6 border-t border-line pt-4 text-xs leading-relaxed text-muted">
                Accepting puts the book on your shelf and keeps it in step with
                the owner&rsquo;s copy. Their story bible, advance readers,
                ledger and writing record do not travel — none of those sync, for
                anybody.
              </p>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

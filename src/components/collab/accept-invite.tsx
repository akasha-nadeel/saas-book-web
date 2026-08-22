"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  acceptInvite,
  declineInvite,
  resendConfirmation,
  type InviteOffer,
} from "@/app/collab/actions";
import { signOut } from "@/app/auth/actions";
import { INVITE_DAYS, ROLE_LABELS } from "@/lib/collab";
import { syncWithServer } from "@/lib/library-store";
import { Spinner } from "@/components/ui/spinner";

/**
 * "Somebody wants you on their book."
 *
 * A standalone page rather than a dialog, because it is the first thing a
 * stranger to this app may ever see — arriving from a link somebody sent them —
 * and it has to stand on its own with no shelf behind it.
 *
 * **One rule holds the whole screen together: every state ends in exactly one
 * control.** An invitation link is opened by somebody who was sent it, usually
 * once, often on a phone, and whatever it resolves to they need a way onward. It
 * did not always work that way — three states used to end in a sentence and
 * nothing to press, which is the shape of screen a reader closes the tab on.
 * Seven states, each with its one way out:
 *
 *   - the link resolves to nothing (mistyped, or the invitation was cancelled),
 *   - they already took it up — **open the book**, rather than being told the
 *     token has been used,
 *   - their address is not confirmed yet — **send it again**, the one blocked
 *     state a reader can clear without anybody else acting,
 *   - it is expired or already answered by somebody else,
 *   - it is for **another address** — name both, and offer the switch,
 *   - it is theirs, and they can accept,
 *   - they declined.
 *
 * **Accepting has no "done" state, because it leaves.** It used to end on a card
 * saying "you're on the book" over a button to the shelf — a screen whose whole
 * content was a click, shown to somebody who had just followed a link, signed in
 * and pressed Accept precisely so they could reach the book. Now it opens the
 * book. Declining keeps its card: there is nowhere else for that one to go.
 *
 * **The wrong-address case carries a Switch account button, and for a while it
 * deliberately did not.** The argument against was that signing somebody out
 * mid-flow could strand unsaved work — a real worry, but it protected nothing:
 * the account menu already offers sign-out with the identical consequence, so
 * refusing it *here* removed the way out without removing the hazard, and left
 * the one screen where switching is the entire point as a paragraph telling
 * somebody to go and do it themselves. That is the pattern every large product
 * settled on — Entra asks "you are signed in as X; however Y was invited, do you
 * want to switch?" — and the products that leave it out are the ones whose
 * support pages tell people to open the link in a private window.
 *
 * Two details make that one work rather than merely exist. It carries `next`
 * back to this invitation, or they sign in correctly and land on a shelf with no
 * memory of the link they were opening. And **the address is named beside the
 * button rather than inside it**: an email address is not a verb, and a label
 * reading "Sign in as somebody@somewhere.example" sets the button's width from
 * data rather than from its job, wrapping on a phone and dwarfing every other
 * control on the card.
 *
 * `h-dvh overflow-y-auto` because `<body>` is `overflow-hidden` for the editor
 * shell — `min-h-dvh` would put the buttons out of reach on a short window.
 */

const PRIMARY =
  "flex items-center justify-center gap-2 rounded-lg bg-accent px-5 py-2.5 " +
  "text-sm font-semibold text-accent-ink disabled:opacity-60";

const SECONDARY =
  "flex items-center justify-center gap-2 rounded-lg border border-line px-5 " +
  "py-2.5 text-sm font-semibold text-fg hover:bg-raised disabled:opacity-60";

type Busy = "accept" | "decline" | "open" | "resend" | null;

export function AcceptInvite({
  token,
  offer,
  viaLink = false,
}: {
  token: string;
  offer: InviteOffer | null;
  /**
   * They followed the invitation and signed in *for* it. See the page component
   * for where this comes from and why forging it buys nothing.
   */
  viaLink?: boolean;
}) {
  const [busy, setBusy] = useState<Busy>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);
  const [resent, setResent] = useState(false);

  /**
   * Open the book, having made sure this browser actually has it.
   *
   * **The sync is awaited before leaving, and that is what makes this work.**
   * Membership lives on the server; the book reaches *this browser* only through
   * `syncWithServer()`. Navigating straight to `/book/<id>` would arrive at a
   * screen reading the local shelf, which has never heard of it — a not-found
   * flash that repairs itself a moment later, which is worse than the
   * confirmation screen this replaced.
   *
   * A sync failure is swallowed rather than blocking: the membership is real
   * either way, and the full navigation runs `LibrarySync` again on arrival. A
   * full navigation rather than a client transition for that same reason — a
   * `<Link>` does not remount the root layout, so the sync never runs.
   *
   * `busy` is deliberately left set: the spinner runs until the browser leaves.
   */
  async function openBook(bookId: string) {
    await syncWithServer().catch(() => {});
    window.location.href = `/book/${bookId}`;
  }

  async function accept() {
    if (!offer) return;

    setBusy("accept");
    setProblem(null);

    const result = await acceptInvite(token);
    if ("error" in result) {
      setBusy(null);
      setProblem(result.error);
      return;
    }

    await openBook(offer.bookId);
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
    setDeclined(true);
  }

  /**
   * Take it up without asking, when signing in *was* the asking.
   *
   * **The one effect on this page, and it is the right tool rather than the
   * usual mistake.** The house rule is that a consequential thing opens on a
   * press and never from an effect, because an effect fires again on a remount
   * and repeats itself. That rule is about things the writer did not ask for;
   * here the request arrived in the URL, so there is no press to hang it on and
   * no other moment to act. The `started` ref is what keeps it honest: it fires
   * once per mount at most, which also absorbs React's double-invoke in
   * development.
   *
   * It runs only on the branch that would otherwise draw Accept — theirs, open,
   * confirmed, unanswered. Every other state falls through to its own card, so
   * a marker on an expired or wrong-account link changes nothing.
   *
   * A failure is not swallowed: `accept()` puts the error on screen and leaves
   * the card standing with both buttons, so an auto-accept that could not go
   * through degrades into exactly the screen it was skipping.
   */
  const started = useRef(false);
  const canAuto =
    viaLink &&
    Boolean(offer?.forMe) &&
    !offer?.problem &&
    !offer?.alreadyMember &&
    !declined;

  /** True from the very first render, so the offer card is never drawn. */
  const joining = canAuto && problem === null;

  useEffect(() => {
    if (!canAuto || started.current) return;
    started.current = true;
    void accept();
    // `accept` is stable for this mount's props, and the ref makes re-entry a
    // no-op regardless — listing it would only widen the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canAuto]);

  async function resend() {
    setBusy("resend");
    setProblem(null);

    const result = await resendConfirmation();
    setBusy(null);

    if ("error" in result) {
      setProblem(result.error);
      return;
    }
    setResent(true);
  }

  return (
    <main className="h-[var(--oc-layout-height)] overflow-y-auto bg-surface pb-(--oc-safe-bottom)">
      <div className="mx-auto flex min-h-full max-w-lg items-center px-6 py-12">
        <div className="w-full rounded-2xl border border-line bg-panel p-6 sm:p-8">
          {/* Drawn from the first render rather than when the effect fires, so
              the card it replaces is never painted at all — a flash of Accept
              followed by a spinner would be the question we decided not to ask,
              asked and withdrawn. */}
          {joining && offer ? (
            <Joining title={offer.bookTitle} />
          ) : declined ? (
            <Terminal
              title="That’s declined."
              body={
                <>
                  Nobody has been told. If it was a mistake, ask them to invite
                  you again.
                </>
              }
            />
          ) : !offer ? (
            <Terminal
              title="This invitation isn’t there any more."
              body={
                <>
                  The link may be mistyped, or the invitation may have been
                  cancelled. Ask whoever sent it for a new one — they last{" "}
                  {INVITE_DAYS} days.
                </>
              }
            />
          ) : (
            <>
              <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                An invitation
              </p>
              <h1 className="mt-2 text-xl font-bold text-fg">
                {offer.alreadyMember ? (
                  <>
                    You’re already on{" "}
                    <span className="text-accent">{offer.bookTitle}</span>
                  </>
                ) : (
                  <>
                    You’ve been asked to join{" "}
                    <span className="text-accent">{offer.bookTitle}</span>
                  </>
                )}
              </h1>
              <p className="mt-3 text-sm text-fg">
                As{" "}
                <strong>{ROLE_LABELS[offer.role].label.toLowerCase()}</strong> —{" "}
                {ROLE_LABELS[offer.role].what.toLowerCase()}
              </p>

              {/* ---- already a member: the link has done its job ---- */}
              {offer.alreadyMember ? (
                <>
                  <p className="mt-4 text-sm text-muted">
                    You took this invitation up already, so the book is yours to
                    open.
                  </p>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void openBook(offer.bookId)}
                    className={`mt-5 w-full sm:w-auto ${PRIMARY}`}
                  >
                    {busy === "open" && <Spinner className="h-3.5 w-3.5" />}
                    Open the book
                  </button>
                </>
              ) : /* ---- unconfirmed address: the one they can clear ---- */
              offer.needsConfirmation ? (
                <>
                  <p className="mt-4 text-sm text-fg">
                    Confirm your email address first. We sent a link to{" "}
                    <span className="font-semibold">{offer.invitedEmail}</span>{" "}
                    when you signed up — open it, then come back here.
                  </p>
                  {resent ? (
                    <p className="mt-5 text-sm text-ok-fg">
                      Sent again. It can take a minute, and it may be in spam.
                    </p>
                  ) : (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void resend()}
                      className={`mt-5 w-full sm:w-auto ${PRIMARY}`}
                    >
                      {busy === "resend" && <Spinner className="h-3.5 w-3.5" />}
                      Send it again
                    </button>
                  )}
                </>
              ) : /* ---- expired, cancelled, answered by somebody else ---- */
              offer.problem ? (
                <>
                  <p role="alert" className="mt-4 text-sm text-note-fg">
                    {offer.problem}
                  </p>
                  <ShelfLink className="mt-5" />
                </>
              ) : /* ---- signed in as the wrong account ---- */
              !offer.forMe ? (
                <div className="mt-5 rounded-xl border border-line bg-raised p-4">
                  <p className="text-sm text-fg">
                    This invitation is for{" "}
                    <strong className="font-semibold">
                      {offer.invitedEmail}
                    </strong>
                    .
                  </p>
                  {offer.signedInAs && (
                    <p className="mt-1 text-sm text-muted">
                      You’re signed in as {offer.signedInAs}.
                    </p>
                  )}

                  {/* A Server Action in a form, the shape the account menu's
                      sign-out already takes. `next` and `email` ride as hidden
                      inputs and are guarded server-side — they reach the
                      browser, so they are attacker-shaped like any other. */}
                  <form action={signOut} className="mt-4 flex justify-center">
                    {/* `via=link` for the same reason the proxy sets it:
                        pressing this *is* signing in to take the invitation up,
                        so coming back should not ask again. */}
                    <input
                      type="hidden"
                      name="next"
                      value={`/invite/${token}?via=link`}
                    />
                    <input
                      type="hidden"
                      name="email"
                      value={offer.invitedEmail}
                    />
                    <button
                      type="submit"
                      className={`w-full sm:w-auto ${PRIMARY}`}
                    >
                      Sign in
                    </button>
                  </form>

                  <p className="mt-3 text-sm text-muted">
                    You’ll be signed out first, then sign in as{" "}
                    <span className="font-semibold text-fg">
                      {offer.invitedEmail}
                    </span>
                    .
                  </p>
                </div>
              ) : (
                /* ---- theirs, and open to accept ---- */
                <>
                  {/* The address at the moment of pressing, because accepting
                      binds the book to *this* account — the one thing somebody
                      with two of them would want to check. It is not restated
                      in a panel above: they proved they own it by signing in. */}
                  <p className="mt-6 text-xs text-muted">
                    Accepting as{" "}
                    <span className="font-semibold text-fg">
                      {offer.invitedEmail}
                    </span>
                    .
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void accept()}
                      className={PRIMARY}
                    >
                      {busy === "accept" && <Spinner className="h-3.5 w-3.5" />}
                      Accept
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void decline()}
                      className={SECONDARY}
                    >
                      Decline
                    </button>
                  </div>
                </>
              )}

              {problem && (
                <p role="alert" className="mt-4 text-sm text-stop-fg">
                  {problem}
                </p>
              )}

              {/* What accepting actually does, and what does not travel with it.
                  Only shown where accepting is still on the table — on the other
                  branches it describes a decision nobody is being asked to make. */}
              {offer.forMe && !offer.problem && !offer.alreadyMember && (
                <p className="mt-6 border-t border-line pt-4 text-xs leading-relaxed text-muted">
                  Accepting puts the book on your shelf and keeps it in step
                  with the owner’s copy. Their story bible, advance readers,
                  ledger and writing record do not travel — none of those sync,
                  for anybody.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

/**
 * The whole screen while an invitation takes itself up.
 *
 * It names the book, because this is the only confirmation that path will ever
 * show and a spinner alone leaves somebody who mistrusted the link none the
 * wiser about what they just joined. It is over in the time the accept and the
 * sync take, and it ends by leaving.
 */
function Joining({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3">
      <Spinner className="h-4 w-4" />
      <p className="text-sm text-fg">
        Joining <span className="font-semibold">{title}</span>…
      </p>
    </div>
  );
}

/** A resolved end of the road: what happened, and the one way on. */
function Terminal({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <>
      <h1 className="text-xl font-bold text-fg">{title}</h1>
      <p className="mt-2 text-sm text-muted">{body}</p>
      <ShelfLink className="mt-6" />
    </>
  );
}

function ShelfLink({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex ${SECONDARY} ${className}`}>
      Go to my shelf
    </Link>
  );
}

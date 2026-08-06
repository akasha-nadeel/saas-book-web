"use client";

import { useEffect, useRef, useState } from "react";
import {
  changeRole,
  inviteLink,
  inviteMember,
  removeMember,
} from "@/app/collab/actions";
import {
  COLLAB_ROLES,
  INVITE_DAYS,
  inviteProblem,
  memberState,
  normalizeEmail,
  ROLE_LABELS,
  seatsUsed,
  type CollabRole,
  type Member,
} from "@/lib/collab";
import { seatAllowance, spentLine } from "@/lib/free-limits";
import { relativeTime, timeUntil } from "@/lib/relative-time";
import { useMembers } from "@/lib/use-collab";
import { usePlan } from "@/lib/use-plan";
import { LeftPill, LimitBanner, LimitDialog } from "@/components/upgrade/free-limit";
import { Spinner } from "@/components/ui/spinner";
import { Menu, MenuButton, MenuSeparator } from "@/components/ui/menu";
import { InviteSentDialog } from "./invite-sent-dialog";

/**
 * Who is on this book, and the one place that changes.
 *
 * **One dialog, not a screen**, because that is where every product that does this
 * well puts it: the roles are changed in place from a dropdown beside the person's
 * name, and Remove is the last item in the same dropdown. Nobody — Google, Notion,
 * Figma, Dropbox, GitHub — has a separate management page, and the reason is that
 * sharing is a thing you do *to a book* while looking at it.
 *
 * Three things about it are deliberate.
 *
 * **Nothing here writes to Postgres.** Every mutation is a Server Action holding
 * the secret key, because `book_members` grants the browser a column-limited
 * `select` and nothing else. So each control awaits an action and then refreshes
 * the list; there is no optimistic update, and there should not be — the seat cap
 * is enforced in SQL under a row lock, so the answer to "did that work" genuinely
 * is the server's to give.
 *
 * **The link is copied, never emailed.** This app sends no transactional mail —
 * Supabase Auth sends its own and nothing else does — so the owner gets a link to
 * pass on however they like, and the invitation also appears in the invitee's own
 * dashboard. Nowhere may this say an email was sent. The link is a *pointer, not a
 * credential*: accepting requires being signed in as the invited address with it
 * confirmed, so a forwarded link grants nothing.
 *
 * **It says what a co-writer will not get.** The tool stores do not sync, so a
 * collaborator sees none of the owner's story bible, advance readers, ledger or
 * writing record. Every screen in this app that has that hole says so, and this is
 * the screen where somebody is deciding to rely on it.
 */
export function ShareDialog({
  bookId,
  bookTitle,
  onClose,
}: {
  bookId: string;
  bookTitle: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { members, loading, error, refresh } = useMembers(bookId);
  const plan = usePlan();

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CollabRole>("editor");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [showLimit, setShowLimit] = useState(false);
  /*
   * The invitation that has just been made, held so its link can be handed over.
   *
   * It used to be copied to the clipboard silently and confirmed with a green
   * line, which is a receipt for a job that is not finished: no email is sent, so
   * until that link reaches somebody the invitation has gone nowhere. The dialog
   * is what makes the handover the visible last step rather than a side effect.
   */
  const [sent, setSent] = useState<{
    email: string;
    role: CollabRole;
    link: string;
  } | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  /*
   * Loading counts as entitled, like `ProGate` — half a second of a paywall shown
   * to somebody who is paying is the screenshot nobody wants.
   *
   * **But it must not print a number.** That rule is about suppressing a *wall*,
   * and applying it to a figure made this dialog flash "1 of 10" at a free
   * account before settling on "1 of 2" — an invented number, on screen, which is
   * the one thing this app does not do. So the count waits until both halves are
   * known: the plan, and the list it is counting. Enforcement is unaffected either
   * way, because the cap is applied by the database under a row lock.
   */
  const pro = plan.loading || plan.pro;
  const known = !plan.loading && !loading;
  const allowance = seatAllowance(seatsUsed(members), pro);

  async function invite() {
    const wrong = inviteProblem(email, { ownerEmail: null, members });
    if (wrong) {
      setProblem(wrong);
      return;
    }

    /*
     * **Refused before the request, and the dialog fires here and only here.**
     *
     * Never from an effect watching `allowance.blocked`: that would also fire on
     * arrival for an owner whose book filled up last week, which is a paywall
     * shown to somebody who pressed nothing. The press is what earns it.
     */
    if (allowance.blocked) {
      setProblem(null);
      if (!pro) setShowLimit(true);
      else setProblem(spentLine(allowance));
      return;
    }

    setBusy(true);
    setProblem(null);
    const result = await inviteMember(bookId, email, role);
    setBusy(false);

    if ("error" in result) {
      setProblem(result.error);
      return;
    }
    setEmail("");
    if (result.link) setSent({ email: normalizeEmail(email), role, link: result.link });
    refresh();
  }

  async function copy(link: string, key: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${link}`);
      setCopied(key);
      window.setTimeout(() => setCopied(null), 2500);
    } catch {
      // A browser that refuses the clipboard is not a failure worth a banner;
      // the row still offers the button and the writer can try again.
      setProblem("Could not reach the clipboard. Try the Copy link button again.");
    }
  }

  async function act(run: () => Promise<{ error: string } | { ok: true }>) {
    setBusy(true);
    setProblem(null);
    const result = await run();
    setBusy(false);
    if ("error" in result) setProblem(result.error);
    refresh();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="share-dialog-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[34rem] max-w-[calc(100vw-2rem)]
                 overflow-y-auto rounded-2xl border border-line bg-panel p-0
                 text-fg backdrop:bg-black/50"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-4">
        <div className="min-w-0">
          <h2 id="share-dialog-title" className="text-lg font-bold">
            Share this book
          </h2>
          <p className="mt-0.5 truncate text-sm text-muted">{bookTitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mt-1 shrink-0 rounded-lg px-2.5 py-1.5 text-xl leading-none
                     text-muted hover:bg-raised"
        >
          ×
        </button>
      </div>

      {error ? (
        <div className="px-6 py-8">
          <p className="font-bold text-fg">Sharing isn&rsquo;t set up yet.</p>
          <p className="mt-2 text-sm text-muted">
            The <code>book_members</code> table could not be read. If this is your
            own server, apply{" "}
            <code>supabase/migrations/20260806000000_collaboration.sql</code>.
          </p>
          <p className="mt-3 font-mono text-xs break-words text-muted">{error}</p>
        </div>
      ) : (
        /*
          **The body is the desk; each section is a card on it.**

          Everything used to sit flat on one surface with nothing but a bold word
          marking where one job ended and the next began — so "Invite someone" and
          "On this book" read as one continuous column of text rather than as two
          things you do. It is the same answer the comps and title-check screens
          already reached: one box per idea.

          The elevation is the palette's own, which is why it needs no thought to
          work in both themes. On black the desk is `surface` (#000) and a card is
          `panel` lifted by a hairline; in daylight the desk is grey and the cards
          are white. A card that stated its own colour would be right in exactly
          one theme.
        */
        <div className="space-y-4 bg-surface px-5 py-5">
          {/* The invite form */}
          <form
            className="rounded-xl border border-line bg-panel p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void invite();
            }}
          >
            <div className="flex items-end justify-between gap-3">
              <label htmlFor="share-email" className="text-sm font-bold text-fg">
                Invite someone
              </label>
              {/* Silent while there is room to spare — see WARN_WHEN_LEFT. */}
              <LeftPill allowance={allowance} />
            </div>

            <div className="mt-1.5 flex flex-wrap gap-2">
              <input
                id="share-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="their@email.com"
                autoComplete="off"
                className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3
                           py-2 text-sm text-fg outline-none placeholder:text-muted
                           focus-visible:ring-2 focus-visible:ring-accent/50"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as CollabRole)}
                aria-label="What they may do"
                className="rounded-lg border border-line bg-surface px-3 py-2 text-sm
                           text-fg outline-none focus-visible:ring-2
                           focus-visible:ring-accent/50"
              >
                {COLLAB_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r].label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={busy}
                className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm
                           font-semibold text-accent-ink disabled:opacity-60"
              >
                {busy && <Spinner className="h-3.5 w-3.5" />}
                Invite
              </button>
            </div>

            {/* **One static line, not a paragraph that rewrites itself.** This
                used to restate the chosen role *and* explain the link, so it
                changed under the reader's eyes as they used the dropdown and ran
                to three lines. What the role does now lives beside the role, in
                the dropdown's own options; what is left here is the one fact the
                dropdown cannot carry — that no email is sent. */}
            <p className="mt-2 text-xs text-muted">
              You&rsquo;ll get a link to send them yourself. It works only for
              that address and lasts {INVITE_DAYS} days.
            </p>

            {problem && (
              <p role="alert" className="mt-2.5 text-sm text-stop-fg">
                {problem}
              </p>
            )}
            {copied && (
              <p role="status" className="mt-2.5 text-sm text-ok-fg">
                Link copied. Send it to them however you like.
              </p>
            )}
          </form>

          {/* The standing state once the book is full. Pro gets a plain note:
              LimitBanner links to /upgrade, which is nothing but an insult to
              somebody who is already there. */}
          {/* No `mt-4` any more: the parent's `space-y-4` spaces the cards, and
              a margin on top of it would double the gap only when the banner is
              showing — which is the hardest kind of spacing bug to spot, because
              the screen looks right until somebody fills a book. */}
          {allowance.blocked &&
            (pro ? (
              <p className="rounded-xl border border-line bg-panel px-4 py-3 text-sm text-muted">
                {spentLine(allowance)} Remove somebody to make room.
              </p>
            ) : (
              <LimitBanner allowance={allowance} />
            ))}

          {/* Who is on it */}
          <div className="rounded-xl border border-line bg-panel p-4">
            <h3 className="text-sm font-bold text-fg">
              On this book{" "}
              {known && (
                <span className="font-normal text-muted">
                  {allowance.used} of {allowance.limit}
                </span>
              )}
            </h3>

            <ul className="mt-2 divide-y divide-line">
              <li className="flex items-center gap-3 py-2.5">
                <Disc tone="owner">
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    className="h-4 w-4"
                  >
                    <circle cx="10" cy="7" r="3" />
                    <path d="M4.5 16a5.5 5.5 0 0 1 11 0" />
                  </svg>
                </Disc>
                <span className="min-w-0 flex-1 truncate text-sm text-fg">
                  You
                </span>
                <span className="shrink-0 text-xs text-muted">Owner</span>
              </li>

              {loading && (
                <li className="flex items-center gap-2 py-3 text-sm text-muted">
                  <Spinner className="h-3.5 w-3.5" /> Reading the list…
                </li>
              )}

              {members.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  busy={busy}
                  copied={copied === m.id}
                  onCopy={async () => {
                    const result = await inviteLink(m.id);
                    if ("error" in result) setProblem(result.error);
                    else if (result.link) void copy(result.link, m.id);
                  }}
                  onRole={(next) => void act(() => changeRole(m.id, next))}
                  onRemove={() => void act(() => removeMember(m.id))}
                />
              ))}
            </ul>

            {known && members.length === 0 && (
              <p className="py-2 text-sm text-muted">
                Nobody else yet. This book holds {allowance.limit} people,
                including you.
              </p>
            )}
          </div>

          {/*
            **Eighty words of footnote became one line and a disclosure.**

            The house rule is that a screen carrying this hole says so, and that
            stands — a co-writer is about to rely on this and must not find out
            later. But two grey paragraphs at the foot of a dialog is not
            "saying so", it is burying it somewhere the eye has already left.
            One sentence in the flow, and the detail one click away for the
            person who wants it, is the honest version of the same promise.

            `<details>` rather than state: it is a disclosure, the browser
            already has one, and it stays open across a re-render for free.
          */}
          {/* Meta, not a section — so no box and no rule. The two cards above
              already do the separating that hairline was doing. */}
          <div className="px-1 pt-1">
            <p className="text-xs text-muted">
              Chapters and their notes sync. Your story bible, ledger and writing
              record do not.
            </p>
            <details className="group mt-1.5">
              <summary
                className="inline-flex cursor-pointer list-none items-center gap-1
                           text-xs font-medium text-fg outline-none
                           focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                What a co-writer will and won&rsquo;t see
                <svg
                  aria-hidden="true"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-3 w-3 text-muted transition-transform group-open:rotate-180"
                >
                  <path d="m5.5 8 4.5 4.5L14.5 8" />
                </svg>
              </summary>
              <div className="mt-2 space-y-2 text-xs leading-relaxed text-muted">
                <p>
                  Your story bible, advance readers, the ledger, your writing
                  record and your roadmap ticks stay on your own machine. None of
                  those sync between machines for anybody, so a co-writer sees
                  none of yours.
                </p>
                <p>
                  Full-size cover artwork does not travel either, so if they
                  export the book they get the thumbnail.
                </p>
                <p>
                  Taking somebody off stops them reaching the book from then on.
                  It cannot reach into a copy their browser has already
                  downloaded.
                </p>
              </div>
            </details>
          </div>
        </div>
      )}

      {showLimit && (
        <LimitDialog action="collaborators" onClose={() => setShowLimit(false)} />
      )}

      {/* Over the share dialog, which browsers stack in the top layer — the same
          thing `LimitDialog` above already does. */}
      {sent && (
        <InviteSentDialog
          email={sent.email}
          role={sent.role}
          link={sent.link}
          onClose={() => setSent(null)}
        />
      )}
    </dialog>
  );
}

/**
 * A person as a disc, so this dialog and the Collaborators list speak the same
 * visual language. There are no avatars anywhere in this app to draw instead.
 */
function Disc({
  tone,
  children,
}: {
  tone: "owner" | "member" | "pending";
  children: React.ReactNode;
}) {
  const look =
    tone === "owner"
      ? "bg-accent text-accent-ink"
      : tone === "pending"
        ? "border border-dashed border-muted text-muted"
        : "bg-raised text-fg";
  return (
    <span
      aria-hidden="true"
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full
                  text-[11px] font-semibold ${look}`}
    >
      {children}
    </span>
  );
}

/**
 * One person, in whichever of three states they are in.
 *
 * **Four controls became one**, and that is the change worth explaining. The row
 * carried a role `<select>`, a Copy link button and a Remove button, which
 * wrapped onto two lines on any narrow dialog and put a destructive action at the
 * same weight as a preference.
 *
 * Google, Notion and Dropbox all do the same thing here: the role reads as a
 * button, opening a menu whose *last item* is Remove. One control, the
 * destructive option one level down and marked, and the row stays a single line.
 * `Menu` is the app's own primitive, so this inherits its keyboard and dismissal
 * behaviour rather than reimplementing it.
 *
 * Copy link stays visible for a pending invitation rather than joining the menu:
 * we send no email, so that link is the *only* way the invitation reaches
 * anybody. Hiding the one thing that makes the feature work behind a chevron
 * would be tidiness bought at the cost of the thing itself.
 */
function MemberRow({
  member,
  busy,
  copied,
  onCopy,
  onRole,
  onRemove,
}: {
  member: Member;
  busy: boolean;
  copied: boolean;
  onCopy: () => void;
  onRole: (role: CollabRole) => void;
  onRemove: () => void;
}) {
  const state = memberState(member);
  const pending = state === "pending";
  const expired = state === "expired";
  const initial = (member.name ?? member.email).trim().charAt(0).toUpperCase();

  return (
    <li className="flex items-center gap-3 py-2.5">
      <Disc tone={pending || expired ? "pending" : "member"}>
        {initial || "?"}
      </Disc>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-fg">{member.name ?? member.email}</p>
        {pending ? (
          <p className="text-xs text-muted">
            Invited · expires {timeUntil(member.expiresAt)}
          </p>
        ) : expired ? (
          <p className="text-xs text-note-fg">
            Invitation expired — remove it and invite them again
          </p>
        ) : (
          member.acceptedAt && (
            <p className="text-xs text-muted">
              Joined {relativeTime(member.acceptedAt)}
            </p>
          )
        )}
      </div>

      {pending && (
        <button
          type="button"
          onClick={onCopy}
          disabled={busy}
          className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-xs
                     font-medium text-fg transition-colors hover:bg-raised
                     disabled:opacity-60"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      )}

      <Menu
        label={`What ${member.email} may do`}
        align="end"
        width={220}
        triggerClassName="shrink-0 rounded-lg border border-line px-2.5 py-1.5
                          text-xs font-medium text-fg outline-none
                          transition-colors hover:bg-raised
                          focus-visible:ring-2 focus-visible:ring-accent/50"
        trigger={
          <span className="flex items-center gap-1.5">
            {ROLE_LABELS[member.role].label}
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-3 w-3 text-muted"
            >
              <path d="m5.5 8 4.5 4.5L14.5 8" />
            </svg>
          </span>
        }
      >
        {(close) => (
          <>
            {COLLAB_ROLES.map((r) => (
              <MenuButton
                key={r}
                hint={ROLE_LABELS[r].what}
                icon={
                  r === member.role ? (
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="h-4 w-4"
                    >
                      <path d="m4.5 10.5 3.5 3.5 7.5-8" />
                    </svg>
                  ) : (
                    <span className="h-4 w-4" />
                  )
                }
                onClick={() => {
                  close();
                  if (r !== member.role) onRole(r);
                }}
              >
                {ROLE_LABELS[r].label}
              </MenuButton>
            ))}

            <MenuSeparator />

            {/* Last item, and marked — the convention every product that does
                this well shares. Cancelling a pending invitation is silent, so
                it says Cancel rather than announcing anything to anybody. */}
            <MenuButton
              danger
              onClick={() => {
                close();
                onRemove();
              }}
            >
              {pending || expired ? "Cancel invitation" : "Remove from book"}
            </MenuButton>
          </>
        )}
      </Menu>
    </li>
  );
}

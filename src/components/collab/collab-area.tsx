"use client";

import { useState } from "react";
import Link from "next/link";
import { acceptOwnInvite, declineOwnInvite } from "@/app/collab/actions";
import { memberState, ROLE_LABELS, type Member } from "@/lib/collab";
import type { Book } from "@/lib/library-store";
import { timeUntil } from "@/lib/relative-time";
import {
  useAllMembers,
  useMyBooks,
  useMyInvites,
  useSharedWithMe,
} from "@/lib/use-collab";
import { bookWordCount } from "@/lib/library-store";
import { useCover, useHydrated } from "@/lib/use-library";
import { usePlan } from "@/lib/use-plan";
import { BookCover } from "@/components/shelf/book-cover";
import { Spinner } from "@/components/ui/spinner";
import { ShareDialog } from "./share-dialog";

/**
 * A book's cover at list size.
 *
 * Its own component because `useCover` is per-book and a hook cannot be called in
 * a loop — and because the cover is the part that does the work here: a writer
 * knows their own jackets at a glance, and this screen is where they decide who
 * gets to write in one of them.
 */
function Jacket({ book }: { book: Book }) {
  const cover = useCover(book.id);
  return (
    <BookCover
      title={book.title}
      subtitle={book.subtitle}
      author={book.author}
      words={bookWordCount(book)}
      image={cover}
      seed={book.id}
    />
  );
}

/**
 * A section's name, how many are in it, and one line of what it is for.
 *
 * The count sits *in* the heading rather than being counted by the reader, and
 * the hint replaces the paragraph each of these sections used to open with — a
 * caption a glance can take, instead of prose a glance skips.
 */
function SectionHead({
  title,
  count,
  hint,
}: {
  title: string;
  count?: number;
  hint: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
      <h3 className="text-sm font-bold text-fg">
        {title}
        {count !== undefined && (
          <span className="ml-1.5 font-normal text-muted">{count}</span>
        )}
      </h3>
      <p className="text-xs text-muted">{hint}</p>
    </div>
  );
}

/**
 * Somebody on a book, as a disc with their initial.
 *
 * **A face pile is the answer to the question this screen exists for**, and it
 * is what Drive, Notion, Figma and Slack all reach for: "who can see my work" is
 * answered by *looking*, not by opening a dialog per book. There are no avatars
 * to show — nothing in this app has ever collected one for a collaborator — so
 * the initial of the invited address is what there is, and it is enough to tell
 * two people apart at a glance.
 *
 * A **pending** invitation is drawn as a dashed outline rather than a filled
 * disc, because somebody who has not accepted is not on the book yet, and a face
 * that looks identical either way would overstate what has happened.
 */
function Face({ member, index }: { member: Member; index: number }) {
  const pending = memberState(member) === "pending";
  const initial = (member.name ?? member.email).trim().charAt(0).toUpperCase();

  return (
    <span
      title={`${member.email}${pending ? " · invited, not yet accepted" : ""}`}
      style={{ zIndex: 10 - index }}
      className={`relative -ml-1.5 flex h-6 w-6 shrink-0 items-center justify-center
                  rounded-full text-[10px] font-semibold ring-2 ring-panel
                  first:ml-0 ${
                    pending
                      ? "border border-dashed border-muted text-muted"
                      : "bg-raised text-fg"
                  }`}
    >
      {initial || "?"}
    </span>
  );
}

/**
 * The owner plus everyone on the book, capped, with a plain-words summary.
 *
 * Three faces then "+N": a pile that grows without bound stops being scannable,
 * which is the one thing it is for. The words beside it carry what the discs
 * cannot — that an invitation is still outstanding — because a dashed ring is a
 * convention a first-time reader has not been taught yet.
 */
function People({
  members,
  loading,
}: {
  members: readonly Member[];
  loading: boolean;
}) {
  if (loading) {
    return <Spinner className="h-3.5 w-3.5 shrink-0 text-muted" />;
  }

  const active = members.filter((m) => memberState(m) === "active");
  const pending = members.filter((m) => memberState(m) === "pending");
  const shown = [...active, ...pending].slice(0, 3);
  const extra = active.length + pending.length - shown.length;

  const summary =
    active.length === 0 && pending.length === 0
      ? "Only you"
      : [
          `${active.length + 1} ${active.length + 1 === 1 ? "person" : "people"}`,
          pending.length > 0 ? `${pending.length} invited` : null,
        ]
          .filter(Boolean)
          .join(" · ");

  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <span className="flex items-center" aria-hidden="true">
        {/* The owner always leads the pile — it is their book. */}
        <span
          className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center
                     rounded-full bg-accent text-accent-ink ring-2 ring-panel"
        >
          {/* A glyph, not the word "You": three characters at 10px do not fit a
              24px disc without either overflowing or shrinking to unreadable.
              The summary beside the pile says who it is in words anyway. */}
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            className="h-3.5 w-3.5"
          >
            <circle cx="10" cy="7" r="3" />
            <path d="M4.5 16a5.5 5.5 0 0 1 11 0" />
          </svg>
        </span>
        {shown.map((m, i) => (
          <Face key={m.id} member={m} index={i + 1} />
        ))}
        {extra > 0 && (
          <span
            className="relative -ml-1.5 flex h-6 w-6 shrink-0 items-center justify-center
                       rounded-full bg-raised text-[10px] font-semibold text-muted
                       ring-2 ring-panel"
          >
            +{extra}
          </span>
        )}
      </span>
      <span className="hidden text-xs text-muted sm:inline">{summary}</span>
    </div>
  );
}

/** One book: jacket, title, who is on it, and whatever the section puts at the end. */
function BookRow({
  book,
  people,
  loadingPeople = false,
  right,
}: {
  book: Book;
  people?: readonly Member[];
  loadingPeople?: boolean;
  right: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-raised/60">
      <div className="w-9 shrink-0">
        <Jacket book={book} />
      </div>
      <div className="min-w-0 flex-1">
        <Link
          href={`/book/${book.id}`}
          className="block truncate text-sm font-semibold text-fg hover:underline"
        >
          {book.title}
        </Link>
      </div>
      {people && <People members={people} loading={loadingPeople} />}
      {right}
    </li>
  );
}

/**
 * The Collaborators area: three lists, in the order somebody arriving needs them.
 *
 * **Invitations waiting first**, because an unanswered invitation is the only thing
 * on this screen with a deadline — and the only thing where doing nothing loses
 * something. Then books shared with you, then your own books with a Share control
 * on each.
 *
 * The invitations list is what makes this area worth having rather than leaving
 * sharing entirely to the per-book dialog: this app sends no email, so without a
 * place in the product that says "somebody has invited you", an invitation whose
 * link went astray would be invisible forever.
 *
 * Each of your books carries a **face pile** rather than only a Share button, and
 * that is the whole reason this screen is worth having as well as the per-book
 * dialog: "who can see my work" is a question about the *shelf*, and answering it
 * one dialog at a time is not answering it. Drive's owner column, Notion's member
 * table and Figma's avatar stacks all exist for the same reason.
 *
 * What stays in the dialog is *changing* any of it. This screen shows; the dialog
 * decides. A roster page that also edited would be a second place for the same
 * facts to disagree.
 */
export function CollabArea() {
  const hydrated = useHydrated();
  const mine = useMyBooks();
  const shared = useSharedWithMe();
  const { invites, loading: loadingInvites } = useMyInvites();
  // One request for every book's people, not one per row — see `useAllMembers`.
  const { byBook, loading: loadingPeople } = useAllMembers();
  const [sharing, setSharing] = useState<Book | null>(null);

  return (
    <div className="space-y-6">
      {/*
        **Three paragraphs used to run before anything you could act on**, and
        this screen is a list, not an article. The seat numbers went first: they
        are reference, not news, and they are already stated at the moment one is
        actually spent — on the share dialog, on the pricing page, in Help. A
        rule you meet three sentences before you can use it is a rule you read
        twice and remember neither time.

        What replaced them is the thing the screen was missing: **who is on each
        book, visible without opening anything.** That is the shape every product
        that does this well converges on — Drive's owner column, Notion's member
        table, Figma's avatar stacks — because the question somebody arrives with
        is "who can see my work", and a list of titles with a Share button beside
        each answers it only after N clicks.
      */}

      {loadingInvites ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Spinner className="h-3.5 w-3.5" /> Checking for invitations…
        </p>
      ) : (
        invites.length > 0 && <Invitations invites={invites} />
      )}

      {/* **Absent when empty, rather than explaining its own emptiness.** A
          heading over a paragraph saying "nothing here yet, and here is what
          would appear if there were" is two lines of furniture on the screen of
          somebody who has never shared anything and may never want to. */}
      {shared.length > 0 && (
        <section>
          <SectionHead
            title="Shared with you"
            count={shared.length}
            hint="Books other writers have put you on"
          />
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
            {shared.map((book) => (
              <BookRow
                key={book.id}
                book={book}
                right={
                  <span
                    className={`shrink-0 rounded-md px-2 py-1 text-xs font-medium ${
                      book.access === "lost"
                        ? "bg-note-bg text-note-fg"
                        : "bg-raised text-muted"
                    }`}
                  >
                    {book.access === "lost"
                      ? "No longer shared"
                      : book.role
                        ? ROLE_LABELS[book.role].label
                        : "Shared"}
                  </span>
                }
              />
            ))}
          </ul>

          {shared.some((b) => b.access === "lost") && (
            <p className="mt-2.5 text-xs leading-relaxed text-muted">
              One of these stopped arriving from the server — the owner took you
              off it, or deleted it. Your copy stays readable on this machine;
              changes will not travel.
            </p>
          )}
        </section>
      )}

      <section>
        <SectionHead
          title="Your books"
          count={hydrated ? mine.length : undefined}
          hint="Press Share to put somebody on one"
        />

        {!hydrated ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted">
            <Spinner className="h-3.5 w-3.5" /> Reading your shelf…
          </p>
        ) : mine.length === 0 ? (
          <p className="mt-3 rounded-xl border border-line bg-panel px-4 py-6 text-center text-sm text-muted">
            No books yet. Make one and you can share it.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-panel">
            {mine.map((book) => (
              <BookRow
                key={book.id}
                book={book}
                people={byBook.get(book.id) ?? []}
                loadingPeople={loadingPeople}
                right={
                  <button
                    type="button"
                    onClick={() => setSharing(book)}
                    className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs
                               font-semibold text-fg transition-colors hover:bg-raised"
                  >
                    Share
                  </button>
                }
              />
            ))}
          </ul>
        )}
      </section>

      {sharing && (
        <ShareDialog
          bookId={sharing.id}
          bookTitle={sharing.title}
          onClose={() => setSharing(null)}
        />
      )}
    </div>
  );
}

/**
 * Invitations addressed to this account.
 *
 * The book's *title* is not here, and cannot be: a pending invitee has no select
 * on that book yet — which is the whole point of a pending invitation granting
 * nothing. So the card says who invited them by address and what they would be
 * able to do, and the title arrives once they accept. Inventing a title, or
 * widening the policy to fetch one, would both be worse.
 */
function Invitations({ invites }: { invites: Member[] }) {
  const plan = usePlan();
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function answer(
    id: string,
    run: () => Promise<{ error: string } | { ok: true }>,
  ) {
    setBusy(id);
    setProblem(null);
    const result = await run();
    setBusy(null);
    if ("error" in result) {
      setProblem(result.error);
      return;
    }
    /*
     * A full reload rather than a refetch, and on purpose: accepting adds a book
     * to this writer's library, which arrives through `syncWithServer` on mount.
     * Re-running that from here would mean reaching into the store's own
     * reconciliation from a component, which is exactly the coupling
     * `library-sync.tsx` exists to avoid.
     */
    window.location.reload();
  }

  return (
    <section>
      <h3 className="text-sm font-bold text-fg">Waiting for you</h3>
      <ul className="mt-3 space-y-3">
        {invites.map((invite) => (
          /* **The `step` indigo, not a blue of its own.**

             The palette allows a hue in exactly one family, and `step` is
             already its fourth member — red is blocked, amber is worth doing,
             green has passed, **indigo is the way forward**. An unanswered
             invitation is the only thing on this screen that is neither a
             problem nor a result: it is a next move, which is precisely what
             that token was minted to say, and it is the same colour the
             dashboard's roadmap strip wears. A new blue beside it would be a
             second brand colour pretending to be the first.

             It also solves the theme problem for free. `accent` goes *white* at
             night, so an accent-tinted ground would have put a white slab across
             a black screen; `step` keeps its hue in both themes because it is a
             ground and carries nothing but its own ink. */
          <li
            key={invite.id}
            className="rounded-xl border border-step-line bg-step-bg p-4 sm:p-5"
          >
            <div className="flex gap-3.5">
              {/* A mark rather than more words. The card was a flat block of two
                  sentences and two buttons with nothing leading the eye; a glyph
                  gives it a first thing to land on and says "correspondence"
                  before the sentence does. */}
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center
                           rounded-lg bg-step-line text-step-fg"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4"
                >
                  <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
                  <path d="m3 6 6.3 4.6a1.2 1.2 0 0 0 1.4 0L17 6" />
                </svg>
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed text-fg">
                  You&rsquo;ve been invited to a book as{" "}
                  <strong className="font-semibold">
                    {ROLE_LABELS[invite.role].label.toLowerCase()}
                  </strong>
                  .
                </p>
                {/* `step-fg` rather than `muted`: a neutral grey on a tinted
                    ground reads as dead text sitting on something else, where
                    the ground's own ink reads as part of the card. */}
                <p className="mt-1 text-xs text-step-fg">
                  Sent to {invite.email} · expires {timeUntil(invite.expiresAt)}
                </p>

                <div className="mt-3.5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy === invite.id}
                    onClick={() =>
                      void answer(invite.id, () => acceptOwnInvite(invite.id))
                    }
                    className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2
                               text-sm font-semibold text-accent-ink
                               transition-opacity hover:opacity-90
                               disabled:opacity-60"
                  >
                    {busy === invite.id && <Spinner className="h-3.5 w-3.5" />}
                    Accept
                  </button>
                  {/* Bordered in the ground's own hairline rather than the
                      chrome's `line`, which is invisible against a tinted card. */}
                  <button
                    type="button"
                    disabled={busy === invite.id}
                    onClick={() =>
                      void answer(invite.id, () => declineOwnInvite(invite.id))
                    }
                    className="rounded-lg border border-step-line px-4 py-2 text-sm
                               font-medium text-fg transition-colors
                               hover:bg-step-line disabled:opacity-60"
                  >
                    Decline
                  </button>
                </div>

                {/* Seats are the one limit Pro raises rather than lifts, so an
                    invitation can be refused at this end too — and being told why
                    here beats a Postgres error. */}
                {!plan.loading && !plan.pro && (
                  <p className="mt-3 text-xs text-step-fg">
                    Whoever owns the book pays for the seat, not you.
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {problem && (
        <p role="alert" className="mt-3 text-sm text-stop-fg">
          {problem}
        </p>
      )}
    </section>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { memberFaces, type Face } from "@/app/collab/actions";
import type { BookRole, Member } from "./collab";
import { findBook, type Book, type Shelf } from "./library-store";
import { createClient } from "./supabase/client";
import { isSupabaseConfigured } from "./supabase/config";
import { useShelf } from "./use-library";

/**
 * React's view of who is on a book.
 *
 * Kept apart from the other `use-*` hooks because this one **fetches rather than
 * derives**, for the reason `use-plan.ts` does: the member list lives in Postgres
 * and changes when somebody else presses a button — an invitation accepted on
 * another machine, days later, with no page of ours open. There is nothing local
 * to read it from, and it deliberately is not part of `library-store.ts`.
 *
 * The one exception is `useBookRole`, which needs no request at all: `sync.ts`
 * already puts the role on the `Book` on the way down, so a screen asking "may I
 * write this" gets a synchronous answer during render. That matters — the editor
 * has to know before it mounts, and a hook that resolved a moment later would
 * make a read-only book briefly typeable.
 */

/**
 * What this writer may do with this book, or null while the shelf is unread.
 *
 * **Absence of a stored role means the book is theirs**, so it answers "owner" —
 * a book made offline, or before there was an account, carries no role and never
 * needs one. Fails towards *their own book* rather than towards no access, which
 * is right: the alternative locks a writer out of their own manuscript whenever a
 * download has not happened yet.
 */
export function useBookRole(bookId: string): BookRole {
  const shelf = useShelf();
  return roleOf(shelf, bookId);
}

function roleOf(shelf: Shelf, bookId: string): BookRole {
  const book = findBook(shelf, bookId);
  return book?.role ?? "owner";
}

/** Books somebody else owns, that this writer has been let into. */
export function useSharedWithMe(): Book[] {
  const shelf = useShelf();
  return shelf.books.filter((b) => b.role && !b.trashedAt && !b.archivedAt);
}

/** Books of this writer's own, which are the ones they can share. */
export function useMyBooks(): Book[] {
  const shelf = useShelf();
  return shelf.books.filter((b) => !b.role && !b.trashedAt && !b.archivedAt);
}

interface MemberRowShape {
  id: string;
  book_id: string;
  invited_email: string;
  user_id: string | null;
  role: "editor" | "viewer";
  status: "pending" | "active" | "revoked";
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
}

/**
 * Exactly the columns `authenticated` is granted.
 *
 * `token` and `invited_by` are withheld by column grant — see the foot of
 * 20260806000000_collaboration.sql — and **PostgREST refuses the whole query if
 * one ungranted column is asked for**, so `select("*")` here does not fail on the
 * column, it fails on everything. Naming them is not tidiness.
 */
const MEMBER_COLUMNS =
  "id, book_id, invited_email, user_id, role, status, expires_at, created_at, accepted_at";

function toMember(row: MemberRowShape): Member {
  return {
    id: row.id,
    bookId: row.book_id,
    email: row.invited_email,
    userId: row.user_id,
    role: row.role,
    status: row.status,
    expiresAt: Date.parse(row.expires_at),
    acceptedAt: row.accepted_at ? Date.parse(row.accepted_at) : null,
  };
}

/**
 * Everybody on every book this writer can see, in **one** request.
 *
 * The Collaborators screen lists books and wants a face pile on each, which the
 * per-book hook would turn into a request per row — the classic N+1, and on a
 * shelf of twenty books it is twenty round trips to draw one page.
 *
 * One query is possible because `book_members`' own select policy already
 * narrows this correctly: it returns rows on books you own, rows that are yours,
 * and live invitations to your address. Nothing else. So "select the lot" is
 * both the smallest query and the right answer.
 */
/**
 * Names and photos for everyone on the caller's books, keyed by user id.
 *
 * One request for the whole screen, like `useAllMembers` — a face pile per book
 * row would otherwise be a lookup per person per row. It fetches rather than
 * derives for the reason `use-plan.ts` does: this lives in `auth.users`, which
 * nothing local has a copy of.
 *
 * An empty map is the honest resting state. Most accounts have no photo — only
 * Google hands one over — so callers fall back to the initial rather than
 * waiting, and nothing on screen moves when the answer arrives for nobody.
 */
/**
 * One request per page, not per visit to the screen.
 *
 * Held at module scope rather than in state: the Collaborators area unmounts
 * whenever `?area=` moves, so a plain effect refetches every time a writer
 * looks at another tab and comes back — several round trips for a set of
 * photographs that change about once a year. Seeded synchronously on the second
 * mount, so the pile is right in the first frame.
 *
 * The *promise* is cached rather than the answer, so two mounts in the same tick
 * share one request. It is deliberately never invalidated: a stale avatar is
 * invisible, and the page reloads often enough.
 */
let facesPromise: Promise<Record<string, Face>> | null = null;
let facesAnswer: Record<string, Face> = {};

export function useMemberFaces(): Record<string, Face> {
  const [faces, setFaces] = useState<Record<string, Face>>(facesAnswer);
  const enabled = isSupabaseConfigured();

  useEffect(() => {
    if (!enabled) return;
    let live = true;

    facesPromise ??= memberFaces().catch(() => {
      // A face is decoration over an initial that already works. Clearing the
      // slot lets the next mount try again rather than caching the failure.
      facesPromise = null;
      return {};
    });

    void facesPromise.then((answer) => {
      facesAnswer = answer;
      if (live) setFaces(answer);
    });

    return () => {
      live = false;
    };
  }, [enabled]);

  return faces;
}

export function useAllMembers(): {
  loading: boolean;
  byBook: Map<string, Member[]>;
} {
  const [answer, setAnswer] = useState<Member[] | null>(null);
  const enabled = isSupabaseConfigured();

  useEffect(() => {
    if (!enabled) return;
    let live = true;

    void createClient()
      .from("book_members")
      .select(MEMBER_COLUMNS)
      .then(({ data, error }) => {
        if (!live) return;
        setAnswer(
          error
            ? []
            : ((data ?? []) as MemberRowShape[])
                .filter((r) => r.status !== "revoked")
                .map(toMember),
        );
      });

    return () => {
      live = false;
    };
  }, [enabled]);

  const byBook = new Map<string, Member[]>();
  for (const member of answer ?? []) {
    const list = byBook.get(member.bookId);
    if (list) list.push(member);
    else byBook.set(member.bookId, [member]);
  }

  return { loading: enabled && answer === null, byBook };
}

export interface MemberList {
  loading: boolean;
  members: Member[];
  /** Set when the list could not be read at all — not when it is simply empty. */
  error: string | null;
  refresh: () => void;
}

/**
 * Everybody on one book, the owner excluded.
 *
 * Revoked rows are dropped here rather than in the query: they are history, and
 * the seat arithmetic in `collab.ts` already knows to ignore them, so filtering in
 * one place keeps the two from disagreeing.
 */
export function useMembers(bookId: string | null): MemberList {
  const [epoch, setEpoch] = useState(0);
  const refresh = useCallback(() => setEpoch((n) => n + 1), []);

  /*
   * **One state slot holding the answer *and* which question it answers**, so
   * `loading` can be derived rather than set.
   *
   * The obvious shape — `setLoading(true)` at the top of the effect — calls
   * setState synchronously in an effect body, which cascades a render and which
   * the lint rule rightly refuses. Keying the result instead means "we have no
   * answer for the current question yet" *is* the loading state, and setState
   * happens only in the fetch's callback. It also fixes a bug the obvious shape
   * has: switching books would briefly show the previous book's members.
   */
  const enabled = Boolean(bookId) && isSupabaseConfigured();
  const key = `${bookId ?? ""}:${epoch}`;

  const [answer, setAnswer] = useState<{
    key: string;
    members: Member[];
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!enabled || !bookId) return;

    let live = true;

    void createClient()
      .from("book_members")
      .select(MEMBER_COLUMNS)
      .eq("book_id", bookId)
      .then(({ data, error: failed }) => {
        if (!live) return;
        if (failed) {
          // A database without the collaboration migration answers PGRST205 here.
          // Reported rather than swallowed, because a share dialog showing an
          // empty list looks like a book nobody is on.
          setAnswer({ key, members: [], error: failed.message });
          return;
        }
        setAnswer({
          key,
          error: null,
          members: ((data ?? []) as MemberRowShape[])
            .filter((r) => r.status !== "revoked")
            .map(toMember),
        });
      });

    return () => {
      live = false;
    };
  }, [enabled, bookId, key]);

  if (!enabled) {
    return { loading: false, members: [], error: null, refresh };
  }
  const current = answer?.key === key ? answer : null;
  return {
    loading: current === null,
    members: current?.members ?? [],
    error: current?.error ?? null,
    refresh,
  };
}

/**
 * Invitations waiting for this writer.
 *
 * Matched on the email in the JWT by `book_members`' own select policy — which is
 * safe *because it grants nothing*: both `book_role()` and `shared_book_ids()`
 * require an active membership carrying this user's id, so a pending row is a
 * notification and not access. Accepting is a Server Action that checks the
 * address is confirmed, which a claim cannot tell us.
 *
 * **Filtered by our own address, and that is not optional.** The policy admits
 * three kinds of row, and two of them are pending: invitations addressed to us,
 * *and* invitations we sent on our own books. Both have `user_id` null, so telling
 * them apart needs the email — without it an owner would see their own outgoing
 * invitations listed as offers to accept.
 *
 * The book's title is not here, because a pending invitee has no select on that
 * book yet — which is the point. The accept screen resolves it server-side.
 */
export function useMyInvites(): { loading: boolean; invites: Member[] } {
  // Same derived-loading shape as `useMembers` above, and for the same reason.
  const [answer, setAnswer] = useState<Member[] | null>(null);
  const enabled = isSupabaseConfigured();

  useEffect(() => {
    if (!enabled) return;

    let live = true;
    const db = createClient();

    void (async () => {
      const { data: claims } = await db.auth.getClaims();
      const mine =
        typeof claims?.claims?.email === "string"
          ? claims.claims.email.trim().toLowerCase()
          : null;

      if (!live) return;
      if (!mine) {
        setAnswer([]);
        return;
      }

      const { data, error } = await db
        .from("book_members")
        .select(MEMBER_COLUMNS)
        .eq("status", "pending")
        .eq("invited_email", mine);

      if (!live) return;
      setAnswer(
        error
          ? []
          : ((data ?? []) as MemberRowShape[])
              .map(toMember)
              // Expiry is derived, never stored — nothing sweeps the table, so a
              // lapsed invitation is only lapsed because this comparison says so.
              .filter((m) => m.expiresAt > Date.now()),
      );
    })();

    return () => {
      live = false;
    };
  }, [enabled]);

  if (!enabled) return { loading: false, invites: [] };
  return { loading: answer === null, invites: answer ?? [] };
}

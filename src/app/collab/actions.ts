"use server";

import { isBillingConfigured } from "@/lib/billing/payhere";
import { subscriptionFor } from "@/lib/billing/server";
import { isPro } from "@/lib/billing/subscription";
import { INVITE_DAYS, inviteProblem, normalizeEmail, type CollabRole } from "@/lib/collab";
import { SEATS_PER_BOOK } from "@/lib/free-limits";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Everything that changes who is on a book.
 *
 * **All of it goes through the secret key, and none of it through the browser.**
 * `book_members` grants `authenticated` a column-limited `select` and nothing
 * else — no insert, no update, no delete — for the reason
 * 20260730120000_billing.sql takes the same posture with `subscriptions`: the seat
 * cap depends on `isPro()` and `isBillingConfigured()`, which are facts Postgres
 * does not have. A grant that does not exist is the part a reader with devtools
 * cannot argue with.
 *
 * The cost is the discipline `src/lib/supabase/admin.ts` warns about: the secret
 * key is not filtered by RLS, so **every query here names the caller and the book
 * itself**. Forgetting one does not fail loudly; it quietly reads somebody else's
 * row. Ownership is therefore checked in exactly one place — `asOwner()` — and
 * every action starts by calling it.
 *
 * The two that race are done in SQL rather than here: `invite_book_member` and
 * `accept_book_invite` take a row lock, because two invitations sent at once each
 * see the other's absence and both get in.
 */

export type CollabResult = { error: string } | { ok: true; link?: string };

/** The seat cap for whoever owns this book, which is the plan that governs it. */
async function seatsFor(ownerId: string): Promise<number> {
  // No gateway means nothing is for sale, so nothing is held back — the same
  // shape as `requirePro()` passing everyone when billing is unconfigured.
  if (!isBillingConfigured()) return SEATS_PER_BOOK.pro;

  const db = createAdminClient();
  if (!db) return SEATS_PER_BOOK.free;

  const subscription = await subscriptionFor(db, ownerId);
  return isPro(subscription) ? SEATS_PER_BOOK.pro : SEATS_PER_BOOK.free;
}

/**
 * The signed-in writer, if they own this book.
 *
 * Returns a string on failure so every caller can hand it straight back. The
 * message is deliberately the same for "no such book" and "not your book": a
 * different answer for each would turn this into a way of asking whether an id
 * exists.
 */
async function asOwner(
  bookId: string,
): Promise<{ userId: string } | { error: string }> {
  if (!isSupabaseConfigured()) {
    return { error: "Accounts aren't configured, so a book cannot be shared." };
  }
  if (!isAdminConfigured()) {
    return {
      error:
        "Sharing isn't available: SUPABASE_SECRET_KEY isn't set on the server.",
    };
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  if (!userId) return { error: "Sign in to share a book." };

  const db = createAdminClient();
  if (!db) return { error: "Sharing isn't available on this server." };

  const { data: book, error } = await db
    .from("books")
    .select("owner")
    .eq("id", bookId)
    .maybeSingle();

  if (error) {
    console.error(`[collab] could not read the book: ${error.message}`);
    return { error: "Could not check that book. Try again in a moment." };
  }
  if (!book || book.owner !== userId) {
    return { error: "That book isn't yours to share." };
  }
  return { userId };
}

/**
 * The same check for a row rather than a book, since the client holds member ids.
 *
 * Two reads rather than a join, because the join would be through the admin
 * client and a mistake in it reads as success.
 */
async function ownedMember(
  memberId: string,
): Promise<{ userId: string; bookId: string } | { error: string }> {
  if (!isAdminConfigured()) {
    return { error: "Sharing isn't available on this server." };
  }
  const db = createAdminClient();
  if (!db) return { error: "Sharing isn't available on this server." };

  const { data: row, error } = await db
    .from("book_members")
    .select("book_id")
    .eq("id", memberId)
    .maybeSingle();

  if (error || !row) return { error: "That person is no longer on this book." };

  const owner = await asOwner(row.book_id);
  if ("error" in owner) return owner;
  return { userId: owner.userId, bookId: row.book_id };
}

/**
 * An invitation token.
 *
 * Long because it is the only thing standing between a link and somebody else's
 * manuscript — and unlike a password there is nobody to notice it being guessed.
 * Two UUIDs is 244 bits, which costs nothing and closes the question.
 */
function newToken(): string {
  const half = () => crypto.randomUUID().replace(/-/g, "");
  return `${half()}${half()}`;
}

function linkFor(token: string): string {
  return `/invite/${token}`;
}

// ---------------------------------------------------------------------------
// Inviting
// ---------------------------------------------------------------------------

export async function inviteMember(
  bookId: string,
  email: string,
  role: CollabRole,
): Promise<CollabResult> {
  const owner = await asOwner(bookId);
  if ("error" in owner) return owner;

  const db = createAdminClient();
  if (!db) return { error: "Sharing isn't available on this server." };

  const address = normalizeEmail(email);

  /*
   * The same refusals the screen already shows, checked again here.
   *
   * Not belt-and-braces for its own sake: the dialog validates what it can see,
   * and what it can see is a list `book_members`' select policy handed it. A row
   * created a second ago on another device is not in that list. The database's own
   * unique indexes are the final word, and this turns their error codes into
   * sentences before the writer meets one.
   */
  const { data: members } = await db
    .from("book_members")
    .select("id, book_id, invited_email, user_id, role, status, expires_at, accepted_at")
    .eq("book_id", bookId);

  const problem = inviteProblem(address, {
    // The owner's own address is checked in SQL, where `auth.users` is readable.
    ownerEmail: null,
    members: (members ?? []).map((m) => ({
      id: m.id,
      bookId: m.book_id,
      email: m.invited_email,
      userId: m.user_id,
      role: m.role,
      status: m.status,
      expiresAt: Date.parse(m.expires_at),
      acceptedAt: m.accepted_at ? Date.parse(m.accepted_at) : null,
    })),
  });
  if (problem) return { error: problem };

  const token = newToken();
  const { error } = await db.rpc("invite_book_member", {
    bid: bookId,
    email: address,
    member_role: role,
    max_seats: await seatsFor(owner.userId),
    invite_token: token,
    caller: owner.userId,
    ttl: `${INVITE_DAYS} days`,
  });

  if (error) return { error: inviteError(error) };
  return { ok: true, link: linkFor(token) };
}

/**
 * Postgres' error codes, turned into what the writer needs to know.
 *
 * `program_limit_exceeded` is the seat cap and is the one that matters: the
 * screen has already offered the upgrade, so this is the backstop for a plan that
 * changed between the page loading and the press.
 */
function inviteError(error: { code?: string; message?: string }): string {
  if (error.code === "P0001" || error.message) {
    const message = error.message ?? "";
    if (/seat cap/i.test(message)) {
      return "This book is full. Remove somebody, or move to Pro for more room.";
    }
    if (/that is the owner/i.test(message)) {
      return "This is your own book — you already have every permission on it.";
    }
    if (/not the owner/i.test(message)) {
      return "That book isn't yours to share.";
    }
    if (/duplicate key/i.test(message)) {
      return "They have already been invited.";
    }
  }
  console.error(`[collab] invite failed [${error.code}]: ${error.message}`);
  return "Could not send that invitation. Try again in a moment.";
}

/** The link for an invitation already sent. The token is server-side only. */
export async function inviteLink(memberId: string): Promise<CollabResult> {
  const owned = await ownedMember(memberId);
  if ("error" in owned) return owned;

  const db = createAdminClient();
  if (!db) return { error: "Sharing isn't available on this server." };

  const { data, error } = await db
    .from("book_members")
    .select("token, status")
    .eq("id", memberId)
    .maybeSingle();

  if (error || !data) return { error: "That invitation is no longer there." };
  if (data.status !== "pending") {
    return { error: "That invitation has already been answered." };
  }
  return { ok: true, link: linkFor(data.token) };
}

// ---------------------------------------------------------------------------
// Changing and ending
// ---------------------------------------------------------------------------

export async function changeRole(
  memberId: string,
  role: CollabRole,
): Promise<CollabResult> {
  const owned = await ownedMember(memberId);
  if ("error" in owned) return owned;
  if (role !== "editor" && role !== "viewer") {
    return { error: "That isn't a role." };
  }

  const db = createAdminClient();
  if (!db) return { error: "Sharing isn't available on this server." };

  const { error } = await db
    .from("book_members")
    .update({ role })
    .eq("id", memberId);

  if (error) {
    console.error(`[collab] could not change a role: ${error.message}`);
    return { error: "Could not change that. Try again in a moment." };
  }
  return { ok: true };
}

/**
 * Taking somebody off a book, and cancelling an invitation nobody answered.
 *
 * One action for both, because they are the same row in two states and the owner
 * is doing the same thing to it. **Revoked rather than deleted**: who was asked
 * and when is worth keeping, the seat comes back either way, and the partial
 * unique index that stops two live invitations to one address only counts rows
 * that are not revoked — so this is also what makes re-inviting somebody work.
 *
 * Cancelling is silent. GitHub's own documentation makes a point of it — *"if the
 * invite is pending and you cancel it, the recipient will not be notified"* — and
 * telling somebody you have withdrawn an invitation they never saw is a social
 * injury for no benefit.
 */
export async function removeMember(memberId: string): Promise<CollabResult> {
  const owned = await ownedMember(memberId);
  if ("error" in owned) return owned;

  const db = createAdminClient();
  if (!db) return { error: "Sharing isn't available on this server." };

  const { error } = await db
    .from("book_members")
    .update({ status: "revoked", user_id: null })
    .eq("id", memberId);

  if (error) {
    console.error(`[collab] could not remove a member: ${error.message}`);
    return { error: "Could not do that. Try again in a moment." };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Accepting
// ---------------------------------------------------------------------------

/**
 * What the invited writer is shown before they decide.
 *
 * Resolved from the token server-side, because the token is not granted to
 * `authenticated` — and it must not be, since anybody who can read one can accept
 * an invitation addressed to somebody else.
 */
export interface InviteOffer {
  bookTitle: string;
  role: CollabRole;
  invitedEmail: string;
  /** Whether the signed-in account is the one this was addressed to. */
  forMe: boolean;
  /** Why it cannot be accepted, if it cannot. */
  problem?: string;
}

export async function offerFor(token: string): Promise<InviteOffer | null> {
  if (!isSupabaseConfigured() || !isAdminConfigured()) return null;

  const db = createAdminClient();
  if (!db) return null;

  const { data: invite } = await db
    .from("book_members")
    .select("book_id, invited_email, role, status, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!invite) return null;

  const { data: book } = await db
    .from("books")
    .select("title")
    .eq("id", invite.book_id)
    .maybeSingle();

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;

  let mine = false;
  let problem: string | undefined;

  if (invite.status !== "pending") {
    problem = "That invitation has already been answered.";
  } else if (Date.parse(invite.expires_at) <= Date.now()) {
    problem = `That invitation has expired. Invitations last ${INVITE_DAYS} days — ask for another.`;
  }

  if (me) {
    /*
     * **The address is read from the account, not from the token's claims.**
     *
     * Supabase puts `email` in the access token whether or not it has been
     * confirmed, so matching on the claim would let somebody sign up as
     * victim@company.com, never confirm it, and accept their invitation.
     * `getUserById` carries `email_confirmed_at`, which is the only honest answer.
     */
    const { data: account } = await db.auth.admin.getUserById(me);
    const address = normalizeEmail(account?.user?.email ?? "");
    const confirmed = Boolean(account?.user?.email_confirmed_at);
    mine = confirmed && address === invite.invited_email;

    if (!problem && address === invite.invited_email && !confirmed) {
      problem =
        "Confirm your email address first — check your inbox for the link we sent when you signed up.";
    }
  }

  return {
    bookTitle: book?.title ?? "a book",
    role: invite.role,
    invitedEmail: invite.invited_email,
    forMe: mine,
    problem,
  };
}

/**
 * Accepting from the dashboard, where there is no link to click.
 *
 * The invitations list is drawn from `book_members`' select policy, which matches
 * on the email claim — so the row's id is all the browser has. Resolving it to a
 * token here is not a weaker door than the link: `acceptInvite` refuses anyone
 * whose *confirmed* address does not match `invited_email`, so the token is a
 * convenience for reaching the page, never the thing that grants access.
 */
export async function acceptOwnInvite(memberId: string): Promise<CollabResult> {
  if (!isAdminConfigured()) {
    return { error: "Sharing isn't available on this server." };
  }
  const db = createAdminClient();
  if (!db) return { error: "Sharing isn't available on this server." };

  const { data } = await db
    .from("book_members")
    .select("token")
    .eq("id", memberId)
    .maybeSingle();

  if (!data) return { error: "That invitation is no longer there." };
  return acceptInvite(data.token);
}

export async function acceptInvite(token: string): Promise<CollabResult> {
  if (!isSupabaseConfigured() || !isAdminConfigured()) {
    return { error: "Sharing isn't available on this server." };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!me) return { error: "Sign in to accept this invitation." };

  const db = createAdminClient();
  if (!db) return { error: "Sharing isn't available on this server." };

  const { data: account } = await db.auth.admin.getUserById(me);
  if (!account?.user?.email_confirmed_at) {
    return {
      error:
        "Confirm your email address first — check your inbox for the link we sent when you signed up.",
    };
  }

  // Whose invitation this is decides which plan governs the seat count, so the
  // book's owner is read rather than assumed to be the accepter.
  const { data: invite } = await db
    .from("book_members")
    .select("book_id")
    .eq("token", token)
    .maybeSingle();
  if (!invite) return { error: "That invitation is no longer there." };

  const { data: book } = await db
    .from("books")
    .select("owner")
    .eq("id", invite.book_id)
    .maybeSingle();
  if (!book) return { error: "That book is no longer there." };

  const { error } = await db.rpc("accept_book_invite", {
    invite_token: token,
    caller: me,
    caller_email: normalizeEmail(account.user.email ?? ""),
    // Re-checked here and not only at invitation: an owner can drop off Pro with
    // nine invitations outstanding.
    max_seats: await seatsFor(book.owner),
  });

  if (error) return { error: acceptError(error) };
  return { ok: true };
}

function acceptError(error: { code?: string; message?: string }): string {
  const message = error.message ?? "";
  if (/seat cap/i.test(message)) {
    return "This book is full, so the invitation can't be taken up. Ask the owner to make room.";
  }
  if (/for somebody else/i.test(message)) {
    return "That invitation is for a different email address. Sign in as that account to accept it.";
  }
  if (/expired/i.test(message)) {
    return `That invitation has expired. Invitations last ${INVITE_DAYS} days — ask for another.`;
  }
  if (/already been answered/i.test(message)) {
    return "That invitation has already been answered.";
  }
  console.error(`[collab] accept failed [${error.code}]: ${message}`);
  return "Could not accept that invitation. Try again in a moment.";
}

/** Declining from the dashboard, where the row's id is all the browser has. */
export async function declineOwnInvite(memberId: string): Promise<CollabResult> {
  if (!isAdminConfigured()) {
    return { error: "Sharing isn't available on this server." };
  }
  const db = createAdminClient();
  if (!db) return { error: "Sharing isn't available on this server." };

  const { data } = await db
    .from("book_members")
    .select("token")
    .eq("id", memberId)
    .maybeSingle();

  if (!data) return { error: "That invitation is no longer there." };
  return declineInvite(data.token);
}

/** Declining is the invitee's own version of a revoke, and equally silent. */
export async function declineInvite(token: string): Promise<CollabResult> {
  if (!isAdminConfigured()) {
    return { error: "Sharing isn't available on this server." };
  }
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!me) return { error: "Sign in first." };

  const db = createAdminClient();
  if (!db) return { error: "Sharing isn't available on this server." };

  const { data: account } = await db.auth.admin.getUserById(me);
  const address = normalizeEmail(account?.user?.email ?? "");

  // Only the person it was addressed to may decline it, or a leaked link becomes
  // a way of cancelling other people's invitations.
  const { error } = await db
    .from("book_members")
    .update({ status: "revoked" })
    .eq("token", token)
    .eq("status", "pending")
    .eq("invited_email", address);

  if (error) {
    console.error(`[collab] could not decline: ${error.message}`);
    return { error: "Could not do that. Try again in a moment." };
  }
  return { ok: true };
}

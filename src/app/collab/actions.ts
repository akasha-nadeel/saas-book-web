"use server";

import { accountFromClaims } from "@/lib/account";
import { billingConfigured } from "@/lib/billing/provider";
import { subscriptionFor } from "@/lib/billing/server";
import { isPro } from "@/lib/billing/subscription";
import {
  INVITE_DAYS,
  inviteProblem,
  normalizeEmail,
  type CollabRole,
  type MemberStatus,
} from "@/lib/collab";
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
 * cap depends on `isPro()` and `billingConfigured()`, which are facts Postgres
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

/**
 * Said in one place because two screens and three actions say it, and a reader
 * who meets two different wordings for one state reads them as two states.
 */
const CONFIRM_FIRST =
  "Confirm your email address first — check your inbox for the link we sent when you signed up.";
const LOOKUP_FAILED =
  "We couldn’t check your account just now. Try again in a moment.";

/**
 * "On the book", as the column actually spells it.
 *
 * **A literal here is a filter that silently matches nothing.** This was written
 * as `"accepted"` — a reasonable word, and not one of the three the CHECK
 * constraint allows — so every query using it returned an empty set with no
 * error: the face pile lost every collaborator, and the "you are already on this
 * book" screen became unreachable, falling back to the dead end it was built to
 * remove. Typed against `MemberStatus`, the same mistake stops the build instead.
 */
const ON_THE_BOOK = "active" satisfies MemberStatus;

/**
 * The signed-in account: the address on it, and whether that address is
 * confirmed.
 *
 * **The lookup's own error is the whole reason this exists.** All three callers
 * read `getUserById`'s `data` and dropped its `error`, which turns a lookup that
 * *failed* into a confident false statement about somebody's account — and each
 * one failed differently:
 *
 *   - `acceptInvite` answered "confirm your email address first", which is
 *     advice that cannot help, about a state nobody had established. It is also
 *     how that action and `offerFor` came to disagree about one account: two
 *     calls, one of them failing, the failure discarded, so the page offered
 *     Accept and the press was refused for a reason that was not true.
 *   - `declineInvite` fell through to `address = ""` and matched
 *     `invited_email = ""`, which matches no row, raises no error, and told the
 *     writer their invitation was declined when nothing had happened at all.
 *   - `offerFor` read it as "not confirmed", which is the harmless one, and only
 *     by luck.
 *
 * A lookup that did not happen must not read as a fact about the account, so
 * this returns null and every caller says so in its own words.
 *
 * The address is read from the account rather than from the token's claims for
 * the reason `offerFor` documents: Supabase puts `email` in the access token
 * whether or not it has been confirmed, so matching on the claim would let
 * somebody sign up as victim@company.com, never confirm it, and accept their
 * invitation. `email_confirmed_at` is the only honest answer.
 */
async function accountFor(
  db: NonNullable<ReturnType<typeof createAdminClient>>,
  id: string,
): Promise<{ email: string; confirmed: boolean } | null> {
  const { data, error } = await db.auth.admin.getUserById(id);

  if (error || !data?.user) {
    console.error(
      `[collab] could not read the signed-in account: ${error?.message ?? "no user returned"}`,
    );
    return null;
  }

  return {
    email: normalizeEmail(data.user.email ?? ""),
    confirmed: Boolean(data.user.email_confirmed_at),
  };
}

/** The seat cap for whoever owns this book, which is the plan that governs it. */
async function seatsFor(ownerId: string): Promise<number> {
  // No gateway means nothing is for sale, so nothing is held back — the same
  // shape as `requirePro()` passing everyone when billing is unconfigured.
  // Asked of `provider.ts` rather than of PayHere: the question is whether
  // *anything* can take money, and a Paddle-only deployment (which is what
  // going live means) answers false to PayHere's own check while selling
  // perfectly well. Asking the wrong half handed every free owner Pro's seats.
  if (!billingConfigured()) return SEATS_PER_BOOK.pro;

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
  /** Where accepting sends them — the book itself, not a confirmation screen. */
  bookId: string;
  bookTitle: string;
  role: CollabRole;
  invitedEmail: string;
  /** Whether the signed-in account is the one this was addressed to. */
  forMe: boolean;
  /**
   * The address this reader is signed in as, so the page can name both sides of
   * a mismatch. Their own address and nobody else's — the page is gated, so the
   * only person who can read it is the person it belongs to.
   */
  signedInAs?: string;
  /** Why it cannot be accepted, if it cannot. */
  problem?: string;
  /**
   * They already took this invitation up — the commonest repeat visit there is,
   * since an invitation link sits in a message somebody scrolls back to.
   *
   * Kept apart from `problem` because it is not one: the link did exactly what
   * it promised. "That invitation has already been answered" is true, useless,
   * and a dead end in front of a book they own the right to open — which is why
   * every large product sends a second click straight through to the resource
   * rather than reporting on the token.
   */
  alreadyMember?: boolean;
  /**
   * Their email is not confirmed yet, so nothing can be accepted. Separate from
   * `problem` because it is the one blocked state the reader can clear
   * themselves, and so the only one that earns a control of its own.
   */
  needsConfirmation?: boolean;
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
  let signedInAs: string | undefined;
  let problem: string | undefined;
  let alreadyMember = false;
  let needsConfirmation = false;

  /*
   * **The account is resolved before the token is judged**, which is the order
   * that makes "you already have this" reachable at all. Judging the row first
   * turns an accepted invitation into "already been answered" for everybody —
   * including the person who accepted it, standing one click from a book they
   * are entitled to open.
   */
  const account = me ? await accountFor(db, me) : null;
  const isInvitee = Boolean(account && account.email === invite.invited_email);

  if (me && !account) {
    // The lookup failed, so nothing about this account is known. Saying so is
    // the only honest answer: "signed in as somebody else" and "confirm your
    // email" are both claims, and neither has been established.
    problem = LOOKUP_FAILED;
  } else if (account) {
    signedInAs = account.email || undefined;

    if (invite.status === ON_THE_BOOK && isInvitee) {
      alreadyMember = true;
    } else if (invite.status !== "pending") {
      problem = "That invitation has already been answered.";
    } else if (Date.parse(invite.expires_at) <= Date.now()) {
      problem = `That invitation has expired. Invitations last ${INVITE_DAYS} days — ask for another.`;
    } else if (isInvitee && !account.confirmed) {
      needsConfirmation = true;
      problem = CONFIRM_FIRST;
    } else {
      mine = isInvitee && account.confirmed;
    }
  } else if (invite.status !== "pending") {
    problem = "That invitation has already been answered.";
  } else if (Date.parse(invite.expires_at) <= Date.now()) {
    problem = `That invitation has expired. Invitations last ${INVITE_DAYS} days — ask for another.`;
  }

  return {
    bookId: invite.book_id,
    bookTitle: book?.title ?? "a book",
    role: invite.role,
    invitedEmail: invite.invited_email,
    forMe: mine,
    signedInAs,
    problem,
    alreadyMember,
    needsConfirmation,
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

/**
 * Send the confirmation email again.
 *
 * The one blocked state on this page a reader can clear without anybody else
 * doing anything, so it is the one that earns a button. Telling somebody to
 * check an inbox for a message that may have been sent days ago, gone to spam,
 * or never arrived — and giving them no way to ask for another — is the dead end
 * this removes.
 *
 * The address comes from the session rather than from the caller: a parameter
 * would let anybody use this to send mail to any address they liked.
 */
export async function resendConfirmation(): Promise<CollabResult> {
  if (!isSupabaseConfigured() || !isAdminConfigured()) {
    return { error: "Accounts aren't configured on this server." };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!me) return { error: "Sign in first." };

  const db = createAdminClient();
  if (!db) return { error: "Accounts aren't configured on this server." };

  const account = await accountFor(db, me);
  if (!account) return { error: LOOKUP_FAILED };
  if (account.confirmed) return { ok: true };

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: account.email,
  });

  if (error) {
    console.error(`[collab] could not resend confirmation: ${error.message}`);
    return { error: "Could not send it just now. Try again in a moment." };
  }

  return { ok: true };
}

/** A collaborator as the face pile draws them. */
export interface Face {
  name: string | null;
  avatarUrl: string | null;
}

/**
 * The name and photo behind each person on the caller's books.
 *
 * The face pile has always drawn initials, and the comment above it said why:
 * nothing in this app had ever collected an avatar for a collaborator. That was
 * a gap in the data rather than a decision — Drive, Notion and Figma all show
 * real faces, and the pile exists to answer "who can see my work" by *looking*.
 * This closes it.
 *
 * **It has to be a server action, and it takes no arguments — both for the same
 * reason.** Photos live in `auth.users.user_metadata`, which the browser cannot
 * read for anybody but itself, so the secret key is the only way to them. And a
 * function that accepted a list of user ids would be an oracle: hand it any
 * uuid and it hands back a name and a face. So the list is *derived* here from
 * the books the caller is actually on, and an id they have no business seeing
 * can never enter it.
 *
 * Only Google accounts have a photo at all. An email-and-password signup has
 * none and never will, so every caller of this must keep the initial as its
 * fallback rather than treating a null as a failure.
 */
export async function memberFaces(): Promise<Record<string, Face>> {
  if (!isSupabaseConfigured() || !isAdminConfigured()) return {};

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!me) return {};

  const db = createAdminClient();
  if (!db) return {};

  // The books this caller may see people on: their own, plus any they have
  // accepted an invitation to.
  const [{ data: owned }, { data: joined }] = await Promise.all([
    db.from("books").select("id").eq("owner", me),
    db
      .from("book_members")
      .select("book_id")
      .eq("user_id", me)
      .eq("status", ON_THE_BOOK),
  ]);

  const bookIds = [
    ...new Set([
      ...(owned ?? []).map((b) => b.id as string),
      ...(joined ?? []).map((m) => m.book_id as string),
    ]),
  ];

  // Themselves always — the pile leads with the owner, and on their own shelf
  // that is this caller.
  const ids = new Set<string>([me]);

  if (bookIds.length > 0) {
    // Together, not one after the other: neither reads the other's answer, and
    // this runs on every visit to the Collaborators screen.
    const [{ data: people }, { data: owners }] = await Promise.all([
      db
        .from("book_members")
        .select("user_id")
        .in("book_id", bookIds)
        .eq("status", ON_THE_BOOK),
      db.from("books").select("owner").in("id", bookIds),
    ]);

    for (const row of people ?? []) {
      if (typeof row.user_id === "string") ids.add(row.user_id);
    }

    for (const row of owners ?? []) {
      if (typeof row.owner === "string") ids.add(row.owner);
    }
  }

  const faces: Record<string, Face> = {};

  await Promise.all(
    [...ids].map(async (id) => {
      const { data, error } = await db.auth.admin.getUserById(id);
      if (error || !data?.user) return;

      // The same chain of fallbacks the chrome uses for the signed-in writer,
      // rather than a second reading of the same provider metadata: `avatar_url`
      // or `picture` depending on the provider, https only, and a name that is
      // usually absent.
      const account = accountFromClaims({
        email: data.user.email,
        user_metadata: data.user.user_metadata,
      });

      faces[id] = { name: account.name, avatarUrl: account.avatarUrl };
    }),
  );

  /*
   * The caller again, under a name the client can reach without knowing their
   * own uuid. The pile leads with the owner, and on the caller's own shelf that
   * disc is them — but nothing on that screen has their id to look up. A uuid
   * can never collide with this, so the map stays one shape.
   */
  if (faces[me]) faces.self = faces[me];

  return faces;
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

  const account = await accountFor(db, me);
  if (!account) return { error: LOOKUP_FAILED };
  if (!account.confirmed) return { error: CONFIRM_FIRST };

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
    caller_email: account.email,
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

/**
 * Take yourself off somebody else's book.
 *
 * **The one thing a collaborator could not do**, and it mattered more the day
 * an invitation stopped needing an Accept: following a link and signing in puts
 * a writer on a book, so without this a stray link is a book on your shelf
 * permanently and a message to the owner to get it off again. `removeMember`
 * above is the same row from the other side — the owner's — and the two are
 * kept apart rather than sharing one function precisely because they authorise
 * differently.
 *
 * **It takes a book id and never a member id, and that is the security of it.**
 * The row is found by the *caller's own* user id, so there is no argument
 * anybody can put here that reaches somebody else's membership. `removeMember`
 * can be handed any member id because it checks book ownership first; this one
 * has no such check to make, so it must not accept the id at all.
 *
 * The row is revoked rather than deleted, the way a removal is: the seat comes
 * back to the owner either way, and a deleted row would lose the fact that this
 * address was ever on the book — which the invitation's own unique index needs
 * in order to let them be invited again cleanly.
 *
 * Nobody is told. A writer leaving a book is the mirror of an owner revoking
 * access, and that is silent too.
 */
export async function leaveBook(bookId: string): Promise<CollabResult> {
  if (!isSupabaseConfigured() || !isAdminConfigured()) {
    return { error: "Sharing isn't available on this server." };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const me = typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;
  if (!me) return { error: "Sign in first." };

  const db = createAdminClient();
  if (!db) return { error: "Sharing isn't available on this server." };

  const { data, error } = await db
    .from("book_members")
    .update({ status: "revoked", user_id: null })
    .eq("book_id", bookId)
    .eq("user_id", me)
    .eq("status", ON_THE_BOOK)
    .select("id");

  if (error) {
    console.error(`[collab] could not leave a book: ${error.message}`);
    return { error: "Could not do that. Try again in a moment." };
  }

  // No row matched: they are not on this book. Answered as success rather than
  // as an error, because the writer's intent — not being on it — is already
  // true, and an error here would strand them on a book they cannot leave.
  if (!data || data.length === 0) return { ok: true };

  return { ok: true };
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

  const account = await accountFor(db, me);
  if (!account) return { error: LOOKUP_FAILED };
  const address = account.email;

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

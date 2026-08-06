/**
 * Who else is on a book, and what they may do with it.
 *
 * Some books have two writers. Until now the app could not express that at all:
 * every row in the library schema carries `owner uuid` and every policy on it is
 * `auth.uid() = owner`, so a book was reachable by exactly one account. This is
 * the pure half of the answer — the roles, what each one can do, how an
 * invitation ages, and how many people a plan lets onto one book. The SQL
 * enforces it, the screens draw it, and neither of them decides it.
 *
 * **Two roles, and the second one is deliberately the last.** An editor writes
 * the book; a viewer reads it. The standard third rung across this trade is a
 * *commenter*, and it is absent because there are no comments in this app — a
 * role that cannot do the one thing its name promises is worse than a role that
 * does not exist. The cautionary case is Reedsy, which advertises three
 * permission levels while every invitee in fact gets full edit rights; two
 * enforced roles beat three decorative ones.
 *
 * **The line between editor and owner is drawn at the book rather than at the
 * prose**, which is where Atticus draws it too: a co-writer may write and may
 * arrange chapters, but the book's identity — its title, its cover, its shop
 * listing — stays with whoever owns it. That is not squeamishness about trust.
 * `last_opened_id`, `last_opened_at` and `position` live on the `books` row, and
 * they are *per-writer* state: an editor allowed to write that row would
 * overwrite the owner's "where you left off" every few minutes. Keeping the
 * whole row owner-only needs no column-level rules and reduces to one sentence
 * a writer can hold in their head — **an editor writes the book, the owner owns
 * the book.**
 *
 * A viewer keeps export. They can read the whole manuscript anyway, so refusing
 * them the file would be theatre; Google's viewers can download for the same
 * reason.
 */

// ---------------------------------------------------------------------------
// The roles
// ---------------------------------------------------------------------------

/** A role that can be granted. Ownership is not granted, so it is not here. */
export type CollabRole = "editor" | "viewer";

/** Every role somebody can hold on a book, including the one nobody grants. */
export type BookRole = "owner" | CollabRole;

/** Grantable roles, in the order the dropdown offers them. */
export const COLLAB_ROLES: readonly CollabRole[] = ["editor", "viewer"];

/**
 * What each role is called, and what it does, in the words the screen uses.
 *
 * Named for the *capability* rather than for a tier — "Can edit" and "Can view"
 * explain themselves where "Collaborator" and "Contributor" are nouns whose
 * powers have to be learned. This is Figma's whole vocabulary and it is the one
 * nearly every product on the list converges on.
 */
export const ROLE_LABELS: Record<BookRole, { label: string; what: string }> = {
  owner: {
    label: "Owner",
    what: "Everything, including who else is on the book.",
  },
  editor: {
    label: "Can edit",
    what: "Write the chapters, and add, rename or reorder them.",
  },
  viewer: {
    label: "Can view",
    what: "Read the book and export it. No changes.",
  },
};

// ---------------------------------------------------------------------------
// What a role may do
// ---------------------------------------------------------------------------

/**
 * The capabilities the app asks about, one per question a screen actually has.
 *
 * Deliberately coarse. A finer list would let a role acquire a power by
 * accident — the failure mode here is a permission that reads as enforced and is
 * not, so there are few enough of these to check against the SQL by eye.
 */
export type Capability =
  /** Open the manuscript, read it, export it. */
  | "read"
  /** Write prose and chapter notes. */
  | "writeProse"
  /** Add, rename, reorder, delete or import chapters. */
  | "manageChapters"
  /** Title, author, genre, cover, page setup, typography, listing details. */
  | "editBook"
  /** Archive, trash or delete the whole book. */
  | "manageBook"
  /** Invite somebody, change their role, remove them. */
  | "manageMembers";

/**
 * The table, and it is the whole of the policy on this side.
 *
 * Stated as a table rather than as a chain of `if`s so that reading it answers
 * the question completely — and so a test can walk it. The one that matters is
 * the viewer's row: it holds exactly one capability, and if anything ever
 * appears beside it, read-only has stopped being read-only.
 */
const CAN: Record<BookRole, readonly Capability[]> = {
  owner: [
    "read",
    "writeProse",
    "manageChapters",
    "editBook",
    "manageBook",
    "manageMembers",
  ],
  editor: ["read", "writeProse", "manageChapters"],
  viewer: ["read"],
};

/**
 * May this role do this?
 *
 * `null` means no role at all — not signed in, not invited, or revoked — and it
 * answers false to everything. The absence of a role is the default rather than
 * a case to remember: a screen that forgets to look up a role fails closed.
 */
export function can(role: BookRole | null, capability: Capability): boolean {
  if (!role) return false;
  return CAN[role].includes(capability);
}

/** Every capability a role holds, for a screen laying itself out around them. */
export function capabilitiesOf(role: BookRole | null): readonly Capability[] {
  return role ? CAN[role] : [];
}

/**
 * The book is somebody else's.
 *
 * Absence of a `role` on a `Book` means it is the writer's own — a book made
 * offline has no role and no owner id — so this is the test every screen wants
 * rather than a comparison against the signed-in id, which a component would
 * have to fetch.
 */
export function isSharedWithMe(role: BookRole | null | undefined): boolean {
  return role === "editor" || role === "viewer";
}

// ---------------------------------------------------------------------------
// Membership, and how an invitation ages
// ---------------------------------------------------------------------------

/** What the row says about itself. Expiry is derived, not stored — see below. */
export type MemberStatus = "pending" | "active" | "revoked";

/** What the *screen* says about it, once the clock has been taken into account. */
export type MemberState = MemberStatus | "expired";

/** One person on one book, as the client sees a `book_members` row. */
export interface Member {
  id: string;
  bookId: string;
  /** The invited address, lowercased. The identity until somebody accepts. */
  email: string;
  /** Set only on acceptance. Null means the invitation is still an invitation. */
  userId: string | null;
  role: CollabRole;
  status: MemberStatus;
  /** Epoch ms, like every other stamp in the store. */
  expiresAt: number;
  acceptedAt: number | null;
  /** A display name, once there is an account to take one from. */
  name?: string;
}

/**
 * How long a pending invitation lives.
 *
 * **An invitation that never expires is a live pointer at somebody's manuscript,
 * sitting in an inbox years later.** GitHub added seven-day self-expiry to its
 * repository invites on purpose; Dabble uses thirty. Fourteen is the middle: long
 * enough that a co-writer who was away for a fortnight is not locked out, short
 * enough that a forgotten invite stops mattering. Re-inviting is one press, so
 * being wrong here is cheap in the safe direction.
 */
export const INVITE_DAYS = 14;

const DAY = 24 * 60 * 60 * 1000;

/** When an invitation sent now should stop working. */
export function inviteExpiry(from: number = Date.now()): number {
  return from + INVITE_DAYS * DAY;
}

/**
 * What this row really is, right now.
 *
 * **Expiry is derived rather than stored**, and that is the load-bearing part: a
 * stored `expired` status would need something to go round and set it, and until
 * that something ran the invitation would still work. Comparing the stamp means
 * an invitation is dead at the instant it should be, with nothing scheduled and
 * nothing to fail.
 *
 * Only a *pending* row can expire. An accepted membership has no deadline —
 * somebody who is on the book stays on it until they are taken off.
 */
export function memberState(
  member: Member,
  now: number = Date.now(),
): MemberState {
  if (member.status !== "pending") return member.status;
  return member.expiresAt <= now ? "expired" : "pending";
}

/**
 * The role this account holds on the book, or null.
 *
 * Two conditions, and both are required: the membership must be **active** and it
 * must carry **this user's id**. A pending row matching somebody's email address
 * grants nothing — it says an invitation exists, which is all it is for. Deciding
 * access on an email match would make an address the credential, and an address
 * is not a secret.
 */
export function roleFor(
  members: readonly Member[],
  userId: string | null,
): CollabRole | null {
  if (!userId) return null;
  for (const member of members) {
    if (member.status === "active" && member.userId === userId) {
      return member.role;
    }
  }
  return null;
}

/**
 * The invitations this address should be shown, newest deadline first.
 *
 * Matched on the email rather than on an id, because the whole point of a pending
 * invitation is that the account it is for may not have existed when it was sent.
 */
export function invitesFor(
  members: readonly Member[],
  email: string | null | undefined,
  now: number = Date.now(),
): Member[] {
  const wanted = normalizeEmail(email ?? "");
  if (!wanted) return [];
  return members
    .filter((m) => m.email === wanted && memberState(m, now) === "pending")
    .sort((a, b) => b.expiresAt - a.expiresAt);
}

// ---------------------------------------------------------------------------
// Seats
// ---------------------------------------------------------------------------

/**
 * How many people a book is currently holding, the owner included.
 *
 * **A pending invitation occupies a seat.** It has not been accepted, so it is
 * tempting not to count it — and that is the trap: an owner on the free plan
 * could send nine invitations, be told there was room each time, and then have
 * eight of them refused at the moment their co-writers pressed Accept. The
 * refusal would land on the wrong person, in the wrong place, days later. So a
 * seat is spent when the invitation goes out and comes back when it is cancelled,
 * revoked, or left to expire.
 *
 * The owner is counted because the number on the pricing page is the number of
 * people on the book — two on free means the writer and one other, which is what
 * a reader of that page expects it to mean.
 */
export function seatsUsed(
  members: readonly Member[],
  now: number = Date.now(),
): number {
  let people = 1; // the owner
  for (const member of members) {
    const state = memberState(member, now);
    if (state === "active" || state === "pending") people += 1;
  }
  return people;
}

// ---------------------------------------------------------------------------
// The invited address
// ---------------------------------------------------------------------------

/**
 * One spelling of an address, so a row can be found by it.
 *
 * Lowercased and trimmed, and done here rather than at each of the three places
 * that compare one — the Server Action that writes the row, the accept screen
 * that matches the signed-in account against it, and `invitesFor` above. Two of
 * those agreeing and the third not is a writer who cannot accept an invitation
 * that is plainly addressed to them.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Is this worth sending?
 *
 * Deliberately loose. The real check is that somebody signs in as this address,
 * which no pattern can do — so this only catches the typo that would otherwise
 * produce an invitation nobody can ever accept, and refuses nothing that might
 * be a real address.
 */
export function isLikelyEmail(email: string): boolean {
  const value = normalizeEmail(email);
  if (value.length < 3 || value.length > 320) return false;
  const at = value.indexOf("@");
  if (at < 1 || at !== value.lastIndexOf("@")) return false;
  const domain = value.slice(at + 1);
  return domain.includes(".") && !domain.startsWith(".") && !domain.endsWith(".") && !/\s/.test(value);
}

/**
 * Why this address cannot be invited to this book, or null if it can.
 *
 * Returns the sentence rather than a code: there are four of them, every caller
 * wants to print it, and a code would be turned back into these same words in
 * two places. `ownerEmail` and the existing members are what make the answer
 * specific — "you are already on this book" is a better refusal than "invalid".
 */
export function inviteProblem(
  email: string,
  {
    ownerEmail,
    members,
    now = Date.now(),
  }: {
    ownerEmail: string | null | undefined;
    members: readonly Member[];
    now?: number;
  },
): string | null {
  const value = normalizeEmail(email);
  if (!value) return "Enter an email address.";
  if (!isLikelyEmail(value)) return "That does not look like an email address.";
  if (ownerEmail && value === normalizeEmail(ownerEmail)) {
    return "This is your own book — you already have every permission on it.";
  }

  for (const member of members) {
    if (member.email !== value) continue;
    const state = memberState(member, now);
    if (state === "active") return "They are already on this book.";
    if (state === "pending") return "They have already been invited.";
  }

  return null;
}

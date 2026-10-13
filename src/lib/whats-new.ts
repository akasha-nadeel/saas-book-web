/**
 * Product announcements shown once, and who they are shown to.
 *
 * **One notice so far: unlimited books on every plan** (2026-10-13). Free held
 * three books until then; the writers who were here before should hear that
 * the limit is gone, once. A writer who signs up afterwards should not — for
 * them unlimited is simply how the app is, and a "what's new" about something
 * they never lacked is noise.
 *
 * **Nobody has to sign in again to see it.** Most writers stay signed in for
 * weeks; the account is read off the session they already have, and a writer
 * with no account (or a lookup that failed) is judged by their own books
 * instead, so the notice still reaches them rather than silently never.
 *
 * Pure, so the rule is tested rather than eyeballed. The dialog that shows it
 * is `components/shelf/whats-new.tsx`.
 */

export const NOTICE_UNLIMITED_BOOKS = "unlimited-books-2026-10";

/** When unlimited books shipped. Accounts and books older than this were here before. */
export const NOTICE_FROM = Date.UTC(2026, 9, 13);

export interface NoticeInput {
  id: string;
  /** Notice ids this reader has answered — this machine's and the account's. */
  seen: readonly string[];
  /**
   * When the signed-in account was created, in epoch ms, or null when there
   * is no account here or it could not be read.
   */
  accountCreatedAt: number | null;
  /** The shelf, for a reader with no account to read. */
  books: readonly { lastOpenedAt: number }[];
  from: number;
}

/**
 * Whether to show the notice.
 *
 * - Answered already, on this machine or on the account: no.
 * - An account we can read: yes when it was made before `from`.
 * - No account, or no answer about it: yes when a book here was last opened
 *   before `from` — this reader was writing here before the change.
 */
export function shouldShowNotice(input: NoticeInput): boolean {
  if (input.seen.includes(input.id)) return false;
  if (input.accountCreatedAt !== null) return input.accountCreatedAt < input.from;
  return input.books.some(
    (b) => Number.isFinite(b.lastOpenedAt) && b.lastOpenedAt > 0 && b.lastOpenedAt < input.from,
  );
}

/** A `user_metadata.notices_seen` value narrowed to ids. */
export function seenFromMetadata(metadata: unknown): string[] {
  const list = (metadata as { notices_seen?: unknown } | null)?.notices_seen;
  return Array.isArray(list) ? list.filter((id): id is string => typeof id === "string") : [];
}

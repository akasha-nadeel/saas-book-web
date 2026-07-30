/**
 * Who the chrome says you are.
 *
 * A signed-in writer is three things on screen — a name, a face, and an email —
 * and where each comes from depends on how they signed in. Google hands over a
 * real name and a photo; an email-and-password signup hands over neither. So
 * this is a chain of fallbacks rather than a field lookup, and it is kept out of
 * the components because the shelf header and the account dialog have to agree
 * on the answer.
 *
 * Pure, and given whatever the JWT actually contains rather than a typed user:
 * `user_metadata` is written by identity providers, not by us, and nothing has
 * ever type-checked it.
 */

export interface Account {
  email: string | null;
  /** The writer's own name, when a provider gave us one. */
  name: string | null;
  /** A photo URL, when a provider gave us one. */
  avatarUrl: string | null;
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Only `https:`.
 *
 * This lands in an `<img src>`, and the value arrives from an identity
 * provider's metadata rather than from us. Nothing dangerous is *known* to fit
 * through an img src, but the narrowing costs one line and the alternative is
 * trusting a field we do not write. A URL that fails this simply falls back to
 * the initial, which is a face nobody misses.
 */
function httpsUrl(value: unknown): string | null {
  const raw = str(value);
  if (!raw) return null;

  try {
    return new URL(raw).protocol === "https:" ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Read an account out of verified JWT claims.
 *
 * `user_metadata` is where Supabase puts what the provider said. Google fills
 * `full_name`/`name` and `avatar_url`/`picture`; both spellings are checked
 * because which one is present depends on the provider, and a missing name is
 * the normal case rather than an error.
 */
export function accountFromClaims(claims: Record<string, unknown>): Account {
  const meta = (claims.user_metadata ?? {}) as Record<string, unknown>;

  return {
    email: str(claims.email),
    name: str(meta.full_name) ?? str(meta.name),
    avatarUrl: httpsUrl(meta.avatar_url) ?? httpsUrl(meta.picture),
  };
}

/**
 * What to call them.
 *
 * The real name when there is one, the email's local part when there is not,
 * and "Guest" when there are no accounts at all. The middle case is a guess —
 * "kha.akashanadeel" is not what anyone calls themselves — which is exactly why
 * the real name is preferred wherever a provider gave us one.
 */
export function displayName(account: Account | null): string {
  if (!account) return "Guest";
  if (account.name) return account.name;

  const local = account.email?.split("@")[0];
  return local && local.length > 0 ? local : "Guest";
}

/**
 * Just the first word.
 *
 * For the header chip, which has room for about nine characters before it
 * truncates — and "Akasha Nadeel gun…" is worse than "Akasha" in every way: it
 * is longer, less readable, and ends mid-word. The full name still appears in
 * the menu the chip opens, where there is room for it.
 */
export function firstNameOf(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

/** The letter in the circle, for when there is no photo to put there. */
export function initialOf(name: string): string {
  // Codepoint-wise, so a name starting with an emoji or an astral character
  // yields that character rather than half of it.
  const first = [...name.trim()][0];
  return first ? first.toUpperCase() : "G";
}

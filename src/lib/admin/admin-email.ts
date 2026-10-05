/**
 * Who the operator is.
 *
 * `ADMIN_EMAILS` is a comma-separated list, read on the server only — it has
 * no NEXT_PUBLIC_ prefix, so it never reaches a browser, and a client
 * component that imported this would read `undefined` and answer false.
 *
 * **Unset means nobody is admin.** That is the safe failure and the reason the
 * address lives in an environment variable rather than in the source: a
 * deployment that forgot it shows every writer the ordinary dashboard, rather
 * than one that inherited somebody's address showing them everybody's.
 *
 * Exact match after trimming and lower-casing. Nothing fuzzier: a suffix or a
 * domain match would make an address the operator does not own an admin.
 *
 * This decides which screen to draw. It is not the lock — `requireAdmin()`
 * also asks Supabase whether the address is confirmed, and the data behind
 * `/admin` is reachable only with the secret key.
 */
export function adminEmails(raw: string | undefined = process.env.ADMIN_EMAILS): string[] {
  return (raw ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

export function isAdminEmail(
  email: unknown,
  raw: string | undefined = process.env.ADMIN_EMAILS,
): boolean {
  if (typeof email !== "string") return false;
  const wanted = email.trim().toLowerCase();
  if (wanted.length === 0) return false;
  return adminEmails(raw).includes(wanted);
}

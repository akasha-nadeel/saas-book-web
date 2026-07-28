/**
 * Where the Supabase project lives — and whether there is one at all.
 *
 * Accounts are optional the way the assistant's API key is optional: with these
 * two values unset the app runs exactly as it always has — the local library,
 * no sign-in wall — and the account menu says so plainly rather than offering a
 * button that cannot work. A fresh clone therefore still runs before anyone has
 * a project to point it at.
 *
 * Both are public by design. The publishable key is meant to reach the browser;
 * it grants nothing on its own, since row-level security is what decides who
 * may read what. The secret key must never be named with a NEXT_PUBLIC_ prefix,
 * because Next inlines every such variable into the client bundle.
 */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

/**
 * True once a project is configured. Every auth entry point checks this first:
 * the clients throw on an empty URL, so nothing may build one without asking.
 */
export function isSupabaseConfigured(): boolean {
  return SUPABASE_URL.length > 0 && SUPABASE_PUBLISHABLE_KEY.length > 0;
}

/** What to tell a writer who reaches a sign-in screen with no project behind it. */
export const NOT_CONFIGURED =
  "Accounts aren't configured. Add NEXT_PUBLIC_SUPABASE_URL and " +
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to .env.local and restart the dev server.";

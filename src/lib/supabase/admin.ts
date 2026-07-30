import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./config";

/**
 * The client with no user attached, for the one caller that has no user.
 *
 * PayHere's payment notification arrives as a POST from PayHere's servers. It
 * carries no cookies and no session — there is no signed-in writer to act as,
 * and yet it is the only thing allowed to write a subscription. So it uses the
 * secret key, which row-level security does not apply to.
 *
 * Three things follow from that, all of them load-bearing:
 *
 *   - The key is read from a name with no NEXT_PUBLIC_ prefix, so Next cannot
 *     inline it into the browser bundle. This module must never be imported by
 *     a client component; the `@supabase/ssr` clients in client.ts and
 *     server.ts are what everything else uses.
 *   - Sessions are off. This client has no cookies to persist and no token to
 *     refresh, and leaving persistence on would have it write to a storage that
 *     does not exist on a server.
 *   - Every query it runs is unfiltered by RLS, so *every* query it runs must
 *     name the owner itself. Forgetting a `.eq("owner", …)` here does not fail
 *     loudly the way it would elsewhere — it quietly reads somebody else's row.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SECRET_KEY ?? "";
  if (!SUPABASE_URL || !key) return null;

  return createSupabaseClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * True when the webhook has what it needs to record a payment. Checked before
 * a checkout starts rather than after one is paid for: taking money the app
 * cannot then act on is the worst of the failure modes available here.
 */
export function isAdminConfigured(): boolean {
  return Boolean(SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

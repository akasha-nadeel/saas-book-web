import "server-only";

import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "./admin-email";

export type AdminDb = NonNullable<ReturnType<typeof createAdminClient>>;

export type AdminSession =
  | { ready: true; id: string; email: string; db: AdminDb }
  /**
   * The address matched but there is no secret key on this deployment, so
   * nothing can be read and nothing could be confirmed. The page says which
   * variable is missing; it shows no data, because it has none.
   */
  | { ready: false; id: string; email: string };

/**
 * The lock on every `/admin` screen. Anyone who is not the operator gets a
 * 404 — the same answer a hidden route gives — rather than a refusal that
 * says there is something here.
 *
 * Two checks, in this order:
 *
 *   1. `getClaims()` — the verified token, never `getSession()`, which trusts
 *      the cookie — and its email against `ADMIN_EMAILS`.
 *   2. The account itself, read with the secret key: the address must be
 *      **confirmed** and must still be the one on the list. A token minted
 *      before an email change, or an address somebody signed up with and never
 *      proved, does not get in.
 *
 * Call it first in the page, before any read.
 */
export async function requireAdmin(): Promise<AdminSession> {
  if (!isSupabaseConfigured()) notFound();

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const sub = typeof claims?.sub === "string" ? claims.sub : null;
  const email = typeof claims?.email === "string" ? claims.email : null;

  if (!sub || !email || !isAdminEmail(email)) notFound();

  const db = createAdminClient();
  if (!db) return { ready: false, id: sub, email };

  const { data: found, error } = await db.auth.admin.getUserById(sub);
  const user = found?.user;
  if (error || !user || !user.email_confirmed_at || !isAdminEmail(user.email)) {
    notFound();
  }

  return { ready: true, id: sub, email: user.email ?? email, db };
}

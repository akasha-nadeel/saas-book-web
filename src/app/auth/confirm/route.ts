import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { safeNext } from "@/lib/auth-redirect";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * The far end of a confirmation email.
 *
 * Exchanging the link's one-time credential *here*, on the server, is what turns
 * a confirmed address into a signed-in writer — only the server can write the
 * httpOnly session cookie.
 *
 * Two shapes arrive, and both are handled on purpose:
 *
 * - `?code=` — what Supabase's stock email template produces. Its link goes to
 *   Supabase's own verify endpoint, which bounces back here with a PKCE auth
 *   code to exchange.
 * - `?token_hash=&type=` — what you get after rewriting the template to point
 *   straight at this route, as Supabase's SSR guide suggests.
 *
 * Supporting both means a fresh project works before anyone has touched the
 * email templates, and keeps working after. Nothing here is secret: a
 * credential that fails to verify just lands the writer on the sign-in screen
 * with a plain explanation.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const next = safeNext(searchParams.get("next"));

  // Supabase reports its own failures this way — an expired link, mostly.
  if (searchParams.get("error")) redirect("/signin?error=link");

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (!isSupabaseConfigured() || (!code && !tokenHash)) {
    redirect("/signin?error=link");
  }

  const supabase = await createClient();

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({
        // Only reachable with tokenHash set; `type` defaults to the signup
        // confirmation, which is the one link a stock project sends.
        type: type ?? "email",
        token_hash: tokenHash as string,
      });

  // redirect() throws to unwind, so it stays clear of anything that catches.
  if (error) redirect("/signin?error=link");

  redirect(next);
}

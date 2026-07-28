"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/auth-redirect";
import { NOT_CONFIGURED, isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * Sign in, sign up, sign out.
 *
 * Server Actions rather than a client-side call to Supabase, for one reason
 * that matters: the session cookie is set on the server as part of the same
 * response that redirects, so the writer never lands on a page that has to
 * discover afterwards who they are. No sign-in flash, no loading gate.
 */

export type AuthState = {
  /** Something went wrong; shown in red under the form. */
  error?: string;
  /** Something is pending on the writer's side — usually a confirmation email. */
  notice?: string;
};

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

export async function signIn(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };

  const { email, password } = readCredentials(formData);
  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase says "Invalid login credentials" without saying which half was
    // wrong, and that is the right answer — telling someone an email exists is
    // how account lists get harvested. Pass it through rather than guessing.
    return { error: error.message };
  }

  // The shelf renders per-request now, so the cached signed-out render has to
  // go or the writer lands back on the marketing-side of the wall.
  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function signUp(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };

  const { email, password } = readCredentials(formData);
  if (!email || !password) {
    return { error: "Enter your email and a password." };
  }
  // Supabase's own floor is 6. Ask for a little more rather than letting the
  // server reject it after a round trip.
  if (password.length < 8) {
    return { error: "Use at least 8 characters." };
  }

  const origin = (await headers()).get("origin") ?? "";
  const next = safeNext(formData.get("next"));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) return { error: error.message };

  // An email that is already registered comes back looking like a fresh signup
  // with no identities — deliberately, so the form cannot be used to test which
  // addresses exist. Answer the same way a real signup does.
  if (data.user && data.user.identities?.length === 0) {
    return {
      notice: `If ${email} isn't already registered, a confirmation link is on its way.`,
    };
  }

  // With email confirmation switched off, signUp returns a live session and the
  // writer is simply in. With it on, session is null until they click the link.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect(next);
  }

  return {
    notice: `Check ${email} for a confirmation link, then sign in.`,
  };
}

/**
 * Step one of a forgotten password: mail a recovery link.
 *
 * The link lands on /auth/confirm like any other, which exchanges it for a
 * session and forwards to /reset-password. That is why the reset screen needs
 * no token of its own — by the time a writer reaches it they are already
 * signed in, and updateUser() knows who they are.
 */
export async function requestPasswordReset(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };

  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email." };

  const origin = (await headers()).get("origin") ?? "";

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm?next=${encodeURIComponent("/reset-password")}`,
  });

  // Supabase does not error on an address it has never seen — deliberately, so
  // this form cannot be used to discover who has an account. Errors that do
  // arrive are worth showing: a rate limit is something the writer can act on.
  if (error) return { error: error.message };

  // Phrased so it says the same thing either way.
  return {
    notice: `If ${email} has an account, a reset link is on its way. The link opens in this browser only.`,
  };
}

/**
 * Step two: set the new password.
 *
 * Reachable only with a session, which the recovery link established — the
 * proxy bounces anyone else to sign-in. Doubles as an ordinary change-password
 * screen for someone already signed in.
 */
export async function updatePassword(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) return { error: NOT_CONFIGURED };

  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== confirm) return { error: "Those two don’t match." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signOut() {
  if (!isSupabaseConfigured()) redirect("/");

  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");
  redirect("/signin");
}

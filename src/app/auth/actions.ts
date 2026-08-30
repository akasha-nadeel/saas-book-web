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

async function getOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin && origin !== "null") return origin.replace(/\/+$/, "");

  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`.replace(/\/+$/, "");

  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

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

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // Supabase says "Invalid login credentials" without saying which half was
      // wrong, and that is the right answer — telling someone an email exists is
      // how account lists get harvested. Pass it through rather than guessing.
      return { error: error.message };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to sign in.";
    return { error: message };
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

  const origin = await getOrigin();
  const next = safeNext(formData.get("next"));

  let shouldRedirect = false;
  try {
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
      shouldRedirect = true;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to sign up.";
    return { error: message };
  }

  if (shouldRedirect) {
    revalidatePath("/", "layout");
    redirect(next);
  }

  return {
    notice: `Check ${email} for a confirmation link, then sign in.`,
  };
}

/**
 * Hand off to Google.
 *
 * Run as a Server Action rather than from the browser so the PKCE verifier is
 * written to an httpOnly cookie by the same request that starts the handshake.
 * Google returns to Supabase, Supabase returns to /auth/confirm with a `code`,
 * and that route exchanges it exactly as it does an emailed link — one place
 * where sessions get created, whatever started them.
 *
 * Not wired to useActionState: this always ends in a redirect, so there is no
 * state to hand back.
 */
export async function signInWithGoogle(formData: FormData) {
  if (!isSupabaseConfigured()) {
    redirect("/signin?error=config");
  }

  const next = safeNext(formData.get("next"));
  const origin = await getOrigin();

  let targetUrl = "";
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
      },
    });

    if (error || !data?.url) {
      targetUrl = "/signin?error=oauth";
    } else {
      targetUrl = data.url;
    }
  } catch {
    targetUrl = "/signin?error=oauth";
  }

  if (targetUrl) {
    redirect(targetUrl);
  }
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

  const origin = await getOrigin();

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

/**
 * Sign out, and optionally say where sign-in should land afterwards.
 *
 * The `next` field is what makes "switch account" possible rather than merely
 * "sign out": an invitation addressed to another account is a dead end without
 * it — the reader signs out, signs in as the right address, and arrives back at
 * the shelf with no memory of the link they were trying to open. Guarded by
 * `safeNext` like every other destination read out of a form or a query string,
 * because this one reaches the browser as a hidden input.
 *
 * The parameter is optional so the account menu's plain `<form action={signOut}>`
 * keeps working untouched — a form with no `next` field lands on `/signin`, as
 * it always did.
 */
export async function signOut(formData?: FormData) {
  if (!isSupabaseConfigured()) redirect("/");

  const next = safeNext(formData?.get("next"));
  // Which address to sign in *as*, when the caller knows. Only ever the one
  // already on screen — the invitation names it — and it is put in the field
  // rather than merely suggested, because the browser will otherwise autofill
  // the account being signed out of, which is the one that cannot be used.
  const email = formData?.get("email");

  const supabase = await createClient();
  await supabase.auth.signOut();

  revalidatePath("/", "layout");

  if (next === "/") redirect("/signin");

  const query = new URLSearchParams({ next });
  if (typeof email === "string" && email) query.set("email", email);
  redirect(`/signin?${query}`);
}

"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type AuthState, signIn, signUp } from "@/app/auth/actions";
import {
  AuthShell,
  FIELD,
  FormError,
  FormNotice,
  SUBMIT,
} from "@/components/auth/auth-shell";

/**
 * The sign-in and sign-up form — one component, because the two differ in their
 * copy and their action and in nothing else, and keeping them together is what
 * stops the two screens drifting apart.
 *
 * The action runs on the server, so the session cookie and the redirect arrive
 * in the same response. React hands back `isPending` from useActionState, which
 * is why there is no separate loading state to keep in sync.
 */

const COPY = {
  signin: {
    heading: "Welcome back",
    lede: "Sign in to reach your shelf.",
    submit: "Sign in",
    working: "Signing in…",
    switchLede: "New here?",
    switchLabel: "Create an account",
    switchHref: "/signup",
    autoComplete: "current-password",
  },
  signup: {
    heading: "Start writing",
    lede: "Create an account to keep your books.",
    submit: "Create account",
    working: "Creating…",
    switchLede: "Already have an account?",
    switchLabel: "Sign in",
    switchHref: "/signin",
    autoComplete: "new-password",
  },
} as const;

export function AuthForm({
  mode,
  next,
  linkError,
}: {
  mode: "signin" | "signup";
  next: string;
  /** The confirmation link was stale or already used. */
  linkError?: boolean;
}) {
  const copy = COPY[mode];
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    mode === "signin" ? signIn : signUp,
    {},
  );

  return (
    <AuthShell>
      <h1 className="font-serif text-2xl text-fg">{copy.heading}</h1>
      <p className="mt-1.5 font-sans text-sm text-muted">{copy.lede}</p>

      {linkError && (
        <div className="mt-5">
          <FormNotice>
            That link has expired or was already used — they work once, and only
            in the browser that asked for them. Sign in, or start again to get a
            fresh one.
          </FormNotice>
        </div>
      )}

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />

        <label className="flex flex-col gap-1.5">
          <span className="font-sans text-sm font-medium text-fg">Email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            autoFocus
            placeholder="you@example.com"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="flex items-baseline justify-between gap-3">
            <span className="font-sans text-sm font-medium text-fg">
              Password
            </span>
            {/* Only on sign-in. Offering it during signup would be asking to
                reset a password they are in the middle of choosing. */}
            {mode === "signin" && (
              <Link
                href="/forgot-password"
                className="font-sans text-xs text-muted underline-offset-2
                           outline-none hover:text-fg hover:underline
                           focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                Forgot it?
              </Link>
            )}
          </span>
          <input
            type="password"
            name="password"
            required
            minLength={mode === "signup" ? 8 : undefined}
            autoComplete={copy.autoComplete}
            placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
            className={FIELD}
          />
        </label>

        {state.error && <FormError>{state.error}</FormError>}
        {state.notice && <FormNotice>{state.notice}</FormNotice>}

        <button type="submit" disabled={isPending} className={SUBMIT}>
          {isPending ? copy.working : copy.submit}
        </button>
      </form>

      <p className="mt-5 font-sans text-sm text-muted">
        {copy.switchLede}{" "}
        <Link
          href={copy.switchHref}
          className="font-medium text-accent underline-offset-2 outline-none
                     hover:underline focus-visible:ring-2
                     focus-visible:ring-accent/50"
        >
          {copy.switchLabel}
        </Link>
      </p>
    </AuthShell>
  );
}

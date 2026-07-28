"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type AuthState, signIn, signUp } from "@/app/auth/actions";

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
    // h-dvh, not min-h-dvh: <body> is overflow-hidden for the editor shell, so
    // a standalone page has to own its own scrolling or its foot is unreachable.
    <div className="h-dvh overflow-y-auto bg-surface">
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-6 py-12">
        <Link
          href="/"
          className="self-center font-display text-2xl font-semibold tracking-tight
                     text-fg outline-none focus-visible:ring-2
                     focus-visible:ring-accent/50"
        >
          Open<span style={{ color: "#3a86d4" }}>Chapter</span>
        </Link>

        <div className="mt-8 rounded-2xl border border-line bg-panel p-7 shadow-sm">
          <h1 className="font-serif text-2xl text-fg">{copy.heading}</h1>
          <p className="mt-1.5 font-sans text-sm text-muted">{copy.lede}</p>

          {linkError && (
            <p
              role="status"
              className="mt-5 rounded-lg bg-raised px-3.5 py-3 font-sans text-sm
                         leading-relaxed text-fg"
            >
              That confirmation link has expired or was already used. Sign in, or
              create the account again to get a fresh one.
            </p>
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
                className="rounded-lg border border-line bg-surface px-3.5 py-2.5
                           font-sans text-sm text-fg placeholder:text-muted
                           focus-visible:border-accent focus-visible:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="font-sans text-sm font-medium text-fg">
                Password
              </span>
              <input
                type="password"
                name="password"
                required
                minLength={mode === "signup" ? 8 : undefined}
                autoComplete={copy.autoComplete}
                placeholder={mode === "signup" ? "At least 8 characters" : "••••••••"}
                className="rounded-lg border border-line bg-surface px-3.5 py-2.5
                           font-sans text-sm text-fg placeholder:text-muted
                           focus-visible:border-accent focus-visible:outline-none"
              />
            </label>

            {state.error && (
              <p role="alert" className="font-sans text-sm text-danger">
                {state.error}
              </p>
            )}
            {state.notice && (
              <p
                role="status"
                className="rounded-lg bg-raised px-3.5 py-3 font-sans text-sm
                           leading-relaxed text-fg"
              >
                {state.notice}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="mt-1 rounded-lg bg-accent py-2.5 font-sans text-sm
                         font-semibold text-white outline-none transition-colors
                         hover:bg-accent-strong focus-visible:ring-2
                         focus-visible:ring-accent/60 disabled:opacity-60"
            >
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
        </div>

        {/* Said here rather than discovered later: an account is not yet a
            backup. Storage moves to Supabase as its own piece of work. */}
        <p className="mt-6 px-2 text-center font-sans text-xs leading-relaxed text-muted">
          Your manuscripts are still stored in this browser. Signing in doesn’t
          move them yet — syncing comes with the next release.
        </p>
      </div>
    </div>
  );
}

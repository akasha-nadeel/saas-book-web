"use client";

import { useActionState } from "react";
import {
  type AuthState,
  signIn,
  signInWithGoogle,
  signUp,
} from "@/app/auth/actions";
import {
  AuthHeading,
  AuthLink,
  AuthShell,
  FIELD,
  FieldLabel,
  FormError,
  FormNotice,
  GoogleButton,
  OrDivider,
  PasswordField,
  SUBMIT,
  useAuthProblem,
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
    lede: "Enter your details to reach your shelf.",
    submit: "Sign in",
    working: "Signing in…",
    switchLede: "Don’t have an account?",
    switchLabel: "Sign up",
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

/** What went wrong before we got here, if anything, as told by ?error=. */
const PROBLEM: Record<string, string> = {
  link:
    "That link has expired or was already used — they work once, and only in " +
    "the browser that asked for them. Sign in, or start again to get a fresh one.",
  oauth:
    "Google sign-in isn’t available on this deployment. Use your email and " +
    "password below.",
  config:
    "Accounts aren’t configured on this deployment, so there is nothing to " +
    "sign in to.",
};

export function AuthForm({
  mode,
  next,
  problem,
  email,
  heading,
  lede,
}: {
  mode: "signin" | "signup";
  next: string;
  /** The `error` query param, if the writer arrived carrying one. */
  problem?: string;
  /** Typed into the landing page's hero, carried here rather than asked twice. */
  email?: string;
  /**
   * Replace the standing heading and lede when the writer was sent here *for*
   * something. "Welcome back — enter your details to reach your shelf" is true
   * of somebody who came to sign in and wrong twice over for somebody arriving
   * from an invitation: the shelf is not what they are trying to reach, and an
   * invitee may never have had an account to come back to.
   */
  heading?: string;
  lede?: string;
}) {
  const copy = COPY[mode];

  /*
   * **The switch to the other mode keeps `next` and `email`.** It was a bare
   * `/signup`, which is a dead end for the one visitor most likely to press it:
   * somebody invited to a book who has no account yet loses the invitation *and*
   * the address it has to be accepted with, creates an account, and lands on an
   * empty shelf with nothing to say what became of the link they followed.
   */
  const switchQuery = new URLSearchParams();
  if (next !== "/") switchQuery.set("next", next);
  if (email) switchQuery.set("email", email);
  const switchHref = switchQuery.toString()
    ? `${copy.switchHref}?${switchQuery}`
    : copy.switchHref;
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    mode === "signin" ? signIn : signUp,
    {},
  );
  const problemText = useAuthProblem(problem, PROBLEM);

  return (
    <AuthShell
      headerAction={
        <p className="font-sans text-sm text-muted">
          {copy.switchLede}{" "}
          <AuthLink href={switchHref}>{copy.switchLabel}</AuthLink>
        </p>
      }
    >
      <AuthHeading title={heading ?? copy.heading} lede={lede ?? copy.lede} />

      {problemText && (
        <div className="mt-6">
          <FormNotice>{problemText}</FormNotice>
        </div>
      )}

      <div className="mt-7 flex flex-col gap-4">
        <GoogleButton
          action={signInWithGoogle}
          next={next}
          label={
            mode === "signin" ? "Continue with Google" : "Sign up with Google"
          }
        />
        <OrDivider>
          {mode === "signin" ? "Or sign in with" : "Or sign up with"}
        </OrDivider>
      </div>

      <form action={formAction} className="mt-4 flex flex-col gap-4">
        <input type="hidden" name="next" value={next} />

        <label className="flex flex-col gap-1.5">
          <FieldLabel>Email</FieldLabel>
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            // Uncontrolled with a default: the writer must be able to correct
            // whatever the hero carried over.
            defaultValue={email}
            autoFocus={!email}
            placeholder="you@example.com"
            className={FIELD}
          />
        </label>

        <PasswordField
          name="password"
          label="Password"
          autoComplete={copy.autoComplete}
          minLength={mode === "signup" ? 8 : undefined}
          placeholder={
            mode === "signup" ? "At least 8 characters" : "Your password"
          }
        />

        {state.error && <FormError>{state.error}</FormError>}
        {state.notice && <FormNotice>{state.notice}</FormNotice>}

        <button type="submit" disabled={isPending} className={SUBMIT}>
          {isPending ? copy.working : copy.submit}
          {!isPending && (
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M4 10h11M11 6l4 4-4 4" />
            </svg>
          )}
        </button>
      </form>

      {/* Under the button, where the reference puts it — a writer looks for it
          after the password has failed, not while typing it. */}
      {mode === "signin" && (
        <p className="mt-5 text-center font-sans text-sm text-muted">
          <AuthLink href="/forgot-password">Forgot password?</AuthLink>
        </p>
      )}
    </AuthShell>
  );
}

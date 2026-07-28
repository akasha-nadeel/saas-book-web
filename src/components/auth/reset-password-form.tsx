"use client";

import { useActionState } from "react";
import { type AuthState, updatePassword } from "@/app/auth/actions";
import {
  AuthShell,
  FIELD,
  FormError,
  SUBMIT,
} from "@/components/auth/auth-shell";

/**
 * Set a new password.
 *
 * No token here on purpose: the recovery link already exchanged itself for a
 * session over at /auth/confirm, so this screen only needs to know that
 * *somebody* is signed in — and the proxy guarantees that much before the page
 * renders. Which also makes it a plain change-password screen for anyone
 * already in.
 */
export function ResetPasswordForm({ email }: { email: string | null }) {
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    updatePassword,
    {},
  );

  return (
    <AuthShell>
      <h1 className="font-serif text-2xl text-fg">Set a new password</h1>
      <p className="mt-1.5 font-sans text-sm break-words text-muted">
        {email ? (
          <>
            For <span className="font-medium text-fg">{email}</span>.
          </>
        ) : (
          "Choose something you’ll keep."
        )}
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        {/* Off-screen, but present: password managers need the account this
            new password belongs to, or they save it against nothing. */}
        {email && (
          <input
            type="email"
            name="username"
            value={email}
            autoComplete="username"
            readOnly
            hidden
          />
        )}

        <label className="flex flex-col gap-1.5">
          <span className="font-sans text-sm font-medium text-fg">
            New password
          </span>
          <input
            type="password"
            name="password"
            required
            minLength={8}
            autoComplete="new-password"
            autoFocus
            placeholder="At least 8 characters"
            className={FIELD}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="font-sans text-sm font-medium text-fg">
            Again, to be sure
          </span>
          <input
            type="password"
            name="confirm"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Repeat it"
            className={FIELD}
          />
        </label>

        {state.error && <FormError>{state.error}</FormError>}

        <button type="submit" disabled={isPending} className={SUBMIT}>
          {isPending ? "Saving…" : "Save and continue"}
        </button>
      </form>
    </AuthShell>
  );
}

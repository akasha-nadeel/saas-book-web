"use client";

import { useActionState } from "react";
import { type AuthState, updatePassword } from "@/app/auth/actions";
import {
  AuthHeading,
  AuthShell,
  FormError,
  PasswordField,
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
      <AuthHeading
        title="Set a new password"
        lede={email ? `For ${email}.` : "Choose something you’ll keep."}
      />

      <form action={formAction} className="mt-7 flex flex-col gap-4">
        {/* Hidden, but present: password managers need the account this new
            password belongs to, or they save it against nothing. */}
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

        <PasswordField
          name="password"
          label="New password"
          autoComplete="new-password"
          minLength={8}
          autoFocus
          placeholder="At least 8 characters"
        />

        <PasswordField
          name="confirm"
          label="Again, to be sure"
          autoComplete="new-password"
          minLength={8}
          placeholder="Repeat it"
        />

        {state.error && <FormError>{state.error}</FormError>}

        <button type="submit" disabled={isPending} className={SUBMIT}>
          {isPending ? "Saving…" : "Save and continue"}
        </button>
      </form>
    </AuthShell>
  );
}

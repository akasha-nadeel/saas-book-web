"use client";

import { useActionState } from "react";
import { type AuthState, requestPasswordReset } from "@/app/auth/actions";
import {
  AuthHeading,
  AuthLink,
  AuthShell,
  FIELD,
  FieldLabel,
  FormError,
  FormNotice,
  SUBMIT,
} from "@/components/auth/auth-shell";

/** Ask for the address, mail a recovery link, say nothing about who exists. */
export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    {},
  );

  return (
    <AuthShell
      headerAction={
        <p className="font-sans text-sm text-muted">
          Remembered it? <AuthLink href="/signin">Sign in</AuthLink>
        </p>
      }
    >
      <AuthHeading
        title="Reset your password"
        lede="We’ll email you a link that signs you in and lets you set a new one."
      />

      <form action={formAction} className="mt-7 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <FieldLabel>Email</FieldLabel>
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

        {state.error && <FormError>{state.error}</FormError>}
        {state.notice && <FormNotice>{state.notice}</FormNotice>}

        <button type="submit" disabled={isPending} className={SUBMIT}>
          {isPending ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-8 text-center font-sans text-xs leading-relaxed text-muted">
        The link works once, and only in this browser.
      </p>
    </AuthShell>
  );
}

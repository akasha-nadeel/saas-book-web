"use client";

import Link from "next/link";
import { useActionState } from "react";
import { type AuthState, requestPasswordReset } from "@/app/auth/actions";
import {
  AuthShell,
  FIELD,
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
    <AuthShell>
      <h1 className="font-serif text-2xl text-fg">Reset your password</h1>
      <p className="mt-1.5 font-sans text-sm leading-relaxed text-muted">
        We’ll email you a link that signs you in and lets you set a new one.
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
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

        {state.error && <FormError>{state.error}</FormError>}
        {state.notice && <FormNotice>{state.notice}</FormNotice>}

        <button type="submit" disabled={isPending} className={SUBMIT}>
          {isPending ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-5 font-sans text-sm text-muted">
        Remembered it?{" "}
        <Link
          href="/signin"
          className="font-medium text-accent underline-offset-2 outline-none
                     hover:underline focus-visible:ring-2
                     focus-visible:ring-accent/50"
        >
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The frame every auth screen sits in — wordmark, one card, one footnote.
 *
 * Four screens now share it (sign in, sign up, forgot, reset). Keeping the
 * chrome here is what stops them drifting: change the card once and all four
 * follow, rather than three of them quietly falling behind.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    // h-dvh, not min-h-dvh: <body> is overflow-hidden for the editor shell, so
    // a standalone page has to own its scrolling or its foot is unreachable.
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
          {children}
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

/** One look for every text field on these screens. */
export const FIELD =
  "rounded-lg border border-line bg-surface px-3.5 py-2.5 font-sans text-sm " +
  "text-fg placeholder:text-muted focus-visible:border-accent " +
  "focus-visible:outline-none";

/** One look for the primary action on every one of them. */
export const SUBMIT =
  "mt-1 rounded-lg bg-accent py-2.5 font-sans text-sm font-semibold text-white " +
  "outline-none transition-colors hover:bg-accent-strong focus-visible:ring-2 " +
  "focus-visible:ring-accent/60 disabled:opacity-60";

/** The red line under a form that refused. */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="font-sans text-sm text-danger">
      {children}
    </p>
  );
}

/** The quiet grey block for something pending on the writer's side. */
export function FormNotice({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="rounded-lg bg-raised px-3.5 py-3 font-sans text-sm
                 leading-relaxed text-fg"
    >
      {children}
    </p>
  );
}

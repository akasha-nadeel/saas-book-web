"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";

/**
 * What the account chip in the shelf header opens.
 *
 * Two states, because the app genuinely has two. With a Supabase project
 * configured this is a real account with a real sign-out. Without one there are
 * no accounts at all, and it says that plainly rather than showing a sign-out
 * that could not sign anything out. This replaced the old "plans aren't
 * available" note, which stopped being true the moment there was an account.
 */
export function AccountDialog({
  email,
  onClose,
}: {
  /** The signed-in writer, or null when accounts are not configured. */
  email: string | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
      className="m-auto w-[26rem] max-w-[calc(100vw-2rem)] rounded-lg bg-panel
                 p-0 text-fg backdrop:bg-black/70"
    >
      <div className="p-6">
        {email ? (
          <>
            <h2 className="font-serif text-xl">Your account</h2>
            <p className="mt-3 font-sans text-sm break-words text-muted">
              Signed in as{" "}
              <span className="font-medium text-fg">{email}</span>.
            </p>
            <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
              Your manuscripts are stored in this browser and synced to your
              account. Signing out leaves them exactly where they are.
            </p>
            <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
              You are on the free plan.{" "}
              <Link
                href="/upgrade"
                onClick={onClose}
                className="font-medium text-accent underline underline-offset-2
                           outline-none hover:text-accent-strong
                           focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                See what Pro adds
              </Link>
              .
            </p>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-4 py-2 font-sans text-sm font-medium
                           text-muted outline-none transition-colors
                           hover:bg-raised hover:text-fg focus-visible:ring-2
                           focus-visible:ring-accent/50"
              >
                Back to writing
              </button>
              {/* A form, not an onClick: sign-out clears an httpOnly cookie,
                  which only the server can do. */}
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-md bg-accent px-4 py-2 font-sans text-sm
                             font-semibold text-white outline-none
                             transition-colors hover:bg-accent-strong
                             focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  Sign out
                </button>
              </form>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-serif text-xl">There are no accounts here</h2>
            <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
              This copy of OpenChapter has no Supabase project configured, so it
              runs the way it always has: entirely in this browser, with nothing
              to sign in to and no account to bill.
            </p>
            <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
              Set <code className="font-mono text-xs">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
              and{" "}
              <code className="font-mono text-xs">
                NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
              </code>{" "}
              in <code className="font-mono text-xs">.env.local</code> to turn
              sign-in on.
            </p>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md bg-accent px-4 py-2 font-sans text-sm
                           font-semibold text-white outline-none
                           transition-colors hover:bg-accent-strong
                           focus-visible:ring-2 focus-visible:ring-accent/60"
              >
                Back to writing
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}

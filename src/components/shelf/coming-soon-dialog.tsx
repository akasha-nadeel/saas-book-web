"use client";

import { useEffect, useRef } from "react";

/**
 * "Not yet" — said once, in one place, and said as a teaser rather than a
 * notice.
 *
 * Two of the header's buttons are held back at the moment while their features
 * are reconsidered. The house rule is that a control either works or plainly
 * says it does not, and this is the second of those: the button stays where a
 * writer has learnt to find it, and pressing it explains itself.
 *
 * It commits to a dark ground in both themes. Every one of these is a poster —
 * a thing under a sheet with a light on it — and a poster does not follow the
 * room it is hung in. It is also the one screen in the app that is not a place
 * to work, so it can afford to be the loudest.
 *
 * Neither feature was removed to make this. `templates-dialog.tsx` and
 * `sounds-dialog.tsx` are both complete and still in the repo — see the note in
 * TODO.md. Switching either back on is a matter of pointing its button at its
 * own dialog again.
 */
export function ComingSoonDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  /** What it will do, in the writer's terms rather than the roadmap's. */
  children: React.ReactNode;
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
      className="m-auto w-[34rem] max-w-[calc(100vw-2rem)] overflow-hidden
                 rounded-2xl bg-transparent p-0 backdrop:bg-black/80"
    >
      <div
        className="relative overflow-hidden px-8 py-12 text-center sm:px-12 sm:py-14"
        // Inline rather than an arbitrary Tailwind value: a gradient this long
        // is exactly the sort of utility v4 drops without saying so, and a
        // dropped background here would leave white text on white.
        //
        // Two layers — a cone of light from above and behind the words, and the
        // deep ground it falls on.
        style={{
          backgroundImage:
            "radial-gradient(120% 80% at 50% -10%, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.06) 38%, rgba(0,0,0,0) 72%), linear-gradient(180deg, #121212 0%, #000000 100%)",
        }}
      >
        {/* The beam itself: a soft wedge coming down from the top edge, which is
            what makes it read as something lit rather than something dark. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[22rem]
                     -translate-x-1/2 blur-3xl"
          style={{
            backgroundImage:
              "radial-gradient(50% 50% at 50% 50%, rgba(147,197,253,0.5) 0%, rgba(147,197,253,0) 100%)",
          }}
        />

        <div className="relative">
          <p className="font-sans text-xs font-semibold tracking-[0.28em] text-muted uppercase">
            Something new
          </p>

          {/* The line the whole dialog exists to say. Set in the display face at
              poster size, on two lines because "available soon" broken after
              the first word is the shape every one of these takes — and because
              stacked, it fills the width instead of shrinking to fit it. */}
          <h2 className="oc-soon mt-4 font-display text-[2.75rem] leading-[0.92] font-extrabold tracking-tight uppercase sm:text-[3.5rem]">
            Available
            <br />
            Soon
          </h2>

          {/* A hairline under the headline, fading out at both ends — the join
              between the poster and the sentence explaining it. */}
          <span
            aria-hidden="true"
            className="mx-auto mt-7 block h-px w-40"
            style={{
              backgroundImage:
                "linear-gradient(90deg, rgba(147,197,253,0) 0%, rgba(147,197,253,0.55) 50%, rgba(147,197,253,0) 100%)",
            }}
          />

          <h3 className="mt-7 font-serif text-3xl text-white">{title}</h3>

          <div
            className="mx-auto mt-3 max-w-md font-sans text-base leading-relaxed
                       font-medium text-fg/90"
          >
            {children}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-9 cursor-pointer rounded-full bg-white px-7 py-3
                       font-sans text-sm font-semibold text-accent-ink
                       outline-none transition-opacity hover:opacity-90
                       focus-visible:ring-2 focus-visible:ring-fg/60
                       focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            Back to writing
          </button>
        </div>
      </div>
    </dialog>
  );
}

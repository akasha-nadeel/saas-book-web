"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import {
  displayName,
  firstNameOf,
  initialOf,
  type Account,
} from "@/lib/account";
import { usePlan } from "@/lib/use-plan";

/**
 * The account chip in the shelf header, and the menu it opens.
 *
 * A menu rather than the modal dialog this replaced. The chip has always drawn
 * a caret, which promises a menu; a dialog that dims the whole shelf to tell
 * you your own email address is a heavier thing than the promise, and it put
 * "sign out" behind the same weight of interruption as a destructive
 * confirmation. A menu drops from the control that opened it, and reading it
 * costs nothing.
 *
 * The trigger lives in here rather than in the header, because the menu is
 * positioned from the trigger's own rect and the two cannot be separated
 * without passing a ref around.
 *
 * Portalled and fixed-positioned, for the same reason `RowMenu` in the sidebar
 * is: the shelf scrolls, and an ancestor with overflow clips an absolutely
 * positioned child. The two solve the same problem and do not share code — the
 * shapes differ too much (that one is a ⋯ button over flat items, this one
 * carries a header and a form) — so if a third popover ever appears, that is
 * the moment to lift the anchoring out rather than write it a third time.
 */

const MENU_WIDTH = 288;
const EDGE_PADDING = 8;

export function AccountMenu({ account }: { account: Account | null }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Asked once, here, and handed down — the chip names the plan and so does the
  // menu, and two `usePlan()` calls would be two requests answering one
  // question, able to disagree for as long as one of them is in flight.
  const plan = usePlan();

  const name = displayName(account);

  // Null, not "Free plan", until we know. A paying writer seeing "Free plan"
  // flash under their own name on every load is worse than a line that arrives
  // a moment late — and with no gateway configured there are no plans to name.
  const planLabel =
    plan.loading || !plan.billing ? null : plan.pro ? "Pro plan" : "Free plan";

  const close = (returnFocus = true) => {
    setOpen(false);
    // Otherwise focus falls to the body and a keyboard reader loses the header.
    if (returnFocus) triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      // Portalled, so the menu is not inside the trigger's subtree — both have
      // to be checked or clicking an item would dismiss before it fires.
      if (
        !triggerRef.current?.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        close(false);
      }
    };
    // A fixed position taken from a rect goes stale the moment anything moves.
    const onMove = () => close(false);

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("resize", onMove);
    document.addEventListener("scroll", onMove, true);

    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("resize", onMove);
      document.removeEventListener("scroll", onMove, true);
    };
  }, [open]);

  // Measured, not guessed: clamping the top edge alone slides the menu down
  // while its own height carries on past the bottom of the screen.
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    if (open && menuRef.current) setHeight(menuRef.current.offsetHeight);
    else setHeight(0);
  }, [open]);

  const roomBelow = rect ? window.innerHeight - rect.bottom - EDGE_PADDING : 0;
  const roomAbove = rect ? rect.top - EDGE_PADDING : 0;
  const flip = height > roomBelow && roomAbove > roomBelow;

  const vertical =
    rect && flip
      ? { bottom: window.innerHeight - rect.top + 6 }
      : { top: rect ? rect.bottom + 6 : 0 };

  const left = rect
    ? Math.max(
        EDGE_PADDING,
        Math.min(
          rect.right - MENU_WIDTH,
          window.innerWidth - MENU_WIDTH - EDGE_PADDING,
        ),
      )
    : 0;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          if (open) return close(false);
          setRect(triggerRef.current?.getBoundingClientRect() ?? null);
          setOpen(true);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={
          account?.email ? `Your account — ${account.email}` : "Your account"
        }
        // No border and no resting fill: the avatar is the visible object here,
        // and the name and plan sit beside it as label rather than as a second
        // bordered control competing with the search field. The ground still
        // fills on hover and while open, so it is not a control that gives no
        // sign of being one — it just does not announce itself at rest.
        className={`flex shrink-0 items-center gap-2.5 rounded-full py-1 pr-1
                    pl-3 text-left outline-none transition-colors
                    hover:bg-raised focus-visible:ring-2
                    focus-visible:ring-accent/50 ${open ? "bg-raised" : ""}`}
      >
        {/* Name over plan, then the avatar last — so the one round, solid thing
            in the bar is what finishes it.

            No caret. It was doing the work the pill now does, and doing it
            worse: an arrow is a small grey glyph that says "this opens", where
            a bordered pill with a face on it says the same thing at a glance
            and without a third element competing with the two lines of text.
            `aria-haspopup` still tells a screen reader what it is, which the
            arrow never did.

            Only the first name: the chip truncates at about nine characters,
            and "Akasha Nadeel gun…" is longer and less readable than "Akasha".
            The full name is in the menu, where there is room for it.

            The two lines are set tight and the block is centred on the avatar
            rather than baseline-aligned, so the pair reads as one object beside
            the face. Nothing changes height when the plan line arrives — the
            36px avatar is taller than both lines together, so it is the avatar
            that sets the pill's height, not the text. */}
        <span className="hidden flex-col items-start leading-tight sm:flex">
          <span className="max-w-32 truncate font-sans text-sm font-semibold text-fg">
            {firstNameOf(name)}
          </span>
          {planLabel && (
            <span className="font-sans text-[0.6875rem] font-medium text-muted">
              {planLabel}
            </span>
          )}
        </span>
        <Avatar url={account?.avatarUrl ?? null} name={name} size={32} />
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Your account"
            style={{ position: "fixed", left, width: MENU_WIDTH, ...vertical }}
            className="z-50 overflow-hidden rounded-xl border border-line
                       bg-panel shadow-xl"
          >
            <MenuBody account={account} plan={plan} onClose={close} />
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * What is actually in the menu.
 *
 * Split out so the anchoring above stays about anchoring. Two shapes, because
 * the app genuinely has two: a real account, or no accounts configured at all —
 * the same fork the dialog carried, and for the same reason. A sign-out that
 * could not sign anything out would be worse than a sentence saying why.
 */
function MenuBody({
  account,
  plan,
  onClose,
}: {
  account: Account | null;
  /** Asked once by the menu above, so the chip and this cannot disagree. */
  plan: ReturnType<typeof usePlan>;
  onClose: (returnFocus?: boolean) => void;
}) {
  const { refresh } = plan;

  // One press from irreversible, so it is two: the item turns into its own
  // confirmation in place rather than opening a dialog over the menu.
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setWorking(true);
    setError(null);

    try {
      const response = await fetch("/api/billing/cancel", { method: "POST" });
      const data = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(data?.error ?? "Could not cancel. Try again in a moment.");
        return;
      }

      setConfirming(false);
      refresh();
    } catch {
      setError("Could not reach the server. Try again in a moment.");
    } finally {
      setWorking(false);
    }
  }

  if (!account?.email) {
    return (
      <div className="p-4">
        <p className="font-sans text-sm font-medium text-fg">
          There are no accounts here
        </p>
        <p className="mt-2 font-sans text-xs leading-relaxed text-muted">
          This copy of OpenChapter has no Supabase project configured, so it runs
          entirely in this browser — nothing to sign in to, and no account to
          bill.
        </p>
      </div>
    );
  }

  const until = plan.currentPeriodEnd
    ? new Date(plan.currentPeriodEnd).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const name = displayName(account);

  return (
    <>
      {/* Who you are: the face, the whole name, the address. The address is
          quiet but present — it is what a writer with two accounts checks, and
          what they would quote to support. */}
      <div className="flex items-center gap-3 p-4">
        <Avatar url={account.avatarUrl} name={name} size={40} />
        <div className="min-w-0">
          <p className="truncate font-sans text-sm font-semibold text-fg">
            {name}
          </p>
          <p className="truncate font-sans text-xs text-muted">
            {account.email}
          </p>
        </div>
      </div>

      <Rule />

      <div className="px-4 py-3">
        {plan.loading ? (
          <p className="font-sans text-xs text-muted">Checking your plan…</p>
        ) : !plan.billing ? (
          <p className="font-sans text-xs leading-relaxed text-muted">
            No payment gateway is configured here, so there are no plans and
            nothing is held back.
          </p>
        ) : plan.pro ? (
          <>
            <div className="flex items-center gap-2">
              <span
                className="rounded-full bg-accent/15 px-2 py-0.5 font-sans
                           text-[0.6875rem] font-semibold text-accent"
              >
                Pro
              </span>
              <span className="font-sans text-xs text-muted">
                {plan.period === "annual" ? "Annual" : "Monthly"}
              </span>
            </div>
            <p className="mt-1.5 font-sans text-xs leading-relaxed text-muted">
              {plan.status === "cancelled" ? (
                <>Cancelled{until ? <> — runs until {until}</> : null}.</>
              ) : plan.status === "past_due" ? (
                // Not "expired". PayHere retries a failed renewal on its own
                // schedule, and a plan about to charge again is not a dead one.
                <>The last renewal didn&rsquo;t go through — PayHere will retry.</>
              ) : until ? (
                <>Renews {until}.</>
              ) : null}
            </p>
          </>
        ) : (
          <>
            <p className="font-sans text-xs text-muted">You are on the free plan.</p>
            <Link
              href="/upgrade"
              onClick={() => onClose(false)}
              className="mt-1.5 inline-block font-sans text-xs font-semibold
                         text-accent underline underline-offset-2 outline-none
                         hover:text-accent-strong focus-visible:ring-2
                         focus-visible:ring-accent/50"
            >
              See what Pro adds
            </Link>
          </>
        )}
      </div>

      <Rule />

      <div className="p-1.5">
        <MenuLink href="/upgrade" onSelect={() => onClose(false)} icon={icons.plans}>
          Plans &amp; pricing
        </MenuLink>

        {plan.canCancel &&
          (confirming ? (
            <div className="px-2.5 py-2">
              <p className="font-sans text-xs leading-relaxed text-muted">
                You keep Pro until {until ?? "the end of the paid period"}.
                Nothing is deleted.
              </p>
              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={cancel}
                  disabled={working}
                  className="rounded-md border border-line px-2.5 py-1 font-sans
                             text-xs font-medium text-fg outline-none
                             transition-colors hover:bg-raised
                             focus-visible:ring-2 focus-visible:ring-accent/50
                             disabled:opacity-60"
                >
                  {working ? "Cancelling…" : "Yes, cancel"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="font-sans text-xs text-muted underline
                             underline-offset-2 outline-none hover:text-fg
                             focus-visible:ring-2 focus-visible:ring-accent/50"
                >
                  Keep it
                </button>
              </div>
              {error && (
                <p role="alert" className="mt-2 font-sans text-xs text-muted">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <MenuButton onSelect={() => setConfirming(true)} icon={icons.cancel}>
              Cancel subscription
            </MenuButton>
          ))}

        <Rule className="my-1.5" />

        {/* A form, not an onClick: sign-out clears an httpOnly cookie, which
            only the server can do. */}
        <form action={signOut}>
          <button
            type="submit"
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2
                       text-left font-sans text-sm text-fg outline-none
                       transition-colors hover:bg-raised focus-visible:ring-2
                       focus-visible:ring-accent/60"
          >
            <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">
              {icons.signOut}
            </span>
            Sign out
          </button>
        </form>
      </div>
    </>
  );
}

function Rule({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`h-px bg-line ${className}`} />;
}

const ITEM = `flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left
  font-sans text-sm text-fg outline-none transition-colors hover:bg-raised
  focus-visible:ring-2 focus-visible:ring-accent/60`;

function MenuLink({
  href,
  onSelect,
  icon,
  children,
}: {
  href: string;
  onSelect: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} role="menuitem" onClick={onSelect} className={ITEM}>
      <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      {children}
    </Link>
  );
}

function MenuButton({
  onSelect,
  icon,
  children,
}: {
  onSelect: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button type="button" role="menuitem" onClick={onSelect} className={ITEM}>
      <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      {children}
    </button>
  );
}

/**
 * The round mark: the writer's photo, or their initial.
 *
 * The fallback is not only for accounts that never had a photo. A provider's
 * image URL is somebody else's server, and Google's expire and rate-limit — so
 * one that fails to load falls back to the lettered circle rather than leaving
 * a broken-image glyph in the header. Both states are the same circle at the
 * same size, so nothing reflows when one becomes the other.
 *
 * A plain <img>, like the covers: one small remote image, where next/image
 * would want the provider's host declared in next.config for no gain a writer
 * could see.
 */
export function Avatar({
  url,
  name,
  size,
}: {
  url: string | null;
  name: string;
  size: number;
}) {
  const [failed, setFailed] = useState(false);

  if (url && !failed) {
    return (
      // Keyed on the url so a changed photo gets a fresh attempt rather than
      // inheriting the last one's failure.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={url}
        src={url}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        onError={() => setFailed(true)}
        style={{ width: size, height: size }}
        // A hairline ring: a photograph can be any colour, including one close
        // to the header's own, and without an edge it floats. The solid
        // fallback below needs none — it defines its own edge.
        className="shrink-0 rounded-full object-cover ring-1 ring-line"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full
                 bg-accent font-sans text-sm font-semibold text-white"
    >
      {initialOf(name)}
    </span>
  );
}

/** Inline, matching the rails and the row menu — no icon dependency. */
const icons = {
  plans: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path
        d="M10.6 2.7 17 9.1a1.4 1.4 0 0 1 0 2l-5.9 5.9a1.4 1.4 0 0 1-2 0L2.7 10.6V3.4a.7.7 0 0 1 .7-.7z"
        strokeLinejoin="round"
      />
      <circle cx="6.6" cy="6.6" r="1.1" />
    </svg>
  ),
  cancel: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="10" cy="10" r="7.2" />
      <path d="m5.4 5.4 9.2 9.2" strokeLinecap="round" />
    </svg>
  ),
  signOut: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path
        d="M8 17H4.6A1.6 1.6 0 0 1 3 15.4V4.6A1.6 1.6 0 0 1 4.6 3H8"
        strokeLinecap="round"
      />
      <path d="M12.6 13.4 16 10l-3.4-3.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 10H7.4" strokeLinecap="round" />
    </svg>
  ),
};

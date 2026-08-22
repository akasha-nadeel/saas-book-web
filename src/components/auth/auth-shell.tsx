"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

/**
 * The failure Supabase reported in the URL fragment, if there was one.
 *
 * Supabase puts auth failures after the `#`, which browsers never send to the
 * server — so a Server Component cannot see them, and the page would otherwise
 * fall back to a generic "that link expired". Worth reading properly: a
 * rejected OAuth client secret and a stale email link arrive at the same URL
 * and are nothing alike, and reporting the first as the second sends whoever
 * is debugging it somewhere entirely wrong.
 *
 * Read through useSyncExternalStore, the same shape useHydrated uses, so the
 * server renders nothing and the client fills it in after hydration. The
 * capture is cached at module scope for two reasons: the snapshot must be
 * referentially stable or the store loops, and the effect below wipes the hash
 * afterwards — so a second read of the address bar would come back empty.
 */
let captured: string | null | undefined;

function readFragmentError(): string | null {
  if (captured === undefined) {
    const hash = window.location.hash;
    // URLSearchParams decodes the "+" separators Supabase uses for spaces.
    captured = hash.includes("error")
      ? new URLSearchParams(hash.slice(1)).get("error_description")
      : null;
  }
  return captured;
}

const NEVER_CHANGES = () => () => {};
const NOTHING_ON_SERVER = () => null;

function useFragmentError(): string | null {
  const message = useSyncExternalStore(
    NEVER_CHANGES,
    readFragmentError,
    NOTHING_ON_SERVER,
  );

  // Tidy the address bar once it has been read, so a reload does not re-report
  // a failure already seen. Safe to run after the capture: the value is held at
  // module scope, not re-read from the URL.
  useEffect(() => {
    if (message && window.location.hash) {
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
    }
  }, [message]);

  return message;
}

/**
 * The frame every auth screen sits in: a navy column saying what the app is,
 * and the form beside it.
 *
 * Four screens share it (sign in, sign up, forgot, reset), which is what stops
 * them drifting — change the frame once and all four follow.
 *
 * The navy column carries no controls, so below lg it simply goes: on a phone
 * the form wants the whole width, and a pitch above it would only push the
 * fields off the fold.
 */
export function AuthShell({
  children,
  /** The top-right link — the other screen a writer might have wanted. */
  headerAction,
}: {
  children: ReactNode;
  headerAction?: ReactNode;
}) {
  return (
    // The dark ground runs edge to edge; the form sits on it as an inset card.
    // h-dvh and inner scrolling because <body> is overflow-hidden for the editor
    // shell, so min-h-dvh would put the foot of this page out of reach.
    <div className="auth-ground flex h-[var(--oc-layout-height)] overflow-hidden">
      {/* Copy only, no controls — so below lg it simply goes: on a phone the
          form wants the width, and a pitch above it pushes the fields off. */}
      <aside
        className="auth-aside hidden w-[40%] max-w-2xl shrink-0 flex-col
                   items-center justify-center px-10 py-12 text-center lg:flex"
      >
        <Mark />

        <h2 className="mt-8 font-display text-3xl leading-tight font-semibold text-fg">
          A calm place to
          <br />
          write your novel.
        </h2>
        <p className="mt-3 max-w-xs font-sans text-sm leading-relaxed text-muted">
          A shelf of your books, an editor that gets out of the way, and export
          to the formats an agent actually asks for.
        </p>
      </aside>

      {/* The card. Inset all round so the ground shows as a border, and rounded
          on every corner — including the two that meet the navy column. */}
      <div
        className="flex min-w-0 flex-1 flex-col overflow-hidden border border-line
                   bg-panel sm:m-3 sm:rounded-2xl lg:my-4 lg:mr-4 lg:ml-0"
      >
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 px-5 pt-[max(1rem,var(--oc-safe-top))] pb-4 sm:px-10 sm:py-6">
          <Wordmark />
          {headerAction}
        </header>

        {/* my-auto rather than items-center: centres the form when there is
            room, and lets it scroll from the top when there is not. */}
        <main className="scroll-slim flex min-h-0 flex-1 flex-col overflow-y-auto px-5 sm:px-10">
          <div className="mx-auto my-auto w-full max-w-sm py-6">{children}</div>
        </main>

        <footer
          className="flex shrink-0 flex-wrap items-center justify-between gap-x-6
                     gap-y-1 px-5 pt-4 pb-[max(1rem,var(--oc-safe-bottom))] font-sans text-xs text-muted sm:px-10 sm:py-6"
        >
          <span>© {new Date().getFullYear()} OpenChapter</span>
          <span>
            Your books stay in this browser — signing in doesn’t move them yet.
          </span>
        </footer>
      </div>
    </div>
  );
}

/**
 * The brand mark.
 *
 * **A real image now, not a mask, and the theme is the reason.** It used to be
 * `/logo.png` shown through `maskImage` over `bg-current`, so the shape took
 * the panel's own `text-fg` — near-black by day, near-white at night, right in
 * both without a second file. That was the correct trick while the mark was a
 * neutral glyph. It cannot survive the mark being *blue*: masking to
 * `--color-accent` looks right in daylight and turns the logo white after
 * sunset, because the accent is white on black by design. A brand mark that
 * changes colour with the theme is not a brand mark.
 *
 * So this is `/logo-mark.png` — the artwork itself, blue, on transparency —
 * drawn at its own colour in both themes. `/logo.png` stays for the mask sites
 * that still want a silhouette.
 *
 * `object-contain` in a square box because the bubble is taller than it is
 * wide (its tail hangs below the body) and the file is padded square, so the
 * box is the layout and the artwork sits inside it.
 */
function Mark() {
  return (
    <Image
      src="/logo-mark.png"
      alt=""
      aria-hidden="true"
      width={512}
      height={512}
      priority
      className="h-24 w-24 object-contain"
    />
  );
}

function Wordmark() {
  return (
    <Link
      href="/"
      className="font-display text-xl font-semibold tracking-tight text-fg
                 outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      Open<span className="text-muted">Chapter</span>
    </Link>
  );
}

/** The heading and lede above a form, centred the way the reference sets them. */
export function AuthHeading({ title, lede }: { title: string; lede: string }) {
  return (
    <div className="text-center">
      <h1 className="font-serif text-2xl text-fg">{title}</h1>
      <p className="mt-1.5 font-sans text-sm leading-relaxed text-muted">
        {lede}
      </p>
    </div>
  );
}

/** One look for every text field on these screens. */
export const FIELD =
  "w-full rounded-lg border border-line bg-panel px-3.5 py-3 font-sans " +
  "text-sm text-fg placeholder:text-muted transition-colors " +
  "hover:border-muted/40 focus-visible:border-accent focus-visible:outline-none";

/** One look for the primary action on every one of them. */
export const SUBMIT =
  "mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-3 " +
  "font-sans text-sm font-semibold text-accent-ink outline-none transition-colors " +
  "hover:bg-accent-strong focus-visible:ring-2 focus-visible:ring-accent/60 " +
  "disabled:opacity-60";

/**
 * "Continue with Google".
 *
 * Its own form because it posts to its own Server Action — the email form
 * beside it carries different fields and a different destination, and nesting
 * forms is not a thing HTML allows.
 */
export function GoogleButton({
  action,
  next,
  label,
  /** Overrides the button's own classes — the landing hero sets it inline. */
  className,
}: {
  action: (formData: FormData) => void;
  next: string;
  label: string;
  className?: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        className={
          className ??
          `flex w-full items-center justify-center gap-2.5 rounded-lg
           border border-line bg-panel py-3 font-sans text-sm font-medium
           text-fg outline-none transition-colors hover:bg-raised
           focus-visible:ring-2 focus-visible:ring-accent/50`
        }
      >
        <GoogleMark />
        {label}
      </button>
    </form>
  );
}

/** Google's mark, in its own colours — the one part of this page not themed. */
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="h-[18px] w-[18px]">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.83.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

/** The hairline that separates the handoff above from the form below. */
export function OrDivider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-line" />
      <span className="font-sans text-xs text-muted">{children}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** The field label, and anything that sits on its line. */
export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="font-sans text-sm font-medium text-fg">{children}</span>
  );
}

/**
 * A password box with a reveal toggle.
 *
 * Worth the state it costs: these forms reject silently-mistyped passwords, and
 * on a screen with two password boxes it is the difference between finding a
 * typo and guessing at one.
 */
export function PasswordField({
  name,
  label,
  autoComplete,
  placeholder,
  minLength,
  autoFocus,
  trailing,
}: {
  name: string;
  label: string;
  autoComplete: string;
  placeholder?: string;
  minLength?: number;
  autoFocus?: boolean;
  /** Something to sit at the far end of the label line. */
  trailing?: ReactNode;
}) {
  const [shown, setShown] = useState(false);
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="flex items-baseline justify-between gap-3">
        <FieldLabel>{label}</FieldLabel>
        {trailing}
      </label>

      <div className="relative">
        <input
          id={id}
          type={shown ? "text" : "password"}
          name={name}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          placeholder={placeholder}
          className={`${FIELD} pr-11`}
        />
        <button
          type="button"
          onClick={() => setShown((on) => !on)}
          aria-label={shown ? "Hide password" : "Show password"}
          className="absolute top-1/2 right-1 -translate-y-1/2 rounded-md p-2
                     text-muted outline-none transition-colors hover:text-fg
                     focus-visible:ring-2 focus-visible:ring-accent/50"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
          >
            <path d="M1.7 10S4.6 4.8 10 4.8 18.3 10 18.3 10 15.4 15.2 10 15.2 1.7 10 1.7 10Z" />
            <circle cx="10" cy="10" r="2.3" />
            {shown && <path d="m3.5 3.5 13 13" />}
          </svg>
        </button>
      </div>
    </div>
  );
}

/** The red line under a form that refused. */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="font-sans text-sm text-danger">
      {children}
    </p>
  );
}

/**
 * What to tell the writer went wrong, given the `?error=` the server saw and
 * whatever the provider left in the fragment.
 *
 * The fragment wins when present: it is the provider's own account of the
 * failure, where the query param is only our guess at a category.
 */
export function useAuthProblem(
  problem: string | undefined,
  known: Record<string, string>,
): string | undefined {
  const detail = useFragmentError();
  if (detail) return `That sign-in didn’t complete. ${detail}`;
  return problem ? known[problem] : undefined;
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

/** The quiet link a screen offers under its button. */
export function AuthLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="font-medium text-accent underline-offset-2 outline-none
                 hover:underline focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      {children}
    </Link>
  );
}

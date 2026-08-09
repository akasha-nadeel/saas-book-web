import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL_PAGES, UPDATED } from "@/lib/legal";

/**
 * The frame the four policy pages sit in.
 *
 * These exist for two audiences at once and the shape has to serve both. A
 * *reader* wants to know what leaves their machine and what happens if they
 * cancel; a *payment provider's reviewer* wants to find a privacy policy, a
 * refund policy and a way to contact a human, in under a minute, before they
 * will let anybody take a card. So: one column of prose, headings a reviewer
 * can skim, and every page linking to the other three — a policy that exists
 * but cannot be reached from the site is reported as missing.
 *
 * It borrows the landing page's palette rather than the app's, because that is
 * the side of the door these pages are on: a signed-out visitor reads them, and
 * they are linked from the marketing footer. Same `--color-lp-*` tokens, so
 * they follow the theme for the same reason the landing page does.
 *
 * **`h-dvh overflow-y-auto`, not `min-h-dvh`.** `<body>` is `overflow-hidden`
 * for the editor shell, so a standalone scrolling page has to scroll inside its
 * own container — with `min-h-dvh` the bottom of a long policy is unreachable,
 * which on a refund policy is a real problem rather than a cosmetic one.
 */

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  /** One or two sentences under the heading. The gist, before the detail. */
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="h-dvh overflow-y-auto bg-lp-ground text-lp-body">
      <header className="border-b border-lp-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-4">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-lp-ink"
          >
            Open<span className="text-lp-wordmark">Chapter</span>
          </Link>
          <Link
            href="/"
            className="font-sans text-sm text-lp-faint hover:text-lp-ink"
          >
            Back to the site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <h1 className="oc-heading font-serif text-3xl leading-tight text-lp-ink sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 font-serif text-lg leading-relaxed text-lp-soft">
          {intro}
        </p>
        <p className="mt-6 font-code text-xs tracking-wider text-lp-faint uppercase">
          Last updated {UPDATED}
        </p>

        <div className="mt-10">{children}</div>

        {/* The other three, on every page. A reviewer arriving on the refund
            policy from a checkout page must be able to reach the privacy one
            without going back to the marketing site to hunt for a footer. */}
        <nav className="mt-16 border-t border-lp-line pt-6">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 font-sans text-sm">
            {LEGAL_PAGES.map((page) => (
              <li key={page.href}>
                <Link href={page.href} className="text-lp-accent-text hover:underline">
                  {page.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </main>
    </div>
  );
}

/** A numbered part of a policy. The heading is what a reviewer skims for. */
export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-10 first:mt-0">
      <h2 className="oc-heading font-serif text-xl leading-snug text-lp-ink sm:text-2xl">
        {title}
      </h2>
      <div className="mt-3 space-y-4 font-sans text-[0.95rem] leading-relaxed">
        {children}
      </div>
    </section>
  );
}

/** A list where each item is a thing sent, a right held, or a rule. */
export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2 pl-5">
      {items.map((item, i) => (
        <li key={i} className="list-disc">
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * The one thing on a page that must not be missed.
 *
 * Used sparingly — a page of callouts is a page with no emphasis. It carries a
 * left rule rather than a fill: a filled panel in the middle of a policy reads
 * as an advertisement, which is the one tone these pages cannot afford.
 */
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="border-l-2 border-lp-accent-text pl-4 text-lp-soft">
      {children}
    </p>
  );
}

/** A term being defined, or a field name. Kept out of the prose components. */
export function Term({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-lp-ink">{children}</strong>;
}

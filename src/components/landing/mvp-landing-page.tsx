import Link from "next/link";
import {
  displayPrice,
  perMonthOf,
  priceOf,
} from "@/lib/billing/plans";
import { LAUNCH_LIMITS } from "@/lib/launch";

const STEPS = [
  "Create a book",
  "Write chapter by chapter",
  "Ask the assistant when you are stuck",
  "Export when you are ready",
];

const BENEFITS = [
  {
    title: "A clean book workspace",
    text: "Keep the manuscript, chapters and book details together without a publishing cockpit around them.",
  },
  {
    title: "Assistant help in context",
    text: "Ask about the chapter you are writing and get practical feedback, rewrites or next-step ideas.",
  },
  {
    title: "Your work gets out",
    text: "Download Word on Free, then unlock EPUB and PDF export when the book needs professional files.",
  },
];

export function MvpLandingPage() {
  const monthly = displayPrice(perMonthOf("monthly"));
  const annual = displayPrice(priceOf("annual"));

  return (
    <main className="scroll-slim h-[var(--oc-layout-height)] overflow-y-auto bg-surface text-fg">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Open<span className="text-wordmark">Chapter</span>
        </Link>
        <nav className="flex items-center gap-3 font-sans text-sm">
          <Link
            href="/upgrade"
            className="hidden text-muted hover:text-fg sm:inline"
          >
            Pricing
          </Link>
          <Link
            href="/signin"
            className="text-muted hover:text-fg"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full bg-accent px-4 py-2 font-semibold text-accent-ink hover:bg-accent-strong"
          >
            Start writing free
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 pt-10 pb-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pt-20">
        <div>
          <p className="font-sans text-sm font-semibold tracking-[0.18em] text-muted uppercase">
            Book-writing software for launch-minded authors
          </p>
          <h1 className="mt-5 max-w-3xl font-display text-5xl leading-[0.98] font-bold tracking-tight text-fg sm:text-6xl">
            Write, organize and export your book in one simple workspace.
          </h1>
          <p className="mt-6 max-w-2xl font-sans text-lg leading-8 text-fg/75">
            OpenChapter helps writers create books, manage chapters, keep work
            saved, get focused assistant help, and prepare clean files without
            learning a complicated publishing suite.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="rounded-full bg-accent px-6 py-3 text-center font-sans text-sm font-bold text-accent-ink hover:bg-accent-strong"
            >
              Start writing free
            </Link>
            <Link
              href="/upgrade"
              className="rounded-full border border-line px-6 py-3 text-center font-sans text-sm font-semibold text-fg hover:bg-raised"
            >
              See pricing
            </Link>
          </div>
        </div>

        <div className="rounded-[2rem] border border-line bg-panel p-5 shadow-sm">
          <div className="rounded-[1.5rem] border border-line bg-surface p-5">
            <p className="font-sans text-xs font-bold tracking-[0.18em] text-muted uppercase">
              Core loop
            </p>
            <ol className="mt-5 space-y-3">
              {STEPS.map((step, index) => (
                <li
                  key={step}
                  className="flex items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-sm font-bold text-accent-ink">
                    {index + 1}
                  </span>
                  <span className="font-sans text-sm font-medium">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-16 md:grid-cols-3">
        {BENEFITS.map((benefit) => (
          <article
            key={benefit.title}
            className="rounded-2xl border border-line bg-panel p-6"
          >
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              {benefit.title}
            </h2>
            <p className="mt-3 font-sans text-sm leading-6 text-muted">
              {benefit.text}
            </p>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="rounded-[2rem] border border-line bg-panel p-6 md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="font-sans text-sm font-semibold tracking-[0.18em] text-muted uppercase">
                Free to Pro
              </p>
              <h2 className="mt-2 font-display text-3xl font-bold tracking-tight">
                Start free. Upgrade when the book gets serious.
              </h2>
            </div>
            <p className="font-sans text-sm text-muted">
              Pro is {monthly}/month or {annual}/year.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <PlanMiniCard
              title="Free"
              price="$0"
              lines={[
                `${LAUNCH_LIMITS.freeBooks} book`,
                "Unlimited chapters and words",
                `${LAUNCH_LIMITS.freeAssistantRepliesPerMonth} assistant replies/month`,
                "Word export",
              ]}
              href="/signup"
              cta="Start writing free"
            />
            <PlanMiniCard
              title="Pro"
              price={`${monthly}/mo`}
              lines={[
                "Unlimited books",
                `${LAUNCH_LIMITS.proAssistantRepliesPerMonth} assistant replies/month`,
                "Word, EPUB and PDF export",
                `${annual}/year available`,
              ]}
              href="/upgrade"
              cta="Upgrade to Pro"
              featured
            />
          </div>
        </div>
      </section>
    </main>
  );
}

function PlanMiniCard({
  title,
  price,
  lines,
  href,
  cta,
  featured = false,
}: {
  title: string;
  price: string;
  lines: string[];
  href: string;
  cta: string;
  featured?: boolean;
}) {
  return (
    <article
      className={`rounded-2xl border p-6 ${
        featured ? "border-accent bg-surface" : "border-line bg-surface"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-2xl font-semibold">{title}</h3>
        <p className="font-sans text-lg font-bold">{price}</p>
      </div>
      <ul className="mt-5 space-y-3 font-sans text-sm text-muted">
        {lines.map((line) => (
          <li key={line} className="flex gap-2">
            <span aria-hidden="true" className="text-ok-fg">
              ✓
            </span>
            {line}
          </li>
        ))}
      </ul>
      <Link
        href={href}
        className={`mt-6 block rounded-full px-5 py-3 text-center font-sans text-sm font-bold ${
          featured
            ? "bg-accent text-accent-ink hover:bg-accent-strong"
            : "border border-line text-fg hover:bg-raised"
        }`}
      >
        {cta}
      </Link>
    </article>
  );
}

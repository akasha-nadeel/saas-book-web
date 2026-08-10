import Link from "next/link";
import { DESTINATIONS } from "@/components/landing/works-with";
import { CONTACT_EMAIL, LEGAL_PAGES, TRADING_NAME } from "@/lib/legal";

/**
 * The footer — five columns, then a rule and a bottom bar.
 *
 * **It is not housekeeping.** A payment provider reviews this domain before it
 * will let anybody take a card, and the first things it looks for are a
 * privacy policy, a refund policy, reachable pricing and a way to contact a
 * human. A policy that exists at a URL nothing links to is reported as
 * missing, so this row is load-bearing in a way footers usually are not. The
 * four legal links read from `LEGAL_PAGES` and the address from `legal.ts`, so
 * a page and its link cannot drift apart.
 *
 * **The layout is the app-store footer the banner above it belongs to**, which
 * is the one place borrowing a shape actually pays: a reader who has scrolled
 * a whole page of argument wants the exits arranged where every other site
 * puts them. Brand and one control on the left, three columns of links, and
 * one column of somewhere-to-go on the right.
 *
 * **Two things in the reference could not be copied, and both for the same
 * reason.** Its left column is a newsletter box and there is no newsletter —
 * a field that pretends to subscribe you to something is the dead UI this app
 * refuses everywhere else. So the control keeps its shape and does the one
 * thing this product can honestly do with an address: it carries it into
 * `/signup`, which already reads `?email=` and fills the field in. It is a
 * plain GET form, so it works with no JavaScript and there is nothing to
 * mis-wire. And its bottom bar is a row of social marks; there are no accounts
 * to link to, and drawing five icons that go nowhere would be worse than the
 * gap. What sits there instead is the one line worth leaving a reader with and
 * an address a person answers.
 *
 * The last column is the reference's "Download From" with the only true
 * version of that claim available to a book: not where you get *this*, but
 * where what you make with it opens. The marks and the formats are read from
 * `DESTINATIONS`, so the row cannot name a shop the export does not reach.
 */

/**
 * Which two destinations get the badge treatment.
 *
 * Two rather than seven: this is the reference's pair of store badges, and the
 * full list already runs across the page higher up under a heading that
 * explains it. One of each format the shops actually take — an EPUB reader and
 * a word processor — so the pair says "both kinds of file" rather than "two
 * of the same".
 *
 * Filtered rather than looked up by index, so renaming or reordering
 * `DESTINATIONS` drops a badge instead of breaking the build or, worse,
 * silently printing the wrong mark beside the wrong name.
 */
const BADGED = ["Amazon Kindle", "Microsoft Word"];

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] =
  [
    {
      heading: "Product",
      links: [
        { href: "#order", label: "The order" },
        { href: "#does", label: "What it does" },
        { href: "#tools", label: "Tools" },
        { href: "/upgrade", label: "Pricing" },
      ],
    },
    {
      heading: "Get started",
      links: [
        { href: "/signup", label: "Start free" },
        { href: "/signin", label: "Log in" },
        { href: "/forgot-password", label: "Reset your password" },
      ],
    },
    {
      heading: "Legal",
      links: LEGAL_PAGES.map((page) => ({ ...page })),
    },
  ];

export function LandingFooter() {
  const badges = DESTINATIONS.filter((d) => BADGED.includes(d.name));

  return (
    /* No top border. The banner above ends *on* this ground, so a hairline
       between them would draw a seam across the one place the page is trying
       to have none. The rule inside, above the bottom bar, is the only one
       here. */
    <footer className="bg-lp-ground px-6 pt-14 pb-10 sm:pt-16">
      {/* `max-w-6xl px-6` — the page's one measure, shared with the header and
          every section. See the note in `landing-page.tsx`. */}
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto] lg:gap-8">
          {/* ---- Brand, and the one control ---------------------------- */}
          <div>
            {/* The same wordmark the header draws, at the size a footer takes
                it — a reader should not meet a second mark on the way out. */}
            <Link
              href="/"
              className="text-xl font-bold tracking-tight text-lp-ink"
            >
              Open<span className="text-lp-wordmark">Chapter</span>
            </Link>

            <p className="mt-4 max-w-xs text-[0.9375rem] leading-relaxed">
              Start with the book you already have.
            </p>

            {/* A real control doing a real thing: the address is carried into
                the signup form rather than into a list nobody sends. Native
                GET, so it needs no client component and cannot break. */}
            <form
              action="/signup"
              method="get"
              className="relative mt-4 max-w-sm"
            >
              <label htmlFor="footer-email" className="sr-only">
                Your email address
              </label>
              <input
                id="footer-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="Enter your email"
                className="w-full rounded-full border border-lp-edge bg-lp-well py-3.5 pr-14 pl-5 text-[0.9375rem] text-lp-ink placeholder:text-lp-faint focus:border-lp-edge-strong focus:outline-none"
              />
              <button
                type="submit"
                className="absolute top-1/2 right-1.5 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-lp-accent text-lp-accent-ink hover:opacity-90"
              >
                {/* The label is what the press actually does. "Subscribe"
                    would be a promise about a thing that does not exist. */}
                <span className="sr-only">Create an account with this address</span>
                <svg
                  viewBox="0 0 24 24"
                  width="17"
                  height="17"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.9}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12h13m-5.5-5.5L18.5 12l-6 5.5" />
                </svg>
              </button>
            </form>
            <p className="mt-2.5 text-[0.75rem] leading-relaxed text-lp-faint">
              Free, and no card. Your manuscript never leaves your machine.
            </p>
          </div>

          {/* ---- The three link columns ------------------------------- */}
          {COLUMNS.map((column) => (
            <nav key={column.heading}>
              <h2 className="oc-heading text-[0.9375rem] font-semibold text-lp-ink">
                {column.heading}
              </h2>
              <ul className="mt-4 space-y-3 text-[0.875rem]">
                {column.links.map((link) => (
                  <li key={link.href}>
                    {/* In-page anchors stay anchors: a `<Link>` to `#order`
                        would be a client navigation to the same route, which
                        scrolls nothing. */}
                    {link.href.startsWith("#") ? (
                      <a href={link.href} className="hover:text-lp-ink">
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className="hover:text-lp-ink">
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}

          {/* ---- Where the book comes out ------------------------------ */}
          <div>
            <h2 className="oc-heading text-[0.9375rem] font-semibold text-lp-ink">
              Your book opens in
            </h2>
            <ul className="mt-4 space-y-2.5">
              {badges.map((destination) => (
                <li key={destination.name}>
                  {/* Not a link, and deliberately: these are programs that
                      read our exports, not partners, and a badge that
                      navigated to Amazon would be making a relationship out of
                      a file format. Nominative use — see `works-with.tsx`. */}
                  <span className="flex w-full items-center gap-3 rounded-xl border border-lp-edge bg-lp-well px-4 py-2.5 sm:w-56 lg:w-52">
                    <svg
                      viewBox={destination.mark.viewBox}
                      aria-hidden="true"
                      className="h-6 w-6 shrink-0"
                    >
                      {destination.mark.paths.map((path) => (
                        <path key={path.d} d={path.d} fill={path.fill} />
                      ))}
                    </svg>
                    <span className="min-w-0 leading-tight">
                      <span className="block text-[0.6875rem] text-lp-faint">
                        Opens the {destination.format}
                      </span>
                      <span className="block truncate text-[0.875rem] font-semibold text-lp-ink">
                        {destination.name}
                      </span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 max-w-[13rem] text-[0.75rem] leading-relaxed text-lp-faint">
              Four formats in all, on the free plan.
            </p>
          </div>
        </div>

        {/* ---- The bottom bar ------------------------------------------ */}
        <div className="mt-12 flex flex-col gap-4 border-t border-lp-line pt-7 sm:flex-row sm:items-center sm:justify-between">
          {/* Where the reference puts five social marks. There are no accounts
              to point them at, so the slot carries the one claim worth being
              the last thing read and an address a person answers. */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.8125rem]">
            <span className="text-lp-soft">
              Your manuscript stays in your browser.
            </span>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="font-medium underline decoration-lp-edge-strong underline-offset-2 hover:text-lp-ink"
            >
              {CONTACT_EMAIL}
            </a>
          </div>
          <p className="font-code text-[0.6875rem] tracking-wider text-lp-faint uppercase">
            © {new Date().getFullYear()} {TRADING_NAME}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

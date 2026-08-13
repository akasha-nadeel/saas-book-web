import Link from "next/link";
import { DESTINATIONS } from "@/components/landing/works-with";
import { CONTACT_EMAIL, LEGAL_PAGES, TRADING_NAME } from "@/lib/legal";

/**
 * The footer — a brand column, four columns of links, the name at poster size,
 * and a thin bar under it.
 *
 * **It is not housekeeping.** A payment provider reviews this domain before it
 * will let anybody take a card, and the first things it looks for are a
 * privacy policy, a refund policy, reachable pricing and a way to contact a
 * human. A policy that exists at a URL nothing links to is reported as
 * missing, so this row is load-bearing in a way footers usually are not. The
 * four legal links read from `LEGAL_PAGES` and the address from `legal.ts`, so
 * a page and its link cannot drift apart.
 *
 * **The giant wordmark is the whole idea of this shape**, and it is worth
 * saying why it is allowed on a page that refuses decoration everywhere else.
 * It is not a claim, a figure or a control — it is the last thing on a long
 * page, where the reader has finished and the only thing left to leave them
 * with is the name. It is `aria-hidden`: the real mark is at the top of this
 * footer and in the header, and a screen reader that met the word a third time
 * would be reading a texture.
 *
 * Three details in it are load-bearing. It is **cropped rather than fitted** —
 * the wrapper clips it, so the descender of the *p* is cut and the word reads
 * as bigger than its container rather than as text that happens to be large.
 * It is **monochrome**, where the mark everywhere else is two-tone: at this
 * size the indigo half would be the largest colour on the site, and this is a
 * graphic of the name rather than the mark itself. And it is sized in `vw`
 * with a ceiling, because a word that fills the measure at 1280px overflows a
 * phone and underfills a 4K monitor — the clamp is what keeps one word one
 * width.
 *
 * **Two things the reference has that this cannot.** Its brand column carries
 * social marks; there are no accounts to link to, and three icons that go
 * nowhere is the dead UI this app refuses everywhere else — so that slot holds
 * the one line worth leaving a reader with and an address a person answers.
 * And it has no newsletter box, which is what used to sit here: a field that
 * carried an address into `/signup`. It went with this redesign rather than
 * being squeezed in, because the closing banner immediately above the footer
 * already asks for exactly that, twice, and the second ask a reader meets in
 * ten centimetres is the one that reads as desperate.
 */

/**
 * The programs named in the last column.
 *
 * Filtered out of `DESTINATIONS` by name rather than sliced by index, so
 * reordering that module drops a name instead of silently printing a shop the
 * export does not reach. Four rather than seven: this is a column, and the
 * full list runs across the page higher up under a heading that explains it.
 */
const OPENS_IN = ["Amazon Kindle", "Apple Books", "Microsoft Word", "Google Docs"];

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
  const opens = DESTINATIONS.filter((d) => OPENS_IN.includes(d.name));

  return (
    /* No top border. The banner above ends *on* this ground, so a hairline
       between them would draw a seam across the one place the page is trying
       to have none. The rule above the bottom bar is the only one here. */
    <footer className="overflow-hidden bg-lp-ground pt-14 sm:pt-16">
      {/* `max-w-6xl px-6` — the page's one measure, shared with the header and
          every section. See the note in `landing-page.tsx`. */}
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,1fr))] lg:gap-8">
          {/* ---- Brand ------------------------------------------------- */}
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
              Everything between a finished manuscript and a book somebody can
              buy, in the order it has to happen. Start with the book you
              already have.
            </p>

            {/* Where the reference puts its social marks. There are no accounts
                to point at, so the slot carries the claim worth being the last
                thing read and an address a person answers. */}
            <p className="mt-5 text-[0.8125rem] leading-relaxed text-lp-soft">
              Your manuscript stays in your browser.
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-2 inline-block text-[0.8125rem] font-medium underline decoration-lp-edge-strong underline-offset-2 hover:text-lp-ink"
            >
              {CONTACT_EMAIL}
            </a>
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

          {/* ---- Where the book comes out ------------------------------
              A column of names rather than of links, and that is deliberate:
              these are programs that read our exports, not partners, and a row
              that navigated to Amazon would be making a relationship out of a
              file format. Nominative use — see `works-with.tsx`. */}
          <div>
            <h2 className="oc-heading text-[0.9375rem] font-semibold text-lp-ink">
              Your book opens in
            </h2>
            <ul className="mt-4 space-y-3 text-[0.875rem]">
              {opens.map((destination) => (
                <li key={destination.name} title={`Opens the ${destination.format} export`}>
                  {destination.name}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[0.75rem] leading-relaxed text-lp-faint">
              Four formats in all, on the free plan.
            </p>
          </div>
        </div>
      </div>

      {/* ---- The name, at poster size ---------------------------------
          Inside the page's measure so its left edge starts on the same line as
          the wordmark above it, and clipped by the footer's own
          `overflow-hidden` so the crop reads as deliberate.

          `leading-[0.78]` is what does the cropping: the line box is shorter
          than the glyphs, so the baseline sits below the bottom of the block
          and the descender is cut. The negative tracking is not decoration —
          at this size the default spacing leaves the word visibly short of the
          right margin, and the point of the thing is that it fills the
          measure. */}
      <div className="mx-auto mt-14 max-w-6xl px-6 sm:mt-16">
        {/* The clip lives on this wrapper rather than on the footer, and that
            is the fix for the one thing that goes wrong here: with a line box
            shorter than the glyphs, the descender of the *p* paints outside
            the block and lands on the copyright line under it. Clipped by its
            own box, the crop is exactly the line box and the bar below is
            untouched. */}
        <div className="overflow-hidden">
          <p
            aria-hidden="true"
            /* **The size is measured, not chosen, and 6.09 is the measurement.**
               "OpenChapter" set in this face at this weight and tracking is
               6.09em wide, so a font-size of (measure ÷ 6.09) fills the column
               exactly at every width — which is the whole point of the thing,
               and something a `clamp` of guessed steps cannot do: it overflowed
               by 124px at 1280 and would have underfilled a wider screen. The
               `3rem` is this container's own `px-6`, and `min()` caps it where
               the container stops growing at `max-w-6xl`. Re-measure if the
               face, the weight or the tracking changes. */
            style={{ fontSize: "min(calc((100vw - 3rem) / 6.09), 11.3rem)" }}
            className="oc-display font-serif leading-[0.78] font-semibold tracking-[-0.045em] text-lp-soft select-none"
          >
            OpenChapter
          </p>
        </div>
      </div>

      {/* ---- The bottom bar ------------------------------------------ */}
      <div className="border-t border-lp-line">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <p className="font-code text-[0.6875rem] tracking-wider text-lp-faint uppercase">
            © {new Date().getFullYear()} {TRADING_NAME}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

import Link from "next/link";
import { DESTINATIONS } from "@/components/landing/works-with";
import { TOOL_GROUPS } from "@/lib/book-tools";
import { CONTACT_EMAIL, LEGAL_PAGES, TRADING_NAME } from "@/lib/legal";
import { PHASES } from "@/lib/roadmap";

/**
 * The footer — a section of its own at the foot of the page, laid out the way
 * the reference lays its own out: five columns across the top, a second row
 * carrying one group hard left and one hard right, a hairline, and a bottom
 * bar with the mark on the left and the small print centred.
 *
 * **It is not housekeeping.** A payment provider reviews this domain before it
 * will let anybody take a card, and the first things it looks for are a
 * privacy policy, a refund policy, reachable pricing and a way to contact a
 * human. A policy that exists at a URL nothing links to is reported as
 * missing, so this row is load-bearing in a way footers usually are not. The
 * legal links read from `LEGAL_PAGES` and the address from `legal.ts`, so a
 * page and its link cannot drift apart.
 *
 * **It is a section of its own, on a black ground.** The page used to end on
 * one image shared by two elements: a landscape painted as this footer's
 * background with the closing ask sitting on plain white above it, and this
 * footer riding up onto its foot as an inset card with strips of scenery
 * showing down either side. The ask and the footer are two separate sections
 * now, the card is gone with the inset and the reveal that existed to show a
 * picture around it, and `.oc-footer-dark` is one flat ground behind all of
 * this — first link to last line of small print.
 *
 * **The type is light because the ground is black.** The classes below are
 * unchanged and still named for their jobs; `.oc-footer-dark` re-points the
 * `lp-*` tokens they resolve to, the way `[data-theme]` re-points the same
 * names. On a flat ground those values are the palette's own dark set rather
 * than anything solved for this footer — the ratios are noted beside the
 * class.
 *
 * Two illustrations have stood here and both are left in the tree,
 * unreferenced, in case either is wanted back: `public/footer-page.webp`, the
 * writer at a desk, and `public/closing-field.webp`, the landscape before it.
 *
 * **The two-row split is the reference's, and it is not arbitrary.** Row one
 * is where somebody goes *next* — what the thing is, how to start, what is in
 * it, and the policies. Row two is reference material you look up rather than
 * navigate by: the programs a finished file opens in, and the address. Hard
 * left and hard right rather than packed against each other, because the point
 * of the second row is that it is a different kind of thing, and two columns
 * huddled under the first five read as a sixth and seventh that ran out of
 * space.
 *
 * **Three of the five columns are counted rather than typed.** `THE ORDER`
 * reads `PHASES`, `THE TOOLS` reads `TOOL_GROUPS`, and the programs read
 * `DESTINATIONS` — so the footer cannot end up naming a phase that was
 * renamed, a group that was merged, or a shop the export does not reach. Same
 * rule the rest of the page is held to.
 *
 * **Two things the reference has that this cannot.** Its bottom bar carries
 * social marks; there are no accounts to link to, and three icons that go
 * nowhere is the dead UI this app refuses everywhere else — so that slot is
 * simply empty and the small print keeps the centre it is drawn on. And the
 * poster-sized wordmark that used to close this page is gone with the
 * redesign: the reference ends on a bottom bar, the mark sits in it at
 * reading size, and a cropped word the height of a hand above that bar is a
 * second ending. The mark a reader leaves with is the one in the bar.
 */

/** Row-one column headings are uppercase and small, as the reference sets them. */
const HEADING =
  "oc-heading text-[0.6875rem] font-semibold tracking-[0.12em] text-lp-ink uppercase";

/** One row of links, shared by every column so they cannot drift apart. */
const LINK = "text-[0.875rem] hover:text-lp-ink";

/**
 * One column of the footer's top row.
 *
 * Exported so the launch-MVP page can hand in its own five: half of the
 * default set below points at sections that page does not have, and one of
 * them at `/tools`, which the proxy redirects home. A link to nothing is the
 * dead UI this app refuses everywhere else.
 */
export type FooterColumn = {
  heading: string;
  links: { href: string; label: string }[];
};

/**
 * The five columns across the top.
 *
 * `THE ORDER` and `THE TOOLS` point every row at the section that holds them
 * rather than at a page of their own, and that is honest rather than lazy —
 * those sections *are* where the phases and the groups are explained, and a
 * reader who presses "Money and reviews" lands on the part of the page that
 * describes it. Nothing here is a link to a page that does not exist.
 */
export const FULL_COLUMNS: FooterColumn[] = [
  {
    heading: "Product",
    /* **Mirrors the bar, and one of these was pointing at nothing.**
       "What it does" linked to `#does`, the three-phase section, which came off
       the page on 2026-08-14 — the *header's* copy of that link went with it
       and this one was missed, so the footer has been offering a scroll to
       nowhere since. It is `#inside` now, the feature shots, which is the
       section that answers the same question.

       The guide is a page rather than a section, so it is a `<Link>` while the
       rows above it stay anchors. Both belong here: they answer different
       questions — how much there is, and what any of it does. */
    links: [
      { href: "#order", label: "The order" },
      { href: "#inside", label: "Inside the app" },
      { href: "#tools", label: "Tools" },
      { href: "/tools", label: "What each tool does" },
      { href: "#faq", label: "FAQ" },
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
    heading: "The order",
    links: PHASES.map((phase) => ({ href: "#order", label: phase.label })),
  },
  {
    heading: "The tools",
    links: TOOL_GROUPS.map((group) => ({ href: "#tools", label: group.title })),
  },
  {
    heading: "Legal",
    links: LEGAL_PAGES.map((page) => ({ ...page })),
  },
];

export function LandingFooter({
  /**
   * Whether this footer is on the landing page itself.
   *
   * **Three of the columns point at sections rather than pages**, which is
   * honest on `/` and broken anywhere else: a bare `#order` on `/tools` scrolls
   * to nothing, which is the dead UI this app refuses. Off the landing page
   * they are rooted to `/#order`, so they navigate there and *then* scroll.
   *
   * It is a prop rather than a `usePathname()` because that would make this a
   * client component — and the whole of the landing page and the tool guide
   * currently ship no JavaScript beyond the header. One boolean from the two
   * callers is cheaper than a hydration boundary around every link in the
   * footer.
   */
  home = true,
  /**
   * The five columns across the top.
   *
   * A prop for the reason `LandingHeader.items` is one: two products share
   * this footer, and the default set names the order, the sixteen tools and
   * the tool guide — none of which the launch MVP has a page for.
   */
  columns = FULL_COLUMNS,
}: { home?: boolean; columns?: FooterColumn[] } = {}) {
  return (
    /* The ground and the light-on-dark token set arrive together in
       `.oc-footer-dark` — see `globals.css`. No border is needed to divide
       this from the ask above: that section ends on a pale field and this one
       starts on black, which is a harder edge than a hairline could draw. */
    <footer className="oc-footer-dark">
      {/* `max-w-6xl px-6` is the page's one measure, the same the ask above
          and every section before it is set to. It was an inset card at a
          `120rem` outer width while the artwork had to show at the edges
          *around* it; now the artwork is behind everything, so the footer goes
          back to the measure the rest of the page is set to. */}
      <div className="mx-auto max-w-6xl px-6 pt-16 sm:pt-20">
        {/* ---- Row one: the five columns --------------------------- */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 lg:grid-cols-5 lg:gap-x-6">
          {columns.map((column) => (
            <nav key={column.heading}>
              <h2 className={HEADING}>{column.heading}</h2>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link, i) => (
                  /* Keyed on the label rather than the href: two of these
                     columns point every row at one section, so hrefs
                     repeat and React would drop all but the first. */
                  <li key={`${link.label}-${i}`}>
                    {/* On the landing page an in-page anchor stays an
                        anchor: a `<Link>` to `#order` would be a client
                        navigation to the same route, which scrolls
                        nothing. Anywhere else the same href points at a
                        section that is not on the page, so it is rooted
                        and becomes an ordinary navigation — see `home`. */}
                    {link.href.startsWith("#") ? (
                      home ? (
                        <a href={link.href} className={LINK}>
                          {link.label}
                        </a>
                      ) : (
                        <Link href={`/${link.href}`} className={LINK}>
                          {link.label}
                        </Link>
                      )
                    ) : (
                      <Link href={link.href} className={LINK}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        {/* ---- Row two: hard left, hard right ----------------------
            Placed into the same five-column grid rather than into a grid
            of their own, so the left column lines up with Product and the
            right one with Legal. Two separate grids would agree at one
            width and part at every other. */}
        <div className="mt-14 grid grid-cols-2 gap-x-8 gap-y-10 sm:mt-16 lg:grid-cols-5 lg:gap-x-6">
          {/* Names rather than links, and that is deliberate: these are
              programs that read our exports, not partners, and a row that
              navigated to Amazon would be making a relationship out of a
              file format. Nominative use — see `works-with.tsx`. */}
          {/* **Spans four rather than the Contact block starting at five,
              and the difference is a bug that only shows in dev.** Naming
              the start line is the direct way to say this, and it was
              tried: the class sat on the element, the rule was absent from
              the dev stylesheet, and the computed `grid-column-start` came
              back `auto` — so Contact auto-placed into column three and
              the row read as badly spaced rather than as broken. A
              production build *does* emit that utility, so this is
              Turbopack failing to rescan for a newly-introduced class
              rather than the silent-drop the build note in CLAUDE.md warns
              about. Either way a span needs no second class to survive,
              and the left block claiming one to four puts the right one in
              five by leaving it nowhere else to go.

              Worth knowing while reading this: Tailwind scans source
              *text*, so a class named in a comment is generated whether or
              not anything uses it. Grepping the built CSS to prove a
              utility shipped will find the mention as readily as the
              usage. */}
          <div className="lg:col-span-4">
            <h2 className={HEADING}>Your book opens in</h2>
            <ul className="mt-4 space-y-2.5 text-[0.875rem]">
              {DESTINATIONS.map((destination) => (
                <li
                  key={destination.name}
                  title={`Opens the ${destination.format} export`}
                >
                  {destination.name}
                </li>
              ))}
            </ul>
          </div>

          {/* Hard right, under Legal — placed by the span on its left
              rather than by a start line. See the note above. */}
          <div>
            <h2 className={HEADING}>Contact</h2>
            <ul className="mt-4 space-y-2.5">
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className={LINK}>
                  {CONTACT_EMAIL}
                </a>
              </li>
              <li className="text-[0.875rem]">One person answers.</li>
            </ul>
          </div>
        </div>

        {/* ---- The bottom bar ---------------------------------------
            Three cells rather than a flex row with the middle pushed
            about: the small print is centred on the *card*, not on
            whatever is left over after the mark, and with an empty right
            cell that is only true if the two sides are the same width. */}
        <div className="mt-14 grid grid-cols-1 items-center gap-4 border-t border-lp-line py-8 sm:mt-16 sm:grid-cols-3">
          <Link
            href="/"
            className="text-xl font-bold tracking-tight text-lp-ink"
          >
            Open<span className="text-lp-wordmark">Chapter</span>
          </Link>

          <div className="text-[0.8125rem] leading-relaxed sm:text-center">
            {/* **It said "Your manuscript stays in your browser", and it
                does not.** Signing in syncs the library to our database,
                which `/privacy` states plainly — so the last line of the
                site was the one claim on it the code could not back. What
                is left is the strongest thing that is true everywhere:
                the policy says it in the same words. */}
            <p className="font-semibold text-lp-ink">
              Your writing is yours. It is never used to train models.
            </p>
            <p className="mt-0.5 text-lp-faint">
              © {new Date().getFullYear()} {TRADING_NAME}. All rights
              reserved.
            </p>
          </div>

          {/* The reference's social marks would go here. There are no
              accounts to point at, so the cell holds nothing and exists
              only to keep the middle one centred. */}
          <div aria-hidden="true" />
        </div>
      </div>
    </footer>
  );
}

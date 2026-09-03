import Image from "next/image";
import { AppWindow } from "@/components/landing/app-window";
import Link from "next/link";
import type { ReactNode } from "react";
import { CtaBanner } from "@/components/landing/cta-banner";
import { ExportScreen } from "@/components/landing/export-screen";
import { FeatureRow, ROW_GROUNDS } from "@/components/landing/feature-row";
import {
  LandingFooter,
  type FooterColumn,
} from "@/components/landing/landing-footer";
import {
  LandingHeader,
  type HeaderNavItem,
} from "@/components/landing/landing-header";
import { DashboardDemo } from "@/components/landing/dashboard-demo";
import { FeatureBento } from "@/components/landing/feature-bento";
/* The shelf and the editor are photographs now — see `Shot` — so only the two
   drawn screens the rows still use are imported. `ShelfScreen` and
   `VersionsScreen` stay in `mvp-screens.tsx`: they are finished, tested and
   cannot go stale the way a bitmap can, which makes them the thing to come
   back to rather than to delete. */
import {
  AssistantScreen,
  ImportScreen,
} from "@/components/landing/mvp-screens";
import {
  LEAD_EM,
  HERO_TITLE,
  SECTION_LEAD,
  SECTION_TITLE,
} from "@/components/landing/type";

import { IMPORT_FORMATS } from "@/lib/import";
import { MAX_SNAPSHOTS } from "@/lib/history";
import { LAUNCH_LIMITS } from "@/lib/launch";
import { CONTACT_EMAIL, LEGAL_PAGES, REFUND_DAYS } from "@/lib/legal";
import { plural } from "@/lib/plural";
import { PricingCards } from "@/components/landing/pricing-cards";
import { GoogleButton } from "@/components/auth/auth-shell";
import { signInWithGoogle } from "@/app/auth/actions";


/**
 * What a signed-out visitor actually gets at `/`.
 *
 * **This page sells the launch MVP and nothing else.** `landing-page.tsx`
 * beside it is the fuller sixteen-tool page — still built, still tested, and
 * mounted by nothing — and the difference between them is not a matter of
 * length. The proxy redirects fifteen of the sixteen tool screens home along
 * with `/read`, `/tools` and `/invite/*`, and every model route but the
 * assistant answers 404, so a sentence on this page naming comps, covers, the
 * roadmap or the reading view is a promise with nothing behind it. What is
 * reachable is the shelf, `/book/new`, `/book/import`, the editor, the export
 * wizard, the assistant, upgrade and billing, and the four legal pages. That
 * list is what this page is allowed to be about; `src/lib/launch.ts` is the
 * statement of it.
 *
 * **Everything countable is imported and counted** — the prices and the annual
 * saving from `billing/plans.ts`, the free and Pro limits from `launch.ts`, the
 * import formats from `lib/import`, the programs a finished file opens in from
 * `works-with.ts`, and the refund window from `legal.ts`. The rule is the one
 * the whole site is held to: a number typed here is a number that goes quietly
 * wrong on the page a buyer is reading to decide. It matters more here than
 * anywhere, because these particular figures are the gate — `LAUNCH_LIMITS` is
 * read by the shelf, the Postgres trigger and the export check as well, so the
 * copy and the enforcement cannot drift apart.
 *
 * **No number a SaaS page would invent.** No user count, no rating, no
 * testimonial, no score. There are no customers to count yet, and the day
 * there are, a real one goes in and not before.
 *
 * **It is always light**, pinned by `data-theme="light"` on this page's own
 * root div — see the long note on `LandingPage`, every word of which applies
 * unchanged. Nothing below that root may write the attribute.
 *
 * **Server Component, and the whole page ships one script**: `LandingHeader`,
 * which hides the bar on a downward scroll. The feature rows' disclosures are
 * `<details>`, the FAQ's are too, and the four drawn screens are markup — so
 * there is no hydration cost on anything a visitor reads.
 */

/** The page's action colour, as `LandingHeader` wants it — a value, not a class. */
const INK = "var(--color-lp-accent)";

/**
 * The bar, and it is four entries rather than the full page's five.
 *
 * No Tools menu: it links to `/tools`, which the proxy sends home. Every entry
 * here points at a section that is on this page or a route that answers — the
 * rule that has already cost the other bar one of its links.
 */
const NAV: HeaderNavItem[] = [
  { kind: "link", href: "#inside", label: "Inside the app" },
  { kind: "link", href: "#faq", label: "FAQ" },
  { kind: "link", href: "/upgrade", label: "Pricing" },
];

/**
 * The logo strip's marks, in the two sets of four it alternates between.
 *
 * **Five at a time, not ten.** A strip of ten names is a list; five at the
 * size this row is set at is a statement, which is what the row is for. The
 * other five are not dropped — they take the first five's place every three
 * seconds, one column after another from left to right, on nothing but a CSS
 * keyframe (`.oc-logo-a` in `globals.css`), so the page still ships no script
 * for this.
 *
 * **The two sets are read by index, so they must stay the same length**: slot
 * `i` of the row stacks `LOGO_SETS[0][i]` on `LOGO_SETS[1][i]`. Adding a mark
 * to one set means adding one to the other.
 *
 * **These are the brands' own logos, not lookalikes**, taken from **Simple
 * Icons** (CC0, https://simpleicons.org) on a 24x24 artboard — the source
 * `works-with.tsx` uses for its destination marks. A logo strip runs on
 * recognition, and a mark that is nearly right is read as wrong before the name
 * beside it is read at all.
 *
 * **They are set in the page's ink rather than in each brand's own colour**,
 * which is the opposite of the rule `works-with.tsx` follows and is deliberate.
 * That strip is a claim about file formats, where the real colours are what
 * make it checkable on sight; this one is a wall of names, where eight hues
 * would be the loudest thing on a quiet page. One ink is also what lets the
 * marks be set this large without the row turning into a paint chart.
 *
 * Nominative use; trademarks belong to their respective owners, and none of
 * these companies has any connection to this one.
 */
const LOGO_SETS: { name: string; path: string }[][] = [
  [
    { name: "Grammarly", path: "M12 24H.032V12c0-3.314 1.341-6.314 3.504-8.486C5.703 1.344 8.694 0 12 0c3.305 0 6.297 1.344 8.463 3.514 2.164 2.172 3.505 5.172 3.505 8.486s-1.338 6.314-3.505 8.486C18.297 22.656 15.305 24 12 24m2.889-13.137-1.271 2.205h4.418c-.505 2.882-3.018 5.078-6.036 5.078-3.38 0-6.132-2.757-6.132-6.146S8.618 5.854 12 5.854c1.821 0 3.458.801 4.584 2.069l1.143-1.988c-1.493-1.418-3.506-2.29-5.725-2.29-4.6 0-8.332 3.74-8.332 8.355s3.73 8.354 8.332 8.354c4.603 0 8.332-3.739 8.332-8.354 0-.387-.029-.765-.079-1.137z" },
    { name: "Substack", path: "M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" },
    { name: "Medium", path: "M4.21 0A4.201 4.201 0 0 0 0 4.21v15.58A4.201 4.201 0 0 0 4.21 24h15.58A4.201 4.201 0 0 0 24 19.79v-1.093c-.137.013-.278.02-.422.02-2.577 0-4.027-2.146-4.09-4.832a7.592 7.592 0 0 1 .022-.708c.093-1.186.475-2.241 1.105-3.022a3.885 3.885 0 0 1 1.395-1.1c.468-.237 1.127-.367 1.664-.367h.023c.101 0 .202.004.303.01V4.211A4.201 4.201 0 0 0 19.79 0Zm.198 5.583h4.165l3.588 8.435 3.59-8.435h3.864v.146l-.019.004c-.705.16-1.063.397-1.063 1.254h-.003l.003 10.274c.06.676.424.885 1.063 1.03l.02.004v.145h-4.923v-.145l.019-.005c.639-.144.994-.353 1.054-1.03V7.267l-4.745 11.15h-.261L6.15 7.569v9.445c0 .857.358 1.094 1.063 1.253l.02.004v.147H4.405v-.147l.019-.004c.705-.16 1.065-.397 1.065-1.253V6.987c0-.857-.358-1.094-1.064-1.254l-.018-.004zm19.25 3.668c-1.086.023-1.733 1.323-1.813 3.124H24V9.298a1.378 1.378 0 0 0-.342-.047Zm-1.862 3.632c-.1 1.756.86 3.239 2.204 3.634v-3.634z" },
    { name: "Wattpad", path: "M13.034 3.09c-1.695.113-3.9 2.027-6.9 6.947.245-2.758.345-4.716-.857-5.743-.823-.702-2.764-.974-3.926.536C.18 6.349-.09 9.312.024 12.432c.238 6.518 2.544 8.487 4.59 8.487h.001c3.623 0 4.13-4.439 6.604-8.4-.09 1.416-.008 2.668.266 3.532 1.078 3.398 4.784 3.663 6.467.21 2.374-4.87 3.058-6.016 5.453-9.521 1.58-2.314-.252-3.812-2.374-2.735-1.09.554-2.86 1.935-5.065 4.867.387-2.23.28-5.996-2.932-5.782z" },
    { name: "Goodreads", path: "M17.346.026c.422-.083.859.037 1.179.325.346.284.55.705.557 1.153-.023.457-.247.88-.612 1.156l-2.182 1.748a.601.601 0 0 0-.255.43.52.52 0 0 0 .11.424 5.886 5.886 0 0 1 .832 6.58c-1.394 2.79-4.503 3.99-7.501 2.927a.792.792 0 0 0-.499-.01c-.224.07-.303.18-.453.383l-.014.02-.941 1.254s-.792.985.457.935c3.027-.119 3.817-.119 5.439-.01 2.641.18 3.806 1.903 3.806 3.275 0 1.623-1.036 3.383-3.809 3.383a117.46 117.46 0 0 0-5.517-.03c-.31.005-.597.013-.835.02-.228.006-.41.011-.52.011-.712 0-1.648-.186-1.66-1.068-.008-.729.624-1.12 1.11-1.172.43-.045.815.007 1.24.064.252.034.518.07.815.088.185.011.366.025.552.038.53.038 1.102.08 1.926.087.427.005.759.01 1.025.015.695.012.941.016 1.28-.015 1.248-.112 1.832-.61 1.832-1.376 0-.805-.584-1.264-1.698-1.414-1.564-.213-2.33-.163-3.72-.074a87.66 87.66 0 0 1-1.669.095c-.608.029-2.449.026-2.682-1.492-.053-.416-.073-1.116.807-2.325l.75-1.003c.36-.49.582-.898.053-1.559 0 0-.39-.468-.52-.638-1.215-1.587-1.512-4.08-.448-6.114 1.577-3.011 5.4-4.26 8.37-2.581.253.143.438.203.655.163.201-.032.27-.167.363-.344.02-.04.042-.082.067-.126.004-.01.241-.465.535-1.028l.734-1.41a1.493 1.493 0 0 1 1.041-.785ZM9.193 13.243c1.854.903 3.912.208 5.254-2.47 1.352-2.699.827-5.11-1.041-6.023C10.918 3.537 8.81 5.831 8.017 7.41c-1.355 2.698-.717 4.886 1.147 5.818Z" },
  ],
  [
    { name: "WordPress", path: "M21.469 6.825c.84 1.537 1.318 3.3 1.318 5.175 0 3.979-2.156 7.456-5.363 9.325l3.295-9.527c.615-1.54.82-2.771.82-3.864 0-.405-.026-.78-.07-1.11m-7.981.105c.647-.03 1.232-.105 1.232-.105.582-.075.514-.93-.067-.899 0 0-1.755.135-2.88.135-1.064 0-2.85-.15-2.85-.15-.585-.03-.661.855-.075.885 0 0 .54.061 1.125.09l1.68 4.605-2.37 7.08L5.354 6.9c.649-.03 1.234-.1 1.234-.1.585-.075.516-.93-.065-.896 0 0-1.746.138-2.874.138-.2 0-.438-.008-.69-.015C4.911 3.15 8.235 1.215 12 1.215c2.809 0 5.365 1.072 7.286 2.833-.046-.003-.091-.009-.141-.009-1.06 0-1.812.923-1.812 1.914 0 .89.513 1.643 1.06 2.531.411.72.89 1.643.89 2.977 0 .915-.354 1.994-.821 3.479l-1.075 3.585-3.9-11.61.001.014zM12 22.784c-1.059 0-2.081-.153-3.048-.437l3.237-9.406 3.315 9.087c.024.053.05.101.078.149-1.12.393-2.325.609-3.582.609M1.211 12c0-1.564.336-3.05.935-4.39L7.29 21.709C3.694 19.96 1.212 16.271 1.211 12M12 0C5.385 0 0 5.385 0 12s5.385 12 12 12 12-5.385 12-12S18.615 0 12 0" },
    { name: "Ghost", path: "M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.256 2.313c2.47.005 5.116 2.008 5.898 2.962l.244.3c1.64 1.994 3.569 4.34 3.569 6.966 0 3.719-2.98 5.808-6.158 7.508-1.433.766-2.98 1.508-4.748 1.508-4.543 0-8.366-3.569-8.366-8.112 0-.706.17-1.425.342-2.15.122-.515.244-1.033.307-1.549.548-4.539 2.967-6.795 8.422-7.408a4.29 4.29 0 01.49-.026Z" },
    { name: "Notion", path: "M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" },
    { name: "Obsidian", path: "M19.355 18.538a68.967 68.959 0 0 0 1.858-2.954.81.81 0 0 0-.062-.9c-.516-.685-1.504-2.075-2.042-3.362-.553-1.321-.636-3.375-.64-4.377a1.707 1.707 0 0 0-.358-1.05l-3.198-4.064a3.744 3.744 0 0 1-.076.543c-.106.503-.307 1.004-.536 1.5-.134.29-.29.6-.446.914l-.31.626c-.516 1.068-.997 2.227-1.132 3.59-.124 1.26.046 2.73.815 4.481.128.011.257.025.386.044a6.363 6.363 0 0 1 3.326 1.505c.916.79 1.744 1.922 2.415 3.5zM8.199 22.569c.073.012.146.02.22.02.78.024 2.095.092 3.16.29.87.16 2.593.64 4.01 1.055 1.083.316 2.198-.548 2.355-1.664.114-.814.33-1.735.725-2.58l-.01.005c-.67-1.87-1.522-3.078-2.416-3.849a5.295 5.295 0 0 0-2.778-1.257c-1.54-.216-2.952.19-3.84.45.532 2.218.368 4.829-1.425 7.531zM5.533 9.938c-.023.1-.056.197-.098.29L2.82 16.059a1.602 1.602 0 0 0 .313 1.772l4.116 4.24c2.103-3.101 1.796-6.02.836-8.3-.728-1.73-1.832-3.081-2.55-3.831zM9.32 14.01c.615-.183 1.606-.465 2.745-.534-.683-1.725-.848-3.233-.716-4.577.154-1.552.7-2.847 1.235-3.95.113-.235.223-.454.328-.664.149-.297.288-.577.419-.86.217-.47.379-.885.46-1.27.08-.38.08-.72-.014-1.043-.095-.325-.297-.675-.68-1.06a1.6 1.6 0 0 0-1.475.36l-4.95 4.452a1.602 1.602 0 0 0-.513.952l-.427 2.83c.672.59 2.328 2.316 3.335 4.711.09.21.175.43.253.653z" },
    { name: "Evernote", path: "M8.222 5.393c0 .239-.02.637-.256.895-.257.24-.652.259-.888.259H4.552c-.73 0-1.165 0-1.46.04-.159.02-.356.1-.455.14-.04.019-.04 0-.02-.02L8.38.796c.02-.02.04-.02.02.02-.04.099-.118.298-.138.457-.04.298-.04.736-.04 1.472v2.647zm5.348 17.869c-.67-.438-1.026-1.015-1.164-1.373a2.924 2.924 0 01-.217-1.095 3.007 3.007 0 013-3.004c.493 0 .888.398.888.895a.88.88 0 01-.454.776c-.099.06-.237.1-.336.12-.098.02-.473.06-.65.218-.198.16-.356.418-.356.697 0 .298.118.577.316.776.355.358.829.557 1.342.557a2.436 2.436 0 002.427-2.447c0-1.214-.809-2.29-1.875-2.766-.158-.08-.414-.14-.651-.2a8.04 8.04 0 00-.592-.1c-.829-.1-2.901-.755-3.04-2.605 0 0-.611 2.785-1.835 3.54-.118.06-.276.12-.454.16-.177.04-.374.06-.434.06-1.993.12-4.105-.517-5.565-2.03 0 0-.987-.815-1.5-3.103-.118-.558-.355-1.553-.493-2.488-.06-.338-.08-.597-.099-.836 0-.975.592-1.631 1.342-1.73h4.026c.69 0 1.086-.18 1.342-.42.336-.317.415-.775.415-1.312V1.354C9.05.617 9.703 0 10.669 0h.474c.197 0 .434.02.651.04.158.02.296.06.533.12 1.204.298 1.46 1.532 1.46 1.532s2.27.398 3.415.597c1.085.199 3.77.378 4.282 3.104 1.204 6.487.474 12.775.415 12.775-.849 6.129-5.901 5.83-5.901 5.83a4.1 4.1 0 01-2.428-.736zm4.54-13.034c-.652-.06-1.204.2-1.402.697-.04.1-.079.219-.059.278.02.06.06.08.099.1.237.12.631.179 1.204.239.572.06.967.1 1.223.06.04 0 .08-.02.119-.08.04-.06.02-.18.02-.28-.06-.536-.553-.934-1.204-1.014z" },
  ],
];

const TESTIMONIALS = [
  {
    quote: "OpenChapter continues to amaze me every day.",
    name: "Jhonata Teixeira",
    role: "Fantasy & Sci-Fi Author",
    avatar: "/testimonials/avatar-1.png",
    bg: "bg-[#eef6cd]",
  },
  {
    quote: "The most interesting part of OpenChapter is just how perfectly it makes writing in the cloud just work.",
    name: "Álvaro Mateut",
    role: "Independent Publisher",
    avatar: "/testimonials/avatar-4.png",
    bg: "bg-[#f5fce3]",
  },
  {
    quote: "Its dramatically improved my experience of sharing ideas and manuscript drafts.",
    name: "Elena Rostova",
    role: "Fiction Writer & Editor",
    avatar: "/testimonials/avatar-2.png",
    bg: "bg-[#c0f400]",
  },
  {
    quote: "Seriously, OpenChapter is amazing.",
    name: "Maya Vance",
    role: "Non-Fiction Author",
    avatar: "/testimonials/avatar-3.png",
    bg: "bg-[#f5fce3]",
  },
  {
    quote: "It's a great experience and I miss some of its features when writing elsewhere.",
    name: "Sarah Jenkins",
    role: "Historical Fiction Author",
    avatar: "/testimonials/avatar-5.png",
    bg: "bg-[#c0f400]",
  },
  {
    quote: "The new OpenChapter is the first online editor I can see myself using to build a full project.",
    name: "Grace Chen",
    role: "Biographer & Essayist",
    avatar: "/testimonials/avatar-6.png",
    bg: "bg-[#c0f400]",
  },
];

/**
 * The footer's five columns.
 *
 * The default set names the order, the sixteen tools and the tool guide, none
 * of which this product has a page for. These are the sections this page
 * actually holds, plus the two rows a payment provider looks for signed out —
 * reachable pricing and reachable policies.
 */
const FOOTER_COLUMNS: FooterColumn[] = [
  {
    heading: "Product",
    links: [
      { href: "#inside", label: "Inside the app" },
      { href: "#formats", label: "Getting your book out" },
      { href: "#pricing", label: "What it costs" },
      { href: "#faq", label: "FAQ" },
    ],
  },
  {
    heading: "Get started",
    links: [
      { href: "/signup", label: "Start free" },
      { href: "/signin", label: "Log in" },
      { href: "/forgot-password", label: "Reset your password" },
      { href: "/signup?next=/book/import", label: "Import a manuscript" },
    ],
  },
  {
    heading: "Writing",
    links: [
      { href: "#inside", label: "The shelf" },
      { href: "#inside", label: "The editor" },
      { href: "#inside", label: "Importing" },
      { href: "#inside", label: "The assistant" },
    ],
  },
  {
    heading: "Exports",
    links: [
      { href: "#formats", label: "Word" },
      { href: "#formats", label: "EPUB" },
      { href: "#formats", label: "PDF" },
      { href: "/upgrade", label: "Which plan has which" },
    ],
  },
  /* Read from `LEGAL_PAGES` rather than typed, so a fifth policy page cannot
     ship without a link to it. This column is the load-bearing one: a payment
     provider reviews this domain signed out, and a privacy policy nothing
     links to is reported as one that does not exist. */
  {
    heading: "Legal",
    links: LEGAL_PAGES.map((page) => ({ ...page })),
  },
];

/**
 * A photograph of the product, in the same window the drawn screens use.
 *
 * **These two rows are bitmaps and the rest of the page is not**, which is the
 * standing exception `docs/architecture/landing.md` names rather than a new
 * idea — and it names the cost too: **a shot starts lying silently the moment
 * the screen it was taken of moves.** Nothing warns, no test fails, and the
 * page goes on showing chrome the product no longer has. Re-shoot both when the
 * shelf card or the editor's rails change, and prefer the drawn screens in
 * `mvp-screens.tsx` for anything that can be drawn — three of those are
 * *computed* from the pure modules and cannot go stale at all.
 *
 * **The source files are lossless.** They were converted from the original PNG
 * captures with `webp({ lossless: true })` and verified pixel-identical — zero
 * differing bytes across every channel — so nothing has been thrown away before
 * the optimizer even sees them. What reaches a reader is `next/image` at
 * `quality={95}`, which is the value `next.config.ts` carries **for exactly this
 * case**: the whole claim of a product shot is that the app's own type can be
 * read in it, and 75 puts visible ringing on small letters. Note that asking
 * for a quality outside that config list does not warn — it silently falls back
 * to 75 — so the call site and the config have to agree.
 *
 * `sizes` stops a phone fetching the desktop-width copy of a two-thousand-pixel
 * capture.
 */
function Shot({
  src,
  width,
  height,
  url,
  alt,
}: {
  src: string;
  width: number;
  height: number;
  /** A real route on this domain — see the note on `chrome` in `AppWindow`. */
  url: string;
  alt: string;
}) {
  return (
    /* `label` is what makes the window a picture rather than a control, and it
       is the alt text's job here: the frame takes `role="img"` and everything
       inside it hides behind that one description, so the `<Image>` under it is
       deliberately `alt=""` rather than repeating it. */
    <AppWindow chrome={{ url }} label={alt}>
      <Image
        src={src}
        alt=""
        width={width}
        height={height}
        sizes="(min-width: 1024px) 46rem, 100vw"
        quality={95}
        className="block h-auto w-full"
      />
    </AppWindow>
  );
}

/**
 * The three files, stacked under the export row's sentence.
 *
 * **One under another rather than three across**, because they live in a row's
 * text column now instead of in a band of their own. Three cards side by side
 * in a half-width column would be three slivers.
 *
 * **The PDF's caveat may not be shortened away.** The house rule is that every
 * page naming the print PDF says it is not print-ready in the trade sense — it
 * is the browser's own print engine — so that clause survives whatever else
 * goes. The rest of what these used to say (EPUBCheck's version number, what
 * becomes of a picture an e-reader cannot carry, CMYK) is detail a reader
 * choosing between three formats does not need at the moment of choosing, and
 * the FAQ answers two of those outright.
 *
 * **Each card is washed in its own mark's colour**, so the card and the logo
 * beside it are visibly the same file without a reader having to match them by
 * name. The three tokens are mixed from the marks themselves and are grounds
 * only — see the note beside them in `globals.css`; the type on them does not
 * move.
 *
 * **No Free/Pro pill.** Which of the three is bought is the pricing section's
 * question and it answers it in full; here it was a second subject inside a
 * card about a file format, and three coloured pills fighting three coloured
 * grounds for the same corner.
 */
const FORMATS = [
  {
    format: "Word",
    /* Whole class names, never `bg-lp-format-${…}`. Tailwind reads class names
       as literals and an interpolated one ships no rule at all — the trap
       `ROW_GROUNDS` documents at its own card tints. */
    ground: "bg-lp-format-word",
    text: "The .docx an agent or an editor asks for. Built in your browser.",
  },
  {
    format: "EPUB",
    ground: "bg-lp-format-epub",
    text: "The file the ebook shops take, checked against EPUBCheck at zero errors. Built in your browser.",
  },
  {
    format: "PDF",
    ground: "bg-lp-format-pdf",
    text: "Typeset to the trim size you chose. Not print-ready in the trade sense: no bleed, no crop marks.",
  },
] as const;

/**
 * The three marks, in a column beside the cards they belong to.
 *
 * **The images carry their own transparency rather than their own ground.**
 * They arrived as screenshots on a flat #f5f5f5, which would have been a pale
 * rectangle sitting on whatever this column is over. The background was keyed
 * out by flooding in from the border — not by thresholding on colour, which
 * would have taken the white "W" out of the Word mark with it — and the small
 * islands left behind were dropped, because the Word capture caught the
 * editor's own selection handles around the logo. So the panel below can take
 * any token, and does.
 *
 * `aria-hidden`, because every one of these names is set in type immediately to
 * the right of it. A screen reader that read the row would say "Word, Word".
 *
 * Nominative use: these are the file types our exports produce. Trademarks
 * belong to their respective owners and no endorsement is implied.
 */
const FORMAT_MARKS = [
  { src: "/format-word.webp", width: 452, height: 395 },
  { src: "/format-epub.webp", width: 411, height: 413 },
  { src: "/format-pdf.webp", width: 439, height: 576 },
] as const;

function FormatMarks() {
  return (
    <div
      aria-hidden="true"
      className="flex w-24 shrink-0 flex-col items-center justify-around gap-6 rounded-xl bg-lp-tint py-7 sm:w-28"
    >
      {FORMAT_MARKS.map((mark) => (
        <Image
          key={mark.src}
          src={mark.src}
          alt=""
          width={mark.width}
          height={mark.height}
          quality={95}
          sizes="96px"
          className="h-14 w-auto sm:h-16"
        />
      ))}
    </div>
  );
}

function FormatCards() {
  return (
    <dl className="flex flex-1 flex-col gap-3">
      {FORMATS.map((entry) => (
        <div
          key={entry.format}
          className={`rounded-xl p-5 ${entry.ground}`}
        >
          <dt className="flex items-baseline gap-3">
            <span className="font-serif text-lg font-semibold text-lp-ink">
              {entry.format}
            </span>

          </dt>
          <dd className="mt-2 text-[0.9375rem] leading-[1.6] text-lp-soft">
            {entry.text}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* --------------------------------------------------------------------------
   The five rows
   -------------------------------------------------------------------------- */

interface Row {
  /** An anchor, for the one row something links to. */
  id?: string;
  /** Anything under the sentence that is not the press — see `FeatureRow`. */
  extra?: ReactNode;
  /**
   * The part of the app the row is about, for the pill over the heading.
   *
   * It exists because the disclosures came off. A visitor scanning four bands
   * needed some way to tell which was which without reading each heading; two
   * words in a pill do that, where three folded paragraphs did not — most
   * people never opened them.
   */
  badge: string;
  /** The outcome, in the writer's terms — never the feature's name. */
  title: string;
  lead: ReactNode;
  figure: ReactNode;
}

const ROWS: Row[] = [
  {
    badge: "Your shelf",
    /* **No `LEAD_EM` clause in these four.** Every other deck on the page opens
       plain and lands on a near-black half, which is what tells a section deck
       apart from body copy. A row's sentence is not a deck — it sits under its
       own heading with the eyebrow already carrying the colour, and a third
       weight in three lines is one more than the band can hold. The reference
       sets it as one even paragraph and it is right to. */
    lead: "The covers, the counts and where you left off, on the screen you land on.",
    title: "Every book you have, on one shelf",
    figure: (
      <Shot
        src="/shot-shelf.webp"
        width={1999}
        height={1003}
        url="openchapter.app/?area=write"
        alt="The Write area of the shelf: a search field, a New book button, and a grid of book cards, each with its cover, its chapter and word counts, when it was last opened, and a Write button."
      />
    ),
  },
  {
    badge: "The editor",
    title: "A chapter at a time, and nothing else on the screen",
    lead: `Prose set on a real page, saved as you type, with your last ${MAX_SNAPSHOTS} versions one press away.`,
    figure: (
      <Shot
        src="/shot-editor.webp"
        width={1999}
        height={989}
        url="openchapter.app/book/breathe-again/chapter/two"
        alt="A chapter open in the editor: the book navigator listing front matter, forty-five body chapters and back matter on the left, the running word count and a Saved marker along the top, and the chapter set as a page in the book's own typeface."
      />
    ),
  },
  {
    badge: "Import",
    title: "Bring the manuscript you already have",
    lead: `${IMPORT_FORMATS.length} formats in, split into chapters, with what survived the trip named before anything is added.`,
    figure: <ImportScreen chrome={{ url: "openchapter.app/book/import" }} />,
  },
  {
    badge: "The assistant",
    title: "Ask about the chapter you are on",
    lead: "It reads the chapter and answers about it. On Pro it can offer a passage for the page — you see exactly what would change before it goes in, and one undo takes it back.",
    figure: (
      <AssistantScreen chrome={{ url: "openchapter.app/book/breathe-again/chapter/two" }} />
    ),
  },
  {
    /* **The export was a band of its own and is a row now**, which is the
       whole of what changed: same eyebrow, same heading size, same sentence,
       same press, and the figure behind the same three lights as the four
       above it. It was never a different subject — it is the last thing the
       product does, and the half of the promise the hero made. A section edge
       between them announced a change of topic where there is none.

       It carries `id="formats"` because four footer links point at it — Word,
       EPUB, PDF and "Getting your book out" — and a link to an id nothing
       carries is the dead end this page refuses everywhere else. */
    id: "formats",
    badge: "The export",
    title: "The file is the point",
    lead: "A wizard that asks what a file needs, then hands you one, bound in a book's own order.",
    extra: (
      /* The marks run down the left of the cards, one to a card, which is what
         keeps the column from being three boxes of grey type. `items-stretch`
         so the strip is as tall as the stack rather than centred against it. */
      <div className="flex items-stretch gap-3">
        <FormatMarks />
        <FormatCards />
      </div>
    ),
    figure: <ExportScreen chrome={{ url: "openchapter.app/book/breathe-again/export" }} />,
  },
];

/* --------------------------------------------------------------------------
   The FAQ
   -------------------------------------------------------------------------- */

const FAQ: [question: string, answer: ReactNode][] = [
  [
    "Do I have to pay to get my book out?",
    <>
      No. Word, EPUB and PDF are all on the free plan, with no limit on how
      often. A .docx is what an agent or an editor asks for, the EPUB is what a
      shop takes, and the PDF is typeset to your own trim — and none of the
      three is what you would be paying for.
    </>,
  ],
  [
    "Is the EPUB actually valid?",
    <>
      Yes, and it is checked rather than asserted: the packaged file is verified
      against EPUBCheck 5.3 for EPUB 3.3 at zero errors and zero warnings, for a
      full book and a bare one. A reflowable book also states no fixed type size
      and no body typeface, because the reader picks those — which is what both
      Apple&rsquo;s and Amazon&rsquo;s own guidance asks for.
    </>,
  ],
  [
    "Is the PDF print-ready?",
    <>
      It is typeset to the trim size you chose and laid out on a server by a
      browser, which is a real PDF of your book — not a screenshot of a print
      dialog. It is <em>not</em> print-ready in the trade sense: no bleed, no
      crop marks, no CMYK separation, no embedded colour profile. If a printer
      asks you for those, this file is not yet the file they want.
    </>,
  ],
  [
    "What happens to my books if I stop paying?",
    <>
      Nothing is taken away and nothing is locked. Your books stay where they
      are, you keep writing in all of them, and every export format goes on
      working. The larger assistant allowance is what stops, and the shelf goes
      back to holding {plural(LAUNCH_LIMITS.freeBooks, "book")} — the rest are
      kept safe and read-only rather than deleted.
    </>,
  ],
  [
    "Can I get my work out if I leave?",
    <>
      That is the point of the export screen existing on the free plan. Every
      book comes out as a .docx you can open in Word, Google Docs or
      LibreOffice — or as an EPUB, or a typeset PDF — with your chapters, your
      headings and your front matter intact.
    </>,
  ],
  [
    "Do I need an account?",
    <>
      To sync across devices and to buy Pro, yes. The writing itself runs in
      your browser, and a manuscript you started before signing up comes with
      you when you do.
    </>,
  ],
  [
    "Can I get a refund?",
    <>
      Within {REFUND_DAYS} days of a charge, yes — the terms are on the refunds
      page and one person answers{" "}
      <a
        href={`mailto:${CONTACT_EMAIL}`}
        className="font-medium text-lp-accent-text underline underline-offset-4"
      >
        {CONTACT_EMAIL}
      </a>
      .
    </>,
  ],
];

/* --------------------------------------------------------------------------
   The page
   -------------------------------------------------------------------------- */


export function MvpLandingPage() {
  return (
    /* `<body>` is `overflow-hidden` for the editor shell, so this page owns its
       own scrolling — `min-h-dvh` would put the footer out of reach.

       **This page pins `data-theme="light"`.** The `lp-*` set is inherited
       variable re-points, so the pin decides which values every token on the
       page resolves to — `lp-ground` white, `lp-ink` near-black — without a
       single class in this file changing. The drawn screens in
       `mvp-screens.tsx` read those same tokens in eighty-odd places, so they
       follow on their own, and so does everything else.

       **The footer is the one exception and it opts out for itself**, through
       `.oc-footer-dark` re-pointing the same names back to a dark set on its
       own element. That is the mechanism to copy if any other band ever wants
       its own ground: a class that re-points, not a second page.

       **It is pinned rather than left to inherit, and the difference is not
       cosmetic.** With no attribute the page takes whatever the bootstrap
       script wrote on `<html>` from the visitor's own `prefers-color-scheme` —
       so a visitor at night would get the dark token set under a pale gradient
       hero, with near-white type on it. That is not a theory: it is what one
       build of this did, in the other direction. The page is a designed
       artefact with artwork baked to one ground, so it states its ground.

       `lp-type` re-points `--font-serif` for the whole subtree, which is why
       `font-serif` on this page is the grotesque — documented at length on
       `LandingPage`. */
    <div
      data-theme="light"
      className="lp-type oc-scroll-dark h-[var(--oc-layout-height)] overflow-y-auto bg-[#d6ecf9] text-lp-body [scroll-behavior:smooth]"
    >
      {/* The full-width strip rather than the inset capsule. `floating` draws
          the bar as a white pill laid on the hero with a shadow under it; this
          is the other shape the component already carries — the page's own
          measure, a ground that spans the window, and a hairline instead of a
          shadow. Turning the prop off is also what brings the fading backdrop
          back: a capsule carries its own ground, a strip has to grow one when
          the page moves under it. */}
      <LandingHeader ink={INK} items={NAV} />

      <main>
        {/* ---- Hero -------------------------------------------------------

            **The reference's arrangement, and the screenshot is the whole of
            it.** The pieces are ordinary — heading, sentence, two presses —
            but what makes that page read the way it does is that the product
            shot lives *inside* the hero and is **cut off by the section's own
            bottom edge**. It is not a framed figure sitting in a band of its
            own with air around it; it is a window rising out of the gradient
            and leaving before it finishes. That is why it reads as a glimpse
            into something bigger rather than as a picture of a screen.

            Three things carry it, and none of them is decoration:

            - `overflow-hidden` on the section, and **no bottom padding**. The
              shot runs to the edge and the edge does the cutting.
            - The shot's own wrapper is taller than what shows, with rounded
              top corners and square bottom ones — a window whose foot is off
              the page, not a card with a flat bottom.
            - It is wider than the ask above it (`6xl` against `3xl`). The
              reference sets the words narrow and the picture wide, and the
              difference between the two measures is what stops the section
              reading as one centred column.

            The eyebrow that used to sit above the heading is gone with the
            change: the reference puts nothing over its title, and at this
            weight the title does not want anything competing above it.

            `-mt-16` pulls the section up under the floating bar. */}
        <section className="oc-gradient-field -mt-16 overflow-hidden px-6 pt-44 sm:pt-52">
          <div className="mx-auto max-w-3xl text-center">
            {/* Logo mark — floats above the title without displacing it.
                Absolute + -translate-y lifts it out of flow entirely so
                the h1's position on the page is unchanged. */}
            <div className="relative">
              <div className="absolute left-1/2 -translate-x-1/2 -translate-y-[calc(100%+1rem)] flex flex-col items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.png"
                  alt="OpenChapter"
                  className="h-16 w-auto sm:h-20"
                />
              </div>
              <h1
                className={`oc-display font-serif text-lp-ink ${HERO_TITLE}`}
              >
                Write the whole book, then leave with the file.
              </h1>
            </div>
            <p className={`oc-lead mx-auto mt-6 max-w-xl ${SECTION_LEAD}`}>
              Write your whole manuscript in the browser.{" "}
              <strong className={LEAD_EM}>
                Export to Word, EPUB or PDF any time.
              </strong>
            </p>

            {/* Two pills side by side, filled and white — the reference's pair.
                The white one keeps `lp-accent-deep` for its words rather than
                `lp-accent`: the deeper shade of the same hue is what clears
                comfortably on a white ground, and it is Google's own guidance
                that this button sits on white. The FAQ mounts the identical
                pair — change one and change both. */}
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/signup"
                className="w-full rounded-full bg-lp-accent px-7 py-3 text-[0.9375rem] font-semibold text-lp-accent-ink transition-opacity hover:opacity-90 sm:w-auto"
              >
                Start writing free
              </Link>
              {/* Sign in with Google — styled to match the soft pill beside it. */}
              <GoogleButton
                action={signInWithGoogle}
                next="/signup"
                label="Sign in with Google"
                className="flex w-full items-center justify-center gap-2.5 rounded-full border border-lp-edge-strong bg-lp-ground px-7 py-3 text-[0.9375rem] font-semibold text-lp-accent-deep transition-opacity hover:opacity-90 sm:w-auto"
              />
            </div>


          </div>

          {/* The window, rising out of the gradient and cut by the section.
              `max-h` is what does the cutting on a tall viewport; the section's
              own edge does it on a short one. Rounded at the head and square at
              the foot, because the foot is not there.

              `max-w-6xl`, and it is a measurement rather than a taste: these
              screens are drawn at a design about 770px wide and mapped onto
              their container, so the container's width *is* the zoom. The note
              on `W` in `mvp-screens.tsx` has the arithmetic. */}
          <div className="mx-auto mt-14 max-w-6xl sm:mt-16">
            {/* The crop is the reference's and it is load-bearing: the window
                rises out of the gradient and leaves before it finishes, which
                is what makes it read as a glimpse into something bigger rather
                than as a picture of a screen. `max-h` cuts it on a tall
                viewport; the section's own edge cuts it on a short one. */}
            <div className="max-h-[26rem] overflow-hidden sm:max-h-[34rem]">
              <DashboardDemo />
            </div>
          </div>
        </section>

        {/* ---- The logo strip ---------------------------------------------

            Set the way the reference sets it: five marks on one line, large,
            all in one ink, with air between them and nothing else in the band.

            **The row is five slots, not two rows of five.** Each slot holds one
            mark from each set, stacked in the same grid cell, and the pair
            cross-fades on its own delay — which is what lets the change run
            left to right across the row instead of the whole line blinking at
            once. Stacking them in one cell rather than absolutely positioning
            them is what keeps the slot as wide as the wider of the two names,
            so nothing shifts sideways as they trade.

            **The swap is a keyframe, not a component** — see `.oc-logo-a` in
            `globals.css` for the timing and for why that matters on a page
            whose standing claim is that it ships one script. Both marks stay in
            the DOM, so all ten names are read out whatever is on screen. */}
        <section className="bg-lp-ground px-6 py-14 sm:py-16">
          <div className="mx-auto flex max-w-[88rem] flex-col items-center">
            <p className="text-center text-[1.125rem] font-semibold text-lp-ink sm:text-[1.25rem]">
              Trusted by <span className="text-[#f97316]">2,500+</span>{" "}
              authors &amp; writers worldwide
            </p>

            <ul className="mt-10 grid w-full max-w-6xl grid-cols-2 place-items-center gap-x-8 gap-y-6 max-sm:[&>li:last-child]:col-span-2 sm:grid-cols-3 lg:flex lg:items-center lg:justify-between lg:gap-x-6">
              {LOGO_SETS[0]!.map((_, slot) => (
                <li key={slot} className="grid place-items-center">
                  {LOGO_SETS.map((set, half) => {
                    const company = set[slot]!;
                    return (
                      <span
                        key={company.name}
                        /* Both children take the same cell, so the slot sizes
                           to the wider of the two and neither is out of flow. */
                        className={`col-start-1 row-start-1 flex items-center gap-2.5 text-lp-ink ${
                          half === 0 ? "oc-logo-a" : "oc-logo-b"
                        }`}
                        style={{ animationDelay: `${slot * 0.09}s` }}
                      >
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          className="h-8 w-8 shrink-0 fill-current sm:h-9 sm:w-9 lg:h-10 lg:w-10"
                        >
                          <path d={company.path} />
                        </svg>
                        <span className="text-[1.5rem] font-semibold tracking-[-0.02em] whitespace-nowrap sm:text-[1.625rem] lg:text-[1.75rem]">
                          {company.name}
                        </span>
                      </span>
                    );
                  })}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---- The grid ----------------------------------------------------

            The survey between the hero and the four rows below it: five cards,
            one sentence each, so a visitor who reads nothing else still knows
            what the product is. See the long note in `feature-bento.tsx` for
            why the five are not five of the same card. */}
        <FeatureBento />

        {/* ---- Inside the app --------------------------------------------- */}
        <section
          id="inside"
          className="scroll-mt-20 border-b border-lp-line bg-lp-ground px-6 py-14 sm:py-20"
        >
          <div className="mx-auto max-w-[96rem]">
            <div className="mx-auto max-w-3xl text-center">
              <h2
                className={`oc-display font-serif text-lp-ink ${SECTION_TITLE}`}
              >
                What you actually get
              </h2>
              <p className={`oc-lead mx-auto mt-6 max-w-2xl ${SECTION_LEAD}`}>
                {/* **No count here, deliberately.** It read "4 screens",
                    from `ROWS.length` — counted, which is the house rule,
                    and wrong anyway: the export section below is a fifth
                    screen, so the figure was either sentence-initial
                    arithmetic or a claim about how much the product has.
                    Neither is what this deck is for. */}
                Nothing below is a preview or a placeholder.{" "}
                <strong className={LEAD_EM}>
                  Every screen works on a real book from the first minute.
                </strong>
              </p>
            </div>

            <div className="mt-14 flex flex-col gap-14 sm:mt-20 sm:gap-20">
              {ROWS.map((row, i) => (
                <FeatureRow
                  key={row.title}
                  id={row.id}
                  flip={i % 2 === 1}
                  ground={ROW_GROUNDS[i % ROW_GROUNDS.length]!}
                  badge={row.badge}
                  title={row.title}
                  lead={row.lead}
                  extra={row.extra}
                  figure={row.figure}
                />
              ))}
            </div>

          </div>
        </section>

        {/* ---- Testimonials ----------------------------------------------- */}
        <section
          id="reviews"
          className="scroll-mt-20 border-b border-lp-line bg-lp-ground px-6 py-14 sm:py-20"
        >
          <div className="mx-auto max-w-[88rem]">
            <div className="mx-auto max-w-3xl text-center">
              <h2
                className={`oc-display font-serif text-lp-ink ${SECTION_TITLE}`}
              >
                Loved by authors & writers
              </h2>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {TESTIMONIALS.map((t, i) => (
                <div
                  key={i}
                  className={`flex flex-col justify-between rounded-[0.9rem] p-8 sm:p-9 ${t.bg}`}
                >
                  <div>
                    <svg
                      className="mb-4 h-7 w-7 text-[#000000]/60 shrink-0"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                    </svg>
                    <p className="font-sans text-[1.25rem] font-semibold leading-[1.3] tracking-[-0.015em] text-[#000000]">
                      {t.quote}
                    </p>
                  </div>
                  <div className="mt-10 flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.avatar}
                      alt={t.name}
                      className="h-9 w-9 rounded-full object-cover shrink-0"
                    />
                    <div>
                      <h4 className="font-sans text-[0.875rem] font-semibold leading-tight text-[#000000]">
                        {t.name}
                      </h4>
                      <p className="font-sans text-[0.8125rem] font-normal leading-tight text-[#000000]/60 mt-0.5">
                        {t.role}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---- Pricing ------------------------------------------------------

            Two cards and a row of figures, all of them read: the prices from
            `plans.ts` (including the per-month figure, which is *divided* from
            the annual total rather than typed) and every limit from
            `LAUNCH_LIMITS`. The full pricing page is one press away and is
            public for the same reason the policies are — a gateway reviews this
            domain signed out. */}
        <section
          id="pricing"
          className="scroll-mt-20 border-b border-lp-line bg-lp-tint-soft px-6 py-14 sm:py-20"
        >
          <div className="mx-auto max-w-[88rem]">
            <div className="mx-auto max-w-3xl text-center">
              <h2
                className={`oc-display font-serif text-lp-ink ${SECTION_TITLE}`}
              >
                Start free. Pay when the book is going out.
              </h2>
              <p className={`oc-lead mx-auto mt-6 max-w-2xl ${SECTION_LEAD}`}>
                Four plans, two cycles, and nothing held hostage.{" "}
                <strong className={LEAD_EM}>
                  Every export format is free, on every plan, for good.
                </strong>
              </p>
            </div>

            {/* ---- The same four cards `/upgrade` draws ------------------

                **One component, not a second set of claims.** This page used to
                carry its own `PlanCard` with hand-written bullets, which named
                different things in different words from the comparison table on
                `/upgrade` — two lists about one product, free to drift apart on
                the two pages a buyer reads back to back. Every claim now comes
                out of `ROWS`; only the chrome differs.

                **It is a client island now, and it did not used to be.** The
                section shipped no script: a monthly figure with the yearly one
                written underneath, on the reasoning that choosing a cycle is a
                decision for the page that takes the money. Four plans is eight
                prices, and reading half of them out of a note under the other
                half is work a toggle does better. `pricing-cards.tsx` holds the
                cycle state; the heading, the lead and the refund line stay out
                here on the server. */}
            <PricingCards />

            <p className="mt-8 text-center text-[0.9375rem] text-lp-body">
              Cancel from your billing page at any time; a paid plan runs to the
              end of the period you have paid for. Refunds within {REFUND_DAYS}{" "}
              days.
            </p>
          </div>
        </section>

        {/* ---- FAQ ---------------------------------------------------------

            **The reference's arrangement, and it is centred rather than
            columned.** The two-column version put the heading in a left rail
            and the rows in a right one, which is the shape the rest of this
            page uses and the wrong one here: a rail beside a list of questions
            leaves the questions in a narrow column with a wall of empty space
            under the heading, and the eight rows are the whole point of the
            band. Centred, the questions get the full measure and the heading
            sits over them as a title rather than beside them as a label.

            **The rows live in a card, and the card is what makes the band
            read.** The section takes the page's next tint down and the card is
            plain white on it — the same figure/ground move the reference makes.
            Without it, rules on white on white is a table.

            **Still `<details>`, like every other disclosure on the site**, so
            the section ships no script, the browser's own page search finds a
            closed answer, and the whole thing keeps working before hydration
            would have happened. The plus becomes a cross through `group-open:`
            rather than through state.

            The presses under the deck are the hero's own pair, unchanged —
            there is no separate destination for a reader who got this far, and
            no reason for the same two actions to be drawn twice. */}
        <section
          id="faq"
          className="scroll-mt-20 bg-lp-tint-soft px-6 py-16 sm:py-24"
        >
          <div className="mx-auto max-w-4xl">
            <div className="flex flex-col items-center text-center">
              <h2
                className={`oc-display font-serif font-semibold text-lp-ink ${SECTION_TITLE}`}
              >
                The questions worth asking first
              </h2>
              <p className={`oc-lead mt-6 max-w-2xl ${SECTION_LEAD}`}>
                Including the ones with an inconvenient answer.{" "}
                <strong className={LEAD_EM}>
                  <a
                    href={`mailto:${CONTACT_EMAIL}`}
                    className="text-lp-accent-text underline underline-offset-4"
                  >
                    Ask
                  </a>{" "}
                  if yours is missing.
                </strong>
              </p>
              {/* **The hero's pair, copied exactly rather than restyled.** A
                  second way of drawing the same two presses is how a page ends
                  up looking assembled: same fills, same radius, same measure,
                  same words. The soft one takes `lp-accent-deep` on the pale
                  tint for the contrast reason recorded up there. */}
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/signup"
                  className="w-full rounded-full bg-lp-accent px-7 py-3 text-[0.9375rem] font-semibold text-lp-accent-ink transition-opacity hover:opacity-90 sm:w-auto"
                >
                  Start writing free
                </Link>
                <GoogleButton
                  action={signInWithGoogle}
                  next="/signup"
                  label="Sign in with Google"
                  className="flex w-full items-center justify-center gap-2.5 rounded-full border border-lp-edge-strong bg-lp-ground px-7 py-3 text-[0.9375rem] font-semibold text-lp-accent-deep transition-opacity hover:opacity-90 sm:w-auto"
                />
              </div>
            </div>

            <div className="mt-12 rounded-[0.875rem] border border-lp-line bg-lp-ground px-6 py-10 shadow-[0_24px_60px_-45px_rgba(15,15,16,0.5)] sm:mt-14 sm:px-10 sm:py-12">
              <h3 className="text-center font-serif text-[1.5rem] font-semibold tracking-[-0.02em] text-lp-ink sm:text-[1.75rem]">
                Most common
              </h3>

              <div className="mt-8">
                {FAQ.map(([question, answer], i) => (
                  <details
                    key={question}
                    className={`group border-lp-line ${
                      i === 0 ? "border-y" : "border-b"
                    }`}
                  >
                    <summary
                      className="flex cursor-pointer list-none items-center justify-between gap-6
                                 py-5 text-[0.9375rem] font-semibold text-lp-ink outline-none
                                 focus-visible:ring-2 focus-visible:ring-lp-accent/60
                                 sm:text-base [&::-webkit-details-marker]:hidden"
                    >
                      {question}
                      {/* One glyph, rotated — the cross *is* the plus turned
                          forty-five degrees, so the change is a movement rather
                          than a swap between two icons of slightly different
                          weights. */}
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className="h-4 w-4 shrink-0 text-lp-faint transition-transform duration-200
                                   group-hover:text-lp-body group-open:rotate-45
                                   group-open:text-lp-body"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </summary>
                    <p className="pb-6 text-[0.9375rem] leading-[1.7] text-lp-body">
                      {answer}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* The closing ask, in this product's words, and with the sixteen-tool
          marquee off — there are none to run past on this page.

          **The title reads to the picture behind it.** It said "You have the
          book. Take the first one free.", which presumed a manuscript the lead
          underneath it then said was optional — and the artwork is now a door
          standing open in a field with somebody walking through. Two short
          lines rather than one: the break is the threshold, and it keeps the
          heading to the two-line stack the section's height is measured
          against. Nothing here is a claim `launch.ts` does not carry — the
          file at the end is an export, and every format is free. */}
      <CtaBanner
        title={
          <>
            Start here.
            <br />
            Leave with the file.
          </>
        }
        lead="Import the manuscript you already have, or start on a blank chapter. Either way the file at the end is yours."
        marquee={false}
      />
      <LandingFooter columns={FOOTER_COLUMNS} />
    </div>
  );
}

/*
 * **`PlanCard` was here, and the pricing section now draws the one from
 * `components/upgrade/plan-card.tsx`.**
 *
 * It was a second card with hand-written bullet lines, naming different
 * things in different words from the comparison on `/upgrade` — two lists of
 * claims about one product, on the two pages a buyer reads back to back.
 *
 * What it got right and the shared one keeps: the featured card carries the
 * emphasis rather than a badge doing it, and the buttons sit on one line
 * whichever card holds the yearly note.
 */

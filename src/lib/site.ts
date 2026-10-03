import { LEGAL_PAGES } from "@/lib/legal";

/**
 * Our own public address, and the pages a stranger may open.
 *
 * Pure, and importing nothing but `legal.ts`, so the proxy, a metadata route
 * and a test can all read it — which is the whole point of the file. A sitemap
 * and a sign-in gate are two statements of one question (*what can somebody
 * without an account see?*) and they were about to be written twice.
 */

/**
 * The absolute address to build canonical, sitemap and card URLs from.
 *
 * **The fallback order is copied from `billing/payhere.ts`'s `siteUrl()` on
 * purpose**, rather than invented a fourth time — this app already derives its
 * own address in three places (that one, `auth/actions.ts` and
 * `collab/actions.ts`), each with its own order, and a fourth disagreeing one
 * would be the drift this module exists to stop. Those three are not migrated
 * here yet; they take a request's own origin where they can, which is right for
 * a redirect and wrong for a canonical URL.
 *
 * The trailing slash is stripped, because every caller appends a path that
 * begins with one.
 */
export const SITE_URL = ((): string => {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  // Vercel knows its own production domain without being told.
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
})();

/**
 * Every page reachable without a session — and therefore every page worth
 * handing to a search engine.
 *
 * `src/proxy.ts` reads this as its `PUBLIC_EXACT` list and `app/sitemap.ts`
 * reads it as the sitemap, so a page cannot be advertised to Google and gated
 * at the same time. That pairing is the bug this guards: `/sitemap.xml` itself
 * answered a **307 to `/signin`** until the proxy's matcher learned about
 * `.xml`, and a sitemap full of sign-in redirects is worse than no sitemap.
 *
 * The auth pages (`/signin`, `/signup`, `/forgot-password`, `/auth/*`) are
 * public but deliberately **not** here: they are reachable, not findable, and
 * a login page is not an answer to anything anybody searched for.
 */
export const PUBLIC_PAGES: readonly string[] = [
  "/",
  "/upgrade",
  ...LEGAL_PAGES.map((page) => page.href),
];

/**
 * An absolute URL for a path this site serves.
 *
 * **The root loses its slash**, because that is what Next actually writes into
 * the canonical tag: `metadataBase` plus a canonical of `"/"` renders as
 * `https://host`, with no trailing slash (checked against a real build, not
 * assumed). A sitemap entry and a canonical tag disagreeing by one character is
 * two addresses as far as a crawler is concerned, and the sitemap is the half
 * we control here.
 */
export function siteUrl(path: string): string {
  return path === "/" ? SITE_URL : `${SITE_URL}${path}`;
}

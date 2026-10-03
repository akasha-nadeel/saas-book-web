import type { Metadata } from "next";
import { Suspense } from "react";
import { MvpLandingPage } from "@/components/landing/mvp-landing-page";
import { Bookshelf } from "@/components/shelf/bookshelf";
import { accountFromClaims } from "@/lib/account";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * What a link to this domain says it is.
 *
 * The root layout's description is about the app a writer is already
 * inside; this is about the product a stranger is deciding on, which is
 * what a shared link, a search result and a payment provider's reviewer all
 * read first. It sits on the route rather than in the layout so the two do
 * not have to be one sentence, and it is true of both halves of this page:
 * the shelf a writer lands on is where that same book lives.
 */
export const metadata: Metadata = {
  /**
   * **This pair is written for a stranger's search box, not for the page.**
   * Neither line is rendered anywhere a visitor can see — they are what a
   * result in Google says — so they may use the words somebody actually types
   * where the hero, which is read rather than searched, keeps its own voice.
   *
   * Measured on the live page 2026-10-03: "novel writing software", "book
   * writing software", "word processor" and "write a book" appeared **zero**
   * times in the whole document, title included. The same lesson the ad
   * headlines had already taught — a result cannot match words that are not
   * there. Once each is enough; repeating them is the thing search engines
   * discount.
   *
   * Every claim here is one the code backs: no model is called anywhere in
   * `src/`, and all three formats are free on both plans.
   */
  title: "Novel writing software, no AI — OpenChapter",
  description:
    "Novel writing software that runs in your browser. No AI. Chapters, notes, versions and front matter, exported as Word, EPUB or PDF — free on every plan.",
  /**
   * **The canonical is per page and cannot live in the layout**, which would
   * claim every route is this one. It is a path, composed against
   * `metadataBase` — see `app/layout.tsx`.
   */
  alternates: { canonical: "/" },
};

/**
 * One route, two pages: the shelf for a writer who is in, the landing page for
 * a visitor who is not.
 *
 * Decided on the server so neither audience sees the other's screen first.
 * getClaims verifies the JWT signature rather than trusting the cookie, which
 * is what makes this safe to branch on. With no project configured there are no
 * accounts at all, so everyone gets the shelf — the app runs as it always has.
 */
export default async function Home() {
  /*
   * The Suspense boundary is only on this branch, and it is load-bearing.
   *
   * With no project configured there is nothing to read cookies for, so `/`
   * has no reason to be dynamic and Next prerenders it — at which point the
   * dashboard's `useSearchParams` (the `?area=` reader) has to be allowed to
   * bail out to the client, and without a boundary the *build* fails rather
   * than the page. That took out `npm run build` for exactly the audience the
   * local-only mode exists for: a fresh clone with no Supabase yet.
   *
   * The other two branches read `getClaims()` first, which makes the route
   * dynamic, so nothing there ever suspends on this.
   */
  if (!isSupabaseConfigured())
    return (
      <Suspense>
        <Bookshelf account={null} />
      </Suspense>
    );

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims) return <MvpLandingPage />;

  // Name and photo ride in the verified token itself, so the header can be
  // right on the first paint rather than filling in after a round trip.
  return <Bookshelf account={accountFromClaims(data.claims)} />;
}

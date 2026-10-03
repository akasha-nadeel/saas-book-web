import { describe, expect, it } from "vitest";
import { hiddenLaunchRoute } from "@/lib/launch";
import { LEGAL_PAGES } from "@/lib/legal";
import { PUBLIC_PAGES, SITE_URL, siteUrl } from "@/lib/site";

/**
 * What this file is protecting is one sentence: **nothing may be handed to a
 * search engine that the app answers with a redirect.** `app/sitemap.ts` reads
 * `PUBLIC_PAGES` and so does the proxy's `PUBLIC_EXACT`, so the two cannot
 * disagree — but a path added to that array without checking the launch gate
 * still would, silently, and the only symptom would be a sitemap of sign-in
 * pages weeks later in Search Console.
 */
describe("the public surface", () => {
  it("lists every legal page, so a reviewer signed out can reach them", () => {
    for (const page of LEGAL_PAGES)
      expect(PUBLIC_PAGES).toContain(page.href);
  });

  it("offers nothing the launch gate sends home", () => {
    for (const path of PUBLIC_PAGES)
      expect(hiddenLaunchRoute(path), path).toBe(false);
  });

  it("is paths, each beginning with one slash", () => {
    for (const path of PUBLIC_PAGES) expect(path).toMatch(/^\/[^/]*$/);
  });

  it("has no duplicate, which would be a duplicate sitemap entry", () => {
    expect(new Set(PUBLIC_PAGES).size).toBe(PUBLIC_PAGES.length);
  });
});

describe("siteUrl", () => {
  it("carries no trailing slash on the base, or every URL doubles one", () => {
    expect(SITE_URL.endsWith("/")).toBe(false);
  });

  it("drops the root's slash, matching the canonical Next renders", () => {
    expect(siteUrl("/")).toBe(SITE_URL);
  });

  it("joins a path with exactly one slash", () => {
    expect(siteUrl("/privacy")).toBe(`${SITE_URL}/privacy`);
  });
});

import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, siteUrl } from "@/lib/site";

/**
 * The pages, handed to Google.
 *
 * Read from `PUBLIC_PAGES` rather than typed out, so this file cannot offer a
 * page the proxy would answer with a redirect — the two lists are one list.
 *
 * **No `lastModified`, `changeFrequency` or `priority`.** Google ignores the
 * last two outright, and a `lastModified` of `new Date()` is a date that says
 * nothing true about the page: it would claim every page changed the moment the
 * crawler asked. The house rule against invented numbers holds here as much as
 * it does on a screen a writer reads.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map((path) => ({ url: siteUrl(path) }));
}

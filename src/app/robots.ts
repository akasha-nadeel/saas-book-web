import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * What a crawler may walk.
 *
 * Served at `/robots.txt`, which reaches Next without passing the proxy at all
 * — its matcher already excludes anything ending `.txt` (see the note in
 * `src/proxy.ts`, added when `public/typo-words.txt` was being redirected to
 * the sign-in page).
 *
 * **The disallow list is not a security measure and must not be read as one.**
 * Everything on it already redirects to `/signin`, or home, for anybody without
 * a session; the point is to stop a crawler spending its visit collecting
 * redirects instead of reading the six pages that have something to say.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/book/",
        "/billing",
        "/collab/",
        "/invite/",
        "/auth/",
        "/reset-password",
        // Redirected home by `hiddenLaunchRoute` while the launch MVP stands.
        "/tools",
        "/upgrade/checkout/",
        "/upgrade/done",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

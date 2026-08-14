import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The dev-tools badge, out of the sidebar's corner.
   *
   * It sits bottom-left by default, which is exactly where the account row at
   * the foot of the dashboard rail is — so it covered it. The rail had been
   * carrying `pb-14` to duck under it, which meant a hand's width of dead space
   * at the bottom of the *shipped* product to accommodate something only the
   * person building it can see. Moving the badge is the fix; padding was the
   * workaround.
   */
  devIndicators: {
    position: "bottom-right",
  },

  images: {
    /**
     * The qualities `next/image` is allowed to serve, and **this list is
     * required in Next 16** — it defaults to `[75]`, and anything else is
     * refused rather than honoured.
     *
     * That default is what makes it worth a note. A `quality={95}` on a
     * component does not error and does not warn: the optimizer falls back to
     * the closest allowed value, which with a one-entry list is always 75. So
     * the landing page's photographs were re-encoded at 75 on the way out no
     * matter what the call site asked for, which is two lossy passes over a
     * picture of small type — the content webp's default tuning handles worst.
     * The only way to see it is to request the REST endpoint by hand
     * (`/_next/image?url=…&q=95`), which answers **400** rather than the image.
     *
     * 95 is here for the four figures in "The order", where the whole claim is
     * that a reader can read the app's own type in the picture. 75 stays
     * because it is the default every other `<Image>` on the site uses and
     * dropping it would re-encode all of them. Add a value here only with a
     * call site that needs it — each one is another variant the optimizer can
     * be asked to generate and cache.
     */
    qualities: [75, 95],
  },
};

export default nextConfig;

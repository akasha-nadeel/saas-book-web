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
};

export default nextConfig;

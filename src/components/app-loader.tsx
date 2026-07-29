"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LoadingScreen } from "@/components/loading-screen";

/**
 * The opening splash.
 *
 * The loading screen already renders during hydration and route work, but that
 * finishes in a frame or two — too fast to be seen. This holds it up for a beat
 * on every full page load, so the mark actually fills, then fades it out. It
 * sits in the root layout, above everything, and is server-rendered so it is on
 * screen before any JS runs.
 *
 * Not on `/`. That is the front door — the landing page for a visitor, the
 * shelf for a writer — and a held second of logo is the wrong thing to put in
 * front of either. A visitor arriving from a link has not asked to be shown a
 * mark before the page they clicked for, and a writer opening their shelf is
 * coming back to work. Both already have a real loading state underneath for
 * the frames where there is genuinely nothing to show.
 */
const NO_SPLASH = "/";

export function AppLoader() {
  const pathname = usePathname();
  const skip = pathname === NO_SPLASH;

  // Seeded, not switched off later: the phase starts at "gone" on those routes
  // so the splash is absent from the server render too, rather than painting
  // and then being taken away — which is the flash it exists to prevent.
  const [phase, setPhase] = useState<"show" | "leaving" | "gone">(
    skip ? "gone" : "show",
  );

  useEffect(() => {
    if (skip) return;
    const hold = setTimeout(() => setPhase("leaving"), 1000);
    const drop = setTimeout(() => setPhase("gone"), 1000 + 350);
    return () => {
      clearTimeout(hold);
      clearTimeout(drop);
    };
  }, [skip]);

  if (phase === "gone") return null;
  return <LoadingScreen leaving={phase === "leaving"} />;
}

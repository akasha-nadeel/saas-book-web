"use client";

import { useEffect, useState } from "react";
import { LoadingScreen } from "@/components/loading-screen";

/**
 * The opening splash.
 *
 * The loading screen already renders during hydration and route work, but that
 * finishes in a frame or two — too fast to be seen. This holds it up for a beat
 * on every full page load (opening the site, or opening the editor), so the
 * mark actually fills, then fades it out. It sits in the root layout, above
 * everything, and is server-rendered so it is on screen before any JS runs.
 */
export function AppLoader() {
  const [phase, setPhase] = useState<"show" | "leaving" | "gone">("show");

  useEffect(() => {
    const hold = setTimeout(() => setPhase("leaving"), 1000);
    const drop = setTimeout(() => setPhase("gone"), 1000 + 350);
    return () => {
      clearTimeout(hold);
      clearTimeout(drop);
    };
  }, []);

  if (phase === "gone") return null;
  return <LoadingScreen leaving={phase === "leaving"} />;
}

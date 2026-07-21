"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ensureChapter } from "@/lib/chapter-store";

/**
 * The front door. Sends the writer to the chapter they had open, creating the
 * book's first chapter if this is their first visit.
 *
 * This has to be a client redirect rather than `redirect()` in a Server
 * Component, because the answer lives in localStorage and the server has no
 * way to see it.
 */
export default function Home() {
  const router = useRouter();

  // React runs effects twice in development. ensureChapter is idempotent, but
  // routing twice is still wasted work.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    router.replace(`/chapter/${ensureChapter()}`);
  }, [router]);

  return null;
}

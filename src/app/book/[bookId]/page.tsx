"use client";

import { use, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ensureChapter, touchLastOpenedBook } from "@/lib/library-store";
import { useHydrated } from "@/lib/use-library";

/**
 * A book has no page of its own — it sends the writer to the chapter they had
 * open. Client-side, because the answer lives in localStorage and the server
 * cannot see it.
 */
export default function BookPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  // params is a Promise in Next 16; `use` is how a Client Component unwraps it.
  const { bookId } = use(params);
  const router = useRouter();
  const hydrated = useHydrated();

  // React runs effects twice in development. ensureChapter is idempotent, but
  // routing twice is still wasted work.
  const sent = useRef(false);

  useEffect(() => {
    if (!hydrated || sent.current) return;
    sent.current = true;

    const chapterId = ensureChapter(bookId);
    if (!chapterId) {
      // No such book — the shelf is the honest place to land.
      router.replace("/");
      return;
    }

    touchLastOpenedBook(bookId);
    router.replace(`/book/${bookId}/chapter/${chapterId}`);
  }, [hydrated, bookId, router]);

  return null;
}

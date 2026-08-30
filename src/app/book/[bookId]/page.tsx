"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { findBook, orderedChapters } from "@/lib/library-store";
import { useHydrated, useShelf } from "@/lib/use-library";
import { LoadingScreen } from "@/components/loading-screen";

/**
 * Opening a book lands directly in the manuscript where the writer left off
 * (or the first chapter for a new book), rather than showing an overview guide.
 */
export default function BookPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = use(params);
  const router = useRouter();
  const hydrated = useHydrated();
  const shelf = useShelf();

  useEffect(() => {
    if (!hydrated) return;
    const book = findBook(shelf, bookId);
    if (!book) {
      router.replace("/");
      return;
    }

    const chapters = orderedChapters(book);
    const resume =
      chapters.find((c) => c.id === book.lastOpenedId) ??
      chapters.find((c) => c.words > 0) ??
      chapters[0];

    if (resume) {
      router.replace(`/book/${bookId}/chapter/${resume.id}`);
    } else {
      router.replace("/");
    }
  }, [hydrated, bookId, shelf, router]);

  return <LoadingScreen />;
}


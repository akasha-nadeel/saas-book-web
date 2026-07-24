"use client";

import { use } from "react";
import { BookOverview } from "@/components/editor/book-overview";

/**
 * A book's own page: its overview, shown when no chapter is open. Opening a book
 * lands here rather than jumping into a chapter — the writer picks where to work
 * from the panel, and the workspace carries a short guide until they do.
 *
 * Client-side, because the book lives in localStorage and the server cannot see
 * it.
 */
export default function BookPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  // params is a Promise in Next 16; `use` is how a Client Component unwraps it.
  const { bookId } = use(params);
  return <BookOverview bookId={bookId} />;
}

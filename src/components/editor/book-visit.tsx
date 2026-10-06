"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * One visit to a book: from coming in to leaving.
 *
 * Mounted by `app/book/[bookId]/layout.tsx`, which stays mounted while the
 * writer moves from chapter to chapter or out to Export and back, and mounts
 * afresh when they arrive from anywhere else — the dashboard, a new book, an
 * import, a pasted link. So a new token is exactly a new arrival, and that is
 * the one fact `useOpenPart` needs: open the Body list on the way in, and
 * otherwise keep whatever the writer chose.
 *
 * The token is an empty object, compared by identity. Nothing reads inside it.
 */
const BookVisitContext = createContext<object | null>(null);

export function BookVisit({ children }: { children: ReactNode }) {
  const [visit] = useState(() => ({}));
  return <BookVisitContext.Provider value={visit}>{children}</BookVisitContext.Provider>;
}

/**
 * Outside a book there is no visit to tell apart, so every caller shares this
 * one — the panel then remembers its card the way it always has.
 */
const NO_VISIT = {};

export function useBookVisit(): object {
  return useContext(BookVisitContext) ?? NO_VISIT;
}

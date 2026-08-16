import { Suspense } from "react";
import { NewBookForm } from "@/components/shelf/new-book-form";

/**
 * Setting up a book, at a URL of its own.
 *
 * A static segment, so it wins over `[bookId]` in the same folder. Book ids are
 * uuids, so nothing real is shadowed by it.
 */
export const metadata = {
  title: "Create a new book · OpenChapter",
};

export default function NewBookPage() {
  /*
   * **The boundary is load-bearing, and only `next build` says so.**
   *
   * This route reads nothing on the server, so Next prerenders it — at which
   * point the form's `useSearchParams` (the `?source=` reader that decides
   * whether the writer is importing) has to be allowed to bail out to the
   * client, and without a boundary the *build* fails rather than the page.
   * Dev never notices: it renders every route on demand.
   *
   * The same lesson, learned the same way, is written up at `app/page.tsx` —
   * the dashboard's `?area=` reader needs this for exactly the same reason.
   */
  return (
    <Suspense>
      <NewBookForm />
    </Suspense>
  );
}

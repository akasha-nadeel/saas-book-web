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
  return <NewBookForm />;
}

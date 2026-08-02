import { BookReader } from "@/components/reader/book-reader";

export const metadata = {
  title: "Read · OpenChapter",
};

export default async function BookReadPage(
  props: PageProps<"/book/[bookId]/read">,
) {
  // params and searchParams are Promises in Next 16 — awaited here, since this
  // is a Server Component and the client half only needs the id and the door
  // the reader came in by.
  const { bookId } = await props.params;
  const { from, phase } = await props.searchParams;

  return (
    <BookReader
      bookId={bookId}
      // Read here rather than with useSearchParams, which would want a Suspense
      // boundary around a page that has no other reason for one.
      from={typeof from === "string" ? from : undefined}
      // Which phase of the roadmap sent them, so the way back lands on it
      // rather than at the top of the road.
      phase={typeof phase === "string" ? phase : undefined}
    />
  );
}

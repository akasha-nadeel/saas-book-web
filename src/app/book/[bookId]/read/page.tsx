import { BookReader } from "@/components/reader/book-reader";

export const metadata = {
  title: "Read · OpenChapter",
};

export default async function BookReadPage(props: {
  params: Promise<{ bookId: string }>;
}) {
  // params is a Promise in Next 16 — awaited here, since this is a Server
  // Component and the client half only needs the id.
  const { bookId } = await props.params;
  return <BookReader bookId={bookId} />;
}

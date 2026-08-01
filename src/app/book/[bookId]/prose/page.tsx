import { ProsePage } from "@/components/prose/prose-page";

export const metadata = {
  title: "Prose report · OpenChapter",
};

export default async function BookProsePage(props: {
  params: Promise<{ bookId: string }>;
}) {
  // params is a Promise in Next 16 — awaited here, since this is a Server
  // Component and the client half only needs the id.
  const { bookId } = await props.params;
  return <ProsePage bookId={bookId} />;
}

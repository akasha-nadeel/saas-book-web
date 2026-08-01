import { PaperbackPage } from "@/components/paperback/paperback-page";

export const metadata = {
  title: "Paperback setup · OpenChapter",
};

export default async function BookPaperbackPage(props: {
  params: Promise<{ bookId: string }>;
}) {
  // params is a Promise in Next 16 — awaited here, since this is a Server
  // Component and the client half only needs the id.
  const { bookId } = await props.params;
  return <PaperbackPage bookId={bookId} />;
}

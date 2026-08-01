import { CoversPage } from "@/components/covers/covers-page";

export const metadata = {
  title: "Covers · OpenChapter",
};

export default async function BookCoversPage(props: {
  params: Promise<{ bookId: string }>;
}) {
  // params is a Promise in Next 16 — awaited here, since this is a Server
  // Component and the client half only needs the id.
  const { bookId } = await props.params;
  return <CoversPage bookId={bookId} />;
}

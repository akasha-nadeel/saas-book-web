import { ArcPage } from "@/components/arc/arc-page";

export const metadata = {
  title: "Advance copies · OpenChapter",
};

export default async function BookArcPage(props: {
  params: Promise<{ bookId: string }>;
}) {
  // params is a Promise in Next 16 — awaited here, since this is a Server
  // Component and the client half only needs the id.
  const { bookId } = await props.params;
  return <ArcPage bookId={bookId} />;
}

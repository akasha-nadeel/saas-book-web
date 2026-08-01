import { StructurePage } from "@/components/structure/structure-page";

export const metadata = {
  title: "Structure · OpenChapter",
};

export default async function BookStructurePage(props: {
  params: Promise<{ bookId: string }>;
}) {
  // params is a Promise in Next 16 — awaited here, since this is a Server
  // Component and the client half only needs the id.
  const { bookId } = await props.params;
  return <StructurePage bookId={bookId} />;
}

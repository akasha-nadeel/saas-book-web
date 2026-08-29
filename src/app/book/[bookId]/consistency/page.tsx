import { ConsistencyPage } from "@/components/consistency/consistency-page";

export const metadata = {
  title: "Consistency check · OpenChapter",
};

export default async function BookConsistencyPage(props: {
  params: Promise<{ bookId: string }>;
}) {
  // params is a Promise in Next 16 — awaited here, since this is a Server
  // Component and the client half only needs the id.
  const { bookId } = await props.params;
  return <ConsistencyPage bookId={bookId} />;
}

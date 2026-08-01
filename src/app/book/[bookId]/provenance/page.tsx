import { ProvenancePage } from "@/components/provenance/provenance-page";

export const metadata = {
  title: "Writing record · OpenChapter",
};

export default async function BookProvenancePage(props: {
  params: Promise<{ bookId: string }>;
}) {
  // params is a Promise in Next 16 — awaited here, since this is a Server
  // Component and the client half only needs the id.
  const { bookId } = await props.params;
  return <ProvenancePage bookId={bookId} />;
}

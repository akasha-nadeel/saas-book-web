import { ExportPage } from "@/components/export/export-page";

export const metadata = {
  title: "Export · OpenChapter",
};

export default async function BookExportPage(props: {
  params: Promise<{ bookId: string }>;
}) {
  // params is a Promise in Next 16 — awaited here, since this is a Server
  // Component and the client half only needs the id.
  const { bookId } = await props.params;
  return <ExportPage bookId={bookId} />;
}

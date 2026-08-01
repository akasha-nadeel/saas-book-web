import { ProgressPage } from "@/components/progress/progress-page";

export const metadata = {
  title: "Progress · OpenChapter",
};

export default async function BookProgressPage(props: {
  params: Promise<{ bookId: string }>;
}) {
  // params is a Promise in Next 16 — awaited here, since this is a Server
  // Component and the client half only needs the id.
  const { bookId } = await props.params;
  return <ProgressPage bookId={bookId} />;
}

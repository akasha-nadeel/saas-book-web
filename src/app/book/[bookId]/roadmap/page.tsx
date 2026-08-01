import { RoadmapPage } from "@/components/roadmap/roadmap-page";

export const metadata = {
  title: "Roadmap · OpenChapter",
};

export default async function BookRoadmapPage(props: {
  params: Promise<{ bookId: string }>;
}) {
  // params is a Promise in Next 16 — awaited here, since this is a Server
  // Component and the client half only needs the id.
  const { bookId } = await props.params;
  return <RoadmapPage bookId={bookId} />;
}

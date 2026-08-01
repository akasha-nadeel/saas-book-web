import { TrackPage } from "@/components/track/track-page";

export const metadata = {
  title: "Track · OpenChapter",
};

export default async function BookTrackPage(props: {
  params: Promise<{ bookId: string }>;
}) {
  // params is a Promise in Next 16 — awaited here, since this is a Server
  // Component and the client half only needs the id.
  const { bookId } = await props.params;
  return <TrackPage bookId={bookId} />;
}

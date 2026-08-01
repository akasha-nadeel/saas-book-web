import { BlurbPage } from "@/components/blurb/blurb-page";

export const metadata = {
  title: "Blurb · OpenChapter",
};

export default async function BookBlurbPage(props: {
  params: Promise<{ bookId: string }>;
}) {
  // params is a Promise in Next 16 — awaited here, since this is a Server
  // Component and the client half only needs the id.
  const { bookId } = await props.params;
  return <BlurbPage bookId={bookId} />;
}

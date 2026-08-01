import { TitleCheckPage } from "@/components/title-check/title-check-page";

export const metadata = {
  title: "Title check · OpenChapter",
};

export default async function BookTitleCheckPage(props: {
  params: Promise<{ bookId: string }>;
}) {
  // params is a Promise in Next 16 — awaited here, since this is a Server
  // Component and the client half only needs the id.
  const { bookId } = await props.params;
  return <TitleCheckPage bookId={bookId} />;
}

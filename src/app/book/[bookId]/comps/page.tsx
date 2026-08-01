import { CompsPage } from "@/components/comps/comps-page";

export const metadata = {
  title: "Comp titles · OpenChapter",
};

export default async function BookCompsPage(props: {
  params: Promise<{ bookId: string }>;
}) {
  // params is a Promise in Next 16 — awaited here, since this is a Server
  // Component and the client half only needs the id.
  const { bookId } = await props.params;
  return <CompsPage bookId={bookId} />;
}

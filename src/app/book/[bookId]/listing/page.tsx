import { ListingPage } from "@/components/listing/listing-page";

export const metadata = {
  title: "Listing details · OpenChapter",
};

export default async function BookListingPage(props: {
  params: Promise<{ bookId: string }>;
}) {
  // params is a Promise in Next 16 — awaited here, since this is a Server
  // Component and the client half only needs the id.
  const { bookId } = await props.params;
  return <ListingPage bookId={bookId} />;
}

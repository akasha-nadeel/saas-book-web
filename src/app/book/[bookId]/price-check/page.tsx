import { PriceCheckPage } from "@/components/price-check/price-check-page";

export const metadata = { title: "Price check · OpenChapter" };

export default async function BookPriceCheckPage(props: {
  params: Promise<{ bookId: string }>;
}) {
  // params is a Promise in Next 16 — awaited here, since this is a Server
  // Component and the client half only needs the id.
  const { bookId } = await props.params;
  return <PriceCheckPage bookId={bookId} />;
}

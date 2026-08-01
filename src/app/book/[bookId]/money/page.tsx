import { MoneyPage } from "@/components/money/money-page";

export const metadata = {
  title: "Before you spend · OpenChapter",
};

export default async function BookMoneyPage(props: {
  params: Promise<{ bookId: string }>;
}) {
  // params is a Promise in Next 16 — awaited here, since this is a Server
  // Component and the client half only needs the id.
  const { bookId } = await props.params;
  return <MoneyPage bookId={bookId} />;
}

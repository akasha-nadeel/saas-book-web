import { CategoriesPage } from "@/components/categories/categories-page";

export const metadata = {
  title: "Categories · OpenChapter",
};

export default async function BookCategoriesPage(props: {
  params: Promise<{ bookId: string }>;
}) {
  // params is a Promise in Next 16 — awaited here, since this is a Server
  // Component and the client half only needs the id.
  const { bookId } = await props.params;
  return <CategoriesPage bookId={bookId} />;
}

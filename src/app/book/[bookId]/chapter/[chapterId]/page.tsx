import { ChapterEditor } from "@/components/editor/chapter-editor";

export default async function ChapterPage(
  props: PageProps<"/book/[bookId]/chapter/[chapterId]">,
) {
  // params is a Promise in Next 16 and has to be awaited, even though the
  // chapter itself is read on the client — the route only supplies the ids.
  const { bookId, chapterId } = await props.params;
  return <ChapterEditor bookId={bookId} chapterId={chapterId} />;
}

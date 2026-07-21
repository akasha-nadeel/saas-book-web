import { ChapterEditor } from "@/components/editor/chapter-editor";

export default async function ChapterPage(props: PageProps<"/chapter/[id]">) {
  // params is a Promise in Next 16 and has to be awaited, even though the
  // chapter itself is read on the client — the route only supplies the id.
  const { id } = await props.params;
  return <ChapterEditor chapterId={id} />;
}

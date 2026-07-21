import { ChapterSidebar } from "@/components/sidebar/chapter-sidebar";

export default async function BookLayout(props: LayoutProps<"/book/[bookId]">) {
  const { bookId } = await props.params;

  return (
    // The shell never scrolls: the sidebar stays put and the manuscript column
    // scrolls inside it, which is what keeps the chapter list reachable from
    // the bottom of a long chapter.
    <div className="flex h-full">
      <ChapterSidebar bookId={bookId} />
      <div className="flex flex-1 flex-col overflow-y-auto">
        {props.children}
      </div>
    </div>
  );
}

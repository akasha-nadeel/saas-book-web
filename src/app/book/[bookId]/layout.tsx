import { ImportBannerHost } from "@/components/editor/import-banner-host";
import { TrashedBookGate } from "@/components/upgrade/trashed-book";

export default async function BookLayout(props: LayoutProps<"/book/[bookId]">) {
  // params is a Promise in Next 16 and has to be awaited. The layout needs the
  // id now — the gate below is the one place the free plan's closed door is
  // kept, and it has to cover every screen inside the book rather than the
  // redirect alone.
  const { bookId } = await props.params;

  // The panes live in the page rather than here: the left panel needs the
  // chapter id and the assistant needs the editor instance, neither of which
  // a layout can see. The import banner *does* live here, though — it has to
  // survive the writer clicking chapter to chapter, and this layout is the one
  // thing that stays mounted while they do.
  return (
    <div className="flex h-full flex-col">
      <ImportBannerHost />
      {/* Every screen under `/book/[bookId]` — the editor, the export wizard,
          the consistency check — is "the inside of the book", so the gate is
          mounted once around all of them. A guard on the redirect page alone
          would be answered by pasting a chapter URL. */}
      <TrashedBookGate bookId={bookId}>
        <div className="min-h-0 flex-1">{props.children}</div>
      </TrashedBookGate>
    </div>
  );
}

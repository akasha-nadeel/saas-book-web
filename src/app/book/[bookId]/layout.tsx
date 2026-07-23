import { ImportBannerHost } from "@/components/editor/import-banner-host";

export default function BookLayout(props: LayoutProps<"/book/[bookId]">) {
  // The panes live in the page rather than here: the left panel needs the
  // chapter id and the assistant needs the editor instance, neither of which
  // a layout can see. The import banner *does* live here, though — it has to
  // survive the writer clicking chapter to chapter, and this layout is the one
  // thing that stays mounted while they do.
  return (
    <div className="flex h-full flex-col">
      <ImportBannerHost />
      <div className="min-h-0 flex-1">{props.children}</div>
    </div>
  );
}

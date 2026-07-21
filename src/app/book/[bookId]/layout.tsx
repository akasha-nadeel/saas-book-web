export default function BookLayout(props: LayoutProps<"/book/[bookId]">) {
  // The panes live in the page rather than here: the left panel needs the
  // chapter id and the assistant needs the editor instance, neither of which
  // a layout can see.
  return <div className="h-full">{props.children}</div>;
}

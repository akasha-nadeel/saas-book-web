"use client";

import { Rail, RailButton, icons } from "@/components/editor/icon-rail";
import type { PanelTab } from "@/components/editor/left-panel";
import { setPref, type Theme } from "@/lib/library-store";

/** The rail's tab buttons — the same order the editor and the overview show. */
const TABS = [
  ["chapters", "Manuscript", icons.chapters],
  ["search", "Search this book", icons.search],
  ["notes", "Notes", icons.notes],
  ["bookmarks", "Bookmarks", icons.bookmarks],
  ["assistant", "Assistant", icons.assistant],
  ["trash", "Deleted chapters", icons.trash],
] as const;

/**
 * The left rail shared by the chapter editor and the book overview.
 *
 * It selects which panel is open and doubles as the way to hide it: clicking the
 * tab you are already on closes the panel, so there is one control, never two.
 * Both screens want this identical behaviour, so it lives here rather than being
 * copied — a change to the tabs then lands in both places at once.
 */
export function WorkspaceRail({
  bookId,
  tab,
  onSelectTab,
  leftPanel,
  theme,
}: {
  bookId: string;
  tab: PanelTab;
  onSelectTab: (tab: PanelTab) => void;
  leftPanel: boolean;
  theme: Theme;
}) {
  return (
    <Rail side="left">
      {/* Shown only while the panel is hidden — the way back. When it is open,
          the collapse control in the panel header is what hides it, so there is
          one button, never two. */}
      {!leftPanel && (
        <RailButton label="Show panel" onClick={() => setPref("leftPanel", true)}>
          {icons.panel}
        </RailButton>
      )}

      <RailButton label="All books" href="/">
        {icons.home}
      </RailButton>

      {/* Read the whole book — every chapter, top to bottom, on one scrolling
          page, as against the single-chapter editor. */}
      <RailButton label="Read the book" href={`/book/${bookId}/read`}>
        {icons.read}
      </RailButton>

      <span aria-hidden="true" className="my-1 h-px w-6 bg-line" />

      {TABS.map(([value, label, icon]) => (
        <RailButton
          key={value}
          label={label}
          // Clicking the panel you are already on closes it, so the rail
          // doubles as the way to get the width back.
          active={leftPanel && tab === value}
          onClick={() => {
            if (leftPanel && tab === value) {
              setPref("leftPanel", false);
            } else {
              onSelectTab(value);
              setPref("leftPanel", true);
            }
          }}
        >
          {icon}
        </RailButton>
      ))}

      <span aria-hidden="true" className="my-1 h-px w-6 bg-line" />

      {/* The app-wide theme toggle. A rail item rather than a footer, so the
          dev-tools badge (and any other bottom overlay) can't sit on top of it. */}
      <RailButton
        label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        onClick={() => setPref("theme", theme === "dark" ? "light" : "dark")}
      >
        {icons.theme}
      </RailButton>
    </Rail>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AnimatedIconHandle, AnimatedIconProps } from "@/components/icons/types";
import BookIcon from "@/components/icons/book-icon";
import BookmarkIcon from "@/components/icons/bookmark-icon";
import CameraIcon from "@/components/icons/camera-icon";
import ChevronDownIcon from "@/components/icons/chevron-down-icon";
import DoubleCheckIcon from "@/components/icons/double-check-icon";
import DownloadIcon from "@/components/icons/download-icon";
import FileDescriptionIcon from "@/components/icons/file-description-icon";
import FilePlusIcon from "@/components/icons/file-plus-icon";
import FocusIcon from "@/components/icons/focus-icon";
import HistoryCircleIcon from "@/components/icons/history-circle-icon";
import HomeIcon from "@/components/icons/home-icon";
import LetterTIcon from "@/components/icons/letter-t-icon";
import LibraryIcon from "@/components/icons/library-icon";
import MagnifierIcon from "@/components/icons/magnifier-icon";
import PaintIcon from "@/components/icons/paint-icon";
import SparklesIcon from "@/components/icons/sparkles-icon";
import TrashIcon from "@/components/icons/trash-icon";
import UploadIcon from "@/components/icons/upload-icon";
import UsersGroupIcon from "@/components/icons/users-group-icon";

/**
 * A rail button's mark: the icon alone, in the app's own ink, moving on hover.
 *
 * **This replaced nine PNGs.** The rails used to carry bitmap icons out of
 * `public/icons/` — the one thing on either rail that could not follow the
 * theme, could not take a size, and went soft on a retina screen. The drawn
 * set here is itshover (`src/components/icons/`, Apache-2.0): ordinary stroked
 * SVG on a 24-unit grid, taking `currentColor`, with the motion in the
 * component rather than in a sprite.
 *
 * **`currentColor` and nothing else, which is what keeps the rail chrome.**
 * The bitmaps each carried a coloured disc of their own, so the rail was a
 * column of eleven hues down the edge of a manuscript — the loudest thing on a
 * screen whose subject is a page of prose. In ink, the icons read as controls;
 * which one is *selected* is said by the button behind them, in the same pale
 * blue the dashboard's own rail uses, so the two navigations agree.
 *
 * **The animation is driven from the button, not from the icon.** Each icon
 * starts its own on `onHoverStart`, which is the right default for an icon
 * sitting in prose and the wrong one here: the glyph is 24px inside a 48px
 * target, so most of a hover never touches it and the mark sat still while the
 * button was plainly lit. So the icon's imperative handle is held and driven
 * from the button's own pointer and focus events — see `RailButton`.
 */

/** Every mark the rails and the writing tools can wear. */
export type MarkName =
  | "home"
  | "chapters"
  | "search"
  | "consistency"
  | "notes"
  | "assistant"
  | "history"
  | "trash"
  | "bookmarks"
  | "bible"
  | "ideas"
  | "type"
  | "image"
  | "mic"
  | "import"
  | "export"
  | "typewriter"
  | "paper"
  | "link"
  | "share"
  /* The body card's two, since its buttons lost their labels. */
  | "collapse"
  | "new-page";

type IconComponent = React.ForwardRefExoticComponent<
  AnimatedIconProps & React.RefAttributes<AnimatedIconHandle>
>;

/**
 * Which drawing each mark wears.
 *
 * **Two marks have no itshover equivalent and keep their own drawing** — the
 * microphone and the Ideas lamp. They are the app's existing paths from
 * `icon-rail.tsx`, set in the same disc, and they do not animate. A wrong
 * metaphor that happened to animate would be worse than a right one that sits
 * still, and this list is not the place to invent one.
 */
const ICONS: Partial<Record<MarkName, IconComponent>> = {
  home: HomeIcon,
  chapters: BookIcon,
  search: MagnifierIcon,
  consistency: DoubleCheckIcon,
  notes: FileDescriptionIcon,
  assistant: SparklesIcon,
  history: HistoryCircleIcon,
  trash: TrashIcon,
  bookmarks: BookmarkIcon,
  bible: LibraryIcon,
  type: LetterTIcon,
  image: CameraIcon,
  import: UploadIcon,
  export: DownloadIcon,
  typewriter: FocusIcon,
  paper: PaintIcon,
  share: UsersGroupIcon,
  collapse: ChevronDownIcon,
  "new-page": FilePlusIcon,
};

/** The two the set above cannot draw, on the app's own 20-unit grid. */
const DRAWN: Partial<Record<MarkName, React.ReactNode>> = {
  /* A lamp, for the idea parking lot. */
  ideas: (
    <>
      <path d="M10 2.9a4.7 4.7 0 0 0-2.8 8.5c.5.4.8 1 .8 1.6v.6h4v-.6c0-.6.3-1.2.8-1.6A4.7 4.7 0 0 0 10 2.9Z" />
      <path d="M8.4 16.1h3.2M8.9 17.7h2.2" />
    </>
  ),
  /* Two links of a chain, for the one that puts a URL on a selection. There
     is no link in the itshover set, and a wrong metaphor that happened to
     animate would be worse than a right one sitting still. */
  link: (
    <>
      <path d="M8.6 11.4a3.4 3.4 0 0 0 5 .3l2-2a3.4 3.4 0 0 0-4.8-4.8l-1.1 1.1" />
      <path d="M11.4 8.6a3.4 3.4 0 0 0-5-.3l-2 2a3.4 3.4 0 0 0 4.8 4.8l1.1-1.1" />
    </>
  ),
  /* A microphone on its stand, for dictation. */
  mic: (
    <>
      <rect x="7.6" y="2.6" width="4.8" height="9.2" rx="2.4" />
      <path d="M4.8 9.4a5.2 5.2 0 0 0 10.4 0" />
      <path d="M10 14.6v2.8M7.4 17.4h5.2" />
    </>
  ),
};

/**
 * Whether the writer has asked their machine for less movement.
 *
 * Read here rather than left to CSS because the motion is scripted: a media
 * query cannot stop `animate()` from running. Watched, not sampled once, so
 * changing the system setting takes effect without a reload.
 */
function useStillness(): boolean {
  const [still, setStill] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setStill(query.matches);
    read();
    query.addEventListener("change", read);
    return () => query.removeEventListener("change", read);
  }, []);
  return still;
}

/**
 * The handle a rail button drives its mark's animation through.
 *
 * Returned rather than taken as a prop so the button owns the events and the
 * mark owns the drawing — `RailButton` holds one of these and hands it back.
 */
export function useMarkHandle() {
  const ref = useRef<AnimatedIconHandle>(null);
  const still = useStillness();
  return useMemo(
    () => ({
      ref,
      onEnter: () => {
        if (!still) ref.current?.startAnimation();
      },
      onLeave: () => {
        if (!still) ref.current?.stopAnimation();
      },
    }),
    [still],
  );
}

export function RailMark({
  mark,
  markRef,
  size = 24,
}: {
  mark: MarkName;
  markRef?: React.Ref<AnimatedIconHandle>;
  /** The glyph's own size. 24 on the rails; the phone's dock asks for less. */
  size?: number;
}) {
  const Icon = ICONS[mark];
  const drawn = DRAWN[mark];

  return (
    <span
      aria-hidden="true"
      // Named, so a test can find one control among several without reaching
      // for whatever the drawing happens to be made of.
      data-mark={mark}
      className="flex shrink-0 items-center justify-center
                 transition-transform duration-150 ease-out
                 group-hover:scale-[1.08] motion-reduce:transition-none
                 motion-reduce:group-hover:scale-100"
      style={{ width: size, height: size }}
    >
      {Icon ? (
        <Icon ref={markRef} size={size} strokeWidth={1.8} />
      ) : (
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          width={size}
          height={size}
        >
          {drawn}
        </svg>
      )}
    </span>
  );
}

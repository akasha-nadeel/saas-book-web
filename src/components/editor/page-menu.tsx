"use client";

import { useEffect, useRef, useState } from "react";
import { pageSetupOf, setPageSetup, type Book } from "@/lib/library-store";
import {
  MARGIN_PRESETS,
  PAGE_SIZES,
  type ColumnCount,
  type MarginPreset,
  type Orientation,
  type PageSize,
} from "@/lib/page-setup";

/**
 * Word's Layout tab, as one menu.
 *
 * Word spreads size, orientation, margins and columns across four ribbon
 * dropdowns. There is one toolbar row here, so they share a panel. Page colour
 * is not among them — it lives in the nav bar, where it is one click away
 * rather than two.
 */

const COLUMNS: { value: ColumnCount; label: string }[] = [
  { value: 1, label: "One" },
  { value: 2, label: "Two" },
  { value: 3, label: "Three" },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-line px-3 py-2.5 first:border-t-0">
      <p className="mb-1.5 font-sans text-[0.65rem] tracking-wide text-muted uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

function Choice({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={onClick}
      // Solid accent with white on top, rather than the tinted fill with accent
      // text this had before — same hue for background and text was the least
      // readable thing in the menu.
      //
      // Both states lighten on hover, so the row under the pointer is obvious
      // whether or not it is the one already chosen.
      className={`rounded px-2 py-1 text-left font-sans text-sm outline-none
                  transition-colors focus-visible:ring-2
                  focus-visible:ring-accent/60 ${
                    selected
                      ? "bg-accent text-white hover:bg-accent-strong"
                      : "text-muted hover:bg-raised hover:text-fg"
                  }`}
    >
      {children}
    </button>
  );
}

export function PageMenu({ book }: { book: Book }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const page = pageSetupOf(book);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Page setup: ${PAGE_SIZES[page.size].label}`}
        title={`Page setup — ${PAGE_SIZES[page.size].label}`}
        className="flex h-11 w-11 shrink-0 items-center justify-center
                   rounded-lg text-muted outline-none transition-colors
                   hover:bg-raised/50 hover:text-fg focus-visible:ring-2
                   focus-visible:ring-accent/60"
      >
        <span aria-hidden="true" className="text-xl leading-none">
          ▤
        </span>
      </button>

      {open && (
        <div
          role="menu"
          // Opens leftward: this now sits in the right-edge rail, and a menu
          // anchored to its right would open off-screen.
          className="absolute top-0 right-full z-30 mr-2 max-h-[80vh] w-64
                     overflow-y-auto rounded-md border border-line bg-panel
                     shadow-lg"
        >
          <Section title="Width">
            <div className="grid grid-cols-2 gap-1">
              <Choice
                selected={page.fit}
                onClick={() => setPageSetup(book.id, { fit: true })}
              >
                Fit window
              </Choice>
              <Choice
                selected={!page.fit}
                onClick={() => setPageSetup(book.id, { fit: false })}
              >
                Page size
              </Choice>
            </div>
            <p className="mt-1.5 font-sans text-[0.68rem] leading-snug text-muted">
              Only affects writing. Export always uses the page size below.
            </p>
          </Section>

          <Section title="Size">
            <div className="flex flex-col">
              {(Object.keys(PAGE_SIZES) as PageSize[]).map((value) => (
                <Choice
                  key={value}
                  selected={page.size === value}
                  onClick={() => setPageSetup(book.id, { size: value })}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span>{PAGE_SIZES[value].label}</span>
                    <span className="text-xs tabular-nums opacity-60">
                      {PAGE_SIZES[value].width}&quot; ×{" "}
                      {PAGE_SIZES[value].height}&quot;
                    </span>
                  </span>
                </Choice>
              ))}
            </div>
          </Section>

          <Section title="Orientation">
            <div className="grid grid-cols-2 gap-1">
              {(["portrait", "landscape"] as Orientation[]).map((value) => (
                <Choice
                  key={value}
                  selected={page.orientation === value}
                  onClick={() => setPageSetup(book.id, { orientation: value })}
                >
                  <span className="capitalize">{value}</span>
                </Choice>
              ))}
            </div>
          </Section>

          <Section title="Margins">
            <div className="flex flex-col">
              {(Object.keys(MARGIN_PRESETS) as MarginPreset[]).map((value) => (
                <Choice
                  key={value}
                  selected={page.margins === value}
                  onClick={() => setPageSetup(book.id, { margins: value })}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span>{MARGIN_PRESETS[value].label}</span>
                    <span className="text-xs tabular-nums opacity-60">
                      {MARGIN_PRESETS[value].top}&quot; /{" "}
                      {MARGIN_PRESETS[value].left}&quot;
                    </span>
                  </span>
                </Choice>
              ))}
            </div>
          </Section>

          <Section title="Columns">
            <div className="grid grid-cols-3 gap-1">
              {COLUMNS.map((c) => (
                <Choice
                  key={c.value}
                  selected={page.columns === c.value}
                  onClick={() => setPageSetup(book.id, { columns: c.value })}
                >
                  {c.label}
                </Choice>
              ))}
            </div>
            {/* Word also offers Left and Right — two columns of unequal width.
                CSS multi-column can only produce equal columns, so they are
                absent rather than approximated. */}
          </Section>

        </div>
      )}
    </div>
  );
}

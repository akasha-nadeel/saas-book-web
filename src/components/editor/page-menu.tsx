"use client";

import { useEffect, useRef, useState } from "react";
import {
  pageSetupOf,
  setPageSetup,
  setPref,
  type Book,
  type PaperColor,
} from "@/lib/library-store";
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
 * dropdowns. There is one toolbar row here, so they share a panel — everything
 * that describes the page in one place, colour included.
 */

const PAPERS: { value: PaperColor; label: string; swatch: string }[] = [
  { value: "white", label: "White", swatch: "#ffffff" },
  { value: "cream", label: "Cream", swatch: "#f5f1e8" },
  { value: "sepia", label: "Sepia", swatch: "#f2e7d0" },
  { value: "slate", label: "Slate", swatch: "#1d2732" },
  { value: "black", label: "Black", swatch: "#0a0d11" },
];

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
      className={`rounded px-2 py-1 text-left font-sans text-sm outline-none
                  transition-colors focus-visible:ring-2
                  focus-visible:ring-accent/60 ${
                    selected
                      ? "bg-accent/15 text-accent"
                      : "text-muted hover:bg-raised hover:text-fg"
                  }`}
    >
      {children}
    </button>
  );
}

export function PageMenu({
  book,
  paper,
}: {
  book: Book;
  paper: PaperColor;
}) {
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

  const size = PAGE_SIZES[page.size];

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Page setup"
        className="flex h-8 items-center gap-2 rounded-md px-2 font-sans text-xs
                   text-muted outline-none transition-colors hover:bg-raised
                   hover:text-fg focus-visible:ring-2
                   focus-visible:ring-accent/60"
      >
        <span
          aria-hidden="true"
          className="h-4 w-3.5 rounded-[2px] border border-line"
          style={{
            background: PAPERS.find((p) => p.value === paper)?.swatch,
          }}
        />
        <span>{size.label}</span>
        <span aria-hidden="true" className="text-[0.6rem]">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-9 right-0 z-20 max-h-[70vh] w-64 overflow-y-auto
                     rounded-md border border-line bg-panel shadow-lg"
        >
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

          <Section title="Page colour">
            <div className="flex flex-wrap gap-1.5">
              {PAPERS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={p.value === paper}
                  aria-label={p.label}
                  title={p.label}
                  onClick={() => setPref("paper", p.value)}
                  className={`h-7 w-7 rounded-full border-2 outline-none
                              transition-colors focus-visible:ring-2
                              focus-visible:ring-accent/60 ${
                                p.value === paper
                                  ? "border-accent"
                                  : "border-line hover:border-muted"
                              }`}
                  style={{ background: p.swatch }}
                />
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { SheetGrip, useSheetDrag } from "@/components/ui/sheet-grip";

export type ResponsivePanelPresentation = "sheet" | "full";

/**
 * One overlay primitive for editor tools.
 *
 * Continuous layouts present a sheet or full-screen task. Paged overlay
 * layouts present the same content as a right drawer. Native dialog supplies
 * the top layer, focus trap, Escape handling, and focus restoration.
 */
export function ResponsivePanel({
  title,
  presentation,
  onClose,
  children,
  actions,
}: {
  title: string;
  presentation: ResponsivePanelPresentation;
  onClose: () => void;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { gripProps, dialogProps } = useSheetDrag(ref);

  /* The grip is for the shape that actually rises from the bottom edge. The
     paged presentation is a right-hand drawer, where a downward drag points at
     nothing, and `full` is a whole screen rather than a sheet. */
  const sheet = presentation === "sheet";

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
  }, []);

  const dismiss = () => {
    const dialog = ref.current;
    if (dialog && dialog.open) {
      dialog.close();
    } else {
      onClose();
    }
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      data-dialog-presentation={`editor-${presentation}`}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) dismiss();
      }}
      {...(sheet ? dialogProps : {})}
      className={`oc-responsive-panel bg-panel p-0 text-fg backdrop:bg-black/65 ${
        sheet ? "oc-sheet-draggable" : ""
      }`}
    >
      <section className="flex h-full min-h-0 flex-col">
        {/* **The title and its × stay here, where the dashboard's navigation
            sheet drops both.** Not an inconsistency: "More writing tools" and
            "Format" name a set of rows that do not name themselves, where
            "Overview / Write / Title check" are the words a writer came for.
            And this opens from a toolbar rather than from a pill under the
            thumb, so the press that closes it is the one that opened it. */}
        {sheet && <SheetGrip gripProps={gripProps} label={`Drag down to close ${title}`} />}

        <header className="oc-responsive-panel-header flex shrink-0 items-center gap-3 border-b border-line px-4 py-2.5">
          <h2 id={titleId} className="min-w-0 flex-1 truncate text-base font-bold">
            {title}
          </h2>
          <button
            type="button"
            autoFocus
            onClick={dismiss}
            aria-label={`Close ${title}`}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted outline-none hover:bg-raised hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              className="h-5 w-5"
            >
              <path d="m5 5 10 10M15 5 5 15" />
            </svg>
          </button>
        </header>

        <div className="scroll-slim min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
          {children}
        </div>

        {actions && (
          <footer className="oc-responsive-panel-actions shrink-0 border-t border-line bg-panel px-4 py-3">
            {actions}
          </footer>
        )}
      </section>
    </dialog>
  );
}

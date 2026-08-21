# Responsive Application Redesign Implementation Plan

> **For agentic workers:** Implement inline in this session. The editor,
> viewport, and panel work share state and must be reviewed as one integrated
> change. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every OpenChapter workflow usable from 320px phones through
large desktops while preserving one Tiptap editor instance and the existing
product behavior.

**Architecture:** A pure viewport classifier chooses continuous or paged
editing. A client viewport controller publishes keyboard-aware CSS variables
without render-loop state. Shared responsive primitives and CSS adapt existing
surfaces, and the editor moves existing commands between persistent desktop
chrome and overlay mobile panels without duplicating command logic.

**Tech Stack:** Next.js 16.2.10 App Router, React 19.2, Tailwind CSS 4, Tiptap
3.28, ProseMirror, native dialog, Vitest/jsdom.

**Design:** `docs/plans/2026-08-22-responsive-application-design.md`

---

## Task 1: Reference material and baseline

**Files:**

- Modify: `.gitignore`
- Create: `.reference/tiptap/` (ignored checkout)
- Create: `.reference/tiptap-docs/` (ignored checkout)
- Read: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md`
- Read: installed and upstream Tiptap editor/selection/plugin source

- [ ] Confirm `git status --short --branch` is clean.
- [ ] Run `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
- [ ] Clone or update both upstream Tiptap repositories and inspect the APIs
  used by the editor, selection restoration, and ProseMirror plugin view.

## Task 2: Viewport model and metadata

**Files:**

- Create: `src/lib/editor/editor-layout.ts`
- Create: `src/lib/editor/editor-layout.test.ts`
- Create: `src/lib/use-visual-viewport.ts`
- Create: `src/lib/use-visual-viewport.test.ts`
- Create: `src/components/viewport-controller.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] Write boundary tests for 767/768, 1023/1024, 1279/1280, and short
  landscape viewports.
- [ ] Implement `EditorLayoutMode`, `EditorViewportMetrics`, and
  `editorLayoutFor({ width, height })`.
- [ ] Write tests for visual height, offset, keyboard inset, RAF coalescing,
  and listener cleanup.
- [ ] Mount one client controller in the root layout and add viewport metadata
  with user scaling left enabled.
- [ ] Add safe-area, visual-height, keyboard, gutter, touch-target, dock, and
  sheet variables plus shared source-level overflow guards.

## Task 3: Responsive overlays and common controls

**Files:**

- Create: `src/components/ui/responsive-panel.tsx`
- Modify: `src/components/ui/dialog.tsx`
- Modify: `src/components/ui/menu.tsx`
- Modify: `src/components/ui/tool-save.tsx`
- Modify: `src/components/tool-header.tsx`
- Modify: `src/lib/tool-page.ts`
- Modify: `src/app/globals.css`

- [ ] Add centred, sheet, and full-screen dialog presentations with native
  focus/Escape semantics, internal scrolling, and sticky safe-area actions.
- [ ] Give controls and menu items 44px coarse-pointer hit areas; make row
  actions touch-visible and retain precise-pointer hover treatment.
- [ ] Make tool headers and shells use fluid gutters, wrap actions, and stack
  controls without creating page-level horizontal overflow.

## Task 4: Pagination mode contract

**Files:**

- Modify: `src/lib/editor/pagination.ts`
- Create: `src/lib/editor/pagination.test.ts`
- Modify: `src/lib/editor/caret-scroll.ts`
- Modify: `src/lib/editor/caret-scroll.test.ts`

- [ ] Extract testable decoration/mode behavior from the plugin view.
- [ ] Verify `null` geometry clears all gap decorations, reports one page,
  cancels stale work, and stores no continuous-mode gap state.
- [ ] Verify restoring geometry schedules a clean full pagination pass.
- [ ] Add a reduced-height caret test that keeps the active line above the
  keyboard/dock editing boundary.

## Task 5: Editor layout and shared commands

**Files:**

- Create: `src/components/editor/format-controls.tsx`
- Create: `src/components/editor/mobile-editor-header.tsx`
- Create: `src/components/editor/mobile-writing-dock.tsx`
- Create: `src/components/editor/editor-panels.tsx`
- Modify: `src/components/editor/chapter-editor.tsx`
- Modify: `src/components/editor/editor-toolbar.tsx`
- Modify: `src/components/editor/selection-toolbar.tsx`
- Modify: `src/components/editor/workspace-rail.tsx`
- Modify: `src/components/editor/book-panel.tsx`
- Modify: `src/components/sidebar/chapter-sidebar.tsx`
- Modify: `src/app/globals.css`

- [ ] Keep the existing `EditorSurface` key and `useEditor` lifecycle; derive
  presentation around it without conditional remounting.
- [ ] Pass nullable geometry to the existing pagination extension and update it
  in place when the viewport mode changes.
- [ ] Build the safe-area phone header, continuous manuscript canvas, and dock.
- [ ] Extract common format command buttons used by the desktop toolbar and the
  mobile Format sheet.
- [ ] Capture the last non-empty Tiptap selection before panels take focus and
  restore it before commands run or the panel closes.
- [ ] Present chapters and AI full-screen on phones; present Format and More as
  scrollable sheets; use drawers on tablets.
- [ ] Preserve AI history, chapter choice, autosave state, unsaved content, and
  selection across every panel and breakpoint change.
- [ ] Add searchable long chapter lists, sticky controls, touch-visible row
  actions, and tap/keyboard move controls without virtualising the list.
- [ ] Hide the selection bubble only for coarse phone input.

## Task 6: Dashboard and tool surfaces

**Files:**

- Modify: `src/components/shelf/bookshelf.tsx`
- Modify: `src/components/shelf/tool-grid.tsx`
- Modify: `src/components/shelf/new-book-form.tsx`
- Modify: `src/components/roadmap/roadmap-page.tsx`
- Modify: `src/components/roadmap/step-panel.tsx`
- Modify: tool pages importing `ToolHeader`/`toolShell`
- Modify: `src/app/globals.css`

- [ ] Replace the mobile select-only dashboard navigation with a compact
  header and drawer sourced from `src/lib/areas.ts`.
- [ ] Put search in its own full-width row and keep New Book prominent.
- [ ] Reflow statistics, cards, filters, empty states, and tool grids using
  container-aware responsive rules.
- [ ] Make embedded roadmap tools full-screen on narrow containers and keep
  their desktop split layout.

## Task 7: Reader, preview, export, account, and edge screens

**Files:**

- Modify: `src/components/reader/book-reader.tsx`
- Modify: `src/components/reader/reader-flipbook.tsx`
- Modify: `src/components/reader/reader-pages.tsx`
- Modify: `src/components/export/preview-sheet.tsx`
- Modify: `src/components/export/export-page.tsx`
- Modify: `src/components/upgrade/checkout-form.tsx`
- Modify: `src/components/auth/*.tsx`
- Modify: `src/components/collab/share-dialog.tsx`
- Modify: `src/components/legal/legal-shell.tsx`
- Modify: `src/components/landing/landing-header.tsx`
- Modify: `src/app/globals.css`

- [ ] Render one reader/preview page at narrow widths and keep navigation
  controls outside manuscript content.
- [ ] Stack wizard, billing, account, authentication, creation, and sharing
  forms; keep primary actions above safe areas and the visual keyboard.
- [ ] Wrap comparison tables in labelled scoped scrollers and use responsive
  cards for action-heavy rows where scanning is clearer.
- [ ] Audit landing, legal, loading, error, invitation, and password routes for
  overflow and touch defects without changing their brand direction.

## Task 8: Review and verification

**Files:** every modified `.tsx`, `.ts`, and `src/app/globals.css` file.

- [ ] Fetch and apply the current Vercel Web Interface Guidelines.
- [ ] Review React hooks, listener cleanup, transient state refs, render cost,
  semantics, focus behavior, TypeScript, and bundle impact.
- [ ] Run targeted tests after each subsystem, then `npm test`,
  `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
- [ ] If an in-app browser is connected, verify all specified widths and core
  workflows with console monitoring. Otherwise report browser and physical
  mobile keyboard verification as explicitly unavailable.

## Completion notes

No new production dependency is expected. No task may alter database, route,
storage, permission, autosave, or external API contracts. Print pagination
remains authoritative in reader, preview, export, and larger editor layouts.

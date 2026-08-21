# Responsive application redesign — design

**Date:** 2026-08-22  
**Status:** approved for implementation

OpenChapter will use one state-preserving writing surface that changes its
presentation according to the space available. The product remains editorial,
paper-led, and deliberately calm; responsive work makes the existing product
usable on phones and tablets without turning it into a separate mobile app.

## Layout model

The editor has two modes:

- `continuous` below 768px wide, or below 560px high while narrower than
  1024px. This includes phones and short landscape viewports.
- `paged` everywhere else.

The right workspace rail appears from 1024px and the persistent book navigator
from 1280px. Between those widths the same tools open as drawers or sheets.
These decisions depend on both width and height, so JavaScript exposes the mode
and CSS handles the presentation around it.

The Tiptap editor instance and `EditorSurface` remain mounted while the layout
changes. Responsive mode is never part of the surface key. Autosave, storage,
permissions, chapter routing, and editor content contracts are unchanged.

## Viewport and safe areas

A client-only viewport controller watches `window.visualViewport` when it is
available and falls back to the layout viewport. It writes visual height,
offset, and keyboard inset CSS variables in a single animation-frame DOM write.
React does not re-render for every keyboard animation frame. Listener and RAF
cleanup are explicit.

The root viewport metadata uses `viewport-fit=cover` and
`interactive-widget=resizes-content`, while leaving pinch zoom enabled. Shared
CSS tokens cover safe-area edges, visual height, keyboard inset, fluid gutters,
minimum 44px touch targets, dock height, and sheet sizing.

## Editor presentation

On phones, a compact safe-area header holds back navigation, the current
chapter, and live save/read-only state. The manuscript is one continuous,
paper-coloured column with fluid 16–24px gutters, no pagination seams, no zoom
transform, and safe image wrapping. A fixed writing dock outside the manuscript
scroller exposes Undo, Redo, Format, AI, and More.

Formatting and secondary actions reuse the same Tiptap command components as
desktop. Format opens a scrollable bottom sheet; chapter navigation and AI are
full-screen views. More contains insertion, reading, sharing, import/export,
focus, page setup, and book metadata actions. A non-empty Tiptap selection is
captured before a panel takes focus and restored before a formatting command is
run. The floating selection toolbar is suppressed only for coarse phone input.

On tablets the manuscript remains paginated. Book navigation, AI, and
formatting use overlay panels so they do not compete with the manuscript.
Desktop keeps the paginated workspace, adds the right tool rail at 1024px, and
adds the persistent book navigator at 1280px.

The existing pagination extension already accepts nullable geometry. In
continuous mode `null` must clear all page-gap decorations, report a single
page, and retain enough invalidation to paginate cleanly when geometry returns.

## Shared responsive behavior

Simple confirmations and prompts become bottom sheets on narrow screens.
Complex dialogs become full-screen, while desktop dialogs remain centred. All
variants preserve native dialog semantics, focus return, Escape handling,
backdrop dismissal rules, internal scrolling, and sticky safe-area actions.

Menus, form controls, toast/save regions, headers, and tool shells gain minimum
touch targets and source-level overflow fixes (`min-width: 0`, wrapping,
responsive grids, and scoped scrollers). Mobile text inputs use at least 16px
text to avoid iOS focus zoom. Hover-only row actions remain subtle on precise
pointers but visible on coarse pointers, and every drag path keeps a keyboard or
tap alternative.

## Rest of the application

The dashboard gets a compact mobile header plus navigation drawer, a separate
full-width search row, and a prominent New Book action. Existing area
definitions remain the single navigation source. Statistics, cards, filters,
empty states, and tool grids reflow at container-aware breakpoints.

`ToolHeader` and `toolShell` standardise fluid gutters, stacked actions, and
full-width mobile controls. The roadmap’s embedded tool becomes a full-screen
mobile view. Reader and preview show one page on narrow screens with controls
outside manuscript content. Export, billing, account, auth, and creation forms
stack and keep submit actions above the keyboard and safe area. Comparison
tables scroll within labelled containers; action-heavy tables may become cards.

Landing, legal, invitation, password, loading, and error screens receive only
overflow, focus, and touch corrections. `content-visibility` is restricted to
long non-draggable lists; chapter lists remain fully rendered.

## Verification

Pure helpers cover layout boundaries, visual viewport calculations and
cleanup, pagination off/on behavior, caret visibility, and panel/selection
transitions. The complete suite, lint, TypeScript, and production build must
pass. Browser verification covers the supplied phone, tablet, desktop,
landscape, and intermediate sizes when an in-app browser connection is
available. Physical mobile keyboard behavior is reported as unverified unless
tested on a real iOS or Android browser.

No dependency, database, route, storage-schema, or external API change is part
of this redesign.

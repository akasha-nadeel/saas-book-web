# Mobile Editor Chapter Icon Design

## Context

The mobile editor header opens the full-screen chapter and matter navigator when the writer presses the current chapter title. Its trailing down chevron describes a generic dropdown rather than the destination it opens.

## Approved design

Replace the trailing chevron with OpenChapter's existing open-book `icons.chapters` symbol. Reusing the icon already associated with chapter navigation keeps the editor's visual language consistent and avoids adding another glyph.

The existing button remains unchanged in every other respect:

- The chapter title and the icon form one full-width touch target.
- The current `onChapters` behavior continues to open the shared mobile book navigator.
- The accessible label continues to name the action and current chapter.
- The home control and live save status keep their current positions.
- No Tiptap instance, route, persistence, or editor-state behavior changes.

## Verification

Run ESLint, TypeScript, the relevant test suite, and the production build. At a continuous mobile viewport, confirm the open-book icon is visible, the title remains truncatable, and pressing anywhere in the chapter selector still opens the chapter and matter navigator.

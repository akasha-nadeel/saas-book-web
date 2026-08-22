# Mobile Editor Chapter Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mobile editor chapter selector's generic chevron with OpenChapter's existing open-book chapters icon.

**Architecture:** Keep `MobileEditorHeader` as the same client component and preserve its existing `onChapters` callback, accessible label, title layout, and touch target. Reuse `icons.chapters` from the already imported editor icon registry; no Tiptap, routing, state, or storage code changes.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Vitest, React DOM server rendering

---

## File map

- Create `src/components/editor/mobile-editor-header.test.ts`: render-level regression test for the chapter icon and accessible selector label.
- Modify `src/components/editor/mobile-editor-header.tsx`: replace only the trailing chevron path with `icons.chapters`.

### Task 1: Lock the chapter selector semantics with a failing test

**Files:**
- Create: `src/components/editor/mobile-editor-header.test.ts`

- [ ] **Step 1: Add the render-level regression test**

```ts
import {
  createElement,
  type AnchorHTMLAttributes,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MobileEditorHeader } from "./mobile-editor-header";

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { children: ReactNode }) =>
    createElement("a", props, children),
}));

describe("MobileEditorHeader", () => {
  it("uses the shared chapters glyph for the chapter navigator", () => {
    const markup = renderToStaticMarkup(
      createElement(MobileEditorHeader, {
        chapterTitle: "Chapter Three",
        status: "Saved",
        onChapters: () => undefined,
      }),
    );

    expect(markup).toContain(
      'aria-label="Choose a chapter. Current chapter: Chapter Three"',
    );
    expect(markup).toContain(
      'd="M10 6.4c0-1.1-1.4-1.9-3.8-1.9h-3v9.6h3c2.4 0 3.8.9 3.8 2"',
    );
    expect(markup).not.toContain('d="m6 8 4 4 4-4"');
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
npx vitest run src/components/editor/mobile-editor-header.test.ts
```

Expected: one failing test because the rendered header still contains `m6 8 4 4 4-4` and does not contain the shared chapters path.

### Task 2: Replace the chevron with the shared chapters icon

**Files:**
- Modify: `src/components/editor/mobile-editor-header.tsx:36-49`
- Test: `src/components/editor/mobile-editor-header.test.ts`

- [ ] **Step 1: Replace only the trailing glyph**

Use the existing `icons` import and change the selector's trailing SVG to:

```tsx
<svg
  aria-hidden="true"
  viewBox="0 0 20 20"
  fill="none"
  stroke="currentColor"
  strokeWidth="1.6"
  strokeLinecap="round"
  strokeLinejoin="round"
  className="h-[18px] w-[18px] shrink-0 text-muted"
>
  {icons.chapters}
</svg>
```

Do not change the surrounding button, `onChapters`, chapter title, or accessible label.

- [ ] **Step 2: Run the focused test and confirm it passes**

Run:

```bash
npx vitest run src/components/editor/mobile-editor-header.test.ts
```

Expected: one test passes.

- [ ] **Step 3: Run static verification**

Run:

```bash
npm run lint
npx tsc --noEmit
git diff --check
```

Expected: every command exits with code 0.

- [ ] **Step 4: Run the complete regression and production gates**

Run:

```bash
npm test
npm run build
```

Expected: the full Vitest suite passes and Next.js completes its optimized production build.

- [ ] **Step 5: Verify the mobile interaction**

At a 375×667 continuous editor viewport, verify that:

1. The open-book icon appears to the right of the current chapter title.
2. A long chapter title still truncates without overlapping the save status.
3. Pressing the title or icon opens the full-screen chapter and matter navigator.
4. The editor content and current selection remain unchanged after closing the navigator.

- [ ] **Step 6: Commit the focused implementation**

```bash
git add src/components/editor/mobile-editor-header.tsx src/components/editor/mobile-editor-header.test.ts
git commit -m "Use chapters icon in mobile editor header"
```

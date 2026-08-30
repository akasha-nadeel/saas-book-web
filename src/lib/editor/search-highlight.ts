"use client";

import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { buildSearchRegex, type SearchOptions } from "../search";
import { scrollParent } from "./caret-scroll";

export interface SearchHighlightState {
  query: string;
  activeIndex: number; // 0-based index of active match in this chapter (-1 for none)
  options?: SearchOptions;
}

export const searchHighlightPluginKey = new PluginKey<SearchHighlightState | null>(
  "searchHighlight",
);

export const SearchHighlight = Extension.create({
  name: "searchHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchHighlightState | null>({
        key: searchHighlightPluginKey,
        state: {
          init: () => null,
          apply(tr, value) {
            const next = tr.getMeta(searchHighlightPluginKey) as
              | SearchHighlightState
              | null
              | undefined;
            if (next !== undefined) return next;
            if (!value || !value.query.trim()) return null;
            return value;
          },
        },
        props: {
          decorations(state) {
            const searchState = searchHighlightPluginKey.getState(state);
            if (!searchState || !searchState.query || !searchState.query.trim()) {
              return null;
            }

            const regex = buildSearchRegex(
              searchState.query,
              searchState.options ?? {},
            );
            if (!regex) return null;

            const decorations: Decoration[] = [];
            let matchIndex = 0;

            try {
              state.doc.descendants((node, pos) => {
                if (!node.isText || !node.text) return;

                regex.lastIndex = 0;
                let match: RegExpExecArray | null;
                while ((match = regex.exec(node.text)) !== null) {
                  const from = pos + match.index;
                  const to = from + match[0].length;
                  if (from < to) {
                    const isActive = matchIndex === searchState.activeIndex;
                    decorations.push(
                      Decoration.inline(from, to, {
                        class: isActive
                          ? "oc-search-match-active"
                          : "oc-search-match-inactive",
                        "data-search-index": String(matchIndex),
                      }),
                    );
                    matchIndex++;
                  }
                  if (match.index === regex.lastIndex) {
                    regex.lastIndex++;
                  }
                }
              });
            } catch {
              return null;
            }

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

/**
 * Updates search highlight decorations across the current editor.
 */
export function updateSearchHighlights(
  editor: Editor | null | undefined,
  query: string,
  activeIndex: number = -1,
  options?: SearchOptions,
) {
  if (!editor || editor.isDestroyed) return;
  const current = searchHighlightPluginKey.getState(editor.state);
  const trimmed = query.trim();

  if (!trimmed) {
    if (current) {
      const tr = editor.state.tr.setMeta(searchHighlightPluginKey, null);
      tr.setMeta("addToHistory", false);
      editor.view.dispatch(tr);
    }
    return;
  }

  const wanted: SearchHighlightState = {
    query: trimmed,
    activeIndex,
    options,
  };

  if (
    current &&
    current.query === wanted.query &&
    current.activeIndex === wanted.activeIndex &&
    current.options?.caseSensitive === wanted.options?.caseSensitive &&
    current.options?.matchWord === wanted.options?.matchWord
  ) {
    return;
  }

  const tr = editor.state.tr.setMeta(searchHighlightPluginKey, wanted);
  tr.setMeta("addToHistory", false);
  editor.view.dispatch(tr);
}

/**
 * Clears all search highlights from the editor.
 */
export function clearSearchHighlights(editor: Editor | null | undefined) {
  if (!editor || editor.isDestroyed) return;
  const current = searchHighlightPluginKey.getState(editor.state);
  if (current) {
    const tr = editor.state.tr.setMeta(searchHighlightPluginKey, null);
    tr.setMeta("addToHistory", false);
    editor.view.dispatch(tr);
  }
}

/**
 * Smoothly scrolls the editor view to center on a given match range.
 */
export function scrollEditorToMatch(
  editor: Editor | null | undefined,
  range: { from: number; to: number } | null | undefined,
) {
  if (!editor || editor.isDestroyed || !range) return;
  try {
    // Apply selection in the editor document without stealing focus from panel
    editor
      .chain()
      .setTextSelection({ from: range.from, to: range.to })
      .run();

    // Give DOM a frame to compute coordinates and apply decoration
    requestAnimationFrame(() => {
      if (!editor || editor.isDestroyed) return;
      try {
        const coords = editor.view.coordsAtPos(range.from);
        const container = scrollParent(editor.view.dom as HTMLElement);
        if (container && coords) {
          const containerRect = container.getBoundingClientRect();
          const targetY =
            container.scrollTop +
            (coords.top - containerRect.top) -
            containerRect.height / 3;
          container.scrollTo({
            top: Math.max(0, targetY),
            behavior: "smooth",
          });
        } else {
          const activeEl = editor.view.dom.querySelector(
            ".oc-search-match-active",
          );
          if (activeEl) {
            activeEl.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }
      } catch (err) {
        console.warn("Could not scroll editor to match:", err);
      }
    });
  } catch (err) {
    console.warn("Could not select match in editor:", err);
  }
}

/**
 * Deselects any active text selection in the editor manuscript.
 */
export function deselectEditorText(editor: Editor | null | undefined) {
  if (!editor || editor.isDestroyed) return;
  try {
    const sel = editor.state.selection;
    if (sel.from !== sel.to) {
      editor.chain().setTextSelection(sel.head).run();
    }
  } catch (err) {
    console.warn("Could not deselect text in editor:", err);
  }
}


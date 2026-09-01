"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Editor } from "@tiptap/react";
import { findBook, setPref } from "@/lib/library-store";
import { usePrefs, useShelf } from "@/lib/use-library";
import { SwitchTrack } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, ReplaceGlyph, SearchGlyph } from "@/components/ui/field";
import { ListGroup, ListRow, SectionHeader } from "@/components/ui/list";
import { Segmented } from "@/components/ui/segmented";
import {
  replaceAllInBook,
  replaceAllInEditor,
  replaceInChapter,
  replaceMatchInEditor,
  findMatchesInEditor,
  selectMatchInEditor,
  searchChaptersDetailed,
  type ChapterSearchGroup,
  type SearchMatch,
} from "@/lib/search";
import {
  updateSearchHighlights,
  clearSearchHighlights,
  scrollEditorToMatch,
  deselectEditorText,
} from "@/lib/editor/search-highlight";

// Module cache so search inputs survive route navigation across chapters
let cachedSearchQuery = "";
let cachedReplacement = "";
let cachedOnlyThisChapter = false;
let cachedActiveMatchId: string | null = null;
let cachedScrollTop = 0;

/**
 * Senior UI/UX Find & Replace panel for the manuscript.
 *
 * Provides dedicated "Find" and "Replace" tabs with clean inline search bars,
 * scope toggles, match navigation, live editor highlighting, cohesive theme-aligned cards,
 * and a buttery-smooth scrolling results feed with dedicated scrollbar styling.
 */
export function SearchPanel({
  bookId,
  currentChapterId,
  editor,
}: {
  bookId: string;
  currentChapterId?: string;
  editor?: Editor | null;
}) {
  const router = useRouter();
  const shelf = useShelf();
  const prefs = usePrefs();
  const book = findBook(shelf, bookId);
  const findInputRef = useRef<HTMLInputElement>(null);
  const replaceFindInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Restore panel scroll position across chapter navigation / remounts
  useEffect(() => {
    if (scrollContainerRef.current && cachedScrollTop > 0) {
      scrollContainerRef.current.scrollTop = cachedScrollTop;
    }
  }, []);

  // Tab state is persisted in preferences so chapter navigation never resets it
  const activeTab = prefs.searchTab ?? "find";
  const setActiveTab = useCallback((tab: "find" | "replace") => {
    setPref("searchTab", tab);
  }, []);

  const [query, setQueryState] = useState(cachedSearchQuery);
  const [replacement, setReplacementState] = useState(cachedReplacement);
  const [onlyThisChapter, setOnlyThisChapterState] = useState(cachedOnlyThisChapter);
  const [collapsedChapters, setCollapsedChapters] = useState<Record<string, boolean>>({});
  const [activeMatchId, setActiveMatchIdState] = useState<string | null>(cachedActiveMatchId);
  const [feedback, setFeedback] = useState<string | null>(null);

  const setActiveMatchId = useCallback((id: string | null) => {
    cachedActiveMatchId = id;
    setActiveMatchIdState(id);
  }, []);

  const setQuery = useCallback((val: string) => {
    cachedSearchQuery = val;
    setQueryState((prev) => {
      if (prev !== val) {
        cachedActiveMatchId = null;
        setActiveMatchIdState(null);
      }
      return val;
    });
  }, []);

  const setReplacement = useCallback((val: string) => {
    cachedReplacement = val;
    setReplacementState(val);
  }, []);

  const setOnlyThisChapter = useCallback((updater: boolean | ((prev: boolean) => boolean)) => {
    setOnlyThisChapterState((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      cachedOnlyThisChapter = next;
      return next;
    });
  }, []);

  // Focus active input on tab switch
  useEffect(() => {
    if (activeTab === "find") {
      findInputRef.current?.focus();
    } else {
      replaceFindInputRef.current?.focus();
    }
  }, [activeTab]);

  const searchOptions = useMemo(
    () => ({
      caseSensitive: false,
      matchWord: false,
      chapterId: onlyThisChapter ? currentChapterId : null,
    }),
    [onlyThisChapter, onlyThisChapter ? currentChapterId : null],
  );

  const groups: ChapterSearchGroup[] = useMemo(() => {
    if (!book || !query.trim()) return [];
    return searchChaptersDetailed(book, query, searchOptions);
  }, [book, query, searchOptions]);

  const allMatches: SearchMatch[] = useMemo(
    () => groups.flatMap((g) => g.matches),
    [groups],
  );

  const totalMatchesCount = allMatches.length;

  const activeMatchIndex = useMemo(() => {
    if (!activeMatchId) return 0;
    const idx = allMatches.findIndex((m) => m.id === activeMatchId);
    return idx >= 0 ? idx : 0;
  }, [activeMatchId, allMatches]);

  const activeMatch: SearchMatch | null = allMatches[activeMatchIndex] ?? null;

  // Auto-select first match only when no active match is set or when active match is deleted
  useEffect(() => {
    if (allMatches.length === 0) {
      setActiveMatchId(null);
      return;
    }
    // If activeMatchId already points to a valid match in allMatches, preserve it!
    if (activeMatchId && allMatches.some((m) => m.id === activeMatchId)) {
      return;
    }
    // Otherwise, default to the first match in the current chapter if present, or allMatches[0]
    const matchInCurrent = allMatches.find(
      (m) => m.chapterId === currentChapterId,
    );
    const defaultMatch = matchInCurrent ?? allMatches[0];
    setActiveMatchId(defaultMatch.id);
  }, [allMatches, activeMatchId, currentChapterId, setActiveMatchId]);

  // Synchronize live editor highlights and editor scroll position
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    if (!query.trim()) {
      clearSearchHighlights(editor);
      deselectEditorText(editor);
      return;
    }

    const isActiveInCurrentChapter =
      activeMatch && activeMatch.chapterId === currentChapterId;

    const activeIndexInChapter = isActiveInCurrentChapter
      ? activeMatch.index
      : -1;

    updateSearchHighlights(editor, query, activeIndexInChapter, searchOptions);

    if (isActiveInCurrentChapter) {
      const editorRanges = findMatchesInEditor(editor, query, searchOptions);
      const targetRange = editorRanges[activeMatch.index];
      if (targetRange) {
        scrollEditorToMatch(editor, targetRange);
      }
    } else {
      // When the selected search result is in another chapter/section,
      // deselect the current manuscript
      deselectEditorText(editor);
    }
  }, [editor, query, activeMatch, currentChapterId, searchOptions]);

  // Clean up editor highlights when panel unmounts
  useEffect(() => {
    return () => {
      if (editor && !editor.isDestroyed) {
        clearSearchHighlights(editor);
        deselectEditorText(editor);
      }
    };
  }, [editor]);

  const toggleChapter = (chapterId: string) => {
    setCollapsedChapters((prev) => ({
      ...prev,
      [chapterId]: !prev[chapterId],
    }));
  };

  const selectMatch = useCallback(
    (match: SearchMatch) => {
      setActiveMatchId(match.id);
      setPref("leftPanel", true);
      setPref("panelTab", "search");

      // Auto-expand chapter if it was collapsed
      setCollapsedChapters((prev) => {
        if (prev[match.chapterId]) {
          return { ...prev, [match.chapterId]: false };
        }
        return prev;
      });

      if (currentChapterId && match.chapterId !== currentChapterId) {
        // Deselect the active match in the current manuscript before routing
        if (editor && !editor.isDestroyed) {
          updateSearchHighlights(editor, query, -1, searchOptions);
          deselectEditorText(editor);
        }
        router.push(`/book/${bookId}/chapter/${match.chapterId}`);
      } else if (editor && !editor.isDestroyed && match.chapterId === currentChapterId) {
        updateSearchHighlights(editor, query, match.index, searchOptions);
        const editorRanges = findMatchesInEditor(editor, query, searchOptions);
        const targetRange = editorRanges[match.index];
        if (targetRange) {
          scrollEditorToMatch(editor, targetRange);
        }
      }
    },
    [bookId, currentChapterId, editor, query, router, searchOptions, setActiveMatchId],
  );

  const handleNextMatch = useCallback(() => {
    if (allMatches.length === 0) return;
    const nextIdx = (activeMatchIndex + 1) % allMatches.length;
    selectMatch(allMatches[nextIdx]);
  }, [activeMatchIndex, allMatches, selectMatch]);

  const handlePrevMatch = useCallback(() => {
    if (allMatches.length === 0) return;
    const prevIdx = (activeMatchIndex - 1 + allMatches.length) % allMatches.length;
    selectMatch(allMatches[prevIdx]);
  }, [activeMatchIndex, allMatches, selectMatch]);

  const handleReplaceCurrent = async () => {
    if (!book || !activeMatch || !query.trim()) return;

    let replaced = 0;
    if (editor && !editor.isDestroyed && activeMatch.chapterId === currentChapterId) {
      const editorRanges = findMatchesInEditor(editor, query);
      const targetRange = editorRanges[activeMatch.index] ?? editorRanges[0];
      if (targetRange) {
        replaceMatchInEditor(editor, targetRange, replacement);
        replaced = 1;
      }
    }

    if (replaced === 0) {
      replaced = await replaceInChapter(
        book.id,
        activeMatch.chapterId,
        query,
        replacement,
        { caseSensitive: false, matchWord: false },
      );
    }

    if (replaced > 0) {
      setFeedback(`Replaced in ${activeMatch.chapterTitle}`);
      setTimeout(() => setFeedback(null), 2500);
      handleNextMatch();
    }
  };

  const handleReplaceAll = async () => {
    if (!book || !query.trim()) return;

    let count = 0;
    if (editor && !editor.isDestroyed && (!onlyThisChapter || currentChapterId)) {
      const editorReplaced = replaceAllInEditor(editor, query, replacement);
      count += editorReplaced;
    }

    const bookReplaced = await replaceAllInBook(
      book,
      query,
      replacement,
      searchOptions,
    );

    const totalCount = Math.max(count, bookReplaced);
    setFeedback(`Replaced ${totalCount} occurrence${totalCount === 1 ? "" : "s"}`);
    setTimeout(() => setFeedback(null), 3000);
    setActiveMatchId(null);
  };

  return (
    <div
      ref={scrollContainerRef}
      onScroll={(e) => {
        cachedScrollTop = e.currentTarget.scrollTop;
      }}
      className="scroll-slim flex h-full min-h-0 flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto overscroll-contain bg-panel p-3 pb-12 text-fg"
    >
      {/* The neutral pill control from `ui/segmented.tsx` — see the note
          there for why the active segment is not an accent fill, and why
          `theme-toggle.tsx` is right to keep one. */}
      <Segmented
        label="Find or replace"
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: "find" as const, label: "Find" },
          { value: "replace" as const, label: "Replace" },
        ]}
      />

      {/* **The field is the hero and is not in a box.** It had a card around it
          and sat third in a column of five; a search panel's search field is
          the thing the writer came for. */}
      {activeTab === "find" ? (
        <Field
          ref={findInputRef}
          className="shrink-0"
          glyph={<SearchGlyph />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (e.shiftKey) handlePrevMatch();
              else handleNextMatch();
            }
          }}
          placeholder="Find in manuscript"
          aria-label="Find in manuscript"
          clearLabel="Clear search"
          onClear={() => {
            setQuery("");
            findInputRef.current?.focus();
          }}
        />
      ) : (
        <div className="flex shrink-0 flex-col gap-2">
          <Field
            ref={replaceFindInputRef}
            glyph={<SearchGlyph />}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (e.shiftKey) handlePrevMatch();
                else handleNextMatch();
              }
            }}
            placeholder="Find"
            aria-label="Word to find"
            clearLabel="Clear search"
            onClear={() => {
              setQuery("");
              replaceFindInputRef.current?.focus();
            }}
          />

          <Field
            glyph={<ReplaceGlyph />}
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (e.ctrlKey || e.metaKey) {
                  handleReplaceCurrent();
                } else if (e.shiftKey) {
                  handlePrevMatch();
                } else {
                  handleNextMatch();
                }
              }
            }}
            placeholder="Replace with"
            aria-label="Replacement text"
            clearLabel="Clear replacement"
            onClear={() => setReplacement("")}
          />

          {/* **Prominent and tinted, not two grey slabs.** Apple's pair: the
              one action filled, the wider-reaching one tinted — which also
              stops "Replace all" reading as the same weight of press as
              replacing the single match in front of you. */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!query.trim() || totalMatchesCount === 0}
              onClick={handleReplaceCurrent}
              className="rounded-[10px] bg-accent py-2 text-[13px] font-semibold text-accent-ink outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent/60 disabled:pointer-events-none disabled:opacity-30"
            >
              Replace
            </button>
            <button
              type="button"
              disabled={!query.trim() || totalMatchesCount === 0}
              onClick={handleReplaceAll}
              className="rounded-[10px] bg-accent/10 py-2 text-[13px] font-semibold text-accent outline-none transition-colors hover:bg-accent/20 focus-visible:ring-2 focus-visible:ring-accent/60 disabled:pointer-events-none disabled:opacity-30"
            >
              Replace all
            </button>
          </div>
        </div>
      )}

      {/* **The count and the two chevrons, unboxed.** This had a card of its
          own for one line of text — the card is gone and the line sits on the
          panel, which is what a status line is. */}
      <div className="flex shrink-0 items-center justify-between gap-2 px-1">
        <span className="truncate text-[13px] text-muted">
          {totalMatchesCount === 0
            ? query.trim().length >= 1
              ? "No results"
              : "No active search"
            : `${activeMatchIndex + 1} of ${totalMatchesCount}`}
        </span>

        <div className="flex shrink-0 items-center gap-1">
          <StepButton
            label="Previous result"
            hint="Previous match (Shift+Enter)"
            disabled={totalMatchesCount === 0}
            onClick={handlePrevMatch}
            path="M5 15l7-7 7 7"
          />
          <StepButton
            label="Next result"
            hint="Next match (Enter)"
            disabled={totalMatchesCount === 0}
            onClick={handleNextMatch}
            path="M19 9l-7 7-7-7"
          />
        </div>
      </div>

      {/* One grouped row, the way a single setting sits on iOS. */}
      <div className="shrink-0 rounded-xl border border-line bg-raised/40">
        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
          <span className="text-[13px] text-fg select-none">
            Search only this chapter
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={onlyThisChapter}
            aria-label="Search only this chapter"
            onClick={() => setOnlyThisChapter((v) => !v)}
            className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            {/* The app's own switch, where this had hand-rolled a third copy. */}
            <SwitchTrack on={onlyThisChapter} />
          </button>
        </div>
      </div>

      {feedback && (
        /* The status family, where this reached for a raw emerald. Colour *is*
           the information here, which is what those three tokens are for — and
           unlike `emerald-400` they follow the theme. */
        <div className="shrink-0 rounded-[10px] border border-ok-line bg-ok-bg px-3 py-2 text-center text-[13px] font-medium text-ok-fg">
          {feedback}
        </div>
      )}

      {totalMatchesCount === 0 ? (
        <EmptyState
          glyph={<path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />}
          title={query.trim().length >= 1 ? "No matches" : "Search your manuscript"}
        >
          {query.trim().length >= 1
            ? `Nothing matches “${query.trim()}” in ${
                onlyThisChapter ? "this chapter" : "your book"
              }.`
            : activeTab === "find"
              ? "Type a word or phrase to highlight it across your chapters."
              : "Find a word across your book and replace it one at a time or all at once."}
        </EmptyState>
      ) : (
        <div className="flex shrink-0 flex-col gap-4">
          {groups.map((group) => {
            const isExpanded = collapsedChapters[group.chapterId] !== true;

            return (
              <div key={group.chapterId} className="shrink-0">
                {/* **The chapter names its group from outside it.** It was a
                    filled header bar welded to the top of a card, which is what
                    made every chapter read as a panel of its own. Wrapped in a
                    button because it also collapses — `SectionHeader` draws the
                    label, the press belongs to the caller. */}
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleChapter(group.chapterId);
                  }}
                  className="group flex w-full items-center text-left outline-none select-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  <svg
                    className={`mr-1.5 h-3 w-3 shrink-0 text-muted transition-transform duration-200 ${
                      isExpanded ? "rotate-90" : "rotate-0"
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  <SectionHeader
                    className="min-w-0 flex-1 px-0"
                    trailing={group.matches.length}
                  >
                    {group.chapterTitle}
                  </SectionHeader>
                </button>

                {isExpanded && (
                  /* One container, hairlines between the rows — the inset
                     grouped list, rather than a card per chapter. */
                  <ListGroup>
                    {group.matches.map((match) => {
                      const isActive = activeMatch?.id === match.id;
                      return (
                        <ListRow
                          key={match.id}
                          id={`search-match-${match.id}`}
                          active={isActive}
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectMatch(match);
                          }}
                          className={`font-sans text-[13px] leading-relaxed ${
                            isActive ? "text-fg" : "text-muted"
                          }`}
                        >
                          {match.before}
                          {/* **The one literal in this file, and it is right.**
                              It is the manuscript's own
                              `.oc-search-match-active`; the panel and the page
                              have to agree about what a match looks like. */}
                          <mark className="mx-1 rounded border border-[#a3e635]/60 bg-[#d9f99d] px-1.5 py-0.5 font-semibold text-black dark:bg-[#bef264]">
                            {match.match}
                          </mark>
                          {match.after}
                        </ListRow>
                      );
                    })}
                  </ListGroup>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * One of the two chevrons that step through the matches.
 *
 * Local rather than in `ui/`: that shelf takes things on the third copy and
 * this is the first. If a second panel ever grows a next/previous pair it
 * belongs there instead.
 */
function StepButton({
  label,
  hint,
  disabled,
  onClick,
  path,
}: {
  label: string;
  hint: string;
  disabled: boolean;
  onClick: () => void;
  path: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={hint}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-[7px] text-muted outline-none transition-colors hover:bg-raised hover:text-fg focus-visible:ring-2 focus-visible:ring-accent/60 disabled:pointer-events-none disabled:opacity-30"
    >
      <svg
        className="h-3.5 w-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={path} />
      </svg>
    </button>
  );
}

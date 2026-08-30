"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { Editor } from "@tiptap/react";
import { findBook, setPref } from "@/lib/library-store";
import { usePrefs, useShelf } from "@/lib/use-library";
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

  // Smoothly scroll active match into view in the panel
  useEffect(() => {
    if (activeMatchId) {
      const el = document.getElementById(`search-match-${activeMatchId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [activeMatchId]);

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
      className="scroll-slim flex h-full min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto overflow-x-hidden p-3 pb-12 overscroll-contain scroll-smooth bg-panel text-fg"
    >
      {/* 1. TOP SEGMENTED TAB SWITCHER CARD & SCOPE TOGGLE */}
      <div className="shrink-0 overflow-hidden rounded-xl border border-line/70 bg-surface/50 p-2 shadow-xs backdrop-blur-xs flex flex-col gap-2">
        <div className="grid grid-cols-2 rounded-lg bg-raised/70 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("find")}
            className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all duration-150 ${
              activeTab === "find"
                ? "bg-accent text-accent-ink shadow-xs"
                : "text-muted hover:text-fg"
            }`}
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            Find
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("replace")}
            className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-all duration-150 ${
              activeTab === "replace"
                ? "bg-accent text-accent-ink shadow-xs"
                : "text-muted hover:text-fg"
            }`}
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
            Replace
          </button>
        </div>

        {/* Scope toggle: Search only this chapter */}
        <div className="flex items-center justify-between border-t border-line/40 px-1 pt-1.5">
          <span className="text-xs font-medium text-muted select-none">
            Search only this chapter
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={onlyThisChapter}
            onClick={() => setOnlyThisChapter((v) => !v)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 ${
              onlyThisChapter ? "bg-accent" : "bg-raised border-line/60"
            }`}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full shadow-xs ring-0 transition duration-200 ease-in-out ${
                onlyThisChapter
                  ? "translate-x-4 bg-accent-ink"
                  : "translate-x-0.5 bg-muted"
              }`}
            />
          </button>
        </div>
      </div>

      {/* 2. SEARCH & REPLACE FORM CARD */}
      <div className="shrink-0 overflow-hidden rounded-xl border border-line/70 bg-surface/50 p-2.5 shadow-xs flex flex-col gap-2">
        {/* TAB 1: FIND CONTROLS */}
        {activeTab === "find" && (
          <div className="relative flex items-center">
            <div className="pointer-events-none absolute left-2.5 flex items-center text-muted">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              ref={findInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (e.shiftKey) handlePrevMatch();
                  else handleNextMatch();
                }
              }}
              placeholder="Find in manuscript..."
              className="w-full rounded-lg border border-line/70 bg-raised/50 py-1.5 pr-8 pl-8 text-xs font-medium text-fg outline-none placeholder:text-muted/70 focus:border-accent focus:ring-1 focus:ring-accent transition-all"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  findInputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="absolute right-2 flex h-4 w-4 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-fg transition-colors cursor-pointer"
              >
                <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* TAB 2: REPLACE CONTROLS */}
        {activeTab === "replace" && (
          <div className="flex flex-col gap-2">
            {/* Find what */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-muted">
                Find
              </label>
              <div className="relative flex items-center">
                <div className="pointer-events-none absolute left-2.5 flex items-center text-muted">
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <input
                  ref={replaceFindInputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (e.shiftKey) handlePrevMatch();
                      else handleNextMatch();
                    }
                  }}
                  placeholder="Word to find..."
                  className="w-full rounded-lg border border-line/70 bg-raised/50 py-1.5 pr-8 pl-8 text-xs font-medium text-fg outline-none placeholder:text-muted/70 focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      replaceFindInputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                    className="absolute right-2 flex h-4 w-4 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-fg transition-colors cursor-pointer"
                  >
                    <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Replace with */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-muted">
                Replace with
              </label>
              <div className="relative flex items-center">
                <div className="pointer-events-none absolute left-2.5 flex items-center text-muted">
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                    />
                  </svg>
                </div>
                <input
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
                  placeholder="Replacement text..."
                  className="w-full rounded-lg border border-line/70 bg-raised/50 py-1.5 pr-8 pl-8 text-xs font-medium text-fg outline-none placeholder:text-muted/70 focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                />
                {replacement && (
                  <button
                    type="button"
                    onClick={() => setReplacement("")}
                    aria-label="Clear replacement"
                    className="absolute right-2 flex h-4 w-4 items-center justify-center rounded-full text-muted hover:bg-raised hover:text-fg transition-colors cursor-pointer"
                  >
                    <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Action buttons row */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                disabled={!query.trim() || totalMatchesCount === 0}
                onClick={handleReplaceCurrent}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-accent text-accent-ink px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none shadow-xs cursor-pointer"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Replace
              </button>
              <button
                type="button"
                disabled={!query.trim() || totalMatchesCount === 0}
                onClick={handleReplaceAll}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-line/80 bg-raised/80 text-fg px-3 py-1.5 text-xs font-semibold transition-all hover:bg-raised active:scale-[0.98] disabled:opacity-30 disabled:pointer-events-none shadow-xs cursor-pointer"
              >
                Replace all
              </button>
            </div>
          </div>
        )}

        {/* Feedback Banner */}
        {feedback && (
          <div className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-center text-xs font-medium text-emerald-400 dark:text-emerald-300 flex items-center justify-center gap-1.5 animate-fadeIn">
            <svg
              className="h-3.5 w-3.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>{feedback}</span>
          </div>
        )}
      </div>

      {/* 3. RESULTS NAVIGATION & COUNT BAR CARD */}
      <div className="shrink-0 flex items-center justify-between rounded-xl border border-line/70 bg-surface/50 px-3 py-1.5 shadow-xs">
        <span className="text-xs text-muted truncate">
          {totalMatchesCount === 0 ? (
            query.trim().length >= 1 ? "0 results" : "No active search"
          ) : (
            <>
              <strong className="text-fg font-semibold">{activeMatchIndex + 1}</strong>
              <span className="text-muted/80"> of </span>
              <strong className="text-fg font-semibold">{totalMatchesCount}</strong>
              <span className="text-muted/80">
                {" "}
                result{totalMatchesCount === 1 ? "" : "s"}
              </span>
            </>
          )}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            disabled={totalMatchesCount === 0}
            onClick={handlePrevMatch}
            title="Previous match (Shift+Enter)"
            aria-label="Previous result"
            className="flex h-6 w-6 items-center justify-center rounded-md border border-line/60 bg-raised/50 text-muted transition-colors hover:bg-raised hover:text-fg disabled:pointer-events-none disabled:opacity-30 cursor-pointer"
          >
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>

          <button
            type="button"
            disabled={totalMatchesCount === 0}
            onClick={handleNextMatch}
            title="Next match (Enter)"
            aria-label="Next result"
            className="flex h-6 w-6 items-center justify-center rounded-md border border-line/60 bg-raised/50 text-muted transition-colors hover:bg-raised hover:text-fg disabled:pointer-events-none disabled:opacity-30 cursor-pointer"
          >
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* 4. CHAPTER RESULTS LIST */}
      {totalMatchesCount === 0 ? (
        <div className="shrink-0 rounded-xl border border-line/50 bg-surface/30 p-6 text-center shadow-xs flex flex-col items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-raised/80 text-muted">
            <svg
              className="h-4.5 w-4.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <p className="text-xs font-medium text-fg">
            {query.trim().length >= 1 ? "No matching text found" : "Search your manuscript"}
          </p>
          <p className="text-[11px] text-muted max-w-[220px] leading-relaxed">
            {query.trim().length >= 1
              ? `No occurrences of “${query.trim()}” were found in ${
                  onlyThisChapter ? "this chapter" : "the book"
                }.`
              : activeTab === "find"
              ? "Type words or phrases in the search bar above to highlight and jump to matches in your chapters."
              : "Search for words across your book and replace them individually or all at once."}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 shrink-0">
          {groups.map((group) => {
            const isExpanded = collapsedChapters[group.chapterId] !== true;

            return (
              <div
                key={group.chapterId}
                className="shrink-0 overflow-hidden rounded-xl border border-line/70 bg-surface/40 shadow-xs transition-all duration-150"
              >
                {/* Card Header with Chapter Title */}
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleChapter(group.chapterId);
                  }}
                  className="flex w-full items-center justify-between gap-2 bg-raised/40 px-3.5 py-2.5 text-left select-none transition-colors hover:bg-raised/70 group cursor-pointer shrink-0"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <svg
                      className={`h-3 w-3 shrink-0 text-muted transition-transform duration-200 group-hover:text-fg ${
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
                    <span className="truncate text-xs font-semibold text-fg">
                      {group.chapterTitle}
                    </span>
                  </div>
                  <span className="shrink-0 ml-2 rounded-full border border-line/60 bg-raised/80 px-2 py-0.5 text-[11px] font-bold text-muted tabular-nums group-hover:text-fg group-hover:border-line">
                    {group.matches.length}
                  </span>
                </button>

                {/* Card Body with Match Snippets */}
                {isExpanded && (
                  <div className="flex flex-col divide-y divide-line/40 border-t border-line/50 bg-surface/20">
                    {group.matches.map((match) => {
                      const isActive = activeMatch?.id === match.id;
                      return (
                        <button
                          key={match.id}
                          id={`search-match-${match.id}`}
                          type="button"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectMatch(match);
                          }}
                          className={`shrink-0 w-full px-3.5 py-2 text-left font-sans text-xs leading-relaxed transition-all outline-none group focus-visible:ring-1 focus-visible:ring-accent cursor-pointer ${
                            isActive
                              ? "bg-accent/10 border-l-2 border-l-accent font-medium text-fg pl-3"
                              : "text-muted hover:bg-raised/50 hover:text-fg"
                          }`}
                        >
                          <span className="text-muted group-hover:text-fg/90 transition-colors">
                            {match.before}
                          </span>
                          <mark className="mx-1 rounded px-1.5 py-0.5 text-xs font-semibold text-black bg-[#d9f99d] dark:bg-[#bef264] border border-[#a3e635]/60 shadow-2xs">
                            {match.match}
                          </mark>
                          <span className="text-muted group-hover:text-fg/90 transition-colors">
                            {match.after}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

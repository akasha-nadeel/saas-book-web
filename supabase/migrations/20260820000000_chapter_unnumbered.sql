-- A body page that is not one of the numbered chapters.
--
-- A chapter's number is its position among the body chapters, which is only
-- right while every body page is a chapter. A part title, an interlude, or a
-- heading the importer could not place -- a bare "END" is the case that started
-- this -- sits in the body and silently spends a number, so every chapter after
-- it counts one too high. See ChapterMeta.unnumbered in src/lib/library-store.ts.
--
-- Set by the writer from the panel's row menu, never detected: excluding a
-- document because somebody said so is how Vellum and Scrivener settle the same
-- question, and a guess here would be silently wrong in exactly the case the
-- flag exists to fix.
--
-- Nullable, and written as true-or-null rather than true-or-false, because the
-- store uses absence to mean false (like `bookmarked` beside it) and the return
-- trip has to put the field back exactly that way.
--
-- NOTE: unlike `publishing`, this one does *not* stop chapters syncing while it
-- is unapplied. `upsertChapters` in sync.ts catches PGRST204 naming this column,
-- warns once, and re-sends the rows without it -- so an unmigrated database
-- keeps every chapter, and only loses the flag. Applying this heals it.
alter table public.chapters
  add column if not exists unnumbered boolean;

comment on column public.chapters.unnumbered is
  'True when this body page is not one of the numbered chapters (a part title, an interlude, an unplaceable heading). Null otherwise -- absence means false, matching the store.';

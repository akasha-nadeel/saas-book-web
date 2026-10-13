-- The free plan holds unlimited books.
--
-- Decided 2026-10-13. Free held three books from 2026-09-15 (one before that);
-- every plan now holds as many as the writer makes, so the trigger that
-- counted them is dropped rather than raised to a bigger number.
--
-- **Apply this before deploying the code that ships with it.** The new code
-- lets a free writer make a fourth book at once; with the trigger still in
-- place Postgres refuses it with a 23514 and that book lives in one browser
-- and never reaches the server — the failure that cost a writer their sync on
-- 2026-09-23, when the sixteenth migration shipped after its code. Applying
-- this first is safe the other way round: the old code simply offers fewer
-- books than the database would now accept.
--
-- Check afterwards (both should be 0):
--
--   select count(*) from pg_trigger where tgname = 'books_launch_free_limit';
--   select count(*) from pg_proc where proname = 'enforce_launch_book_limit';
--
-- `openchapter_internal_plan_tier` stays: it is not the limit, only the
-- question the limit asked, and other code may still want it.

begin;

drop trigger if exists books_launch_free_limit on public.books;
drop function if exists public.enforce_launch_book_limit();

commit;

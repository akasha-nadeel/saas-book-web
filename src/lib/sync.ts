/**
 * The bridge between the local library and Supabase.
 *
 * `library-store.ts` stays synchronous and localStorage-backed — that is what
 * lets `useSyncExternalStore` read a snapshot during render, and why none of the
 * 37 files that read the store had to change. This module is the async half:
 * it maps rows to the store's types and back, fetches a whole library, and
 * queues writes.
 *
 * It deliberately owns no state and touches no localStorage. `library-store.ts`
 * calls in here and decides what to do with the answer; keeping the direction
 * one-way is what stops the two modules growing into each other.
 *
 * See docs/plans/2026-07-29-supabase-persistence-design.md for why localStorage
 * remains the read path rather than being replaced.
 */

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type {
  Book,
  ChapterMeta,
  Prefs,
  Shelf,
  TrashedChapter,
} from "./library-store";
import type { PageSetup } from "./page-setup";
import type { PublishingMeta } from "./publishing";
import type { Typography } from "./typography";

// ---------------------------------------------------------------------------
// Rows, as the schema defines them
// ---------------------------------------------------------------------------

interface BookRow {
  id: string;
  owner: string;
  title: string;
  subtitle: string | null;
  author: string | null;
  kind: string | null;
  genre: string | null;
  target_words: number | null;
  bare_cover: boolean | null;
  page: PageSetup | null;
  typography: Typography | null;
  publishing: PublishingMeta | null;
  archived_at: string | null;
  trashed_at: string | null;
  last_opened_id: string | null;
  last_opened_at: string;
  position: number;
}

interface ChapterRow {
  id: string;
  book_id: string;
  owner: string;
  title: string;
  words: number;
  position: number;
  matter: "front" | "back" | null;
  matter_key: "front" | "back" | null;
  bookmarked: boolean | null;
  trashed_at: string | null;
}

/** Everything a writer has, as one download. */
export interface RemoteLibrary {
  shelf: Shelf;
  bodies: Map<string, string>;
  notes: Map<string, string>;
  covers: Map<string, string>;
  prefs: Partial<Prefs> | null;
}

// ---------------------------------------------------------------------------
// Mapping
//
// The store's types use *absence* to mean false — `bookmarked?: true`, not
// `bookmarked: boolean` — so that the common case carries no field and books
// written before a flag existed need no migration. Postgres has no such idiom,
// so the mapping has to put the fields back exactly that way on the return
// trip, or every book comes back subtly different from the one that went up.
// ---------------------------------------------------------------------------

/**
 * A timestamp the database will accept, or null.
 *
 * Guarded rather than trusting the number: `new Date(NaN).toISOString()` throws
 * a RangeError, so a single corrupt stamp in localStorage would take down the
 * whole upload with an exception rather than a rejected row.
 */
const toIso = (ms: unknown): string | null => {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  const at = new Date(ms);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
};

const toMs = (iso: string | null): number | undefined =>
  iso === null ? undefined : Date.parse(iso);

/** A NOT NULL text column will refuse undefined; give it something. */
const text = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.length > 0 ? value : fallback;

/** An integer column will refuse NaN, a float, or a string. */
const count = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value))
    : 0;

function bookToRow(book: Book, owner: string, position: number): BookRow {
  return {
    id: book.id,
    owner,
    title: text(book.title, "Untitled book"),
    subtitle: book.subtitle ?? null,
    author: book.author ?? null,
    kind: book.kind ?? null,
    genre: book.genre ?? null,
    target_words:
      typeof book.targetWords === "number" && Number.isFinite(book.targetWords)
        ? Math.round(book.targetWords)
        : null,
    bare_cover: book.bareCover ? true : null,
    page: book.page ?? null,
    typography: book.typography ?? null,
    publishing: book.publishing ?? null,
    archived_at: toIso(book.archivedAt),
    trashed_at: toIso(book.trashedAt),
    last_opened_id: book.lastOpenedId ?? null,
    // NOT NULL, so it needs a value even when the stored stamp is unusable.
    last_opened_at: toIso(book.lastOpenedAt) ?? new Date().toISOString(),
    position,
  };
}

/**
 * Anything that is not exactly "front" or "back" becomes null.
 *
 * The type says these can only be those two, and today's code only ever writes
 * those two — but the type describes the code, not the data. localStorage holds
 * whatever earlier versions of this app put there, unchecked by any compiler,
 * and the database has a CHECK constraint that will refuse the difference. That
 * refusal aborts the whole upload, so one odd field in one chapter written
 * months ago is enough to stop a writer's entire library reaching the server.
 *
 * Narrowing on the way out is the fix: the database gets values it can accept,
 * and a stray one is dropped rather than taking everything else down with it.
 */
function matterOrNull(value: unknown): "front" | "back" | null {
  return value === "front" || value === "back" ? value : null;
}

function chapterToRow(
  chapter: ChapterMeta,
  bookId: string,
  owner: string,
  position: number,
  trashedAt?: number,
): ChapterRow {
  return {
    id: chapter.id,
    book_id: bookId,
    owner,
    title: text(chapter.title, "Untitled chapter"),
    words: count(chapter.words),
    position,
    matter: matterOrNull(chapter.matter),
    matter_key: matterOrNull(chapter.matterKey),
    // Coerced, not passed through: a truthy non-boolean here would be rejected
    // by the column just as surely.
    bookmarked: chapter.bookmarked ? true : null,
    trashed_at: toIso(trashedAt),
  };
}

function rowToChapter(row: ChapterRow): ChapterMeta {
  const chapter: ChapterMeta = {
    id: row.id,
    title: row.title,
    words: row.words,
  };
  // Only set when true/present — see the note above about absence.
  if (row.bookmarked) chapter.bookmarked = true;
  if (row.matter) chapter.matter = row.matter;
  if (row.matter_key) chapter.matterKey = row.matter_key;
  return chapter;
}

/** Every row of a book's chapters, back into the one Book the store expects. */
function rowsToBook(row: BookRow, chapters: ChapterRow[]): Book {
  const live = chapters
    .filter((c) => c.trashed_at === null)
    .sort((a, b) => a.position - b.position)
    .map(rowToChapter);

  const trashed: TrashedChapter[] = chapters
    .filter((c) => c.trashed_at !== null)
    .sort((a, b) => Date.parse(b.trashed_at!) - Date.parse(a.trashed_at!))
    .map((c) => ({ ...rowToChapter(c), trashedAt: Date.parse(c.trashed_at!) }));

  const book: Book = {
    id: row.id,
    title: row.title,
    chapters: live,
    lastOpenedId: row.last_opened_id,
    lastOpenedAt: Date.parse(row.last_opened_at),
  };

  if (row.subtitle) book.subtitle = row.subtitle;
  if (row.author) book.author = row.author;
  if (row.kind) book.kind = row.kind as Book["kind"];
  if (row.genre) book.genre = row.genre;
  if (row.target_words !== null) book.targetWords = row.target_words;
  if (row.bare_cover) book.bareCover = true;
  if (row.page) book.page = row.page;
  if (row.typography) book.typography = row.typography;
  if (row.publishing) book.publishing = row.publishing;

  const archivedAt = toMs(row.archived_at);
  if (archivedAt !== undefined) book.archivedAt = archivedAt;
  const trashedAt = toMs(row.trashed_at);
  if (trashedAt !== undefined) book.trashedAt = trashedAt;

  if (trashed.length > 0) book.trash = trashed;

  return book;
}

// ---------------------------------------------------------------------------
// Who is signed in
// ---------------------------------------------------------------------------

/** The signed-in writer's id, or null. getClaims verifies the JWT signature. */
export async function currentOwner(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const { data } = await createClient().auth.getClaims();
    return data?.claims.sub ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

/**
 * Everything the writer has on the server.
 *
 * One request per table rather than nested selects: the tables are joined only
 * by id, PostgREST's embedding would fetch prose alongside the shelf, and the
 * whole point of the split is that opening a library does not do that.
 *
 * Returns null when there is nothing to talk to, which is not an error — an
 * unconfigured or signed-out app runs entirely on localStorage.
 */
export async function fetchLibrary(): Promise<RemoteLibrary | null> {
  const owner = await currentOwner();
  if (!owner) return null;

  const db = createClient();

  const [books, chapters, bodies, notes, covers, prefs] = await Promise.all([
    db.from("books").select("*"),
    db.from("chapters").select("*"),
    db.from("chapter_bodies").select("chapter_id, doc"),
    db.from("chapter_notes").select("chapter_id, text"),
    db.from("book_covers").select("book_id, data_url"),
    db.from("prefs").select("data").maybeSingle(),
  ]);

  const failure = [books, chapters, bodies, notes, covers, prefs].find(
    (r) => r.error,
  );
  if (failure?.error) {
    console.error("[sync] could not read library", failure.error);
    return null;
  }

  const chapterRows = (chapters.data ?? []) as ChapterRow[];
  const byBook = new Map<string, ChapterRow[]>();
  for (const row of chapterRows) {
    const list = byBook.get(row.book_id);
    if (list) list.push(row);
    else byBook.set(row.book_id, [row]);
  }

  const bookRows = ((books.data ?? []) as BookRow[]).sort(
    (a, b) => a.position - b.position,
  );

  return {
    shelf: {
      books: bookRows.map((row) => rowsToBook(row, byBook.get(row.id) ?? [])),
      // Derived rather than stored: the most recently opened book is already
      // recorded per book, so a separate field could only disagree with it.
      lastOpenedBookId: mostRecentlyOpened(bookRows),
    },
    bodies: new Map(
      (bodies.data ?? []).map((r) => [
        r.chapter_id as string,
        JSON.stringify(r.doc),
      ]),
    ),
    notes: new Map(
      (notes.data ?? []).map((r) => [r.chapter_id as string, r.text as string]),
    ),
    covers: new Map(
      (covers.data ?? []).map((r) => [
        r.book_id as string,
        r.data_url as string,
      ]),
    ),
    prefs: (prefs.data?.data as Partial<Prefs> | undefined) ?? null,
  };
}

function mostRecentlyOpened(rows: BookRow[]): string | null {
  let best: BookRow | null = null;
  for (const row of rows) {
    if (row.trashed_at || row.archived_at) continue;
    if (!best || Date.parse(row.last_opened_at) > Date.parse(best.last_opened_at)) {
      best = row;
    }
  }
  return best?.id ?? null;
}

// ---------------------------------------------------------------------------
// The claim
//
// A writer signing in for the first time has books in this browser and nothing
// on the server. That library has to go up exactly once.
//
// The claim is recorded server-side rather than locally, and checked before
// uploading, because the dangerous direction is the second sign-in: without a
// record, a browser still holding a stale copy would re-upload books deleted
// from another machine, and deletions would never stick.
// ---------------------------------------------------------------------------

export async function hasClaimed(): Promise<boolean> {
  const owner = await currentOwner();
  if (!owner) return true; // Nothing to claim into; treat as done.

  const { data, error } = await createClient()
    .from("library_claims")
    .select("owner")
    .maybeSingle();

  if (error) {
    console.error("[sync] could not read claim", error);
    // Fail closed. A failed read must not be taken as "never claimed" — that
    // is exactly the case that resurrects deleted books.
    return true;
  }
  return data !== null;
}

/** Uploads a whole local library. Returns false if anything failed. */
export async function uploadLibrary(
  shelf: Shelf,
  bodies: Map<string, string>,
  notes: Map<string, string>,
  covers: Map<string, string>,
  prefs: Prefs,
): Promise<boolean> {
  const owner = await currentOwner();
  if (!owner) return false;

  const db = createClient();

  const bookRows: BookRow[] = [];
  const chapterRows: ChapterRow[] = [];

  shelf.books.forEach((book, index) => {
    bookRows.push(bookToRow(book, owner, index));
    book.chapters.forEach((chapter, position) => {
      chapterRows.push(chapterToRow(chapter, book.id, owner, position));
    });
    (book.trash ?? []).forEach((chapter, position) => {
      chapterRows.push(
        chapterToRow(chapter, book.id, owner, position, chapter.trashedAt),
      );
    });
  });

  /**
   * Only prose whose chapter is actually going up.
   *
   * collectLocal() sweeps every openchapter:chapter: key in the browser, and
   * after enough versions of an app some of those belong to nothing — a book
   * deleted before its bodies were cleaned up, a chapter from a schema two
   * rewrites ago. Each is a foreign key the database will refuse, and one
   * refusal takes the whole batch with it. They are dropped rather than
   * repaired: a body with no chapter has nothing to be attached to.
   */
  const liveChapters = new Set<string>();
  for (const book of shelf.books) {
    for (const c of book.chapters) liveChapters.add(c.id);
    for (const c of book.trash ?? []) liveChapters.add(c.id);
  }
  const liveBooks = new Set(shelf.books.map((b) => b.id));

  const bodyRows = [...bodies]
    .filter(([chapterId]) => liveChapters.has(chapterId))
    .map(([chapter_id, raw]) => ({ chapter_id, owner, doc: safeParse(raw) }))
    // doc is NOT NULL, and safeParse yields null on text that will not parse.
    // A body that cannot be read is skipped so the rest still land.
    .filter((row) => row.doc !== null);

  const noteRows = [...notes]
    .filter(([chapterId]) => liveChapters.has(chapterId))
    .map(([chapter_id, text]) => ({ chapter_id, owner, text }));

  const coverRows = [...covers]
    .filter(([bookId]) => liveBooks.has(bookId))
    .map(([book_id, data_url]) => ({ book_id, owner, data_url }));

  /**
   * Books before chapters, chapters before their bodies: the foreign keys make
   * any other order fail, and failing halfway would leave prose with no chapter
   * to hang from.
   *
   * Sent in batches rather than one request apiece. A library of forty chapters
   * carrying inline images, plus a cover of up to 250KB per book, adds up to a
   * payload large enough to be refused whole — and a refusal loses everything,
   * not the row that caused it. The sizes differ because the rows do: a cover
   * is a quarter-megabyte data URL, a chapter row is a few hundred bytes.
   */
  const steps: { what: string; rows: object[]; table: string; size: number }[] =
    [
      { what: "books", rows: bookRows, table: "books", size: 100 },
      { what: "chapters", rows: chapterRows, table: "chapters", size: 200 },
      { what: "bodies", rows: bodyRows, table: "chapter_bodies", size: 10 },
      { what: "notes", rows: noteRows, table: "chapter_notes", size: 50 },
      { what: "covers", rows: coverRows, table: "book_covers", size: 4 },
      {
        what: "prefs",
        rows: [{ owner, data: prefs }],
        table: "prefs",
        size: 1,
      },
    ];

  for (const step of steps) {
    if (step.rows.length === 0) continue;
    for (let i = 0; i < step.rows.length; i += step.size) {
      const batch = step.rows.slice(i, i + step.size);
      try {
        await db.from(step.table).upsert(batch).throwOnError();
      } catch (err) {
        // Which rows, not just which table. A rejected batch otherwise leaves
        // nothing to go on but the constraint's name, and hunting the offending
        // chapter through a library by hand is the slow way to find it.
        console.error(
          `[sync] could not upload ${step.what} (rows ${i}–${i + batch.length - 1} of ${step.rows.length})`,
          err,
        );
        console.error("[sync] rows in the rejected batch:", batch.map(identify));
        return false;
      }
    }
  }

  const { error } = await db.from("library_claims").upsert({ owner });
  if (error) {
    console.error("[sync] uploaded, but could not record the claim", error);
    return false;
  }
  return true;
}

/**
 * Enough of a row to find it again, and no more. Printing a whole one would
 * dump a chapter's prose or a quarter-megabyte cover into the console.
 */
function identify(row: object): Record<string, unknown> {
  const r = row as Record<string, unknown>;
  const shown: Record<string, unknown> = {};
  for (const key of [
    "id",
    "book_id",
    "chapter_id",
    "title",
    "matter",
    "matter_key",
    "words",
    "position",
  ]) {
    if (key in r) shown[key] = r[key];
  }
  return shown;
}

function safeParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Push
//
// Writes are coalesced by key and flushed on a short timer. Autosave fires
// every few seconds while a writer types; without coalescing, a long session
// is a request per save, and the last one is the only one that mattered.
// ---------------------------------------------------------------------------

type Job = () => Promise<void>;

const pending = new Map<string, Job>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_MS = 800;

function enqueue(key: string, job: Job) {
  if (!isSupabaseConfigured()) return;
  // Replacing by key is the coalescing: only the newest state of a given row
  // is worth sending, and the older one is already stale.
  pending.set(key, job);
  if (flushTimer) return;
  flushTimer = setTimeout(flush, FLUSH_MS);
}

async function flush() {
  flushTimer = null;
  const jobs = [...pending.values()];
  pending.clear();
  for (const job of jobs) {
    try {
      await job();
    } catch (err) {
      // Supabase rejects with a PostgrestError — a plain object, not an Error —
      // and both the dev overlay and console.error render one of those as `{}`.
      // A sync that is failing then looks exactly like a sync that is fine, so
      // the fields are pulled out by name rather than handed over as an object.
      const e = err as Partial<Record<"message" | "code" | "details" | "hint", string>>;
      console.error(
        `[sync] push failed${e?.code ? ` [${e.code}]` : ""}: ${
          e?.message ?? String(err)
        }`,
        e?.details ?? "",
        e?.hint ?? "",
      );
    }
  }
}

/** Send anything still queued now — used before the tab goes away. */
export function flushNow() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  void flush();
}

/** So a whole library's worth of books does not each say the same thing. */
let warnedMissingPublishing = false;

export function pushBook(book: Book, position: number) {
  enqueue(`book:${book.id}`, async () => {
    const owner = await currentOwner();
    if (!owner) return;
    const db = createClient();

    const row = bookToRow(book, owner, position);
    const { error } = await db.from("books").upsert(row);
    if (error) {
      // PostgREST refuses a row carrying a column the table does not have, and
      // refuses the *whole* row — so a database that has not had migration
      // 20260730000000 applied stops syncing books, chapters, and everything
      // that rides along with them. That is a catastrophic answer to an
      // optional field being unavailable.
      //
      // So the row goes up again without it. The writer keeps their sync; only
      // the listing details wait for the column. It heals itself the moment the
      // migration lands, and says so once in the meantime rather than once per
      // book per load.
      const missingPublishing =
        error.code === "PGRST204" && /'publishing'/.test(error.message ?? "");
      if (!missingPublishing) throw error;

      if (!warnedMissingPublishing) {
        warnedMissingPublishing = true;
        console.warn(
          "[sync] the books table has no `publishing` column, so store-listing " +
            "details are not being saved to the server. Everything else is " +
            "syncing normally. Apply supabase/migrations/20260730000000_book_publishing.sql.",
        );
      }

      const withoutPublishing = { ...row };
      delete (withoutPublishing as Partial<BookRow>).publishing;
      const retry = await db.from("books").upsert(withoutPublishing);
      if (retry.error) throw retry.error;
    }

    // The chapter list is part of the book as far as the store is concerned —
    // a reorder is a change to the book, not to each chapter — so it goes up
    // with it rather than as a separate call that could land out of order.
    const rows = [
      ...book.chapters.map((c, i) => chapterToRow(c, book.id, owner, i)),
      ...(book.trash ?? []).map((c, i) =>
        chapterToRow(c, book.id, owner, i, c.trashedAt),
      ),
    ];
    if (rows.length === 0) return;
    const { error: chapterError } = await db.from("chapters").upsert(rows);
    if (chapterError) throw chapterError;
  });
}

export function pushBody(chapterId: string, raw: string) {
  enqueue(`body:${chapterId}`, async () => {
    const owner = await currentOwner();
    if (!owner) return;
    const { error } = await createClient()
      .from("chapter_bodies")
      .upsert({ chapter_id: chapterId, owner, doc: safeParse(raw) });
    if (error) throw error;
  });
}

export function pushNotes(chapterId: string, text: string) {
  enqueue(`notes:${chapterId}`, async () => {
    const owner = await currentOwner();
    if (!owner) return;
    const { error } = await createClient()
      .from("chapter_notes")
      .upsert({ chapter_id: chapterId, owner, text });
    if (error) throw error;
  });
}

export function pushCover(bookId: string, dataUrl: string | null) {
  enqueue(`cover:${bookId}`, async () => {
    const owner = await currentOwner();
    if (!owner) return;
    const db = createClient();
    const { error } =
      dataUrl === null
        ? await db.from("book_covers").delete().eq("book_id", bookId)
        : await db
            .from("book_covers")
            .upsert({ book_id: bookId, owner, data_url: dataUrl });
    if (error) throw error;
  });
}

export function pushPrefs(prefs: Prefs) {
  enqueue("prefs", async () => {
    const owner = await currentOwner();
    if (!owner) return;
    const { error } = await createClient()
      .from("prefs")
      .upsert({ owner, data: prefs });
    if (error) throw error;
  });
}

/**
 * A hard delete. Books cascade to their chapters, chapters to their bodies and
 * notes, so one statement is enough — and the cascade is declared in the schema
 * rather than reimplemented here, where it could fall out of step.
 */
export function pushBookDeleted(bookId: string) {
  enqueue(`book:${bookId}`, async () => {
    const { error } = await createClient()
      .from("books")
      .delete()
      .eq("id", bookId);
    if (error) throw error;
  });
}

export function pushChapterDeleted(chapterId: string) {
  enqueue(`chapter:${chapterId}`, async () => {
    const { error } = await createClient()
      .from("chapters")
      .delete()
      .eq("id", chapterId);
    if (error) throw error;
  });
}

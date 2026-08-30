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
  /* No `kind`. The column is still on the table and is simply never written —
     see the note on `Book` in `library-store.ts`. Leaving it out of the upsert
     is safe: it is nullable, and PostgREST only refuses columns that do *not*
     exist. */
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

/**
 * A book row as it comes *back*, which is not the same shape as one going out.
 *
 * `updated_at` is set by a trigger, so it is never sent — and it is read for one
 * purpose. `last_opened_at` on a shared book is the *owner's* stamp: ordering a
 * collaborator's shelf by it would sort their books by somebody else's reading,
 * and pin "continue writing" to a book they have never opened. So for a shared
 * book this writer has not opened here, the fallback is when the manuscript last
 * moved — a fact about the book rather than about a stranger.
 */
interface BookReadRow extends BookRow {
  updated_at: string;
}

/**
 * A membership, as the column grant allows it to be read.
 *
 * `token` and `invited_by` are **not** granted to `authenticated` — see the foot
 * of 20260806000000_collaboration.sql — and PostgREST refuses the whole query if
 * an ungranted column is asked for. So every read of this table names its
 * columns; there is no `select("*")` here and there cannot be.
 */
interface MemberRow {
  book_id: string;
  role: "editor" | "viewer";
  status: "pending" | "active" | "revoked";
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
  /** Arrives with the chapter-numbering migration; absent on an older database
   *  and survivable, which is what `upsertChapters` below is for. Optional so
   *  the retry can drop it and still be a `ChapterRow`. */
  unnumbered?: boolean | null;
  trashed_at: string | null;
}

/** Everything a writer has, as one download. */
export interface RemoteLibrary {
  shelf: Shelf;
  bodies: Map<string, string>;
  notes: Map<string, string>;
  covers: Map<string, string>;
  prefs: Partial<Prefs> | null;
  /**
   * The revision each body was at when it was downloaded, which is what the
   * conflict guard compares against on the next save. Seeded into `bodyRevs` by
   * `applyRemote`; without it the first save of the session cannot tell "nobody
   * has touched this" from "somebody has".
   */
  revs: Map<string, number>;
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
    unnumbered: chapter.unnumbered ? true : null,
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
  if (row.unnumbered) chapter.unnumbered = true;
  if (row.matter) chapter.matter = row.matter;
  if (row.matter_key) chapter.matterKey = row.matter_key;
  return chapter;
}

/**
 * Every row of a book's chapters, back into the one Book the store expects.
 *
 * `role` is the membership this writer holds, or undefined for their own book.
 * `mine` is the local copy, if there is one, and it exists for one reason: four
 * fields on a shared `books` row belong to the *owner* and not to the reader —
 * see the note on `lastOpenedId` below.
 */
function rowsToBook(
  row: BookReadRow,
  chapters: ChapterRow[],
  role?: "editor" | "viewer",
  mine?: Book,
): Book {
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
    /*
     * **On a shared book these two are the collaborator's own, not the row's.**
     * `last_opened_id` and `last_opened_at` are per-writer state that happens to
     * live on the shared `books` row — which is the whole reason that row stays
     * owner-only for writes. Reading the owner's values here would put a
     * co-writer back on whichever chapter the *owner* last had open, and would
     * pin their shelf's "continue writing" to a book they have never touched.
     *
     * So a foreign book keeps whatever this browser already knew, falling back to
     * when the manuscript last moved rather than to the owner's reading.
     */
    lastOpenedId: role ? (mine?.lastOpenedId ?? null) : row.last_opened_id,
    lastOpenedAt: role
      ? (mine?.lastOpenedAt ?? Date.parse(row.updated_at))
      : Date.parse(row.last_opened_at),
  };

  // Always set, so `book.ownerId !== me` is the one test for "somebody else's"
  // and no caller has to reach for the signed-in id to find out.
  book.ownerId = row.owner;
  if (role) book.role = role;

  if (row.subtitle) book.subtitle = row.subtitle;
  if (row.author) book.author = row.author;
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
// Reading what went wrong
//
// Supabase rejects with a PostgrestError, which is a plain object rather than an
// Error — and both `console.error` and the dev overlay render one of those as
// `{}`. A sync that is failing then looks exactly like a sync that is fine, so
// every log here pulls the fields out by name. `flush` already did this; the
// pull path did not, and "[sync] could not read library {}" is what that costs.
// ---------------------------------------------------------------------------

/** The shape Supabase rejects with. Not an Error, which is the whole problem. */
type Postgrestish = Partial<
  Record<"message" | "code" | "details" | "hint", string>
>;

function describe(error: unknown): string {
  const e = error as Postgrestish | null;
  if (!e || typeof e !== "object") return String(error);
  const code = e.code ? ` [${e.code}]` : "";
  const extra = [e.details, e.hint].filter(Boolean).join(" · ");
  return `${code} ${e.message ?? "unknown error"}${extra ? ` — ${extra}` : ""}`.trim();
}

/**
 * Is this the database telling us a column does not exist yet?
 *
 * `42703` is Postgres' undefined_column; `PGRST204` is PostgREST refusing a
 * *write* naming an unknown column. Both mean the same thing here: a migration
 * that has not been applied. Matched on the column name too, so an unrelated
 * schema error is not quietly swallowed as a missing feature.
 */
function missingColumn(error: unknown, column: string): boolean {
  const e = error as Postgrestish | null;
  if (!e?.code) return false;
  if (e.code !== "42703" && e.code !== "PGRST204") return false;
  return new RegExp(`\\b${column}\\b`).test(`${e.message ?? ""}`);
}

/** So a whole library's worth of rows does not each say the same thing. */
const warned = new Set<string>();
function warnOnce(key: string, message: string) {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(message);
}

/**
 * Does this database have the conflict guard's column?
 *
 * Optimistic, and corrected by the first download that finds it missing. When it
 * is false `pushBody` reverts to the plain upsert it always did — last-write-wins
 * on prose, which is what the app promised before sharing existed.
 */
let hasRevColumn = true;

/** A body row, with the guard's revision when the database has one. */
interface BodyRow {
  chapter_id: string;
  doc: unknown;
  rev?: number;
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
export async function fetchLibrary(local?: Shelf): Promise<RemoteLibrary | null> {
  const owner = await currentOwner();
  if (!owner) return null;

  const db = createClient();

  /*
   * **The memberships come first, and the rest is filtered by them.**
   *
   * These six selects used to carry no filter at all and let RLS be the filter,
   * which was exactly right while every policy was `owner = auth.uid()`: an
   * indexed comparison against a constant. Sharing adds a second branch, and an
   * unfiltered select would then ask Postgres to evaluate it for every row of
   * every writer's chapters on every page load.
   *
   * So the filter is stated: own rows by owner, shared rows by the handful of
   * book ids this writer is actually in. RLS remains the guarantee — it is what
   * makes a wrong filter safe rather than a leak — but it is no longer the plan.
   */
  const membership = await db
    .from("book_members")
    .select("book_id, role, status")
    .eq("user_id", owner)
    .eq("status", "active");

  if (membership.error) {
    // Not fatal, and it must not be: a database without the collaboration
    // migration answers PGRST205 here — PostgREST cannot find the table in its
    // schema cache — and a writer with no co-writers loses nothing by it. Their
    // own library still downloads.
    warnOnce(
      "book_members",
      `[sync] no collaboration table yet, so no shared books:${describe(
        membership.error,
      )}`,
    );
  }

  const roles = new Map<string, "editor" | "viewer">(
    ((membership.data ?? []) as MemberRow[]).map((m) => [m.book_id, m.role]),
  );
  const sharedIds = [...roles.keys()];

  /**
   * Own rows, plus the shared ones when there are any.
   *
   * PostgREST has no OR across two `.eq`/`.in` calls, so the shared half is a
   * second request rather than a cleverer filter. Two indexed queries beat one
   * sequential scan, and a writer with no shared books makes no second request
   * at all.
   */
  const mineAndShared = async <T>(
    table: string,
    columns: string,
  ): Promise<{ data: T[]; error: Postgrestish | null }> => {
    const own = await db.from(table).select(columns).eq("owner", owner);
    if (own.error) return { data: [], error: own.error };
    if (sharedIds.length === 0) {
      return { data: (own.data ?? []) as T[], error: null };
    }
    const shared = await db.from(table).select(columns).in("book_id", sharedIds);
    if (shared.error) return { data: [], error: shared.error };
    return {
      data: [...(own.data ?? []), ...(shared.data ?? [])] as T[],
      error: null,
    };
  };

  const [books, chapters, bodies, notes, covers, prefs] = await Promise.all([
    (async () => {
      const own = await db.from("books").select("*").eq("owner", owner);
      if (own.error || sharedIds.length === 0) return own;
      const shared = await db.from("books").select("*").in("id", sharedIds);
      if (shared.error) return shared;
      return {
        data: [...(own.data ?? []), ...(shared.data ?? [])],
        error: null,
      };
    })(),
    mineAndShared<ChapterRow>("chapters", "*"),
    /*
     * **`rev` is asked for, and its absence is survivable.**
     *
     * The conflict guard's column arrives with 20260806000000, and a database
     * that has not had it applied answers 42703 for the *whole select* — which
     * would take the entire library download with it, on every load, for a
     * feature the writer may not even be using. That is the same catastrophe
     * `pushBook` already defends against for the `publishing` column, and the
     * same answer: ask, and fall back to the shape that worked before.
     */
    (async () => {
      const withRev = await mineAndShared<BodyRow>(
        "chapter_bodies",
        "chapter_id, doc, rev",
      );
      if (!missingColumn(withRev.error, "rev")) return withRev;

      warnOnce(
        "rev",
        "[sync] chapter_bodies has no `rev` column, so two writers in one " +
          "chapter still resolve last-write-wins rather than being warned. " +
          "Everything else is syncing normally. Apply " +
          "supabase/migrations/20260806000000_collaboration.sql.",
      );
      hasRevColumn = false;
      return mineAndShared<BodyRow>("chapter_bodies", "chapter_id, doc");
    })(),
    mineAndShared<{ chapter_id: string; text: string }>(
      "chapter_notes",
      "chapter_id, text",
    ),
    mineAndShared<{ book_id: string; data_url: string }>(
      "book_covers",
      "book_id, data_url",
    ),
    db.from("prefs").select("data").maybeSingle(),
  ]);

  const named: [string, { error: unknown }][] = [
    ["books", books],
    ["chapters", chapters],
    ["bodies", bodies],
    ["notes", notes],
    ["covers", covers],
    ["prefs", prefs],
  ];
  const failure = named.find(([, r]) => r.error);
  if (failure) {
    // Which table, and what it actually said. Both were missing before: the
    // whole download failing with `{}` gives nobody anywhere to start.
    console.error(
      `[sync] could not read ${failure[0]}:${describe(failure[1].error)}`,
    );
    return null;
  }

  const chapterRows = (chapters.data ?? []) as ChapterRow[];
  const byBook = new Map<string, ChapterRow[]>();
  for (const row of chapterRows) {
    const list = byBook.get(row.book_id);
    if (list) list.push(row);
    else byBook.set(row.book_id, [row]);
  }

  const bookRows = ((books.data ?? []) as BookReadRow[]).sort(
    (a, b) => a.position - b.position,
  );

  const localBooks = new Map((local?.books ?? []).map((b) => [b.id, b]));

  return {
    shelf: {
      books: bookRows.map((row) =>
        rowsToBook(
          row,
          byBook.get(row.id) ?? [],
          roles.get(row.id),
          localBooks.get(row.id),
        ),
      ),
      // Derived rather than stored: the most recently opened book is already
      // recorded per book, so a separate field could only disagree with it.
      lastOpenedBookId: mostRecentlyOpened(bookRows, owner, localBooks),
    },
    bodies: new Map(
      (bodies.data ?? []).map((r) => [r.chapter_id, JSON.stringify(r.doc)]),
    ),
    // Empty when the database has no `rev` column, rather than a map of noughts:
    // a seeded rev that does not exist on the server is worse than no rev at all,
    // because it looks like knowledge.
    revs: new Map(
      hasRevColumn
        ? (bodies.data ?? [])
            .filter((r) => typeof r.rev === "number")
            .map((r) => [r.chapter_id, count(r.rev)] as [string, number])
        : [],
    ),
    notes: new Map((notes.data ?? []).map((r) => [r.chapter_id, r.text])),
    covers: new Map((covers.data ?? []).map((r) => [r.book_id, r.data_url])),
    prefs: (prefs.data?.data as Partial<Prefs> | undefined) ?? null,
  };
}

/**
 * Which book to open on arrival.
 *
 * **Shared books are judged by this writer's own history, never by the row's.**
 * `last_opened_at` on somebody else's book is *their* stamp, so an active
 * co-author would otherwise pin their collaborator's "continue writing" to the
 * shared book permanently — and open it at whichever chapter the owner was in.
 * A shared book the reader has never opened has no claim on this at all.
 */
function mostRecentlyOpened(
  rows: BookReadRow[],
  owner: string,
  localBooks: Map<string, Book>,
): string | null {
  let bestId: string | null = null;
  let bestAt = -Infinity;

  for (const row of rows) {
    if (row.trashed_at || row.archived_at) continue;

    const mine = row.owner === owner;
    const at = mine
      ? Date.parse(row.last_opened_at)
      : (localBooks.get(row.id)?.lastOpenedAt ?? Number.NaN);

    if (!Number.isFinite(at)) continue; // never opened here
    if (at > bestAt) {
      bestAt = at;
      bestId = row.id;
    }
  }
  return bestId;
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
    .eq("owner", owner)
    .maybeSingle();

  if (error) {
    console.warn(`[sync] could not read claim:${describe(error)}`);
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
  prefs: Prefs | null,
): Promise<boolean> {
  const owner = await currentOwner();
  if (!owner) return false;

  const db = createClient();

  const bookRows: BookRow[] = [];
  const chapterRows: ChapterRow[] = [];

  /*
   * **Only this writer's own books, and this filter is load-bearing.**
   *
   * A collaborator's shelf holds shared books, and uploading one would try to
   * upsert it with `owner` set to *them* — an attempt to take somebody else's
   * manuscript. It fails, because `books_update` is owner-only, and the failure
   * is worse than harmless: `uploadLibrary` returns false, and every caller
   * treats that as "do not apply the download". So an invited collaborator's sync
   * stops working entirely, permanently, from their second load onward.
   *
   * Absence of `ownerId` means the book is theirs — a book made offline has none.
   */
  const own = shelf.books.filter((b) => !b.ownerId || b.ownerId === owner);

  own.forEach((book, index) => {
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
   *
   * Derived from `own` rather than from `shelf.books`, for the same reason the
   * book rows are: a shared book's prose must not ride along, or the batch
   * carries rows the writer has no right to insert and the whole upload is
   * refused.
   */
  const liveChapters = new Set<string>();
  for (const book of own) {
    for (const c of book.chapters) liveChapters.add(c.id);
    for (const c of book.trash ?? []) liveChapters.add(c.id);
  }
  const liveBooks = new Set(own.map((b) => b.id));

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
        rows: prefs ? [{ owner, data: prefs }] : [],
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

/**
 * **Parents before children, because the database says so.**
 *
 * `chapter_bodies` derives its `book_id` and `owner` from the chapter row in a
 * trigger, and raises `foreign_key_violation` when there is no chapter to
 * derive them from. So a body sent before its chapter is refused — and that is
 * exactly the order a new chapter produces, because `saveBody` writes the prose
 * and pushes it *before* the caller updates the word count that queues the
 * book. Both land in one flush, and the body used to go first.
 *
 * A Map iterates in insertion order, which is the order the writer's actions
 * happened in and not the order the foreign keys need. `uploadLibrary` already
 * knew this — "books before chapters, chapters before their bodies" — and the
 * incremental path is now held to the same rule.
 */
const ORDER = ["book", "chapter", "body", "notes", "cover", "prefs"];

export function rank(key: string): number {
  const at = ORDER.indexOf(key.split(":")[0]);
  return at === -1 ? ORDER.length : at;
}

/**
 * How many times a key has failed in a row.
 *
 * Cleared on success, and on a fresh `enqueue` for that key — a new save is a
 * new fact about the row, and it starts with its own budget rather than
 * inheriting the last one's.
 */
const attempts = new Map<string, number>();

/**
 * **A push that fails is tried again, and for a long time it simply was not.**
 *
 * `flush` logged the error and dropped the job, so one refusal lost that write
 * for good: nothing re-queued it, and nothing on a later load noticed it was
 * missing. A body refused for arriving before its chapter — the ordering bug
 * above — was gone permanently, and so was one lost to a dropped connection.
 * Measured on a real library: 298 chapters on the server, 30 of their bodies.
 *
 * Five attempts over roughly half a minute, doubling. Bounded because a push
 * refused for a reason retrying cannot fix must not spin forever, and because a
 * writer who has closed the tab is past helping — `syncWithServer`'s repair
 * pass is what catches whatever is still missing on the next load.
 */
const MAX_ATTEMPTS = 5;
const RETRY_MS = 1200;

function enqueue(key: string, job: Job) {
  if (!isSupabaseConfigured()) return;
  // Replacing by key is the coalescing: only the newest state of a given row
  // is worth sending, and the older one is already stale.
  pending.set(key, job);
  attempts.delete(key);
  if (flushTimer) return;
  flushTimer = setTimeout(flush, FLUSH_MS);
}

/**
 * Whether trying this again could ever work.
 *
 * A refusal under RLS is the one failure that is *about* the writer rather than
 * about the moment: access has been taken away, and four more attempts would
 * be four more denials and four more lines in the console telling them so.
 * Everything else — a foreign key that has not landed yet, a dropped
 * connection, a gateway having a bad minute — is worth another go.
 */
export function worthRetrying(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return code !== "42501" && code !== "PGRST301";
}

/**
 * Marks a refusal as a refusal, and tells the store.
 *
 * `42501` is Postgres declining the row under RLS; `PGRST301` is PostgREST
 * declining the request. Under collaboration either one has a specific meaning
 * that did not exist before — **access was taken away while this tab was open** —
 * and it is the one sync failure a writer has to be shown rather than left to
 * find in a console. Returns the error so a caller can `throw denied(...)` and
 * keep the existing logging.
 */
function denied<E extends { code?: string }>(error: E, table: string): E {
  if (error.code === "42501" || error.code === "PGRST301") onDenied?.(table);
  return error;
}

async function flush() {
  flushTimer = null;

  /*
   * **Nobody signed in, nothing to push to.**
   *
   * Checked once here rather than in each job, because it is a fact about the
   * session rather than about any one row, and because a queue flushed signed
   * out is every job in it refused as `anon` — Postgres answering 42501, five
   * times each, with a hint suggesting the cure is to grant `anon` write
   * access to `books`. That "fix" would let any stranger write to any writer's
   * shelf; the actual bug is that we asked at all.
   *
   * It happens the moment somebody signs out with a local library: the books
   * keep their `ownerId` from the session that made them, so the push looked
   * perfectly well-formed and only the database knew better.
   *
   * **Dropped rather than held**, which is safe for the reason the retry note
   * above gives: signing in ends in a redirect or a full navigation, so an
   * in-memory queue never survives to see it, and `syncWithServer()` uploads
   * whatever the browser is holding on the next load anyway. Keeping the jobs
   * would buy nothing and risk sending one writer's edits under the next
   * writer's session.
   */
  if (!(await currentOwner())) {
    pending.clear();
    attempts.clear();
    return;
  }

  const jobs = [...pending.entries()].sort((a, b) => rank(a[0]) - rank(b[0]));
  pending.clear();
  for (const [key, job] of jobs) {
    try {
      await job();
      attempts.delete(key);
    } catch (err) {
      /*
       * Put it back, unless a newer save for the same row has already been
       * queued while this one was in flight — that one carries the writer's
       * later text, and re-queueing this would send the older prose after it.
       */
      const tries = (attempts.get(key) ?? 0) + 1;
      const retrying =
        tries <= MAX_ATTEMPTS && worthRetrying(err) && !pending.has(key);

      if (retrying) {
        attempts.set(key, tries);
        pending.set(key, job);
        if (!flushTimer) {
          flushTimer = setTimeout(flush, RETRY_MS * 2 ** (tries - 1));
        }
      } else {
        attempts.delete(key);
      }

      // Supabase rejects with a PostgrestError — a plain object, not an Error —
      // and both the dev overlay and console.error render one of those as `{}`.
      // A sync that is failing then looks exactly like a sync that is fine, so
      // the fields are pulled out by name rather than handed over as an object.
      //
      // Whether it will be tried again is part of the message: "failed" alone
      // reads the same for a blip and for a write that has just been given up
      // on, and only one of those is worth a writer's attention.
      const e = err as Partial<Record<"message" | "code" | "details" | "hint", string>>;
      console.warn(
        `[sync] ${key} failed${e?.code ? ` [${e.code}]` : ""}${
          retrying ? `, retrying (${tries}/${MAX_ATTEMPTS})` : ", giving up"
        }: ${e?.message ?? String(err)}`,
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

/**
 * The revision each chapter body was at when this browser last saw it.
 *
 * Module-level rather than captured in the job, because `enqueue` coalesces by
 * key: a rev read when the job was queued is the wrong one by the time it runs,
 * three saves later. The job reads it at execution time and writes back what the
 * server returned — the trigger bumps `rev` on our *own* successful push, so a
 * client that did not re-read it would report a conflict against itself on every
 * save after the first.
 */
const bodyRevs = new Map<string, number>();

/** Seeded by `applyRemote` from what the download carried. */
export function seedBodyRevs(revs: Map<string, number>) {
  for (const [chapterId, rev] of revs) bodyRevs.set(chapterId, rev);
}

/** Forgotten when the local library is cleared, or the next save is a conflict. */
export function forgetBodyRevs() {
  bodyRevs.clear();
}

/**
 * Somebody else moved this chapter's text; ours was not sent.
 *
 * The store subscribes so it can keep the local copy and say so. Set rather than
 * thrown because a conflict is not a failure — it is the guard doing its job, and
 * `flush`'s error path would log it as a broken sync.
 */
let onConflict: ((chapterId: string) => void) | null = null;
export function setConflictHandler(fn: (chapterId: string) => void) {
  onConflict = fn;
}

/**
 * A write this writer is no longer allowed to make.
 *
 * `42501` is Postgres refusing the row; `PGRST301` is PostgREST refusing the
 * request. Either means access was revoked while the tab was open, which the
 * writer has to be told — the alternative is a console line nobody reads and a
 * manuscript that quietly stops saving.
 */
let onDenied: ((table: string) => void) | null = null;
export function setDeniedHandler(fn: (table: string) => void) {
  onDenied = fn;
}

/**
 * Who owns this book, for a push.
 *
 * A book with no `ownerId` is one this browser made, so it belongs to whoever is
 * signed in. A book *with* one keeps it — which is the whole of not stealing
 * somebody else's manuscript, since every child row's `owner` used to come from
 * `currentOwner()`. The database no longer trusts this value either (a trigger
 * derives it), but sending the right one keeps the two halves saying the same
 * thing.
 *
 * **Signed out, there is no owner at all** — and that has to be checked before
 * the book's own field rather than after it. A book carries the `ownerId` of
 * the session that made it, so after a sign-out the stored value is still
 * there and still looks like an answer; returning it produced a push that was
 * well-formed, attributed to a real person, and sent with no credentials, so
 * only the database could tell it was wrong. `flush` now stops a signed-out
 * queue before any of this runs; this is the same rule stated where the
 * mistake was actually made.
 */
async function ownerOf(book: Book): Promise<string | null> {
  return pushOwner(book, await currentOwner());
}

/**
 * The decision on its own, pure and tested, because it is where the mistake
 * was: `book.ownerId ?? me` reads as "the book knows best, fall back to the
 * session", and it is the wrong way round. The session decides *whether* to
 * push at all; the book only decides who to attribute it to once there is a
 * session to push with.
 */
export function pushOwner(
  book: { ownerId?: string },
  me: string | null,
): string | null {
  if (!me) return null;
  return book.ownerId ?? me;
}

/**
 * Rows for a book's chapters, live and trashed, in one list.
 *
 * `positions` come from the full list before any filtering, so a row that survives
 * the `changed` filter still says where it really sits in the book.
 */
function chapterRowsOf(
  book: Book,
  owner: string,
  changed?: Set<string>,
): ChapterRow[] {
  const rows = [
    ...book.chapters.map((c, i) => chapterToRow(c, book.id, owner, i)),
    ...(book.trash ?? []).map((c, i) =>
      chapterToRow(c, book.id, owner, i, c.trashedAt),
    ),
  ];
  return changed ? rows.filter((r) => changed.has(r.id)) : rows;
}

/** So a whole library's worth of chapters does not each say the same thing. */
let warnedMissingUnnumbered = false;

/**
 * Chapter rows up, surviving a database that has not learned `unnumbered` yet.
 *
 * **PostgREST refuses the whole row for one unknown column**, so a shelf
 * carrying this field against a database without the migration would stop
 * syncing chapters entirely — prose, titles, order and all — for the sake of
 * one optional flag. That is the catastrophe `pushBook` already defends the
 * `publishing` column against, and this is the same answer in the same shape:
 * send it, and on that one error send what worked before.
 *
 * Both push paths go through here, the owner's and a collaborator's, because a
 * fallback only one of them has is a fallback that fails for somebody.
 */
async function upsertChapters(
  db: ReturnType<typeof createClient>,
  rows: ChapterRow[],
) {
  const { error } = await db.from("chapters").upsert(rows);
  if (!error) return;
  if (!missingColumn(error, "unnumbered")) throw denied(error, "chapters");

  if (!warnedMissingUnnumbered) {
    warnedMissingUnnumbered = true;
    console.warn(
      "[sync] the chapters table has no `unnumbered` column, so a chapter " +
        "taken out of the numbering is not being saved to the server. " +
        "Everything else is syncing normally. Apply " +
        "supabase/migrations/20260820000000_chapter_unnumbered.sql.",
    );
  }

  const without = rows.map((row) => {
    const copy = { ...row };
    delete copy.unnumbered;
    return copy;
  });
  const retry = await db.from("chapters").upsert(without);
  if (retry.error) throw denied(retry.error, "chapters");
}

/**
 * @param changed Which chapter ids actually differ from the last push, or
 *   undefined when there is no baseline to compare against and everything must
 *   go. **Sending only these is what keeps two writers from reverting each
 *   other** — see `changedChapterIds` in the store for the whole reasoning.
 *   Positions are still taken from the full list, so a filtered row carries its
 *   real place in the book rather than its index in the subset.
 */
/**
 * Chapter ids waiting to go up, per book, accumulated across coalesced pushes.
 *
 * **This exists because coalescing and a partial payload do not mix**, and the
 * two were introduced separately. `enqueue` replaces a job by key on the
 * reasoning that "only the newest state of a given row is worth sending" —
 * true of a body or of a book's own fields, where the newest copy contains
 * everything the older one had. It is false of `pushBook`, which carries a
 * *subset*: the newest job's `changed` set describes only the newest diff, so
 * every id named by the job it replaced was silently dropped.
 *
 * The shape of the loss is the giveaway. Making one chapter at a time is fine —
 * each push has time to run. Making thirty in a couple of minutes is one
 * `commit` per chapter, each enqueuing `book:<id>` with a single-chapter set,
 * each discarding the one before: only the last chapter of each flush window
 * reaches the server. Measured on a real library — 51 chapters locally, 27 on
 * the server, and every missing body reported as `23503 no chapter … to attach
 * this to`, which is the *body* correctly refusing to attach to a chapter row
 * that was never sent. The bodies were the symptom; this is the cause.
 *
 * `null` means "send the whole list" — what `undefined` means to `pushBook` —
 * and it wins over any set, because a push that was going to send everything
 * still has to.
 */
const pendingChapters = new Map<string, Set<string> | null>();

/**
 * What a coalesced push must carry: everything already waiting, plus this.
 *
 * Pure and exported because it is the decision the bug turned on, and the rest
 * of `pushBook` is Supabase I/O that cannot be tested here.
 *
 * `null` is "the whole list" on both sides, and it wins: a push that was going
 * to send everything still has to, and one that must send everything cannot be
 * narrowed by a later, smaller diff. `undefined` for `held` means nothing is
 * waiting yet.
 */
export function mergeChanged(
  held: Set<string> | null | undefined,
  incoming?: Set<string>,
): Set<string> | null {
  // A copy, never the caller's own set — the store builds that per commit and
  // is free to keep a reference to it.
  if (held === undefined) return incoming ? new Set(incoming) : null;
  if (held === null || !incoming) return null;
  for (const id of incoming) held.add(id);
  return held;
}

function rememberChanged(bookId: string, changed?: Set<string>) {
  pendingChapters.set(
    bookId,
    mergeChanged(pendingChapters.get(bookId), changed),
  );
}

export function pushBook(
  book: Book,
  position: number,
  changed?: Set<string>,
) {
  rememberChanged(book.id, changed);

  enqueue(`book:${book.id}`, async () => {
    /* Read at run time, not captured: everything queued since the last
       successful push is in here, including the ids from jobs this one
       replaced. Cleared only once the rows are away — a throw leaves it
       standing, so the retry carries the same work rather than the last
       fragment of it. */
    const held = pendingChapters.get(book.id);
    const changed = held === null || held === undefined ? undefined : held;
    const sent = () => pendingChapters.delete(book.id);
    const owner = await ownerOf(book);
    /* Signed out, so nothing is going anywhere and the queue is dropped rather
       than held (see `flush`). Letting go of the ids too keeps this map from
       being the one thing that outlives a sign-out. */
    if (!owner) {
      sent();
      return;
    }
    const me = await currentOwner();
    const db = createClient();

    /*
     * **A book somebody else owns: the chapter list only.**
     *
     * The `books` row carries the book's identity, its cover flag, its page
     * setup, its listing details — and `last_opened_*`, which is per-writer. It
     * is owner-only in the schema, so pushing it as a collaborator is a request
     * that will be refused; and it *should* be refused, because a co-writer's
     * reading position is not a fact about the owner's book.
     *
     * A viewer pushes nothing at all. The database would refuse them anyway; not
     * asking is what keeps a read-only session from filling the console with
     * denials on every keystroke.
     */
    // A viewer never pushes, so the ids are not waiting for anything.
    if (book.role === "viewer") {
      sent();
      return;
    }
    if (book.ownerId && me && book.ownerId !== me) {
      const rows = chapterRowsOf(book, owner, changed);
      if (rows.length === 0) {
        sent();
        return;
      }
      await upsertChapters(db, rows);
      sent();
      return;
    }

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
    //
    // The *owner's* push may still send the whole list: nobody else's copy of
    // their book can be stale in a way that matters, because they are the only
    // one who may write this row. `pushShelfDiff` sends only the changed rows for
    // a shared book — see the note there.
    const rows = chapterRowsOf(book, owner, changed);
    if (rows.length === 0) {
      sent();
      return;
    }
    await upsertChapters(db, rows);
    sent();
  });
}

/**
 * Prose, and the one guard that keeps two writers from overwriting each other.
 *
 * **A conditional update, not an upsert.** The row carries a `rev` the trigger
 * bumps on every write, so sending the rev we last saw makes the update match
 * nothing when somebody else has written since. Zero rows affected is the whole
 * signal: the local text is kept, the store is told, and the writer is asked
 * rather than having their paragraph replaced by somebody else's.
 *
 * Three things that make this correct rather than nearly correct:
 *
 * - **`.select()` is required.** PostgREST returns no rows from an `update`
 *   unless you ask, so without it every push looks like a conflict.
 * - **The returned rev is written back**, because the trigger bumped it for *us*
 *   too. A client that skipped this would conflict with itself on the second
 *   save of every session.
 * - **A rev we do not have means insert**, which is a chapter whose body has never
 *   been sent. A duplicate key there is somebody else having got in first, so it
 *   is a conflict like any other.
 *
 * `owner` is not sent at all any more: the trigger derives it from the book, and
 * sending a value the database ignores is a lie about who decides.
 */
export function pushBody(chapterId: string, raw: string) {
  enqueue(`body:${chapterId}`, async () => {
    const doc = safeParse(raw);
    if (doc === null) return; // NOT NULL, and unreadable text is not worth sending
    const db = createClient();

    /*
     * **No column, no guard, and the old behaviour exactly.**
     *
     * A database without 20260806000000 has nothing to compare against, so prose
     * resolves last-write-wins as it always did. Saying so once is better than
     * failing every save, and better than pretending to a guard that is not there.
     */
    if (!hasRevColumn) {
      const { error } = await db
        .from("chapter_bodies")
        .upsert({ chapter_id: chapterId, owner: await currentOwner(), doc });
      if (error) throw denied(error, "chapter_bodies");
      return;
    }

    /*
     * A chapter whose revision we have never seen. Read it rather than guessing:
     * inserting and treating the duplicate-key as a conflict was wrong, because
     * "this body exists on the server and was not in our download" is not the same
     * thing as "somebody edited it while we were typing" — and reporting the
     * second when it was the first puts a conflict banner on a chapter nobody
     * else has touched.
     */
    let seen = bodyRevs.get(chapterId);
    if (seen === undefined) {
      const { data, error } = await db
        .from("chapter_bodies")
        .select("rev")
        .eq("chapter_id", chapterId)
        .maybeSingle();

      if (error) {
        if (missingColumn(error, "rev")) {
          hasRevColumn = false;
          return pushBody(chapterId, raw); // once more, down the plain path
        }
        throw denied(error, "chapter_bodies");
      }
      if (data) {
        seen = count(data.rev);
        bodyRevs.set(chapterId, seen);
      }
    }

    // Still nothing: the server has no body for this chapter, so this is the
    // first save of a new one.
    if (seen === undefined) {
      const { data, error } = await db
        .from("chapter_bodies")
        .insert({ chapter_id: chapterId, doc })
        .select("rev")
        .maybeSingle();
      // 23505 means somebody inserted between our read and our write, which is
      // the race the guard is for.
      if (error?.code === "23505") return conflict(chapterId);
      if (error) throw denied(error, "chapter_bodies");
      if (data) bodyRevs.set(chapterId, count(data.rev));
      return;
    }

    const { data, error } = await db
      .from("chapter_bodies")
      .update({ doc })
      .eq("chapter_id", chapterId)
      .eq("rev", seen)
      .select("rev")
      .maybeSingle();

    if (error) throw denied(error, "chapter_bodies");
    // Zero rows and no error: the rev moved, so somebody else wrote this chapter.
    if (data === null) return conflict(chapterId);
    bodyRevs.set(chapterId, count(data.rev));
  });
}

/** Kept out of `flush`'s error path: a conflict is the guard working, not a fault. */
function conflict(chapterId: string) {
  onConflict?.(chapterId);
}

export function pushNotes(chapterId: string, text: string) {
  enqueue(`notes:${chapterId}`, async () => {
    const owner = await currentOwner();
    if (!owner) return;
    const { error } = await createClient()
      .from("chapter_notes")
      /*
       * `owner` is still sent, even though a trigger now derives it.
       *
       * The column is NOT NULL, and the trigger arrives with
       * 20260806000000 — so a database without that migration would refuse a row
       * that omitted it. Where the trigger *does* exist it overwrites this with
       * the book's owner, which is what stops a note on a shared chapter being
       * filed under whoever typed it. Sending the signed-in writer is right in
       * the only case that can reach here without a trigger: an unshared chapter,
       * because sharing cannot exist before the migration that creates it.
       */
      .upsert({ chapter_id: chapterId, owner, text });
    if (error) throw denied(error, "chapter_notes");
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
        // `owner` sent for the reason given in `pushNotes`: NOT NULL, and the
        // trigger that would derive it does not exist before 20260806000000. A
        // cover is owner-only either way.
        : await db
            .from("book_covers")
            .upsert({ book_id: bookId, owner, data_url: dataUrl });
    if (error) throw denied(error, "book_covers");
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

/**
 * A chapter gone for good — emptied from the trash, or never trashed at all.
 *
 * **Only for a book this writer owns**, and the caller is what enforces it (see
 * `pushShelfDiff`). An editor has no DELETE on `chapters` by design: their delete
 * is `trashed_at`, an update, so a restore stays lossless. A hard delete cascades
 * to the prose and the notes, and this call is made from a *local* diff — so any
 * local shelf that lost a chapter for any reason, a quota-truncated download
 * included, would become a delete statement against somebody else's manuscript.
 */
export function pushChapterDeleted(chapterId: string) {
  enqueue(`chapter:${chapterId}`, async () => {
    const { error } = await createClient()
      .from("chapters")
      .delete()
      .eq("id", chapterId);
    if (error) throw denied(error, "chapters");
    bodyRevs.delete(chapterId);
  });
}

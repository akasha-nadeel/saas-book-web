import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * The activity record: which features a signed-in writer used, and when.
 *
 * **Not `activity.ts`**, which is the writer's own words-per-day log, kept in
 * their browser and shown back to them. This one goes to the server and is
 * read only by the operator, and it carries no word counts at all.
 *
 * This is what the admin dashboard reads to answer "who comes back" and "what
 * gets used" — questions the rest of the database cannot answer, because a
 * session lasts 400 days and `last_sign_in_at` therefore barely moves.
 *
 * **What a row may carry is the whole design.** A kind and a detail, both
 * drawn from the fixed lists below, and a book's id. No title, no text, no
 * URL, nothing a writer typed. The table has no free-text column and its CHECK
 * constraints repeat these lists, so a release that tried to send a sentence
 * would be refused by Postgres rather than stored. `activity.test.ts` reads
 * the migration and fails if the two ever disagree. /privacy names the record.
 *
 * **It never gets in the way.** `noteActivity` is fire-and-forget: it returns
 * at once, never throws, does nothing for a local-only or signed-out writer,
 * and swallows a missing table, so a project without
 * `20261005000000_admin_insights.sql` behaves exactly as before.
 */

/** Matches the `kind` CHECK in the migration, in the same order. */
export const ACTIVITY_KINDS = [
  "app_open",
  "book_open",
  "writing",
  "book_created",
  "import_done",
  "export_done",
  "title_check_run",
  "price_check_run",
  "consistency_run",
  "paperback_open",
  "provenance_open",
  "pricing_view",
  "checkout_start",
  "limit_hit",
] as const;

export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/**
 * The details each kind may carry. A kind missing here carries none.
 *
 * `md` is an imported file's extension and `markdown` is the export format's
 * own name (`Format` in `export/index.ts`), so both are on the list.
 */
export const ACTIVITY_DETAILS = {
  book_created: ["blank", "import"],
  import_done: ["docx", "epub", "md", "txt", "html"],
  export_done: ["docx", "epub", "markdown", "pdf"],
  checkout_start: ["monthly", "annual"],
  limit_hit: [
    "books",
    "titleCheck",
    "priceCheck",
    "comps",
    "covers",
    "blurb",
    "prose",
    "track",
    "arcReaders",
    "ideas",
    "seats",
    "checks",
    "paperback",
  ],
} as const satisfies Partial<Record<ActivityKind, readonly string[]>>;

type Detailed = keyof typeof ACTIVITY_DETAILS;

export type DetailOf<K extends ActivityKind> = K extends Detailed
  ? (typeof ACTIVITY_DETAILS)[K][number]
  : never;

export type LimitDetail = DetailOf<"limit_hit">;

/** Every detail on every list, once — what the SQL CHECK holds. */
export function allDetails(): string[] {
  return [...new Set(Object.values(ACTIVITY_DETAILS).flat())];
}

/**
 * The kinds worth one row per half hour: being here, rather than doing a
 * thing. The database collapses them over the same window, so sending more
 * often would only be requests it drops.
 */
const PRESENCE: ReadonlySet<ActivityKind> = new Set([
  "app_open",
  "book_open",
  "writing",
]);

const PRESENCE_MS = 30 * 60 * 1000;
const REPEAT_MS = 10 * 1000;

/** Whether a note made at `now` should go, given when the same one last went. */
export function shouldSend(
  kind: ActivityKind,
  last: number | undefined,
  now: number,
): boolean {
  if (last === undefined) return true;
  return now - last >= (PRESENCE.has(kind) ? PRESENCE_MS : REPEAT_MS);
}

/**
 * A book id, or null when the value is not shaped like one. The database
 * checks the same pattern; this keeps a bad value from costing the whole row.
 */
export function cleanBookId(value: string | null | undefined): string | null {
  return typeof value === "string" && /^[A-Za-z0-9-]{1,64}$/.test(value)
    ? value
    : null;
}

const lastSent = new Map<string, number>();

/**
 * Only a positive answer is kept. A writer who signs in arrives on a full
 * page load, which starts this module over, so a stale "yes" cannot outlive
 * the session — but a "no" caused by a network blip should not silence the
 * rest of the visit.
 */
let signedIn = false;

async function isSignedIn(): Promise<boolean> {
  if (signedIn) return true;
  try {
    const { data } = await createClient().auth.getClaims();
    signedIn = Boolean(data?.claims?.sub);
  } catch {
    signedIn = false;
  }
  return signedIn;
}

type Row = { kind: ActivityKind; detail: string | null; book_id: string | null };

async function send(row: Row): Promise<void> {
  try {
    if (!(await isSignedIn())) return;

    // `owner` is left off deliberately — the column defaults to auth.uid() and
    // the grant does not even allow it to be named.
    const { error } = await createClient().from("activity_events").insert(row);

    // PGRST205 is a table that was never created, 42P01 one that went missing
    // under PostgREST's cache: the migration is not on this project, which is
    // a state this module is written to live in quietly. Anything else is
    // logged with its code in full, because a missing grant reads as 42501
    // and nothing like an RLS refusal.
    if (error && error.code !== "PGRST205" && error.code !== "42P01") {
      console.warn(`[activity] ${row.kind} not recorded [${error.code}] ${error.message}`);
    }
  } catch {
    // Offline, or Supabase unreachable. The record is a convenience; losing
    // one row is not worth a word to the writer.
  }
}

const IMPORT_EXTENSIONS: Record<string, DetailOf<"import_done">> = {
  docx: "docx",
  epub: "epub",
  md: "md",
  markdown: "md",
  txt: "txt",
  html: "html",
  htm: "html",
};

/** Which import a file name is, by the same extensions `IMPORT_ACCEPT` takes. */
export function importDetail(fileName: string): DetailOf<"import_done"> | null {
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return null;
  return IMPORT_EXTENSIONS[fileName.slice(dot + 1).toLowerCase()] ?? null;
}

/** A file was read. Only its format is recorded — never its name. */
export function noteImport(fileName: string, bookId?: string | null): void {
  const detail = importDetail(fileName);
  if (detail) noteActivity("import_done", { detail, bookId });
}

type Note<K extends ActivityKind> = [DetailOf<K>] extends [never]
  ? [note?: { bookId?: string | null }]
  : [note: { detail: DetailOf<K>; bookId?: string | null }];

/**
 * Record that a writer did something. Returns at once; never throws.
 *
 * The detail is required exactly where the kind has a list of them, so the
 * compiler refuses an export with no format and an app_open with one.
 */
export function noteActivity<K extends ActivityKind>(
  kind: K,
  ...[note]: Note<K>
): void {
  if (typeof window === "undefined" || !isSupabaseConfigured()) return;

  const detail =
    note && "detail" in note ? (note.detail as string | null) : null;
  const bookId = cleanBookId(note?.bookId);

  const key = `${kind}|${detail ?? ""}|${bookId ?? ""}`;
  const now = Date.now();
  if (!shouldSend(kind, lastSent.get(key), now)) return;
  lastSent.set(key, now);

  void send({ kind, detail, book_id: bookId });
}

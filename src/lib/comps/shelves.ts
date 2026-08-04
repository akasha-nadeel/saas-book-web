import type { SubjectCount } from "./subjects";

/**
 * Where a shop would file this book, worked out from where comparable books
 * are filed — and the honest limits of saying so.
 *
 * `subjects.ts` answers "what is this book, to a librarian", because that is
 * what the two free catalogues record. The writer's actual problem is a
 * different one: KDP asks them to pick **three categories out of Amazon's own
 * store tree**, which is not the librarian's vocabulary and is not published
 * anywhere we can read. Translating between the two is a judgement, and it is
 * the one thing in this cluster a model is for.
 *
 * **Three refusals hold it together, and they are the whole design.**
 *
 * **No search volume, ever.** That is the number a writer wants and it cannot
 * be had honestly. Amazon publishes none; its Product Advertising API shut
 * down in May 2026 and its replacement needs ten affiliate sales a month to
 * keep; the tools quoting a figure buy scraped data from a vendor. A volume or
 * a "competition score" invented here would sit beside real books on a screen
 * about money, which makes it the most believable invented number the app
 * could print. The type below has nowhere to put one.
 *
 * **The counts are ours, never the model's.** How many comparable books carry
 * a subject is something we counted in `rankSubjects`, and it is re-attached
 * here after parsing. Asked for a count a model will produce a plausible one,
 * and a plausible count is indistinguishable from a real one.
 *
 * **A path is a candidate, not a fact.** Only Amazon knows its own tree, it
 * changes it, and it dropped BISAC codes for store categories in 2023. So a
 * suggestion is something to type into the KDP selector and confirm, and the
 * screen has to say so. Nothing here claims to have read Amazon.
 */

/** As many as KDP takes. Suggesting more is suggesting the writer choose. */
export const MAX_PATHS = 6;

/** KDP's own limit: three categories per format. */
export const KDP_CATEGORIES = 3;

/** One place a shop might file the book. */
export interface Shelf {
  /**
   * The path as the model wrote it, e.g. `Mystery, Thriller & Suspense >
   * Mystery > Cozy`. Kept as one string rather than split into parts, because
   * we cannot verify the levels and splitting would imply we had.
   */
  path: string;
  /** Why, in a sentence. The model's own words. */
  reason: string;
  /**
   * The librarian subjects this was drawn from, and how many of the fetched
   * books carried each. Counted by us — see the note above.
   */
  from: SubjectCount[];
}

export interface ShelfReading {
  shelves: Shelf[];
  /** Absent when the model answered without one, rather than filled in. */
  note: string | null;
}

/** The subjects worth handing over: the ones enough books actually share. */
export function seedSubjects(
  counts: readonly SubjectCount[],
  limit = 14,
): SubjectCount[] {
  return counts.filter((s) => s.count > 1).slice(0, limit);
}

/**
 * Turn whatever the model said into shelves, or into nothing.
 *
 * Written against hostile input for the same reason `rank.ts` is: this is
 * generated text, which is neither our input nor the user's. It arrives
 * wrapped in prose, fenced, as a bare array, with a count it invented, with a
 * path that is an empty string. None of that may reach a screen.
 */
export function parseShelves(
  raw: string,
  counts: readonly SubjectCount[],
): ShelfReading {
  const payload = extractJson(raw);
  if (!payload) return { shelves: [], note: null };

  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as Record<string, unknown>).shelves)
      ? ((payload as Record<string, unknown>).shelves as unknown[])
      : [];

  // Our own counts, to re-attach by name. Anything the model names that we did
  // not count is dropped rather than shown with a number we cannot stand behind.
  const known = new Map(counts.map((c) => [c.name.toLowerCase(), c]));

  const seen = new Set<string>();
  const shelves: Shelf[] = [];

  for (const row of rows) {
    if (shelves.length >= MAX_PATHS) break;
    const r = row as Record<string, unknown>;

    const path = typeof r?.path === "string" ? tidy(r.path) : "";
    if (!path) continue;

    const key = path.toLowerCase();
    if (seen.has(key)) continue;

    const reason = typeof r.reason === "string" ? r.reason.trim() : "";
    // A shelf with no reason is a bare assertion, which is the thing this
    // feature exists not to be.
    if (!reason) continue;

    const from = Array.isArray(r.from)
      ? r.from
          .map((name) =>
            typeof name === "string" ? known.get(name.trim().toLowerCase()) : undefined,
          )
          .filter((c): c is SubjectCount => c !== undefined)
      : [];

    seen.add(key);
    shelves.push({ path, reason: cut(reason, 240), from: dedupe(from) });
  }

  const note =
    !Array.isArray(payload) && typeof (payload as Record<string, unknown>).note === "string"
      ? cut(((payload as Record<string, unknown>).note as string).trim(), 400)
      : "";

  return { shelves, note: note || null };
}

/* -------------------------------------------------------------------------- */

/**
 * Normalise the separators a model writes a path with.
 *
 * `>`, `›`, `/` and ` - ` all turn up for the same idea. One shape, so two
 * suggestions of the same shelf collapse rather than both being shown.
 */
function tidy(path: string): string {
  return path
    .replace(/\s*(?:>|›|»|\/|\|)\s*/g, " > ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^>\s*|\s*>$/g, "");
}

function dedupe(counts: SubjectCount[]): SubjectCount[] {
  const by = new Map<string, SubjectCount>();
  for (const c of counts) if (!by.has(c.name)) by.set(c.name, c);
  return [...by.values()];
}

/**
 * The first JSON value in a piece of text.
 *
 * The clean parse is tried before any bracket scan, for the reason `rank.ts`
 * records: scanning a bare array for `{` finds the first element's brace and
 * parses one row as the whole reply.
 */
function extractJson(raw: string): unknown {
  const text = raw.trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    // Wrapped in something. Fall through to the scan.
  }

  const spans = ([
    ["{", "}"],
    ["[", "]"],
  ] as const)
    .map(([open, close]) => ({
      from: text.indexOf(open),
      to: text.lastIndexOf(close),
    }))
    .filter((s) => s.from !== -1 && s.to > s.from)
    .sort((a, b) => a.from - b.from);

  for (const { from, to } of spans) {
    try {
      return JSON.parse(text.slice(from, to + 1));
    } catch {
      // Try the other bracket shape before giving up.
    }
  }
  return null;
}

function cut(text: string, max: number): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const window = clean.slice(0, max);
  const space = window.lastIndexOf(" ");
  return `${(space > max / 2 ? window.slice(0, space) : window).trimEnd()}…`;
}

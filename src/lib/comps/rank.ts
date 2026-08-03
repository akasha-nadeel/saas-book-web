import type { Block } from "../export/blocks";
import type { CompTitle } from "./comps";

/**
 * Which of the comps are actually like this book — the one place in the
 * cluster where a model earns its cost.
 *
 * Everything else around comps is a plain request and some arithmetic: no key,
 * no model, no bill. But a keyword search returns forty books of which perhaps
 * five are genuinely comparable, and sorting those five out is a fuzzy
 * judgement rather than a query. That is what a model is for, and it is the
 * whole of what this one is asked to do.
 *
 * Three rules hold the feature to the house style.
 *
 * **There is no score, and there is no field to put one in.** Not "87% match",
 * not four stars, not a confidence. A number here would be invented — there is
 * nothing being measured — and it would be the most believable invented number
 * in the app, because it would sit in a list of real books. What comes back is
 * an order and a reason in words, which is what a judgement actually is. A test
 * asserts the shape carries no number, and it is one of the tests not to fix.
 *
 * **The model may only choose from books that were fetched.** It is handed a
 * numbered list and answers with numbers; anything outside the range is
 * dropped, silently and by design. A language model asked about books will
 * happily produce a plausible title that does not exist, and a made-up comp on
 * a screen a writer is about to paste into a query letter is the worst failure
 * this feature has available to it.
 *
 * **Nothing is written into the book.** It reads and reports, like the
 * assistant and like the prose report: no rewritten blurb, no "apply these
 * comps", no categories set on the writer's behalf.
 *
 * The parsing lives here rather than in the route so it can be tested against
 * the answers a model actually gives — including the malformed ones, which are
 * the interesting half.
 */

/** As many as a query letter or a listing has room for. */
export const MAX_PICKS = 5;

/** Enough to judge from, few enough to pay for. */
export const MAX_CANDIDATES = 20;

/** A blurb runs to a paragraph; anything longer is a paste. */
export const MAX_BLURB = 2000;

/**
 * How much of the opening chapter goes.
 *
 * Voice is what this is for, and voice is legible in the first page or two —
 * so this is deliberately not "the chapter". It is the smallest sample that
 * answers the question, which keeps the bill down and keeps the amount of
 * somebody's unpublished manuscript crossing the network to the least that
 * does the job.
 */
export const MAX_OPENING = 6000;

/** One candidate, as the model is shown it. */
export interface Candidate {
  /** 1-based, and the only handle the model is given. */
  id: number;
  title: string;
  authors: string;
  year?: number;
  subjects: string;
  blurb?: string;
}

/** One book the model picked, and why it said so. */
export interface RankedComp {
  book: CompTitle;
  /** The model's own words. Never a score, never a grade. */
  reason: string;
}

export interface Ranking {
  picks: RankedComp[];
  /**
   * What the picked books have in common, in a sentence or two — the third of
   * the three jobs. Null when the model did not answer with one, rather than a
   * filled-in platitude.
   */
  pattern: string | null;
}

/* -------------------------------------------------------------------------- */
/* Going out                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The comps, trimmed to what a judgement needs.
 *
 * Blurbs are cut hard: the question is "is this the same kind of book", which
 * a first paragraph answers, and twenty full descriptions is most of the cost
 * of the call for the least of its value.
 */
export function candidatesFrom(books: readonly CompTitle[]): Candidate[] {
  return books.slice(0, MAX_CANDIDATES).map((book, i) => ({
    id: i + 1,
    title: book.title,
    authors: book.authors.join(", "),
    ...(book.year === undefined ? {} : { year: book.year }),
    subjects: book.subjects.slice(0, 6).join(", "),
    ...(book.description
      ? { blurb: cut(book.description, 400) }
      : {}),
  }));
}

/**
 * A chapter's prose as plain text, with its paragraphs still in it.
 *
 * Through the export path's blocks rather than `chapterText()` from search.ts,
 * which collapses all whitespace: that is right for a search index and wrong
 * here, because paragraphing is part of what "does this sound like that book"
 * is asking about, and a wall of run-together text is a worse sample than a
 * shorter one with its shape intact.
 *
 * Images are dropped rather than described. A `data:` URL is a megabyte of
 * base64 that says nothing about voice, and it is the writer's picture.
 */
export function proseFrom(blocks: readonly Block[]): string {
  return blocks
    .filter((block) => block.kind !== "image")
    .map((block) => block.runs.map((run) => run.text).join("").trim())
    .filter(Boolean)
    .join("\n\n");
}

/**
 * The opening of the manuscript, cut at a paragraph.
 *
 * Cutting mid-sentence would be cheaper to write and worse to read: the model
 * is being asked to judge voice, and a severed clause is a false signal about
 * how the writer ends their sentences. Same reasoning as `speechChunks()` in
 * the narrator, at a coarser grain — the largest boundary that fits, then the
 * next largest, and only then a hard cut.
 */
export function openingFrom(text: string, max = MAX_OPENING): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;

  const window = clean.slice(0, max);
  for (const boundary of ["\n\n", "\n", ". "]) {
    const at = window.lastIndexOf(boundary);
    // Past halfway, or the cut throws away more than it keeps.
    if (at > max / 2) return window.slice(0, at).trim();
  }
  return window.trim();
}

/* -------------------------------------------------------------------------- */
/* Coming back                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Turn whatever the model said into picks, or into nothing.
 *
 * Everything about this function assumes the input is hostile, because it is
 * not user input and it is not our input either — it is generated text, which
 * is a third thing. It can arrive wrapped in prose, fenced in backticks, with
 * a trailing comma, with an id nobody offered, with the same book twice, with
 * a reason that is four paragraphs long, or with the whole thing as a bare
 * array. All of those are seen in practice, and none of them may reach a
 * screen a writer is going to trust.
 *
 * What it will never do is *repair* a book: an id outside the range is
 * dropped, not guessed at. Better five picks than six with an invention in it.
 */
export function parseRanking(
  raw: string,
  books: readonly CompTitle[],
): Ranking {
  const payload = extractJson(raw);
  if (!payload) return { picks: [], pattern: null };

  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as Record<string, unknown>).picks)
      ? ((payload as Record<string, unknown>).picks as unknown[])
      : [];

  const seen = new Set<number>();
  const picks: RankedComp[] = [];

  for (const row of rows) {
    if (picks.length >= MAX_PICKS) break;
    const r = row as Record<string, unknown>;
    const id = Number(r?.id);
    if (!Number.isInteger(id) || id < 1 || id > books.length) continue;
    if (seen.has(id)) continue;

    const reason = typeof r.reason === "string" ? r.reason.trim() : "";
    // A pick with no reason is a bare assertion, which is the thing this
    // feature exists not to be. Dropped rather than shown wordless.
    if (!reason) continue;

    seen.add(id);
    picks.push({ book: books[id - 1], reason: cut(reason, 300) });
  }

  const pattern =
    !Array.isArray(payload) &&
    typeof (payload as Record<string, unknown>).pattern === "string"
      ? cut(((payload as Record<string, unknown>).pattern as string).trim(), 500)
      : "";

  return { picks, pattern: pattern || null };
}

/** The books that came back and were not picked, in the order they arrived. */
export function restOf(
  books: readonly CompTitle[],
  picks: readonly RankedComp[],
): CompTitle[] {
  const chosen = new Set(picks.map((p) => p.book.key));
  return books.filter((b) => !chosen.has(b.key));
}

/* -------------------------------------------------------------------------- */

/**
 * The first JSON value in a piece of text.
 *
 * Models are asked for JSON and mostly send JSON, and sometimes send "Here is
 * the ranking:" and then JSON, or fence it in backticks. The clean answer is
 * tried whole first and the scan is the fallback, in that order and not the
 * other way round — scanning a bare array for `{` finds the *first element's*
 * brace and parses one pick as if it were the whole reply, which loses every
 * other pick silently. That is exactly the failure this function exists to
 * prevent, and it is why the two bracket shapes are tried in the order they
 * appear rather than braces-first.
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
    .filter((span) => span.from !== -1 && span.to > span.from)
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

/** Trim to a length without ending mid-word. */
function cut(text: string, max: number): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const window = clean.slice(0, max);
  const space = window.lastIndexOf(" ");
  return `${(space > max / 2 ? window.slice(0, space) : window).trimEnd()}…`;
}

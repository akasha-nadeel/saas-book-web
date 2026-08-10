/**
 * What a reader would still be asking after your blurb — and nothing else.
 *
 * **This reads and reports. It does not write.** That is the standing rule the
 * whole product rests on, and this is the one feature where breaking it would
 * have been easiest to justify: writers say the blurb is the thing they are
 * worst at, a dozen free tools will generate one, and the stores permit it —
 * Amazon's AI disclosure covers the manuscript, while the description is
 * metadata and needs no declaration at all. So the refusal here is a choice
 * rather than a restriction, and it is worth recording why it survived the
 * question being asked directly:
 *
 * - **A generated blurb is generic in exactly the place a blurb cannot afford
 *   to be.** What readers use to spot machine copy is vagueness — the absence
 *   of specific, odd detail — and a blurb's whole job is to be more specific
 *   than the forty books beside it on the shelf.
 * - **Generating one honestly means reading the book, and reading the book
 *   ruins it.** A blurb stops around the inciting incident; a model that has
 *   read to the end writes a synopsis with the ending in it. More of the
 *   manuscript makes the output worse at the job, not better.
 * - **The market sells generation and nobody sells this.** Being told that your
 *   blurb never names the antagonist is worth more than a paragraph you did not
 *   write, and it is the half no competitor offers.
 *
 * **Nothing from the manuscript is sent.** What leaves is the blurb the writer
 * typed, the title, and the genre they chose — the same category of thing the
 * comps search sends, and the reason this route does not appear in the list of
 * places prose can leave. Keep it that way: the moment this sends a chapter, it
 * needs a line on the privacy page and a sentence on the screen.
 */

/** One thing the blurb leaves unanswered. */
export interface Question {
  /** What it is about, in two or three words — the label on the row. */
  about: string;
  /** One sentence naming what is missing. Never a replacement for it. */
  note: string;
}

export interface Critique {
  questions: Question[];
}

/** More than this is a list nobody acts on. Six is already generous. */
export const MAX_QUESTIONS = 6;

/**
 * Below this there is nothing to read, and it is stated once here because both
 * sides need it: the screen greys the control and says why, and the route
 * refuses anyway, since a browser is not where a limit is enforced.
 *
 * It is a length rather than a judgement. Forty characters is a sentence
 * fragment, not a short blurb — a genuinely short description is a legitimate
 * thing to have read.
 */
export const MIN_BLURB = 40;

/**
 * The ceiling on one note.
 *
 * **This is the guard that keeps the feature from becoming the thing it
 * refuses.** A model asked what a blurb is missing will, sooner or later,
 * helpfully supply the missing sentence — and a "note" carrying two hundred
 * words of replacement copy is a generated blurb arriving through the back
 * door, in a field nobody is reading as one. There is no rewrite field in the
 * shape above, and anything long enough to be one is dropped rather than
 * truncated: a note cut mid-clause reads as our bug rather than as a limit.
 */
const MAX_NOTE = 260;

/** Two or three words. Anything longer is a sentence in the wrong column. */
const MAX_ABOUT = 40;

export const CRITIQUE_SYSTEM = `You are a bookshop browser who has just read the
description on a book's page and is deciding whether to buy it. You are helping
a self-publishing author see what their description does not tell you.

You will be given the description, and possibly the book's title and genre. You
have NOT read the book, and you must not pretend otherwise.

Name at most ${MAX_QUESTIONS} things a reader would still be asking. Look for:
- who the story is about, and what they want
- what stands in the way, and what it costs them if they fail
- where and when it happens, if that matters to the kind of book it is
- who this book is for, and what reading it will feel like
- anything stated so generally it would fit any book in the genre

Rules:
- Quote the description's own words when you name something. "Vague" is not a
  finding; "the only thing said about the antagonist is 'a dark force'" is.
- Say what is MISSING. Do NOT write the missing part. Do not supply replacement
  sentences, rewritten openings, suggested wording, or a rewritten description.
  The author writes their own book description; you are only telling them what
  a reader cannot find in it.
- Give NO score, rating, grade, percentage, or mark out of anything. There is
  no such measurement and an invented one would be the most believable false
  thing on the page.
- If the description genuinely answers all of it, reply with an empty list. An
  invented complaint is worse than a short answer.
- Judge it as a book description, not as prose. Short is not a fault.

Reply with JSON only:
{"questions":[{"about":"<two or three words>","note":"<one sentence>"}]}`;

/** What is actually sent, assembled where it can be read and tested. */
export function critiquePrompt(input: {
  blurb: string;
  title?: string;
  genre?: string;
}): string {
  const title = (input.title ?? "").trim();
  const genre = (input.genre ?? "").trim();

  return [
    title ? `Title: ${title}` : "The writer has not set a title.",
    genre ? `Genre: ${genre}` : "The writer has not set a genre.",
    "Description:",
    input.blurb.trim(),
  ].join("\n\n");
}

/**
 * Turn whatever the model said into questions, or into nothing.
 *
 * Written against hostile input for the reason `rank.ts` and `shelves.ts` are:
 * this is generated text, which is neither our input nor the writer's. It
 * arrives wrapped in prose, fenced, as a bare array, with a score it invented,
 * with an empty note, and — the one specific to this feature — with the missing
 * sentence helpfully written out. None of that may reach a screen.
 */
export function parseCritique(raw: string): Critique {
  const payload = extractJson(raw);
  if (!payload) return { questions: [] };

  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as Record<string, unknown>).questions)
      ? ((payload as Record<string, unknown>).questions as unknown[])
      : [];

  const seen = new Set<string>();
  const questions: Question[] = [];

  for (const row of rows) {
    if (questions.length >= MAX_QUESTIONS) break;

    const r = row as Record<string, unknown>;
    const about = typeof r?.about === "string" ? r.about.trim() : "";
    const note = typeof r?.note === "string" ? r.note.trim() : "";

    // Both halves or neither: a label with no note says nothing, and a note
    // with no label has nowhere to sit in a list of rows.
    if (!about || !note) continue;
    if (about.length > MAX_ABOUT) continue;
    // See MAX_NOTE. This is the rewrite guard, not a formatting preference.
    if (note.length > MAX_NOTE) continue;

    const key = about.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    // Only these two fields are carried over. A score, a rating, a rewritten
    // blurb or anything else the model decided to add is dropped here rather
    // than filtered on screen, because this is the side a reader with devtools
    // cannot edit.
    questions.push({ about, note });
  }

  return { questions };
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

  const spans = (
    [
      ["{", "}"],
      ["[", "]"],
    ] as const
  )
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

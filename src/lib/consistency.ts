/**
 * What this book spells more than one way.
 *
 * From the research into what novelists actually buy: the most-used report in
 * ProWritingAid is not the grammar one. It is the consistency pass — a
 * character called "Katherine" for twelve chapters and "Catherine" in chapter
 * thirty, "grey" becoming "gray" halfway through, a compound that gains and
 * loses its hyphen. Writers run it first, every time, and it is the reason they
 * keep that tool even while paying for Grammarly as well.
 *
 * **It is also the one check that needs the whole book.** A chapter cannot
 * disagree with itself about a name; it disagrees with chapter four. Every
 * general-purpose checker sees one pasted document and structurally cannot find
 * this. We hold the manuscript, so we can.
 *
 * **This module is built around being wrong, not around being thorough.** The
 * loudest complaint about every tool in this trade is the false positive: a
 * writer told five times that their deliberate sentence is broken stops reading
 * the sixth, and everything after that is noise. So every check below carries
 * its guard rails written down beside it, each one costs real findings, and
 * that trade is the whole design.
 *
 * **Nothing here is a verdict.** No score, no grade, no "consistency rating".
 * Two spellings appear; here is where each one is. Whether they are one thing
 * spelled twice or two things spelled once is the writer's to say — and for
 * names it is a judgement this module explicitly refuses to make. See
 * `mergeSeriesBible` in `series.ts`, which refuses the same thing for the same
 * reason: a writer can see a duplicate and cannot see a merge.
 *
 * **Echoes are not here.** `echoes()` in `prose.ts` already does per-chapter
 * repetition, which is the other half of what ProWritingAid is used for. One
 * copy of that, in the report it belongs to.
 */

import { sentencesIn } from "./prose";
import { NAME_WORDS } from "./name-words";
import { SPELLING_PAIRS } from "./spelling-pairs";
import { STYLE_PAIRS } from "./style-pairs";

/** One chapter's prose, paragraphs intact. */
export interface BookText {
  chapterId: string;
  title: string;
  /** Body-chapter number, or null for a page named rather than numbered. */
  number: number | null;
  /** `proseFrom(toBlocks(doc))` — paragraphs joined by a blank line. */
  text: string;
  /**
   * Every scene break in this chapter, in reading order. `null` is a real one;
   * a string is one somebody typed into a paragraph, exactly as written.
   *
   * **It has to come in separately because a real break is invisible in
   * `text`.** `toBlocks` turns a horizontal rule into a `sceneBreak` block with
   * no runs, and `proseFrom` maps every block to its runs and drops the empty
   * results — so by the time prose exists the break is gone. The importer, on
   * the other hand, has no separator handling at all, so an imported `***`
   * survives as an ordinary paragraph. One book can hold both, and the
   * difference is invisible until the file is exported.
   *
   * Optional because a caller that has only prose is still a legitimate caller;
   * the check simply has nothing to say about it.
   */
  breaks?: readonly (string | null)[];
}

/** Where one spelling appears, and how often, in one chapter. */
export interface Where {
  chapterId: string;
  chapterTitle: string;
  number: number | null;
  count: number;
  /**
   * One sentence from *this* chapter, so the spelling can be read in place.
   *
   * There was one example per *spelling* before, which is one sentence for the
   * whole book — enough to prove a word exists and not enough to show a writer
   * what chapter thirty actually says. The card draws a chapter and its line
   * together, so the line has to hang off the chapter.
   */
  example?: string;
}

/** One spelling of a thing this book spells more than one way. */
export interface Variant {
  /** Exactly as it appears in the manuscript. */
  text: string;
  /** Across the whole book. */
  count: number;
  /** Every chapter it appears in, in reading order. */
  where: Where[];
  /** One sentence it lives in, so the writer can see it in place. */
  example?: string;
}

/**
 * One place in the book, for the checks that point at a sentence.
 *
 * Two of the six are not about a thing spelled two ways at all — a word typed
 * twice, a quotation mark left open — and forcing those into `Variant` would
 * make the commoner shape lie about itself.
 */
export interface Occurrence {
  chapterId: string;
  chapterTitle: string;
  number: number | null;
  text: string;
  /** What was found, so the screen can mark it without re-deriving it. */
  mark: string;
}

export type CheckId =
  | "names"
  | "spelling"
  | "style"
  | "hyphens"
  | "quotes"
  | "doubled"
  | "unclosed"
  | "numbers"
  | "capitals"
  | "breaks"
  | "typos";

/**
 * Every check, in the order `consistencyReport` emits them.
 *
 * Here rather than in the catalogue beside it because this *is* the emit order
 * — the sequence of calls at the foot of this file — and a second list saying
 * so somewhere else would be a second answer to one question. The words and
 * the hue for each live in `consistency-checks.ts`, which reads this.
 */
export const ALL_CHECKS: readonly CheckId[] = [
  "names",
  "spelling",
  "style",
  "quotes",
  "unclosed",
  "doubled",
  "hyphens",
  "numbers",
  "capitals",
  "breaks",
  "typos",
];

export interface ConsistencyFinding {
  /**
   * A stable handle, so a writer who says no once is not asked again.
   *
   * Built from the kind and the spellings — never from a count and never from a
   * chapter, both of which move on the next keystroke and would quietly undo a
   * dismissal the moment anything was written.
   */
  key: string;
  check: CheckId;
  /** In the writer's words: `Katherine / Catherine`. */
  label: string;
  /** What it is, and why anybody mentions it. Never what to do about it. */
  note: string;
  /** The spellings involved, commonest first. Empty where a check has none. */
  variants: Variant[];
  /** Where a check points at a sentence rather than at a spelling. */
  passages?: Occurrence[];
}

export interface ConsistencyReport {
  /** Chapters actually read. Zero means the check did not run. */
  chapters: number;
  words: number;
  /**
   * The checks that actually ran.
   *
   * The same obligation `chapters` and `words` carry, one step further out: an
   * empty result is never rendered as a good one, and the moment a writer can
   * run two of these instead of six, "six checks found nothing" is a sentence
   * about a run that did not happen. Every screen counts this rather than
   * typing a number.
   */
  ran: readonly CheckId[];
  /** Whether a hand-kept story bible was there to check names against. */
  usedBible: boolean;
  findings: ConsistencyFinding[];
}

/** What one story-bible entry answers to. Most books have no bible at all. */
export type NameGroup = readonly string[];

export interface ConsistencyOptions {
  /** `entries.map(namesOf)`. A bonus signal, never a requirement. */
  known?: readonly NameGroup[];
  /** Findings the writer has already set aside, by `key`. */
  dismissed?: readonly string[];
  /**
   * Which checks to run. Omitted means all of them; `[]` means none.
   *
   * **A shorter answer, not a quicker one** — most of the cost of this screen
   * is reading the manuscript out of storage, which happens before this module
   * is called at all. Leaving `names` out does save real time (its `sameLine`
   * pass is the expensive one here), but nothing on screen may say so.
   */
  only?: readonly CheckId[];
  /**
   * An English word list, for the near-miss check.
   *
   * **Absent means that check cannot run**, and `ran` says so — it is left out
   * rather than reported as having found nothing. The list is a megabyte and is
   * fetched on demand, so a caller that has not got it is an ordinary case
   * rather than an error; see `typo-words.ts`. Passing an empty set instead
   * would make every unusual word in the book a finding.
   */
  words?: ReadonlySet<string>;
}

/** Shorter than this, one edit is a quarter of the word. */
export const MIN_NAME_LENGTH = 4;
/** Below this there is not enough of a common spelling to be drifting from. */
export const MIN_DOMINANT = 8;
/** The common spelling has to be this many times the rare one. */
export const DOMINANCE = 4;
/**
 * How much of a candidate's use has to be mid-sentence to read as a name.
 *
 * Presence alone is not enough: "Still" opening forty sentences and turning up
 * once in the middle of one would pass a presence test and is not a name.
 */
export const MID_SENTENCE_SHARE = 0.34;

/* ------------------------------------------------------------------ *
 * Reading the book — one pass, everything else reads its tables
 * ------------------------------------------------------------------ */

/**
 * A word, keeping the two marks that live *inside* one.
 *
 * A hyphen and an apostrophe are part of the word here — `well-known` and
 * `don't` are single tokens — because two of the checks below are about
 * exactly those marks.
 */
const WORD = /\p{L}[\p{L}\p{M}'’\u2010-\u2015-]*/gu;

/** Marks a line of speech opens on. */
const OPENS = new Set(['"', "“", "'", "‘", "(", "["]);

interface Token {
  /** As written, with a trailing possessive already taken off. */
  text: string;
  /** Where it started, so a sentence can be pulled back out around it. */
  at: number;
  /**
   * The first word of a sentence, or of a piece of speech.
   *
   * Every sentence starts with a capital, so this is the flag that decides
   * whether a capitalised word is evidence of anything.
   */
  opens: boolean;
  /** Exactly one space between this token and the one before it. */
  spaced: boolean;
  /**
   * Whether the next word is a capitalised **name**.
   *
   * The one thing that tells *King Robert* from *the king*: a title before a
   * name is a different use of the word, and counting it would make every book
   * with a monarch in it report its own correct capitalisation.
   *
   * **It asks about a name and not merely about a capital**, and the difference
   * is a whole finding. *the Council Chamber* against *the council* was never
   * looked at, because `Council` never once stood alone — the guard aimed at
   * titles was catching two-word terms as well. `NAME_WORDS` separates them:
   * `blake` is somebody's name and `chamber` is not.
   *
   * What it still cannot see is an invented character with a title in front of
   * them, since no list has that name either. Narrow, and named here so that
   * whoever meets it knows it was known about.
   */
  beforeName: boolean;
}

function tokensOf(sentence: string): Token[] {
  const out: Token[] = [];
  WORD.lastIndex = 0;
  let match: RegExpExecArray | null;
  let previousEnd = -1;

  while ((match = WORD.exec(sentence)) !== null) {
    const raw = match[0].replace(/^[-'’\u2010-\u2015]+/, "");
    // `Katherine's` is Katherine. Counting the possessive as its own spelling
    // would split every character's tally in two.
    const text = raw.replace(/['’]s$/i, "").replace(/[-'’\u2010-\u2015]+$/, "");
    if (!text) continue;

    const before = sentence.slice(0, match.index).trimEnd();
    const previous = before.slice(-1);
    out.push({
      text,
      at: match.index,
      opens: out.length === 0 || OPENS.has(previous),
      spaced:
        previousEnd >= 0 && sentence.slice(previousEnd, match.index) === " ",
      beforeName: false,
    });
    previousEnd = match.index + match[0].length;
  }

  // Filled on a second pass rather than guessed at during the first: it is a
  // fact about the *next* token, which does not exist yet while this one is
  // being made.
  for (let i = 0; i < out.length - 1; i += 1) {
    const next = out[i + 1].text;
    out[i].beforeName =
      CAPITALISED.test(next) && NAME_WORDS.has(next.toLocaleLowerCase());
  }

  return out;
}

/** Starts with a capital and carries a small letter — a name, not an acronym. */
const CAPITALISED = /^\p{Lu}/u;

/** What one spelling did in one chapter. */
interface Spot {
  count: number;
  /** The first sentence it was seen in, in this chapter. */
  example?: string;
}

/** Everything one spelling did, across the book. */
interface Tally {
  total: number;
  /** Appearances that were not the first word of a sentence or a speech. */
  midSentence: number;
  perChapter: Map<number, Spot>;
  example?: string;
}

function bump(
  into: Map<string, Tally>,
  word: string,
  chapter: number,
  mid: boolean,
  sentence: string,
) {
  let tally = into.get(word);
  if (!tally) {
    tally = { total: 0, midSentence: 0, perChapter: new Map() };
    into.set(word, tally);
  }
  tally.total += 1;
  if (mid) tally.midSentence += 1;

  let spot = tally.perChapter.get(chapter);
  if (!spot) {
    spot = { count: 0 };
    tally.perChapter.set(chapter, spot);
  }
  spot.count += 1;

  // The first sentence is kept rather than the best one: a real place in the
  // book beats a shorter sentence chosen by a rule. The same rule per chapter
  // as for the book, so the two cannot disagree about which line to show.
  if (!spot.example && sentence.length <= 300) spot.example = sentence.trim();
  if (!tally.example && sentence.length <= 300) tally.example = sentence.trim();
}

/** A sentence, with the chapter it came from. */
interface Line {
  chapter: number;
  text: string;
}

/** Everything the one pass collected. */
interface Scan {
  words: number;
  /** Capitalised words, as written. */
  capitals: Map<string, Tally>;
  /** Every word, lower-cased. */
  lower: Map<string, Tally>;
  /** Hyphenated words, lower-cased and as written. */
  hyphenated: Map<string, Tally>;
  /** Adjacent pairs separated by exactly one space, lower-cased. */
  bigrams: Map<string, Tally>;
  /**
   * Words written in lower case, and *only* those.
   *
   * `lower` holds every token lower-cased, capitals included, so it cannot
   * answer "is this word also written in lower case" — the count would include
   * the very occurrences being compared against.
   */
  lowered: Map<string, Tally>;
  /**
   * Capitalised words that are not standing in front of another capital.
   *
   * Separate from `capitals` rather than a filter on it, so the name check —
   * and the twenty-odd tests pinning what it refuses — reads exactly what it
   * always read.
   */
  standaloneCapitals: Map<string, Tally>;
  /** Bare integers, as written, that read as a count rather than as a code. */
  numerals: Map<string, Tally>;
  /**
   * How each lower-cased word is spelled, for the cards to show.
   *
   * `lower` is keyed case-insensitively, which is right for counting and wrong
   * for showing: a card reading `aetherium` under a book that writes
   * *Aetherium* looks like a bug.
   *
   * **A mid-sentence spelling beats one that opened a sentence**, and this was
   * first-seen-wins, which is the trap this module warns about everywhere else
   * — every sentence starts on a capital, so the first sighting of an ordinary
   * word is usually its capitalised form. A book writing `room` twenty times
   * had its card headed `Room`, because one of the twenty happened to come
   * first and happened to start a sentence. Among mid-sentence sightings the
   * first still wins, under the same "a real place in the book beats one chosen
   * by a rule" the examples already follow.
   */
  written: Map<string, { text: string; mid: boolean }>;
  /** Every sentence, so a check can look at whole lines. */
  lines: Line[];
  /** Paragraphs, for the checks that are about a paragraph. */
  paragraphs: { chapter: number; text: string; }[];
}

function scan(book: readonly BookText[]): Scan {
  const out: Scan = {
    words: 0,
    capitals: new Map(),
    lower: new Map(),
    hyphenated: new Map(),
    bigrams: new Map(),
    lowered: new Map(),
    standaloneCapitals: new Map(),
    numerals: new Map(),
    written: new Map(),
    lines: [],
    paragraphs: [],
  };

  book.forEach((chapter, index) => {
    // A soft hyphen is an artefact of a PDF's line breaking and is invisible
    // on screen; left in, it makes one word look like two spellings.
    const clean = chapter.text.replace(/\u00AD/g, "");

    for (const paragraph of clean.split(/\n{2,}/)) {
      if (!paragraph.trim()) continue;
      out.paragraphs.push({ chapter: index, text: paragraph });

      for (const sentence of sentencesIn(paragraph)) {
        out.lines.push({ chapter: index, text: sentence });
        const tokens = tokensOf(sentence);

        tokens.forEach((token, at) => {
          out.words += 1;
          const lower = token.text.toLocaleLowerCase();
          const mid = !token.opens;

          bump(out.lower, lower, index, mid, sentence);
          const spelling = out.written.get(lower);
          if (!spelling || (mid && !spelling.mid)) {
            out.written.set(lower, { text: token.text, mid });
          }
          if (/[\u2010-\u2015-]/.test(token.text)) {
            bump(out.hyphenated, lower, index, mid, sentence);
          }
          if (/^\p{Lu}/u.test(token.text) && /\p{Ll}/u.test(token.text.slice(1))) {
            bump(out.capitals, token.text, index, mid, sentence);
            if (!token.beforeName) {
              bump(out.standaloneCapitals, token.text, index, mid, sentence);
            }
          } else if (!CAPITALISED.test(token.text)) {
            bump(out.lowered, lower, index, mid, sentence);
          }
          if (at > 0 && token.spaced) {
            const pair = `${tokens[at - 1].text.toLocaleLowerCase()} ${lower}`;
            bump(out.bigrams, pair, index, mid, sentence);
          }
        });

        // **Digits are not words and the tokeniser never sees them** — `WORD`
        // is letters-only — so the numerals are read straight off the sentence,
        // which is also where every guard on them has to look.
        NUMERAL.lastIndex = 0;
        let digits: RegExpExecArray | null;
        while ((digits = NUMERAL.exec(sentence)) !== null) {
          if (!countableNumeral(sentence, digits.index, digits[0])) continue;
          bump(out.numerals, digits[0], index, true, sentence);
        }
      }
    }
  });

  return out;
}

/* ------------------------------------------------------------------ *
 * Shaping a finding
 * ------------------------------------------------------------------ */

const whereOf = (tally: Tally, book: readonly BookText[]): Where[] =>
  [...tally.perChapter.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([index, spot]) => ({
      chapterId: book[index].chapterId,
      chapterTitle: book[index].title,
      number: book[index].number,
      count: spot.count,
      ...(spot.example ? { example: spot.example } : {}),
    }));

const variantOf = (
  text: string,
  tally: Tally,
  book: readonly BookText[],
): Variant => ({
  text,
  count: tally.total,
  where: whereOf(tally, book),
  ...(tally.example ? { example: tally.example } : {}),
});

/** Commonest first, then alphabetically so a second run reads the same. */
const byCount = (a: Variant, b: Variant) =>
  b.count - a.count || a.text.localeCompare(b.text);

/**
 * A stable handle on one finding.
 *
 * Readable rather than hashed on purpose: this string lands in `localStorage`,
 * where the person reading it is somebody working out why a dismissal stuck,
 * and a book has at most a few dozen of them.
 */
export function driftKey(check: CheckId, parts: readonly string[]): string {
  return [check, ...parts.map((p) => p.toLocaleLowerCase()).sort()].join("|");
}

function drift(
  check: CheckId,
  note: string,
  variants: Variant[],
): ConsistencyFinding {
  const ranked = [...variants].sort(byCount);
  return {
    key: driftKey(check, ranked.map((v) => v.text)),
    check,
    label: ranked.map((v) => v.text).join(" / "),
    note,
    variants: ranked,
  };
}

/* ------------------------------------------------------------------ *
 * (a) A name spelled two ways — the flagship
 * ------------------------------------------------------------------ */

type Edit =
  | { kind: "sub"; at: number; from: string; to: string }
  | { kind: "gap"; at: number }
  | { kind: "swap"; at: number }
  | null;

/**
 * One edit apart, or none — never a distance, because nothing here wants a
 * number. A full Levenshtein matrix answers a question this module never asks.
 *
 * **Two apart is not offered and will not be.** Distance two buys
 * "Marianne / Maryanne" and costs "Sarah / Sasha", "Martin / Marion" and
 * "Helena / Helene" — every one of those a pair of real people, and one false
 * card on this screen costs more than the finding it arrived with.
 */
function editBetween(a: string, b: string): Edit {
  if (a === b) return null;

  if (a.length === b.length) {
    const diff: number[] = [];
    for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) diff.push(i);
    if (diff.length === 1) {
      return { kind: "sub", at: diff[0], from: a[diff[0]], to: b[diff[0]] };
    }
    // Two letters swapped is one slip of two fingers, and a swapped pair is
    // almost never a *different* name — which is exactly what is not true of a
    // substitution. It is the one two-edit shape worth admitting.
    if (
      diff.length === 2 &&
      diff[1] === diff[0] + 1 &&
      a[diff[0]] === b[diff[1]] &&
      a[diff[1]] === b[diff[0]]
    ) {
      return { kind: "swap", at: diff[0] };
    }
    return null;
  }

  if (Math.abs(a.length - b.length) !== 1) return null;
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let skipped = -1;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i += 1;
      j += 1;
      continue;
    }
    if (skipped >= 0) return null;
    skipped = j;
    j += 1;
  }
  return { kind: "gap", at: skipped >= 0 ? skipped : long.length - 1 };
}

export const withinOneEdit = (a: string, b: string): boolean =>
  editBetween(a.toLocaleLowerCase(), b.toLocaleLowerCase()) !== null;

const VOWELS = new Set(["a", "e", "i", "o", "u", "y"]);

/** Letters English genuinely writes one name with either of. */
const INTERCHANGEABLE = [
  new Set(["c", "k"]),
  new Set(["s", "z"]),
  new Set(["i", "y"]),
  new Set(["j", "g"]),
];

const interchangeable = (a: string, b: string) =>
  INTERCHANGEABLE.some((pair) => pair.has(a) && pair.has(b));

/**
 * From this length up, one vowel apart reads as a slip rather than as a second
 * character.
 *
 * Substituting a vowel is precisely how English tells given names apart — Tim
 * and Tom, Jan and Jon — so the rule below refuses it. Applied at every length
 * it would also refuse "Katherine / Katharine", which after the C/K pair is the
 * most classic drift there is. The risk lives in short names, so the rule stops
 * at six letters.
 */
const VOWEL_SAFE_LENGTH = 6;

/**
 * Whether one spelling could be a slip for the other.
 *
 * Exported because it is the piece of judgement here most worth arguing with
 * directly — the same reason `opensHere` is exported from `smart-quotes.ts`.
 */
export function looksLikeDrift(a: string, b: string): boolean {
  const x = a.toLocaleLowerCase();
  const y = b.toLocaleLowerCase();

  // A case difference is where a sentence started, not a spelling. Without
  // this, "Ash" and "ash" fire on every book that has a fire in it.
  if (x === y) return false;
  if (Math.min(x.length, y.length) < MIN_NAME_LENGTH) return false;
  // A plural is not a spelling: the Fenners are the Fenner family.
  if (x === `${y}s` || y === `${x}s`) return false;

  const edit = editBetween(x, y);
  if (!edit) return false;
  if (edit.kind !== "sub") return true;

  // Katherine and Catherine is the flagship; Ben and Ken is two people. A
  // first letter may only turn into one English actually swaps it for.
  if (edit.at === 0) return interchangeable(edit.from, edit.to);

  if (
    x.length < VOWEL_SAFE_LENGTH &&
    VOWELS.has(edit.from) &&
    VOWELS.has(edit.to)
  ) {
    return interchangeable(edit.from, edit.to);
  }
  return true;
}

/**
 * Capitalised words that are not names.
 *
 * Short, and deliberately so — the mid-sentence share below is the real filter.
 * This holds only the few words that turn up capitalised in the middle of an
 * ordinary sentence as a matter of course.
 */
const NOT_NAMES = new Set([
  "mr", "mrs", "ms", "miss", "dr", "sir", "lady", "lord", "captain",
  "father", "mother", "uncle", "aunt", "professor", "reverend", "saint",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "january", "february", "march", "april", "june", "july",
  "august", "september", "october", "november", "december",
  "english", "french", "german", "spanish", "italian", "american", "british",
  // More of the same three kinds: what somebody is called by rank, where they
  // are from, and when a thing happened.
  "madam", "madame", "monsieur", "señor", "señora", "rabbi", "imam",
  "sister", "brother", "colonel", "sergeant", "corporal", "admiral",
  "general", "major", "lieutenant", "commander", "constable", "inspector",
  "detective", "judge", "governor", "mayor", "president", "chancellor",
  "duke", "duchess", "baron", "baroness", "earl", "count", "countess",
  "irish", "scottish", "welsh", "dutch", "russian", "greek", "roman",
  "chinese", "japanese", "indian", "african", "european", "australian",
  "canadian", "mexican", "polish", "swedish", "danish", "turkish",
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
  "sunday", "january", "february", "march", "april", "june", "july",
  "august", "september", "october", "november", "december",
  "christmas", "easter", "halloween",
]);

/** Past this many, the detection has gone wrong and a wall of cards is worse. */
const MAX_NAME_FINDINGS = 12;

const NAME_NOTE =
  "Two spellings of one name, in one book. This is the first thing a copy " +
  "editor looks for, because a reader who notices is a reader who has stopped " +
  "reading. Nothing here knows which one was meant, and a second character " +
  "whose name is one letter from the first would look exactly like this from " +
  "the outside.";

function nameFindings(
  found: Scan,
  book: readonly BookText[],
  known: readonly NameGroup[],
): ConsistencyFinding[] {
  const groups = new Map<string, number>();
  known.forEach((group, index) => {
    for (const name of group) groups.set(name.toLocaleLowerCase(), index);
  });

  /*
   * **A word only ever seen after a full stop is not evidence of a name.**
   *
   * Every sentence opens on a capital, so without this the candidate list is a
   * list of ordinary words. The *share* rather than the presence is what
   * matters: "Still" opening forty sentences and turning up mid-sentence once
   * would pass a presence test, while a real character is overwhelmingly
   * mid-sentence — dialogue attribution and possessives put them there
   * hundreds of times.
   *
   * It is also what disposes of "Mary" against "Marry", and it does it
   * upstream rather than with a rule about doubled consonants: `marry` is a
   * lower-case verb, so it only ever enters this table capitalised at the head
   * of a sentence, and it never survives.
   */
  const names = [...found.capitals.entries()]
    .filter(
      ([word, tally]) =>
        word.length >= MIN_NAME_LENGTH &&
        !NOT_NAMES.has(word.toLocaleLowerCase()) &&
        tally.midSentence >= 1 &&
        tally.midSentence / tally.total >= MID_SENTENCE_SHARE,
    )
    .sort((a, b) => b[1].total - a[1].total);

  /*
   * Whole words, not substrings.
   *
   * A gap edit at the end makes one spelling contain the other — "Kathryn"
   * sits inside "Kathryne" — so a substring test finds both in every sentence
   * that holds either, and the pair is rejected for sharing a line it never
   * shared. Every such pair would have been silently dropped.
   */
  const sameLine = (a: string, b: string) => {
    const x = new RegExp(`\\b${a}\\b`, "i");
    const y = new RegExp(`\\b${b}\\b`, "i");
    return found.lines.some((line) => x.test(line.text) && y.test(line.text));
  };

  // Union-find, so three spellings of one name are one card rather than two.
  const parent = new Map<string, string>();
  const root = (key: string): string => {
    let at = parent.get(key) ?? key;
    while (at !== (parent.get(at) ?? at)) at = parent.get(at) ?? at;
    parent.set(key, at);
    return at;
  };
  const join = (a: string, b: string) => {
    const ra = root(a);
    const rb = root(b);
    if (ra !== rb) parent.set(rb, ra);
  };

  for (let i = 0; i < names.length; i += 1) {
    const [common, commonTally] = names[i];
    const commonGroup = groups.get(common.toLocaleLowerCase());

    for (let j = i + 1; j < names.length; j += 1) {
      const [rare, rareTally] = names[j];
      if (Math.abs(common.length - rare.length) > 1) continue;

      const rareGroup = groups.get(rare.toLocaleLowerCase());
      // The writer has said these are two people, or has said this one is a
      // deliberate nickname. Either way they have already answered.
      if (commonGroup !== undefined && rareGroup !== undefined) continue;

      // A near-miss of a name the writer wrote down needs less corroboration
      // from the counts. The ratio still has to hold.
      const floor = commonGroup !== undefined ? DOMINANCE : MIN_DOMINANT;
      if (commonTally.total < floor) continue;
      if (commonTally.total < rareTally.total * DOMINANCE) continue;
      if (!looksLikeDrift(common, rare)) continue;
      // A sentence carrying both spellings is two people being introduced.
      if (sameLine(common, rare)) continue;

      join(common, rare);
    }
  }

  const clusters = new Map<string, string[]>();
  for (const key of parent.keys()) {
    const head = root(key);
    const cluster = clusters.get(head);
    if (cluster) cluster.push(key);
    else clusters.set(head, [key]);
  }

  const out: ConsistencyFinding[] = [];
  for (const [head, rest] of clusters) {
    const spellings = [...new Set([head, ...rest])];
    if (spellings.length < 2) continue;
    const variants: Variant[] = [];
    for (const word of spellings) {
      const tally = found.capitals.get(word);
      if (tally) variants.push(variantOf(word, tally, book));
    }
    if (variants.length >= 2) out.push(drift("names", NAME_NOTE, variants));
  }

  return out
    .sort((a, b) => b.variants[0].count - a.variants[0].count)
    .slice(0, MAX_NAME_FINDINGS);
}

/* ------------------------------------------------------------------ *
 * (b) British and American spellings, both in one book
 * ------------------------------------------------------------------ */

/**
 * A table, and not a rule that derives one.
 *
 * Deriving looks tidier and is wrong in two ways that matter. Turning `-our`
 * into `-or` produces four/for, hour/hor, your/yor, pour/por, tour/tor; and no
 * rule can know that `practise` against `practice` is a British noun-and-verb
 * distinction rather than drift at all. A table is longer and says only what
 * it means.
 *
 * Read against the word counts the one pass already built, so this costs a few
 * thousand hash lookups rather than a few thousand regexes over the manuscript.
 *
 * **The table itself moved to `spelling-pairs.ts` and is generated**, which is
 * why it is imported rather than written here. It was 112 pairs typed by hand,
 * so the check found `colour/color` and was blind to `sulphur/sulfur`,
 * `aeroplane/airplane` and `artefact/artifact`; it is 2,441 now, out of VarCon.
 * That module carries the provenance and what was filtered out of it. **The
 * judgement about which pairs are too ambiguous to use stays here**, below,
 * because it is a decision rather than data.
 */

/**
 * Pairs where one side is also an ordinary word with another meaning.
 *
 * Named rather than deleted, so the decision stays visible. Every novel
 * contains "story" and "check" and "draft"; a tool that reads those as
 * British-and-American drift is wrong on nearly every manuscript, which is the
 * one failure this feature cannot afford. `learnt/learned` and `burnt/burned`
 * are here for the same reason from the other side — *a learned man* and
 * *burnt toast* are adjectives, and both are correct beside the other form in
 * one book.
 */
const AMBIGUOUS_PAIRS: readonly (readonly [string, string])[] = [
  ["storey", "story"], ["cheque", "check"], ["draught", "draft"],
  ["tyre", "tire"], ["kerb", "curb"], ["licence", "license"],
  ["mould", "mold"], ["axe", "ax"], ["learnt", "learned"],
  ["burnt", "burned"], ["whilst", "while"], ["amongst", "among"],
  ["towards", "toward"], ["whisky", "whiskey"], ["practise", "practice"],
  // The two the bigger table turned up. `enquire` and `inquire` are a real
  // distinction in British English — asking a question against holding an
  // investigation — so a book using both is usually right; and *a spoilt
  // child* is an adjective, which is the whole reason `learnt` and `burnt`
  // are already here.
  ["enquire", "inquire"], ["spoilt", "spoiled"],
  // Turned up by reading what the wider table let through. Each is a word
  // whose two forms are not the same word: a *storey* is a floor and a *story*
  // is a tale, and these are the same shape.
  ["metre", "meter"], ["spelt", "spelled"], ["programme", "program"],
  ["plait", "plat"], ["gaol", "jail"], ["pram", "perambulator"],
  ["dyke", "dike"], ["baulk", "balk"], ["behove", "behoove"],
  ["flannelette", "flanellette"], ["gramme", "gram"], ["tonne", "ton"],
  ["kilogramme", "kilogram"],
];

/**
 * Suffixes that make a word a form of itself rather than a new one.
 *
 * `mould` being refused has to refuse `moulded` and `mouldy` with it, or the
 * ambiguity walks straight back in through an inflection. It must **not**
 * refuse a compound built on the word: `cheque/check` is a trap and
 * `chequebook/checkbook` is not, because nobody writes a chequebook by
 * accident.
 */
const INFLECTIONS = [
  "", "s", "es", "ed", "d", "ing", "y", "ier", "iest", "er", "est", "ies",
];

/**
 * Whether this pair is one where a book may legitimately hold both.
 *
 * Applied at the point of use rather than when the table is built, so a pair
 * added by hand is refused by the same rule as a generated one — there is one
 * statement of this judgement and it is `AMBIGUOUS_PAIRS`.
 */
export function ambiguousPair(british: string, american: string): boolean {
  return AMBIGUOUS_PAIRS.some(([b, a]) => {
    if (!british.startsWith(b) || !american.startsWith(a)) return false;
    return (
      INFLECTIONS.includes(british.slice(b.length)) &&
      INFLECTIONS.includes(american.slice(a.length))
    );
  });
}

const SPELLING_NOTE =
  "Both spellings are in this book. Neither is wrong — one is British and one " +
  "is American — and a manuscript carrying both is one of the things a copy " +
  "editor is hired to find. Nothing here has a preference between them.";

function spellingFindings(
  found: Scan,
  book: readonly BookText[],
): ConsistencyFinding[] {
  return pairFindings(
    found,
    book,
    SPELLING_PAIRS,
    "spelling",
    SPELLING_NOTE,
    ambiguousPair,
  );
}

/**
 * Every pair in a table that this book contains both halves of.
 *
 * Shared by the British/American check and the house-style one below, which
 * differ in their table, their note and what they refuse — and in nothing else.
 */
function pairFindings(
  found: Scan,
  book: readonly BookText[],
  table: readonly (readonly [string, string])[],
  check: CheckId,
  note: string,
  refuse?: (first: string, second: string) => boolean,
): ConsistencyFinding[] {
  const out: ConsistencyFinding[] = [];

  for (const [first, second] of table) {
    if (refuse?.(first, second)) continue;
    const one = tallyOf(found, first);
    const other = tallyOf(found, second);
    // The whole guard: a spelling this book does not contain is never reported.
    if (!one || !other) continue;
    out.push(
      drift(check, note, [
        variantOf(first, one, book),
        variantOf(second, other, book),
      ]),
    );
  }

  return out.sort((a, b) => b.variants[0].count - a.variants[0].count);
}

/**
 * One spelling of a term, wherever the scan happens to keep it.
 *
 * A word lives in `lower`, a pair of words in `bigrams`. A hyphenated form is
 * in `lower` too, because the tokeniser keeps a hyphen inside a word.
 */
const tallyOf = (found: Scan, term: string): Tally | undefined =>
  term.includes(" ") ? found.bigrams.get(term) : found.lower.get(term);

/* ------------------------------------------------------------------ *
 * (b2) A word written two ways, neither of them wrong
 * ------------------------------------------------------------------ */

const STYLE_NOTE =
  "Both of these are correct, and this book uses both. It is a house-style " +
  "choice rather than a dialect one — the kind of thing a copy editor writes " +
  "down on a style sheet at the start and then holds the manuscript to. " +
  "Nothing here has a preference between them.";

/* ------------------------------------------------------------------ *
 * (c) A compound written more than one way
 * ------------------------------------------------------------------ */

/**
 * Compounds English genuinely writes both ways, depending on where they sit.
 *
 * *A well-known writer* and *the writer is well known* are both correct, and
 * telling one from the other needs to know which word the compound is leaning
 * on — which is a part-of-speech question this module has no way to ask. So
 * the heads that alternate are simply left alone.
 *
 * **This is the weakest of the six checks and the first that should go** if it
 * ever turns out to be noisy on real manuscripts.
 */
const ALTERNATING = new Set([
  "well", "ill", "best", "better", "most", "least", "long", "short",
  "full", "part", "high", "low", "hard", "fast", "slow", "close",
  "open", "old", "new", "first", "last", "half", "self", "year", "years",
  // The same argument, more of it: every one of these heads a compound that
  // English writes hyphenated before a noun and open after it — *a far-off
  // country* and *the country is far off*, *a deep-set window*, *wide-eyed*.
  "far", "near", "deep", "wide", "broad", "thick", "thin", "light", "heavy",
  "much", "more", "less", "ever", "never", "over", "under", "out", "in",
  "up", "down", "back", "free", "clear", "straight", "sharp", "soft",
  "loud", "quiet", "cold", "warm", "dry", "wet", "rough", "smooth",
  "quick", "strong", "weak", "bright", "dark", "sweet", "clean",
]);

/** Closed forms that are their own word, and a different one. */
const DIFFERENT_WORD = new Set([
  "everyday", "anymore", "awhile", "alright", "cannot", "into", "onto",
  "maybe", "nobody", "anyone", "someone", "everyone", "already", "altogether",
  // The rest of the family.
  "anyway", "anyhow", "anytime", "anyplace", "everything", "everywhere",
  "everybody", "something", "sometime", "sometimes", "somewhere", "somebody",
  "nothing", "nowhere", "whatever", "whenever", "wherever", "whoever",
  "however", "therefore", "nevertheless", "moreover", "meanwhile", "inside",
  "outside", "upon", "throughout", "without", "within", "beside", "besides",
  "always", "awake", "aside", "apart", "ahead", "along", "around", "above",
  "below", "overall", "underway",
  /*
   * **The richest seam, and the one that was costing real false positives.**
   * A noun written closed and the verb it came from written open are two
   * words, not one word written two ways: you *set up* a *setup*, you *work
   * out* at a *workout*, you *log in* at a *login*. Every one of these is
   * correct in both forms in the same sentence.
   */
  "setup", "workout", "login", "logout", "pickup", "breakup", "makeup",
  "backup", "checkout", "checkup", "cleanup", "lookout", "takeout",
  "takeover", "handout", "handoff", "dropout", "standby", "holdup",
  "buildup", "letdown", "breakdown", "showdown", "shutdown", "runaway",
  "getaway", "giveaway", "payoff", "layoff", "cutback", "feedback",
]);

const HYPHEN_NOTE =
  "The same compound is written more than one way here. English does " +
  "alternate on purpose — a well-known writer is well known — so some of " +
  "these are correct exactly as they stand. What is recorded is only that " +
  "both forms are in the book.";

const MAX_HYPHEN_FINDINGS = 8;

function hyphenFindings(
  found: Scan,
  book: readonly BookText[],
): ConsistencyFinding[] {
  const out: ConsistencyFinding[] = [];

  for (const [hyphenated, tally] of found.hyphenated) {
    const parts = hyphenated.split(/[‐-―-]+/).filter(Boolean);
    if (parts.length !== 2) continue;
    // A two-letter half is a prefix — e-mail, x-ray, re-enter — and its spaced
    // form is not English at all, so there is nothing to be inconsistent with.
    if (parts.some((part) => part.length < 3)) continue;
    if (parts.some((part) => !/^\p{L}+$/u.test(part))) continue;
    if (ALTERNATING.has(parts[0])) continue;

    const closed = parts.join("");
    if (DIFFERENT_WORD.has(closed)) continue;

    const variants = [variantOf(hyphenated, tally, book)];
    const asClosed = found.lower.get(closed);
    if (asClosed) variants.push(variantOf(closed, asClosed, book));
    const asSpaced = found.bigrams.get(parts.join(" "));
    if (asSpaced) variants.push(variantOf(parts.join(" "), asSpaced, book));

    if (variants.length >= 2) out.push(drift("hyphens", HYPHEN_NOTE, variants));
  }

  return out
    .sort((a, b) => b.variants[0].count - a.variants[0].count)
    .slice(0, MAX_HYPHEN_FINDINGS);
}

/* ------------------------------------------------------------------ *
 * (d) Straight quotation marks among curly ones
 * ------------------------------------------------------------------ */

/**
 * The cleanest check here, and the one only this app can make.
 *
 * `editor/smart-quotes.ts` turns straight marks into curly ones *as they are
 * typed*, and says so: nothing already written is touched. So a manuscript
 * that arrived by import keeps whatever it came with and everything written
 * since is curly — one book, printing two ways, and invisible until somebody
 * opens the finished file. The per-chapter breakdown is the whole payload,
 * because it tells the writer exactly which part of the book came from where.
 */
const QUOTE_KINDS = {
  double: { straight: /"/g, curly: /[“”]/g, plain: '"', typeset: "“ ”" },
  single: { straight: /'/g, curly: /[‘’]/g, plain: "'", typeset: "‘ ’" },
} as const;

const QUOTE_NOTE =
  "Typewriter quotation marks and typographic ones are both in this book. " +
  "Printed books use the curly pair; text imported or pasted from elsewhere " +
  "keeps whatever it arrived with, which is usually straight. Both are here, " +
  "so the book currently prints two ways.";

const APOSTROPHE_NOTE =
  "Straight and curly apostrophes are both in this book. It is the same " +
  "question as the quotation marks and a separate answer, because an " +
  "apostrophe in a contraction is not a mark of speech and a book can be " +
  "settled about one and not the other.";

/**
 * The first line in each chapter carrying a given mark.
 *
 * **This check counted and showed nothing, which is the wrong way round for
 * the one check whose entire subject is how a character prints.** A writer
 * told there are four straight marks in chapter three still cannot see what
 * chapter three looks like. The marks are counted on the raw chapter text —
 * they have to be, an apostrophe is not a word — so the lines have to be
 * fetched separately, and they come from the pass that has already read the
 * book rather than from a second one.
 */
function firstLineIn(found: Scan, mark: RegExp): Map<number, string> {
  const out = new Map<number, string>();
  for (const line of found.lines) {
    if (out.has(line.chapter)) continue;
    // A `/g` regex carries `lastIndex` between calls, and `test` advances it:
    // left alone, this finds a mark in every other line and misses the rest.
    mark.lastIndex = 0;
    if (mark.test(line.text)) {
      out.set(line.chapter, line.text.trim().slice(0, 300));
    }
  }
  return out;
}

function quoteFindings(
  found: Scan,
  book: readonly BookText[],
): ConsistencyFinding[] {
  const out: ConsistencyFinding[] = [];

  for (const [kind, marks] of Object.entries(QUOTE_KINDS)) {
    const straight: Tally = { total: 0, midSentence: 0, perChapter: new Map() };
    const curly: Tally = { total: 0, midSentence: 0, perChapter: new Map() };
    const plainLines = firstLineIn(found, marks.straight);
    const typesetLines = firstLineIn(found, marks.curly);

    book.forEach((chapter, index) => {
      const plain = (chapter.text.match(marks.straight) ?? []).length;
      const typeset = (chapter.text.match(marks.curly) ?? []).length;
      if (plain > 0) {
        straight.total += plain;
        straight.perChapter.set(index, {
          count: plain,
          example: plainLines.get(index),
        });
      }
      if (typeset > 0) {
        curly.total += typeset;
        curly.perChapter.set(index, {
          count: typeset,
          example: typesetLines.get(index),
        });
      }
    });

    if (straight.total === 0 || curly.total === 0) continue;
    out.push(
      drift("quotes", kind === "double" ? QUOTE_NOTE : APOSTROPHE_NOTE, [
        variantOf(marks.plain, straight, book),
        variantOf(marks.typeset, curly, book),
      ]),
    );
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * (e) The same word twice in a row
 * ------------------------------------------------------------------ */

/** Doubles people write on purpose. */
const MEANT_TWICE = new Set([
  // Grammar puts these together on purpose: *she had had enough*, *what it is
  // is*, *I do do that*, *the thing that that man said*.
  "had", "that", "is", "do", "did", "was", "were", "who",
  // Said twice for effect, in speech.
  "no", "now", "there", "well", "come", "hear", "yes", "please", "sorry",
  "hello", "goodbye", "wait", "stop", "easy", "steady",
  // Sounds, and the reduplications English writes as two words.
  "ha", "bye", "night", "bang", "knock", "tut", "chop", "blah", "boo",
  "choo", "din", "yum", "wee", "poo", "goody", "hush", "cha", "tsk",
  // Emphasis. A writer doubling one of these means it.
  "so", "very", "really", "quite", "long", "far", "many", "much", "go",
  "run", "quick", "deep", "big", "little", "slow", "high",
]);

const DOUBLED_NOTE =
  "The same word twice in a row. Some are meant — she had had enough, and " +
  "anything a character says twice for effect — so the ones that read that " +
  "way are left alone. These are what is left.";

function doubledFindings(
  found: Scan,
  book: readonly BookText[],
): ConsistencyFinding[] {
  const hits = new Map<string, { tally: Tally; spots: Occurrence[] }>();

  for (const line of found.lines) {
    const tokens = tokensOf(line.text);
    for (let i = 1; i < tokens.length; i += 1) {
      const first = tokens[i - 1];
      const second = tokens[i];
      const word = first.text.toLocaleLowerCase();
      if (word.length < 2) continue;
      if (word !== second.text.toLocaleLowerCase()) continue;
      if (MEANT_TWICE.has(word)) continue;
      // A capital on the second one is a place, not a slip — New New York,
      // Sing Sing, Baden Baden.
      if (/^\p{Lu}/u.test(second.text)) continue;
      // Anything but space between them is punctuation, and punctuation is how
      // "No, no" and "Now, now." are written.
      if (!second.spaced) continue;

      const chapter = book[line.chapter];
      let hit = hits.get(word);
      if (!hit) {
        hit = {
          tally: { total: 0, midSentence: 0, perChapter: new Map() },
          spots: [],
        };
        hits.set(word, hit);
      }
      hit.tally.total += 1;
      const spot = hit.tally.perChapter.get(line.chapter);
      if (spot) spot.count += 1;
      else
        hit.tally.perChapter.set(line.chapter, {
          count: 1,
          example: line.text.trim(),
        });
      hit.tally.example ??= line.text.trim();
      hit.spots.push({
        chapterId: chapter.chapterId,
        chapterTitle: chapter.title,
        number: chapter.number,
        text: line.text.trim(),
        mark: `${first.text} ${second.text}`,
      });
    }
  }

  const out: ConsistencyFinding[] = [];
  for (const [word, hit] of hits) {
    const finding = drift("doubled", DOUBLED_NOTE, [
      variantOf(`${word} ${word}`, hit.tally, book),
    ]);
    out.push({ ...finding, passages: hit.spots.slice(0, 6) });
  }

  return out.sort((a, b) => b.variants[0].count - a.variants[0].count);
}

/* ------------------------------------------------------------------ *
 * (f) A quotation mark left open
 * ------------------------------------------------------------------ */

/**
 * Built to be quiet, because the obvious version of this check reports the
 * best-typeset books as broken.
 *
 * A speech running over several paragraphs opens a quotation mark in every one
 * of them and closes it only in the last. That is correct, it is how every
 * long speech in every novel is set, and a plain odd-parity check calls every
 * paragraph of it an error.
 *
 * Single quotes are never looked at: British books set speech in them, and an
 * apostrophe makes their parity meaningless.
 */
const DOUBLE_MARKS = /["“”]/g;
const OPENS_SPEECH = /^\s*["“]/;

/** Past this many, this book uses a convention the check does not know. */
const GIVE_UP_AT = 12;
const MAX_UNCLOSED_SPOTS = 6;

const UNCLOSED_NOTE =
  "A paragraph with an odd number of double quotation marks, which does not " +
  "itself open one. A speech running over several paragraphs opens each and " +
  "closes only the last — that is correct, and it is not counted here. Books " +
  "that set dialogue in single quotes or with dashes are not checked at all.";

function unclosedFindings(
  found: Scan,
  book: readonly BookText[],
): ConsistencyFinding[] {
  const spots: Occurrence[] = [];
  const tally: Tally = { total: 0, midSentence: 0, perChapter: new Map() };

  found.paragraphs.forEach((paragraph, index) => {
    const marks = (paragraph.text.match(DOUBLE_MARKS) ?? []).length;
    if (marks === 0 || marks % 2 === 0) return;
    if (OPENS_SPEECH.test(paragraph.text)) return;

    const next = found.paragraphs[index + 1];
    if (next && next.chapter === paragraph.chapter && OPENS_SPEECH.test(next.text)) {
      return;
    }

    const chapter = book[paragraph.chapter];
    tally.total += 1;
    const spot = tally.perChapter.get(paragraph.chapter);
    if (spot) spot.count += 1;
    else
      tally.perChapter.set(paragraph.chapter, {
        count: 1,
        example: paragraph.text.trim().slice(0, 300),
      });
    spots.push({
      chapterId: chapter.chapterId,
      chapterTitle: chapter.title,
      number: chapter.number,
      text: paragraph.text.trim().slice(0, 300),
      mark: '"',
    });
  });

  // Being loudly wrong a dozen times is the failure this feature cannot
  // afford, so past that it says nothing rather than something.
  if (spots.length === 0 || spots.length > GIVE_UP_AT) return [];

  return [
    {
      key: driftKey("unclosed", ["quotation mark"]),
      check: "unclosed",
      label: "A quotation mark left open",
      note: UNCLOSED_NOTE,
      variants: [],
      passages: spots.slice(0, MAX_UNCLOSED_SPOTS),
    },
  ];
}

/* ------------------------------------------------------------------ *
 * (g) The same number written as a word and as digits
 * ------------------------------------------------------------------ */

/** Every run of digits. Filtered hard afterwards; see `countableNumeral`. */
const NUMERAL = /\d+/g;

/**
 * Whether a run of digits is a *count* rather than a code.
 *
 * Everything here is about the characters around it, which is why the numerals
 * are read off the sentence rather than off the token list — a year, a price, a
 * time and a percentage are all just digits until you look at the neighbours.
 * Every guard costs real findings and every one is cheaper than the false
 * positive it prevents: a book holding `1985` and `nineteen` is not
 * inconsistent about anything.
 */
function countableNumeral(
  sentence: string,
  at: number,
  digits: string,
): boolean {
  // A leading zero is a code, a track number or a clock time, never a count.
  if (digits.length > 1 && digits.startsWith("0")) return false;
  const value = Number(digits);
  if (value < 2 || value > MAX_COUNT) return false;

  /*
   * **Above a hundred, only round numbers count.**
   *
   * A book writes *two hundred* or *200*, and that is a choice. It writes
   * *1985* and *1642* because they are years, and there is no other way to
   * write them — so the round-number rule disposes of every year that is not a
   * century without needing a rule about years at all.
   */
  if (value > 100 && value % 100 !== 0) return false;

  /*
   * **And the centuries themselves are refused**, because 1000 to 2100 are
   * round numbers *and* the years a novel is most likely to name. `2000` is
   * *the year 2000* far more often than it is two thousand of anything.
   *
   * The cost is real and is taken deliberately: `one thousand` against `1000`
   * and `two thousand` against `2000` will never be reported. Three thousand
   * upwards works normally.
   */
  if (value >= 1000 && value <= 2100) return false;

  const before = sentence.slice(Math.max(0, at - 2), at);
  const after = sentence.slice(at + digits.length, at + digits.length + 5);

  // Part of a longer number, a decimal, or a time of day.
  if (/[.,:\d]$/.test(before)) return false;
  if (/^[.,:\d]/.test(after)) return false;
  // Money, a measurement, an ordinal, a clock time.
  if (/[$£€¥₹]\s?$/.test(before)) return false;
  if (/^\s?[%°]/.test(after)) return false;
  if (/^(st|nd|rd|th)\b/i.test(after)) return false;
  if (/^\s?(am|pm|a\.m\.|p\.m\.)\b/i.test(after)) return false;
  // A range or a compound: 20-30, 12-inch.
  if (/[-‐-―]$/.test(before)) return false;
  if (/^[-‐-―]/.test(after)) return false;

  return true;
}

const SMALL = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen",
  "sixteen", "seventeen", "eighteen", "nineteen",
];

const TENS = [
  "", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty",
  "ninety",
];

/**
 * Number words, against the value each one names.
 *
 * **It starts at two, and that is the whole guard.** *One* is a pronoun and a
 * determiner long before it is a number — *one must always*, *one day*, *the
 * one thing* — and it turns up hundreds of times in any novel, so a book with a
 * single `1` anywhere in it would carry a finding it can never clear. *Second*
 * is left out from the other side for the same reason: it is a unit of time and
 * an ordinal before it is a count. Both cost real findings and neither is worth
 * what it would bring with it.
 *
 * Compounds are written twice because English writes them twice — `twenty-one`
 * arrives as one hyphenated token and `twenty one` as a pair of words, and the
 * scan already keeps a table for each.
 */
function numberWords(): Map<string, number> {
  const out = new Map<string, number>();
  for (let n = 2; n <= 19; n += 1) out.set(SMALL[n], n);
  for (let t = 2; t <= 9; t += 1) {
    out.set(TENS[t], t * 10);
    for (let u = 1; u <= 9; u += 1) {
      out.set(`${TENS[t]}-${SMALL[u]}`, t * 10 + u);
      out.set(`${TENS[t]} ${SMALL[u]}`, t * 10 + u);
    }
  }
  /*
   * **`a hundred`, not a bare `hundred`.**
   *
   * A book writing *two hundred* twice and `100` once was told it had written
   * "hundred" two ways. It had not: `hundred` appeared only inside a compound,
   * and two hundred is not one hundred. The bare word matched because it is
   * there in the text — which is true and useless.
   *
   * The article is how a book writes that number standing on its own, and
   * `one hundred` is unreachable for the reason `one` is left out of this table
   * altogether.
   */
  out.set("a hundred", 100);

  // Hundreds and thousands, in the range `countableNumeral` will look at. The
  // thousands start at three because 1000 and 2000 are inside the band it
  // refuses as years — generating them would only put entries here that can
  // never match anything.
  for (let h = 2; h <= 9; h += 1) out.set(`${SMALL[h]} hundred`, h * 100);
  for (let t = 3; t <= 9; t += 1) out.set(`${SMALL[t]} thousand`, t * 1000);

  return out;
}

/** The largest count worth reading as one. Past this it is an identifier. */
const MAX_COUNT = 9000;

const NUMBER_WORDS = numberWords();

/** Past this many, the book has a house style and this is not the report for it. */
const MAX_NUMBER_FINDINGS = 8;

const NUMBER_NOTE =
  "The same number is written as a word in one place and in digits in " +
  "another. Most publishers spell out numbers below a hundred in fiction and " +
  "use digits above it, but that is a house style rather than a law — what is " +
  "recorded here is only that this book does both for one number.";

function numberFindings(
  found: Scan,
  book: readonly BookText[],
): ConsistencyFinding[] {
  /*
   * One finding per *value*, not per spelling. `twenty-one` and `twenty one`
   * both name 21, and a book that writes it three ways is one decision rather
   * than two — so the commonest written form leads and the others stay quiet.
   */
  const best = new Map<number, { word: string; tally: Tally }>();
  for (const [word, value] of NUMBER_WORDS) {
    const tally = tallyOf(found, word);
    if (!tally) continue;
    const held = best.get(value);
    if (!held || tally.total > held.tally.total) {
      best.set(value, { word, tally });
    }
  }

  const out: ConsistencyFinding[] = [];
  for (const [value, { word, tally }] of best) {
    const digits = found.numerals.get(String(value));
    if (!digits) continue;
    out.push(
      drift("numbers", NUMBER_NOTE, [
        variantOf(word, tally, book),
        variantOf(String(value), digits, book),
      ]),
    );
  }

  return out
    .sort((a, b) => b.variants[0].count - a.variants[0].count)
    .slice(0, MAX_NUMBER_FINDINGS);
}

/* ------------------------------------------------------------------ *
 * (h) The same term capitalised two ways
 * ------------------------------------------------------------------ */

/**
 * Words English writes both ways on purpose.
 *
 * *Mother said* and *my mother*, *the Earth* and *the earth*, *King Robert* and
 * *the king* are all correct beside one another, and a check that reports them
 * is wrong on nearly every book. What is left once these are gone is the case
 * this check exists for: a term the writer invented and then capitalised only
 * some of the time.
 *
 * **`council`, `sight`, `order` and their like are deliberately absent.** They
 * look exactly like `king` from the outside, and that is the point — English
 * has a convention for a monarch and none at all for somebody's invented
 * institution, so only one of the two can be assumed.
 */
const BOTH_CASES = new Set([
  "mother", "father", "mum", "mom", "dad", "papa", "mama", "grandmother",
  "grandfather", "gran", "nan", "aunt", "auntie", "uncle", "cousin",
  "sir", "madam", "lord", "lady", "king", "queen", "prince", "princess",
  "duke", "duchess", "emperor", "empress", "doctor", "professor", "captain",
  "sergeant", "colonel", "major", "general", "admiral", "president", "senator",
  "earth", "sun", "moon", "god", "gods", "goddess", "heaven", "hell", "devil",
  "north", "south", "east", "west", "northern", "southern", "eastern",
  "western", "spring", "summer", "autumn", "winter", "fall",
  "state", "church", "government", "army", "navy", "court", "crown",
  "parliament", "congress", "senate", "university", "college",
]);

/** Under this many of *each*, a capital is a habit rather than a decision. */
const MIN_EITHER_CASE = 3;
const MAX_CAPITAL_FINDINGS = 10;

const CAPITAL_NOTE =
  "The same word is capitalised in some places and not in others. This is the " +
  "hardest thing to keep straight in a book with invented terms in it, " +
  "because there is nothing to look the answer up in — the writer decided it. " +
  "Words English genuinely writes both ways, a mother beside Mother or a king " +
  "beside King Robert, are not counted.";

function capitalFindings(
  found: Scan,
  book: readonly BookText[],
): ConsistencyFinding[] {
  const out: ConsistencyFinding[] = [];

  for (const [word, upper] of found.standaloneCapitals) {
    /*
     * **Both sides have to be mid-sentence, and both have to be habits.**
     * Every sentence opens on a capital, so a sentence-initial use is evidence
     * of nothing at all; and a term capitalised once in forty is a typo rather
     * than a second convention, which is a different report from this one.
     */
    if (upper.midSentence < MIN_EITHER_CASE) continue;

    const plain = word.toLocaleLowerCase();
    /*
     * Three reasons to stay quiet, kept apart because they are three different
     * reasons. `BOTH_CASES` is what English writes both ways by convention;
     * `NOT_NAMES` is the titles and calendar words the name check already
     * refuses; `NAME_WORDS` is generated, and is every ordinary word that is
     * also somebody's name — without it this check fires on any novel whose
     * character was named out of the dictionary, which is most of them.
     */
    if (BOTH_CASES.has(plain) || NOT_NAMES.has(plain) || NAME_WORDS.has(plain)) {
      continue;
    }

    const lower = found.lowered.get(plain);
    if (!lower || lower.midSentence < MIN_EITHER_CASE) continue;

    out.push(
      drift("capitals", CAPITAL_NOTE, [
        variantOf(word, upper, book),
        variantOf(plain, lower, book),
      ]),
    );
  }

  return out
    .sort((a, b) => b.variants[0].count - a.variants[0].count)
    .slice(0, MAX_CAPITAL_FINDINGS);
}

/* ------------------------------------------------------------------ *
 * (i) Scene breaks written more than one way
 * ------------------------------------------------------------------ */

/**
 * What a real scene break is called on the card.
 *
 * It has no text of its own — that is the whole finding — so it needs a word,
 * and the word has to say what it *is* rather than what it looks like.
 */
export const REAL_BREAK = "a real break";

const BREAK_NOTE =
  "This book marks a scene break in more than one way. A real break is a mark " +
  "the file itself carries, and it is typeset as one wherever the book is " +
  "read. Asterisks typed into a paragraph are not: they are words, and they " +
  "come out of the exporter as a centred line of text in the body face. A " +
  "manuscript that arrived from somewhere else usually holds both, and the " +
  "difference does not show until the finished file is opened.";

function breakFindings(book: readonly BookText[]): ConsistencyFinding[] {
  const blank = (): Tally => ({
    total: 0,
    midSentence: 0,
    perChapter: new Map(),
  });
  const real = blank();
  const typed = new Map<string, Tally>();

  book.forEach((chapter, index) => {
    for (const mark of chapter.breaks ?? []) {
      let tally: Tally;
      if (mark === null) tally = real;
      else {
        const held = typed.get(mark);
        if (held) tally = held;
        else {
          tally = blank();
          typed.set(mark, tally);
        }
      }
      tally.total += 1;
      const spot = tally.perChapter.get(index);
      if (spot) spot.count += 1;
      else tally.perChapter.set(index, { count: 1 });
    }
  });

  // One kind of break, however many of them there are, is a consistent book.
  const kinds = (real.total > 0 ? 1 : 0) + typed.size;
  if (kinds < 2) return [];

  const variants: Variant[] = [];
  if (real.total > 0) variants.push(variantOf(REAL_BREAK, real, book));
  for (const [mark, tally] of typed) variants.push(variantOf(mark, tally, book));

  return [drift("breaks", BREAK_NOTE, variants)];
}

/* ------------------------------------------------------------------ *
 * (j) A near-miss of a word this book uses
 * ------------------------------------------------------------------ */

/** Below this, too many real English words sit one edit from one another. */
const MIN_TYPO_LENGTH = 5;
/** A word used more than twice is a word, not a slip. */
const MAX_TYPO_USES = 2;
/** The correct spelling has to be a habit, not another one-off. */
const MIN_TYPO_ANCHOR = 3;
/**
 * How many times over the near-miss the correct spelling has to be used.
 *
 * **Three, not the four the other checks share.** `DOMINANCE` is written for a
 * pair that both appear freely, where four is what separates a slip from a book
 * that does both. Here the rare side is capped at two uses to begin with, so
 * four would mean a word used three times could never anchor anything — and a
 * name used three times and mistyped once is the exact gap this check was added
 * to close.
 */
const TYPO_DOMINANCE = 3;
const MAX_TYPO_FINDINGS = 10;

const TYPO_NOTE =
  "A word used once or twice, one letter from a word this book uses often, " +
  "and in no English dictionary. That is the shape of a mistyped invented " +
  "word — the one thing a spelling checker cannot help with, because it has " +
  "never heard of the word either. Some of these will be deliberate: a book " +
  "written in dialect, a word coined once on purpose. Nothing here knows " +
  "which, and the correct spelling is whichever one you meant.";

/**
 * Every word one edit from this one.
 *
 * **Generated rather than compared, and that is the whole of why this check is
 * fast enough to exist.** Testing every rare word against every frequent one is
 * ten thousand by five thousand on a novel — fifty million comparisons, against
 * a check that runs in about 150ms today. Building the neighbours of a word and
 * looking each one up is about sixty per letter, and a `Map.get` apiece.
 *
 * Deletions, substitutions, insertions and the one transposition
 * `looksLikeDrift` admits. The guards it carries — a first letter may only turn
 * into one English actually swaps it for, a short word may not change a vowel —
 * are applied afterwards, on the handful that matched.
 */
function neighbours(word: string): Set<string> {
  const out = new Set<string>();
  const letters = "abcdefghijklmnopqrstuvwxyz";

  for (let i = 0; i < word.length; i += 1) {
    out.add(word.slice(0, i) + word.slice(i + 1));
    for (const letter of letters) {
      out.add(word.slice(0, i) + letter + word.slice(i + 1));
      out.add(word.slice(0, i) + letter + word.slice(i));
    }
    if (i + 1 < word.length) {
      out.add(
        word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2),
      );
    }
  }
  for (const letter of letters) out.add(word + letter);

  out.delete(word);
  return out;
}

/**
 * How often a word was capitalised in the middle of a sentence.
 *
 * No table of its own: `lower` counts every token and `lowered` counts only the
 * ones that do not start with a capital, so the difference is already there.
 * **Mid-sentence is the only place a capital means anything** — at the head of a
 * sentence every word has one.
 */
const capitalMid = (found: Scan, word: string) =>
  (found.lower.get(word)?.midSentence ?? 0) -
  (found.lowered.get(word)?.midSentence ?? 0);

const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A hyphenated compound pluralised on the inside.
 *
 * *son-in-law* and *sons-in-law*, *passer-by* and *passers-by*. `looksLikeDrift`
 * already refuses a plural, but it looks at the end of the word — and English
 * puts this one in the middle, so the guard walked straight past it and Pride
 * and Prejudice reported a correct plural as a typo.
 */
function innerPlural(a: string, b: string): boolean {
  const left = a.split("-");
  const right = b.split("-");
  if (left.length !== right.length || left.length < 2) return false;
  let differences = 0;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] === right[i]) continue;
    differences += 1;
    if (left[i] !== `${right[i]}s` && right[i] !== `${left[i]}s`) return false;
  }
  return differences === 1;
}

function typoFindings(
  found: Scan,
  book: readonly BookText[],
  words: ReadonlySet<string>,
): ConsistencyFinding[] {
  const out: ConsistencyFinding[] = [];

  for (const [rare, rareTally] of found.lower) {
    if (rareTally.total > MAX_TYPO_USES) continue;
    if (rare.length < MIN_TYPO_LENGTH) continue;
    /*
     * Letters, and hyphens between them. `sky-glass` against `sky-glasse` was
     * invisible while this was letters only, and a hyphenated invented word is
     * exactly the kind this check is for. Apostrophes stay out: a `\b` beside a
     * trailing one behaves badly, and a mistyped contraction is not this.
     */
    if (!/^\p{L}+(?:-\p{L}+)*$/u.test(rare)) continue;
    // The two ways a word earns the benefit of the doubt: English has it, or
    // it is somebody's name. Both are things a book may use once and mean.
    if (words.has(rare) || NAME_WORDS.has(rare)) continue;
    /*
     * **A hyphenated word is in no dictionary at all**, so the test above waves
     * every one of them through — which is how `twelve-month` came back as a
     * typo of *twelvemonth* on Pride and Prejudice. Closing the hyphen up and
     * asking again is the same question the word list can actually answer, and
     * it is exactly the pair the hyphenation check already reports properly.
     */
    if (rare.includes("-") && words.has(rare.replace(/-/g, ""))) continue;

    for (const candidate of neighbours(rare)) {
      const anchor = found.lower.get(candidate);
      if (!anchor) continue;
      if (anchor.total < MIN_TYPO_ANCHOR) continue;
      if (anchor.total < rareTally.total * TYPO_DOMINANCE) continue;
      if (!looksLikeDrift(rare, candidate)) continue;
      if (innerPlural(rare, candidate)) continue;

      /*
       * **A capital where the frequent word has none is a proper noun.**
       *
       * Measured on Moby Dick, this was four of the ten findings — `Sebond`
       * against *second*, `Tooke` against *took*, `Matse` against *mate*. Every
       * one a name the book mentions once, one letter from an ordinary word it
       * uses constantly, and none of them a mistake. A name the census list has
       * never heard of is exactly what `NAME_WORDS` cannot catch, and this is
       * the signal that does: nobody capitalises a typo of a lower-case word.
       *
       * **Counted mid-sentence, and that is the whole correctness of it.** This
       * read the written spelling instead, so a typo that happened to open a
       * sentence was capitalised by the only test that mattered — and vanished.
       * `Aetherius glittered on the shelf` found nothing where `she held the
       * aetherius` found it, for the same book and the same mistake. Every
       * sentence starts on a capital, so a capital there is evidence of
       * nothing; the rest of this module says so in four places and this line
       * did not.
       *
       * A pair capitalised on both sides is left alone — that is
       * `Aetherius`/`Aetherium`, which is the case this check exists for.
       */
      if (capitalMid(found, rare) > 0 && capitalMid(found, candidate) === 0) {
        continue;
      }

      /*
       * A sentence carrying both is two words being used, not one mistyped —
       * the same guard the name check leans on, and for the same reason.
       *
       * Escaped, now that a hyphen can reach here. A hyphen outside a character
       * class is literal, so this is not a live bug — but leaning on that is
       * how one arrives later.
       */
      const here = new RegExp(`\\b${escapeRe(rare)}\\b`, "i");
      const there = new RegExp(`\\b${escapeRe(candidate)}\\b`, "i");
      if (found.lines.some((line) => here.test(line.text) && there.test(line.text))) {
        continue;
      }

      out.push(
        drift("typos", TYPO_NOTE, [
          variantOf(found.written.get(rare)?.text ?? rare, rareTally, book),
          variantOf(
            found.written.get(candidate)?.text ?? candidate,
            anchor,
            book,
          ),
        ]),
      );
      break;
    }
  }

  /*
   * Commonest correct spelling first — the more a book leans on a word, the
   * more a near-miss of it reads as a slip. Capped for the reason the name
   * check is capped: past a certain number the detection has gone wrong, and a
   * wall of cards is worse than a short list.
   */
  return out
    .sort((a, b) => b.variants[0].count - a.variants[0].count)
    .slice(0, MAX_TYPO_FINDINGS);
}

/* ------------------------------------------------------------------ *
 * The report
 * ------------------------------------------------------------------ */

/**
 * One pair of spellings, one card, whichever check found it first.
 *
 * **Two checks can describe one problem and nothing used to stop the second.**
 * A capitalised invented word used often and mistyped once is a name spelled
 * two ways *and* a near-miss of a word you use, so `Aetherium / Aetherius`
 * arrived twice — two cards, two switches, one mistake.
 *
 * First wins, and the order is already the right one: `ALL_CHECKS` is the order
 * these are worth reading in, so the flagship name check keeps the card and the
 * broader net stands down.
 *
 * General rather than shaped around the pair that exposed it, because the next
 * two checks to overlap should not need a second fix. A finding with no
 * spellings at all — a quotation mark left open — has an empty key and is never
 * matched against anything.
 */
function onlyOnce(): (finding: ConsistencyFinding) => boolean {
  const seen = new Set<string>();
  return (finding) => {
    if (finding.variants.length === 0) return true;
    const spellings = finding.variants
      .map((variant) => variant.text.toLocaleLowerCase())
      .sort()
      .join("|");
    if (seen.has(spellings)) return false;
    seen.add(spellings);
    return true;
  };
}

/**
 * Every check, over the whole book.
 *
 * The order is the order they are worth reading in — the flagship first, the
 * weakest last. `chapters` and `words` are not decoration: they are the only
 * way the screen can tell "six checks ran and found nothing" from "nothing was
 * read", and the house rule that an empty result is never rendered as a good
 * one has nowhere else to live.
 */
export function consistencyReport(
  book: readonly BookText[],
  options: ConsistencyOptions = {},
): ConsistencyReport {
  const known = options.known ?? [];
  const dismissed = new Set(options.dismissed ?? []);
  const usedBible = known.length > 0;

  /*
   * **`ran` is computed from `ALL_CHECKS`, never from what came back.**
   *
   * A check that ran and found nothing and a check that never ran are the same
   * empty array of findings, and the whole house rule about empty results
   * turns on telling them apart.
   */
  /*
   * **The near-miss check drops out of `ran` when it has no word list.**
   *
   * It is the one check that needs something fetched, and the editor is
   * expected to work with the network off — so this is an ordinary case rather
   * than an error. Leaving it in `ran` would report an unloadable dictionary as
   * a book with no typos in it, which is the failure this field exists to
   * prevent.
   */
  const asked = options.only
    ? ALL_CHECKS.filter((id) => options.only!.includes(id))
    : ALL_CHECKS;
  const ran = options.words
    ? asked
    : asked.filter((id) => id !== "typos");
  const wanted = (id: CheckId) => ran.includes(id);

  if (book.length === 0) {
    return { chapters: 0, words: 0, usedBible, ran, findings: [] };
  }

  const found = scan(book);
  const findings = [
    ...(wanted("names") ? nameFindings(found, book, known) : []),
    ...(wanted("spelling") ? spellingFindings(found, book) : []),
    ...(wanted("style")
      ? pairFindings(found, book, STYLE_PAIRS, "style", STYLE_NOTE)
      : []),
    ...(wanted("quotes") ? quoteFindings(found, book) : []),
    ...(wanted("unclosed") ? unclosedFindings(found, book) : []),
    ...(wanted("doubled") ? doubledFindings(found, book) : []),
    ...(wanted("hyphens") ? hyphenFindings(found, book) : []),
    ...(wanted("numbers") ? numberFindings(found, book) : []),
    ...(wanted("capitals") ? capitalFindings(found, book) : []),
    ...(wanted("breaks") ? breakFindings(book) : []),
    ...(wanted("typos") && options.words
      ? typoFindings(found, book, options.words)
      : []),
  ]
    .filter(onlyOnce())
    .filter((finding) => !dismissed.has(finding.key));

  return { chapters: book.length, words: found.words, usedBible, ran, findings };
}

/* ------------------------------------------------------------------ *
 * Findings the writer has already answered
 * ------------------------------------------------------------------ */

/**
 * A finding set aside, and when.
 *
 * The parser lives here rather than in a module of its own because the only
 * thing it holds is a `driftKey`, which is defined above it. A file holding
 * one twelve-line parser is a file to forget.
 */
export interface Dismissal {
  key: string;
  at: number;
}

export function parseDismissals(raw: string | null): Dismissal[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((row) => {
      if (typeof row !== "object" || row === null) return [];
      const { key, at } = row as { key?: unknown; at?: unknown };
      if (typeof key !== "string" || !key) return [];
      return [{ key, at: typeof at === "number" ? at : 0 }];
    });
  } catch {
    return [];
  }
}

/** Set one aside. Writing the same one twice is not an error, it is a no-op. */
export function withDismissal(
  list: readonly Dismissal[],
  key: string,
  at: number = Date.now(),
): Dismissal[] {
  if (list.some((row) => row.key === key)) return [...list];
  return [...list, { key, at }];
}

/**
 * Put one back.
 *
 * There is always a way back. A dismissal kept in storage that the writer
 * cannot find again is a trap, not a preference.
 */
export function withoutDismissal(
  list: readonly Dismissal[],
  key: string,
): Dismissal[] {
  return list.filter((row) => row.key !== key);
}

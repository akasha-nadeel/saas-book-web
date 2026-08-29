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

/** One chapter's prose, paragraphs intact. */
export interface BookText {
  chapterId: string;
  title: string;
  /** Body-chapter number, or null for a page named rather than numbered. */
  number: number | null;
  /** `proseFrom(toBlocks(doc))` — paragraphs joined by a blank line. */
  text: string;
}

/** Where one spelling appears, and how often, in one chapter. */
export interface Where {
  chapterId: string;
  chapterTitle: string;
  number: number | null;
  count: number;
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
  | "hyphens"
  | "quotes"
  | "doubled"
  | "unclosed";

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
    });
    previousEnd = match.index + match[0].length;
  }

  return out;
}

/** Everything one spelling did, across the book. */
interface Tally {
  total: number;
  /** Appearances that were not the first word of a sentence or a speech. */
  midSentence: number;
  perChapter: Map<number, number>;
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
  tally.perChapter.set(chapter, (tally.perChapter.get(chapter) ?? 0) + 1);
  // The first sentence is kept rather than the best one: a real place in the
  // book beats a shorter sentence chosen by a rule.
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
          if (/[\u2010-\u2015-]/.test(token.text)) {
            bump(out.hyphenated, lower, index, mid, sentence);
          }
          if (/^\p{Lu}/u.test(token.text) && /\p{Ll}/u.test(token.text.slice(1))) {
            bump(out.capitals, token.text, index, mid, sentence);
          }
          if (at > 0 && token.spaced) {
            const pair = `${tokens[at - 1].text.toLocaleLowerCase()} ${lower}`;
            bump(out.bigrams, pair, index, mid, sentence);
          }
        });
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
    .map(([index, count]) => ({
      chapterId: book[index].chapterId,
      chapterTitle: book[index].title,
      number: book[index].number,
      count,
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
 * hundred hash lookups rather than a few hundred regexes over the manuscript.
 */
const SPELLING_PAIRS: readonly (readonly [string, string])[] = [
  ["colour", "color"], ["colours", "colors"], ["coloured", "colored"],
  ["colourful", "colorful"], ["favour", "favor"], ["favours", "favors"],
  ["favourite", "favorite"], ["favourites", "favorites"],
  ["neighbour", "neighbor"], ["neighbours", "neighbors"],
  ["honour", "honor"], ["honoured", "honored"], ["harbour", "harbor"],
  ["rumour", "rumor"], ["rumours", "rumors"], ["armour", "armor"],
  ["behaviour", "behavior"], ["labour", "labor"], ["odour", "odor"],
  ["parlour", "parlor"], ["saviour", "savior"], ["splendour", "splendor"],
  ["vapour", "vapor"], ["humour", "humor"], ["flavour", "flavor"],
  ["flavours", "flavors"], ["endeavour", "endeavor"], ["clamour", "clamor"],

  ["centre", "center"], ["centres", "centers"], ["centred", "centered"],
  ["theatre", "theater"], ["metre", "meter"], ["metres", "meters"],
  ["litre", "liter"], ["litres", "liters"], ["fibre", "fiber"],
  ["sombre", "somber"], ["spectre", "specter"], ["lustre", "luster"],
  ["calibre", "caliber"], ["sceptre", "scepter"], ["sabre", "saber"],

  ["realise", "realize"], ["realised", "realized"], ["realising", "realizing"],
  ["recognise", "recognize"], ["recognised", "recognized"],
  ["apologise", "apologize"], ["apologised", "apologized"],
  ["organise", "organize"], ["organised", "organized"],
  ["organisation", "organization"], ["civilisation", "civilization"],
  ["memorise", "memorize"], ["emphasise", "emphasize"],
  ["criticise", "criticize"], ["criticised", "criticized"],
  ["analyse", "analyze"], ["analysed", "analyzed"],
  ["paralyse", "paralyze"], ["paralysed", "paralyzed"],
  ["summarise", "summarize"], ["agonise", "agonize"],

  ["travelled", "traveled"], ["travelling", "traveling"],
  ["traveller", "traveler"], ["travellers", "travelers"],
  ["cancelled", "canceled"], ["cancelling", "canceling"],
  ["labelled", "labeled"], ["labelling", "labeling"],
  ["marvellous", "marvelous"], ["jewellery", "jewelry"],
  ["counsellor", "counselor"], ["modelling", "modeling"],
  ["signalled", "signaled"], ["shrivelled", "shriveled"],
  ["fuelled", "fueled"], ["quarrelled", "quarreled"],
  ["enrol", "enroll"], ["fulfil", "fulfill"], ["skilful", "skillful"],
  ["instalment", "installment"], ["appal", "appall"],

  ["defence", "defense"], ["offence", "offense"], ["pretence", "pretense"],
  ["anaemic", "anemic"], ["paediatric", "pediatric"], ["foetus", "fetus"],
  ["manoeuvre", "maneuver"], ["oesophagus", "esophagus"],

  ["grey", "gray"], ["greyish", "grayish"], ["greying", "graying"],
  ["greyer", "grayer"], ["plough", "plow"], ["ploughed", "plowed"],
  ["pyjamas", "pajamas"], ["moustache", "mustache"],
  ["aluminium", "aluminum"], ["smoulder", "smolder"],
  ["smouldering", "smoldering"], ["sceptical", "skeptical"],
  ["speciality", "specialty"], ["woollen", "woolen"],
  ["dreamt", "dreamed"], ["spelt", "spelled"], ["spilt", "spilled"],
  ["leapt", "leaped"], ["knelt", "kneeled"],
];

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
];

const SPELLING_NOTE =
  "Both spellings are in this book. Neither is wrong — one is British and one " +
  "is American — and a manuscript carrying both is one of the things a copy " +
  "editor is hired to find. Nothing here has a preference between them.";

function spellingFindings(
  found: Scan,
  book: readonly BookText[],
): ConsistencyFinding[] {
  const skip = new Set(AMBIGUOUS_PAIRS.map(([a, b]) => `${a}|${b}`));
  const out: ConsistencyFinding[] = [];

  for (const [british, american] of SPELLING_PAIRS) {
    if (skip.has(`${british}|${american}`)) continue;
    const one = found.lower.get(british);
    const other = found.lower.get(american);
    // The whole guard: a spelling this book does not contain is never reported.
    if (!one || !other) continue;
    out.push(
      drift("spelling", SPELLING_NOTE, [
        variantOf(british, one, book),
        variantOf(american, other, book),
      ]),
    );
  }

  return out.sort((a, b) => b.variants[0].count - a.variants[0].count);
}

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
]);

/** Closed forms that are their own word, and a different one. */
const DIFFERENT_WORD = new Set([
  "everyday", "anymore", "awhile", "alright", "cannot", "into", "onto",
  "maybe", "nobody", "anyone", "someone", "everyone", "already", "altogether",
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

function quoteFindings(book: readonly BookText[]): ConsistencyFinding[] {
  const out: ConsistencyFinding[] = [];

  for (const [kind, marks] of Object.entries(QUOTE_KINDS)) {
    const straight: Tally = { total: 0, midSentence: 0, perChapter: new Map() };
    const curly: Tally = { total: 0, midSentence: 0, perChapter: new Map() };

    book.forEach((chapter, index) => {
      const plain = (chapter.text.match(marks.straight) ?? []).length;
      const typeset = (chapter.text.match(marks.curly) ?? []).length;
      if (plain > 0) {
        straight.total += plain;
        straight.perChapter.set(index, plain);
      }
      if (typeset > 0) {
        curly.total += typeset;
        curly.perChapter.set(index, typeset);
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
  "had", "that", "no", "now", "there", "well", "come", "hear", "yes",
  "ha", "bye", "night", "bang", "knock", "tut", "chop", "blah",
  "so", "very", "long", "far", "many", "much", "go", "run", "quick",
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
      hit.tally.perChapter.set(
        line.chapter,
        (hit.tally.perChapter.get(line.chapter) ?? 0) + 1,
      );
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
    tally.perChapter.set(
      paragraph.chapter,
      (tally.perChapter.get(paragraph.chapter) ?? 0) + 1,
    );
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
 * The report
 * ------------------------------------------------------------------ */

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

  if (book.length === 0) {
    return { chapters: 0, words: 0, usedBible, findings: [] };
  }

  const found = scan(book);
  const findings = [
    ...nameFindings(found, book, known),
    ...spellingFindings(found, book),
    ...quoteFindings(book),
    ...doubledFindings(found, book),
    ...unclosedFindings(found, book),
    ...hyphenFindings(found, book),
  ].filter((finding) => !dismissed.has(finding.key));

  return { chapters: book.length, words: found.words, usedBible, findings };
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

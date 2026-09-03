#!/usr/bin/env node
/**
 * Rebuild the consistency check's three generated word tables.
 *
 *   node scripts/build-word-tables.cjs
 *
 * A one-shot tool, like `feature-shots.cjs` and `cut-illustration.cjs` — not
 * part of the build. It downloads its sources rather than keeping them in the
 * repo, so run it with a network. Nothing it downloads ever ships: the tables
 * it writes are the only thing committed.
 *
 *   src/lib/spelling-pairs.ts   British against American
 *   src/lib/style-pairs.ts      the same word written two ways
 *   src/lib/name-words.ts       words that are also somebody's name
 *
 * ## The sources, and what each is for
 *
 * **VarCon**, by Kevin Atkinson and Benjamin Titze — British/American/Canadian/
 * Australian spelling pairs, verified against Oxford dictionaries. Licence:
 * "permission to use, copy, modify, distribute and sell this array ... without
 * fee" provided the copyright notice is kept, so it is safe in a paid product.
 *
 * **AGID**, same author, same terms — inflections. Used only to grow the
 * house-style seeds: `e-mail` on its own finds nothing when the book writes
 * `e-mails`.
 *
 * **words_alpha.txt** (dwyl/english-words, Unlicense) — used to throw out
 * malformed entries, and never shipped.
 *
 * **US Census 1990 name frequencies** — public domain, a work of the US
 * government. First names and surnames with their popularity rank.
 *
 * All four are snapshots. VarCon and AGID are **no longer maintained** — both
 * were folded into the English Speller Database, whose format is harder to
 * read.
 *
 * ## Why the filtering is this aggressive
 *
 * The failure this check cannot afford is a false positive: a writer told five
 * times that their deliberate sentence is broken stops reading the sixth. Each
 * step below throws away more than it keeps, and each generated file carries
 * the same argument written for a reader rather than for a machine.
 */

const fs = require("fs");
const path = require("path");

const SRC = {
  varcon: "https://raw.githubusercontent.com/en-wl/wordlist/v1/varcon/varcon.txt",
  agid: "https://raw.githubusercontent.com/en-wl/wordlist/v1/agid/infl.txt",
  words:
    "https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt",
  male: "https://www2.census.gov/topics/genealogy/1990surnames/dist.male.first",
  female:
    "https://www2.census.gov/topics/genealogy/1990surnames/dist.female.first",
  last: "https://www2.census.gov/topics/genealogy/1990surnames/dist.all.last",
};

/**
 * How obscure a word may be and still count.
 *
 * SCOWL's own scale: 10 is the commonest few thousand words, 35 is a normal
 * vocabulary, 70 is well past what a novel contains. It was 60, and 70 was
 * chosen deliberately — the extra entries are words nobody writes, they cost
 * about ten kilobytes, and a spelling table that stops early is the one failure
 * a writer notices as *the tool missed it*.
 */
const LEVEL_MAX = 70;

/**
 * How well known a name has to be to silence a word.
 *
 * Every name here takes a real finding away — a book that genuinely writes
 * *Rose* and *rose* inconsistently will never be told. That is the right way
 * round, because a character called Rose in a book with roses in it is far
 * commoner and is not an error. But it is a cost, so the cut is at names people
 * actually use rather than at every name ever recorded.
 */
const FIRST_RANK = 1500;
const LAST_RANK = 2500;

const OUT = (name) => path.join(__dirname, "..", "src", "lib", name);

async function text(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

/* ------------------------------------------------------------------ *
 * VarCon
 * ------------------------------------------------------------------ */

/**
 * One line of VarCon is a set of tagged forms:
 *
 *     A Cv DV: story / AV B C D: storey | level of building
 *
 * `A` American, `B` British, `C` Canadian, `D` Australian, `Z` British -ize.
 * A lowercase `v` marks a variant, an uppercase `V` marks one that is **seldom
 * used**, and a trailing `.` marks the preferred of two acceptable forms.
 * Everything after `|` is a sense note.
 */
function parseVarcon(varcon) {
  const rows = [];
  let level = null;
  let noted = 0;
  let seldom = 0;

  for (const raw of varcon.split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("#")) {
      const m = /\(level (\d+)\)/.exec(line);
      level = m ? Number(m[1]) : null;
      continue;
    }
    if (!line || !line.includes(":")) continue;

    // **A sense note means the two words mean different things**, and that one
    // rule catches every trap the hand-written list found the hard way:
    // story/storey, check/cheque, tire/tyre, draft/draught, curb/kerb,
    // license/licence, whiskey/whisky, practice/practise.
    if (line.includes("|")) {
      noted += 1;
      continue;
    }

    const forms = line
      .split("/")
      .map((part) => part.trim())
      .filter((part) => part.includes(":"))
      .map((part) => {
        const at = part.indexOf(":");
        return {
          tags: part.slice(0, at).trim().split(/\s+/),
          word: part.slice(at + 1).trim(),
        };
      });
    if (forms.length < 2) continue;

    /*
     * **The main form for a dialect, not merely a form.** `foetus` is tagged
     * `Bv` and `dreamt` is `B.`, and requiring a bare `B` threw both away along
     * with several hundred others. What is refused is an uppercase `V` —
     * *seldom used* — because a spelling nobody writes cannot be one this book
     * is inconsistent about.
     */
    const main = (letter) => {
      const hit = forms.find((f) =>
        f.tags.some((t) => t[0] === letter && !/V/.test(t.slice(1))),
      );
      return hit?.word;
    };
    const american = main("A");
    const british = main("B");
    if (!american || !british || american === british) continue;
    if (level === null || level > LEVEL_MAX) continue;
    if (forms.length > 2) seldom += 1;

    rows.push([british, american]);
  }
  return { rows, noted, third: seldom };
}

/* ------------------------------------------------------------------ *
 * AGID
 * ------------------------------------------------------------------ */

/**
 * Every inflected form of a word, from lines shaped like
 *
 *     email V: emailed | emailing | emails
 *
 * The variant markers AGID puts on uncertain forms (`~ < ! ? {}` and a trailing
 * digit) are stripped; anything left that is not plain letters is dropped.
 */
function parseAgid(agid) {
  const out = new Map();
  for (const raw of agid.split("\n")) {
    const at = raw.indexOf(":");
    if (at < 0) continue;
    const head = raw.slice(0, at).trim().split(/\s+/);
    const word = head[0]?.toLowerCase();
    if (!word) continue;
    const forms = raw
      .slice(at + 1)
      .split("|")
      .flatMap((chunk) => chunk.split(","))
      .map((form) => form.replace(/\{[^}]*\}/g, "").trim())
      // **A form AGID is unsure of is not a form.** `?` and `!` are its doubt
      // markers, and they are on exactly the entries nobody writes —
      // `percenter?`, `percentest?`. Keeping them put words in the table that
      // no book contains.
      .filter((form) => !/[?!]/.test(form))
      .map((form) => form.replace(/[~<]/g, "").trim())
      .map((form) => form.split(/\s+/)[0]?.toLowerCase() ?? "")
      .filter((form) => /^[a-z]+$/.test(form));
    if (!forms.length) continue;
    const held = out.get(word) ?? new Set();
    for (const form of forms) held.add(form);
    out.set(word, held);
  }
  return out;
}

/**
 * House-style pairs: both forms are correct, and a book should pick one.
 *
 * Hand-written, because there is no VarCon for this — it is not a dialect
 * question, it is a decision. It stays short on purpose: the tempting entries
 * are **not variants at all**. *every day* and *everyday*, *any more* and
 * *anymore*, *a while* and *awhile*, *over all* and *overall* mean different
 * things, and reporting them would be wrong on every book that uses English
 * correctly.
 *
 * Also refused, each for a reason worth keeping: `blond/blonde` (gendered, not
 * a variant), `farther/further` (distance against degree), `hanged/hung`
 * (executed against suspended), `shrunk/shrank` and `sunk/sank` (participle
 * against past tense), and `fitted/fit` — `fit` is far commoner as an adjective
 * than as a past tense, which is the trap `one` sets in the number check.
 */
const STYLE_SEEDS = [
  // Spaced or hyphenated against closed. These are the ones AGID can inflect,
  // because the two forms differ by a mark and nothing else.
  ["e-mail", "email"],
  ["good-bye", "goodbye"],
  ["good night", "goodnight"],
  ["all right", "alright"],
  ["per cent", "percent"],
  ["co-operate", "cooperate"],
  ["co-ordinate", "coordinate"],
  ["co-worker", "coworker"],
  ["co-author", "coauthor"],
  ["re-enter", "reenter"],
  ["re-read", "reread"],
  ["pre-empt", "preempt"],
  ["web site", "website"],
  ["on-line", "online"],
  ["home page", "homepage"],
  ["cell phone", "cellphone"],
  ["health care", "healthcare"],
  ["data base", "database"],
  ["life style", "lifestyle"],
  ["under way", "underway"],
  ["worth while", "worthwhile"],
  ["none the less", "nonetheless"],
  ["for ever", "forever"],
  // Two spellings of one word, with no rule joining them.
  ["okay", "ok"],
  ["doughnut", "donut"],
  ["amidst", "amid"],
  ["backwards", "backward"],
  ["forwards", "forward"],
  ["upwards", "upward"],
  ["downwards", "downward"],
  ["sneaked", "snuck"],
  ["dived", "dove"],
  ["lighted", "lit"],
  ["pleaded", "pled"],
  ["proved", "proven"],
];

/**
 * The seeds, plus every inflection of them.
 *
 * **Only pairs that differ by a hyphen or a space are inflected.** For those
 * the transformation is unambiguous: whatever suffix turns `email` into
 * `emails` turns `e-mail` into `e-mails`. For a pair like `sneaked/snuck` there
 * is no such rule, and guessing would put words in the table that nobody
 * writes.
 */
function styleTable(agid, words) {
  const out = new Set(STYLE_SEEDS.map(([a, b]) => `${a}\t${b}`));

  for (const [open, closed] of STYLE_SEEDS) {
    if (open.replace(/[- ]/g, "") !== closed) continue;
    for (const form of agid.get(closed) ?? []) {
      if (!form.startsWith(closed) || form === closed) continue;
      /*
       * **Not checked against the word list, unlike the VarCon pairs.** That
       * guard exists to catch VarCon's machine-made inflections — `colorrest`,
       * `lacklusterrer` — and here it was doing the opposite: `emails`,
       * `emailing` and `websites` are all missing from a word list built in
       * 2016, so the guard threw away the very forms AGID was fetched for.
       * AGID is a curated inflection database; its own doubt markers are the
       * check that belongs here, and they are applied in `parseAgid`.
       */
      out.add(`${open}${form.slice(closed.length)}\t${form}`);
    }
  }

  return [...out].sort().map((k) => k.split("\t"));
}

/* ------------------------------------------------------------------ *
 * Census names
 * ------------------------------------------------------------------ */

/** `NAME  frequency  cumulative  rank` — one name per line. */
function parseNames(raw, maxRank) {
  const out = [];
  for (const line of raw.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;
    if (Number(parts[3]) > maxRank) continue;
    out.push(parts[0].toLowerCase());
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Writing the tables out
 * ------------------------------------------------------------------ */

/**
 * The head of the file is kept and the body replaced.
 *
 * The doc comment above each table is written by hand and is the point of these
 * files — the provenance, the licence, and what was filtered out and why. Only
 * what sits below the export line is generated.
 */
function render(file, exportLine, rows, close) {
  const head = fs.existsSync(file)
    ? fs.readFileSync(file, "utf8").split(exportLine)[0]
    : "";
  return `${head}${exportLine}\n${rows.join("\n")}\n${close}\n`;
}

async function main() {
  process.stdout.write("fetching five sources…\n");
  const [varcon, agidRaw, wordsRaw, male, female, last] = await Promise.all([
    text(SRC.varcon),
    text(SRC.agid),
    text(SRC.words),
    text(SRC.male),
    text(SRC.female),
    text(SRC.last),
  ]);
  const words = new Set(wordsRaw.split(/\s+/));

  /* ---------------------------------------------------------------- */
  const { rows, noted, third } = parseVarcon(varcon);
  const step = {
    "British/American lines": rows.length + noted,
    "minus rows carrying a sense note": rows.length,
    "  of which kept by allowing a third form": third,
  };

  let pairs = new Set(rows.map(([b, a]) => `${b}\t${a}`));
  step["minus duplicates"] = pairs.size;

  const word = /^[a-z]{4,}$/;
  pairs = new Set(
    [...pairs].filter((k) => {
      const [b, a] = k.split("\t");
      return word.test(b) && word.test(a);
    }),
  );
  step["minus possessives and words under four letters"] = pairs.size;

  // **Only the American side is tested.** VarCon carries machine-made
  // inflections for spellcheckers — `colorrest`, `lacklusterrer`,
  // `unauthorizedder` — that nobody writes, and they fail here. The word list
  // is US-biased and is missing `favourites`, `organisations`, `recognises` and
  // 800 more real British forms, so testing both sides threw away good pairs.
  pairs = new Set([...pairs].filter((k) => words.has(k.split("\t")[1])));
  step["minus malformed forms (American side not a word)"] = pairs.size;

  for (const k of read(OUT("spelling-pairs.ts"))) pairs.add(k);
  step["plus the pairs already shipped"] = pairs.size;

  /*
   * **Nothing is filtered for ambiguity here.** `AMBIGUOUS_PAIRS` in
   * `consistency.ts` is the one statement of that judgement and it runs at the
   * point of use, so a pair added by hand is refused by the same rule as a
   * generated one.
   */
  write(
    OUT("spelling-pairs.ts"),
    "export const SPELLING_PAIRS: readonly (readonly [string, string])[] = [",
    [...pairs].sort().map((k) => {
      const [b, a] = k.split("\t");
      return `  ["${b}", "${a}"],`;
    }),
  );

  /* ---------------------------------------------------------------- */
  const style = styleTable(parseAgid(agidRaw), words);
  step["house-style pairs (seeds plus inflections)"] = style.length;
  write(
    OUT("style-pairs.ts"),
    "export const STYLE_PAIRS: readonly (readonly [string, string])[] = [",
    style.map(([a, b]) => `  ["${a}", "${b}"],`),
  );

  /* ---------------------------------------------------------------- */
  const named = new Set(
    [
      ...parseNames(male, FIRST_RANK),
      ...parseNames(female, FIRST_RANK),
      ...parseNames(last, LAST_RANK),
    ].filter((n) => n.length >= 3 && words.has(n)),
  );
  step["words that are also a well-known name"] = named.size;
  write(
    OUT("name-words.ts"),
    "export const NAME_WORDS: ReadonlySet<string> = new Set([",
    [...named].sort().map((n) => `  "${n}",`),
    "]);",
  );

  /* ---------------------------------------------------------------- */
  /*
   * **The one file that ships as text rather than as code.**
   *
   * The near-miss check needs to ask "is this rare word real English", and
   * measured on two novels there is no cheap answer: with no word list it
   * reported 162 findings on Pride and Prejudice and 757 on Moby Dick, nearly
   * all of them ordinary words — `works/words`, `stage/state`, `mouth/month`.
   * A top-10,000 frequency list barely helped (101 and 609), because the
   * question is whether a word is *real*, not whether it is *common*:
   * `applies`, `assures` and `healthy` are all missing from one. With the full
   * list it is 1 and 30.
   *
   * So it is the whole list, and it is a `.txt` in `public/` rather than a
   * module: three and a half megabytes of array literal would be parsed as
   * JavaScript on every load of the chunk that held it, where a text file is
   * fetched once, gzipped to about a megabyte in transit, and split in 170ms.
   * Nothing fetches it until a writer ticks the check.
   *
   * Five letters and up, because below that too many real English words sit
   * one edit apart for the list to separate them.
   */
  const typoWords = [...words]
    .filter((w) => /^[a-z]{5,}$/.test(w))
    .sort();
  fs.writeFileSync(
    path.join(__dirname, "..", "public", "typo-words.txt"),
    `${typoWords.join("\n")}\n`,
    "utf8",
  );
  step["words in the near-miss list"] = typoWords.length;
  process.stdout.write(
    `  wrote typo-words.txt (${(typoWords.join("\n").length / 1024 / 1024).toFixed(2)} MB)\n`,
  );

  for (const [k, v] of Object.entries(step)) {
    process.stdout.write(`  ${k.padEnd(52)} ${v}\n`);
  }
}

/** Keep anything already shipped: the filters are strict and drop a few good pairs. */
function read(file) {
  const out = new Set();
  if (!fs.existsSync(file)) return out;
  for (const m of fs.readFileSync(file, "utf8").matchAll(/\["([a-z-]+)", "([a-z-]+)"\]/g)) {
    out.add(`${m[1]}\t${m[2]}`);
  }
  return out;
}

function write(file, exportLine, rows, close = "];") {
  fs.writeFileSync(file, render(file, exportLine, rows, close), "utf8");
  process.stdout.write(`  wrote ${path.basename(file)} (${rows.length})\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});

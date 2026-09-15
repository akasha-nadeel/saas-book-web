/**
 * The writing record — what the app can honestly say about how a book was made.
 *
 * From the research, and it is the newest pain on the list: writers are being
 * *accused* of using AI, by readers, by reviewers, and in at least one report by
 * a contest. The accusation is unfalsifiable by design — there is no test for
 * it — and the detectors sold as a remedy are known to fail on non-native
 * English and on plain, clean prose. The people worst hit are the ones who
 * write simply.
 *
 * What actually works today, when someone is accused, is *provenance*: a
 * document's edit history, dated drafts, the record of a thing accumulating over
 * months. That is circumstantial and it is what people already reach for. This
 * page gathers the version of it the app has been keeping all along.
 *
 * **It is evidence, not proof, and the file says so in its own words.** Three
 * limits are stated on the page and again in the exported document rather than
 * buried:
 *
 * 1. The record lives in the writer's own browser and anyone at that machine
 *    can edit it. It is not tamper-evident. Presenting it as proof would be
 *    selling false confidence to somebody in the middle of an argument they
 *    are frightened of losing.
 * 2. It starts when the writer started using OpenChapter. Nothing before that
 *    exists, and a book drafted elsewhere and imported shows up as one large
 *    day — which is an import, and is evidence of nothing either way.
 * 3. The day log is library-wide. It is what the writer wrote, not what they
 *    wrote in this one book.
 *
 * **The fingerprint is the one part that is not self-reported.** A SHA-256 of
 * the manuscript is a number anyone can recompute from the same text. It proves
 * nothing on its own — what makes it worth anything is a *timestamp somewhere
 * we do not control*, which is why the page tells the writer to email it to
 * themselves or post it and never offers to store it here. A notary that is
 * also the accused party is not a notary.
 *
 * Deliberately **not C2PA**, though that is the standard heading this way.
 * C2PA's whole value is a signature chained to a certificate authority; signing
 * with a key we ship in the browser would produce a file that looks like the
 * real thing and carries none of its weight, which is worse than not signing.
 *
 * ---
 *
 * **The fingerprint is taken over the prose, and for a while it was not.** The
 * first version hashed `getBody()` — the *stored Tiptap JSON* — joined up with
 * separators nobody outside this file knew about. Two things were wrong with
 * that, and both of them broke the only promise the number makes.
 *
 * It was **not reproducible by anyone else**: the document told a reader that
 * "anyone with the same text can recompute this", and nobody could, because
 * the input was an internal document format and an unpublished recipe rather
 * than the words in the book.
 *
 * Worse, it was **not stable against the app itself**. A hash of serialised
 * JSON moves when an attribute is added, when a mark is stored in a different
 * order, when the editor is upgraded — all with the prose untouched. So a
 * writer who did the one thing this page tells them to do, stamp the number
 * somewhere public and keep writing, could find their manuscript no longer
 * matched its own fingerprint without a word having changed. That is worse
 * than no fingerprint: it looks like the text was altered.
 *
 * `canonicalText` is the fix and its rules are printed in the document itself,
 * so the number can be checked rather than merely believed.
 */

import type { Activity } from "./activity";
import { dayKey } from "./activity";
import type { Block } from "./export/blocks";

export interface DayEntry {
  /** `YYYY-MM-DD`, in the writer's own timezone — see `dayKey`. */
  day: string;
  /** Net words that day. Negative on a day of cutting, which is still writing. */
  words: number;
}

export interface WritingRecord {
  /** Oldest day with any writing on it, or null when there is none. */
  firstDay: string | null;
  lastDay: string | null;
  /** Days with any change at all, up or down. */
  daysWritten: number;
  /** Calendar days from the first to the last, inclusive. */
  spanDays: number;
  /** Net words across the whole record. */
  netWords: number;
  /** Every day with writing on it, oldest first. */
  days: DayEntry[];
}

/**
 * Beyond which a day is a file arriving rather than a day of typing.
 *
 * A fast drafting day is two to five thousand words; the "10k day" is a real
 * thing writers celebrate precisely because it is rare. Twenty thousand net
 * words between two midnights is a manuscript being imported or pasted, and
 * the number is set well clear of the human range so that the page never says
 * this about a day somebody actually wrote.
 */
export const IMPORT_LIKELY = 20_000;

/** What the day log says, with the empty case answered rather than crashing. */
export function writingRecord(activity: Activity): WritingRecord {
  const days = Object.entries(activity)
    .filter(([, words]) => words !== 0)
    .map(([day, words]) => ({ day, words }))
    .sort((a, b) => a.day.localeCompare(b.day));

  if (days.length === 0) {
    return {
      firstDay: null,
      lastDay: null,
      daysWritten: 0,
      spanDays: 0,
      netWords: 0,
      days: [],
    };
  }

  const firstDay = days[0].day;
  const lastDay = days[days.length - 1].day;

  return {
    firstDay,
    lastDay,
    daysWritten: days.length,
    spanDays: daysBetween(firstDay, lastDay) + 1,
    netWords: days.reduce((sum, d) => sum + d.words, 0),
    days,
  };
}

/**
 * Whole days between two `YYYY-MM-DD` keys.
 *
 * Anchored at midday rather than midnight, the same trick `trim()` uses: a day
 * key has no timezone, and an hour either side of a daylight-saving change is
 * enough to round a span to the wrong number of days.
 */
export function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`).getTime();
  const b = new Date(`${to}T12:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

/**
 * The first day a window of `days` days covers, today included.
 *
 * **The Free plan's record is a window, and this is its edge** (2026-09-15).
 * The log goes on recording every day for everybody; a free copy of the
 * document is cut to the last `FREE_RECORD_DAYS`, and Pro reads all of it. So
 * upgrading unlocks history that already exists rather than starting a clock.
 *
 * Anchored at midday before stepping back, for the reason `daysBetween` is: a
 * daylight-saving change an hour either side of midnight would otherwise move
 * the edge by a whole day.
 */
export function windowStart(days: number, now: number = Date.now()): string {
  const noon = new Date(now);
  noon.setHours(12, 0, 0, 0);
  noon.setDate(noon.getDate() - Math.max(0, days - 1));
  return dayKey(noon);
}

/** The day log cut to the days on or after `from`. Keys compare as ISO dates. */
export function activitySince(activity: Activity, from: string): Activity {
  const out: Activity = {};
  for (const [day, words] of Object.entries(activity)) {
    if (day >= from) out[day] = words;
  }
  return out;
}

/** The drafts saved on or after the local day `from`. */
export function versionsSince<T extends { at: number }>(
  versions: readonly T[],
  from: string,
): T[] {
  return versions.filter((v) => dayKey(v.at) >= from);
}

/**
 * The days too large to have been typed.
 *
 * Reported rather than hidden, and described rather than judged. A writer who
 * drafted three books in Word and imported them should see those three days
 * and know what they are — being shown the record and then surprised by it in
 * somebody else's hands is the failure this page exists to prevent.
 */
export function importDays(record: WritingRecord): DayEntry[] {
  return record.days.filter((d) => d.words >= IMPORT_LIKELY);
}

export interface ChapterVersions {
  title: string;
  /** Oldest first, so the chapter reads as a thing that grew. */
  versions: { at: number; words: number }[];
}

/**
 * Which recipe the fingerprints in a given document were taken with.
 *
 * Printed in the file, because a hash is only checkable against a stated
 * method and this one is allowed to change. A reader holding an older record
 * needs to know it was made under rules that are not these.
 *
 * 1 was the unpublished JSON digest described at the top of this file, and is
 * gone. 2 is `canonicalText`.
 */
export const RECORD_FORMAT = 2;

/**
 * One paragraph, reduced to the text in it.
 *
 * Formatting goes because formatting is not the writing: bolding a word does
 * not make it a different word, and a fingerprint that moved when somebody
 * italicised a title would be reporting an edit nobody made. Runs of spaces
 * collapse for the same reason — a double space after a full stop is invisible
 * on the page, and would otherwise be the difference between a manuscript
 * matching its own record and not.
 *
 * Newlines from a hard break survive, because a line break inside a paragraph
 * is something the writer put there and can be seen.
 */
function blockText(block: Block): string {
  return block.runs
    .map((run) => run.text)
    .join("")
    .replace(/\r\n?/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

/**
 * The manuscript reduced to the text a fingerprint is taken over.
 *
 * **The rules are the feature.** They are printed in the record itself, so the
 * number is something a stranger can recompute rather than something this app
 * asserts. Any change here is a change to a published method: bump
 * `RECORD_FORMAT` with it, or two records made a month apart will disagree
 * about a manuscript that never moved.
 *
 * - chapters in book order, each as its title, a blank line, then its
 *   paragraphs;
 * - paragraphs, and chapters, separated by one blank line;
 * - text only — no marks, no images, no scene-break furniture. A block holding
 *   no text is left out rather than contributing an empty line, since an image
 *   is not a paragraph;
 * - runs of spaces and tabs collapse to one, and every line is trimmed;
 * - NFC, and no trailing newline.
 *
 * NFC matters more than it looks: a manuscript that has been through a Mac, an
 * import and an export can hold é as one codepoint in one chapter and two in
 * the next, and unnormalised, two files that read identically hash
 * differently.
 *
 * The old NUL-separated form is gone with the JSON it separated. It was there
 * so no manuscript could forge another by butting text together across a
 * separator; that cannot happen here either, because a chapter's title is on
 * its own line and prose cannot introduce a chapter boundary without
 * introducing the blank line and title that go with it.
 */
export function canonicalText(
  chapters: readonly { title: string; blocks: readonly Block[] }[],
): string {
  return chapters.map(chapterCanonicalText).join("\n\n").normalize("NFC");
}

/** One chapter under the same rules, which is what its own hash is taken over. */
export function chapterCanonicalText(chapter: {
  title: string;
  blocks: readonly Block[];
}): string {
  const parts = [chapter.title.replace(/\s+/g, " ").trim()];
  for (const block of chapter.blocks) {
    const text = blockText(block);
    if (text) parts.push(text);
  }
  return parts.join("\n\n").normalize("NFC");
}

/**
 * What this *book* can say for itself, as against the library-wide day log.
 *
 * The day log is the honest thing the app has, and it has a weakness the
 * document has always had to admit: it counts everything the writer typed that
 * day, in any book. Somebody reading the record to decide whether *this*
 * manuscript accumulated over months is being handed a number about a
 * different question.
 *
 * The chapter snapshots are per chapter and therefore per book, so they answer
 * it directly. They under-report by design — eight a chapter, one every ten
 * minutes, oldest swept first — so every figure derived here is a floor, and
 * the document says "at least" in front of it. A floor is still worth having:
 * "at least 41 drafts across 9 separate days" is not something a file that
 * arrived yesterday can say.
 */
export interface BookTimeline {
  /** Epoch ms of the oldest surviving snapshot, or null when there are none. */
  firstAt: number | null;
  lastAt: number | null;
  /** Distinct local days carrying a snapshot. */
  days: number;
  snapshots: number;
}

export function bookTimeline(
  chapters: readonly { versions: readonly { at: number }[] }[],
): BookTimeline {
  const times = chapters
    .flatMap((c) => c.versions.map((v) => v.at))
    .sort((a, b) => a - b);

  if (times.length === 0) {
    return { firstAt: null, lastAt: null, days: 0, snapshots: 0 };
  }

  return {
    firstAt: times[0],
    lastAt: times[times.length - 1],
    days: new Set(times.map((at) => dayKey(at))).size,
    snapshots: times.length,
  };
}

/**
 * The author's own UTC offset, written the way a reader expects to see one.
 *
 * The day keys in the log are *local* days — `dayKey` reads the machine's own
 * clock — while every instant in the file is printed as UTC. With the offset
 * unstated, a reader comparing "2026-08-11" against "2026-08-11T19:08:42Z" has
 * no way to tell whether they are the same day, and for anybody far enough
 * east they frequently are not.
 */
export function utcOffset(at: number | Date = Date.now()): string {
  const minutes = -(at instanceof Date ? at : new Date(at)).getTimezoneOffset();
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `UTC${sign}${hh}:${mm}`;
}

/** Bytes as lowercase hex, the form every checksum tool prints. */
export function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** One chapter as the document reports it. */
export interface RecordChapter {
  title: string;
  /** The app's own count, so the file and the screen agree. */
  words: number;
  /** SHA-256 of this chapter's canonical text, or null where none was taken. */
  fingerprint: string | null;
  /**
   * The body could not be read out of storage.
   *
   * Reported rather than swallowed. The old code hashed `getBody(id) ?? ""`,
   * so a chapter that failed to load produced a *different but perfectly
   * valid-looking* fingerprint — a number that says the manuscript changed
   * when what actually happened was a failed read. Anything the fingerprint
   * could not see has to be named beside it.
   */
  unreadable?: true;
  /** Oldest first, so the chapter reads as a thing that grew. */
  versions: readonly { at: number; words: number }[];
}

/**
 * The document a writer hands to whoever accused them.
 *
 * Plain text on purpose: it has to survive being pasted into an email, a forum
 * reply or a contest form, and a PDF that renders differently at the far end is
 * one more thing to argue about. The limits are in the document rather than
 * only on the screen, because the screen is not what gets forwarded.
 *
 * **Everything the screen shows, the file shows.** The import warning used to
 * be on the page and not in the document, which inverts the whole point of the
 * page: a writer is meant to see the awkward part of their own record *before*
 * the person accusing them does, and it was the one thing the accuser would
 * never be handed.
 */
export function formatRecord({
  title,
  author,
  record,
  timeline,
  chapters,
  fingerprint,
  imports,
  at,
  zone,
  window = null,
  fingerprintWithheld = false,
}: {
  title: string;
  author?: string;
  /**
   * Set when this copy covers only the days from `from` onwards.
   *
   * **The file must say so in its own words**, because the file is what gets
   * forwarded: a thirty-day copy read as the whole history would tell an
   * accuser the book was written in a month.
   */
  window?: { from: string } | null;
  /**
   * The fingerprints were left out of this copy on purpose.
   *
   * Distinct from `fingerprint: null`, which means the browser refused. The two
   * need different sentences, and printing neither would leave a reader
   * wondering which.
   */
  fingerprintWithheld?: boolean;
  /** The library-wide day log. */
  record: WritingRecord;
  /** What this book's own snapshots say, which is a floor. */
  timeline: BookTimeline;
  chapters: readonly RecordChapter[];
  /** Hex SHA-256 of the whole manuscript, or null where the browser refused. */
  fingerprint: string | null;
  /** Days too large to have been typed. Named here, not only on screen. */
  imports: readonly DayEntry[];
  at: number;
  /** The author's UTC offset — see `utcOffset`. */
  zone: string;
}): string {
  const when = new Date(at).toISOString();
  const lines: string[] = [];
  const words = chapters.reduce((sum, c) => sum + c.words, 0);
  const unreadable = chapters.filter((c) => c.unreadable);

  lines.push(`WRITING RECORD — ${title}`);
  if (author) lines.push(`Author: ${author}`);
  lines.push(`Generated ${when} by OpenChapter`);
  lines.push(`Record format ${RECORD_FORMAT}. Author's clock: ${zone}.`);
  lines.push("");

  lines.push("WHAT THIS IS");
  lines.push(
    "A record of this manuscript being written: which days work happened on,",
    "how the word count moved on each of them, and the intermediate drafts the",
    "app saved along the way. It is the same kind of evidence as a word",
    "processor's edit history.",
  );
  lines.push("");

  if (window) {
    lines.push("THIS COPY");
    lines.push(
      `This copy covers ${window.from} to ${when.slice(0, 10)} only. Earlier`,
      "days and drafts are kept on the author's machine but are not included",
      "here, so nothing below says when the writing began.",
    );
    lines.push("");
  }

  /* This book, before the library-wide log — it is the question the reader
     came with, and burying it under a figure about a different question was
     the record's oldest weakness. */
  lines.push("THIS BOOK");
  lines.push(`Chapters:            ${chapters.length}`);
  lines.push(`Words:               ${words.toLocaleString("en")}`);
  if (timeline.firstAt === null) {
    lines.push(
      "Saved drafts:        none kept on this machine",
      "",
      "Drafts are kept in the browser they were written in and do not travel",
      "between machines. None here means none *here* — on a book opened for the",
      "first time on a second computer, that is what this line will always say.",
    );
  } else {
    lines.push(
      `Saved drafts:        at least ${timeline.snapshots}, on at least ${timeline.days} separate ${timeline.days === 1 ? "day" : "days"}`,
      `Oldest kept draft:   ${new Date(timeline.firstAt).toISOString()}`,
      `Newest kept draft:   ${new Date(timeline.lastAt!).toISOString()}`,
      "",
      "\"At least\" is meant literally. The app keeps eight drafts per chapter and",
      "sweeps the oldest away, so these are the ones that survive rather than",
      "every one that was taken.",
    );
  }
  lines.push("");

  lines.push("THE DAY LOG");
  lines.push(
    "Everything the author wrote in this app on these days, across every book",
    "of theirs — not this one alone.",
  );
  if (record.firstDay === null) {
    lines.push("No writing days recorded.");
  } else {
    lines.push(`First recorded day:  ${record.firstDay}`);
    lines.push(`Most recent day:     ${record.lastDay}`);
    lines.push(`Days written on:     ${record.daysWritten}`);
    lines.push(
      `Across:              ${record.spanDays} calendar ${record.spanDays === 1 ? "day" : "days"}`,
    );
    lines.push(`Net words:           ${record.netWords.toLocaleString("en")}`);
    lines.push(`Days are ${zone} days.`);
  }
  lines.push("");

  if (imports.length > 0) {
    lines.push("DAYS THAT LOOK LIKE IMPORTS");
    lines.push(
      `${imports.length} of the days below ${imports.length === 1 ? "is" : "are"} larger than anybody types in a day.`,
      "That is a file arriving rather than a day of drafting — a manuscript",
      "written elsewhere and brought in. It is stated here because it is",
      "evidence of nothing either way, and because a record that hid it would",
      "deserve none of the trust the rest of this asks for.",
      "",
    );
    for (const day of imports) {
      lines.push(`  ${day.day}  +${day.words.toLocaleString("en")}`);
    }
    lines.push("");
  }

  if (record.days.length > 0) {
    lines.push("DAY BY DAY");
    for (const day of record.days) {
      const sign = day.words > 0 ? "+" : "−";
      lines.push(
        `${day.day}  ${sign}${Math.abs(day.words).toLocaleString("en")}`,
      );
    }
    lines.push("");
  }

  /* The chapter list is what tells a reader *what was fingerprinted*. Without
     it the number at the bottom is a hash of an unnamed thing. */
  lines.push("CHAPTERS");
  chapters.forEach((chapter, i) => {
    const n = String(i + 1).padStart(3, " ");
    lines.push(`${n}. ${chapter.title}`);
    lines.push(
      `     ${chapter.words.toLocaleString("en")} words` +
        (chapter.fingerprint ? `  sha256 ${chapter.fingerprint}` : ""),
    );
    if (chapter.unreadable) {
      lines.push("     COULD NOT BE READ — not included in the fingerprint.");
    }
  });
  lines.push("");

  const withVersions = chapters.filter((c) => c.versions.length > 0);
  if (withVersions.length > 0) {
    lines.push("SAVED DRAFTS");
    for (const chapter of withVersions) {
      lines.push(chapter.title);
      for (const version of chapter.versions) {
        lines.push(
          `  ${new Date(version.at).toISOString()}  ${version.words.toLocaleString("en")} words`,
        );
      }
    }
    lines.push("");
  }

  if (fingerprintWithheld) {
    lines.push("FINGERPRINT");
    lines.push("Not included in this copy.");
    lines.push("");
  } else if (fingerprint) {
    lines.push("FINGERPRINT");
    lines.push("SHA-256 of the manuscript text as of the moment above:");
    lines.push(`  ${fingerprint}`);
    if (unreadable.length > 0) {
      lines.push(
        "",
        `WARNING: ${unreadable.length} ${unreadable.length === 1 ? "chapter" : "chapters"} could not be read and ${unreadable.length === 1 ? "is" : "are"} not in it.`,
        "The number above covers the rest. The chapters are named in the list",
        "above.",
      );
    }
    lines.push("");
    lines.push("HOW TO CHECK IT");
    lines.push(
      "The number is the SHA-256, lowercase hex, of the manuscript reduced to",
      "plain text by these rules — so anybody holding the same book can work it",
      "out for themselves rather than take this file's word for it:",
      "",
      "  1. Chapters in the order listed above, front and back matter included.",
      "  2. Each chapter is its title, one blank line, then its paragraphs.",
      "  3. Paragraphs are separated by one blank line; so are chapters.",
      "  4. Text only. No bold or italics, no images, no scene-break marks. A",
      "     paragraph holding no text is left out altogether.",
      "  5. Runs of spaces and tabs become a single space, and every line is",
      "     trimmed at both ends.",
      "  6. Unicode normalised to NFC, encoded UTF-8, lines ending LF, and no",
      "     newline at the end of the file.",
      "",
      "Each chapter's own number is the same recipe applied to that chapter by",
      "itself, which is what lets a reader find *which* chapter differs rather",
      "than only that something does.",
      "",
      "Formatting is deliberately outside the recipe: italicising a word does",
      "not make it a different word, and a fingerprint that moved when somebody",
      "changed a font would report an edit nobody made.",
      "",
      "On its own this number dates nothing. To make it mean something, put it",
      "somewhere outside the author's control — email it, post it, commit it —",
      "so there is a timestamp neither the author nor OpenChapter can move.",
    );
    lines.push("");
  }

  lines.push("WHAT THIS IS NOT");
  lines.push(
    "This is evidence, not proof, and it is worth being straight about why.",
    "",
    "1. It is kept in the author's own browser. Anyone with access to that",
    "   machine could edit it. It is not tamper-evident.",
    "2. It begins when the author started using OpenChapter. Work done before",
    "   that is not in here, and a manuscript written elsewhere and imported",
    "   appears as a single large day. That is an import, and is evidence of",
    "   nothing either way.",
    "3. The day-by-day figures cover everything the author wrote in this app",
    "   on those days, not only this book. The figures under THIS BOOK are the",
    "   ones that are about this manuscript alone.",
    "4. The draft counts are a floor, not a total. Older drafts are swept away",
    "   as newer ones are kept, and they stay in the browser they were written",
    "   in — a record made on a second machine shows none of them.",
    "",
    "There is no test that establishes who wrote a piece of prose. Tools sold",
    "as detectors are known to misfire on plain writing and on writers whose",
    "first language is not English. This document does not claim to settle the",
    "question; it shows the trail the work left while it was being done.",
  );

  return lines.join("\n");
}

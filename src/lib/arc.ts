/**
 * Advance copies: who has one, who read it, and what is late.
 *
 * From the research, and the pain is specific: one launch used NetGalley,
 * Booksprout, BookSirens, Reddit, Facebook, Threads and Instagram — *"six sites
 * and a spreadsheet"*. Another writer *"had to decline 12 because they didn't
 * seem to read my genre"*. And behind both, the one that costs most: *"I've
 * realized how absolutely essential ARCs are… now I'm trying to get reviews for
 * a book that has been published for a few months."*
 *
 * **This is a tracker, not a marketplace.** We cannot supply readers — that is
 * a two-sided business with a chicken-and-egg problem, and it is on the ruled-
 * out list for good reasons. What the research actually described was not "no
 * readers available", it was six tabs and no idea who had what. That is a
 * spreadsheet's job, and this is a better spreadsheet.
 *
 * **A due date is the point of the whole thing.** Advance copies exist so the
 * reviews are there on the day the book goes on sale; a copy sent with no date
 * is a copy nobody chases, and a writer who does not know what is late finds
 * out on launch day.
 */

export type ArcStatus = "sent" | "reading" | "reviewed" | "declined" | "silent";

export const STATUSES: { id: ArcStatus; label: string; note: string }[] = [
  { id: "sent", label: "Sent", note: "They have the file." },
  { id: "reading", label: "Reading", note: "They have said they are on it." },
  { id: "reviewed", label: "Reviewed", note: "It is up." },
  { id: "declined", label: "Declined", note: "They said no, or gave it back." },
  {
    id: "silent",
    label: "No answer",
    note: "Chased and heard nothing. Most of them, in practice.",
  },
];

export interface ArcReader {
  id: string;
  name: string;
  /** Where they came from — NetGalley, a Facebook group, a friend. */
  from: string;
  /**
   * What they actually read. The specific complaint in the research was
   * accepting readers who do not read the genre, which produces the review
   * everyone remembers.
   */
  reads: string;
  status: ArcStatus;
  /** Epoch ms. When the copy went out. */
  sentAt: number;
  /** Epoch ms. When a review was asked for. Absent means nobody is chasing. */
  dueAt?: number;
  /** Where the review is, once there is one. */
  link?: string;
  notes: string;
}

export function parseArc(raw: string | null): ArcReader[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const known = new Set(STATUSES.map((s) => s.id));
  const out: ArcReader[] = [];
  for (const row of parsed) {
    const r = row as Record<string, unknown>;
    const name = typeof r?.name === "string" ? r.name.trim() : "";
    if (!name || typeof r.id !== "string") continue;
    out.push({
      id: r.id,
      name,
      from: typeof r.from === "string" ? r.from : "",
      reads: typeof r.reads === "string" ? r.reads : "",
      status: known.has(r.status as ArcStatus) ? (r.status as ArcStatus) : "sent",
      sentAt: typeof r.sentAt === "number" ? r.sentAt : 0,
      ...(typeof r.dueAt === "number" ? { dueAt: r.dueAt } : {}),
      ...(typeof r.link === "string" && r.link ? { link: r.link } : {}),
      notes: typeof r.notes === "string" ? r.notes : "",
    });
  }
  return out;
}

/**
 * Whether this one is late.
 *
 * Only a reader who still might review counts as overdue. Somebody who declined
 * is not late, and somebody who has already reviewed is certainly not — a list
 * that called those overdue would train the writer to ignore the whole column.
 */
export function isOverdue(reader: ArcReader, now: number = Date.now()): boolean {
  if (reader.status === "reviewed" || reader.status === "declined") return false;
  return reader.dueAt !== undefined && reader.dueAt < now;
}

export interface ArcSummary {
  total: number;
  out: number;
  reviewed: number;
  overdue: number;
  /** Of those who took a copy and answered either way, the share who reviewed. */
  reviewRate: number | null;
}

/**
 * Where the campaign stands.
 *
 * The rate counts only readers who resolved one way or the other. Counting the
 * silent ones as failures would be a guess, and counting them as pending
 * forever flatters the number — leaving them out of both sides is the only
 * honest denominator, and the screen shows how many are still open beside it.
 */
export function summarise(
  readers: readonly ArcReader[],
  now: number = Date.now(),
): ArcSummary {
  const reviewed = readers.filter((r) => r.status === "reviewed").length;
  const declined = readers.filter((r) => r.status === "declined").length;
  const resolved = reviewed + declined;

  return {
    total: readers.length,
    out: readers.filter((r) => r.status === "sent" || r.status === "reading")
      .length,
    reviewed,
    overdue: readers.filter((r) => isOverdue(r, now)).length,
    reviewRate: resolved > 0 ? Math.round((reviewed / resolved) * 100) : null,
  };
}

/**
 * Overdue first, then whoever is due soonest, then everyone with no date.
 *
 * The order is the feature: a writer opening this wants the two people to chase
 * this morning, not an alphabetical list of thirty.
 */
export function sortReaders(
  readers: readonly ArcReader[],
  now: number = Date.now(),
): ArcReader[] {
  return [...readers].sort((a, b) => {
    const lateA = isOverdue(a, now);
    const lateB = isOverdue(b, now);
    if (lateA !== lateB) return lateA ? -1 : 1;

    const dueA = a.dueAt ?? Infinity;
    const dueB = b.dueAt ?? Infinity;
    if (dueA !== dueB) return dueA - dueB;

    return a.name.localeCompare(b.name);
  });
}

/**
 * How long before publication advance copies should go out.
 *
 * **Six weeks, and it was four until 2026-08-09.** Four was wrong, and wrong in
 * the direction that costs a writer the launch: it was described here as "the
 * convention the shops and the review sites both work to", and the review sites
 * do not work to it. BookSirens, which distributes the things, asks for a book
 * **at least 40 days** before publication and notes that many authors send 60 or
 * 90; the general indie guidance is four to eight weeks. Twenty-eight sat under
 * the floor of every source, on the one step this product's own landing page
 * names as the reason it exists.
 *
 * Six weeks clears the 40-day minimum, sits mid-range of four-to-eight, and is a
 * whole number of weeks — which matters, because a writer reads this as "six
 * weeks before" and counts back on a calendar rather than in days.
 *
 * It is a convention rather than a rule, and longer is generally better: a
 * reader needs time to finish the book *and* to get round to posting. But a
 * writer who has never done this needs a number, and "some time before" is what
 * left the person in the research chasing reviews for a book already out.
 */
export const LEAD_DAYS = 42;

/** When copies should go out, for a given publication date. */
export function sendBy(publishAt: number): number {
  return publishAt - LEAD_DAYS * 86_400_000;
}

/**
 * A `YYYY-MM-DD` — from a date input, or from `publishing.published` — as an
 * instant to compare against.
 *
 * Two things here are deliberate and both are the kind of bug that is invisible
 * until somebody in the wrong timezone is looking at it.
 *
 * **The last millisecond of the day, not the first.** A deadline of today is
 * not late until today is over; anchoring to midnight would mark every reader
 * overdue from one minute past twelve on the morning their review was due.
 *
 * **Local, not UTC.** `new Date("2026-09-01")` is parsed as UTC by spec, so a
 * writer west of Greenwich picking the 1st gets an instant that is still the
 * 31st where they are sitting. The parts are pulled out and handed to the local
 * constructor instead, and the result is checked back against them — that
 * constructor rolls a 13th month into next January rather than refusing it, so
 * only comparing the parts can tell a real date from a typo.
 */
export function fromDay(iso: string): number | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!parts) return null;

  const [year, month, day] = parts.slice(1).map(Number);
  const date = new Date(year, month - 1, day, 23, 59, 59, 999);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date.getTime();
}

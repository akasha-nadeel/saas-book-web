/**
 * The story bible: who and what and where, kept beside the manuscript.
 *
 * Two complaints in the research, and they are the same one at different
 * lengths: *"keeping track of details across multiple books must be tricky"*,
 * and *"I do get stuck sometimes… I usually forget some of my ideas. I started
 * writing notes on my phone."* A discovery writer invents a character's sister
 * in chapter four and needs her name in chapter nineteen, and by then the only
 * copy is somewhere in sixty thousand words.
 *
 * **The useful half is not the list, it is the lookup.** Anyone can keep a file
 * of names; nobody keeps it current. What a file cannot do is tell you who is
 * in the chapter you have open — and that is a search, which is free, which
 * means it is right whether or not the writer has maintained anything.
 *
 * **Per book rather than per series, for now.** The research asked for a series
 * bible and this is one book's; the shape here would carry, but a series needs
 * a notion of series that the store does not have yet. Recorded in TODO.md
 * rather than half-built.
 */

export type EntryKind = "character" | "place" | "thing" | "note";

export const KINDS: { id: EntryKind; label: string }[] = [
  { id: "character", label: "People" },
  { id: "place", label: "Places" },
  { id: "thing", label: "Things" },
  { id: "note", label: "Notes" },
];

export interface BibleEntry {
  id: string;
  kind: EntryKind;
  name: string;
  /**
   * Other things this is called. The point of the whole feature for a
   * character who is "Elizabeth" to the narrator and "Lizzie" to her brother —
   * a lookup that missed the second would be worse than no lookup.
   */
  aka: string[];
  detail: string;
  at: number;
}

export function parseBible(raw: string | null): BibleEntry[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const kinds = new Set(KINDS.map((k) => k.id));
  const out: BibleEntry[] = [];
  for (const row of parsed) {
    const r = row as Record<string, unknown>;
    const name = typeof r?.name === "string" ? r.name.trim() : "";
    if (!name || typeof r.id !== "string") continue;
    out.push({
      id: r.id,
      kind: kinds.has(r.kind as EntryKind) ? (r.kind as EntryKind) : "note",
      name,
      aka: Array.isArray(r.aka)
        ? r.aka.filter((a): a is string => typeof a === "string" && a.trim() !== "")
        : [],
      detail: typeof r.detail === "string" ? r.detail : "",
      at: typeof r.at === "number" ? r.at : 0,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Everything an entry answers to, longest first — see `mentionedIn`. */
export function namesOf(entry: BibleEntry): string[] {
  return [entry.name, ...entry.aka]
    .map((n) => n.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
}

export interface Mention {
  entry: BibleEntry;
  count: number;
}

/**
 * Which entries appear in a piece of prose, most-mentioned first.
 *
 * **Whole words only**, which is the whole difficulty: a character called Ash
 * must not match "ashes", "cashew" or "Ashton". Word boundaries do that, and
 * the alternative — a plain `includes` — turns the feature into noise the first
 * time somebody names a character Sam and writes "same".
 *
 * A name that is two words is matched as a phrase, so "Mrs Danvers" does not
 * also count every "Danvers". Names are tried longest-first so the longer of
 * two overlapping ones wins, and each match is counted once even where a short
 * alias sits inside a long name.
 */
export function mentionedIn(
  text: string,
  entries: readonly BibleEntry[],
): Mention[] {
  if (!text.trim()) return [];
  const mentions: Mention[] = [];

  for (const entry of entries) {
    let count = 0;
    let remaining = text;

    for (const name of namesOf(entry)) {
      const pattern = new RegExp(`\\b${escape(name)}\\b`, "gi");
      const hits = remaining.match(pattern);
      if (!hits) continue;
      count += hits.length;
      // Blank out what has already matched, so an alias inside a longer name
      // ("Ash" inside "Ash Fenner") is not counted a second time.
      remaining = remaining.replace(pattern, " ");
    }

    if (count > 0) mentions.push({ entry, count });
  }

  return mentions.sort(
    (a, b) => b.count - a.count || a.entry.name.localeCompare(b.entry.name),
  );
}

/** Regex-safe. Names contain apostrophes, hyphens and full stops. */
function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

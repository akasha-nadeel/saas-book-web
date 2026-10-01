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
 * **One book's, and that is still the unit that is stored.** The research asked
 * for a series bible and `series.ts` is it — but it is a *read across* these
 * lists rather than a store of its own, so everything below stays the shape it
 * was and an entry never loses the book it was written in. Nothing here knows
 * about series, deliberately; the merge is somebody else's job.
 */

/**
 * **Factions, events and lore are the world, not the cast.** A fantasy writer's
 * bible is half guilds, wars and magic systems, and filing all of that under
 * Notes made the one list a writer of that genre most needs the least sorted.
 * An unknown kind still reads as a note, so a bible written by a newer tab
 * opens in an older one.
 */
export type EntryKind =
  | "character"
  | "place"
  | "faction"
  | "event"
  | "thing"
  | "lore"
  | "note";

/**
 * **Each kind carries a hue, and every hue is one the consistency check already
 * measured.** `check-hue.ts` holds its ink mixes to AA on the palest of that
 * family, which is amber; a kind given a paler hue would silently fall below
 * the bar those numbers were measured against. Nothing here is near the accent
 * indigo, which is spent on "this is the way forward".
 *
 * The hue is only ever drawn on the kind's mark (`kind-marks.tsx`), mixed into
 * theme tokens — never as a card's ground — so it adds nothing to the closed
 * list of colour exceptions in `docs/styling.md`.
 */
export const KINDS: { id: EntryKind; label: string; one: string; hue: string }[] = [
  { id: "character", label: "People", one: "Person", hue: "#ec4899" },
  { id: "place", label: "Places", one: "Place", hue: "#10b981" },
  { id: "faction", label: "Factions", one: "Faction", hue: "#ea580c" },
  { id: "event", label: "Events", one: "Event", hue: "#f59e0b" },
  { id: "thing", label: "Things", one: "Thing", hue: "#0891b2" },
  { id: "lore", label: "Lore", one: "Lore", hue: "#8b5cf6" },
  { id: "note", label: "Notes", one: "Note", hue: "#3b82f6" },
];

/** A kind's row in `KINDS`. Every `EntryKind` has one, so this cannot miss. */
export function kindOf(kind: EntryKind): (typeof KINDS)[number] {
  return KINDS.find((k) => k.id === kind) ?? KINDS[KINDS.length - 1];
}

/**
 * How one entry points at another.
 *
 * **A fixed list, not free text**, because each link is read from both ends
 * and the far end needs its own words: Anna *lives in* Rivertown, and
 * Rivertown is *home to* Anna. A typed label could only ever be shown the one
 * way round. Nothing checks that the kinds make sense — a writer whose
 * guild lives in a city is allowed to say so.
 */
export type LinkKind =
  | "lives-in"
  | "member-of"
  | "took-part-in"
  | "happened-at"
  | "part-of"
  | "related-to";

export const LINK_KINDS: {
  id: LinkKind;
  /** Read from the entry that holds the link: Anna — Lives in — Rivertown. */
  label: string;
  /** Read from the entry it points at: Rivertown — Home to — Anna. */
  reverse: string;
}[] = [
  { id: "lives-in", label: "Lives in", reverse: "Home to" },
  { id: "member-of", label: "Member of", reverse: "Members" },
  { id: "took-part-in", label: "Took part in", reverse: "Who was there" },
  { id: "happened-at", label: "Happened at", reverse: "What happened here" },
  { id: "part-of", label: "Part of", reverse: "Includes" },
  { id: "related-to", label: "Related to", reverse: "Related to" },
];

/** The one link that reads the same from both ends. */
const SYMMETRIC: ReadonlySet<LinkKind> = new Set(["related-to"]);

export interface BibleLink {
  /** The id of the entry pointed at, in the same book's bible. */
  to: string;
  kind: LinkKind;
}

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
  /**
   * What this entry points at. **Stored once, on the entry that holds it, and
   * shown from both ends** by `connectionsOf` — writing the reverse onto the
   * other entry too would be two copies of one fact, and the first delete that
   * missed one would leave the world disagreeing with itself.
   *
   * Absent rather than empty, like `ChapterMeta.bookmarked`, so a bible with no
   * links is stored exactly as it was before links existed.
   */
  links?: BibleLink[];
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
  const rawLinks = new Map<string, unknown>();
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
    rawLinks.set(r.id, r.links);
  }

  // Links are read once every id is known, so one pointing at an entry that
  // no longer exists is dropped here rather than drawn as a dead name.
  const ids = new Set(out.map((e) => e.id));
  const read = out.map((entry) =>
    withLinks(entry, parseLinks(rawLinks.get(entry.id), entry.id, ids)),
  );
  return read.sort((a, b) => a.name.localeCompare(b.name));
}

const linkKinds = new Set(LINK_KINDS.map((k) => k.id));

function parseLinks(
  raw: unknown,
  from: string,
  ids: ReadonlySet<string>,
): BibleLink[] {
  if (!Array.isArray(raw)) return [];
  const out: BibleLink[] = [];
  for (const item of raw) {
    const l = item as Record<string, unknown>;
    if (typeof l?.to !== "string" || !linkKinds.has(l.kind as LinkKind)) continue;
    const link = { to: l.to, kind: l.kind as LinkKind };
    if (link.to === from || !ids.has(link.to)) continue;
    if (out.some((o) => sameLink(o, link))) continue;
    out.push(link);
  }
  return out;
}

function sameLink(a: BibleLink, b: BibleLink): boolean {
  return a.to === b.to && a.kind === b.kind;
}

/** The entry with these links, and no `links` key at all when there are none. */
function withLinks(entry: BibleEntry, links: BibleLink[]): BibleEntry {
  const out = { ...entry };
  delete out.links;
  if (links.length > 0) out.links = links;
  return out;
}

// ---------------------------------------------------------------------------
// Links, read from both ends
// ---------------------------------------------------------------------------

/** One line under an entry: what it is connected to, and in which words. */
export interface Connection {
  /** The entry at the other end. */
  entry: BibleEntry;
  kind: LinkKind;
  /** Already turned the right way round for the entry being read. */
  label: string;
  /** True when this entry holds the link, so this is where it is removed. */
  outgoing: boolean;
}

/**
 * Everything an entry is connected to: the links it holds, then the links
 * other entries hold that point at it, in the reverse wording.
 *
 * A symmetric link written from both ends ("related to", once each way) is
 * shown once, as the outgoing one, which is the one that can be removed here.
 */
export function connectionsOf(
  entry: BibleEntry,
  entries: readonly BibleEntry[],
): Connection[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const words = new Map(LINK_KINDS.map((k) => [k.id, k]));
  const out: Connection[] = [];

  for (const link of entry.links ?? []) {
    const other = byId.get(link.to);
    if (!other) continue;
    out.push({
      entry: other,
      kind: link.kind,
      label: words.get(link.kind)?.label ?? link.kind,
      outgoing: true,
    });
  }

  for (const other of entries) {
    if (other.id === entry.id) continue;
    for (const link of other.links ?? []) {
      if (link.to !== entry.id) continue;
      const shown = out.some(
        (c) =>
          c.outgoing &&
          c.entry.id === other.id &&
          c.kind === link.kind &&
          SYMMETRIC.has(link.kind),
      );
      if (shown) continue;
      out.push({
        entry: other,
        kind: link.kind,
        label: words.get(link.kind)?.reverse ?? link.kind,
        outgoing: false,
      });
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Edits — pure, each returning the whole list to be written back
// ---------------------------------------------------------------------------

/**
 * Add a link. Refused — the same list handed back — for a link to itself, to
 * an entry that is not in this bible, or one that already stands, including a
 * symmetric one already written from the other end.
 */
export function addLink(
  entries: readonly BibleEntry[],
  fromId: string,
  link: BibleLink,
): readonly BibleEntry[] {
  const from = entries.find((e) => e.id === fromId);
  if (!from || link.to === fromId) return entries;
  if (!entries.some((e) => e.id === link.to)) return entries;
  if ((from.links ?? []).some((l) => sameLink(l, link))) return entries;
  if (SYMMETRIC.has(link.kind)) {
    const target = entries.find((e) => e.id === link.to);
    const back = { to: fromId, kind: link.kind };
    if ((target?.links ?? []).some((l) => sameLink(l, back))) return entries;
  }
  return entries.map((e) =>
    e.id === fromId ? withLinks(e, [...(e.links ?? []), link]) : e,
  );
}

export function removeLink(
  entries: readonly BibleEntry[],
  fromId: string,
  link: BibleLink,
): readonly BibleEntry[] {
  return entries.map((e) =>
    e.id === fromId
      ? withLinks(
          e,
          (e.links ?? []).filter((l) => !sameLink(l, link)),
        )
      : e,
  );
}

/**
 * Remove an entry **and every link pointing at it**, in one write — so
 * deleting Rivertown cannot leave Anna living nowhere with a line that says so.
 */
export function removeEntry(
  entries: readonly BibleEntry[],
  id: string,
): readonly BibleEntry[] {
  return entries
    .filter((e) => e.id !== id)
    .map((e) =>
      (e.links ?? []).some((l) => l.to === id)
        ? withLinks(
            e,
            (e.links ?? []).filter((l) => l.to !== id),
          )
        : e,
    );
}

/** What the edit form may change. The id, the date and the links are not it. */
export type EntryEdit = Partial<Pick<BibleEntry, "kind" | "name" | "aka" | "detail">>;

/**
 * Change an entry in place. A blank name is refused — the same list handed
 * back — because `parseBible` would drop a nameless entry on the next read and
 * take its links with it.
 */
export function updateEntry(
  entries: readonly BibleEntry[],
  id: string,
  edit: EntryEdit,
): readonly BibleEntry[] {
  if (edit.name !== undefined && !edit.name.trim()) return entries;
  return entries.map((e) =>
    e.id === id
      ? {
          ...e,
          ...edit,
          ...(edit.name !== undefined ? { name: edit.name.trim() } : {}),
          ...(edit.aka !== undefined
            ? { aka: edit.aka.map((a) => a.trim()).filter(Boolean) }
            : {}),
        }
      : e,
  );
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

// ---------------------------------------------------------------------------
// Finding an entry, and wording a new link
// ---------------------------------------------------------------------------

/**
 * Whether the search box's words match an entry, by any name it answers to
 * or by what is written about it.
 *
 * **Every word must appear somewhere, in any order**, and case is ignored:
 * "guild red" finds the Red Guild, and "fisher anna" finds Anna by her detail.
 * A plain substring search of the whole query would miss both. This is a
 * filter over a list the writer made, not the chapter lookup — so it is a
 * substring match on purpose, where `mentionedIn` insists on whole words:
 * typing "riv" should already find Rivertown.
 */
export function entryMatches(
  names: readonly string[],
  detail: string,
  query: string,
): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = [...names, detail].join("\n").toLowerCase();
  return words.every((word) => haystack.includes(word));
}

/**
 * The words a new link starts on, from the two kinds it joins.
 *
 * **A suggestion and nothing more**: the connect screen preselects it and the
 * writer can change it before anything is written, so a link is never stored
 * in words nobody chose. Anything this table does not know is "Related to",
 * which is true of any two things.
 */
export function suggestLink(from: EntryKind, to: EntryKind): LinkKind {
  if (from === "character" && to === "place") return "lives-in";
  if (from === "character" && to === "faction") return "member-of";
  if (from === "character" && to === "event") return "took-part-in";
  if (from === "event" && to === "place") return "happened-at";
  if (from === to && (from === "place" || from === "faction")) return "part-of";
  return "related-to";
}

/** Regex-safe. Names contain apostrophes, hyphens and full stops. */
function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

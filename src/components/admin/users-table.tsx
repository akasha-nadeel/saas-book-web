"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SEGMENTS, type SegmentId } from "@/lib/admin/insights";

/**
 * Every account, filterable and sortable — the one island on `/admin`.
 *
 * Rows arrive as plain numbers and strings from the server, which has already
 * worked out each writer's segment, so this file holds no rule of its own:
 * it narrows and orders what it was given.
 */

export interface UserRow {
  id: string;
  email: string;
  provider: string;
  confirmed: boolean;
  createdAt: number;
  lastActive: number | null;
  /**
   * "3 days ago", worded on the server. Worded here it would use the
   * browser's locale and the server's render would not match it.
   */
  lastSeen: string;
  books: number;
  chapters: number;
  words: number;
  activeDays30: number;
  segment: SegmentId;
  plan: string;
  paid: string;
}

type SortKey = "createdAt" | "lastActive" | "words" | "books" | "activeDays30";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "createdAt", label: "Signed up" },
  { key: "lastActive", label: "Last seen" },
  { key: "books", label: "Books" },
  { key: "words", label: "Words" },
  { key: "activeDays30", label: "Days active (30d)" },
];

const TONES = {
  ok: "border-ok-line bg-ok-bg text-ok-fg",
  note: "border-note-line bg-note-bg text-note-fg",
  stop: "border-stop-line bg-stop-bg text-stop-fg",
  plain: "border-line bg-raised text-muted",
} as const;

// UTC, so the server's render and the browser's agree and hydration does not
// trip over a signup near midnight.
const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function UsersTable({
  rows,
  initialSegment,
}: {
  rows: UserRow[];
  initialSegment: SegmentId | null;
}) {
  const [query, setQuery] = useState("");
  const [only, setOnly] = useState<SegmentId | "all">(initialSegment ?? "all");
  const [sort, setSort] = useState<SortKey>("createdAt");
  const [desc, setDesc] = useState(true);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const kept = rows.filter(
      (r) => (only === "all" || r.segment === only) && (q === "" || r.email.toLowerCase().includes(q)),
    );
    // Every sortable value is a count or a timestamp, so -1 puts "never" last
    // going down and first going up without a NaN out of Infinity − Infinity.
    return kept.sort((a, b) => {
      const x = a[sort] ?? -1;
      const y = b[sort] ?? -1;
      return desc ? y - x : x - y;
    });
  }, [rows, query, only, sort, desc]);

  function press(key: SortKey) {
    if (key === sort) setDesc(!desc);
    else {
      setSort(key);
      setDesc(true);
    }
  }

  const tone = new Map(SEGMENTS.map((s) => [s.id, s]));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by email"
          aria-label="Search by email"
          className="h-9 w-64 max-w-full rounded-lg border border-line bg-panel px-3 font-sans text-sm text-fg
                     placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <select
          value={only}
          onChange={(e) => setOnly(e.target.value as SegmentId | "all")}
          aria-label="Segment"
          className="h-9 rounded-lg border border-line bg-panel px-3 font-sans text-sm text-fg focus:border-accent focus:outline-none"
        >
          <option value="all">Every segment</option>
          {SEGMENTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <span className="font-sans text-sm text-muted tabular-nums">
          {shown.length} of {rows.length}
        </span>
      </div>

      {only !== "all" ? (
        <p className="mt-2 font-sans text-xs text-muted">{tone.get(only)?.rule}</p>
      ) : null}

      <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-panel">
        <table className="w-full text-left font-sans text-sm">
          <thead>
            <tr className="border-b border-line text-xs font-semibold tracking-wider text-muted uppercase">
              <th className="px-4 py-3 font-semibold">Account</th>
              <th className="px-4 py-3 font-semibold">Segment</th>
              <th className="px-4 py-3 font-semibold">Plan</th>
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-4 py-3 font-semibold whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => press(c.key)}
                    className="inline-flex items-center gap-1 uppercase hover:text-fg"
                  >
                    {c.label}
                    {sort === c.key ? <span aria-hidden>{desc ? "↓" : "↑"}</span> : null}
                  </button>
                </th>
              ))}
              <th className="px-4 py-3 font-semibold">Paid</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60 text-fg">
            {shown.map((r) => {
              const s = tone.get(r.segment)!;
              return (
                <tr key={r.id} className="hover:bg-raised/50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${r.id}`} className="font-medium text-accent hover:underline">
                      {r.email || "(no email)"}
                    </Link>
                    <div className="text-xs text-muted">
                      {r.provider}
                      {r.confirmed ? "" : " · unconfirmed"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      title={s.rule}
                      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${TONES[s.tone]}`}
                    >
                      {s.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{r.plan}</td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {DATE.format(new Date(r.createdAt))}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{r.lastSeen}</td>
                  <td className="px-4 py-3 tabular-nums">{r.books}</td>
                  <td className="px-4 py-3 tabular-nums">{r.words.toLocaleString()}</td>
                  <td className="px-4 py-3 tabular-nums">{r.activeDays30}</td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">{r.paid}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.length === 0 ? (
          <p className="py-6 text-center font-sans text-sm text-muted">Nobody matches.</p>
        ) : null}
      </div>
    </div>
  );
}

import Link from "next/link";
import type { ReactNode } from "react";
import { relativeTime } from "@/lib/relative-time";
import { segment, type SegmentId } from "@/lib/admin/insights";

/**
 * The admin screens' small parts. Server-rendered, no script: the dashboard is
 * read, not operated, so the only island is the users table's filter.
 *
 * Drawn in the app's own tokens and the status family — `ok` / `note` / `stop`
 * — because there the colour *is* the information, the same reason the
 * dashboard's findings use it. No new palette.
 */

export const SHELL =
  "scroll-slim h-[var(--oc-layout-height)] overflow-y-auto bg-surface pb-(--oc-safe-bottom)";

export function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="font-sans text-base font-bold text-fg">{title}</h2>
      {note ? <p className="mt-1 font-sans text-sm text-muted">{note}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-line bg-panel ${className}`}>{children}</div>
  );
}

export function Stat({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
}) {
  return (
    <Panel className="px-5 py-4">
      <p className="font-sans text-xs font-semibold tracking-wider text-muted uppercase">
        {label}
      </p>
      <p className="mt-1 font-display text-3xl font-bold tracking-tight text-fg tabular-nums">
        {value}
      </p>
      {note ? <p className="mt-1 font-sans text-xs text-muted">{note}</p> : null}
    </Panel>
  );
}

const TONES = {
  ok: "border-ok-line bg-ok-bg text-ok-fg",
  note: "border-note-line bg-note-bg text-note-fg",
  stop: "border-stop-line bg-stop-bg text-stop-fg",
  plain: "border-line bg-raised text-muted",
} as const;

export function SegmentBadge({ id }: { id: SegmentId }) {
  const s = segment(id);
  return (
    <span
      title={s.rule}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-sans text-xs font-semibold whitespace-nowrap ${TONES[s.tone]}`}
    >
      {s.label}
    </span>
  );
}

/**
 * Horizontal bars, longest first as given. The figure is printed beside every
 * bar — a bar alone is a shape, and the operator wants the number.
 */
export function Bars({
  rows,
  empty,
}: {
  rows: { label: ReactNode; value: number; note?: ReactNode; href?: string }[];
  empty: string;
}) {
  if (rows.length === 0) {
    return <p className="font-sans text-sm text-muted">{empty}</p>;
  }
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((row, i) => {
        const inner = (
          <>
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 rounded-lg bg-accent/12"
              style={{ width: `${(row.value / max) * 100}%` }}
            />
            <span className="relative min-w-0 truncate py-2 pl-3 font-sans text-sm font-medium text-fg">
              {row.label}
              {row.note ? (
                <span className="ml-2 font-normal text-muted">{row.note}</span>
              ) : null}
            </span>
            <span className="relative shrink-0 py-2 pr-3 font-sans text-sm font-semibold text-fg tabular-nums">
              {row.value.toLocaleString()}
            </span>
          </>
        );
        const cls =
          "relative flex items-center justify-between gap-4 overflow-hidden rounded-lg";
        return (
          <li key={i}>
            {row.href ? (
              <Link href={row.href} className={`${cls} hover:bg-raised/50`}>
                {inner}
              </Link>
            ) : (
              <div className={cls}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * One column per day, two series side by side. Every column carries its
 * figures in a tooltip, and the axis states its own maximum, so nothing has to
 * be read off a bar's height by eye.
 */
export function DailyColumns({
  days,
  series,
}: {
  days: { day: string; values: number[] }[];
  series: { label: string; className: string }[];
}) {
  const max = Math.max(1, ...days.flatMap((d) => d.values));
  return (
    <div>
      <div className="flex items-center gap-4 font-sans text-xs text-muted">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${s.className}`} />
            {s.label}
          </span>
        ))}
        <span className="ml-auto tabular-nums">top of scale: {max}</span>
      </div>
      <div className="mt-3 flex h-40 items-end gap-[3px]">
        {days.map((d) => (
          <div
            key={d.day}
            title={`${d.day}\n${series.map((s, i) => `${s.label}: ${d.values[i]}`).join("\n")}`}
            className="flex h-full min-w-0 flex-1 items-end gap-px"
          >
            {d.values.map((v, i) => (
              <div
                key={i}
                className={`min-h-px flex-1 rounded-t-sm ${series[i].className} ${v === 0 ? "opacity-25" : ""}`}
                style={{ height: `${Math.max(v === 0 ? 1 : 3, (v / max) * 100)}%` }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between font-sans text-[11px] text-muted tabular-nums">
        <span>{days[0]?.day}</span>
        <span>{days[days.length - 1]?.day}</span>
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center font-sans text-sm text-muted">{children}</p>;
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-semibold whitespace-nowrap ${className}`}>{children}</th>;
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

export function TableFrame({ head, children }: { head: ReactNode; children: ReactNode }) {
  return (
    <Panel className="overflow-x-auto">
      <table className="w-full text-left font-sans text-sm">
        <thead>
          <tr className="border-b border-line text-xs font-semibold tracking-wider text-muted uppercase">
            {head}
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60 text-fg">{children}</tbody>
      </table>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Words for figures
// ---------------------------------------------------------------------------

const DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const DATE_TIME = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

export function fmtDate(d: Date | null | undefined): string {
  return d ? DATE.format(d) : "—";
}

export function fmtDateTime(d: Date | null | undefined): string {
  return d ? DATE_TIME.format(d) : "—";
}

/** "3 days ago", or a dash for never. */
export function ago(d: Date | null | undefined, now: Date): string {
  return d ? relativeTime(d.getTime(), now.getTime()) : "—";
}

export function fmtMoney(amounts: Record<string, number>): string {
  const parts = Object.entries(amounts)
    .filter(([, n]) => n > 0)
    .map(([currency, n]) =>
      new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n),
    );
  return parts.length > 0 ? parts.join(" + ") : "—";
}

import Link from "next/link";
import type { ReactNode } from "react";
import {
  SEGMENTS,
  describeEvent,
  funnel,
  isPaying,
  lastActive,
  recordStart,
  revenue,
  segmentCounts,
  segmentOf,
  type AdminDay,
  type AdminFeedback,
  type AdminInterest,
  type AdminPayment,
  type AdminUser,
  type FeatureUse,
  type SegmentId,
} from "@/lib/admin/insights";
import {
  Bars,
  DailyColumns,
  Empty,
  Panel,
  SHELL,
  Section,
  SegmentBadge,
  Stat,
  TableFrame,
  Td,
  Th,
  ago,
  fmtDate,
  fmtDateTime,
  fmtMoney,
} from "./admin-ui";
import { UsersTable, type UserRow } from "./users-table";

/**
 * `/admin`, drawn. Server Components throughout; the users table is the one
 * island. Every figure is a count of rows the `admin_*` functions returned,
 * and every segment prints the rule that put somebody in it.
 */

export const TABS = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "customers", label: "Customers" },
  { id: "features", label: "Features" },
  { id: "feedback", label: "Feedback" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

/** A lookup against the fixed set, never a cast — anyone can type a query string. */
export function asTab(value: unknown): TabId {
  return TABS.find((t) => t.id === value)?.id ?? "overview";
}

export function asSegment(value: unknown): SegmentId | null {
  return SEGMENTS.find((s) => s.id === value)?.id ?? null;
}

export function AdminFrame({
  email,
  tab,
  children,
}: {
  email: string;
  tab: TabId | null;
  children: ReactNode;
}) {
  return (
    <main className={SHELL}>
      <div className="mx-auto max-w-7xl px-5 pt-8 pb-20">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-fg">Admin</h1>
            <p className="mt-1 font-sans text-sm text-muted">
              Signed in as {email}. Only this account can open this page.
            </p>
          </div>
          <Link
            href="/?area=write"
            className="rounded-lg border border-line bg-panel px-4 py-2 font-sans text-sm font-semibold text-fg hover:bg-raised"
          >
            My books
          </Link>
        </header>

        <nav className="mt-6 flex flex-wrap gap-1 border-b border-line" aria-label="Admin sections">
          {TABS.map((t) => (
            <Link
              key={t.id}
              href={t.id === "overview" ? "/admin" : `/admin?tab=${t.id}`}
              aria-current={t.id === tab ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2 font-sans text-sm font-semibold ${
                t.id === tab
                  ? "border-accent text-fg"
                  : "border-transparent text-muted hover:text-fg"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        {children}
      </div>
    </main>
  );
}

export function Problem({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-8 rounded-2xl border border-note-line bg-note-bg px-6 py-5">
      <h2 className="font-sans text-base font-bold text-note-fg">{title}</h2>
      <div className="mt-1 font-sans text-sm text-fg">{children}</div>
    </div>
  );
}

function RecordNote({ users }: { users: readonly AdminUser[] }) {
  const start = recordStart(users);
  return (
    <p className="mt-4 font-sans text-xs text-muted">
      {start
        ? `The activity record began on ${fmtDate(start)}. Visits, writing days, feature use and pricing views know nothing before then; signups, books, words and payments go back to the first account.`
        : "The activity record has no events yet. Until it does, activity is read from sign-ins and chapter changes only."}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export function OverviewTab({
  users,
  daily,
  now,
}: {
  users: AdminUser[];
  daily: AdminDay[];
  now: Date;
}) {
  const week = 7 * 24 * 60 * 60 * 1000;
  const recent = (d: Date | null) => d !== null && now.getTime() - d.getTime() <= week;

  const newThisWeek = users.filter((u) => recent(u.createdAt)).length;
  const seenThisWeek = users.filter((u) => recent(lastActive(u))).length;
  const wroteThisWeek = users.filter((u) => recent(u.lastWritingAt) || recent(u.lastChangeAt)).length;
  const money = revenue(users, now);
  const steps = funnel(users);
  const counts = segmentCounts(users, now);

  return (
    <>
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Accounts" value={users.length} />
        <Stat label="New, 7 days" value={newThisWeek} />
        <Stat label="Seen, 7 days" value={seenThisWeek} note="Any event, sync or sign-in" />
        <Stat label="Wrote, 7 days" value={wroteThisWeek} />
        <Stat
          label="Paying now"
          value={money.active + money.pastDue + money.ending}
          note={money.pastDue + money.ending > 0 ? `${money.pastDue} past due · ${money.ending} ending` : undefined}
        />
        <Stat
          label="Monthly revenue"
          value={`$${money.monthly.toFixed(2)}`}
          note="Active subscriptions at their per-month price"
        />
      </div>
      <RecordNote users={users} />

      <Section title="Last 30 days" note="Per UTC day. Active means at least one event in the activity record.">
        <Panel className="px-5 py-4">
          <DailyColumns
            days={daily.map((d) => ({ day: d.day, values: [d.signups, d.activeUsers, d.writers] }))}
            series={[
              { label: "Signups", className: "bg-accent" },
              { label: "Active", className: "bg-ok-fg" },
              { label: "Wrote", className: "bg-note-fg" },
            ]}
          />
        </Panel>
      </Section>

      <div className="grid gap-x-8 lg:grid-cols-2">
        <Section
          title="From signup to paying"
          note="Each step counted on its own, out of every account. Steps are not forced to nest."
        >
          <Panel className="px-3 py-3">
            <Bars
              rows={steps.map((s) => ({
                label: s.label,
                value: s.count,
                note: users.length > 0 ? `${Math.round((s.count / users.length) * 100)}% of signups` : undefined,
              }))}
              empty="No accounts yet."
            />
          </Panel>
        </Section>

        <Section title="Segments" note="Every account is in exactly one: the first rule it meets, top to bottom.">
          <Panel className="divide-y divide-line/60">
            {SEGMENTS.map((s) => (
              <Link
                key={s.id}
                href={`/admin?tab=users&segment=${s.id}`}
                className="flex items-start justify-between gap-4 px-5 py-3 hover:bg-raised/50"
              >
                <div className="min-w-0">
                  <SegmentBadge id={s.id} />
                  <p className="mt-1 font-sans text-xs text-muted">{s.rule}</p>
                </div>
                <span className="font-display text-xl font-bold text-fg tabular-nums">
                  {counts.get(s.id) ?? 0}
                </span>
              </Link>
            ))}
          </Panel>
        </Section>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

function planLabel(user: AdminUser, now: Date): string {
  const sub = user.subscription;
  if (!sub) return "Free";
  if (isPaying(user, now)) {
    const status = sub.status === "active" ? "" : ` · ${sub.status === "past_due" ? "past due" : "cancelled"}`;
    return `Pro · ${sub.period ?? "?"}${status}`;
  }
  return "Free (lapsed)";
}

export function toRow(user: AdminUser, now: Date): UserRow {
  const seen = lastActive(user);
  return {
    id: user.id,
    email: user.email ?? "",
    provider: user.provider,
    confirmed: user.emailConfirmed,
    createdAt: user.createdAt.getTime(),
    lastActive: seen ? seen.getTime() : null,
    lastSeen: ago(seen, now),
    books: user.books,
    chapters: user.chapters,
    words: user.words,
    activeDays30: user.activeDays30,
    segment: segmentOf(user, now),
    plan: planLabel(user, now),
    paid: fmtMoney(user.paid),
  };
}

export function UsersTab({
  users,
  now,
  segment,
}: {
  users: AdminUser[];
  now: Date;
  segment: SegmentId | null;
}) {
  return (
    <>
      <Section
        title="Every account"
        note="Last seen is the newest of an event, a chapter change reaching the server, or a sign-in. Words leave the trash out."
      >
        <UsersTable rows={users.map((u) => toRow(u, now))} initialSegment={segment} />
      </Section>
      <RecordNote users={users} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

export function CustomersTab({
  users,
  interest,
  payments,
  now,
}: {
  users: AdminUser[];
  interest: AdminInterest[];
  payments: AdminPayment[];
  now: Date;
}) {
  const money = revenue(users, now);
  const subscribers = users
    .filter((u) => u.subscription !== null)
    .sort((a, b) => Number(isPaying(b, now)) - Number(isPaying(a, now)));
  const hit = users.filter((u) => segmentOf(u, now) === "limit");

  return (
    <>
      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Monthly revenue" value={`$${money.monthly.toFixed(2)}`} note="Active, at per-month price" />
        <Stat label="Active" value={money.active} />
        <Stat label="Past due" value={money.pastDue} note="Renewal failed; still inside grace" />
        <Stat label="Cancelled, still paid up" value={money.ending} />
        <Stat label="Taken, all time" value={fmtMoney(money.allTime)} note="Completed payments" />
      </div>

      <Section title="Subscribers" note="Everybody with a subscription row, paid up first.">
        {subscribers.length === 0 ? (
          <Panel>
            <Empty>No subscriptions yet.</Empty>
          </Panel>
        ) : (
          <TableFrame
            head={
              <>
                <Th>Account</Th>
                <Th>Plan</Th>
                <Th>Status</Th>
                <Th>Paid up to</Th>
                <Th>Cancelled</Th>
                <Th>Paid in total</Th>
                <Th>Last seen</Th>
                <Th>Segment</Th>
              </>
            }
          >
            {subscribers.map((u) => (
              <tr key={u.id} className="hover:bg-raised/50">
                <Td>
                  <Link href={`/admin/users/${u.id}`} className="font-medium text-accent hover:underline">
                    {u.email ?? u.id}
                  </Link>
                </Td>
                <Td>{u.subscription?.period ?? "—"} · {u.subscription?.provider ?? "—"}</Td>
                <Td>{isPaying(u, now) ? (u.subscription?.status ?? "—") : "lapsed"}</Td>
                <Td className="whitespace-nowrap">{fmtDate(u.subscription?.currentPeriodEnd)}</Td>
                <Td className="whitespace-nowrap">{fmtDate(u.subscription?.cancelledAt)}</Td>
                <Td className="tabular-nums">{fmtMoney(u.paid)}</Td>
                <Td className="whitespace-nowrap">{ago(lastActive(u), now)}</Td>
                <Td>
                  <SegmentBadge id={segmentOf(u, now)} />
                </Td>
              </tr>
            ))}
          </TableFrame>
        )}
      </Section>

      <Section
        title="Upgrade candidates"
        note={SEGMENTS.find((s) => s.id === "limit")?.rule}
      >
        {hit.length === 0 ? (
          <Panel>
            <Empty>Nobody on Free has met a limit yet.</Empty>
          </Panel>
        ) : (
          <TableFrame
            head={
              <>
                <Th>Account</Th>
                <Th>Books</Th>
                <Th>Words</Th>
                <Th>Last refused</Th>
                <Th>Looked at pricing</Th>
                <Th>Last seen</Th>
              </>
            }
          >
            {hit.map((u) => (
              <tr key={u.id} className="hover:bg-raised/50">
                <Td>
                  <Link href={`/admin/users/${u.id}`} className="font-medium text-accent hover:underline">
                    {u.email ?? u.id}
                  </Link>
                </Td>
                <Td className="tabular-nums">{u.books}</Td>
                <Td className="tabular-nums">{u.words.toLocaleString()}</Td>
                <Td className="whitespace-nowrap">{ago(u.lastLimitAt, now)}</Td>
                <Td>{u.sawPricing || u.interestPresses > 0 ? "Yes" : "No"}</Td>
                <Td className="whitespace-nowrap">{ago(lastActive(u), now)}</Td>
              </tr>
            ))}
          </TableFrame>
        )}
      </Section>

      <Section
        title="Presses on a paid button"
        note="Recorded by /api/plan-interest from the public pricing page. Signed-out presses carry no address."
      >
        {interest.length === 0 ? (
          <Panel>
            <Empty>No presses recorded.</Empty>
          </Panel>
        ) : (
          <TableFrame
            head={
              <>
                <Th>When</Th>
                <Th>Plan</Th>
                <Th>Cycle</Th>
                <Th>Page</Th>
                <Th>Who</Th>
              </>
            }
          >
            {interest.map((p, i) => (
              <tr key={i}>
                <Td className="whitespace-nowrap">{fmtDateTime(p.createdAt)}</Td>
                <Td>{p.tier ?? "—"}</Td>
                <Td>{p.period ?? "—"}</Td>
                <Td>{p.source ?? "—"}</Td>
                <Td>
                  {p.owner ? (
                    <Link href={`/admin/users/${p.owner}`} className="text-accent hover:underline">
                      {p.email ?? p.owner}
                    </Link>
                  ) : (
                    <span className="text-muted">signed out</span>
                  )}
                </Td>
              </tr>
            ))}
          </TableFrame>
        )}
      </Section>

      <Section title="Payment events" note="Everything the payment webhooks recorded, newest first.">
        {payments.length === 0 ? (
          <Panel>
            <Empty>No payment events yet.</Empty>
          </Panel>
        ) : (
          <TableFrame
            head={
              <>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>Amount</Th>
                <Th>Event</Th>
                <Th>Completed</Th>
              </>
            }
          >
            {payments.map((p, i) => (
              <tr key={i}>
                <Td className="whitespace-nowrap">{fmtDateTime(p.createdAt)}</Td>
                <Td>
                  {p.owner ? (
                    <Link href={`/admin/users/${p.owner}`} className="text-accent hover:underline">
                      {p.email ?? p.owner}
                    </Link>
                  ) : (
                    "—"
                  )}
                </Td>
                <Td className="tabular-nums">
                  {p.amount === null ? "—" : fmtMoney({ [p.currency ?? "USD"]: p.amount })}
                </Td>
                <Td>
                  {p.provider ?? "—"} · {p.eventType ?? `status ${p.statusCode ?? "?"}`}
                </Td>
                <Td>{p.completed ? "Yes" : "No"}</Td>
              </tr>
            ))}
          </TableFrame>
        )}
      </Section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

export function FeaturesTab({
  week,
  month,
}: {
  week: FeatureUse[];
  month: FeatureUse[];
}) {
  const bars = (use: FeatureUse[]) =>
    use.map((f) => ({
      label: describeEvent(f.kind, f.detail),
      value: f.events,
      note: `${f.users} ${f.users === 1 ? "person" : "people"}`,
    }));

  return (
    <div className="grid gap-x-8 lg:grid-cols-2">
      <Section title="Last 7 days" note="Events, and how many different accounts made them.">
        <Panel className="px-3 py-3">
          <Bars rows={bars(week)} empty="Nothing recorded in the last 7 days." />
        </Panel>
      </Section>
      <Section title="Last 30 days" note="Opening the app, a book or writing counts once per half hour.">
        <Panel className="px-3 py-3">
          <Bars rows={bars(month)} empty="Nothing recorded in the last 30 days." />
        </Panel>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

const SENTIMENT_TONE: Record<string, string> = {
  bad: "text-stop-fg",
  poor: "text-note-fg",
  fine: "text-muted",
  good: "text-ok-fg",
};

export function FeedbackList({
  feedback,
  now,
  showWho = true,
}: {
  feedback: AdminFeedback[];
  now: Date;
  /** Off on one account's own page, where the sender is the page. */
  showWho?: boolean;
}) {
  if (feedback.length === 0) {
    return (
      <Panel>
        <Empty>No feedback yet.</Empty>
      </Panel>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {feedback.map((f, i) => (
        <li key={i}>
          <Panel className="px-5 py-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-xs text-muted">
              <span>{fmtDateTime(f.createdAt)}</span>
              <span>·</span>
              <span>{ago(f.createdAt, now)}</span>
              {f.topic ? (
                <span className="rounded-full border border-line px-2 py-0.5">{f.topic}</span>
              ) : null}
              {f.sentiment ? (
                <span className={`font-semibold ${SENTIMENT_TONE[f.sentiment] ?? ""}`}>{f.sentiment}</span>
              ) : null}
              {!showWho ? null : f.owner ? (
                <Link href={`/admin/users/${f.owner}`} className="ml-auto text-accent hover:underline">
                  {f.email ?? f.owner}
                </Link>
              ) : (
                <span className="ml-auto">account closed</span>
              )}
            </div>
            <p className="mt-2 font-sans text-sm whitespace-pre-wrap text-fg">{f.message}</p>
          </Panel>
        </li>
      ))}
    </ul>
  );
}

export function FeedbackTab({ feedback, now }: { feedback: AdminFeedback[]; now: Date }) {
  return (
    <Section title="Feedback" note="Everything sent through Send feedback, newest first.">
      <FeedbackList feedback={feedback} now={now} />
    </Section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AdminFrame,
  FeedbackList,
  Problem,
} from "@/components/admin/admin-dashboard";
import {
  Empty,
  Panel,
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
} from "@/components/admin/admin-ui";
import {
  cameBack,
  describeEvent,
  isPaying,
  lastActive,
  segment,
  segmentOf,
} from "@/lib/admin/insights";
import { MIGRATION, readUserDetail, readUsers } from "@/lib/admin/insights-server";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title: "Account · Admin · OpenChapter",
  robots: { index: false, follow: false },
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One account: who, where they are and why, their books by title and count,
 * everything the activity record holds for them, and what they paid and said.
 *
 * **No chapter text, no notes, no cover** — `admin_user_detail` cannot read
 * them, which is the promise on /privacy and what `insights.test.ts` holds.
 */
export default async function AdminUserRoute(props: {
  params: Promise<{ userId: string }>;
}) {
  const session = await requireAdmin();
  const { userId } = await props.params;
  if (!UUID.test(userId)) notFound();

  if (!session.ready) {
    return (
      <AdminFrame email={session.email} tab={null}>
        <Problem title="This deployment has no secret key">
          <code>SUPABASE_SECRET_KEY</code> is not set, so nothing can be read.
        </Problem>
      </AdminFrame>
    );
  }

  const [users, detail] = await Promise.all([
    readUsers(session.db),
    readUserDetail(session.db, userId),
  ]);

  if (!users.ok || !detail.ok) {
    const problem = !users.ok ? users.problem : !detail.ok ? detail.problem : null;
    return (
      <AdminFrame email={session.email} tab={null}>
        <Problem title={problem?.kind === "missing" ? "The admin migration is not on this project" : "A read failed"}>
          {problem?.kind === "missing" ? (
            <>
              Apply <code>{MIGRATION}</code> in the Supabase SQL editor, then reload.
            </>
          ) : (
            <code>{problem?.kind === "failed" ? problem.message : ""}</code>
          )}
        </Problem>
      </AdminFrame>
    );
  }

  const user = users.value.find((u) => u.id === userId);
  if (!user) notFound();

  const now = new Date();
  const d = detail.value;
  const seg = segment(segmentOf(user, now));
  const titles = new Map(d.books.map((b) => [b.id, b.title]));

  return (
    <AdminFrame email={session.email} tab={null}>
      <div className="mt-6">
        <Link href="/admin?tab=users" className="font-sans text-sm text-accent hover:underline">
          ← Every account
        </Link>
        <h2 className="mt-3 font-display text-2xl font-bold tracking-tight text-fg break-all">
          {user.email ?? user.id}
        </h2>
        <p className="mt-1 font-sans text-sm text-muted">
          Signed up {fmtDate(user.createdAt)} ({ago(user.createdAt, now)}) with {user.provider}
          {user.emailConfirmed ? "" : " · email never confirmed"} · last sign-in{" "}
          {ago(user.lastSignInAt, now)}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <SegmentBadge id={seg.id} />
          <span className="font-sans text-xs text-muted">{seg.rule}</span>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Stat label="Books" value={user.books} note="Outside the trash" />
        <Stat label="Words" value={user.words.toLocaleString()} note={`${user.chapters} chapters`} />
        <Stat label="Last seen" value={ago(lastActive(user), now)} />
        <Stat label="Days active (30d)" value={user.activeDays30} />
        <Stat label="Came back" value={cameBack(user) ? "Yes" : "No"} note="On a day after signing up" />
        <Stat
          label="Plan"
          value={isPaying(user, now) ? "Pro" : "Free"}
          note={user.subscription ? `${user.subscription.period ?? ""} · ${user.subscription.status ?? ""} · to ${fmtDate(user.subscription.currentPeriodEnd)}` : undefined}
        />
      </div>

      <Section title="Books" note="Titles and counts only. Chapter text, notes and covers are not readable from here.">
        {d.books.length === 0 ? (
          <Panel>
            <Empty>No books.</Empty>
          </Panel>
        ) : (
          <TableFrame
            head={
              <>
                <Th>Title</Th>
                <Th>Genre</Th>
                <Th>Chapters</Th>
                <Th>Words</Th>
                <Th>Target</Th>
                <Th>Made</Th>
                <Th>Last opened</Th>
                <Th>State</Th>
              </>
            }
          >
            {d.books.map((b) => (
              <tr key={b.id}>
                <Td className="font-medium">{b.title || "(untitled)"}</Td>
                <Td>{b.genre ?? "—"}</Td>
                <Td className="tabular-nums">{b.chapters}</Td>
                <Td className="tabular-nums">{b.words.toLocaleString()}</Td>
                <Td className="tabular-nums">{b.targetWords ? b.targetWords.toLocaleString() : "—"}</Td>
                <Td className="whitespace-nowrap">{fmtDate(b.createdAt)}</Td>
                <Td className="whitespace-nowrap">{ago(b.lastOpenedAt, now)}</Td>
                <Td>{b.trashedAt ? "In trash" : b.archivedAt ? "Archived" : "On shelf"}</Td>
              </tr>
            ))}
          </TableFrame>
        )}
      </Section>

      <Section
        title="Activity"
        note={`The last ${d.events.length === 300 ? "300 " : ""}events, newest first. Opening the app, a book or writing is recorded at most once per half hour.`}
      >
        {d.events.length === 0 ? (
          <Panel>
            <Empty>Nothing in the activity record for this account.</Empty>
          </Panel>
        ) : (
          <TableFrame
            head={
              <>
                <Th>When</Th>
                <Th>What</Th>
                <Th>Book</Th>
              </>
            }
          >
            {d.events.map((e, i) => (
              <tr key={i}>
                <Td className="whitespace-nowrap">{fmtDateTime(e.createdAt)}</Td>
                <Td>{describeEvent(e.kind, e.detail)}</Td>
                <Td className="text-muted">
                  {e.bookId ? (titles.get(e.bookId) ?? "a book since deleted") : "—"}
                </Td>
              </tr>
            ))}
          </TableFrame>
        )}
      </Section>

      <div className="grid gap-x-8 lg:grid-cols-2">
        <Section title="Payments">
          {d.payments.length === 0 ? (
            <Panel>
              <Empty>No payments.</Empty>
            </Panel>
          ) : (
            <TableFrame
              head={
                <>
                  <Th>When</Th>
                  <Th>Amount</Th>
                  <Th>Event</Th>
                </>
              }
            >
              {d.payments.map((p, i) => (
                <tr key={i}>
                  <Td className="whitespace-nowrap">{fmtDateTime(p.createdAt)}</Td>
                  <Td className="tabular-nums">
                    {p.amount === null ? "—" : fmtMoney({ [p.currency ?? "USD"]: p.amount })}
                  </Td>
                  <Td>
                    {p.eventType ?? `status ${p.statusCode ?? "?"}`}
                    {p.completed ? "" : " (not a completed payment)"}
                  </Td>
                </tr>
              ))}
            </TableFrame>
          )}
        </Section>

        <Section title="Presses on a paid button">
          {d.interest.length === 0 ? (
            <Panel>
              <Empty>None.</Empty>
            </Panel>
          ) : (
            <TableFrame
              head={
                <>
                  <Th>When</Th>
                  <Th>Cycle</Th>
                  <Th>Page</Th>
                </>
              }
            >
              {d.interest.map((p, i) => (
                <tr key={i}>
                  <Td className="whitespace-nowrap">{fmtDateTime(p.createdAt)}</Td>
                  <Td>{p.period ?? "—"}</Td>
                  <Td>{p.source ?? "—"}</Td>
                </tr>
              ))}
            </TableFrame>
          )}
        </Section>
      </div>

      {d.memberships.length > 0 ? (
        <Section title="Invited to" note="Books somebody else owns that this account was invited to.">
          <TableFrame
            head={
              <>
                <Th>Book</Th>
                <Th>Role</Th>
                <Th>Status</Th>
                <Th>Accepted</Th>
              </>
            }
          >
            {d.memberships.map((m, i) => (
              <tr key={i}>
                <Td>{m.title ?? m.bookId}</Td>
                <Td>{m.role ?? "—"}</Td>
                <Td>{m.status ?? "—"}</Td>
                <Td className="whitespace-nowrap">{fmtDate(m.acceptedAt)}</Td>
              </tr>
            ))}
          </TableFrame>
        </Section>
      ) : null}

      <Section title="Feedback from this account">
        <FeedbackList feedback={d.feedback} now={now} showWho={false} />
      </Section>
    </AdminFrame>
  );
}

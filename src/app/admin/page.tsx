import type { Metadata } from "next";
import {
  AdminFrame,
  CustomersTab,
  FeaturesTab,
  FeedbackTab,
  OverviewTab,
  Problem,
  UsersTab,
  asSegment,
  asTab,
} from "@/components/admin/admin-dashboard";
import {
  MIGRATION,
  readDaily,
  readFeatureUse,
  readFeatureUsers,
  readFeedback,
  readInterest,
  readPayments,
  readUsers,
  type ReadProblem,
} from "@/lib/admin/insights-server";
import { requireAdmin } from "@/lib/admin/require-admin";

export const metadata: Metadata = {
  title: "Admin · OpenChapter",
  robots: { index: false, follow: false },
};

/**
 * The operator's dashboard: every account, what it does, who pays.
 *
 * `requireAdmin()` runs before anything is read and answers 404 to everybody
 * else. `/` sends the operator here on arrival (see `app/page.tsx`); "My
 * books" goes back to their own dashboard.
 *
 * One tab is read per request — the users list is the expensive call and the
 * Feedback tab does not need it. Features reads it for the plan and segment
 * beside each name in "Who uses them".
 */
export default async function AdminRoute(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireAdmin();
  const params = await props.searchParams;
  const tab = asTab(params.tab);
  const now = new Date();

  if (!session.ready) {
    return (
      <AdminFrame email={session.email} tab={tab}>
        <Problem title="This deployment has no secret key">
          <code>SUPABASE_SECRET_KEY</code> is not set, so nothing can be read across
          accounts. Add it where the other Supabase variables live and redeploy.
        </Problem>
      </AdminFrame>
    );
  }

  const { db } = session;
  const missing = (problem: ReadProblem) => (
    <AdminFrame email={session.email} tab={tab}>
      {problem.kind === "missing" ? (
        <Problem title="The admin migration is not on this project">
          Apply <code>{MIGRATION}</code> in the Supabase SQL editor, then reload. Until it
          is, there is nothing here to read and the app records no activity.
        </Problem>
      ) : (
        <Problem title="A read failed">
          <code>{problem.message}</code>
        </Problem>
      )}
    </AdminFrame>
  );

  if (tab === "features") {
    // Who-uses-what comes from the second admin migration, so a project with
    // only the first still gets the bars: that read failing is said inside
    // the tab rather than in place of it.
    const [week, month, people, users] = await Promise.all([
      readFeatureUse(db, 7),
      readFeatureUse(db, 30),
      readFeatureUsers(db),
      readUsers(db),
    ]);
    if (!week.ok) return missing(week.problem);
    if (!month.ok) return missing(month.problem);
    if (!users.ok) return missing(users.problem);
    return (
      <AdminFrame email={session.email} tab={tab}>
        <FeaturesTab
          week={week.value}
          month={month.value}
          users={users.value}
          people={people.ok ? people.value : people.problem}
          now={now}
        />
      </AdminFrame>
    );
  }

  if (tab === "feedback") {
    const feedback = await readFeedback(db);
    if (!feedback.ok) return missing(feedback.problem);
    return (
      <AdminFrame email={session.email} tab={tab}>
        <FeedbackTab feedback={feedback.value} now={now} />
      </AdminFrame>
    );
  }

  const users = await readUsers(db);
  if (!users.ok) return missing(users.problem);

  if (tab === "users") {
    return (
      <AdminFrame email={session.email} tab={tab}>
        <UsersTab users={users.value} now={now} segment={asSegment(params.segment)} />
      </AdminFrame>
    );
  }

  if (tab === "customers") {
    const [interest, payments] = await Promise.all([readInterest(db), readPayments(db)]);
    if (!interest.ok) return missing(interest.problem);
    if (!payments.ok) return missing(payments.problem);
    return (
      <AdminFrame email={session.email} tab={tab}>
        <CustomersTab
          users={users.value}
          interest={interest.value}
          payments={payments.value}
          now={now}
        />
      </AdminFrame>
    );
  }

  const daily = await readDaily(db, 30);
  if (!daily.ok) return missing(daily.problem);
  return (
    <AdminFrame email={session.email} tab={tab}>
      <OverviewTab users={users.value} daily={daily.value} now={now} />
    </AdminFrame>
  );
}

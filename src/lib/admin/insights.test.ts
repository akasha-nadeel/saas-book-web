import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ACTIVITY_KINDS } from "@/lib/activity-log";
import { perMonthOf } from "@/lib/billing/plans";
import { LAUNCH_LIMITS } from "@/lib/launch";
import {
  KIND_LABELS,
  SEGMENTS,
  cameBack,
  describeEvent,
  funnel,
  isPaying,
  revenue,
  segmentCounts,
  segmentOf,
  toAdminUser,
  toUserDetail,
  type AdminUser,
} from "./insights";

const NOW = new Date("2026-10-05T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

function user(over: Partial<AdminUser> = {}): AdminUser {
  return {
    id: "u",
    email: "w@example.com",
    createdAt: daysAgo(30),
    lastSignInAt: daysAgo(30),
    emailConfirmed: true,
    provider: "email",
    books: 1,
    chapters: 3,
    words: 2000,
    lastChangeAt: daysAgo(30),
    firstEventAt: null,
    lastEventAt: null,
    events30: 0,
    activeDays30: 0,
    activeDaysTotal: 0,
    lastWritingAt: null,
    lastLimitAt: null,
    sawPricing: false,
    startedCheckout: false,
    subscription: null,
    paid: {},
    interestPresses: 0,
    feedbackCount: 0,
    ...over,
  };
}

const pro = (over: Partial<NonNullable<AdminUser["subscription"]>> = {}) => ({
  plan: "pro",
  status: "active" as const,
  period: "monthly" as const,
  provider: "paddle",
  currentPeriodEnd: daysAgo(-20),
  cancelledAt: null,
  ...over,
});

/*
 * /privacy says the operator can see titles and word counts and never a
 * chapter's text, a note or a cover. These three tables are where those live,
 * so the functions that feed /admin must not name them. Comments are stripped
 * first: the migration explains the rule, and explaining it is not breaking it.
 */
describe("what the admin functions may read", () => {
  const sql = readFileSync(
    "supabase/migrations/20261005000000_admin_insights.sql",
    "utf8",
  )
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");

  it.each(["chapter_bodies", "chapter_notes", "book_covers"])(
    "never touches %s",
    (table) => {
      expect(sql).not.toContain(table);
    },
  );

  it("revokes every admin function from the browser's roles", () => {
    const fns = [...sql.matchAll(/create or replace function public\.(admin_\w+)\(/g)].map(
      (m) => m[1],
    );
    expect(fns.length).toBeGreaterThan(0);
    for (const fn of fns) {
      expect(sql).toMatch(
        new RegExp(`revoke execute on function public\\.${fn}\\([^)]*\\) from public, anon, authenticated;`),
      );
      expect(sql).toMatch(
        new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to service_role;`),
      );
    }
  });
});

describe("toAdminUser", () => {
  it("narrows a row from admin_users()", () => {
    const u = toAdminUser({
      id: "abc",
      email: "a@b.com",
      created_at: "2026-10-04T00:54:00Z",
      last_sign_in_at: null,
      email_confirmed: true,
      provider: "google",
      books: 2,
      chapters: 6,
      words: "2130",
      paid: { USD: "5.99" },
      status: "active",
      plan: "pro",
      period: "monthly",
      sub_provider: "paddle",
      current_period_end: "2026-11-04T00:00:00Z",
    });
    expect(u.words).toBe(2130);
    expect(u.paid).toEqual({ USD: 5.99 });
    expect(u.subscription?.status).toBe("active");
    expect(u.lastSignInAt).toBeNull();
  });

  it("reads no subscription when the row has none", () => {
    expect(toAdminUser({ id: "x", created_at: "2026-10-01T00:00:00Z" }).subscription).toBeNull();
  });

  it("refuses a status it does not know rather than guessing", () => {
    const u = toAdminUser({ id: "x", status: "trialing", plan: "pro", period: "monthly" });
    expect(u.subscription?.status).toBeNull();
    expect(isPaying(u, NOW)).toBe(false);
  });
});

describe("isPaying", () => {
  it("follows billing's own rule, grace days included", () => {
    expect(isPaying(user({ subscription: pro() }), NOW)).toBe(true);
    expect(isPaying(user({ subscription: pro({ currentPeriodEnd: daysAgo(2) }) }), NOW)).toBe(true);
    expect(isPaying(user({ subscription: pro({ currentPeriodEnd: daysAgo(4) }) }), NOW)).toBe(false);
  });

  it("gives a cancelled subscription no grace", () => {
    const sub = pro({ status: "cancelled", currentPeriodEnd: daysAgo(1) });
    expect(isPaying(user({ subscription: sub }), NOW)).toBe(false);
  });

  it("does not count a subscription whose first payment has not landed", () => {
    expect(isPaying(user({ subscription: pro({ currentPeriodEnd: null }) }), NOW)).toBe(false);
  });
});

describe("segmentOf", () => {
  it("puts a paid-up writer seen lately in Paying", () => {
    expect(segmentOf(user({ subscription: pro(), lastEventAt: daysAgo(1) }), NOW)).toBe("paying");
  });

  it("flags a paid-up writer nobody has seen for 14 days", () => {
    expect(segmentOf(user({ subscription: pro(), lastEventAt: daysAgo(20) }), NOW)).toBe(
      "paying_quiet",
    );
  });

  it("puts an unconfirmed account before anything else on Free", () => {
    expect(segmentOf(user({ emailConfirmed: false, books: 5 }), NOW)).toBe("unconfirmed");
  });

  it("finds the writers a limit has refused, or who hold the free book count", () => {
    expect(segmentOf(user({ lastLimitAt: daysAgo(3) }), NOW)).toBe("limit");
    expect(segmentOf(user({ books: LAUNCH_LIMITS.freeBooks }), NOW)).toBe("limit");
    expect(segmentOf(user({ lastLimitAt: daysAgo(40) }), NOW)).not.toBe("limit");
  });

  it("separates no book from no words", () => {
    expect(segmentOf(user({ books: 0, words: 0 }), NOW)).toBe("no_book");
    expect(segmentOf(user({ books: 1, words: 0 }), NOW)).toBe("no_words");
  });

  it("calls a writing event or a chapter change in 7 days Writing", () => {
    expect(segmentOf(user({ lastWritingAt: daysAgo(2) }), NOW)).toBe("writing");
    expect(segmentOf(user({ lastChangeAt: daysAgo(6) }), NOW)).toBe("writing");
  });

  it("tells a visitor from somebody gone quiet", () => {
    expect(segmentOf(user({ lastEventAt: daysAgo(3) }), NOW)).toBe("visiting");
    expect(segmentOf(user({ lastEventAt: daysAgo(15) }), NOW)).toBe("quiet");
  });

  it("puts everybody somewhere, and states a rule for every segment", () => {
    const users = [user(), user({ books: 0 }), user({ subscription: pro() })];
    const counts = segmentCounts(users, NOW);
    expect([...counts.values()].reduce((a, b) => a + b, 0)).toBe(users.length);
    for (const s of SEGMENTS) expect(s.rule.length).toBeGreaterThan(10);
  });
});

describe("cameBack", () => {
  it("is true for a later day and false for the signup day alone", () => {
    const joined = new Date("2026-10-04T00:54:00Z");
    expect(
      cameBack(user({ createdAt: joined, lastSignInAt: joined, lastChangeAt: joined })),
    ).toBe(false);
    expect(
      cameBack(
        user({
          createdAt: joined,
          lastSignInAt: joined,
          lastChangeAt: new Date("2026-10-05T09:00:00Z"),
        }),
      ),
    ).toBe(true);
    expect(cameBack(user({ activeDaysTotal: 2 }))).toBe(true);
  });
});

describe("funnel", () => {
  it("counts each step on its own rather than forcing them to nest", () => {
    const users = [
      user({ books: 0, words: 0, emailConfirmed: false }),
      user({ words: 50 }),
      user({ words: 5000, paid: { USD: 5.99 }, subscription: pro() }),
    ];
    const steps = Object.fromEntries(funnel(users).map((s) => [s.label, s.count]));
    expect(steps["Signed up"]).toBe(3);
    expect(steps["Confirmed their email"]).toBe(2);
    expect(steps["Made a book"]).toBe(2);
    expect(steps["Wrote 100+ words"]).toBe(1);
    expect(steps["Paid"]).toBe(1);
    expect(steps["Started a checkout"]).toBe(1);
  });
});

describe("revenue", () => {
  it("prices active subscriptions from plans.ts and sums every completed payment", () => {
    const users = [
      user({ subscription: pro(), paid: { USD: 5.99 } }),
      user({ subscription: pro({ period: "annual" }), paid: { USD: 59.88 } }),
      user({ subscription: pro({ status: "past_due" }), paid: { USD: 5.99 } }),
      user({ subscription: pro({ status: "cancelled" }), paid: { USD: 5.99 } }),
      user({ subscription: pro({ currentPeriodEnd: daysAgo(30) }), paid: { USD: 5.99 } }),
    ];
    const r = revenue(users, NOW);
    expect(r.active).toBe(2);
    expect(r.pastDue).toBe(1);
    expect(r.ending).toBe(1);
    expect(r.monthly).toBeCloseTo(perMonthOf("pro", "monthly") + perMonthOf("pro", "annual"));
    expect(r.allTime).toEqual({ USD: 83.84 });
  });
});

describe("words for the record", () => {
  it("has a label for every kind", () => {
    for (const kind of ACTIVITY_KINDS) expect(KIND_LABELS[kind]).toBeTruthy();
  });

  it("joins a kind and its detail", () => {
    expect(describeEvent("export_done", "epub")).toBe("Exported · EPUB");
    expect(describeEvent("app_open", null)).toBe("Opened the app");
  });
});

describe("toUserDetail", () => {
  it("reads the jsonb admin_user_detail() returns", () => {
    const d = toUserDetail({
      books: [{ id: "bk-1", title: "The Book", chapters: 2, words: "2000", created_at: "2026-10-04T01:00:00Z" }],
      events: [{ kind: "export_done", detail: "epub", book_id: null, created_at: "2026-10-05T00:00:00Z" }],
      payments: [],
    });
    expect(d.books[0]).toMatchObject({ title: "The Book", words: 2000, chapters: 2 });
    expect(d.events[0].detail).toBe("epub");
    expect(d.feedback).toEqual([]);
  });

  it("survives null", () => {
    expect(toUserDetail(null).books).toEqual([]);
  });
});

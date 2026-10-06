import { ACTIVITY_KINDS, type ActivityKind } from "@/lib/activity-log";
import { asPeriod, perMonthOf, type Period } from "@/lib/billing/plans";
import {
  asSubscriptionStatus,
  isPro,
  type SubscriptionStatus,
} from "@/lib/billing/subscription";
import { asPaidTier } from "@/lib/billing/tiers";
import { LAUNCH_LIMITS } from "@/lib/launch";

/**
 * What the admin dashboard says about the people using OpenChapter.
 *
 * Pure: it reads the rows the `admin_*` functions return and nothing else, so
 * every rule here is tested and the screens only draw.
 *
 * **The house rules hold here as everywhere.** No score, no grade, no
 * "engagement index". A writer is put in a *segment* by a rule that is
 * written down beside it on the screen, so the operator can always see why
 * somebody is where they are — and disagree with the rule rather than with a
 * number. Counts are counts; the only derived money figure is the monthly
 * revenue, worked out from `plans.ts` rather than from a copy of the prices.
 *
 * **The activity record is younger than the accounts.** Anything that rests on
 * it — visits, writing days, pricing views — knows nothing before the first
 * event, and the dashboard says when that was.
 */

const DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export interface AdminSubscription {
  plan: string | null;
  status: SubscriptionStatus | null;
  period: Period | null;
  provider: string | null;
  currentPeriodEnd: Date | null;
  cancelledAt: Date | null;
}

export interface AdminUser {
  id: string;
  email: string | null;
  createdAt: Date;
  lastSignInAt: Date | null;
  emailConfirmed: boolean;
  provider: string;
  books: number;
  chapters: number;
  words: number;
  /** The newest `chapters.updated_at` — a sync of any chapter change. */
  lastChangeAt: Date | null;
  firstEventAt: Date | null;
  lastEventAt: Date | null;
  events30: number;
  activeDays30: number;
  activeDaysTotal: number;
  lastWritingAt: Date | null;
  lastLimitAt: Date | null;
  sawPricing: boolean;
  startedCheckout: boolean;
  subscription: AdminSubscription | null;
  /** Completed payments, summed per currency. */
  paid: Record<string, number>;
  interestPresses: number;
  feedbackCount: number;
}

function date(value: unknown): Date | null {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function num(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function money(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, number> = {};
  for (const [currency, amount] of Object.entries(value)) {
    const n = num(amount);
    if (n !== 0) out[currency] = n;
  }
  return out;
}

/** One row of `admin_users()`. Narrowed field by field; nothing is trusted. */
export function toAdminUser(row: Record<string, unknown>): AdminUser {
  const hasSub = row.status != null || row.plan != null;
  return {
    id: String(row.id),
    email: text(row.email),
    createdAt: date(row.created_at) ?? new Date(0),
    lastSignInAt: date(row.last_sign_in_at),
    emailConfirmed: row.email_confirmed === true,
    provider: text(row.provider) ?? "email",
    books: num(row.books),
    chapters: num(row.chapters),
    words: num(row.words),
    lastChangeAt: date(row.last_change_at),
    firstEventAt: date(row.first_event_at),
    lastEventAt: date(row.last_event_at),
    events30: num(row.events_30),
    activeDays30: num(row.active_days_30),
    activeDaysTotal: num(row.active_days_total),
    lastWritingAt: date(row.last_writing_at),
    lastLimitAt: date(row.last_limit_at),
    sawPricing: row.saw_pricing === true,
    startedCheckout: row.started_checkout === true,
    subscription: hasSub
      ? {
          plan: text(row.plan),
          status: asSubscriptionStatus(row.status),
          period: asPeriod(row.period),
          provider: text(row.sub_provider),
          currentPeriodEnd: date(row.current_period_end),
          cancelledAt: date(row.cancelled_at),
        }
      : null,
    paid: money(row.paid),
    interestPresses: num(row.interest_presses),
    feedbackCount: num(row.feedback_count),
  };
}

// ---------------------------------------------------------------------------
// Facts about one writer
// ---------------------------------------------------------------------------

/**
 * Paid up at `now`, by the app's own rule — `isPro`, the one answer billing
 * gives everywhere else, grace days and all. A row that does not narrow is
 * not paying, the same treatment `toSubscription` gives it.
 */
export function isPaying(user: AdminUser, now: Date): boolean {
  const sub = user.subscription;
  if (!sub || !sub.status || !sub.period) return false;
  const tier = asPaidTier(sub.plan);
  if (!tier) return false;
  return isPro(
    {
      provider: sub.provider === "paddle" ? "paddle" : "payhere",
      tier,
      status: sub.status,
      period: sub.period,
      currentPeriodEnd: sub.currentPeriodEnd,
      payhereSubscriptionId: null,
      paddleSubscriptionId: null,
      cancelledAt: sub.cancelledAt,
    },
    now,
  );
}

/** Has any completed payment ever been recorded for this writer. */
export function hasPaid(user: AdminUser): boolean {
  return Object.values(user.paid).some((n) => n > 0);
}

/**
 * The last time this writer did anything the database saw: an event, a
 * chapter change reaching the server, or a sign-in. Null for an account that
 * has done none of the three.
 */
export function lastActive(user: AdminUser): Date | null {
  const times = [user.lastEventAt, user.lastChangeAt, user.lastSignInAt]
    .filter((d): d is Date => d !== null)
    .map((d) => d.getTime());
  return times.length > 0 ? new Date(Math.max(...times)) : null;
}

function within(d: Date | null, days: number, now: Date): boolean {
  return d !== null && now.getTime() - d.getTime() <= days * DAY;
}

function utcDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Came back on a day after the one they signed up on. Read from every
 * timestamp there is, so it works for accounts older than the activity record.
 */
export function cameBack(user: AdminUser): boolean {
  if (user.activeDaysTotal >= 2) return true;
  const joined = utcDay(user.createdAt);
  return [user.lastEventAt, user.lastChangeAt, user.lastSignInAt].some(
    (d) => d !== null && utcDay(d) > joined,
  );
}

// ---------------------------------------------------------------------------
// Segments
// ---------------------------------------------------------------------------

export type SegmentId =
  | "paying_quiet"
  | "paying"
  | "unconfirmed"
  | "limit"
  | "no_book"
  | "no_words"
  | "writing"
  | "visiting"
  | "quiet";

export interface Segment {
  id: SegmentId;
  label: string;
  /** The rule, in words, printed beside the label. */
  rule: string;
  tone: "ok" | "note" | "stop" | "plain";
}

/** In the order they are tested — the first rule a writer meets is theirs. */
export const SEGMENTS: readonly Segment[] = [
  {
    id: "paying_quiet",
    label: "Paying, gone quiet",
    rule: "Paid up, and nothing seen from them in 14 days. The ones most likely to cancel.",
    tone: "stop",
  },
  {
    id: "paying",
    label: "Paying",
    rule: "Paid up on Pro right now, by the same rule the app uses to unlock it.",
    tone: "ok",
  },
  {
    id: "unconfirmed",
    label: "Never confirmed",
    rule: "Signed up but never confirmed their email address.",
    tone: "plain",
  },
  {
    id: "limit",
    label: "Hit a free limit",
    rule: `On Free, and either refused by a limit in the last 30 days or holding ${LAUNCH_LIMITS.freeBooks}+ books. The ones to ask about Pro.`,
    tone: "note",
  },
  {
    id: "no_book",
    label: "No book yet",
    rule: "Signed up and confirmed, but has not made a book.",
    tone: "plain",
  },
  {
    id: "no_words",
    label: "Book, no words",
    rule: "Has a book with nothing written in it yet.",
    tone: "plain",
  },
  {
    id: "writing",
    label: "Writing",
    rule: "Wrote, or changed a chapter, in the last 7 days.",
    tone: "ok",
  },
  {
    id: "visiting",
    label: "Visiting, not writing",
    rule: "Seen in the last 14 days, but no writing in the last 7.",
    tone: "note",
  },
  {
    id: "quiet",
    label: "Gone quiet",
    rule: "Has written before, and nothing seen from them in 14 days.",
    tone: "plain",
  },
];

const BY_ID = new Map(SEGMENTS.map((s) => [s.id, s]));

export function segment(id: SegmentId): Segment {
  return BY_ID.get(id)!;
}

export function segmentOf(user: AdminUser, now: Date): SegmentId {
  const seen = lastActive(user);

  if (isPaying(user, now)) {
    return within(seen, 14, now) ? "paying" : "paying_quiet";
  }
  if (!user.emailConfirmed) return "unconfirmed";
  if (within(user.lastLimitAt, 30, now) || user.books >= LAUNCH_LIMITS.freeBooks) {
    return "limit";
  }
  if (user.books === 0) return "no_book";
  if (user.words === 0) return "no_words";
  if (within(user.lastWritingAt, 7, now) || within(user.lastChangeAt, 7, now)) {
    return "writing";
  }
  if (within(seen, 14, now)) return "visiting";
  return "quiet";
}

export function segmentCounts(
  users: readonly AdminUser[],
  now: Date,
): Map<SegmentId, number> {
  const counts = new Map<SegmentId, number>(SEGMENTS.map((s) => [s.id, 0]));
  for (const user of users) {
    const id = segmentOf(user, now);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

// ---------------------------------------------------------------------------
// The funnel
// ---------------------------------------------------------------------------

export interface FunnelStep {
  label: string;
  count: number;
  /** Where the count comes from, when it is not plain account data. */
  source?: string;
}

/**
 * Each step counted on its own, in the order a writer usually meets them.
 * They are not forced to nest: somebody can pay without writing 100 words,
 * and a funnel that hid them to make the bars shrink tidily would be lying.
 */
export function funnel(users: readonly AdminUser[]): FunnelStep[] {
  const count = (test: (u: AdminUser) => boolean) => users.filter(test).length;

  return [
    { label: "Signed up", count: users.length },
    { label: "Confirmed their email", count: count((u) => u.emailConfirmed) },
    { label: "Made a book", count: count((u) => u.books > 0) },
    { label: "Wrote 100+ words", count: count((u) => u.words >= 100) },
    { label: "Came back on a later day", count: count(cameBack) },
    {
      label: "Looked at pricing",
      count: count(
        (u) =>
          u.sawPricing ||
          u.startedCheckout ||
          u.interestPresses > 0 ||
          u.subscription !== null ||
          hasPaid(u),
      ),
      source: "Activity record and plan-button presses",
    },
    {
      label: "Started a checkout",
      count: count((u) => u.startedCheckout || u.subscription !== null || hasPaid(u)),
      source: "Activity record and subscriptions",
    },
    { label: "Paid", count: count(hasPaid), source: "Completed payments" },
  ];
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export interface Revenue {
  /** Active subscriptions that will renew, at their per-month price, in USD. */
  monthly: number;
  active: number;
  pastDue: number;
  /** Cancelled, still inside the period they paid for. */
  ending: number;
  /** Every completed payment ever, per currency. */
  allTime: Record<string, number>;
}

export function revenue(users: readonly AdminUser[], now: Date): Revenue {
  let monthly = 0;
  let active = 0;
  let pastDue = 0;
  let ending = 0;
  const allTime: Record<string, number> = {};

  for (const user of users) {
    for (const [currency, amount] of Object.entries(user.paid)) {
      allTime[currency] = round2((allTime[currency] ?? 0) + amount);
    }

    if (!isPaying(user, now)) continue;
    const sub = user.subscription!;
    const tier = asPaidTier(sub.plan)!;

    if (sub.status === "active") {
      active += 1;
      monthly += perMonthOf(tier, sub.period!);
    } else if (sub.status === "past_due") {
      pastDue += 1;
    } else if (sub.status === "cancelled") {
      ending += 1;
    }
  }

  return { monthly: round2(monthly), active, pastDue, ending, allTime };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// The activity record, in words
// ---------------------------------------------------------------------------

export const KIND_LABELS: Record<ActivityKind, string> = {
  app_open: "Opened the app",
  book_open: "Opened a book",
  writing: "Wrote",
  book_created: "Made a book",
  import_done: "Imported a file",
  export_done: "Exported",
  title_check_run: "Ran a title check",
  price_check_run: "Ran a price check",
  consistency_run: "Ran a consistency check",
  paperback_open: "Opened paperback setup",
  provenance_open: "Opened the writing record",
  pricing_view: "Looked at pricing",
  checkout_start: "Started a checkout",
  limit_hit: "Was refused by a free limit",
};

const DETAIL_LABELS: Record<string, string> = {
  blank: "from scratch",
  import: "from a file",
  docx: "Word",
  epub: "EPUB",
  md: "Markdown",
  markdown: "Markdown",
  txt: "plain text",
  html: "HTML",
  pdf: "PDF",
  monthly: "monthly",
  annual: "annual",
  books: "book limit",
  titleCheck: "title checks",
  /* Until 6 Oct 2026 the price check's daily limit; since then, a free writer
     pressing its Amazon tab. Reused rather than renamed because the details
     are also a CHECK constraint in the database, and a new word would need a
     migration for one counter. */
  priceCheck: "price check (Amazon tab)",
  comps: "comparable titles",
  covers: "cover checks",
  blurb: "blurb",
  prose: "prose report",
  track: "tracking",
  arcReaders: "advance readers",
  ideas: "parked ideas",
  seats: "seats",
  checks: "consistency checks",
  paperback: "paperback setup",
};

/** "Exported · EPUB", "Was refused by a free limit · title checks". */
export function describeEvent(kind: string, detail: string | null): string {
  const label = (KIND_LABELS as Record<string, string>)[kind] ?? kind;
  if (!detail) return label;
  return `${label} · ${DETAIL_LABELS[detail] ?? detail}`;
}

export function isActivityKind(value: unknown): value is ActivityKind {
  return (ACTIVITY_KINDS as readonly unknown[]).includes(value);
}

// ---------------------------------------------------------------------------
// Days, features, and one writer's detail
// ---------------------------------------------------------------------------

export interface AdminDay {
  day: string;
  signups: number;
  activeUsers: number;
  writers: number;
  payments: number;
}

export function toAdminDay(row: Record<string, unknown>): AdminDay {
  return {
    day: String(row.day).slice(0, 10),
    signups: num(row.signups),
    activeUsers: num(row.active_users),
    writers: num(row.writers),
    payments: num(row.payments),
  };
}

export interface FeatureUse {
  kind: string;
  detail: string | null;
  events: number;
  users: number;
}

export function toFeatureUse(row: Record<string, unknown>): FeatureUse {
  return {
    kind: String(row.kind),
    detail: text(row.detail),
    events: num(row.events),
    users: num(row.users),
  };
}

/** The earliest event anybody has — the day the activity record began. */
export function recordStart(users: readonly AdminUser[]): Date | null {
  const times = users
    .map((u) => u.firstEventAt?.getTime())
    .filter((t): t is number => t !== undefined);
  return times.length > 0 ? new Date(Math.min(...times)) : null;
}

export interface AdminBook {
  id: string;
  title: string;
  genre: string | null;
  kind: string | null;
  targetWords: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  lastOpenedAt: Date | null;
  archivedAt: Date | null;
  trashedAt: Date | null;
  chapters: number;
  words: number;
}

export interface AdminEvent {
  kind: string;
  detail: string | null;
  bookId: string | null;
  createdAt: Date | null;
}

export interface AdminPayment {
  createdAt: Date | null;
  provider: string | null;
  eventType: string | null;
  statusCode: number | null;
  amount: number | null;
  currency: string | null;
  completed: boolean;
  email?: string | null;
  owner?: string | null;
}

export interface AdminFeedback {
  createdAt: Date | null;
  topic: string | null;
  sentiment: string | null;
  message: string;
  owner?: string | null;
  email?: string | null;
}

export interface AdminInterest {
  createdAt: Date | null;
  tier: string | null;
  period: string | null;
  source: string | null;
  owner?: string | null;
  email?: string | null;
}

export interface AdminMembership {
  bookId: string;
  title: string | null;
  role: string | null;
  status: string | null;
  acceptedAt: Date | null;
}

export interface AdminUserDetail {
  books: AdminBook[];
  events: AdminEvent[];
  payments: AdminPayment[];
  feedback: AdminFeedback[];
  interest: AdminInterest[];
  memberships: AdminMembership[];
}

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    : [];
}

export function toPayment(row: Record<string, unknown>): AdminPayment {
  return {
    createdAt: date(row.created_at),
    provider: text(row.provider),
    eventType: text(row.event_type),
    statusCode: row.status_code == null ? null : num(row.status_code),
    amount: row.amount == null ? null : num(row.amount),
    currency: text(row.currency),
    completed: row.completed === true,
    email: text(row.email),
    owner: text(row.owner),
  };
}

export function toFeedback(row: Record<string, unknown>): AdminFeedback {
  return {
    createdAt: date(row.created_at),
    topic: text(row.topic),
    sentiment: text(row.sentiment),
    message: typeof row.message === "string" ? row.message : "",
    owner: text(row.owner),
    email: text(row.email),
  };
}

export function toInterest(row: Record<string, unknown>): AdminInterest {
  return {
    createdAt: date(row.created_at),
    tier: text(row.tier),
    period: text(row.period),
    source: text(row.source),
    owner: text(row.owner),
    email: text(row.email),
  };
}

export function toUserDetail(value: unknown): AdminUserDetail {
  const d = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    books: list(d.books).map((b) => ({
      id: String(b.id),
      title: typeof b.title === "string" ? b.title : "",
      genre: text(b.genre),
      kind: text(b.kind),
      targetWords: b.target_words == null ? null : num(b.target_words),
      createdAt: date(b.created_at),
      updatedAt: date(b.updated_at),
      lastOpenedAt: date(b.last_opened_at),
      archivedAt: date(b.archived_at),
      trashedAt: date(b.trashed_at),
      chapters: num(b.chapters),
      words: num(b.words),
    })),
    events: list(d.events).map((e) => ({
      kind: String(e.kind),
      detail: text(e.detail),
      bookId: text(e.book_id),
      createdAt: date(e.created_at),
    })),
    payments: list(d.payments).map(toPayment),
    feedback: list(d.feedback).map(toFeedback),
    interest: list(d.interest).map(toInterest),
    memberships: list(d.memberships).map((m) => ({
      bookId: String(m.book_id),
      title: text(m.title),
      role: text(m.role),
      status: text(m.status),
      acceptedAt: date(m.accepted_at),
    })),
  };
}

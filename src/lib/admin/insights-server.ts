import "server-only";

import type { AdminDb } from "./require-admin";
import {
  toAdminDay,
  toAdminUser,
  toFeatureUse,
  toFeedback,
  toInterest,
  toPayment,
  toUserDetail,
  type AdminDay,
  type AdminFeedback,
  type AdminInterest,
  type AdminPayment,
  type AdminUser,
  type AdminUserDetail,
  type FeatureUse,
} from "./insights";

/**
 * The reads behind `/admin`, through the `admin_*` functions and nothing else.
 *
 * Only ever handed the client `requireAdmin()` returns, so there is no path
 * here that runs before the operator has been checked. Every read goes
 * through a function rather than a table: the functions are the list of what
 * the operator may see, and `insights.test.ts` holds that list to /privacy.
 */

export const MIGRATION = "supabase/migrations/20261005000000_admin_insights.sql";

/**
 * Why a read came back empty. A function that does not exist is the migration
 * not having been applied — PostgREST says PGRST202 for an unknown function —
 * and the page names the file rather than drawing an empty dashboard that
 * reads as "nobody uses this".
 */
export type ReadProblem = { kind: "missing" } | { kind: "failed"; message: string };

type Result<T> = { ok: true; value: T } | { ok: false; problem: ReadProblem };

async function call<T>(
  db: AdminDb,
  fn: string,
  args: Record<string, unknown> | undefined,
  map: (data: unknown) => T,
): Promise<Result<T>> {
  const { data, error } = await db.rpc(fn, args);
  if (error) {
    if (error.code === "PGRST202" || error.code === "42883") {
      return { ok: false, problem: { kind: "missing" } };
    }
    console.error(`[admin] ${fn} failed [${error.code}] ${error.message}`);
    return {
      ok: false,
      problem: { kind: "failed", message: `${fn}: [${error.code}] ${error.message}` },
    };
  }
  return { ok: true, value: map(data) };
}

const rows = (data: unknown): Record<string, unknown>[] =>
  Array.isArray(data) ? (data as Record<string, unknown>[]) : [];

export function readUsers(db: AdminDb): Promise<Result<AdminUser[]>> {
  return call(db, "admin_users", undefined, (d) => rows(d).map(toAdminUser));
}

export function readDaily(db: AdminDb, days: number): Promise<Result<AdminDay[]>> {
  return call(db, "admin_daily", { p_days: days }, (d) => rows(d).map(toAdminDay));
}

export function readFeatureUse(db: AdminDb, days: number): Promise<Result<FeatureUse[]>> {
  return call(db, "admin_feature_use", { p_days: days }, (d) => rows(d).map(toFeatureUse));
}

export function readUserDetail(db: AdminDb, id: string): Promise<Result<AdminUserDetail>> {
  return call(db, "admin_user_detail", { p_user: id }, toUserDetail);
}

export function readFeedback(db: AdminDb, limit = 200): Promise<Result<AdminFeedback[]>> {
  return call(db, "admin_feedback", { p_limit: limit }, (d) => rows(d).map(toFeedback));
}

export function readInterest(db: AdminDb, limit = 200): Promise<Result<AdminInterest[]>> {
  return call(db, "admin_interest", { p_limit: limit }, (d) => rows(d).map(toInterest));
}

export function readPayments(db: AdminDb, limit = 200): Promise<Result<AdminPayment[]>> {
  return call(db, "admin_payments", { p_limit: limit }, (d) => rows(d).map(toPayment));
}

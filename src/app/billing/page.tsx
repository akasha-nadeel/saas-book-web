import { redirect } from "next/navigation";
import { BillingPage } from "@/components/billing/billing-page";
import { paddleClientConfig } from "@/lib/billing/paddle";
import { activeProvider } from "@/lib/billing/provider";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Billing · OpenChapter",
};

/**
 * The billing page. Only for signed-in writers — a visitor without an account
 * has nothing to bill, and seeing an empty billing screen is confusing rather
 * than helpful.
 *
 * The component itself is a client component that fetches the plan and payment
 * history from the API, same pattern as the plans page.
 *
 * **Paddle's client config is read here and passed down**, exactly as
 * `/upgrade` does it, and for a reason that cost a working button: only
 * `NEXT_PUBLIC_` names survive into a client bundle, so `PADDLE_ENV` read from
 * a component is always `undefined` and `paddleClientConfig()` there always
 * answered `sandbox`. Paddle.js will not start with a live token against the
 * sandbox, so the Update button failed to open anything — in production as much
 * as locally. Read on the server it is simply right.
 */
export default async function BillingRoute() {
  if (!isSupabaseConfigured()) redirect("/");

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;

  if (!userId) redirect("/signin?next=/billing");

  const paddle = activeProvider() === "paddle" ? paddleClientConfig() : null;

  return <BillingPage paddle={paddle} />;
}

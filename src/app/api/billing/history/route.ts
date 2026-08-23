import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { billingConfigured } from "@/lib/billing/provider";
import { hasInvoice, paymentStatus } from "@/lib/billing/history";

/**
 * The writer's own payment history, read through RLS.
 *
 * Returns the most recent 50 transactions so the billing page can show an
 * invoices table without the client needing to know the table name or the
 * column mapping. Each row is what a receipt line needs: date, amount,
 * currency, what became of it, and whether there is an invoice to open.
 *
 * The status is read here rather than in the table because the two gateways
 * store their statuses in different columns and different vocabularies — see
 * `lib/billing/history.ts`, which is the pure half and the tested one. What
 * reaches the browser is one shape, and the raw codes stay on the server.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  if (!billingConfigured() || !isSupabaseConfigured()) {
    return Response.json({ events: [] });
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId =
    typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;

  if (!userId) {
    return Response.json({ events: [] });
  }

  const { data, error } = await supabase
    .from("payment_events")
    .select(
      "payment_id, order_id, provider, amount, currency, event_type, status_code, created_at",
    )
    .eq("owner", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[billing] payment history query failed", error);
    return Response.json({ events: [] });
  }

  const events = (data ?? []).map((row) => {
    const provider = typeof row.provider === "string" ? row.provider : null;
    const eventType = typeof row.event_type === "string" ? row.event_type : null;
    const statusCode =
      typeof row.status_code === "number" ? row.status_code : null;
    const id = String(row.payment_id ?? row.order_id ?? "");

    return {
      id,
      date: row.created_at ? String(row.created_at) : null,
      amount: typeof row.amount === "number" ? row.amount : null,
      currency: typeof row.currency === "string" ? row.currency : "USD",
      provider,
      status: paymentStatus({ provider, eventType, statusCode }),
      // Whether to offer the link at all is decided here, so the table never
      // renders a View that leads nowhere.
      invoice: hasInvoice({ provider, eventType }) && id.length > 0,
    };
  });

  return Response.json({ events });
}

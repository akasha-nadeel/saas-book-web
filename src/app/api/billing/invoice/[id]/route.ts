import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import {
  PADDLE_API_KEY,
  PADDLE_SANDBOX,
  isPaddleConfigured,
} from "@/lib/billing/paddle";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/**
 * One invoice, opened rather than fetched.
 *
 * This is a **redirect**, not JSON, and that is the whole design: the table
 * links straight at it, the browser follows it in a new tab, and the writer
 * gets Paddle's own PDF. Fetching the URL into the page instead would mean
 * `window.open` after an await — which is what a popup blocker exists to stop —
 * and would put a signed document URL in the page source. Paddle's link is
 * short-lived, so it is asked for at the moment it is used and never stored.
 *
 * **The id is checked against the writer's own rows before Paddle is asked.**
 * A transaction id is guessable in the way any id is, and Paddle would happily
 * hand back a stranger's invoice if we passed one through. The lookup goes
 * through the ordinary client, so RLS is doing the work and the `owner` filter
 * is the second lock rather than the only one.
 */

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!isPaddleConfigured() || !isSupabaseConfigured()) {
    return Response.json({ error: "No invoices here." }, { status: 501 });
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId =
    typeof claims?.claims?.sub === "string" ? claims.claims.sub : null;

  if (!userId) {
    return Response.json({ error: "Sign in to see your invoices." }, { status: 401 });
  }

  const { data: row } = await supabase
    .from("payment_events")
    .select("payment_id, provider")
    .eq("payment_id", id)
    .eq("owner", userId)
    .maybeSingle();

  // Not found and not yours are answered the same way on purpose: telling a
  // stranger that an id exists is the one thing this check is here to avoid.
  if (!row || row.provider !== "paddle") {
    return Response.json({ error: "No such invoice." }, { status: 404 });
  }

  const paddle = new Paddle(PADDLE_API_KEY, {
    environment: PADDLE_SANDBOX ? Environment.sandbox : Environment.production,
  });

  try {
    const invoice = await paddle.transactions.getInvoicePDF(id);
    if (!invoice?.url) {
      return Response.json({ error: "No invoice for that payment." }, { status: 404 });
    }
    return Response.redirect(invoice.url, 302);
  } catch (error) {
    console.error("[billing] paddle invoice lookup failed", error);
    return Response.json({ error: "Could not fetch that invoice." }, { status: 502 });
  }
}

import { CheckoutResult } from "@/components/upgrade/checkout-result";

/**
 * PayHere's return_url.
 *
 * Gated like the rest of the app — a writer arriving here has a session,
 * because they had one when they left. The order id rides in the query so the
 * page can ask about that particular payment as well as about the plan; it is
 * only ever used to look up a row that row-level security already scopes to the
 * writer, so a guessed one finds nothing.
 */

export const metadata = {
  title: "Payment · OpenChapter",
};

export default async function CheckoutDonePage(
  props: PageProps<"/upgrade/done">,
) {
  const { order } = await props.searchParams;
  return <CheckoutResult orderId={typeof order === "string" ? order : null} />;
}

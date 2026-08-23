/**
 * What a row in the payment history actually says.
 *
 * `payment_events` holds two gateways' vocabularies side by side and neither
 * was translated on the way in — PayHere's integer code and Paddle's own words
 * are both stored raw, on purpose, so a status a later version does not know
 * about is still on the record. The reading of them therefore has to happen
 * somewhere, and it happens here rather than in the route or the table so there
 * is one answer and it can be tested.
 *
 * **The invoices table used to print "Paid" on every row.** That was true of
 * every row it could show, since `transaction.completed` is the only Paddle
 * event that writes one — but it was printed rather than read, so a refund or a
 * chargeback would have been captioned as a payment. A status column that
 * cannot say anything but "Paid" is a decoration; this is the same column
 * answering from the record.
 *
 * The unknown case is the important one and it is deliberately not "Paid": an
 * unrecognised code is shown as itself, tidied up, because a writer looking at
 * their own money is better served by a word we did not understand than by a
 * reassuring one we made up.
 */

/**
 * Which of the three status colours a row takes. `plain` is for a status that
 * is real but carries no verdict — pending, or a word we do not recognise —
 * and takes the ordinary text colour rather than spending one of the three.
 */
export type PaymentTone = "ok" | "note" | "stop" | "plain";

export interface PaymentStatus {
  label: string;
  tone: PaymentTone;
}

export interface PaymentStatusInput {
  provider: string | null;
  /** Paddle's own event name, stored raw. */
  eventType: string | null;
  /** PayHere's own integer, stored raw. */
  statusCode: number | null;
}

/** PayHere's codes, from its notification documentation. */
const PAYHERE_CODES: Record<number, PaymentStatus> = {
  2: { label: "Paid", tone: "ok" },
  0: { label: "Pending", tone: "plain" },
  [-1]: { label: "Cancelled", tone: "note" },
  [-2]: { label: "Failed", tone: "stop" },
  [-3]: { label: "Chargeback", tone: "stop" },
};

/**
 * Paddle's event names. Only `transaction.completed` is written today, and the
 * rest are here because the webhook is one edit away from recording them and a
 * status that arrives before its label is exactly the case the fallback below
 * is protecting against.
 */
const PADDLE_EVENTS: Record<string, PaymentStatus> = {
  "transaction.completed": { label: "Paid", tone: "ok" },
  "transaction.paid": { label: "Paid", tone: "ok" },
  "transaction.billed": { label: "Billed", tone: "plain" },
  "transaction.payment_failed": { label: "Failed", tone: "stop" },
  "transaction.canceled": { label: "Cancelled", tone: "note" },
  "transaction.past_due": { label: "Past due", tone: "stop" },
  "adjustment.created": { label: "Refunded", tone: "note" },
  "adjustment.updated": { label: "Refunded", tone: "note" },
};

/**
 * `transaction.payment_failed` → "Payment failed".
 *
 * The namespace is dropped because it is the same on every row and says
 * nothing, and the underscores become spaces. Nothing else is done to it: this
 * is a status we do not have a word for, and dressing it up further would be
 * inventing one.
 */
function humanise(raw: string): string {
  const tail = raw.includes(".") ? raw.slice(raw.lastIndexOf(".") + 1) : raw;
  const words = tail.replace(/[_-]+/g, " ").trim();
  if (words.length === 0) return raw;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function paymentStatus({
  provider,
  eventType,
  statusCode,
}: PaymentStatusInput): PaymentStatus {
  if (provider === "paddle" || (eventType && provider !== "payhere")) {
    if (!eventType) return { label: "—", tone: "plain" };
    return PADDLE_EVENTS[eventType] ?? { label: humanise(eventType), tone: "plain" };
  }

  if (statusCode === null) return { label: "—", tone: "plain" };
  return (
    PAYHERE_CODES[statusCode] ?? {
      // PayHere's unknown code has no words in it at all, so the number is the
      // only honest thing to show. It is at least searchable.
      label: `Code ${statusCode}`,
      tone: "plain",
    }
  );
}

/**
 * Whether this row has an invoice a writer can open.
 *
 * Only Paddle issues one, and only for a transaction it completed. PayHere
 * sends a receipt by email and has no document to link to, so those rows show
 * nothing rather than a link that would 404 — the same rule as everywhere else
 * here: a control that cannot work does not appear.
 */
export function hasInvoice({
  provider,
  eventType,
}: Pick<PaymentStatusInput, "provider" | "eventType">): boolean {
  return provider === "paddle" && eventType === "transaction.completed";
}

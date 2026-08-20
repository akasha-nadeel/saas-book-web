/**
 * Who runs this, how to reach them, and when the policies last changed.
 *
 * One module because four pages and the landing footer all state the same
 * handful of facts, and a contact address that is right on three pages and
 * stale on the fourth is the exact failure a payment reviewer looks for. Same
 * rule the prices and the free limits follow: one number, one place.
 *
 * These are *legal* identity rather than product copy — a payment provider,
 * a card network and a customer with a complaint all need to know who they are
 * dealing with, and "OpenChapter" is a trading name rather than a person.
 */

/** The person legally behind the service, as written on the bank account. */
export const OPERATOR = "Kadawala Hetti Arachchilage Akasha Nadeel Gunathilaka";

/** The same person, as anybody would actually address them. */
export const OPERATOR_SHORT = "Akasha Nadeel Gunathilaka";

/** The trading name — what the product is called everywhere else. */
export const TRADING_NAME = "OpenChapter";

/** Where the operator is, which is also whose law governs the terms. */
export const COUNTRY = "Sri Lanka";

/**
 * The one address on the site. Support, refunds, privacy requests, all of it.
 *
 * **On the domain rather than a personal inbox, and that is not vanity.** This
 * was a `gmail.com` address until 2026-08-20, printed beside the operator's
 * full legal name on the landing page, the footer and all four legal pages —
 * which is the pairing a payment reviewer reads as an individual rather than a
 * business, on the one product that is asking for a card. It is the same
 * reasoning `send.ts` gives for never sending *as* the owner: an address on the
 * domain that is selling is what a gateway, a card network and a customer with
 * a complaint all expect to find.
 *
 * It has to **receive**, not merely exist — Resend sends and does not give the
 * domain an inbox. Forwarded to a real mailbox, and tested before this line
 * changed, because an address on four legal pages that bounces is worse than
 * the personal one it replaced.
 */
export const CONTACT_EMAIL = "contact@openchapterapp.com";

/**
 * When these pages last changed, written out rather than generated.
 *
 * A date derived from `new Date()` would say the policy changed today every
 * day, which tells a reader nothing and is untrue. Bump it by hand when the
 * words change.
 */
export const UPDATED = "20 August 2026";

/**
 * The no-questions refund window, in days from the first payment.
 *
 * Quoted by the refunds page and by the terms, so the two cannot drift. Seven
 * is long enough to have actually used the paid tools and short enough that it
 * is not a free month.
 */
export const REFUND_DAYS = 7;

/** What the contact page promises, and therefore what has to be true. */
export const REPLY_DAYS = 2;

/**
 * The four pages, in the order they are listed in the footer.
 *
 * Exported so the footer and each page's own "see also" strip read from one
 * array — a legal page that cannot be reached from the others is a legal page
 * a reviewer will report as missing.
 */
export const LEGAL_PAGES = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/refunds", label: "Refunds" },
  { href: "/contact", label: "Contact" },
] as const;

import "server-only";

/**
 * Putting an email on the wire, and the one rule that governs it.
 *
 * **Mail is an addition to the invitation, never a dependency of it.** The row
 * in `book_members` is what grants access; the message is a convenience that
 * saves the owner a paste. So nothing in here throws and nothing in here is
 * awaited by anything that could fail because of it: every path resolves to a
 * `Sent`, the caller records what happened, and the dialog tells the truth
 * about it. An invitation that succeeded and then reported failure because a
 * mail provider had a bad minute would be the worst of both — the co-writer is
 * on the book, the owner believes they are not, and the seat is quietly spent.
 *
 * That is also why the link is still shown, always. Every product this is
 * measured against does both, and the two fail in different places: mail is
 * filtered, delayed and mistyped; a link needs a channel to travel down.
 *
 * **Configured or not, the same shape as everything else here.** No
 * `RESEND_API_KEY` and this answers `{ sent: false, reason: "not-configured" }`
 * rather than throwing — the same degradation the assistant, the two audio
 * routes and both payment gateways take. A self-hosted copy with no mail
 * provider goes on working exactly as this feature did before mail existed.
 *
 * **Resend is the provider because it is the only one.** Vercel's marketplace
 * lists exactly one messaging integration (`resend/resend-email`), so there was
 * no choice to agonise over; it is reached over its REST API rather than
 * through its SDK, for the reason `ai.ts` writes Gemini out by hand — the whole
 * of what we do is one POST, and a dependency for that is a dependency to keep
 * patched, audit and eventually remove.
 */

/**
 * Where a sent message came from.
 *
 * **`RESEND_EMAIL_DOMAIN` is the integration's own variable**, written by
 * `vercel integration add resend/resend-email` alongside the key, so the
 * sending domain is read from the thing that provisioned it rather than
 * repeated here. That matters on the day somebody changes the domain in the
 * Resend dashboard: one variable moves and this follows, where a second copy
 * would sit there being wrong until the first bounce.
 *
 * `RESEND_FROM` overrides it whole, for the case the local part or the display
 * name needs to be something other than the default — and a deployment with
 * neither falls back to a literal, which cannot send but also cannot crash a
 * module load.
 *
 * A note for whoever changes this: the domain must be **verified in Resend**
 * (DKIM and SPF on DNS) or every send is refused. Resend's own guidance is to
 * use a *subdomain* — `mail.` or `send.` — rather than the apex, so that the
 * sending reputation is isolated and so that adding SPF here cannot collide
 * with an SPF record the apex already carries for ordinary business mail. The
 * apex is what was provisioned; moving to a subdomain is this one variable
 * plus a second domain in the Resend dashboard.
 */
const DOMAIN = process.env.RESEND_EMAIL_DOMAIN ?? "openchapterapp.com";
const FROM = process.env.RESEND_FROM ?? `OpenChapter <invites@${DOMAIN}>`;

export type SendReason =
  /** No API key. The feature is simply not switched on here. */
  | "not-configured"
  /** Resend refused it — bad key, unverified domain, rejected address. */
  | "refused"
  /** The request itself failed: DNS, a timeout, the provider being down. */
  | "unreachable";

export interface Sent {
  sent: boolean;
  reason?: SendReason;
  /** Whatever the provider said, for the server log. Never shown to a writer. */
  detail?: string;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export interface Message {
  to: string;
  subject: string;
  html: string;
  text: string;
  /**
   * Where a reply goes.
   *
   * **Never the `from`.** The temptation is to send as the owner so the mail
   * looks personal; doing it fails DKIM and DMARC for their domain and lands
   * the whole thing in spam — or gets our sending domain flagged for spoofing.
   * The way every product does this is to send from their own verified domain
   * with the person's *name* in the display name, and point replies at them.
   * So "Ada Vance (via OpenChapter)" in `from`, and their real address here.
   */
  replyTo?: string;
  /** The display name to put in front of our address. */
  fromName?: string;
  /**
   * A key that makes a repeated send harmless.
   *
   * **This is the one Resend gotcha that costs a real person something.** A
   * Server Action is an HTTP request: a double-clicked button, a flaky
   * connection the browser retries, or React replaying the action all arrive
   * here as a second identical send — and the recipient gets the same
   * invitation twice from somebody who pressed once. With a key, Resend
   * returns the original response instead of sending again.
   *
   * Resend's own convention is `<event-type>/<entity-id>`, capped at 256
   * characters and remembered for 24 hours. The invitation token is the ideal
   * entity id: it is generated per invitation, so a genuine second invitation
   * to the same person — after the first expired, say — carries a different
   * token and is correctly sent.
   *
   * One trap worth knowing: the *same* key with a *different* payload is a
   * 409, not a resend. That is fine here, because the key is derived from the
   * token the payload is built around.
   */
  idempotencyKey?: string;
}

/**
 * Send one message. Resolves either way; never throws.
 *
 * The timeout is not optional. This is awaited inside a Server Action that a
 * writer is watching a spinner for, and a provider that accepts the connection
 * and then stalls would hang the invitation UI on a step that does not matter.
 * Ten seconds is far longer than a healthy API call and far shorter than a
 * writer's patience.
 */
export async function sendEmail(message: Message): Promise<Sent> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: "not-configured" };

  const from = message.fromName
    ? `${sanitizeName(message.fromName)} <${addressOf(FROM)}>`
    : FROM;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(message.idempotencyKey
          ? { "Idempotency-Key": message.idempotencyKey.slice(0, 256) }
          : {}),
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      /* Resend's default rate limit is 2 requests a second, so a burst of
         invitations can meet a 429 — which, unlike a 403 for an unverified
         domain, would have succeeded a moment later. Both come back as
         `refused` because the writer's next step is the same either way (send
         them the link), but the status is kept in `detail` so the log says
         which happened rather than leaving somebody to guess. */
      return {
        sent: false,
        reason: "refused",
        detail: `${response.status} ${detail}`.slice(0, 500),
      };
    }

    return { sent: true };
  } catch (err) {
    return {
      sent: false,
      reason: "unreachable",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/** The address out of `Name <addr>`, or the whole string if it is bare. */
function addressOf(from: string): string {
  const match = /<([^>]+)>/.exec(from);
  return match ? match[1] : from;
}

/**
 * A display name that cannot break out of the header.
 *
 * This is somebody's `user_metadata`, written by an identity provider and
 * never type-checked. A `<` in it would close our own address and a newline
 * would inject a header — the oldest trick there is against a mail API, and
 * the reason this is not a template literal on its own.
 */
function sanitizeName(name: string): string {
  const clean = name.replace(/[<>\r\n"]/g, "").trim();
  return clean.length > 0 ? `${clean} (via OpenChapter)` : "OpenChapter";
}

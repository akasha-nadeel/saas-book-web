import { INVITE_DAYS, type CollabRole } from "@/lib/collab";

/**
 * The invitation email, composed and nothing else.
 *
 * Pure and tested, like every other piece of thinking in this app: what leaves
 * the building is a paragraph somebody will read in an inbox they did not ask
 * to hear from, and the one way to keep that honest is to be able to assert
 * what it says. Sending is `send.ts`'s job and it knows nothing about wording.
 *
 * **Why there is an email at all.** For its whole life this feature copied a
 * link and said, in the dialog and in `CLAUDE.md`, that nothing was sent — the
 * invitation also surfaced in the invitee's own Collaborators area, so an
 * invited writer who happened to sign in would find it. That is the half of
 * the promise that never worked: somebody who does not yet have an account has
 * no dashboard to find it in, and the owner is left pasting a URL into
 * WhatsApp. Every product this is measured against — Google Docs, Figma,
 * Notion, Dropbox, GitHub — sends the mail *and* offers the link, never one or
 * the other, because the two fail in different places.
 *
 * Four things about what is written here are load-bearing.
 *
 * **The link is a pointer, not a credential, and that is what makes emailing
 * it safe.** `/invite/[token]` sits behind the sign-in wall and `acceptInvite`
 * refuses anybody whose *confirmed* address is not the invited one. So a
 * forwarded message, a mail server keeping a copy, or a shoulder-read on a
 * train grants nothing. Were the token a bearer credential this feature could
 * not exist in an email at all.
 *
 * **It never claims more than it knows.** The role is stated in the invitee's
 * terms rather than ours — "edit the manuscript" instead of `editor` — and the
 * expiry is printed, because a link that dies in a fortnight and does not say
 * so is a support request waiting to happen.
 *
 * **The owner's own words are quoted, never merged.** `message` is rendered as
 * a distinct block above the button, attributed, and HTML-escaped. An optional
 * note is what Google Docs, Figma and Dropbox all offer and it is the single
 * biggest thing standing between this and the spam folder — but it is somebody
 * else's text arriving in a third party's inbox, so it is quoted like evidence
 * rather than folded into our sentences.
 *
 * **Both parts are written, not one.** `text` is not a fallback nobody reads:
 * it is what a screen reader, a plain-text client and every spam filter worth
 * anything actually judges, and an HTML-only message scores badly on all
 * three.
 */
export interface InviteEmail {
  subject: string;
  html: string;
  text: string;
}

export interface InviteDetails {
  /** The book being shared. */
  bookTitle: string;
  /** What the owner is called, where anything is known. Falls back to their address. */
  inviterName: string | null;
  /** The owner's address, for the attribution and the Reply-To. */
  inviterEmail: string;
  role: CollabRole;
  /** Absolute — a relative path in an inbox is a dead link. */
  link: string;
  /** The owner's optional note. Blank and absent are the same thing. */
  message?: string | null;
}

/**
 * What each role may do, said as the invitee would say it.
 *
 * The two words the app uses internally are precise and mean nothing to
 * somebody who has never seen this product. There is deliberately no third
 * rung — see `collab.ts` for why a "commenter" that cannot comment is worse
 * than no commenter at all.
 */
const ROLE_LINE: Record<CollabRole, string> = {
  editor: "write and edit the manuscript",
  viewer: "read the manuscript and export it",
};

/** Who to say it is from, preferring a name over an address. */
export function inviterLabel(details: InviteDetails): string {
  const name = details.inviterName?.trim();
  return name && name.length > 0 ? name : details.inviterEmail;
}

/**
 * Escape a string for HTML.
 *
 * Every interpolation below goes through this, and the reason is not
 * hypothetical: the book title, the owner's display name and the owner's note
 * are all free text a stranger will receive. `user_metadata` in particular is
 * written by identity providers and has never been type-checked, let alone
 * sanitised. An unescaped `<` in a book title is a broken email; an unescaped
 * `<a>` in a display name is a phishing link sent under our domain.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The subject line.
 *
 * The book's name is in it because that is what the recipient recognises, and
 * the inviter's name because that is what makes it not look like a robot. No
 * "Action required", no "You've been invited!", no exclamation mark: those are
 * the marks of the mail this one has to be told apart from.
 */
export function inviteSubject(details: InviteDetails): string {
  return `${inviterLabel(details)} shared “${details.bookTitle}” with you`;
}

export function inviteEmail(details: InviteDetails): InviteEmail {
  const who = inviterLabel(details);
  const can = ROLE_LINE[details.role];
  const note = details.message?.trim();

  const text = [
    `${who} (${details.inviterEmail}) has shared a book with you on OpenChapter.`,
    "",
    `Book: ${details.bookTitle}`,
    `You can: ${can}`,
    ...(note
      ? ["", `${who} wrote:`, ...note.split("\n").map((l) => `  ${l}`)]
      : []),
    "",
    "Open it here:",
    details.link,
    "",
    `This invitation lasts ${INVITE_DAYS} days. It only works for this email address —`,
    "you will be asked to sign in as it before the book appears on your shelf.",
    "",
    "If you were not expecting this, you can ignore it. Nothing has been shared",
    "with anyone else, and no account has been made for you.",
    "",
    "OpenChapter — write and publish your book",
  ].join("\n");

  /*
   * **Written to the rules email actually has, not the ones a browser has.**
   *
   * Gmail strips `<style>`, Outlook renders through Word, and no client can be
   * relied on for flexbox, custom properties or modern selectors. So: inline
   * styles throughout, one 600px column (the width every client is tuned for),
   * a table only where Outlook needs one, and the palette written out as
   * literals — a `var(--color-accent)` resolves to nothing in an inbox.
   *
   * **Five accessibility rules, and every one of them was broken by the first
   * version of this template**, which is why they are listed rather than
   * assumed:
   *
   * - **`lang` and `dir` twice** — on `<html>` *and* on the body's direct
   *   child, because several clients strip them from `<html>`. This is the
   *   commonest accessibility failure in production email.
   * - **A `<title>`** naming the email rather than the brand: several clients
   *   and screen readers read it before anything else, and it is what shows
   *   when the message is opened as a web page.
   * - **No bare URL as link text.** A screen-reader user navigating by link
   *   text hears a 64-character token read out. The button carries the
   *   descriptive link; the URL below it is *plain text*, present only because
   *   it has to be copyable when a button cannot be pressed.
   * - **A preheader** — the hidden line a client shows beside the subject in
   *   the list. Without one it grabs whatever text comes first, which here was
   *   the word "OpenChapter": a wasted line in the one place the recipient
   *   decides whether to open it at all.
   * - **16px body type and a ~48px button.** Both are the documented floors;
   *   14px body is the commonest reason a transactional email is hard to read
   *   on a phone.
   *
   * **The book is drawn, not fetched, and that is a decision rather than a
   * shortcut.** A cover thumbnail would be the obvious thing to put here and
   * it cannot be done honestly: the artwork lives in the writer's own browser,
   * the synced copy sits behind auth, and a public URL for somebody's
   * unpublished cover is a leak — of the book's existence, to anyone who
   * guesses the address. Remote images are also blocked by default in most
   * clients, so it would be an empty box on first open, which is the one
   * moment that matters. What is drawn instead is the same typeset face the
   * app gives a book with no artwork: a 2:3 block with the title set in it, in
   * nothing but a div and a background, which every client can render and
   * nothing can fail to load.
   */
  const initial = escapeHtml((who.trim()[0] ?? "?").toUpperCase());

  /* The preheader's padding. A run of zero-width entities after the sentence,
     so the client stops pulling visible copy in behind it — without this the
     preview reads "…lasts 14 days. OpenChapter You have been invited". */
  const padding = "&#8199;&#65279;&#847; ".repeat(30);

  const html = `<!doctype html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<!-- Both, so a client that forces dark mode derives its colours from ours
     rather than inverting the whole message to something nobody chose. -->
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<title>${escapeHtml(inviteSubject(details))}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;">
<div lang="en" dir="ltr" style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#17171a;">

  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    ${escapeHtml(`${who} wants you on “${details.bookTitle}”. The invitation lasts ${INVITE_DAYS} days.`)}
    ${padding}
  </div>

  <div style="padding:24px 12px;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e2e5;border-radius:12px;overflow:hidden;">

      <!-- The wordmark in type rather than a logo image: an image is blocked
           by default on first open, and this is the line that says who the
           mail is from. -->
      <div style="padding:24px 32px 0;">
        <span style="font-size:15px;font-weight:700;letter-spacing:-0.01em;color:#17171a;">Open<span style="color:#423ead;">Chapter</span></span>
      </div>

      <div style="padding:20px 32px 32px;">

        <div style="margin:0 0 20px;">
          <span style="display:inline-block;width:36px;height:36px;line-height:36px;border-radius:18px;background:#eeeefb;color:#312e81;font-size:15px;font-weight:700;text-align:center;vertical-align:middle;">${initial}</span>
          <span style="display:inline-block;vertical-align:middle;padding-left:12px;font-size:15px;color:#62626b;">
            <strong style="color:#17171a;font-weight:600;">${escapeHtml(who)}</strong><br />
            <span style="font-size:13px;">${escapeHtml(details.inviterEmail)}</span>
          </span>
        </div>

        <h1 style="margin:0 0 20px;font-size:24px;line-height:1.3;font-weight:700;color:#17171a;">
          You have been invited to a book
        </h1>

        <!-- The book itself: a drawn face beside its title, so the thing being
             shared is the thing the eye lands on. -->
        <div style="margin:0 0 24px;padding:16px;background:#fafafa;border:1px solid #e9e9ec;border-radius:10px;">
          <div style="display:inline-block;width:56px;height:84px;background:#2e2e2e;border-radius:2px 5px 5px 2px;vertical-align:middle;text-align:center;overflow:hidden;">
            <span style="display:block;padding:12px 6px 0;font-family:Georgia,'Times New Roman',serif;font-size:9px;line-height:1.3;color:#ededed;">${escapeHtml(details.bookTitle.slice(0, 40))}</span>
          </div>
          <div style="display:inline-block;vertical-align:middle;padding-left:16px;max-width:400px;">
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;line-height:1.3;font-weight:700;color:#17171a;">${escapeHtml(details.bookTitle)}</div>
            <div style="margin-top:6px;font-size:15px;line-height:1.5;color:#62626b;">You can ${escapeHtml(can)}.</div>
          </div>
        </div>
${
  note
    ? `
        <blockquote style="margin:0 0 24px;padding:14px 18px;border-left:3px solid #d8d8f4;background:#f7f7fb;font-size:16px;line-height:1.6;color:#17171a;">
          ${escapeHtml(note).replace(/\n/g, "<br />")}
          <span style="display:block;margin-top:10px;font-size:13px;color:#62626b;">— ${escapeHtml(who)}</span>
        </blockquote>`
    : ""
}
        <!-- A table, because Outlook's Word engine will not give a padded
             anchor a reliable box. It is marked presentational so a screen
             reader does not announce a one-cell table around the button. -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
          <tr>
            <td style="background:#312e81;border-radius:8px;">
              <a href="${escapeHtml(details.link)}" style="display:inline-block;padding:15px 30px;font-size:16px;font-weight:600;line-height:1;color:#ffffff;text-decoration:none;">Open the book</a>
            </td>
          </tr>
        </table>

        <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#62626b;">
          If the button does not work, copy this address into your browser:
        </p>
        <p style="margin:0 0 28px;font-size:13px;line-height:1.6;color:#62626b;word-break:break-all;">
          ${escapeHtml(details.link)}
        </p>

        <div style="border-top:1px solid #e9e9ec;padding-top:20px;">
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#62626b;">
            This invitation lasts ${INVITE_DAYS} days and only works for this
            email address — you will be asked to sign in as it before the book
            appears on your shelf.
          </p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#62626b;">
            If you were not expecting this you can ignore it. Nothing has been
            shared with anyone else, and no account has been made for you.
          </p>
        </div>
      </div>
    </div>

    <!-- Who sent it and why, where a reader looks to check. No unsubscribe
         link: this is transactional — a named person asked for it — and
         offering to unsubscribe from invitations would be offering to break
         the feature. -->
    <div style="max-width:600px;margin:16px auto 0;text-align:center;">
      <p style="margin:0;font-size:12px;line-height:1.6;color:#8a8a92;">
        Sent by OpenChapter because ${escapeHtml(who)} invited you to a book.<br />
        openchapterapp.com
      </p>
    </div>
  </div>
</div>
</body></html>`;

  return { subject: inviteSubject(details), html, text };
}

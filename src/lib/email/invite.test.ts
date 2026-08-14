import { describe, expect, it } from "vitest";
import { INVITE_DAYS } from "@/lib/collab";
import {
  escapeHtml,
  inviteEmail,
  inviteSubject,
  inviterLabel,
  type InviteDetails,
} from "@/lib/email/invite";

const base: InviteDetails = {
  bookTitle: "The Salt Road",
  inviterName: "Ada Vance",
  inviterEmail: "ada@example.com",
  role: "editor",
  link: "https://openchapterapp.com/invite/abc123",
};

describe("inviterLabel", () => {
  it("prefers the name", () => {
    expect(inviterLabel(base)).toBe("Ada Vance");
  });

  /* An email signup hands over no name at all — see `account.ts`, which is a
     chain of fallbacks for exactly this reason. "null shared a book with you"
     is the failure this prevents. */
  it("falls back to the address when there is no name", () => {
    expect(inviterLabel({ ...base, inviterName: null })).toBe(
      "ada@example.com",
    );
    expect(inviterLabel({ ...base, inviterName: "   " })).toBe(
      "ada@example.com",
    );
  });
});

describe("inviteSubject", () => {
  it("names the person and the book", () => {
    expect(inviteSubject(base)).toBe(
      "Ada Vance shared “The Salt Road” with you",
    );
  });

  /* Not a style note. A subject line that shouts is the subject line of the
     mail this one has to be distinguished from, and these three marks are what
     a reader scans for when deciding whether something is bulk. */
  it("does not shout", () => {
    const subject = inviteSubject(base);
    expect(subject).not.toMatch(/!/);
    expect(subject).not.toMatch(/action required/i);
    expect(subject).not.toMatch(/invited!/i);
  });
});

describe("escapeHtml", () => {
  it("escapes every character that could close a tag or an attribute", () => {
    expect(escapeHtml(`<a href="x">&'`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;&amp;&#39;",
    );
  });

  /* The ampersand has to go first or every other replacement is re-escaped
     into `&amp;lt;`. Asserted because the ordering is invisible in the source. */
  it("does not double-escape", () => {
    expect(escapeHtml("a & b < c")).toBe("a &amp; b &lt; c");
  });
});

describe("inviteEmail", () => {
  it("carries the book, the role and the link in both parts", () => {
    const mail = inviteEmail(base);

    for (const part of [mail.html, mail.text]) {
      expect(part).toContain("The Salt Road");
      expect(part).toContain("https://openchapterapp.com/invite/abc123");
      expect(part).toContain("write and edit the manuscript");
    }
  });

  /* A plain-text part is not decoration: it is what a screen reader, a
     text-only client and most spam filters actually read, and an HTML-only
     message scores badly on all three. */
  it("writes a real plain-text part, not a stub", () => {
    const mail = inviteEmail(base);
    expect(mail.text.length).toBeGreaterThan(200);
    expect(mail.text).not.toContain("<");
  });

  it("says what a viewer may do, in the invitee's terms", () => {
    const mail = inviteEmail({ ...base, role: "viewer" });
    expect(mail.text).toContain("read the manuscript and export it");
    // Never the internal word, which means nothing to somebody outside.
    expect(mail.text).not.toMatch(/\brole\b/i);
  });

  /* The link dies in a fortnight. An invitation that does not say so is a
     support request waiting to happen, so both parts carry the number and it
     comes from the same constant the server enforces. */
  it("prints the expiry from the constant the server uses", () => {
    const mail = inviteEmail(base);
    expect(mail.text).toContain(`${INVITE_DAYS} days`);
    expect(mail.html).toContain(`${INVITE_DAYS} days`);
  });

  it("says the link only works for this address", () => {
    const mail = inviteEmail(base);
    expect(mail.text).toMatch(/only works for this email address/i);
  });

  describe("the owner's note", () => {
    it("is quoted and attributed when there is one", () => {
      const mail = inviteEmail({ ...base, message: "Chapter 9 needs you." });
      expect(mail.text).toContain("Chapter 9 needs you.");
      expect(mail.text).toContain("Ada Vance wrote:");
      expect(mail.html).toContain("blockquote");
    });

    /* Absent, empty and whitespace are one state. Without this an owner who
       tabbed through the field gets an empty quote block above the button. */
    it("leaves no empty quote behind", () => {
      for (const message of [undefined, null, "", "   \n  "]) {
        const mail = inviteEmail({ ...base, message });
        expect(mail.html).not.toContain("blockquote");
        expect(mail.text).not.toContain("wrote:");
      }
    });

    /*
     * The one that matters. All three of these are free text that reaches a
     * stranger's inbox under our own domain and our own DKIM signature: a book
     * title the owner typed, a display name an identity provider wrote and
     * never type-checked, and a note the owner composed. An unescaped anchor
     * in any of them is a phishing link we signed.
     */
    it("escapes the note, the title and the name", () => {
      const mail = inviteEmail({
        ...base,
        bookTitle: `<img src=x onerror="alert(1)">`,
        inviterName: `<b>Ada</b>`,
        message: `<a href="https://evil.example">click me</a>`,
      });

      expect(mail.html).not.toContain("<img");
      expect(mail.html).not.toContain("<b>Ada</b>");
      expect(mail.html).not.toContain(`<a href="https://evil.example"`);
      expect(mail.html).toContain("&lt;img");
    });

    /* A note is written with the Enter key. Collapsed to one line it reads as
       though the owner could not be bothered. */
    it("keeps the note's line breaks in the HTML", () => {
      const mail = inviteEmail({ ...base, message: "One.\nTwo." });
      expect(mail.html).toContain("One.<br />Two.");
    });
  });

  /* The whole reason it is safe to put this link in an email. If the token
     were a bearer credential, a forwarded message would hand over somebody's
     manuscript — so the mail states the condition that makes it not one, and
     this test is here to fail if that sentence is ever cut. */
  it("says signing in as the invited address is required", () => {
    const mail = inviteEmail(base);
    expect(mail.text).toMatch(/sign in as it/i);
    expect(mail.html).toMatch(/sign in as it/i);
  });

  it("tells an unexpecting recipient that nothing happened", () => {
    const mail = inviteEmail(base);
    expect(mail.text).toMatch(/no account has been made for you/i);
  });
});

/*
 * The mechanical accessibility and deliverability rules.
 *
 * Every one of these was broken by the first version of this template, which
 * is exactly why they are asserted rather than trusted to a careful eye: none
 * of them is visible when the email looks fine in a preview.
 */
describe("the rules email actually has", () => {
  const mail = inviteEmail(base);

  it("sets lang and dir on <html> *and* on the body's child", () => {
    expect(mail.html).toContain('<html lang="en" dir="ltr">');
    // The one that matters: several clients strip the attributes from <html>,
    // so the body's direct child has to carry them too.
    expect(mail.html).toMatch(/<div lang="en" dir="ltr"/);
  });

  it("carries a <title> naming the email rather than the brand", () => {
    expect(mail.html).toContain(`<title>${inviteSubject(base)}</title>`);
    expect(mail.html).not.toContain("<title>OpenChapter</title>");
  });

  /* The hidden line the inbox list shows beside the subject. Without one the
     client grabs the first visible text, which was the wordmark. */
  it("opens with a preheader", () => {
    const preheader = mail.html.indexOf("display:none;max-height:0");
    const body = mail.html.indexOf("<h1");
    expect(preheader).toBeGreaterThan(-1);
    expect(preheader).toBeLessThan(body);
    expect(mail.html).toContain("The Salt Road");
  });

  /* A screen-reader user navigating by link text would otherwise hear a
     64-character token read out. The URL stays *visible* — it has to be
     copyable — but it is not the anchor. */
  it("never uses the bare URL as link text", () => {
    const anchors = [...mail.html.matchAll(/<a [^>]*>([\s\S]*?)<\/a>/g)].map(
      (m) => m[1].trim(),
    );
    expect(anchors.length).toBeGreaterThan(0);
    for (const text of anchors) {
      expect(text).not.toContain("http");
      expect(text.length).toBeGreaterThan(3);
    }
    // Still present as plain text, or a blocked button strands the reader.
    expect(mail.html).toContain(base.link);
  });

  it("marks the layout table presentational", () => {
    for (const table of mail.html.match(/<table[^>]*>/g) ?? []) {
      expect(table).toContain('role="presentation"');
    }
  });

  it("declares both colour schemes, so a dark client derives ours", () => {
    expect(mail.html).toContain('name="color-scheme"');
    expect(mail.html).toContain('name="supported-color-schemes"');
  });

  /* 16px body and a ~48px tap target are the documented floors. 14px body is
     the commonest reason a transactional email is hard to read on a phone. */
  it("gives the button a 16px label and real padding", () => {
    expect(mail.html).toMatch(/padding:15px 30px;font-size:16px/);
  });

  it("says who sent it and why, at the foot", () => {
    expect(mail.html).toMatch(/Sent by OpenChapter because/);
  });

  /* Transactional, not marketing: a named person asked for this. Offering to
     unsubscribe from invitations would be offering to break the feature.
     Asserted against the *links* rather than the word, because the template's
     own comment explains the decision and says the word to do it. */
  it("carries no unsubscribe link", () => {
    const anchors = [...mail.html.matchAll(/<a [^>]*>([\s\S]*?)<\/a>/g)];
    for (const [whole] of anchors) {
      expect(whole.toLowerCase()).not.toContain("unsubscribe");
      expect(whole.toLowerCase()).not.toContain("opt out");
    }
  });

  /* The book is the thing being shared, so it is drawn rather than fetched —
     see the note in `invite.ts`. A remote image would be blocked on first
     open, and a public URL for an unpublished cover would leak it. */
  it("draws the book rather than linking a cover image", () => {
    expect(mail.html).not.toMatch(/<img/);
    // The title is set twice: once in the drawn face, once beside it.
    const shown = mail.html.split("The Salt Road").length - 1;
    expect(shown).toBeGreaterThanOrEqual(2);
  });
});

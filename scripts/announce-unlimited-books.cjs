// One email to every OpenChapter account: unlimited books are now free on
// every plan (2026-10-13). A one-off, like `apify-amazon-test.cjs`.
//
//   node scripts/announce-unlimited-books.cjs          dry run (the default)
//   node scripts/announce-unlimited-books.cjs --send   sends it
//
// The dry run prints how many accounts would get it — never an address — and
// writes the email itself, as HTML and as text, to the system temp folder
// (`openchapter-announce`) so it can be read before anything goes out.
//
// **Who gets it**: every account with a confirmed email address, once. Read
// through Supabase's admin API with SUPABASE_SECRET_KEY, which is why this runs
// on the owner's machine and is not a route anybody could call.
//
// **Once means once.** Each message carries Resend's idempotency key
// `unlimited-books-2026-10/<user id>`, and every id that was accepted is
// written to `sent.json` in the same temp folder, so a run that stops halfway
// can be run again and skips everyone already sent to.
//
// **Plain on purpose**: no tracking pixel, no tracked links, a reply goes to a
// person, and the footer says why the email came and that there is no
// newsletter. /privacy says we email about changes to an account's plan.
//
// Reads the keys from .env.local and never prints them.

const fs = require("fs");
const path = require("path");
const os = require("os");

const SEND = process.argv.includes("--send");
const NOTICE = "unlimited-books-2026-10";
const SITE = process.env.OPENCHAPTER_SITE ?? "https://openchapterapp.com";
const CONTACT = "contact@openchapterapp.com";
const OUT = path.join(os.tmpdir(), "openchapter-announce");
const SENT_LOG = path.join(OUT, "sent.json");
/** Resend's free plan takes 2 requests a second. */
const GAP_MS = 600;

function readEnv() {
  const file = path.join(__dirname, "..", ".env.local");
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = { ...readEnv(), ...process.env };
const SUPABASE_URL = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, "");
const SECRET = env.SUPABASE_SECRET_KEY ?? "";
const RESEND = env.RESEND_API_KEY ?? "";
const DOMAIN = env.RESEND_EMAIL_DOMAIN ?? "openchapterapp.com";
const FROM = `OpenChapter <hello@${DOMAIN}>`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function listUsers() {
  const users = [];
  for (let page = 1; page < 100; page++) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` },
    });
    if (!res.ok) throw new Error(`Supabase answered ${res.status} listing users`);
    const body = await res.json();
    const batch = Array.isArray(body.users) ? body.users : [];
    users.push(...batch);
    if (batch.length < 200) break;
  }
  return users;
}

/** Confirmed addresses only, one message per address. */
function recipients(users) {
  const byEmail = new Map();
  for (const u of users) {
    const email = typeof u.email === "string" ? u.email.trim().toLowerCase() : "";
    if (!email || !u.email_confirmed_at) continue;
    if (!byEmail.has(email)) byEmail.set(email, { id: u.id, email });
  }
  return [...byEmail.values()];
}

const SUBJECT = "Unlimited books, free on every plan";

const TEXT = `Hello,

A short note about your OpenChapter account: every plan now holds as many books as you write, Free included. The three-book limit is gone.

Nothing else changed. Your books, your chapters and your exports are exactly where you left them, and Word, EPUB and PDF export stay free on every plan.

Start your next book: ${SITE}/book/new

Happy writing,
OpenChapter

—
You're getting this one-off email because you have an OpenChapter account. We don't send newsletters. Questions? Just reply, or write to ${CONTACT}. Privacy: ${SITE}/privacy
`;

const HTML = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f6f6f8;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d1d1f;">
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#6e6e73;">What's new</p>
    <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:normal;line-height:1.25;">Unlimited books, free.</h1>
    <p style="margin:0 0 14px;font-size:16px;line-height:1.6;">Every plan now holds as many books as you write, Free included. The three-book limit is gone.</p>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">Nothing else changed. Your books, your chapters and your exports are exactly where you left them, and Word, EPUB and PDF export stay free on every plan.</p>
    <p style="margin:0 0 32px;"><a href="${SITE}/book/new" style="display:inline-block;background:#4338ca;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:8px;">Start your next book</a></p>
    <p style="margin:0 0 28px;font-size:16px;line-height:1.6;">Happy writing,<br>OpenChapter</p>
    <hr style="border:none;border-top:1px solid #e5e5ea;margin:0 0 16px;">
    <p style="margin:0;font-size:12px;line-height:1.6;color:#6e6e73;">You're getting this one-off email because you have an OpenChapter account. We don't send newsletters. Questions? Just reply, or write to <a href="mailto:${CONTACT}" style="color:#6e6e73;">${CONTACT}</a>. <a href="${SITE}/privacy" style="color:#6e6e73;">Privacy</a></p>
  </div>
</body>
</html>`;

async function send(to, id) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `${NOTICE}/${id}`,
    },
    body: JSON.stringify({ from: FROM, to, reply_to: CONTACT, subject: SUBJECT, html: HTML, text: TEXT }),
  });
  return res.ok ? null : `${res.status} ${(await res.text()).slice(0, 200)}`;
}

(async () => {
  if (!SUPABASE_URL || !SECRET) {
    console.log("NO SUPABASE: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be in .env.local.");
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "email.html"), HTML);
  fs.writeFileSync(path.join(OUT, "email.txt"), `Subject: ${SUBJECT}\nFrom: ${FROM}\nReply-To: ${CONTACT}\n\n${TEXT}`);

  const users = await listUsers();
  const list = recipients(users);
  const sent = new Set(fs.existsSync(SENT_LOG) ? JSON.parse(fs.readFileSync(SENT_LOG, "utf8")) : []);
  const todo = list.filter((r) => !sent.has(r.id));

  console.log(`Accounts: ${users.length}. Confirmed addresses: ${list.length}. Already sent: ${list.length - todo.length}. To send: ${todo.length}.`);
  console.log(`The email is in ${OUT} (email.html, email.txt).`);

  if (!SEND) {
    console.log("Dry run: nothing was sent. Run again with --send to send it.");
    return;
  }
  if (!RESEND) {
    console.log("NO RESEND: RESEND_API_KEY must be in .env.local.");
    process.exit(1);
  }

  let ok = 0;
  const failed = [];
  for (const r of todo) {
    const error = await send(r.email, r.id);
    if (error) {
      failed.push({ id: r.id, error });
    } else {
      ok += 1;
      sent.add(r.id);
      fs.writeFileSync(SENT_LOG, JSON.stringify([...sent]));
    }
    await sleep(GAP_MS);
  }
  console.log(`Sent: ${ok}. Failed: ${failed.length}.`);
  for (const f of failed) console.log(`  failed for account ${f.id}: ${f.error}`);
})().catch((e) => {
  console.error("FAILED", e.message);
  process.exit(1);
});

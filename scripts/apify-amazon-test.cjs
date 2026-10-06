// RESULT ON 2026-10-06, before re-running this: Amazon's list, rank and price
// came back (30 per genre, not 50); the Kindle Unlimited field said "no" for
// all 60 books, including two Amazon shows as in Kindle Unlimited; the detail
// tool was stopped by Amazon's CAPTCHA and returned nothing. $0.40 spent.
// Details: docs/plans/2026-10-05-price-check-amazon-design.md.
//
// The free Apify test: can Amazon's own Kindle data be had, what fields does it
// really carry, and what does it cost out of the free $5? Changes nothing in the app.
//
// Run it with `node scripts/apify-amazon-test.cjs`. Plan and costs:
// docs/plans/2026-10-05-price-check-amazon-design.md.
//
// Reads APIFY_TOKEN from the project's .env.local and never prints it. Sends it
// as an Authorization header, never in a URL.
const fs = require("fs");
const path = require("path");
const os = require("os");
const ENV = path.join(__dirname, "..", ".env.local");
// Results go to the system temp folder, never into the repo.
const OUT = path.join(os.tmpdir(), "openchapter-apify-test");
fs.mkdirSync(OUT, { recursive: true });
const line = fs.readFileSync(ENV, "utf8").split(/\r?\n/).find((l) => /^APIFY_TOKEN=/.test(l));
const TOKEN = line ? line.slice("APIFY_TOKEN=".length).trim().replace(/^["']|["']$/g, "") : "";
if (!TOKEN) {
  console.log("NO KEY: add APIFY_TOKEN=... to .env.local first.");
  process.exit(2);
}

const API = "https://api.apify.com/v2";
const headers = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const GENRES = [
  { name: "Cozy Mystery", url: "https://www.amazon.com/gp/bestsellers/digital-text/6190476011", apple: 11259 },
  { name: "Contemporary Romance", url: "https://www.amazon.com/gp/bestsellers/digital-text/158568011", apple: 10057 },
];

async function api(method, p, body) {
  const res = await fetch(`${API}${p}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }
  if (!res.ok) throw new Error(`${method} ${p.split("?")[0]} -> ${res.status} ${text.slice(0, 300)}`);
  return json;
}

async function run(actor, input, { memory, maxCharge }) {
  const started = Date.now();
  let r = (await api("POST", `/acts/${actor}/runs?memory=${memory}&maxTotalChargeUsd=${maxCharge}&waitForFinish=240`, input)).data;
  while (["READY", "RUNNING"].includes(r.status) && Date.now() - started < 20 * 60 * 1000) {
    r = (await api("GET", `/actor-runs/${r.id}?waitForFinish=240`)).data;
  }
  const items = (await api("GET", `/datasets/${r.defaultDatasetId}/items?clean=true&format=json`)) ?? [];
  return { run: r, items, seconds: Math.round((Date.now() - started) / 1000) };
}

function coverage(items) {
  const keys = new Set();
  for (const it of items) Object.keys(it).forEach((k) => keys.add(k));
  const out = {};
  for (const k of keys) {
    out[k] = items.filter((it) => it[k] !== null && it[k] !== undefined && it[k] !== "").length;
  }
  return out;
}

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").slice(0, 4).join(" ");

(async () => {
  const report = { when: new Date().toISOString(), runs: [] };

  // Run 1: Amazon's Kindle top lists with Kindle Unlimited status. 50 per genre
  // keeps it near $0.60: $0.10 start at 1 GB, $0.005 per complete book.
  const r1 = await run(
    "conceivable_extension~kdp-market-intel-scraper",
    {
      mode: "category_snapshot",
      categoryUrls: GENRES.map((g) => g.url),
      marketplace: "amazon.com",
      maxResultsPerCategory: 50,
      proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] },
    },
    { memory: 1024, maxCharge: 0.8 },
  );
  report.runs.push({
    actor: "kdp-market-intel-scraper",
    status: r1.run.status,
    seconds: r1.seconds,
    items: r1.items.length,
    usageTotalUsd: r1.run.usageTotalUsd,
    chargedEventCounts: r1.run.chargedEventCounts,
    coverage: coverage(r1.items),
    sample: r1.items.slice(0, 3),
  });
  fs.writeFileSync(path.join(OUT, "apify-run1-items.json"), JSON.stringify(r1.items, null, 2));
  console.log("RUN1", r1.run.status, r1.items.length, "items in", r1.seconds, "s; platform usage $", r1.run.usageTotalUsd, "; events", JSON.stringify(r1.run.chargedEventCounts));
  console.log("RUN1 FIELDS", JSON.stringify(coverage(r1.items)));

  // Run 2: publisher, pages and date for 20 of those books, about $0.02.
  const asinOf = (it) => it.asin ?? it.ASIN ?? String(it.url ?? "").match(/\/dp\/([A-Z0-9]{10})/)?.[1];
  const urls = r1.items.map(asinOf).filter(Boolean).slice(0, 20).map((a) => `https://www.amazon.com/dp/${a}`);
  if (urls.length > 0) {
    const r2 = await run(
      "getascraper~kdp-book-niche-analyzer",
      // Apify request lists want { url } objects; bare strings are refused (400).
      { bookUrls: urls.map((url) => ({ url })), maxBooksPerKeyword: 20 },
      { memory: 256, maxCharge: 0.1 },
    );
    report.runs.push({
      actor: "kdp-book-niche-analyzer",
      status: r2.run.status,
      seconds: r2.seconds,
      items: r2.items.length,
      usageTotalUsd: r2.run.usageTotalUsd,
      chargedEventCounts: r2.run.chargedEventCounts,
      coverage: coverage(r2.items),
      sample: r2.items.slice(0, 2),
    });
    fs.writeFileSync(path.join(OUT, "apify-run2-items.json"), JSON.stringify(r2.items, null, 2));
    console.log("RUN2", r2.run.status, r2.items.length, "items in", r2.seconds, "s; platform usage $", r2.run.usageTotalUsd, "; events", JSON.stringify(r2.run.chargedEventCounts));
    console.log("RUN2 FIELDS", JSON.stringify(coverage(r2.items)));
  } else {
    console.log("RUN2 skipped: run 1 returned no book ids");
  }

  // Same book, two shops: does Amazon's price match Apple's?
  const matches = [];
  for (const g of GENRES) {
    const feed = await (await fetch(`https://itunes.apple.com/us/rss/toppaidebooks/limit=100/genre=${g.apple}/json`)).json();
    const apple = (feed.feed.entry || []).map((e) => ({ t: norm(e["im:name"].label), price: Number(e["im:price"].attributes.amount) }));
    for (const it of r1.items) {
      const t = norm(it.title ?? it.name);
      const hit = apple.find((a) => a.t && a.t === t);
      const amazonPrice = Number(it.price ?? it.kindlePrice ?? it.priceValue);
      if (hit && Number.isFinite(amazonPrice)) matches.push({ title: it.title ?? it.name, amazon: amazonPrice, apple: hit.price });
    }
  }
  report.priceCheck = { matched: matches.length, same: matches.filter((m) => Math.abs(m.amazon - m.apple) < 0.01).length, examples: matches.slice(0, 10) };
  console.log("SAME BOOK, BOTH SHOPS", report.priceCheck.matched, "matched,", report.priceCheck.same, "at the same price");

  const me = (await api("GET", "/users/me/limits")).data;
  report.credit = me?.current ?? me;
  console.log("ACCOUNT USAGE THIS CYCLE", JSON.stringify(me?.current ?? {}), "LIMIT", JSON.stringify(me?.limits?.maxMonthlyUsageUsd ?? null));

  fs.writeFileSync(path.join(OUT, "apify-report.json"), JSON.stringify(report, null, 2));
  console.log("REPORT saved");
})().catch((e) => {
  console.error("FAILED", e.message);
  process.exit(1);
});

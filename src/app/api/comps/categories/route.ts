import { hiddenLaunchApiResponse, launchFeatureEnabled } from "@/lib/launch-server";
import { askModel, ModelError, modelProvider } from "@/lib/ai";
import { requirePro } from "@/lib/billing/server";
import { KDP_CATEGORIES, MAX_PATHS, parseShelves } from "@/lib/comps/shelves";
import type { SubjectCount } from "@/lib/comps/subjects";

/**
 * Where a shop would file this book — translated from where a librarian files
 * the comparable ones.
 *
 * **This is a translation, not a lookup, and the difference is the whole
 * point.** Google Books and Open Library record what a *librarian* files a
 * book under. KDP asks for three categories out of *Amazon's own store tree*,
 * which is a different vocabulary, is not published anywhere we can read, and
 * replaced BISAC codes in 2023. Nobody can do that mapping with a table, which
 * is what makes it the second place in this cluster where a model earns its
 * cost.
 *
 * **Nothing here has read Amazon.** There is no scrape and no shop API: the
 * Product Advertising API shut down in May 2026 and its replacement needs ten
 * affiliate sales a month to keep, so the only way to quote a real Amazon
 * figure is to buy scraped data from a vendor. We do not, so the route never
 * claims a search volume, a competition score or a bestseller rank, and the
 * screen says these are candidates to confirm in the KDP selector.
 *
 * What is sent is **subject names and counts we already fetched publicly** —
 * no manuscript, no blurb. The prose that leaves this app leaves through
 * `/api/chat` and `/api/comps/rank`, and only on a press.
 */

export const maxDuration = 60;

const SYSTEM = `You translate library subject headings into the categories an
online bookshop would file a book under, for a self-publishing author filling
in Amazon KDP's category selector.

You will be given the subjects that comparable published books are filed under
by Google Books and Open Library, each with how many of those books carry it,
plus the writer's genre if they set one.

Suggest at most ${MAX_PATHS} category paths, best first, in the shape Amazon's
store tree uses — for example "Mystery, Thriller & Suspense > Mystery > Cozy"
or "Romance > Contemporary". KDP allows ${KDP_CATEGORIES}, so the writer will
choose from your list.

Rules:
- Prefer the deepest path you are confident the book genuinely belongs in. A
  broad category the book merely qualifies for is worth less than a narrow one
  it belongs in.
- Give a reason in one short sentence, naming what in the subjects led you
  there. "It is fiction" is not a reason.
- List which of the given subjects each path came from, using their exact
  names, in a "from" array.
- Do NOT give a search volume, a competition score, a bestseller rank, a
  difficulty or any other number. You have no data for any of them and an
  invented one would be worse than nothing.
- Do not claim a path exists in Amazon's tree today. You are proposing
  candidates for the writer to confirm in the selector.

Reply with JSON only:
{"shelves":[{"path":"<path>","reason":"<one sentence>","from":["<subject>"]}],
 "note":"<one sentence on what these have in common, or an empty string>"}`;

interface Incoming {
  subjects?: SubjectCount[];
  genre?: string;
}

export async function POST(request: Request) {
  if (!launchFeatureEnabled()) return hiddenLaunchApiResponse("Category suggestions");
  if (!modelProvider()) {
    return Response.json(
      {
        error:
          "No model is configured, so this is off. The subjects above are read without it.",
      },
      { status: 501 },
    );
  }

  // The proxy skips /api, so this route checks for itself — see the chat
  // route. With no accounts or no gateway configured this passes everyone.
  const denied = await requirePro({
    signIn: "Sign in to have these matched to a shop's categories.",
    upgrade: "Matching to a shop's own categories is part of Pro. The subjects above stay free.",
  });
  if (denied) return denied;

  let body: Incoming;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  // Narrowed here rather than trusted: this arrives from a browser, and the
  // counts are what the answer is re-attached to.
  const subjects = (Array.isArray(body.subjects) ? body.subjects : [])
    .filter(
      (s): s is SubjectCount =>
        typeof s?.name === "string" &&
        s.name.trim() !== "" &&
        typeof s.count === "number" &&
        Number.isFinite(s.count),
    )
    .slice(0, 20);

  if (subjects.length === 0) {
    return Response.json(
      { error: "Search for comparable books first — there is nothing to match." },
      { status: 400 },
    );
  }

  const genre = (body.genre ?? "").slice(0, 60).trim();
  const prompt = [
    genre ? `The writer's genre: ${genre}` : "The writer has not set a genre.",
    "Subjects the comparable books are filed under, with how many carry each:",
    subjects.map((s) => `- ${s.name} (${s.count})`).join("\n"),
  ].join("\n\n");

  try {
    // Generous, because on some models the thinking counts against this and a
    // budget that fits the answer still truncates it. See `Ask` in lib/ai.ts.
    const raw = await askModel({ system: SYSTEM, prompt, maxTokens: 3000 });

    // Parsed server-side so a malformed answer costs a 502 rather than a
    // broken list — and so the "counts are ours" rule is enforced where a
    // reader with devtools cannot reach it.
    const reading = parseShelves(raw, subjects);

    if (reading.shelves.length === 0) {
      return Response.json(
        {
          error:
            "Nothing came back that was worth showing. Try a search that describes the story rather than naming the genre.",
        },
        { status: 422 },
      );
    }

    return Response.json(reading);
  } catch (err) {
    if (err instanceof ModelError) {
      const status = err.kind === "auth" ? 401 : err.kind === "rate" ? 429 : 502;
      return Response.json({ error: err.message }, { status });
    }
    console.error("[comps/categories] request failed", err);
    return Response.json(
      { error: "That did not work. The subjects above are unaffected." },
      { status: 502 },
    );
  }
}

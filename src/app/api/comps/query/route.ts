import { hiddenLaunchApiResponse, launchFeatureEnabled } from "@/lib/launch-server";
import { NextResponse } from "next/server";
import { askModel, ModelError, modelProvider } from "@/lib/ai";
import { requirePro } from "@/lib/billing/server";
import { COMMON_SUBJECTS } from "@/lib/comps/common-subjects";
import { buildPrompt, parseQuery, SYSTEM } from "@/lib/comps/query";

/**
 * A writer's sentence, turned into a catalogue query — before the search, not
 * after it.
 *
 * **Why this is a route of its own**, like the ranking and the categories: the
 * search itself (`/api/comps`) is free, keyless and stays that way. Folding a
 * model into it would make the whole feature need a key and a plan for a step
 * most searches do not want — the shelf chips already send a proper query, and
 * a writer who types one themselves needs nothing translating.
 *
 * **What is sent is the words in the box and the genre they already chose.**
 * Not the manuscript, not the blurb. This is the cheapest of the three model
 * routes by a wide margin — one short sentence in, one line out.
 *
 * The reply is generated text and is parsed as hostile input; see `query.ts`.
 * The one rule worth repeating here is that a term with a prefix neither
 * catalogue takes is *dropped*, because Open Library answers an unknown prefix
 * with zero results rather than an error.
 */

export const maxDuration = 30;

/**
 * The shelves that actually exist, for checking the model's answer against.
 *
 * `common-subjects.ts` is Open Library's own headings with Open Library's own
 * counts — the catalogue's vocabulary rather than one of ours, which is what
 * makes it usable as a test of whether a shelf is real. Built once at module
 * scope: it is 900 strings and does not change between requests.
 *
 * It is a floor, not the whole language — a real heading outside these 900 is
 * dropped along with the invented ones. That costs a slightly looser search
 * and never costs a wrong one, which is the right direction to be wrong in.
 */
const REAL_SHELVES = new Set(
  COMMON_SUBJECTS.map((s) => s.name.trim().toLowerCase()),
);

/** One line out. Generous for Gemini, whose thinking counts against it. */
const MAX_TOKENS = 400;

/** A sentence, not a manuscript. Anything longer is a paste. */
const MAX_WORDS = 300;

export async function POST(request: Request) {
  if (!launchFeatureEnabled()) return hiddenLaunchApiResponse("Comp title query");
  const gate = await requirePro({
    signIn: "Sign in to have your words turned into a catalogue search.",
    upgrade: "Turning your words into a catalogue search is part of Pro.",
  });
  if (gate) return gate;

  if (!modelProvider()) {
    return NextResponse.json(
      {
        error:
          "No model is configured. Add ANTHROPIC_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY to .env.local and restart.",
      },
      { status: 501 },
    );
  }

  let body: { words?: unknown; genre?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nothing to read." }, { status: 400 });
  }

  const words =
    typeof body.words === "string" ? body.words.trim().slice(0, MAX_WORDS) : "";
  if (words.length < 2) {
    return NextResponse.json(
      { error: "Say a little more about the book." },
      { status: 400 },
    );
  }

  try {
    const reply = await askModel({
      system: SYSTEM,
      prompt: buildPrompt({
        words,
        genre: typeof body.genre === "string" ? body.genre : undefined,
      }),
      maxTokens: MAX_TOKENS,
    });

    const parsed = parseQuery(reply, REAL_SHELVES);

    /*
     * **A translation is only worth having if it names a real shelf.**
     *
     * Everything this route can add over the writer's own words is the
     * `subject:` term — the one thing they could not have written, because it
     * needs the catalogue's vocabulary. A reply with no verified shelf in it
     * has contributed nothing but rewording, and rewording somebody's search
     * without improving it is how the three failures found in testing all
     * happened:
     *
     *   - four terms ANDed to nothing, and the screen said the genre was empty
     *   - `subject:"Fantasy mystery"`, a shelf no catalogue has, which matched
     *     nothing and left "librarian" to return the catalogues of actual
     *     libraries, several from the 1890s
     *   - a line of this file's own prompt — "Use ONE subject term, quoted,
     *     naming the shelf the book belongs on" — echoed back and searched for
     *
     * The last one is the reason this is a rule rather than a nudge. Generated
     * text is hostile input; a parser that accepts anything shaped like words
     * will eventually search the instructions. Requiring a shelf that exists
     * in Open Library's own list is a test none of those three can pass.
     *
     * Null is not a failure. The caller runs the writer's words, which is what
     * would have happened without this route at all.
     */
    const query = parsed && /(^|\s)subject:/i.test(parsed) ? parsed : null;

    if (!query) {
      // Nothing usable came back. The caller searches the writer's own words,
      // which is what it would have done anyway — never an error on a path
      // that has a working fallback.
      return NextResponse.json({ query: null });
    }

    return NextResponse.json({ query });
  } catch (err) {
    if (err instanceof ModelError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.kind === "auth" ? 502 : err.kind === "rate" ? 429 : 502 },
      );
    }
    return NextResponse.json(
      { error: "That did not work. Try again in a moment." },
      { status: 502 },
    );
  }
}

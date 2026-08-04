import { NextResponse } from "next/server";
import { askModel, ModelError, modelProvider } from "@/lib/ai";
import { requirePro } from "@/lib/billing/server";
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

/** One line out. Generous for Gemini, whose thinking counts against it. */
const MAX_TOKENS = 400;

/** A sentence, not a manuscript. Anything longer is a paste. */
const MAX_WORDS = 300;

export async function POST(request: Request) {
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

    const query = parseQuery(reply);
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

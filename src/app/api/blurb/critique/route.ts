import { askModel, ModelError, modelProvider } from "@/lib/ai";
import { requirePro } from "@/lib/billing/server";
import {
  CRITIQUE_SYSTEM,
  MIN_BLURB,
  critiquePrompt,
  parseCritique,
} from "@/lib/blurb-critique";
import { BLURB_MAX } from "@/lib/publishing";

/**
 * What a reader would still be asking after the writer's own blurb.
 *
 * **The one model route in this app pointed at the writer's own words, and it
 * reports on them rather than replacing them.** The reasoning is in
 * `lib/blurb-critique.ts` and is worth reading before anybody adds a "write it
 * for me" field to this route: the stores permit a generated description —
 * Amazon's AI disclosure covers the manuscript, and the description is metadata
 * — so what stops us is that a generated blurb is generic exactly where a blurb
 * cannot afford to be, and that generating one honestly would mean sending the
 * whole book, which produces a synopsis with the ending in it.
 *
 * **No manuscript leaves here.** What is sent is the blurb the writer typed,
 * the title and the genre — words they entered into form fields, which is the
 * same category of thing `/api/comps` sends. That is why this route is not on
 * the short list of places prose can leave. Send a chapter from here and it
 * needs a line on the privacy page and a sentence above the button, like the
 * prose report has.
 */

export const maxDuration = 60;

interface Incoming {
  blurb?: unknown;
  title?: unknown;
  genre?: unknown;
}

const text = (value: unknown, cap: number) =>
  typeof value === "string" ? value.slice(0, cap).trim() : "";

export async function POST(request: Request) {
  if (!modelProvider()) {
    return Response.json(
      {
        error:
          "No model is configured, so this is off. The counts and the findings beside them are worked out without it.",
      },
      { status: 501 },
    );
  }

  // The proxy skips /api, so this route checks for itself — see the chat
  // route. With no accounts or no gateway configured this passes everyone.
  const denied = await requirePro({
    signIn: "Sign in to have a reader look at your blurb.",
    upgrade:
      "Having a reader look at your blurb is part of Pro. Writing it, the counts and the findings stay free.",
  });
  if (denied) return denied;

  let body: Incoming;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  // Capped at the shops' own limit rather than trusted: this arrives from a
  // browser, and nothing else bounds what a POST can carry.
  const blurb = text(body.blurb, BLURB_MAX);

  if (blurb.length < MIN_BLURB) {
    return Response.json(
      { error: "Write a little more first — there is not enough here to read." },
      { status: 400 },
    );
  }

  const prompt = critiquePrompt({
    blurb,
    title: text(body.title, 200),
    genre: text(body.genre, 60),
  });

  try {
    // Generous, because on some models the thinking counts against this and a
    // budget that fits the answer still truncates it. See `Ask` in lib/ai.ts.
    const raw = await askModel({
      system: CRITIQUE_SYSTEM,
      prompt,
      maxTokens: 2000,
    });

    // Parsed server-side so a malformed answer costs a 502 rather than a broken
    // list — and so the two rules that make this feature what it is, no score
    // and no replacement copy, are enforced where a reader with devtools cannot
    // reach them.
    const critique = parseCritique(raw);

    /*
     * An empty list is a real answer here, unlike everywhere else in this app
     * that talks to a model: the prompt says outright that an invented
     * complaint is worse than a short answer, so "nothing to add" has to be
     * allowed to arrive. The screen says which it was.
     */
    return Response.json(critique);
  } catch (err) {
    if (err instanceof ModelError) {
      const status = err.kind === "auth" ? 401 : err.kind === "rate" ? 429 : 502;
      return Response.json({ error: err.message }, { status });
    }
    console.error("[blurb/critique] request failed", err);
    return Response.json(
      { error: "That did not work. Your blurb is unaffected." },
      { status: 502 },
    );
  }
}

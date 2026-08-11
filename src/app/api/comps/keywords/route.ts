import { NextResponse } from "next/server";
import { askModel, ModelError, modelProvider } from "@/lib/ai";
import { requirePro } from "@/lib/billing/server";
import type { Listing } from "@/lib/keywords";
import {
  buildPrompt,
  MAX_TOKENS,
  suggestKeywords,
  SYSTEM,
} from "@/lib/keywords/suggest";

/**
 * Candidate keywords for the seven boxes, from what the writer already typed.
 *
 * **A route of its own, like the other three model steps around comps**, and
 * for the same reason: `/api/comps` and `/api/comps/subjects` are free and
 * keyless and must stay that way. Everything above the button on the
 * categories screen — the shelves, the counts, the checker — works with no key
 * and no plan; only this one press costs anything.
 *
 * **What is sent is the listing form's own fields.** The blurb, the genre, the
 * categories already chosen, and the title, author and series so the model can
 * avoid the words the shop indexes anyway. The manuscript does not go. That is
 * what keeps this route off the privacy page's list of places prose travels —
 * add a field here and it needs a line there in the same commit.
 *
 * **`requirePro()` stays on it although the first five are free.** The free
 * five are counted in the browser, which anybody can clear; the sixth press is
 * refused *here*, where they cannot. That is the split the whole free-limits
 * file rests on — the counter is a courtesy, the wall is server-side — and it
 * matters more on this route than on the others, because this is the first
 * limited feature whose every press spends money rather than a free catalogue
 * lookup.
 *
 * The reply is generated text and is parsed as hostile input; the filtering is
 * in `suggest.ts`, where every candidate goes through `keywordReport` before
 * anybody sees it.
 */

export const maxDuration = 30;

/** Guards a paste. The blurb is cut again inside `buildPrompt`. */
const MAX_BLURB = 4000;

/** More than the seven boxes could ever be shelved under. */
const MAX_CATEGORIES = 8;

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, max);
  return trimmed || undefined;
}

export async function POST(request: Request) {
  const gate = await requirePro({
    signIn: "Sign in to have keywords suggested for your book.",
    upgrade:
      "The free plan includes five sets of keyword suggestions, and yours are used. Pro has no limit.",
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

  let body: {
    blurb?: unknown;
    genre?: unknown;
    categories?: unknown;
    listing?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nothing to read." }, { status: 400 });
  }

  const raw = (body.listing ?? {}) as Record<string, unknown>;

  const blurb = text(body.blurb, MAX_BLURB);
  const genre = text(body.genre, 100);
  const categories = Array.isArray(body.categories)
    ? body.categories
        .filter((c): c is string => typeof c === "string" && c.trim().length > 0)
        .slice(0, MAX_CATEGORIES)
    : undefined;

  /*
   * The shelves ride in the listing as well as in the prompt, because the
   * prompt is a request and `keywordReport` is the guarantee: a phrase
   * repeating a category the book is already on is dropped by the filter
   * rather than trusted not to be written.
   */
  const listing: Listing = {
    title: text(raw.title, 300),
    subtitle: text(raw.subtitle, 300),
    author: text(raw.author, 200),
    series: text(raw.series, 200),
    categories,
  };

  /*
   * **A genre alone is not enough to be worth a model call.** Everything this
   * route can add over the writer's own guesses comes out of the description —
   * a genre and a title produce seven phrases any two books in that genre
   * would share, which is the generic output this feature would be justly
   * criticised for. Refusing here is cheaper than spending one of five
   * allowances on an answer nobody would keep.
   */
  if (!blurb || blurb.length < 40) {
    return NextResponse.json(
      {
        error:
          "Write the blurb first. Keyword suggestions are drawn from your description, and there is not enough of it yet.",
      },
      { status: 400 },
    );
  }

  try {
    const reply = await askModel({
      system: SYSTEM,
      prompt: buildPrompt({ blurb, genre, categories, listing }),
      maxTokens: MAX_TOKENS,
    });

    const keywords = suggestKeywords(reply, listing);

    /*
     * Nothing survived the filter. Answered as an empty list rather than an
     * error, because it is not one — the checker did its job — but the screen
     * has to tell the writer that plainly, and must not spend one of their
     * five on it.
     */
    return NextResponse.json({ keywords });
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

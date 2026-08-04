import { askModel, ModelError, modelProvider } from "@/lib/ai";
import { requirePro } from "@/lib/billing/server";
import type { CompTitle } from "@/lib/comps/comps";
import {
  candidatesFrom,
  MAX_BLURB,
  MAX_CANDIDATES,
  MAX_OPENING,
  MAX_PICKS,
  openingFrom,
  parseRanking,
} from "@/lib/comps/rank";

/**
 * The judgement half of comps: which of these are actually like your book.
 *
 * **Separate from `/api/comps` on purpose, and the split is the design.** That
 * one is free, needs no key, is cached for a day and stays that way. This one
 * costs money every time it runs. Putting them together would make the whole
 * feature unavailable without an API key and a plan, for the sake of a step
 * most searches do not need — and a feature that spends a model call to read a
 * page count is one that gets switched off when the invoice arrives.
 *
 * **This is the one route that sends prose.** The manuscript's opening goes
 * here, because voice is the thing a keyword search cannot judge and the
 * question is unanswerable without it. Three things keep that honest: it is
 * the *opening only*, capped at a couple of pages; it goes only when the
 * writer presses the button; and the screen lists exactly what leaves before
 * they press it. Same shape as the assistant and the feedback dialog.
 *
 * The cheap tier of whichever family is configured, rather than the
 * assistant's Opus. The assistant reasons about somebody's prose in an
 * open-ended conversation; this is a bounded classification over twenty short
 * records, which is what a small model is good at — and the cost of this
 * feature is the whole reason it took so long to build. Which provider answers
 * is `lib/ai.ts`'s business, not this route's.
 */

export const maxDuration = 120;

const SYSTEM = `You judge which published books are genuinely comparable to a
writer's unpublished one, for use in a query letter or a store listing.

A comparable title is a book a reader who liked theirs would also have bought:
same shelf, same register, same kind of reader. It is NOT a book that shares a
keyword, NOT a classic of the genre, and NOT a bestseller — an agent reads
"like Tolkien" as someone who has not looked.

You will be given the writer's blurb, the opening of their manuscript, and a
numbered list of candidates fetched from a catalogue search. Choose at most
${MAX_PICKS}, best first. Fewer is a good answer. None is a good answer when
none of them are close, and you should say so rather than filling the list.

Rules:
- Choose ONLY from the numbered candidates. Never name a book that is not in
  the list, and never invent one.
- Give a reason in one short sentence, naming the specific thing they share —
  register, structure, subject, the kind of reader. "Both are fantasy" is not
  a reason.
- Do not score, rate, grade or give a percentage. An order and a reason.
- Do not comment on the quality of the writer's prose. You are matching a
  shelf, not reviewing.

Reply with JSON only, in this shape:
{"picks":[{"id":<number>,"reason":"<one sentence>"}],
 "pattern":"<one or two sentences on what the chosen books have in common, or
 an empty string>"}`;

interface Incoming {
  blurb?: string;
  opening?: string;
  books?: CompTitle[];
}

export async function POST(request: Request) {
  if (!modelProvider()) {
    return Response.json(
      {
        error:
          "No model is configured, so ranking is off. The search above works without it.",
      },
      { status: 501 },
    );
  }

  // The proxy skips /api, so this route checks for itself — see the note in
  // the chat route. With no accounts or no gateway configured this passes
  // everyone, and a self-hosted copy on its owner's key behaves as before.
  const denied = await requirePro({
    signIn: "Sign in to have your comps ranked.",
    upgrade: "Ranking comps is part of Pro. The search itself stays free.",
  });
  if (denied) return denied;

  let body: Incoming;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  const books = Array.isArray(body.books)
    ? body.books.slice(0, MAX_CANDIDATES)
    : [];
  if (books.length === 0) {
    return Response.json(
      { error: "Search for comps first — there is nothing to rank." },
      { status: 400 },
    );
  }

  const blurb = (body.blurb ?? "").slice(0, MAX_BLURB).trim();
  const opening = openingFrom(body.opening ?? "", MAX_OPENING);
  if (!blurb && !opening) {
    return Response.json(
      {
        error:
          "There is nothing to judge against. Write a blurb, or open a chapter with some prose in it.",
      },
      { status: 400 },
    );
  }

  const prompt = [
    blurb ? `The writer's blurb:\n\n${blurb}` : "The writer has no blurb yet.",
    opening
      ? `The opening of their manuscript:\n\n${opening}`
      : "No manuscript prose was sent.",
    `Candidates:\n\n${JSON.stringify(candidatesFrom(books), null, 1)}`,
  ].join("\n\n---\n\n");

  try {
    // Generous, because on some models the thinking counts against this and a
    // budget that fits the answer still truncates it. See `Ask` in lib/ai.ts.
    const raw = await askModel({ system: SYSTEM, prompt, maxTokens: 4000 });

    // Parsed here rather than in the browser so a malformed answer costs a
    // 502 rather than a broken list — and so the "never a book we did not
    // fetch" rule is enforced on the side the reader cannot edit.
    const ranking = parseRanking(raw, books);

    if (ranking.picks.length === 0 && !ranking.pattern) {
      return Response.json(
        {
          error:
            "The model did not pick any of these. Try a search that describes the story rather than the genre.",
        },
        { status: 422 },
      );
    }

    return Response.json({
      // Keys rather than whole records: the browser already has the books.
      picks: ranking.picks.map((p) => ({ key: p.book.key, reason: p.reason })),
      pattern: ranking.pattern,
    });
  } catch (err) {
    if (err instanceof ModelError) {
      const status = err.kind === "auth" ? 401 : err.kind === "rate" ? 429 : 502;
      return Response.json({ error: err.message }, { status });
    }
    console.error("[comps/rank] request failed", err);
    return Response.json(
      { error: "The ranking is unavailable. The search above still works." },
      { status: 502 },
    );
  }
}

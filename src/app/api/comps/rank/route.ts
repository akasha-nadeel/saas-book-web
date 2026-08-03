import Anthropic from "@anthropic-ai/sdk";
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
 * Sonnet rather than the assistant's Opus. The assistant is reasoning about
 * somebody's prose in an open-ended conversation; this is a bounded
 * classification over twenty short records, which is what the cheaper model is
 * good at — and the cost of this feature is the whole reason it took this long
 * to build.
 */

export const maxDuration = 120;

const MODEL = "claude-sonnet-5";

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
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      {
        error:
          "No ANTHROPIC_API_KEY is set, so ranking is off. The search above works without it.",
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

  const client = new Anthropic();

  const prompt = [
    blurb ? `The writer's blurb:\n\n${blurb}` : "The writer has no blurb yet.",
    opening
      ? `The opening of their manuscript:\n\n${opening}`
      : "No manuscript prose was sent.",
    `Candidates:\n\n${JSON.stringify(candidatesFrom(books), null, 1)}`,
  ].join("\n\n---\n\n");

  try {
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");

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
    if (err instanceof Anthropic.AuthenticationError) {
      return Response.json(
        { error: "That ANTHROPIC_API_KEY was rejected." },
        { status: 401 },
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return Response.json(
        { error: "Rate limited. Try again in a moment." },
        { status: 429 },
      );
    }
    console.error("[comps/rank] request failed", err);
    return Response.json(
      { error: "The ranking is unavailable. The search above still works." },
      { status: 502 },
    );
  }
}

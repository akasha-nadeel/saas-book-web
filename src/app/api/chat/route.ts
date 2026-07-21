import Anthropic from "@anthropic-ai/sdk";

/**
 * The assistant behind the editor's right-hand panel.
 *
 * This is the only part of OpenChapter that talks to a server. Everything else
 * is local, and the chapter text sent here is sent only when the writer opens
 * the panel and asks something.
 */

export const maxDuration = 300;

const MODEL = "claude-opus-4-8";

const SYSTEM = `You are a writing assistant inside a novel-drafting app, helping
with the chapter the writer currently has open.

Answer about their prose: continuations, alternatives, tightening, continuity
problems, whether a scene is landing. When they ask for prose, write in their
voice as it appears in the chapter — do not impose your own style, and do not
smooth away deliberate roughness.

Be concise. Lead with the thing they asked for rather than a preamble about
what you are about to do. If you have a reservation about a suggestion, say it
in a sentence; do not survey every option.

You cannot edit the document. Offer text for the writer to use, and say so
plainly if a request needs something you cannot see.`;

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      {
        error:
          "No ANTHROPIC_API_KEY is set. Add one to .env.local and restart the dev server.",
      },
      { status: 501 },
    );
  }

  let body: { messages?: IncomingMessage[]; chapter?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  const messages = (body.messages ?? []).filter(
    (m) => typeof m?.content === "string" && m.content.trim(),
  );
  if (messages.length === 0) {
    return Response.json({ error: "No message to answer." }, { status: 400 });
  }

  const client = new Anthropic();

  // The chapter goes in the system prompt rather than the conversation so it
  // stays put as the prefix while the exchange grows, which is what lets the
  // cache hold across turns.
  const chapter = (body.chapter ?? "").slice(0, 200_000);
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: SYSTEM },
    {
      type: "text",
      text: chapter
        ? `The chapter as it currently stands:\n\n${chapter}`
        : "The chapter is currently empty.",
      cache_control: { type: "ephemeral" },
    },
  ];

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      system,
      // Adaptive is the only on-mode on Opus 4.8, and it is off unless asked
      // for. Prose problems are worth thinking about.
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }

          const final = await stream.finalMessage();
          if (final.stop_reason === "refusal") {
            controller.enqueue(
              encoder.encode("\n\n[The assistant declined this request.]"),
            );
          }
        } catch (err) {
          console.error("[chat] stream failed", err);
          controller.enqueue(
            encoder.encode("\n\n[The reply was cut short by an error.]"),
          );
        } finally {
          controller.close();
        }
      },
      cancel() {
        // The writer closed the panel or asked something else. Stop paying for
        // tokens nobody will read.
        stream.abort();
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
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
    console.error("[chat] request failed", err);
    return Response.json({ error: "The assistant is unavailable." }, {
      status: 502,
    });
  }
}

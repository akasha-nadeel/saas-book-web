import Anthropic from "@anthropic-ai/sdk";

/**
 * One way to ask a model a question, whichever model is configured.
 *
 * The two comps routes want the same thing — a system prompt, one user
 * message, JSON back — and neither cares who answers. Putting that behind one
 * function is what lets the provider be a deployment decision rather than a
 * code change: set `ANTHROPIC_API_KEY` and it is Claude, set
 * `GOOGLE_GENERATIVE_AI_API_KEY` and it is Gemini, set both and Claude wins.
 *
 * **The assistant is here too, as of 2026-08-15.** It was not: `/api/chat`
 * streams, caches the chapter across turns and reasons about somebody's prose,
 * so it stayed on the Anthropic SDK directly and this file said in as many
 * words that it was for short, bounded, one-shot calls. What it also said was
 * where streaming would go if it were ever worth having — *"in `ai.ts` for both
 * providers rather than as a second Anthropic-only route"* — and the reason
 * arrived: an installation with only a Google key had sixteen tools, six model
 * routes and a dead assistant panel telling it to go and get an Anthropic key.
 * `streamModel` below is that, and `askModel` is unchanged.
 *
 * **Not the gateway either, and that is worth writing down.** Narration and
 * transcription go through Vercel's AI Gateway on `AI_GATEWAY_API_KEY`, which
 * would have been the tidier home for this too — one credential, `provider/model`
 * strings, switching providers by editing a string. It was tried and the
 * gateway refuses every request without a card on file, whatever the model. So
 * these two call the providers directly, and the shape below keeps the switch
 * cheap for whenever that changes.
 */

export type Provider = "anthropic" | "google";

/**
 * What each provider is asked by default, and there are two tiers because the
 * callers are two different jobs.
 *
 * **`task`** is the cheap, fast tier: bounded classification over a couple of
 * dozen short records, which is what the comps, categories, keyword and blurb
 * routes do.
 *
 * **`chat`** is the assistant, which is open-ended reasoning about somebody's
 * prose and the one place here worth a larger model. Keeping it a separate
 * entry is not tidiness — folding it in would have quietly moved the assistant
 * from Opus to Sonnet when it came through this file, since the route named its
 * own model before and `DEFAULTS` was written for the other callers.
 *
 * **Google is the same model in both tiers, deliberately.** The obvious move is
 * to name a Pro here, and the reason not to is that a wrong model id fails at
 * request time as a 404 on a screen that says the assistant is unavailable —
 * so this stays on the id the six working routes already prove is good, and
 * anyone wanting a bigger one names it themselves. Flash also streams quickly,
 * which suits a panel somebody is watching fill in.
 *
 * `OPENCHAPTER_MODEL` overrides the task tier and `OPENCHAPTER_CHAT_MODEL` the
 * assistant, so either can be tried without a deploy and without the other
 * moving.
 */
const DEFAULTS: Record<Tier, Record<Provider, string>> = {
  task: {
    anthropic: "claude-sonnet-5",
    google: "gemini-3.6-flash",
  },
  chat: {
    anthropic: "claude-opus-4-8",
    google: "gemini-3.6-flash",
  },
};

/** Which job the model is being asked to do — see `DEFAULTS`. */
export type Tier = "task" | "chat";

/** Which provider this deployment can use, or null for none. */
export function modelProvider(): Provider | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return "google";
  return null;
}

export function modelName(provider: Provider, tier: Tier = "task"): string {
  const override =
    tier === "chat"
      ? process.env.OPENCHAPTER_CHAT_MODEL
      : process.env.OPENCHAPTER_MODEL;
  return override || DEFAULTS[tier][provider];
}

/** What every caller here needs, and nothing else. */
export interface Ask {
  system: string;
  prompt: string;
  /**
   * A ceiling, not a target.
   *
   * Worth being generous with on Gemini 3, where **thinking tokens count
   * against it**: a budget that comfortably fits the answer still truncates
   * mid-sentence because the model spent it reasoning first. Measured — 800
   * returned `MAX_TOKENS` on a reply whose text was 34 tokens long. Turning
   * thinking off is not available either; `thinkingBudget: 0` is rejected
   * outright by that model.
   */
  maxTokens: number;
}

/** Raised when a provider answers with something that is not an answer. */
export class ModelError extends Error {
  constructor(
    message: string,
    /** Mapped from the provider's own status, so routes can answer in kind. */
    readonly kind: "auth" | "rate" | "other",
  ) {
    super(message);
    this.name = "ModelError";
  }
}

/**
 * Ask, and get the text back.
 *
 * Whatever comes out is generated text and is treated as hostile by the
 * parsers that read it — see `rank.ts` and `shelves.ts`. Nothing here tries to
 * validate the content; it only gets it out of the provider's envelope.
 */
export async function askModel({ system, prompt, maxTokens }: Ask): Promise<string> {
  const provider = modelProvider();
  if (!provider) throw new ModelError("No model is configured.", "other");

  return provider === "anthropic"
    ? askAnthropic(system, prompt, maxTokens)
    : askGoogle(system, prompt, maxTokens);
}

async function askAnthropic(
  system: string,
  prompt: string,
  maxTokens: number,
): Promise<string> {
  const client = new Anthropic();
  try {
    const message = await client.messages.create({
      model: modelName("anthropic"),
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    return message.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new ModelError("That ANTHROPIC_API_KEY was rejected.", "auth");
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new ModelError("Rate limited. Try again in a moment.", "rate");
    }
    throw err;
  }
}

/**
 * Gemini, over its REST API.
 *
 * Written out rather than pulled in. `@ai-sdk/google` would do this in three
 * lines, and the whole of what it does here is one POST and one field lookup —
 * the same trade the CSV reader in `ledger.ts` makes. It also keeps the
 * dependency list honest about a provider that is expected to be temporary.
 */
async function askGoogle(
  system: string,
  prompt: string,
  maxTokens: number,
): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      modelName("google"),
    )}:generateContent`,
    {
      method: "POST",
      headers: {
        // In a header rather than the query string, so it stays out of logs
        // and out of anything that records a URL.
        "x-goog-api-key": process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    },
  );

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ModelError(
        "That GOOGLE_GENERATIVE_AI_API_KEY was rejected.",
        "auth",
      );
    }
    if (response.status === 429) {
      throw new ModelError("Rate limited. Try again in a moment.", "rate");
    }
    throw new ModelError(`The model answered ${response.status}.`, "other");
  }

  return textFromGemini(await response.json());
}

// ---------------------------------------------------------------------------
// Streaming — the assistant's half.
// ---------------------------------------------------------------------------

/** One turn. `assistant` is Anthropic's word; Gemini's is `model`. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamAsk {
  /** The standing instruction — who the model is and how to answer. */
  system: string;
  /**
   * A large, stable prefix: the chapter.
   *
   * **Kept apart from `system` rather than concatenated into it**, because the
   * two are treated differently on the way out. On Anthropic it becomes its own
   * system block carrying `cache_control`, which is what lets it hold across
   * the turns of a conversation instead of being re-read and re-billed every
   * time the writer types. Concatenated, the cache breakpoint would sit at the
   * end of the whole thing and the instruction above it could never be varied
   * without invalidating the chapter behind it.
   */
  context?: string;
  messages: ChatMessage[];
  maxTokens: number;
  /**
   * Aborts the request at the provider.
   *
   * Not optional in practice: the writer closing the panel is the common case,
   * and without this the tokens go on being generated and billed for a reply
   * nobody will read.
   */
  signal?: AbortSignal;
}

/**
 * Ask, and get the answer a piece at a time.
 *
 * The provider is chosen exactly as `askModel` chooses it, so a deployment with
 * one key has one answer for the whole app rather than an assistant that works
 * and six routes that do not, or the reverse.
 *
 * **What it yields is text, and only text.** Thinking blocks, tool calls and
 * the rest of each provider's envelope are dropped here rather than downstream:
 * the panel renders what arrives, and the two providers disagree about
 * everything except the fact that some of it is prose.
 */
export async function* streamModel(ask: StreamAsk): AsyncGenerator<string> {
  const provider = modelProvider();
  if (!provider) throw new ModelError("No model is configured.", "other");

  yield* provider === "anthropic" ? streamAnthropic(ask) : streamGoogle(ask);
}

async function* streamAnthropic({
  system,
  context,
  messages,
  maxTokens,
  signal,
}: StreamAsk): AsyncGenerator<string> {
  const client = new Anthropic();

  /* Two blocks, and the second carries the cache breakpoint — see `context`. */
  const blocks: Anthropic.TextBlockParam[] = [{ type: "text", text: system }];
  if (context !== undefined) {
    blocks.push({
      type: "text",
      text: context,
      cache_control: { type: "ephemeral" },
    });
  }

  const stream = client.messages.stream(
    {
      model: modelName("anthropic", "chat"),
      max_tokens: maxTokens,
      system: blocks,
      // Adaptive is the only on-mode on Opus 4.8, and it is off unless asked
      // for. Prose problems are worth thinking about.
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    },
    { signal },
  );

  try {
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }

    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      yield "\n\n[The assistant declined this request.]";
    }
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      throw new ModelError("That ANTHROPIC_API_KEY was rejected.", "auth");
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new ModelError("Rate limited. Try again in a moment.", "rate");
    }
    throw err;
  }
}

/**
 * Gemini, streaming, over its REST API — written out for the reason `askGoogle`
 * is.
 *
 * Three differences from the one-shot call, and each has bitten somewhere:
 *
 * - **`?alt=sse`.** Without it `:streamGenerateContent` answers with a JSON
 *   *array* delivered in pieces, which cannot be parsed until the last byte
 *   arrives — a streaming endpoint that does not stream, and the failure looks
 *   exactly like a slow model.
 * - **The role is `model`, not `assistant`.** Gemini rejects the conversation
 *   outright rather than ignoring the unknown word.
 * - **No cache breakpoint.** Gemini's implicit caching is automatic on a
 *   repeated prefix and there is nothing to declare, so `context` simply joins
 *   the system instruction. That is why it is the caller's job to keep it
 *   stable across turns rather than this function's to say so.
 */
async function* streamGoogle({
  system,
  context,
  messages,
  maxTokens,
  signal,
}: StreamAsk): AsyncGenerator<string> {
  const instruction =
    context === undefined ? system : `${system}\n\n${context}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      modelName("google", "chat"),
    )}:streamGenerateContent?alt=sse`,
    {
      method: "POST",
      headers: {
        // In a header rather than the query string, so it stays out of logs
        // and out of anything that records a URL.
        "x-goog-api-key": process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instruction }] },
        contents: messages.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: maxTokens },
      }),
      signal,
    },
  );

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new ModelError(
        "That GOOGLE_GENERATIVE_AI_API_KEY was rejected.",
        "auth",
      );
    }
    if (response.status === 429) {
      throw new ModelError("Rate limited. Try again in a moment.", "rate");
    }
    throw new ModelError(`The model answered ${response.status}.`, "other");
  }
  if (!response.body) throw new ModelError("The model sent no body.", "other");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let rest = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      /* `stream: true` — a multi-byte character split across two network
         chunks decodes to a replacement character otherwise, which in a tool
         that writes novels means an em dash arriving as garbage. */
      const parsed = splitSse(rest + decoder.decode(value, { stream: true }));
      rest = parsed.rest;

      for (const payload of parsed.payloads) {
        let json: unknown;
        try {
          json = JSON.parse(payload);
        } catch {
          /* A keep-alive or a comment line. Not an error, and not text. */
          continue;
        }
        const text = textFromGemini(json);
        if (text) yield text;
      }
    }
  } finally {
    /* Releasing the lock is what lets the connection be torn down when the
       writer closes the panel mid-reply. */
    reader.cancel().catch(() => {});
  }
}

/**
 * Split a buffer of server-sent events into complete `data:` payloads.
 *
 * Pure, and separate from the fetch, because this is the part with an edge:
 * a network chunk is not a message. One read can carry half an event, three
 * events, or an event split mid-word — so whatever follows the last blank line
 * has to be carried forward rather than parsed. Getting that wrong drops
 * roughly one token in ten, invisibly, on exactly the long replies where it
 * matters.
 *
 * Multi-line `data:` fields are joined with a newline, as the SSE spec says;
 * anything that is not a `data:` line (comments, `event:`, `id:`) is ignored.
 */
export function splitSse(buffer: string): { payloads: string[]; rest: string } {
  /* Normalise the line endings first: the spec allows CRLF and Gemini has been
     seen to use it, so splitting on "\n\n" alone leaves a stray "\r" that turns
     valid JSON into a parse error. */
  const text = buffer.replace(/\r\n/g, "\n");
  const chunks = text.split("\n\n");
  /* The last piece has no terminator yet, so it is not a whole event. */
  const rest = chunks.pop() ?? "";

  const payloads: string[] = [];
  for (const chunk of chunks) {
    const data = chunk
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (data) payloads.push(data);
  }

  return { payloads, rest };
}

/**
 * The text out of Gemini's envelope.
 *
 * Exported because it is the part worth testing directly: the reply is nested
 * four deep, every level of it is optional in practice, and a blocked or
 * truncated answer arrives with the same shape minus a field rather than as an
 * error. Returning "" for all of those is right — the parsers downstream
 * already treat an unreadable answer as no answer.
 */
export function textFromGemini(payload: unknown): string {
  const candidates = (payload as { candidates?: unknown })?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return "";

  const parts = (candidates[0] as { content?: { parts?: unknown } })?.content?.parts;
  if (!Array.isArray(parts)) return "";

  return parts
    .map((part) => {
      const text = (part as { text?: unknown })?.text;
      return typeof text === "string" ? text : "";
    })
    .join("");
}

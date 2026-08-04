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
 * **Not the assistant.** `/api/chat` streams, caches the chapter in a system
 * block across turns, and reasons about somebody's prose; it stays on the
 * Anthropic SDK directly and is deliberately not routed through here. This is
 * for the short, bounded, one-shot calls.
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
 * Sensible defaults, overridable per deployment.
 *
 * Both are the cheap, fast tier of their family, which is right for what these
 * routes do: bounded classification over a couple of dozen short records, not
 * open-ended reasoning. `OPENCHAPTER_MODEL` overrides whichever is chosen, for
 * trying a bigger one without a deploy.
 */
const DEFAULTS: Record<Provider, string> = {
  anthropic: "claude-sonnet-5",
  google: "gemini-3.6-flash",
};

/** Which provider this deployment can use, or null for none. */
export function modelProvider(): Provider | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return "google";
  return null;
}

export function modelName(provider: Provider): string {
  return process.env.OPENCHAPTER_MODEL || DEFAULTS[provider];
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

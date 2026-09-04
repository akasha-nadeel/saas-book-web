import { afterEach, describe, expect, it } from "vitest";
import {
  CHAT_MODELS,
  asChatModel,
  chatTuning,
  modelName,
  modelProvider,
  splitSse,
  textFromGemini,
} from "./ai";

const KEYS = [
  "ANTHROPIC_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "OPENCHAPTER_MODEL",
  "OPENCHAPTER_QUICK_MODEL",
  "OPENCHAPTER_CAREFUL_MODEL",
  "OPENCHAPTER_DEEP_MODEL",
] as const;

const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

const only = (set: Partial<Record<(typeof KEYS)[number], string>>) => {
  for (const key of KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(set)) process.env[key] = value;
};

describe("modelProvider", () => {
  it("is null when nothing is configured", () => {
    only({});
    expect(modelProvider()).toBeNull();
  });

  it("uses Google when only its key is set", () => {
    only({ GOOGLE_GENERATIVE_AI_API_KEY: "g" });
    expect(modelProvider()).toBe("google");
  });

  it("uses Anthropic when only its key is set", () => {
    only({ ANTHROPIC_API_KEY: "a" });
    expect(modelProvider()).toBe("anthropic");
  });

  // The whole point of the switch: adding the Anthropic key later takes over
  // without touching a line of code or removing the Google one.
  it("prefers Anthropic when both are set", () => {
    only({ ANTHROPIC_API_KEY: "a", GOOGLE_GENERATIVE_AI_API_KEY: "g" });
    expect(modelProvider()).toBe("anthropic");
  });
});

describe("modelName", () => {
  it("has a default for each provider", () => {
    only({});
    expect(modelName("anthropic")).toBeTruthy();
    expect(modelName("google")).toBeTruthy();
  });

  it("lets a deployment override it without a code change", () => {
    only({ OPENCHAPTER_MODEL: "something-else" });
    expect(modelName("google")).toBe("something-else");
    expect(modelName("anthropic")).toBe("something-else");
  });

  /**
   * **Three models, not one model asked in three different manners.** The
   * credit ladder prices a reply at 10, 30 and 100 on the strength of that; if
   * any two of these returned the same id on Anthropic a writer would be
   * charged ten times over for the same answer, and nothing else in the tree
   * would notice.
   */
  it("asks Anthropic for a different model per assistant job", () => {
    only({});
    expect(modelName("anthropic", "quick")).toBe("claude-haiku-4-5");
    expect(modelName("anthropic", "careful")).toBe("claude-sonnet-5");
    expect(modelName("anthropic", "deep")).toBe("claude-opus-5");

    const ids = CHAT_MODELS.map((model) => modelName("anthropic", model));
    expect(new Set(ids).size).toBe(CHAT_MODELS.length);
  });

  it("overrides one assistant job without moving the others", () => {
    only({ OPENCHAPTER_QUICK_MODEL: "mine" });
    expect(modelName("anthropic", "quick")).toBe("mine");
    expect(modelName("anthropic", "careful")).toBe("claude-sonnet-5");
    expect(modelName("anthropic", "deep")).toBe("claude-opus-5");
    expect(modelName("anthropic", "task")).toBe("claude-sonnet-5");

    only({ OPENCHAPTER_DEEP_MODEL: "yours" });
    expect(modelName("anthropic", "deep")).toBe("yours");
    expect(modelName("anthropic", "quick")).toBe("claude-haiku-4-5");
    expect(modelName("anthropic", "careful")).toBe("claude-sonnet-5");
  });
});

describe("asChatModel", () => {
  it("narrows the three the assistant offers", () => {
    expect(asChatModel("quick")).toBe("quick");
    expect(asChatModel("careful")).toBe("careful");
    expect(asChatModel("deep")).toBe("deep");
  });

  /**
   * **A stored preference outlives a rename, and this is the only thing that
   * says so.**
   *
   * `prefs.assistantModel` is on disk in whatever vocabulary was canonical when
   * the writer last touched the picker. `light` and `close` were canonical for
   * part of 2026-09-04; dropping the map would reset those writers to the
   * default silently, and one who had chosen the thinking model would be
   * answered by the cheap one with nothing on screen to say why.
   *
   * `close` resolves to `careful` rather than `deep` because it was Sonnet
   * under both names — the writer keeps the model they picked instead of being
   * promoted into one that costs ten times as much.
   */
  it("carries a retired vocabulary forward", () => {
    expect(asChatModel("light")).toBe("quick");
    expect(asChatModel("close")).toBe("careful");
  });

  it("refuses everything else, including a model id", () => {
    for (const junk of [
      "task",
      "haiku",
      "claude-haiku-4-5",
      "",
      "Quick",
      "Careful",
      null,
      undefined,
      1,
      {},
    ]) {
      expect(asChatModel(junk)).toBeNull();
    }
  });
});

/**
 * **The assertion standing between Haiku and a 502 nobody can explain.**
 *
 * `claude-haiku-4-5` is a pre-4.6 model: `output_config: { effort }` is rejected
 * by it and `{ type: "adaptive" }` is not its thinking mode. Both fields used to
 * be written straight into the request, which was correct while the assistant
 * was Sonnet on both sides — and would 400 on every Quick reply now, surfacing
 * as `ModelError("other")`, a 502, and a panel saying "The assistant is
 * unavailable" with nothing on screen to explain it.
 *
 * Nothing else in the tree would notice these fields being made unconditional
 * again. There is no test of `streamAnthropic` — it needs a live key — so this
 * is the only guard.
 */
describe("chatTuning", () => {
  it("sends Quick neither thinking nor effort", () => {
    const tuning = chatTuning("quick");
    expect(tuning.thinking).toBeUndefined();
    expect(tuning.output_config).toBeUndefined();
    // Not merely undefined — absent, because the SDK reads the keys.
    expect(Object.keys(tuning)).toEqual([]);
  });

  it("keeps Careful thinking, as the assistant always has", () => {
    expect(chatTuning("careful")).toEqual({
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
    });
  });

  /**
   * **Deep is the same request at a higher effort**, which is the one dial
   * worth turning between two thinking models. A Deep reply is billed a
   * hundred credits against Careful's thirty; if the two sent identical tuning
   * the whole difference would be the model id, and this is what says
   * otherwise.
   */
  it("asks Deep for more effort than Careful", () => {
    expect(chatTuning("deep")).toEqual({
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
    });
  });

  /* The pair travels together: adaptive thinking with no effort is a different
     request from the one this was tuned against, and effort with no thinking is
     rejected outright. */
  it("sends both fields or neither", () => {
    for (const model of CHAT_MODELS) {
      const tuning = chatTuning(model);
      expect(tuning.thinking === undefined).toBe(
        tuning.output_config === undefined,
      );
    }
  });
});

describe("textFromGemini", () => {
  const reply = (parts: unknown) => ({ candidates: [{ content: { parts } }] });

  it("reads the text out of the envelope", () => {
    expect(textFromGemini(reply([{ text: "ok" }]))).toBe("ok");
  });

  it("joins several parts, as a long answer arrives", () => {
    expect(textFromGemini(reply([{ text: "one " }, { text: "two" }]))).toBe("one two");
  });

  /*
   * All of these are real shapes, not hypotheticals: a blocked answer, a
   * truncated one and a safety refusal each arrive as this envelope minus a
   * field rather than as an HTTP error. Empty string is the right reading —
   * the parsers downstream already treat an unreadable answer as no answer,
   * and the routes turn that into a message rather than a crash.
   */
  it("is empty for every shape that is not an answer", () => {
    expect(textFromGemini(null)).toBe("");
    expect(textFromGemini({})).toBe("");
    expect(textFromGemini({ candidates: [] })).toBe("");
    expect(textFromGemini({ candidates: "nope" })).toBe("");
    expect(textFromGemini({ candidates: [{}] })).toBe("");
    expect(textFromGemini({ candidates: [{ content: {} }] })).toBe("");
    expect(textFromGemini(reply("nope"))).toBe("");
  });

  it("skips a part carrying something other than text", () => {
    expect(textFromGemini(reply([{ inlineData: {} }, { text: "kept" }]))).toBe("kept");
  });
});

describe("splitSse", () => {
  /*
   * The whole point of this function, and the bug it exists to prevent.
   *
   * A network chunk is not a message. One `read()` can carry half an event,
   * and a splitter that parsed whatever it was handed would drop that half —
   * silently, since the JSON simply fails to parse and the piece is skipped.
   * On a long reply that is roughly one token in ten going missing, which
   * reads as the model writing badly rather than as a bug.
   */
  it("carries an incomplete event forward instead of parsing it", () => {
    const { payloads, rest } = splitSse('data: {"a":1}\n\ndata: {"b":');
    expect(payloads).toEqual(['{"a":1}']);
    expect(rest).toBe('data: {"b":');
  });

  it("reassembles across reads", () => {
    const first = splitSse('data: {"text":"half');
    expect(first.payloads).toEqual([]);

    const second = splitSse(`${first.rest}-and-half"}\n\n`);
    expect(second.payloads).toEqual(['{"text":"half-and-half"}']);
    expect(second.rest).toBe("");
  });

  it("reads several events out of one chunk", () => {
    const { payloads } = splitSse('data: {"n":1}\n\ndata: {"n":2}\n\n');
    expect(payloads).toEqual(['{"n":1}', '{"n":2}']);
  });

  /*
   * CRLF is allowed by the SSE spec and does turn up. Split on "\n\n" alone
   * and every payload keeps a trailing "\r", which makes valid JSON a parse
   * error — so the stream would arrive completely empty rather than slightly
   * wrong, which is at least a loud failure, but only in production.
   */
  it("survives CRLF line endings", () => {
    const { payloads } = splitSse('data: {"a":1}\r\n\r\n');
    expect(payloads).toEqual(['{"a":1}']);
  });

  it("ignores comments and non-data fields", () => {
    const { payloads } = splitSse(': keep-alive\n\nevent: ping\nid: 7\n\ndata: {"a":1}\n\n');
    expect(payloads).toEqual(['{"a":1}']);
  });

  /* The spec joins repeated `data:` lines within one event with a newline. */
  it("joins a multi-line data field", () => {
    const { payloads } = splitSse("data: one\ndata: two\n\n");
    expect(payloads).toEqual(["one\ntwo"]);
  });

  /* `data:{"a":1}` with no space is as valid as `data: {"a":1}`, and only one
     of the two survives a naive `slice(6)`. */
  it("takes a payload with no space after the colon", () => {
    const { payloads } = splitSse('data:{"a":1}\n\n');
    expect(payloads).toEqual(['{"a":1}']);
  });

  it("has nothing to say about an empty buffer", () => {
    expect(splitSse("")).toEqual({ payloads: [], rest: "" });
  });
});

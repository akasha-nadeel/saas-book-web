import { afterEach, describe, expect, it } from "vitest";
import { modelName, modelProvider, textFromGemini } from "./ai";

const KEYS = [
  "ANTHROPIC_API_KEY",
  "GOOGLE_GENERATIVE_AI_API_KEY",
  "OPENCHAPTER_MODEL",
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

import { describe, expect, it } from "vitest";
import {
  checkDraft,
  MESSAGE_MAX,
  MESSAGE_MIN,
  SENTIMENTS,
  TOPICS,
  toRow,
  type Draft,
} from "./feedback";

function draft(over: Partial<Draft> = {}): Draft {
  return {
    topic: over.topic ?? "editor",
    message: over.message ?? "The chapter list scrolls back to the top.",
    ...(over.sentiment !== undefined ? { sentiment: over.sentiment } : {}),
  };
}

describe("checkDraft", () => {
  it("passes a real note", () => {
    expect(checkDraft(draft())).toBeNull();
  });

  it("refuses an empty box", () => {
    expect(checkDraft(draft({ message: "   " }))).toBe(
      "There is nothing to send yet.",
    );
  });

  it("refuses something too short to act on", () => {
    // "bad" arrives with nothing to do about it, and the writer who sent it
    // believes they have been heard.
    expect(checkDraft(draft({ message: "bad" }))).toMatch(/few more words/);
  });

  it("counts the trimmed message against the minimum", () => {
    const padded = `   ${"a".repeat(MESSAGE_MIN - 1)}   `;
    expect(checkDraft(draft({ message: padded }))).toMatch(/few more words/);
  });

  it("refuses a pasted chapter, and says by how much", () => {
    const long = "a".repeat(MESSAGE_MAX + 1);
    const problem = checkDraft(draft({ message: long })) ?? "";
    expect(problem).toContain((MESSAGE_MAX + 1).toLocaleString());
    expect(problem).toContain(MESSAGE_MAX.toLocaleString());
  });

  it("accepts a message exactly at the limit", () => {
    expect(checkDraft(draft({ message: "a".repeat(MESSAGE_MAX) }))).toBeNull();
  });

  it("refuses a topic that is not on the list", () => {
    // The ids reach a CHECK constraint in the database, which would refuse the
    // row anyway — better to say so in the dialog than to fail on send.
    expect(checkDraft(draft({ topic: "" }))).toBe("Pick what this is about.");
    expect(checkDraft(draft({ topic: "manuscript" }))).toBe(
      "Pick what this is about.",
    );
  });
});

describe("toRow", () => {
  it("trims the message", () => {
    expect(toRow(draft({ message: "  it broke  " })).message).toBe("it broke");
  });

  it("keeps a face that was pressed", () => {
    expect(toRow(draft({ sentiment: "good" })).sentiment).toBe("good");
  });

  it("sends no sentiment as null rather than a middling default", () => {
    // "Did not answer" and "said it was fine" are different things, and
    // averaging them together would be inventing a number.
    expect(toRow(draft()).sentiment).toBeNull();
  });

  it("carries nothing but the topic, the message and the face", () => {
    // The guard on the whole feature: this app's argument is that the
    // manuscript does not leave the browser, so the row that goes to the server
    // must be exactly these three fields and no quiet fourth.
    expect(Object.keys(toRow(draft({ sentiment: "fine" }))).sort()).toEqual([
      "message",
      "sentiment",
      "topic",
    ]);
  });
});

describe("the lists", () => {
  it("has four faces and no middle", () => {
    // An odd scale collects a pile of neutral answers meaning "I did not want
    // to think about it", which tells whoever reads them nothing.
    expect(SENTIMENTS).toHaveLength(4);
    expect(SENTIMENTS.map((s) => s.id)).toEqual(["bad", "poor", "fine", "good"]);
  });

  it("gives every topic and face a distinct id", () => {
    for (const list of [TOPICS.map((t) => t.id), SENTIMENTS.map((s) => s.id)]) {
      expect(new Set(list).size).toBe(list.length);
    }
  });

  it("gives every face a label as well as a glyph", () => {
    // The glyph alone is not a name. These are buttons, and a button whose only
    // content is an emoji is unreadable to a screen reader.
    for (const sentiment of SENTIMENTS) {
      expect(sentiment.label.trim().length).toBeGreaterThan(0);
    }
  });
});

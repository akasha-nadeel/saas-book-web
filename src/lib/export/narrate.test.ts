import { describe, expect, it } from "vitest";
import { speechChunks, trackName } from "./narrate";

describe("speechChunks", () => {
  it("leaves a short chapter as one request", () => {
    expect(speechChunks("She opened the door.")).toEqual([
      "She opened the door.",
    ]);
  });

  it("produces nothing for a chapter with no prose", () => {
    expect(speechChunks("")).toEqual([]);
    expect(speechChunks("   \n\n  ")).toEqual([]);
  });

  it("packs whole paragraphs together up to the limit", () => {
    const chunks = speechChunks("aaaa\n\nbbbb\n\ncccc", 12);
    // "aaaa\n\nbbbb" is 10; adding "cccc" would pass 12.
    expect(chunks).toEqual(["aaaa\n\nbbbb", "cccc"]);
  });

  it("never returns a chunk over the limit", () => {
    const paragraph = "Word ".repeat(400).trim();
    const text = `${paragraph}\n\n${paragraph}`;
    for (const chunk of speechChunks(text, 200)) {
      expect(chunk.length).toBeLessThanOrEqual(200);
    }
  });

  it("cuts a long paragraph at sentence ends, not mid-clause", () => {
    const text =
      "She opened the door. The hall was dark. Morning came late that day.";
    const chunks = speechChunks(text, 40);
    for (const chunk of chunks) {
      // Every cut lands after terminal punctuation.
      expect(chunk).toMatch(/[.!?…]$/);
    }
  });

  it("falls back to words only when a sentence alone is too long", () => {
    const sentence = `${"long ".repeat(60).trim()}.`;
    const chunks = speechChunks(sentence, 50);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(50);
    }
  });

  it("never splits a word in half", () => {
    const chunks = speechChunks("antidisestablishmentarianism ".repeat(6), 40);
    for (const chunk of chunks) {
      for (const word of chunk.split(/\s+/)) {
        expect(word).toBe("antidisestablishmentarianism");
      }
    }
  });

  it("keeps every word, in order", () => {
    const text =
      "One two three. Four five six.\n\nSeven eight nine. Ten eleven twelve.";
    const rejoined = speechChunks(text, 25).join(" ").replace(/\s+/g, " ");
    expect(rejoined).toBe(text.replace(/\s+/g, " "));
  });
});

describe("trackName", () => {
  it("zero-pads so ten does not sort before two", () => {
    expect(trackName(1, 12, "Two")).toBe("02 Two.mp3");
    expect(trackName(9, 12, "Ten")).toBe("10 Ten.mp3");
  });

  it("does not pad when it cannot help", () => {
    expect(trackName(0, 9, "One")).toBe("1 One.mp3");
  });

  it("strips characters a file system will not take", () => {
    expect(trackName(0, 1, 'A/B:C*D?E"F<G>H|I')).toBe("1 ABCDEFGHI.mp3");
  });

  it("names an untitled chapter rather than producing a bare number", () => {
    expect(trackName(0, 1, "   ")).toBe("1 Untitled.mp3");
  });
});

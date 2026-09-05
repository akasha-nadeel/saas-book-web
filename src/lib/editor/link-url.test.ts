import { describe, expect, it } from "vitest";
import { normalizeHref } from "./link-url";

describe("normalizeHref", () => {
  it("puts a scheme on a bare domain", () => {
    expect(normalizeHref("example.com")).toBe("https://example.com");
    expect(normalizeHref("example.com/books/one")).toBe(
      "https://example.com/books/one",
    );
    expect(normalizeHref("www.example.co.uk")).toBe("https://www.example.co.uk");
  });

  it("leaves a full URL alone", () => {
    expect(normalizeHref("https://example.com")).toBe("https://example.com");
    expect(normalizeHref("http://example.com/a?b=c#d")).toBe(
      "http://example.com/a?b=c#d",
    );
  });

  it("keeps the case of the path", () => {
    // Only the scheme is matched case-insensitively; a path can be a case-
    // sensitive key on the far end.
    expect(normalizeHref("HTTPS://example.com/Chapter/One")).toBe(
      "HTTPS://example.com/Chapter/One",
    );
  });

  it("trims what was typed", () => {
    expect(normalizeHref("  example.com  ")).toBe("https://example.com");
  });

  it("reads an address as an address", () => {
    expect(normalizeHref("hello@example.com")).toBe("mailto:hello@example.com");
    expect(normalizeHref("mailto:hello@example.com")).toBe(
      "mailto:hello@example.com",
    );
  });

  it("refuses an empty box", () => {
    expect(normalizeHref("")).toBeNull();
    expect(normalizeHref("   ")).toBeNull();
  });

  it("refuses a scheme with nothing after it", () => {
    // Somebody who started typing and stopped, not a link.
    expect(normalizeHref("https://")).toBeNull();
    expect(normalizeHref("mailto:")).toBeNull();
  });

  it("refuses a word, which is not a host", () => {
    // `https://chapter` looks like a link and goes nowhere, which is worse
    // than saying no.
    expect(normalizeHref("chapter")).toBeNull();
    expect(normalizeHref("see the appendix")).toBeNull();
  });

  it("refuses an address with no host", () => {
    expect(normalizeHref("hello@")).toBeNull();
    expect(normalizeHref("hello@localhost")).toBeNull();
  });

  /**
   * The one input here that is actually dangerous.
   *
   * A manuscript becomes an EPUB, and an EPUB is markup a reading app runs. A
   * script URL typed into the link box would travel into every file the writer
   * ships, so it is refused rather than repaired — guessing that this meant
   * `https://javascript:…` would be worse than declining it.
   */
  it("refuses every scheme but the three a book needs", () => {
    expect(normalizeHref("javascript:alert(1)")).toBeNull();
    expect(normalizeHref("JavaScript:alert(1)")).toBeNull();
    expect(normalizeHref("data:text/html,<script>")).toBeNull();
    expect(normalizeHref("file:///etc/passwd")).toBeNull();
    expect(normalizeHref("vbscript:msgbox")).toBeNull();
  });

  it("does not mistake a path's colon for a scheme", () => {
    // The colon is after the first slash, so this is a host and a path.
    expect(normalizeHref("example.com/a:b")).toBe("https://example.com/a:b");
  });

  it("drops a protocol-relative prefix", () => {
    // `//example.com` has no meaning in a file opened from disk.
    expect(normalizeHref("//example.com")).toBe("https://example.com");
  });
});

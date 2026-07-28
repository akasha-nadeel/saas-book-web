import { describe, expect, it } from "vitest";
import { safeNext } from "./auth-redirect";

describe("safeNext", () => {
  it("keeps a rooted same-site path", () => {
    expect(safeNext("/book/abc/chapter/1")).toBe("/book/abc/chapter/1");
  });

  it("keeps a query string on that path", () => {
    expect(safeNext("/book/abc?view=archived")).toBe("/book/abc?view=archived");
  });

  it("falls back to the shelf when there is nothing to go on", () => {
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext(null)).toBe("/");
    expect(safeNext("")).toBe("/");
    expect(safeNext(42)).toBe("/");
  });

  it("refuses an absolute URL", () => {
    expect(safeNext("https://evil.example/harvest")).toBe("/");
    expect(safeNext("http://evil.example")).toBe("/");
  });

  it("refuses a protocol-relative URL", () => {
    expect(safeNext("//evil.example")).toBe("/");
  });

  it("refuses a backslash path, which some browsers read as protocol-relative", () => {
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext("\\\\evil.example")).toBe("/");
  });

  it("refuses a bare path with no leading slash", () => {
    expect(safeNext("book/abc")).toBe("/");
  });
});

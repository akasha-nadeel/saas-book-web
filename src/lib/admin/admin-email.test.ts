import { describe, expect, it } from "vitest";
import { adminEmails, isAdminEmail } from "./admin-email";

describe("isAdminEmail", () => {
  const env = " Owner@Example.com , second@example.com,";

  it("matches the listed addresses whatever their case and spacing", () => {
    expect(isAdminEmail("owner@example.com", env)).toBe(true);
    expect(isAdminEmail("  OWNER@example.COM ", env)).toBe(true);
    expect(isAdminEmail("second@example.com", env)).toBe(true);
  });

  it("makes nobody admin when the variable is unset or empty", () => {
    expect(isAdminEmail("owner@example.com", undefined)).toBe(false);
    expect(isAdminEmail("owner@example.com", "")).toBe(false);
    expect(isAdminEmail("owner@example.com", " , ")).toBe(false);
  });

  it("never matches a missing address", () => {
    expect(isAdminEmail(null, env)).toBe(false);
    expect(isAdminEmail(undefined, env)).toBe(false);
    expect(isAdminEmail("", env)).toBe(false);
    expect(isAdminEmail(42, env)).toBe(false);
  });

  it("matches whole addresses only — no suffix, no domain", () => {
    expect(isAdminEmail("xowner@example.com", env)).toBe(false);
    expect(isAdminEmail("owner@example.com.evil", env)).toBe(false);
    expect(isAdminEmail("example.com", env)).toBe(false);
    expect(isAdminEmail("@example.com", env)).toBe(false);
  });
});

describe("adminEmails", () => {
  it("drops empty entries", () => {
    expect(adminEmails("a@x.com,,b@x.com, ")).toEqual(["a@x.com", "b@x.com"]);
  });
});

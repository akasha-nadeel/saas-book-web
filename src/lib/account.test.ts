import { describe, expect, it } from "vitest";
import {
  accountFromClaims,
  displayName,
  firstNameOf,
  initialOf,
  type Account,
} from "./account";

/** What Supabase actually puts in the token after a Google sign-in. */
const GOOGLE_CLAIMS = {
  email: "writer@gmail.com",
  user_metadata: {
    avatar_url: "https://lh3.googleusercontent.com/a/photo=s96-c",
    email: "writer@gmail.com",
    full_name: "Akasha Nadeel gunathilake",
    name: "Akasha Nadeel gunathilake",
    picture: "https://lh3.googleusercontent.com/a/photo=s96-c",
  },
};

/** And after an email-and-password signup, which gives none of it. */
const PASSWORD_CLAIMS = {
  email: "writer@gmail.com",
  user_metadata: { email: "writer@gmail.com", email_verified: true },
};

describe("accountFromClaims", () => {
  it("reads the name and photo a provider gave us", () => {
    expect(accountFromClaims(GOOGLE_CLAIMS)).toEqual({
      email: "writer@gmail.com",
      name: "Akasha Nadeel gunathilake",
      avatarUrl: "https://lh3.googleusercontent.com/a/photo=s96-c",
    });
  });

  // The common case, not an error: nothing but an email was ever collected.
  it("leaves name and photo null when there are none", () => {
    expect(accountFromClaims(PASSWORD_CLAIMS)).toEqual({
      email: "writer@gmail.com",
      name: null,
      avatarUrl: null,
    });
  });

  it("survives claims with no user_metadata at all", () => {
    expect(accountFromClaims({ email: "a@b.com" })).toEqual({
      email: "a@b.com",
      name: null,
      avatarUrl: null,
    });
  });

  it("falls back to `name` when `full_name` is absent", () => {
    const account = accountFromClaims({
      user_metadata: { name: "Solo Name" },
    });
    expect(account.name).toBe("Solo Name");
  });

  it("falls back to `picture` when `avatar_url` is absent", () => {
    const account = accountFromClaims({
      user_metadata: { picture: "https://example.com/p.jpg" },
    });
    expect(account.avatarUrl).toBe("https://example.com/p.jpg");
  });

  it("treats blank strings as absent", () => {
    const account = accountFromClaims({
      email: "   ",
      user_metadata: { full_name: "  ", avatar_url: "" },
    });
    expect(account).toEqual({ email: null, name: null, avatarUrl: null });
  });

  // This value goes into an img src and is written by an identity provider
  // rather than by us. Anything that is not plainly https falls back to the
  // initial instead.
  it("refuses an avatar URL that is not https", () => {
    for (const avatar_url of [
      "http://example.com/p.jpg",
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "not a url",
    ]) {
      expect(accountFromClaims({ user_metadata: { avatar_url } }).avatarUrl).toBeNull();
    }
  });

  it("ignores a name that is not a string", () => {
    const account = accountFromClaims({
      user_metadata: { full_name: 42, avatar_url: { href: "https://x.com" } },
    });
    expect(account.name).toBeNull();
    expect(account.avatarUrl).toBeNull();
  });
});

describe("displayName", () => {
  const account = (over: Partial<Account> = {}): Account => ({
    email: "kha.akashanadeel@gmail.com",
    name: null,
    avatarUrl: null,
    ...over,
  });

  it("prefers the real name", () => {
    expect(displayName(account({ name: "Akasha Nadeel gunathilake" }))).toBe(
      "Akasha Nadeel gunathilake",
    );
  });

  // A guess, and a poor one — which is the whole reason the name above wins.
  it("falls back to the email's local part", () => {
    expect(displayName(account())).toBe("kha.akashanadeel");
  });

  it("says Guest when there is no account at all", () => {
    expect(displayName(null)).toBe("Guest");
  });

  it("says Guest when there is neither a name nor an email", () => {
    expect(displayName(account({ email: null }))).toBe("Guest");
  });
});

describe("firstNameOf", () => {
  it("takes the first word", () => {
    expect(firstNameOf("Akasha Nadeel gunathilake")).toBe("Akasha");
  });

  it("leaves a single word alone", () => {
    expect(firstNameOf("Akasha")).toBe("Akasha");
  });

  // The email-fallback case: no spaces, so there is nothing to cut.
  it("leaves an email local part alone", () => {
    expect(firstNameOf("kha.akashanadeel")).toBe("kha.akashanadeel");
  });

  it("ignores surrounding and repeated space", () => {
    expect(firstNameOf("  Akasha   Nadeel ")).toBe("Akasha");
  });

  it("gives back what it was given when there is no word at all", () => {
    expect(firstNameOf("   ")).toBe("   ");
  });
});

describe("initialOf", () => {
  it("takes the first letter, upper-cased", () => {
    expect(initialOf("Akasha Nadeel gunathilake")).toBe("A");
    expect(initialOf("kha.akashanadeel")).toBe("K");
  });

  it("ignores leading space", () => {
    expect(initialOf("  bea")).toBe("B");
  });

  // Sliced by codepoint, so an astral character comes back whole rather than
  // as half a surrogate pair.
  it("handles a name that starts outside the basic plane", () => {
    expect(initialOf("😀 writer")).toBe("😀");
  });

  it("falls back when there is nothing to take", () => {
    expect(initialOf("")).toBe("G");
    expect(initialOf("   ")).toBe("G");
  });
});

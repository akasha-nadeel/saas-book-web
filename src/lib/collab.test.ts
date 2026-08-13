import { describe, expect, it } from "vitest";
import {
  can,
  capabilitiesOf,
  COLLAB_ROLES,
  INVITE_DAYS,
  inviteExpiry,
  inviteProblem,
  invitesFor,
  isLikelyEmail,
  isSharedWithMe,
  type Member,
  memberState,
  normalizeEmail,
  roleFor,
  ROLE_LABELS,
  seatsUsed,
} from "./collab";

const NOW = Date.UTC(2026, 7, 6, 12, 0, 0);
const DAY = 24 * 60 * 60 * 1000;

function member(over: Partial<Member> = {}): Member {
  return {
    id: "m1",
    bookId: "b1",
    email: "ann@example.com",
    userId: "user-ann",
    role: "editor",
    status: "active",
    expiresAt: NOW + 7 * DAY,
    acceptedAt: NOW - DAY,
    ...over,
  };
}

describe("what a role may do", () => {
  /*
   * The one not to "fix". A viewer holds exactly one capability, and the moment
   * a second appears beside it read-only has stopped being read-only — which is
   * half of what this whole feature was asked for. Reedsy is the cautionary
   * case: three advertised permission levels, one enforced.
   */
  it("gives a viewer no way to write anything", () => {
    expect(capabilitiesOf("viewer")).toEqual(["read"]);
    for (const capability of [
      "writeProse",
      "manageChapters",
      "editBook",
      "manageBook",
      "manageMembers",
    ] as const) {
      expect(can("viewer", capability)).toBe(false);
    }
  });

  /*
   * The other half of the same rule, and the reason the line sits at the book
   * rather than at the prose: `last_opened_*` and `position` live on the `books`
   * row and are per-writer, so an editor who could write that row would
   * overwrite the owner's place in the manuscript every few minutes.
   */
  it("lets an editor write the manuscript but not own the book", () => {
    expect(can("editor", "writeProse")).toBe(true);
    expect(can("editor", "manageChapters")).toBe(true);
    expect(can("editor", "editBook")).toBe(false);
    expect(can("editor", "manageBook")).toBe(false);
    expect(can("editor", "manageMembers")).toBe(false);
  });

  it("gives the owner everything, including the member list", () => {
    expect(can("owner", "manageMembers")).toBe(true);
    expect(can("owner", "editBook")).toBe(true);
    expect(can("owner", "manageBook")).toBe(true);
  });

  /*
   * No role is the default rather than a case to remember, so a screen that
   * forgets to look one up refuses rather than permits.
   */
  it("fails closed when there is no role at all", () => {
    expect(capabilitiesOf(null)).toEqual([]);
    for (const capability of ["read", "writeProse", "manageMembers"] as const) {
      expect(can(null, capability)).toBe(false);
    }
  });

  it("names every role it can grant", () => {
    for (const role of COLLAB_ROLES) {
      expect(ROLE_LABELS[role].label).toBeTruthy();
      expect(ROLE_LABELS[role].what).toBeTruthy();
    }
    expect(ROLE_LABELS.owner.label).toBeTruthy();
  });

  /*
   * There is no third rung, and that is a decision rather than an omission: the
   * standard one is a commenter, and there are no comments in this app.
   */
  it("grants two roles and no more", () => {
    expect([...COLLAB_ROLES]).toEqual(["editor", "viewer"]);
  });

  it("knows a book that is somebody else's", () => {
    expect(isSharedWithMe("editor")).toBe(true);
    expect(isSharedWithMe("viewer")).toBe(true);
    // A book made offline has no role at all, and it is the writer's own.
    expect(isSharedWithMe(undefined)).toBe(false);
    expect(isSharedWithMe(null)).toBe(false);
    expect(isSharedWithMe("owner")).toBe(false);
  });
});

describe("how an invitation ages", () => {
  it("dates an invitation from when it was sent", () => {
    expect(inviteExpiry(NOW)).toBe(NOW + INVITE_DAYS * DAY);
  });

  /*
   * Expiry is derived from the stamp, never stored — a stored `expired` status
   * needs something to go round and set it, and until that ran the invitation
   * would still work. This is the assertion that says so.
   */
  it("treats a pending invite past its date as expired", () => {
    const invite = member({ status: "pending", userId: null, expiresAt: NOW - 1 });
    expect(memberState(invite, NOW)).toBe("expired");
    expect(memberState({ ...invite, expiresAt: NOW + 1 }, NOW)).toBe("pending");
  });

  it("never expires somebody who has accepted", () => {
    // An accepted membership has no deadline; they are on the book until they
    // are taken off it.
    const old = member({ expiresAt: NOW - 400 * DAY });
    expect(memberState(old, NOW)).toBe("active");
  });

  it("leaves a revoked membership revoked", () => {
    expect(memberState(member({ status: "revoked" }), NOW)).toBe("revoked");
  });
});

describe("the role somebody actually holds", () => {
  /*
   * Two conditions, both required: active, and carrying *this* user's id.
   * Deciding access on an email match would make an address the credential, and
   * an address is not a secret.
   */
  it("ignores a pending invite that matches only on email", () => {
    const invite = member({ status: "pending", userId: null });
    expect(roleFor([invite], "user-ann")).toBeNull();
  });

  it("ignores a revoked membership", () => {
    expect(roleFor([member({ status: "revoked" })], "user-ann")).toBeNull();
  });

  it("gives an active member their role", () => {
    expect(roleFor([member({ role: "viewer" })], "user-ann")).toBe("viewer");
  });

  it("answers null when nobody is signed in", () => {
    expect(roleFor([member()], null)).toBeNull();
  });

  it("does not confuse two people on one book", () => {
    const members = [
      member({ id: "m1", userId: "user-ann", role: "editor" }),
      member({ id: "m2", userId: "user-raj", role: "viewer", email: "raj@example.com" }),
    ];
    expect(roleFor(members, "user-raj")).toBe("viewer");
    expect(roleFor(members, "user-mia")).toBeNull();
  });
});

describe("invitations waiting for an address", () => {
  it("finds a pending invite by email, whatever the case", () => {
    const invite = member({ status: "pending", userId: null });
    /* `NOW` is passed for the same reason every other test here passes it, and
       this one is the proof: without it `invitesFor` fell back to the real
       clock while the fixture's `expiresAt` stayed pinned at `NOW + 7 days`.
       That is 2026-08-13T12:00Z, so the test passed for a week and then began
       failing forever, mid-afternoon, with nothing changed. A fixture built on
       a fixed date has to be read against that date. */
    expect(invitesFor([invite], "  ANN@Example.com ", NOW)).toHaveLength(1);
  });

  it("leaves out accepted, revoked and expired ones", () => {
    const members = [
      member({ id: "a", status: "active" }),
      member({ id: "b", status: "revoked" }),
      member({ id: "c", status: "pending", userId: null, expiresAt: NOW - 1 }),
    ];
    expect(invitesFor(members, "ann@example.com", NOW)).toEqual([]);
  });

  it("says nothing for an address it does not have", () => {
    expect(invitesFor([member()], "")).toEqual([]);
    expect(invitesFor([member()], null)).toEqual([]);
  });
});

describe("seats", () => {
  /*
   * The one not to "fix": the number on the pricing page is the number of people
   * on the book, so free's two means the writer and one other. Counting only the
   * invited would make "2 people per book" mean three.
   */
  it("counts the owner as one of them", () => {
    expect(seatsUsed([])).toBe(1);
    expect(seatsUsed([member()])).toBe(2);
  });

  /*
   * A pending invitation spends a seat, and this is the assertion that keeps it
   * that way. Not counting them lets an owner be told there is room nine times
   * and then have the refusals land on their co-writers, days later, at the
   * moment each of them presses Accept.
   */
  it("spends a seat on an invitation that has not been accepted", () => {
    const invite = member({ status: "pending", userId: null });
    expect(seatsUsed([invite], NOW)).toBe(2);
  });

  it("gives the seat back when the invite lapses or is revoked", () => {
    expect(
      seatsUsed([member({ status: "pending", userId: null, expiresAt: NOW - 1 })], NOW),
    ).toBe(1);
    expect(seatsUsed([member({ status: "revoked" })], NOW)).toBe(1);
  });
});

describe("the invited address", () => {
  it("has one spelling", () => {
    expect(normalizeEmail("  Ann@Example.COM ")).toBe("ann@example.com");
  });

  it("catches the typo that would make an invite nobody can accept", () => {
    for (const bad of ["", "ann", "ann@", "@example.com", "ann@example", "a n@b.com", "ann@@example.com"]) {
      expect(isLikelyEmail(bad)).toBe(false);
    }
  });

  it("refuses nothing that might be a real address", () => {
    for (const good of [
      "ann@example.com",
      "ann.o'brien+drafts@sub.example.co.uk",
      "a@b.co",
    ]) {
      expect(isLikelyEmail(good)).toBe(true);
    }
  });
});

describe("why an invite cannot be sent", () => {
  it("allows a new address", () => {
    expect(
      inviteProblem("raj@example.com", {
        ownerEmail: "me@example.com",
        members: [member()],
        now: NOW,
      }),
    ).toBeNull();
  });

  it("refuses the owner inviting themselves", () => {
    expect(
      inviteProblem(" ME@example.com ", {
        ownerEmail: "me@example.com",
        members: [],
        now: NOW,
      }),
    ).toMatch(/your own book/i);
  });

  it("tells apart somebody already on the book from somebody already invited", () => {
    expect(
      inviteProblem("ann@example.com", {
        ownerEmail: "me@example.com",
        members: [member({ status: "active" })],
        now: NOW,
      }),
    ).toMatch(/already on this book/i);

    expect(
      inviteProblem("ann@example.com", {
        ownerEmail: "me@example.com",
        members: [member({ status: "pending", userId: null })],
        now: NOW,
      }),
    ).toMatch(/already been invited/i);
  });

  /*
   * A revoked member and an expired invite are both re-invitable — taking
   * somebody off a book is not a ban, and an invitation nobody accepted in a
   * fortnight is exactly the one an owner would want to send again.
   */
  it("lets a revoked or lapsed address be invited again", () => {
    for (const stale of [
      member({ status: "revoked" }),
      member({ status: "pending", userId: null, expiresAt: NOW - 1 }),
    ]) {
      expect(
        inviteProblem("ann@example.com", {
          ownerEmail: "me@example.com",
          members: [stale],
          now: NOW,
        }),
      ).toBeNull();
    }
  });

  it("asks for an address before judging it", () => {
    expect(
      inviteProblem("   ", { ownerEmail: "me@example.com", members: [] }),
    ).toMatch(/enter an email/i);
  });
});

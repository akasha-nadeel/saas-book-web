/**
 * Launch-MVP product decisions that must stay consistent across marketing,
 * pricing, entitlement checks, and upgrade prompts.
 */

export const LAUNCH_PRICING = {
  monthlyUsd: 5.98,
  annualUsd: 53.99,
} as const;

export const LAUNCH_LIMITS = {
  freeBooks: 5,
  freeAssistantRepliesPerMonth: 5,
  proAssistantRepliesPerMonth: 60,
  /**
   * **Every format, on both plans, and the two arrays being identical is the
   * point rather than an oversight.**
   *
   * The launch MVP shipped `["docx"]` here and sold EPUB and PDF as the two
   * things Pro bought. That reversed a rule this app had already written down —
   * *export must never move behind the plan* — and it was the wrong thing to
   * charge for: a writer has to be able to take the book and go, and a tool
   * that holds the finished file back is the one thing this trade's writers
   * have been burned by often enough to look for first. Pro is unlimited books
   * and the assistant's allowance; it is not the door.
   *
   * The pair stays as a pair so the decision has somewhere to live and so
   * narrowing it again is still one edit — `exportAllowed` reads both.
   */
  freeExports: ["docx", "epub", "pdf"],
  proExports: ["docx", "epub", "pdf"],
} as const;

export type LaunchExportFormat = (typeof LAUNCH_LIMITS.proExports)[number];

export function assistantReplyLimit(pro: boolean): number {
  return pro
    ? LAUNCH_LIMITS.proAssistantRepliesPerMonth
    : LAUNCH_LIMITS.freeAssistantRepliesPerMonth;
}

export function exportAllowed(format: string, pro: boolean): boolean {
  const allowed = pro ? LAUNCH_LIMITS.proExports : LAUNCH_LIMITS.freeExports;
  return (allowed as readonly string[]).includes(format);
}

const HIDDEN_BOOK_TOOL_PATHS = new Set([
  "arc",
  "blurb",
  "categories",
  "comps",
  "covers",
  "listing",
  "money",
  "paperback",
  "progress",
  "prose",
  "provenance",
  "read",
  "roadmap",
  "structure",
  "title-check",
  "track",
]);

export function hiddenLaunchRoute(pathname: string): boolean {
  if (pathname === "/tools") return true;
  if (pathname.startsWith("/invite/")) return true;

  const match = pathname.match(/^\/book\/[^/]+\/([^/?#]+)/);
  return match ? HIDDEN_BOOK_TOOL_PATHS.has(match[1]) : false;
}

export const LAUNCH_POST_BACKLOG = [
  "Publishing roadmap",
  "Store listing details",
  "Paperback setup",
  "Comparable-title research",
  "Blurb workshop",
  "Categories and keyword tools",
  "Cover checker",
  "Title check",
  "Structure report",
  "Prose report",
  "Progress and writing record",
  "Money tracking",
  "Advance copies",
  "Collaboration and invitations",
  "Story bible, ideas, and bookmarks panels",
  "Markdown and audiobook export",
] as const;

/**
 * The landing page's section links, in the order the page presents them.
 *
 * In a module of their own, with **no `"use client"`**, because both sides of
 * the boundary read them: the sticky header is a Client Component (it listens
 * for scroll) and the footer column is rendered on the server.
 *
 * That is the whole reason this file exists. Exporting the array from
 * `landing-nav.tsx` instead looks tidier and fails at runtime — Next replaces a
 * client module's exports with client *references* when a Server Component
 * imports them, so `SECTIONS.map` on the server is `.map` of a reference
 * object, not of an array, and the page 500s with "SECTIONS.map is not a
 * function". A plain shared module is imported normally by both.
 *
 * Every href here must match an `id` on the page. A link to a section that does
 * not exist is a table of contents with a missing chapter.
 */
export const SECTIONS = [
  ["Features", "#features"],
  ["Formats", "#formats"],
  ["The path", "#path"],
  ["Publishing checks", "#publishing"],
  ["What's next", "#next"],
  ["FAQ", "#faq"],
] as const;

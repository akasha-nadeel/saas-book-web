/** "$5" for a whole dollar, "$4.99" otherwise: prices are read, not added up. */
export const money = (n: number) =>
  n % 1 === 0 ? `$${n.toFixed(0)}` : `$${n.toFixed(2)}`;

/** What a writer typed, as a price — "$4.99", "4.99" — or null if it is not one. */
export function parsePrice(text: string): number | null {
  const n = Number(text.replace(/[$\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

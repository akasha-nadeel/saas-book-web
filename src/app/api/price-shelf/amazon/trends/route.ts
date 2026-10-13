import { NextResponse } from "next/server";
import { requireAmazonData } from "@/lib/billing/require-amazon-data";
import { amazonDataConfigured, fetchAmazonTrends, TREND_LISTS } from "@/lib/pricing/amazon-source";
import { shelfById } from "@/lib/pricing/shelves";

/**
 * One genre's three Amazon trend lists — new releases, movers & shakers and
 * most wished for — for the Market check's Trends tab. Pro Plus.
 *
 * The same gate, switch and refusals as `/api/price-shelf/amazon`, in the same
 * order, and the same `private, no-store`. Each list answers on its own: a
 * genre where Amazon keeps no Most Wished For list still gets the other two,
 * and the missing one says so rather than showing as empty.
 */
export async function GET(request: Request) {
  const refused = await requireAmazonData("Amazon's trend lists");
  if (refused) return refused;

  if (!amazonDataConfigured()) {
    return NextResponse.json(
      { error: "Amazon's lists aren't switched on yet." },
      { status: 503 },
    );
  }

  const shelf = shelfById(new URL(request.url).searchParams.get("shelf") ?? "");
  if (!shelf) {
    return NextResponse.json({ error: "Choose a genre from the list." }, { status: 400 });
  }

  const lists = await fetchAmazonTrends(shelf);
  if (!lists) {
    return NextResponse.json(
      { error: "There is no Amazon list for this genre yet." },
      { status: 404 },
    );
  }
  if (TREND_LISTS.every((type) => !lists[type].ok && lists[type].reason === "failed")) {
    return NextResponse.json(
      {
        error:
          "Amazon's lists couldn't be fetched just now, so there is nothing to show. Try again in a moment.",
      },
      { status: 502, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  return NextResponse.json(
    { shelf: shelf.id, source: "amazon", store: "us", lists },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

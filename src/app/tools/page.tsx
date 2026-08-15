import type { Metadata } from "next";
import { ToolsPage } from "@/components/landing/tools-page";
import { ALL_TOOLS } from "@/lib/book-tools";

/**
 * `/tools` — the long half of the landing page's tool section.
 *
 * **Public, and it has to be**: it is in `PUBLIC_EXACT` in `src/proxy.ts` for
 * the same reason the four policy pages are. Somebody deciding whether to make
 * an account reads this *before* they have one, and a page describing the
 * product from behind the sign-in wall describes it to nobody.
 *
 * Unlike `/`, this does not branch on the session. The landing page has to,
 * because a signed-in writer opening `/` wants their shelf; there is no second
 * thing `/tools` could be, and a writer already inside who wants to know what a
 * tool does is asking the same question as a visitor.
 */
export const metadata: Metadata = {
  title: `All ${ALL_TOOLS.length} tools · OpenChapter`,
  description:
    "What every tool in OpenChapter does, grouped the way they are grouped in the app: getting the book out, finding its shelf, the writing itself, and what happens once it is published.",
};

export default function Tools() {
  return <ToolsPage />;
}

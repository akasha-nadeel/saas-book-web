import { ImageResponse } from "next/og";
import { LAUNCH_LIMITS } from "@/lib/launch";
import { plural } from "@/lib/plural";
import { OG_LOGO_DATA_URI } from "./opengraph-logo";

/**
 * The card a link to this domain unfurls into.
 *
 * **Drawn, not screenshotted** — the same rule the landing page's figures
 * follow, and for the same reason: a picture of a screen starts lying the day
 * the screen moves, while markup reading `LAUNCH_LIMITS` cannot say "three
 * books" after the limit becomes four.
 *
 * Served at `/opengraph-image`, which carries no file extension, so
 * `src/proxy.ts` names it in the matcher — without that every scraper asking
 * for this image is handed the sign-in page instead.
 *
 * The three facts are ones the code already backs in public: no model is called
 * anywhere in `src/`, `LAUNCH_LIMITS.freeExports` carries all three formats,
 * and the free book count is read rather than typed. Nothing here may say
 * anything the landing page could not.
 *
 * **The column is centred and the mark is on it because of what WhatsApp
 * does** (2026-10-03). The metadata is right — `og:image:width` 1200 and
 * `og:image:height` 630 are both declared and the PNG answers 200 — but
 * WhatsApp still draws a link in a chat as a small *square* thumbnail, and it
 * crops to the centre: a 630-wide band from x=285 to x=915. Against the
 * left-aligned column this card used to carry, that band held the middle of
 * one sentence and nothing else, so a shared link showed "your book in the
 * brows / with the file." and no sign of whose link it was.
 *
 * Centred, the mark and the name sit inside that band whatever else is cut, so
 * the square crop says OpenChapter. **The heading will still be cut in half
 * there and that is accepted** — a 1200-wide sentence cannot survive a 630
 * crop, and the brand surviving is the part worth buying. Everything else that
 * unfurls a link — X, Facebook, LinkedIn, Slack, iMessage — gets the whole
 * 1.91:1 card as before.
 */

export const alt =
  "OpenChapter — write your book in the browser and leave with the file";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          // The MVP landing page's own ground, which is what somebody sees one
          // press later: surface over panel, the darker of the two below.
          background: "linear-gradient(135deg, #141b34 0%, #080e26 100%)",
          color: "#f1f2fa",
          padding: "56px 80px",
        }}
      >
        {/* The tile is white rather than the mark being drawn bare: the source
            art is #0F68FA on transparency, which against this navy leaves the
            inner strokes near 3.4:1. The favicon solves it the same way. */}
        <div
          style={{
            display: "flex",
            width: 116,
            height: 116,
            borderRadius: 28,
            background: "#ffffff",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={OG_LOGO_DATA_URI} width={88} height={88} alt="" />
        </div>

        <div
          style={{
            fontSize: 30,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#8ab4ff",
            marginTop: 22,
            flexShrink: 0,
          }}
        >
          OpenChapter
        </div>

        <div
          style={{
            // 58 rather than 64, and a narrower measure than the left-aligned
            // card used: the mark costs 138px of the 630 and the sentence has
            // to stay at two lines, or the column stands taller than the card
            // and flex children shrink until the lines sit on each other.
            fontSize: 58,
            lineHeight: 1.15,
            marginTop: 20,
            maxWidth: 980,
            flexShrink: 0,
          }}
        >
          Write your book in the browser. Leave with the file.
        </div>

        <div
          style={{
            fontSize: 28,
            marginTop: 22,
            color: "#bcc5de",
            maxWidth: 940,
            flexShrink: 0,
          }}
        >
          A quiet editor for a whole manuscript — chapters, notes, versions and
          front matter.
        </div>

        <div style={{ display: "flex", gap: 20, marginTop: 34, flexShrink: 0 }}>
          {[
            "No AI",
            "EPUB, PDF & Word",
            `Free for ${plural(LAUNCH_LIMITS.freeBooks, "book")}`,
          ].map((fact) => (
            <div
              key={fact}
              style={{
                fontSize: 26,
                padding: "13px 24px",
                borderRadius: 999,
                border: "2px solid #29335a",
                color: "#f1f2fa",
              }}
            >
              {fact}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}

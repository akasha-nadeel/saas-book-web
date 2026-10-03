import { ImageResponse } from "next/og";
import { LAUNCH_LIMITS } from "@/lib/launch";
import { plural } from "@/lib/plural";

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
          justifyContent: "center",
          // The MVP landing page's own ground, which is what somebody sees one
          // press later: surface over panel, the darker of the two below.
          background: "linear-gradient(135deg, #141b34 0%, #080e26 100%)",
          color: "#f1f2fa",
          padding: "72px 80px",
        }}
      >
        <div
          style={{
            fontSize: 30,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#8ab4ff",
          }}
        >
          OpenChapter
        </div>

        <div
          style={{
            fontSize: 76,
            lineHeight: 1.1,
            marginTop: 28,
            maxWidth: 940,
          }}
        >
          Write your book in the browser. Leave with the file.
        </div>

        <div
          style={{
            fontSize: 32,
            marginTop: 32,
            color: "#bcc5de",
            maxWidth: 940,
          }}
        >
          A quiet editor for a whole manuscript — chapters, notes, versions and
          front matter.
        </div>

        <div style={{ display: "flex", gap: 20, marginTop: 52 }}>
          {[
            "No AI",
            "EPUB, PDF & Word",
            `Free for ${plural(LAUNCH_LIMITS.freeBooks, "book")}`,
          ].map((fact) => (
            <div
              key={fact}
              style={{
                fontSize: 27,
                padding: "14px 26px",
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

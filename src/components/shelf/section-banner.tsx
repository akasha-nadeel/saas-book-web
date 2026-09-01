import Link from "next/link";

/**
 * The picture band at the head of a section.
 *
 * **A photograph with the words on it, not a card with a picture beside it.**
 * Every one of these is 2752×1536 — the same shape and the same job as
 * `resume-card-background.jpg` — so the picture is the ground and the type
 * sits on it, the way `ResumeCard` is built.
 *
 * **This was `OverviewBanner` and became a component on its third use.** There
 * are five now — Overview, and one for each of the four lists in Write — and
 * the alternative was five files that would have drifted apart within a week.
 * What each one carries is a row in a table (`VIEW_BANNERS` in
 * `bookshelf.tsx`); a sixth section is one entry, not one component.
 *
 * **`ink` is a prop rather than a token, and that is the important part.** A
 * banner's ground is a photograph, which is the same picture in both themes —
 * so a colour that inverted with the theme would put white type on a light
 * illustration by night. Each banner's ink is decided by measuring *its own
 * picture* and stated once, in the table. It is the rule `--color-stop-solid`
 * already follows, and the reason that token writes its white at the call site.
 *
 * **`scrim` is off by default and each use of it is earned.** Most of these
 * pictures carry type that clears 4.5:1 across the whole region it sits on, so
 * they show exactly as they are. The ones that switch it on have a bright
 * passage where the contrast falls under the line — the table says which, and
 * by how much. A scrim on a picture that does not need one is just a dimmer
 * picture.
 */

export type BannerInk = "light" | "dark";

export interface SectionBannerProps {
  /** A path under `public/`. */
  image: string;
  /** The headline. */
  title: string;
  /** The line under it. */
  subtitle: string;
  /** Small caps above the headline. Overview's is the only one so far. */
  eyebrow?: string;
  /** Decided by measuring the picture, never by the theme. */
  ink: BannerInk;
  /** `background-position`. The pan, since `cover` crops the sides. */
  crop?: string;
  /** A ground under the words, for a picture with a bright passage in it. */
  scrim?: boolean;
  /** The one banner with something to press. */
  action?: { label: string; href: string };
}

/* Near-white and near-black rather than pure, which is what the rest of the app
   sets its type in: a hard #fff on a photograph glares, and a hard #000 reads
   as a hole in one. */
const INK: Record<BannerInk, { title: string; body: string; eyebrow: string }> = {
  light: { title: "#f6f6f8", body: "#e4e4ea", eyebrow: "#c9c9d2" },
  dark: { title: "#141310", body: "#2c2a24", eyebrow: "#3d3a33" },
};

export function SectionBanner({
  image,
  title,
  subtitle,
  eyebrow,
  ink,
  crop = "center",
  scrim = false,
  action,
}: SectionBannerProps) {
  const colour = INK[ink];

  return (
    <section
      className={`relative isolate flex min-h-52 flex-col justify-center
                  overflow-hidden rounded-lg border p-6 shadow-sm sm:min-h-64
                  sm:p-8 ${ink === "light" ? "border-white/15" : "border-black/10"}`}
    >
      <div
        aria-hidden
        className="absolute inset-0 -z-20 bg-cover"
        style={{ backgroundImage: `url('${image}')`, backgroundPosition: crop }}
      />
      {/* Heaviest under the type and clearing by 55%, so the half of the
          picture with no words on it shows at full strength. Dark under light
          type, light under dark type — the veil follows the ink. */}
      {scrim && (
        <div
          aria-hidden
          className={`absolute inset-0 -z-10 ${
            ink === "light"
              ? "bg-[linear-gradient(105deg,rgba(0,0,0,0.72)_0%,rgba(0,0,0,0.5)_30%,rgba(0,0,0,0)_55%)]"
              : "bg-[linear-gradient(105deg,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0.5)_30%,rgba(255,255,255,0)_55%)]"
          }`}
        />
      )}

      {eyebrow && (
        <p
          className="text-xs font-semibold tracking-[0.08em] uppercase"
          style={{ color: colour.eyebrow }}
        >
          {eyebrow}
        </p>
      )}

      {/* `max-w-xs` on both: these pictures put their subject in the middle of
          the frame, and a wider measure runs the words into it. */}
      <h2
        className={`max-w-xs text-xl font-bold text-balance sm:text-2xl ${
          eyebrow ? "mt-2" : ""
        }`}
        style={{ color: colour.title }}
      >
        {title}
      </h2>
      <p
        className="mt-2 max-w-xs text-sm leading-relaxed"
        style={{ color: colour.body }}
      >
        {subtitle}
      </p>

      {action && (
        /* **Apricot, and both values are written here rather than tokenised**
           — the fill sits on a photograph and does not invert, so a token that
           crossed over would put the wrong ink on it by day. No border, at the
           owner's request; the shadow is what lifts it off the picture. */
        <Link
          href={action.href}
          className="mt-5 inline-flex w-fit items-center gap-2 rounded-lg
                     bg-[#febc8c] px-4 py-2 text-sm font-semibold text-[#2a1a0e]
                     shadow-md transition-opacity hover:opacity-90"
        >
          {action.label}
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </section>
  );
}

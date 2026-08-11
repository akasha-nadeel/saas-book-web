/**
 * The face the blurb workshop answers in.
 *
 * **Drawn rather than shipped as a picture**, which is the same call the tool
 * marks and the landing figures make. A 36px avatar as a bitmap needs a 72px
 * and a 108px copy for the screens that ask for them, cannot take the theme,
 * and is a request; nine paths cost nothing and stay sharp at any size. It is
 * the one drawn thing in the app that is a *character* rather than a symbol,
 * which is the point — a conversation reads as a conversation when the other
 * side has a face.
 *
 * **The blue is its own, and that is deliberate.** The chrome spends one
 * colour on "this is the way forward" and the marks in `tool-marks.tsx` keep
 * theirs because a product mark is a thing you learn to recognise. This is the
 * second kind: it identifies a speaker, so it holds its blue in both themes
 * rather than following `--color-accent`, which goes white at night and would
 * leave a white disc in a dark panel.
 */
export function ReaderMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      className="shrink-0"
    >
      <defs>
        {/* Lit from the top, like every real object. A flat disc reads as a
            sticker; two stops are the whole difference. The id carries the
            size so two marks at different sizes on one screen cannot collide
            in the document's id space. */}
        <linearGradient id={`rm-disc-${size}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6b9dff" />
          <stop offset="1" stopColor="#2f6bef" />
        </linearGradient>
        <linearGradient id={`rm-head-${size}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#dce6fb" />
        </linearGradient>
      </defs>

      <circle cx="24" cy="24" r="24" fill={`url(#rm-disc-${size})`} />

      {/* The aerials go behind the head, so the head's own edge cuts them —
          which is what makes them read as attached rather than as two pins
          lying on top of the face. */}
      <g stroke="#e6edfd" strokeWidth="2.2" strokeLinecap="round">
        <path d="M15.5 21 12.5 16" />
        <path d="M32.5 21 35.5 16" />
      </g>
      <circle cx="12" cy="15" r="2.6" fill="#f2f6ff" />
      <circle cx="36" cy="15" r="2.6" fill="#f2f6ff" />

      {/*
       * Head and speech tail as one shape rather than two.
       *
       * The tail is the whole idea of the mark — a face that is also the thing
       * a reply comes out of — and drawn as a separate triangle it never quite
       * meets the curve above it at every size. One path has no seam to get
       * wrong.
       */}
      <path
        d="M24 19.5c7.7 0 13.5 4.4 13.5 10.4 0 4.3-3 7.9-7.6 9.5l.4 5.6-6-4.9
           c-.1 0-.2 0-.3 0-7.7 0-13.5-4.4-13.5-10.2S16.3 19.5 24 19.5Z"
        fill={`url(#rm-head-${size})`}
      />

      {/* Wide-set and low: eyes at the centre of a head read as a mask, and
          the pair is what makes this a face rather than a badge. */}
      <circle cx="18.6" cy="29" r="3.1" fill="#1c2333" />
      <circle cx="29.4" cy="29" r="3.1" fill="#1c2333" />
      {/* One highlight each, on the same side, or the two eyes look crossed. */}
      <circle cx="17.6" cy="28" r="1" fill="#ffffff" opacity=".9" />
      <circle cx="28.4" cy="28" r="1" fill="#ffffff" opacity=".9" />
    </svg>
  );
}
